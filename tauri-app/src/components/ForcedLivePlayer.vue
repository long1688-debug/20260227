<template>
  <div class="forced-live-player" :class="{ fullscreen: isFullscreen }">
    <!-- 直播视频区域 -->
    <div class="live-container">
      <video
        ref="videoRef"
        class="live-video"
        autoplay
        playsinline
        @loadedmetadata="onVideoLoaded"
        @play="onPlay"
        @pause="onPause"
      ></video>

      <!-- 直播状态指示器 -->
      <div class="live-status">
        <div class="live-badge">
          <span class="live-dot"></span>
          <span class="live-text">LIVE</span>
        </div>
        <div class="live-info">
          <span class="teacher-name">{{ teacherName }}</span>
          <span class="live-title">{{ liveTitle }}</span>
        </div>
      </div>

      <!-- 字幕叠加 -->
      <div v-if="subtitleVisible" class="subtitle-overlay">
        <div class="subtitle-text">{{ currentSubtitle }}</div>
      </div>

      <!-- 退出全屏按钮 -->
      <div class="exit-button" @click="showExitDialog">
        <el-icon><close /></el-icon>
        <span>退出全屏</span>
      </div>

      <!-- 录制指示器 -->
      <div v-if="isRecording" class="recording-indicator">
        <span class="rec-dot"></span>
        <span class="rec-text">录制中 {{ recordingTime }}</span>
      </div>

      <!-- 连接状态 -->
      <div v-if="!connected" class="connection-status">
        <el-icon class="loading"><loading /></el-icon>
        <span>正在连接直播...</span>
      </div>
    </div>

    <!-- 退出全屏验证对话框 -->
    <el-dialog
      v-model="showExitDialogVisible"
      title="退出全屏验证"
      width="400px"
      :close-on-click-modal="false"
      :show-close="false"
    >
      <div class="exit-verification">
        <el-alert
          title="安全提示"
          type="warning"
          :closable="false"
          show-icon
          style="margin-bottom: 20px"
        >
          退出全屏需要输入用户名和密码进行验证
        </el-alert>

        <el-form :model="exitForm" label-width="80px">
          <el-form-item label="用户名">
            <el-input
              v-model="exitForm.username"
              placeholder="请输入用户名"
              @keyup.enter="verifyExit"
            />
          </el-form-item>
          <el-form-item label="密码">
            <el-input
              v-model="exitForm.password"
              type="password"
              placeholder="请输入密码"
              show-password
              @keyup.enter="verifyExit"
            />
          </el-form-item>
        </el-form>

        <div v-if="exitError" class="exit-error">
          <el-icon><warning /></el-icon>
          <span>{{ exitError }}</span>
        </div>
      </div>

      <template #footer>
        <el-button @click="cancelExit">取消</el-button>
        <el-button type="primary" @click="verifyExit">确定退出</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Close, Loading, Warning } from '@/components/icons';

const props = defineProps({
  // 教师端 WebSocket 地址
  teacherUrl: {
    type: String,
    default: 'ws://127.0.0.1:8080/live'
  },
  // 教师名称
  teacherName: {
    type: String,
    default: '教师'
  },
  // 直播标题
  liveTitle: {
    type: String,
    default: '在线直播'
  },
  // 退出凭证（用户名和密码）
  exitCredentials: {
    type: Object,
    default: () => ({
      username: 'admin',
      password: 'admin123'
    })
  }
});

const emit = defineEmits([
  'connected',
  'disconnected',
  'play',
  'pause',
  'subtitleChanged',
  'recordingChanged'
]);

// 视频元素
const videoRef = ref(null);

// 状态
const isFullscreen = ref(true);
const connected = ref(false);
const isPlaying = ref(false);
const subtitleVisible = ref(true);
const currentSubtitle = ref('');
const showExitDialogVisible = ref(false);

// 退出验证
const exitForm = ref({
  username: '',
  password: ''
});
const exitError = ref('');

// WebSocket
const websocket = ref(null);

// 录制
const isRecording = ref(false);
const recordingTime = ref('00:00:00');
let mediaRecorder = null;
let recordedChunks = [];
let recordingStartTime = null;

// 进入全屏
onMounted(() => {
  requestFullscreen();
  connectToLive();
  startRecording();
});

// 退出全屏
onUnmounted(() => {
  exitFullscreen();
  disconnectFromLive();
  stopRecording();
});

// 请求全屏
async function requestFullscreen() {
  try {
    const element = document.documentElement;

    if (element.requestFullscreen) {
      await element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) {
      await element.webkitRequestFullscreen();
    } else if (element.msRequestFullscreen) {
      await element.msRequestFullscreen();
    }

    isFullscreen.value = true;

    // 监听全屏变化
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

  } catch (error) {
    console.error('进入全屏失败:', error);
    ElMessage.error('进入全屏失败');
  }
}

// 退出全屏
function exitFullscreen() {
  try {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }

    isFullscreen.value = false;

  } catch (error) {
    console.error('退出全屏失败:', error);
  }
}

// 处理全屏变化
function handleFullscreenChange() {
  const isCurrentlyFullscreen = !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement
  );

  if (!isCurrentlyFullscreen && isFullscreen.value) {
    // 用户尝试退出全屏，显示验证对话框
    showExitDialog();

    // 重新进入全屏
    setTimeout(() => {
      requestFullscreen();
    }, 100);
  }
}

// 显示退出对话框
function showExitDialog() {
  showExitDialogVisible.value = true;
  exitForm.value.username = '';
  exitForm.value.password = '';
  exitError.value = '';
}

