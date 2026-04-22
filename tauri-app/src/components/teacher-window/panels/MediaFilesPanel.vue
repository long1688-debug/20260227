<template>
  <div class="media-files-panel">
    <div class="panel-header">
      <h3 class="panel-title">媒体文件</h3>
      <el-button type="primary" size="small" @click="handleAddMediaFile">
        <el-icon><Plus /></el-icon> 添加媒体文件
      </el-button>
    </div>
    
    <div class="panel-content">
      <div v-if="mediaSources.length === 0" class="empty-state">
        <el-empty description="暂无媒体文件" :image-size="0">
          <template #image>
            <span></span>
          </template>
        </el-empty>
      </div>
      
      <div v-else class="source-list">
        <div 
          v-for="source in mediaSources" 
          :key="source.id" 
          class="source-item"
        >
          <div class="source-info">
            <div class="source-name">{{ source.name }}</div>
            <div class="source-type">{{ source.subType }}</div>
          </div>
          <div class="source-actions">
            <el-button size="small" type="primary" @click="handlePlay(source)">播放</el-button>
            <el-button size="small" type="danger" @click="handleRemove(source)">移除</el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useSourceStore } from '@/stores/sourceStore'
import { useVideoSync } from '@/composables/useVideoSync'
import { createBlobUrl } from '@/utils/videoSource'

const sourceStore = useSourceStore()
const { addVideoSource, removeVideoSource } = useVideoSync()

// 过滤媒体文件类型的信号源
const mediaSources = computed(() => {
  return sourceStore.sources.filter(s => 
    s.type === 'video' || s.type === 'localVideo' || s.type === 'networkStream'
  )
})

const handleAddMediaFile = async () => {
  try {
    // 创建文件输入元素
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'video/*'

    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return

      try {
        // 🎯 使用 VideoSourceManager 创建共享 Blob URL
        const { blobUrl: sharedBlobUrl } = createBlobUrl(file)

        const mediaSource = {
          id: `media_${Date.now()}`,
          name: file.name,
          type: 'localVideo',
          url: sharedBlobUrl, // 使用共享的 Blob URL
          sharedBlobUrl, // 显式存储共享 URL
          blobUrl: sharedBlobUrl, // 兼容旧字段
          file: file,  // 添加file属性
          status: 'ready',
          audioEnabled: false, // 🎯 默认静音，避免多个视频同时发声
          volume: 100
        }

        sourceStore.addSource(mediaSource)
        // 标记为已添加到预览
        sourceStore.updateSource(mediaSource.id, { addedToPreview: true })
        // 同时添加到预览区域
        addVideoSource(mediaSource)
        ElMessage.success(`已添加媒体文件: ${file.name}`)
      } catch (error) {
        console.error('添加媒体文件失败:', error)
        ElMessage.error('添加媒体文件失败: ' + error.message)
      }
    }

    input.click()
  } catch (error) {
    console.error('打开文件选择器失败:', error)
    ElMessage.error('打开文件选择器失败: ' + error.message)
  }
}

const handlePlay = (source) => {
  ElMessage.success(`开始播放: ${source.name}`)
}

const handleRemove = (source) => {
  sourceStore.removeSource(source.id)
  removeVideoSource(source.id)
  ElMessage.success(`已移除: ${source.name}`)
}
</script>

<style lang="scss" scoped>
.media-files-panel {
  display: flex;
  flex-direction: column;
  color: #FFFFFF;
  background: #0D1B2A;
  flex: 1;
  min-height: 0;
  height: 100%;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #2A3F5F;
  
  .panel-title {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
    color: #FFFFFF;
  }
}

.panel-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}

.source-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.source-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #0F2035;
  border: 1px solid #2A3F5F;
  border-radius: 4px;
  
  .source-info {
    flex: 1;
    
    .source-name {
      font-size: 14px;
      font-weight: 500;
      color: #FFFFFF;
      margin-bottom: 4px;
    }
    
    .source-type {
      font-size: 13px;
      color: #888888;
    }
  }
  
  .source-actions {
    display: flex;
    gap: 8px;
  }
}
</style>
