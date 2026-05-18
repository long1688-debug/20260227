/**
 * 会议记录管理器
 *
 * 功能：
 * - 自动保存语音识别结果
 * - 时间戳标记
 * - 导出为文本/JSON/SRT
 * - 历史记录管理
 */

import { ref, reactive } from 'vue'

// ==================== 类型定义 ====================

export interface MeetingRecord {
  id: string
  title: string
  startTime: number
  endTime: number
  segments: MeetingSegment[]
  duration: number
}

export interface MeetingSegment {
  id: string
  text: string
  speaker?: string
  timestamp: number
  duration: number
  confidence: number
}

export interface MeetingStats {
  totalRecords: number
  totalDuration: number
  totalSegments: number
  averageConfidence: number
}

// ==================== 状态管理 ====================

const currentMeeting = ref<MeetingRecord | null>(null)
const meetingHistory = ref<MeetingRecord[]>([])
const isRecording = ref(false)

// 从 localStorage 加载历史记录
function loadFromStorage() {
  try {
    const saved = localStorage.getItem('meeting-records')
    if (saved) {
      meetingHistory.value = JSON.parse(saved)
      console.log(`[MeetingRecorder] 加载了 ${meetingHistory.value.length} 条历史记录`)
    }
  } catch (error) {
    console.error('[MeetingRecorder] 加载历史记录失败:', error)
  }
}

// 保存到 localStorage
function saveToStorage() {
  try {
    localStorage.setItem('meeting-records', JSON.stringify(meetingHistory.value))
  } catch (error) {
    console.error('[MeetingRecorder] 保存历史记录失败:', error)
  }
}

// 初始化
loadFromStorage()

// ==================== 核心功能 ====================

/**
 * 开始新会议
 */
export function startMeeting(title: string = `会议 ${new Date().toLocaleString()}`): MeetingRecord {
  const meeting: MeetingRecord = {
    id: generateId(),
    title,
    startTime: Date.now(),
    endTime: 0,
    segments: [],
    duration: 0
  }

  currentMeeting.value = meeting
  isRecording.value = true

  console.log('[MeetingRecorder] 🎤 开始新会议:', title)

  return meeting
}

/**
 * 结束会议
 */
export function endMeeting(): MeetingRecord | null {
  if (!currentMeeting.value) {
    console.warn('[MeetingRecorder] ⚠️ 没有正在进行的会议')
    return null
  }

  const meeting = currentMeeting.value
  meeting.endTime = Date.now()
  meeting.duration = meeting.endTime - meeting.startTime

  isRecording.value = false

  // 添加到历史记录
  meetingHistory.value.unshift(meeting)
  saveToStorage()

  console.log('[MeetingRecorder] ✅ 会议结束:', {
    title: meeting.title,
    duration: formatDuration(meeting.duration),
    segments: meeting.segments.length
  })

  currentMeeting.value = null

  return meeting
}

/**
 * 添加识别片段
 */
export function addSegment(text: string, confidence: number = 1.0, speaker?: string): MeetingSegment | null {
  if (!currentMeeting.value) {
    console.warn('[MeetingRecorder] ⚠️ 没有正在进行的会议，无法添加片段')
    return null
  }

  if (!text.trim()) {
    return null
  }

  const segment: MeetingSegment = {
    id: generateId(),
    text: text.trim(),
    speaker: speaker || 'Speaker 1',
    timestamp: Date.now() - currentMeeting.value.startTime,
    duration: 0, // 将在下一个片段添加时计算
    confidence
  }

  // 计算前一个片段的时长
  if (currentMeeting.value.segments.length > 0) {
    const prevSegment = currentMeeting.value.segments[currentMeeting.value.segments.length - 1]
    prevSegment.duration = segment.timestamp - prevSegment.timestamp
  }

  currentMeeting.value.segments.push(segment)

  console.log('[MeetingRecorder] 📝 添加片段:', {
    text: segment.text.substring(0, 50) + '...',
    timestamp: formatTime(segment.timestamp),
    speaker: segment.speaker
  })

  return segment
}

