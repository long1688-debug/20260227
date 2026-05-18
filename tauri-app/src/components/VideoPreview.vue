<template>
  <div class="video-preview" @drop.prevent="onContainerDrop" @dragover.prevent="onContainerDragOver"
    @dragenter.prevent="onContainerDragEnter">
    <!-- 视频预览区域 -->
    <div class="video-container" @dblclick="onCanvasDoubleClick">
      <!-- 🎯 ZLMediaKit 流媒体播放 -->
      <video v-if="!useNativeVideo" ref="videoRef" class="video-element" autoplay playsinline muted
        @loadedmetadata="onVideoLoadedMetadata" @play="onVideoPlay"></video>

      <!-- 🎯 本地视频/摄像头（原生 video 标签） -->
      <video v-else ref="videoRef" class="video-element" autoplay playsinline muted
        @loadedmetadata="onVideoLoadedMetadata" @play="onVideoPlay" @pause="onVideoPause" @error="onVideoError"
        @canplay="onVideoCanPlay" @waiting="onVideoWaiting" @stalled="onVideoStalled" @ended="onVideoEnded"></video>

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

      <!-- 实时字幕叠加层 - 显示在视频区域内下方 -->
      <div v-if="showRealtimeSubtitle && (subtitleText || realtimeSubtitleText)" class="subtitle-overlay">
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
      <PtzControlPanel v-if="showPtzPanel" :visible="showPtzPanel" :device-config="onvifConfig"
        @close="showPtzPanel = false" />

      <!-- 批注画布 -->
      <canvas v-if="annotationEnabled" ref="annotationCanvasRef" class="annotation-canvas" @mousedown="startAnnotation"
        @mousemove="drawAnnotation" @mouseup="stopAnnotation" @mouseleave="stopAnnotation"></canvas>
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
        <el-button :icon="isPaused ? 'VideoPlay' : 'VideoPause'" @click="togglePlayPause" circle size="small" />

        <!-- 时间显示 -->
        <span class="time-display">
          {{ formatTime(videoRef.currentTime) }} / {{ formatTime(videoRef.duration) }}
        </span>

        <!-- 进度条 -->
        <el-slider v-model="progress" :max="100" @change="onProgressChange" @input="onProgressInput"
          class="progress-slider" :show-tooltip="false" />

        <!-- 播放速度 -->
        <el-select v-model="playbackRate" @change="changePlaybackRate" size="small" style="width: 80px">
          <el-option label="0.5x" :value="0.5" />
          <el-option label="1.0x" :value="1.0" />
          <el-option label="1.5x" :value="1.5" />
          <el-option label="2.0x" :value="2.0" />
        </el-select>
      </div>

      <!-- 录制控制 -->
      <div class="record-controls">
        <el-button :type="isRecording ? 'danger' : 'primary'" :icon="isRecording ? 'Close' : VideoCamera"
          @click="toggleRecording">
          {{ isRecording ? '停止录制' : '开始录制' }}
        </el-button>

        <!-- 实时字幕控制 -->
        <el-button :type="isRecognizing ? 'warning' : 'success'" @click="toggleRealtimeSubtitle">
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
import { useSourceStore } from '@/stores/sourceStore';

// 🎯 初始化视频源管理器
const videoSourceManager = useVideoSourceManager();
const sourceStore = useSourceStore();

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
  },
  showRealtimeSubtitle: {
    type: Boolean,
    default: false
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
    // flv.js 通过 SourceBuffer 推送数据，不设置 src/srcObject，
    // _flvPlayer 存在即为有效流，不可因为 src 为空而跳过注册。
    const hasFlvPlayer = videoRef.value._flvPlayer && typeof videoRef.value._flvPlayer.destroy === 'function';
    const hasVideoSource = videoRef.value.src || videoRef.value.srcObject || hasFlvPlayer;
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

    // ⚠️ 延迟注册：给 flvPlayer 挂载留出时间（200ms）。
    // flvPlayer 加载后（主路径 ~1100 行或 _flvPlayer watcher）会完成注册。
    setTimeout(() => {
      if (!isRegistered.value && props.sourceId && videoRef.value) {
        const hasFlvPlayer = videoRef.value._flvPlayer && typeof videoRef.value._flvPlayer.destroy === 'function';
        if (hasFlvPlayer || videoRef.value.src || videoRef.value.srcObject) {
          console.log(`[VideoPreview.watch] sourceId 切换后延迟注册: ${props.sourceId}`);
          registerVideoToSyncSystem();
        } else {
          console.warn(`[VideoPreview.watch] sourceId 切换 200ms 后仍无源，放弃延迟注册: ${props.sourceId}`);
        }
      }
    }, 200);
  }
});

