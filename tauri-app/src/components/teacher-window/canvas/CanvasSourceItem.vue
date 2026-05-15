<template>
  <div
    class="canvas-source-item"
    :class="{
      'selected': isSelected,
      'locked': source.locked,
      [`type-${source.type}`]: true
    }"
    :style="itemStyle"
    @mousedown="handleMouseDown"
    @contextmenu="handleContextMenu"
  >
    <!-- 标题栏 -->
    <div v-if="source.showTitle" class="source-header">
      <span class="source-title">{{ source.name }}</span>
      <div class="source-controls" v-if="isSelected">
        <el-button 
          size="small" 
          text
          @click.stop="toggleVisibility"
          :icon="source.visible ? 'View' : 'Hide'"
        />
        <el-button 
          size="small" 
          text
          @click.stop="toggleLock"
          :icon="source.locked ? 'Lock' : 'Unlock'"
        />
      </div>
    </div>
    
    <!-- 内容区域 -->
    <div class="source-content" :style="{ filter: filterCSS }">
      <!-- 根据类型渲染不同内容 -->
      <VideoContent v-if="source.type === 'video'" :source="source" />
      <TextContent v-else-if="source.type === 'text'" :source="source" />
      <ImageContent v-else-if="source.type === 'image'" :source="source" />
      <WebpageContent v-else-if="source.type === 'webpage'" :source="source" />
      <PptContent v-else-if="source.type === 'ppt'" :source="source" />
      <WordContent v-else-if="source.type === 'word'" :source="source" />
      <MindmapContent v-else-if="source.type === 'mindmap'" :source="source" />
      <RemoteDesktopContent v-else-if="source.type === 'remote_desktop'" :source="source" />
      <CameraContent v-else-if="source.type === 'camera'" :source="source" />
      <!-- PDF 使用 iframe 直接加载 -->
      <div v-else-if="source.type === 'pdf'" class="pdf-content-wrapper">
        <iframe
          v-if="source.properties?.url"
          :src="source.properties.url"
          class="pdf-iframe"
          frameborder="0"
        ></iframe>
        <div v-else class="pdf-placeholder">
          <el-icon><Document /></el-icon>
          <span>{{ source.name }}</span>
        </div>
      </div>
    </div>
    
    <!-- 选中边框和控制点 -->
    <div v-if="isSelected && !source.locked" class="selection-border">
      <!-- 8个控制点 -->
      <div 
        v-for="handle in resizeHandles" 
        :key="handle.position"
        class="resize-handle"
        :class="handle.position"
        @mousedown.stop="(e) => startResize(e, handle.position)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { Document } from '@element-plus/icons-vue';
import VideoContent from './contents/VideoContent.vue';
import TextContent from './contents/TextContent.vue';
import ImageContent from './contents/ImageContent.vue';
import WebpageContent from './contents/WebpageContent.vue';
import PptContent from './contents/PptContent.vue';
import WordContent from './contents/WordContent.vue';
import MindmapContent from './contents/MindmapContent.vue';
import RemoteDesktopContent from './contents/RemoteDesktopContent.vue';
import CameraContent from './contents/CameraContent.vue';

const props = defineProps({
  source: {
    type: Object,
    required: true
  },
  isSelected: {
    type: Boolean,
    default: false
  },
  filterCSS: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['select', 'move', 'resize', 'context-menu']);

// 拖拽状态
const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });
const sourceStart = ref({ x: 0, y: 0 });

// 调整大小状态
const isResizing = ref(false);
const resizeHandle = ref('');
const resizeStart = ref({ x: 0, y: 0, width: 0, height: 0 });

// 控制点位置定义
const resizeHandles = [
  { position: 'nw' }, { position: 'n' }, { position: 'ne' },
  { position: 'w' }, { position: 'e' },
  { position: 'sw' }, { position: 's' }, { position: 'se' }
];

// ============================================
// 计算属性
// ============================================

/**
 * 信号源样式
 */
const itemStyle = computed(() => ({
  position: 'absolute',
  left: `${props.source.x}%`,
  top: `${props.source.y}%`,
  width: `${props.source.width}%`,
  height: `${props.source.height}%`,
  zIndex: props.source.zIndex,
  transform: `rotate(${props.source.rotation}deg)`,
  opacity: props.source.opacity,
  cursor: props.source.locked ? 'default' : 'move'
}));

// ============================================
// 事件处理
// ============================================

/**
 * 鼠标按下 - 开始拖拽
 */
const handleMouseDown = (e) => {
  if (props.source.locked) return;
  
  // 如果点击的是控制点,不触发拖拽
  if (e.target.classList.contains('resize-handle')) return;
  
  e.stopPropagation();
  emit('select', props.source.id);
  
  isDragging.value = true;
  dragStart.value = { x: e.clientX, y: e.clientY };
  sourceStart.value = { x: props.source.x, y: props.source.y };
  
  // 添加全局事件监听
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};

/**
 * 鼠标移动 - 拖拽中
 */
