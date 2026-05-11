<template>
  <div class="media-mixer-page">
    <!-- 顶部工具栏 -->
    <header class="page-header">
      <h1>音视频多路混流演示</h1>
      
      <!-- 音频控制 -->
      <AudioSelector />
      
      <!-- 激活音频按钮 -->
      <el-button type="warning" @click="handleResumeAudio">
        <el-icon><Bell /></el-icon>
        激活音频
      </el-button>
    </header>

    <!-- 主内容区 -->
    <main class="page-content">
      <!-- 左侧:预览区域 -->
      <div class="left-panel">
        <PreviewArea />
      </div>
      
      <!-- 右侧:画布区域 -->
      <div class="right-panel">
        <Canvas />
      </div>
    </main>

    <!-- 底部状态栏 -->
    <footer class="page-footer">
      <span>画布中有 {{ tiles.length }} 个视频块</span>
      <span>|</span>
      <span>已添加 {{ sources.size }} 个媒体源</span>
    </footer>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { Bell } from '@element-plus/icons-vue';
import { useMediaStore } from '@/stores/mediaStore';
import { useAudioMixerControl } from '@/composables/useAudioMixerControl';
import PreviewArea from '@/components/media/PreviewArea.vue';
import Canvas from '@/components/media/Canvas.vue';
import AudioSelector from '@/components/media/AudioSelector.vue';

const mediaStore = useMediaStore();
const { resumeAudio } = useAudioMixerControl();

// Computed
const tiles = computed(() => mediaStore.tiles);
const sources = computed(() => mediaStore.sources);

// Methods
const handleResumeAudio = async () => {
  await resumeAudio();
  alert('音频上下文已激活');
};

// Lifecycle
onMounted(() => {
  console.log('[MediaMixerPage] 页面加载完成');
  
  // 全局点击激活 AudioContext
  const handleUserInteraction = () => {
    resumeAudio();
    window.removeEventListener('click', handleUserInteraction);
  };
  
  window.addEventListener('click', handleUserInteraction);
});
</script>

<style scoped>
.media-mixer-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.page-header {
  padding: 16px 24px;
  background: #2c3e50;
  color: white;
  display: flex;
  align-items: center;
  gap: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.page-header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.page-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.left-panel {
  width: 500px;
  min-width: 500px;
  background: #f5f5f5;
  padding: 16px;
  border-right: 1px solid #ddd;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.right-panel {
  flex: 1;
  padding: 16px;
  background: #fafafa;
}

.page-footer {
  padding: 12px 24px;
  background: #fff;
  border-top: 1px solid #ddd;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: #666;
}
</style>