// ======================================================
// 🎯 _flvPlayer 赋值后补注册（时序兜底 - 独立 watcher）
// ======================================================
// 画布 VideoPreview 挂载时，sourceId watcher 先触发，
// 此时 flv.js 刚 attachMediaElement，_flvPlayer 尚未来得及写入。
// 此 watcher 在 _flvPlayer 同步赋值后立即触发，消除时序差。
let _flvPlayerWatcherTriggered = false;
watch(
  () => videoRef.value?._flvPlayer,
  (newPlayer, oldPlayer) => {
    if (!newPlayer || !props.sourceId) return;
    if (isRegistered.value) return;
    if (_flvPlayerWatcherTriggered) return;
    _flvPlayerWatcherTriggered = true;
    console.log(`[VideoPreview.watch] _flvPlayer 已赋值（时序兜底），触发注册: ${props.sourceId}`);
    nextTick(() => registerVideoToSyncSystem());
  }
);

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

  // 🎯 关键修复：如果播放器正在销毁，跳过注册
  if (videoRef.value?._isDestroying) {
    console.log(`[VideoPreview.registerVideoToSyncSystem] 播放器正在销毁，跳过注册: ${props.sourceId}`);
    return;
  }

  // 检查是否有有效的视频源（含 FLV 播放器实例）
  // flv.js 通过 MediaSource 写入 SourceBuffer，不设置 src/srcObject，
  // 此时 src 和 srcObject 均为空，但 _flvPlayer 存在表示视频已就绪。
  const hasVideoSource =
    videoRef.value.src ||
    videoRef.value.srcObject ||
    // FLV 播放器：即使 src/srcObject 为空，_flvPlayer 存在即为有效流
    (videoRef.value._flvPlayer && typeof videoRef.value._flvPlayer.destroy === 'function');
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
    registerMasterVideo(videoRef.value, props.videoSource || props.sourceId);
    console.log(`[VideoPreview] 主控视频已手动注册: ${props.sourceId}`);
  } else {
    // 🎯 关键修复：传递完整的 videoSource 对象，而不是仅传递 sourceId
    // 这样 useVideoSync 可以检测到 isClone 和 originalStreamId 属性
    const sourceToRegister = props.videoSource || props.sourceId;
    registerSlaveVideo(videoRef.value, props.index, sourceToRegister);
    console.log(`[VideoPreview] 从属视频已手动注册: ${props.sourceId}, isClone: ${props.videoSource?.isClone || false}`);
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
  // flv.js：通过 FLV 播放器实例检测有效流（其 src/srcObject 始终为空）
  const hasVideoSourceFromFlv = !!videoRef.value._flvPlayer && typeof videoRef.value._flvPlayer.destroy === 'function';
  const hasVideoSource = videoRef.value.src || videoRef.value.srcObject || hasVideoSourceFromFlv;
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
      registerMasterVideo(videoRef.value, props.videoSource || props.sourceId);
      console.log(`[VideoPreview] 主控视频已注册: ${props.sourceId}`);
    } else {
      // 🎯 关键修复：传递完整的 videoSource 对象，而不是仅传递 sourceId
      // 这样 useVideoSync 可以检测到 isClone 和 originalStreamId 属性
      const sourceToRegister = props.videoSource || props.sourceId;
      registerSlaveVideo(videoRef.value, props.index, sourceToRegister);
      console.log(`[VideoPreview] 从属视频已注册: ${props.sourceId}, isClone: ${props.videoSource?.isClone || false}`);
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
  await nextTick();

  if (videoRef.value) {
    const videoElement = videoRef.value;
    console.log('[VideoPreview.onMounted] 视频元素已准备好');

    videoElement.style.width = '100%';
    videoElement.style.height = '100%';
    videoElement.style.objectFit = 'contain';
    videoElement.style.backgroundColor = '#000';

    videoElement.addEventListener('click', () => {
      if (videoElement.paused) {
        videoElement.play().catch(err => {
          console.warn('[VideoPreview] 点击播放失败:', err);
        });
      }
    });
  }

  if (props.videoSource) {
    console.log('[VideoPreview.onMounted] 检测到videoSource，准备加载:', props.videoSource.type, props.videoSource.name);

    const cameraTypes = ['camera', 'usb', 'localCamera'];
    const isCameraSource = cameraTypes.includes(props.videoSource.type);

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

  if (props.index === 0) {
    clearMasterVideo(props.sourceId);
  } else if (props.sourceId) {
    // 🎯 关键修复：传递完整的 videoSource 对象，以便正确移除克隆源
    const sourceToUnregister = props.videoSource || props.sourceId;
    unregisterSlaveVideo(props.index, sourceToUnregister);
  }
});

// 暴露调试函数到window对象
if (typeof window !== 'undefined') {
  window.__testOnvifConnection = testOnvifConnection;
  console.log('[VideoPreview] 调试函数已暴露: window.__testOnvifConnection(ip, port, username, password)');
}

// 启动 USB 摄像头
async function startUSBCamera(sourceData = null) {
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

// 已验证的 RTSP 地址映射表（用于 ONVIF 失败时的回退）
const VERIFIED_RTSP_URLS = {
  // '192.168.5.165': 'rtsp://192.168.5.165:554/live/av0',  // 已通过 VLC 验证
  // 添加更多已验证的设备...
};

// 🚫 品牌 RTSP 地址模板库已删除，强制使用 ONVIF 协议获取真实 RTSP 地址
const BRAND_RTSP_TEMPLATES = {
  generic: [
    'rtsp://{ip}:554/stream',
    'rtsp://{ip}:554/live/av0'
  ]
};

// 尝试常见的RTSP地址模板（智能回退策略）
async function tryRtspTemplates(ip, username, password, sourceData) {
  console.log('[VideoPreview] 尝试RTSP地址模板:', ip);

  // 🎯 策略 0: 如果用户已经提供了具体的RTSP地址，优先使用用户输入的地址
  if (sourceData?.streamUrl && sourceData.streamUrl.startsWith('rtsp://')) {
    console.log('[VideoPreview] ✅ 策略0 - 使用用户输入的 RTSP 地址:', sourceData.streamUrl);
    return sourceData.streamUrl;
  }

  //  策略 1: 优先检查是否有已验证的 RTSP 地址
  if (VERIFIED_RTSP_URLS[ip]) {
    console.log('[VideoPreview] ✅ 策略1 - 使用已验证的 RTSP 地址:', VERIFIED_RTSP_URLS[ip]);
    return VERIFIED_RTSP_URLS[ip];
  }

  // 🚫 策略 2 已删除：不再基于品牌识别使用模板
  // 强制使用 ONVIF 协议获取真实 RTSP 地址

  // 🎯 策略 3: 使用通用模板
  console.log('[VideoPreview] 🔍 策略3 - 使用通用模板');
  const genericTemplates = BRAND_RTSP_TEMPLATES.generic;
  const url = genericTemplates[0].replace('{ip}', ip);
  console.log('[VideoPreview] ✅ 策略3 - 使用通用模板地址:', url);
  return url;
}

// 调试函数：测试ONVIF连接
async function testOnvifConnection(ip, port, username, password) {
  console.log('[VideoPreview] 开始测试ONVIF连接:', { ip, port, username: username || '空' });

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const result = await invoke('test_onvif_connection', {
      ip,
      port,
      username: username || '',
      password: password || ''
    });

    console.log('[VideoPreview] ONVIF连接测试结果:', result);
    return result;
  } catch (e) {
    console.error('[VideoPreview] ONVIF连接测试失败:', e);
    throw e;
  }
}

