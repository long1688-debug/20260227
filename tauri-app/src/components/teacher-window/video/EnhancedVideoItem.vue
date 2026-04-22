<template>
  <div 
    class="enhanced-video-item" 
    :class="{ 
      'is-maximized': isMaximized,
      'is-fullscreen': isFullscreen,
      'is-document': isDocumentType,
      'is-dragging': isDragging 
    }"
    :data-index="index"
    @dblclick="handleDoubleClick"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <!-- 视频内容 -->
    <video
      v-if="isVideoType"
      ref="videoRef"
      class="video-content"
      :src="videoSrc"
      :autoplay="true"
      :muted="isMuted"
      :loop="false"
      playsinline
      @loadedmetadata="onLoadedMetadata"
      @timeupdate="onTimeUpdate"
      @play="onPlay"
      @pause="onPause"
      @ended="onEnded"
      @error="onError"
    />

    <!-- 文档内容 -->
    <div v-else-if="isDocumentType" class="document-content">
      <DocumentPager
        ref="documentPagerRef"
        :source="source"
        :initial-fullscreen="false"
        @page-change="onPageChange"
        @enter-fullscreen="handleEnterFullscreen"
        @exit-fullscreen="handleExitFullscreen"
      />
    </div>

    <!-- 实时流内容（摄像头） -->
    <div v-else-if="isCameraType" class="stream-content">
      <video
        ref="streamRef"
        class="stream-video"
        autoplay
        playsinline
        muted
      />
      <div v-if="!hasStream" class="stream-placeholder">
        <el-icon :size="48"><VideoCamera /></el-icon>
        <span>等待视频源...</span>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-overlay">
      <el-icon class="is-loading" :size="40"><Loading /></el-icon>
    </div>

    <!-- 错误状态 -->
    <div v-if="error" class="error-overlay">
      <el-icon :size="40"><WarningFilled /></el-icon>
      <span>{{ error }}</span>
    </div>

    <!-- 视频控制栏（仅视频类型显示） -->
    <div v-if="isVideoType && !isFullscreen" class="video-controls-bar">
      <!-- 播放/暂停 -->
      <button class="control-btn" @click.stop="togglePlay">
        <el-icon v-if="isPlaying"><VideoPause /></el-icon>
        <el-icon v-else><VideoPlay /></el-icon>
      </button>

      <!-- 进度条 -->
      <div class="progress-container" @click.stop="seekTo">
        <div class="progress-bar">
          <div class="progress-played" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <span class="time-display">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
      </div>

      <!-- 音量控制 -->
      <div class="volume-control" @click.stop>
        <button class="control-btn" @click="toggleMute">
          <el-icon v-if="isMuted || volume === 0"><VideoPause /></el-icon>
          <el-icon v-else><VideoPlay /></el-icon>
        </button>
        <el-slider 
          v-model="volume" 
          :min="0" 
          :max="100"
          :show-tooltip="false"
          class="volume-slider"
          @change="handleVolumeChange"
        />
        <span class="volume-value">{{ volume }}%</span>
      </div>

      <!-- 全屏按钮 -->
      <button class="control-btn" @click.stop="handleFullscreen">
        <el-icon><FullScreen /></el-icon>
      </button>
    </div>

    <!-- 全屏模式下的文档翻页控件（仅文档类型显示） -->
    <div v-if="isDocumentType && isFullscreen && totalDocPages > 1" class="document-pager-overlay">
      <div class="pager-controls-mini">
        <button class="pager-btn" :disabled="currentDocPage <= 1" @click="previousDocPage">
          <el-icon><ArrowLeft /></el-icon>
        </button>
        <span class="page-indicator">{{ currentDocPage }} / {{ totalDocPages }}</span>
        <button class="pager-btn" :disabled="currentDocPage >= totalDocPages" @click="nextDocPage">
          <el-icon><ArrowRight /></el-icon>
        </button>
      </div>
    </div>

    <!-- 悬浮信息 -->
    <div class="item-overlay">
      <div class="source-name">{{ sourceName }}</div>
      <div class="source-type-badge">
        <el-tag :type="sourceTypeTag" size="small">{{ sourceTypeLabel }}</el-tag>
      </div>
    </div>

    <!-- 网络质量指示器 -->
    <NetworkQualityIndicator 
      v-if="networkQuality" 
      :quality="networkQuality" 
      class="network-indicator"
    />

    <!-- 音频电平指示器 -->
    <AudioLevelIndicator 
      v-if="audioLevel !== null && isVideoType" 
      :level="audioLevel"
      class="audio-indicator"
    />

    <!-- 拖拽高亮 -->
    <div v-if="isDragOver" class="drag-highlight">
      <el-icon :size="32"><Plus /></el-icon>
    </div>

    <!-- 全屏遮罩 -->
    <Teleport to="body">
      <div v-if="isFullscreen && isDocumentType" class="fullscreen-document-container">
        <DocumentPager
          ref="fullscreenDocumentRef"
          :source="source"
          :initial-fullscreen="true"
          @page-change="onFullscreenPageChange"
          @exit-fullscreen="handleExitFullscreen"
        />
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { 
  VideoPlay, VideoPause, FullScreen, 
  VideoCamera, WarningFilled, Loading,
  ArrowLeft, ArrowRight, Plus
} from '@element-plus/icons-vue'
import NetworkQualityIndicator from '../common/NetworkQualityIndicator.vue'
import AudioLevelIndicator from '../common/AudioLevelIndicator.vue'
import DocumentPager from './DocumentPager.vue'

