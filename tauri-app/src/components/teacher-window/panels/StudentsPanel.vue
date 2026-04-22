<template>
  <div class="students-panel">
    <div class="panel-header">
      <h3 class="panel-title">学生管理</h3>
      <div class="panel-actions">
        <el-button type="primary" size="small" @click="handleAddStudent">添加学生</el-button>
        <el-button size="small" @click="handleRefresh">刷新</el-button>
      </div>
    </div>

    <div class="panel-content">
      <el-table :data="students" stripe>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="joinTime" label="加入时间" width="150" />
        <el-table-column prop="networkQuality" label="网络" width="70">
          <template #default="{ row }">
            <NetworkQualityIndicator :quality="row.networkQuality" />
          </template>
        </el-table-column>
        <el-table-column label="远程桌面" width="100">
          <template #default="{ row }">
            <div class="remote-status">
              <span v-if="row.remoteDesktopEnabled" class="remote-enabled">🟢</span>
              <span v-else class="remote-disabled">⚪</span>
              <span class="remote-text">{{ row.remoteDesktopEnabled ? '已开启' : '未开启' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="摄像头" width="80">
          <template #default="{ row }">
            <div class="camera-status">
              <span v-if="row.cameraEnabled" class="camera-enabled">🟢</span>
              <span v-else class="camera-disabled">⚪</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="220">
          <template #default="{ row }">
            <button
              class="table-action-btn table-action-btn-primary"
              :disabled="!row.remoteDesktopEnabled || !row.online"
              @click="handleRemoteDesktop(row)"
              title="远程桌面"
            >
              <span class="btn-icon">🖥️</span>
              桌面
            </button>
            <button
              class="table-action-btn table-action-btn-success"
              :disabled="!row.cameraEnabled || !row.online"
              @click="handleCamera(row)"
              title="查看摄像头"
            >
              <span class="btn-icon">📷</span>
              摄像头
            </button>
            <button class="table-action-btn table-action-btn-default" @click="handleViewDetails(row)">详情</button>
            <button class="table-action-btn table-action-btn-danger" @click="handleKick(row)">踢出</button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="panel-footer">
      <span class="student-count">在线学生: {{ onlineCount }} / {{ totalCount }}</span>
      <span class="remote-count">开启远程桌面: {{ remoteDesktopCount }}</span>
    </div>
  </div>

  <!-- 远程桌面弹窗 -->
  <el-dialog
    v-if="showRemoteDialog"
    title="远程桌面 - {{ selectedStudent?.name }}"
    width="900px"
    :close-on-click-modal="false"
    @close="closeRemoteDialog"
  >
    <div class="remote-desktop-container">
      <div v-if="remoteConnecting" class="connecting-state">
        <el-icon class="is-loading" :size="48"><Loading /></el-icon>
        <p>正在连接远程桌面...</p>
      </div>
      <div v-else-if="remoteConnected" class="connected-state">
        <video
          ref="remoteVideoRef"
          class="remote-video"
          autoplay
          playsinline
        ></video>
        <div class="remote-controls">
          <el-button size="small" @click="toggleRemoteFullscreen">
            <el-icon><FullScreen /></el-icon>
            全屏
          </el-button>
          <el-button size="small" type="danger" @click="disconnectRemote">
            <el-icon><SwitchButton /></el-icon>
            断开
          </el-button>
        </div>
      </div>
      <div v-else class="disconnected-state">
        <el-icon :size="48"><Monitor /></el-icon>
        <p>远程桌面连接已断开</p>
        <el-button size="small" type="primary" @click="connectRemote">
          <el-icon><Refresh /></el-icon>
          重新连接
        </el-button>
      </div>
    </div>
  </el-dialog>

  <!-- 摄像头弹窗 -->
  <el-dialog
    v-if="showCameraDialog"
    title="学生摄像头 - {{ selectedStudent?.name }}"
    width="600px"
    :close-on-click-modal="false"
    @close="closeCameraDialog"
  >
    <div class="camera-container">
      <div v-if="cameraConnecting" class="connecting-state">
        <el-icon class="is-loading" :size="48"><Loading /></el-icon>
        <p>正在连接摄像头...</p>
      </div>
      <div v-else-if="cameraConnected" class="connected-state">
        <video
          ref="cameraVideoRef"
          class="camera-video"
          autoplay
          playsinline
        ></video>
        <div class="camera-controls">
          <el-button size="small" type="danger" @click="disconnectCamera">
            <el-icon><SwitchButton /></el-icon>
            断开
          </el-button>
        </div>
      </div>
      <div v-else class="disconnected-state">
        <el-icon :size="48"><VideoCamera /></el-icon>
        <p>摄像头连接已断开</p>
        <el-button size="small" type="primary" @click="connectCamera">
          <el-icon><Refresh /></el-icon>
          重新连接
        </el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Loading, FullScreen, SwitchButton, Monitor, VideoCamera } from '@element-plus/icons-vue'
import { useStudentStore } from '@/stores/studentStore'
import NetworkQualityIndicator from '../common/NetworkQualityIndicator.vue'

const studentStore = useStudentStore()

// 状态管理
const students = computed(() => studentStore.students)
const onlineCount = computed(() => studentStore.onlineCount)
const totalCount = computed(() => studentStore.totalCount)
const remoteDesktopCount = computed(() => studentStore.studentsWithRemoteDesktop.length)

// 弹窗状态
const showRemoteDialog = ref(false)
const showCameraDialog = ref(false)
const selectedStudent = ref(null)
const remoteConnecting = ref(false)
const remoteConnected = ref(false)
const cameraConnecting = ref(false)
const cameraConnected = ref(false)

// Video refs
const remoteVideoRef = ref(null)
const cameraVideoRef = ref(null)

// 远程桌面流
let remoteStream = null
let cameraStream = null

const getStatusType = (status) => {
  const map = { online: 'success', offline: 'info', busy: 'warning' }
  return map[status] || 'info'
}

const getStatusLabel = (status) => {
  const map = { online: '在线', offline: '离线', busy: '忙碌' }
  return map[status] || '未知'
}

const handleAddStudent = () => {
  ElMessageBox.prompt('请输入学生姓名', '添加学生', {
    confirmButtonText: '确定',
    cancelButtonText: '取消'
  }).then(({ value }) => {
    studentStore.addStudent({ name: value })
    ElMessage.success('添加成功')
  }).catch(() => {})
}

const handleRefresh = () => {
  studentStore.fetchStudents()
  ElMessage.success('刷新成功')
}

const handleViewDetails = (student) => {
  const details = `
    <div style="padding: 10px;">
      <p><strong>ID:</strong> ${student.id}</p>
      <p><strong>姓名:</strong> ${student.name}</p>
      <p><strong>状态:</strong> ${getStatusLabel(student.status)}</p>
      <p><strong>加入时间:</strong> ${student.joinTime || '未加入'}</p>
      <p><strong>网络质量:</strong> ${student.networkQuality}</p>
      <p><strong>远程桌面:</strong> ${student.remoteDesktopEnabled ? '已开启' : '未开启'}</p>
      <p><strong>摄像头:</strong> ${student.cameraEnabled ? '已开启' : '未开启'}</p>
      <p><strong>音频:</strong> ${student.audioEnabled ? '已开启' : '未开启'}</p>
    </div>
  `
  ElMessageBox.alert(details, '学生详情', {
    dangerouslyUseHTMLString: true
  })
}

const handleKick = (student) => {
  ElMessageBox.confirm(`确定要踢出学生 "${student.name}" 吗？`, '确认', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    studentStore.kickStudent(student.id)
    ElMessage.success('已踢出')
  }).catch(() => {})
}

