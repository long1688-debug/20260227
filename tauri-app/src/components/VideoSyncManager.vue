<template>
  <!-- 视频同步管理组件 - 无 DOM 输出，仅处理同步逻辑 -->
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue';
import { useSimplifiedVideoSync } from '@/composables/useSimplifiedVideoSync';

const props = defineProps({
  sourceId: {
    type: String,
    default: ''
  },
  videoRef: {
    type: Object,
    default: null
  },
  index: {
    type: Number,
    default: 0
  },
  isDocumentType: {
    type: Boolean,
    default: false
  },
  isPreviewArea: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['sync-status-change']);

const { registerMaster, registerSlave, unregisterMaster, unregisterSlave, getSyncStatus } = useSimplifiedVideoSync();

const isRegistered = ref(false);
let lastRegisteredSourceId = '';
let registrationAttempts = 0;
const maxRegistrationAttempts = 10;

/**
 * 🎯 获取视频元素（支持多种引用格式）
 */
const getVideoElement = () => {
  if (!props.videoRef)
    return null;

  // 如果已经是视频元素，直接返回
  if (props.videoRef instanceof HTMLVideoElement) {
    return props.videoRef;
  }

  // 处理 ref 对象（.value 可能是视频元素或另一个 ref）
  const video = props.videoRef.value;
  if (video instanceof HTMLVideoElement) {
    return video;
  }

  // 如果 .value 本身也是一个 ref
  if (video && video.value instanceof HTMLVideoElement) {
    return video.value;
  }

  // 如果是组件引用，尝试从 $el 中查找 video 元素
  if (props.videoRef.$el) {
    const elVideo = props.videoRef.$el.querySelector('video');
    if (elVideo instanceof HTMLVideoElement) {
      return elVideo;
    }
  }

  return null;
};

/**
 * 🎯 修复：判断是否为主控视频
 * - index === 0: 专门的预览区域（如果有的话）
 * - index === 1: 第一个画布格子作为主控（这是主要的主控来源）
 * 
 * 注意：使用 Number() 确保类型一致性，避免字符串和数字比较的问题
 */
const isMasterVideo = () => {
  // 如果明确指定为预览区域，直接返回 true
  if (props.isPreviewArea) {
    return true;
  }
  // 🎯 修复：使用 Number() 转换确保类型一致
  // 将 index === 1 作为主控（第一个画布格子）
  // 这是为了解决系统中没有独立预览区域的问题
  const indexValue = Number(props.index);
  if (indexValue === 1) {
    return true;
  }
  // 备用判断：index === 0
  if (indexValue === 0) {
    return true;
  }
  return false;
};

const registerVideoToSyncSystem = () => {
  const videoElement = getVideoElement();
  if (!videoElement) {
    console.log(`[VideoSyncManager] 跳过注册: videoRef 不存在或不是有效的视频元素`);
    // 🎯 延迟重试：videoRef 可能还未挂载
    if (registrationAttempts < maxRegistrationAttempts) {
      registrationAttempts++;
      console.log(`[VideoSyncManager] 重试注册 (${registrationAttempts}/${maxRegistrationAttempts})，延迟 ${200 * registrationAttempts}ms...`);
      setTimeout(() => registerVideoToSyncSystem(), 200 * registrationAttempts);
    }
    return;
  }

  const effectiveSourceId = props.sourceId;
  if (!effectiveSourceId) {
    console.log(`[VideoSyncManager] 跳过注册: sourceId 为空`);
    return;
  }

  // 检查视频元素是否已准备好
  const hasVideoSource = videoElement.src || videoElement.srcObject;
  if (!hasVideoSource) {
    console.log(`[VideoSyncManager] 跳过注册: 视频源未就绪`);
    // 🎯 延迟重试：增加重试间隔，给视频源更多时间准备
    if (registrationAttempts < maxRegistrationAttempts) {
      registrationAttempts++;
      // 指数退避：200ms, 400ms, 800ms, 1600ms... 最多 5000ms (5秒)
      const delay = Math.min(200 * Math.pow(2, registrationAttempts - 1), 5000);
      console.log(`[VideoSyncManager] 重试注册 (${registrationAttempts}/${maxRegistrationAttempts})，延迟 ${delay}ms...`);

      // 🎯 优化：监听视频元素的 loadedmetadata 或 canplay 事件，提前触发注册
      const onVideoReady = () => {
        // 移除事件监听器
        videoElement.removeEventListener('loadedmetadata', onVideoReady);
        videoElement.removeEventListener('canplay', onVideoReady);
        videoElement.removeEventListener('loadeddata', onVideoReady);
        
        // 立即重试注册
        registrationAttempts = 0; // 重置尝试计数
        registerVideoToSyncSystem();
      };

      // 注册事件监听器，在视频就绪时立即重试
      videoElement.addEventListener('loadedmetadata', onVideoReady);
      videoElement.addEventListener('canplay', onVideoReady);
      videoElement.addEventListener('loadeddata', onVideoReady);

      // 设置超时作为后备
      setTimeout(() => {
        // 如果超时仍未触发事件，则移除监听器并重试
        videoElement.removeEventListener('loadedmetadata', onVideoReady);
        videoElement.removeEventListener('canplay', onVideoReady);
        videoElement.removeEventListener('loadeddata', onVideoReady);
        
        // 仅当注册尚未完成时才重试
        if (!isRegistered.value) {
          registerVideoToSyncSystem();
        }
      }, delay);
    }
    return;
  }

  // 检查视频是否已经加载了足够的数据
  if (videoElement.readyState < 1) {
    console.log(`[VideoSyncManager] 跳过注册: 视频未就绪 (readyState: ${videoElement.readyState})`);
    // 再次等待视频就绪
    if (registrationAttempts < maxRegistrationAttempts) {
      registrationAttempts++;
      const delay = Math.min(200 * Math.pow(2, registrationAttempts - 1), 5000);
      console.log(`[VideoSyncManager] 重试注册 (${registrationAttempts}/${maxRegistrationAttempts})，延迟 ${delay}ms...`);
      
      const waitForReady = () => {
        videoElement.removeEventListener('loadedmetadata', waitForReady);
        videoElement.removeEventListener('canplay', waitForReady);
        videoElement.removeEventListener('loadeddata', waitForReady);
        
        registrationAttempts = 0; // 重置尝试计数
        registerVideoToSyncSystem();
      };
      
      videoElement.addEventListener('loadedmetadata', waitForReady);
      videoElement.addEventListener('canplay', waitForReady);
      videoElement.addEventListener('loadeddata', waitForReady);
      
      setTimeout(() => {
        videoElement.removeEventListener('loadedmetadata', waitForReady);
        videoElement.removeEventListener('canplay', waitForReady);
        videoElement.removeEventListener('loadeddata', waitForReady);
        
        if (!isRegistered.value) {
          registerVideoToSyncSystem();
        }
      }, delay);
    }
    return;
  }

  if (isRegistered.value && lastRegisteredSourceId === effectiveSourceId) {
    console.log(`[VideoSyncManager] 已注册，跳过重复注册: ${effectiveSourceId}`);
    return;
  }

  console.log(`[VideoSyncManager] 注册视频到同步系统:`, {
    sourceId: effectiveSourceId,
    index: props.index,
    isMaster: isMasterVideo(),
    isPreviewArea: props.isPreviewArea
  });

  // 🎯 使用 isMasterVideo() 判断是否为主控
  if (isMasterVideo()) {
    registerMaster(videoElement, effectiveSourceId);
    console.log(`[VideoSyncManager] ✅ 注册为主控视频: index=${props.index}, sourceId=${effectiveSourceId}`);
  } else {
    // 🎯 关键修复：Slave 注册需要传入 canvasId（使用 index 作为 canvasId）
    registerSlave(videoElement, props.index, effectiveSourceId);
    console.log(`[VideoSyncManager] ✅ 注册为从属视频: index=${props.index}, sourceId=${effectiveSourceId}`);
  }

  isRegistered.value = true;
  lastRegisteredSourceId = effectiveSourceId;
  registrationAttempts = 0; // 重置重试计数

  emit('sync-status-change', {
    registered: true,
    sourceId: effectiveSourceId,
    isMaster: isMasterVideo()
  });
};

watch(() => props.sourceId, (newSourceId, oldSourceId) => {
  console.log(`[VideoSyncManager.watch] sourceId 变化:`, {
    index: props.index,
    oldSourceId,
    newSourceId,
    hasVideo: !!getVideoElement(),
    isDocumentType: props.isDocumentType,
    isPreviewArea: props.isPreviewArea,
    isMaster: isMasterVideo()
  });

  // sourceId 从有值变为空，注销同步
  if (!newSourceId && oldSourceId) {
    console.log(`[VideoSyncManager.watch] sourceId 清空，注销同步: ${oldSourceId}`);
    // 🎯 使用 isMasterVideo() 判断是否为主控
    if (isMasterVideo()) {
      unregisterMaster(oldSourceId);
    } else {
      // 🎯 Slave 注销需要传入 canvasId
      unregisterSlave(props.index, oldSourceId);
    }
    isRegistered.value = false;
    lastRegisteredSourceId = '';
    registrationAttempts = 0;
  }

  // sourceId 从空变为有值，注册同步
  if (newSourceId && !oldSourceId && !props.isDocumentType) {
    console.log(`[VideoSyncManager.watch] sourceId 新增，注册同步: ${newSourceId}`);
    setTimeout(() => {
      registerVideoToSyncSystem();
    }, 150); // 稍长一点的延迟，确保视频元素就绪
  }

  // sourceId 变更，先注销旧的再注册新的
  if (newSourceId && oldSourceId && newSourceId !== oldSourceId) {
    console.log(`[VideoSyncManager.watch] sourceId 变更: ${oldSourceId} -> ${newSourceId}`);
    // 🎯 使用 isMasterVideo() 判断是否为主控
    if (isMasterVideo()) {
      unregisterMaster(oldSourceId);
    } else {
      // 🎯 Slave 注销需要传入 canvasId
      unregisterSlave(props.index, oldSourceId);
    }
    // 🎯 额外清理：确保该 canvasId 不在其他 sourceId 组中
    unregisterSlave(props.index, newSourceId);
    isRegistered.value = false;
    lastRegisteredSourceId = '';
    registrationAttempts = 0;

    setTimeout(() => {
      registerVideoToSyncSystem();
    }, 150);
  }
});

watch(() => props.videoRef, (newVideoRef, oldVideoRef) => {
  if (newVideoRef && props.sourceId && !props.isDocumentType) {
    setTimeout(() => {
      registerVideoToSyncSystem();
    }, 100);
  }
});

// 添加对视频元素加载状态的监听
watch(() => {
  if (props.videoRef && props.videoRef.value) {
    const videoElement = getVideoElement();
    if (videoElement) {
      return {
        readyState: videoElement.readyState,
        networkState: videoElement.networkState,
        src: videoElement.src,
        srcObject: videoElement.srcObject
      };
    }
  }
}, (newState, oldState) => {
  console.log(`[VideoSyncManager.watch] 视频状态变化:`, {
    newState,
    oldState,
    sourceId: props.sourceId,
    index: props.index
  });

  // 当视频元素准备好后，注册到同步系统
  if (newState && newState.readyState >= 1 && props.sourceId) {
    setTimeout(() => {
      registerVideoToSyncSystem();
    }, 100);
  }
}, { deep: true });

onUnmounted(() => {
  if (lastRegisteredSourceId) {
    console.log(`[VideoSyncManager.onUnmounted] 组件卸载，注销同步: ${lastRegisteredSourceId}`);
    // 🎯 使用 isMasterVideo() 判断是否为主控
    if (isMasterVideo()) {
      unregisterMaster(lastRegisteredSourceId);
    } else {
      // 🎯 Slave 注销需要传入 canvasId
      unregisterSlave(props.index, lastRegisteredSourceId);
    }
  }
  isRegistered.value = false;
  lastRegisteredSourceId = '';
  registrationAttempts = 0;
});

defineExpose({
  registerVideoToSyncSystem,
  isRegistered,
  getSyncStatus
});
</script>

<style scoped lang="scss">
/* 无样式 - 纯逻辑组件 */
</style>
