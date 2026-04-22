<template>
  <div class="camera-preview" :class="{ 'camera-active': isActive, 'camera-error': error }">
    <!-- 渲染引擎画布 -->
    <RenderEngineWrapper
      ref="engineWrapper"
      :sources="cameraSources"
      :layout-type="layoutType"
      :width="width"
      :height="height"
      :auto-start="autoStart"
      @ready="onEngineReady"
      @error="onEngineError"
      @source-ready="onSourceReady"
      @source-error="onSourceError"
    />
    
    <!-- 摄像头控制栏 -->
    <div class="camera-controls" v-if="showControls">
      <div class="control-group">
        <button 
          class="control-btn" 
          :class="{ active: isRecording }"
          @click="toggleRecording"
          :disabled="!isActive"
        >
          <span class="btn-icon">{{ isRecording ? '⏹️' : '⏺️' }}</span>
          <span class="btn-text">{{ isRecording ? '停止录制' : '开始录制' }}</span>
        </button>
        
        <button 
          class="control-btn"
          @click="switchCamera"
          :disabled="!isActive || availableCameras.length < 2"
        >
          <span class="btn-icon">🔄</span>
          <span class="btn-text">切换摄像头</span>
        </button>
        
        <button 
          class="control-btn"
          :class="{ active: isMuted }"
          @click="toggleMute"
        >
          <span class="btn-icon">{{ isMuted ? '🔇' : '🔊' }}</span>
          <span class="btn-text">{{ isMuted ? '取消静音' : '静音' }}</span>
        </button>
        
        <button 
          class="control-btn danger"
          @click="stopCamera"
          :disabled="!isActive"
        >
          <span class="btn-icon">⏹️</span>
          <span class="btn-text">关闭摄像头</span>
        </button>
      </div>
    </div>
    
    <!-- 摄像头选择器 -->
    <div class="camera-selector" v-if="showSelector && availableCameras.length > 0">
      <select 
        v-model="selectedCameraId" 
        @change="onCameraChange"
        class="camera-select"
      >
        <option value="">选择摄像头</option>
        <option 
          v-for="camera in availableCameras" 
          :key="camera.deviceId" 
          :value="camera.deviceId"
        >
          {{ camera.label || camera.deviceId }}
        </option>
      </select>
    </div>
    
    <!-- 状态指示 -->
    <div class="status-bar">
      <span class="status-indicator" :class="statusClass"></span>
      <span class="status-text">{{ statusText }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import RenderEngineWrapper from './RenderEngineWrapper.vue';
import { RenderSourceCamera } from '../../render';

const props = defineProps({
  width: {
    type: Number,
    default: 1280
  },
  height: {
    type: Number,
    default: 720
  },
  deviceId: {
    type: String,
    default: ''
  },
  layoutType: {
    type: String,
    default: 'single'
  },
  autoStart: {
    type: Boolean,
    default: true
  },
  showControls: {
    type: Boolean,
    default: true
  },
  showSelector: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits([
  'ready', 
  'error', 
  'started', 
  'stopped', 
  'recording-started',
  'recording-stopped',
  'camera-switched'
]);

// Refs
const engineWrapper = ref(null);

// State
const isActive = ref(false);
const isRecording = ref(false);
const isMuted = ref(true); // 摄像头默认静音
const error = ref(null);
const selectedCameraId = ref(props.deviceId);
const availableCameras = ref([]);
const cameraSource = ref(null);

// 计算属性
const cameraSources = computed(() => {
  if (!selectedCameraId.value) return [];
  
  return [{
    id: 'camera-main',
    type: 'camera',
    name: '摄像头',
    deviceId: selectedCameraId.value
  }];
});

const statusClass = computed(() => {
  if (error.value) return 'error';
  if (isRecording.value) return 'recording';
  if (isActive.value) return 'active';
  return 'inactive';
});

const statusText = computed(() => {
  if (error.value) return `错误: ${error.value}`;
  if (isRecording.value) return '录制中...';
  if (isActive.value) return '摄像头已启动';
  return '未连接';
});

// 初始化摄像头列表
const initCameraList = async () => {
  try {
    const devices = await RenderSourceCamera.getDevices();
    availableCameras.value = devices;
    
    // 如果没有指定设备，选择第一个
    if (!selectedCameraId.value && devices.length > 0) {
      selectedCameraId.value = devices[0].deviceId;
    }
  } catch (err) {
    console.error('[CameraPreview] 获取摄像头列表失败:', err);
  }
};

// 启动摄像头
const startCamera = async () => {
  try {
    error.value = null;
    
    if (!selectedCameraId.value) {
      throw new Error('请选择摄像头');
    }
    
    // 创建摄像头数据源
    cameraSource.value = new RenderSourceCamera({
      id: 'camera-main',
      name: '主摄像头',
      deviceId: selectedCameraId.value,
      constraints: {
        video: {
          width: { ideal: props.width },
          height: { ideal: props.height },
          frameRate: { ideal: 30 }
        },
        audio: !isMuted.value
      }
    });
    
    // 监听事件
    cameraSource.value.on('ready', () => {
      isActive.value = true;
      emit('started', { deviceId: selectedCameraId.value });
    });
    
    cameraSource.value.on('error', (e) => {
      error.value = e.error.message;
      isActive.value = false;
      emit('error', { error: e.error });
    });
    
    // 初始化并播放
    await cameraSource.value.init();
    await cameraSource.value.play();
    
  } catch (err) {
    error.value = err.message;
    emit('error', { error: err });
    console.error('[CameraPreview] 启动摄像头失败:', err);
  }
};

// 停止摄像头
const stopCamera = () => {
  if (cameraSource.value) {
    cameraSource.value.dispose();
    cameraSource.value = null;
  }
  isActive.value = false;
  isRecording.value = false;
  emit('stopped');
};

// 切换摄像头
const switchCamera = async () => {
  if (availableCameras.value.length < 2) return;
  
  const currentIndex = availableCameras.value.findIndex(
    cam => cam.deviceId === selectedCameraId.value
  );
  const nextIndex = (currentIndex + 1) % availableCameras.value.length;
  selectedCameraId.value = availableCameras.value[nextIndex].deviceId;
  
  // 重启摄像头
  await restartCamera();
  
  emit('camera-switched', { deviceId: selectedCameraId.value });
};

// 重启摄像头
const restartCamera = async () => {
  stopCamera();
  await startCamera();
};

// 切换录制状态
const toggleRecording = () => {
  isRecording.value = !isRecording.value;
  
  if (isRecording.value) {
    emit('recording-started');
  } else {
    emit('recording-stopped');
  }
};

// 切换静音
const toggleMute = () => {
  isMuted.value = !isMuted.value;
  
  if (cameraSource.value) {
    cameraSource.value.setMuted(isMuted.value);
  }
};

// 摄像头选择变更
const onCameraChange = async () => {
  await restartCamera();
};

// 引擎回调
const onEngineReady = () => {
  emit('ready');
};

const onEngineError = (e) => {
  error.value = e.error.message;
};

const onSourceReady = (e) => {
  console.log('[CameraPreview] 数据源就绪:', e.sourceId);
};

const onSourceError = (e) => {
  error.value = e.error.message;
};

// 监听设备ID变化
watch(() => props.deviceId, (newId) => {
  if (newId && newId !== selectedCameraId.value) {
    selectedCameraId.value = newId;
    restartCamera();
  }
});

// 生命周期
onMounted(async () => {
  await initCameraList();
  
  if (props.autoStart && selectedCameraId.value) {
    await startCamera();
  }
});

onUnmounted(() => {
  stopCamera();
});

// 暴露方法
defineExpose({
  startCamera,
  stopCamera,
  switchCamera,
  toggleRecording,
  toggleMute,
  isActive,
  isRecording,
  isMuted,
  availableCameras
});
</script>

<style scoped>
.camera-preview {
  position: relative;
  width: 100%;
  height: 100%;
  background: #0D1B2A;
  border-radius: 8px;
  overflow: hidden;
}

.camera-active {
  border: 2px solid #4CAF50;
}

.camera-error {
  border: 2px solid #E74C3C;
}

.camera-controls {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
}

.control-group {
  display: flex;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 24px;
  backdrop-filter: blur(10px);
}

.control-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(52, 152, 219, 0.8);
  border: none;
  border-radius: 16px;
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.control-btn:hover:not(:disabled) {
  background: rgba(52, 152, 219, 1);
  transform: translateY(-2px);
}

.control-btn:active:not(:disabled) {
  transform: translateY(0);
}

.control-btn:disabled {
  background: rgba(255, 255, 255, 0.2);
  cursor: not-allowed;
}

.control-btn.active {
  background: #E74C3C;
}

.control-btn.danger {
  background: rgba(231, 76, 60, 0.8);
}

.control-btn.danger:hover:not(:disabled) {
  background: #E74C3C;
}

.btn-icon {
  font-size: 16px;
}

.btn-text {
  font-size: 12px;
}

.camera-selector {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
}

.camera-select {
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  font-size: 12px;
  cursor: pointer;
}

.camera-select:focus {
  outline: none;
  border-color: #3498DB;
}

.status-bar {
  position: absolute;
  bottom: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 12px;
  z-index: 10;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #9E9E9E;
}

.status-indicator.active {
  background: #4CAF50;
  box-shadow: 0 0 8px #4CAF50;
}

.status-indicator.recording {
  background: #E74C3C;
  box-shadow: 0 0 8px #E74C3C;
  animation: pulse 1s infinite;
}

.status-indicator.error {
  background: #E74C3C;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-text {
  color: #E0E0E0;
  font-size: 12px;
}
</style>
