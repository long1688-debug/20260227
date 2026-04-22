<template>
  <div class="server-panel">
    <div class="panel-header">
      <h3 class="panel-title">服务器管理</h3>
    </div>

    <div class="panel-content">
      <div class="server-status">
        <div class="status-item">
          <span class="status-label">服务器状态:</span>
          <el-tag :type="serverStatus.online ? 'success' : 'danger'">
            {{ serverStatus.online ? '在线' : '离线' }}
          </el-tag>
        </div>
        <div class="status-item">
          <span class="status-label">CPU 使用率:</span>
          <el-progress :percentage="serverStatus.cpu" :status="getProgressStatus(serverStatus.cpu)" />
        </div>
        <div class="status-item">
          <span class="status-label">内存使用:</span>
          <el-progress :percentage="serverStatus.memory" :status="getProgressStatus(serverStatus.memory)" />
        </div>
        <div class="status-item">
          <span class="status-label">存储空间:</span>
          <span class="status-value">{{ serverStatus.disk }} GB / 500 GB</span>
        </div>
      </div>

      <div class="server-actions">
        <el-button type="primary" @click="handleRestart">重启服务</el-button>
        <el-button type="warning" @click="handleClearCache">清理缓存</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'

const serverStatus = ref({
  online: true,
  cpu: 45,
  memory: 62,
  disk: 245
})

let statusTimer = null

const getProgressStatus = (value) => {
  if (value >= 80) return 'exception'
  if (value >= 60) return 'warning'
  return undefined
}

const handleRestart = () => {
  ElMessage.success('服务重启中...')
}

const handleClearCache = () => {
  ElMessage.success('缓存已清理')
}

const updateStatus = () => {
  serverStatus.value = {
    online: true,
    cpu: Math.floor(Math.random() * 30) + 30,
    memory: Math.floor(Math.random() * 20) + 50,
    disk: 245 + Math.floor(Math.random() * 10)
  }
}

onMounted(() => {
  statusTimer = setInterval(updateStatus, 5000)
})

onUnmounted(() => {
  if (statusTimer) {
    clearInterval(statusTimer)
  }
})
</script>

<style lang="scss" scoped>
.server-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  background: #0D1B2A;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.panel-header {
  margin-bottom: 10px;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #E0E1DD;
  margin: 0;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
}

.server-status {
  background: #0F2035;
  border: 1px solid #1A2A3A;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 10px;
}

.status-item {
  display: flex;
  align-items: center;
  margin-bottom: 10px;

  &:last-child {
    margin-bottom: 0;
  }
}

.status-label {
  font-size: 12px;
  color: #E0E1DD;
  width: 90px;
}

.status-value {
  font-size: 12px;
  color: #778DA9;
}

.server-actions {
  display: flex;
  gap: 8px;

  :deep(.el-button) {
    padding: 5px 10px;
    font-size: 11px;
  }
}
</style>
