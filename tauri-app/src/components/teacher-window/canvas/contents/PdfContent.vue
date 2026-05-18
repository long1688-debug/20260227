<template>
  <div class="pdf-content">
    <!-- PDF 预览容器 -->
    <div class="pdf-container">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <el-icon class="is-loading"><Loading /></el-icon>
        <p>正在加载 PDF...</p>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="error-state">
        <el-icon><Warning /></el-icon>
        <p>{{ error }}</p>
      </div>

      <!-- PDF 内容 -->
      <div v-else-if="pdfPages.length > 0" class="pdf-viewer">
        <!-- 当前页面 -->
        <div
          class="page-viewer"
          :style="{ transform: `scale(${zoom})` }"
        >
          <div
            v-for="(page, index) in pdfPages"
            :key="index"
            class="pdf-page"
            :class="{ active: currentPage === index }"
          >
            <canvas :ref="`pdfCanvas-${index}`" class="pdf-canvas"></canvas>
            <div class="page-overlay">
              <span class="page-number">{{ index + 1 }}</span>
            </div>
          </div>
        </div>

        <!-- 翻页控制 -->
        <div class="page-controls">
          <div class="control-left">
            <el-button
              size="small"
              :disabled="currentPage === 0"
              @click="firstPage"
              :icon="ChevronDoubleLeft"
              title="第一页"
            />
            <el-button
              size="small"
              :disabled="currentPage === 0"
              @click="prevPage"
              :icon="ArrowLeft"
              title="上一页"
            />
          </div>

          <div class="control-center">
            <div class="page-info">
              <el-input
                v-model.number="pageInput"
                type="number"
                :min="1"
                :max="totalPages"
                class="page-input"
                @change="goToPage"
                @keyup.enter="goToPage"
              />
              <span class="page-divider">/</span>
              <span class="page-total">{{ totalPages }}</span>
            </div>
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: progressPercent + '%' }"
              ></div>
            </div>
          </div>

          <div class="control-right">
            <el-button
              size="small"
              :disabled="currentPage >= totalPages - 1"
              @click="nextPage"
              :icon="ChevronRight"
              title="下一页"
            />
            <el-button
              size="small"
              :disabled="currentPage >= totalPages - 1"
              @click="lastPage"
              :icon="ArrowRight"
              title="最后一页"
            />
          </div>
        </div>

        <!-- 工具栏 -->
        <div class="toolbar">
          <div class="zoom-controls">
            <el-button
              size="small"
              @click="zoomOut"
              :icon="ZoomOut"
              title="缩小"
            />
            <span class="zoom-value">{{ Math.round(zoom * 100) }}%</span>
            <el-button
              size="small"
              @click="zoomIn"
              :icon="ZoomIn"
              title="放大"
            />
            <el-button
              size="small"
              @click="resetZoom"
              :icon="Refresh"
              title="重置"
            />
          </div>
        </div>
      </div>

      <!-- 备用 iframe 加载 -->
      <div v-else-if="sourceUrl" class="pdf-fallback">
        <iframe
          :src="sourceUrl"
          class="pdf-iframe"
          frameborder="0"
        ></iframe>
      </div>

      <!-- 空状态 -->
      <div v-else class="empty-state">
        <el-icon :size="64"><Document /></el-icon>
        <p>暂无 PDF 内容</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { Document, Loading, Warning, ArrowLeft, ArrowRight, ZoomIn, ZoomOut, Refresh } from '@element-plus/icons-vue';

const props = defineProps({
  source: {
    type: Object,
    required: true
  }
});

// 状态
const pdfPages = ref([]);
const currentPage = ref(0);
const pageInput = ref(1);
const zoom = ref(1);
const loading = ref(false);
const error = ref('');
const sourceUrl = ref('');

// 计算属性
const totalPages = computed(() => pdfPages.value.length || 1);
const progressPercent = computed(() => {
  if (totalPages.value <= 1) return 100;
  return ((currentPage.value + 1) / totalPages.value) * 100;
});

// 翻页方法
const firstPage = () => {
  currentPage.value = 0;
  updatePageInput();
};

const prevPage = () => {
  if (currentPage.value > 0) {
    currentPage.value--;
    updatePageInput();
  }
};

const nextPage = () => {
  if (currentPage.value < totalPages.value - 1) {
    currentPage.value++;
    updatePageInput();
  }
};