// 远程桌面相关方法
const handleRemoteDesktop = (student) => {
  selectedStudent.value = student
  showRemoteDialog.value = true
  connectRemote()
}

const connectRemote = async () => {
  if (!selectedStudent.value) return

  remoteConnecting.value = true
  remoteConnected.value = false

  try {
    // 模拟连接延迟
    await new Promise(resolve => setTimeout(resolve, 1500))

    // 创建模拟视频流
    if (remoteVideoRef.value) {
      const canvas = document.createElement('canvas')
      canvas.width = 1920
      canvas.height = 1080
      const ctx = canvas.getContext('2d')

      // 绘制模拟桌面
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = '#fff'
      ctx.font = '36px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(`远程桌面 - ${selectedStudent.value.name}`, canvas.width / 2, canvas.height / 2 - 30)
      ctx.font = '24px Arial'
      ctx.fillStyle = '#aaa'
      ctx.fillText(`ID: ${selectedStudent.value.id}`, canvas.width / 2, canvas.height / 2 + 20)
      ctx.fillText('正在显示学生桌面...', canvas.width / 2, canvas.height / 2 + 60)

      remoteStream = canvas.captureStream(30)
      remoteVideoRef.value.srcObject = remoteStream
    }

    remoteConnected.value = true
    ElMessage.success('远程桌面连接成功')
  } catch (error) {
    console.error('远程桌面连接失败:', error)
    ElMessage.error('远程桌面连接失败')
  } finally {
    remoteConnecting.value = false
  }
}

