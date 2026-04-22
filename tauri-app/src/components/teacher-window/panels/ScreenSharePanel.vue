<template>
  <div class="screen-share-panel">
    <div class="panel-header">
      <h3 class="panel-title">屏幕共享</h3>
      <el-button type="primary" size="small" @click="handleAddScreenShare">
        <el-icon><Plus /></el-icon> 添加屏幕共享
      </el-button>
    </div>
    
    <div class="panel-content">
      <div v-if="screenShareSources.length === 0" class="empty-state">
        <el-empty description="暂无屏幕共享" :image-size="0">
          <template #image>
            <span></span>
          </template>
        </el-empty>
      </div>
      
      <div v-else class="source-list">
        <div 
          v-for="source in screenShareSources" 
          :key="source.id" 
          class="source-item"
        >
          <div class="source-info">
            <div class="source-name">{{ source.name }}</div>
            <div class="source-type">{{ source.subType }}</div>
          </div>
          <div class="source-actions">
            <el-button size="small" type="primary" @click="handleShare(source)">共享</el-button>
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

const sourceStore = useSourceStore()
const { addVideoSource, removeVideoSource } = useVideoSync()

// 过滤屏幕共享类型的信号源
const screenShareSources = computed(() => {
  return sourceStore.sources.filter(s => 
    s.type === 'screen' || s.type === 'remoteDesktop' || s.type === 'mobileScreen'
  )
})

const handleAddScreenShare = async () => {
  try {
    // 直接启动屏幕共享
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: 'always' },
      audio: true
    })

    const screenShareSource = {
      id: `screen_share_${Date.now()}`,
      name: '屏幕共享',
      type: 'screen',
      stream: stream,
      status: 'online',
      audioEnabled: true,
      volume: 100
    }

    // 添加到视频源
    sourceStore.addSource(screenShareSource)
    // 标记为已添加到预览
    sourceStore.updateSource(screenShareSource.id, { addedToPreview: true })
    // 同时添加到预览区域
    addVideoSource(screenShareSource)
    ElMessage.success('屏幕共享已启动')

    // 监听用户停止共享
    stream.getVideoTracks()[0].onended = () => {
      sourceStore.removeSource(screenShareSource.id)
      removeVideoSource(screenShareSource.id)
      ElMessage.info('屏幕共享已停止')
    }
  } catch (error) {
    console.error('启动屏幕共享失败:', error)
    if (error.name === 'NotAllowedError') {
      ElMessage.warning('用户拒绝了屏幕共享权限')
    } else {
      ElMessage.error('启动屏幕共享失败: ' + error.message)
    }
  }
}

const handleShare = (source) => {
  ElMessage.success(`开始共享: ${source.name}`)
}

const handleRemove = (source) => {
  sourceStore.removeSource(source.id)
  removeVideoSource(source.id)
  ElMessage.success(`已移除: ${source.name}`)
}
</script>

<style lang="scss" scoped>
.screen-share-panel {
  display: flex;
  flex-direction: column;
  color: #E0E1DD;
  background: #0D1B2A;
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow-y: auto;
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
