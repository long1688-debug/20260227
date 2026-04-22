<template>
  <div class="document-pager" :class="{ 'is-fullscreen': isFullscreen }">
    <!-- 文档内容区域 -->
    <div 
      class="pager-content"
      @dblclick="handleDoubleClick"
      @mousewheel="handleMouseWheel"
      @keydown="handleKeyDown"
      tabindex="0"
    >
      <!-- Word文档 -->
      <div v-if="documentType === 'word'" class="word-renderer">
        <iframe 
          v-if="documentUrl" 
          ref="iframeRef"
          :src="documentUrl" 
          class="document-iframe"
          @load="onIframeLoad"
        ></iframe>
        <div v-else class="document-placeholder">
          <el-icon :size="48"><Document /></el-icon>
          <span>{{ source?.name || 'Word文档' }}</span>
        </div>
      </div>

      <!-- PPT文档 -->
      <div v-else-if="documentType === 'ppt'" class="ppt-renderer">
        <div class="ppt-slide" v-html="currentSlideContent"></div>
      </div>

      <!-- Excel文档 -->
      <div v-else-if="documentType === 'excel'" class="excel-renderer">
        <div class="excel-content" v-html="excelContent"></div>
      </div>

      <!-- PDF文档 -->
      <div v-else-if="documentType === 'pdf'" class="pdf-renderer">
        <iframe 
          v-if="documentUrl" 
          ref="iframeRef"
          :src="documentUrl" 
          class="document-iframe"
          @load="onIframeLoad"
        ></iframe>
        <div v-else class="document-placeholder">
          <el-icon :size="48"><Document /></el-icon>
          <span>{{ source?.name || 'PDF文档' }}</span>
        </div>
      </div>

      <!-- TXT文档 -->
      <div v-else-if="documentType === 'txt'" class="txt-renderer">
        <pre class="txt-content" :style="txtStyle">{{ txtContent }}</pre>
      </div>

      <!-- 图片 -->
      <div v-else-if="documentType === 'image'" class="image-renderer">
        <img 
          :src="imageUrl" 
          :alt="source?.name" 
          class="document-image"
          @load="onImageLoad"
        />
      </div>

      <!-- 未知类型 -->
      <div v-else class="unknown-renderer">
        <el-icon :size="48"><Document /></el-icon>
        <span>不支持的文档类型</span>
      </div>

      <!-- 加载状态 -->
      <div v-if="isLoading" class="loading-overlay">
        <el-icon class="is-loading" :size="48"><Loading /></el-icon>
        <span>加载中...</span>
      </div>
    </div>

    <!-- 全屏翻页控件 -->
    <div 
      v-if="isFullscreen && totalPages > 1" 
      class="pager-controls"
      :class="{ 'controls-visible': showControls }"
      @mouseenter="showControls = true"
      @mouseleave="hideControlsDelayed"
    >
      <!-- 上一页按钮 -->
      <button 
        class="pager-btn prev-btn" 
        :disabled="currentPage <= 1"
        @click="previousPage"
        @mouseenter="keepControlsVisible"
      >
        <el-icon><ArrowLeft /></el-icon>
        <span>上一页</span>
      </button>

      <!-- 页码信息 -->
      <div class="page-info">
        <span class="current-page">{{ currentPage }}</span>
        <span class="page-separator">/</span>
        <span class="total-pages">{{ totalPages }}</span>
      </div>

      <!-- 下一页按钮 -->
      <button 
        class="pager-btn next-btn" 
        :disabled="currentPage >= totalPages"
        @click="nextPage"
        @mouseenter="keepControlsVisible"
      >
        <span>下一页</span>
        <el-icon><ArrowRight /></el-icon>
      </button>

      <!-- 页码跳转 -->
      <div class="page-jump">
        <span>跳转到</span>
        <el-input-number 
          v-model="jumpPage" 
          :min="1" 
          :max="totalPages"
          size="small"
          controls-position="right"
          @change="handleJumpToPage"
        />
        <span>页</span>
      </div>
    </div>

    <!-- 全屏退出按钮 -->
    <button 
      v-if="isFullscreen" 
      class="exit-fullscreen-btn"
      @click="exitFullscreen"
    >
      <el-icon><Close /></el-icon>
    </button>

    <!-- 键盘快捷键提示 -->
    <div v-if="isFullscreen && showShortcutHint" class="shortcut-hint">
      <span>← → 键翻页 | ESC 退出</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { 
  Document, Loading, ArrowLeft, ArrowRight, 
  Close 
} from '@element-plus/icons-vue'

const props = defineProps({
  source: {
    type: Object,
    default: null
  },
  initialFullscreen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'page-change', 
  'enter-fullscreen', 
  'exit-fullscreen',
  'document-ready'
])

// 状态
const isLoading = ref(true)
const isFullscreen = ref(props.initialFullscreen)
const currentPage = ref(1)
const totalPages = ref(1)
const showControls = ref(true)
const showShortcutHint = ref(true)
const jumpPage = ref(1)
const iframeRef = ref(null)

