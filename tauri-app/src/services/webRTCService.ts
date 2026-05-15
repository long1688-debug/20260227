// WebRTC 推流和本地摄像头服务
import { invoke } from '@tauri-apps/api/core'

// ==================== 类型定义 ====================

export interface WebRTCPushOptions {
  app?: string            // 应用名称，默认 "live"
  enableAudio?: boolean   // 是否启用音频
  enableVideo?: boolean   // 是否启用视频
  timeoutSec?: number     // 超时时间（秒）
}

export interface LocalCameraOptions {
  deviceId?: string       // 设备 ID（Windows 为设备名称）
  resolution?: string     // 分辨率，如 "1920x1080"
  framerate?: number      // 帧率
  enableAudio?: boolean   // 是否启用音频
  app?: string            // 应用名称
}

export interface MobileScreenOptions {
  connectionType?: string // 连接方式：wifi, usb, qrcode
  deviceIp?: string       // 设备IP地址（WiFi模式）
  adbPort?: number        // ADB端口（USB模式）
  resolution?: string     // 分辨率，如 "1920x1080"
  framerate?: number      // 帧率
  enableAudio?: boolean   // 是否启用音频
  app?: string            // 应用名称
}

export interface WebRTCStreamMeta {
  id: string
  streamType: string
  sourceUrl: string        // WebRTC 推流地址
  flvUrl: string           // FLV 播放地址
  webrtcUrl: string        // WebRTC 播放地址
  wsFlvUrl: string         // WebSocket-FLV 播放地址
  status: string
  hasAudio: boolean
  hasVideo: boolean
  createdAt: number
}

// ==================== WebRTC 推流 ====================

/**
 * 创建 WebRTC 推流会话
 *
 * 前端通过 WebRTC API 直接推送到 ZLMediaKit，
 * ZLMediaKit 将流转换为 FLV/RTSP/RTMP 等格式。
 *
 * @param streamId 流 ID
 * @param options 推流选项
 * @returns 流元信息
 *
 * @example
 * ```typescript
 * const meta = await createWebRTCPush('my_stream')
 *
 * // 使用浏览器 WebRTC API 推送
 * const pc = new RTCPeerConnection()
 * const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
 * stream.getTracks().forEach(track => pc.addTrack(track, stream))
 *
 * // 获取 SDP Offer
 * const offer = await pc.createOffer()
 * await pc.setLocalDescription(offer)
 *
 * // 发送到 ZLMediaKit
 * const response = await fetch(meta.webrtcUrl, {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/sdp' },
 *   body: offer.sdp
 * })
 * ```
 */
export async function createWebRTCPush(
  streamId: string,
  options: WebRTCPushOptions = {}
): Promise<WebRTCStreamMeta> {
  try {
    console.log(`[WebRTC推流] 创建推流会话: ${streamId}`, options)

    const result = await invoke<WebRTCStreamMeta>('proxy_webrtc_push', {
      streamId,
      options: {
        app: options.app || null,
        enable_audio: options.enableAudio !== undefined ? options.enableAudio : true,
        enable_video: options.enableVideo !== undefined ? options.enableVideo : true,
        timeout_sec: options.timeoutSec || null
      }
    })

    console.log(`[WebRTC推流] 推流会话创建成功:`, result)
    return result
  } catch (error) {
    console.error('[WebRTC推流] 创建推流会话失败:', error)
    throw error
  }
}

/**
 * 使用浏览器 WebRTC API 推送到 ZLMediaKit
 *
 * @param streamId 流 ID
 * @param mediaStream 媒体流（摄像头/屏幕共享）
 * @param webrtcUrl WebRTC 推流地址
 * @returns RTCPeerConnection 实例
 */
export async function pushWebRTCStream(
  streamId: string,
  mediaStream: MediaStream,
  webrtcUrl: string
): Promise<RTCPeerConnection> {
  try {
    console.log(`[WebRTC推流] 开始推送: ${streamId}`)

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    })

    // 添加媒体轨道
    mediaStream.getTracks().forEach(track => {
      pc.addTrack(track, mediaStream)
      console.log(`[WebRTC推流] 添加轨道: ${track.kind} - ${track.label}`)
    })

    // 创建 Offer
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    })

    await pc.setLocalDescription(offer)
    console.log('[WebRTC推流] LocalDescription 已设置')

    // 发送到 ZLMediaKit
    const response = await fetch(webrtcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp'
      },
      body: offer.sdp
    })

    if (!response.ok) {
      throw new Error(`ZLMediaKit 响应错误: ${response.status}`)
    }

    const answerSdp = await response.text()
    await pc.setRemoteDescription(new RTCSessionDescription({
      type: 'answer',
      sdp: answerSdp
    }))

    console.log('[WebRTC推流] 推流成功')
    return pc
  } catch (error) {
    console.error('[WebRTC推流] 推送失败:', error)
    throw error
  }
}

// ==================== 本地摄像头代理 ====================

/**
 * 代理本地摄像头到 ZLMediaKit（通过 FFmpeg）
 *
 * 后端使用 FFmpeg 捕获摄像头并推送到 ZLMediaKit，
 * 实现低延迟 FLV/WebRTC 播放。
 *
 * @param streamId 流 ID
 * @param options 摄像头选项
 * @returns 流元信息
 *
 * @example
 * ```typescript
 * const meta = await createLocalCameraStream('camera_001', {
 *   deviceId: 'Integrated Camera',
 *   resolution: '1920x1080',
 *   framerate: 30,
 *   enableAudio: true
 * })
 *
 * // 在 video 元素中播放
 * video.src = meta.wsFlvUrl
 * ```
 */
