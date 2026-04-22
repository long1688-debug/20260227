<template>
  <div class="documents-panel">
    <div class="panel-header">
      <h3 class="panel-title">文档课件</h3>
      <div class="header-actions">
        <el-button type="primary" size="small" @click="openBrowser">
          <el-icon><Reading /></el-icon> 浏览器
        </el-button>
        <el-button type="primary" size="small" @click="openWhiteboard">
          <el-icon><Picture /></el-icon> 白板
        </el-button>
        <el-button type="primary" size="small" @click="handleAddDocument">
          <el-icon><Plus /></el-icon> 添加文档
        </el-button>
      </div>
    </div>

    <div class="panel-content">
      <!-- 快速添加区域 -->
      <div v-if="documentSources.length === 0" class="quick-add-section">
        <p class="hint-text">点击上方按钮快速添加文档到信号源</p>

        <div class="info-section">
          <div class="info-title">支持的文件格式</div>

          <!-- Microsoft Office 格式 -->
          <div class="format-category">
            <div class="category-title">📝 Microsoft Office</div>
            <div class="format-list">
              <span class="format-item recommended">DOCX ⭐</span>
              <span class="format-item">DOC</span>
              <span class="format-item recommended">XLSX ⭐</span>
              <span class="format-item">XLS</span>
              <span class="format-item recommended">PPTX ⭐</span>
              <span class="format-item">PPT</span>
            </div>
          </div>

          <!-- WPS Office 格式 -->
          <div class="format-category">
            <div class="category-title">📄 WPS Office</div>
            <div class="format-list">
              <span class="format-item recommended">WPS ⭐</span>
              <span class="format-item">WPT</span>
              <span class="format-item recommended">ET ⭐</span>
              <span class="format-item">ETT</span>
              <span class="format-item recommended">DPS ⭐</span>
              <span class="format-item">DPT</span>
            </div>
          </div>

          <!-- 通用格式 -->
          <div class="format-category">
            <div class="category-title">📋 通用格式</div>
            <div class="format-list">
              <span class="format-item recommended">PDF ⭐</span>
              <span class="format-item">TXT</span>
              <span class="format-item">RTF</span>
              <span class="format-item">ODT</span>
            </div>
          </div>

          <p class="format-hint">⭐ 推荐格式可获得最佳预览效果 | WPS 格式会自动转换为 Office 兼容格式</p>
        </div>

        <div class="tip-section">
          <el-icon class="tip-icon"><InfoFilled /></el-icon>
          <p class="tip-text">添加的文档将出现在"信号源"标签中,可拖拽到预览区域使用</p>
        </div>
      </div>

      <!-- 文档列表 -->
      <div v-else class="document-list">
        <div
          v-for="source in documentSources"
          :key="source.id"
          class="document-item"
        >
          <div class="document-icon">
            <el-icon :size="32">
              <component :is="getDocumentIcon(source.type)" />
            </el-icon>
          </div>

          <div class="document-info">
            <div class="document-name">{{ source.name }}</div>
            <div class="document-meta">
              <el-tag size="small" :type="getDocumentTypeTag(source.type)">
                {{ getDocumentTypeLabel(source.type) }}
              </el-tag>
              <span v-if="source.file" class="file-size">
                {{ formatFileSize(source.file.size) }}
              </span>
            </div>
          </div>

          <div class="document-actions">
            <el-tooltip content="添加到预览" placement="top">
              <el-button
                size="small"
                type="primary"
                :icon="VideoPlay"
                @click="handleAddToPreview(source)"
              />
            </el-tooltip>
            <el-tooltip content="移除文档" placement="top">
              <el-button
                size="small"
                type="danger"
                :icon="Delete"
                @click="handleRemove(source)"
              />
            </el-tooltip>
          </div>
        </div>
      </div>
    </div>

    <!-- 浏览器模态框 -->
    <el-dialog v-model="showBrowser" title="内置浏览器" width="90%" height="80%">
      <WebpageViewer v-if="currentUrl" :url="currentUrl" :source-id="'browser'" :show-toolbar="true"
        :show-info="true" />
      <div v-else class="browser-input-container">
        <el-input v-model="browserUrl" placeholder="请输入网页地址（如：https://www.baidu.com）" @keyup.enter="openUrl" />
        <el-button type="primary" @click="openUrl">访问</el-button>
      </div>
    </el-dialog>

    <!-- 白板模态框 -->
    <el-dialog v-model="showWhiteboard" title="在线白板" width="90%" height="85%">
      <div class="whiteboard-toolbar">
        <el-button-group>
          <el-button v-for="color in colors" :key="color" class="color-btn" :style="{ backgroundColor: color }"
            @click="currentColor = color"></el-button>
        </el-button-group>
        <el-select v-model="brushSize" size="small" style="width: 80px; margin-left: 10px;">
          <el-option label="细" :value="2" />
          <el-option label="中" :value="5" />
          <el-option label="粗" :value="10" />
        </el-select>
        <el-button size="small" @click="clearWhiteboard">清空</el-button>
        <el-button size="small" @click="undoWhiteboard">撤销</el-button>
      </div>
      <div class="whiteboard-container">
        <canvas ref="whiteboardCanvas" class="whiteboard-canvas" @mousedown="startDraw" @mousemove="drawing"
          @mouseup="stopDraw" @mouseleave="stopDraw"></canvas>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Document,
  Files,
  Reading,
  Picture,
  Plus,
  Delete,
  InfoFilled,
  VideoPlay
} from '@element-plus/icons-vue'
import { useSourceStore } from '@/stores/sourceStore'
import { useVideoSync } from '@/composables/useVideoSync'
import { createBlobUrl } from '@/utils/videoSource'
// 🎯 导入新的文档类型检测工具
import { validateFile, getTypeDisplayName, getTypeIcon } from '@/utils/documentTypeDetector'
import WebpageViewer from '../../previews/WebpageViewer.vue'

