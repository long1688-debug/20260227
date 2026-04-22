<template>
  <div class="camera-content">
    <video 
      v-if="source.properties?.deviceId"
      ref="videoRef"
      autoplay
      playsinline
      class="camera-video"
    />
    <div v-else class="placeholder">
      <el-icon :size="48"><Camera /></el-icon>
      <p>摄像机画面</p>
      <small>请选择摄像头设备</small>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { Camera } from '@element-plus/icons-vue';

const props = defineProps({
  source: Object
});

const videoRef = ref(null);

// 启动摄像头
const startCamera = async () => {
  if (!props.source.properties?.deviceId || !videoRef.value) return;
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: props.source.properties.deviceId }
    });
    videoRef.value.srcObject = stream;
  } catch (error) {
    console.error('[CameraContent] 摄像头启动失败:', error);
  }
};

onMounted(() => {
  startCamera();
});

watch(() => props.source.properties?.deviceId, () => {
  startCamera();
});
</script>

<style scoped lang="scss">
.camera-content {
  width: 100%;
  height: 100%;
  background: #000;
  
  .camera-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #a0aec0;
    
    small {
      margin-top: 8px;
      font-size: 11px;
      opacity: 0.7;
    }
  }
}
</style>
