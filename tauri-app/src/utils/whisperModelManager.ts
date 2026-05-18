/**
 * Whisper 模型下载管理器
 *
 * 功能：
 * - 管理多种模型的下载
 * - 显示下载进度
 * - 本地缓存管理
 * - 模型切换
 */

import { ref, reactive } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

// ==================== 类型定义 ====================

export interface WhisperModel {
  id: string
  name: string
  description: string
  size: string
  downloadUrl?: string
  localPath?: string
  downloaded: boolean
  downloading: boolean
  progress: number
  error?: string
}

export interface DownloadProgress {
  modelId: string
  progress: number
  speed: string
  eta: string
  status: 'downloading' | 'completed' | 'error'
}

// ==================== 可用模型列表 ====================

export const AVAILABLE_MODELS: WhisperModel[] = [
  {
    id: 'tiny',
    name: 'Tiny',
    description: '最快，精度较低（39M）',
    size: '39 MB',
    downloaded: false,
    downloading: false,
    progress: 0
  },
  {
    id: 'base',
    name: 'Base',
    description: '快速，精度一般（74M）',
    size: '74 MB',
    downloaded: false,
    downloading: false,
    progress: 0
  },
  {
    id: 'small',
    name: 'Small',
    description: '平衡速度和精度（244M）',
    size: '244 MB',
    downloaded: false,
    downloading: false,
    progress: 0
  },
  {
    id: 'medium',
    name: 'Medium',
    description: '高精度，速度较慢（769M）',
    size: '769 MB',
    downloaded: false,
    downloading: false,
    progress: 0
  },
  {
    id: 'large',
    name: 'Large',
    description: '最高精度，速度最慢（1.5G）',
    size: '1.5 GB',
    downloaded: false,
    downloading: false,
    progress: 0
  }
]

// ==================== 状态管理 ====================

const models = reactive<WhisperModel[]>([...AVAILABLE_MODELS])
const currentModel = ref<string>('base')
const isInitializing = ref(false)

// 从 localStorage 加载模型状态
function loadModelState() {
  try {
    const saved = localStorage.getItem('whisper-models')
    if (saved) {
      const parsed = JSON.parse(saved)
      parsed.forEach((model: any) => {
        const existing = models.find(m => m.id === model.id)
        if (existing) {
          existing.downloaded = model.downloaded
          existing.localPath = model.localPath
        }
      })
    }

    const savedCurrent = localStorage.getItem('whisper-current-model')
    if (savedCurrent) {
      currentModel.value = savedCurrent
    }
  } catch (error) {
    console.error('[ModelManager] 加载模型状态失败:', error)
  }
}

// 保存模型状态到 localStorage
function saveModelState() {
  try {
    const state = models.map(m => ({
      id: m.id,
      downloaded: m.downloaded,
      localPath: m.localPath
    }))
    localStorage.setItem('whisper-models', JSON.stringify(state))
    localStorage.setItem('whisper-current-model', currentModel.value)
  } catch (error) {
    console.error('[ModelManager] 保存模型状态失败:', error)
  }
}

// ==================== 核心功能 ====================

/**
 * 初始化模型管理器
 */
export async function initModelManager() {
  loadModelState()
  await checkModelsStatus()
}

/**
 * 检查所有模型的下载状态
 */
async function checkModelsStatus() {
  try {
    // 🎯 调用 Rust 后端检查每个模型
    for (const model of models) {
      try {
        const result = await invoke<any>('check_whisper_model_exists', { modelId: model.id })
        model.downloaded = result.exists
        if (result.exists) {
          model.localPath = result.path
        }
      } catch (error) {
        console.warn(`[ModelManager] 检查模型 ${model.id} 失败:`, error)
      }
    }

    saveModelState()
  } catch (error) {
    console.error('[ModelManager] 检查模型状态失败:', error)
  }
}

/**
 * 下载指定模型
 */
