<template>
  <div class="video-player" :class="{ 'flv-player': isFlvPlayer }">
    <video
      v-if="!isFlvPlayer"
      ref="videoRef"
      class="video-element native-video"
      :data-source-id="sourceId"
      playsinline
      :muted="isMuted"
      :volume="volume"
      :controls="showControls"
      poster="data:,"
      @loadedmetadata="onLoadedMetadata"
      @loadstart="onLoadStart"
      @progress="onProgress"
      @waiting="onWaiting"
      @playing="onPlaying"
      @play="onPlay"
      @pause="onPause"
      @ended="onEnded"
      @error="onError"
      @timeupdate="onTimeUpdate"
      @canplay="onCanPlay"
      @seeked="onSeeked"
      @volumechange="onVolumeChange"
    ></video>

    <!-- 🎯 完整播放控制栏 -->
    <div v-if="showControls && !isFlvPlayer" class="video-controls-overlay">
      <!-- 进度条 -->
      <div class="progress-container" @click="onProgressBarClick">
        <div class="progress-loaded" :style="{ width: loadedPercentage + '%' }"></div>
        <div class="progress-played" :style="{ width: playedPercentage + '%' }"></div>
        <div class="progress-thumb" :style="{ left: playedPercentage + '%' }"></div>
        <!-- 🎯 悬停预览 -->
        <div class="progress-hover-indicator" :style="{ left: hoverPercentage + '%' }">
          <span class="hover-time">{{ formatTime(hoverTime) }}</span>
        </div>
      </div>

      <!-- 控制按钮行 -->
      <div class="controls-row">
        <!-- 播放/暂停按钮 -->
        <button class="control-btn play-btn" @click="togglePlay">
          <el-icon v-if="isPlaying"><VideoPause /></el-icon>
          <el-icon v-else><VideoPlay /></el-icon>
        </button>

        <!-- 🎯 快退按钮 -->
        <button class="control-btn skip-btn" @click="skipBackward" title="快退10秒">
          <el-icon><RefreshLeft /></el-icon>
          <span class="skip-label">10</span>
        </button>

        <!-- 🎯 快进按钮 -->
        <button class="control-btn skip-btn" @click="skipForward" title="快进10秒">
          <span class="skip-label">10</span>
          <el-icon><RefreshRight /></el-icon>
        </button>

        <!-- 时间显示 -->
        <div class="time-display">
          <span class="current-time">{{ formatTime(currentTime) }}</span>
          <span class="time-separator">/</span>
          <span class="total-time">{{ formatTime(duration) }}</span>
        </div>

        <!-- 🎯 音量控制 -->
        <div class="volume-control">
          <button class="control-btn volume-btn" @click="toggleMute">
            <el-icon v-if="isMuted || volume === 0"><Mute /></el-icon>
            <el-icon v-else><Mute /></el-icon>
          </button>
          <div class="volume-slider-container">
            <input
              type="range"
              class="volume-slider"
              min="0"
              max="100"
              :value="volume * 100"
              @input="onVolumeSliderChange"
            />
          </div>
          <span class="volume-value">{{ Math.round(volume * 100) }}%</span>
        </div>

        <!-- 🎯 倍速控制 -->
        <div class="speed-control">
          <el-dropdown trigger="click" @command="handleSpeedChange">
            <button class="control-btn speed-btn">
              <span>{{ playbackRate }}x</span>
              <el-icon><ArrowDown /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item :command="0.5">0.5x</el-dropdown-item>
                <el-dropdown-item :command="0.75">0.75x</el-dropdown-item>
                <el-dropdown-item :command="1" :class="{ 'is-active': playbackRate === 1 }">1x (正常)</el-dropdown-item>
                <el-dropdown-item :command="1.25">1.25x</el-dropdown-item>
                <el-dropdown-item :command="1.5">1.5x</el-dropdown-item>
                <el-dropdown-item :command="2">2x</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>

        <!-- 🎯 全屏按钮 -->
        <button class="control-btn fullscreen-btn" @click="toggleFullscreen" title="全屏">
          <el-icon><FullScreen /></el-icon>
        </button>
      </div>
    </div>

    <!-- 🎯 ZLMediaKit 流媒体播放 -->
    <FlvPlayer
      v-else
      ref="flvRef"
      :source="flvSource"
      :options="flvOptions"
      @ready="onFlvReady"
      @error="onFlvError"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import flvjs from 'flv.js';
import FlvPlayer from './FlvPlayer.vue';
import { VideoPlay, VideoPause, Mute, RefreshLeft, RefreshRight, FullScreen, ArrowDown } from '@element-plus/icons-vue';

