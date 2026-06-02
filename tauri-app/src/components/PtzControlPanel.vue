<template>
  <div class="ptz-control-panel">
    <h3>云台摄像机控制</h3>

    <!-- 设备选择 -->
    <div class="device-selector">
      <label>选择设备：</label>
      <select v-model="selectedDevice" @change="onDeviceChange">
        <option value="">-- 请选择 --</option>
        <option v-for="dev in devices" :key="dev" :value="dev">
          {{ dev }}
        </option>
      </select>
      <button @click="discoverDevices" :disabled="scanning">
        {{ scanning ? '扫描中...' : '扫描局域网设备' }}
      </button>
    </div>

    <!-- 发现的设备列表 -->
    <div v-if="discoveredDevices.length > 0" class="discovered-list">
      <h4>发现的设备：</h4>
      <ul>
        <li v-for="dev in discoveredDevices" :key="dev.ip">
          <span>{{ dev.name }} ({{ dev.ip }})</span>
          <button @click="registerDevice(dev)" :disabled="registering">
            注册
          </button>
        </li>
      </ul>
    </div>

    <!-- 视频画面点击控制 -->
    <div class="video-container" v-if="selectedDevice">
      <video
        ref="ptzVideo"
        @click="handleVideoClick"
        style="width: 100%; cursor: crosshair; border: 2px solid #333"
      ></video>
      <div class="click-hint">点击画面控制云台移动</div>
    </div>

    <!-- 方向控制面板 -->
    <div class="direction-controls" v-if="selectedDevice">
      <div class="control-row">
        <button @mousedown="startMove('up_left')" @mouseup="stopMove" @mouseleave="stopMove">
          ↖
        </button>
        <button @mousedown="startMove('up')" @mouseup="stopMove" @mouseleave="stopMove">
          ↑
        </button>
        <button @mousedown="startMove('up_right')" @mouseup="stopMove" @mouseleave="stopMove">
          ↗
        </button>
      </div>
      <div class="control-row">
        <button @mousedown="startMove('left')" @mouseup="stopMove" @mouseleave="stopMove">
          ←
        </button>
        <button class="stop-btn" @click="stopAll">
          ⏹
        </button>
        <button @mousedown="startMove('right')" @mouseup="stopMove" @mouseleave="stopMove">
          →
        </button>
      </div>
      <div class="control-row">
        <button @mousedown="startMove('down_left')" @mouseup="stopMove" @mouseleave="stopMove">
          ↙
        </button>
        <button @mousedown="startMove('down')" @mouseup="stopMove" @mouseleave="stopMove">
          ↓
        </button>
        <button @mousedown="startMove('down_right')" @mouseup="stopMove" @mouseleave="stopMove">
          ↘
        </button>
      </div>
    </div>

    <!-- 变焦控制 -->
    <div class="zoom-controls" v-if="selectedDevice">
      <label>变焦：</label>
      <input
        type="range"
        v-model="zoomLevel"
        min="1"
        max="10"
        step="0.5"
        @input="onZoomChange"
      />
      <span>{{ zoomLevel }}x</span>
    </div>

    <!-- 预置位控制 -->
    <div class="preset-controls" v-if="selectedDevice">
      <h4>预置位：</h4>
      <div class="preset-buttons">
        <button v-for="i in 5" :key="i" @click="gotoPreset(i.toString())">
          预置位 {{ i }}
        </button>
      </div>
    </div>

    <!-- 相对移动微调 -->
    <div class="fine-tune" v-if="selectedDevice">
      <h4>微调：</h4>
      <div class="tune-buttons">
        <button @click="relativeMove(0.1, 0, 0)">右移</button>
        <button @click="relativeMove(-0.1, 0, 0)">左移</button>
        <button @click="relativeMove(0, -0.1, 0)">上移</button>
        <button @click="relativeMove(0, 0.1, 0)">下移</button>
        <button @click="relativeMove(0, 0, 0.1)">放大</button>
        <button @click="relativeMove(0, 0, -0.1)">缩小</button>
      </div>
    </div>

    <!-- 状态信息 -->
    <div class="status-info" v-if="statusMessage">
      <p :class="{ error: isError }">{{ statusMessage }}</p>
    </div>

    <!-- 手动输入RTSP地址 -->
    <div class="manual-rtsp-input" v-if="selectedDevice">
      <h4>手动设置RTSP地址:</h4>
      <div class="input-group">
        <input
          type="text"
          v-model="manualRtspUrl"
          placeholder="例如: rtsp://192.168.1.100:554/stream1"
          class="rtsp-url-input"
        />
        <button @click="setManualRtspUrl" class="set-rtsp-btn">设置</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import flvjs from 'flv.js'

