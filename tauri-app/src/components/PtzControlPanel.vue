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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'

const selectedDevice = ref('')
const devices = ref([])
const discoveredDevices = ref([])
const scanning = ref(false)
const registering = ref(false)
const zoomLevel = ref(3.0)
const isBusy = ref(false)
const statusMessage = ref('')
const isError = ref(false)

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
    // 这里应该弹出对话框获取用户名密码，简化起见使用默认值
    const deviceId = await invoke('ptz_register_device', {
      ip: dev.ip,
      username: 'admin',
      password: 'admin',
      name: dev.name
    })
    
    showStatus(`设备注册成功: ${deviceId}`, false)
    await loadDevices()
    discoveredDevices.value = discoveredDevices.value.filter(d => d.ip !== dev.ip)
  } catch (err) {
    showStatus('注册失败: ' + err, true)
  } finally {
    registering.value = false
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
function onDeviceChange() {
  showStatus(`已切换到设备: ${selectedDevice.value}`, false)
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
</style>
