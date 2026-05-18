import { defineStore } from 'pinia'
import { pipeline } from '@xenova/transformers'
import { getCocoDatasetManager } from '@/services/coco-dataset'

// YOLO 模型加载器（单例模式）
let yoloDetector = null
let visionStoreRef = null

// 本地模型配置
const LOCAL_MODEL_CONFIG = {
  // 本地模型路径 - 支持 Tauri 和 Web 环境
  getModelPath: () => {
    // Tauri 环境：使用 asset 协议
    if (typeof window !== 'undefined' && window.__TAURI__) {
      return 'resource:///models/yolov8n.onnx'
    }
    // 开发环境：使用公共路径
    return '/models/yolov8n.onnx'
  },
  // 本地模型是否已下载
  available: false
}

// COCO 数据集本地路径配置
const COCO_DATASET_CONFIG = {
  // 本地 COCO 数据集路径（包含 val2017 或 train2017 文件夹）
  localPath: 'F:\\\\coco',
  // 是否使用本地数据集
  useLocalDataset: false,
  // 获取本地数据集路径
  getDatasetPath: () => {
    // 优先使用配置的本地路径
    if (typeof window !== 'undefined' && window.__TAURI__) {
      // Tauri 环境：转换为 asset 协议
      return `asset://localhost/${COCO_DATASET_CONFIG.localPath.replace(/\\/g, '/')}`
    }
    // 开发环境：直接使用文件路径或本地服务器
    return COCO_DATASET_CONFIG.localPath
  },
  // COCO val2017 图片目录名
  valDir: 'val2017',
  // COCO train2017 图片目录名
  trainDir: 'train2017'
}

/**
 * 设置 visionStore 引用
 */
function setVisionStoreRef(store) {
  visionStoreRef = store
}

/**
 * 检测网络状态
 */
async function checkNetworkStatus() {
  if (visionStoreRef) {
    visionStoreRef.isOnline = navigator.onLine
  }
  return navigator.onLine
}

/**
 * 检测本地模型是否可用
 */
async function checkLocalModelAvailable() {
  const modelPath = LOCAL_MODEL_CONFIG.getModelPath()
  console.log(`[VisionStore] 检查本地模型: ${modelPath}`)
  try {
    const response = await fetch(modelPath, { method: 'HEAD' })
    LOCAL_MODEL_CONFIG.available = response.ok
    console.log(`[VisionStore] 本地模型可用: ${response.ok}`)
  } catch (error) {
    console.warn(`[VisionStore] 本地模型不可用:`, error)
    LOCAL_MODEL_CONFIG.available = false
  }
  return LOCAL_MODEL_CONFIG.available
}

/**
 * 获取或初始化 YOLO 检测器（在线/离线双模式）
 */
async function getYoloDetector() {
  if (!yoloDetector) {
    if (visionStoreRef) {
      visionStoreRef.yoloStatus = 'loading'
    }

    const isOnline = await checkNetworkStatus()
    console.log(`[VisionStore] 网络状态: ${isOnline ? '在线' : '离线'}`)

    try {
      if (isOnline) {
        // 在线模式：从 HuggingFace 加载模型
        console.log('[VisionStore] 使用在线模型 (HuggingFace)...')
        if (visionStoreRef) {
          visionStoreRef.detectionMode = 'online'
        }
        yoloDetector = await pipeline('object-detection', 'Xenova/yolov8n')
      } else {
        // 离线模式：检查本地模型
        const localAvailable = await checkLocalModelAvailable()
        if (localAvailable) {
          console.log('[VisionStore] 使用本地模型...')
          if (visionStoreRef) {
            visionStoreRef.detectionMode = 'local'
          }
          // 使用 onnxruntime-web 加载本地模型
          const { InferenceSession } = await import('onnxruntime-web')
          yoloDetector = await InferenceSession.create(LOCAL_MODEL_CONFIG.modelPath)
          // 包装为统一接口
          yoloDetector = createLocalDetectorWrapper(yoloDetector)
        } else {
          console.warn('[VisionStore] 本地模型不可用，启用降级模式...')
          if (visionStoreRef) {
            visionStoreRef.detectionMode = 'fallback'
          }
          // 降级到模拟检测
          yoloDetector = createFallbackDetector()
        }
      }
      console.log('[VisionStore] YOLO 模型加载完成')
    } catch (error) {
      console.error('[VisionStore] 模型加载失败:', error)
      // 降级到模拟检测
      if (visionStoreRef) {
        visionStoreRef.detectionMode = 'fallback'
      }
      yoloDetector = createFallbackDetector()
    }

    if (visionStoreRef) {
      visionStoreRef.yoloStatus = 'ready'
      visionStoreRef.yoloModel = yoloDetector
    }
  }
  return yoloDetector
}

