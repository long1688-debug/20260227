/**
 * 音频和视频同步管理器
 * 解决需求9：音频控制区域音量调节、视频同步播放等问题
 */
import { ref, computed, watch, onUnmounted } from 'vue'

export function useAudioSyncManager() {
  // 音频控制状态
  const masterVolume = ref(100)
  const masterMuted = ref(false)
  const currentPlayingSource = ref(null)
  
  // 同步组 - 同一信号源的多个播放实例
  const syncGroups = new Map() // sourceId -> { master: videoEl, slaves: Set<videoEl> }
  
  // 播放状态追踪
  const playbackStates = new Map() // sourceId -> { isPlaying, currentTime, duration }
  
  // 全局音频上下文
  let audioContext = null
  
  /**
   * 初始化音频上下文
   */
  const initAudioContext = () => {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)()
    }
    return audioContext
  }
  
  /**
   * 注册视频到同步组
   * @param {HTMLVideoElement} videoElement - 视频元素
   * @param {string} sourceId - 信号源ID
   * @param {boolean} isMaster - 是否为主控视频
   */
  const registerVideo = (videoElement, sourceId, isMaster = false) => {
    if (!videoElement || !sourceId) return
    
    // 初始化同步组
    if (!syncGroups.has(sourceId)) {
      syncGroups.set(sourceId, { master: null, slaves: new Set() })
    }
    
    const group = syncGroups.get(sourceId)
    
    if (isMaster || !group.master) {
      // 设置为主控
      if (group.master && group.master !== videoElement) {
        // 将旧主控转为从属
        group.slaves.add(group.master)
      }
      group.master = videoElement
      
      // 添加主控事件监听
      addMasterListeners(videoElement, sourceId)
    } else {
      // 添加为从属
      group.slaves.add(videoElement)
      
      // 添加从属事件监听
      addSlaveListeners(videoElement, sourceId)
    }
    
    console.log(`[AudioSync] 注册视频: sourceId=${sourceId}, isMaster=${isMaster}`)
  }
  
  /**
   * 移除视频从同步组
   */
  const unregisterVideo = (videoElement, sourceId) => {
    if (!videoElement || !sourceId) return
    
    const group = syncGroups.get(sourceId)
    if (!group) return
    
    if (group.master === videoElement) {
      // 移除主控，提升第一个从属为主控
      const firstSlave = group.slaves.values().next().value
      if (firstSlave) {
        group.slaves.delete(firstSlave)
        group.master = firstSlave
        addMasterListeners(firstSlave, sourceId)
      } else {
        group.master = null
      }
    } else {
      group.slaves.delete(videoElement)
    }
    
    // 移除事件监听
    removeVideoListeners(videoElement)
    
    // 如果组为空，删除组
    if (!group.master && group.slaves.size === 0) {
      syncGroups.delete(sourceId)
    }
    
    console.log(`[AudioSync] 移除视频: sourceId=${sourceId}`)
  }
  
  /**
   * 添加主控视频事件监听
   */
  const addMasterListeners = (videoElement, sourceId) => {
    const handlers = {
      play: () => onMasterPlay(sourceId),
      pause: () => onMasterPause(sourceId),
      seeked: () => onMasterSeeked(sourceId),
      timeupdate: () => onMasterTimeUpdate(sourceId),
      volumechange: () => onVolumeChange(sourceId)
    }
    
    videoElement._syncHandlers = handlers
    videoElement.addEventListener('play', handlers.play)
    videoElement.addEventListener('pause', handlers.pause)
    videoElement.addEventListener('seeked', handlers.seeked)
    videoElement.addEventListener('timeupdate', handlers.timeupdate)
    videoElement.addEventListener('volumechange', handlers.volumechange)
  }
  
  /**
   * 添加从属视频事件监听
   */
  const addSlaveListeners = (videoElement, sourceId) => {
    const handlers = {
      // 从属不应响应用户交互，只被动同步
      volumechange: () => {
        // 确保从属跟随主控音量
        syncSlaveVolume(videoElement, sourceId)
      }
    }
    
    videoElement._slaveHandlers = handlers
    videoElement.addEventListener('volumechange', handlers.volumechange)
  }
  
  /**
   * 移除视频所有事件监听
   */
  const removeVideoListeners = (videoElement) => {
    if (videoElement._syncHandlers) {
      const handlers = videoElement._syncHandlers
      videoElement.removeEventListener('play', handlers.play)
      videoElement.removeEventListener('pause', handlers.pause)
      videoElement.removeEventListener('seeked', handlers.seeked)
      videoElement.removeEventListener('timeupdate', handlers.timeupdate)
      videoElement.removeEventListener('volumechange', handlers.volumechange)
      delete videoElement._syncHandlers
    }
    
    if (videoElement._slaveHandlers) {
      const handlers = videoElement._slaveHandlers
      videoElement.removeEventListener('volumechange', handlers.volumechange)
      delete videoElement._slaveHandlers
    }
  }
  
  /**
   * 主控播放事件处理
   */
  const onMasterPlay = (sourceId) => {
    const group = syncGroups.get(sourceId)
    if (!group) return
    
    // 更新播放状态
    playbackStates.set(sourceId, { ...playbackStates.get(sourceId), isPlaying: true })
    
    // 同步所有从属
    group.slaves.forEach(slave => {
      if (slave.paused) {
        slave.play().catch(err => {
          if (err.name !== 'AbortError') {
            console.warn('[AudioSync] 从属播放失败:', err)
          }
        })
      }
    })
    
    console.log(`[AudioSync] 主控播放，同步${group.slaves.size}个从属`)
  }
  
  /**
   * 主控暂停事件处理
   */
  const onMasterPause = (sourceId) => {
    const group = syncGroups.get(sourceId)
    if (!group) return
    
    // 更新播放状态
    playbackStates.set(sourceId, { ...playbackStates.get(sourceId), isPlaying: false })
    
    // 同步所有从属
    group.slaves.forEach(slave => {
      if (!slave.paused) {
        slave.pause()
      }
    })
    
    console.log(`[AudioSync] 主控暂停，同步${group.slaves.size}个从属`)
  }
  
  /**
   * 主控跳转事件处理
   */
  const onMasterSeeked = (sourceId) => {
    const group = syncGroups.get(sourceId)
    const master = group?.master
    if (!master) return
    
    const currentTime = master.currentTime
    
    // 更新播放状态
    playbackStates.set(sourceId, { 
      ...playbackStates.get(sourceId), 
      currentTime 
    })
    
    // 同步所有从属
    group.slaves.forEach(slave => {
      if (Math.abs(slave.currentTime - currentTime) > 0.5) {
        slave.currentTime = currentTime
      }
    })
    
    console.log(`[AudioSync] 主控跳转至${currentTime}秒`)
  }
  
  /**
   * 主控时间更新处理
   */
  const onMasterTimeUpdate = (sourceId) => {
    const group = syncGroups.get(sourceId)
    const master = group?.master
    if (!master) return
    
    playbackStates.set(sourceId, {
      ...playbackStates.get(sourceId),
      currentTime: master.currentTime,
      duration: master.duration
    })
  }
  
  /**
   * 音量变化处理
   */
  const onVolumeChange = (sourceId) => {
    syncGroupVolume(sourceId)
  }
  
  /**
   * 同步从属音量
   */
  const syncSlaveVolume = (slave, sourceId) => {
    const master = syncGroups.get(sourceId)?.master
    if (!master) return
    
    if (slave.volume !== master.volume || slave.muted !== master.muted) {
      slave.volume = master.volume
      slave.muted = master.muted
    }
  }
  
  /**
   * 同步整个组的音量
   */
  const syncGroupVolume = (sourceId) => {
    const group = syncGroups.get(sourceId)
    const master = group?.master
    if (!master) return
    
    group.slaves.forEach(slave => {
      slave.volume = master.volume
      slave.muted = master.muted
    })
  }
  
  /**
   * 设置全局音量
   */
  const setMasterVolume = (volume) => {
    masterVolume.value = Math.max(0, Math.min(100, volume))
    masterMuted.value = volume === 0
    
    // 应用到所有主控
    syncGroups.forEach((group, sourceId) => {
      if (group.master) {
        group.master.volume = masterVolume.value / 100
        group.master.muted = masterMuted.value
      }
      syncGroupVolume(sourceId)
    })
    
    console.log(`[AudioSync] 设置全局音量: ${masterVolume.value}%`)
  }
  
  /**
   * 切换静音
   */
  const toggleMute = () => {
    masterMuted.value = !masterMuted.value
    
    // 应用到所有视频
    syncGroups.forEach((group) => {
      if (group.master) {
        group.master.muted = masterMuted.value
      }
      group.slaves.forEach(slave => {
        slave.muted = masterMuted.value
      })
    })
    
    console.log(`[AudioSync] 切换静音: ${masterMuted.value}`)
  }
  
  /**
   * 播放指定源
   */
  const playSource = async (sourceId) => {
    const group = syncGroups.get(sourceId)
    const master = group?.master
    if (!master) {
      console.warn(`[AudioSync] 未找到源: ${sourceId}`)
      return
    }
    
    try {
      await master.play()
      currentPlayingSource.value = sourceId
      console.log(`[AudioSync] 播放源: ${sourceId}`)
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[AudioSync] 播放失败:', err)
      }
    }
  }
  
  /**
   * 暂停指定源
   */
  const pauseSource = (sourceId) => {
    const group = syncGroups.get(sourceId)
    const master = group?.master
    if (!master) return
    
    master.pause()
    
    if (currentPlayingSource.value === sourceId) {
      currentPlayingSource.value = null
    }
    
    console.log(`[AudioSync] 暂停源: ${sourceId}`)
  }
  
  /**
   * 跳转指定源到指定时间
   */
  const seekSource = (sourceId, time) => {
    const group = syncGroups.get(sourceId)
    const master = group?.master
    if (!master) return
    
    master.currentTime = time
    
    // 同步所有从属
    group.slaves.forEach(slave => {
      slave.currentTime = time
    })
    
    console.log(`[AudioSync] 跳转源 ${sourceId} 至 ${time}秒`)
  }
  
  /**
   * 获取源播放状态
   */
  const getPlaybackState = (sourceId) => {
    return playbackStates.get(sourceId) || { 
      isPlaying: false, 
      currentTime: 0, 
      duration: 0 
    }
  }
  
  /**
   * 获取所有播放中的源
   */
  const getPlayingSources = () => {
    const sources = []
    playbackStates.forEach((state, sourceId) => {
      if (state.isPlaying) {
        sources.push(sourceId)
      }
    })
    return sources
  }
  
  /**
   * 暂停所有源
   */
  const pauseAll = () => {
    syncGroups.forEach((group, sourceId) => {
      if (group.master && !group.master.paused) {
        group.master.pause()
      }
    })
    currentPlayingSource.value = null
    console.log('[AudioSync] 暂停所有源')
  }
  
  /**
   * 清理所有
   */
  const cleanup = () => {
    syncGroups.forEach((group, sourceId) => {
      if (group.master) {
        removeVideoListeners(group.master)
      }
      group.slaves.forEach(slave => {
        removeVideoListeners(slave)
      })
    })
    
    syncGroups.clear()
    playbackStates.clear()
    
    if (audioContext) {
      audioContext.close()
      audioContext = null
    }
    
    console.log('[AudioSync] 清理完成')
  }
  
  // 组件卸载时清理
  onUnmounted(() => {
    cleanup()
  })
  
  return {
    // 状态
    masterVolume,
    masterMuted,
    currentPlayingSource,
    
    // 方法
    initAudioContext,
    registerVideo,
    unregisterVideo,
    setMasterVolume,
    toggleMute,
    playSource,
    pauseSource,
    seekSource,
    getPlaybackState,
    getPlayingSources,
    pauseAll,
    cleanup
  }
}

// 创建全局单例
let globalAudioSyncManager = null

export function useGlobalAudioSyncManager() {
  if (!globalAudioSyncManager) {
    globalAudioSyncManager = useAudioSyncManager()
  }
  return globalAudioSyncManager
}