/**
 * 获取当前会议
 */
export function getCurrentMeeting(): MeetingRecord | null {
  return currentMeeting.value
}

/**
 * 获取会议历史
 */
export function getMeetingHistory(): MeetingRecord[] {
  return meetingHistory.value
}

/**
 * 删除会议记录
 */
export function deleteMeeting(meetingId: string): boolean {
  const index = meetingHistory.value.findIndex(m => m.id === meetingId)
  if (index === -1) {
    return false
  }

  meetingHistory.value.splice(index, 1)
  saveToStorage()

  console.log('[MeetingRecorder] 🗑️ 删除会议记录:', meetingId)
  return true
}

/**
 * 清空所有历史记录
 */
export function clearHistory(): void {
  meetingHistory.value = []
  saveToStorage()
  console.log('[MeetingRecorder] 🗑️ 已清空所有历史记录')
}

// ==================== 导出功能 ====================

/**
 * 导出为纯文本
 */
export function exportAsText(meeting: MeetingRecord): string {
  let text = `${meeting.title}\n`
  text += `时间: ${new Date(meeting.startTime).toLocaleString()}\n`
  text += `时长: ${formatDuration(meeting.duration)}\n`
  text += `片段数: ${meeting.segments.length}\n`
  text += '='.repeat(60) + '\n\n'

  meeting.segments.forEach((seg, index) => {
    text += `[${formatTime(seg.timestamp)}] ${seg.speaker}: ${seg.text}\n`
  })

  return text
}

/**
 * 导出为 JSON
 */
export function exportAsJSON(meeting: MeetingRecord): string {
  return JSON.stringify(meeting, null, 2)
}

/**
 * 导出为 SRT 字幕格式
 */
export function exportAsSRT(meeting: MeetingRecord): string {
  let srt = ''

  meeting.segments.forEach((seg, index) => {
    const startTime = formatSRTTime(seg.timestamp)
    const endTime = formatSRTTime(seg.timestamp + seg.duration)

    srt += `${index + 1}\n`
    srt += `${startTime} --> ${endTime}\n`
    srt += `${seg.text}\n\n`
  })

  return srt
}

/**
 * 下载文件
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  console.log('[MeetingRecorder] 💾 文件已下载:', filename)
}

// ==================== 统计功能 ====================

/**
 * 获取统计数据
 */
export function getStats(): MeetingStats {
  const totalSegments = meetingHistory.value.reduce((sum, m) => sum + m.segments.length, 0)
  const totalDuration = meetingHistory.value.reduce((sum, m) => sum + m.duration, 0)
  const totalConfidence = meetingHistory.value.reduce((sum, m) => {
    return sum + m.segments.reduce((s, seg) => s + seg.confidence, 0)
  }, 0)

  return {
    totalRecords: meetingHistory.value.length,
    totalDuration,
    totalSegments,
    averageConfidence: totalSegments > 0 ? totalConfidence / totalSegments : 0
  }
}

// ==================== 工具函数 ====================

function generateId(): string {
  return `meeting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`
  } else if (minutes > 0) {
    return `${minutes}分钟${seconds % 60}秒`
  } else {
    return `${seconds}秒`
  }
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function formatSRTTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const milliseconds = ms % 1000
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`
}

// ==================== Vue Composable ====================

export function useMeetingRecorder() {
  return {
    // 状态
    currentMeeting,
    meetingHistory,
    isRecording,

    // 方法
    startMeeting,
    endMeeting,
    addSegment,
    getCurrentMeeting,
    getMeetingHistory,
    deleteMeeting,
    clearHistory,

    // 导出
    exportAsText,
    exportAsJSON,
    exportAsSRT,
    downloadFile,

    // 统计
    getStats
  }
}
