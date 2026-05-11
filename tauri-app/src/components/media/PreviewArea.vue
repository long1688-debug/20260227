<template>
  <div class="preview-area">
    <!-- 视频预览容器 -->
    <div v-if="selectedSource" class="preview-video-container">
      <div class="video-wrapper">
        <!-- 视频播放器 -->
        <video
          v-if="!isDocumentType"
          ref="videoRef"
          :src="selectedSource.url || selectedSource.file"
          :poster="selectedSource.poster"
          controls
          playsinline
          class="preview-video"
          @loadedmetadata="onLoadedMetadata"
          @timeupdate="onTimeUpdate"
          @play="onPlay"
          @pause="onPause"
          @ended="onEnded"
        />

        <!-- 文档预览 -->
        <img
          v-else
          :src="selectedSource.url || selectedSource.poster"
          alt="Document Preview"
          class="preview-video document-image"
        />
      </div>

      <!-- 播放控制 -->
      <div class="preview-controls">
        <el-button
          :icon="selectedSource.isPlaying ? 'VideoPause' : 'VideoPlay'"
          circle
          size="small"
          @click="togglePlayPause"
        />

        <div class="progress-container">
          <el-slider
            v-model="progressValue"
            :max="selectedSource.duration === Infinity ? 100 : selectedSource.duration"
            :step="0.1"
            @change="onSeek"
            @input="onProgressInput"
            style="flex: 1"
          />
        </div>

        <span class="time-display">
          {{ formatTime(selectedSource.currentTime) }} /
          {{ selectedSource.duration === Infinity ? 'Live' : formatTime(selectedSource.duration) }}
        </span>
      </div>

      <!-- 🎯 视频同步管理器（预览区域作为主控） -->
      <VideoSyncManager
        ref="videoSyncManagerRef"
        :source-id="selectedSource?.id"
        :video-ref="videoRef"
        :index="0"
        :is-document-type="isDocumentType"
        :is-preview-area="true"
        @sync-status-change="handleSyncStatusChange"
      />
    </div>

    <!-- 空状态占位符 -->
    <div v-else class="placeholder-container">
      <div class="placeholder">
        <el-icon :size="48"><VideoPlay /></el-icon>
        <p>请选择或添加媒体源</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { VideoCamera, FolderOpened, VideoPlay } from '@element-plus/icons-vue';
import { useMediaStore } from '@/stores/mediaStore';
import { useMediaSource } from '@/composables/useMediaSource';
import { useLayoutStates } from '@/composables/useLayoutStates';
import { audioMixer } from '@/utils/audioMixer';
import { ElMessage } from 'element-plus';
import { useSourceDrag } from '@/composables/useSourceDrag';
import VideoSyncManager from '@/components/VideoSyncManager.vue';

const mediaStore = useMediaStore();
const { addCameraSource, addLocalVideoSource, togglePlayPause: storeTogglePlayPause } = useMediaSource();
const { saveToStorage } = useLayoutStates();

// State
const sources = computed(() => mediaStore.sources);
const selectedSourceId = ref('');
const videoRef = ref(null);
const videoSyncManagerRef = ref(null);
const progressValue = ref(0);
const isDragging = ref(false);

// 🎯 判断是否为文档类型
const isDocumentType = computed(() => {
  if (!selectedSource.value) return false;
  return ['ppt', 'word', 'pdf', 'excel', 'txt', 'image'].includes(selectedSource.value.type);
});

// 初始化拖拽 composable
const {
  onMouseDown: sourceOnMouseDown,
  onTouchStart: sourceOnTouchStart,
  onTouchMove,
  onTouchEnd,
  cleanupDragState,
  isDraggingSource
} = useSourceDrag({
  // 由于 PreviewArea 不直接管理 canvasSourceMap，我们提供空对象
  canvasSourceMap: {},
  videoPreviews: [],
  unregisterSlaveVideo: () => {},
  saveLayoutMap: saveToStorage,
  getPipVideoPreview: () => null,
  isPipVisible: () => false
});

// Computed
const selectedSource = computed(() => {
  return selectedSourceId.value ? sources.value.get(selectedSourceId.value) : null;
});

// Watch
watch(selectedSourceId, (newId) => {
  if (newId && videoRef.value) {
    const source = sources.value.get(newId);
    if (source) {
      setupVideoElement(source);
    }
  }
});

// 🎯 监听源的音频属性变化，确保视频元素的音频状态正确更新
watch(selectedSource, (newSource) => {
  if (newSource && videoRef.value) {
    videoRef.value.muted = !newSource.audioEnabled || newSource.muted;
    videoRef.value.volume = (newSource.volume || 100) / 100;
    console.log(`[PreviewArea] 音频状态已更新: muted=${videoRef.value.muted}, volume=${videoRef.value.volume}`);
  }
}, { deep: true });

// Methods
const setupVideoElement = (source) => {
  const video = videoRef.value;
  if (!video || !source) return;

  // 设置视频源
    if (source.type === 'camera' && source.stream) {
      video.srcObject = source.stream;
    } else if (source.objectUrl) {
      video.src = source.objectUrl;

      // 注册视频元素到音频混音器（传入音频状态）
      audioMixer.registerVideoElement(source.id, video, source.audioEnabled !== false, source.volume || 100);
    }

  // 🎯 设置音频状态（预览区域专用）
  video.muted = !source.audioEnabled || source.muted;
  video.volume = (source.volume || 100) / 100;
  video.autoplay = true;
  video.playsinline = true;

  console.log(`[PreviewArea.setupVideoElement] 设置音频状态: muted=${video.muted}, volume=${video.volume}, audioEnabled=${source.audioEnabled}`);

  // 同步播放状态
  if (source.isPlaying) {
    video.play().catch(e => console.warn('[PreviewArea] 自动播放被阻止:', e));
  } else {
    video.pause();
  }
};

