<template>
  <div class="ppt-content">
    <!-- PPT 预览容器 -->
    <div v-if="slides.length > 0" class="slides-container">
      <!-- 当前幻灯片 -->
      <div 
        class="slide-viewer" 
        :style="{ transform: `scale(${zoom})` }"
      >
        <div 
          v-html="currentSlideContent" 
          class="slide-content"
        ></div>
      </div>
      
      <!-- 幻灯片导航 -->
      <div class="slide-navigation" v-if="slides.length > 1">
        <el-button 
          size="small" 
          :disabled="currentSlideIndex === 0"
          @click="prevSlide"
        >
          <el-icon><ArrowLeft /></el-icon>
        </el-button>
        
        <span class="slide-indicator">
          {{ currentSlideIndex + 1 }} / {{ slides.length }}
        </span>
        
        <el-button 
          size="small" 
          :disabled="currentSlideIndex >= slides.length - 1"
          @click="nextSlide"
        >
          <el-icon><ArrowRight /></el-icon>
        </el-button>
      </div>
    </div>
    
    <!-- 加载状态 -->
    <div v-else-if="loading" class="loading-state">
      <el-icon class="is-loading"><Loading /></el-icon>
      <p>正在解析 PPT...</p>
    </div>
    
    <!-- 错误状态 -->
    <div v-else-if="error" class="error-state">
      <el-icon><Warning /></el-icon>
      <p>{{ error }}</p>
    </div>
    
    <!-- 空状态 -->
    <div v-else class="empty-state">
      <el-icon :size="64"><Document /></el-icon>
      <p>暂无 PPT 内容</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { Document, ArrowLeft, ArrowRight, Loading, Warning } from '@element-plus/icons-vue';

const props = defineProps({
  source: {
    type: Object,
    required: true
  }
});

// 状态
const slides = ref([]);
const currentSlideIndex = ref(0);
const loading = ref(false);
const error = ref('');
const zoom = ref(1);

// 计算属性
const currentSlideContent = computed(() => {
  if (slides.value.length === 0) return '';
  const slide = slides.value[currentSlideIndex.value];
  return slide?.content || slide?.html || '';
});

// 方法
const prevSlide = () => {
  if (currentSlideIndex.value > 0) {
    currentSlideIndex.value--;
  }
};

const nextSlide = () => {
  if (currentSlideIndex.value < slides.value.length - 1) {
    currentSlideIndex.value++;
  }
};

const loadPpt = async () => {
  if (!props.source) return;
  
  loading.value = true;
  error.value = '';
  
  try {
    // TODO: 实现 PPT 解析逻辑
    // 可以使用 pptx2json 或其他库来解析 PPTX 文件
    console.log('[PptContent] 加载 PPT:', props.source.name);
    
    // 临时占位实现
    slides.value = [
      {
        content: `<div style="padding: 40px; text-align: center;">
          <h2>${props.source.name}</h2>
          <p>PPT 预览功能待实现</p>
          <p>建议使用 pptx2json 库进行解析</p>
        </div>`
      }
    ];
    
  } catch (err) {
    console.error('[PptContent] 加载失败:', err);
    error.value = 'PPT 加载失败: ' + err.message;
  } finally {
    loading.value = false;
  }
};

// 监听 source 变化
watch(() => props.source, (newSource) => {
  if (newSource) {
    loadPpt();
  }
}, { immediate: true });

onMounted(() => {
  loadPpt();
});
</script>

<style scoped lang="scss">
.ppt-content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden;
}

.slides-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
}

.slide-viewer {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.slide-content {
  width: 100%;
  max-width: 960px;
  aspect-ratio: 16 / 9;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  
  :deep(*) {
    max-width: 100%;
  }
}

.slide-navigation {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.05);
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.slide-indicator {
  font-size: 14px;
  color: #666;
  min-width: 80px;
  text-align: center;
}

.loading-state,
.error-state,
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #999;
  
  p {
    margin: 0;
    font-size: 14px;
  }
}

.error-state {
  color: #f56c6c;
}
</style>