const selectedDevice = ref('')
const devices = ref([])
const discoveredDevices = ref([])
const scanning = ref(false)
const registering = ref(false)
const zoomLevel = ref(3.0)
const isBusy = ref(false)
const statusMessage = ref('')
const isError = ref(false)
const ptzVideo = ref(null)
let videoStream = null
let flvPlayer = null
let currentStreamId = null
const manualRtspUrl = ref('')

// 加载已注册设备列表
async function loadDevices() {
  try {
    devices.value = await invoke('ptz_list_devices')
    if (devices.value.length > 0) {
      selectedDevice.value = devices.value[0]
    }
  } catch (err) {
    showStatus('加载设备列表失败: ' + err, true)
  }
}

// 扫描局域网设备
async function discoverDevices() {
  scanning.value = true
  showStatus('正在扫描...', false)

  try {
    const found = await invoke('onvif_discover_devices', { timeoutSecs: 3 })
    discoveredDevices.value = found
    showStatus(`发现 ${found.length} 个设备`, false)
  } catch (err) {
    showStatus('扫描失败: ' + err, true)
  } finally {
    scanning.value = false
  }
}

// 注册设备
async function registerDevice(dev) {
  registering.value = true
  showStatus('正在注册设备...', false)

  try {
    // 使用新的统一注册命令，同时获取RTSP地址
    const result = await invoke('register_onvif_device_with_rtsp', {
      deviceName: dev.name,
      ip: dev.ip,
      port: 80,
      username: 'admin',
      password: 'admin',
      profileToken: 'profile_1'
    })

    if (result.registered) {
      showStatus(`设备注册成功: ${result.device_id}${result.rtsp_url ? ' 并获取了RTSP地址' : ' 但未能获取RTSP地址'}`, false)
      await loadDevices()
      discoveredDevices.value = discoveredDevices.value.filter(d => d.ip !== dev.ip)

      // 如果注册成功，自动选择该设备
      selectedDevice.value = result.device_id

      // 如果获取到了RTSP地址，尝试播放视频流
      if (result.rtsp_url) {
        await playVideoStream(result.device_id)
      }
    } else {
      showStatus('设备注册失败', true)
    }
  } catch (err) {
    showStatus('注册失败: ' + err, true)
  } finally {
    registering.value = false
  }
}

// 获取设备的RTSP流地址
async function getRtspStreamUrl(deviceId) {
  try {
    // 首先尝试获取已设置的RTSP URL
    try {
      const savedRtspUrl = await invoke('get_device_rtsp_url', {
        device_id: deviceId
      })
      return savedRtspUrl
    } catch (savedErr) {
      // 如果没有预设的RTSP URL，尝试通过ONVIF获取
      console.log('未找到预设的RTSP地址，尝试通过ONVIF获取')
    }

    // 通过ONVIF协议获取RTSP流地址
    const streamUri = await invoke('get_onvif_stream_uri', {
      device_id: deviceId
    })

    return streamUri.uri
  } catch (err) {
    console.warn(`通过ONVIF获取RTSP地址失败: ${err}`)
    showStatus('无法通过ONVIF获取RTSP地址，需要手动输入', true)
    return null
  }
}

