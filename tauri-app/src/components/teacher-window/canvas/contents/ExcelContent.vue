<template>
  <div class="excel-content">
    <!-- Excel 表格内容 -->
    <div v-if="sheets.length > 0" class="spreadsheet-viewer">
      <!-- 工作表标签 -->
      <div class="sheet-tabs" v-if="sheets.length > 1">
        <el-button
          v-for="(sheet, index) in sheets"
          :key="index"
          size="small"
          :type="currentSheetIndex === index ? 'primary' : ''"
          @click="currentSheetIndex = index"
        >
          {{ sheet.name || `Sheet ${index + 1}` }}
        </el-button>
      </div>
      
      <!-- 表格内容 -->
      <div class="table-container">
        <table v-if="currentSheetData" class="excel-table">
          <tbody>
            <tr v-for="(row, rowIndex) in currentSheetData" :key="rowIndex">
              <td 
                v-for="(cell, colIndex) in row" 
                :key="colIndex"
                :class="{ 'header-cell': rowIndex === 0 }"
              >
                {{ cell }}
              </td>
            </tr>
          </tbody>
        </table>
        
        <div v-else class="empty-sheet">
          <p>当前工作表为空</p>
        </div>
      </div>
    </div>
    
    <!-- 加载状态 -->
    <div v-else-if="loading" class="loading-state">
      <el-icon class="is-loading"><Loading /></el-icon>
      <p>正在解析 Excel 文件...</p>
    </div>
    
    <!-- 错误状态 -->
    <div v-else-if="error" class="error-state">
      <el-icon><Warning /></el-icon>
      <p>{{ error }}</p>
    </div>
    
    <!-- 空状态 -->
    <div v-else class="empty-state">
      <el-icon :size="64"><Document /></el-icon>
      <p>暂无 Excel 文件内容</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { Document, Loading, Warning } from '@element-plus/icons-vue';

const props = defineProps({
  source: {
    type: Object,
    required: true
  }
});

// 状态
const sheets = ref([]);
const currentSheetIndex = ref(0);
const loading = ref(false);
const error = ref('');

// 计算属性
const currentSheetData = computed(() => {
  if (sheets.value.length === 0) return null;
  return sheets.value[currentSheetIndex.value]?.data || [];
});

// 方法
const loadExcel = async () => {
  if (!props.source) return;
  
  loading.value = true;
  error.value = '';
  
  try {
    console.log('[ExcelContent] 加载 Excel 文件:', props.source.name);
    
    // TODO: 实现 Excel 解析逻辑
    // 可以使用 SheetJS (xlsx.js) 库来解析 .xlsx 文件
    
    // 临时占位实现
    sheets.value = [
      {
        name: 'Sheet1',
        data: [
          ['A1', 'B1', 'C1'],
          ['A2', 'B2', 'C2'],
          ['A3', 'B3', 'C3']
        ]
      }
    ];
    
  } catch (err) {
    console.error('[ExcelContent] 加载失败:', err);
    error.value = 'Excel 文件加载失败: ' + err.message;
  } finally {
    loading.value = false;
  }
};

// 监听 source 变化
watch(() => props.source, (newSource) => {
  if (newSource) {
    loadExcel();
  }
}, { immediate: true });

onMounted(() => {
  loadExcel();
});
</script>

<style scoped lang="scss">
.excel-content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden;
}

.spreadsheet-viewer {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.sheet-tabs {
  display: flex;
  gap: 8px;
  padding: 8px;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
  overflow-x: auto;
}

.table-container {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.excel-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  
  td {
    border: 1px solid #ddd;
    padding: 8px 12px;
    min-width: 80px;
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .header-cell {
    background: #f0f0f0;
    font-weight: bold;
  }
  
  tr:nth-child(even) {
    background: #fafafa;
  }
  
  tr:hover {
    background: #e8f4ff;
  }
}

.empty-sheet {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #999;
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
