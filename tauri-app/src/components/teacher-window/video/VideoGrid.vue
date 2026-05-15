<template>
  <div
    class="video-grid"
    :style="gridStyle"
    :class="gridClasses"
    :data-layout="currentLayout"
  >
    <!-- 自由布局模式 -->
    <FreeCanvas v-if="currentLayout === 18" />

    <!-- 标准网格布局模式 -->
    <template v-else>
      <!-- 视频格子 -->
      <div
        v-for="index in gridItemCount"
        :key="`video-item-${index}`"
        class="video-item"
        :data-index="index"
        :data-source-id="getSourceId(index)"
        :class="getItemClasses(index)"
        @dblclick="handleDoubleClick(index)"
        @dragover.prevent="onDragOver($event, index)"
        @dragenter.prevent="onDragOver($event, index)"
        @dragleave="onDragLeave($event)"
        @drop.prevent="onDrop($event, index)"
      >
        <!-- 视频源信息覆盖层 -->
        <div class="video-item-overlay">
          <div class="source-info" v-if="getVideoSource(index)">
            <span class="source-name">{{ getVideoSource(index).name }}</span>
            <span class="source-type">{{ getSourceTypeIcon(getVideoSource(index).type) }}</span>
          </div>
          <div class="source-placeholder" v-else></div>
        </div>

        <!-- 字幕显示叠加层 -->
        <div v-if="subtitleVisible && globalSubtitle" class="subtitle-overlay">
          <div class="subtitle-text">{{ globalSubtitle }}</div>
        </div>

        <!-- 拖曳覆盖层 -->
        <div class="video-item-drop-overlay" v-if="dragOverIndex === index && !isPipMain(index)"></div>

        <!-- 视频预览组件 -->
        <video-preview
          v-if="!isDocumentType(index)"
          :ref="el => setVideoPreviewRef(el, index)"
          :index="index"
          :show-controls="false"
          :source-id="getSourceId(index)"
          :video-source="getVideoSource(index)"
          :subtitle-text="currentSubtitleText"
          :auto-start="true"
          @recording-changed="handleRecordingChanged"
          @video-drop="handleVideoDrop($event, index)"
          @video-drag-over="onDragOver($event, index)"
        />

        <!-- 文档类型显示（网格布局模式） -->
        <div v-else class="document-content-in-grid">
          <!-- PPT -->
          <PptContent
            v-if="getVideoSource(index)?.type === 'ppt'"
            :source="getVideoSource(index)"
          />
          <!-- Word -->
          <WordContent
            v-else-if="getVideoSource(index)?.type === 'word'"
            :source="getVideoSource(index)"
          />
          <!-- PDF -->
          <iframe
            v-else-if="getVideoSource(index)?.type === 'pdf' && getVideoSource(index)?.url"
            :src="getVideoSource(index).url"
            class="pdf-grid-iframe"
            frameborder="0"
          ></iframe>
          <!-- 文档占位符 -->
          <div v-else class="doc-placeholder">
            <el-icon><Document /></el-icon>
            <span>{{ getVideoSource(index)?.name || '文档' }}</span>
          </div>
        </div>

        <!-- 画中画小窗口 - 只在第一个视频项显示 -->
        <div
          v-if="pipVisible && isPipMain(index)"
          class="pip-inlay"
          :class="{ 'drag-over': dragOverIndex === 2, [pipPosition]: true }"
          draggable="false"
          @dragover.prevent.stop="onDragOverPip($event)"
          @dragenter.prevent.stop="onDragOverPip($event)"
          @dragleave.prevent.stop="onDragLeavePip($event)"
          @drop.prevent.stop="handlePipDrop($event)"
        >
          <!-- 调试信息 -->
          <div class="pip-debug-info">
            <span>dragOverIndex: {{ dragOverIndex }}</span>
          </div>
          <!-- 画中画拖曳覆盖层 -->
          <div class="pip-drop-overlay" v-if="dragOverIndex === 2"></div>
          <video-preview
            :ref="handlePipRef"
            :index="2"
            :show-controls="false"
            :subtitle-text="currentSubtitleText"
            :auto-start="false"
            @recordingChanged="handleRecordingChanged"
            @video-drop="onDropPip($event)"
            @video-drag-over="onDragOverPip($event)"
          />
        </div>

        <!-- 网络质量指示器 -->
        <div
          class="network-quality-indicator"
          @click.stop="handleShowNetworkQuality(index)"
          title="点击查看网络详情"
        >
          <span :class="['quality-dot', { good: getNetworkQuality(index) === 'good' }]"></span>
          <span :class="['quality-dot', { fair: getNetworkQuality(index) === 'fair' }]"></span>
          <span :class="['quality-dot', { poor: getNetworkQuality(index) === 'poor' }]"></span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { Document } from '@element-plus/icons-vue';