const props = defineProps({
  // ... existing props ...
})

const sourceStore = useSourceStore()
const { addVideoSource } = useVideoSync()

// 浏览器功能
const showBrowser = ref(false)
const browserUrl = ref('')
const currentUrl = ref('')

// 白板功能
const showWhiteboard = ref(false)
const whiteboardCanvas = ref(null)
const currentColor = ref('#000000')
const brushSize = ref(5)
const isDrawing = ref(false)
const lastX = ref(0)
const lastY = ref(0)
const drawingHistory = ref([])
const colors = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF']

// 打开浏览器
const openBrowser = () => {
  showBrowser.value = true
}

// 打开白板
const openWhiteboard = () => {
  showWhiteboard.value = true
  nextTick(() => {
    initWhiteboard()
  })
}

// 浏览器访问URL
const openUrl = () => {
  if (browserUrl.value) {
    currentUrl.value = browserUrl.value.startsWith('http') ? browserUrl.value : 'https://' + browserUrl.value
  }
}

// 初始化白板
const initWhiteboard = () => {
  nextTick(() => {
    if (whiteboardCanvas.value) {
      const canvas = whiteboardCanvas.value
      canvas.width = canvas.parentElement.clientWidth
      canvas.height = 500
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = currentColor.value
      ctx.lineWidth = brushSize.value
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    }
  })
}

// 白板绘制开始
const startDraw = (e) => {
  isDrawing.value = true
  const canvas = whiteboardCanvas.value
  const rect = canvas.getBoundingClientRect()
  lastX.value = e.clientX - rect.left
  lastY.value = e.clientY - rect.top
}

// 白板绘制
const drawing = (e) => {
  if (!isDrawing.value) return
  const canvas = whiteboardCanvas.value
  const ctx = canvas.getContext('2d')
  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  ctx.strokeStyle = currentColor.value
  ctx.lineWidth = brushSize.value
  ctx.beginPath()
  ctx.moveTo(lastX.value, lastY.value)
  ctx.lineTo(x, y)
  ctx.stroke()

  lastX.value = x
  lastY.value = y
}

// 白板绘制结束
const stopDraw = () => {
  if (isDrawing.value) {
    drawingHistory.value.push(whiteboardCanvas.value.toDataURL())
  }
  isDrawing.value = false
}

