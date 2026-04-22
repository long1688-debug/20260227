/**
 * 会议统计和日志服务
 * 记录会议活动并生成统计数据
 */

class MeetingStatsService {
  constructor() {
    this.currentSession = null
    this.sessionHistory = []
    this.eventLog = []
  }

  /**
   * 开始新会话
   * @param {Object} meetingInfo - 会议信息 { id, name, createdBy }
   */
  startSession(meetingInfo) {
    this.currentSession = {
      id: meetingInfo.id,
      name: meetingInfo.name,
      createdBy: meetingInfo.createdBy,
      startTime: new Date().toISOString(),
      endTime: null,
      duration: 0,
      participants: [],
      events: [],
      recordings: [],
      peakParticipants: 0
    }

    console.log('[会议统计] 会话已开始:', this.currentSession)
  }

  /**
   * 结束当前会话
   */
  endSession() {
    if (!this.currentSession) {
      return null
    }

    this.currentSession.endTime = new Date().toISOString()
    this.currentSession.duration = this.calculateDuration(
      this.currentSession.startTime,
      this.currentSession.endTime
    )

    // 保存到历史记录
    this.sessionHistory.push({ ...this.currentSession })

    console.log('[会议统计] 会话已结束:', this.currentSession)
    return this.currentSession
  }

  /**
   * 记录事件
   * @param {string} type - 事件类型
   * @param {Object} data - 事件数据
   */
  logEvent(type, data = {}) {
    const event = {
      timestamp: new Date().toISOString(),
      type,
      ...data
    }

    this.eventLog.push(event)

    // 添加到当前会话
    if (this.currentSession) {
      this.currentSession.events.push(event)
    }

    console.log('[会议统计] 事件已记录:', event)
  }

  /**
   * 记录参会者加入
   * @param {Object} participant - 参会者信息
   */
  logParticipantJoin(participant) {
    this.logEvent('participant-join', {
      participantId: participant.id,
      participantName: participant.name
    })

    if (this.currentSession) {
      // 检查是否已存在
      const exists = this.currentSession.participants.find(p => p.id === participant.id)
      if (!exists) {
        this.currentSession.participants.push({
          id: participant.id,
          name: participant.name,
          joinTime: new Date().toISOString(),
          leaveTime: null,
          duration: 0
        })

        // 更新峰值人数
        if (this.currentSession.participants.length > this.currentSession.peakParticipants) {
          this.currentSession.peakParticipants = this.currentSession.participants.length
        }
      }
    }
  }

  /**
   * 记录参会者离开
   * @param {string} participantId - 参会者 ID
   */
  logParticipantLeave(participantId) {
    this.logEvent('participant-leave', { participantId })

    if (this.currentSession) {
      const participant = this.currentSession.participants.find(p => p.id === participantId)
      if (participant) {
        participant.leaveTime = new Date().toISOString()
        participant.duration = this.calculateDuration(participant.joinTime, participant.leaveTime)
      }
    }
  }

  /**
   * 记录录制开始
   */
  logRecordingStart() {
    this.logEvent('recording-start')
  }

  /**
   * 记录录制结束
   * @param {Object} recordingInfo - 录制信息
   */
  logRecordingEnd(recordingInfo) {
    this.logEvent('recording-end', recordingInfo)

    if (this.currentSession) {
      this.currentSession.recordings.push({
        startTime: new Date().toISOString(),
        ...recordingInfo
      })
    }
  }

  /**
   * 记录屏幕共享
   * @param {boolean} started - 是否开始
   */
  logScreenShare(started) {
    this.logEvent('screen-share', { started })
  }

  /**
   * 记录远程控制
   * @param {boolean} enabled - 是否启用
   */
  logRemoteControl(enabled) {
    this.logEvent('remote-control', { enabled })
  }

  /**
   * 计算持续时间
   * @param {string} startTime - 开始时间 ISO 字符串
   * @param {string} endTime - 结束时间 ISO 字符串
   */
  calculateDuration(startTime, endTime) {
    const start = new Date(startTime).getTime()
    const end = new Date(endTime).getTime()
    return Math.floor((end - start) / 1000) // 返回秒数
  }

