<template>
  <!-- 🎯 视频同步管理器 - 无UI的纯逻辑组件 -->
  <div style="display: none;"></div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useSimplifiedVideoSync } from '@/composables/useSimplifiedVideoSync';

const props = defineProps({
  // 信号源ID
  sourceId: {
    type: String,
    required: true
  },
  // 视频元素引用
  videoRef: {
    type: Object,
    required: true
  },
  // 画布索引（从属视频使用）
  index: {
    type: [Number, String],
    default: 0
  },
  // 是否为文档类型
  isDocumentType: {
    type: Boolean,
    default: false
  },
  // 是否为预览区域（主控）
  isPreviewArea: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['sync-status-change']);

// 初始化视频同步 composable
const {
  registerMaster,
  registerSlave,
  unregisterMaster,
  unregisterSlave,
  selectAudioOutput,
  toggleCanvasAudio,
  getSyncStatus
} = useSimplifiedVideoSync();

// 标记是否已注册
const isRegistered = ref(false);

/**
 * 注册视频到同步管理器
 */
const registerVideo = () => {
  if (!props.videoRef?.value || isRegistered.value) return;

  const videoElement = props.videoRef.value;

  console.log(`[VideoSyncManager] 注册视频: sourceId=${props.sourceId}, isPreviewArea=${props.isPreviewArea}, index=${props.index}`);

  if (props.isPreviewArea) {
    // 预览区域作为主控（Master）
    registerMaster(videoElement, props.sourceId);
    console.log(`[VideoSyncManager] ✅ 已注册为主控: ${props.sourceId}`);
  } else {
    // 画布区域作为从属（Slave）
    registerSlave(videoElement, props.index, props.sourceId);
    console.log(`[VideoSyncManager] ✅ 已注册为从属: canvasIndex=${props.index}, sourceId=${props.sourceId}`);
  }

  isRegistered.value = true;

  // 发出同步状态变化事件
  emit('sync-status-change', {
    sourceId: props.sourceId,
    isPreviewArea: props.isPreviewArea,
    status: 'registered'
  });
};

/**
 * 注销视频
 */
const unregisterVideo = () => {
  if (!isRegistered.value) return;

  console.log(`[VideoSyncManager] 注销视频: sourceId=${props.sourceId}, isPreviewArea=${props.isPreviewArea}`);

  if (props.isPreviewArea) {
    unregisterMaster(props.sourceId);
    console.log(`[VideoSyncManager] ✅ 已注销主控: ${props.sourceId}`);
  } else {
    unregisterSlave(props.index, props.sourceId);
    console.log(`[VideoSyncManager] ✅ 已注销从属: canvasIndex=${props.index}, sourceId=${props.sourceId}`);
  }

  isRegistered.value = false;

  // 发出同步状态变化事件
  emit('sync-status-change', {
    sourceId: props.sourceId,
    isPreviewArea: props.isPreviewArea,
    status: 'unregistered'
  });
};

/**
 * 选择此视频作为音频输出源
 */
const selectAsAudioOutput = () => {
  const targetId = props.isPreviewArea ? props.sourceId : `canvas-${props.index}`;
  selectAudioOutput(targetId);
  console.log(`[VideoSyncManager] 选择音频输出: ${targetId}`);
};

/**
 * 切换画布音频状态（仅对从属视频有效）
 */
const toggleAudio = () => {
  if (!props.isPreviewArea) {
    toggleCanvasAudio(`canvas-${props.index}`);
    console.log(`[VideoSyncManager] 切换画布音频: canvas-${props.index}`);
  }
};

// 监听 videoRef 变化，自动注册/注销
watch(
  () => props.videoRef?.value,
  (newVideo, oldVideo) => {
    if (newVideo && !oldVideo) {
      // 视频元素挂载，注册
      registerVideo();
    } else if (!newVideo && oldVideo) {
      // 视频元素卸载，注销
      unregisterVideo();
    }
  },
  { immediate: true }
);

// 监听 sourceId 变化，重新注册
watch(
  () => props.sourceId,
  (newSourceId, oldSourceId) => {
    if (newSourceId !== oldSourceId && isRegistered.value) {
      // 先注销旧的
      unregisterVideo();
      // 再注册新的
      setTimeout(() => registerVideo(), 0);
    }
  }
);

// 生命周期钩子
onMounted(() => {
  registerVideo();
});

onUnmounted(() => {
  unregisterVideo();
});

// 暴露方法给父组件
defineExpose({
  selectAsAudioOutput,
  toggleAudio,
  getSyncStatus: () => getSyncStatus()
});
</script>

<script>
export default {
  name: 'VideoSyncManager'
};
</script>
