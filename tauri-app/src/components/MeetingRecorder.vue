<template>
  <div class="meeting-recorder-panel">
    <!-- 面板头部 -->
    <div class="panel-header">
      <div class="panel-title">
        <el-icon><Microphone /></el-icon>
        <span>会议记录</span>
      </div>
      <el-tag :type="isRecording ? 'danger' : 'info'" size="small">
        {{ isRecording ? '录制中' : '未开始' }}
      </el-tag>
    </div>

    <!-- 控制面板 -->
    <div class="control-section">
      <div v-if="!isRecording" class="start-controls">
        <el-input
          v-model="meetingTitle"
          placeholder="输入会议标题（可选）"
          clearable
          @keyup.enter="startMeeting"
        />
        <el-button type="primary" @click="startMeeting" :disabled="!whisperReady">
          <el-icon><VideoPlay /></el-icon>
          <span>开始会议</span>
        </el-button>
      </div>

      <div v-else class="recording-controls">
        <div class="recording-info">
          <div class="info-item">
            <span class="label">时长:</span>
            <span class="value">{{ formatDuration(elapsedTime) }}</span>
          </div>
          <div class="info-item">
            <span class="label">片段:</span>
            <span class="value">{{ currentMeeting?.segments.length || 0 }}</span>
          </div>
        </div>

        <el-button type="danger" @click="endMeeting">
          <el-icon><VideoPause /></el-icon>
          <span>结束会议</span>
        </el-button>
      </div>
    </div>

    <!-- 当前会议内容 -->
    <div v-if="currentMeeting" class="current-meeting">
      <div class="section-title">当前会议</div>
      <div class="meeting-content">
        <div v-if="currentMeeting.segments.length === 0" class="empty-tip">
          等待语音输入...
        </div>
        <div v-else class="segment-list">
          <div
            v-for="(seg, index) in currentMeeting.segments"
            :key="seg.id"
            class="segment-item"
          >
            <div class="segment-header">
              <span class="segment-time">[{{ formatTime(seg.timestamp) }}]</span>
              <span class="segment-speaker">{{ seg.speaker }}</span>
            </div>
            <div class="segment-text">{{ seg.text }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 导出选项 -->
    <div v-if="currentMeeting && currentMeeting.segments.length > 0" class="export-section">
      <div class="section-title">导出会议记录</div>
      <div class="export-buttons">
        <el-button size="small" @click="exportText">
          <el-icon><Document /></el-icon>
          文本
        </el-button>
        <el-button size="small" @click="exportJSON">
          <el-icon><Files /></el-icon>
          JSON
        </el-button>
        <el-button size="small" @click="exportSRT">
          <el-icon><VideoCamera /></el-icon>
          SRT字幕
        </el-button>
      </div>
    </div>

    <!-- 历史记录 -->
    <div class="history-section">
      <div class="section-title">
        <span>历史记录</span>
        <el-button
          v-if="meetingHistory.length > 0"
          size="small"
          text
          type="danger"
          @click="confirmClearHistory"
        >
          清空
        </el-button>
      </div>

      <div v-if="meetingHistory.length === 0" class="empty-history">
        暂无历史记录
      </div>

      <div v-else class="history-list">
        <div
          v-for="meeting in meetingHistory.slice(0, 10)"
          :key="meeting.id"
          class="history-item"
        >
          <div class="history-header">
            <span class="history-title">{{ meeting.title }}</span>
            <el-button
              size="small"
              text
              type="danger"
              @click="deleteHistoryItem(meeting.id)"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
          <div class="history-meta">
            <span>{{ new Date(meeting.startTime).toLocaleDateString() }}</span>
            <span>{{ formatDuration(meeting.duration) }}</span>
            <span>{{ meeting.segments.length }} 片段</span>
          </div>
          <div class="history-actions">
            <el-button size="small" text @click="viewHistory(meeting)">
              查看
            </el-button>
            <el-button size="small" text @click="downloadHistory(meeting, 'text')">
              下载
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 统计信息 -->
    <div class="stats-section">
      <div class="section-title">统计信息</div>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">{{ stats.totalRecords }}</div>
          <div class="stat-label">总记录数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ formatDuration(stats.totalDuration) }}</div>
          <div class="stat-label">总时长</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ stats.totalSegments }}</div>
          <div class="stat-label">总片段数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ (stats.averageConfidence * 100).toFixed(1) }}%</div>
          <div class="stat-label">平均置信度</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Microphone,
  VideoPlay,
  VideoPause,
  Document,
  Files,
  VideoCamera,
  Delete
} from '@element-plus/icons-vue'
import {
  useMeetingRecorder,
  type MeetingRecord
} from '@/utils/meetingRecorder'
import { getWhisperStatus } from '@/utils/whisper'