  /**
   * 格式化持续时间
   * @param {number} seconds - 秒数
   */
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}小时${minutes}分${secs}秒`
    } else if (minutes > 0) {
      return `${minutes}分${secs}秒`
    } else {
      return `${secs}秒`
    }
  }

  /**
   * 获取当前会话统计
   */
  getCurrentSessionStats() {
    if (!this.currentSession) {
      return null
    }

    const now = new Date().toISOString()
    const currentDuration = this.calculateDuration(this.currentSession.startTime, now)

    return {
      id: this.currentSession.id,
      name: this.currentSession.name,
      startTime: this.currentSession.startTime,
      duration: currentDuration,
      durationFormatted: this.formatDuration(currentDuration),
      participantCount: this.currentSession.participants.length,
      peakParticipants: this.currentSession.peakParticipants,
      eventCount: this.currentSession.events.length,
      recordingCount: this.currentSession.recordings.length
    }
  }

  /**
   * 获取会话历史
   */
  getSessionHistory(limit = 10) {
    return this.sessionHistory.slice(-limit).reverse()
  }

  /**
   * 获取历史统计摘要
   */
  getHistorySummary() {
    const totalSessions = this.sessionHistory.length
    if (totalSessions === 0) {
      return null
    }

    const totalDuration = this.sessionHistory.reduce((sum, session) => sum + session.duration, 0)
    const totalParticipants = this.sessionHistory.reduce(
      (sum, session) => sum + session.peakParticipants,
      0
    )
    const totalRecordings = this.sessionHistory.reduce(
      (sum, session) => sum + session.recordings.length,
      0
    )

    return {
      totalSessions,
      totalDuration,
      totalDurationFormatted: this.formatDuration(totalDuration),
      avgDuration: Math.floor(totalDuration / totalSessions),
      avgDurationFormatted: this.formatDuration(Math.floor(totalDuration / totalSessions)),
      totalParticipants,
      avgParticipants: Math.floor(totalParticipants / totalSessions),
      totalRecordings
    }
  }

  /**
   * 导出事件日志
   * @param {string} format - 导出格式 'json' | 'csv'
   */
  exportEventLog(format = 'json') {
    if (format === 'json') {
      return JSON.stringify(this.eventLog, null, 2)
    } else if (format === 'csv') {
      const headers = 'timestamp,type,data\n'
      const rows = this.eventLog.map(event =>
        `${event.timestamp},${event.type},"${JSON.stringify(event.data).replace(/"/g, '""')}"`
      )
      return headers + rows.join('\n')
    }
  }

  /**
   * 清除历史记录
   */
  clearHistory() {
    this.sessionHistory = []
    this.eventLog = []
    console.log('[会议统计] 历史记录已清除')
  }

  /**
   * 保存到 localStorage
   */
  saveToLocalStorage() {
    try {
      const data = {
        sessionHistory: this.sessionHistory,
        eventLog: this.eventLog
      }
      localStorage.setItem('meeting-stats', JSON.stringify(data))
      console.log('[会议统计] 数据已保存到 localStorage')
    } catch (error) {
      console.error('[会议统计] 保存失败:', error)
    }
  }

  /**
   * 从 localStorage 加载
   */
  loadFromLocalStorage() {
    try {
      const data = localStorage.getItem('meeting-stats')
      if (data) {
        const parsed = JSON.parse(data)
        this.sessionHistory = parsed.sessionHistory || []
        this.eventLog = parsed.eventLog || []
        console.log('[会议统计] 数据已从 localStorage 加载')
      }
    } catch (error) {
      console.error('[会议统计] 加载失败:', error)
    }
  }
}

// 创建单例
const meetingStatsService = new MeetingStatsService()

// 初始化时加载历史数据
meetingStatsService.loadFromLocalStorage()

export default meetingStatsService