const props = defineProps({
  source: {
    type: Object,
    default: null
  },
  index: {
    type: Number,
    default: 0
  },
  initialMuted: {
    type: Boolean,
    default: false
  },
  networkQuality: {
    type: Object,
    default: null
  },
  audioLevel: {
    type: Number,
    default: null
  }
})

const emit = defineEmits([
  'toggle-play',
  'play',
  'pause',
  'seek',
  'volume-change',
  'fullscreen',
  'maximize',
  'unmaximize',
  'drag-over',
  'drag-leave',
  'drop',
  'source-ready',
  'error'
])

// Refs
const videoRef = ref(null)
const streamRef = ref(null)
const documentPagerRef = ref(null)
const fullscreenDocumentRef = ref(null)

// 状态
const isLoading = ref(true)
const error = ref(null)
const isPlaying = ref(false)
const isMuted = ref(props.initialMuted)
const isFullscreen = ref(false)
const isMaximized = ref(false)
const isDragging = ref(false)
const isDragOver = ref(false)
const hasStream = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(100)
const currentDocPage = ref(1)
const totalDocPages = ref(1)

// 计算属性
const isVideoType = computed(() => {
  const type = props.source?.type
  return ['localVideo', 'video', 'media', 'mp4', 'webm'].includes(type)
})

const isDocumentType = computed(() => {
  const type = props.source?.type
  return ['word', 'doc', 'docx', 'ppt', 'pptx', 'excel', 'xls', 'xlsx', 
          'pdf', 'txt', 'text', 'image'].includes(type)
})

const isCameraType = computed(() => {
  const type = props.source?.type
  return ['camera', 'localCamera', 'localDevice', 'usb', 'capture', 
          'screen', 'remoteDesktop'].includes(type)
})

const videoSrc = computed(() => {
  if (!props.source) return ''
  return props.source.url || props.source.src || ''
})

const sourceName = computed(() => {
  return props.source?.name || props.source?.file?.name || '未命名'
})

const sourceTypeLabel = computed(() => {
  const type = props.source?.type
  const labels = {
    localVideo: '本地视频',
    video: '视频',
    media: '媒体',
    word: 'Word文档',
    doc: 'Word文档',
    docx: 'Word文档',
    ppt: 'PPT课件',
    pptx: 'PPT课件',
    excel: 'Excel表格',
    xls: 'Excel表格',
    xlsx: 'Excel表格',
    pdf: 'PDF文档',
    txt: '文本文件',
    text: '文本文件',
    image: '图片',
    camera: '摄像头',
    localCamera: '本地摄像头',
    localDevice: '本地设备',
    screen: '屏幕共享',
    remoteDesktop: '远程桌面'
  }
  return labels[type] || type || '未知'
})

const sourceTypeTag = computed(() => {
  const type = props.source?.type
  const tags = {
    localVideo: 'success',
    video: 'success',
    media: 'success',
    word: 'info',
    doc: 'info',
    docx: 'info',
    ppt: 'info',
    pptx: 'info',
    excel: 'info',
    xls: 'info',
    xlsx: 'info',
    pdf: 'info',
    txt: 'info',
    text: 'info',
    image: 'warning',
    camera: 'primary',
    localCamera: 'primary',
    localDevice: 'primary',
    screen: 'warning',
    remoteDesktop: 'warning'
  }
  return tags[type] || 'info'
})