// 文档内容
const documentUrl = ref('')
const txtContent = ref('')
const imageUrl = ref('')
const excelContent = ref('')

// 控制隐藏定时器
let hideControlsTimer = null
let shortcutHintTimer = null

// 计算文档类型
const documentType = computed(() => {
  if (!props.source) return ''
  const type = props.source.type
  if (['doc', 'docx', 'word'].includes(type)) return 'word'
  if (['ppt', 'pptx'].includes(type)) return 'ppt'
  if (['xls', 'xlsx', 'excel'].includes(type)) return 'excel'
  if (['pdf'].includes(type)) return 'pdf'
  if (['txt', 'text'].includes(type)) return 'txt'
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'image'].includes(type)) return 'image'
  return type
})

// PPT当前幻灯片内容
const currentSlideContent = computed(() => {
  // 如果有解析后的幻灯片数据
  if (props.source?.slides && props.source.slides.length > 0) {
    const slide = props.source.slides[currentPage.value - 1]
    return slide?.html || slide?.content || ''
  }
  return '<div class="slide-placeholder">PPT内容</div>'
})

// TXT样式
const txtStyle = computed(() => ({
  fontSize: '14px',
  lineHeight: '1.6',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word'
}))

// 初始化文档
const initDocument = async () => {
  isLoading.value = true
  
  try {
    if (documentType.value === 'word' || documentType.value === 'pdf') {
      // 对于Word和PDF，使用iframe加载
      if (props.source?.url) {
        documentUrl.value = props.source.url
      } else if (props.source?.file) {
        // 创建本地URL
        documentUrl.value = URL.createObjectURL(props.source.file)
      }
    } else if (documentType.value === 'txt') {
      // TXT文件内容
      if (props.source?.content) {
        txtContent.value = props.source.content
      } else if (props.source?.file) {
        const text = await props.source.file.text()
        txtContent.value = text
      }
      totalPages.value = calculateTxtPages(txtContent.value)
    } else if (documentType.value === 'image') {
      // 图片
      if (props.source?.url) {
        imageUrl.value = props.source.url
      } else if (props.source?.file) {
        imageUrl.value = URL.createObjectURL(props.source.file)
      }
      totalPages.value = 1
    } else if (documentType.value === 'ppt' || documentType.value === 'excel') {
      // PPT和Excel使用专用渲染器
      totalPages.value = props.source?.totalPages || 1
    }

    isLoading.value = false
    emit('document-ready')
  } catch (error) {
    console.error('[DocumentPager] 初始化文档失败:', error)
    isLoading.value = false
  }
}

// 计算TXT页数（每页约2000字符）
const calculateTxtPages = (content) => {
  if (!content) return 1
  const charsPerPage = 2000
  return Math.ceil(content.length / charsPerPage) || 1
}

// 上一页
const previousPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    jumpPage.value = currentPage.value
    handlePageChange()
  }
}

// 下一页
const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    jumpPage.value = currentPage.value
    handlePageChange()
  }
}

// 跳转到指定页
const handleJumpToPage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
    handlePageChange()
  }
}

// 页面变化处理
const handlePageChange = () => {
  emit('page-change', {
    currentPage: currentPage.value,
    totalPages: totalPages.value,
    documentType: documentType.value
  })
  
  // 滚动到指定位置（对于TXT和长文档）
  scrollToCurrentPage()
}

// 滚动到当前页
const scrollToCurrentPage = () => {
  if (documentType.value === 'txt') {
    const content = document.querySelector('.txt-content')
    if (content) {
      const charsPerPage = 2000
      const scrollPosition = (currentPage.value - 1) * charsPerPage * 14 * 1.6 // 估算行高
      content.scrollTop = scrollPosition
    }
  }
}

// 鼠标滚轮翻页
const handleMouseWheel = (e) => {
  if (!isFullscreen.value) return
  
  if (e.deltaY > 0) {
    nextPage()
  } else if (e.deltaY < 0) {
    previousPage()
  }
}

// 键盘事件
const handleKeyDown = (e) => {
  if (!isFullscreen.value) return
  
  switch (e.key) {
    case 'ArrowLeft':
    case 'PageUp':
      e.preventDefault()
      previousPage()
      break
    case 'ArrowRight':
    case 'PageDown':
      e.preventDefault()
      nextPage()
      break
    case 'Home':
      e.preventDefault()
      handleJumpToPage(1)
      break
    case 'End':
      e.preventDefault()
      handleJumpToPage(totalPages.value)
      break
    case 'Escape':
      e.preventDefault()
      exitFullscreen()
      break
  }
}

// 双击进入全屏
const handleDoubleClick = () => {
  if (!isFullscreen.value) {
    enterFullscreen()
  }
}

