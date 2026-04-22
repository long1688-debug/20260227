<template>
  <div class="word-content">
    <!-- Word文档容器 -->
    <div v-if="isValidSource" class="word-container">
      <!-- 文档工具栏 -->
      <div class="document-toolbar">
        <div class="document-info">
          <el-icon><Document /></el-icon>
          <span class="document-name">{{ documentName }}</span>
          <el-tag v-if="readonly" size="small" type="info">只读</el-tag>
        </div>

        <div class="document-controls">
          <el-button-group size="small">
            <el-button :disabled="totalPages <= 1 || currentPage <= 1" @click="previousPage">
              <el-icon><ArrowLeft /></el-icon>
            </el-button>
            <el-button disabled>{{ currentPage }} / {{ totalPages || '?' }}</el-button>
            <el-button :disabled="totalPages <= 1 || currentPage >= totalPages" @click="nextPage">
              <el-icon><ArrowRight /></el-icon>
            </el-button>
          </el-button-group>

          <el-select v-model="zoomLevel" size="small" style="width: 100px">
            <el-option label="50%" :value="50" />
            <el-option label="75%" :value="75" />
            <el-option label="100%" :value="100" />
            <el-option label="125%" :value="125" />
            <el-option label="150%" :value="150" />
          </el-select>
        </div>
      </div>

      <!-- 文档内容显示 -->
      <div class="document-display" :style="displayStyle" @touchstart="handleTouchStart" @touchend="handleTouchEnd">
        <!-- 🎯 使用 docx-preview 渲染容器 -->
        <div ref="docxContainer" class="docx-container"></div>

        <!-- 占位符 -->
        <div v-if="!isDocumentLoaded" class="document-placeholder">
          <el-icon :size="64"><Document /></el-icon>
          <p>{{ documentName }}</p>
          <small>文档预览不可用</small>
          <el-button size="small" type="primary" style="margin-top: 12px" @click="downloadDocument">
            <el-icon><Download /></el-icon>
            下载文档
          </el-button>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-else-if="isLoading" class="loading-state">
      <el-icon class="is-loading" :size="48"><Loading /></el-icon>
      <p>加载中...</p>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="hasError" class="error-state">
      <el-icon :size="48"><WarningFilled /></el-icon>
      <p>文档加载失败</p>
      <small>{{ errorMessage || '请检查文件是否有效' }}</small>
      <el-button size="small" type="primary" style="margin-top: 12px" @click="retryLoad">
        重试
      </el-button>
    </div>

    <!-- 默认占位符 -->
    <div v-else class="placeholder">
      <el-icon :size="64"><Document /></el-icon>
      <p>Word文档</p>
      <small>支持 .doc, .docx 格式</small>
      <el-button size="small" type="primary" style="margin-top: 12px" @click="handleUpload">
        上传文档
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import {
  Document, Loading, WarningFilled,
  ArrowLeft, ArrowRight, Download
} from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { renderAsync } from 'docx-preview'; // 🎯 导入 docx-preview

const props = defineProps({
  source: Object
});

const emit = defineEmits(['upload-word']);

// 状态管理
const isLoading = ref(false);
const hasError = ref(false);
const errorMessage = ref('');
const currentPage = ref(1);
const totalPages = ref(1);
const zoomLevel = ref(100);
const readonly = ref(true);
const isDocumentLoaded = ref(false);

// 文档相关
const docxContainer = ref(null);

/**
 * 验证源是否有效
 */
const isValidSource = computed(() => {
  // 🎯 支持 Microsoft Word 和 WPS Writer 格式
  return (
    props.source?.type === 'word' &&
    props.source?.file &&
    ['doc', 'docx', 'dot', 'dotx', 'wps', 'wpt', 'odt'].includes(
      props.source.originalExt || props.source.file.name.split('.').pop().toLowerCase()
    )
  );
});

/**
 * 获取文档名称
 */
const documentName = computed(() => {
  return props.source?.name || props.source?.file?.name || '未命名文档';
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
    updatePageVisibility();
  }
};

/**
 * 下一页
 */
const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
    updatePageVisibility();
  }
};

/**
 * 更新页面可见性 - 使用滚动方式
 */
const updatePageVisibility = () => {
  if (!docxContainer.value) return;

  // 尝试多种选择器，以适应不同版本的 docx-preview
  const selectors = [
    '.docx-wrapper > section',
    '.docx-wrapper section',
    'section.docx-page',
    '.docx-preview section'
  ];

  let pages = null;
  for (const selector of selectors) {
    pages = docxContainer.value.querySelectorAll(selector);
    if (pages && pages.length > 0) {
      console.log('[WordContent] 找到页面，使用选择器:', selector);
      break;
    }
  }

  if (pages && pages.length > 0) {
    // 使用滚动方式定位到指定页面
    const targetPage = pages[currentPage.value - 1];
    if (targetPage) {
      targetPage.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest'
      });
    }
  } else {
    console.warn('[WordContent] 未找到任何页面元素');
  }
};

/**
 * 上传文档
 */
const handleUpload = () => {
  emit('upload-word');
};

/**
 * 重试加载
 */
const retryLoad = () => {
  hasError.value = false;
  loadDocument();
};

/**
 * 下载文档
 */
const downloadDocument = () => {
  const file = props.source?.file;
  if (file) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success('文档下载已开始');
  }
};

/**
 * 加载Word文档
 */
