<template>
  <div class="video-content">
    <video 
      v-if="source.properties?.src"
      :ref="videoRef"
      :src="source.properties.src"
      controls
      autoplay
      muted
      class="video-element"
      @loadedmetadata="applyVideoState"
    />
    <div v-else class="placeholder">
      <el-icon :size="48"><VideoPlay /></el-icon>
      <p>未配置视频源</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { VideoPlay } from '@element-plus/icons-vue';

const props = defineProps({
  source: Object
});

const videoRef = ref(null);

// 🎯 应用从预览区域克隆的视频状态
const applyVideoState = () => {
  if (!videoRef.value || !props.source.properties?.videoState) return;
  
  const { currentTime, paused, volume, muted, playbackRate } = props.source.properties.videoState;
  
  console.log('[VideoContent] 应用克隆的视频状态:', props.source.properties.videoState);
  
  // 应用播放位置
  if (currentTime !== undefined && !isNaN(currentTime)) {
    videoRef.value.currentTime = currentTime;
  }
  
  // 应用播放状态
  if (paused !== undefined) {
    if (paused) {
      videoRef.value.pause();
    } else {
      videoRef.value.play().catch(e => console.warn('[VideoContent] 自动播放失败:', e));
    }
  }
  
  // 应用音量
  if (volume !== undefined && !isNaN(volume)) {
    videoRef.value.volume = volume;
  }
  
  // 应用静音状态
  if (muted !== undefined) {
    videoRef.value.muted = muted;
  }
  
  // 应用播放速率
  if (playbackRate !== undefined && !isNaN(playbackRate)) {
    videoRef.value.playbackRate = playbackRate;
  }
};
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
