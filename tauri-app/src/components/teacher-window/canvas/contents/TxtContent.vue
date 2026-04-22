<template>
  <div class="txt-content">
    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-state">
      <el-icon class="is-loading" :size="48"><Loading /></el-icon>
      <p>正在加载文本文件...</p>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="hasError" class="error-state">
      <el-icon :size="48"><WarningFilled /></el-icon>
      <p>文本文件读取失败</p>
      <small>{{ errorMessage || '请确保文件格式正确' }}</small>
      <el-button size="small" type="primary" style="margin-top: 12px" @click="retryLoad">
        重新加载
      </el-button>
    </div>

    <!-- 文本内容 -->
    <div v-else-if="textContent" class="text-container">
      <!-- 工具栏 -->
      <div class="text-toolbar">
        <div class="page-nav">
          <el-button-group size="small">
            <el-button :disabled="currentPage <= 1" @click="previousPage">
              <el-icon><ArrowLeft /></el-icon>
            </el-button>
            <el-button disabled>{{ currentPage }} / {{ totalPages }}</el-button>
            <el-button :disabled="currentPage >= totalPages" @click="nextPage">
              <el-icon><ArrowRight /></el-icon>
            </el-button>
          </el-button-group>
        </div>

        <div class="zoom-controls">
          <el-button-group size="small">
            <el-button @click="zoomOut" :disabled="zoomLevel <= 50">
              <el-icon><ZoomOut /></el-icon>
            </el-button>
            <el-button disabled>{{ zoomLevel }}%</el-button>
            <el-button @click="zoomIn" :disabled="zoomLevel >= 200">
              <el-icon><ZoomIn /></el-icon>
            </el-button>
          </el-button-group>
        </div>
      </div>

      <!-- 内容区域 -->
      <div class="text-display" :style="displayStyle">
        <pre class="text-pre">{{ currentPageContent }}</pre>
      </div>
    </div>

    <!-- 占位符 -->
    <div v-else class="placeholder">
      <el-icon :size="64"><Document /></el-icon>
      <p>文本文件预览</p>
      <small>拖拽 .txt 或 .rtf 文件到此处查看内容</small>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { Document, Loading, WarningFilled, ArrowLeft, ArrowRight, ZoomIn, ZoomOut } from '@element-plus/icons-vue';

const props = defineProps({
  source: Object
});

// 状态管理
const isLoading = ref(false);
const hasError = ref(false);
const errorMessage = ref('');
const textContent = ref('');

// 分页状态
const currentPage = ref(1);
const totalPages = ref(1);
const zoomLevel = ref(100);
const linesPerPage = ref(40); // 每页显示行数

/**
 * 验证源是否有效
 */
const isValidSource = computed(() => {
  return (
    props.source?.type === 'txt' &&
    props.source?.file &&
    ['txt', 'rtf'].includes(
      props.source.originalExt || props.source.file.name.split('.').pop().toLowerCase()
    )
  );
});

/**
 * 获取当前页内容
 */
const currentPageContent = computed(() => {
  if (!textContent.value) return '';

  const lines = textContent.value.split('\n');
  const startIndex = (currentPage.value - 1) * linesPerPage.value;
  const endIndex = startIndex + linesPerPage.value;

  return lines.slice(startIndex, endIndex).join('\n');
});

/**
 * 获取显示样式
 */
const displayStyle = computed(() => {
  return {
    fontSize: `${zoomLevel.value}%`
  };
});

/**
 * 上一页
 */
const previousPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
};

/**
 * 下一页
 */
const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
};

/**
 * 放大
 */
const zoomIn = () => {
  if (zoomLevel.value < 200) {
    zoomLevel.value += 10;
  }
};

/**
 * 缩小
 */
const zoomOut = () => {
  if (zoomLevel.value > 50) {
    zoomLevel.value -= 10;
  }
};

/**
 * 计算总页数
 */
const calculatePages = () => {
  if (!textContent.value) {
    totalPages.value = 1;
    currentPage.value = 1;
    return;
  }

  const lines = textContent.value.split('\n');
  totalPages.value = Math.max(1, Math.ceil(lines.length / linesPerPage.value));
  currentPage.value = 1;
};

/**
 * 加载文本文件
 */
const loadDocument = async () => {
  if (!isValidSource.value) return;

  isLoading.value = true;
  hasError.value = false;

  try {
    const file = props.source.file;
    const fileName = file.name.toLowerCase();
    const fileExt = (props.source.originalExt || fileName.split('.').pop()).toLowerCase();

    console.log('[TxtContent] 加载文本文件:', fileName, '扩展名:', fileExt);

    // 读取文本文件内容
    const reader = new FileReader();

    reader.onload = (e) => {
      textContent.value = e.target.result;
      console.log('[TxtContent] 文本文件加载成功，长度:', textContent.value.length, '字符');

      // 计算页数
      calculatePages();

      isLoading.value = false;
    };

    reader.onerror = () => {
      throw new Error('文件读取失败');
    };

    reader.readAsText(file, 'UTF-8');
  } catch (error) {
    console.error('[TxtContent] 文本文件加载失败:', error);
    hasError.value = true;
    errorMessage.value = error.message || '文本文件读取失败';
    isLoading.value = false;
  }
};

/**
 * 重试加载
 */
const retryLoad = () => {
  hasError.value = false;
  loadDocument();
};

// 监听 source 变化
watch(() => props.source, () => {
  loadDocument();
}, { deep: true });

/**
 * 🎯 处理键盘事件 - 支持左右方向键翻页
 */
const handleKeydown = (event) => {
  if (!textContent.value || hasError.value) return;

  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault();
      previousPage();
      break;
    case 'ArrowRight':
      event.preventDefault();
      nextPage();
      break;
    case 'PageUp':
      event.preventDefault();
      previousPage();
      break;
    case 'PageDown':
      event.preventDefault();
      nextPage();
      break;
  }
};

// 组件挂载时加载并添加键盘监听
onMounted(() => {
  loadDocument();
  window.addEventListener('keydown', handleKeydown);
});

// 组件卸载时移除键盘监听
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<style lang="scss" scoped>
.txt-content {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  overflow: auto;
}

.loading-state,
.error-state,
.placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  text-align: center;

  p {
    font-size: 16px;
    color: #606266;
    margin: 0;
  }

  small {
    font-size: 12px;
    color: #909399;
  }
}

.error-state {
  p {
    color: #F56C6C;
  }
}

.text-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.text-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #F5F7FA;
  border-bottom: 1px solid #E4E7ED;
  flex-shrink: 0;

  .page-nav {
    display: flex;
    align-items: center;
  }

  .zoom-controls {
    display: flex;
    align-items: center;
  }
}

.text-display {
  flex: 1;
  overflow: auto;
  padding: 20px;

  .text-pre {
    margin: 0;
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 14px;
    line-height: 1.6;
    color: #303133;
    background: #FAFAFA;
    padding: 16px;
    border-radius: 4px;
    min-height: 100%;
  }
}
</style>