// 清空白板
const clearWhiteboard = () => {
  const canvas = whiteboardCanvas.value
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  drawingHistory.value = []
}

// 撤销白板
const undoWhiteboard = () => {
  if (drawingHistory.value.length > 0) {
    const lastState = drawingHistory.value.pop()
    const img = new Image()
    img.onload = () => {
      const ctx = whiteboardCanvas.value.getContext('2d')
      ctx.drawImage(img, 0, 0)
    }
    img.src = lastState
  }
}

// 过滤文档课件类型的信号源
const documentSources = computed(() => {
  return sourceStore.sources.filter(s =>
    s.type === 'document' || s.type === 'webpage' || s.type === 'ppt' ||
    s.type === 'word' || s.type === 'mindmap' || s.type === 'pdf'
  )
})

/**
 * 获取文档图标
 */
const getDocumentIcon = (type) => {
  const iconMap = {
    // PDF
    'pdf': Reading,

    // Microsoft Word / WPS Writer
    'word': Document,
    'doc': Document,
    'docx': Document,
    'wps': Document,  // WPS 文字
    'wpt': Document,  // WPS 文字模板
    'odt': Document,  // OpenDocument

    // Microsoft Excel / WPS Spreadsheets
    'excel': Files,
    'xls': Files,
    'xlsx': Files,
    'et': Files,      // WPS 表格
    'ett': Files,     // WPS 表格模板

    // Microsoft PowerPoint / WPS Presentation
    'ppt': Files,
    'pptx': Files,
    'dps': Files,     // WPS 演示
    'dpt': Files,     // WPS 演示模板

    // 其他
    'txt': Document,
    'rtf': Document,
    'document': Document,
    'webpage': Reading,
    'mindmap': Files
  }
  return iconMap[type] || Document
}

/**
 * 获取文档类型标签
 */
const getDocumentTypeTag = (type) => {
  const tagMap = {
    // PDF
    'pdf': 'danger',

    // Word 系列
    'word': 'success',
    'doc': 'success',
    'docx': 'success',
    'wps': 'success',
    'wpt': 'success',
    'odt': 'success',

    // Excel 系列
    'excel': 'success',
    'xls': 'success',
    'xlsx': 'success',
    'et': 'success',
    'ett': 'success',

    // PowerPoint 系列
    'ppt': 'warning',
    'pptx': 'warning',
    'dps': 'warning',
    'dpt': 'warning',

    // 其他
    'txt': 'info',
    'rtf': 'info',
    'document': '',
    'webpage': '',
    'mindmap': ''
  }
  return tagMap[type] || ''
}

/**
 * 获取文档类型标签文本
 */
const getDocumentTypeLabel = (type) => {
  const labelMap = {
    // PDF
    'pdf': 'PDF',

    // Word 系列
    'word': 'Word',
    'doc': 'Word',
    'docx': 'Word',
    'wps': 'WPS文字',
    'wpt': 'WPS模板',
    'odt': 'OpenDoc',

    // Excel 系列
    'excel': 'Excel',
    'xls': 'Excel',
    'xlsx': 'Excel',
    'et': 'WPS表格',
    'ett': 'WPS表格模板',

    // PowerPoint 系列
    'ppt': 'PPT',
    'pptx': 'PPT',
    'dps': 'WPS演示',
    'dpt': 'WPS演示模板',

    // 其他
    'txt': '文本',
    'rtf': 'RTF',
    'document': '文档',
    'webpage': '网页',
    'mindmap': '思维导图'
  }
  return labelMap[type] || '文档'
}

/**
 * 格式化文件大小
 */
