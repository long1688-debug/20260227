
<template>
  <div class="pdf-viewer">
    <!-- PDF容器 -->
    <div class="pdf-container" ref="container">
      <!-- 加载中 -->
      <div v-if="status === 'loading'" class="loading-state">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>正在加载文档...</span>
        <div class="progress-bar" v-if="loadProgress > 0">
          <div class="progress-fill" :style="{ width: loadProgress + '%' }"></div>
        </div>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="status === 'error'" class="error-state">
        <el-icon><WarningFilled /></el-icon>
        <span>{{ errorMessage }}</span>
        <el-button size="small" type="primary" @click="reload">重新加载</el-button>
      </div>

      <!-- PDF内容 -->
      <div v-else-if="status === 'ready'" class="pdf-content">
        <canvas ref="pdfCanvas" class="pdf-canvas"></canvas>

        <!-- 页面导航 -->
        <div class="page-nav">
          <el-button
            circle
            size="small"
            :icon="ArrowLeft"
            @click="prevPage"
            :disabled="currentPage === 1"
          />

          <div class="page-counter">
            {{ currentPage }} / {{ totalPages }}
          </div>

          <el-button
            circle
            size="small"
            :icon="ArrowRight"
            @click="nextPage"
            :disabled="currentPage === totalPages"
          />
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="empty-state">
        <el-icon><Document /></el-icon>
        <span>未加载文档文件</span>
        <p class="hint">请在信号源配置中选择文档文件</p>
      </div>
    </div>

    <!-- 信息栏 -->
    <div class="info-bar" v-if="showInfo && fileName">
      <span class="file-name">{{ fileName }}</span>
      <span class="page-info">{{ currentPage }}/{{ totalPages }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { Loading, WarningFilled, Document, ArrowLeft, ArrowRight } from '@element-plus/icons-vue';
import * as pdfjsLib from 'pdfjs-dist';

// 设置 PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const props = defineProps({
  sourceId: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    default: ''
  },
  fileName: {
    type: String,
    default: ''
  },
  showInfo: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['page-change', 'load-complete', 'load-error']);

const status = ref('idle'); // idle, loading, ready, error
const errorMessage = ref('');
const loadProgress = ref(0);
const currentPage = ref(1);
const totalPages = ref(0);
const pdfCanvas = ref(null);
const container = ref(null);
let pdfDoc = null;
let renderingTask = null;

// 加载 PDF 文件
const loadPdf = async () => {
  if (!props.filePath) {
    status.value = 'error';
    errorMessage.value = '未指定文件路径';
    return;
  }

  status.value = 'loading';
  loadProgress.value = 0;

  try {
    // 调用后端转换文档为 PDF
    // 确保文件路径使用正斜杠（Rust PathBuf 兼容）
    const normalizedPath = props.filePath.replace(/\\/g, '/');
    const conversionResult = await invoke('convert_document_to_pdf', {
      filePath: normalizedPath
    });

    if (!conversionResult.success) {
      throw new Error(conversionResult.error_message || '文档转换失败');
    }

    // 显示缓存状态
    if (conversionResult.cached) {
      console.log('[PdfViewer] 使用缓存的 PDF');
    } else {
      console.log('[PdfViewer] 新转换的 PDF');
    }

    loadProgress.value = 50;

    // 使用 Blob URL 或文件路径加载 PDF
    const pdfUrl = conversionResult.blob_url || conversionResult.pdf_path;
    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    pdfDoc = await loadingTask.promise;
    totalPages.value = pdfDoc.numPages;
    currentPage.value = 1;

    loadProgress.value = 100;
    status.value = 'ready';

    // 渲染第一页
    await renderPage(currentPage.value);

    emit('load-complete', {
      totalPages: totalPages.value,
      pdfPath: conversionResult.pdf_path,
      blobUrl: conversionResult.blob_url,
      cached: conversionResult.cached
    });
  } catch (error) {
    console.error('PDF加载失败:', error);
    status.value = 'error';
    errorMessage.value = error.message || '文档文件加载失败';
    emit('load-error', error);
  }
};