// 进入全屏
const enterFullscreen = async () => {
  try {
    const element = document.querySelector('.document-pager')
    if (element) {
      if (element.requestFullscreen) {
        await element.requestFullscreen()
      } else if (element.webkitRequestFullscreen) {
        await element.webkitRequestFullscreen()
      } else if (element.msRequestFullscreen) {
        await element.msRequestFullscreen()
      }
    }
    
    isFullscreen.value = true
    showShortcutHint.value = true
    
    // 3秒后隐藏快捷键提示
    clearTimeout(shortcutHintTimer)
    shortcutHintTimer = setTimeout(() => {
      showShortcutHint.value = false
    }, 3000)
    
    emit('enter-fullscreen')
  } catch (error) {
    console.error('[DocumentPager] 进入全屏失败:', error)
  }
}

// 退出全屏
const exitFullscreen = () => {
  try {
    if (document.fullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen()
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen()
      }
    }
    
    isFullscreen.value = false
    emit('exit-fullscreen')
  } catch (error) {
    console.error('[DocumentPager] 退出全屏失败:', error)
  }
}

// 保持控件可见
const keepControlsVisible = () => {
  showControls.value = true
  clearTimeout(hideControlsTimer)
}

// 延迟隐藏控件
const hideControlsDelayed = () => {
  hideControlsTimer = setTimeout(() => {
    showControls.value = false
  }, 3000)
}

// iframe加载完成
const onIframeLoad = () => {
  isLoading.value = false
}

// 图片加载完成
const onImageLoad = () => {
  isLoading.value = false
}

// 监听全屏状态变化
const handleFullscreenChange = () => {
  if (!document.fullscreenElement) {
    isFullscreen.value = false
    emit('exit-fullscreen')
  }
}

// 监听源变化
watch(() => props.source, (newSource) => {
  if (newSource) {
    currentPage.value = 1
    totalPages.value = 1
    initDocument()
  }
}, { immediate: true })

// 生命周期
onMounted(() => {
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
  
  if (props.initialFullscreen) {
    nextTick(() => {
      enterFullscreen()
    })
  }
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
  
  clearTimeout(hideControlsTimer)
  clearTimeout(shortcutHintTimer)
  
  // 清理blob URL
  if (documentUrl.value && documentUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(documentUrl.value)
  }
  if (imageUrl.value && imageUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(imageUrl.value)
  }
})

// 暴露方法
defineExpose({
  nextPage,
  previousPage,
  goToPage: handleJumpToPage,
  enterFullscreen,
  exitFullscreen,
  getCurrentPage: () => currentPage.value,
  getTotalPages: () => totalPages.value,
  isFullscreen: () => isFullscreen.value
})
</script>

<style scoped lang="scss">
.document-pager {
  width: 100%;
  height: 100%;
  position: relative;
  background: var(--bg-primary, #1a1a1a);
  overflow: hidden;
  display: flex;
  flex-direction: column;

  &.is-fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 9999;
  }
}

.pager-content {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;

  &:focus {
    outline: none;
  }
}

// 文档渲染器通用样式
.document-iframe,
.ppt-slide,
.excel-content,
.txt-content,
.document-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.document-iframe {
  border: none;
}

.ppt-slide {
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.excel-content {
  overflow: auto;
  background: white;
  padding: 16px;
}

.txt-content {
  color: var(--text-primary, #e0e0e0);
  font-family: 'Consolas', 'Monaco', monospace;
  padding: 20px;
  background: transparent;
}

.document-image {
  max-width: 100%;
  max-height: 100%;
}

// 占位符
.document-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary, #888);
  gap: 12px;

  .el-icon {
    opacity: 0.5;
  }

  span {
    font-size: 14px;
  }
}

// 加载遮罩
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  gap: 12px;
  z-index: 10;
}

// 全屏翻页控件
.pager-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px 24px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.3s ease;
  z-index: 100;

  &.controls-visible {
    opacity: 1;
    transform: translateY(0);
  }
}

.pager-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.4);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .el-icon {
    font-size: 18px;
  }
}

.page-info {
  display: flex;
  align-items: baseline;
  gap: 4px;
  color: white;
  font-size: 16px;

  .current-page {
    font-size: 24px;
    font-weight: bold;
  }

  .page-separator {
    color: rgba(255, 255, 255, 0.5);
  }

  .total-pages {
    font-size: 18px;
  }
}

.page-jump {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;

  .el-input-number {
    width: 80px;
  }
}

// 退出全屏按钮
.exit-fullscreen-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  background: rgba(0, 0, 0, 0.6);
  border: none;
  border-radius: 50%;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: 101;

  &:hover {
    background: rgba(0, 0, 0, 0.8);
    transform: scale(1.1);
  }

  .el-icon {
    font-size: 20px;
  }
}

// 键盘快捷键提示
.shortcut-hint {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.6);
  padding: 8px 16px;
  border-radius: 20px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  z-index: 100;
  animation: fadeInOut 3s ease forwards;
}

@keyframes fadeInOut {
  0% { opacity: 0; }
  10% { opacity: 1; }
  80% { opacity: 1; }
  100% { opacity: 0; }
}

// 幻灯片占位符
.slide-placeholder {
  color: var(--text-secondary, #888);
  font-size: 18px;
}
</style>
