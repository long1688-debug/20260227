<template>
  <div class="status-panel">
    <div class="panel-header">
      <h3 class="panel-title">状态监控</h3>
      <el-button size="small" @click="handleRefresh">刷新</el-button>
    </div>

    <div class="panel-content">
      <div class="status-section">
        <h4 class="section-title">系统状态</h4>
        <div class="status-grid">
          <div class="status-card">
            <span class="status-label">摄像头</span>
            <el-tag :type="systemStatus.cameras.online > 0 ? 'success' : 'danger'">
              {{ systemStatus.cameras.online }}/{{ systemStatus.cameras.total }}
            </el-tag>
          </div>
          <div class="status-card">
            <span class="status-label">麦克风</span>
            <el-tag :type="systemStatus.microphones.online > 0 ? 'success' : 'danger'">
              {{ systemStatus.microphones.online }}/{{ systemStatus.microphones.total }}
            </el-tag>
          </div>
          <div class="status-card">
            <span class="status-label">录制中</span>
            <el-tag :type="systemStatus.recording > 0 ? 'warning' : 'info'">
              {{ systemStatus.recording }}
            </el-tag>
          </div>
          <div class="status-card">
            <span class="status-label">推流中</span>
            <el-tag :type="systemStatus.streaming > 0 ? 'success' : 'info'">
              {{ systemStatus.streaming }}
            </el-tag>
          </div>
        </div>
      </div>

      <div class="status-section">
        <h4 class="section-title">网络状态</h4>
        <div class="network-info">
          <div class="info-item">
            <span class="info-label">上传速度:</span>
            <span class="info-value">{{ networkStatus.upload }} Mbps</span>
          </div>
          <div class="info-item">
            <span class="info-label">下载速度:</span>
            <span class="info-value">{{ networkStatus.download }} Mbps</span>
          </div>
          <div class="info-item">
            <span class="info-label">延迟:</span>
            <span class="info-value">{{ networkStatus.latency }} ms</span>
          </div>
        </div>
      </div>

      <div class="status-section">
        <h4 class="section-title">最近事件</h4>
        <div class="events-list">
          <div v-for="event in recentEvents" :key="event.id" class="event-item">
            <span class="event-time">{{ event.time }}</span>
            <span class="event-message">{{ event.message }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'

const systemStatus = ref({
  cameras: { online: 3, total: 4 },
  microphones: { online: 2, total: 2 },
  recording: 0,
  streaming: 1
})

const networkStatus = ref({
  upload: 12.5,
  download: 45.8,
  latency: 23
})

const recentEvents = ref([
  { id: 1, time: '23:20:15', message: '摄像头-3 已连接' },
  { id: 2, time: '23:19:32', message: '学生 张三 加入课堂' },
  { id: 3, time: '23:18:45', message: '开始推流到 rtmp://...' }
])

const handleRefresh = () => {
  ElMessage.success('状态已刷新')
}

let statusTimer = null

onMounted(() => {
  statusTimer = setInterval(() => {
    networkStatus.value = {
      upload: (Math.random() * 5 + 10).toFixed(1),
      download: (Math.random() * 10 + 40).toFixed(1),
      latency: Math.floor(Math.random() * 10 + 20)
    }
  }, 3000)
})

onUnmounted(() => clearInterval(statusTimer))
</script>

<style lang="scss" scoped>
.status-panel {
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;

  :deep(.el-button) {
    padding: 5px 10px;
    font-size: 11px;
  }
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

.status-section {
  margin-bottom: 15px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-title {
  font-size: 13px;
  font-weight: 500;
  color: #E0E1DD;
  margin: 0 0 8px 0;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.status-card {
  background: #0F2035;
  border: 1px solid #1A2A3A;
  border-radius: 6px;
  padding: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-label {
  font-size: 13px;
  color: #778DA9;
}

.network-info {
  background: #0F2035;
  border: 1px solid #1A2A3A;
  border-radius: 6px;
  padding: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;

  &:last-child {
    margin-bottom: 0;
  }
}

.info-label {
  font-size: 13px;
  color: #778DA9;
}

.info-value {
  font-size: 13px;
  color: #E0E1DD;
}

.events-list {
  background: #0F2035;
  border: 1px solid #1A2A3A;
  border-radius: 6px;
  padding: 10px;
  max-height: 150px;
  overflow-y: auto;
}

.event-item {
  display: flex;
  gap: 10px;
  font-size: 12px;
  margin-bottom: 8px;

  &:last-child {
    margin-bottom: 0;
  }
}

.event-time {
  color: #778DA9;
  flex-shrink: 0;
}

.event-message {
  color: #E0E1DD;
}
</style>
