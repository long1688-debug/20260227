/**
 * RTSP 地址解析工具
 *
 * 提供三层智能探测策略：
 * 1. ONVIF 协议获取（优先）
 * 2. 品牌模板匹配
 * 3. 探针验证确保可用性
 */

import { invoke } from '@tauri-apps/api/core'

/**
 * RTSP 解析请求参数
 */
export interface RtspResolveRequest {
  /** 摄像机品牌/制造商（如 "Hikvision", "Dahua"） */
  manufacturer: string
  /** 主机地址（IP 或域名） */
  host: string
  /** RTSP 端口（默认 554） */
  port?: number
  /** 用户名 */
  username: string
  /** 密码 */
  password: string
  /** ONVIF 返回的原始 URI（可选） */
  onvifUri?: string
  /** 🎯 ONVIF 服务端口（可选，用于真正的 ONVIF 协议调用） */
  onvifPort?: number
  /** 🎯 搜索模式：true=自动发现（遍历多端口），false=用户手动指定端口（仅用指定端口） */
  scanMode?: boolean
}

/**
 * RTSP 解析结果
 */
export interface RtspResolveResult {
  /** 主码流 RTSP 地址 */
  uri: string
  /** 来源："onvif" | "template" | "fallback" */
  source: string
  /** 是否有效（通过探针验证） */
  valid: boolean
  /** 所有码流地址（主码流+子码流，逗号分隔） */
  media_urls: string
}

/**
 * 🎯 核心函数：解析 RTSP 地址
 *
 * 使用三层智能探测策略：
 * 1. 尝试 ONVIF 返回的 URI（如果提供）
 * 2. 根据品牌匹配 RTSP 模板
 * 3. 通过 TCP + OPTIONS 探针验证地址有效性
 *
 * @param request - 解析请求参数
 * @returns 解析成功的 RTSP 地址信息
 *
 * @example
 * ```typescript
 * const result = await resolveRtsp({
 *   manufacturer: 'Hikvision',
 *   host: '192.168.1.100',
 *   port: 554,
 *   username: 'admin',
 *   password: 'Admin@123',
 *   onvifUri: 'rtsp://localhost:554/Streaming/Channels/101'
 * })
 *
 * console.log('RTSP 地址:', result.uri)
 * console.log('来源:', result.source)  // "onvif" 或 "template"
 * console.log('有效:', result.valid)   // true
 * ```
 */
export async function resolveRtsp(request: RtspResolveRequest): Promise<RtspResolveResult> {
  try {
    console.log('[RTSP解析] 开始解析...', {
      manufacturer: request.manufacturer,
      host: request.host,
      port: request.port || 554,
      hasOnvifUri: !!request.onvifUri
    })

    const result = await invoke<RtspResolveResult>('resolve_rtsp', {
      req: {
        manufacturer: request.manufacturer,
        host: request.host,
        port: request.port || 554,
        username: request.username,
        password: request.password,
        onvif_uri: request.onvifUri,
        onvif_port: request.onvifPort,
        scan_mode: request.scanMode || false
      }
    })

    console.log('[RTSP解析] ✅ 解析成功', {
      uri: result.uri,
      source: result.source,
      valid: result.valid
    })

    return result
  } catch (error) {
    console.error('[RTSP解析] ❌ 解析失败:', error)
    throw error
  }
}

/**
 * 便捷函数：从网络摄像机配置解析 RTSP 地址
 *
 * @param cameraConfig - 摄像机配置对象
 * @returns 解析成功的 RTSP 地址
 */
export async function resolveCameraRtsp(cameraConfig: {
  brand?: string
  protocol?: string
  ip: string
  port?: number
  username: string
  password: string
  onvifUrl?: string
  streamUrl?: string
  onvifPort?: number
  scanMode?: boolean
}): Promise<string> {
  // 如果已经有有效的 RTSP 地址，直接返回
  if (cameraConfig.streamUrl && cameraConfig.streamUrl.startsWith('rtsp://')) {
    console.log('[RTSP解析] 已有 RTSP 地址，直接使用')
    return cameraConfig.streamUrl
  }

  // 构建解析请求
  const request: RtspResolveRequest = {
    manufacturer: cameraConfig.brand || 'generic',
    host: cameraConfig.ip,
    port: cameraConfig.port || 554,
    username: cameraConfig.username,
    password: cameraConfig.password,
    // 如果协议是 ONVIF，将 onvifUrl 作为提示传入
    onvifUri: cameraConfig.protocol === 'onvif' ? cameraConfig.onvifUrl : undefined,
    onvifPort: cameraConfig.onvifPort,
    scanMode: cameraConfig.scanMode ?? false
  }

  try {
    const result = await resolveRtsp(request)
    return result.uri
  } catch (error) {
    console.warn('[RTSP解析] ONVIF/模板解析失败，使用常见回退路径尝试直接构造 RTSP 地址', error)

    const creds = request.username && request.password ? `${encodeURIComponent(request.username)}:${encodeURIComponent(request.password)}@` : ''
    const hostPort = `${request.host}:${request.port || 554}`
    const candidates = [
      `rtsp://${creds}${hostPort}/live/av0`,
      `rtsp://${creds}${hostPort}/live.sdp`,
      `rtsp://${creds}${hostPort}/Streaming/Channels/101`,
      `rtsp://${creds}${hostPort}/Streaming/Channels/101/preview`,
      `rtsp://${creds}${hostPort}/h264`,
      `rtsp://${creds}${hostPort}/ch0_0.264`
    ]

    console.info('[RTSP解析] 回退候选:', candidates)
    // 返回第一个候选，调用方若需可自行验证
    return candidates[0]
  }
}

/**
 * 测试函数：演示完整的 RTSP 解析流程
 */
export async function testRtspResolution() {
  console.log('=== RTSP 地址解析测试 ===\n')

  // 测试用例 1: ONVIF 返回 localhost 地址
  console.log('测试 1: ONVIF 返回 localhost 地址')
  try {
    const result1 = await resolveRtsp({
      manufacturer: 'Hikvision',
      host: '192.168.1.100',
      port: 554,
      username: 'admin',
      password: 'Admin@123',
      onvifUri: 'rtsp://localhost:554/Streaming/Channels/101'
    })
    console.log('✅ 结果:', result1)
  } catch (error) {
    console.log('❌ 失败:', error)
  }

  console.log('\n---\n')

  // 测试用例 2: 纯品牌模板匹配
  console.log('测试 2: 大华摄像机（无 ONVIF URI）')
  try {
    const result2 = await resolveRtsp({
      manufacturer: 'Dahua',
      host: '192.168.1.101',
      port: 554,
      username: 'admin',
      password: 'admin'
    })
    console.log('✅ 结果:', result2)
  } catch (error) {
    console.log('❌ 失败:', error)
  }

  console.log('\n---\n')

  // 测试用例 3: 未知品牌（使用通用模板）
  console.log('测试 3: 未知品牌摄像机')
  try {
    const result3 = await resolveRtsp({
      manufacturer: 'Unknown Brand',
      host: '192.168.1.102',
      port: 554,
      username: 'admin',
      password: '12345'
    })
    console.log('✅ 结果:', result3)
  } catch (error) {
    console.log('❌ 失败:', error)
  }
}
