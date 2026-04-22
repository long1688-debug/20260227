<template>
  <div class="document-scanner-preview">
    <!-- 图像容器 -->
    <div class="image-container" @click="captureImage">
      <img
        v-if="currentImage"
        :src="currentImage"
        class="scanner-image"
        alt="高拍仪画面"
      />

      <div v-else class="placeholder">
        <el-icon><Document /></el-icon>
        <span>点击拍摄或等待自动扫描</span>
      </div>

      <!-- 状态指示器 -->
      <div v-if="status === 'scanning'" class="scanning-overlay">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>扫描中...</span>
      </div>
    </div>

    <!-- 控制栏 -->
    <div class="control-bar">
      <div class="scan-controls">
        <el-button
          size="small"
          type="primary"
          :icon="Camera"
          @click="captureImage"
          :loading="status === 'scanning'"
        >
          拍摄
        </el-button>

        <el-button
          size="small"
          :type="autoScan ? 'success' : ''"
          @click="toggleAutoScan"
        >
          {{ autoScan ? '停止连拍' : '连续扫描' }}
        </el-button>

        <el-button
          size="small"
          :icon="Refresh"
          @click="refreshDevice"
        >
          刷新
        </el-button>
      </div>

      <div class="enhance-controls" v-if="showEnhanceControls">
        <el-checkbox v-model="autoEnhance" size="small">自动增强</el-checkbox>
        <el-checkbox v-model="autoCrop" size="small">自动裁剪</el-checkbox>
      </div>
    </div>

    <!-- 信息栏 -->
    <div class="info-bar" v-if="showInfo">
      <span class="device-name">{{ deviceName }}</span>
      <span class="scan-mode">{{ scanModeText }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Document, Loading, Camera, Refresh } from '@element-plus/icons-vue';

const props = defineProps({
  sourceId: {
    type: String,
    required: true
  },
  deviceId: {
    type: String,
    default: ''
  },
  scanMode: {
    type: String,
    default: 'single' // single, continuous, auto-focus
  },
  autoEnhance: {
    type: Boolean,
    default: false
  },
  autoCrop: {
    type: Boolean,
    default: false
  },
  deviceName: {
    type: String,
    default: '高拍仪'
  },
  showInfo: {
    type: Boolean,
    default: true
  },
  showEnhanceControls: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['image-captured', 'status-change']);

const videoRef = ref(null);
const currentImage = ref(null);
const status = ref('idle'); // idle, scanning, ready
const autoScan = ref(false);
let autoScanInterval = null;

// 扫描模式文本
const scanModeText = computed(() => {
  const modes = {
    single: '单页',
    continuous: '连续',
    'auto-focus': '自动对焦'
  };
  return modes[props.scanMode] || '单页';
});

// 初始化高拍仪
const initScanner = async () => {
  if (!props.deviceId) {
    status.value = 'error';
    return;
  }

  status.value = 'scanning';

  try {
    // TODO: 调用Tauri后端API初始化高拍仪
    // await invoke('init_document_scanner', {
    //   device_id: props.deviceId,
    //   scan_mode: props.scanMode,
    //   auto_enhance: props.autoEnhance,
    //   auto_crop: props.autoCrop
    // });

    // 临时使用摄像头模拟
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: props.deviceId ? { exact: props.deviceId } : undefined
      }
    });

    if (videoRef.value) {
      videoRef.value.srcObject = stream;
      status.value = 'ready';
      emit('status-change', 'ready');
    }
  } catch (error) {
    console.error('高拍仪初始化失败:', error);
    status.value = 'error';
  }
};

// 拍摄照片
const captureImage = async () => {
  if (status.value === 'scanning') return;

  status.value = 'scanning';

  try {
    // TODO: 调用Tauri后端API拍摄照片
    // const imageData = await invoke('scanner_capture', {
    //   device_id: props.deviceId,
    //   enhance: props.autoEnhance,
    //   crop: props.autoCrop
    // });

    // 临时模拟：从视频流捕获帧
    if (videoRef.value && videoRef.value.srcObject) {
      const canvas = document.createElement('canvas');
      const video = document.createElement('video');
      video.srcObject = videoRef.value.srcObject;
      
      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
      });
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      currentImage.value = canvas.toDataURL('image/jpeg', 0.9);
      emit('image-captured', currentImage.value);
    }

    status.value = 'ready';
  } catch (error) {
    console.error('拍摄失败:', error);
    status.value = 'error';
  }
};

// 切换自动扫描
const toggleAutoScan = () => {
  autoScan.value = !autoScan.value;

  if (autoScan.value) {
    // 开始连续扫描（每2秒拍摄一次）
    autoScanInterval = setInterval(() => {
      captureImage();
    }, 2000);
  } else {
    // 停止连续扫描
    if (autoScanInterval) {
      clearInterval(autoScanInterval);
      autoScanInterval = null;
    }
  }
};

// 刷新设备
const refreshDevice = () => {
  cleanup();
  initScanner();
};

// 清理资源
const cleanup = () => {
  if (autoScanInterval) {
    clearInterval(autoScanInterval);
    autoScanInterval = null;
  }

  if (videoRef.value && videoRef.value.srcObject) {
    const tracks = videoRef.value.srcObject.getTracks();
    tracks.forEach(track => track.stop());
    videoRef.value.srcObject = null;
  }
};

onMounted(() => {
  initScanner();
});

onUnmounted(() => {
  cleanup();
});

// 暴露方法
defineExpose({
  refresh: refreshDevice,
  capture: captureImage,
  getStatus: () => status.value
});
</script>

<style scoped lang="scss">
.document-scanner-preview {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;

  .image-container {
    flex: 1;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    background: white;

    .scanner-image {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    .placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      color: #909399;
      font-size: 14px;

      .el-icon {
        font-size: 64px;
      }
    }

    .scanning-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: white;
      font-size: 14px;

      .el-icon {
        font-size: 48px;
      }
    }
  }

  .control-bar {
    padding: 12px;
    background: white;
    border-top: 1px solid #e4e7ed;
    display: flex;
    flex-direction: column;
    gap: 8px;

    .scan-controls {
      display: flex;
      gap: 8px;
      justify-content: center;
    }

    .enhance-controls {
      display: flex;
      gap: 16px;
      justify-content: center;
    }
  }

  .info-bar {
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    font-size: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;

    .device-name {
      font-weight: 500;
    }

    .scan-mode {
      padding: 2px 6px;
      background: rgba(103, 194, 58, 0.3);
      border-radius: 3px;
      font-size: 11px;
    }
  }
}
</style>
