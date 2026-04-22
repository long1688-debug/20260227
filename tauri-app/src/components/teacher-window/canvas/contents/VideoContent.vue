<template>
  <div class="video-content">
    <video 
      v-if="source.properties?.src"
      ref="videoRef"
      :src="source.properties.src"
      loop
      class="video-element"
      @loadedmetadata="onVideoLoaded"
      @timeupdate="onTimeUpdate"
      @play="onPlay"
      @pause="onPause"
    />
    <div v-else class="placeholder">
      <el-icon :size="48"><VideoPlay /></el-icon>
      <p>未配置视频源</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { VideoPlay } from '@element-plus/icons-vue';
import { useSourceStore } from '@/stores/sourceStore';
import { useMediaStore } from '@/stores/mediaStore';

const props = defineProps({
  source: Object
});

const sourceStore = useSourceStore();
const mediaStore = useMediaStore();
const videoRef = ref(null);

// 获取源数据（从两个 store 中查找）
const sourceData = computed(() => {
  const sourceId = props.source?.properties?.sourceId || props.source?.id;
  if (!sourceId) return null;
  
  // 先从 mediaStore 查找
  const mediaSource = mediaStore.sources.get(sourceId);
  if (mediaSource) return mediaSource;
  
  // 再从 sourceStore 查找
  return sourceStore.sources.find(s => s.id === sourceId);
});

// 音频是否启用 - 画布视频默认静音，只有明确设置 audioEnabled=true 才发声
const isAudioEnabled = computed(() => {
  // 画布视频默认不发声，只有当 sourceData 明确设置 audioEnabled=true 时才启用音频
  return sourceData.value?.audioEnabled === true;
});

// 音频音量
const audioVolume = computed(() => {
  return sourceData.value?.volume || 100;
});

// 当前播放时间
const currentTime = computed(() => {
  return sourceData.value?.currentTime || 0;
});

// 更新视频元素的音频状态（不触发重新渲染）
const updateVideoAudioState = () => {
  if (videoRef.value) {
    const enabled = isAudioEnabled.value;
    const volume = audioVolume.value;
    videoRef.value.muted = !enabled;
    videoRef.value.volume = volume / 100;
    console.log(`[VideoContent] 音频状态更新: muted=${!enabled}, volume=${volume}`);
  }
};

// 更新视频播放进度（不触发重新渲染）
const updateVideoProgress = (time) => {
  if (videoRef.value && videoRef.value.currentTime !== time) {
    videoRef.value.currentTime = time;
    console.log(`[VideoContent] 进度同步: ${time}`);
  }
};

// 监听音频状态变化
watch([isAudioEnabled, audioVolume], () => {
  updateVideoAudioState();
});

// 监听播放进度变化，同步到画布中的视频
watch(currentTime, (newTime) => {
  if (videoRef.value && Math.abs(videoRef.value.currentTime - newTime) > 0.1) {
    updateVideoProgress(newTime);
  }
});

// 视频加载完成
const onVideoLoaded = () => {
  console.log('[VideoContent] 视频加载完成');
  // 确保初始音频状态正确
  updateVideoAudioState();
  // 同步初始进度
  if (currentTime.value > 0) {
    updateVideoProgress(currentTime.value);
  }
};

// 时间更新，同步到 store
const onTimeUpdate = () => {
  if (videoRef.value && sourceData.value) {
    const time = videoRef.value.currentTime;
    // 更新到两个 store
    mediaStore.updateSource(sourceData.value.id, { currentTime: time });
    sourceStore.updateSource(sourceData.value.id, { currentTime: time });
  }
};

// 播放事件
const onPlay = () => {
  if (sourceData.value) {
    mediaStore.updateSource(sourceData.value.id, { isPlaying: true });
    sourceStore.updateSource(sourceData.value.id, { isPlaying: true });
  }
};

// 暂停事件
const onPause = () => {
  if (sourceData.value) {
    mediaStore.updateSource(sourceData.value.id, { isPlaying: false });
    sourceStore.updateSource(sourceData.value.id, { isPlaying: false });
  }
};

// 组件挂载后设置初始状态
// 🎯 关键修复：画布视频不自动播放，等待同步系统（主控）的指令
onMounted(() => {
  if (videoRef.value) {
    // 设置初始音频状态（画布视频默认静音）
    updateVideoAudioState();
    // 🎯 画布视频不自动播放，由同步系统控制播放/暂停
    // 禁用自动播放，等待主控视频的同步指令
    videoRef.value.pause();
    console.log('[VideoContent] 画布视频已挂载，等待同步指令');
  }
});
</script>

<style scoped lang="scss">
.video-content {
  width: 100%;
  height: 100%;
  background: #000;
  
  .video-element {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  
  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #718096;
    
    p {
      margin-top: 8px;
      font-size: 12px;
    }
  }
}
</style>
