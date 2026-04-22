<template>
  <div class="offline-ppt-viewer">
    <div class="upload-section">
      <input 
        type="file" 
        @change="handleFileUpload" 
        accept=".pptx" 
        id="pptx-input"
        :disabled="loading"
      />
      <label for="pptx-input" class="upload-btn">
        <el-icon><Document /></el-icon>
        选择 PPTX 文件
      </label>
    </div>

    <div v-if="loading" class="loading-overlay">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>正在解析 PPT,请稍候...</span>
    </div>

    <div v-if="error" class="error-message">
      <el-icon><WarningFilled /></el-icon>
      <span>{{ error }}</span>
    </div>

    <div 
      ref="pptContainer" 
      class="ppt-container"
      v-show="!loading && !error"
    ></div>

    <!-- 分页控制 -->
    <div v-if="totalSlides > 0" class="pagination-controls">
      <el-button 
        @click="prevSlide" 
        :disabled="currentSlide <= 1"
        size="small"
      >
        上一页
      </el-button>
      <span class="page-info">
        {{ currentSlide }} / {{ totalSlides }}
      </span>
      <el-button 
        @click="nextSlide" 
        :disabled="currentSlide >= totalSlides"
        size="small"
      >
        下一页
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue'
import { Document, Loading, WarningFilled } from '@element-plus/icons-vue'
import PptxJS from 'pptxjs'
import 'pptxjs/css/pptxjs.css'

// 响应式数据
const loading = ref(false)
const error = ref('')
const pptContainer = ref(null)
const currentSlide = ref(1)
const totalSlides = ref(0)
let pptxInstance = null

// 文件上传处理
const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  if (!file || !file.name.match(/\.pptx$/i)) {
    error.value = '请选择一个 .pptx 文件'
    return
  }

  // 重置状态
  loading.value = true
  error.value = ''
  currentSlide.value = 1
  totalSlides.value = 0

  try {
    // 读取文件为 ArrayBuffer
    const arrayBuffer = await readFileAsArrayBuffer(file)
    
    // 清空容器
    if (pptContainer.value) {
      pptContainer.value.innerHTML = ''
    }

    // 使用 PptxJS 渲染
    const result = await new Promise((resolve, reject) => {
      try {
        // 创建 PptxJS 实例
        pptxInstance = new PptxJS({
          element: pptContainer.value,
          data: arrayBuffer,
          success: (data) => {
            resolve(data)
          },
          error: (err) => {
            reject(err)
          },
          slideMode: true,
          showPlayBtn: false,
          width: '100%',
          height: 'auto'
        })
      } catch (err) {
        reject(err)
      }
    })

    // 获取总页数
    if (result && result.length) {
      totalSlides.value = result.length
    }

    loading.value = false
  } catch (err) {
    console.error('PPTX 解析失败:', err)
    error.value = `文件解析失败: ${err.message || '未知错误'}`
    loading.value = false
  }
}

// 读取文件为 ArrayBuffer
const readFileAsArrayBuffer = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsArrayBuffer(file)
  })
}

// 上一页
const prevSlide = () => {
  if (currentSlide.value > 1) {
    currentSlide.value--
  }
}

// 下一页
const nextSlide = () => {
  if (currentSlide.value < totalSlides.value) {
    currentSlide.value++
  }
}

// 组件卸载时清理
onBeforeUnmount(() => {
  if (pptxInstance) {
    pptxInstance = null
  }
})
</script>

<style scoped lang="scss">
.offline-ppt-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

.upload-section {
  padding: 16px;
  background: white;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  gap: 12px;

  input[type="file"] {
    display: none;
  }

  .upload-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: #409eff;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.3s;
    font-size: 14px;

    &:hover {
      background: #66b1ff;
    }

    &:active {
      background: #3a8ee6;
    }
  }
}

.loading-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 16px;
  color: #606266;
  font-size: 14px;

  .el-icon {
    font-size: 32px;
    color: #409eff;
  }
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  margin: 16px;
  background: #fef0f0;
  border: 1px solid #fbc4c4;
  border-radius: 4px;
  color: #f56c6c;
  font-size: 14px;

  .el-icon {
    font-size: 18px;
  }
}

.ppt-container {
  flex: 1;
  width: 100%;
  min-height: 400px;
  overflow: auto;
  background: white;
  padding: 20px;

  :deep(.pptx-slides) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  :deep(.pptx-slide) {
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    border-radius: 4px;
    overflow: hidden;
  }
}

.pagination-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 12px 16px;
  background: white;
  border-top: 1px solid #e4e7ed;

  .page-info {
    font-size: 14px;
    color: #606266;
    min-width: 80px;
    text-align: center;
  }
}
</style>
