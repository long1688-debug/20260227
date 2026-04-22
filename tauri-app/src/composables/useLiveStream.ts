/**
 * 直播管理 Composable
 * 
 * 职责：
 * - 管理 RTMP 推流状态和配置
 * - 管理直播开始/停止
 * - 管理直播统计信息
 */

import { ref, type Ref } from 'vue'
import { ElMessage } from 'element-plus'

/**
 * RTMP 推流配置接口
 */
export interface RtmpConfig {
  url: string
  streamKey: string
  bitrate: number
  resolution: string
  fps: number
}

/**
 * 直播状态接口
 */
export interface LiveStreamState {
  isStreaming: boolean
  startTime?: number
  duration?: number
  viewers?: number
  bitrate?: number
}

/**
 * 直播存储接口（简化版）
 */
export interface LiveStreamingStoreLike {
  startStream: (config: RtmpConfig) => Promise<void>
  stopStream: () => Promise<void>
  saveRtmpConfig: (config: RtmpConfig) => void
}

/**
 * 直播管理选项
 */
export interface UseLiveStreamOptions {
  /** 直播存储对象 */
  liveStreamingStore?: LiveStreamingStoreLike
  /** 是否显示 RTMP 配置对话框 */
  showRtmpDialog?: Ref<boolean>
  /** RTMP 推流配置 */
  rtmpConfig?: Ref<RtmpConfig>
  /** 直播状态 */
  liveStreamState?: Ref<LiveStreamState>
}

/**
 * 直播管理器返回值
 */
export interface UseLiveStreamReturn {
  /** 显示 RTMP 配置对话框 */
  showRtmpDialog: Ref<boolean>
  /** RTMP 推流配置 */
  rtmpConfig: Ref<RtmpConfig>
  /** 直播状态 */
  liveStreamState: Ref<LiveStreamState>
  /** 打开 RTMP 配置对话框 */
  openRtmpDialog: () => void
  /** 关闭 RTMP 配置对话框 */
  closeRtmpDialog: () => void
  /** 开始直播 */
  startLiveStream: () => Promise<void>
  /** 停止直播 */
  stopLiveStream: () => Promise<void>
  /** 更新 RTMP 配置 */
  updateRtmpConfig: (config: Partial<RtmpConfig>) => void
  /** 保存 RTMP 配置 */
  saveRtmpConfig: () => void
}

/**
 * 使用直播管理器
 */
export function useLiveStream(options: UseLiveStreamOptions = {}): UseLiveStreamReturn {
  const liveStreamingStore = options.liveStreamingStore
  
  // 使用外部传入的引用，或创建内部引用
  const showRtmpDialog = options.showRtmpDialog || ref(false)
  const rtmpConfig = options.rtmpConfig || ref<RtmpConfig>({
    url: '',
    streamKey: '',
    bitrate: 2500,
    resolution: '1920x1080',
    fps: 30
  })
  const liveStreamState = options.liveStreamState || ref<LiveStreamState>({
    isStreaming: false,
    startTime: undefined,
    duration: 0,
    viewers: 0,
    bitrate: 0
  })

  /**
   * 打开 RTMP 配置对话框
   */
  const openRtmpDialog = () => {
    showRtmpDialog.value = true
    console.log('[直播管理] 打开 RTMP 配置对话框')
  }

  /**
   * 关闭 RTMP 配置对话框
   */
  const closeRtmpDialog = () => {
    showRtmpDialog.value = false
    console.log('[直播管理] 关闭 RTMP 配置对话框')
  }

  /**
   * 开始直播
   */
  const startLiveStream = async () => {
    try {
      if (!liveStreamingStore) {
        console.warn('[直播管理] liveStreamingStore 未提供')
        return
      }
      
      // 验证配置
      if (!rtmpConfig.value.url || !rtmpConfig.value.streamKey) {
        ElMessage.warning('请填写 RTMP 地址和串流密钥')
        openRtmpDialog()
        return
      }
      
      console.log('[直播管理] 开始直播:', rtmpConfig.value)
      
      // 调用 store 开始直播
      await liveStreamingStore.startStream(rtmpConfig.value)
      
      // 更新本地状态
      liveStreamState.value.isStreaming = true
      liveStreamState.value.startTime = Date.now()
      
      closeRtmpDialog()
      ElMessage.success('直播已开始')
      console.log('[直播管理] 直播启动成功')
    } catch (error) {
      console.error('[直播管理] 开始直播失败:', error)
      ElMessage.error('开始直播失败')
    }
  }

  /**
   * 停止直播
   */
  const stopLiveStream = async () => {
    try {
      if (!liveStreamingStore) {
        console.warn('[直播管理] liveStreamingStore 未提供')
        return
      }
      
      if (!liveStreamState.value.isStreaming) {
        ElMessage.warning('当前未在直播')
        return
      }
      
      console.log('[直播管理] 停止直播')
      
      // 调用 store 停止直播
      await liveStreamingStore.stopStream()
      
      // 更新本地状态
      liveStreamState.value.isStreaming = false
      liveStreamState.value.duration = Date.now() - (liveStreamState.value.startTime || Date.now())
      
      ElMessage.success('直播已停止')
      console.log('[直播管理] 直播停止成功')
    } catch (error) {
      console.error('[直播管理] 停止直播失败:', error)
      ElMessage.error('停止直播失败')
    }
  }

  /**
   * 更新 RTMP 配置
   * @param config 新的配置（部分字段）
   */
  const updateRtmpConfig = (config: Partial<RtmpConfig>) => {
    try {
      rtmpConfig.value = {
        ...rtmpConfig.value,
        ...config
      }
      
      console.log('[直播管理] 更新 RTMP 配置:', config)
    } catch (error) {
      console.error('[直播管理] 更新 RTMP 配置失败:', error)
      ElMessage.error('更新配置失败')
    }
  }

  /**
   * 保存 RTMP 配置
   */
  const saveRtmpConfig = () => {
    try {
      if (!liveStreamingStore) {
        console.warn('[直播管理] liveStreamingStore 未提供')
        return
      }
      
      // 验证配置
      if (!rtmpConfig.value.url) {
        ElMessage.warning('RTMP 地址不能为空')
        return
      }
      
      // 保存到 store
      liveStreamingStore.saveRtmpConfig(rtmpConfig.value)
      
      closeRtmpDialog()
      ElMessage.success('RTMP 配置已保存')
      console.log('[直播管理] RTMP 配置保存成功')
    } catch (error) {
      console.error('[直播管理] 保存 RTMP 配置失败:', error)
      ElMessage.error('保存配置失败')
    }
  }

  return {
    showRtmpDialog,
    rtmpConfig,
    liveStreamState,
    openRtmpDialog,
    closeRtmpDialog,
    startLiveStream,
    stopLiveStream,
    updateRtmpConfig,
    saveRtmpConfig
  }
}