const progressPercent = computed(() => {
  if (duration.value === 0) return 0
  return (currentTime.value / duration.value) * 100
})

// 视频事件处理
const onLoadedMetadata = () => {
  isLoading.value = false
  if (videoRef.value) {
    duration.value = videoRef.value.duration
    isLoading.value = false
    emit('source-ready', { type: 'video', duration: duration.value })
  }
}

const onTimeUpdate = () => {
  if (videoRef.value) {
    currentTime.value = videoRef.value.currentTime
  }
}

const onPlay = () => {
  isPlaying.value = true
  emit('play')
}

const onPause = () => {
  isPlaying.value = false
  emit('pause')
}

const onEnded = () => {
  isPlaying.value = false
}

const onError = (e) => {
  isLoading.value = false
  error.value = '视频加载失败'
  console.error('[EnhancedVideoItem] Video error:', e)
  emit('error', { source: props.source, error: e })
}

// 控制函数
const togglePlay = () => {
  if (!videoRef.value) return
  
  if (videoRef.value.paused) {
    videoRef.value.play().catch(err => {
      if (err.name !== 'AbortError') {
        console.error('[EnhancedVideoItem] Play error:', err)
      }
    })
  } else {
    videoRef.value.pause()
  }
  emit('toggle-play')
}

const toggleMute = () => {
  isMuted.value = !isMuted.value
  if (videoRef.value) {
    videoRef.value.muted = isMuted.value
  }
  emit('volume-change', { muted: isMuted.value, volume: volume.value })
}

const handleVolumeChange = (val) => {
  volume.value = val
  if (videoRef.value) {
    videoRef.value.volume = val / 100
    videoRef.value.muted = val === 0
    isMuted.value = val === 0
  }
  emit('volume-change', { muted: isMuted.value, volume: val })
}

const seekTo = (e) => {
  if (!videoRef.value || duration.value === 0) return
  
  const rect = e.currentTarget.getBoundingClientRect()
  const percent = (e.clientX - rect.left) / rect.width
  const time = percent * duration.value
  
  videoRef.value.currentTime = time
  emit('seek', time)
}

const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// 文档翻页
const nextDocPage = () => {
  if (documentPagerRef.value) {
    documentPagerRef.value.nextPage()
  }
}

const previousDocPage = () => {
  if (documentPagerRef.value) {
    documentPagerRef.value.previousPage()
  }
}

const onPageChange = ({ currentPage, totalPages }) => {
  currentDocPage.value = currentPage
  totalDocPages.value = totalPages
}

const onFullscreenPageChange = ({ currentPage, totalPages }) => {
  currentDocPage.value = currentPage
  totalDocPages.value = totalPages
}

// 全屏处理
const handleFullscreen = () => {
  if (isDocumentType.value) {
    if (documentPagerRef.value) {
      documentPagerRef.value.enterFullscreen()
    }
  } else {
    // 视频全屏
    if (videoRef.value) {
      if (videoRef.value.requestFullscreen) {
        videoRef.value.requestFullscreen()
      } else if (videoRef.value.webkitRequestFullscreen) {
        videoRef.value.webkitRequestFullscreen()
      }
    }
  }
  emit('fullscreen', { source: props.source, isFullscreen: true })
}

const handleEnterFullscreen = () => {
  isFullscreen.value = true
  emit('fullscreen', { source: props.source, isFullscreen: true })
}

const handleExitFullscreen = () => {
  isFullscreen.value = false
  emit('fullscreen', { source: props.source, isFullscreen: false })
}

// 拖拽处理
const handleDoubleClick = () => {
  if (isMaximized.value) {
    isMaximized.value = false
    emit('unmaximize')
  } else {
    isMaximized.value = true
    emit('maximize')
  }
}

const handleDragOver = (e) => {
  e.preventDefault()
  isDragOver.value = true
  emit('drag-over', { index: props.index, event: e })
}

const handleDragLeave = (e) => {
  isDragOver.value = false
  emit('drag-leave', { index: props.index, event: e })
}

const handleDrop = (e) => {
  e.preventDefault()
  isDragOver.value = false
  
  try {
    const data = e.dataTransfer.getData('application/json')
    if (data) {
      const source = JSON.parse(data)
      emit('drop', { index: props.index, source })
    }
  } catch (err) {
    console.error('[EnhancedVideoItem] Drop error:', err)
  }
}

