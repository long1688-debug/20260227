<template>
  <div class="document-viewer" :class="{ 'has-controls': showControls }">
    <!-- 文档内容区域 -->
    <div class="document-content">
      <!-- Word 文档 -->
      <div v-if="documentType === 'word'" class="word-viewer">
        <!-- 内容显示 -->
        <div class="page-container">
          <div
            v-for="(page, index) in pages"
            :key="index"
            class="document-page"
            :class="{ active: currentPage === index }"
            v-html="page.content"
          ></div>
        </div>
      </div>

      <!-- PDF 文档 -->
      <div v-else-if="documentType === 'pdf'" class="pdf-viewer">
        <div class="pdf-container">
          <div v-if="pdfPages.length > 0" class="pdf-page-wrapper">
            <div
              v-for="(page, index) in pdfPages"
              :key="index"
              class="pdf-page"
              :class="{ active: currentPage === index }"
            >
              <canvas :ref="`pdfCanvas-${index}`" class="pdf-canvas"></canvas>
            </div>
          </div>
          <div v-else-if="loading" class="loading-state">
            <el-icon class="is-loading"><Loading /></el-icon>
            <p>正在加载 PDF...</p>
          </div>
          <div v-else class="pdf-placeholder">
            <iframe
              v-if="sourceUrl"
              :src="sourceUrl"
              class="pdf-iframe"
              frameborder="0"
            ></iframe>
          </div>
        </div>
      </div>

      <!-- PPT 文档 -->
      <div v-else-if="documentType === 'ppt'" class="ppt-viewer">
        <div class="ppt-container">
          <div
            v-for="(slide, index) in slides"
            :key="index"
            class="ppt-slide"
            :class="{ active: currentPage === index }"
            v-html="slide.content"
          ></div>
        </div>
      </div>

      <!-- 通用文档视图 -->
      <div v-else class="generic-viewer">
        <iframe
          v-if="sourceUrl"
          :src="sourceUrl"
          class="document-iframe"
          frameborder="0"
        ></iframe>
        <div v-else class="empty-state">
          <el-icon :size="64"><Document /></el-icon>
          <p>暂无文档内容</p>
        </div>
      </div>
    </div>

    <!-- 翻页控制栏 -->
    <div v-if="showControls && totalPages > 1" class="page-controls">
      <div class="controls-left">
        <el-button
          size="small"
          :disabled="currentPage === 0"
          @click="firstPage"
          :icon="ArrowLeft"
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

      <div class="controls-center">
        <!-- 页码输入 -->
        <div class="page-input-group">
          <el-input
            v-model.number="pageInput"
            type="number"
            :min="1"
            :max="totalPages"
            class="page-input"
            @change="goToPage"
            @keyup.enter="goToPage"
          />
          <span class="page-separator">/</span>
          <span class="total-pages">{{ totalPages }}</span>
        </div>

        <!-- 进度条 -->
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: progressPercent + '%' }"
          ></div>
        </div>
      </div>

      <div class="controls-right">
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

    <!-- 工具栏 -->
    <div v-if="showControls" class="toolbar">
      <div class="toolbar-left">
        <span class="document-title">{{ documentName }}</span>
      </div>

      <div class="toolbar-center">
        <span class="view-mode-indicator">单页视图</span>
      </div>

      <div class="toolbar-right">
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
            title="重置缩放"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { Document, Loading, ArrowLeft, ArrowRight, ZoomIn, ZoomOut, Refresh } from '@element-plus/icons-vue';