const formatFileSize = (bytes) => {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

/**
 * 添加文档
 */
const handleAddDocument = async () => {
  try {
    // 创建文件输入元素 - 支持 Office 和 WPS 所有格式
    const input = document.createElement('input')
    input.type = 'file'
    // 🎯 扩展支持：Microsoft Office + WPS Office + 通用格式
    input.accept = [
      // Microsoft Word
      '.doc', '.docx', '.dot', '.dotx',
      // Microsoft Excel
      '.xls', '.xlsx', '.xlt', '.xltx',
      // Microsoft PowerPoint
      '.ppt', '.pptx', '.pot', '.potx',
      // WPS Writer (文字)
      '.wps', '.wpt',
      // WPS Spreadsheets (表格)
      '.et', '.ett',
      // WPS Presentation (演示)
      '.dps', '.dpt',
      // 其他格式
      '.pdf', '.txt', '.rtf', '.odt', '.ods', '.odp'
    ].join(',')

    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return

      console.log('[DocumentsPanel] 选择文件:', file.name, '大小:', file.size, '类型:', file.type)

      try {
        // 🎯 使用新的验证工具进行完整验证
        const validation = validateFile(file)

        // 检查是否有效
        if (!validation.valid) {
          ElMessage.error(validation.error)
          console.warn('[DocumentsPanel] 文件验证失败:', validation.error)
          return
        }

        // 显示警告信息(如果有)
        if (validation.warning) {
          ElMessage.warning(validation.warning)
          console.log('[DocumentsPanel] 兼容性提示:', validation.warning)
        }

        // 🎯 使用 VideoSourceManager 创建共享 Blob URL
        const { blobUrl: sharedBlobUrl } = createBlobUrl(file)
        console.log('[DocumentsPanel] 创建共享 blob URL:', sharedBlobUrl)

        // 🎯 获取文件路径(从 File 对象)
        const filePath = file.path || file.webkitRelativePath || ''

        // 🎯 创建文档信号源对象
        const documentSource = {
          id: `doc_${Date.now()}`,
          name: file.name,
          type: validation.type,              // ✅ 使用验证后的类型
          url: sharedBlobUrl,                 // 使用共享 Blob URL
          sharedBlobUrl,                      // 显式存储共享 URL
          blobUrl: sharedBlobUrl,             // 兼容旧字段
          filePath: filePath,                 // 保存原始文件路径,用于后端转换
          file: file,                         // 保存原始 File 对象
          originalExt: file.name.split('.').pop().toLowerCase(), // 保存原始扩展名
          status: 'ready',
          compatibility: validation.compatibility.level  // 🎯 记录兼容性级别
        }

        console.log('[DocumentsPanel] 创建文档源:', {
          name: documentSource.name,
          type: documentSource.type,
          compatibility: documentSource.compatibility
        })

        sourceStore.addSource(documentSource)
        console.log('[DocumentsPanel] 已添加到 sourceStore')

        // 标记为已添加到预览
        sourceStore.updateSource(documentSource.id, { addedToPreview: true })
        console.log('[DocumentsPanel] 已标记 addedToPreview = true')

        // 🎯 修复：只有视频类型的文档才添加到视频同步系统
        // PPT、PDF、Word、Excel 等非视频文档不需要视频同步
        const videoTypes = ['video', 'localVideo', 'networkStream'];
        if (videoTypes.includes(validation.type)) {
          addVideoSource(documentSource)
          console.log('[DocumentsPanel] 已调用 addVideoSource')
        } else {
          console.log('[DocumentsPanel] 非视频类型，跳过视频同步注册')
        }

        ElMessage.success(`✅ 已添加${getTypeDisplayName(validation.type)}: ${file.name}`)

      } catch (error) {
        console.error('[DocumentsPanel] 添加文档失败:', error)
        ElMessage.error('添加文档失败: ' + error.message)
      }
    }

    input.click()
  } catch (error) {
    console.error('打开文件选择器失败:', error)
    ElMessage.error('打开文件选择器失败: ' + error.message)
  }
}

/**
 * 添加到预览
 * 🎯 修复：确保添加到预览后，信号源同时出现在信号源列表和预览窗口
 */
const handleAddToPreview = (source) => {
  // 确保已标记为添加到预览
  sourceStore.updateSource(source.id, { addedToPreview: true })

  // 🎯 修复：将信号源添加到视频预览列表，使其在预览窗口显示
  // 检查是否已存在
  const existsInPreviews = sourceStore.sources.find(s => s.id === source.id && s.addedToPreview)
  if (!existsInPreviews) {
    addVideoSource(source)
    console.log('[DocumentsPanel] 已添加到预览窗口')
  }

  ElMessage.success(`已将 "${source.name}" 添加到预览`)
}

