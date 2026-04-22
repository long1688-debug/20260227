<template>
  <div class="capture-card-preview">
    <!-- 视频容器 -->
    <div class="video-container">
      <video
        ref="videoRef"
        class="video-element"
        autoplay
        playsinline
        muted
      ></video>

      <!-- 状态指示器 -->
      <div v-if="status === 'connecting'" class="status-indicator connecting">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>连接中...</span>
      </div>

      <div v-else-if="status === 'error'" class="status-indicator error">
        <el-icon><WarningFilled /></el-icon>
        <span>{{ errorMessage }}</span>
      </div>

      <div v-else-if="status === 'no-signal'" class="status-indicator no-signal">
        <el-icon><VideoCamera /></el-icon>
        <span>无信号</span>
      </div>
    </div>

    <!-- 信息栏 -->
    <div class="info-bar" v-if="showInfo">
      <div class="device-info">
        <span class="device-name">{{ deviceName }}</span>
        <span class="interface-type">{{ interfaceType }}</span>
      </div>
      <div class="resolution-info" v-if="resolution">
        {{ resolution }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { Loading, WarningFilled, VideoCamera } from '@element-plus/icons-vue';

const props = defineProps({
  sourceId: {
    type: String,
    required: true
  },
  deviceId: {
    type: String,
    default: ''
  },
  interfaceType: {
    type: String,
    default: 'HDMI' // HDMI, SDI, DVI, VGA, USB
  },
  resolution: {
    type: String,
    default: 'auto' // 1080p, 720p, 4K, auto
  },
  deviceName: {
    type: String,
    default: '采集卡'
  },
  showInfo: {
    type: Boolean,
    default: true
  }
});

const videoRef = ref(null);
const status = ref('idle'); // idle, connecting, connected, error, no-signal
const errorMessage = ref('');

// 初始化采集卡
const initCaptureCard = async () => {
  if (!props.deviceId) {
    status.value = 'error';
    errorMessage.value = '未选择设备';
    return;
  }

  status.value = 'connecting';

  try {
    // TODO: 调用Tauri后端API获取采集卡视频流
    // const stream = await invoke('get_capture_card_stream', {
    //   device_id: props.deviceId,
    //   interface_type: props.interfaceType,
    //   resolution: props.resolution
    // });

    // 临时使用摄像头作为演示
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: props.deviceId ? { exact: props.deviceId } : undefined,
        width: props.resolution === '4K' ? 3840 : props.resolution === '1080p' ? 1920 : 1280,
        height: props.resolution === '4K' ? 2160 : props.resolution === '1080p' ? 1080 : 720
      }
    });

    if (videoRef.value) {
      videoRef.value.srcObject = stream;
      status.value = 'connected';
    }
  } catch (error) {
    console.error('采集卡初始化失败:', error);
    status.value = 'error';
    errorMessage.value = error.message || '设备连接失败';
  }
};

// 清理资源
const cleanup = () => {
  if (videoRef.value && videoRef.value.srcObject) {
    const tracks = videoRef.value.srcObject.getTracks();
    tracks.forEach(track => track.stop());
    videoRef.value.srcObject = null;
  }
};

onMounted(() => {
  initCaptureCard();
});

onUnmounted(() => {
  cleanup();
});

watch(() => props.deviceId, () => {
  cleanup();
  initCaptureCard();
});

// 暴露方法供父组件调用
defineExpose({
  refresh: initCaptureCard,
  getStatus: () => status.value
});
</script>

<style scoped lang="scss">
.capture-card-preview {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #000;
  position: relative;

  .video-container {
    flex: 1;
    position: relative;
    overflow: hidden;

    .video-element {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .status-indicator {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      color: white;
      font-size: 14px;

      &.connecting {
        color: #409eff;
      }

      &.error {
        color: #f56c6c;
      }

      &.no-signal {
        color: #909399;
      }

      .el-icon {
        font-size: 48px;
      }
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

    .device-info {
      display: flex;
      gap: 8px;
      align-items: center;

      .device-name {
        font-weight: 500;
      }

      .interface-type {
        padding: 2px 6px;
        background: rgba(64, 158, 255, 0.3);
        border-radius: 3px;
        font-size: 11px;
      }
    }

    .resolution-info {
      color: #909399;
    }
  }
}
</style>