// 播放视频流
async function playVideoStream(deviceId) {
  if (!ptzVideo.value) return

  // 停止当前流
  await stopVideoStream()

  // 尝试获取RTSP流地址
  const rtspUrl = await getRtspStreamUrl(deviceId)
  if (!rtspUrl) {
    showStatus('无法获取视频流地址，请手动配置', true)
    return
  }

  try {
    const streamResponse = await invoke('start_rtsp_stream_proxy', {
      rtspUrl: rtspUrl,
      streamId: selectedDevice.value
    })

    currentStreamId = streamResponse.streamId || selectedDevice.value
    const flvUrl = streamResponse.flvUrl || streamResponse.streamUrl

    if (!flvUrl) {
      throw new Error('未获取到可播放的流地址')
    }

    if (flvjs.isSupported()) {
      if (flvPlayer) {
        try {
          flvPlayer.destroy()
        } catch (destroyError) {
          console.warn('销毁旧FLV播放器失败:', destroyError)
        }
        flvPlayer = null
      }

      flvPlayer = flvjs.createPlayer({
        type: 'flv',
        url: flvUrl,
        isLive: true,
        hasAudio: true,
        hasVideo: true,
        enableStashBuffer: true,
        stashInitialSize: 128
      })
      flvPlayer.attachMediaElement(ptzVideo.value)
      flvPlayer.load()
      await ptzVideo.value.play()
    } else {
      ptzVideo.value.src = flvUrl
      await ptzVideo.value.play()
    }
  } catch (err) {
    console.error('启动RTSP流失败:', err)
    showStatus('启动视频流失败: ' + err.message, true)
  }
}

// 停止视频流
async function stopVideoStream() {
  if (flvPlayer) {
    try {
      flvPlayer.destroy()
    } catch (destroyError) {
      console.warn('销毁FLV播放器失败:', destroyError)
    }
    flvPlayer = null
  }

  if (ptzVideo.value) {
    ptzVideo.value.pause()
    ptzVideo.value.src = ''
  }

  if (currentStreamId) {
    try {
      await invoke('stop_rtsp_stream_proxy', { stream_id: currentStreamId })
    } catch (err) {
      console.warn('停止RTSP代理失败:', err)
    }
    currentStreamId = null
  }

  if (videoStream) {
    try {
      videoStream.close()
    } catch (closeError) {
      console.warn('关闭旧流失败:', closeError)
    }
    videoStream = null
  }
}

// 手动设置RTSP地址
async function setManualRtspUrl() {
  if (!selectedDevice.value) {
    showStatus('请先选择设备', true)
    return
  }

  if (!manualRtspUrl.value.trim()) {
    showStatus('请输入RTSP地址', true)
    return
  }

  try {
    await invoke('set_device_rtsp_url', {
      device_id: selectedDevice.value,
      rtsp_url: manualRtspUrl.value.trim()
    })

    showStatus('RTSP地址设置成功，正在刷新视频流...', false)

    // 刷新视频流
    await playVideoStream(selectedDevice.value)
  } catch (err) {
    showStatus('设置RTSP地址失败: ' + err.message, true)
  }
}

// 视频画面点击处理
async function handleVideoClick(e) {
  if (!selectedDevice.value || isBusy.value) return

  isBusy.value = true
  const rect = e.target.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  const y = (e.clientY - rect.top) / rect.height

  try {
    await invoke('ptz_move_absolute', {
      deviceId: selectedDevice.value,
      clickX: x,
      clickY: y,
      zoom: zoomLevel.value,
      hfov: 120.0,
      vfov: 90.0
    })
    showStatus('云台已响应', false)
  } catch (err) {
    showStatus('控制失败: ' + err, true)
  } finally {
    setTimeout(() => {
      isBusy.value = false
    }, 600) // 硬件防抖
  }
}

// 开始连续移动
async function startMove(direction) {
  if (!selectedDevice.value) return

  const moves = {
    up: [0, 0.5, 0],
    down: [0, -0.5, 0],
    left: [-0.5, 0, 0],
    right: [0.5, 0, 0],
    up_left: [-0.5, 0.5, 0],
    up_right: [0.5, 0.5, 0],
    down_left: [-0.5, -0.5, 0],
    down_right: [0.5, -0.5, 0]
  }

  const [pan, tilt, zoom] = moves[direction] || [0, 0, 0]

  try {
    await invoke('ptz_continuous_move', {
      deviceId: selectedDevice.value,
      pan,
      tilt,
      zoom
    })
  } catch (err) {
    showStatus('移动失败: ' + err, true)
  }
}

// 停止移动
async function stopMove() {
  if (!selectedDevice.value) return

  try {
    await invoke('ptz_stop', {
      deviceId: selectedDevice.value
    })
  } catch (err) {
    console.error('停止失败:', err)
  }
}

// 完全停止
async function stopAll() {
  await stopMove()
  showStatus('云台已停止', false)
}