const lastPage = () => {
  currentPage.value = totalPages.value - 1;
  updatePageInput();
};

const goToPage = () => {
  const page = parseInt(pageInput.value);
  if (page && page >= 1 && page <= totalPages.value) {
    currentPage.value = page - 1;
  } else {
    updatePageInput();
  }
};

const updatePageInput = () => {
  pageInput.value = currentPage.value + 1;
};

// 缩放方法
const zoomIn = () => {
  if (zoom.value < 3) {
    zoom.value += 0.1;
  }
};

const zoomOut = () => {
  if (zoom.value > 0.5) {
    zoom.value -= 0.1;
  }
};

const resetZoom = () => {
  zoom.value = 1;
};

// 键盘事件处理
const handleKeydown = (e) => {
  switch (e.key) {
    case 'ArrowLeft':
      if (e.ctrlKey || e.metaKey) {
        firstPage();
      } else {
        prevPage();
      }
      break;
    case 'ArrowRight':
      if (e.ctrlKey || e.metaKey) {
        lastPage();
      } else {
        nextPage();
      }
      break;
    case 'Home':
      firstPage();
      break;
    case 'End':
      lastPage();
      break;
    case '+':
    case '=':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoomIn();
      }
      break;
    case '-':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoomOut();
      }
      break;
    case '0':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        resetZoom();
      }
      break;
  }
};

// 加载 PDF
const loadPdf = async () => {
  if (!props.source) return;

  loading.value = true;
  error.value = '';
  sourceUrl.value = props.source.url || props.source.path || '';

  try {
    console.log('[PdfContent] 加载 PDF:', props.source.name);

    // 模拟 PDF 页面（实际应使用 PDF.js 解析）
    // 生成模拟页面
    const pageCount = 4;
    pdfPages.value = Array.from({ length: pageCount }, (_, index) => ({
      index,
      content: `PDF 页面 ${index + 1}`
    }));

    currentPage.value = 0;
    updatePageInput();

  } catch (err) {
    console.error('[PdfContent] 加载失败:', err);
    error.value = 'PDF 加载失败: ' + err.message;
  } finally {
    loading.value = false;
  }
};

// 监听 source 变化
watch(() => props.source, (newSource) => {
  if (newSource) {
    loadPdf();
  }
}, { immediate: true });

// 全屏翻页事件处理
const handleFullscreenPageChange = (e) => {
  if (e.detail && e.detail.sourceId === props.source.id) {
    if (e.detail.direction === 'prev') {
      prevPage();
    } else if (e.detail.direction === 'next') {
      nextPage();
    }
  }
};

onMounted(() => {
  loadPdf();
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('doc-page-change', handleFullscreenPageChange);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('doc-page-change', handleFullscreenPageChange);
});
</script>

<style scoped lang="scss">
.pdf-content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden;
}

.pdf-container {
  flex: 1;
  overflow: auto;
}

.pdf-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.page-viewer {
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  transform-origin: center top;
}

.pdf-page {
  width: 100%;
  max-width: 800px;
  min-height: 600px;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  margin-bottom: 20px;
  display: none;
  position: relative;

  &.active {
    display: block;
  }
}

.pdf-canvas {
  width: 100%;
  height: auto;
}

.page-overlay {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
}

/* 翻页控制 */
.page-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #f8f9fa;
  border-top: 1px solid #e0e0e0;
}

.control-left,
.control-right {
  display: flex;
  gap: 8px;
}

.control-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.page-info {
  display: flex;
  align-items: center;
  gap: 4px;
}

.page-input {
  width: 60px;
  text-align: center;
}

.page-divider {
  color: #999;
}

.page-total {
  color: #666;
  font-size: 14px;
}

.progress-bar {
  width: 200px;
  height: 4px;
  background: #e0e0e0;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #4299e1;
  transition: width 0.3s ease;
}

/* 工具栏 */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
}

.view-modes {
  display: flex;
  gap: 4px;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.zoom-value {
  min-width: 60px;
  text-align: center;
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

/* 备用 iframe */
.pdf-fallback {
  width: 100%;
  height: 100%;
}

.pdf-iframe {
  width: 100%;
  height: 100%;
  min-height: 600px;
}

/* 状态样式 */
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
