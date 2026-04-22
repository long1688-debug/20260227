import { ref, watch, onMounted, onUnmounted, watchEffect } from 'vue'
import { useMediaStore } from '@/stores/mediaStore'
import { useAudioStore } from '@/stores/audioStore'
import { audioMixer } from '@/utils/audioMixer'

/**
 * 音频混音器管理 Composable
 * 增强版：监听store中的音频源选择变化，同步到混音器，并提供完整的混音器控制功能
 */
export function useAudioMixerControl() {
  const mediaStore = useMediaStore()
  const audioStore = useAudioStore()

  // 混音器状态
  const isInitialized = ref(false)
  const masterLevel = ref(0)
  const sourceLevels = ref(new Map())

  // 分析器
  let masterAnalyser = null
  let levelUpdateInterval = null

  // 当全局 activeAudioSourceId 变化时,更新混音器
  watchEffect(() => {
    const activeSourceId = mediaStore.activeAudioSourceId
    
    if (activeSourceId) {
      // 激活选中的音频源
      audioMixer.setActiveSource(activeSourceId)
      console.log('[useAudioMixerControl] 激活音频源:', activeSourceId)
    } else {
      // 关闭所有音频输出
      audioMixer.setActiveSource(null)
      console.log('[useAudioMixerControl] 关闭所有音频输出')
    }
  })

  // 监听通道音量变化
  watch(
    () => audioStore.channels,
    (channels) => {
      channels.forEach(channel => {
        audioMixer.setVolume(channel.id, channel.volume / 100)
      })
    },
    { deep: true }
  )

  // 监听主音量变化
  watch(
    () => audioStore.microphoneVolume,
    (volume) => {
      audioMixer.setVolume('master', volume / 100)
    }
  )

  // 监听静音状态变化
  watch(
    () => audioStore.microphoneMuted,
    (muted) => {
      if (muted) {
        audioMixer.setVolume('master', 0)
      }
    }
  )

  /**
   * 初始化混音器
   */
  const initMixer = async () => {
    try {
      await audioMixer.init()
      isInitialized.value = true
      
      // 创建主分析器用于电平监测
      masterAnalyser = audioMixer.context.createAnalyser()
      masterAnalyser.fftSize = 256
      audioMixer.masterGain.connect(masterAnalyser)
      
      // 开始电平监测
      startLevelMonitoring()
      
      console.log('[useAudioMixerControl] 混音器初始化成功')
      return true
    } catch (error) {
      console.error('[useAudioMixerControl] 混音器初始化失败:', error)
      return false
    }
  }

  /**
   * 开始电平监测
   */
  const startLevelMonitoring = () => {
    if (levelUpdateInterval) {
      clearInterval(levelUpdateInterval)
    }

    levelUpdateInterval = setInterval(() => {
      if (masterAnalyser) {
        const dataArray = new Uint8Array(masterAnalyser.frequencyBinCount)
        masterAnalyser.getByteFrequencyData(dataArray)
        
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        masterLevel.value = Math.round((average / 255) * 100)
      }

      // 更新各个源的电平
      updateSourceLevels()
    }, 50)
  }

  /**
   * 更新各个源的电平
   */
  const updateSourceLevels = () => {
    const sources = audioMixer.getRegisteredSources()
    sources.forEach(sourceId => {
      // 这里可以添加更详细的电平分析
      const level = Math.random() * 30 + 10 // 模拟电平
      sourceLevels.value.set(sourceId, level)
    })
  }

  /**
   * 注册视频元素到混音器
   */
  const registerVideo = (sourceId, videoElement, audioEnabled = true, volume = 100) => {
    if (!isInitialized.value) {
      console.warn('[useAudioMixerControl] 混音器未初始化')
      return false
    }
    audioMixer.registerVideoElement(sourceId, videoElement, audioEnabled, volume)
    return true
  }

  /**
   * 注销视频元素
   */
  const unregisterVideo = (sourceId) => {
    audioMixer.disconnectSource(sourceId)
  }

  /**
   * 设置活跃音频源
   */
  const setActiveSource = (sourceId) => {
    audioMixer.setActiveSource(sourceId)
  }

  /**
   * 设置源音量
   */
  const setSourceVolume = (sourceId, volume) => {
    audioMixer.setVolume(sourceId, volume / 100)
  }

  /**
   * 获取混音器状态
   */
  const getMixerStatus = () => {
    return {
      isInitialized: isInitialized.value,
      registeredSources: audioMixer.getRegisteredSources(),
      activeSource: audioMixer.getActiveSource(),
      masterLevel: masterLevel.value,
      sourceLevels: Object.fromEntries(sourceLevels.value)
    }
  }

  /**
   * 用户交互时恢复 AudioContext
   * 必须在用户点击/触摸等交互后调用
   */
  const resumeAudio = async () => {
    try {
      if (!isInitialized.value) {
        await initMixer()
      }
      await audioMixer.resume()
      console.log('[useAudioMixerControl] AudioContext 已恢复')
    } catch (error) {
      console.error('[useAudioMixerControl] 恢复 AudioContext 失败:', error)
    }
  }

  /**
   * 清理资源
   */
  const cleanup = () => {
    if (levelUpdateInterval) {
      clearInterval(levelUpdateInterval)
    }
    audioMixer.close()
    isInitialized.value = false
  }

  return {
    // 状态
    isInitialized,
    masterLevel,
    sourceLevels,

    // 方法
    initMixer,
    resumeAudio,
    registerVideo,
    unregisterVideo,
    setActiveSource,
    setSourceVolume,
    getMixerStatus,
    cleanup
  }
}
