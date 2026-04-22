import { computed, ref, onUnmounted, watch } from 'vue'
import { useVisionStore } from '@/stores/visionStore'

export function useVisionAnalysis() {
  const visionStore = useVisionStore()
  const isRunning = ref(false)
  let analysisInterval = null
  let animationFrameId = null

  // 从 store 获取状态
  const isAnalyzing = computed(() => visionStore.isAnalyzing)
  const analysisResults = computed(() => visionStore.analysisResults)
  const recentResults = computed(() => visionStore.recentResults)
  const resultCount = computed(() => visionStore.resultCount)
  const currentFrame = computed(() => visionStore.currentFrame)
  const faces = computed(() => visionStore.faces)
  const objects = computed(() => visionStore.objects)
  const attentionScore = computed(() => visionStore.attentionScore)
  const emotions = computed(() => visionStore.emotions)

  /**
   * 开始分析
   * @param {HTMLVideoElement|HTMLCanvasElement} videoElement - 视频元素
   * @param {number} intervalMs - 分析间隔（毫秒）
   */
  const startAnalysis = async (videoElement, intervalMs = 500) => {
    if (isRunning.value) return
    if (!videoElement) {
      console.error('[useVisionAnalysis] 视频元素不存在')
      return
    }

    isRunning.value = true
    visionStore.startAnalysis()

    const analyze = async () => {
      if (!isRunning.value) return

      try {
        const canvas = captureFrame(videoElement)
        if (canvas) {
          await visionStore.analyzeFrame(canvas)
        }
      } catch (error) {
        console.error('[useVisionAnalysis] 分析失败:', error)
      }

      if (isRunning.value) {
        analysisInterval = setTimeout(() => {
          requestAnimationFrame(analyze)
        }, intervalMs)
      }
    }

    await analyze()
  }

  /**
   * 停止分析
   */
  const stopAnalysis = () => {
    isRunning.value = false
    if (analysisInterval) {
      clearTimeout(analysisInterval)
      analysisInterval = null
    }
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    visionStore.stopAnalysis()
  }

  /**
   * 切换分析状态
   */
  const toggleAnalysis = (videoElement, intervalMs = 500) => {
    if (isRunning.value) {
      stopAnalysis()
    } else {
      startAnalysis(videoElement, intervalMs)
    }
  }

  /**
   * 分析单帧
   */
  const analyzeFrame = async (frame) => {
    return await visionStore.analyzeFrame(frame)
  }

  /**
   * 从视频元素捕获帧
   */
  const captureFrame = (videoElement) => {
    if (!videoElement || videoElement.readyState < 2) {
      return null
    }

    const canvas = document.createElement('canvas')
    canvas.width = videoElement.videoWidth || 640
    canvas.height = videoElement.videoHeight || 480
    const ctx = canvas.getContext('2d')

    try {
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)
      visionStore.setCurrentFrame(canvas.toDataURL('image/jpeg', 0.8))
      return canvas
    } catch (error) {
      console.error('[useVisionAnalysis] 帧捕获失败:', error)
      return null
    }
  }

  /**
   * 清除结果
   */
  const clearResults = () => {
    visionStore.clearResults()
  }

  /**
   * 获取分析结果
   */
  const getResults = () => {
    return visionStore.getAnalysisResults()
  }

  /**
   * 设置检测配置
   */
  const setConfig = (config) => {
    visionStore.setConfig(config)
  }

  /**
   * 初始化摄像头
   */
  const initCamera = async (constraints = { video: true, audio: false }) => {
    return await visionStore.initCamera(constraints)
  }

  /**
   * 停止摄像头
   */
  const stopCamera = () => {
    visionStore.stopCamera()
  }

  /**
   * 绘制检测结果到画布
   */
  const drawResults = (canvas, faces, objects) => {
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 绘制人脸框
    faces.forEach((face, index) => {
      if (face.boundingBox) {
        const { x, y, width, height } = face.boundingBox
        ctx.strokeStyle = '#00FF00'
        ctx.lineWidth = 2
        ctx.strokeRect(x, y, width, height)

        // 绘制标签背景
        ctx.fillStyle = 'rgba(0, 255, 0, 0.8)'
        ctx.fillRect(x, y - 25, 100, 25)

        // 绘制标签文字
        ctx.fillStyle = '#000'
        ctx.font = '14px Arial'
        ctx.fillText(`人脸 ${index + 1} ${(face.confidence * 100).toFixed(0)}%`, x + 5, y - 7)
      }
    })

    // 绘制物体框
    objects.forEach((obj, index) => {
      if (obj.bbox) {
        const { x, y, width, height } = obj.bbox
        ctx.strokeStyle = '#FF00FF'
        ctx.lineWidth = 2
        ctx.strokeRect(x, y, width, height)

        // 绘制标签背景
        ctx.fillStyle = 'rgba(255, 0, 255, 0.8)'
        ctx.fillRect(x, y - 25, 100, 25)

        // 绘制标签文字
        ctx.fillStyle = '#000'
        ctx.font = '14px Arial'
        ctx.fillText(`${obj.label} ${(obj.confidence * 100).toFixed(0)}%`, x + 5, y - 7)
      }
    })
  }

  // 组件卸载时清理
  onUnmounted(() => {
    stopAnalysis()
  })

  return {
    // 状态
    isRunning,
    isAnalyzing,
    analysisResults,
    recentResults,
    resultCount,
    currentFrame,
    faces,
    objects,
    attentionScore,
    emotions,

    // 方法
    startAnalysis,
    stopAnalysis,
    toggleAnalysis,
    analyzeFrame,
    captureFrame,
    clearResults,
    getResults,
    setConfig,
    initCamera,
    stopCamera,
    drawResults
  }
}
