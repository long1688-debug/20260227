/**
 * 移动端连接管理服务
 * 用于管理手机/平板设备通过Web App的连接
 */

import { invoke } from '@tauri-apps/api/core'

export interface MobileConnectionInfo {
  connection_id: string
  stream_id: string
  device_type: string      // android / ios / unknown
  connected_at: number     // Unix timestamp
  last_heartbeat: number   // Unix timestamp
  status: string           // waiting / connected / disconnected
}

/**
 * 注册移动端连接
 * @param connectionId 连接ID
 * @param streamId 流ID
 * @param deviceType 设备类型（可选）
 * @returns 是否成功
 */
export async function registerMobileConnection(
  connectionId: string,
  streamId: string,
  deviceType?: string
): Promise<boolean> {
  try {
    console.log(`[移动端连接] 注册连接: ${connectionId}`, { streamId, deviceType })

    const result = await invoke<boolean>('register_mobile_connection', {
      connectionId,
      streamId,
      deviceType: deviceType || null
    })

    console.log(`[移动端连接] 注册成功: ${connectionId}`)
    return result
  } catch (error) {
    console.error('[移动端连接] 注册失败:', error)
    throw error
  }
}

/**
 * 发送心跳
 * @param connectionId 连接ID
 * @returns 是否成功
 */
export async function sendHeartbeat(connectionId: string): Promise<boolean> {
  try {
    const result = await invoke<boolean>('mobile_heartbeat', {
      connectionId
    })

    return result
  } catch (error) {
    console.error('[移动端连接] 心跳失败:', error)
    throw error
  }
}

/**
 * 断开移动端连接
 * @param connectionId 连接ID
 * @returns 是否成功
 */
export async function disconnectMobile(connectionId: string): Promise<boolean> {
  try {
    console.log(`[移动端连接] 断开连接: ${connectionId}`)

    const result = await invoke<boolean>('disconnect_mobile', {
      connectionId
    })

    console.log(`[移动端连接] 已断开: ${connectionId}`)
    return result
  } catch (error) {
    console.error('[移动端连接] 断开失败:', error)
    throw error
  }
}

/**
 * 获取所有移动端连接
 * @returns 连接列表
 */
export async function getMobileConnections(): Promise<MobileConnectionInfo[]> {
  try {
    const connections = await invoke<MobileConnectionInfo[]>('get_mobile_connections')
    return connections
  } catch (error) {
    console.error('[移动端连接] 获取连接列表失败:', error)
    throw error
  }
}

/**
 * 启动心跳定时器
 * @param connectionId 连接ID
 * @param interval 心跳间隔（毫秒），默认30秒
 * @returns 清除定时器的函数
 */
export function startHeartbeatTimer(
  connectionId: string,
  interval: number = 30000
): () => void {
  const timerId = setInterval(async () => {
    try {
      await sendHeartbeat(connectionId)
    } catch (error) {
      console.error(`[移动端连接] 心跳发送失败: ${connectionId}`, error)
      // 连续失败多次后可以考虑断开连接
    }
  }, interval)

  // 返回清除函数
  return () => {
    clearInterval(timerId)
    console.log(`[移动端连接] 心跳定时器已清除: ${connectionId}`)
  }
}

/**
 * 生成移动端连接二维码数据
 * @param serverUrl 服务器URL
 * @param streamId 流ID
 * @returns 二维码JSON字符串
 */
export function generateQRCodeData(serverUrl: string, streamId: string): string {
  const connectionInfo = {
    id: streamId,
    type: 'mobile_screen',
    timestamp: Date.now(),
    serverUrl: serverUrl
  }

  return JSON.stringify(connectionInfo)
}

/**
 * 获取本地服务器URL
 * @returns 服务器URL
 */
export async function getServerUrl(): Promise<string> {
  try {
    const localIp = await invoke<string>('get_local_ip')
    const port = 801 // ZLMediaKit HTTP端口，实际应该从配置读取

    if (localIp) {
      return `http://${localIp}:${port}`
    } else {
      return `http://localhost:${port}`
    }
  } catch (error) {
    console.error('[移动端连接] 获取服务器URL失败:', error)
    return 'http://localhost:801'
  }
}
