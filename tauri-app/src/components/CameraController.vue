<template>
  <!-- 摄像头控制组件 - 无 DOM 输出，仅处理摄像头逻辑 -->
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  videoRef: {
    type: Object,
    default: null
  },
  deviceId: {
    type: String,
    default: ''
  },
  constraints: {
    type: Object,
    default: () => ({
      video: true  // 使用摄像头原始分辨率
    })
  }
});

const emit = defineEmits(['camera-start', 'camera-error', 'camera-stop', 'stream-ready']);

const isStarting = ref(false);
const stream = ref(null);
const pendingStream = ref(null); // 保存待绑定的流
const pendingStart = ref(false); // 标记是否有待处理的启动请求

// 获取实际的视频元素
const getVideoElement = () => {
  if (!props.videoRef) return null;
  
  // 如果是 Ref 对象，获取其 value
  if (props.videoRef.value !== undefined) {
    return props.videoRef.value;
  }
  
  // 否则直接返回（可能已经是元素）
  return props.videoRef;
};

// 绑定流到视频元素
const bindStreamToVideo = () => {
  if (!stream.value) return;
  
  const videoEl = getVideoElement();
  
  if (!videoEl) {
    console.warn('[CameraController] 视频元素为空，无法绑定流');
    return;
  }
  
  console.log('[CameraController] 绑定流到视频元素');
  
  // 设置视频源
  videoEl.srcObject = stream.value;
  
  // 设置元数据加载完成后的回调
  videoEl.onloadedmetadata = () => {
    console.log('[CameraController] 摄像头元数据加载完成');
    videoEl.play().then(() => {
      console.log('[CameraController] 摄像头播放成功');
      isStarting.value = false;
      pendingStart.value = false;
      emit('stream-ready', { stream: stream.value });
    }).catch(err => {
      console.warn('[CameraController] 摄像头自动播放失败:', err);
      isStarting.value = false;
      pendingStart.value = false;
    });
  };
  
  // 设置播放事件处理
  videoEl.onplay = () => {
    console.log('[CameraController] 摄像头开始播放');
  };
  
  // 设置暂停事件处理
  videoEl.onpause = () => {
    console.log('[CameraController] 摄像头暂停');
  };
  
  // 设置错误事件处理
  videoEl.onerror = (event) => {
    console.error('[CameraController] 摄像头播放错误:', event);
    isStarting.value = false;
    pendingStart.value = false;
    emit('camera-error', { error: event, message: '摄像头播放错误' });
  };
};

// 监听 videoRef 变化，如果有待处理的流，立即绑定
watch(() => {
  // 监听实际的视频元素变化（处理 Ref 对象或直接元素）
  return getVideoElement();
}, (newVideoEl) => {
  if (newVideoEl && stream.value && pendingStart.value) {
    console.log('[CameraController] videoRef 已就绪，绑定待处理的流');
    bindStreamToVideo();
  }
});

const startUSBCamera = async () => {
  if (isStarting.value) {
    console.log('[CameraController] 摄像头正在启动中...');
    return;
  }
  
  isStarting.value = true;
  pendingStart.value = true;
  emit('camera-start');
  
  try {
    const videoConstraints = { ...props.constraints.video };
    if (props.deviceId) {
      videoConstraints.deviceId = props.deviceId;
    }
    
    console.log('[CameraController] 开始启动摄像头:', {
      deviceId: props.deviceId,
      constraints: videoConstraints
    });
    
    // 请求摄像头权限
    stream.value = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: false
    });
    
    console.log('[CameraController] 摄像头流获取成功');
    
    // 如果视频元素已就绪，直接绑定
    const videoEl = getVideoElement();
    if (videoEl) {
      bindStreamToVideo();
    } else {
      // 视频元素尚未就绪，等待后续绑定
      console.log('[CameraController] 视频元素尚未就绪，等待绑定...');
    }
    
  } catch (error) {
    console.error('[CameraController] 启动摄像头失败:', error);
    isStarting.value = false;
    pendingStart.value = false;
    
    let errorMessage = '无法访问摄像头';
    if (error.name === 'NotAllowedError') {
      errorMessage = '摄像头权限被拒绝，请在浏览器设置中开启权限';
    } else if (error.name === 'NotFoundError') {
      errorMessage = '未检测到摄像头设备';
    } else if (error.name === 'NotReadableError') {
      errorMessage = '摄像头被其他应用占用，请关闭其他应用后重试';
    }
    
    emit('camera-error', { error, message: errorMessage });
  }
};
const stopUSBCamera = () => {
  if (stream.value) {
    stream.value.getTracks().forEach(track => track.stop());
    stream.value = null;
    console.log('[CameraController] 摄像头已停止');
  }
  const videoEl = getVideoElement();
  if (videoEl) {
    videoEl.srcObject = null;
  }
  isStarting.value = false;
  pendingStart.value = false;
  emit('camera-stop');
};
const restartCamera = async () => {
 stopUSBCamera();
 await new Promise(resolve => setTimeout(resolve, 500));
 await startUSBCamera();
};
defineExpose({
 startUSBCamera,
 stopUSBCamera,
 restartCamera,
 isStarting,
 stream
});
</script>

<style scoped lang="scss">
/* 无样式 - 纯逻辑组件 */
</style>
