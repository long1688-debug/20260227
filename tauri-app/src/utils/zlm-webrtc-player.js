/**
 * ZLMediaKit WebRTC 播放器
 *
 * 通过 RTCPeerConnection 与 ZLMediaKit 内置的 WebRTC 服务器交互
 * 延迟 <200ms，无需后端视频处理代码
 *
 * ZLMediaKit WebRTC 信令流程（HTTP + SDP 交换）：
 * 1. 前端创建 RTCPeerConnection，生成 offer SDP
 * 2. 将 offer SDP 通过 HTTP POST 发送给 ZLMediaKit
 * 3. ZLMediaKit 返回 answer SDP
 * 4. 前端设置 answer SDP，建立 WebRTC 连接
 */

// ZLMediaKit 默认配置
const ZLM_DEFAULT_HOST = '127.0.0.1'
const ZLM_DEFAULT_HTTP_PORT = 801
const ZLM_DEFAULT_SECRET = '8qNdNv8bykcWrRo9BAsFQiUZABZ9kWd3'

/**
 * ZLMediaKit WebRTC 播放器类
 */
export class ZLMediaKitWebRTCPlayer {
  /**
   * @param {HTMLVideoElement} videoElement - 视频元素
   * @param {Object} options - 配置选项
   * @param {string} [options.host] - ZLMediaKit 服务器地址
   * @param {number} [options.httpPort] - ZLMediaKit HTTP API 端口
   * @param {string} [options.secret] - ZLMediaKit API 密钥
   * @param {string} options.streamId - 流 ID（如 "live/camera1"）
   * @param {boolean} [options.enableAudio] - 是否启用音频（默认 true）
   * @param {boolean} [options.enableVideo] - 是否启用视频（默认 true）
   * @param {Function} [options.onStats] - 统计信息回调
   * @param {Function} [options.onError] - 错误回调
   * @param {Function} [options.onConnected] - 连接成功回调
   * @param {Function} [options.onDisconnected] - 断开连接回调
   */
  constructor(videoElement, options = {}) {
    this._videoElement = videoElement
    this._host = options.host || ZLM_DEFAULT_HOST
    this._httpPort = options.httpPort || ZLM_DEFAULT_HTTP_PORT
    this._secret = options.secret || ZLM_DEFAULT_SECRET
    this._streamId = options.streamId || ''
    this._enableAudio = options.enableAudio !== false
    this._enableVideo = options.enableVideo !== false
    this._onStats = options.onStats || null
    this._onError = options.onError || null
    this._onConnected = options.onConnected || null
    this._onDisconnected = options.onDisconnected || null

    this._pc = null
    this._isConnected = false
    this._isDestroyed = false
    this._statsInterval = null
    this._reconnectTimer = null
    this._reconnectAttempts = 0
    this._maxReconnectAttempts = 5
    this._reconnectDelay = 3000

    // 帧捕获相关
    this._canvas = null
    this._canvasCtx = null
  }

  /**
   * 获取 WebRTC 播放 URL
   */
  get webrtcPlayUrl() {
    return `/index/api/webrtc?app=live&stream=${this._streamId}&type=play&secret=${this._secret}`
  }