import VideoPreview from '@/components/VideoPreview.vue';
import FreeCanvas from '../canvas/FreeCanvas.vue';
import PptContent from '../canvas/contents/PptContent.vue';
import WordContent from '../canvas/contents/WordContent.vue';
import { getGridStyle } from '@/constants/layout';
import { getSourceTypeIcon } from '@/constants/sourceTypes';

const props = defineProps({
  // 布局配置
  currentLayout: {
    type: Number,
    default: 1
  },
  pipVisible: {
    type: Boolean,
    default: false
  },
  pipPosition: {
    type: String,
    default: 'bottom-right'
  },
  isMaximized: {
    type: Boolean,
    default: false
  },
  maximizedIndex: {
    type: Number,
    default: -1
  },
  dragOverIndex: {
    type: Number,
    default: -1
  },
  // 数据源
  canvasSources: {
    type: Array,
    default: () => []
  },
  canvasSourceMap: {
    type: Object,
    default: () => ({})
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
  // 网络质量数据 { index: quality }
  networkQuality: {
    type: Object,
    default: () => ({})
  },
  // 自由布局的自定义格子数量
  customGridCount: {
    type: Number,
    default: null
  }
});

const emit = defineEmits([
  'double-click',
  'drag-over',
  'drag-leave',
  'drop',
  'video-drop',
  'pip-drop',
  'pip-drag-over',
  'pip-drag-leave',
  'recording-changed',
  'set-video-preview-ref',
  'set-pip-ref',
  'toggle-maximize', // 双击切换最大化
  'show-network-detail' // 显示网络详情
]);

// 计算属性
const gridItemCount = computed(() => {
  //  关键修复：自由布局（索引18）和1分屏类似，只显示1个格子
  if (props.currentLayout === 18) {
    return 1;
  }

  // 🎯 关键修复：根据布局索引映射到正确的格子数量
  // 布局索引与格子数量的映射关系（与 layout.js 保持一致）
  const layoutCellMap = {
    1: 1,   // 1分屏
    2: 2,   // 2分屏
    3: 3,   // 3分屏
    4: 4,   // 4分屏
    5: 6,   // 6分屏
    7: 9,   // 9分屏
    10: 16, // 16分屏
    11: 25, // 25分屏
    12: 36, // 36分屏
    13: 49, // 49分屏
    14: 2,  // 特殊布局1
    15: 2,  // 特殊布局2
    16: 2,  // 特殊布局3
    17: 2   // 特殊布局4
  };

  const count = layoutCellMap[props.currentLayout];
  return count || 1;
});

// 🎯 优化：缓存每个格子的视频源对象，避免重复查找
const videoSourceCache = computed(() => {
  const cache = {};
  for (let i = 1; i <= gridItemCount.value; i++) {
    const sourceId = props.canvasSourceMap?.[i];
    if (sourceId) {
      cache[i] = props.canvasSources.find(source => source?.id === sourceId) || null;
    } else {
      cache[i] = null;
    }
  }
  return cache;
});

const gridStyle = computed(() => {
  return getGridStyle(props.currentLayout, props.pipVisible, props.isMaximized, props.customGridCount);
});

const gridClasses = computed(() => {
  const classes = [];

  // 添加布局类
  if (props.currentLayout === 0 || props.currentLayout === 'free') {
    classes.push('layout-free');
  } else {
    classes.push(`layout-${props.currentLayout}`);
  }

  if (props.pipVisible) {
    classes.push(props.pipPosition);
  }
  if (props.isMaximized) {
    classes.push('maximized-mode');
  }
  return classes;
});

// 方法
const getSourceId = (index) => {
  // 使用 canvasSourceMap 来获取格子对应的源ID
  const sourceId = props.canvasSourceMap?.[index];
  // 如果没有映射，返回默认ID
  return sourceId || `source-${index}`;
};

// 🎯 优化：使用缓存替代重复查找
const getVideoSource = (index) => {
  return videoSourceCache.value[index] || null;
};

const getItemClasses = (index) => {
  const classes = {
    'drag-over': props.dragOverIndex === index,
    'has-source': !!getVideoSource(index),
    'pip-main': props.pipVisible && index === 1,
    'maximized': props.isMaximized && index === props.maximizedIndex,
    'hidden': isHiddenInLayout(index)
  };
  return classes;
};

const isHiddenInLayout = (index) => {
  // 3分屏特殊处理：第4个格子隐藏
  if (props.currentLayout === 3 && index === 4) {
    return true;
  }

  // 最大化模式下，隐藏非最大化的格子
  if (props.isMaximized && index !== props.maximizedIndex) {
    return true;
  }

  return false;
};

const isPipMain = (index) => {
  return props.pipVisible && index === 1;
};

const setVideoPreviewRef = (el, index) => {
  // 通过事件传递 ref，由父组件管理
  emit('set-video-preview-ref', { el, index });
};

// 事件处理
const handleDoubleClick = (index) => {
  // 触发双击放大切换事件
  emit('toggle-maximize', index);
};

const onDragOver = (event, index) => {
  emit('drag-over', event, index);
};

const onDragLeave = (event) => {
  emit('drag-leave', event);
};

const onDrop = (event, index) => {
  emit('drop', event, index);
};

const handleVideoDrop = (event, index) => {
  emit('video-drop', event, index);
};

const handlePipDrop = (event) => {
  emit('pip-drop', event);
};

const onDragOverPip = (event) => {
  emit('pip-drag-over', event);
};

const onDragLeavePip = (event) => {
  emit('pip-drag-leave', event);
};

const handleRecordingChanged = (data) => {
  emit('recording-changed', data);
};

// 判断是否是文档类型
const isDocumentType = (index) => {
  const source = getVideoSource(index);
  return source && ['ppt', 'word', 'pdf', 'webpage', 'mindmap'].includes(source.type);
};

// 显示网络质量详情
const handleShowNetworkQuality = (index) => {
  const detail = {
    canvas: index,
    bandwidth: props.networkQuality[index]?.bandwidth || 0,
    latency: props.networkQuality[index]?.latency || 0,
    packetLoss: props.networkQuality[index]?.packetLoss || 0,
    quality: getNetworkQuality(index)
  }
  emit('show-network-detail', detail)
}

const handlePipRef = (el) => {
  emit('set-pip-ref', el);
};

const getNetworkQuality = (index) => {
  // 从父组件传入的网络质量数据中获取
  const quality = props.networkQuality[index];
  if (!quality) return 'good';

  // 根据延迟和丢包率判断网络质量
  if (quality.latency < 100 && quality.packetLoss < 1) {
    return 'good';
  } else if (quality.latency < 300 && quality.packetLoss < 5) {
    return 'fair';
  } else {
    return 'poor';
  }
};
</script>

<style scoped lang="scss">
@import '@/styles/variables.scss';

.video-grid {
  display: grid;
  gap: 0 !important;
  width: 100%;
  height: 100%;
  position: relative;

  // 三分屏布局：左二右一
  &[data-layout="3"] {
    grid-template-columns: 1fr 2fr;
    grid-template-rows: 1fr 1fr;
    grid-template-areas:
      "left1 right"
      "left2 right";

    .video-item:nth-child(1) {
      grid-area: left1;
    }

    .video-item:nth-child(2) {
      grid-area: right;
    }

    .video-item:nth-child(3) {
      grid-area: left2;
    }
  }

  // 🎯 特殊布局1：小窗口在左上角
  &[data-layout="14"] {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;

    .video-item:nth-child(1) {
      grid-column: 1;
      grid-row: 1;
      z-index: 1;
    }

    .video-item:nth-child(2) {
      position: absolute !important;
      top: 20px;
      left: 20px;
      width: 22%;
      height: 22%;
      z-index: 10;
      border: 2px solid #00ff00;
      border-radius: $video-border-radius;
    }
  }

  //  特殊布局2：小窗口在左下角
  &[data-layout="15"] {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;

    .video-item:nth-child(1) {
      grid-column: 1;
      grid-row: 1;
      z-index: 1;
    }

    .video-item:nth-child(2) {
      position: absolute !important;
      bottom: 20px;
      left: 20px;
      width: 22%;
      height: 22%;
      z-index: 10;
      border: 2px solid #00ff00;
      border-radius: $video-border-radius;
    }
  }

  //  特殊布局3：小窗口在右上角
  &[data-layout="16"] {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;

    .video-item:nth-child(1) {
      grid-column: 1;
      grid-row: 1;
      z-index: 1;
    }

    .video-item:nth-child(2) {
      position: absolute !important;
      top: 20px;
      right: 20px;
      width: 22%;
      height: 22%;
      z-index: 10;
      border: 2px solid #00ff00;
      border-radius: $video-border-radius;
    }
  }

  //  特殊布局4：小窗口在右下角
  &[data-layout="17"] {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;

    .video-item:nth-child(1) {
      grid-column: 1;
      grid-row: 1;
      z-index: 1;
    }

    .video-item:nth-child(2) {
      position: absolute !important;
      bottom: 20px;
      right: 20px;
      width: 22%;
      height: 22%;
      z-index: 10;
      border: 2px solid #00ff00;
      border-radius: $video-border-radius;
    }
  }
}

.video-item {
  position: relative;
  background: #000;
  border-radius: $video-border-radius;
  overflow: hidden;
  transition: all 0.3s ease;
  border: 1px solid rgba(100, 100, 100, 0.5);
  box-sizing: border-box;

  &.drag-over {
    border: 2px dashed $primary-color;
  }

  &.has-source {
    background: #1a1a1a;
  }

  &.hidden {
    display: none;
  }

  &.maximized {
    grid-column: 1 / -1;
    grid-row: 1 / -1;
    z-index: 10;
  }
}

.video-item-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: $spacing-sm;
  z-index: 5;
  pointer-events: none;
}