// 设置视频流（用于摄像头）
const setVideoStream = (stream) => {
  if (streamRef.value && stream) {
    streamRef.value.srcObject = stream
    hasStream.value = true
    emit('source-ready', { type: 'camera', stream })
  }
}

// 设置文档源
const setDocumentSource = (source) => {
  if (documentPagerRef.value) {
    documentPagerRef.value.setSource(source)
  }
}

// 生命周期
watch(() => props.source, (newSource) => {
  if (newSource) {
    isLoading.value = true
    error.value = null
    currentTime.value = 0
    duration.value = 0
    isPlaying.value = false
  }
}, { immediate: true })

watch(() => props.initialMuted, (muted) => {
  isMuted.value = muted
  if (videoRef.value) {
    videoRef.value.muted = muted
  }
})

onMounted(() => {
  // 初始化视频流
  if (props.source?.stream) {
    setVideoStream(props.source.stream)
  }
})

onUnmounted(() => {
  // 清理
  if (streamRef.value?.srcObject) {
    // 不停止原始流，只清除引用
    streamRef.value.srcObject = null
  }
})

// 暴露方法
defineExpose({
  setVideoStream,
  setDocumentSource,
  togglePlay,
  toggleMute,
  seekTo,
  getVideoElement: () => videoRef.value,
  getCurrentTime: () => currentTime.value,
  getDuration: () => duration.value,
  isPlaying: () => isPlaying.value
})
</script>

<style scoped lang="scss">
.enhanced-video-item {
  width: 100%;
  height: 100%;
  position: relative;
  background: var(--bg-primary, #0a0f1a);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  transition: all 0.3s ease;

  &:hover {
    border-color: var(--primary-color, #409eff);
    box-shadow: 0 0 12px rgba(64, 158, 255, 0.3);
  }

  &.is-maximized {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 1000;
    border-radius: 0;
  }

  &.is-fullscreen {
    // 全屏模式由Teleport处理
  }

  &.is-dragging {
    opacity: 0.7;
    transform: scale(0.98);
  }
}

.video-content,
.stream-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}

.document-content {
  width: 100%;
  height: 100%;
}

.stream-content {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;

  .stream-video {
    position: absolute;
    top: 0;
    left: 0;
  }
}

.stream-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary, #888);
  gap: 8px;
  z-index: 1;
}

// 加载和错误遮罩
.loading-overlay,
.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  z-index: 5;
}

.error-overlay {
  color: #f56c6c;
}

// 视频控制栏
.video-controls-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 8px 12px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
  display: flex;
  align-items: center;
  gap: 12px;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 10;

  .enhanced-video-item:hover & {
    opacity: 1;
  }
}

.control-btn {
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .el-icon {
    font-size: 16px;
  }
}

.progress-container {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.progress-bar {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  overflow: hidden;
}

.progress-played {
  height: 100%;
  background: var(--primary-color, #409eff);
  transition: width 0.1s;
}

.time-display {
  color: white;
  font-size: 12px;
  white-space: nowrap;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.volume-slider {
  width: 80px;
}

.volume-value {
  color: white;
  font-size: 12px;
  min-width: 35px;
}

// 悬浮信息
.item-overlay {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 8;

  .source-name {
    background: rgba(0, 0, 0, 0.6);
    padding: 4px 8px;
    border-radius: 4px;
    color: white;
    font-size: 12px;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.network-indicator {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 8;
}

.audio-indicator {
  position: absolute;
  top: 8px;
  right: 60px;
  z-index: 8;
}

// 拖拽高亮
.drag-highlight {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(64, 158, 255, 0.3);
  border: 2px dashed var(--primary-color, #409eff);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  z-index: 9;
}

// 文档翻页控件
.document-pager-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
  display: flex;
  justify-content: center;
  z-index: 10;
}

.pager-controls-mini {
  display: flex;
  align-items: center;
  gap: 16px;
  background: rgba(255, 255, 255, 0.1);
  padding: 8px 16px;
  border-radius: 24px;
}

.pager-btn {
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .el-icon {
    font-size: 18px;
  }
}

.page-indicator {
  color: white;
  font-size: 14px;
  min-width: 60px;
  text-align: center;
}

// 全屏文档容器
.fullscreen-document-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  background: #000;
}
</style>
