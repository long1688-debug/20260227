<template>
  <div class="video-preview"
    @drop.prevent="onContainerDrop"
    @dragover.prevent="onContainerDragOver"
    @dragenter.prevent="onContainerDragEnter"
  >
    <!-- 视频预览区域 -->
    <div class="video-container" @dblclick="onCanvasDoubleClick">
      <!-- 🎯 ZLMediaKit 流媒体播放 -->
      <video
        v-if="!useNativeVideo"
        ref="videoRef"
        class="video-element"
        autoplay
        playsinline
        muted
        @loadedmetadata="onVideoLoadedMetadata"
        @play="onVideoPlay"
      ></video>

      <!-- 🎯 本地视频/摄像头（原生 video 标签） -->
      <video
        v-else
        ref="videoRef"
        class="video-element"
        autoplay
        playsinline
        muted
        @loadedmetadata="onVideoLoadedMetadata"
        @play="onVideoPlay"
        @pause="onVideoPause"
        @error="onVideoError"
        @canplay="onVideoCanPlay"
        @waiting="onVideoWaiting"
        @stalled="onVideoStalled"
        @ended="onVideoEnded"
      ></video>

      <!-- 🎯 视频加载状态指示器 -->
      <div v-if="videoLoading" class="video-loading">
        <span class="loading-spinner"></span>
        <span class="loading-text">加载中...</span>
      </div>

      <!-- 🎯 视频错误状态指示器 -->
      <div v-if="videoError" class="video-error">
        <span class="error-icon">⚠️</span>
        <span class="error-text">{{ videoError }}</span>
      </div>

      <!-- 字幕叠加层 -->
      <div v-if="subtitleText || realtimeSubtitleText" class="subtitle-overlay">
        <div class="subtitle-text">{{ realtimeSubtitleText || subtitleText }}</div>
      </div>

      <!-- 🎯 流媒体状态指示器 -->
      <div v-if="isStreaming" class="streaming-indicator">
        <span class="stream-dot" :class="{ 'connected': streamConnected }"></span>
        <span class="stream-text">{{ streamConnected ? '流已连接' : '连接中...' }}</span>
      </div>

      <!-- 录制指示器 -->
      <div v-if="isRecording" class="recording-indicator">
        <span class="rec-dot"></span>
        <span class="rec-text">录制中 {{ recordingTime }}</span>
      </div>

      <!-- PTZ 控制按钮（仅网络摄像头显示） -->
      <div v-if="sourceType === 'networkCamera' && onvifConfig" class="ptz-toggle-btn" @click="togglePtzPanel">
        <span class="ptz-icon">🎥</span>
      </div>

      <!-- PTZ 控制面板 -->
      <PtzControlPanel
        v-if="showPtzPanel"
        :visible="showPtzPanel"
        :device-config="onvifConfig"
        @close="showPtzPanel = false"
      />

      <!-- 批注画布 -->
      <canvas
        v-if="annotationEnabled"
        ref="annotationCanvasRef"
        class="annotation-canvas"
        @mousedown="startAnnotation"
        @mousemove="drawAnnotation"
        @mouseup="stopAnnotation"
        @mouseleave="stopAnnotation"
      ></canvas>
    </div>

    <!-- 控制栏 -->
    <div class="control-bar" v-if="showControls">
      <!-- 🎯 流媒体信息 -->
      <div v-if="isStreaming" class="stream-info">
        <el-tag size="small" type="success">ZLMediaKit</el-tag>
        <el-tag v-if="streamType" size="small" type="info">{{ streamType }}</el-tag>
      </div>

      <!-- 视频播放控制 -->
      <div class="playback-controls" v-if="videoRef && !isStreaming">
        <!-- 播放/暂停按钮 -->
        <el-button
          :icon="isPaused ? 'VideoPlay' : 'VideoPause'"
          @click="togglePlayPause"
          circle
          size="small"
        />

        <!-- 时间显示 -->
        <span class="time-display">
          {{ formatTime(videoRef.currentTime) }} / {{ formatTime(videoRef.duration) }}
        </span>

        <!-- 进度条 -->
        <el-slider
          v-model="progress"
          :max="100"
          @change="onProgressChange"
          @input="onProgressInput"
          class="progress-slider"
          :show-tooltip="false"
        />

        <!-- 播放速度 -->
        <el-select
          v-model="playbackRate"
          @change="changePlaybackRate"
          size="small"
          style="width: 80px"
        >
          <el-option label="0.5x" :value="0.5" />
          <el-option label="1.0x" :value="1.0" />
          <el-option label="1.5x" :value="1.5" />
          <el-option label="2.0x" :value="2.0" />
        </el-select>
      </div>

      <!-- 录制控制 -->
      <div class="record-controls">
        <el-button
          :type="isRecording ? 'danger' : 'primary'"
          :icon="isRecording ? 'Close' : VideoCamera"
          @click="toggleRecording"
        >
          {{ isRecording ? '停止录制' : '开始录制' }}
        </el-button>

        <!-- 实时字幕控制 -->
        <el-button
          :type="isRecognizing ? 'warning' : 'success'"
          @click="toggleRealtimeSubtitle"
        >
          {{ isRecognizing ? '停止字幕' : '实时字幕' }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { VideoCamera } from '@/components/icons';
import PtzControlPanel from './PtzControlPanel.vue';
import { useVideoSync } from '@/composables/useVideoSync';
import { useRealtimeSubtitle } from '@/composables/useRealtimeSubtitle';
import flvjs from 'flv.js'; // 🎯 导入 FLV.js 播放器
// 🎯 导入视频源管理工具
import { useVideoSourceManager } from '@/utils/videoSource';

// 🎯 初始化视频源管理器
const videoSourceManager = useVideoSourceManager();

const props = defineProps({
  index: {
    type: Number,
    required: true
  },
  initialSource: {
    type: String,
    default: 'usb'
  },
  showControls: {
    type: Boolean,
    default: true
  },
  sourceId: {
    type: String,
    default: ''
  },
  videoSource: {
    type: Object,
    default: null
  },
  autoStart: {
    type: Boolean,
    default: true
  },
  subtitleText: {
    type: String,
    default: ''
  },
  annotationEnabled: {
    type: Boolean,
    default: false
  },
  annotationColor: {
    type: String,
    default: '#FF0000'
  },
  annotationBrushSize: {
    type: Number,
    default: 5
  },
  annotationBrushType: {
    type: String,
    default: 'pen'
  },
  onvifConfig: {
    type: Object,
    default: null
  }
});

const emit = defineEmits([
  'sourceChanged',
  'recordingChanged',
  'canvasDoubleClick',
  'videoDrop',
  'videoDragOver',
  'videoPlay'  // 添加视频播放事件
]);

// 拖曳事件处理 - 容器层级
const onContainerDrop = (event) => {
  console.log('[VideoPreview] 容器 drop 事件触发');
  emit('videoDrop', event);
};

const onContainerDragOver = (event) => {
  event.preventDefault();
  console.log('[VideoPreview] 容器 dragover 事件触发');
  emit('videoDragOver', event);
};

const onContainerDragEnter = (event) => {
  event.preventDefault();
  console.log('[VideoPreview] 容器 dragenter 事件触发');
  emit('videoDragOver', event);
};

// 视频播放事件 - 触发音频互斥
const onVideoPlay = () => {
  console.log(`[VideoPreview] 视频播放事件: index=${props.index}, sourceId=${props.sourceId}`);
  isPaused.value = false;
  emit('videoPlay', {
    index: props.index,
    sourceId: props.sourceId
  });

  // 注意：不再自动互斥，由 SourceManager 的音频选择器控制
  // 支持多个视频同时发声（虽然实际应用中不会全选）
};

// 视频暂停事件
const onVideoPause = () => {
  console.log(`[VideoPreview] 视频暂停事件: index=${props.index}, sourceId=${props.sourceId}`);
  isPaused.value = true;
};

// 视频同步
const { registerMasterVideo, registerSlaveVideo, unregisterSlaveVideo, clearMasterVideo } = useVideoSync();

// 实时字幕
const { subtitleText: realtimeSubtitleText, isRecognizing, startRealtimeSubtitle, stopRealtimeSubtitle } = useRealtimeSubtitle();

const toggleRealtimeSubtitle = async () => {
  if (isRecognizing.value) {
    await stopRealtimeSubtitle();
  } else {
    await startRealtimeSubtitle();
  }
};

// 视频元素
const videoRef = ref(null);

// 跟踪是否已注册
const isRegistered = ref(false);

// 🎯 关键修复：监听 sourceId 变化，确保在 sourceId 更新后重新注册
let lastRegisteredSourceId = '';

watch(() => props.sourceId, (newSourceId, oldSourceId) => {
  console.log(`[VideoPreview.watch] sourceId 变化:`, {
    index: props.index,
    oldSourceId,
    newSourceId,
    hasVideo: !!videoRef.value,
    hasVideoSource: videoRef.value?.src || !!videoRef.value?.srcObject
  });

  // 如果 sourceId 从空变为有效，且视频已加载但未注册，则重新注册
  if (newSourceId && !lastRegisteredSourceId && videoRef.value) {
    const hasVideoSource = videoRef.value.src || videoRef.value.srcObject;
    if (hasVideoSource && !isRegistered.value) {
      console.log(`[VideoPreview.watch] sourceId 已设置，触发重新注册`);
      registerVideoToSyncSystem();
    }
  }

  // 如果 sourceId 变化，重置注册状态
  if (oldSourceId && newSourceId && oldSourceId !== newSourceId) {
    console.log(`[VideoPreview.watch] sourceId 变化，重置注册状态`);
    isRegistered.value = false;
    lastRegisteredSourceId = '';

    // 尝试重新注册
    registerVideoToSyncSystem();
  }
});

// 🎯 手动注册视频到同步系统
// 用于在设置视频源后确保注册到 SyncStateReplicator
const registerVideoToSyncSystem = () => {
  if (!videoRef.value || !props.sourceId || isRegistered.value) {
    console.log(`[VideoPreview.registerVideoToSyncSystem] 跳过注册:`, {
      hasVideo: !!videoRef.value,
      sourceId: props.sourceId,
      isRegistered: isRegistered.value
    });
    return;
  }

  // 检查是否有有效的视频源
  const hasVideoSource = videoRef.value.src || videoRef.value.srcObject;
  if (!hasVideoSource) {
    console.log(`[VideoPreview.registerVideoToSyncSystem] 视频元素无有效源，跳过注册: ${props.sourceId}`);
    return;
  }

  // 🎯 关键修复：检查是否在布局切换期间，如果是则延迟注册
  // 防止在旧注册未清理时尝试新注册
  if (window.__isLayoutSwitching) {
    console.log(`[VideoPreview.registerVideoToSyncSystem] 布局切换中，延迟注册: ${props.sourceId}`);
    setTimeout(() => registerVideoToSyncSystem(), 100);
    return;
  }

  console.log(`[VideoPreview.registerVideoToSyncSystem] 手动注册视频: ${props.sourceId}, index: ${props.index}`);

  if (props.index === 0) {
    registerMasterVideo(videoRef.value, props.sourceId);
    console.log(`[VideoPreview] 主控视频已手动注册: ${props.sourceId}`);
  } else {
    // 🎯 修复：传递 sourceId 参数
    registerSlaveVideo(videoRef.value, props.index, props.sourceId);
    console.log(`[VideoPreview] 从属视频已手动注册: ${props.sourceId}`);
  }

  isRegistered.value = true;
  lastRegisteredSourceId = props.sourceId;
};

// 视频元数据加载完成
const onVideoLoadedMetadata = () => {
  videoLoading.value = false;
  videoError.value = null;

  if (!videoRef.value || !props.sourceId || isRegistered.value) return;

  // 🎯 关键修复：只有当 video 元素真正有视频源时才注册
  // 避免空 video 元素误注册到同步系统
  const hasVideoSource = videoRef.value.src || videoRef.value.srcObject;
  if (!hasVideoSource) {
    console.log(`[VideoPreview] 视频元素无有效源，跳过注册: ${props.sourceId}`);
    return;
  }

  console.log(`[VideoPreview.onVideoLoadedMetadata] 视频元数据加载完成，准备注册: ${props.sourceId}`);

  // 🎯 关键修复：延迟注册，确保视频元素完全就绪
  // 避免在布局切换时，视频元素尚未挂载完成就调用 play()
  setTimeout(() => {
    if (!videoRef.value || isRegistered.value) return;

    if (props.index === 0) {
      registerMasterVideo(videoRef.value, props.sourceId);
      console.log(`[VideoPreview] 主控视频已注册: ${props.sourceId}`);
    } else {
      // 🎯 修复：传递 sourceId 参数
      registerSlaveVideo(videoRef.value, props.index, props.sourceId);
      console.log(`[VideoPreview] 从属视频已注册: ${props.sourceId}`);
    }

    isRegistered.value = true;
    console.log(`[VideoPreview] ${props.index === 0 ? '主控' : '从属'} 已注册: ${props.sourceId}`);
  }, 50);
};

// 视频可以播放
const onVideoCanPlay = () => {
  console.log(`[VideoPreview] 视频可以播放: ${props.sourceId}`);
  videoLoading.value = false;
  
  // 确保视频尺寸正确设置
  if (videoRef.value) {
    // 🎯 修复：确保视频元素尺寸正确
    const video = videoRef.value;
    if (video.videoWidth && video.videoHeight) {
      console.log(`[VideoPreview] 视频尺寸: ${video.videoWidth}x${video.videoHeight}`);
    }
    
    // 尝试播放视频
    if (!isPaused.value) {
      video.play().catch(err => {
        console.warn(`[VideoPreview] 自动播放失败: ${err.message}`);
      });
    }
  }
};

// 视频缓冲中
const onVideoWaiting = () => {
  console.log(`[VideoPreview] 视频缓冲中: ${props.sourceId}`);
  videoLoading.value = true;
};

// 视频流停滞
const onVideoStalled = () => {
  console.warn(`[VideoPreview] 视频流停滞: ${props.sourceId}`);
  videoLoading.value = true;
};

// 视频播放结束
const onVideoEnded = () => {
  console.log(`[VideoPreview] 视频播放结束: ${props.sourceId}`);
  isPaused.value = true;
};

// 🎯 视频错误处理
const onVideoError = (event) => {
  console.error('[VideoPreview] 视频加载错误:', event);
  videoLoading.value = false;

  // 获取错误信息
  const error = videoRef.value?.error;
  let errorMessage = '视频加载失败';

  if (error) {
    switch (error.code) {
      case error.MEDIA_ERR_ABORTED:
        errorMessage = '视频加载被中止';
        break;
      case error.MEDIA_ERR_NETWORK:
        errorMessage = '网络错误导致视频下载失败';
        break;
      case error.MEDIA_ERR_DECODE:
        errorMessage = '视频解码错误';
        break;
      case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
        errorMessage = '不支持的视频格式';
        break;
      default:
        errorMessage = `视频加载错误 (code: ${error.code})`;
    }
  }

  videoError.value = errorMessage;
  ElMessage.error(errorMessage);
};

// 批注画布
const annotationCanvasRef = ref(null);
let annotationCtx = null;
let isAnnotationDrawing = false;
let lastAnnotationPos = null;

// 🎯 ZLMediaKit 流媒体状态
const isStreaming = ref(false);        // 是否正在播放流媒体
const streamConnected = ref(false);    // 流连接状态
const streamType = ref('');            // 流类型（FLV/WebRTC）
const useNativeVideo = ref(true);      // 是否使用原生 video 标签
let flvPlayer = null;                  // FLV.js 播放器实例
let currentStreamUrl = null;           // 当前流 URL

// 状态
const stream = ref(null);
const isRecording = ref(false);
const isRecordingPaused = ref(false);
const recordingTime = ref('00:00:00');
let recordingStartTime = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordingId = null;

// 播放控制状态
const isPaused = ref(false);
const playbackRate = ref(1.0);
const progress = ref(0); // 进度条值（0-100）
let isDragging = false; // 是否正在拖动进度条

// 🎯 视频加载和错误状态
const videoLoading = ref(false);
const videoError = ref(null);

// 信号源类型和 PTZ 面板
const sourceType = ref(props.initialSource);
const showPtzPanel = ref(false);

// 切换 PTZ 面板
const togglePtzPanel = () => {
  showPtzPanel.value = !showPtzPanel.value;
};

// 生命周期
onMounted(async () => {
  // 等待DOM更新，确保videoRef已经准备好
  await nextTick();
  
  // 🎯 修复：确保视频元素尺寸正确设置
  if (videoRef.value) {
    const videoElement = videoRef.value;
    console.log('[VideoPreview.onMounted] 视频元素已准备好');
    
    // 设置视频元素初始尺寸
    videoElement.style.width = '100%';
    videoElement.style.height = '100%';
    
    // 设置视频元素样式
    videoElement.style.objectFit = 'contain';
    videoElement.style.backgroundColor = '#000';
    
    // 添加事件监听器
    videoElement.addEventListener('click', () => {
      if (videoElement.paused) {
        videoElement.play().catch(err => {
          console.warn('[VideoPreview] 点击播放失败:', err);
        });
      }
    });
  }

  // 如果有videoSource props，根据源的类型加载对应的视频内容
  if (props.videoSource) {
    console.log('[VideoPreview.onMounted] 检测到videoSource，准备加载:', props.videoSource.type, props.videoSource.name);
    
    // 🎯 修复：支持多种摄像头类型标识
    const isCameraSource = ['camera', 'usb', 'localCamera'].includes(props.videoSource.type);
    
    if (props.videoSource.type === 'localVideo' && props.videoSource.file) {
      console.log('[VideoPreview.onMounted] 加载本地视频文件:', props.videoSource.name);
      await setVideoFile(props.videoSource.file, props.videoSource.url);
    } else if (props.videoSource.type === 'screen' && props.videoSource.stream) {
      console.log('[VideoPreview.onMounted] 加载屏幕共享流:', props.videoSource.name);
      if (videoRef.value) {
        videoRef.value.srcObject = props.videoSource.stream;
        videoRef.value.play().catch(err => {
          console.warn('[VideoPreview] 屏幕共享播放失败:', err);
        });
        stream.value = props.videoSource.stream;
      }
    } else if (isCameraSource) {
      console.log('[VideoPreview.onMounted] 启动摄像头，类型:', props.videoSource.type);
      await startUSBCamera();
    }
  }
});

onUnmounted(() => {
  cleanup();

  // 注销同步 - 🎯 传递 sourceId 参数
  if (props.index === 0) {
    clearMasterVideo(props.sourceId);
  } else if (props.sourceId) {
    unregisterSlaveVideo(props.index, props.sourceId);
  }
});

// 启动 USB 摄像头
async function startUSBCamera() {
  try {
    // 🎯 修复：先停止现有流
    if (stream.value) {
      stream.value.getTracks().forEach(track => track.stop());
      stream.value = null;
    }

    // 🎯 修复：添加更详细的摄像头约束
    const constraints = {
      video: {
        width: { ideal: 1920, min: 640 },
        height: { ideal: 1080, min: 480 },
        frameRate: { ideal: 30 },
        facingMode: 'user' // 前置摄像头，如果需要后置可以改为 'environment'
      },
      // 🎯 修复：添加音频轨道
      audio: true
    };

    console.log('[VideoPreview] 尝试获取摄像头权限，约束:', constraints);
    
    stream.value = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('[VideoPreview] 摄像头流获取成功');

    // 🎯 修复：确保视频元素存在且已准备好
    if (videoRef.value) {
      // 清除之前的错误状态
      videoError.value = null;
      
      // 设置视频源
      videoRef.value.srcObject = stream.value;
      
      // 设置加载状态
      videoLoading.value = true;
      
      // 设置元数据加载完成后的回调
      videoRef.value.onloadedmetadata = () => {
        console.log('[VideoPreview] 摄像头元数据加载完成');
        
        // 尝试播放视频
        videoRef.value.play().then(() => {
          console.log('[VideoPreview] 摄像头播放成功');
          videoLoading.value = false;
        }).catch(err => {
          console.warn('[VideoPreview] 摄像头自动播放失败:', err);
          videoLoading.value = false;
          // 如果自动播放失败，显示提示
          ElMessage.warning('摄像头自动播放被阻止，请点击画面播放');
        });
      };
      
      // 设置播放事件处理
      videoRef.value.onplay = () => {
        console.log('[VideoPreview] 摄像头开始播放');
        isPaused.value = false;
      };
      
      // 设置暂停事件处理
      videoRef.value.onpause = () => {
        console.log('[VideoPreview] 摄像头暂停');
        isPaused.value = true;
      };
      
      // 设置错误事件处理
      videoRef.value.onerror = (event) => {
        console.error('[VideoPreview] 摄像头错误:', event);
        onVideoError(event);
      };
    }

    emit('sourceChanged', {
      index: props.index,
      source: 'usb'
    });
  } catch (error) {
    console.error('启动摄像头失败:', error);
    videoLoading.value = false;
    videoError.value = `摄像头启动失败: ${error.message}`;
    ElMessage.error(`启动摄像头失败：${error.message}`);
  }
}

// 开始/停止录制
function toggleRecording() {
  if (isRecording.value) {
    stopRecording();
  } else {
    startRecording();
  }
}

async function startRecording() {
  if (!stream.value) {
    ElMessage.warning('没有视频流');
    return;
  }

  try {
    const captureStream = videoRef.value.captureStream ?
      videoRef.value.captureStream() : stream.value;

    if (!captureStream) {
      ElMessage.error('无法获取视频流');
      return;
    }

    mediaRecorder = new MediaRecorder(captureStream, {
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
      a.download = `recording_${props.index}_${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      ElMessage.success('录制已保存');
    };

    mediaRecorder.start(1000);
    isRecording.value = true;
    isRecordingPaused.value = false;
    recordingStartTime = Date.now();
    updateRecordingTime();

    emit('recordingChanged', { index: props.index, recording: true });
    ElMessage.success('开始录制');
  } catch (error) {
    console.error('开始录制失败:', error);
    ElMessage.error('开始录制失败');
  }
}

async function stopRecording() {
  try {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      isRecording.value = false;
      isRecordingPaused.value = false;
      emit('recordingChanged', { index: props.index, recording: false });
      ElMessage.success('录制已停止，文件已保存');
    }
  } catch (error) {
    console.error('停止录制失败:', error);
    ElMessage.error('停止录制失败：' + error.message);
  }
}

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

// 双击画布事件
const onCanvasDoubleClick = () => {
  emit('canvasDoubleClick', props.index);
};

// ========== 播放控制功能 ==========
// 播放/暂停切换
const togglePlayPause = () => {
  if (!videoRef.value) return;

  if (videoRef.value.paused) {
    videoRef.value.play();
    isPaused.value = false;
  } else {
    videoRef.value.pause();
    isPaused.value = true;
  }
};

// 改变播放速度
const changePlaybackRate = (rate) => {
  if (!videoRef.value) return;
  videoRef.value.playbackRate = rate;
  playbackRate.value = rate;
};

// 格式化时间显示
const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '00:00';

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

// 进度条输入事件（拖动中）
const onProgressInput = (value) => {
  isDragging = true;
  if (videoRef.value && videoRef.value.duration) {
    const currentTime = (value / 100) * videoRef.value.duration;
    videoRef.value.currentTime = currentTime;
  }
};

// 进度条改变事件（拖动结束）
const onProgressChange = (value) => {
  isDragging = false;
  if (videoRef.value && videoRef.value.duration) {
    const currentTime = (value / 100) * videoRef.value.duration;
    videoRef.value.currentTime = currentTime;
  }
};

// 更新进度条
const updateProgress = () => {
  if (videoRef.value && videoRef.value.duration && !isDragging) {
    progress.value = (videoRef.value.currentTime / videoRef.value.duration) * 100;
  }
  requestAnimationFrame(updateProgress);
};

// 启动进度条更新
updateProgress();

// ========== 批注功能 ==========
const initializeAnnotationCanvas = () => {
  if (!annotationCanvasRef.value) return;

  const canvas = annotationCanvasRef.value;
  const container = canvas.parentElement;
  if (!container) return;

  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  annotationCtx = canvas.getContext('2d');
};

const startAnnotation = (event) => {
  if (!annotationCtx) return;
  isAnnotationDrawing = true;
  lastAnnotationPos = { x: event.offsetX, y: event.offsetY };
};

const drawAnnotation = (event) => {
  if (!isAnnotationDrawing || !annotationCtx) return;

  const ctx = annotationCtx;
  const currentPos = { x: event.offsetX, y: event.offsetY };

  if (props.annotationBrushType === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
    ctx.lineWidth = props.annotationBrushSize * 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(lastAnnotationPos.x, lastAnnotationPos.y);
    ctx.lineTo(currentPos.x, currentPos.y);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  } else if (props.annotationBrushType === 'highlighter') {
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = props.annotationColor;
    ctx.lineWidth = props.annotationBrushSize * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(lastAnnotationPos.x, lastAnnotationPos.y);
    ctx.lineTo(currentPos.x, currentPos.y);
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  } else {
    ctx.strokeStyle = props.annotationColor;
    ctx.lineWidth = props.annotationBrushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(lastAnnotationPos.x, lastAnnotationPos.y);
    ctx.lineTo(currentPos.x, currentPos.y);
    ctx.stroke();
  }

  lastAnnotationPos = currentPos;
};

const stopAnnotation = () => {
  isAnnotationDrawing = false;
};

const clearAnnotation = () => {
  if (!annotationCtx || !annotationCanvasRef.value) return;
  annotationCtx.clearRect(0, 0, annotationCanvasRef.value.width, annotationCanvasRef.value.height);
};

const saveAnnotation = () => {
  if (!annotationCanvasRef.value) return;
  const link = document.createElement('a');
  link.download = `annotation_${props.index}_${Date.now()}.png`;
  link.href = annotationCanvasRef.value.toDataURL('image/png');
  link.click();
  ElMessage.success('批注已保存');
};

// 清理
function cleanup() {
  // 🎯 清理 FLV 播放器
  cleanupFlvPlayer();

  // 清理媒体流
  if (stream.value) {
    stream.value.getTracks().forEach(track => track.stop());
  }

  // 清理录制
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }

  console.log('[VideoPreview] 清理完成');
}

// 监听 annotationEnabled 变化，初始化画布
watch(() => props.annotationEnabled, (newVal) => {
  if (newVal) {
    nextTick(() => {
      initializeAnnotationCanvas();
    });
  }
});

// 监听 videoSource 变化，根据源的类型加载对应的视频内容
watch(() => props.videoSource, async (newSource, oldSource) => {
  console.log('[VideoPreview] videoSource 变化:', {
    index: props.index,
    oldSource: oldSource?.id,
    newSource: newSource?.id,
    type: newSource?.type
  });

  if (!newSource) {
    console.log('[VideoPreview] videoSource 为空，跳过处理');
    return;
  }

  // 根据源的类型加载对应的视频内容
  if (newSource.type === 'localVideo' && newSource.file) {
    console.log('[VideoPreview] 加载本地视频文件:', newSource.name);
    await setVideoFile(newSource.file, newSource.url);
  } else if (newSource.type === 'screen' && newSource.stream) {
    console.log('[VideoPreview] 加载屏幕共享流:', newSource.name);
    if (videoRef.value) {
      videoRef.value.srcObject = newSource.stream;
      videoRef.value.play();
      stream.value = newSource.stream;
    }
  } else if (newSource.type === 'camera' || newSource.type === 'usb' || newSource.type === 'localCamera') {
    console.log('[VideoPreview] 启动USB摄像头');
    startUSBCamera();
  } else if (newSource.type === 'pdf' || newSource.type === 'ppt' || newSource.type === 'word') {
    console.log('[VideoPreview] 加载文档:', newSource.name);
    // 文档类型，暂时不处理，可以后续添加文档预览功能
  } else {
    console.warn('[VideoPreview] 未知的视频源类型:', newSource.type);
  }
}, { deep: true });

// 设置信号源类型
function setSourceType(type) {
  switch (type) {
    case 'usb':
      startUSBCamera();
      break;
    case 'local':
      ElMessage.info('请选择本地视频文件');
      break;
    case 'network':
      ElMessage.info('请配置网络摄像头地址');
      break;
    case 'remote':
      ElMessage.info('请配置远程桌面连接');
      break;
    default:
      startUSBCamera();
  }
}

// 设置本地视频文件
async function setVideoFile(file, blobUrl = null) {
  console.log('[VideoPreview.setVideoFile] 设置视频文件，index:', props.index, 'file:', file?.name, 'blobUrl:', blobUrl);

  // 🎯 设置加载状态
  videoLoading.value = true;
  videoError.value = null;

  // 等待videoRef准备好
  if (!videoRef.value) {
    await nextTick();
  }

  if (!file && !blobUrl || !videoRef.value) {
    console.warn('[VideoPreview.setVideoFile] file/blobUrl 或 videoRef 不存在');
    videoLoading.value = false;
    return;
  }

  // 停止之前的媒体流
  if (videoRef.value.srcObject) {
    const oldStream = videoRef.value.srcObject;
    oldStream.getTracks().forEach(track => track.stop());
    videoRef.value.srcObject = null;
  }

  // 🎯 清除之前的视频源
  if (videoRef.value.src) {
    videoRef.value.pause();
    videoRef.value.src = '';
  }

  // 🎯 关键修复：使用统一管理器管理 Blob URL
  // 如果 blobUrl 是从外部传入的，我们不应该释放它
  let url;
  if (blobUrl) {
    // 复用已有的 blob URL（确保预览和画布使用相同的源）
    url = blobUrl;
    console.log('[VideoPreview.setVideoFile] 复用已有 blob URL');
  } else {
    // 只有在没有提供 blobUrl 时才创建新的
    const { blobUrl: newUrl, fileId } = videoSourceManager.createBlobUrl(file);
    url = newUrl;
    // 保存 fileId 以便后续释放
    if (!videoRef.value._currentFileId) {
      videoRef.value._currentFileId = fileId;
    }
    console.log('[VideoPreview.setVideoFile] 创建新 blob URL');
  }

  // 🎯 关键修复：重置注册状态，等待 loadedmetadata 后再注册
  isRegistered.value = false;
  lastRegisteredSourceId = '';

  // 🎯 修复：确保视频元素尺寸正确设置
  const videoElement = videoRef.value;
  if (videoElement) {
    // 重置视频元素尺寸
    videoElement.style.width = '';
    videoElement.style.height = '';
    
    // 设置视频源
    videoElement.src = url;
    videoElement.load();
    
    // 🎯 音频路由：画布默认静音
    videoElement.muted = true;
    console.log('[VideoPreview.setVideoFile] 画布设置为静音');
    
    // 设置加载状态
    videoLoading.value = true;
    
    // 设置元数据加载完成后的回调
    videoElement.onloadedmetadata = () => {
      console.log('[VideoPreview] 视频元数据加载完成');
      
      // 尝试播放视频
      videoElement.play().then(() => {
        console.log('[VideoPreview] 视频自动播放成功');
        isPaused.value = false;
        videoLoading.value = false;
      }).catch(err => {
        console.warn('[VideoPreview] 自动播放失败:', err);
        isPaused.value = true;
        videoLoading.value = false;
        // 如果自动播放失败，显示提示
        ElMessage.warning('视频自动播放被阻止，请点击画面播放');
      });
    };
    
    // 设置播放事件处理
    videoElement.onplay = () => {
      console.log('[VideoPreview] 视频开始播放');
      isPaused.value = false;
      videoLoading.value = false;
    };
    
    // 设置暂停事件处理
    videoElement.onpause = () => {
      console.log('[VideoPreview] 视频暂停');
      isPaused.value = true;
    };
    
    // 设置错误事件处理
    videoElement.onerror = (event) => {
      console.error('[VideoPreview] 视频加载错误:', event);
      onVideoError(event);
    };
    
    // 设置缓冲事件处理
    videoElement.onwaiting = () => {
      console.log('[VideoPreview] 视频缓冲中');
      videoLoading.value = true;
    };
    
    videoElement.onstalled = () => {
      console.warn('[VideoPreview] 视频流停滞');
      videoLoading.value = true;
    };
    
    // 设置播放结束事件处理
    videoElement.onended = () => {
      console.log('[VideoPreview] 视频播放结束');
      isPaused.value = true;
    };
  }

  stream.value = null;

  // 🎯 不再手动注册，等待 onVideoLoadedMetadata 自然触发
  // registerVideoToSyncSystem(); // 删除这行，让事件自然触发
}

// 🎯 新增：清空视频源（用于布局切换时清理）
function clearVideoSource() {
  console.log('[VideoPreview.clearVideoSource] 清空视频源，index:', props.index);

  if (!videoRef.value) {
    console.warn('[VideoPreview.clearVideoSource] videoRef 不存在');
    return;
  }

  // 停止并清理媒体流
  if (videoRef.value.srcObject) {
    const oldStream = videoRef.value.srcObject;
    oldStream.getTracks().forEach(track => track.stop());
    videoRef.value.srcObject = null;
  }

  // 🎯 使用统一管理器释放 Blob URL
  if (videoRef.value._currentFileId) {
    videoSourceManager.revokeBlobUrl(videoRef.value._currentFileId);
    videoRef.value._currentFileId = null;
    console.log('[VideoPreview.clearVideoSource] 释放 blob URL (通过管理器)');
  } else if (videoRef.value.src && videoRef.value.src.startsWith('blob:')) {
    // 兼容旧代码
    URL.revokeObjectURL(videoRef.value.src);
    console.log('[VideoPreview.clearVideoSource] 释放 blob URL (直接释放)');
  }

  // 清空视频源
  videoRef.value.src = '';
  videoRef.value.load();

  // 重置注册状态
  isRegistered.value = false;
  lastRegisteredSourceId = '';

  // 清理 FLV 播放器
  cleanupFlvPlayer();

  stream.value = null;

  console.log('[VideoPreview.clearVideoSource] 视频源已清空');
}

// 🎯 新增：清空视频源（用于布局切换时清理，不释放 blob URL）
function clearVideoSourceWithoutRevoke() {
  console.log('[VideoPreview.clearVideoSourceWithoutRevoke] 清空视频源（保留 blob URL），index:', props.index);

  if (!videoRef.value) {
    console.warn('[VideoPreview.clearVideoSourceWithoutRevoke] videoRef 不存在');
    return;
  }

  // 停止并清理媒体流
  if (videoRef.value.srcObject) {
    const oldStream = videoRef.value.srcObject;
    oldStream.getTracks().forEach(track => track.stop());
    videoRef.value.srcObject = null;
  }

  // 🎯 不释放 blob URL，只清空 video 元素的 src
  if (videoRef.value.src && videoRef.value.src.startsWith('blob:')) {
    console.log('[VideoPreview.clearVideoSourceWithoutRevoke] 保留 blob URL:', videoRef.value.src);
  }

  // 清空 video 元素
  videoRef.value.src = '';
  videoRef.value.load();

  // 重置注册状态
  isRegistered.value = false;
  lastRegisteredSourceId = '';

  // 清理 FLV 播放器
  cleanupFlvPlayer();

  stream.value = null;

  console.log('[VideoPreview.clearVideoSourceWithoutRevoke] 视频源已清空（blob URL 保留）');
}

// 🎯 设置 ZLMediaKit 流 URL（FLV/WebRTC）
function setStreamUrl(streamUrl, zlStreamId = null, type = 'flv') {
  console.log('[VideoPreview.setStreamUrl] 设置流媒体 URL，index:', props.index, 'streamUrl:', streamUrl, 'type:', type);

  if (!streamUrl || !videoRef.value) {
    console.warn('[VideoPreview.setStreamUrl] streamUrl 或 videoRef 不存在');
    return;
  }

  // 停止并清理旧的播放器
  cleanupFlvPlayer();

  // 停止之前的媒体流
  if (videoRef.value.srcObject) {
    const oldStream = videoRef.value.srcObject;
    oldStream.getTracks().forEach(track => track.stop());
    videoRef.value.srcObject = null;
  }



  // 🎯 使用统一管理器释放 Blob URL
  if (videoRef.value._currentFileId) {
    videoSourceManager.revokeBlobUrl(videoRef.value._currentFileId);
    videoRef.value._currentFileId = null;
  } else if (videoRef.value.src && videoRef.value.src.startsWith('blob:')) {
    URL.revokeObjectURL(videoRef.value.src);
  }

  // 重置注册状态
  isRegistered.value = false;

  // 根据类型选择播放方式
  if (type === 'flv' && streamUrl.includes('.flv')) {
    // 🎯 使用 FLV.js 播放 WebSocket-FLV 流
    initFlvPlayer(streamUrl);
    isStreaming.value = true;
    streamType.value = 'FLV';
    useNativeVideo.value = false;
  } else {
    // 🎯 使用原生 video 标签（适用于 HTTP-FLV 或其他格式）
    videoRef.value.src = streamUrl;
    videoRef.value.load();
    isStreaming.value = true;
    streamType.value = 'Native';
    useNativeVideo.value = true;
  }

  // 🎯 音频路由：画布默认静音
  videoRef.value.muted = true;
  console.log('[VideoPreview.setStreamUrl] 画布设置为静音');

  currentStreamUrl = streamUrl;
  stream.value = null;
  console.log('[VideoPreview.setStreamUrl] 流媒体 URL 设置完成:', streamUrl);

  // 🎯 关键修复：手动注册到视频同步系统
  registerVideoToSyncSystem();
}

// 🎯 初始化 FLV.js 播放器
function initFlvPlayer(streamUrl) {
  try {
    // 检查浏览器是否支持 FLV.js
    if (!flvjs.isSupported()) {
      console.warn('[VideoPreview] 浏览器不支持 FLV.js，回退到原生播放');
      videoRef.value.src = streamUrl;
      videoRef.value.load();
      useNativeVideo.value = true;
      return;
    }

    console.log('[VideoPreview] 初始化 FLV.js 播放器:', streamUrl);

    // 创建 FLV 播放器实例
    flvPlayer = flvjs.createPlayer({
      type: 'flv',
      url: streamUrl,
      isLive: false,  // 本地视频文件不是直播
      hasAudio: true,
      hasVideo: true,
    }, {
      enableWorker: true,              // 启用 Web Worker
      enableStashBuffer: false,        // 禁用缓存缓冲（降低延迟）
      stashInitialSize: 128,           // 初始缓存大小
      lazyLoad: false,                 // 禁用延迟加载
      lazyLoadMaxDuration: 0,          // 不限制最大持续时间
      deferLoadAfterSourceOpen: false, // 不延迟加载
    });

    // 附加到 video 元素
    flvPlayer.attachMediaElement(videoRef.value);

    // 加载并播放
    flvPlayer.load();
    flvPlayer.play().then(() => {
      console.log('[VideoPreview] FLV 播放开始');
      streamConnected.value = true;
    }).catch(err => {
      console.error('[VideoPreview] FLV 播放失败:', err);
      streamConnected.value = false;
      // 回退到原生播放
      videoRef.value.src = streamUrl;
      videoRef.value.load();
      useNativeVideo.value = true;
    });

    // 监听事件
    flvPlayer.on(flvjs.Events.MEDIA_INFO, (mediaInfo) => {
      console.log('[VideoPreview] 媒体信息:', mediaInfo);
      streamConnected.value = true;
    });

    flvPlayer.on(flvjs.Events.STATISTICS_INFO, (stats) => {
      console.log('[VideoPreview] 统计信息:', stats);
    });

    flvPlayer.on(flvjs.Events.ERROR, (errorType, errorDetail, errorInfo) => {
      console.error('[VideoPreview] FLV 错误:', errorType, errorDetail, errorInfo);
      streamConnected.value = false;

      // 尝试重连
      setTimeout(() => {
        if (flvPlayer) {
          try {
            flvPlayer.unload();
            flvPlayer.load();
            flvPlayer.play();
            console.log('[VideoPreview] FLV 重连成功');
            streamConnected.value = true;
          } catch (e) {
            console.error('[VideoPreview] FLV 重连失败:', e);
          }
        }
      }, 3000);
    });

  } catch (error) {
    console.error('[VideoPreview] 初始化 FLV 播放器失败:', error);
    // 回退到原生播放
    videoRef.value.src = streamUrl;
    videoRef.value.load();
    useNativeVideo.value = true;
  }
}

// 🎯 清理 FLV 播放器
function cleanupFlvPlayer() {
  if (flvPlayer) {
    try {
      console.log('[VideoPreview] 清理 FLV 播放器');
      flvPlayer.pause();
      flvPlayer.unload();
      flvPlayer.detachMediaElement();
      flvPlayer.destroy();
      flvPlayer = null;
    } catch (error) {
      console.error('[VideoPreview] 清理 FLV 播放器失败:', error);
    }
  }
  isStreaming.value = false;
  streamConnected.value = false;
}

// ========== 同步更新方法 ==========
/**
 * 接收同步更新（已弃用）
 *
 * 注意：此方法已不再被调用。
 * 新架构使用 SyncStateReplicator 直接操作 DOM 视频元素进行同步。
 * 保留此方法仅为兼容性考虑。
 */
function onSyncUpdate(data) {
  try {
    const { currentTime, duration, isPlaying, percent, source } = data;

    if (!videoRef.value) {
      console.warn('[VideoPreview.onSyncUpdate] videoRef 不存在');
      return;
    }

    console.log(`[VideoPreview.onSyncUpdate] 画布 ${props.index} 收到同步数据:`, {
      currentTime: currentTime?.toFixed(2),
      duration: duration?.toFixed(2),
      isPlaying,
      source
    });

    // 同步时间点
    if (currentTime !== undefined && !isNaN(currentTime)) {
      const timeDiff = Math.abs(videoRef.value.currentTime - currentTime);

      // 只在时间差大于阈值时才跳转，避免频繁操作
      if (timeDiff > 0.1) {
        console.log(`[VideoPreview.onSyncUpdate] 同步时间: ${videoRef.value.currentTime.toFixed(2)} -> ${currentTime.toFixed(2)}, 偏差: ${timeDiff.toFixed(2)}s`);
        videoRef.value.currentTime = currentTime;
      }
    }

    // 同步播放状态
    if (isPlaying !== undefined) {
      if (isPlaying && videoRef.value.paused) {
        videoRef.value.play().catch(err => {
          console.warn('[VideoPreview.onSyncUpdate] 播放失败:', err);
        });
        console.log(`[VideoPreview.onSyncUpdate] 同步播放状态: 播放`);
      } else if (!isPlaying && !videoRef.value.paused) {
        videoRef.value.pause();
        console.log(`[VideoPreview.onSyncUpdate] 同步播放状态: 暂停`);
      }
    }

  } catch (error) {
    console.error('[VideoPreview.onSyncUpdate] 同步更新失败:', error);
  }
}

// 暴露方法
defineExpose({
  refreshCamera: startUSBCamera,
  startRecording,
  stopRecording,
  isRecording: () => isRecording.value,
  isRecordingPaused: () => isRecordingPaused.value,
  setSourceType,
  setVideoFile,
  clearVideoSource, // 🎯 清空视频源（释放 blob URL）
  clearVideoSourceWithoutRevoke, // 🎯 清空视频源（保留 blob URL）
  setStreamUrl, // 🎯 新增：支持 ZLMediaKit 流
  setScreenStream: (screenStream) => {
    if (videoRef.value) {
      videoRef.value.srcObject = screenStream;
      videoRef.value.play();
    }
    stream.value = screenStream;
  },
  clearAnnotation,
  saveAnnotation,
  initializeAnnotationCanvas,
  onSyncUpdate,
  getCurrentTime: () => {
    // 获取当前视频播放时间（秒）
    return videoRef.value ? videoRef.value.currentTime : 0;
  },
  getVideoElement: () => videoRef.value,
  videoRef
});
</script>

<style lang="scss" scoped>
.video-preview {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: #000;
  border-radius: 0;
  overflow: hidden;
  // 确保能接收拖曳事件
  pointer-events: auto;
}

.video-container {
  flex: 1;
  position: relative;
  background: #000;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  min-width: 0;
  // 确保能接收拖曳事件
  pointer-events: auto;

  .video-element {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    display: block;
    // 🎯 修复：确保视频元素有明确的尺寸
    min-width: 1px;
    min-height: 1px;
    // 🎯 修复：添加背景色以便调试
    background-color: #000;
    // video 元素不阻止拖曳事件
    pointer-events: none;
    // 🎯 修复：优化渲染性能
    transform: translateZ(0);
    will-change: transform;
  }

  // 🎯 视频加载状态
  .video-loading {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.7);
    z-index: 20;

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    .loading-text {
      margin-top: 16px;
      color: #fff;
      font-size: 14px;
    }
  }

  // 🎯 视频错误状态
  .video-error {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.8);
    z-index: 20;

    .error-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .error-text {
      color: #fff;
      font-size: 16px;
      text-align: center;
      padding: 0 20px;
    }
  }

  .recording-indicator {
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(230, 57, 70, 0.9);
    color: white;
    padding: 6px 12px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    z-index: 10;

    .rec-dot {
      width: 10px;
      height: 10px;
      background: #fff;
      border-radius: 50%;
      animation: pulse 1s infinite;
    }
  }

  // 字幕叠加层
  .subtitle-overlay {
    position: absolute;
    bottom: 60px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.5); // 更透明的背景
    color: white;
    padding: 8px 20px; // 减小内边距
    border-radius: 6px;
    font-size: 18px;
    line-height: 1.5;
    text-align: center;
    max-width: 85%; // 调整宽度
    width: auto; // 宽度自适应
    min-width: 180px; // 最小宽度
    z-index: 15;
    pointer-events: none;
    height: auto; // 高度自适应

    .subtitle-text {
      word-wrap: break-word;
      white-space: pre-wrap;
    }
  }

  // 🎯 流媒体状态指示器
  .streaming-indicator {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(40, 167, 69, 0.9);
    color: white;
    padding: 6px 12px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    z-index: 10;
    transition: all 0.3s;

    .stream-dot {
      width: 8px;
      height: 8px;
      background: rgba(255, 255, 255, 0.5);
      border-radius: 50%;
      animation: pulse 1.5s infinite;

      &.connected {
        background: #28a745;
        animation: none;
      }
    }
  }

  // PTZ 控制按钮
  .ptz-toggle-btn {
    position: absolute;
    top: 10px;
    left: 10px;
    width: 40px;
    height: 40px;
    background: rgba(76, 201, 240, 0.9);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 10;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);

    &:hover {
      background: rgba(76, 201, 240, 1);
      transform: scale(1.1);
    }

    &:active {
      transform: scale(0.95);
    }

    .ptz-icon {
      font-size: 20px;
    }
  }

  .annotation-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 5;
    cursor: crosshair;
    pointer-events: auto;
  }
}

.control-bar {
  background: #1B263B;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  min-height: 60px;

  .stream-info {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .playback-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    flex: 1;

    .time-display {
      color: #fff;
      font-size: 14px;
      font-family: monospace;
      min-width: 100px;
      text-align: center;
    }

    .progress-slider {
      flex: 1;
      min-width: 200px;
      max-width: 400px;

      :deep(.el-slider__runway) {
        background-color: rgba(255, 255, 255, 0.3);
      }

      :deep(.el-slider__bar) {
        background-color: #409EFF;
      }

      :deep(.el-slider__button) {
        border-color: #409EFF;
      }
    }
  }

  .record-controls {
    flex-shrink: 0;
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
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
