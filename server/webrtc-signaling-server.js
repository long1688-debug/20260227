/**
 * WebRTC 信令服务器
 * 处理 WebSocket 连接和信令消息转发
 */

const WebSocket = require('ws')
const { v4: uuidv4 } = require('crypto')

class WebRTCSignalingServer {
  constructor(port = 8080) {
    this.port = port
    this.server = null
    this.wss = null
    this.clients = new Map() // socketId -> { socket, participantId, meetingId }
    this.meetings = new Map() // meetingId -> { name, password, participants: Set }
  }

  /**
   * 启动信令服务器
   */
  start() {
    this.server = require('http').createServer()
    this.wss = new WebSocket.Server({ server: this.server })

    this.wss.on('connection', (ws, req) => {
      const socketId = uuidv4()
      console.log(`[信令服务器] 新连接: ${socketId}`)

      // 存储客户端连接
      this.clients.set(socketId, {
        socket: ws,
        participantId: null,
        meetingId: null
      })

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message)
          this.handleMessage(socketId, data)
        } catch (error) {
          console.error(`[信令服务器] 消息解析失败:`, error)
        }
      })

      ws.on('close', () => {
        this.handleDisconnect(socketId)
      })

      ws.on('error', (error) => {
        console.error(`[信令服务器] WebSocket 错误:`, error)
      })

      ws.send(JSON.stringify({
        type: 'connected',
        socketId: socketId
      }))
    })

    this.server.listen(this.port, () => {
      console.log(`[信令服务器] 已启动，监听端口 ${this.port}`)
    })

    this.server.on('error', (error) => {
      console.error(`[信令服务器] 服务器错误:`, error)
    })
  }

  /**
   * 处理客户端消息
   * @param {string} socketId - 客户端 socket ID
   * @param {Object} message - 消息对象
   */
  handleMessage(socketId, message) {
    const { type } = message
    const client = this.clients.get(socketId)

    if (!client) {
      console.warn(`[信令服务器] 未知客户端: ${socketId}`)
      return
    }

    switch (type) {
      case 'join':
        this.handleJoin(socketId, message)
        break

      case 'offer':
      case 'answer':
      case 'ice-candidate':
        this.forwardMessage(socketId, message)
        break

      case 'leave':
        this.handleLeave(socketId)
        break

      default:
        console.log(`[信令服务器] 未知消息类型: ${type}`)
    }
  }

  /**
   * 处理加入会议
   * @param {string} socketId - 客户端 socket ID
   * @param {Object} message - 消息对象 { meetingId, meetingName, password }
   */
  handleJoin(socketId, message) {
    const client = this.clients.get(socketId)
    const { meetingId, meetingName, password } = message

    // 检查会议是否存在
    let meeting = this.meetings.get(meetingId)

    if (!meeting) {
      // 创建新会议
      meeting = {
        id: meetingId,
        name: meetingName || `会议-${meetingId.slice(-4)}`,
        password: password || '',
        participants: new Set(),
        createdAt: new Date()
      }
      this.meetings.set(meetingId, meeting)
      console.log(`[信令服务器] 创建新会议: ${meetingName} (${meetingId})`)
    } else {
      // 验证密码
      if (meeting.password && meeting.password !== password) {
        client.socket.send(JSON.stringify({
          type: 'error',
          message: '会议密码错误'
        }))
        return
      }
    }

    // 分配参会者 ID
    const participantId = `participant-${uuidv4().slice(-8)}`
    client.participantId = participantId
    client.meetingId = meetingId

    // 添加到会议
    meeting.participants.add(socketId)

    // 发送加入成功消息
    client.socket.send(JSON.stringify({
      type: 'joined',
      from: participantId,
      meetingId: meetingId,
      meetingName: meeting.name
    }))

    // 通知会议中其他参会者
    this.broadcastToMeeting(meetingId, {
      type: 'participant-joined',
      from: participantId,
      name: client.participantName || `参会者-${participantId.slice(-4)}`,
      timestamp: new Date().toISOString()
    }, socketId)

    // 发送当前参会者列表
    const participantList = Array.from(meeting.participants)
      .filter(id => id !== socketId)
      .map(id => ({
        participantId: this.clients.get(id)?.participantId,
        socketId: id
      }))

    client.socket.send(JSON.stringify({
      type: 'participants',
      participants: participantList
    }))

    console.log(`[信令服务器] ${participantId} 加入会议 ${meetingId}`)
  }

  /**
   * 转发 P2P 信令消息
   * @param {string} socketId - 发送方 socket ID
   * @param {Object} message - 消息对象
   */
  forwardMessage(socketId, message) {
    const client = this.clients.get(socketId)
    const { type, to, from } = message

    if (!to) {
      console.warn(`[信令服务器] 消息缺少目标: ${type}`)
      return
    }

    // 查找目标客户端
    const targetSocketId = Array.from(this.clients.keys()).find(id =>
      this.clients.get(id)?.participantId === to
    )

    if (!targetSocketId) {
      console.warn(`[信令服务器] 目标客户端不存在: ${to}`)
      return
    }

    const targetClient = this.clients.get(targetSocketId)
    if (targetClient && targetClient.socket.readyState === WebSocket.OPEN) {
      // 转发消息
      targetClient.socket.send(JSON.stringify({
        ...message,
        from: client.participantId || socketId
      }))
      console.log(`[信令服务器] 转发 ${type} 消息: ${from} -> ${to}`)
    }
  }

  /**
   * 处理离开会议
   * @param {string} socketId - 客户端 socket ID
   */
  handleLeave(socketId) {
    const client = this.clients.get(socketId)

    if (client && client.meetingId && client.participantId) {
      const { meetingId, participantId } = client

      // 从会议中移除
      const meeting = this.meetings.get(meetingId)
      if (meeting) {
        meeting.participants.delete(socketId)

        // 通知其他参会者
        this.broadcastToMeeting(meetingId, {
          type: 'participant-left',
          from: participantId,
          timestamp: new Date().toISOString()
        }, socketId)

        // 如果会议为空，删除会议
        if (meeting.participants.size === 0) {
          this.meetings.delete(meetingId)
          console.log(`[信令服务器] 会议已删除: ${meetingId}`)
        }
      }

      client.socket.send(JSON.stringify({
        type: 'left',
        meetingId: meetingId
      }))

      console.log(`[信令服务器] ${participantId} 离开会议 ${meetingId}`)
    }
  }

  /**
   * 处理客户端断开连接
   * @param {string} socketId - 客户端 socket ID
   */
  handleDisconnect(socketId) {
    const client = this.clients.get(socketId)

    if (client) {
      // 通知会议中的其他参会者
      if (client.meetingId && client.participantId) {
        this.broadcastToMeeting(client.meetingId, {
          type: 'participant-left',
          from: client.participantId,
          timestamp: new Date().toISOString()
        }, socketId)

        // 从会议中移除
        const meeting = this.meetings.get(client.meetingId)
        if (meeting) {
          meeting.participants.delete(socketId)

          // 如果会议为空，删除会议
          if (meeting.participants.size === 0) {
            this.meetings.delete(client.meetingId)
            console.log(`[信令服务器] 会议已删除: ${client.meetingId}`)
          }
        }
      }

      this.clients.delete(socketId)
      console.log(`[信令服务器] 客户端断开: ${socketId}`)
    }
  }

  /**
   * 广播消息到会议中的所有参会者
   * @param {string} meetingId - 会议 ID
   * @param {Object} message - 消息对象
   * @param {string} excludeSocketId - 排除的 socket ID
   */
  broadcastToMeeting(meetingId, message, excludeSocketId = null) {
    const meeting = this.meetings.get(meetingId)

    if (!meeting) {
      console.warn(`[信令服务器] 会议不存在: ${meetingId}`)
      return
    }

    meeting.participants.forEach(socketId => {
      if (socketId !== excludeSocketId) {
        const client = this.clients.get(socketId)
        if (client && client.socket.readyState === WebSocket.OPEN) {
          client.socket.send(JSON.stringify(message))
        }
      }
    })
  }

  /**
   * 获取会议信息
   * @param {string} meetingId - 会议 ID
   */
  getMeeting(meetingId) {
    return this.meetings.get(meetingId)
  }

  /**
   * 获取所有会议
   */
  getAllMeetings() {
    return Array.from(this.meetings.values()).map(meeting => ({
      id: meeting.id,
      name: meeting.name,
      participantCount: meeting.participants.size,
      createdAt: meeting.createdAt
    }))
  }

  /**
   * 关闭服务器
   */
  shutdown() {
    if (this.wss) {
      this.wss.clients.forEach(ws => ws.close())
      this.wss.close()
    }

    if (this.server) {
      this.server.close()
    }

    this.clients.clear()
    this.meetings.clear()

    console.log('[信令服务器] 已关闭')
  }
}

// 导出
module.exports = WebRTCSignalingServer

// 如果直接运行此文件
if (require.main === module) {
  const server = new WebRTCSignalingServer(8080)
  server.start()

  // 优雅关闭
  process.on('SIGINT', () => {
    console.log('\n[信令服务器] 收到关闭信号')
    server.shutdown()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    console.log('\n[信令服务器] 收到关闭信号')
    server.shutdown()
    process.exit(0)
  })
}
