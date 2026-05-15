<template>
  <el-dialog
    v-model="visible"
    title="信号源属性"
    width="600px"
    :close-on-click-modal="false"
  >
    <div v-if="source" class="properties-form">
      <!-- 基本信息 -->
      <el-form label-width="100px">
        <el-form-item label="名称">
          <el-input v-model="source.name" placeholder="输入信号源名称" />
        </el-form-item>
        
        <!-- 网页URL配置 -->
        <el-form-item v-if="source.type === 'webpage'" label="网页URL">
          <el-input 
            v-model="source.properties.url" 
            placeholder="请输入完整的HTTP/HTTPS地址"
            @blur="validateUrl"
          />
          <div v-if="urlError" class="error-tip">{{ urlError }}</div>
          <small class="help-text">示例: https://www.example.com</small>
        </el-form-item>
        
        <!-- 视频源配置 -->
        <el-form-item v-if="source.type === 'video'" label="视频地址">
          <el-input v-model="source.properties.src" placeholder="视频文件路径或URL" />
        </el-form-item>
        
        <!-- 图片源配置 -->
        <el-form-item v-if="source.type === 'image'" label="图片地址">
          <el-input v-model="source.properties.src" placeholder="图片文件路径或URL" />
        </el-form-item>
        
        <!-- 文本内容配置 -->
        <el-form-item v-if="source.type === 'text'" label="文本内容">
          <el-input 
            v-model="source.properties.content" 
            type="textarea"
            :rows="4"
            placeholder="输入文本内容"
          />
        </el-form-item>
        
        <!-- 位置信息(只读) -->
        <el-divider>位置与尺寸</el-divider>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="X坐标">
              <el-input-number v-model="source.x" :min="0" :max="100" :step="1" />
              <span class="unit">%</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Y坐标">
              <el-input-number v-model="source.y" :min="0" :max="100" :step="1" />
              <span class="unit">%</span>
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="宽度">
              <el-input-number v-model="source.width" :min="5" :max="100" :step="1" />
              <span class="unit">%</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="高度">
              <el-input-number v-model="source.height" :min="5" :max="100" :step="1" />
              <span class="unit">%</span>
            </el-form-item>
          </el-col>
        </el-row>
        
        <!-- 滤镜设置 -->
        <el-divider>滤镜效果</el-divider>
        <div class="filter-controls">
          <div v-for="filter in filterOptions" :key="filter.key" class="filter-item">
            <label>{{ filter.label }}</label>
            <el-slider 
              v-model="source.filters[filter.key]"
              :min="filter.min"
              :max="filter.max"
              :step="filter.step || 1"
              show-input
            />
          </div>
        </div>
        
        <el-button size="small" @click="resetFilters">重置滤镜</el-button>
      </el-form>
    </div>
    
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="handleSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useCanvasStore } from '@/stores/canvasStore';
import { FILTER_OPTIONS } from '@/constants/canvasSourceTypes';

const canvasStore = useCanvasStore();

const visible = ref(false);
const sourceId = ref(null);
const urlError = ref('');

// 当前编辑的信号源
const source = computed(() => {
  if (!sourceId.value) return null;
  return canvasStore.sources.find(s => s.id === sourceId.value);
});

// 滤镜选项
const filterOptions = FILTER_OPTIONS;

/**
 * 打开属性面板
 */
function open(sourceIdParam) {
  sourceId.value = sourceIdParam;
  urlError.value = '';
  visible.value = true;
}

/**
 * 验证URL格式
 */
function validateUrl() {
  if (!source.value || source.value.type !== 'webpage') return;
  
  const url = source.value.properties.url;
  if (!url) {
    urlError.value = '';
    return;
  }
  
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      urlError.value = '仅支持 http:// 或 https:// 协议';
    } else {
      urlError.value = '';
    }
  } catch {
    urlError.value = 'URL格式不正确';
  }
}

/**
 * 重置滤镜
 */
function resetFilters() {
  if (source.value) {
    canvasStore.resetFilters(source.value.id);
  }
}

/**
 * 保存修改
 */
function handleSave() {
  // 如果是网页类型,验证URL
  if (source.value?.type === 'webpage' && urlError.value) {
    return;
  }
  
  visible.value = false;
}

// 暴露方法给父组件
defineExpose({
  open
});
</script>

<style scoped lang="scss">
.properties-form {
  max-height: 60vh;
  overflow-y: auto;
  
  .error-tip {
    color: #e53e3e;
    font-size: 12px;
    margin-top: 4px;
  }
  
  .help-text {
    display: block;
    color: #718096;
    font-size: 12px;
    margin-top: 4px;
  }
  
  .unit {
    margin-left: 8px;
    color: #718096;
    font-size: 13px;
  }
  
  .filter-controls {
    .filter-item {
      margin-bottom: 16px;
      
      label {
        display: block;
        margin-bottom: 8px;
        font-size: 13px;
        color: #cbd5e0;
      }
    }
  }
}
</style>