// ==================== 状态管理 ====================

const {
  currentMeeting,
  meetingHistory,
  isRecording,
  startMeeting: startMeetingAction,
  endMeeting: endMeetingAction,
  addSegment,
  deleteMeeting,
  clearHistory,
  exportAsText,
  exportAsJSON,
  exportAsSRT,
  downloadFile,
  getStats
} = useMeetingRecorder()

const meetingTitle = ref('')
const whisperReady = ref(false)
const elapsedTime = ref(0)
let timer: NodeJS.Timeout | null = null

const stats = computed(() => getStats())

// ==================== 生命周期 ====================

onMounted(async () => {
  // 检查 Whisper 状态
  try {
    const status = await getWhisperStatus()
    whisperReady.value = status.initialized
  } catch (error) {
    console.error('[MeetingRecorder] 检查 Whisper 状态失败:', error)
  }
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})

// ==================== 核心功能 ====================

/**
 * 开始会议
 */
function startMeeting() {
  const title = meetingTitle.value.trim() || `会议 ${new Date().toLocaleString()}`

  startMeetingAction(title)

  // 启动计时器
  elapsedTime.value = 0
  timer = setInterval(() => {
    elapsedTime.value += 1000
  }, 1000)

  ElMessage.success(`会议 "${title}" 已开始`)
  meetingTitle.value = ''
}

/**
 * 结束会议
 */
function endMeeting() {
  const meeting = endMeetingAction()

  if (timer) {
    clearInterval(timer)
    timer = null
  }

  if (meeting) {
    ElMessage.success({
      message: `会议已结束，共 ${meeting.segments.length} 个片段`,
      duration: 3000
    })
  }
}

/**
 * 添加片段（供外部调用）
 */
function addMeetingSegment(text: string, confidence: number = 1.0) {
  if (!isRecording.value) {
    return
  }

  addSegment(text, confidence)
}

/**
 * 导出为文本
 */
function exportText() {
  if (!currentMeeting.value) return

  const content = exportAsText(currentMeeting.value)
  const filename = `${currentMeeting.value.title}.txt`
  downloadFile(content, filename, 'text/plain')

  ElMessage.success('已导出为文本文件')
}

/**
 * 导出为 JSON
 */
function exportJSON() {
  if (!currentMeeting.value) return

  const content = exportAsJSON(currentMeeting.value)
  const filename = `${currentMeeting.value.title}.json`
  downloadFile(content, filename, 'application/json')

  ElMessage.success('已导出为 JSON 文件')
}

/**
 * 导出为 SRT
 */
function exportSRT() {
  if (!currentMeeting.value) return

  const content = exportAsSRT(currentMeeting.value)
  const filename = `${currentMeeting.value.title}.srt`
  downloadFile(content, filename, 'text/plain')

  ElMessage.success('已导出为 SRT 字幕文件')
}

/**
 * 删除历史记录
 */
function deleteHistoryItem(meetingId: string) {
  ElMessageBox.confirm('确定要删除这条记录吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    if (deleteMeeting(meetingId)) {
      ElMessage.success('已删除')
    }
  }).catch(() => {})
}

/**
 * 清空历史
 */
