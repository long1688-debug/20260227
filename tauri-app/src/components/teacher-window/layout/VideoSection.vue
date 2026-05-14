<template>
  <div class="video-section">
    <!-- 主内容区域：视频画布 + 全局功能层 -->
    <div class="video-main-area">
      <div
        class="video-display-container"
        ref="videoContainerRef"
        @dragover.prevent="onDragOver"
        @dragenter.prevent="onDragEnter"
        @dragleave="onDragLeave"
        @drop.prevent="onDrop"
      >
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

        <!-- 🎯 拖拽提示覆盖层 -->
        <div v-if="isDragOver" class="drag-overlay">
          <div class="drag-hint">
            <span class="hint-icon">📥</span>
            <span class="hint-text">释放以添加信号源</span>
          </div>
        </div>

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
  },
  // 🎯 新增：兼容原有 VideoGrid 的 props
  videoPreviews: {
    type: Array,
    default: () => []
  },
  allSources: {
    type: Array,
    default: () => []
  },
  customGridCount: {
    type: Number,
    default: 4
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
  'show-network-detail',
  // 🎯 新增：拖拽放置事件
  'drop-source'
])

// 引用
const renderEngineRef = ref(null)
const videoContainerRef = ref(null)
const containerWidth = ref(1280)
const containerHeight = ref(720)
const isFullscreen = ref(false)
const isDragOver = ref(false)  // 🎯 拖拽悬停状态

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
  // 🎯 修复：支持所有新的布局类型
  const layoutMap = {
    1: 'single',           // 1分屏
    2: 'grid-1x2',         // 2分屏（1行2列）
    3: 'grid-3-special',   // 特殊布局，左2右1
    4: 'grid-2x2',         // 4分屏
    5: 'grid-2x3',         // 6分屏（2行3列）
    6: 'grid-3x2',         // 6分屏（3行2列）
    7: 'grid-3x3',         // 9分屏
    8: 'grid-4x2',         // 8分屏
    9: 'grid-3x3',         // 9分屏
    10: 'grid-4x4',        // 16分屏
    11: 'grid-5x5',        // 25分屏
    12: 'grid-6x6',        // 36分屏
    13: 'grid-7x7',        // 49分屏
    14: 'special-1',       // 特殊布局1
    15: 'special-2',       // 特殊布局2
    16: 'special-3',       // 特殊布局3
    17: 'special-4',       // 特殊布局4
    18: 'free'             // 自由布局
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

// 🎯 拖拽事件处理
const onDragOver = (event) => {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'copy'
}

const onDragEnter = (event) => {
  event.preventDefault()
  isDragOver.value = true
  console.log('[VideoSection] 拖拽进入')
}

const onDragLeave = (event) => {
  // 检查是否真的离开了容器
  if (!event.currentTarget.contains(event.relatedTarget)) {
    isDragOver.value = false
    console.log('[VideoSection] 拖拽离开')
  }
}

const onDrop = (event) => {
  event.preventDefault()
  isDragOver.value = false

  console.log('[VideoSection] 拖拽放置')

  try {
    // 获取拖拽的数据
    const sourceId = event.dataTransfer?.getData('sourceId')
    const sourceType = event.dataTransfer?.getData('sourceType')
    const sourceName = event.dataTransfer?.getData('sourceName')
    const jsonData = event.dataTransfer?.getData('application/json')

    console.log('[VideoSection] 拖拽数据:', { sourceId, sourceType, sourceName })

    let source = null

    // 优先从 JSON 数据解析
    if (jsonData) {
      try {
        source = JSON.parse(jsonData)
        console.log('[VideoSection] 从 JSON 解析信号源:', source.name)
      } catch (e) {
        console.error('[VideoSection] JSON 解析失败:', e)
      }
    }

    // 如果没有 JSON 数据，构造基本对象
    if (!source && sourceId) {
      source = {
        id: sourceId,
        type: sourceType,
        name: sourceName
      }
      console.log('[VideoSection] 构造基本信号源对象')
    }

    if (!source) {
      console.warn('[VideoSection] 未找到有效的信号源数据')
      return
    }

    // 🎯 计算放置位置对应的元素索引
    // 通过鼠标位置判断应该放置到哪个槽位
    const rect = videoContainerRef.value.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // 根据当前布局和坐标计算目标槽位
    const targetSlotIndex = calculateTargetSlot(x, y, rect.width, rect.height)

    console.log(`[VideoSection] 计算得到目标槽位: ${targetSlotIndex}`)

    // 发出事件给父组件处理
    emit('drop-source', {
      source,
      slotIndex: targetSlotIndex,
      position: { x, y }
    })

  } catch (error) {
    console.error('[VideoSection] 处理拖拽放置失败:', error)
  }
}

// 🎯 根据坐标计算目标槽位索引（支持网格布局和特殊布局）
const calculateTargetSlot = (x, y, width, height) => {
  const layout = props.currentLayout

  // 🎯 处理特殊布局（1大1小：小的在四角）
  if ([14, 15, 16, 17].includes(layout)) {
    return calculateSpecialLayoutSlot(x, y, width, height, layout)
  }

  // 🎯 处理画中画布局（如果有）
  if (layout === 'pip' || layout === 'PIP') {
    return calculatePipLayoutSlot(x, y, width, height)
  }

  // 🎯 处理自由布局 - 返回默认槽位1
  if (layout === 0 || layout === 'free') {
    return 1
  }

  // 🎯 标准网格布局
  let cols = 1
  let rows = 1

  switch (layout) {
    case 1:  // 1分屏
      cols = 1; rows = 1; break
    case 2:  // 2分屏（左右）
      cols = 2; rows = 1; break
    case 3:  // 3分屏（左二右一）
      return calculateGrid3SpecialSlot(x, y, width, height)
    case 4:  // 4分屏（2x2）
      cols = 2; rows = 2; break
    case 5:  // 6分屏（2x3）
      cols = 3; rows = 2; break
    case 7:  // 9分屏（3x3）
      cols = 3; rows = 3; break
    case 10: // 16分屏（4x4）
      cols = 4; rows = 4; break
    case 11: // 25分屏（5x5）
      cols = 5; rows = 5; break
    case 12: // 36分屏（6x6）
      cols = 6; rows = 6; break
    case 13: // 49分屏（7x7）
      cols = 7; rows = 7; break
    default:
      cols = 2; rows = 2; break
  }

  const cellWidth = width / cols
  const cellHeight = height / rows

  const colIndex = Math.floor(x / cellWidth)
  const rowIndex = Math.floor(y / cellHeight)

  // 转换为 1-based 索引
  const slotIndex = rowIndex * cols + colIndex + 1

  // 限制在有效范围内
  const maxSlots = cols * rows
  return Math.min(Math.max(1, slotIndex), maxSlots)
}

// 🎯 处理特殊布局（1大1小：小的在四角）
const calculateSpecialLayoutSlot = (x, y, width, height, layout) => {
  // 小窗口尺寸（固定大小，与 RenderLayout.js 中一致）
  const subWidth = width * 0.25  // 25% 宽度
  const subHeight = height * 0.25  // 25% 高度

  // 根据布局类型确定小窗口位置
  let subX = 0, subY = 0

  switch (layout) {
    case 14: // 特殊布局1：小的左上角
      subX = 0; subY = 0; break
    case 15: // 特殊布局2：小的左下角
      subX = 0; subY = height - subHeight; break
    case 16: // 特殊布局3：小的右上角
      subX = width - subWidth; subY = 0; break
    case 17: // 特殊布局4：小的右下角
      subX = width - subWidth; subY = height - subHeight; break
  }

  // 检查鼠标是否在小窗口区域内
  if (x >= subX && x <= subX + subWidth &&
      y >= subY && y <= subY + subHeight) {
    return 2  // 小窗口（副画面）
  } else {
    return 1  // 大窗口（主画面）
  }
}

// 🎯 处理3分屏特殊布局（左二右一）
const calculateGrid3SpecialSlot = (x, y, width, height) => {
  const halfWidth = width / 2
  const halfHeight = height / 2

  if (x < halfWidth) {
    // 左侧区域
    if (y < halfHeight) {
      return 1  // 左上
    } else {
      return 2  // 左下
    }
  } else {
    // 右侧区域（占满整个高度）
    return 3  // 右侧
  }
}

// 🎯 处理画中画布局
const calculatePipLayoutSlot = (x, y, width, height) => {
  // 画中画小窗口通常在右下角，固定大小
  const pipWidth = 240
  const pipHeight = 135
  const pipX = width - pipWidth - 20  // 留一些边距
  const pipY = height - pipHeight - 20

  // 检查是否点击在画中画区域
  if (x >= pipX && x <= pipX + pipWidth &&
      y >= pipY && y <= pipY + pipHeight) {
    return 2  // 画中画小窗口
  } else {
    return 1  // 主画面
  }
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
  border-radius: 0;  /* 🎯 修复：移除圆角，避免边缘留白 */
  overflow: hidden;
  position: relative;
  width: 100%;
  height: 100%;
  padding: 0;  /* 🎯 修复：移除padding */
  margin: 0;   /* 🎯 修复：移除margin */
}

.video-main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
  height: 100%;
}

.video-display-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #0D1B2A;
  min-height: 0;
  width: 100%;
  height: 100%;
}

/* 🎯 拖拽覆盖层 */
.drag-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(76, 201, 240, 0.1);
  backdrop-filter: blur(2px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.drag-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px 48px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 12px;
  border: 2px dashed #4CC9F0;
}

.hint-icon {
  font-size: 48px;
  animation: bounce 1s infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.hint-text {
  font-size: 18px;
  color: #E0E1DD;
  font-weight: 500;
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
  height: 0;           /* 🎯 修复：高度设为0，不占据空间 */
  flex-shrink: 0;
  overflow: hidden;    /* 🎯 隐藏内容，防止溢出 */
  opacity: 0;          /* 🎯 完全透明 */
}
</style>
