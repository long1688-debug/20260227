/**
 * COCO 数据集处理模块
 * 提供 COCO 数据集的加载、解析和管理功能
 */

// COCO 80 类标签
export const COCO_LABELS = [
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

// 数据集配置
const DEFAULT_CONFIG = {
  localPath: 'F:\\coco',
  useLocalDataset: false,
  valDir: 'val2017',
  trainDir: 'train2017',
  annotationsDir: 'annotations',
  imageExtensions: ['.jpg', '.jpeg', '.png']
}

/**
 * COCO 数据集管理器
 */
export class CocoDatasetManager {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.images = []
    this.annotations = {}
    this.currentIndex = 0
    this.loaded = false
  }

  /**
   * 设置本地数据集路径
   */
  setLocalPath(path) {
    this.config.localPath = path
    this.config.useLocalDataset = true
    console.log(`[CocoDataset] 数据集路径已设置: ${path}`)
  }

  /**
   * 获取本地数据集路径
   */
  getLocalPath() {
    return this.config.localPath
  }

  /**
   * 加载图片列表
   * @param {boolean} useValDir - 是否使用验证集目录
   */
  async loadImages(useValDir = true) {
    const dirName = useValDir ? this.config.valDir : this.config.trainDir
    const dirPath = `${this.config.localPath}\\${dirName}`

    console.log(`[CocoDataset] 加载 ${dirName} 图片列表...`)

    this.images = []
    this.loaded = false

    try {
      // Tauri 环境使用 fs 插件
      if (typeof window !== 'undefined' && window.__TAURI__) {
        const { readDir } = await import('@tauri-apps/plugin-fs')
        const entries = await readDir(dirPath)

        for (const entry of entries) {
          if (entry.isFile) {
            const ext = entry.name.split('.').pop().toLowerCase()
            if (this.config.imageExtensions.includes(`.${ext}`)) {
              this.images.push({
                name: entry.name,
                fileName: entry.name,
                path: `${dirPath}\\${entry.name}`,
                fullPath: `${dirPath}\\${entry.name}`,
                directory: dirName
              })
            }
          }
        }
      } else {
        // Web 环境：需要本地服务器配置
        console.warn('[CocoDataset] Web 环境需要配置本地服务器来访问数据集')
        return []
      }

      this.images.sort((a, b) => a.name.localeCompare(b.name))
      this.currentIndex = 0
      this.loaded = true

      console.log(`[CocoDataset] 已加载 ${this.images.length} 张图片`)
      return this.images
    } catch (error) {
      console.error('[CocoDataset] 加载图片列表失败:', error)
      return []
    }
  }

  /**
   * 加载标注文件
   * @param {boolean} useValDir - 是否使用验证集标注
   */
  async loadAnnotations(useValDir = true) {
    const fileName = useValDir
      ? 'instances_val2017.json'
      : 'instances_train2017.json'
    const filePath = `${this.config.localPath}\\${this.config.annotationsDir}\\${fileName}`

    console.log(`[CocoDataset] 加载标注文件: ${fileName}`)

    try {
      if (typeof window !== 'undefined' && window.__TAURI__) {
        const { readTextFile } = await import('@tauri-apps/plugin-fs')
        const content = await readTextFile(filePath)
        this.annotations = JSON.parse(content)
        console.log(`[CocoDataset] 标注文件加载成功，包含 ${this.annotations.images?.length || 0} 张图片的标注`)
      } else {
        const response = await fetch(filePath)
        this.annotations = await response.json()
      }

      return this.annotations
    } catch (error) {
      console.warn('[CocoDataset] 加载标注文件失败:', error)
      return {}
    }
  }

  /**
   * 获取当前图片
   */
  getCurrentImage() {
    if (!this.loaded || this.images.length === 0) return null
    return this.images[this.currentIndex]
  }

  /**
   * 获取下一张图片
   */
  getNextImage() {
    if (!this.loaded || this.images.length === 0) return null
    this.currentIndex = (this.currentIndex + 1) % this.images.length
    return this.images[this.currentIndex]
  }

  /**
   * 获取上一张图片
   */
  getPreviousImage() {
    if (!this.loaded || this.images.length === 0) return null
    this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length
    return this.images[this.currentIndex]
  }

  /**
   * 根据索引获取图片
   */
  getImageByIndex(index) {
    if (!this.loaded || index < 0 || index >= this.images.length) return null
    this.currentIndex = index
    return this.images[index]
  }

  /**
   * 获取随机图片
   */
  getRandomImage() {
    if (!this.loaded || this.images.length === 0) return null
    this.currentIndex = Math.floor(Math.random() * this.images.length)
    return this.images[this.currentIndex]
  }

  /**
   * 获取指定数量的随机图片
   */
  getRandomImages(count = 5) {
    if (!this.loaded || this.images.length === 0) return []

    const shuffled = [...this.images].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, Math.min(count, this.images.length))
  }

  /**
   * 获取图片数量
   */
  getImageCount() {
    return this.images.length
  }

  /**
   * 获取当前索引
   */
  getCurrentIndex() {
    return this.currentIndex
  }

  /**
   * 根据图片ID获取标注
   */
  getAnnotationsForImage(imageId) {
    if (!this.annotations.annotations) return []

    return this.annotations.annotations.filter(
      ann => ann.image_id === imageId
    )
  }

  /**
   * 根据图片文件名获取标注
   */
  getAnnotationsForImageFile(fileName) {
    if (!this.annotations.images || !this.annotations.annotations) return []

    const imageInfo = this.annotations.images.find(
      img => img.file_name === fileName
    )

    if (!imageInfo) return []

    return this.annotations.annotations.filter(
      ann => ann.image_id === imageInfo.id
    )
  }

  /**
   * 获取类别名称
   */
  getCategoryName(categoryId) {
    if (!this.annotations.categories) return 'unknown'

    const category = this.annotations.categories.find(
      cat => cat.id === categoryId
    )

    return category ? category.name : 'unknown'
  }

  /**
   * 获取所有类别
   */
  getCategories() {
    return this.annotations.categories || []
  }

  /**
   * 搜索包含指定类别的图片
   */
  async searchImagesByCategory(categoryName, maxResults = 10) {
    if (!this.loaded) await this.loadImages()
    if (!this.annotations.categories) await this.loadAnnotations()

    const category = this.annotations.categories?.find(
      cat => cat.name === categoryName || cat.supercategory === categoryName
    )

    if (!category) {
      console.warn(`[CocoDataset] 未找到类别: ${categoryName}`)
      return []
    }

    const imageIds = new Set()
    for (const ann of this.annotations.annotations || []) {
      if (ann.category_id === category.id) {
        imageIds.add(ann.image_id)
        if (imageIds.size >= maxResults) break
      }
    }

    const result = []
    for (const img of this.images) {
      const imgInfo = this.annotations.images?.find(
        info => info.file_name === img.name
      )
      if (imgInfo && imageIds.has(imgInfo.id)) {
        result.push(img)
        if (result.length >= maxResults) break
      }
    }

    return result
  }

  /**
   * 转换本地路径为可访问的URL
   */
  async convertToUrl(localPath) {
    if (typeof window !== 'undefined' && window.__TAURI__) {
      const { convertFileSrc } = await import('@tauri-apps/api/core')
      return convertFileSrc(localPath)
    }
    return localPath
  }

  /**
   * 验证数据集是否完整
   */
  async validateDataset() {
    const checks = [
      { name: '验证集目录', path: `${this.config.localPath}\\${this.config.valDir}`, required: true },
      { name: '训练集目录', path: `${this.config.localPath}\\${this.config.trainDir}`, required: false },
      { name: '标注目录', path: `${this.config.localPath}\\${this.config.annotationsDir}`, required: true }
    ]

    const results = []
    let isValid = true

    for (const check of checks) {
      try {
        if (typeof window !== 'undefined' && window.__TAURI__) {
          const { exists } = await import('@tauri-apps/plugin-fs')
          const existsResult = await exists(check.path)
          results.push({ ...check, exists: existsResult })
          if (check.required && !existsResult) isValid = false
        } else {
          // Web 环境无法直接验证文件系统
          results.push({ ...check, exists: true, warning: 'Web环境无法验证' })
        }
      } catch {
        results.push({ ...check, exists: false })
        if (check.required) isValid = false
      }
    }

    return {
      isValid,
      checks: results,
      path: this.config.localPath
    }
  }

  /**
   * 获取数据集统计信息
   */
  async getStatistics() {
    await this.loadImages()
    await this.loadAnnotations()

    const stats = {
      totalImages: this.images.length,
      totalAnnotations: this.annotations.annotations?.length || 0,
      totalCategories: this.annotations.categories?.length || 80,
      hasAnnotations: Object.keys(this.annotations).length > 0,
      loaded: this.loaded,
      path: this.config.localPath
    }

    return stats
  }
}

// 创建单例实例
let instance = null

export function getCocoDatasetManager() {
  if (!instance) {
    instance = new CocoDatasetManager()
  }
  return instance
}

// 导出常用函数
export const cocoDataset = {
  manager: getCocoDatasetManager,
  labels: COCO_LABELS,
  createManager: (config) => new CocoDatasetManager(config)
}
