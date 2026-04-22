<template>
  <div class="video-section">
    <!-- 主内容区域：视频画布 + 全局功能层 -->
    <div class="video-main-area">
      <div class="video-display-container" ref="videoContainerRef">
        <!-- 渲染引擎主画布 -->
        <RenderEngineWrapper
          ref="renderEngineRef"
          :sources="canvasSources"
          :layout-type="convertLayoutType(currentLayout)"
          :width="containerWidth"
          :height="containerHeight"
          :auto-start="true"
          @ready="onEngineReady"
          @error="onEngineError"
          @source-ready="onSourceReady"
          @source-error="onSourceError"
          @element-click="onElementClick"
          @layout-change="onLayoutChange"
        />
        
        <!-- 全屏切换按钮 -->
        <button class="fullscreen-btn" @click="toggleFullscreen" title="全屏">
          <span class="fullscreen-icon">⛶</span>
        </button>
        
        <!-- 全局功能层（覆盖整个视频展示区域，不受布局切换影响） -->
        <GlobalSubtitle />
        <AnnotationCanvas @double-click="handleAnnotationDoubleClick" />
      </div>

      <!-- 字幕控制栏（固定在视频区域底部） -->
      <div class="subtitle-control-bar-container">
        <SubtitleControlBar
          @manage-subtitles="$emit('show-subtitle-dialog')"
          @export-subtitles="$emit('export-subtitles')"
          @import-subtitles="$emit('import-subtitles')"
          @clear-subtitles="$emit('clear-subtitles')"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import RenderEngineWrapper from '../../render/RenderEngineWrapper.vue'  // 导入渲染引擎包装器
import GlobalSubtitle from '../video/GlobalSubtitle.vue'
import AnnotationCanvas from '../video/AnnotationCanvas.vue'
import SubtitleControlBar from '../common/SubtitleControlBar.vue'

// 定义属性
const props = defineProps({
  currentLayout: {
    type: Number,
    default: 1
  },
  canvasSources: {
    type: Array,
    default: () => []
  },
  canvasSourceMap: {
    type: Object,
    default: () => ({})
  },
  dragOverIndex: {
    type: Number,
    default: -1
  },
  networkQuality: {
    type: Object,
    default: () => ({})
  },
  isMaximized: {
    type: Boolean,
    default: false
  },
  maximizedIndex: {
    type: Number,
    default: null  // 使用 null 表示没有最大化，与 VideoGrid.vue 的逻辑保持一致
  },
  globalSubtitle: {
    type: String,
    default: ''
  },
  subtitleVisible: {
    type: Boolean,
    default: true
  },
  currentSubtitleText: {
    type: String,
    default: ''
  }
})

// 定义事件
const emit = defineEmits([
  'show-recording-dialog',
  'show-settings-dialog',
  'show-multicam-dialog',
  'show-vr-dialog',
  'show-chromakey-dialog',
  'show-subtitle-dialog',
  'show-video-to-subtitle-dialog',
  'export-subtitles',
  'import-subtitles',
  'clear-subtitles',
  // 渲染引擎事件
  'ready',
  'error',
  'source-ready',
  'source-error',
  'element-click',
  'layout-change',
  // 用于处理最大化/还原
  'toggle-maximize',
  'show-network-detail'
])

// 引用
const renderEngineRef = ref(null)
const videoContainerRef = ref(null)
const containerWidth = ref(1280)
const containerHeight = ref(720)
const isFullscreen = ref(false)

// 更新容器尺寸
const updateContainerSize = () => {
  if (videoContainerRef.value) {
    const rect = videoContainerRef.value.getBoundingClientRect()
    containerWidth.value = Math.max(rect.width, 640)
    containerHeight.value = Math.max(rect.height, 360)
  }
}

// 全屏切换
const toggleFullscreen = () => {
  const container = videoContainerRef.value
  if (!container) return
  
  if (!document.fullscreenElement) {
    container.requestFullscreen?.().then(() => {
      isFullscreen.value = true
      updateContainerSize()
    }).catch(err => {
      console.error('[VideoSection] 全屏失败:', err)
    })
  } else {
    document.exitFullscreen?.().then(() => {
      isFullscreen.value = false
      updateContainerSize()
    }).catch(err => {
      console.error('[VideoSection] 退出全屏失败:', err)
    })
  }
}

// 监听全屏变化
document.addEventListener('fullscreenchange', () => {
  isFullscreen.value = !!document.fullscreenElement
  updateContainerSize()
})

// 监听窗口大小变化
let resizeObserver = null
onMounted(() => {
  updateContainerSize()
  
  // 使用 ResizeObserver 监听容器尺寸变化
  if (window.ResizeObserver && videoContainerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      updateContainerSize()
    })
    resizeObserver.observe(videoContainerRef.value)
  } else {
    // 降级方案：监听 window resize
    window.addEventListener('resize', updateContainerSize)
  }
})

onUnmounted(() => {
  if (resizeObserver && videoContainerRef.value) {
    resizeObserver.unobserve(videoContainerRef.value)
  }
  window.removeEventListener('resize', updateContainerSize)
})

// 将布局编号转换为渲染引擎支持的布局类型
const convertLayoutType = (layoutNum) => {
  const layoutMap = {
    1: 'single',
    2: 'grid-1x2',
    3: 'grid-3-split-left', // 特殊布局，左2右1
    4: 'grid-2x2',
    5: 'grid-2x3', // 2行3列
    6: 'grid-3x2', // 3行2列
    7: 'grid-3x3',
    8: 'grid-4x2',
    9: 'grid-3x3',
    16: 'grid-4x4',
    18: 'free', // 自由布局
  }
  
  // 对于自定义网格布局
  if (layoutNum > 9 && layoutNum < 18) {
    // 这里可以根据具体数值推算行列数，例如12=3x4, 15=3x5等
    return 'grid-custom'
  }
  
  return layoutMap[layoutNum] || 'single'
}

// 渲染引擎事件处理器
const onEngineReady = (event) => {
  emit('ready', event)
}

const onEngineError = (event) => {
  emit('error', event)
}

const onSourceReady = (event) => {
  emit('source-ready', event)
}

const onSourceError = (event) => {
  emit('source-error', event)
}

const onElementClick = (event) => {
  // 确定点击的是哪个元素，根据坐标或其他信息
  // 由于渲染引擎是Canvas，需要更复杂的逻辑来确定点击位置
  // 这里暂时简单处理为切换第一个元素
  emit('toggle-maximize', 1)
}

const onLayoutChange = (event) => {
  emit('layout-change', event)
}

// 处理 AnnotationCanvas 的双击事件
const handleAnnotationDoubleClick = (event) => {
  // 触发最大化/还原事件
  // 由于渲染引擎中元素位置可能不同，这里可能需要更复杂的坐标计算
  emit('toggle-maximize', 1) // 默认触发第一个元素的切换
}

// 暴露方法给父组件
defineExpose({
  renderEngineRef
})
</script>

<style scoped>
.video-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #1B263B;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
}

.video-main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.video-display-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #0D1B2A;
  min-height: 0;
}

/* 全屏按钮 */
.fullscreen-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 40px;
  height: 40px;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  transition: all 0.2s ease;
  backdrop-filter: blur(4px);
}

.fullscreen-btn:hover {
  background: rgba(0, 0, 0, 0.8);
  transform: scale(1.1);
}

.fullscreen-icon {
  font-size: 20px;
  color: #E0E1DD;
}

.subtitle-control-bar-container {
  height: 48px;
  flex-shrink: 0;
}
</style>