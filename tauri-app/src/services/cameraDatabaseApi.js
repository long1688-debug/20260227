/**
 * 网络摄像机数据库 API
 *
 * 提供持久化存储网络摄像机配置的功能
 */

import { invoke } from '@tauri-apps/api/core'

/**
 * 初始化摄像机数据库（应用启动时自动调用）
 */
export async function initCameraDatabase() {
  try {
    await invoke('init_camera_database')
    console.log('[CameraDB] ✅ 数据库初始化成功')
  } catch (error) {
    console.error('[CameraDB] ❌ 数据库初始化失败:', error)
    throw error
  }
}

/**
 * 保存摄像机配置
 */
export async function saveCameraConfig(camera) {
  try {
    await invoke('save_camera_config', { camera })
    console.log('[CameraDB] ✅ 保存成功:', camera.name)
  } catch (error) {
    console.error('[CameraDB] ❌ 保存失败:', error)
    throw error
  }
}

/**
 * 获取所有摄像机配置
 */
export async function getAllCameras() {
  try {
    const cameras = await invoke('get_all_cameras')
    console.log('[CameraDB] 📋 获取到', cameras.length, '个摄像机')
    return cameras
  } catch (error) {
    console.error('[CameraDB] ❌ 获取列表失败:', error)
    throw error
  }
}

/**
 * 根据ID获取摄像机配置
 */
export async function getCameraById(id) {
  try {
    const camera = await invoke('get_camera_by_id', { id })
    return camera
  } catch (error) {
    console.error('[CameraDB] ❌ 获取详情失败:', error)
    throw error
  }
}

/**
 * 删除摄像机配置
 */
export async function deleteCameraConfig(id) {
  try {
    const rowsAffected = await invoke('delete_camera_config', { id })
    console.log('[CameraDB] 🗑️ 删除成功，影响行数:', rowsAffected)
    return rowsAffected
  } catch (error) {
    console.error('[CameraDB] ❌ 删除失败:', error)
    throw error
  }
}

/**
 * 更新摄像机状态
 */
export async function updateCameraStatus(id, status) {
  try {
    await invoke('update_camera_status', { id, status })
    console.log('[CameraDB] 🔄 状态更新:', id, '->', status)
  } catch (error) {
    console.error('[CameraDB] ❌ 状态更新失败:', error)
    throw error
  }
}

/**
 * 获取在线摄像机数量
 */
export async function getOnlineCameraCount() {
  try {
    const count = await invoke('get_online_camera_count')
    return count
  } catch (error) {
    console.error('[CameraDB] ❌ 获取在线数量失败:', error)
    throw error
  }
}

/**
 * 获取离线摄像机数量
 */
export async function getOfflineCameraCount() {
  try {
    const count = await invoke('get_offline_camera_count')
    return count
  } catch (error) {
    console.error('[CameraDB] ❌ 获取离线数量失败:', error)
    throw error
  }
}

/**
 * 批量保存摄像机配置
 */
export async function batchSaveCameras(cameras) {
  try {
    for (const camera of cameras) {
      await saveCameraConfig(camera)
    }
    console.log('[CameraDB] ✅ 批量保存成功:', cameras.length, '个摄像机')
  } catch (error) {
    console.error('[CameraDB] ❌ 批量保存失败:', error)
    throw error
  }
}

/**
 * 根据协议筛选摄像机
 */
export async function getCamerasByProtocol(protocol) {
  const allCameras = await getAllCameras()
  return allCameras.filter(camera => camera.protocol === protocol)
}

/**
 * 获取在线摄像机列表
 */
export async function getOnlineCameras() {
  const allCameras = await getAllCameras()
  return allCameras.filter(camera => camera.status === 'online')
}

/**
 * 获取离线摄像机列表
 */
export async function getOfflineCameras() {
  const allCameras = await getAllCameras()
  return allCameras.filter(camera => camera.status === 'offline')
}

/**
 * 启动摄像机状态监控服务
 * @param {number} checkIntervalSecs - 检查间隔（秒），默认30秒
 */
export async function startCameraStatusMonitor(checkIntervalSecs = 30) {
  try {
    await invoke('start_camera_status_monitor', {
      checkIntervalSecs
    })
    console.log('[CameraDB] 🚀 状态监控服务已启动，间隔:', checkIntervalSecs, '秒')
  } catch (error) {
    console.error('[CameraDB] ❌ 启动监控服务失败:', error)
    throw error
  }
}
