/**
 * 信号源管理 Composable
 * 
 * 职责：
 * - 管理信号源的添加、删除、重命名等操作
 * - 管理采集卡设备列表
 * - 管理高拍仪设备列表
 * 
 * 设计模式：
 * - 依赖注入：通过 options 参数注入 store 和响应式引用，便于测试和解耦
 */

import { ref, type Ref } from 'vue'
import { ElMessage } from 'element-plus'

/**
 * 信号源类型枚举
 */
export enum SourceType {
  CAMERA = 'camera',           // 摄像头
  CAPTURE_CARD = 'captureCard', // 采集卡
  SCANNER = 'scanner',         // 高拍仪
  SCREEN = 'screen',           // 屏幕共享
  FILE = 'file',               // 文件（PPT/PDF/Word）
  RTMP = 'rtmp'                // RTMP 流
}

/**
 * 信号源接口
 */
export interface VideoSource {
  id: string
  name: string
  type: SourceType
  deviceId?: string
  url?: string
  resolution?: string
  fps?: number
}

/**
 * 设备接口
 */
export interface CaptureDevice {
  id: string
  name: string
  device_type: string
  interface_type?: string
  resolution?: string
  fps?: number
  is_available: boolean
}

/**
 * 信号源存储接口（简化版）
 * 用于依赖注入，解耦具体的 Pinia store 或其他状态管理实现
 */
export interface SourceStoreLike {
  addSource: (source: VideoSource) => Promise<void>
  removeSource: (sourceId: string) => void
  renameSource: (sourceId: string, newName: string) => void
}

/**
 * 信号源管理选项
 */
export interface UseSourceManagerOptions {
  /** [依赖注入] 信号源存储对象 */
  sourceStore?: SourceStoreLike
  /** [依赖注入] 是否显示添加信号源对话框的响应式引用 */
  showAddSourceDialog?: Ref<boolean>
  /** [依赖注入] 采集卡设备列表的响应式引用 */
  captureDevices?: Ref<CaptureDevice[]>
  /** [依赖注入] 高拍仪设备列表的响应式引用 */
  scannerDevices?: Ref<CaptureDevice[]>
}

/**
 * 信号源管理器返回值
 */
export interface UseSourceManagerReturn {
  /** 显示添加信号源对话框 */
  showAddSourceDialog: Ref<boolean>
  /** 采集卡设备列表 */
  captureDevices: Ref<CaptureDevice[]>
  /** 高拍仪设备列表 */
  scannerDevices: Ref<CaptureDevice[]>
  /** 打开添加信号源对话框 */
  openAddSourceDialog: () => void
  /** 关闭添加信号源对话框 */
  closeAddSourceDialog: () => void
  /** 添加信号源 */
  addSource: (source: Partial<VideoSource>) => Promise<void>
  /** 删除信号源 */
  deleteSource: (sourceId: string) => void
  /** 重命名信号源 */
  renameSource: (sourceId: string, newName: string) => void
  /** 刷新设备列表 */
  refreshDevices: () => Promise<void>
}

/**
 * 使用信号源管理器
 * @param options 配置选项，支持依赖注入
 */
export function useSourceManager(options: UseSourceManagerOptions = {}): UseSourceManagerReturn {
  // 依赖注入：优先使用外部传入的 store，否则为 undefined（需在方法中检查）
  const sourceStore = options.sourceStore
  
  // 依赖注入：优先使用外部传入的 Ref，否则创建内部的 Ref
  const showAddSourceDialog = options.showAddSourceDialog ?? ref(false)
  const captureDevices = options.captureDevices ?? ref<CaptureDevice[]>([])
  const scannerDevices = options.scannerDevices ?? ref<CaptureDevice[]>([])

  /**
   * 打开添加信号源对话框
   */
  const openAddSourceDialog = () => {
    showAddSourceDialog.value = true
    console.log('[信号源管理] 打开添加对话框')
  }

  /**
   * 关闭添加信号源对话框
   */
  const closeAddSourceDialog = () => {
    showAddSourceDialog.value = false
    console.log('[信号源管理] 关闭添加对话框')
  }

  /**
   * 添加信号源
   * @param source 信号源信息
   */
  const addSource = async (source: Partial<VideoSource>) => {
    try {
      if (!sourceStore) {
        console.warn('[信号源管理] sourceStore 未提供，无法添加信号源')
        ElMessage.warning('系统初始化未完成，请稍后重试')
        return
      }
      
      if (!source.name) {
        ElMessage.warning('请输入信号源名称')
        return
      }
      
      if (!source.type) {
        ElMessage.warning('请选择信号源类型')
        return
      }
      
      // 调用注入的 store 添加信号源
      await sourceStore.addSource(source as VideoSource)
      
      closeAddSourceDialog()
      ElMessage.success('信号源添加成功')
      console.log('[信号源管理] 添加信号源成功:', source)
    } catch (error) {
      console.error('[信号源管理] 添加信号源失败:', error)
      ElMessage.error('添加信号源失败')
    }
  }

  /**
   * 删除信号源
   * @param sourceId 信号源 ID
   */
  const deleteSource = (sourceId: string) => {
    try {
      if (!sourceStore) {
        console.warn('[信号源管理] sourceStore 未提供，无法删除信号源')
        ElMessage.warning('系统初始化未完成，请稍后重试')
        return
      }
      
      sourceStore.removeSource(sourceId)
      ElMessage.success('信号源删除成功')
      console.log('[信号源管理] 删除信号源成功:', sourceId)
    } catch (error) {
      console.error('[信号源管理] 删除信号源失败:', error)
      ElMessage.error('删除信号源失败')
    }
  }

  /**
   * 重命名信号源
   * @param sourceId 信号源 ID
   * @param newName 新名称
   */
  const renameSource = (sourceId: string, newName: string) => {
    try {
      if (!sourceStore) {
        console.warn('[信号源管理] sourceStore 未提供，无法重命名信号源')
        ElMessage.warning('系统初始化未完成，请稍后重试')
        return
      }
      
      if (!newName || newName.trim() === '') {
        ElMessage.warning('请输入新的名称')
        return
      }
      
      sourceStore.renameSource(sourceId, newName.trim())
      ElMessage.success('信号源重命名成功')
      console.log('[信号源管理] 重命名信号源成功:', sourceId, newName)
    } catch (error) {
      console.error('[信号源管理] 重命名信号源失败:', error)
      ElMessage.error('重命名失败')
    }
  }

  /**
   * 刷新设备列表
   * 注意：具体实现可能需要注入 API 服务或直接在组件中调用
   */
  const refreshDevices = async () => {
    try {
      // TODO: 此处可以注入 apiService 或直接调用后端接口
      // const devices = await apiService.getCaptureDevices()
      // captureDevices.value = devices.filter(d => d.device_type === 'CaptureCard')
      // scannerDevices.value = devices.filter(d => d.device_type === 'Scanner')
      
      console.log('[信号源管理] 刷新设备列表')
      ElMessage.info('设备列表刷新中...')
    } catch (error) {
      console.error('[信号源管理] 刷新设备列表失败:', error)
      ElMessage.error('刷新设备列表失败')
    }
  }

  return {
    showAddSourceDialog,
    captureDevices,
    scannerDevices,
    openAddSourceDialog,
    closeAddSourceDialog,
    addSource,
    deleteSource,
    renameSource,
    refreshDevices
  }
}