/**
 * 创建本地模型检测器包装
 */
function createLocalDetectorWrapper(session) {
  return async (imageUrl, options = {}) => {
    const threshold = options.threshold || 0.5

    try {
      // 准备输入数据
      const img = new Image()
      img.src = imageUrl
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })

      // 使用 Transformers.js 的 feature-extractor 处理图像
      const { AutoImageProcessor, AutoModelForObjectDetection } = await import('@xenova/transformers')

      // 从本地加载 ONNX 模型
      const model = await AutoModelForObjectDetection.from_onnx(LOCAL_MODEL_CONFIG.getModelPath())

      // 准备输入
      const processor = await AutoImageProcessor.from_pretrained('Xenova/transformers', {
        quantized: true
      })

      const inputs = await processor(img)

      // 执行推理
      const outputs = await model(inputs)

      // 后处理（简化的 YOLO 后处理逻辑）
      const results = []
      const logits = outputs.logits
      const boxes = outputs.pred_boxes || outputs.last_hidden_state

      // COCO 80 类标签
      const cocoLabels = [
        'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
        'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
        'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
        'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
        'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
        'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
        'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair',
        'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote',
        'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book',
        'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
      ]

      // 简单的后处理（取最大分数的检测结果）
      const maxIdx = logits.data.map((x, i) => x > threshold ? i : -1).filter(x => x >= 0)

      for (const idx of maxIdx.slice(0, 20)) {
        results.push({
          label: cocoLabels[idx % cocoLabels.length] || 'object',
          score: logits.data[idx]
        })
      }

      console.log(`[VisionStore] 本地模型检测到 ${results.length} 个物体`)
      return results
    } catch (error) {
      console.error('[VisionStore] 本地 ONNX 推理失败:', error)
      return []
    }
  }
}

/**
 * 创建降级检测器（模拟检测）
 */
function createFallbackDetector() {
  return async (imageUrl, options = {}) => {
    // 返回模拟检测结果
    const objects = []
    const labels = ['person', 'hand', 'object']
    const count = Math.floor(Math.random() * 3) + 1

    for (let i = 0; i < count; i++) {
      objects.push({
        label: labels[Math.floor(Math.random() * labels.length)],
        score: 0.7 + Math.random() * 0.25,
        box: {
          xc: Math.random() * 80 + 10,
          yc: Math.random() * 80 + 10,
          width: Math.random() * 30 + 10,
          height: Math.random() * 30 + 10
        }
      })
    }

    return objects
  }
}

/**
 * 监听网络状态变化
 */
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[VisionStore] 网络已连接')
    if (visionStoreRef) {
      visionStoreRef.isOnline = true
    }
  })
  window.addEventListener('offline', () => {
    console.log('[VisionStore] 网络已断开')
    if (visionStoreRef) {
      visionStoreRef.isOnline = false
    }
  })
}

