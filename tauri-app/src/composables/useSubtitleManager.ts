/**
 * 字幕管理 Composable
 * 
 * 职责：
 * - 管理字幕的编辑、导入、删除等操作
 * - 与 subtitleStore 交互（通过参数传入）
 * - 提供字幕相关的业务逻辑
 */

import { ref, type Ref } from 'vue'
import { ElMessage } from 'element-plus'

/**
 * 字幕项接口
 */
export interface SubtitleItem {
  startTime: string
  endTime: string
  text: string
  index?: number
}

/**
 * 字幕存储接口（简化版）
 */
export interface SubtitleStoreLike {
  subtitles: SubtitleItem[]
  updateSubtitle: (index: number, data: Partial<SubtitleItem>) => void
  removeSubtitle: (index: number) => void
  addSubtitle: (subtitle: Omit<SubtitleItem, 'index'>) => void
}

/**
 * 字幕管理选项
 */
export interface UseSubtitleManagerOptions {
  /** 字幕存储对象 */
  subtitleStore?: SubtitleStoreLike
  /** 是否显示字幕编辑对话框 */
  showSubtitleEditDialog?: Ref<boolean>
  /** 当前编辑的字幕 */
  editingSubtitle?: Ref<SubtitleItem | null>
}

/**
 * 字幕管理器返回值
 */
export interface UseSubtitleManagerReturn {
  /** 显示字幕编辑对话框 */
  showSubtitleEditDialog: Ref<boolean>
  /** 当前编辑的字幕 */
  editingSubtitle: Ref<SubtitleItem | null>
  /** 编辑字幕 */
  editSubtitle: (videoIndex: number, subtitleIndex: number) => void
  /** 保存编辑的字幕 */
  saveEditedSubtitle: () => void
  /** 删除字幕 */
  deleteSubtitle: (videoIndex: number, subtitleIndex: number) => void
  /** 处理导入字幕 */
  handleImportSubtitles: (subtitles: SubtitleItem[]) => void
}

/**
 * 使用字幕管理器
 */
export function useSubtitleManager(options: UseSubtitleManagerOptions = {}): UseSubtitleManagerReturn {
  const subtitleStore = options.subtitleStore
  
  // 使用外部传入的引用，或创建内部引用
  const showSubtitleEditDialog = options.showSubtitleEditDialog || ref(false)
  const editingSubtitle = options.editingSubtitle || ref<SubtitleItem | null>(null)

  /**
   * 编辑字幕
   * @param videoIndex 视频索引
   * @param subtitleIndex 字幕索引
   */
  const editSubtitle = (videoIndex: number, subtitleIndex: number) => {
    try {
      if (!subtitleStore) {
        console.warn('[字幕管理] subtitleStore 未提供')
        return
      }
      
      const subtitles = subtitleStore.subtitles
      
      if (subtitleIndex >= 0 && subtitleIndex < subtitles.length) {
        const subtitle = subtitles[subtitleIndex]
        editingSubtitle.value = {
          ...subtitle,
          index: subtitleIndex
        }
        showSubtitleEditDialog.value = true
        console.log('[字幕管理] 打开编辑对话框:', subtitle)
      } else {
        ElMessage.warning('字幕索引无效')
      }
    } catch (error) {
      console.error('[字幕管理] 编辑字幕失败:', error)
      ElMessage.error('编辑字幕失败')
    }
  }

  /**
   * 保存编辑的字幕
   */
  const saveEditedSubtitle = () => {
    try {
      if (!subtitleStore) {
        console.warn('[字幕管理] subtitleStore 未提供')
        return
      }
      
      if (editingSubtitle.value && editingSubtitle.value.index !== undefined) {
        const index = editingSubtitle.value.index
        
        // 更新字幕
        subtitleStore.updateSubtitle(index, {
          startTime: editingSubtitle.value.startTime,
          endTime: editingSubtitle.value.endTime,
          text: editingSubtitle.value.text
        })
        
        showSubtitleEditDialog.value = false
        editingSubtitle.value = null
        
        ElMessage.success('字幕保存成功')
        console.log('[字幕管理] 字幕保存成功')
      }
    } catch (error) {
      console.error('[字幕管理] 保存字幕失败:', error)
      ElMessage.error('保存字幕失败')
    }
  }

  /**
   * 删除字幕
   * @param videoIndex 视频索引
   * @param subtitleIndex 字幕索引
   */
  const deleteSubtitle = (videoIndex: number, subtitleIndex: number) => {
    try {
      if (!subtitleStore) {
        console.warn('[字幕管理] subtitleStore 未提供')
        return
      }
      
      subtitleStore.removeSubtitle(subtitleIndex)
      ElMessage.success('字幕删除成功')
      console.log('[字幕管理] 字幕删除成功')
    } catch (error) {
      console.error('[字幕管理] 删除字幕失败:', error)
      ElMessage.error('删除字幕失败')
    }
  }

  /**
   * 处理导入字幕
   * @param subtitles 导入的字幕列表
   */
  const handleImportSubtitles = (subtitles: SubtitleItem[]) => {
    try {
      if (!subtitleStore) {
        console.warn('[字幕管理] subtitleStore 未提供')
        return
      }
      
      if (!subtitles || subtitles.length === 0) {
        ElMessage.warning('没有可导入的字幕')
        return
      }
      
      // 批量添加字幕
      subtitles.forEach(subtitle => {
        subtitleStore.addSubtitle({
          startTime: subtitle.startTime,
          endTime: subtitle.endTime,
          text: subtitle.text
        })
      })
      
      ElMessage.success(`成功导入 ${subtitles.length} 条字幕`)
      console.log('[字幕管理] 导入字幕成功:', subtitles.length)
    } catch (error) {
      console.error('[字幕管理] 导入字幕失败:', error)
      ElMessage.error('导入字幕失败')
    }
  }

  return {
    showSubtitleEditDialog,
    editingSubtitle,
    editSubtitle,
    saveEditedSubtitle,
    deleteSubtitle,
    handleImportSubtitles
  }
}