const props = defineProps({
  sourceId: {
    type: String,
    default: ''
  },
  videoSource: {
    type: Object,
    default: () => ({})
  },
  showControls: {
    type: Boolean,
    default: false
  },
  autoStart: {
    type: Boolean,
    default: true
  },
  useFlvPlayer: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'loadstart',
  'progress',
  'waiting',
  'playing',
  'play',
  'pause',
  'ended',
  'error',
  'timeupdate',
  'loadedmetadata',
  'canplay',
  'seeked',
  'volumechange',
  'durationchange',
  'ready'
]);

const videoRef = ref(null);
const flvRef = ref(null);

// Audio state
const isMuted = ref(false);
const volume = ref(1.0);

// 进度条相关状态
const currentTime = ref(0);
const duration = ref(0);
const buffered = ref([]);
const loadedPercentage = ref(0);
const playedPercentage = ref(0);

// 🎯 新增：悬停预览状态
const isHovering = ref(false);
const hoverPercentage = ref(0);
const hoverTime = ref(0);

// 🎯 新增：播放状态
const isPlaying = ref(false);

// 🎯 新增：播放速率
const playbackRate = ref(1.0);

// 根据 videoSource 计算 flvSource
const flvSource = computed(() => {
  if (props.videoSource?.url) {
    return props.videoSource.url;
  }
  return props.flvSource || '';
});

// flvOptions 默认值
const flvOptions = computed(() => {
  return props.flvOptions || {
    enableWorker: true,
    enableStashBuffer: false,
    stashInitialSize: 128
  };
});

// 🎯 是否使用 FLV 播放器
const isFlvPlayer = computed(() => props.useFlvPlayer);

// 格式化时间显示
const formatTime = (time) => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// Methods
const onLoadedMetadata = (e) => {
  const video = e.target;
  duration.value = video.duration;
  emit('loadedmetadata', e);
  emit('durationchange', duration.value);
};

const onLoadStart = (e) => emit('loadstart', e);
const onProgress = (e) => {
  const video = e.target;
  if (video.buffered.length > 0) {
    const bufferedEnd = video.buffered.end(video.buffered.length - 1);
    loadedPercentage.value = (bufferedEnd / duration.value) * 100;
  }
  emit('progress', e);
};

const onWaiting = (e) => emit('waiting', e);
const onPlaying = (e) => emit('playing', e);
const onPlay = (e) => {
  isPlaying.value = true;
  emit('play', e);
};
const onPause = (e) => {
  isPlaying.value = false;
  emit('pause', e);
};
const onEnded = (e) => emit('ended', e);

const onError = (e) => {
  console.error('Video error:', e);
  emit('error', e);
};

const onTimeUpdate = (e) => {
  const video = e.target;
  currentTime.value = video.currentTime;
  if (duration.value > 0) {
    playedPercentage.value = (currentTime.value / duration.value) * 100;
  }
  emit('timeupdate', e);
};

const onCanPlay = (e) => emit('canplay', e);
const onSeeked = (e) => emit('seeked', e);
const onVolumeChange = (e) => {
  if (videoRef.value) {
    volume.value = videoRef.value.volume;
    isMuted.value = videoRef.value.muted;
  }
  emit('volumechange', e);
};

const onFlvReady = (e) => emit('ready', e);
const onFlvError = (e) => emit('error', e);

// 处理进度条点击
const onProgressBarClick = (e) => {
  if (!videoRef.value || duration.value <= 0) return;

  const rect = e.currentTarget.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const width = rect.width;
  const newTime = (clickX / width) * duration.value;

  videoRef.value.currentTime = newTime;
};

const play = () => {
  if (videoRef.value) {
    videoRef.value.play();
  }
};

const pause = () => {
  if (videoRef.value) {
    videoRef.value.pause();
  }
};

const stop = () => {
  if (flvRef.value && typeof flvRef.value.stop === 'function') {
    flvRef.value.stop();
  }
  if (videoRef.value) {
    videoRef.value.pause();
    videoRef.value.currentTime = 0;
  }
};

const seek = (time) => {
  if (videoRef.value) {
    videoRef.value.currentTime = time;
  }
};

const setVolume = (newVolume) => {
  volume.value = newVolume;
  if (videoRef.value) {
    videoRef.value.volume = newVolume;
  }
};

const toggleMute = () => {
  isMuted.value = !isMuted.value;
  if (videoRef.value) {
    videoRef.value.muted = isMuted.value;
  }
};

// 🎯 切换播放/暂停
const togglePlay = () => {
  if (videoRef.value) {
    if (videoRef.value.paused) {
      videoRef.value.play();
    } else {
      videoRef.value.pause();
    }
  }
};

// 🎯 快退10秒
const skipBackward = () => {
  if (videoRef.value) {
    videoRef.value.currentTime = Math.max(0, videoRef.value.currentTime - 10);
  }
};

// 🎯 快进10秒
const skipForward = () => {
  if (videoRef.value) {
    videoRef.value.currentTime = Math.min(duration.value, videoRef.value.currentTime + 10);
  }
};