const disconnectRemote = () => {
  if (remoteStream) {
    remoteStream.getTracks().forEach(track => track.stop())
    remoteStream = null
  }
  remoteConnected.value = false
  ElMessage.info('已断开远程桌面连接')
}

const closeRemoteDialog = () => {
  disconnectRemote()
  showRemoteDialog.value = false
  selectedStudent.value = null
}

const toggleRemoteFullscreen = () => {
  if (!remoteVideoRef.value) return

  if (!document.fullscreenElement) {
    remoteVideoRef.value.requestFullscreen().catch(err => {
      console.error('全屏失败:', err)
      ElMessage.error('全屏失败')
    })
  } else {
    document.exitFullscreen()
  }
}

// 摄像头相关方法
const handleCamera = (student) => {
  selectedStudent.value = student
  showCameraDialog.value = true
  connectCamera()
}

const connectCamera = async () => {
  if (!selectedStudent.value) return

  cameraConnecting.value = true
  cameraConnected.value = false

  try {
    // 模拟连接延迟
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 创建模拟摄像头流
    if (cameraVideoRef.value) {
      const canvas = document.createElement('canvas')
      canvas.width = 640
      canvas.height = 480
      const ctx = canvas.getContext('2d')

      // 绘制模拟摄像头画面
      ctx.fillStyle = '#2d2d2d'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // 绘制模拟视频效果
      ctx.fillStyle = '#4ade80'
      ctx.beginPath()
      ctx.arc(canvas.width / 2, canvas.height / 2, 150, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#fff'
      ctx.font = '24px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(`${selectedStudent.value.name} 的摄像头`, canvas.width / 2, canvas.height / 2 + 180)

      cameraStream = canvas.captureStream(30)
      cameraVideoRef.value.srcObject = cameraStream
    }

    cameraConnected.value = true
    ElMessage.success('摄像头连接成功')
  } catch (error) {
    console.error('摄像头连接失败:', error)
    ElMessage.error('摄像头连接失败')
  } finally {
    cameraConnecting.value = false
  }
}

const disconnectCamera = () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop())
    cameraStream = null
  }
  cameraConnected.value = false
  ElMessage.info('已断开摄像头连接')
}

const closeCameraDialog = () => {
  disconnectCamera()
  showCameraDialog.value = false
  selectedStudent.value = null
}

onMounted(() => {
  console.log('[StudentsPanel] 学生列表已就绪，共', studentStore.students.length, '人')
})

onUnmounted(() => {
  disconnectRemote()
  disconnectCamera()
})
</script>