const loadDocument = async () => {
  if (!isValidSource.value) return;

  isLoading.value = true;
  hasError.value = false;
  isDocumentLoaded.value = false;

  try {
    const file = props.source.file;
    const fileName = file?.name || '';
    // 🎯 优先使用 source 中提供的原始扩展名，否则从文件名获取
    const fileExt = (props.source.originalExt || fileName.split('.').pop())?.toLowerCase();

    console.log('[WordContent] 加载Word文档:', fileName, '扩展名:', fileExt);

    // 🎯 使用 docx-preview 解析 Word 文档（支持 .docx）
    if (fileExt === 'docx') {
      // 清空容器
      if (docxContainer.value) {
        docxContainer.value.innerHTML = '';
      }

      // 等待 DOM 更新
      await nextTick();

      // 使用 docx-preview 渲染文档
      await renderAsync(file, docxContainer.value, null, {
        className: 'docx-preview',
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: false,
        breakPages: true,
        useBase64URL: true,
        renderChanges: false,
        experimental: false
      });

      // 获取总页数 - 使用多种选择器尝试
      const selectors = [
        '.docx-wrapper > section',
        '.docx-wrapper section',
        'section.docx-page',
        '.docx-preview section'
      ];

      let pages = null;
      for (const selector of selectors) {
        pages = docxContainer.value.querySelectorAll(selector);
        if (pages && pages.length > 0) {
          console.log('[WordContent] 找到页面，使用选择器:', selector, '页数:', pages.length);
          break;
        }
      }

      if (pages && pages.length > 0) {
        totalPages.value = pages.length;
        console.log('[WordContent] 文档总页数:', totalPages.value);

        // 初始化页面可见性
        updatePageVisibility();

        isDocumentLoaded.value = true;
        console.log('[WordContent] DOCX 文档加载成功');
      } else {
        throw new Error('无法解析文档页数');
      }

    // 🎯 WPS Writer 格式 (.wps, .wpt)
    } else if (['wps', 'wpt'].includes(fileExt)) {
      throw new Error('WPS 格式需要转换为 .docx 格式才能预览。建议使用 WPS Office 或 Microsoft Word 另存为 .docx 格式。');

    // 🎯 OpenDocument 格式 (.odt)
    } else if (fileExt === 'odt') {
      throw new Error('ODT 格式需要转换为 .docx 格式才能预览');

    // 🎯 旧版 Word 格式 (.doc)
    } else if (fileExt === 'doc') {
      throw new Error('.doc 格式不支持直接解析，请转换为 .docx 格式。建议使用 Microsoft Word 或 WPS Office 另存为 .docx 格式。');

    } else {
      throw new Error('不支持的文件格式: .' + fileExt);
    }

    // 设置只读状态
    readonly.value = props.source?.properties?.readonly !== false;

    isLoading.value = false;
  } catch (error) {
    console.error('[WordContent] Word文档加载失败:', error);
    hasError.value = true;

    // 🎯 增强错误消息处理
    if (error.message) {
      errorMessage.value = error.message;
    } else if (error.toString && error.toString() !== '[object Object]') {
      errorMessage.value = error.toString();
    } else {
      errorMessage.value = '文档解析失败，请检查文件格式是否正确';
    }

    isLoading.value = false;
    isDocumentLoaded.value = false;
  }
};

// 监听source变化
watch(() => props.source?.id, (newId, oldId) => {
  if (newId && newId !== oldId) {
    currentPage.value = 1;
    loadDocument();
  }
});

/**
 * 🎯 处理键盘事件 - 支持左右方向键翻页
 */
const handleKeydown = (event) => {
  if (!isValidSource.value || hasError.value) return;

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

// 🎯 触摸滑动翻页支持
const touchStartX = ref(0);
const touchStartY = ref(0);
const touchThreshold = 50; // 滑动阈值(像素)

const handleTouchStart = (event) => {
  touchStartX.value = event.touches[0].clientX;
  touchStartY.value = event.touches[0].clientY;
};

const handleTouchEnd = (event) => {
  if (!isValidSource.value || hasError.value) return;

  const touchEndX = event.changedTouches[0].clientX;
  const touchEndY = event.changedTouches[0].clientY;

  const deltaX = touchEndX - touchStartX.value;
  const deltaY = touchEndY - touchStartY.value;

  // 确保是水平滑动（垂直滑动可能是滚动）
  if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > touchThreshold) {
    event.preventDefault();
    if (deltaX > 0) {
      // 向右滑动 -> 上一页
      previousPage();
    } else {
      // 向左滑动 -> 下一页
      nextPage();
    }
  }
};

// 组件挂载时加载文档并添加键盘监听
onMounted(() => {
  if (isValidSource.value) {
    loadDocument();
  }
  window.addEventListener('keydown', handleKeydown);
});

// 组件卸载时移除键盘监听
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped lang="scss">
.word-content {
  width: 100%;
  height: 100%;
  background: #f0f0f0;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .word-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    .document-toolbar {
      background: white;
      padding: 8px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #e4e7ed;

      .document-info {
        display: flex;
        align-items: center;
        gap: 8px;

        .document-name {
          font-size: 14px;
          color: #303133;
          font-weight: 500;
        }
      }

      .document-controls {
        display: flex;
        align-items: center;
        gap: 12px;
      }
    }

    .document-display {
      flex: 1;
      overflow: auto;
      padding: 20px;
      background: #f5f5f5;

      .docx-container {
        width: 100%;
        height: 100%;

        :deep(.docx-wrapper) {
          background: white;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          margin: 0 auto;
          padding: 20px;

          > section {
            margin-bottom: 20px;
            page-break-after: always;
          }
        }
      }

      .document-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #909399;
      }
    }
  }

  .loading-state,
  .error-state,
  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    color: #606266;

    p {
      margin: 0;
      font-size: 16px;
    }

    small {
      font-size: 12px;
      color: #909399;
    }
  }

  .error-state {
    p {
      color: #f56c6c;
    }
  }
}
</style>