// 🎯 音量滑块变化
const onVolumeSliderChange = (e) => {
  const newVolume = parseInt(e.target.value) / 100;
  setVolume(newVolume);
};

// 🎯 处理倍速变化
const handleSpeedChange = (rate) => {
  playbackRate.value = rate;
  if (videoRef.value) {
    videoRef.value.playbackRate = rate;
  }
};

// 🎯 切换全屏
const toggleFullscreen = () => {
  const container = videoRef.value?.parentElement;
  if (!container) return;

  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else if (container.requestFullscreen) {
    container.requestFullscreen();
  } else if (container.webkitRequestFullscreen) {
    container.webkitRequestFullscreen();
  }
};

// 🎯 防抖：记录当前正在设置的 sourceId，避免重复设置
let lastSetSourceId = null;
let isSettingSource = false;

// 🎯 设置视频源（支持多种类型：本地文件、流媒体、MediaStream）
// 🎯 修复：避免播放请求被 load() 中断
const setVideoSource = (source) => {
  // 🎯 防抖：如果正在设置同一个源，跳过
  if (isSettingSource && lastSetSourceId === source.id) {
    console.log('[VideoPlayer.setVideoSource] 跳过重复设置:', source.id);
    return;
  }

  // 标记为正在设置
  isSettingSource = true;
  lastSetSourceId = source.id;

  console.log('[VideoPlayer.setVideoSource] 设置视频源:', source);

  if (!videoRef.value || !source) {
    console.warn('[VideoPlayer.setVideoSource] video元素或source无效');
    isSettingSource = false;
    return;
  }

  const video = videoRef.value;

  //  关键修复：立即设置黑色背景,防止绿色闪烁
  video.style.backgroundColor = '#000';
  video.style.opacity = '1';  // 确保可见

  // 记录当前播放状态，避免在 load() 之后立即 play()
  const wasPaused = video.paused;

  // 停止之前的流
  if (video.srcObject) {
    console.log('[VideoPlayer.setVideoSource] 停止旧流');
    // 🎯 修复：先淡出，再停止流，减少闪烁
    video.style.opacity = '0';
    video.style.transition = 'opacity 0.1s ease-out';

    setTimeout(() => {
      video.srcObject.getTracks().forEach(track => track.stop());
      video.srcObject = null;
      video.style.backgroundColor = '#000';  // 确保停止后仍然是黑色背景
      console.log('[VideoPlayer.setVideoSource] 旧流已停止');
    }, 100);
  }

  // 根据类型设置视频源
  if (source.stream) {
    // MediaStream（摄像头等）
    console.log('[VideoPlayer.setVideoSource] 设置 MediaStream');
    video.srcObject = source.stream;
  } else if (source.url) {
    // URL（本地文件或流媒体）
    console.log('[VideoPlayer.setVideoSource] 设置 URL:', source.url);
    video.src = source.url;
  } else if (source.streamUrl) {
    // 流媒体URL
    console.log('[VideoPlayer.setVideoSource] 设置流媒体 URL:', source.streamUrl);
    video.src = source.streamUrl;
  } else {
    console.warn('[VideoPlayer.setVideoSource] 未知的视频源类型:', source);
    isSettingSource = false;
    return;
  }

  // 更新音频设置
  if (source.volume !== undefined) {
    volume.value = (source.volume || 100) / 100;
    video.volume = volume.value;
  }
  if (source.muted !== undefined) {
    isMuted.value = source.muted;
    video.muted = isMuted.value;
  }

  // 🎯 修复：对于 MediaStream，等待 loadedmetadata 事件后再播放
  // 对于 URL/streamUrl，先 load()，然后在 canplay 时播放
  if (source.stream) {
    // MediaStream 类型：直接播放
    console.log('[VideoPlayer.setVideoSource] 设置新流并淡入');

    // 🎯 立即开始淡入,而不是等待 loadedmetadata,避免黑色背景闪烁
    video.style.opacity = '1';
    video.style.transition = 'opacity 0.15s ease-in';

    // 🎯 监听 loadedmetadata 事件，确保流就绪
    const handleLoadedMetadata = () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      console.log('[VideoPlayer.setVideoSource] 流已就绪');

      if (props.autoStart) {
        video.play().catch(err => {
          // 忽略自动播放失败（可能是用户未交互）
          console.log('[VideoPlayer.setVideoSource] MediaStream 播放尝试完成:', err.name);
        });
      }

      // MediaStream 设置完成后重置标记
      setTimeout(() => {
        if (lastSetSourceId === source.id) {
          isSettingSource = false;
        }
      }, 100);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    // 如果流已经就绪，立即触发
    if (video.readyState >= 1) {
      handleLoadedMetadata();
    }
  } else {
    // URL/streamUrl 类型：等待元数据加载后再播放
    const handleCanPlay = () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('loadedmetadata', handleCanPlay);
      if (props.autoStart) {
        video.play().catch(err => {
          console.log('[VideoPlayer.setVideoSource] URL 播放尝试完成:', err.name);
        });
      }
      isSettingSource = false;
    };
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('loadedmetadata', handleCanPlay);
    video.load();
  }
};

