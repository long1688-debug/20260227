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
