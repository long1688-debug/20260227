<template>
  <div
    class="free-canvas"
    :style="canvasStyle"
    :class="{ 'drag-over': isDragOver, 'fullscreen-mode': fullscreenSource }"
    @click="handleCanvasClick"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop.prevent="handleDrop"
    @keydown.escape="exitFullscreen"
    tabindex="0"
  >
    <!-- 渲染所有信号源 -->
    <CanvasSourceItem
      v-for="source in sortedSources"
      v-show="!fullscreenSource || fullscreenSource.id === source.id"
      :key="source.id"
      :source="source"
      :is-selected="selectedSourceId === source.id && !fullscreenSource"
      :filter-css="getFilterCSS(source.id)"
      :class="{ 'fullscreen-source': fullscreenSource?.id === source.id }"
      @select="handleSelectSource"
      @move="handleMoveSource"
      @resize="handleResizeSource"
      @context-menu="handleContextMenu"
      @fullscreen="handleFullscreen"
    />

    <!-- 全屏模式下的控制栏 -->
    <div v-if="fullscreenSource" class="fullscreen-controls">
      <el-button-group>
        <el-button
          size="small"
          type="primary"
          @click="exitFullscreen"
        >
          退出全屏 (ESC)
        </el-button>
      </el-button-group>
      <span class="fullscreen-title">{{ fullscreenSource.name }}</span>
      <!-- 文档翻页控制 -->
      <el-button-group v-if="isDocumentType" class="fullscreen-pagination">
        <el-button
          size="small"
          :icon="ArrowLeft"
          @click="handlePageChange('prev')"
          :disabled="currentDocPage <= 1"
        >
          上一页
        </el-button>
        <el-button
          size="small"
          @click="exitFullscreen"
        >
          {{ currentDocPage }} / {{ totalDocPages }}
        </el-button>
        <el-button
          size="small"
          :icon="ArrowRight"
          @click="handlePageChange('next')"
          :disabled="currentDocPage >= totalDocPages"
        >
          下一页
        </el-button>
      </el-button-group>
    </div>

    <!-- 右键菜单 -->
    <ContextMenu
      v-if="contextMenu.visible && !fullscreenSource"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :source="contextMenu.source"
      @close="closeContextMenu"
      @action="handleContextMenuAction"
    />

    <!-- 属性面板对话框 -->
    <SourcePropertiesDialog ref="propertiesDialogRef" />
  </div>
</template>

<script setup>
import { computed, ref, reactive, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { FullScreen, ArrowLeft, ArrowRight } from '@element-plus/icons-vue';
import { useCanvasStore } from '@/stores/canvasStore';
import CanvasSourceItem from './CanvasSourceItem.vue';
import ContextMenu from './CanvasContextMenu.vue';
import SourcePropertiesDialog from './SourcePropertiesDialog.vue';

const canvasStore = useCanvasStore();

// 属性面板引用
const propertiesDialogRef = ref(null);

// 拖放状态
const isDragOver = ref(false);

// 全屏状态
const fullscreenSource = ref(null);

// 文档类型标识
const documentTypes = ['ppt', 'word', 'pdf', 'mindmap', 'webpage', 'document', 'text', 'image'];
const isDocumentType = computed(() => {
  return fullscreenSource.value && documentTypes.includes(fullscreenSource.value.type);
});

// 文档翻页状态（用于全屏控制栏显示）
const currentDocPage = ref(1);
const totalDocPages = ref(1);

// 文档翻页处理
const handlePageChange = (direction) => {
  if (!fullscreenSource.value) return;
  // 向子组件发送翻页事件
  const canvasEl = document.querySelector('.free-canvas');
  if (canvasEl) {
    canvasEl.dispatchEvent(new CustomEvent('doc-page-change', {
      detail: {
        sourceId: fullscreenSource.value.id,
        direction
      }
    }));
  }
};

// 解构 Store
const {
  sortedSources,
  selectedSourceId,
  getFilterCSS,
  selectSource,
  deselectSource,
  moveSource,
  resizeSource,
  addSource
} = canvasStore;

// 右键菜单状态
const contextMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  source: null
});

// 画布样式
const canvasStyle = computed(() => ({
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  background: '#1a1a2e'
}));

// ============================================
// 生命周期钩子
// ============================================

onMounted(() => {
  // 监听键盘事件
  document.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  // 清理事件监听
  document.removeEventListener('keydown', handleKeyDown);
  // 确保退出全屏
  exitFullscreen();
});

// ============================================
// 键盘事件处理
// ============================================

/**
 * 处理键盘事件
 */
const handleKeyDown = (e) => {
  // ESC 键退出全屏
  if (e.key === 'Escape' && fullscreenSource.value) {
    e.preventDefault();
    exitFullscreen();
  }
};

// ============================================
// 拖放处理
// ============================================

/**
 * 拖拽悬停
 */
const handleDragOver = (e) => {
  isDragOver.value = true;
};

/**
 * 拖拽离开
 */
const handleDragLeave = (e) => {
  // 只有离开画布时才移除高亮
  if (!e.currentTarget.contains(e.relatedTarget)) {
    isDragOver.value = false;
  }
};

/**
 * 处理拖放
 */
