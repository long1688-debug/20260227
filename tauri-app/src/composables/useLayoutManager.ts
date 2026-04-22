/**
 * 布局管理 Composable
 * 
 * 职责：
 * - 管理分屏布局切换（统一使用新布局索引）
 * - 管理画中画布局（固定位置，无需开关）
 * - 管理自由布局和自定义格子数量
 * 
 * 🎯 2026-04-20 更新：统一使用新布局索引方案
 * 布局索引对应关系:
 * 1-1分屏、2-2分屏、3-3分屏、4-4分屏、5-6分屏、7-9分屏、10-16分屏、
 * 11-25分屏、12-36分屏、13-49分屏、14-特殊布局1、15-特殊布局2、
 * 16-特殊布局3、17-特殊布局4、18-自由布局
 */

import { ref, type Ref } from 'vue'
import { ElMessage } from 'element-plus'

/**
 * 布局类型枚举 - 使用新布局索引
 */
export enum LayoutType {
  FREE = 18,       // 自由布局
  SINGLE = 1,      // 单屏 (1分屏)
  DOUBLE = 2,      // 双屏 (2分屏)
  TRIPLE = 3,      // 三屏 (3分屏)
  QUAD = 4,        // 四屏 (4分屏)
  SIX = 5,         // 六屏 (5=6分屏)
  NINE = 7,        // 九屏 (7=9分屏)
  SIXTEEN = 10,    // 十六屏 (10=16分屏)
  TWENTY_FIVE = 11, // 二十五屏 (11=25分屏)
  THIRTY_SIX = 12,  // 三十六屏 (12=36分屏)
  FORTY_NINE = 13   // 四十九屏 (13=49分屏)
}

/**
 * 画中画位置枚举
 */
export enum PipPosition {
  TOP_LEFT = 'top-left',
  TOP_RIGHT = 'top-right',
  BOTTOM_LEFT = 'bottom-left',
  BOTTOM_RIGHT = 'bottom-right'
}

/**
 * 布局信息接口
 */
export interface LayoutInfo {
  type: number
  pipPosition: string  // 画中画位置（固定显示）
}

/**
 * 布局存储接口（简化版）
 */
export interface LayoutStoreLike {
  setLayout: (layout: LayoutInfo) => void
  setPipPosition: (position: string) => void
  setCustomGridCount: (count: number) => void
}

/**
 * 布局管理选项
 */
export interface UseLayoutManagerOptions {
  /** 布局存储对象 */
  layoutStore?: LayoutStoreLike
  /** 当前布局类型 */
  currentLayout?: Ref<number>
  /** 画中画位置 */
  pipPosition?: Ref<string>
  /** 自定义格子数量 */
  customGridCount?: Ref<number>
}

/**
 * 布局管理器返回值
 */
export interface UseLayoutManagerReturn {
  /** 当前布局类型 */
  currentLayout: Ref<number>
  /** 画中画位置 */
  pipPosition: Ref<string>
  /** 自定义格子数量 */
  customGridCount: Ref<number>
  /** 处理布局切换 */
  handleLayoutChange: (newLayout: number, pipPosition?: string) => Promise<void>
  /** 设置画中画位置 */
  setPipPosition: (position: string) => void
  /** 处理自定义格子数量变化 */
  handleCustomCountChange: (value: number) => void
}

/**
 * 使用布局管理器
 */
export function useLayoutManager(options: UseLayoutManagerOptions = {}): UseLayoutManagerReturn {
  const layoutStore = options.layoutStore
  
  // 使用外部传入的引用，或创建内部引用
  const currentLayout = options.currentLayout || ref(LayoutType.SINGLE)
  const pipPosition = options.pipPosition || ref(PipPosition.TOP_RIGHT)
  const customGridCount = options.customGridCount || ref(4)

  /**
   * 处理布局切换
   * @param newLayout 新布局类型
   * @param pipPos 画中画位置（可选）
   */
  const handleLayoutChange = async (newLayout: number, pipPos?: string) => {
    try {
      console.log('[布局管理] 切换布局:', newLayout, pipPos ? `画中画位置: ${pipPos}` : '')
      
      // 更新布局类型
      currentLayout.value = newLayout
      
      // 如果提供了画中画位置，更新画中画位置
      if (pipPos !== undefined && pipPos) {
        pipPosition.value = pipPos
      }
      
      // 保存到 store
      if (layoutStore) {
        layoutStore.setLayout({
          type: newLayout,
          pipPosition: pipPosition.value
        })
      }
      
      ElMessage.success(`已切换到${getLayoutName(newLayout)}布局`)
      console.log('[布局管理] 布局切换成功')
    } catch (error) {
      console.error('[布局管理] 布局切换失败:', error)
      ElMessage.error('布局切换失败')
    }
  }

  /**
   * 设置画中画位置
   * @param position 画中画位置
   */
  const setPipPosition = (position: string) => {
    try {
      pipPosition.value = position
      console.log('[布局管理] 设置画中画位置:', position)
      
      // 更新 store
      if (layoutStore) {
        layoutStore.setPipPosition(position)
      }
    } catch (error) {
      console.error('[布局管理] 设置画中画位置失败:', error)
      ElMessage.error('设置失败')
    }
  }

  /**
   * 处理自定义格子数量变化
   * @param value 新的格子数量
   */
  const handleCustomCountChange = (value: number) => {
    try {
      // 限制范围在 1-49 之间
      const clampedValue = Math.max(1, Math.min(49, value))
      customGridCount.value = clampedValue
      
      // 如果是自由布局，更新 store
      if (currentLayout.value === LayoutType.FREE && layoutStore) {
        layoutStore.setCustomGridCount(clampedValue)
      }
      
      console.log('[布局管理] 自定义格子数量:', clampedValue)
    } catch (error) {
      console.error('[布局管理] 自定义格子数量设置失败:', error)
      ElMessage.error('设置失败')
    }
  }

  /**
   * 获取布局名称
   * @param layout 布局类型
   * @returns 布局名称
   */
  const getLayoutName = (layout: number): string => {
    const names: Record<number, string> = {
      [LayoutType.FREE]: '自由',
      [LayoutType.SINGLE]: '单屏',
      [LayoutType.DOUBLE]: '双屏',
      [LayoutType.TRIPLE]: '三屏',
      [LayoutType.QUAD]: '四屏',
      [LayoutType.SIX]: '六屏',
      [LayoutType.NINE]: '九屏',
      [LayoutType.SIXTEEN]: '十六屏',
      [LayoutType.TWENTY_FIVE]: '二十五屏',
      [LayoutType.THIRTY_SIX]: '三十六屏',
      [LayoutType.FORTY_NINE]: '四十九屏'
    }
    return names[layout] || '未知'
  }

  return {
    currentLayout,
    pipPosition,
    customGridCount,
    handleLayoutChange,
    setPipPosition,
    handleCustomCountChange
  }
}