const props = defineProps({
 source: {
 type: Object,
 required: true
 },
 showControls: {
 type: Boolean,
 default: true
 }
});
// 状态
const documentType = ref('');
const documentName = ref('');
const sourceUrl = ref('');
const loading = ref(false);
const currentPage = ref(0);
const pageInput = ref(1);
const zoom = ref(1);
const viewMode = ref('single'); // single, continuous, two-page
// 文档数据
const pages = ref([]); // Word 页面
const slides = ref([]); // PPT 幻灯片
const pdfPages = ref([]); // PDF 页面
const pdfDoc = ref(null);
// 计算属性
const totalPages = computed(() => {
 if (documentType.value === 'ppt')
 return slides.value.length;
 if (documentType.value === 'word')
 return pages.value.length;
 if (documentType.value === 'pdf')
 return pdfPages.value.length || 1;
 return 1;
});
const progressPercent = computed(() => {
 if (totalPages.value <= 1)
 return 100;
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
 }
 else {
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
// 视图模式
const setViewMode = (mode) => {
 viewMode.value = mode;
};
// 加载文档
const loadDocument = async () => {
 if (!props.source)
 return;
 loading.value = true;
 documentName.value = props.source.name || '文档';
 // 确定文档类型
 const ext = props.source.name?.split('.').pop().toLowerCase() || '';
 const typeMap = {
 'doc': 'word',
 'docx': 'word',
 'wps': 'word',
 'pdf': 'pdf',
 'ppt': 'ppt',
 'pptx': 'ppt',
 'dps': 'ppt'
 };
 documentType.value = typeMap[ext] || 'other';
 sourceUrl.value = props.source.url || props.source.path || '';
 try {
 switch (documentType.value) {
 case 'word':
 await loadWordDocument();
 break;
 case 'pdf':
 await loadPdfDocument();
 break;
 case 'ppt':
 await loadPptDocument();
 break;
 }
 }
 catch (error) {
 console.error('[DocumentViewer] 加载文档失败:', error);
 }
 finally {
 loading.value = false;
 }
};
// 加载 Word 文档（模拟分页）
const loadWordDocument = async () => {
 // 模拟 Word 文档内容和分页
 const content = `
 <h1>${documentName.value}</h1>
 <p>这是一份 Word 文档的预览内容。文档查看器支持完整的翻页功能，包括：</p>
 <ul>
 <li>点击翻页按钮切换页面</li>
 <li>直接输入页码跳转</li>
 <li>使用进度条快速定位</li>
 <li>支持多种视图模式</li>
 </ul>
 <p>文档内容会根据实际内容自动分页显示。</p>
 `;
 // 模拟分页（实际应根据内容高度分页）
 pages.value = [
 { content: `<div style="padding: 40px;">${content}</div>` },
 { content: `<div style="padding: 40px;"><h2>第二页内容</h2><p>这是文档的第二页，可以包含更多的文本、图片和表格。</p><p>Word 文档支持复杂的格式设置，包括字体、颜色、对齐方式等。</p></div>` },
 { content: `<div style="padding: 40px;"><h2>第三页内容</h2><p>这是文档的第三页，展示更多内容...</p><table style="width:100%;border-collapse:collapse;"><tr><th>项目</th><th>描述</th></tr><tr><td>功能1</td><td>翻页浏览</td></tr><tr><td>功能2</td><td>缩放控制</td></tr><tr><td>功能3</td><td>视图模式</td></tr></table></div>` }
 ];
 currentPage.value = 0;
 updatePageInput();
};
// 加载 PDF 文档
const loadPdfDocument = async () => {
 // 如果有 URL，尝试使用 iframe 加载
 if (sourceUrl.value) {
 // 尝试使用 PDF.js 或原生方式加载
 // 这里简化处理，使用占位页面
 pdfPages.value = [
 { index: 0 },
 { index: 1 },
 { index: 2 },
 { index: 3 }
 ];
 currentPage.value = 0;
 updatePageInput();
 }
};
// 加载 PPT 文档
const loadPptDocument = async () => {
 slides.value = [
 { content: `<div style="padding: 40px; text-align:center;"><h1>${documentName.value}</h1><p>欢迎使用文档查看器</p></div>` },
 { content: `<div style="padding: 40px;"><h2>幻灯片 2</h2><p>这是第二张幻灯片的内容，可以包含文字、图片和图表。</p></div>` },
 { content: `<div style="padding: 40px;"><h2>幻灯片 3</h2><p>这是第三张幻灯片的内容。</p><ul><li>项目符号1</li><li>项目符号2</li><li>项目符号3</li></ul></div>` },
 { content: `<div style="padding: 40px;"><h2>幻灯片 4</h2><p>这是最后一张幻灯片。</p><p>感谢观看！</p></div>` }
 ];
 currentPage.value = 0;
 updatePageInput();
};
// 键盘事件处理
const handleKeydown = (e) => {
 if (!showControls.value)
 return;
 switch (e.key) {
 case 'ArrowLeft':
 if (e.ctrlKey || e.metaKey) {
 firstPage();
 }
 else {
 prevPage();
 }
 break;
 case 'ArrowRight':
 if (e.ctrlKey || e.metaKey) {
 lastPage();
 }
 else {
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
// 监听 source 变化
watch(() => props.source, () => {
 loadDocument();
}, { immediate: true });
onMounted(() => {
 loadDocument();
 document.addEventListener('keydown', handleKeydown);
});
onUnmounted(() => {
 document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped lang="scss">
.document-viewer {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #fff;
  overflow: hidden;

  &.has-controls {
    .document-content {
      height: calc(100% - 100px);
    }
  }
}

.document-content {
  flex: 1;
  overflow: auto;
  position: relative;
  padding: 20px;
}

/* Word 查看器 */
.word-viewer {
  width: 100%;
  height: 100%;
}

.page-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.document-page {
  width: 100%;
  max-width: 800px;
  min-height: 600px;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  padding: 40px;
  margin-bottom: 20px;
  display: none;

  &.active {
    display: block;
  }

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

/* PDF 查看器 */
.pdf-viewer {
  width: 100%;
  height: 100%;
}

.pdf-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pdf-page-wrapper {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.pdf-page {
  width: 100%;
  max-width: 800px;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-bottom: 20px;
  display: none;

  &.active {
    display: block;
  }
}

.pdf-canvas {
  width: 100%;
  height: auto;
}

.pdf-iframe {
  width: 100%;
  height: 100%;
  min-height: 600px;
}

.pdf-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
}

/* PPT 查看器 */
.ppt-viewer {
  width: 100%;
  height: 100%;
}

.ppt-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ppt-slide {
  width: 100%;
  max-width: 960px;
  aspect-ratio: 16 / 9;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 40px;
  display: none;

  &.active {
    display: block;
  }

  :deep(*) {
    max-width: 100%;
  }
}

/* 通用文档视图 */
.generic-viewer {
  width: 100%;
  height: 100%;
}

.document-iframe {
  width: 100%;
  height: 100%;
}

.empty-state {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
}

/* 翻页控制栏 */
.page-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #f8f9fa;
  border-top: 1px solid #e0e0e0;
}

.controls-left,
.controls-right {
  display: flex;
  gap: 8px;
}

.controls-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.page-input-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.page-input {
  width: 60px;
  text-align: center;
}

.page-separator {
  color: #999;
}

.total-pages {
  color: #666;
  font-size: 14px;
  min-width: 40px;
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
  padding: 8px 20px;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
}

.toolbar-left {
  flex: 1;
}

.document-title {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 300px;
}

.toolbar-center {
  flex: 2;
  display: flex;
  justify-content: center;
}

.toolbar-right {
  flex: 1;
  display: flex;
  justify-content: flex-end;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zoom-value {
  min-width: 60px;
  text-align: center;
  font-size: 14px;
  color: #666;
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
  gap: 12px;

  p {
    margin: 0;
  }
}
</style>
