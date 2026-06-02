/**
 * ZLMediaKit 流媒体服务前端接口
 */

import { invoke } from '@tauri-apps/api/core'

/**
 * 启动 ZLMediaKit 流媒体服务
 */
export async function startZLMediaKit() {
  return await invoke('start_zlmediakit')
}

/**
 * 停止 ZLMediaKit 流媒体服务
 */
export async function stopZLMediaKit() {
  return await invoke('stop_zlmediakit')
}

/**
 * 检查 ZLMediaKit 流媒体服务状态
 */
export async function checkZLMediaKitStatus() {
  return await invoke('check_zlmediakit_status')
}

/**
 * 启动 RTSP 流代理（通过 ZLMediaKit addStreamProxy）
 * @param {string} rtspUrl - RTSP 流地址
 * @param {string} [streamId] - 可选的流 ID
 * @returns {Promise<{success: boolean, streamId: string, flvUrl: string, wsUrl: string, rtspUrl: string, hlsUrl: string, webrtcUrl: string, backend: string, playMode: string}>}
 */
export async function startRtspStreamProxy(rtspUrl, streamId) {
  return await invoke('start_rtsp_stream_proxy', { rtspUrl: rtspUrl, streamId: streamId })
}

/**
 * 停止 RTSP 流代理（通过 ZLMediaKit delStreamProxy）
 * @param {string} streamId - 流 ID
 */
export async function stopRtspStreamProxy(streamId) {
  return await invoke('stop_rtsp_stream_proxy', { stream_id: streamId })
}

/**
 * 获取所有活跃的 RTSP 流（通过 ZLMediaKit getMediaList）
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
 * 确保 ZLMediaKit 流媒体服务已启动
 */
export async function ensureZLMediaKitRunning() {
  const status = await checkZLMediaKitStatus()
  if (!status.running) {
    console.log('[ZLMediaKit] 服务未运行，正在启动...')
    await startZLMediaKit()
    // 等待服务启动
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('[ZLMediaKit] 服务已启动')
  }
  return status
}
