<template>
  <div class="ptz-panel">
    <!-- 设备选择区域 -->
    <div class="panel-section device-selector">
      <div class="section-header">
        <span class="section-title">📹 设备管理</span>
        <el-button
          size="small"
          type="primary"
          :loading="scanning"
          @click="handleDiscover"
        >
          {{ scanning ? '扫描中...' : '扫描设备' }}
        </el-button>
      </div>

      <el-select
        v-model="selectedDevice"
        placeholder="选择摄像机"
        size="small"
        style="width: 100%; margin-top: 8px"
        @change="onDeviceChange"
      >
        <el-option
          v-for="dev in devices"
          :key="dev"
          :label="dev"
          :value="dev"
        />
      </el-select>

      <!-- 发现的设备列表 -->
      <div v-if="discoveredDevices.length > 0" class="discovered-list">
        <div class="list-header">发现 {{ discoveredDevices.length }} 个设备</div>
        <div
          v-for="dev in discoveredDevices"
          :key="dev.ip"
          class="discovered-item"
        >
          <div class="device-info">
            <div class="device-name">{{ dev.name }}</div>
            <div class="device-ip">{{ dev.ip }}</div>
          </div>
          <el-button
            size="small"
            type="success"
            :loading="registering"
            @click="handleRegister(dev)"
          >
            注册
          </el-button>
        </div>
      </div>
    </div>

    <!-- 方向控制面板 -->
    <div class="panel-section direction-control" v-if="selectedDevice">
      <div class="section-header">
        <span class="section-title">🎮 方向控制</span>
      </div>

      <div class="direction-grid">
        <button
          class="dir-btn"
          @mousedown="startMove('up_left')"
          @mouseup="stopMove"
          @mouseleave="stopMove"
          title="左上"
        >
          ↖
        </button>
        <button
          class="dir-btn"
          @mousedown="startMove('up')"
          @mouseup="stopMove"
          @mouseleave="stopMove"
          title="上"
        >
          ↑
        </button>
        <button
          class="dir-btn"
          @mousedown="startMove('up_right')"
          @mouseup="stopMove"
          @mouseleave="stopMove"
          title="右上"
        >
          ↗
        </button>

        <button
          class="dir-btn"
          @mousedown="startMove('left')"
          @mouseup="stopMove"
          @mouseleave="stopMove"
          title="左"
        >
          ←
        </button>
        <button
          class="dir-btn stop-btn"
          @click="stopAll"
          title="停止"
        >
          ⏹
        </button>
        <button
          class="dir-btn"
          @mousedown="startMove('right')"
          @mouseup="stopMove"
          @mouseleave="stopMove"
          title="右"
        >
          →
        </button>

        <button
          class="dir-btn"
          @mousedown="startMove('down_left')"
          @mouseup="stopMove"
          @mouseleave="stopMove"
          title="左下"
        >
          ↙
        </button>
        <button
          class="dir-btn"
          @mousedown="startMove('down')"
          @mouseup="stopMove"
          @mouseleave="stopMove"
          title="下"
        >
          ↓
        </button>
        <button
          class="dir-btn"
          @mousedown="startMove('down_right')"
          @mouseup="stopMove"
          @mouseleave="stopMove"
          title="右下"
        >
          ↘
        </button>
      </div>
    </div>

    <!-- 变焦控制 -->
    <div class="panel-section zoom-control" v-if="selectedDevice">
      <div class="section-header">
        <span class="section-title">🔍 变焦控制</span>
        <span class="zoom-value">{{ zoomLevel.toFixed(1) }}x</span>
      </div>

      <el-slider
        v-model="zoomLevel"
        :min="1"
        :max="10"
        :step="0.5"
        @input="onZoomChange"
      />
    </div>

    <!-- 预置位控制 -->
    <div class="panel-section preset-control" v-if="selectedDevice">
      <div class="section-header">
        <span class="section-title">📍 预置位</span>
      </div>

      <div class="preset-buttons">
        <el-button
          v-for="i in 5"
          :key="i"
          size="small"
          @click="gotoPreset(i.toString())"
        >
          位置 {{ i }}
        </el-button>
      </div>
    </div>

    <!-- 微调控制 -->
    <div class="panel-section fine-tune" v-if="selectedDevice">
      <div class="section-header">
        <span class="section-title">🎛️ 微调</span>
      </div>

      <div class="tune-buttons">
        <el-button size="small" @click="relativeMove(0.1, 0, 0)">右移</el-button>
        <el-button size="small" @click="relativeMove(-0.1, 0, 0)">左移</el-button>
        <el-button size="small" @click="relativeMove(0, -0.1, 0)">上移</el-button>
        <el-button size="small" @click="relativeMove(0, 0.1, 0)">下移</el-button>
        <el-button size="small" @click="relativeMove(0, 0, 0.1)">放大</el-button>
        <el-button size="small" @click="relativeMove(0, 0, -0.1)">缩小</el-button>
      </div>
    </div>

    <!-- 状态提示 -->
    <el-alert
      v-if="statusMessage"
      :title="statusMessage"
      :type="isError ? 'error' : 'success'"
      :closable="false"
      show-icon
      style="margin-top: 10px"
    />
  </div>

  <!-- 设备注册对话框 -->
  <el-dialog
    title="设备注册"
    v-model="showRegisterDialog"
    width="400px"
    :close-on-click-modal="false"
  >
    <div class="register-form">
      <div class="form-item">
        <label>设备名称</label>
        <el-input
          v-model="registerForm.deviceName"
          disabled
          placeholder="设备名称"
        />
      </div>
      <div class="form-item">
        <label>设备IP</label>
        <el-input
          v-model="registerForm.deviceIp"
          disabled
          placeholder="设备IP"
        />
      </div>
      <div class="form-item">
        <label>用户名</label>
        <el-input
          v-model="registerForm.username"
          placeholder="请输入用户名"
        />
      </div>
      <div class="form-item">
        <label>密码</label>
        <el-input
          type="password"
          v-model="registerForm.password"
          placeholder="请输入密码"
        />
      </div>
    </div>
    <template #footer>
      <el-button @click="showRegisterDialog = false">取消</el-button>
      <el-button
        type="primary"
        :loading="registering"
        @click="confirmRegister"
      >
        注册
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { usePtzControl } from '@/composables/usePtzControl'
import { ElMessage } from 'element-plus'

