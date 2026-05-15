/**
 * RTSP Proxy API - Node.js RTSP 代理服务前端接口
 */

import { invoke } from '@tauri-apps/api/core'

/**
 * 启动 RTSP 代理服务
 */
export async function startRtspProxy() {
  return await invoke('start_rtsp_proxy')
}

/**
 * 停止 RTSP 代理服务
 */
export async function stopRtspProxy() {
  return await invoke('stop_rtsp_proxy')
}

/**
 * 检查 RTSP 代理服务状态
 */
export async function checkRtspProxyStatus() {
  return await invoke('check_rtsp_proxy_status')
}

/**
 * 启动 RTSP 流代理
 * @param {string} rtspUrl - RTSP 流地址
 * @param {string} [streamId] - 可选的流 ID
 * @returns {Promise<{success: boolean, streamId: string, flvUrl: string, wsUrl: string}>}
 */
export async function startRtspStream(rtspUrl, streamId) {
  return await invoke('start_rtsp_stream', { rtspUrl, streamId })
}

/**
 * 停止 RTSP 流代理
 * @param {string} streamId - 流 ID
 */
export async function stopRtspStream(streamId) {
  return await invoke('stop_rtsp_stream', { streamId })
}

/**
 * 获取所有活跃的 RTSP 流
 * @returns {Promise<Array>}
 */
export async function getRtspStreams() {
  return await invoke('get_rtsp_streams')
}

/**
 * 通过 ONVIF GetStreamUri 解析真实 RTSP 流地址
 * @param {string} ip - 摄像机 IP
 * @param {number} port - ONVIF 端口（默认 80）
 * @param {string} [username] - 认证用户名
 * @param {string} [password] - 认证密码
 * @returns {Promise<{uri: string, protocol: string, timeout: string}>}
 */
export async function getOnvifStreamUri(ip, port, username, password) {
  return await invoke('get_onvif_stream_uri', { ip, port, username, password })
}

/**
 * 确保 RTSP 代理服务已启动
 */
export async function ensureRtspProxyRunning() {
  const status = await checkRtspProxyStatus()
  if (!status.running) {
    console.log('[RTSP Proxy] 服务未运行，正在启动...')
    await startRtspProxy()
    console.log('[RTSP Proxy] 服务已启动')
  }
  return status
}