// 🎯 修复：仅在视频源的关键属性变化时重新加载，忽略音频设置变化
// 🎯 关键：添加 immediate: true，确保组件挂载时立即加载视频
watch(() => props.videoSource, (newSource, oldSource) => {
  if (!newSource) {
    return;
  }

  console.log('[VideoPlayer.watch] videoSource 变化:', {
    oldId: oldSource?.id,
    newId: newSource.id,
    oldUrl: oldSource?.url,
    newUrl: newSource.url,
    oldStream: !!oldSource?.stream,
    newStream: !!newSource?.stream
  });

  // Update audio settings
  if (newSource.volume !== undefined) {
    volume.value = (newSource.volume || 100) / 100;
  }
  if (newSource.muted !== undefined) {
    isMuted.value = newSource.muted;
  }

  // 🎯 仅在关键属性变化时重新加载视频，忽略音频设置变化
  const shouldReloadVideo = !oldSource ||
                           newSource.id !== oldSource.id ||
                           newSource.type !== oldSource.type ||
                           newSource.file !== oldSource.file ||
                           newSource.url !== oldSource.url ||
                           newSource.stream !== oldSource.stream ||
                           newSource.streamUrl !== oldSource.streamUrl;

  if (!shouldReloadVideo) {
    // 🎯 仅更新音频相关设置，不重新加载视频
    console.log('[VideoPlayer.watch] 仅更新音频设置，不重新加载视频');
    if (videoRef.value) {
      videoRef.value.volume = volume.value;
      videoRef.value.muted = isMuted.value;
    }
    return;
  }

  console.log('[VideoPlayer.watch] 触发视频加载:', newSource.id || newSource.name);
  nextTick(() => {
    // 调用 setVideoSource 设置视频源
    if (newSource) {
      setVideoSource(newSource);
    }
  });
}, { immediate: true });

onMounted(() => {
  // Set initial audio values
  if (props.videoSource?.volume !== undefined) {
    volume.value = (props.videoSource.volume || 100) / 100;
  }
  if (props.videoSource?.muted !== undefined) {
    isMuted.value = props.videoSource.muted;
  }

  // 🎯 注意：视频加载和播放由 watch (immediate: true) + setVideoSource 统一处理
  // 不再在 onMounted 中直接调用 play()，避免与 setVideoSource 中的播放逻辑冲突
});

onUnmounted(() => {
  if (flvRef.value && typeof flvRef.value.destroy === 'function') {
    flvRef.value.destroy();
    flvRef.value = null;
  }

  if (videoRef.value && videoRef.value.srcObject) {
    videoRef.value.srcObject.getTracks().forEach(track => track.stop());
    videoRef.value.srcObject = null;
  }
});

defineExpose({
  videoRef,
  play,
  pause,
  stop,
  seek,
  setVolume,
  toggleMute,
  setVideoSource
});
</script>

<style scoped lang="scss">
.video-player {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #000;
  display: flex;  /* 确保 video 元素填满容器 */
  min-height: 0;  /* 允许 flex 子元素收缩 - 关键修复 */
}

.video-player video {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;  /* 视频内容适应容器 */
  min-height: 0;  /* 允许收缩 */
  background: #000;  /* 🎯 确保视频元素本身也是黑色背景,避免绿色闪烁 */
}

/* 进度条样式 */
.video-progress-bar {
  position: absolute;
  bottom: 40px;
  left: 0;
  right: 0;
  height: 6px;
  background: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  border-radius: 3px;
  transition: height 0.2s ease;
}

.video-progress-bar:hover {
  height: 10px;
}

.progress-loaded {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 3px;
  z-index: 1;
}

.progress-played {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: #409eff;
  border-radius: 3px;
  z-index: 2;
}

.progress-thumb {
  position: absolute;
  top: 50%;
  transform: translateY(-50%) translateX(-50%);
  width: 12px;
  height: 12px;
  background: #fff;
  border-radius: 50%;
  z-index: 3;
  opacity: 0;
  transition: opacity 0.2s;
}

.video-progress-bar:hover .progress-thumb {
  opacity: 1;
}

.time-display {
  position: absolute;
  bottom: 10px;
  left: 10px;
  color: white;
  font-size: 12px;
  z-index: 4;
  background: rgba(0, 0, 0, 0.5);
  padding: 2px 6px;
  border-radius: 3px;
}

.flv-player {
  width: 100%;
  height: 100%;
}
</style>
