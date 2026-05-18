<template>
  <div class="word-content">
    <!-- 文档内容区域 -->
    <div class="document-container">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <el-icon class="is-loading"><Loading /></el-icon>
        <p>正在解析 Word 文档...</p>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="error-state">
        <el-icon><Warning /></el-icon>
        <p>{{ error }}</p>
      </div>

      <!-- 文档内容 -->
      <div v-else-if="pages.length > 0" class="pages-wrapper">
        <!-- 当前页面 -->
        <div
          class="document-page"
          :style="{ transform: `scale(${zoom})` }"
          v-html="currentPageContent"
        ></div>

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
              :icon="ChevronLeft"
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
              :icon="ArrowRight"
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

        <!-- 缩放控制 -->
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

      <!-- 空状态 -->
      <div v-else class="empty-state">
        <el-icon :size="64"><Document /></el-icon>
        <p>暂无 Word 文档内容</p>
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
const pages = ref([]);
const currentPage = ref(0);
const pageInput = ref(1);
const zoom = ref(1);
const loading = ref(false);
const error = ref('');

// 计算属性
const totalPages = computed(() => pages.value.length || 1);
const currentPageContent = computed(() => {
  if (pages.value.length === 0) return '';
  return pages.value[currentPage.value]?.content || '';
});
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

// 加载 Word 文档
const loadWord = async () => {
  if (!props.source) return;

  loading.value = true;
  error.value = '';

  try {
    console.log('[WordContent] 加载 Word 文档:', props.source.name);

    // 模拟 Word 文档内容（实际应使用 mammoth.js 解析）
    const documentContent = `
      <h1>${props.source.name}</h1>
      <p>这是一份 Word 文档的预览内容。文档查看器支持完整的翻页功能。</p>
      <h2>主要功能</h2>
      <ul>
        <li>🖱️ 点击翻页按钮切换页面</li>
        <li>🔢 直接输入页码跳转</li>
        <li>📊 使用进度条快速定位</li>
        <li>🔍 支持缩放控制</li>
        <li>⌨️ 支持键盘快捷键</li>
      </ul>
      <p>Word 文档支持富文本格式，包括字体样式、颜色、对齐方式、表格等。</p>
    `;

    // 模拟分页
    pages.value = [
      { content: `<div style="padding: 40px;">${documentContent}</div>` },
      { content: `<div style="padding: 40px;"><h2>第二页 - 表格示例</h2><p>以下是一个表格示例：</p><table style="width:100%;border-collapse:collapse;"><tr><th>功能模块</th><th>描述</th><th>状态</th></tr><tr><td>翻页浏览</td><td>支持多种翻页方式</td><td>✅ 完成</td></tr><tr><td>缩放控制</td><td>支持放大缩小</td><td>✅ 完成</td></tr><tr><td>视图模式</td><td>单页/双页切换</td><td>🔄 进行中</td></tr></table></div>` },
      { content: `<div style="padding: 40px;"><h2>第三页 - 更多内容</h2><p>这是文档的第三页，可以包含更多详细信息。</p><p>文档翻页功能已完善，支持：</p><ol><li>鼠标点击翻页</li><li>键盘快捷键翻页</li><li>页码输入跳转</li><li>进度条拖拽定位</li></ol></div>` }
    ];

    currentPage.value = 0;
    updatePageInput();

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
  loadWord();
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('doc-page-change', handleFullscreenPageChange);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('doc-page-change', handleFullscreenPageChange);
});
</script>

<style scoped lang="scss">
.word-content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden;
}

.document-container {
  flex: 1;
  overflow: auto;
}

.document-page {
  width: 100%;
  max-width: 800px;
  min-height: 600px;
  margin: 0 auto;
  padding: 20px;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transform-origin: center top;

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
    margin: 16px 0;
  }

  :deep(td), :deep(th) {
    border: 1px solid #ddd;
    padding: 12px;
    text-align: left;
  }

  :deep(th) {
    background: #f5f5f5;
    font-weight: 600;
  }

  :deep(tr:nth-child(even)) {
    background: #f9f9f9;
  }

  :deep(h1) {
    font-size: 24px;
    color: #333;
    margin-bottom: 16px;
    border-bottom: 2px solid #4299e1;
    padding-bottom: 8px;
  }

  :deep(h2) {
    font-size: 20px;
    color: #444;
    margin-top: 24px;
    margin-bottom: 12px;
  }

  :deep(p) {
    font-size: 14px;
    line-height: 1.8;
    color: #666;
    margin-bottom: 12px;
  }

  :deep(ul), :deep(ol) {
    padding-left: 24px;
    margin-bottom: 16px;
  }

  :deep(li) {
    font-size: 14px;
    line-height: 1.8;
    color: #666;
    margin-bottom: 6px;
  }
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

/* 缩放控制 */
.zoom-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 10px;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
}

.zoom-value {
  min-width: 60px;
  text-align: center;
  font-size: 14px;
  color: #666;
  font-weight: 500;
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