<style lang="scss" scoped>
.students-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  overflow: hidden;
  background: #0D1B2A;
  flex: 1;
  min-height: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #1A2A3A;

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
  overflow: auto;
  min-height: 0;

  :deep(.el-table) {
    --el-table-bg-color: #0D1B2A !important;
    --el-table-header-bg-color: #141f2e !important;
    --el-table-header-text-color: #E0E1DD !important;
    --el-table-row-hover-bg-color: rgba(255, 255, 255, 0.05) !important;
    --el-table-row-bg-color: #0D1B2A !important;
    --el-table-row-bg-color-hover: rgba(255, 255, 255, 0.05) !important;
    --el-table-row-bg-color-striped: #141f2e !important;
    --el-table-border-color: #1A2A3A !important;
    --el-table-text-color: #E0E1DD !important;
    max-height: 100%;
    background: #0D1B2A !important;

    &::before {
      background: transparent !important;
      height: 0 !important;
    }

    // 表头整体
    .el-table__header {
      background: #141f2e !important;
    }

    // 表头包装器
    .el-table__header-wrapper {
      background: #141f2e !important;

      .el-table__header-row {
        background: #141f2e !important;

        .el-table__cell {
          color: #E0E1DD !important;
          border-bottom: 1px solid #2d3a4f !important;
          background: #141f2e !important;
        }
      }

      // 表头 th 元素
      thead {
        background: #141f2e !important;

        tr {
          background: #141f2e !important;

          th {
            background: #141f2e !important;
            color: #E0E1DD !important;
            border-bottom-color: #2d3a4f !important;
          }
        }
      }
    }

    // 表头单元格直接覆盖
    .el-table__header-cell {
      background: #141f2e !important;
      color: #E0E1DD !important;
    }

    // 表体包装器
    .el-table__body-wrapper {
      overflow-y: auto;
      background: #0D1B2A !important;

      .el-table__row {
        background: #0D1B2A !important;

        &.el-table__row--striped {
          background: #141f2e !important;
        }

        .el-table__cell {
          color: #E0E1DD !important;
          border-bottom: 1px solid #1A2A3A !important;
          background: inherit !important;
        }

        &:hover {
          background: rgba(255, 255, 255, 0.05) !important;

          .el-table__cell {
            background: rgba(255, 255, 255, 0.05) !important;
          }
        }
      }
    }

    .el-tag {
      background: rgba(255, 255, 255, 0.1) !important;
      color: #E0E1DD !important;
      border: none !important;
    }
  }
}

.panel-footer {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #1A2A3A;
  display: flex;
  gap: 16px;
}

.student-count {
  font-size: 12px;
  color: #778DA9;
}

.remote-count {
  font-size: 12px;
  color: #4ade80;
}

// 远程桌面状态
.remote-status {
  display: flex;
  align-items: center;
  gap: 6px;

  .remote-enabled {
    color: #4ade80;
    font-size: 12px;
  }

  .remote-disabled {
    color: #6b7280;
    font-size: 12px;
  }

  .remote-text {
    font-size: 12px;
    color: #9ca3af;
  }
}

// 摄像头状态
.camera-status {
  .camera-enabled {
    color: #4ade80;
    font-size: 14px;
  }

  .camera-disabled {
    color: #6b7280;
    font-size: 14px;
  }
}

// 按钮图标
.btn-icon {
  margin-right: 4px;
}

// 统一表格操作按钮样式
.table-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-right: 4px;
  font-family: inherit;
  white-space: nowrap;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }
}

.table-action-btn-primary {
  background: linear-gradient(135deg, #4a90d9 0%, #357abd 100%);
  color: #fff;

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #5a9fe9 0%, #458acd 100%);
  }
}

.table-action-btn-success {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: #fff;

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #34d399 0%, #22c55e 100%);
  }
}

.table-action-btn-default {
  background: rgba(255, 255, 255, 0.1);
  color: #e8e8e8;
  border: 1px solid rgba(255, 255, 255, 0.2);

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.18);
    border-color: rgba(255, 255, 255, 0.3);
  }
}

.table-action-btn-danger {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: #fff;

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
  }
}

// 远程桌面弹窗
.remote-desktop-container {
  width: 100%;
  height: 500px;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  position: relative;

  .connecting-state,
  .disconnected-state {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #9ca3af;
    gap: 12px;
  }

  .connected-state {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .remote-video {
    flex: 1;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .remote-controls {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
    background: rgba(0, 0, 0, 0.7);
    padding: 8px;
    border-radius: 8px;
    backdrop-filter: blur(4px);

    :deep(.el-button) {
      padding: 6px 12px;
      font-size: 12px;
    }
  }
}

// 摄像头弹窗
.camera-container {
  width: 100%;
  height: 400px;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  position: relative;

  .connecting-state,
  .disconnected-state {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #9ca3af;
    gap: 12px;
  }

  .connected-state {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .camera-video {
    flex: 1;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .camera-controls {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
    background: rgba(0, 0, 0, 0.7);
    padding: 8px;
    border-radius: 8px;
    backdrop-filter: blur(4px);

    :deep(.el-button) {
      padding: 6px 12px;
      font-size: 12px;
    }
  }
}
</style>