export async function downloadModel(modelId: string, onProgress?: (progress: DownloadProgress) => void) {
  const model = models.find(m => m.id === modelId)
  if (!model) {
    throw new Error(`模型 ${modelId} 不存在`)
  }

  if (model.downloaded) {
    console.log('[ModelManager] 模型已下载:', modelId)
    return
  }

  if (model.downloading) {
    console.log('[ModelManager] 模型正在下载中:', modelId)
    return
  }

  model.downloading = true
  model.progress = 0
  model.error = undefined

  try {
    console.log('[ModelManager] 开始下载模型:', modelId)

    // 🎯 调用 Rust 后端下载模型
    const result = await invoke<any>('download_whisper_model', { modelId })

    // 获取当前窗口
    const appWindow = getCurrentWindow()

    // 监听下载进度事件
    const unlisten = await appWindow.listen('whisper-download-progress', (event: any) => {
      const progress = event.payload
      model.progress = progress.progress

      if (onProgress) {
        onProgress({
          modelId,
          progress: progress.progress,
          speed: `${(progress.speed_kbps / 1024).toFixed(1)} MB/s`,
          eta: `${progress.eta_seconds}s`,
          status: 'downloading'
        })
      }
    })

    // 等待下载完成
    await new Promise<void>((resolve, reject) => {
      const checkComplete = setInterval(() => {
        if (model.progress >= 100) {
          clearInterval(checkComplete)
          unlisten()
          resolve()
        }
      }, 500)

      setTimeout(() => {
        clearInterval(checkComplete)
        unlisten()
        reject(new Error('下载超时'))
      }, 300000) // 5分钟超时
    })

    model.downloaded = true
    model.downloading = false
    model.progress = 100
    model.localPath = result.path || `~/.cache/whisper/ggml-${modelId}.bin`

    saveModelState()

    console.log('[ModelManager] 模型下载完成:', modelId)

    if (onProgress) {
      onProgress({
        modelId,
        progress: 100,
        speed: '0 MB/s',
        eta: '0s',
        status: 'completed'
      })
    }
  } catch (error) {
    model.downloading = false
    model.error = error instanceof Error ? error.message : String(error)

    console.error('[ModelManager] 模型下载失败:', modelId, error)

    if (onProgress) {
      onProgress({
        modelId,
        progress: model.progress,
        speed: '0 MB/s',
        eta: '-',
        status: 'error'
      })
    }

    throw error
  }
}

/**
 * 删除已下载的模型
 */
export async function deleteModel(modelId: string) {
  const model = models.find(m => m.id === modelId)
  if (!model) {
    throw new Error(`模型 ${modelId} 不存在`)
  }

  if (!model.downloaded) {
    console.log('[ModelManager] 模型未下载:', modelId)
    return
  }

  try {
    console.log('[ModelManager] 删除模型:', modelId)

    // 🎯 调用 Rust 后端删除模型文件
    await invoke('delete_whisper_model', { modelId })

    model.downloaded = false
    model.localPath = undefined
    model.progress = 0

    // 如果删除的是当前模型，切换到 base
    if (currentModel.value === modelId) {
      currentModel.value = 'base'
    }

    saveModelState()

    console.log('[ModelManager] 模型删除成功:', modelId)
  } catch (error) {
    console.error('[ModelManager] 模型删除失败:', modelId, error)
    throw error
  }
}

/**
 * 切换当前使用的模型
 */
export async function switchModel(modelId: string) {
  const model = models.find(m => m.id === modelId)
  if (!model) {
    throw new Error(`模型 ${modelId} 不存在`)
  }

  if (!model.downloaded) {
    throw new Error(`模型 ${modelId} 未下载，请先下载`)
  }

  try {
    console.log('[ModelManager] 切换模型:', modelId)

    // 重新初始化 Whisper 使用新模型
    await invoke('init_whisper', {
      config: {
        model_type: modelId,
        language: 'zh',
        translate: false,
        sample_rate: 16000
      }
    })

    currentModel.value = modelId
    saveModelState()

    console.log('[ModelManager] 模型切换成功:', modelId)
  } catch (error) {
    console.error('[ModelManager] 模型切换失败:', modelId, error)
    throw error
  }
}

/**
 * 获取所有模型列表
 */
export function getModels() {
  return models
}

/**
 * 获取当前模型
 */
export function getCurrentModel() {
  return models.find(m => m.id === currentModel.value)
}

/**
 * 获取存储空间使用情况
 */
export function getStorageUsage() {
  const downloadedModels = models.filter(m => m.downloaded)
  const totalSize = downloadedModels.reduce((sum, m) => {
    const sizeMap: Record<string, number> = {
      'tiny': 39,
      'base': 74,
      'small': 244,
      'medium': 769,
      'large': 1500
    }
    return sum + (sizeMap[m.id] || 0)
  }, 0)

  return {
    count: downloadedModels.length,
    totalSizeMB: totalSize,
    totalSizeGB: (totalSize / 1024).toFixed(2)
  }
}

// ==================== 辅助函数 ====================

/**
 * 模拟下载进度（仅用于测试，实际应该从后端获取）
 */
async function simulateDownload(model: WhisperModel, onProgress?: (progress: DownloadProgress) => void) {
  const steps = 20
  for (let i = 1; i <= steps; i++) {
    await new Promise(resolve => setTimeout(resolve, 200))
    model.progress = Math.round((i / steps) * 100)

    if (onProgress) {
      const speed = (Math.random() * 5 + 2).toFixed(1)
      const remaining = Math.ceil((steps - i) * 0.2)

      onProgress({
        modelId: model.id,
        progress: model.progress,
        speed: `${speed} MB/s`,
        eta: `${remaining}s`,
        status: 'downloading'
      })
    }
  }
}

// 初始化时加载状态
loadModelState()