// 🎯 新增：快速测试RTSP连接（TCP握手）
async function testRtspConnection(rtspUrl) {
  try {
    // 解析RTSP URL获取主机和端口
    const urlObj = new URL(rtspUrl);
    const hostname = urlObj.hostname;
    const port = urlObj.port || 554;  // RTSP默认端口

    console.log(`[VideoPreview] 测试RTSP连接: ${hostname}:${port}`);

    // 🎯 使用Tauri后端进行TCP连接测试（避免CORS问题）
    const { invoke } = await import('@tauri-apps/api/core');

    // 调用后端的TCP连接测试
    const result = await invoke('test_tcp_connection', {
      host: hostname,
      port: parseInt(port),
      timeout: 2000  // 2秒超时
    }).catch(err => {
      console.warn('[VideoPreview] TCP连接测试API调用失败，跳过验证:', err);
      return true;  // 如果API不可用，跳过验证（保守策略）
    });

    console.log(`[VideoPreview] RTSP连接测试结果:`, result);
    return result === true || result?.success === true;
  } catch (e) {
    console.warn('[VideoPreview] RTSP连接测试异常，跳过验证:', e);
    return true;  // 异常时跳过验证，避免误判
  }
}

// 🎯 新增：验证用户输入的RTSP地址
async function validateUserRtspUrl(rtspUrl, sourceData) {
  console.log('[VideoPreview] 🔍 开始验证用户输入的RTSP地址:', rtspUrl);

  // 1. 基本格式验证
  if (!rtspUrl || !rtspUrl.startsWith('rtsp://')) {
    console.error('[VideoPreview] ❌ RTSP地址格式错误:', rtspUrl);
    return {
      valid: false,
      error: 'RTSP地址格式错误，必须以 rtsp:// 开头'
    };
  }

  // 2. 解析URL检查基本结构
  try {
    const urlObj = new URL(rtspUrl);
    if (!urlObj.hostname) {
      return {
        valid: false,
        error: 'RTSP地址缺少主机名'
      };
    }
  } catch (e) {
    console.error('[VideoPreview] ❌ RTSP地址解析失败:', e);
    return {
      valid: false,
      error: `RTSP地址格式无效: ${e.message}`
    };
  }

  // 3. TCP连接测试（快速验证网络可达性）
  console.log('[VideoPreview] 📡 进行TCP连接测试...');
  const tcpResult = await testRtspConnection(rtspUrl);

  if (!tcpResult) {
    console.warn('[VideoPreview] ⚠️ TCP连接测试失败，但继续尝试播放');
    // TCP失败不一定代表RTSP无效，可能是防火墙阻止了TCP探测
    // 所以这里只警告，不直接返回失败
  }

  // 4. 🎯 使用后端ZLMediaKit进行完整RTSP验证（可选，耗时较长）
  // 这里我们选择先尝试播放，让FFmpeg来最终验证
  console.log('[VideoPreview] ✅ RTSP地址基础验证通过，将进行实际播放测试');

  return {
    valid: true,
    warning: tcpResult ? null : 'TCP连接测试失败，但将继续尝试播放'
  };
}