function confirmClearHistory() {
  ElMessageBox.confirm('确定要清空所有历史记录吗？此操作不可恢复！', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'error'
  }).then(() => {
    clearHistory()
    ElMessage.success('已清空所有历史记录')
  }).catch(() => {})
}

/**
 * 查看历史记录详情
 */
function viewHistory(meeting: MeetingRecord) {
  const content = exportAsText(meeting)
  console.log('=== 会议记录详情 ===\n', content)
  ElMessage.info('会议记录已输出到控制台')
}

/**
 * 下载历史记录
 */
function downloadHistory(meeting: MeetingRecord, format: 'text' | 'json' | 'srt') {
  let content: string
  let filename: string
  let mimeType: string

  switch (format) {
    case 'text':
      content = exportAsText(meeting)
      filename = `${meeting.title}.txt`
      mimeType = 'text/plain'
      break
    case 'json':
      content = exportAsJSON(meeting)
      filename = `${meeting.title}.json`
      mimeType = 'application/json'
      break
    case 'srt':
      content = exportAsSRT(meeting)
      filename = `${meeting.title}.srt`
      mimeType = 'text/plain'
      break
  }

  downloadFile(content, filename, mimeType)
  ElMessage.success('下载成功')
}

// ==================== 工具函数 ====================

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
  } else {
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`
  }
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

// 暴露方法给父组件
defineExpose({
  addMeetingSegment
})
</script>

<style scoped lang="scss">
.meeting-recorder-panel {
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: white;
  overflow: hidden;
  max-height: 600px;
  overflow-y: auto;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f5f7fa;
  border-bottom: 1px solid #dcdfe6;

  .panel-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: #303133;
  }
}

.control-section {
  padding: 16px;
  border-bottom: 1px solid #ebeef5;
}

.start-controls {
  display: flex;
  gap: 12px;

  .el-input {
    flex: 1;
  }
}

.recording-controls {
  .recording-info {
    display: flex;
    gap: 24px;
    margin-bottom: 12px;

    .info-item {
      display: flex;
      gap: 8px;

      .label {
        color: #909399;
      }

      .value {
        font-weight: 600;
        color: #303133;
      }
    }
  }
}

.section-title {
  padding: 12px 16px;
  font-weight: 600;
  color: #606266;
  background: #fafafa;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.current-meeting {
  .meeting-content {
    padding: 16px;
    max-height: 300px;
    overflow-y: auto;
  }

  .empty-tip {
    text-align: center;
    color: #909399;
    padding: 40px 0;
  }
}

.segment-list {
  .segment-item {
    padding: 12px;
    background: #f5f7fa;
    border-radius: 6px;
    margin-bottom: 8px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .segment-header {
    display: flex;
    gap: 12px;
    margin-bottom: 6px;
    font-size: 12px;

    .segment-time {
      color: #409eff;
      font-family: monospace;
    }

    .segment-speaker {
      color: #67c23a;
      font-weight: 600;
    }
  }

  .segment-text {
    color: #303133;
    line-height: 1.6;
  }
}

.export-section {
  .export-buttons {
    padding: 12px 16px;
    display: flex;
    gap: 8px;
  }
}

.history-section {
  .empty-history {
    padding: 40px 16px;
    text-align: center;
    color: #909399;
  }

  .history-list {
    padding: 8px 16px;
  }

  .history-item {
    padding: 12px;
    background: #fafafa;
    border-radius: 6px;
    margin-bottom: 8px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;

    .history-title {
      font-weight: 600;
      color: #303133;
    }
  }

  .history-meta {
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: #909399;
    margin-bottom: 8px;
  }

  .history-actions {
    display: flex;
    gap: 8px;
  }
}

.stats-section {
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    padding: 16px;
  }

  .stat-item {
    text-align: center;
    padding: 12px;
    background: #f5f7fa;
    border-radius: 6px;

    .stat-value {
      font-size: 20px;
      font-weight: 600;
      color: #409eff;
      margin-bottom: 4px;
    }

    .stat-label {
      font-size: 12px;
      color: #909399;
    }
  }
}
</style>
