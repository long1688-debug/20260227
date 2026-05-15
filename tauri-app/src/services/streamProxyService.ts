// RTSP 流代理和 ONVIF 云台控制服务
import { invoke } from '@tauri-apps/api/core'

// ==================== 类型定义 ====================

export interface StreamMeta {
  id: string
  rtsp: string
  flv_url: string
  status: string
}

export interface PtzConfig {
  deviceUrl: string
  username: string
  password: string
}

// ==================== RTSP 流代理 ====================

/**
 * 添加 RTSP 流代理（通过 ZLMediaKit）
 * @param streamId 流 ID
 * @param rtspUrl RTSP 地址
 * @returns 流元信息
 */
export async function addRtspProxy(
  streamId: string,
  rtspUrl: string
): Promise<StreamMeta> {
  try {
    console.log(`[RTSP代理] 添加流代理: ${streamId} -> ${rtspUrl}`)

    const result = await invoke<StreamMeta>('add_rtsp_proxy', {
      streamId,
      rtspUrl
    })

    console.log(`[RTSP代理] 流代理添加成功: ${result.flv_url}`)
    return result
  } catch (error) {
    console.error('[RTSP代理] 添加流代理失败:', error)
    throw error
  }
}

/**
 * 移除 RTSP 流代理
 * @param streamId 流 ID
 * @returns 是否成功
 */
export async function removeRtspProxy(streamId: string): Promise<boolean> {
  try {
    console.log(`[RTSP代理] 移除流代理: ${streamId}`)

    const result = await invoke<boolean>('remove_rtsp_proxy', {
      streamId
    })

    console.log(`[RTSP代理] 流代理已移除: ${streamId}`)
    return result
  } catch (error) {
    console.error('[RTSP代理] 移除流代理失败:', error)
    throw error
  }
}

/**
 * 停止流代理（通用接口）
 * @param streamId 流 ID
 * @returns 是否成功
 */
export async function stopStreamProxy(streamId: string): Promise<boolean> {
  try {
    console.log(`[流代理] 停止流: ${streamId}`)

    const result = await invoke<boolean>('stop_stream_proxy', {
      streamId
    })

    console.log(`[流代理] 流已停止: ${streamId}`)
    return result
  } catch (error) {
    console.error('[流代理] 停止流失败:', error)
    throw error
  }
}

/**
 * 获取所有活跃流
 * @returns 活跃流列表
 */
export async function getActiveStreams(): Promise<StreamMeta[]> {
  try {
    const streams = await invoke<StreamMeta[]>('get_active_streams')
    console.log(`[RTSP代理] 获取活跃流: ${streams.length} 个`)
    return streams
  } catch (error) {
    console.error('[RTSP代理] 获取活跃流失败:', error)
    throw error
  }
}

/**
 * 检查流状态
 * @param streamId 流 ID
 * @returns 流元信息
 */
export async function checkStreamStatus(streamId: string): Promise<StreamMeta> {
  try {
    const stream = await invoke<StreamMeta>('check_stream_status', {
      streamId
    })
    console.log(`[RTSP代理] 流状态: ${streamId} -> ${stream.status}`)
    return stream
  } catch (error) {
    console.error('[RTSP代理] 检查流状态失败:', error)
    throw error
  }
}

// ==================== ONVIF 云台控制 ====================

/**
 * PTZ 连续移动
 * @param config ONVIF 设备配置
 * @param action 动作 (up/down/left/right/stop)
 * @param speed 速度 (0.0-1.0)
 * @returns 结果消息
 */
export async function onvifPtz(
  config: PtzConfig,
  action: string,
  speed: number = 0.5
): Promise<string> {
  try {
    console.log(`[PTZ控制] ${action} (速度: ${speed})`)

    const result = await invoke<string>('onvif_ptz', {
      deviceUrl: config.deviceUrl,
      username: config.username,
      password: config.password,
      action,
      speed
    })

    console.log(`[PTZ控制] 指令已下发: ${result}`)
    return result
  } catch (error) {
    console.error('[PTZ控制] 执行失败:', error)
    throw error
  }
}

/**
 * 停止 PTZ 移动
 * @param config ONVIF 设备配置
 * @returns 结果消息
 */
export async function onvifPtzStop(config: PtzConfig): Promise<string> {
  try {
    console.log('[PTZ控制] 停止移动')

    const result = await invoke<string>('onvif_ptz_stop', {
      deviceUrl: config.deviceUrl,
      username: config.username,
      password: config.password
    })

    console.log(`[PTZ控制] 已停止: ${result}`)
    return result
  } catch (error) {
    console.error('[PTZ控制] 停止失败:', error)
    throw error
  }
}

/**
 * 获取 PTZ 预设位
 * @param config ONVIF 设备配置
 * @returns 预设位列表
 */
export async function onvifGetPresets(config: PtzConfig): Promise<string[]> {
  try {
    console.log('[PTZ控制] 获取预设位')

    const presets = await invoke<string[]>('onvif_get_presets', {
      deviceUrl: config.deviceUrl,
      username: config.username,
      password: config.password
    })

    console.log(`[PTZ控制] 获取到 ${presets.length} 个预设位`)
    return presets
  } catch (error) {
    console.error('[PTZ控制] 获取预设位失败:', error)
    throw error
  }
}

/**
 * 跳转到 PTZ 预设位
 * @param config ONVIF 设备配置
 * @param presetToken 预设位令牌
 * @returns 结果消息
 */
export async function onvifGotoPreset(
  config: PtzConfig,
  presetToken: string
): Promise<string> {
  try {
    console.log(`[PTZ控制] 跳转到预设位: ${presetToken}`)

    const result = await invoke<string>('onvif_goto_preset', {
      deviceUrl: config.deviceUrl,
      username: config.username,
      password: config.password,
      presetToken
    })

    console.log(`[PTZ控制] 已跳转: ${result}`)
    return result
  } catch (error) {
    console.error('[PTZ控制] 跳转预设位失败:', error)
    throw error
  }
}

// ==================== 辅助函数 ====================

/**
 * 键盘控制 PTZ
 * @param config ONVIF 设备配置
 * @param key 按键
 * @param speed 速度
 */
export async function handlePtzKeyPress(
  config: PtzConfig,
  key: string,
  speed: number = 0.5
): Promise<void> {
  const keyMap: Record<string, string> = {
    'ArrowUp': 'up',
    'ArrowDown': 'down',
    'ArrowLeft': 'left',
    'ArrowRight': 'right',
    'w': 'up',
    's': 'down',
    'a': 'left',
    'd': 'right',
    'q': 'zoom_out',
    'e': 'zoom_in'
  }

  const action = keyMap[key]
  if (action) {
    await onvifPtz(config, action, speed)
  }
}

/**
 * 鼠标按下持续控制 PTZ
 * @param config ONVIF 设备配置
 * @param action 动作
 * @param speed 速度
 * @returns 清理函数
 */
export function startPtzContinuousControl(
  config: PtzConfig,
  action: string,
  speed: number = 0.5
): () => Promise<void> {
  let intervalId: number | null = null

  // 开始持续发送 PTZ 指令
  const sendCommand = async () => {
    try {
      await onvifPtz(config, action, speed)
    } catch (error) {
      console.error('[PTZ控制] 持续控制失败:', error)
    }
  }

  // 立即发送一次
  sendCommand()

  // 每 100ms 发送一次
  intervalId = window.setInterval(sendCommand, 100)

  // 返回停止函数
  return async () => {
    if (intervalId !== null) {
      window.clearInterval(intervalId)
      intervalId = null
      // 发送停止指令
      await onvifPtzStop(config)
    }
  }
}