// 确保ZLMediaKit流媒体服务已启动
async function ensureZLMediaKitRunning(invoke) {
  console.log('[VideoPreview] 检查ZLMediaKit状态...');

  try {
    const status = await invoke('check_zlmediakit_status');
    console.log('[VideoPreview] ZLMediaKit状态:', status);

    if (!status.running) {
      console.log('[VideoPreview] ZLMediaKit未运行，尝试启动...');
      const result = await invoke('start_zlmediakit');
      console.log('[VideoPreview] ZLMediaKit启动结果:', result);

      // 等待服务启动
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } catch (e) {
    console.warn('[VideoPreview] ZLMediaKit检查/启动失败:', e);
  }
}

// 🆕 确保 ZLMediaKit 流媒体服务已启动（WebRTC + FLV）
async function ensureRtspProxyRunning(invoke) {
  console.log('[VideoPreview] 检查ZLMediaKit流媒体服务状态...');

  try {
    // 🎯 先通过HTTP健康检查判断服务是否真正运行
    let serviceRunning = false;

    try {
      console.log('[VideoPreview] 尝试HTTP健康检查...');
      const response = await fetch('/index/api/getServerInfo', {
        method: 'GET',
        mode: 'cors',
        signal: AbortSignal.timeout(3000)
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[VideoPreview] ✅ ZLMediaKit服务已通过HTTP健康检查:', data);
        serviceRunning = true;
      } else {
        console.warn('[VideoPreview] ⚠️ HTTP健康检查失败，HTTP状态:', response.status);
      }
    } catch (e) {
      console.warn('[VideoPreview] ⚠️ HTTP健康检查异常:', e.message);
      console.warn('[VideoPreview] 将尝试通过Tauri API检查和启动...');
    }

    // 如果HTTP检查成功，直接返回
    if (serviceRunning) {
      return;
    }

    // 如果HTTP检查失败，再使用Tauri API
    console.log('[VideoPreview] 调用Tauri API检查ZLMediaKit状态...');
    const status = await invoke('check_rtsp_proxy_status');
    console.log('[VideoPreview] ZLMediaKit状态:', status);

    if (!status.running) {
      console.log('[VideoPreview] ZLMediaKit未运行，尝试启动...');
      const result = await invoke('start_rtsp_proxy');
      console.log('[VideoPreview] ZLMediaKit启动结果:', result);

      // 等待服务启动
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else {
      console.log('[VideoPreview] ✅ Tauri API检测到服务已在运行');
    }
  } catch (e) {
    console.error('[VideoPreview] ❌ ZLMediaKit检查/启动失败:', e);
    // 即使检查失败，也继续尝试（可能服务已在外部运行）
    console.warn('[VideoPreview] 警告：服务检查失败，但仍将尝试连接...');
  }
}

// 启动网络摄像头（RTSP流或ONVIF流）
async function startNetworkCamera(sourceData) {
  try {
    console.log('[VideoPreview] 启动网络摄像头:', sourceData);

    if (!videoRef.value) {
      console.error('[VideoPreview] 视频元素不存在');
      return;
    }

    videoLoading.value = true;
    videoError.value = null;

    // 🎯 关键修复：重新从store获取最新的源数据，确保使用更新后的数据
    const currentSource = sourceStore.sources.find(s => s.id === props.sourceId);
    if (currentSource) {
      sourceData = { ...sourceData, ...currentSource };
      console.log('[VideoPreview] ✅ 使用最新的源数据:', {
        id: sourceData.id,
        protocol: sourceData.protocol,
        streamUrl: sourceData.streamUrl
      });
    }

    // 获取RTSP URL
    let rtspUrl = sourceData?.streamUrl || sourceData?.url;

    // 🎯 修复：如果 streamUrl 是 ONVIF 端点但协议是 ONVIF，清空它让它走 ONVIF 获取流程
    if (sourceData?.protocol === 'onvif' && rtspUrl && /^https?:\/\/[^/]+\/onvif\//i.test(rtspUrl)) {
      console.warn('[VideoPreview] ⚠️ 检测到 streamUrl 是 ONVIF 端点，将通过 ONVIF 协议获取 RTSP 流地址');
      rtspUrl = '';
    }

    // 🎯 关键优化：如果用户已经提供了RTSP地址，直接播放，不需要ONVIF探测
    if (rtspUrl && rtspUrl.startsWith('rtsp://')) {
      console.log('[VideoPreview] ✅ 检测到用户提供的RTSP地址，直接播放:', rtspUrl);
      console.log('[VideoPreview] 💡 提示：如需云台控制，请确保摄像机支持ONVIF协议');

      // 直接跳转到播放流程，跳过ONVIF探测
      // 后续的代码会处理RTSP代理启动和FLV播放
    }
    // ONVIF协议处理：仅当没有RTSP地址时才通过ONVIF获取
    else if (sourceData?.protocol === 'onvif' && !rtspUrl) {
      console.log('[VideoPreview] 🔄 ONVIF协议，开始通过ONVIF获取RTSP流地址');
      console.log('[VideoPreview] 完整源数据:', JSON.stringify(sourceData, null, 2));

      // 获取IP地址
      let ip;
      let onvifPort;

      if (sourceData?.cameraIp) {
        ip = sourceData.cameraIp;
        console.log('[VideoPreview] 从 cameraIp 获取IP:', ip);
      } else if (sourceData?.onvifUrl) {
        const url = new URL(sourceData.onvifUrl);
        ip = url.hostname;
        onvifPort = url.port ? parseInt(url.port) : 2000;
        console.log('[VideoPreview] 从 onvifUrl 解析IP和端口:', { ip, onvifPort });
      } else {
        throw new Error('未提供摄像机IP地址');
      }

      // 优先使用用户配置的ONVIF端口
      if (sourceData?.onvifPort) {
        onvifPort = sourceData.onvifPort;
        console.log('[VideoPreview] 使用用户配置的ONVIF端口:', onvifPort);
      }

      // 🎯 关键修复：定义常见的ONVIF端口列表，但增加智能过滤
      // 优先尝试用户配置的端口，其他端口需要验证是否为真正的摄像机
      const onvifPorts = [
        onvifPort || sourceData?.onvifPort || 2000,  // 用户配置的端口或默认ONVIF端口（高优先级）
      ];

      // 🎯 只有在用户未配置端口时，才尝试其他常见端口（需要严格验证）
      if (!sourceData?.onvifPort) {
        // 添加其他常见端口，但会在后续步骤中严格验证
        const additionalPorts = [
          80,    // HTTP默认端口（很多摄像机使用）
          8080,  // 常见替代端口
          8899,  // 常用端口
          5000,  // 常用端口
          37777, // 常用端口
          8000,  // 其他品牌常用
        ];
        onvifPorts.push(...additionalPorts);
      }

      console.log('[VideoPreview] ONVIF端口列表:', onvifPorts);
      console.log('[VideoPreview] 用户配置端口:', sourceData?.onvifPort || '未配置');

      // 去重并保持顺序
      const uniquePorts = [...new Set(onvifPorts)];
      console.log('[VideoPreview] 将尝试的ONVIF端口:', uniquePorts);

      // 🎯 显示ONVIF探测提示
      ElMessage.info({
        message: `正在通过ONVIF协议获取RTSP地址（最多15秒）...`,
        duration: 3000
      });

      // 尝试ONVIF协议获取RTSP流地址
      const { invoke } = await import('@tauri-apps/api/core');
      let onvifSuccess = false;
      let verifiedPort = null;  // 🎯 记录验证成功的端口

      for (const port of uniquePorts) {
        try {
          console.log(`[VideoPreview] 尝试ONVIF端口 ${port}...`);

          const result = await invoke('get_onvif_stream_uri', {
            ip: ip,
            port: port,
            username: sourceData?.username || '',
            password: sourceData?.password || ''
          });

          console.log('[VideoPreview] ONVIF返回结果:', result);

          if (result && result.uri) {
            // 🎯 关键验证：检查返回的URI是否为有效的RTSP地址
            const rtspUri = result.uri;

            // 验证1：必须是rtsp://或rtsps://开头
            if (!rtspUri.startsWith('rtsp://') && !rtspUri.startsWith('rtsps://')) {
              console.warn(`[VideoPreview] ⚠️ 端口 ${port} 返回的不是RTSP地址:`, rtspUri);
              continue;
            }

            // 验证2：RTSP地址必须包含IP地址（不能是localhost或无效地址）
            try {
              const urlObj = new URL(rtspUri);
              const hostname = urlObj.hostname;

              // 排除本地地址和无效地址
              if (hostname === 'localhost' ||
                  hostname === '127.0.0.1' ||
                  hostname === '0.0.0.0' ||
                  !hostname.includes('.')) {
                console.warn(`[VideoPreview] ⚠️ 端口 ${port} 返回无效的RTSP主机:`, hostname);
                continue;
              }

              console.log(`[VideoPreview] ✅ 端口 ${port} 验证通过，RTSP地址有效`);
            } catch (e) {
              console.warn(`[VideoPreview] ⚠️ 端口 ${port} RTSP地址解析失败:`, e);
              continue;
            }

            // 验证3：可选 - 快速测试RTSP连接（TCP握手）
            // 🎯 修复：TCP探测失败不跳过该地址，可能是防火墙阻止了探测但RTSP实际可用
            const isRtspReachable = await testRtspConnection(rtspUri);
            if (!isRtspReachable) {
              console.warn(`[VideoPreview] ⚠️ 端口 ${port} RTSP地址TCP连接测试失败，但仍尝试使用:`, rtspUri);
              // 不再 continue，继续使用此地址（TCP探测不可靠，可能被防火墙拦截）
            }

            rtspUrl = rtspUri;
            verifiedPort = port;  // 🎯 记录验证成功的端口
            console.log('[VideoPreview] ✅ ONVIF获取RTSP流地址成功:', rtspUrl);
            console.log('[VideoPreview] ✅ 验证通过的端口:', verifiedPort);

            // 🎯 重要：尊重ONVIF返回的RTSP地址格式，不强制添加认证
            // ONVIF返回的地址可能已经包含认证，也可能是免密访问
            const hasAuthInUrl = rtspUrl.includes('@');
            if (hasAuthInUrl) {
              console.log('[VideoPreview] ℹ️ ONVIF返回的RTSP URL已包含认证信息');
            } else if (sourceData?.username || sourceData?.password) {
              // 🎯 修复：ONVIF返回的URL通常不含认证，需要手动注入用户名密码
              const username = sourceData.username || 'admin';
              const password = sourceData.password || '';
              rtspUrl = rtspUrl.replace('rtsp://', `rtsp://${username}:${password}@`);
              console.log('[VideoPreview] ✅ 已注入认证信息到ONVIF返回的RTSP URL:', username, '***');
            } else {
              console.log('[VideoPreview] ℹ️ ONVIF返回的RTSP URL无认证信息，尝试免密访问');
            }

            onvifSuccess = true;
            break;
          }
        } catch (e) {
          console.warn(`[VideoPreview] ONVIF端口 ${port} 失败:`, e.message || e);
        }
      }

      // 如果ONVIF获取失败，尝试使用常见的RTSP地址模板
      if (!onvifSuccess) {
        console.warn('[VideoPreview] ⚠️ ONVIF所有端口均失败，回退到RTSP地址模板');

        // 🎯 关键修复：如果用户已经提供了有效的RTSP地址，不要覆盖它
        if (rtspUrl && rtspUrl.startsWith('rtsp://')) {
          console.log('[VideoPreview] ✅ 用户已提供RTSP地址，保持使用:', rtspUrl);
          ElMessage.success({
            message: 'ONVIF探测未完成，但将使用您手动输入的RTSP地址',
            duration: 3000
          });
        } else {
          // 显示更详细的错误提示
          ElMessage.warning({
            message: 'ONVIF协议获取失败，将尝试常见RTSP地址模板。\n\n建议：\n1. 确认设备支持ONVIF协议\n2. 检查用户名/密码是否正确\n3. 在摄像机Web界面启用ONVIF服务\n4. 或手动输入RTSP地址',
            duration: 8000,
            showClose: true
          });

          // 🎯 新增：先尝试智能验证 RTSP 地址
          try {
            const { invoke } = await import('@tauri-apps/api/core');
            console.log('[VideoPreview] 🔍 开始智能 RTSP 地址验证...');

            const verifiedUrl = await invoke('try_multiple_rtsp_templates_cmd', {
              ip: ip,
              brand: sourceData?.brand || null
            }).catch(err => {
              console.warn('[VideoPreview] 智能验证失败，回退到模板:', err);
              return null;
            });

            if (verifiedUrl) {
              console.log('[VideoPreview] ✅ 智能验证成功，使用地址:', verifiedUrl);
              rtspUrl = verifiedUrl;
            } else {
              console.log('[VideoPreview] ⚠️ 智能验证失败，使用传统模板');
              rtspUrl = await tryRtspTemplates(ip, sourceData?.username, sourceData?.password, sourceData);
            }
          } catch (e) {
            console.error('[VideoPreview] RTSP 验证异常:', e);
            rtspUrl = await tryRtspTemplates(ip, sourceData?.username, sourceData?.password, sourceData);
          }
        }

        if (rtspUrl) {
          console.log('[VideoPreview] ✅ 最终使用的 RTSP 地址:', rtspUrl);
        } else {
          throw new Error('ONVIF获取失败且RTSP模板也无法生成地址');
        }
      }
    }

    if (!rtspUrl) {
      throw new Error('未提供视频流地址（RTSP或ONVIF服务地址）');
    }

    // 🎯 参考eb4项目：检查连接状态，如果正在后台连接中，等待完成
    if (sourceData?.loading || sourceData?.connectionStatus === 'connecting') {
      console.log('[VideoPreview] ⏳ 信号源正在后台连接中，等待ONVIF/RTSP解析完成...')

      // 🎯 监听重载事件，自动重新加载
      const reloadHandler = (event) => {
        if (event.detail.sourceId === props.sourceId) {
          console.log('[VideoPreview] 🔄 收到重载事件，重新加载视频流...')
          window.removeEventListener('reload-preview', reloadHandler)

          // 延迟后重新调用本函数
          setTimeout(() => {
            startNetworkCamera(sourceData)
          }, 500)
        }
      }

      window.addEventListener('reload-preview', reloadHandler)

      // 显示加载提示
      ElMessage.info({
        message: '正在连接网络摄像机...',
        duration: 3000
      })

      return  // 🎯 提前返回，不继续播放
    }

    console.log('[VideoPreview] 尝试加载视频流:', rtspUrl);

    // 🎯 新增：如果用户手动输入了RTSP地址，先进行验证
    const isUserProvided = sourceData?.streamUrl && sourceData.streamUrl.startsWith('rtsp://');
    if (isUserProvided) {
      console.log('[VideoPreview] 🔍 检测到用户输入的RTSP地址，开始验证...');

      // 显示加载提示
      ElMessage.info({
        message: '正在验证RTSP地址...',
        duration: 2000
      });

      try {
        const validationResult = await validateUserRtspUrl(rtspUrl, sourceData);

        if (!validationResult.valid) {
          console.error('[VideoPreview] ❌ RTSP地址验证失败:', validationResult.error);
          ElMessage.error({
            message: `RTSP地址验证失败：${validationResult.error}\n\n请检查：\n1. 地址格式是否正确\n2. 网络连接是否正常\n3. 用户名密码是否正确`,
            duration: 8000,
            showClose: true
          });
          videoLoading.value = false;
          videoError.value = validationResult.error;
          return; // 直接返回，不继续播放
        }

        // 如果有警告，显示给用户
        if (validationResult.warning) {
          console.warn('[VideoPreview] ⚠️ RTSP地址验证警告:', validationResult.warning);
          ElMessage.warning({
            message: validationResult.warning,
            duration: 5000,
            showClose: true
          });
        }

        console.log('[VideoPreview] ✅ RTSP地址验证通过');
      } catch (e) {
        console.error('[VideoPreview] ❌ RTSP地址验证过程出错:', e);
        // 验证过程出错，不阻止播放，但记录日志
        ElMessage.warning({
          message: 'RTSP地址验证过程出现异常，将尝试直接播放',
          duration: 3000
        });
      }
    }

    // 尝试使用 Tauri API 代理RTSP流
    try {
      const { invoke } = await import('@tauri-apps/api/core');

      // 🎯 关键修复：验证 URL 格式，确保不是 ONVIF 服务端点
      if (/^https?:\/\/[^/]+\/onvif\//i.test(rtspUrl)) {
        console.error('[VideoPreview] ❌ 无法使用 ONVIF 服务端点作为 RTSP 流地址:', rtspUrl);
        console.warn('[VideoPreview] ⚠️ 提示：请手动输入正确的 RTSP 地址');
        ElMessage.error({
          message: 'ONVIF解析失败，无法获取RTSP流地址。请重新添加信号源并输入正确的RTSP地址。',
          duration: 5000,
          showClose: true
        });
        return;  // 🎯 直接返回，不继续尝试播放
      }

      // 🎯 使用 ZLMediaKit 处理 RTSP 流
      await ensureZLMediaKitRunning(invoke);

      // 尝试启动RTSP代理
      // 🎯 关键修复：优先使用克隆源的 originalStreamId，复用预览区域的RTSP代理
      let streamId;
      if (sourceData?.originalStreamId) {
        // 克隆源，使用原始streamId复用已有的RTSP代理
        streamId = sourceData.originalStreamId;
        console.log('[VideoPreview] 克隆源检测到，复用原始streamId:', streamId);
      } else {
        // 原始源，生成新的streamId
        streamId = sourceData?.id ? `camera_${sourceData.id.split('_').pop()}` : `camera_${Date.now()}`;
        console.log('[VideoPreview] 原始源，生成新streamId:', streamId);
      }

      console.log('[VideoPreview] 启动RTSP代理:', rtspUrl);
      console.log('[VideoPreview] 使用streamId:', streamId);
      console.log('[VideoPreview] 源数据认证信息:', {
        needAuth: sourceData?.needAuth,
        username: sourceData?.username ? '***' : '空',
        password: sourceData?.password ? '***' : '空'
      });

      // 🎯 重要：智能处理RTSP地址（补全端口 + 条件注入认证）
      let finalRtspUrl = rtspUrl;

      // 🎯 步骤1：补全端口号（如果缺失）
      // rtsp://192.168.5.163/live/av0 -> rtsp://192.168.5.163:554/live/av0
      const urlWithoutAuth = rtspUrl.replace(/rtsp:\/\/[^@]*@/, 'rtsp://');
      const hostPart = urlWithoutAuth.split('/')[2] || '';
      const hasPort = /:\d+/.test(hostPart);

      if (!hasPort) {
        // 在主机名后添加默认端口554
        finalRtspUrl = rtspUrl.replace(/(rtsp:\/\/[^:/]+)(\/)/, '$1:554$2');
        console.log('[VideoPreview] ✅ 已补全默认端口554:', finalRtspUrl);
      }

      // 🎯 步骤2：条件注入认证信息
      const hasAuthInUrl = finalRtspUrl.includes('@');
      if (hasAuthInUrl) {
        console.log('[VideoPreview] ℹ️ RTSP URL已包含认证信息，保持不变');
      } else if (sourceData?.protocol === 'onvif' && (sourceData?.username || sourceData?.password)) {
        // ONVIF协议：只要有凭据就注入认证（ONVIF设备通常需要认证）
        const username = sourceData.username || 'admin';
        const password = sourceData.password || '';
        finalRtspUrl = finalRtspUrl.replace('rtsp://', `rtsp://${username}:${password}@`);
        console.log('[VideoPreview] ✅ ONVIF协议：已注入认证信息:', username, '***');
      } else if (sourceData?.protocol === 'rtsp' && sourceData?.needAuth && (sourceData?.username || sourceData?.password)) {
        // RTSP协议：只有明确标记需要认证(needAuth=true)时才注入
        const username = sourceData.username || 'admin';
        const password = sourceData.password || '';
        finalRtspUrl = finalRtspUrl.replace('rtsp://', `rtsp://${username}:${password}@`);
        console.log('[VideoPreview] ✅ RTSP协议：已注入认证信息(needAuth=true):', username, '***');
      } else {
        // 免密访问或用户未提供凭据或未标记需要认证
        console.log('[VideoPreview] ℹ️ RTSP URL无认证信息，尝试免密访问');
      }

      // 🎯 使用 ZLMediaKit 处理 RTSP 流（替代 Node.js 代理）
      console.log('[VideoPreview] 🚀 使用ZLMediaKit处理RTSP流...');

      // 确保ZLMediaKit服务已启动
      await ensureZLMediaKitRunning(invoke);

      // 准备代理选项（包含认证信息）
      const proxyOptions = {};
      if (sourceData?.username) {
        proxyOptions.username = sourceData.username;
      }
      if (sourceData?.password) {
        proxyOptions.password = sourceData.password;
      }

      const proxyResult = await invoke('proxy_network_stream', {
        streamUrl: finalRtspUrl,
        streamId: streamId,
        streamType: 'NetworkCamera',
        options: proxyOptions
      }).catch(err => {
        console.error('[VideoPreview] ZLMediaKit代理启动失败:', err);

        let errorMsg = 'RTSP流代理启动失败';
        if (typeof err === 'string') {
          if (err.includes('连接') || err.includes('connect')) {
            errorMsg = '无法连接到RTSP流，请检查地址和网络连接';
          } else {
            errorMsg = err;
          }
        }

        ElMessage.error({
          message: `${errorMsg}\n\n原始错误: ${err}`,
          duration: 8000,
          showClose: true
        });

        return null;
      });

      // 检查代理结果是否有效
      if (!proxyResult) {
        console.error('[VideoPreview] ❌ ZLMediaKit代理未返回有效结果');
        videoLoading.value = false;
        videoError.value = 'RTSP代理启动失败';
        return;
      }

      console.log('[VideoPreview] ZLMediaKit代理返回结果:', JSON.stringify(proxyResult, null, 2));

      // 使用代理后的FLV URL播放
      // 🎯 优化：优先使用 WebSocket-FLV 降低延迟
      let flvUrl = null;
      if (proxyResult) {
        // 🎯 优先使用 WebSocket-FLV（更低延迟）
        flvUrl = proxyResult.wsFlvUrl || proxyResult.ws_flv_url;
        // 如果没有WebSocket-FLV，回退到HTTP-FLV
        if (!flvUrl) {
          flvUrl = proxyResult.flvUrl || proxyResult.flv_url;
        }
      }

      if (flvUrl) {
        console.log('[VideoPreview] 使用代理后的FLV URL:', flvUrl);
        console.log('[VideoPreview] 使用协议:', flvUrl.startsWith('ws://') ? 'WebSocket-FLV (低延迟)' : 'HTTP-FLV');
        console.log('[VideoPreview] 代理返回结果:', JSON.stringify(proxyResult, null, 2));

        // 使用flv.js播放FLV流
        if (flvjs.isSupported()) {
          console.log('[VideoPreview] ✅ 创建FLV播放器...')

          // 🎯 先销毁旧播放器（如果存在）- 使用安全销毁流程
          if (videoRef.value._flvPlayer) {
            console.log('[VideoPreview] 销毁旧的FLV播放器')
            videoRef.value._isDestroying = true;  // 🎯 标记为正在销毁
            try {
              const oldPlayer = videoRef.value._flvPlayer;

              // 🎯 安全销毁：按顺序执行，每个步骤单独捕获异常
              try {
                oldPlayer.pause();
              } catch (e) {
                console.warn('[VideoPreview] pause失败:', e);
              }

              try {
                oldPlayer.unload();
              } catch (e) {
                console.warn('[VideoPreview] unload失败:', e);
              }

              try {
                oldPlayer.detachMediaElement();
              } catch (e) {
                console.warn('[VideoPreview] detachMediaElement失败:', e);
              }

              try {
                oldPlayer.destroy();
              } catch (e) {
                console.warn('[VideoPreview] destroy失败:', e);
              }

              videoRef.value._flvPlayer = null;
            } catch (e) {
              console.warn('[VideoPreview] 销毁旧播放器时出错:', e)
            } finally {
              videoRef.value._isDestroying = false;  // 🎯 销毁完成
            }
          }

          const flvPlayer = flvjs.createPlayer({
            type: 'flv',
            url: flvUrl,
            isLive: true,
            hasAudio: true,
            hasVideo: true
          }, {
            // 🎯 关键配置：修复flushStashedSamples错误，同时优化延迟
            enableWorker: false,              // 禁用Worker避免跨线程错误
            enableStashBuffer: true,          // ✅ 必须启用，否则会导致flushStashedSamples错误
            stashInitialSize: 1024,           // 初始缓冲 1KB（降低延迟）
            lazyLoad: false,                  // 禁用懒加载
            lazyLoadMaxDuration: 0,           // 不限制最大持续时间
            deferLoadAfterSourceOpen: false,  // 不延迟加载
            // 🎯 自动清理策略 - 控制内存和延迟
            autoCleanupSourceBuffer: true,    // 自动清理SourceBuffer
            autoCleanupMaxBackwardDuration: 1, // 最大向后保留1秒（降低延迟）
            autoCleanupMinBackwardDuration: 0.5,  // 最小向后保留0.5秒
            // 🎯 直播同步配置 - 极低延迟（局域网环境）
            liveSyncDuration: 0.5,               // 直播同步时长0.5秒（极低延迟）
            liveSyncDurationCount: 1,         // 直播同步帧数
            fixAudioTimestampGap: true        // 修正音频时间戳间隙
          });

          videoRef.value._flvPlayer = flvPlayer  // 🎯 保存播放器实例（后续 register 将通过 _flvPlayer 检测到与 flvPlayer 相同）

          // ======================================================
          // 🎯 时序兜底：flvPlayer 已创建，立即尝试注册
          // ======================================================
          // flv.js attachMediaElement + load() 是异步的，sourceId watcher
          // 可能已在 flvPlayer 附着之前先触发并跳过了注册。
          // 这里直接绕过 hasVideoSource 检查，确保 VideoSync/Slave 注册不丢失。
          if (!isRegistered.value && props.sourceId && videoRef.value) {
            console.log(`[VideoPreview] FLV播放器已创建，时序兜底触发注册: ${props.sourceId}`);
            if (props.index === 0) {
              registerMasterVideo(videoRef.value, props.videoSource || props.sourceId);
              console.log(`[VideoPreview] 时序兜底-主控注册: ${props.sourceId}`);
            } else {
              // 🎯 关键修复：传递完整的 videoSource 对象
              const sourceToRegister = props.videoSource || props.sourceId;
              registerSlaveVideo(videoRef.value, props.index, sourceToRegister);
              console.log(`[VideoPreview] 时序兜底-从属注册: ${props.sourceId}, isClone: ${props.videoSource?.isClone || false}`);
            }
            isRegistered.value = true;
            lastRegisteredSourceId = props.sourceId;
          }

          flvPlayer.attachMediaElement(videoRef.value);

          // 🎯 监听错误事件
          let retryCount = 0;
          const MAX_RETRIES = 3;

          flvPlayer.on(flvjs.Events.ERROR, (errorType, errorDetail, errorInfo) => {
            console.error('[VideoPreview] FLV播放错误:', errorType, errorDetail, errorInfo)

            // 🎯 关键修复：忽略播放器销毁过程中的错误
            if (videoRef.value?._isDestroying) {
              console.log('[VideoPreview] ℹ️ 播放器正在销毁，忽略错误')
              return
            }

            // 🎯 关键修复：遇到网络错误时尝试重新加载，最多重试3次
            if (errorType === 'NetworkError' && retryCount < MAX_RETRIES) {
              retryCount++;
              const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000); // 指数退避
              console.warn(`[VideoPreview] 网络错误，第${retryCount}次重试（延迟${delay}ms）...`);

              setTimeout(() => {
                try {
                  if (videoRef.value && videoRef.value._flvPlayer && !videoRef.value._isDestroying) {
                    // 🎯 先销毁旧播放器，再重新创建
                    console.log('[VideoPreview] 销毁旧的FLV播放器并重建...');
                    videoRef.value._isDestroying = true;  // 🎯 标记为正在销毁
                    const oldPlayer = videoRef.value._flvPlayer;

                    // 🎯 安全销毁：按顺序执行，每个步骤单独捕获异常
                    try {
                      oldPlayer.pause();
                    } catch (e) {
                      console.warn('[VideoPreview] pause失败:', e);
                    }

                    try {
                      oldPlayer.unload();
                    } catch (e) {
                      console.warn('[VideoPreview] unload失败:', e);
                    }

                    try {
                      oldPlayer.detachMediaElement();
                    } catch (e) {
                      console.warn('[VideoPreview] detachMediaElement失败:', e);
                    }

                    try {
                      oldPlayer.destroy();
                    } catch (e) {
                      console.warn('[VideoPreview] destroy失败:', e);
                    }

                    videoRef.value._flvPlayer = null;
                    videoRef.value._isDestroying = false;  // 🎯 销毁完成

                    // 重新创建播放器
                    const newFlvPlayer = flvjs.createPlayer({
                      type: 'flv',
                      url: flvUrl,
                      isLive: true,
                      hasAudio: true,
                      hasVideo: true
                    }, {
                      enableWorker: false,
                      enableStashBuffer: true,
                      stashInitialSize: 4096,            // 初始缓冲 4KB
                      lazyLoad: false,
                      lazyLoadMaxDuration: 0,
                      deferLoadAfterSourceOpen: false,
                      autoCleanupSourceBuffer: true,
                      autoCleanupMaxBackwardDuration: 2, // 最大向后保留2秒
                      autoCleanupMinBackwardDuration: 1,  // 最小向后保留1秒
                      liveSyncDuration: 1,               // 直播同步时长1秒（平滑低延迟）
                      liveSyncDurationCount: 1,          // 直播同步帧数
                      fixAudioTimestampGap: true
                    });

                    videoRef.value._flvPlayer = newFlvPlayer;
                    newFlvPlayer.attachMediaElement(videoRef.value);
                    newFlvPlayer.load();
                    newFlvPlayer.play().catch(err => {
                      console.warn('[VideoPreview] FLV重播失败:', err);
                    });
                  }
                } catch (e) {
                  console.error('[VideoPreview] FLV重加载失败:', e);
                }
              }, delay);
            } else if (retryCount >= MAX_RETRIES) {
              console.error('[VideoPreview] 达到最大重试次数，停止重试');
              videoLoading.value = false;
              videoError.value = `视频加载失败，已重试${MAX_RETRIES}次。请检查网络连接或手动刷新。`;
              ElMessage.error('视频加载失败，请手动刷新页面重试');
            }
          })

          flvPlayer.load();
          flvPlayer.play().catch(err => {
            console.warn('[VideoPreview] FLV播放失败:', err);
          });
        } else {
          // 备用方案：直接设置src（适用于HLS或其他HTTP流）
          videoRef.value.src = flvUrl;
          videoRef.value.load();
          videoRef.value.play().catch(err => {
            console.warn('[VideoPreview] HTTP流播放失败:', err);
          });
        }
      } else if (rtspUrl && (rtspUrl.startsWith('http') || rtspUrl.startsWith('ws'))) {
        // 如果代理失败但是HTTP/WS流，直接播放
        videoRef.value.src = rtspUrl;
        videoRef.value.load();
        videoRef.value.play().catch(err => {
          console.warn('[VideoPreview] HTTP流播放失败:', err);
        });
      } else if (rtspUrl) {
        // RTSP 地址非空，走代理分支，给一个加载提示（正常流程，非错误）
        console.warn('[VideoPreview] RTSP流需要通过后端代理转换');
        ElMessage.warning({
          message: 'RTSP流加载中，请等待后端代理转换...',
          duration: 3000
        });
      } else {
        // 🚨 真正无有效流地址：rtspUrl 为空 且 flvUrl 也为空，给用户明确提示
        const errorMsg = '未获取到有效的视频流地址。请检查：\n' +
          '1. ONVIF/RTSP 地址是否正确\n' +
          '2. 网络摄像机是否在线\n' +
          '3. 用户名/密码是否正确（如需认证）';
        ElMessage.error({ message: errorMsg, duration: 6000, showClose: true });
        console.error('[VideoPreview] ❌ 无法获取视频流地址:', {
          protocol: sourceData?.protocol,
          rtspUrl, onvifUrl: sourceData?.onvifUrl, cameraIp: sourceData?.cameraIp
        });
      }

      videoLoading.value = false;

    } catch (apiError) {
      console.error('[VideoPreview] Tauri API调用失败:', apiError);
      videoLoading.value = false;
      videoError.value = `网络摄像头加载失败: ${apiError.message}`;
      ElMessage.error(`网络摄像头加载失败: ${apiError.message}`);
    }

  } catch (error) {
    console.error('[VideoPreview] 启动网络摄像头失败:', error);
    videoLoading.value = false;
    videoError.value = `网络摄像头启动失败: ${error.message}`;
    ElMessage.error(`网络摄像头启动失败: ${error.message}`);
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
  } else if (newSource.type === 'camera' || newSource.type === 'usb' || newSource.type === 'localCamera' || newSource.type === 'localDevice') {
    console.log('[VideoPreview] 启动摄像头:', newSource.type, newSource.name);
    await startUSBCamera(newSource);
  } else if (newSource.type === 'networkCamera') {
    console.log('[VideoPreview] 加载网络摄像头:', newSource.name);
    await startNetworkCamera(newSource);
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
      stashInitialSize: 4096,           // 初始缓存大小 4KB
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

      // 🎯 关键修复：忽略播放器销毁过程中的错误
      if (videoRef.value?._isDestroying) {
        console.log('[VideoPreview] ℹ️ 播放器正在销毁，忽略错误')
        return
      }

      streamConnected.value = false;

      // 尝试重连
      setTimeout(() => {
        if (flvPlayer && !videoRef.value?._isDestroying) {
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

// 🎯 组件卸载时清理播放器
onUnmounted(() => {
  console.log('[VideoPreview] 组件卸载，清理FLV播放器')

  if (videoRef.value && videoRef.value._flvPlayer) {
    console.log('[VideoPreview] 销毁FLV播放器')
    try {
      videoRef.value._flvPlayer.pause()
      videoRef.value._flvPlayer.unload()
      videoRef.value._flvPlayer.detachMediaElement()
      videoRef.value._flvPlayer.destroy()
    } catch (e) {
      console.warn('[VideoPreview] 销毁播放器时出错:', e)
    }
    videoRef.value._flvPlayer = null
  }
})
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

  0%,
  100% {
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
