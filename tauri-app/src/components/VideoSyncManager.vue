<template>
  <!-- 🎯 视频同步管理器 - 无UI的纯逻辑组件 -->
  <div style="display: none;"></div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
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

// 🎯 标记视频是否已加载完成（loadedmetadata事件触发）
const isVideoReady = ref(false);

// 🎯 视频加载完成处理函数
const handleVideoLoaded = () => {
  console.log(`[VideoSyncManager] 视频加载完成: sourceId=${props.sourceId}`);
  isVideoReady.value = true;
  // 尝试注册
  tryRegisterVideo();
};

/**
 * 🎯 尝试注册视频（需要视频元素和sourceId都就绪）
 */
const tryRegisterVideo = () => {
  // 检查条件：视频元素存在、sourceId有效、视频已加载、尚未注册
  if (!props.videoRef?.value || !props.sourceId || !isVideoReady.value || isRegistered.value) {
    return;
  }

  const videoElement = props.videoRef.value;

  // 🎯 额外检查视频元素是否在DOM中
  if (!document.contains(videoElement)) {
    console.warn(`[VideoSyncManager] ⚠️ 视频元素不在DOM中，延迟注册: ${props.sourceId}`);
    return;
  }

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
 * 注册视频到同步管理器
 */
const registerVideo = () => {
  // 🎯 重置视频就绪状态
  isVideoReady.value = false;
  
  const videoElement = props.videoRef?.value;
  
  // 如果视频已经有loadedmetadata事件，立即标记就绪
  if (videoElement && videoElement.readyState >= 2) {
    isVideoReady.value = true;
  }
  
  // 🎯 设置视频加载事件监听
  if (videoElement) {
    videoElement.addEventListener('loadedmetadata', handleVideoLoaded);
    videoElement.addEventListener('loadeddata', handleVideoLoaded);
  }
  
  // 尝试注册
  tryRegisterVideo();
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

  // 🎯 移除视频加载事件监听
  const videoElement = props.videoRef?.value;
  if (videoElement) {
    videoElement.removeEventListener('loadedmetadata', handleVideoLoaded);
    videoElement.removeEventListener('loadeddata', handleVideoLoaded);
  }

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

// 🎯 监听 videoRef 变化，自动注册/注销
watch(
  () => props.videoRef?.value,
  (newVideo, oldVideo) => {
    if (newVideo && !oldVideo) {
      // 视频元素挂载，等待下一帧再注册
      nextTick(() => {
        registerVideo();
      });
    } else if (!newVideo && oldVideo) {
      // 视频元素卸载，注销
      unregisterVideo();
    }
  },
  { immediate: false } // 🎯 改为false，避免初始时重复调用
);

// 🎯 监听 sourceId 变化，重新注册
watch(
  () => props.sourceId,
  (newSourceId, oldSourceId) => {
    if (!newSourceId) {
      // sourceId为空，注销
      unregisterVideo();
      return;
    }
    
    if (newSourceId !== oldSourceId) {
      // 先注销旧的
      unregisterVideo();
      // 再注册新的（延迟一帧）
      nextTick(() => {
        registerVideo();
      });
    }
  }
);

// 生命周期钩子
onMounted(() => {
  // 🎯 等待DOM渲染完成后再注册
  nextTick(() => {
    registerVideo();
  });
});

onUnmounted(() => {
  unregisterVideo();
});

// 暴露方法给父组件
defineExpose({
  selectAsAudioOutput,
  toggleAudio,
  getSyncStatus: () => getSyncStatus(),
  // 🎯 暴露注册方法供父组件手动触发
  registerVideo,
  unregisterVideo
});
</script>

<script>
export default {
  name: 'VideoSyncManager'
};
</script>
