/**
 * 采集设备管理服务
 * 提供采集卡、高拍仪等硬件设备的 API 封装
 */

import { invoke } from '@tauri-apps/api/core'

/**
 * 采集设备类型
 */
export const CaptureDeviceType = {
  CAPTURE_CARD: 'CaptureCard',
  DOCUMENT_SCANNER: 'DocumentScanner'
}

/**
 * 高拍仪扫描模式
 */
export const ScannerMode = {
  SINGLE: 'Single',
  CONTINUOUS: 'Continuous',
  AUTO_FOCUS: 'AutoFocus'
}

/**
 * 获取采集设备列表
 * @returns {Promise<Array>} 设备列表
 */
export async function listCaptureDevices() {
  try {
    const devices = await invoke('list_capture_devices')
    console.log('[采集设备] 获取设备列表:', devices)
    return devices
  } catch (error) {
    console.error('[采集设备] 获取设备列表失败:', error)
    throw error
  }
}

/**
 * 启动采集设备
 * @param {string} deviceId - 设备 ID
 * @returns {Promise<string>} 流 ID
 */
export async function startCaptureDevice(deviceId) {
  try {
    const streamId = await invoke('start_capture_device', { deviceId })
    console.log('[采集设备] 启动设备:', deviceId, '流ID:', streamId)
    return streamId
  } catch (error) {
    console.error('[采集设备] 启动设备失败:', error)
    throw error
  }
}

/**
 * 停止采集设备
 * @param {string} deviceId - 设备 ID
 * @returns {Promise<void>}
 */
export async function stopCaptureDevice(deviceId) {
  try {
    await invoke('stop_capture_device', { deviceId })
    console.log('[采集设备] 停止设备:', deviceId)
  } catch (error) {
    console.error('[采集设备] 停止设备失败:', error)
    throw error
  }
}

/**
 * 高拍仪拍照
 * @param {Object} config - 拍照配置
 * @param {string} config.deviceId - 设备 ID
 * @param {string} config.mode - 扫描模式 (Single/Continuous/AutoFocus)
 * @param {string} config.resolution - 分辨率
 * @param {boolean} config.enableEnhancement - 是否启用图像增强
 * @param {boolean} config.enableAutoCrop - 是否启用自动裁剪
 * @returns {Promise<string>} 图片文件路径
 */
export async function scannerTakePhoto(config) {
  try {
    const imagePath = await invoke('scanner_take_photo', {
      config: {
        deviceId: config.deviceId,
        mode: config.mode || ScannerMode.SINGLE,
        resolution: config.resolution || '1920x1080',
        enableEnhancement: config.enableEnhancement !== false,
        enableAutoCrop: config.enableAutoCrop !== false
      }
    })
    console.log('[高拍仪] 拍照完成:', imagePath)
    return imagePath
  } catch (error) {
    console.error('[高拍仪] 拍照失败:', error)
    throw error
  }
}

/**
 * 设置高拍仪配置
 * @param {Object} config - 配置对象
 * @returns {Promise<void>}
 */
export async function setScannerConfiguration(config) {
  try {
    await invoke('set_scanner_configuration', {
      config: {
        deviceId: config.deviceId,
        mode: config.mode || ScannerMode.SINGLE,
        resolution: config.resolution || '1920x1080',
        enableEnhancement: config.enableEnhancement !== false,
        enableAutoCrop: config.enableAutoCrop !== false
      }
    })
    console.log('[高拍仪] 配置更新成功')
  } catch (error) {
    console.error('[高拍仪] 配置更新失败:', error)
    throw error
  }
}

/**
 * 过滤采集卡设备
 * @param {Array} devices - 设备列表
 * @returns {Array} 采集卡设备列表
 */
export function filterCaptureCards(devices) {
  return devices.filter(device => device.device_type === CaptureDeviceType.CAPTURE_CARD)
}

/**
 * 过滤高拍仪设备
 * @param {Array} devices - 设备列表
 * @returns {Array} 高拍仪设备列表
 */
export function filterDocumentScanners(devices) {
  return devices.filter(device => device.device_type === CaptureDeviceType.DOCUMENT_SCANNER)
}

/**
 * 获取设备显示名称
 * @param {Object} device - 设备对象
 * @returns {string} 显示名称
 */
