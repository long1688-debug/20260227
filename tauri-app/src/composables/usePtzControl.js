import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'

/**
 * PTZ 云台控制 Composable
 * 提供统一的摄像机控制接口
 */
export function usePtzControl() {
  const selectedDevice = ref('')
  const devices = ref([])
  const discoveredDevices = ref([])
  const isBusy = ref(false)
  const zoomLevel = ref(3.0)
  const statusMessage = ref('')
  const isError = ref(false)

  /**
   * 加载已注册设备列表
   */
  async function loadDevices() {
    try {
      devices.value = await invoke('ptz_list_devices')
      if (devices.value.length > 0 && !selectedDevice.value) {
        selectedDevice.value = devices.value[0]
      }
      return devices.value
    } catch (err) {
      showStatus('加载设备列表失败: ' + err, true)
      throw err
    }
  }

  /**
   * 扫描局域网 ONVIF 设备
   * @param {number} timeout - 超时时间（秒）
   */
  async function discoverDevices(timeout = 3) {
    try {
      const found = await invoke('onvif_discover_devices', { timeoutSecs: timeout })
      discoveredDevices.value = found
      showStatus(`发现 ${found.length} 个设备`, false)
      return found
    } catch (err) {
      showStatus('扫描失败: ' + err, true)
      throw err
    }
  }

  /**
   * 注册发现的设备
   * @param {Object} device - 设备信息
   * @param {string} username - 用户名
   * @param {string} password - 密码
   */
  async function registerDevice(device, username = 'admin', password = 'admin') {
    try {
      const deviceId = await invoke('ptz_register_device', {
        ip: device.ip,
        username,
        password,
        name: device.name
      })
      
      showStatus(`设备注册成功: ${deviceId}`, false)
      await loadDevices()
      
      // 从发现列表中移除
      discoveredDevices.value = discoveredDevices.value.filter(d => d.ip !== device.ip)
      
      return deviceId
    } catch (err) {
      showStatus('注册失败: ' + err, true)
      throw err
    }
  }

  /**
   * 绝对位置移动（点击画面控制）
   * @param {number} clickX - X坐标 [0, 1]
   * @param {number} clickY - Y坐标 [0, 1]
   * @param {number} zoom - 变焦倍数 [1, 10]
   * @param {number} hfov - 水平视场角（度）
   * @param {number} vfov - 垂直视场角（度）
   */
  async function moveAbsolute(clickX, clickY, zoom = null, hfov = 120, vfov = 90) {
    if (!selectedDevice.value || isBusy.value) {
      throw new Error('设备未选择或正在忙碌')
    }

    isBusy.value = true
    try {
      await invoke('ptz_move_absolute', {
        deviceId: selectedDevice.value,
        clickX,
        clickY,
        zoom: zoom || zoomLevel.value,
        hfov,
        vfov
      })
      showStatus('云台已响应', false)
    } catch (err) {
      showStatus('控制失败: ' + err, true)
      throw err
    } finally {
      setTimeout(() => {
        isBusy.value = false
      }, 600) // 硬件防抖
    }
  }

  /**
   * 连续移动
   * @param {number} pan - 水平方向 [-1, 1]
   * @param {number} tilt - 垂直方向 [-1, 1]
   * @param {number} zoom - 变焦 [-1, 1]
   */
  async function continuousMove(pan, tilt, zoom = 0) {
    if (!selectedDevice.value) {
      throw new Error('设备未选择')
    }

    try {
      await invoke('ptz_continuous_move', {
        deviceId: selectedDevice.value,
        pan,
        tilt,
        zoom
      })
    } catch (err) {
      showStatus('移动失败: ' + err, true)
      throw err
    }
  }

  /**
   * 停止移动
   */
  async function stop() {
    if (!selectedDevice.value) return

    try {
      await invoke('ptz_stop', {
        deviceId: selectedDevice.value
      })
    } catch (err) {
      console.error('停止失败:', err)
    }
  }

  /**
   * 相对移动
   * @param {number} pan - 水平位移 [-1, 1]
   * @param {number} tilt - 垂直位移 [-1, 1]
   * @param {number} zoom - 变焦 [-1, 1]
   */
  async function relativeMove(pan, tilt, zoom = 0) {
    if (!selectedDevice.value) {
      throw new Error('设备未选择')
    }

    try {
      await invoke('ptz_relative_move', {
        deviceId: selectedDevice.value,
        pan,
        tilt,
        zoom
      })
      showStatus('移动完成', false)
    } catch (err) {
      showStatus('移动失败: ' + err, true)
      throw err
    }
  }

  /**
   * 跳转到预置位
   * @param {string} presetToken - 预置位标识
   */
  async function gotoPreset(presetToken) {
    if (!selectedDevice.value) {
      throw new Error('设备未选择')
    }

    try {
      await invoke('ptz_goto_preset', {
        deviceId: selectedDevice.value,
        presetToken
      })
      showStatus(`已切换到预置位 ${presetToken}`, false)
    } catch (err) {
      showStatus('预置位切换失败: ' + err, true)
      throw err
    }
  }

  /**
   * 设置当前设备
   */
  function setDevice(deviceId) {
    selectedDevice.value = deviceId
    showStatus(`已切换到设备: ${deviceId}`, false)
  }

  /**
   * 设置变焦级别
   */
  function setZoom(zoom) {
    zoomLevel.value = Math.max(1, Math.min(10, zoom))
  }

  /**
   * 显示状态消息
   */
  function showStatus(msg, error = false) {
    statusMessage.value = msg
    isError.value = error
    if (!error) {
      setTimeout(() => {
        statusMessage.value = ''
      }, 3000)
    }
  }

  /**
   * 清除状态消息
   */
  function clearStatus() {
    statusMessage.value = ''
    isError.value = false
  }

  return {
    // 状态
    selectedDevice,
    devices,
    discoveredDevices,
    isBusy,
    zoomLevel,
    statusMessage,
    isError,

    // 方法
    loadDevices,
    discoverDevices,
    registerDevice,
    moveAbsolute,
    continuousMove,
    stop,
    relativeMove,
    gotoPreset,
    setDevice,
    setZoom,
    showStatus,
    clearStatus
  }
}
