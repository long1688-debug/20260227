/**
 * 直播管理 Store
 * 
 * 职责：
 * - 管理 RTMP 推流状态和配置
 * - 管理直播开始/停止
 * - 管理直播统计信息
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useLiveStreamingStore = defineStore('liveStreaming', () => {
  // ============================================
  // 状态定义
  // ============================================
  
  /** 是否正在直播 */
  const isStreaming = ref(false)
  
  /** 直播开始时间戳 */
  const startTime = ref(null)
  
  /** 直播持续时间（秒） */
  const duration = ref(0)
  
  /** 当前观众数 */
  const viewers = ref(0)
  
  /** 当前推流码率 (kbps) */
  const currentBitrate = ref(0)
  
  /** RTMP 推流配置 */
  const rtmpConfig = ref({
    url: '',
    streamKey: '',
    bitrate: 2500,
    resolution: '1920x1080',
    fps: 30
  })
  
  /** 直播历史记录 */
  const streamingHistory = ref([])
  
  /** 直播错误信息 */
  const errorMessage = ref('')

  // ============================================
  // Actions
  // ============================================
  
  /**
   * 开始直播
   * @param {Object} config - RTMP 配置
   * @returns {Promise<void>}
   */
  const startStream = async (config) => {
    try {
      console.log('[LiveStreamingStore] 开始直播:', config)
      
      // 验证配置
      if (!config.url || !config.streamKey) {
        throw new Error('RTMP 地址和串流密钥不能为空')
      }
      
      // 更新配置
      rtmpConfig.value = { ...rtmpConfig.value, ...config }
      
      // TODO: 调用后端 API 开始推流
      // await invoke('start_rtmp_stream', { config: rtmpConfig.value })
      
      // 更新状态
      isStreaming.value = true
      startTime.value = Date.now()
      duration.value = 0
      errorMessage.value = ''
      
      // 启动计时器
      startDurationTimer()
      
      console.log('[LiveStreamingStore] 直播已开始')
    } catch (error) {
      console.error('[LiveStreamingStore] 开始直播失败:', error)
      errorMessage.value = error.message
      throw error
    }
  }
  
  /**
   * 停止直播
   * @returns {Promise<void>}
   */
  const stopStream = async () => {
    try {
      if (!isStreaming.value) {
        console.warn('[LiveStreamingStore] 当前未在直播')
        return
      }
      
      console.log('[LiveStreamingStore] 停止直播')
      
      // TODO: 调用后端 API 停止推流
      // await invoke('stop_rtmp_stream')
      
      // 记录到历史
      const historyItem = {
        id: Date.now(),
        startTime: startTime.value,
        endTime: Date.now(),
        duration: duration.value,
        config: { ...rtmpConfig.value },
        maxViewers: viewers.value
      }
      streamingHistory.value.unshift(historyItem)
      
      // 重置状态
      isStreaming.value = false
      startTime.value = null
      duration.value = 0
      viewers.value = 0
      currentBitrate.value = 0
      errorMessage.value = ''
      
      // 停止计时器
      stopDurationTimer()
      
      console.log('[LiveStreamingStore] 直播已停止')
    } catch (error) {
      console.error('[LiveStreamingStore] 停止直播失败:', error)
      errorMessage.value = error.message
      throw error
    }
  }
  
  /**
   * 保存 RTMP 配置
   * @param {Object} config - RTMP 配置
   */
  const saveRtmpConfig = (config) => {
    rtmpConfig.value = { ...rtmpConfig.value, ...config }
    console.log('[LiveStreamingStore] 保存 RTMP 配置:', rtmpConfig.value)
    
    // TODO: 持久化保存到本地存储
    // localStorage.setItem('rtmpConfig', JSON.stringify(rtmpConfig.value))
  }
  
  /**
   * 加载保存的 RTMP 配置
   */
  const loadRtmpConfig = () => {
    try {
      const saved = localStorage.getItem('rtmpConfig')
      if (saved) {
        rtmpConfig.value = JSON.parse(saved)
        console.log('[LiveStreamingStore] 加载 RTMP 配置:', rtmpConfig.value)
      }
    } catch (error) {
      console.error('[LiveStreamingStore] 加载 RTMP 配置失败:', error)
    }
  }
  
  /**
   * 更新观众数
   * @param {number} count - 观众数量
   */
  const updateViewers = (count) => {
    viewers.value = count
  }
  
  /**
   * 更新推流码率
   * @param {number} bitrate - 码率 (kbps)
   */
  const updateBitrate = (bitrate) => {
    currentBitrate.value = bitrate
  }
  
  /**
   * 清除错误信息
   */
  const clearError = () => {
    errorMessage.value = ''
  }
  
  /**
   * 清空直播历史
   */
  const clearHistory = () => {
    streamingHistory.value = []
    console.log('[LiveStreamingStore] 清空直播历史')
  }
  
  /**
   * 重置所有状态
   */
  const resetState = () => {
    isStreaming.value = false
    startTime.value = null
    duration.value = 0
    viewers.value = 0
    currentBitrate.value = 0
    errorMessage.value = ''
    stopDurationTimer()
    console.log('[LiveStreamingStore] 重置所有状态')
  }
  
  // ============================================
  // 内部方法
  // ============================================
  
  let durationTimer = null
  
  /**
   * 启动持续时间计时器
   */
  const startDurationTimer = () => {
    stopDurationTimer()
    durationTimer = setInterval(() => {
      if (startTime.value) {
        duration.value = Math.floor((Date.now() - startTime.value) / 1000)
      }
    }, 1000)
  }
  
  /**
   * 停止持续时间计时器
   */
  const stopDurationTimer = () => {
    if (durationTimer) {
      clearInterval(durationTimer)
      durationTimer = null
    }
  }

  // ============================================
  // Getters
  // ============================================
  
  /** 格式化的直播持续时间 */
  const formattedDuration = computed(() => {
    const hours = Math.floor(duration.value / 3600)
    const minutes = Math.floor((duration.value % 3600) / 60)
    const seconds = duration.value % 60
    
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  })
  
  /** 直播状态文本 */
  const statusText = computed(() => {
    if (isStreaming.value) {
      return `直播中 ${formattedDuration.value}`
    }
    return '未直播'
  })
  
  /** 是否有错误 */
  const hasError = computed(() => {
    return errorMessage.value !== ''
  })

  return {
    // State
    isStreaming,
    startTime,
    duration,
    viewers,
    currentBitrate,
    rtmpConfig,
    streamingHistory,
    errorMessage,
    
    // Actions
    startStream,
    stopStream,
    saveRtmpConfig,
    loadRtmpConfig,
    updateViewers,
    updateBitrate,
    clearError,
    clearHistory,
    resetState,
    
    // Getters
    formattedDuration,
    statusText,
    hasError
  }
})