// 验证退出
function verifyExit() {
  const { username, password } = props.exitCredentials;

  if (exitForm.value.username === username && exitForm.value.password === password) {
    // 验证成功
    showExitDialogVisible.value = false;
    exitFullscreen();
    disconnectFromLive();
    stopRecording();

    ElMessage.success('已退出直播');
  } else {
    // 验证失败
    exitError.value = '用户名或密码错误';
    exitForm.value.password = '';
  }
}

// 取消退出
function cancelExit() {
  showExitDialogVisible.value = false;
  exitForm.value.username = '';
  exitForm.value.password = '';
  exitError.value = '';
}

// 连接到直播
function connectToLive() {
  try {
    websocket.value = new WebSocket(props.teacherUrl);

    websocket.value.onopen = () => {
      connected.value = true;
      emit('connected');
      ElMessage.success('已连接到直播');
    };

    websocket.value.onmessage = (event) => {
      handleMessage(event.data);
    };

    websocket.value.onerror = (error) => {
      console.error('WebSocket 错误:', error);
      ElMessage.error('连接失败');
    };

    websocket.value.onclose = () => {
      connected.value = false;
      isPlaying.value = false;
      emit('disconnected');
      ElMessage.warning('直播连接已断开');
    };

  } catch (error) {
    console.error('连接直播失败:', error);
    ElMessage.error('连接直播失败');
  }
}

// 断开连接
function disconnectFromLive() {
  if (websocket.value) {
    websocket.value.close();
    websocket.value = null;
  }
  connected.value = false;
}

// 处理消息
function handleMessage(data) {
  try {
    const message = JSON.parse(data);

    switch (message.type) {
      case 'video':
        // 视频流数据
        if (videoRef.value && message.data) {
          videoRef.value.src = `data:video/mp4;base64,${message.data}`;
        }
        break;

      case 'subtitle':
        // 字幕数据
        currentSubtitle.value = message.text || '';
        emit('subtitleChanged', { text: message.text });
        break;

      case 'status':
        // 状态更新
        if (message.playing !== undefined) {
          isPlaying.value = message.playing;
        }
        break;

      default:
        console.warn('未知消息类型:', message.type);
    }

  } catch (error) {
    console.error('处理消息失败:', error);
  }
}

// 视频加载完成
function onVideoLoaded() {
  console.log('视频加载完成');
}

// 播放
function onPlay() {
  isPlaying.value = true;
  emit('play');
}

// 暂停
function onPause() {
  isPlaying.value = false;
  emit('pause');
}

// 开始录制
function startRecording() {
  if (!videoRef.value) {
    return;
  }

  try {
    // 捕获视频流
    const stream = videoRef.value.captureStream();

    mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9'
    });

    recordedChunks = [];
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `live_recording_${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);

      emit('recordingChanged', { recording: false });
      ElMessage.success('录制已保存');
    };

    mediaRecorder.start(1000);
    isRecording.value = true;
    recordingStartTime = Date.now();
    updateRecordingTime();

    emit('recordingChanged', { recording: true });
    ElMessage.success('开始录制直播');

  } catch (error) {
    console.error('开始录制失败:', error);
    ElMessage.error('开始录制失败');
  }
}

// 停止录制
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    isRecording.value = false;
  }
}

// 更新录制时间
function updateRecordingTime() {
  if (isRecording.value && recordingStartTime) {
    const elapsed = Date.now() - recordingStartTime;
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    recordingTime.value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    setTimeout(updateRecordingTime, 1000);
  }
}

// 暴露方法
defineExpose({
  connect: connectToLive,
  disconnect: disconnectFromLive,
  startRecording,
  stopRecording,
  toggleSubtitle: () => {
    subtitleVisible.value = !subtitleVisible.value;
  }
});
</script>

<style lang="scss" scoped>
.forced-live-player {
  width: 100vw;
  height: 100vh;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;

  &.fullscreen {
    position: fixed;
  }
}

.live-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.live-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}

.live-status {
  position: absolute;
  top: 20px;
  left: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 10;
}

.live-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(239, 68, 68, 0.9);
  color: white;
  padding: 6px 12px;
  border-radius: 4px;
  font-weight: bold;
  font-size: 14px;

  .live-dot {
    width: 10px;
    height: 10px;
    background: white;
    border-radius: 50%;
    animation: pulse 1.5s infinite;
  }
}

.live-info {
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;

  .teacher-name {
    font-size: 12px;
    opacity: 0.8;
  }

  .live-title {
    font-size: 16px;
    font-weight: 500;
  }
}

.subtitle-overlay {
  position: absolute;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.5);
  color: white;
  padding: 8px 20px;
  border-radius: 6px;
  max-width: 85%;
  width: auto;
  min-width: 180px;
  z-index: 10;
  height: auto;

  .subtitle-text {
    font-size: 24px;
    text-align: center;
    line-height: 1.5;
  }
}

.exit-button {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(239, 68, 68, 0.9);
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 10;
  transition: all 0.3s;

  &:hover {
    background: rgba(220, 38, 38, 1);
    transform: scale(1.05);
  }
}

.recording-indicator {
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: rgba(239, 68, 68, 0.9);
  color: white;
  padding: 10px 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 10;

  .rec-dot {
    width: 12px;
    height: 12px;
    background: white;
    border-radius: 50%;
    animation: pulse 1s infinite;
  }
}

.connection-status {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 20px 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 18px;
  z-index: 100;

  .el-icon {
    font-size: 24px;
    animation: spin 1s linear infinite;
  }
}

.exit-verification {
  .exit-error {
    margin-top: 12px;
    padding: 10px;
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