export function getDeviceDisplayName(device) {
  const typeIcon = device.device_type === CaptureDeviceType.CAPTURE_CARD ? '🎥' : '📷'
  const interfaceInfo = device.interface_type ? ` (${device.interface_type})` : ''
  const resolutionInfo = device.resolution ? ` - ${device.resolution}` : ''
  
  return `${typeIcon} ${device.name}${interfaceInfo}${resolutionInfo}`
}

/**
 * 🎯 网络摄像机配置管理服务
 * 提供在线摄像机的自动发现、注册和配置管理功能
 */

/**
 * 更新摄像机配置参数
 * @param {Object} config - 配置对象
 * @param {string} config.deviceId - 设备ID
 * @param {string} [config.name] - 新名称
 * @param {string} [config.username] - 新用户名
 * @param {string} [config.password] - 新密码
 * @param {string} [config.ip] - 新IP地址
 * @param {number} [config.port] - 新端口
 * @returns {Promise<string>} 操作结果消息
 */
export async function updateCameraConfig(config) {
  try {
    const result = await invoke('update_camera_config', {
      deviceId: config.deviceId,
      name: config.name || null,
      username: config.username || null,
      password: config.password || null,
      ip: config.ip || null,
      port: config.port || null
    })
    console.log('[摄像机配置] 更新成功:', result)
    return result
  } catch (error) {
    console.error('[摄像机配置] 更新失败:', error)
    throw error
  }
}

/**
 * 删除已注册的摄像机
 * @param {string} deviceId - 设备ID
 * @returns {Promise<string>} 操作结果消息
 */
export async function removeCameraDevice(deviceId) {
  try {
    const result = await invoke('remove_camera_device', { deviceId })
    console.log('[摄像机管理] 删除成功:', result)
    return result
  } catch (error) {
    console.error('[摄像机管理] 删除失败:', error)
    throw error
  }
}

/**
 * 获取摄像机详细信息
 * @param {string} deviceId - 设备ID
 * @returns {Promise<Object>} 设备详情
 */
export async function getCameraDetails(deviceId) {
  try {
    const details = await invoke('get_camera_details', { deviceId })
    console.log('[摄像机详情] 获取成功:', details)
    return details
  } catch (error) {
    console.error('[摄像机详情] 获取失败:', error)
    throw error
  }
}

/**
 * 列出所有已注册的PTZ设备
 * @returns {Promise<Array<string>>} 设备ID列表
 */
export async function listPtzDevices() {
  try {
    const devices = await invoke('ptz_list_devices')
    console.log('[PTZ设备] 列表:', devices)
    return devices
  } catch (error) {
    console.error('[PTZ设备] 获取列表失败:', error)
    throw error
  }
}

/**
 * 注册发现的ONVIF设备
 * @param {Object} device - 发现的设备信息
 * @param {string} device.ip - IP地址
 * @param {string} device.username - 用户名
 * @param {string} device.password - 密码
 * @param {string} [device.name] - 设备名称（可选）
 * @returns {Promise<string>} 注册后的设备ID
 */
export async function registerOnvifDevice(device) {
  try {
    const deviceId = await invoke('ptz_register_device', {
      ip: device.ip,
      username: device.username,
      password: device.password,
      name: device.name || null
    })
    console.log('[ONVIF设备] 注册成功:', deviceId)
    return deviceId
  } catch (error) {
    console.error('[ONVIF设备] 注册失败:', error)
    throw error
  }
}

// 🎯 GB/T 28181 国标协议发现
/**
 * 发现GB/T 28181国标协议摄像机
 * @param {number} timeoutSecs - 超时时间(秒)
 * @returns {Promise<Array>} 发现的设备列表
 */
export async function discoverGb28181Devices(timeoutSecs = 5) {
  try {
    const devices = await invoke('discover_gb28181_devices', { timeoutSecs })
    console.log('[GB28181发现] 共发现', devices.length, '个设备')
    return devices
  } catch (error) {
    console.error('[GB28181发现] 失败:', error)
    throw error
  }
}

// 🎯 厂商私有协议发现
/**
 * 发现厂商私有协议摄像机(海康SADP + 大华P2P)
 * @param {number} timeoutSecs - 超时时间(秒)
 * @returns {Promise<Array>} 发现的设备列表
 */
export async function discoverVendorCameras(timeoutSecs = 5) {
  try {
    const devices = await invoke('discover_vendor_cameras', { timeoutSecs })
    console.log('[厂商协议发现] 共发现', devices.length, '个设备')
    return devices
  } catch (error) {
    console.error('[厂商协议发现] 失败:', error)
    throw error
  }
}
