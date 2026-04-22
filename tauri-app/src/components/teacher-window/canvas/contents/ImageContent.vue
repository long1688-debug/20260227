<template>
  <div class="image-content">
    <img 
      v-if="source.properties?.src"
      :src="source.properties.src"
      :alt="source.name"
      class="image-element"
    />
    <div v-else class="placeholder">
      <el-icon :size="48"><Picture /></el-icon>
      <p>未配置图片</p>
    </div>
  </div>
</template>

<script setup>
import { Picture } from '@element-plus/icons-vue';

defineProps({
  source: Object
});
</script>

<style scoped lang="scss">
.image-content {
  width: 100%;
  height: 100%;
  background: #1a202c;
  
  .image-element {
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
