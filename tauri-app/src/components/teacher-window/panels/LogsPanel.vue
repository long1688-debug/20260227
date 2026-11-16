<template>
  <div class="logs-panel">
    <div class="panel-header">
      <h3 class="panel-title">日志查看</h3>
      <div class="panel-actions">
        <el-select v-model="logLevel" size="small" placeholder="日志级别" style="width: 100px">
          <el-option label="全部" value="all" />
          <el-option label="信息" value="info" />
          <el-option label="警告" value="warning" />
          <el-option label="错误" value="error" />
        </el-select>
        <el-button size="small" @click="handleClear">清空</el-button>
        <el-button size="small" @click="handleExport">导出</el-button>
      </div>
    </div>

    <div class="panel-content">
      <div class="logs-container">
        <div
          v-for="(log, index) in filteredLogs"
          :key="index"
          class="log-entry"
          :class="`log-${log.level}`"
        >
          <span class="log-time">{{ log.time }}</span>
          <span class="log-level">{{ log.level }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'

const logLevel = ref('all')
const logs = ref([
  { time: '23:24:15', level: 'info', message: '系统初始化完成' },
  { time: '23:24:12', level: 'info', message: '连接到服务器成功' },
  { time: '23:24:10', level: 'warning', message: '摄像头-1 帧率较低' },
  { time: '23:24:08', level: 'error', message: '音频设备初始化失败' },
  { time: '23:24:05', level: 'info', message: '加载配置文件成功' }
])

const filteredLogs = computed(() => {
  if (logLevel.value === 'all') return logs.value
  return logs.value.filter(log => log.level === logLevel.value)
})

const handleClear = () => {
  logs.value = []
  ElMessage.success('日志已清空')
}

const handleExport = () => {
  ElMessage.success('日志已导出')
}

let logsTimer = null

onMounted(() => {
  logsTimer = setInterval(() => {
    const now = new Date()
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
    const levels = ['info', 'warning', 'error']
    const messages = [
      '系统运行正常',
      '检测到网络延迟',
      '视频流同步成功',
      '音频设备状态检查'
    ]

    logs.value.unshift({
      time,
      level: levels[Math.floor(Math.random() * 3)],
      message: messages[Math.floor(Math.random() * messages.length)]
    })

    if (logs.value.length > 50) {
      logs.value.pop()
    }
  }, 5000)
})

onUnmounted(() => clearInterval(logsTimer))
</script>

<style lang="scss" scoped>
.logs-panel {
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

.panel-actions {
  display: flex;
  gap: 6px;
}

.panel-content {
  flex: 1;
  overflow: hidden;
}

.logs-container {
  background: #0D1117;
  border: 1px solid #1A2A3A;
  border-radius: 5px;
  padding: 8px;
  height: 100%;
  overflow-y: auto;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 11px;
}

.log-entry {
  display: flex;
  gap: 6px;
  margin-bottom: 3px;
  padding: 2px 0;
  border-bottom: 1px solid #1A2A3A;

  &:last-child {
    border-bottom: none;
  }
}

.log-time {
  color: #778DA9;
  flex-shrink: 0;
}

.log-level {
  color: #778DA9;
  width: 45px;
  flex-shrink: 0;
}

.log-message {
  color: #E0E1DD;
  flex: 1;
  word-break: break-all;
}

.log-info .log-level { color: #4CAF50; }
.log-warning .log-level { color: #FFC107; }
.log-error .log-level { color: #F44336; }
</style>