const {
  selectedDevice,
  devices,
  discoveredDevices,
  zoomLevel,
  statusMessage,
  isError,
  loadDevices,
  discoverDevices,
  registerDevice,
  continuousMove,
  stop,
  gotoPreset,
  relativeMove,
  showStatus
} = usePtzControl()

const scanning = ref(false)
const registering = ref(false)

// 注册对话框状态
const showRegisterDialog = ref(false)
const currentRegisterDevice = ref(null)
const registerForm = ref({
  deviceName: '',
  deviceIp: '',
  username: '',
  password: ''
})

// 加载设备列表
async function handleLoadDevices() {
  try {
    await loadDevices()
  } catch (err) {
    ElMessage.error('加载设备失败: ' + err)
  }
}

// 扫描设备
async function handleDiscover() {
  scanning.value = true
  try {
    const found = await discoverDevices(3)
    if (found.length === 0) {
      ElMessage.info('未发现设备，请检查网络连接')
    }
  } catch (err) {
    ElMessage.error('扫描失败: ' + err)
  } finally {
    scanning.value = false
  }
}

// 注册设备 - 打开对话框
async function handleRegister(dev) {
  // 保存当前设备信息
  currentRegisterDevice.value = dev
  registerForm.value = {
    deviceName: dev.name || '',
    deviceIp: dev.ip || '',
    username: '',
    password: ''
  }
  // 打开对话框
  showRegisterDialog.value = true
}

// 确认注册
async function confirmRegister() {
  const { username, password } = registerForm.value

  if (!username.trim()) {
    ElMessage.warning('请输入用户名')
    return
  }
  if (!password) {
    ElMessage.warning('请输入密码')
    return
  }

  registering.value = true
  try {
    const deviceId = await registerDevice(currentRegisterDevice.value, username, password)
    ElMessage.success(`设备注册成功: ${deviceId}`)
    showRegisterDialog.value = false
  } catch (err) {
    ElMessage.error('注册失败: ' + err)
  } finally {
    registering.value = false
  }
}

// 开始连续移动
async function startMove(direction) {
  if (!selectedDevice.value) {
    ElMessage.warning('请先选择设备')
    return
  }

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
    await continuousMove(pan, tilt, zoom)
  } catch (err) {
    ElMessage.error('移动失败: ' + err)
  }
}

// 停止移动
async function stopMove() {
  if (!selectedDevice.value) return

  try {
    await stop()
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
  // 变焦通过相对移动实现
  // 这里可以添加更精细的控制逻辑
}

// 设备变更
function onDeviceChange() {
  showStatus(`已切换到: ${selectedDevice.value}`, false)
}

// 组件挂载时加载设备
onMounted(() => {
  handleLoadDevices()
})
</script>

<style lang="scss" scoped>
.ptz-panel {
  height: 100%;
  padding: 12px;
  overflow-y: auto;
  background: #0F2035;
}

.panel-section {
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #FFFFFF;
}

.zoom-value {
  font-size: 12px;
  color: #00BFFF;
  font-family: monospace;
}

// 设备选择区域
.device-selector {
  .discovered-list {
    margin-top: 10px;
    max-height: 150px;
    overflow-y: auto;
  }

  .list-header {
    font-size: 11px;
    color: #888;
    margin-bottom: 6px;
  }

  .discovered-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px;
    margin-bottom: 4px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.12);
    }

    .device-info {
      flex: 1;
      min-width: 0;
    }

    .device-name {
      font-size: 12px;
      color: #FFFFFF;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .device-ip {
      font-size: 10px;
      color: #888;
      font-family: monospace;
    }
  }
}

// 方向控制网格
.direction-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  max-width: 200px;
  margin: 0 auto;
}

.dir-btn {
  width: 50px;
  height: 50px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
  color: #FFFFFF;
  font-size: 20px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
  }

  &:active {
    background: rgba(0, 191, 255, 0.3);
    transform: scale(0.95);
  }

  &.stop-btn {
    background: rgba(255, 68, 68, 0.2);
    border-color: rgba(255, 68, 68, 0.4);

    &:hover {
      background: rgba(255, 68, 68, 0.3);
    }

    &:active {
      background: rgba(255, 68, 68, 0.5);
    }
  }
}

// 预置位按钮
.preset-buttons {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

// 微调按钮
.tune-buttons {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

// 滚动条样式
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
}
</style>