const handleDrop = (e) => {
  e.preventDefault();
  isDragOver.value = false;

  try {
    // 尝试从 dataTransfer 获取信号源数据
    const jsonData = e.dataTransfer.getData('application/json');
    const sourceType = e.dataTransfer.getData('sourceType');
    const sourceId = e.dataTransfer.getData('sourceId');

    let source = null;

    // 优先解析 JSON 数据
    if (jsonData) {
      try {
        source = JSON.parse(jsonData);
        console.log('[FreeCanvas] 从 JSON 数据添加信号源:', source.name);
      } catch (parseError) {
        console.error('[FreeCanvas] 解析 JSON 失败:', parseError);
      }
    }

    if (source) {
      // 根据源类型映射到画布源类型
      const canvasSourceType = mapToCanvasSourceType(source.type);

      // 计算放置位置（相对于画布）
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      // 添加到画布
      addSource(canvasSourceType, {
        name: source.name,
        x: Math.max(0, Math.min(100 - 20, x - 10)), // 限制在画布内
        y: Math.max(0, Math.min(100 - 15, y - 7.5)),
        width: 40,
        height: 30,
        properties: {
          sourceId: source.id,
          originalType: source.type,
          url: source.url,
          file: source.file
        }
      });

      ElMessage.success(`已添加 ${source.name} 到自由画布`);
    }
  } catch (error) {
    console.error('[FreeCanvas] 拖放处理失败:', error);
    ElMessage.error('添加信号源失败');
  }
};

/**
 * 映射信号源类型到画布源类型
 */
const mapToCanvasSourceType = (sourceType) => {
  const typeMap = {
    'localCamera': 'camera',
    'networkCamera': 'camera',
    'screen': 'video',
    'ppt': 'ppt',
    'word': 'word',
    'pdf': 'pdf'
  };
  return typeMap[sourceType] || 'video';
};

// ============================================
// 事件处理
// ============================================

/**
 * 点击画布空白处
 */
const handleCanvasClick = (e) => {
  // 如果点击的是画布本身(不是信号源),取消选中
  if (e.target.classList.contains('free-canvas')) {
    deselectSource();
  }
};

/**
 * 选中信号源
 */
const handleSelectSource = (sourceId) => {
  selectSource(sourceId);
};

/**
 * 移动信号源
 */
const handleMoveSource = ({ sourceId, deltaX, deltaY }) => {
  moveSource(sourceId, deltaX, deltaY);
};

/**
 * 调整信号源大小
 */
const handleResizeSource = ({ sourceId, deltaWidth, deltaHeight }) => {
  resizeSource(sourceId, deltaWidth, deltaHeight);
};

/**
 * 显示右键菜单
 */
const handleContextMenu = (e, source) => {
  e.preventDefault();
  contextMenu.visible = true;
  contextMenu.x = e.clientX;
  contextMenu.y = e.clientY;
  contextMenu.source = source;

  // 自动选中右键点击的信号源
  selectSource(source.id);
};

/**
 * 关闭右键菜单
 */
const closeContextMenu = () => {
  contextMenu.visible = false;
  contextMenu.source = null;
};

/**
 * 处理右键菜单操作
 */
const handleContextMenuAction = ({ action, source }) => {
  switch (action) {
    case 'delete':
      canvasStore.removeSource(source.id);
      break;
    case 'moveUp':
      canvasStore.moveUpLayer(source.id);
      break;
    case 'moveDown':
      canvasStore.moveDownLayer(source.id);
      break;
    case 'bringToFront':
      canvasStore.bringToFront(source.id);
      break;
    case 'sendToBack':
      canvasStore.sendToBack(source.id);
      break;
    case 'toggleVisibility':
      canvasStore.toggleSourceVisibility(source.id);
      break;
    case 'toggleLock':
      canvasStore.toggleSourceLock(source.id);
      break;
    case 'fullscreen':
      handleFullscreen(source);
      break;
    case 'properties':
      showPropertiesPanel(source);
      break;
  }

  closeContextMenu();
};

/**
 * 全屏显示信号源
 */
const handleFullscreen = (source) => {
  if (!source) return;

  fullscreenSource.value = source;

  // 聚焦到画布以接收键盘事件
  const canvasEl = document.querySelector('.free-canvas');
  if (canvasEl) {
    canvasEl.focus();
  }

  ElMessage.success(`已进入全屏模式: ${source.name}`);
  console.log('[FreeCanvas] 全屏:', source.name);
};

/**
 * 退出全屏模式
 */
const exitFullscreen = () => {
  if (!fullscreenSource.value) return;

  const sourceName = fullscreenSource.value.name;
  fullscreenSource.value = null;

  ElMessage.info(`已退出全屏模式: ${sourceName}`);
  console.log('[FreeCanvas] 退出全屏:', sourceName);
};

/**
 * 显示属性面板
 */
const showPropertiesPanel = (source) => {
  if (propertiesDialogRef.value) {
    propertiesDialogRef.value.open(source.id);
  }
};
</script>

<style scoped lang="scss">
.free-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #1a1a2e;
  outline: none; // 移除聚焦时的默认边框

  // 网格背景(可选)
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
    background-size: 20px 20px;
    pointer-events: none;
  }

  // 拖放高亮
  &.drag-over {
    border: 2px dashed #4CC9F0;
    background: rgba(76, 201, 240, 0.05);
  }

  // 全屏模式
  &.fullscreen-mode {
    z-index: 9999;

    // 隐藏网格背景
    &::before {
      display: none;
    }
  }
}

// 全屏信号源样式
:deep(.fullscreen-source) {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  z-index: 10000 !important;
  transform: none !important;
}

// 全屏控制栏
.fullscreen-controls {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10001;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 24px;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

  .fullscreen-title {
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
  }
}
</style>