// 变焦控制
async function onZoomChange() {
  if (!selectedDevice.value) return

  try {
    await invoke('ptz_relative_move', {
      deviceId: selectedDevice.value,
      pan: 0,
      tilt: 0,
      zoom: 0
    })
  } catch (err) {
    console.error('变焦失败:', err)
  }
}

// 预置位调用
async function gotoPreset(token) {
  if (!selectedDevice.value) return

  try {
    await invoke('ptz_goto_preset', {
      deviceId: selectedDevice.value,
      presetToken: token
    })
    showStatus(`已切换到预置位 ${token}`, false)
  } catch (err) {
    showStatus('预置位切换失败: ' + err, true)
  }
}

// 相对移动
async function relativeMove(pan, tilt, zoom) {
  if (!selectedDevice.value) return

  try {
    await invoke('ptz_relative_move', {
      deviceId: selectedDevice.value,
      pan,
      tilt,
      zoom
    })
    showStatus('微调完成', false)
  } catch (err) {
    showStatus('微调失败: ' + err, true)
  }
}

// 设备变更
async function onDeviceChange() {
  showStatus(`已切换到设备: ${selectedDevice.value}`, false)

  // 切换设备时，自动播放对应设备的视频流
  if (selectedDevice.value) {
    await playVideoStream(selectedDevice.value)
  } else {
    stopVideoStream()
  }
}

// 显示状态消息
function showStatus(msg, error = false) {
  statusMessage.value = msg
  isError.value = error
  if (!error) {
    setTimeout(() => {
      statusMessage.value = ''
    }, 3000)
  }
}

// 组件挂载时加载设备
onMounted(() => {
  loadDevices()
})

// 组件卸载时清理资源
onUnmounted(() => {
  stopVideoStream()
})
</script>

<style scoped>
.ptz-control-panel {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.device-selector {
  margin-bottom: 20px;
  display: flex;
  gap: 10px;
  align-items: center;
}

.device-selector select {
  flex: 1;
  padding: 8px;
}

.discovered-list {
  margin: 15px 0;
  padding: 10px;
  background: #f5f5f5;
  border-radius: 4px;
}

.discovered-list ul {
  list-style: none;
  padding: 0;
}

.discovered-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  margin: 5px 0;
  background: white;
  border-radius: 4px;
}

.video-container {
  margin: 20px 0;
  position: relative;
}

.click-hint {
  text-align: center;
  color: #666;
  font-size: 12px;
  margin-top: 5px;
}

.direction-controls {
  margin: 20px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.control-row {
  display: flex;
  gap: 10px;
}

.control-row button {
  width: 60px;
  height: 60px;
  font-size: 24px;
  cursor: pointer;
  border: 2px solid #333;
  border-radius: 8px;
  background: #fff;
  transition: all 0.2s;
}

.control-row button:hover {
  background: #e0e0e0;
}

.control-row button:active {
  background: #ccc;
  transform: scale(0.95);
}

.stop-btn {
  background: #ff4444 !important;
  color: white;
  border-color: #cc0000 !important;
}

.stop-btn:hover {
  background: #cc0000 !important;
}

.zoom-controls {
  margin: 20px 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.zoom-controls input[type="range"] {
  flex: 1;
}

.preset-controls,
.fine-tune {
  margin: 20px 0;
}

.preset-buttons,
.tune-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
}

.preset-buttons button,
.tune-buttons button {
  padding: 10px 15px;
  border: 1px solid #333;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s;
}

.preset-buttons button:hover,
.tune-buttons button:hover {
  background: #e0e0e0;
}

.status-info {
  margin-top: 20px;
  padding: 10px;
  border-radius: 4px;
  background: #e8f5e9;
}

.status-info p {
  margin: 0;
  color: #2e7d32;
}

.status-info p.error {
  color: #c62828;
  background: #ffebee;
  padding: 10px;
  border-radius: 4px;
}

.manual-rtsp-input {
  margin-top: 20px;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #f9f9f9;
}

.manual-rtsp-input h4 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #333;
}

.input-group {
  display: flex;
  gap: 10px;
  align-items: center;
}

.rtsp-url-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
}

.rtsp-url-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.set-rtsp-btn {
  padding: 8px 16px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.set-rtsp-btn:hover {
  background: #218838;
}
</style>
