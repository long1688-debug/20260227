/**
 * WebRTC 视频会议服务
 * 提供 P2P 视频通话和信令连接功能
 */

class WebRTCService {
  constructor() {
    this.peers = new Map() // 存储所有对等连接: peerId -> RTCPeerConnection
    this.localStream = null
    this.remoteStreams = new Map() // peerId -> MediaStream
    this.socket = null
    
    // 动态确定WebSocket服务器地址
    const SOCKET_BASE_URL = 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ?
        `ws://${window.location.hostname}:8080` :
        `ws${window.location.protocol === 'https:' ? 's' : ''}://${window.location.hostname}:${window.location.port || 8080}`);
        
    this.socketUrl = SOCKET_BASE_URL + '/webrtc'
    this.connected = false
    this.participantId = null
    this.onParticipantJoin = null
    this.onParticipantLeave = null
    this.onRemoteStream = null
    this.onDataMessage = null
  }

  /**
   * 初始化并连接到信令服务器
   * @param {Object} config - WebRTC 配置
   */
  async initialize(config = {}) {
    try {
      console.log('[WebRTC] 正在连接信令服务器:', this.socketUrl)
      
      // 初始化WebSocket连接
      this.socket = new WebSocket(this.socketUrl)
      
      // 初始化连接状态
      this.connected = false
      
      // 返回Promise以等待连接建立
      return new Promise((resolve, reject) => {
        this.socket.onopen = () => {
          console.log('[WebRTC] WebSocket连接已建立')
          this.connected = true
          resolve()
        }
        
        this.socket.onmessage = async (event) => {
          try {
            const message = JSON.parse(event.data)
            await this.handleSignalingMessage(message)
          } catch (error) {
            console.error('[WebRTC] 处理信令消息失败:', error)
          }
        }
        
        this.socket.onerror = (error) => {
          console.error('[WebRTC] WebSocket错误:', error)
          reject(error)
        }
        
        this.socket.onclose = () => {
          console.log('[WebRTC] WebSocket连接已关闭')
          this.connected = false
        }
      })
    } catch (error) {
      console.error('[WebRTC] 服务初始化失败:', error)
      throw error
    }
  }

  /**
   * 创建或加入会议
   * @param {Object} meeting - 会议信息 { id, name, password }
   */
  async joinMeeting(meeting) {
    if (!this.connected) {
      throw new Error('未连接到信令服务器')
    }

    console.log('[WebRTC] 加入会议:', meeting)

    // 发送加入会议请求
    this.send({
      type: 'join',
      meetingId: meeting.id,
      meetingName: meeting.name,
      password: meeting.password
    })
    
    // 设置连接状态
    this.connected = true
  }

  /**
   * 获取本地媒体流
   * @param {Object} constraints - 媒体约束
   */
  async getLocalStream(constraints = { video: true, audio: true }) {
    try {
      console.log('[WebRTC] 请求本地媒体流')
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints)
      console.log('[WebRTC] 本地媒体流获取成功')
      return this.localStream
    } catch (error) {
      console.error('[WebRTC] 获取本地媒体流失败:', error)
      throw error
    }
  }

  /**
   * 发送信令消息
   * @param {Object} message - 消息对象
   */
  send(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message))
      console.log('[WebRTC] 发送消息:', message)
    } else {
      console.error('[WebRTC] WebSocket 未连接，无法发送消息')
    }
  }

  /**
   * 处理信令消息
   * @param {Object} message - 消息对象
   */
  async handleSignalingMessage(message) {
    const { type, from, to } = message

    switch (type) {
      case 'joined':
        console.log('[WebRTC] 已加入会议, 参会者ID:', this.participantId)
        this.participantId = from
        // 通知回调
        if (this.onParticipantJoin) {
          this.onParticipantJoin({ id: from, name: message.name || '我' })
        }
        break

      case 'participant-joined':
        console.log('[WebRTC] 新参会者加入:', from)
        if (this.onParticipantJoin) {
          this.onParticipantJoin({ id: from, name: message.name || `参会者-${from.slice(-4)}` })
        }
        // 为新参会者创建 P2P 连接
        await this.createPeerConnection(from)
        // 发送 offer
        await this.sendOffer(from)
        break

      case 'participant-left':
        console.log('[WebRTC] 参会者离开:', from)
        if (this.onParticipantLeave) {
          this.onParticipantLeave(from)
        }
        this.closePeerConnection(from)
        break

      case 'offer':
        await this.handleOffer(from, message)
        break

      case 'answer':
        await this.handleAnswer(from, message)
        break

      case 'ice-candidate':
        await this.handleIceCandidate(from, message)
        break

      default:
        console.log('[WebRTC] 未知消息类型:', type)
    }
  }

  /**
   * 创建 P2P 连接
   * @param {string} peerId - 对等方ID
   */
  async createPeerConnection(peerId) {
    if (this.peers.has(peerId)) {
      console.warn('[WebRTC] P2P 连接已存在:', peerId)
      return
    }

    console.log('[WebRTC] 创建 P2P 连接:', peerId)

    const config = {
      // 局域网内与本机 ZLMediaKit 直连，不依赖外网 STUN（国内访问 Google STUN 会让 ICE 收集等到超时）
      iceServers: []
    }

    const peerConnection = new RTCPeerConnection(config)

    // 添加本地流
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, this.localStream)
      })
    }

    // 处理远程流
    peerConnection.ontrack = (event) => {
      console.log('[WebRTC] 收到远程流:', peerId)
      const remoteStream = event.streams[0]
      this.remoteStreams.set(peerId, remoteStream)

      if (this.onRemoteStream) {
        this.onRemoteStream(peerId, remoteStream)
      }
    }

    // 处理 ICE 候选
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.send({
          type: 'ice-candidate',
          to: peerId,
          candidate: event.candidate
        })
      }
    }

    // 处理连接状态
    peerConnection.onconnectionstatechange = () => {
      console.log('[WebRTC] P2P 连接状态:', peerId, peerConnection.connectionState)
    }

    this.peers.set(peerId, peerConnection)
  }

  /**
   * 发送 Offer
   * @param {string} peerId - 对等方ID
   */
  async sendOffer(peerId) {
    const peerConnection = this.peers.get(peerId)
    if (!peerConnection) {
      console.error('[WebRTC] P2P 连接不存在:', peerId)
      return
    }

    try {
      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)

      this.send({
        type: 'offer',
        to: peerId,
        offer: peerConnection.localDescription
      })
    } catch (error) {
      console.error('[WebRTC] 发送 Offer 失败:', error)
    }
  }

  /**
   * 处理 Offer
   * @param {string} from - 发送方ID
   * @param {Object} message - 消息对象
   */
  async handleOffer(from, message) {
    const peerConnection = this.peers.get(from)
    if (!peerConnection) {
      await this.createPeerConnection(from)
    }

    const pc = this.peers.get(from)
    if (pc && pc.signalingState !== 'stable') {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(message.offer))

        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        this.send({
          type: 'answer',
          to: from,
          answer: pc.localDescription
        })
      } catch (error) {
        console.error('[WebRTC] 处理 Offer 失败:', error)
      }
    }
  }

  /**
   * 处理 Answer
   * @param {string} from - 发送方ID
   * @param {Object} message - 消息对象
   */
  async handleAnswer(from, message) {
    const peerConnection = this.peers.get(from)
    if (peerConnection) {
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer))
      } catch (error) {
        console.error('[WebRTC] 处理 Answer 失败:', error)
      }
    }
  }

  /**
   * 处理 ICE 候选
   * @param {string} from - 发送方ID
   * @param {Object} message - 消息对象
   */
  async handleIceCandidate(from, message) {
    const peerConnection = this.peers.get(from)
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate))
      } catch (error) {
        console.error('[WebRTC] 处理 ICE 候选失败:', error)
      }
    }
  }

  /**
   * 发送数据消息
   * @param {string} peerId - 对等方ID
   * @param {Object} data - 数据对象
   */
  sendData(peerId, data) {
    const peerConnection = this.peers.get(peerId)
    if (peerConnection) {
      let dataChannel = peerConnection.dataChannels?.get('main')
      if (!dataChannel) {
        dataChannel = peerConnection.createDataChannel('main')
        dataChannel.onopen = () => {
          console.log('[WebRTC] 数据通道已打开:', peerId)
        }
      }
      dataChannel.send(JSON.stringify(data))
    }
  }

  /**
   * 广播数据消息
   * @param {Object} data - 数据对象
   */
  broadcastData(data) {
    this.peers.forEach((peerConnection, peerId) => {
      this.sendData(peerId, data)
    })
  }

  /**
   * 关闭 P2P 连接
   * @param {string} peerId - 对等方ID
   */
  closePeerConnection(peerId) {
    const peerConnection = this.peers.get(peerId)
    if (peerConnection) {
      peerConnection.close()
      this.peers.delete(peerId)
      this.remoteStreams.delete(peerId)
      console.log('[WebRTC] P2P 连接已关闭:', peerId)
    }
  }

  /**
   * 关闭所有连接
   */
  closeAll() {
    // 关闭所有 P2P 连接
    this.peers.forEach((peerConnection, peerId) => {
      peerConnection.close()
    })
    this.peers.clear()
    this.remoteStreams.clear()

    // 停止本地流
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop())
      this.localStream = null
    }

    // 关闭 WebSocket
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }

    this.connected = false
    this.participantId = null

    console.log('[WebRTC] 所有连接已关闭')
  }

  /**
   * 获取本地流
   */
  getLocalMediaStream() {
    return this.localStream
  }

  /**
   * 获取远程流
   * @param {string} peerId - 对等方ID
   */
  getRemoteMediaStream(peerId) {
    return this.remoteStreams.get(peerId)
  }

  /**
   * 设置回调函数
   */
  on(event, callback) {
    switch (event) {
      case 'participant-join':
        this.onParticipantJoin = callback
        break
      case 'participant-leave':
        this.onParticipantLeave = callback
        break
      case 'remote-stream':
        this.onRemoteStream = callback
        break
      case 'data':
        this.onDataMessage = callback
        break
      default:
        console.warn('[WebRTC] 未知事件类型:', event)
    }
  }
}

// 创建单例
const webrtcService = new WebRTCService()

export default webrtcService