  /**
   * 连接并播放 WebRTC 流
   */
  async connect() {
    if (this._isDestroyed) {
      throw new Error('播放器已销毁')
    }

    // 关闭已有连接
    await this.disconnect()

    console.log(`[ZLM-WebRTC] 正在连接: ${this._streamId}`)

    try {
      // 1. 创建 RTCPeerConnection
      this._pc = new RTCPeerConnection({
        iceServers: [],  // ZLMediaKit 本地不需要 STUN/TURN
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
        iceCandidatePoolSize: 0
      })

      // 2. 添加 transceiver（接收音视频）
      if (this._enableAudio) {
        this._pc.addTransceiver('audio', { direction: 'recvonly' })
      }
      if (this._enableVideo) {
        this._pc.addTransceiver('video', { direction: 'recvonly' })
      }

      // 3. 监听 track 事件
      this._pc.ontrack = (event) => {
        console.log(`[ZLM-WebRTC] 收到 track: ${event.track.kind}`, event.streams)
        if (event.streams && event.streams[0]) {
          this._videoElement.srcObject = event.streams[0]
        }
      }

      // 4. 监听连接状态
      this._pc.onconnectionstatechange = () => {
        const state = this._pc?.connectionState
        console.log(`[ZLM-WebRTC] 连接状态: ${state}`)

        switch (state) {
          case 'connected':
            this._isConnected = true
            this._reconnectAttempts = 0
            this._startStatsMonitor()
            this._onConnected?.()
            break
          case 'disconnected':
          case 'failed':
            this._isConnected = false
            this._stopStatsMonitor()
            this._onDisconnected?.()
            // 自动重连
            this._attemptReconnect()
            break
          case 'closed':
            this._isConnected = false
            this._stopStatsMonitor()
            break
        }
      }

      this._pc.oniceconnectionstatechange = () => {
        const state = this._pc?.iceConnectionState
        console.log(`[ZLM-WebRTC] ICE 连接状态: ${state}`)

        if (state === 'failed' || state === 'disconnected') {
          this._isConnected = false
          this._stopStatsMonitor()
          this._onDisconnected?.()
          this._attemptReconnect()
        }
      }

      // 5. 创建 offer SDP
      const offer = await this._pc.createOffer()
      await this._pc.setLocalDescription(offer)

      // 6. 等待 ICE gathering 完成（或超时）
      await this._waitForIceGathering(2000)

      // 7. 将 offer SDP 发送给 ZLMediaKit
      const localSdp = this._pc.localDescription.sdp
      const response = await this._exchangeSDP(localSdp)

      // 8. 设置 answer SDP
      await this._pc.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp: response.sdp })
      )

      console.log(`[ZLM-WebRTC] ✅ WebRTC 信令交换完成，等待媒体流...`)

      // 9. 等待视频播放
      await this._waitForPlayback(10000)

    } catch (error) {
      console.error(`[ZLM-WebRTC] 连接失败:`, error)
      this._onError?.(error)
      throw error
    }
  }

  /**
   * 与 ZLMediaKit 交换 SDP（HTTP POST）
   */
  async _exchangeSDP(offerSdp) {
    const url = this.webrtcPlayUrl

    console.log(`[ZLM-WebRTC] 发送 offer SDP 到: ${url}`)
    console.log(`[ZLM-WebRTC] Offer SDP 长度: ${offerSdp.length}`)
    console.log(`[ZLM-WebRTC] streamId: ${this._streamId}`)
    console.log(`[ZLM-WebRTC] host: ${this._host}:${this._httpPort}`)

    // 先检查流是否就绪
    const streamReady = await this._checkStreamReady()
    if (!streamReady) {
      console.warn(`[ZLM-WebRTC] 流 ${this._streamId} 尚未就绪，将继续尝试...`)
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp'
      },
      body: offerSdp
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[ZLM-WebRTC] ❌ ZLMediaKit 返回错误:`, {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      })
      throw new Error(`ZLMediaKit WebRTC 信令交换失败 (HTTP ${response.status}): ${errorText}`)
    }

    const result = await response.json()

    if (result.code !== 0) {
      console.error(`[ZLM-WebRTC] ❌ ZLMediaKit 业务错误:`, result)
      throw new Error(`ZLMediaKit WebRTC 错误: ${result.msg || '未知错误'}`)
    }

    if (!result.sdp) {
      throw new Error('ZLMediaKit 未返回 answer SDP')
    }

    console.log(`[ZLM-WebRTC] 收到 answer SDP，长度: ${result.sdp.length}`)
    return { sdp: result.sdp, id: result.id }
  }

  /**
   * 检查流是否在 ZLMediaKit 中就绪
   */
  async _checkStreamReady() {
    try {
      const apiUrl = `/index/api/getMediaList?secret=${this._secret}`
      console.log(`[ZLM-WebRTC] 检查流是否就绪: ${this._streamId}`)

      const response = await fetch(apiUrl)
      if (!response.ok) {
        console.warn(`[ZLM-WebRTC] getMediaList 请求失败: ${response.status}`)
        return false
      }

      const data = await response.json()
      console.log(`[ZLM-WebRTC] getMediaList 响应:`, data)

      if (data.code !== 0 || !data.data) {
        return false
      }

      const stream = data.data.find(s => s.stream === this._streamId)
      if (!stream) {
        console.warn(`[ZLM-WebRTC] 流 ${this._streamId} 未在列表中找到`)
        return false
      }

      const hasReadyVideo = stream.tracks?.some(t => t.codec_id === 0 && t.ready)
      if (!hasReadyVideo) {
        console.warn(`[ZLM-WebRTC] 流 ${this._streamId} 的视频轨道未就绪`)
        return false
      }

      console.log(`[ZLM-WebRTC] ✅ 流 ${this._streamId} 已就绪`)
      return true
    } catch (e) {
      console.warn(`[ZLM-WebRTC] 检查流就绪失败:`, e.message)
      return false
    }
  }

  /**
   * 等待 ICE gathering 完成
   */
  _waitForIceGathering(timeout = 2000) {
    return new Promise((resolve) => {
      if (this._pc?.iceGatheringState === 'complete') {
        resolve()
        return
      }

      const timer = setTimeout(resolve, timeout)

      const onStateChange = () => {
        if (this._pc?.iceGatheringState === 'complete') {
          clearTimeout(timer)
          this._pc?.removeEventListener('icegatheringstatechange', onStateChange)
          resolve()
        }
      }

      this._pc?.addEventListener('icegatheringstatechange', onStateChange)

      // 也监听 ICE candidate 事件
      this._pc?.addEventListener('icecandidate', (event) => {
        if (!event.candidate) {
          // null candidate 表示 gathering 完成
          clearTimeout(timer)
          resolve()
        }
      })
    })
  }

  /**
   * 等待视频开始播放
   */
  _waitForPlayback(timeout = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('等待视频播放超时'))
      }, timeout)

      const onPlaying = () => {
        clearTimeout(timer)
        console.log(`[ZLM-WebRTC] ✅ 视频开始播放`)
        resolve()
      }

      this._videoElement.addEventListener('playing', onPlaying, { once: true })

      // 如果已经在播放，直接 resolve
      if (!this._videoElement.paused && this._videoElement.readyState >= 2) {
        clearTimeout(timer)
        this._videoElement.removeEventListener('playing', onPlaying)
        resolve()
      }
    })
  }

  /**
   * 断开连接
   */
  async disconnect() {
    this._stopStatsMonitor()

    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }

    if (this._pc) {
      try {
        this._pc.ontrack = null
        this._pc.onconnectionstatechange = null
        this._pc.oniceconnectionstatechange = null
        this._pc.close()
      } catch (e) {
        console.warn('[ZLM-WebRTC] 关闭 PeerConnection 异常:', e)
      }
      this._pc = null
    }

    if (this._videoElement) {
      this._videoElement.srcObject = null
    }

    this._isConnected = false
  }

  /**
   * 销毁播放器
   */
  async destroy() {
    this._isDestroyed = true
    await this.disconnect()
    this._canvas = null
    this._canvasCtx = null
  }

  /**
   * 自动重连
   */
  _attemptReconnect() {
    if (this._isDestroyed) return
    if (this._reconnectAttempts >= this._maxReconnectAttempts) {
      console.error(`[ZLM-WebRTC] 达到最大重连次数 (${this._maxReconnectAttempts})`)
      this._onError?.(new Error('WebRTC 连接失败，已达到最大重连次数'))
      return
    }

    this._reconnectAttempts++
    const delay = Math.min(this._reconnectDelay * this._reconnectAttempts, 15000)

    console.log(`[ZLM-WebRTC] 尝试重连 (${this._reconnectAttempts}/${this._maxReconnectAttempts})，${delay}ms 后重试...`)

    this._reconnectTimer = setTimeout(async () => {
      if (!this._isDestroyed) {
        try {
          await this.connect()
        } catch (e) {
          console.warn(`[ZLM-WebRTC] 重连失败:`, e.message)
        }
      }
    }, delay)
  }

  /**
   * 启动统计信息监控
   */
  _startStatsMonitor() {
    this._stopStatsMonitor()

    this._statsInterval = setInterval(async () => {
      if (!this._pc || this._isDestroyed) {
        this._stopStatsMonitor()
        return
      }

      try {
        const stats = await this._pc.getStats()
        const statsData = {
          timestamp: Date.now(),
          video: { bytesReceived: 0, packetsReceived: 0, packetsLost: 0, framesPerSecond: 0, jitter: 0 },
          audio: { bytesReceived: 0, packetsReceived: 0, packetsLost: 0, jitter: 0 },
          transport: { bytesReceived: 0, bytesSent: 0, rtt: 0 }
        }

        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            statsData.video.bytesReceived = report.bytesReceived || 0
            statsData.video.packetsReceived = report.packetsReceived || 0
            statsData.video.packetsLost = report.packetsLost || 0
            statsData.video.framesPerSecond = report.framesPerSecond || 0
            statsData.video.jitter = report.jitter || 0
          } else if (report.type === 'inbound-rtp' && report.kind === 'audio') {
            statsData.audio.bytesReceived = report.bytesReceived || 0
            statsData.audio.packetsReceived = report.packetsReceived || 0
            statsData.audio.packetsLost = report.packetsLost || 0
            statsData.audio.jitter = report.jitter || 0
          } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            statsData.transport.bytesReceived = report.bytesReceived || 0
            statsData.transport.bytesSent = report.bytesSent || 0
            statsData.transport.rtt = report.currentRoundTripTime
              ? Math.round(report.currentRoundTripTime * 1000)
              : 0
          }
        })

        this._onStats?.(statsData)
      } catch (e) {
        // 忽略统计信息获取失败
      }
    }, 1000)
  }

  /**
   * 停止统计信息监控
   */
  _stopStatsMonitor() {
    if (this._statsInterval) {
      clearInterval(this._statsInterval)
      this._statsInterval = null
    }
  }

  /**
   * 从 video 元素捕获当前帧（用于 AI 分析）
   * @param {number} [width] - 输出宽度
   * @param {number} [height] - 输出高度
   * @returns {ImageData|null}
   */
  captureFrame(width, height) {
    if (!this._videoElement || this._videoElement.readyState < 2) {
      return null
    }

    const w = width || this._videoElement.videoWidth
    const h = height || this._videoElement.videoHeight

    if (!this._canvas) {
      this._canvas = document.createElement('canvas')
      this._canvasCtx = this._canvas.getContext('2d')
    }

    this._canvas.width = w
    this._canvas.height = h
    this._canvasCtx.drawImage(this._videoElement, 0, 0, w, h)
    return this._canvasCtx.getImageData(0, 0, w, h)
  }

  /**
   * 捕获帧为 Base64 图片（用于 AI 分析上传）
   * @param {string} [format='image/jpeg'] - 图片格式
   * @param {number} [quality=0.8] - 图片质量
   * @returns {string|null} Base64 编码的图片
   */
  captureFrameAsBase64(format = 'image/jpeg', quality = 0.8) {
    if (!this._videoElement || this._videoElement.readyState < 2) {
      return null
    }

    if (!this._canvas) {
      this._canvas = document.createElement('canvas')
      this._canvasCtx = this._canvas.getContext('2d')
    }

    this._canvas.width = this._videoElement.videoWidth
    this._canvas.height = this._videoElement.videoHeight
    this._canvasCtx.drawImage(this._videoElement, 0, 0)
    return this._canvas.toDataURL(format, quality)
  }

  /**
   * 使用 requestVideoFrameCallback 捕获帧（更高效，与视频帧同步）
   * @param {Function} callback - 帧回调 (videoElement, metadata) => void
   * @returns {number|null} 回调 ID（用于取消）
   */
  onVideoFrame(callback) {
    if (!this._videoElement || typeof this._videoElement.requestVideoFrameCallback !== 'function') {
      console.warn('[ZLM-WebRTC] requestVideoFrameCallback 不支持，使用 canvas 方式捕获帧')
      return null
    }

    return this._videoElement.requestVideoFrameCallback((now, metadata) => {
      callback(this._videoElement, metadata)
    })
  }

  /**
   * 取消帧回调
   * @param {number} id - 回调 ID
   */
  cancelVideoFrame(id) {
    if (this._videoElement && typeof this._videoElement.cancelVideoFrameCallback === 'function') {
      this._videoElement.cancelVideoFrameCallback(id)
    }
  }

  /**
   * 获取连接状态
   */
  get isConnected() {
    return this._isConnected
  }

  /**
   * 获取连接统计
   */
  get peerConnection() {
    return this._pc
  }
}

/**
 * 快速创建 WebRTC 播放器并连接
 * @param {HTMLVideoElement} videoElement - 视频元素
 * @param {string} streamId - 流 ID
 * @param {Object} [options] - 配置选项
 * @returns {Promise<ZLMediaKitWebRTCPlayer>}
 */
export async function createWebRTCPlayer(videoElement, streamId, options = {}) {
  const player = new ZLMediaKitWebRTCPlayer(videoElement, {
    ...options,
    streamId
  })
  await player.connect()
  return player
}

/**
 * 检查浏览器是否支持 WebRTC
 * @returns {boolean}
 */
export function isWebRTCSupported() {
  return typeof RTCPeerConnection !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined'
}

/**
 * 检查 ZLMediaKit WebRTC 服务是否可用
 * @param {string} [host] - 服务器地址
 * @param {number} [port] - HTTP 端口
 * @returns {Promise<boolean>}
 */
export async function checkZLMWebRTCAvailable(host = ZLM_DEFAULT_HOST, port = ZLM_DEFAULT_HTTP_PORT) {
  try {
    // 使用 getApiList 代替 getServerInfo（新版ZLMediaKit API）
    const response = await fetch(`/index/api/getApiList`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    })
    if (response.ok) {
      const data = await response.json()
      return data.code === 0
    }
    return false
  } catch {
    return false
  }
}

export default ZLMediaKitWebRTCPlayer