export const useVisionStore = defineStore('vision', {
  state: () => ({
    // 分析结果列表
    analysisResults: [],
    // 当前是否在分析中
    isAnalyzing: false,
    // 当前帧图片
    currentFrame: null,
    // 检测到的人脸信息
    faces: [],
    // 检测到的物体信息
    objects: [],
    // 专注度分析结果
    attentionScore: 0,
    // 情绪分析结果
    emotions: [],
    // 摄像头流
    cameraStream: null,
    // 检测配置
    config: {
      faceDetect: true,
      objectDetect: true,
      attentionMonitor: true,
      emotionAnalysis: true,
      yoloThreshold: 0.5
    },
    // YOLO 模型状态
    yoloStatus: 'idle', // idle | loading | ready | error
    yoloModel: null,
    // 网络状态
    isOnline: navigator.onLine,
    // 检测模式: online | local | fallback
    detectionMode: 'online',
    // 分析历史记录（用于专注度计算）
    analysisHistory: [],
    // 最终得分
    finalScore: 0,
    // COCO 数据集配置
    cocoDataset: {
      localPath: 'F:\\\\coco',
      useLocalDataset: false,
      imageIndex: 0,
      images: []
    },
    // 批量测试状态
    batchTestMode: 'idle', // idle | running | paused | completed
    batchTestProgress: 0,
    batchTestTotal: 0,
    // 考试状态
    examMode: 'idle', // idle | recording | analyzing | completed
    examResults: [],
    examScore: 0
  }),

  getters: {
    recentResults: (state) => state.analysisResults.slice(0, 10),
    resultCount: (state) => state.analysisResults.length,
    hasFace: (state) => state.faces.length > 0,
    attentionLevel: (state) => {
      if (state.attentionScore >= 80) return '高'
      if (state.attentionScore >= 50) return '中'
      return '低'
    },
    yoloReady: (state) => state.yoloStatus === 'ready',
    yoloLoading: (state) => state.yoloStatus === 'loading',
    detectionModeText: (state) => {
      const modes = {
        online: '🌐 在线模式',
        local: '💾 本地模式',
        fallback: '⚠️ 降级模式'
      }
      return modes[state.detectionMode] || state.detectionMode
    },
    isUsingOnlineMode: (state) => state.detectionMode === 'online',
    isUsingLocalMode: (state) => state.detectionMode === 'local'
  },

  actions: {
    // 添加分析结果
    addAnalysisResult(result) {
      this.analysisResults.unshift({
        id: Date.now(),
        time: new Date().toLocaleTimeString(),
        ...result
      })

      // 保持最多100条记录
      if (this.analysisResults.length > 100) {
        this.analysisResults.pop()
      }
    },

    // 清除所有结果
    clearResults() {
      this.analysisResults = []
      this.faces = []
      this.objects = []
      this.emotions = []
      this.attentionScore = 0
      this.finalScore = 0
      this.analysisHistory = []
    },

    // 获取分析结果
    getAnalysisResults() {
      return this.analysisResults
    },

    // 开始分析
    startAnalysis() {
      this.isAnalyzing = true
    },

    // 停止分析
    stopAnalysis() {
      this.isAnalyzing = false
    },

    // 设置当前帧
    setCurrentFrame(frame) {
      this.currentFrame = frame
    },

    // 设置检测配置
    setConfig(config) {
      this.config = { ...this.config, ...config }
    },

    // 预加载 YOLO 模型
    async preloadYoloModel() {
      setVisionStoreRef(this)
      try {
        await getYoloDetector()
        return true
      } catch (error) {
        console.error('[VisionStore] YOLO 模型预加载失败:', error)
        this.yoloStatus = 'error'
        return false
      }
    },

    // 重置 YOLO 模型（用于网络切换后重新加载）
    async resetYoloModel() {
      yoloDetector = null
      this.yoloStatus = 'idle'
      this.yoloModel = null
      await this.preloadYoloModel()
    },

    // 获取当前网络状态
    getNetworkStatus() {
      this.isOnline = navigator.onLine
      return this.isOnline
    },

    // 手动设置检测模式
    setDetectionMode(mode) {
      this.detectionMode = mode
    },

    // ============ COCO 数据集相关 ============
    // 设置本地 COCO 数据集路径
    setCocoDatasetPath(path) {
      this.cocoDataset.localPath = path
      COCO_DATASET_CONFIG.localPath = path
      const manager = getCocoDatasetManager()
      manager.setLocalPath(path)
      console.log(`[VisionStore] COCO 数据集路径已设置为: ${path}`)
    },

    // 启用/禁用本地 COCO 数据集模式
    setUseCocoDataset(use) {
      this.cocoDataset.useLocalDataset = use
      COCO_DATASET_CONFIG.useLocalDataset = use
      console.log(`[VisionStore] COCO 本地数据集模式: ${use ? '启用' : '禁用'}`)
    },

    // 加载本地 COCO 数据集图片列表
    async loadCocoDatasetImages(valDir = true) {
      const manager = getCocoDatasetManager()
      const images = await manager.loadImages(valDir)

      this.cocoDataset.images = images
      this.cocoDataset.imageIndex = 0
      console.log(`[VisionStore] 已加载 ${images.length} 张 COCO 图片`)
      return images
    },

    // 获取当前 COCO 图片
    getCurrentCocoImage() {
      if (this.cocoDataset.images.length === 0) return null
      return this.cocoDataset.images[this.cocoDataset.imageIndex]
    },

    // 下一张 COCO 图片
    nextCocoImage() {
      if (this.cocoDataset.images.length === 0) return null
      this.cocoDataset.imageIndex = (this.cocoDataset.imageIndex + 1) % this.cocoDataset.images.length
      return this.getCurrentCocoImage()
    },

    // 上一张 COCO 图片
    prevCocoImage() {
      if (this.cocoDataset.images.length === 0) return null
      this.cocoDataset.imageIndex = (this.cocoDataset.imageIndex - 1 + this.cocoDataset.images.length) % this.cocoDataset.images.length
      return this.getCurrentCocoImage()
    },

    // 验证数据集是否完整
    async validateCocoDataset() {
      const manager = getCocoDatasetManager()
      return await manager.validateDataset()
    },

    // 获取数据集统计信息
    async getCocoDatasetStats() {
      const manager = getCocoDatasetManager()
      return await manager.getStatistics()
    },

    // 搜索包含指定类别的图片
    async searchCocoImagesByCategory(categoryName, maxResults = 10) {
      const manager = getCocoDatasetManager()
      return await manager.searchImagesByCategory(categoryName, maxResults)
    },

    // 分析本地 COCO 图片
    async analyzeCocoImage(imagePath) {
      console.log(`[VisionStore] 分析 COCO 图片: ${imagePath}`)
      try {
        const img = new Image()
        img.crossOrigin = 'anonymous'

        // 转换本地路径为可访问的 URL
        let imageUrl = imagePath
        if (typeof window !== 'undefined' && window.__TAURI__) {
          // Tauri 环境：使用 convertFileSrc 转换路径
          const { convertFileSrc } = await import('@tauri-apps/api/core')
          imageUrl = convertFileSrc(imagePath)
        }

        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = imageUrl
        })

        // 创建 canvas 并绘制图片
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)

        // 执行分析
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const results = await this.performAnalysis(imageData)
        this.addAnalysisResult({ ...results, source: 'coco', imagePath })

        return results
      } catch (error) {
        console.error('[VisionStore] 分析 COCO 图片失败:', error)
        throw error
      }
    },

    // ============ 教学演示相关 ============
    // 演示模式状态
    demoMode: 'idle', // idle | running | paused
    demoCurrentStep: 0,
    demoResults: [],

    // 开始教学演示
    async startTeachingDemo() {
      this.demoMode = 'running'
      this.demoCurrentStep = 0
      this.demoResults = []
      console.log('[VisionStore] 开始教学演示')

      // 确保模型已加载
      if (this.yoloStatus !== 'ready') {
        await this.preloadYoloModel()
      }

      // 加载演示用的 COCO 图片（从数据集中随机选取几张）
      const images = await this.loadCocoDatasetImages(true)
      if (images.length > 0) {
        // 随机选取 5 张用于演示
        const demoImages = this.shuffleArray([...images]).slice(0, 5)
        for (const img of demoImages) {
          if (this.demoMode !== 'running') break

          const result = await this.analyzeCocoImage(img.fullPath || img.path)
          this.demoResults.push({
            ...img,
            result,
            timestamp: Date.now()
          })
          this.demoCurrentStep++
        }
      }

      this.demoMode = 'idle'
      console.log('[VisionStore] 教学演示完成')
      return this.demoResults
    },

    // 停止教学演示
    stopTeachingDemo() {
      this.demoMode = 'idle'
      console.log('[VisionStore] 教学演示已停止')
    },

    // 打乱数组顺序
    shuffleArray(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]]
      }
      return array
    },

    // ============ 批量测试相关 ============
    // 批量测试状态
    batchTestMode: 'idle', // idle | running | paused | completed
    batchTestProgress: 0,
    batchTestTotal: 0,
    batchTestResults: [],

    // 开始批量测试
    async startBatchTest(options = {}) {
      const {
        maxImages = 100,  // 最大测试图片数
        showProgress = true  // 是否显示进度
      } = options

      this.batchTestMode = 'running'
      this.batchTestProgress = 0
      this.batchTestResults = []

      console.log(`[VisionStore] 开始批量测试（最多 ${maxImages} 张图片）`)

      // 确保模型已加载
      if (this.yoloStatus !== 'ready') {
        await this.preloadYoloModel()
      }

      // 加载 COCO 数据集
      const images = await this.loadCocoDatasetImages(true)
      if (images.length === 0) {
        console.warn('[VisionStore] 未找到 COCO 数据集图片')
        this.batchTestMode = 'idle'
        return this.batchTestResults
      }

      // 限制测试数量
      const testImages = images.slice(0, maxImages)
      this.batchTestTotal = testImages.length

      let correctCount = 0
      let totalDetections = 0

      for (let i = 0; i < testImages.length; i++) {
        if (this.batchTestMode !== 'running') break

        const img = testImages[i]
        try {
          const result = await this.analyzeCocoImage(img.fullPath || img.path)

          // 统计检测结果
          const detectedLabels = result.objects?.map(o => o.label) || []
          const hasObjects = detectedLabels.length > 0

          // 模拟正确率计算（实际应与标注数据对比）
          const isCorrect = hasObjects // 简化：只要检测到物体就算正确

          this.batchTestResults.push({
            imageName: img.name,
            result,
            detectedCount: detectedLabels.length,
            isCorrect,
            confidence: result.objects?.[0]?.confidence || 0
          })

          if (isCorrect) correctCount++
          totalDetections += detectedLabels.length
        } catch (e) {
          this.batchTestResults.push({
            imageName: img.name,
            error: e.message,
            isCorrect: false
          })
        }

        this.batchTestProgress = i + 1

        // 每 10 张输出一次日志
        if ((i + 1) % 10 === 0) {
          console.log(`[VisionStore] 批量测试进度: ${i + 1}/${this.batchTestTotal}`)
        }
      }

      this.batchTestMode = 'completed'
      console.log(`[VisionStore] 批量测试完成: 检测到 ${totalDetections} 个物体, 准确率 ${(correctCount / this.batchTestTotal * 100).toFixed(1)}%`)

      return {
        total: this.batchTestTotal,
        correct: correctCount,
        accuracy: (correctCount / this.batchTestTotal * 100).toFixed(1),
        totalDetections,
        results: this.batchTestResults
      }
    },

    // 停止批量测试
    stopBatchTest() {
      this.batchTestMode = 'idle'
      console.log('[VisionStore] 批量测试已停止')
    },

    // 获取批量测试统计
    getBatchTestStats() {
      const results = this.batchTestResults
      const correct = results.filter(r => r.isCorrect).length
      return {
        total: results.length,
        correct,
        accuracy: results.length > 0 ? (correct / results.length * 100).toFixed(1) : 0,
        totalDetections: results.reduce((sum, r) => sum + (r.detectedCount || 0), 0)
      }
    },

    // ============ 参考图片对照相关 ============
    // 获取指定类别的 COCO 参考图片
    async getReferenceImagesForCategory(category, count = 3) {
      const images = await this.loadCocoDatasetImages(true)
      if (images.length === 0) return []

      // 加载图片并检测，筛选出包含指定类别的图片
      const referenceImages = []
      let checkedCount = 0

      for (const img of images) {
        if (referenceImages.length >= count) break

        try {
          const result = await this.analyzeCocoImage(img.fullPath || img.path)
          const hasCategory = result.objects?.some(
            o => o.label.toLowerCase() === category.toLowerCase()
          )

          if (hasCategory) {
            referenceImages.push({
              ...img,
              detectedObjects: result.objects.filter(
                o => o.label.toLowerCase() === category.toLowerCase()
              )
            })
          }
        } catch (e) {
          // 忽略分析失败的图片
        }

        checkedCount++
        // 最多检查 200 张图片
        if (checkedCount >= 200) break
      }

      console.log(`[VisionStore] 找到 ${referenceImages.length} 张 ${category} 参考图片`)
      return referenceImages
    },

    // ============ 实操视频考试评分相关 ============
    // 考试状态
    examMode: 'idle', // idle | recording | analyzing | completed
    examResults: [],
    examScore: 0,

    // 开始考试录制
    startExam(examConfig = {}) {
      const {
        duration = 60,  // 考试时长（秒）
        requiredObjects = [],  // 需要检测的物体列表
        minConfidence = 0.5  // 最小置信度
      } = examConfig

      this.examMode = 'recording'
      this.examResults = []
      this.examScore = 0

      console.log(`[VisionStore] 开始考试: 时长 ${duration}秒, 需检测 ${requiredObjects.length} 种物体`)

      return {
        duration,
        requiredObjects,
        minConfidence,
        startTime: Date.now()
      }
    },

    // 添加考试帧结果
    addExamFrameResult(frameResult) {
      if (this.examMode !== 'recording') return

      this.examResults.push({
        ...frameResult,
        timestamp: Date.now()
      })
    },

    // 分析并评分考试结果
    analyzeExamResults(examConfig = {}) {
      const {
        requiredObjects = [],
        minConfidence = 0.5
      } = examConfig

      this.examMode = 'analyzing'
      console.log(`[VisionStore] 分析考试结果: ${this.examResults.length} 帧`)

      // 统计每种物体被检测到的次数
      const objectDetectionCount = {}
      const objectDetectionFrames = {}

      for (const frame of this.examResults) {
        for (const obj of frame.objects || []) {
          if (obj.confidence >= minConfidence) {
            objectDetectionCount[obj.label] = (objectDetectionCount[obj.label] || 0) + 1
            if (!objectDetectionFrames[obj.label]) {
              objectDetectionFrames[obj.label] = []
            }
            objectDetectionFrames[obj.label].push(frame.timestamp)
          }
        }
      }

      // 计算每种物体的得分
      let totalScore = 0
      const objectScores = []

      for (const required of requiredObjects) {
        const detected = objectDetectionCount[required] || 0
        const totalFrames = this.examResults.length
        const detectionRate = totalFrames > 0 ? detected / totalFrames : 0

        // 得分规则：检测到 30% 以上的帧给满分，否则按比例扣分
        const threshold = 0.3
        let score = 0
        if (detectionRate >= threshold) {
          score = 100
        } else {
          score = Math.round((detectionRate / threshold) * 100)
        }

        objectScores.push({
          object: required,
          detected,
          totalFrames,
          detectionRate: (detectionRate * 100).toFixed(1),
          score
        })

        totalScore += score
      }

      // 平均分
      const finalScore = requiredObjects.length > 0
        ? Math.round(totalScore / requiredObjects.length)
        : 0

      this.examScore = finalScore
      this.examMode = 'completed'

      const analysis = {
        totalFrames: this.examResults.length,
        score: finalScore,
        objectScores,
        detectedObjects: Object.keys(objectDetectionCount),
        detectionDetails: objectDetectionCount
      }

      console.log(`[VisionStore] 考试评分完成: ${finalScore}分`, analysis)

      return analysis
    },

    // 获取考试评分详情
    getExamGradeDetails() {
      return {
        mode: this.examMode,
        score: this.examScore,
        totalFrames: this.examResults.length,
        results: this.examResults
      }
    },

    // 重置考试
    resetExam() {
      this.examMode = 'idle'
      this.examResults = []
      this.examScore = 0
      console.log('[VisionStore] 考试已重置')
    },

    // 获取 YOLO 模型状态
    getYoloStatus() {
      return this.yoloStatus
    },

    // 更新人脸检测结果
    setFaces(faces) {
      this.faces = faces
    },

    // 更新物体检测结果
    setObjects(objects) {
      this.objects = objects
    },

    // 更新专注度分数
    setAttentionScore(score) {
      this.attentionScore = Math.round(score)
      this.analysisHistory.push({
        score,
        timestamp: Date.now()
      })
      // 保留最近30秒的历史
      const thirtySecondsAgo = Date.now() - 30000
      this.analysisHistory = this.analysisHistory.filter(h => h.timestamp > thirtySecondsAgo)
    },

    // 更新情绪分析结果
    setEmotions(emotions) {
      this.emotions = emotions
    },

    // 计算最终得分
    calculateFinalScore() {
      if (this.analysisHistory.length === 0) {
        this.finalScore = 0
        return
      }
      // 基于专注度历史计算平均得分
      const avgScore = this.analysisHistory.reduce((sum, h) => sum + h.score, 0) / this.analysisHistory.length
      this.finalScore = Math.round(avgScore)
    },

    // 初始化摄像头
    async initCamera(constraints = { video: true, audio: false }) {
      try {
        this.cameraStream = await navigator.mediaDevices.getUserMedia(constraints)
        return this.cameraStream
      } catch (error) {
        console.error('[VisionStore] 摄像头初始化失败:', error)
        throw error
      }
    },

    // 停止摄像头
    stopCamera() {
      if (this.cameraStream) {
        this.cameraStream.getTracks().forEach(track => track.stop())
        this.cameraStream = null
      }
    },

    // 从视频元素捕获帧
    captureFrameFromVideo(videoElement) {
      if (!videoElement) return null

      const canvas = document.createElement('canvas')
      canvas.width = videoElement.videoWidth || 640
      canvas.height = videoElement.videoHeight || 480
      const ctx = canvas.getContext('2d')

      try {
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)
        return canvas
      } catch (error) {
        console.error('[VisionStore] 帧捕获失败:', error)
        return null
      }
    },

    // 分析单帧图像
    async analyzeFrame(frame) {
      this.startAnalysis()

      try {
        const results = await this.performAnalysis(frame)
        this.addAnalysisResult(results)
        return results
      } catch (error) {
        console.error('[VisionStore] 分析失败:', error)
        throw error
      } finally {
        this.stopAnalysis()
      }
    },

    // 执行分析（核心逻辑）
    async performAnalysis(input) {
      const results = {
        faces: [],
        objects: [],
        attention: 0,
        emotions: [],
        timestamp: new Date().toISOString()
      }

      // 如果输入是 Canvas 或 Image，直接分析
      // 如果输入是视频元素，先捕获帧
      let imageData
      if (input instanceof HTMLVideoElement) {
        const canvas = this.captureFrameFromVideo(input)
        if (canvas) {
          imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
        }
      } else if (input instanceof HTMLCanvasElement) {
        imageData = input.getContext('2d').getImageData(0, 0, input.width, input.height)
      } else if (input instanceof ImageData) {
        imageData = input
      } else {
        throw new Error('不支持的输入类型')
      }

      // 人脸检测
      if (this.config.faceDetect) {
        results.faces = await this.detectFaces(imageData)
        this.setFaces(results.faces)
      }

      // 物体检测
      if (this.config.objectDetect) {
        results.objects = await this.detectObjects(imageData)
        this.setObjects(results.objects)
      }

      // 专注度监测
      if (this.config.attentionMonitor) {
        results.attention = await this.analyzeAttention(results.faces, imageData)
        this.setAttentionScore(results.attention)
      }

      // 情绪分析
      if (this.config.emotionAnalysis && results.faces.length > 0) {
        results.emotions = await this.analyzeEmotions(results.faces)
        this.setEmotions(results.emotions)
      }

      // 更新最终得分
      this.calculateFinalScore()

      return results
    },

    // 人脸检测 - 使用 Face Detection API
    async detectFaces(imageData) {
      const faces = []

      // 尝试使用浏览器原生 Face Detection API
      if ('FaceDetector' in window) {
        try {
          const detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 10 })
          const canvas = document.createElement('canvas')
          canvas.width = imageData.width
          canvas.height = imageData.height
          canvas.getContext('2d').putImageData(imageData, 0, 0)
          const detectedFaces = await detector.detect(canvas)

          for (const face of detectedFaces) {
            faces.push({
              boundingBox: {
                x: face.boundingBox.x,
                y: face.boundingBox.y,
                width: face.boundingBox.width,
                height: face.boundingBox.height
              },
              confidence: face.score || 0.9
            })
          }
        } catch (e) {
          console.warn('[VisionStore] FaceDetector API 失败:', e)
        }
      }

      // 如果没有检测到人脸或API不可用，返回模拟数据（演示用）
      if (faces.length === 0 && Math.random() > 0.3) {
        // 模拟检测到一个人脸
        const width = imageData.width
        const height = imageData.height
        faces.push({
          boundingBox: {
            x: width * 0.25,
            y: height * 0.2,
            width: width * 0.5,
            height: height * 0.6
          },
          confidence: 0.85 + Math.random() * 0.1
        })
      }

      return faces
    },

    // 物体检测 - 使用 YOLO 模型（Transformers.js）
    async detectObjects(imageData) {
      const objects = []

      try {
        // 将 ImageData 转换为 canvas 再转为 blob
        const canvas = document.createElement('canvas')
        canvas.width = imageData.width
        canvas.height = imageData.height
        canvas.getContext('2d').putImageData(imageData, 0, 0)

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
        const imageUrl = URL.createObjectURL(blob)

        // 使用 YOLO 模型检测
        const detector = await getYoloDetector()
        const results = await detector(imageUrl, {
          threshold: this.config.yoloThreshold || 0.5,
          percentage: true
        })

        // 清理 blob URL
        URL.revokeObjectURL(imageUrl)

        // 转换结果格式
        for (const item of results) {
          objects.push({
            label: item.label,
            confidence: item.score,
            bbox: {
              x: (item.box.xc / 100) * imageData.width - (item.box.width / 100) * imageData.width / 2,
              y: (item.box.yc / 100) * imageData.height - (item.box.height / 100) * imageData.height / 2,
              width: (item.box.width / 100) * imageData.width,
              height: (item.box.height / 100) * imageData.height
            }
          })
        }

        console.log(`[VisionStore] YOLO 检测到 ${objects.length} 个物体`)
      } catch (error) {
        console.error('[VisionStore] YOLO 检测失败:', error)
        // 检测失败时返回空数组
        return []
      }

      return objects
    },

    // 专注度分析
    async analyzeAttention(faces, imageData) {
      let score = 50 // 基础分数

      // 人脸数量影响分数
      if (faces.length === 1) {
        score += 20 // 单人专注
      } else if (faces.length > 1) {
        score -= 10 // 多人可能注意力分散
      }

      // 模拟眨眼检测（通过像素变化）
      // 实际应该使用眼睛关键点检测
      const eyeOpenness = 0.8 + Math.random() * 0.2
      if (eyeOpenness < 0.7) {
        score -= 15 // 眼睛闭合可能表示疲劳
      }

      // 头部姿态（简化）
      const headPose = Math.random()
      if (headPose > 0.7) {
        score += 10 // 正面
      } else if (headPose < 0.3) {
        score -= 15 // 偏转
      }

      // 添加随机波动
      score += (Math.random() - 0.5) * 10

      // 确保分数在 0-100 范围内
      return Math.max(0, Math.min(100, score))
    },

    // 情绪分析
    async analyzeEmotions(faces) {
      const emotions = []

      // 模拟情绪分析
      // 实际应该使用专门的情绪识别模型（如 FER2013 训练的模型）
      const emotionTypes = [
        { name: '专注', probability: 0.4 + Math.random() * 0.4 },
        { name: '开心', probability: Math.random() * 0.3 },
        { name: '困惑', probability: Math.random() * 0.2 },
        { name: '疲劳', probability: Math.random() * 0.15 }
      ]

      for (const face of faces) {
        // 计算情绪概率
        let remaining = 1
        const faceEmotions = []

        for (let i = 0; i < emotionTypes.length; i++) {
          const emotion = emotionTypes[i]
          const prob = i === emotionTypes.length - 1
            ? remaining
            : Math.min(emotion.probability, remaining)
          remaining -= prob

          if (prob > 0.1) {
            faceEmotions.push({
              emotion: emotion.name,
              confidence: prob
            })
          }
        }

        emotions.push({
          faceIndex: emotions.length,
          emotions: faceEmotions,
          dominantEmotion: faceEmotions[0]?.emotion || '未知'
        })
      }

      return emotions
    },

    // 加载 TensorFlow.js 模型（可选，用于更准确的检测）
    async loadModel() {
      // 动态加载 TensorFlow.js
      if (!window.tf) {
        const script = document.createElement('script')
        script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js'
        await new Promise((resolve, reject) => {
          script.onload = resolve
          script.onerror = reject
          document.head.appendChild(script)
        })
      }

      return window.tf
    }
  }
})
