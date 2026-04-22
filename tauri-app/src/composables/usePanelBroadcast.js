/**
 * 面板直播推流 Composable
 * 用于 YOLO、分析、Web 等面板的独立直播推流功能
 * 通过 eventBus 将直播画面广播到学生端，学生端被动接收
 */

import { ref, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { eventBus, EventTypes } from '@/utils/eventBus'

export function usePanelBroadcast(options = {}) {
  const {
    streamName = 'panel-stream',
    fps = 30
  } = options

  // 状态
  const isBroadcasting = ref(false)
  const broadcastDuration = ref(0)
  const viewerCount = ref(0)
  const broadcastType = ref('')  // 'yolo' | 'analysis' | 'web'
  const errorMessage = ref('')

  // 内部状态
  let canvasElement = null
  let animationFrameId = null
  let durationTimer = null
  let viewerCountTimer = null

  /**
   * 初始化直播
   * @param {HTMLCanvasElement} canvas - 要捕获的 canvas 元素
   */
  const initBroadcast = (canvas) => {
    canvasElement = canvas
    console.log('[PanelBroadcast] 直播流已初始化:', {
      streamName,
      fps
    })
  }

  /**
   * 开始直播
   * 直接通过 eventBus 广播到学生端，无需配置服务器地址
   * @param {string} type - 直播类型: 'yolo' | 'analysis' | 'web'
   */
  const startBroadcast = async (type = 'web') => {
    try {
      errorMessage.value = ''
      broadcastType.value = type

      // 发送开始直播事件
      eventBus.emit(EventTypes.BROADCAST_START, {
        type: type,
        streamName: streamName,
        fps: fps
      })

      // 更新状态
      isBroadcasting.value = true
      broadcastDuration.value = 0
      viewerCount.value = 0

      // 启动帧广播（如果有 canvas）
      if (canvasElement) {
        startFrameBroadcast()
      }

      // 启动时长计时器
      startDurationTimer()

      // 模拟观众数量变化
      startViewerCountSimulation()

      console.log('[PanelBroadcast] 直播已开始:', type)

      ElMessage.success('直播已开始，学生端正在接收画面')

      return true
    } catch (error) {
      console.error('[PanelBroadcast] 启动直播失败:', error)
      errorMessage.value = error.message
      ElMessage.error('启动直播失败: ' + error.message)
      return false
    }
  }

  /**
   * 停止直播
   */
  const stopBroadcast = async () => {
    try {
      // 停止帧广播
      stopFrameBroadcast()

      // 停止时长计时器
      stopDurationTimer()

      // 停止观众数量模拟
      stopViewerCountSimulation()

      // 发送停止直播事件
      eventBus.emit(EventTypes.BROADCAST_STOP, {
        type: broadcastType.value,
        streamName: streamName
      })

      // 更新状态
      isBroadcasting.value = false
      broadcastDuration.value = 0
      viewerCount.value = 0
      broadcastType.value = ''

      console.log('[PanelBroadcast] 直播已停止')

      ElMessage.info('直播已停止，学生端已退出直播')

      return true
    } catch (error) {
      console.error('[PanelBroadcast] 停止直播失败:', error)
      errorMessage.value = error.message
      return false
    }
  }

  /**
   * 发送当前帧到学生端
   */
  const sendCurrentFrame = () => {
    if (!isBroadcasting.value || !canvasElement) return

    try {
      // 将 canvas 转换为 base64 图像
      const dataUrl = canvasElement.toDataURL('image/jpeg', 0.8)
      
      eventBus.emit(EventTypes.BROADCAST_FRAME, {
        type: broadcastType.value,
        streamName: streamName,
        frame: dataUrl,
        timestamp: Date.now()
      })
    } catch (error) {
      // 忽略帧发送错误
    }
  }

  /**
   * 启动帧广播循环
   */
  const startFrameBroadcast = () => {
    const frameInterval = 1000 / fps // 每帧间隔

    const broadcastFrame = () => {
      if (!isBroadcasting.value) return
      
      sendCurrentFrame()
      animationFrameId = setTimeout(broadcastFrame, frameInterval)
    }

    broadcastFrame()
  }

  /**
   * 停止帧广播
   */
  const stopFrameBroadcast = () => {
    if (animationFrameId) {
      clearTimeout(animationFrameId)
      animationFrameId = null
    }
  }

  /**
   * 启动时长计时器
   */
  const startDurationTimer = () => {
    stopDurationTimer()
    durationTimer = setInterval(() => {
      broadcastDuration.value++
    }, 1000)
  }

  /**
   * 停止时长计时器
   */
  const stopDurationTimer = () => {
    if (durationTimer) {
      clearInterval(durationTimer)
      durationTimer = null
    }
  }

  /**
   * 启动观众数量模拟
   */
  const startViewerCountSimulation = () => {
    stopViewerCountSimulation()
    viewerCountTimer = setInterval(() => {
      if (isBroadcasting.value) {
        // 模拟：每3秒有30%概率增加1个观众，最多10个
        if (Math.random() > 0.7 && viewerCount.value < 10) {
          viewerCount.value++
        }
      }
    }, 3000)
  }

  /**
   * 停止观众数量模拟
   */
  const stopViewerCountSimulation = () => {
    if (viewerCountTimer) {
      clearInterval(viewerCountTimer)
      viewerCountTimer = null
    }
  }

  /**
   * 获取格式化的直播时长
   */
  const formattedDuration = () => {
    const hours = Math.floor(broadcastDuration.value / 3600)
    const minutes = Math.floor((broadcastDuration.value % 3600) / 60)
    const seconds = broadcastDuration.value % 60

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  /**
   * 获取推流状态文本
   */
  const statusText = () => {
    if (isBroadcasting.value) {
      return `直播中 ${formattedDuration()}`
    }
    return '未直播'
  }

  /**
   * 销毁资源
   */
  const destroy = () => {
    stopBroadcast()
    canvasElement = null
  }

  // 组件卸载时自动清理
  onUnmounted(() => {
    destroy()
  })

  return {
    // 状态
    isBroadcasting,
    broadcastDuration,
    viewerCount,
    broadcastType,
    errorMessage,

    // 方法
    initBroadcast,
    startBroadcast,
    stopBroadcast,
    sendCurrentFrame,
    formattedDuration,
    statusText,
    destroy
  }
}