const onVideoLoaded = () => {
  console.log('[PreviewArea] 视频元数据加载完成');
  // 更新视频的 duration
  if (videoRef.value && selectedSource.value) {
    const duration = videoRef.value.duration;
    if (duration && isFinite(duration)) {
      mediaStore.updateSource(selectedSource.value.id, { duration });
      console.log('[PreviewArea] 视频时长:', duration);
    }
  }
};

// Event handlers
const onLoadedMetadata = () => {
  if (videoRef.value) {
    // 更新源的持续时间和当前时间
    if (selectedSource.value) {
      selectedSource.value.duration = videoRef.value.duration;
      selectedSource.value.currentTime = videoRef.value.currentTime;
    }
    // 启用进度条
    progressValue.value = 0;
  }
};

const onTimeUpdate = () => {
  if (videoRef.value && !isDragging.value) {
    // 更新视频当前时间
    selectedSource.value.currentTime = videoRef.value.currentTime;
    // 更新进度条位置
    if (videoRef.value.duration) {
      progressValue.value = videoRef.value.currentTime;
    }
  }
};

const onPlay = () => {
  if (selectedSource.value) {
    selectedSource.value.isPlaying = true;
  }
};

const onPause = () => {
  if (selectedSource.value) {
    selectedSource.value.isPlaying = false;
  }
};

const onEnded = () => {
  if (selectedSource.value) {
    selectedSource.value.isPlaying = false;
    selectedSource.value.currentTime = 0;
    progressValue.value = 0;
  }
};

const togglePlayPause = () => {
  if (selectedSource.value && videoRef.value) {
    if (videoRef.value.paused) {
      videoRef.value.play();
    } else {
      videoRef.value.pause();
    }
  }
};

// 进度条控制
const onSeek = (value) => {
  isDragging.value = false;
  if (videoRef.value) {
    // 设置视频播放时间
    videoRef.value.currentTime = value;
    if (selectedSource.value) {
      selectedSource.value.currentTime = value;
    }
  }
};

const onProgressInput = (value) => {
  isDragging.value = true;
  if (videoRef.value) {
    // 实时更新视频播放时间（用于拖动时的即时预览）
    videoRef.value.currentTime = value;
    if (selectedSource.value) {
      selectedSource.value.currentTime = value;
    }
  }
};

// 🎯 处理同步状态变化
const handleSyncStatusChange = (status) => {
  console.log('[PreviewArea] 同步状态变化:', status);
};

const formatTime = (seconds) => {
  if (seconds === Infinity) return 'Live';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

onMounted(() => {
  // 初始化音频混音器
  audioMixer.init().catch(err => {
    console.error('[PreviewArea] 音频混音器初始化失败:', err);
  });
});

onUnmounted(() => {
  // 清理拖拽状态
  if (cleanupDragState) {
    cleanupDragState();
  }
});
</script>

<style scoped>
.preview-area {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0; /* 🎯 允许在父容器中收缩 */
  gap: 12px;
  padding: 16px;
  background-color: #1a1a1a;
  border-radius: 8px;
  box-sizing: border-box;
}

.preview-container {
  flex: 1;
  flex-grow: 1; /* 🎯 明确允许增长 */
  flex-shrink: 1; /* 🎯 允许收缩 */
  min-height: 0; /* 🎯 关键：允许Flex子元素正常收缩 */
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-video-container {
  flex: 1;
  flex-grow: 1; /* 🎯 占据剩余空间 */
  flex-shrink: 1; /* 🎯 允许收缩 */
  min-height: 0; /* 🎯 防止溢出 */
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

.video-wrapper {
  flex: 1;
  flex-grow: 1;
  flex-shrink: 1;
  min-height: 0; /* 🎯 关键修复点 */
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.preview-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  cursor: grab;
  border-radius: 4px;
  
  /* 触摸优化：禁用默认触摸行为 */
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.preview-video:active {
  cursor: grabbing;
}

.document-image {
  /* 继承 .preview-video 的样式 */
}

.placeholder-container {
  flex: 1;
  flex-grow: 1;
  flex-shrink: 1;
  min-height: 0; /* 🎯 允许空状态容器收缩 */
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder {
  text-align: center;
  color: #666;
}

.placeholder p {
  margin-top: 16px;
}

.preview-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  max-width: 600px;
  margin-top: 16px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  flex-shrink: 0; /* 🎯 防止控制栏被压缩（保持不变） */
}

.progress-container {
  flex: 1;
  flex-grow: 1;
  flex-shrink: 1;
  min-width: 100px; /* 🎯 最小宽度保证可用性 */
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-container :deep(.el-slider) {
  margin: 0;
}

.time-display {
  font-family: monospace;
  font-size: 14px;
  color: #ddd;
  min-width: 80px;
  text-align: right;
  flex-shrink: 0; /* 🎯 防止时间显示被压缩 */
}
</style>
