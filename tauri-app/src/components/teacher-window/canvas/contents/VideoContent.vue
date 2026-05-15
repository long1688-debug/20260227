<template>
  <div class="video-content">
    <video 
      v-if="source.properties?.src"
      :src="source.properties.src"
      controls
      autoplay
      loop
      muted
      class="video-element"
    />
    <div v-else class="placeholder">
      <el-icon :size="48"><VideoPlay /></el-icon>
      <p>未配置视频源</p>
    </div>
  </div>
</template>

<script setup>
import { VideoPlay } from '@element-plus/icons-vue';

defineProps({
  source: Object
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