// 渲染指定页面
const renderPage = async (pageNumber) => {
  if (!pdfDoc || !pdfCanvas.value) return;

  // 取消之前的渲染任务
  if (renderingTask) {
    renderingTask.cancel();
  }

  try {
    const page = await pdfDoc.getPage(pageNumber);
    const canvas = pdfCanvas.value;
    const context = canvas.getContext('2d');

    // 计算缩放比例以适应容器
    const containerWidth = container.value.clientWidth;
    const containerHeight = container.value.clientHeight;
    const viewport = page.getViewport({ scale: 1 });

    const scaleX = containerWidth / viewport.width;
    const scaleY = containerHeight / viewport.height;
    const scale = Math.min(scaleX, scaleY) * 0.95; // 留一点边距

    const scaledViewport = page.getViewport({ scale });

    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;

    renderingTask = page.render({
      canvasContext: context,
      viewport: scaledViewport
    });

    await renderingTask.promise;
    renderingTask = null;
  } catch (error) {
    if (error.name !== 'RenderingCancelledException') {
      console.error('页面渲染失败:', error);
    }
  }
};

// 上一页
const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
    renderPage(currentPage.value);
    emit('page-change', currentPage.value);
  }
};

// 下一页
const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
    renderPage(currentPage.value);
    emit('page-change', currentPage.value);
  }
};

// 重新加载
const reload = () => {
  cleanup();
  loadPdf();
};

// 清理资源
const cleanup = () => {
  if (renderingTask) {
    renderingTask.cancel();
    renderingTask = null;
  }
  pdfDoc = null;
  currentPage.value = 1;
  totalPages.value = 0;
};

// 处理窗口大小变化
const handleResize = () => {
  if (status.value === 'ready') {
    renderPage(currentPage.value);
  }
};

/**
 * 🎯 处理键盘事件 - 支持左右方向键翻页
 */
const handleKeydown = (event) => {
  if (status.value !== 'ready') return;
  
  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault();
      prevPage();
      break;
    case 'ArrowRight':
      event.preventDefault();
      nextPage();
      break;
    case 'PageUp':
      event.preventDefault();
      prevPage();
      break;
    case 'PageDown':
      event.preventDefault();
      nextPage();
      break;
  }
};

onMounted(() => {
  loadPdf();
  window.addEventListener('resize', handleResize);
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  cleanup();
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('keydown', handleKeydown);
});

// 监听文件路径变化
watch(() => props.filePath, () => {
  cleanup();
  loadPdf();
});

// 暴露方法
defineExpose({
  reload,
  goToPage: (page) => {
    if (page >= 1 && page <= totalPages.value) {
      currentPage.value = page;
      renderPage(currentPage.value);
    }
  },
  getCurrentPage: () => currentPage.value,
  getTotalPages: () => totalPages.value
});
</script>

<style scoped lang="scss">
.pdf-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;

  .pdf-container {
    flex: 1;
    position: relative;
    overflow: hidden;
    background: #525659; // PDF 阅读器常见的深色背景

    .loading-state,
    .error-state,
    .empty-state {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      color: #909399;
      font-size: 14px;

      .el-icon {
        font-size: 48px;
      }

      .progress-bar {
        width: 200px;
        height: 4px;
        background: #e4e7ed;
        border-radius: 2px;
        overflow: hidden;
        margin-top: 8px;

        .progress-fill {
          height: 100%;
          background: #409eff;
          transition: width 0.3s ease;
        }
      }

      .hint {
        font-size: 12px;
        color: #c0c4cc;
        margin: 0;
      }
    }

    .error-state {
      color: #f56c6c;
    }

    .pdf-content {
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;

      .pdf-canvas {
        max-width: 100%;
        max-height: 100%;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
      }

      .page-nav {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 8px 16px;
        background: rgba(0, 0, 0, 0.7);
        border-radius: 20px;
        color: white;

        .page-counter {
          min-width: 60px;
          text-align: center;
          font-size: 14px;
        }
      }
    }
  }

  .info-bar {
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    font-size: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;

    .file-name {
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .page-info {
      color: #909399;
    }
  }
}
</style>