/**
 * 移除文档
 */
const handleRemove = async (source) => {
  try {
    await ElMessageBox.confirm(
      `确定要移除文档 "${source.name}" 吗？`,
      '确认移除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    sourceStore.removeSource(source.id)
    removeVideoSource(source.id)
    ElMessage.success(`已移除: ${source.name}`)
  } catch {
    // 用户取消
  }
}
</script>

<style lang="scss" scoped>
.documents-panel {
  display: flex;
  flex-direction: column;
  color: #E0E1DD;
  background: #0D1B2A;
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow-y: auto;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #1A2A3A;

  .panel-title {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
    color: #E0E1DD;
  }
}

.panel-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.quick-add-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 20px 0;

  .hint-text {
    font-size: 14px;
    color: #778DA9;
    margin: 0;
  }

  .add-button {
    width: 200px;
    height: 60px;
    font-size: 16px;
  }
}

.info-section {
  width: 100%;
  max-width: 500px;

  .info-title {
    font-size: 14px;
    font-weight: 500;
    color: #E0E1DD;
    margin-bottom: 12px;
    text-align: center;
  }

  .format-category {
    margin-bottom: 16px;

    &:last-child {
      margin-bottom: 0;
    }

    .category-title {
      font-size: 13px;
      font-weight: 600;
      color: #E0E1DD;
      margin-bottom: 8px;
      padding-left: 4px;
      border-left: 3px solid #4CC9F0;
    }
  }

  .format-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;

    .format-item {
      padding: 6px 12px;
      background: rgba(76, 201, 240, 0.1);
      border: 1px solid rgba(76, 201, 240, 0.3);
      border-radius: 4px;
      font-size: 13px;
      color: #4CC9F0;
      transition: all 0.2s ease;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 2px 8px rgba(76, 201, 240, 0.2);
      }

      &.recommended {
        background: rgba(118, 238, 148, 0.15);
        border-color: rgba(118, 238, 148, 0.4);
        color: #76EE94;
        font-weight: 500;

        &:hover {
          box-shadow: 0 2px 8px rgba(118, 238, 148, 0.3);
        }
      }
    }
  }

  .format-hint {
    margin-top: 16px;
    font-size: 12px;
    color: #778DA9;
    text-align: center;
    line-height: 1.6;
  }
}

.tip-section {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(144, 147, 153, 0.1);
  border-left: 3px solid #909399;
  border-radius: 4px;
  max-width: 400px;

  .tip-icon {
    color: #909399;
    font-size: 16px;
    flex-shrink: 0;
  }

  .tip-text {
    font-size: 13px;
    color: #778DA9;
    margin: 0;
    line-height: 1.5;
  }
}

.document-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.document-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #0F2035;
  border: 1px solid #2A3F5F;
  border-radius: 4px;
  transition: all 0.2s ease;

  &:hover {
    border-color: #4CC9F0;
    box-shadow: 0 2px 8px rgba(76, 201, 240, 0.2);
  }

  .document-icon {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(76, 201, 240, 0.1);
    border-radius: 4px;
    color: #4CC9F0;
  }

  .document-info {
    flex: 1;
    min-width: 0;

    .document-name {
      font-size: 14px;
      font-weight: 500;
      color: #E0E1DD;
      margin-bottom: 6px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .document-meta {
      display: flex;
      align-items: center;
      gap: 8px;

      .file-size {
        font-size: 12px;
        color: #778DA9;
      }
    }
  }
}

/* 浏览器模态框样式 */
.browser-input-container {
  display: flex;
  gap: 10px;
  padding: 20px;
}

/* 白板样式 */
.whiteboard-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #0A1525;
}

.whiteboard-toolbar {
  padding: 10px;
  background: #0F2035;
  border-bottom: 1px solid #2A3F5F;
  display: flex;
  align-items: center;
}

.color-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid #4A90E2;
  margin: 0 2px;
}

.whiteboard-canvas {
  flex: 1;
  cursor: crosshair;
  background: white;
}

.header-actions {
  display: flex;
  gap: 8px;
}
</style>
