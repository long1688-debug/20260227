<template>
  <div class="mobile-connections-panel">
    <div class="panel-header">
      <h3>📱 移动端连接</h3>
      <el-button
        size="small"
        @click="refreshConnections"
        :loading="loading"
      >
        🔄 刷新
      </el-button>
    </div>

    <div class="connections-list">
      <el-empty
        v-if="connections.length === 0"
        description="暂无移动设备连接"
        :image-size="80"
      >
        <template #description>
          <p style="color: #909399; font-size: 13px;">
            使用手机扫描二维码即可连接
          </p>
        </template>
      </el-empty>

      <div
        v-for="conn in connections"
        :key="conn.connection_id"
        class="connection-item"
        :class="{ 'connected': conn.status === 'connected' }"
      >
        <div class="connection-info">
          <div class="device-icon">
            <span v-if="conn.device_type === 'android'">🤖</span>
            <span v-else-if="conn.device_type === 'ios'">🍎</span>
            <span v-else>📱</span>
          </div>

          <div class="connection-details">
            <div class="connection-id">{{ truncateId(conn.connection_id) }}</div>
            <div class="connection-meta">
              <span class="status-badge" :class="conn.status">
                {{ getStatusText(conn.status) }}
              </span>
              <span class="time-text">
                {{ formatTime(conn.connected_at) }}
              </span>
            </div>
          </div>
        </div>

        <div class="connection-actions">
          <el-button
            size="small"
            type="danger"
            link
            @click="handleDisconnect(conn.connection_id)"
          >
            断开
          </el-button>
        </div>
      </div>
    </div>

    <div class="panel-footer">
      <el-alert
        title="提示"
        type="info"
        :closable="false"
        show-icon
      >
        <p style="margin: 0; font-size: 12px;">
          手机浏览器访问：<code>{{ serverUrl }}/mobile-app.html</code>
        </p>
      </el-alert>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getMobileConnections,
  disconnectMobile,
  getServerUrl,
  type MobileConnectionInfo
} from '@/services/mobileConnectionService'

const connections = ref<MobileConnectionInfo[]>([])
const loading = ref(false)
const serverUrl = ref('http://localhost:801')
let refreshTimer: number | null = null

// 加载连接列表
async function loadConnections() {
  try {
    connections.value = await getMobileConnections()
  } catch (error) {
    console.error('[移动端连接] 加载失败:', error)
  }
}

// 刷新连接
async function refreshConnections() {
  loading.value = true
  try {
    await loadConnections()
    ElMessage.success('已刷新')
  } catch (error) {
    ElMessage.error('刷新失败')
  } finally {
    loading.value = false
  }
}

// 断开连接
async function handleDisconnect(connectionId: string) {
  try {
    await ElMessageBox.confirm(
      '确定要断开此设备的连接吗？',
      '确认断开',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await disconnectMobile(connectionId)
    ElMessage.success('已断开连接')
    await loadConnections()
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('[移动端连接] 断开失败:', error)
      ElMessage.error('断开失败')
    }
  }
}

// 截断ID显示
function truncateId(id: string): string {
  if (id.length > 12) {
    return id.substring(0, 8) + '...'
  }
  return id
}

// 获取状态文本
function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    waiting: '等待连接',
    connected: '已连接',
    disconnected: '已断开'
  }
  return statusMap[status] || status
}

// 格式化时间
function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diff < 60) {
    return `${diff}秒前`
  } else if (diff < 3600) {
    return `${Math.floor(diff / 60)}分钟前`
  } else {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }
}

// 初始化
onMounted(async () => {
  // 获取服务器URL
  serverUrl.value = await getServerUrl()

  // 加载连接列表
  await loadConnections()

  // 定时刷新（每10秒）
  refreshTimer = window.setInterval(() => {
    loadConnections()
  }, 10000)
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
})
</script>

<style scoped>
.mobile-connections-panel {
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e4e7ed;
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  color: #303133;
}

.connections-list {
  min-height: 200px;
  max-height: 400px;
  overflow-y: auto;
}

.connection-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  margin-bottom: 8px;
  background: #f5f7fa;
  border-radius: 6px;
  border-left: 3px solid transparent;
  transition: all 0.3s ease;
}

.connection-item:hover {
  background: #ecf5ff;
  transform: translateX(2px);
}

.connection-item.connected {
  border-left-color: #67C23A;
  background: #f0f9ff;
}

.connection-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.device-icon {
  font-size: 24px;
}

.connection-details {
  flex: 1;
}

.connection-id {
  font-size: 13px;
  color: #606266;
  font-weight: 500;
  margin-bottom: 4px;
}

.connection-meta {
  display: flex;
  gap: 8px;
  align-items: center;
}

.status-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: #e4e7ed;
  color: #909399;
}

.status-badge.connected {
  background: #e1f3d8;
  color: #67C23A;
}

.status-badge.waiting {
  background: #fdf6ec;
  color: #E6A23C;
}

.status-badge.disconnected {
  background: #fef0f0;
  color: #F56C6C;
}

.time-text {
  font-size: 11px;
  color: #909399;
}

.connection-actions {
  display: flex;
  gap: 8px;
}

.panel-footer {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #e4e7ed;
}

.panel-footer :deep(.el-alert) {
  padding: 8px 12px;
}

.panel-footer code {
  background: #f5f7fa;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  color: #409EFF;
}
</style>