export async function createLocalCameraStream(
  streamId: string,
  options: LocalCameraOptions = {}
): Promise<WebRTCStreamMeta> {
  try {
    console.log(`[本地摄像头] 创建摄像头流: ${streamId}`, options)

    const result = await invoke<WebRTCStreamMeta>('proxy_local_camera', {
      streamId,
      options: {
        device_id: options.deviceId || null,
        resolution: options.resolution || null,
        framerate: options.framerate || null,
        enable_audio: options.enableAudio !== undefined ? options.enableAudio : true,
        app: options.app || null
      }
    })

    console.log(`[本地摄像头] 摄像头流创建成功:`, result)
    return result
  } catch (error) {
    console.error('[本地摄像头] 创建摄像头流失败:', error)
    throw error
  }
}

/**
 * 枚举摄像头设备
 * @returns 设备列表
 */
export async function enumerateCameraDevices(): Promise<MediaDeviceInfo[]> {
  try {
    // 请求摄像头权限
    await navigator.mediaDevices.getUserMedia({ video: true })

    // 枚举设备
    const devices = await navigator.mediaDevices.enumerateDevices()
    const cameras = devices.filter(d => d.kind === 'videoinput')

    console.log(`[本地摄像头] 找到 ${cameras.length} 个摄像头设备`)
    return cameras
  } catch (error) {
    console.error('[本地摄像头] 枚举设备失败:', error)
    throw error
  }
}

/**
 * 获取默认摄像头设备名称（用于 FFmpeg）
 * @returns 摄像头设备名称
 */
export async function getDefaultCameraDevice(): Promise<string | null> {
  try {
    const devices = await enumerateCameraDevices()
    if (devices.length === 0) {
      return null
    }

    // 返回第一个摄像头设备标签
    return devices[0].label || devices[0].deviceId
  } catch (error) {
    console.error('[本地摄像头] 获取默认设备失败:', error)
    return null
  }
}

// ==================== 辅助函数 ====================

/**
 * 停止 WebRTC 推流
 * @param pc RTCPeerConnection 实例
 * @param streamId 流 ID
 */
export async function stopWebRTCPush(
  pc: RTCPeerConnection | null,
  streamId: string
): Promise<boolean> {
  try {
    // 关闭 WebRTC 连接
    if (pc) {
      pc.getSenders().forEach(sender => {
        if (sender.track) {
          sender.track.stop()
        }
      })
      pc.close()
      console.log('[WebRTC推流] WebRTC 连接已关闭')
    }

    // 停止后端流代理
    const { stopStreamProxy } = await import('./streamProxyService')
    return await stopStreamProxy(streamId)
  } catch (error) {
    console.error('[WebRTC推流] 停止推流失败:', error)
    throw error
  }
}

/**
 * 检查 WebRTC 推流状态
 * @param pc RTCPeerConnection 实例
 * @returns 连接状态
 */
export function checkWebRTCStatus(pc: RTCPeerConnection): string {
  if (!pc) return 'disconnected'

  const state = pc.connectionState || pc.iceConnectionState
  return state || 'unknown'
}

// ==================== 手机/平板屏幕投屏 ====================

/**
 * 创建手机屏幕投屏流
 *
 * 支持三种连接方式：
 * 1. WiFi局域网：手机通过RTSP/WebRTC推流到ZLMediaKit
 * 2. USB数据线：通过ADB捕获手机屏幕
 * 3. 二维码扫码：生成二维码供手机扫描连接
 *
 * @param streamId 流 ID
 * @param options 投屏选项
 * @returns 流元信息
 *
 * @example
 * ```typescript
 * // WiFi模式
 * const meta = await createMobileScreenStream('mobile_001', {
 *   connectionType: 'wifi',
 *   deviceIp: '192.168.1.100',
 *   resolution: '1920x1080',
 *   framerate: 30,
 *   enableAudio: true
 * })
 *
 * // USB模式
 * const meta = await createMobileScreenStream('mobile_002', {
 *   connectionType: 'usb',
 *   adbPort: 5555,
 *   resolution: '1920x1080',
 *   framerate: 30
 * })
 *
 * // 二维码模式
 * const meta = await createMobileScreenStream('mobile_003', {
 *   connectionType: 'qrcode',
 *   resolution: '1920x1080'
 * })
 * ```
 */
export async function createMobileScreenStream(
  streamId: string,
  options: MobileScreenOptions = {}
): Promise<WebRTCStreamMeta> {
  try {
    console.log(`[手机投屏] 创建投屏流: ${streamId}`, options)

    const result = await invoke<WebRTCStreamMeta>('proxy_mobile_screen', {
      streamId,
      options: {
        connection_type: options.connectionType || 'wifi',
        device_ip: options.deviceIp || null,
        adb_port: options.adbPort || null,
        resolution: options.resolution || null,
        framerate: options.framerate || null,
        enable_audio: options.enableAudio !== undefined ? options.enableAudio : true,
        app: options.app || null
      }
    })

    console.log(`[手机投屏] 投屏流创建成功:`, result)
    return result
  } catch (error) {
    console.error('[手机投屏] 创建投屏流失败:', error)
    throw error
  }
}