const handleMouseMove = (e) => {
  if (!isDragging.value) return;
  
  const deltaX = e.clientX - dragStart.value.x;
  const deltaY = e.clientY - dragStart.value.y;
  
  // 将像素偏移转换为百分比
  const containerWidth = e.target.parentElement?.offsetWidth || window.innerWidth;
  const containerHeight = e.target.parentElement?.offsetHeight || window.innerHeight;
  
  const percentX = (deltaX / containerWidth) * 100;
  const percentY = (deltaY / containerHeight) * 100;
  
  emit('move', {
    sourceId: props.source.id,
    deltaX: percentX,
    deltaY: percentY
  });
  
  dragStart.value = { x: e.clientX, y: e.clientY };
};

/**
 * 鼠标释放 - 结束拖拽
 */
const handleMouseUp = () => {
  isDragging.value = false;
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
};

/**
 * 开始调整大小
 */
const startResize = (e, handlePosition) => {
  if (props.source.locked) return;
  
  e.stopPropagation();
  isResizing.value = true;
  resizeHandle.value = handlePosition;
  resizeStart.value = {
    x: e.clientX,
    y: e.clientY,
    width: props.source.width,
    height: props.source.height
  };
  
  document.addEventListener('mousemove', handleResizeMove);
  document.addEventListener('mouseup', handleResizeEnd);
};

/**
 * 调整大小中
 */
const handleResizeMove = (e) => {
  if (!isResizing.value) return;
  
  const containerWidth = e.target.parentElement?.parentElement?.offsetWidth || window.innerWidth;
  const containerHeight = e.target.parentElement?.parentElement?.offsetHeight || window.innerHeight;
  
  const deltaX = ((e.clientX - resizeStart.value.x) / containerWidth) * 100;
  const deltaY = ((e.clientY - resizeStart.value.y) / containerHeight) * 100;
  
  let deltaWidth = 0;
  let deltaHeight = 0;
  
  // 根据不同控制点计算尺寸变化
  if (resizeHandle.value.includes('e')) deltaWidth = deltaX;
  if (resizeHandle.value.includes('w')) deltaWidth = -deltaX;
  if (resizeHandle.value.includes('s')) deltaHeight = deltaY;
  if (resizeHandle.value.includes('n')) deltaHeight = -deltaY;
  
  emit('resize', {
    sourceId: props.source.id,
    deltaWidth,
    deltaHeight
  });
  
  resizeStart.value.x = e.clientX;
  resizeStart.value.y = e.clientY;
};

/**
 * 结束调整大小
 */
const handleResizeEnd = () => {
  isResizing.value = false;
  document.removeEventListener('mousemove', handleResizeMove);
  document.removeEventListener('mouseup', handleResizeEnd);
};

/**
 * 右键菜单
 */
const handleContextMenu = (e) => {
  emit('context-menu', e, props.source);
};

/**
 * 切换可见性
 */
const toggleVisibility = () => {
  // 通过父组件或Store处理
  console.log('[CanvasSourceItem] 切换可见性');
};

/**
 * 切换锁定
 */
const toggleLock = () => {
  console.log('[CanvasSourceItem] 切换锁定');
};
</script>

<style scoped lang="scss">
.canvas-source-item {
  position: absolute;
  background: #2d3748;
  border: 2px solid transparent;
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.2s, box-shadow 0.2s;
  
  &.selected {
    border-color: #4299e1;
    box-shadow: 0 0 0 2px rgba(66, 153, 225, 0.3);
  }
  
  &.locked {
    opacity: 0.7;
    cursor: default;
  }
  
  .source-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    font-size: 12px;
    
    .source-title {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .source-controls {
      display: flex;
      gap: 4px;
    }
  }
  
  .source-content {
    width: 100%;
    height: calc(100% - 28px);
    overflow: hidden;

    // PDF 内容样式
    .pdf-content-wrapper {
      width: 100%;
      height: 100%;
      background: #fff;
      position: relative;

      .pdf-iframe {
        width: 100%;
        height: 100%;
        border: none;
      }

      .pdf-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: #1a202c;
        color: #a0aec0;

        .el-icon {
          font-size: 48px;
          margin-bottom: 8px;
        }

        span {
          font-size: 14px;
          text-align: center;
          padding: 0 8px;
        }
      }
    }
  }
  
  .selection-border {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    
    .resize-handle {
      position: absolute;
      width: 10px;
      height: 10px;
      background: white;
      border: 2px solid #4299e1;
      border-radius: 50%;
      pointer-events: all;
      cursor: pointer;
      
      &.nw { top: -5px; left: -5px; cursor: nw-resize; }
      &.n { top: -5px; left: 50%; transform: translateX(-50%); cursor: n-resize; }
      &.ne { top: -5px; right: -5px; cursor: ne-resize; }
      &.w { top: 50%; left: -5px; transform: translateY(-50%); cursor: w-resize; }
      &.e { top: 50%; right: -5px; transform: translateY(-50%); cursor: e-resize; }
      &.sw { bottom: -5px; left: -5px; cursor: sw-resize; }
      &.s { bottom: -5px; left: 50%; transform: translateX(-50%); cursor: s-resize; }
      &.se { bottom: -5px; right: -5px; cursor: se-resize; }
    }
  }
}
</style>