.source-info {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  color: white;
  font-size: $font-size-sm;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

.source-placeholder {
  height: 20px;
}

.subtitle-overlay {
  position: absolute;
  bottom: $spacing-lg;
  left: 50%;
  transform: translateX(-50%);
  max-width: 80%;
  z-index: 6;
  pointer-events: none;
}

.subtitle-text {
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: $spacing-sm $spacing-md;
  border-radius: $border-radius-sm;
  font-size: $font-size-base;
  text-align: center;
}

.video-item-drop-overlay {
  position: absolute;
  inset: 0;
  background: rgba($primary-color, 0.2);
  border: 2px dashed $primary-color;
  z-index: 4;
  pointer-events: none;
}

.pip-inlay {
  position: absolute;
  width: 25%;
  height: 25%;
  z-index: 7;
  border-radius: $video-border-radius;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);

  &.bottom-right {
    bottom: $spacing-md;
    right: $spacing-md;
  }

  &.bottom-left {
    bottom: $spacing-md;
    left: $spacing-md;
  }

  &.top-right {
    top: $spacing-md;
    right: $spacing-md;
  }

  &.top-left {
    top: $spacing-md;
    left: $spacing-md;
  }

  &.drag-over {
    border: 2px dashed $primary-color;
  }
}

.pip-debug-info {
  position: absolute;
  top: 5px;
  left: 5px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  z-index: 8;
}

.pip-drop-overlay {
  position: absolute;
  inset: 0;
  background: rgba($primary-color, 0.2);
  border: 2px dashed $primary-color;
  z-index: 8;
  pointer-events: none;
}

.network-quality-indicator {
  position: absolute;
  top: $spacing-sm;
  right: $spacing-sm;
  display: flex;
  gap: 3px;
  z-index: 5;
}

.quality-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #666;

  &.good {
    background: #52c41a;
  }

  &.fair {
    background: #faad14;
  }

  &.poor {
    background: #ff4d4f;
  }
}

// 网格布局中的文档内容
.document-content-in-grid {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  background: #fff;
  overflow: hidden;

  .pdf-grid-iframe {
    width: 100%;
    height: 100%;
    border: none;
  }

  .doc-placeholder {
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
</style>
