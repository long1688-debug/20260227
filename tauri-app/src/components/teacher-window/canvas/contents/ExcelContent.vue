<template>
  <div class="excel-content">
    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-state">
      <el-icon class="is-loading" :size="48"><Loading /></el-icon>
      <p>正在加载 Excel 表格...</p>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="hasError" class="error-state">
      <el-icon :size="48"><WarningFilled /></el-icon>
      <p>Excel 文件解析失败</p>
      <small>{{ errorMessage || '请确保文件格式正确' }}</small>
      <el-button size="small" type="primary" style="margin-top: 12px" @click="retryLoad">
        重新加载
      </el-button>
    </div>

    <!-- Excel 内容(真实解析后) -->
    <div v-else-if="isDocumentLoaded" class="excel-container">
      <!-- 工具栏 -->
      <div class="excel-toolbar">
        <div class="sheet-selector">
          <el-select v-model="currentSheetIndex" size="small" @change="handleSheetChange">
            <el-option
              v-for="(sheet, index) in sheets"
              :key="index"
              :label="sheet.name"
              :value="index"
            />
          </el-select>
        </div>

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
          <span class="row-info" v-if="totalRows > 0">
            共 {{ totalRows }} 行
          </span>
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

      <!-- 表格内容 -->
      <div class="excel-display" :style="displayStyle" @touchstart="handleTouchStart" @touchend="handleTouchEnd">
        <table class="excel-table">
          <thead>
            <tr>
              <th v-for="(header, index) in currentHeaders" :key="index">
                {{ header }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, rowIndex) in paginatedData" :key="rowIndex">
              <td v-for="(cell, cellIndex) in row" :key="cellIndex">
                {{ cell }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 占位符模式 - 显示兼容性信息 -->
    <div v-else class="placeholder">
      <el-icon :size="64"><Files /></el-icon>
      <h3 class="doc-title">{{ props.source?.name }}</h3>

      <!-- 兼容性级别提示 -->
      <div class="compatibility-banner" :class="`level-${compatibilityLevel}`">
        <el-icon :size="20"><InfoFilled /></el-icon>
        <span>{{ compatibilityMessage }}</span>
      </div>

      <!-- 功能说明 -->
      <div class="feature-info">
        <h4>📋 当前状态</h4>
        <ul>
          <li>✅ 文件已成功添加</li>
          <li>⏳ Excel 真实解析功能开发中</li>
          <li>💡 建议转换为 PDF 获得最佳预览效果</li>
        </ul>
      </div>

      <!-- 操作建议 -->
      <div class="action-suggestions">
        <el-button type="primary" size="small" @click="convertToPdf">
          <el-icon><Document /></el-icon>
          转换为 PDF (推荐)
        </el-button>
        <el-button size="small" @click="openInExternalApp">
          <el-icon><Right /></el-icon>
          用外部应用打开
        </el-button>
      </div>

      <p class="file-info">
        格式: .{{ fileExtension }} |
        大小: {{ formatFileSize(props.source?.file?.size) }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { Files, Loading, WarningFilled, InfoFilled, Document, Right, ZoomIn, ZoomOut, ArrowLeft, ArrowRight } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { checkFormatCompatibility, generateUserWarning } from '@/utils/documentTypeDetector';
import * as XLSX from 'xlsx'; // 🎯 导入 SheetJS

const props = defineProps({
  source: Object
});

// 状态管理
const isLoading = ref(false);
const hasError = ref(false);
const errorMessage = ref('');
const isDocumentLoaded = ref(false);
const zoomLevel = ref(100);

// Excel 数据
const sheets = ref([]);
const currentSheetIndex = ref(0);
const currentData = ref([]);
const currentHeaders = ref([]);

// 分页状态
const currentPage = ref(1);
const totalPages = ref(1);
const totalRows = ref(0);
const rowsPerPage = ref(20); // 每页显示行数

/**
 * 🎯 计算兼容性级别
 */
const compatibilityLevel = computed(() => {
  const ext = props.source?.originalExt ||
              props.source?.file?.name?.split('.').pop()?.toLowerCase() || ''
  const compat = checkFormatCompatibility(ext)
  return compat.level
})

/**
 * 🎯 生成兼容性提示信息
 */
const compatibilityMessage = computed(() => {
  const ext = props.source?.originalExt ||
              props.source?.file?.name?.split('.').pop()?.toLowerCase() || ''
  const warning = generateUserWarning(ext)
  return warning || 'Excel 预览功能开发中'
})

/**
 * 🎯 获取文件扩展名
 */
const fileExtension = computed(() => {
  return props.source?.originalExt ||
         props.source?.file?.name?.split('.').pop()?.toLowerCase() || 'unknown'
})

/**
 * 获取显示样式
 */
const displayStyle = computed(() => {
  return {
    transform: `scale(${zoomLevel.value / 100})`,
    transformOrigin: 'top left'
  };
});

/**
 * 获取分页后的数据
 */
const paginatedData = computed(() => {
  if (!currentData.value || currentData.value.length === 0) {
    return [];
  }

  const startIndex = (currentPage.value - 1) * rowsPerPage.value;
  const endIndex = startIndex + rowsPerPage.value;

  return currentData.value.slice(startIndex, endIndex);
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
 * 计算总页数
 */
const calculatePages = () => {
  totalRows.value = currentData.value.length;
  totalPages.value = Math.max(1, Math.ceil(totalRows.value / rowsPerPage.value));
  currentPage.value = 1;
};

/**
 * 格式化文件大小
 */
const formatFileSize = (bytes) => {
  if (!bytes) return '未知'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

/**
 * 放大
 */
const zoomIn = () => {
  if (zoomLevel.value < 200) {
    zoomLevel.value += 25;
  }
};

/**
 * 缩小
 */
const zoomOut = () => {
  if (zoomLevel.value > 50) {
    zoomLevel.value -= 25;
  }
};

/**
 * 切换工作表
 */
const handleSheetChange = (index) => {
  currentSheetIndex.value = index;
  loadSheetData(index);
};

/**
 * 加载工作表数据
 */
const loadSheetData = (sheetIndex) => {
  if (!sheets.value[sheetIndex]) return;

  const sheet = sheets.value[sheetIndex];
  const worksheet = sheet.worksheet;

  // 将工作表转换为 JSON 数据
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  if (jsonData && jsonData.length > 0) {
    // 第一行作为表头
    currentHeaders.value = jsonData[0];
    // 剩余行作为数据
    currentData.value = jsonData.slice(1);
  } else {
    currentHeaders.value = [];
    currentData.value = [];
  }

  // 计算页数
  calculatePages();
};

/**
 * 🎯 转换为 PDF (调用后端服务或提示用户)
 */
const convertToPdf = () => {
  ElMessage.info('PDF 转换功能开发中，请使用 Office/WPS 另存为 PDF')
  // TODO: 集成后端转换服务
  // await invoke('convert_to_pdf', { filePath: props.source.filePath })
}

/**
 * 🎯 用外部应用打开
 */
const openInExternalApp = async () => {
  try {
    // Tauri: 使用 shell 插件打开文件
    if (window.__TAURI__) {
      const { open } = await import('@tauri-apps/plugin-shell')
      await open(props.source.filePath)
      ElMessage.success('已用默认应用打开文件')
    } else {
      ElMessage.warning('仅在 Tauri 环境中支持此功能')
    }
  } catch (error) {
    console.error('[ExcelContent] 打开文件失败:', error)
    ElMessage.error('打开文件失败')
  }
}

/**
 * 验证源是否有效
 */
const isValidSource = computed(() => {
  return (
    props.source?.type === 'excel' &&
    props.source?.file &&
    ['xls', 'xlsx', 'xlt', 'xltx', 'et', 'ett', 'ods'].includes(
      props.source.originalExt || props.source.file.name.split('.').pop().toLowerCase()
    )
  );
});

/**
 * 加载 Excel 文档
 */
const loadDocument = async () => {
  if (!isValidSource.value) return;

  isLoading.value = true;
  hasError.value = false;
  isDocumentLoaded.value = false;

  try {
    const file = props.source.file;
    const fileName = file.name.toLowerCase();
    const fileExt = (props.source.originalExt || fileName.split('.').pop()).toLowerCase();

    console.log('[ExcelContent] 加载 Excel 文档:', fileName, '扩展名:', fileExt);
    console.log('[ExcelContent] 兼容性级别:', compatibilityLevel.value);

    // 🎯 使用 SheetJS 解析 Excel 文件
    if (['xls', 'xlsx', 'xlt', 'xltx', 'et', 'ett', 'ods'].includes(fileExt)) {
      // 读取文件为 ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // 使用 SheetJS 解析工作簿
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      // 获取所有工作表
      const sheetNames = workbook.SheetNames;
      sheets.value = sheetNames.map(name => ({
        name: name,
        worksheet: workbook.Sheets[name]
      }));

      console.log('[ExcelContent] 解析成功，共', sheets.value.length, '个工作表');

      // 加载第一个工作表的数据
      if (sheets.value.length > 0) {
        currentSheetIndex.value = 0;
        loadSheetData(0);
        isDocumentLoaded.value = true;
      } else {
        throw new Error('Excel 文件中没有工作表');
      }
    } else {
      throw new Error('不支持的文件格式: ' + fileExt);
    }

    isLoading.value = false;
    console.log('[ExcelContent] Excel 文档加载成功');
  } catch (error) {
    console.error('[ExcelContent] Excel 文档加载失败:', error);
    hasError.value = true;
    errorMessage.value = error.message || 'Excel 文件解析失败';
    isLoading.value = false;
    isDocumentLoaded.value = false;
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
  if (!isDocumentLoaded.value || hasError.value) return;
  
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
  if (!isDocumentLoaded.value || hasError.value) return;
  
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
.excel-content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  overflow: hidden;
}

.excel-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .excel-toolbar {
    background: #f5f7fa;
    padding: 8px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #dcdfe6;

    .sheet-selector {
      flex: 1;
      max-width: 300px;
    }

    .page-nav {
      display: flex;
      align-items: center;
      gap: 12px;
      position: relative;
      z-index: 1;
    }

    .zoom-controls {
      display: flex;
      gap: 8px;
    }
  }

  .excel-display {
    flex: 1;
    overflow: auto;
    padding: 20px;
    background: #ffffff;

    .excel-table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

      th, td {
        border: 1px solid #dcdfe6;
        padding: 8px 12px;
        text-align: left;
        white-space: nowrap;
      }

      th {
        background: #f5f7fa;
        font-weight: 600;
        color: #606266;
        position: sticky;
        top: 0;
        z-index: 1;
      }

      tr:hover {
        background: #f5f7fa;
      }

      tr:nth-child(even) {
        background: #fafafa;
      }

      tr:nth-child(even):hover {
        background: #f5f7fa;
      }
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
  gap: 12px;
  padding: 40px;
  text-align: center;
  height: 100%;

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
    color: #f56c6c;
  }
}

// 占位符模式样式
.placeholder {
  .doc-title {
    font-size: 20px;
    color: #303133;
    margin: 16px 0 8px;
    font-weight: 600;
  }

  // 兼容性提示横幅
  .compatibility-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    border-radius: 8px;
    margin: 16px 0;
    font-size: 14px;

    &.level-placeholder {
      background: #FDF6EC;
      color: #E6A23C;
      border: 1px solid #F5DAB1;
    }

    &.level-partial {
      background: #F4F4F5;
      color: #909399;
      border: 1px solid #D3D4D6;
    }

    &.level-convert {
      background: #FEF0F0;
      color: #F56C6C;
      border: 1px solid #FBC4C4;
    }
  }

  // 功能说明
  .feature-info {
    background: #F5F7FA;
    padding: 16px 20px;
    border-radius: 8px;
    margin: 16px 0;
    text-align: left;
    width: 100%;
    max-width: 500px;

    h4 {
      margin: 0 0 12px;
      color: #606266;
      font-size: 14px;
    }

    ul {
      margin: 0;
      padding-left: 20px;

      li {
        margin: 8px 0;
        color: #909399;
        font-size: 13px;
        line-height: 1.6;
      }
    }
  }

  // 操作按钮
  .action-suggestions {
    display: flex;
    gap: 12px;
    margin: 16px 0;
  }

  // 文件信息
  .file-info {
    font-size: 12px;
    color: #C0C4CC;
    margin-top: 16px;
  }
}
</style>
