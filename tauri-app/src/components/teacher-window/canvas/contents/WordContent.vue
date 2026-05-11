<template>
  <div class="word-content">
    <!-- Word 文档内容 -->
    <div v-if="htmlContent" class="document-viewer" v-html="htmlContent"></div>
    
    <!-- 加载状态 -->
    <div v-else-if="loading" class="loading-state">
      <el-icon class="is-loading"><Loading /></el-icon>
      <p>正在解析 Word 文档...</p>
    </div>
    
    <!-- 错误状态 -->
    <div v-else-if="error" class="error-state">
      <el-icon><Warning /></el-icon>
      <p>{{ error }}</p>
    </div>
    
    <!-- 空状态 -->
    <div v-else class="empty-state">
      <el-icon :size="64"><Document /></el-icon>
      <p>暂无 Word 文档内容</p>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { Document, Loading, Warning } from '@element-plus/icons-vue';

const props = defineProps({
  source: {
    type: Object,
    required: true
  }
});

// 状态
const htmlContent = ref('');
const loading = ref(false);
const error = ref('');

// 方法
const loadWord = async () => {
  if (!props.source) return;
  
  loading.value = true;
  error.value = '';
  
  try {
    console.log('[WordContent] 加载 Word 文档:', props.source.name);
    
    // TODO: 实现 Word 解析逻辑
    // 可以使用 mammoth.js 库来解析 .docx 文件
    
    // 临时占位实现
    htmlContent.value = `
      <div style="padding: 40px; max-width: 800px; margin: 0 auto;">
        <h1>${props.source.name}</h1>
        <p>Word 文档预览功能待实现</p>
        <p>建议使用 mammoth.js 库进行解析</p>
        <hr/>
        <p>文档内容将显示在这里...</p>
      </div>
    `;
    
  } catch (err) {
    console.error('[WordContent] 加载失败:', err);
    error.value = 'Word 文档加载失败: ' + err.message;
  } finally {
    loading.value = false;
  }
};

// 监听 source 变化
watch(() => props.source, (newSource) => {
  if (newSource) {
    loadWord();
  }
}, { immediate: true });

onMounted(() => {
  loadWord();
});
</script>

<style scoped lang="scss">
.word-content {
  width: 100%;
  height: 100%;
  overflow: auto;
  background: #fff;
}

.document-viewer {
  padding: 20px;
  min-height: 100%;
  
  :deep(*) {
    max-width: 100%;
  }
  
  :deep(img) {
    max-width: 100%;
    height: auto;
  }
  
  :deep(table) {
    border-collapse: collapse;
    width: 100%;
  }
  
  :deep(td), :deep(th) {
    border: 1px solid #ddd;
    padding: 8px;
  }
}

.loading-state,
.error-state,
.empty-state {
  width: 100%;
  height: 100%;
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
