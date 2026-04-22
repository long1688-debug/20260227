<template>
  <div class="media-codec-panel">
    <h2>多路音视频编解码控制面板</h2>

    <!-- 硬件加速状态 -->
    <div class="hardware-status">
      <h3>🖥️ 硬件加速能力</h3>
      <div v-if="hardwareCaps" class="caps-grid">
        <div class="cap-item" :class="{ active: hardwareCaps.has_nvidia }">
          <span>NVIDIA NVENC</span>
          <span class="status">{{ hardwareCaps.has_nvidia ? '✅' : '❌' }}</span>
        </div>
        <div class="cap-item" :class="{ active: hardwareCaps.has_intel_qsv }">
          <span>Intel QSV</span>
          <span class="status">{{ hardwareCaps.has_intel_qsv ? '✅' : '❌' }}</span>
        </div>
        <div class="cap-item" :class="{ active: hardwareCaps.has_amd_amf }">
          <span>AMD AMF</span>
          <span class="status">{{ hardwareCaps.has_amd_amf ? '✅' : '❌' }}</span>
        </div>
        <div class="cap-item recommended">
          <span>推荐编码器</span>
          <span class="value">{{ hardwareCaps.recommended_encoder }}</span>
        </div>
        <div v-if="hardwareCaps.gpu_memory_mb" class="cap-item">
          <span>GPU 显存</span>
          <span class="value">{{ hardwareCaps.gpu_memory_mb }} MB</span>
        </div>
      </div>
      <button @click="detectHardware" :disabled="detecting">
        {{ detecting ? '检测中...' : '重新检测' }}
      </button>
    </div>

    <!-- 录制配置 -->
    <div class="recording-config">
      <h3>⚙️ 录制配置</h3>
      
      <div class="config-section">
        <h4>视频流配置</h4>
        <div v-for="(stream, index) in videoStreams" :key="index" class="stream-config">
          <div class="stream-header">
            <span>流 {{ index + 1 }}</span>
            <button @click="removeVideoStream(index)" class="btn-remove">×</button>
          </div>
          <div class="form-group">
            <label>源类型:</label>
            <select v-model="stream.source_type">
              <option value="camera">摄像头</option>
              <option value="screen">屏幕捕获</option>
              <option value="rtsp">RTSP 流</option>
              <option value="file">视频文件</option>
            </select>
          </div>
          <div class="form-group">
            <label>源路径:</label>
            <input 
              v-model="stream.source_path" 
              placeholder="设备名或URL"
            />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>分辨率:</label>
              <select v-model="stream.resolution">
                <option value="1920x1080">1920×1080</option>
                <option value="1280x720">1280×720</option>
                <option value="640x480">640×480</option>
              </select>
            </div>
            <div class="form-group">
              <label>帧率:</label>
              <input 
                type="number" 
                v-model.number="stream.framerate"
                min="15"
                max="60"
              />
            </div>
          </div>
          <div class="form-group">
            <label>硬件加速:</label>
            <select v-model="stream.hardware_accel">
              <option value="None">无 (CPU)</option>
              <option value="NVENC">NVIDIA NVENC</option>
              <option value="QSV">Intel QSV</option>
              <option value="AMF">AMD AMF</option>
            </select>
          </div>
        </div>
        <button @click="addVideoStream" class="btn-add">+ 添加视频流</button>
      </div>

      <div class="config-section">
        <h4>输出设置</h4>
        <div class="form-group">
          <label>输出目录:</label>
          <div class="input-with-button">
            <input v-model="outputDir" placeholder="选择输出目录" />
            <button @click="selectOutputDir">浏览...</button>
          </div>
        </div>
        <div class="form-group">
          <label>录制模式:</label>
          <select v-model="recordingMode">
            <option value="multi">多路独立录制</option>
            <option value="pip">画中画混流</option>
            <option value="grid">网格布局混流</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 控制按钮 -->
    <div class="control-buttons">
      <button 
        @click="startRecording" 
        :disabled="isRecording || !canStart"
        class="btn-primary"
      >
        ▶️ 开始录制
      </button>
      <button 
        @click="pauseRecording" 
        :disabled="!isRecording || isPaused"
      >
        ⏸️ 暂停
      </button>
      <button 
        @click="resumeRecording" 
        :disabled="!isPaused"
      >
        ▶️ 恢复
      </button>
      <button 
        @click="stopRecording" 
        :disabled="!isRecording"
        class="btn-danger"
      >
        ⏹️ 停止
      </button>
    </div>

    <!-- 活动会话列表 -->
    <div class="active-sessions" v-if="activeSessions.length > 0">
      <h3>📹 活动会话 ({{ activeSessions.length }})</h3>
      <div v-for="session in activeSessions" :key="session.session_id" class="session-card">
        <div class="session-header">
          <span class="session-id">{{ session.session_id }}</span>
          <span class="session-status" :class="session.status">
            {{ getStatusText(session.status) }}
          </span>
        </div>
        <div class="session-info">
          <p>类型: {{ session.session_type }}</p>
          <p>视频流数: {{ session.video_streams.length }}</p>
          <p>音频流数: {{ session.audio_streams.length }}</p>
          <p>时长: {{ formatDuration(session.duration) }}</p>
          <p>输出: {{ session.output_path }}</p>
        </div>
        <div class="session-actions">
          <button @click="stopSession(session.session_id)" class="btn-small btn-danger">
            停止
          </button>
        </div>
      </div>
    </div>

    <!-- 性能监控面板 -->
    <div class="performance-monitor" v-if="performanceStats">
      <h3>📊 性能监控</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <label>当前 FPS</label>
          <div class="stat-value">{{ performanceStats.fps_current.toFixed(1) }}</div>
        </div>
        <div class="stat-item">
          <label>平均 FPS</label>
          <div class="stat-value">{{ performanceStats.fps_average.toFixed(1) }}</div>
        </div>
        <div class="stat-item">
          <label>CPU 使用率</label>
          <div class="stat-value" :class="{ warning: performanceStats.cpu_usage_percent > 80 }">
            {{ performanceStats.cpu_usage_percent.toFixed(1) }}%
          </div>
        </div>
        <div class="stat-item" v-if="performanceStats.gpu_usage_percent !== undefined">
          <label>GPU 使用率</label>
          <div class="stat-value">{{ performanceStats.gpu_usage_percent.toFixed(1) }}%</div>
        </div>
        <div class="stat-item">
          <label>实际码率</label>
          <div class="stat-value">{{ performanceStats.bitrate_actual }} kbps</div>
        </div>
        <div class="stat-item">
          <label>丢帧数</label>
          <div class="stat-value" :class="{ error: performanceStats.dropped_frames > 100 }">
            {{ performanceStats.dropped_frames }}
          </div>
        </div>
        <div class="stat-item">
          <label>缓冲区健康</label>
          <div class="stat-value">
            <div class="health-bar">
              <div 
                class="health-fill" 
                :style="{ width: (performanceStats.buffer_health * 100) + '%' }"
                :class="{ 
                  low: performanceStats.buffer_health < 0.3,
                  medium: performanceStats.buffer_health >= 0.3 && performanceStats.buffer_health < 0.7
                }"
              ></div>
            </div>
            <span>{{ (performanceStats.buffer_health * 100).toFixed(0) }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="errorMessage" class="error-message">
      <strong>❌ 错误:</strong> {{ errorMessage }}
      <button @click="errorMessage = ''" class="btn-close">×</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { 
  detectHardwareAcceleration,
  startMultiRecord,
  startMixRecording,
  stopCodecSession,
  pauseCodecSession,
  resumeCodecSession,
  getActiveCodecSessions,
  getCodecPerformance,
  onPerformanceUpdate,
  createDefaultVideoConfig,
  createPipLayout,
  createGridLayout
} from '@/services/mediaCodecService'
import { open } from '@tauri-apps/plugin-dialog'

// 状态
const hardwareCaps = ref(null)
const detecting = ref(false)
const videoStreams = ref([])
const outputDir = ref('C:/Recordings')
const recordingMode = ref('multi')
const isRecording = ref(false)
const isPaused = ref(false)
const currentSessionId = ref(null)
const activeSessions = ref([])
const performanceStats = ref(null)
const errorMessage = ref('')
const performanceUnlisten = ref(null)

// 计算属性
const canStart = computed(() => {
  return videoStreams.value.length > 0 && outputDir.value
})

// 方法
async function detectHardware() {
  detecting.value = true
  errorMessage.value = ''
  
  try {
    hardwareCaps.value = await detectHardwareAcceleration()
    console.log('硬件加速能力:', hardwareCaps.value)
  } catch (error) {
    errorMessage.value = `检测失败: ${error}`
    console.error(error)
  } finally {
    detecting.value = false
  }
}

function addVideoStream() {
  const stream = createDefaultVideoConfig(
    `stream_${videoStreams.value.length}`,
    'camera',
    'Integrated Camera'
  )
  
  // 如果已检测到硬件加速，自动设置
  if (hardwareCaps.value) {
    const accelMap = {
      'h264_nvenc': 'NVENC',
      'h264_qsv': 'QSV',
      'h264_amf': 'AMF',
      'h264_videotoolbox': 'VideoToolbox'
    }
    stream.hardware_accel = accelMap[hardwareCaps.value.recommended_encoder] || 'None'
  }
  
  videoStreams.value.push(stream)
}

function removeVideoStream(index) {
  videoStreams.value.splice(index, 1)
}

async function selectOutputDir() {
  try {
    const selected = await open({
      directory: true,
      multiple: false,
      title: '选择录制输出目录'
    })
    
    if (selected) {
      outputDir.value = selected
    }
  } catch (error) {
    errorMessage.value = `选择目录失败: ${error}`
  }
}

async function startRecording() {
  errorMessage.value = ''
  
  try {
    const sessionId = `session_${Date.now()}`
    
    if (recordingMode.value === 'multi') {
      // 多路独立录制
      currentSessionId.value = await startMultiRecord(
        sessionId,
        videoStreams.value,
        [], // 暂不配置音频
        outputDir.value
      )
    } else if (recordingMode.value === 'pip' && videoStreams.value.length >= 2) {
      // 画中画录制
      const layout = createPipLayout(
        videoStreams.value[0].stream_id,
        videoStreams.value[1].stream_id
      )
      
      currentSessionId.value = await startMixRecording(
        sessionId,
        videoStreams.value,
        [],
        layout,
        `${outputDir.value}/pip_output.mp4`
      )
    } else if (recordingMode.value === 'grid' && videoStreams.value.length >= 2) {
      // 网格录制
      const streamIds = videoStreams.value.map(s => s.stream_id)
      const layout = createGridLayout(streamIds)
      
      currentSessionId.value = await startMixRecording(
        sessionId,
        videoStreams.value,
        [],
        layout,
        `${outputDir.value}/grid_output.mp4`
      )
    } else {
      throw new Error('配置不完整或流数量不足')
    }
    
    isRecording.value = true
    isPaused.value = false
    
    console.log('录制已启动:', currentSessionId.value)
    
    // 刷新会话列表
    await refreshSessions()
    
  } catch (error) {
    errorMessage.value = `启动录制失败: ${error}`
    console.error(error)
  }
}

async function pauseRecording() {
  if (!currentSessionId.value) return
  
  try {
    await pauseCodecSession(currentSessionId.value)
    isPaused.value = true
    console.log('录制已暂停')
  } catch (error) {
    errorMessage.value = `暂停失败: ${error}`
  }
}

async function resumeRecording() {
  if (!currentSessionId.value) return
  
  try {
    await resumeCodecSession(currentSessionId.value)
    isPaused.value = false
    console.log('录制已恢复')
  } catch (error) {
    errorMessage.value = `恢复失败: ${error}`
  }
}

async function stopRecording() {
  if (!currentSessionId.value) return
  
  try {
    await stopCodecSession(currentSessionId.value)
    isRecording.value = false
    isPaused.value = false
    currentSessionId.value = null
    console.log('录制已停止')
    
    await refreshSessions()
    
  } catch (error) {
    errorMessage.value = `停止失败: ${error}`
  }
}

async function stopSession(sessionId) {
  try {
    await stopCodecSession(sessionId)
    await refreshSessions()
  } catch (error) {
    errorMessage.value = `停止会话失败: ${error}`
  }
}

async function refreshSessions() {
  try {
    activeSessions.value = await getActiveCodecSessions()
  } catch (error) {
    console.error('获取会话列表失败:', error)
  }
}

function getStatusText(status) {
  const map = {
    'recording': '🔴 录制中',
    'paused': '⏸️ 已暂停',
    'stopped': '⏹️ 已停止',
    'error': '❌ 错误'
  }
  return map[status] || status
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

async function updatePerformanceStats(sessionId) {
  try {
    performanceStats.value = await getCodecPerformance(sessionId)
  } catch (error) {
    console.error('获取性能统计失败:', error)
  }
}

// 生命周期
onMounted(async () => {
  // 初始检测硬件
  await detectHardware()
  
  // 添加默认视频流
  addVideoStream()
  
  // 监听性能更新事件
  performanceUnlisten.value = await onPerformanceUpdate((stats) => {
    performanceStats.value = stats
    
    // 检查告警条件
    if (stats.fps_current < 20) {
      console.warn('⚠️ 帧率过低:', stats.fps_current)
    }
    if (stats.cpu_usage_percent > 80) {
      console.warn('⚠️ CPU 使用率过高:', stats.cpu_usage_percent)
    }
    if (stats.dropped_frames > 100) {
      console.error('❌ 严重丢帧:', stats.dropped_frames)
    }
  })
  
  // 定期刷新会话列表
  const interval = setInterval(refreshSessions, 5000)
  
  // 清理
  onUnmounted(() => {
    if (performanceUnlisten.value) {
      performanceUnlisten.value()
    }
    clearInterval(interval)
  })
})
</script>

<style scoped>
.media-codec-panel {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

h2 {
  color: #333;
  border-bottom: 2px solid #4CC9F0;
  padding-bottom: 10px;
}

h3 {
  color: #555;
  margin-top: 20px;
}

/* 硬件加速状态 */
.hardware-status {
  background: #f5f5f5;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.caps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
  margin-bottom: 15px;
}

.cap-item {
  background: white;
  padding: 10px;
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 2px solid transparent;
}

.cap-item.active {
  border-color: #4CAF50;
  background: #e8f5e9;
}

.cap-item.recommended {
  border-color: #2196F3;
  background: #e3f2fd;
}

.status, .value {
  font-weight: bold;
}

/* 配置区域 */
.recording-config {
  background: white;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.config-section {
  margin-bottom: 20px;
}

.stream-config {
  background: #f9f9f9;
  padding: 15px;
  border-radius: 6px;
  margin-bottom: 10px;
  border: 1px solid #ddd;
}

.stream-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-weight: bold;
}

.btn-remove {
  background: #f44336;
  color: white;
  border: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 16px;
}

.form-group {
  margin-bottom: 10px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-size: 14px;
  color: #666;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.input-with-button {
  display: flex;
  gap: 10px;
}

.input-with-button input {
  flex: 1;
}

.btn-add {
  background: #4CAF50;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-add:hover {
  background: #45a049;
}

/* 控制按钮 */
.control-buttons {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.control-buttons button {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.3s;
}

.control-buttons button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #2196F3;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #1976D2;
}

.btn-danger {
  background: #f44336;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #d32f2f;
}

/* 会话卡片 */
.active-sessions {
  margin-bottom: 20px;
}

.session-card {
  background: white;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 10px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.session-id {
  font-family: monospace;
  font-size: 12px;
  color: #666;
}

.session-status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.session-status.recording {
  background: #ffebee;
  color: #c62828;
}

.session-status.paused {
  background: #fff3e0;
  color: #ef6c00;
}

.session-status.stopped {
  background: #e8f5e9;
  color: #2e7d32;
}

.session-info p {
  margin: 5px 0;
  font-size: 14px;
  color: #666;
}

.session-actions {
  margin-top: 10px;
  text-align: right;
}

.btn-small {
  padding: 6px 12px;
  font-size: 12px;
}

/* 性能监控 */
.performance-monitor {
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
}

.stat-item {
  text-align: center;
  padding: 10px;
  background: #f5f5f5;
  border-radius: 6px;
}

.stat-item label {
  display: block;
  font-size: 12px;
  color: #666;
  margin-bottom: 5px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

.stat-value.warning {
  color: #ff9800;
}

.stat-value.error {
  color: #f44336;
}

.health-bar {
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 5px;
}

.health-fill {
  height: 100%;
  background: #4CAF50;
  transition: width 0.3s, background 0.3s;
}

.health-fill.low {
  background: #f44336;
}

.health-fill.medium {
  background: #ff9800;
}

/* 错误提示 */
.error-message {
  background: #ffebee;
  color: #c62828;
  padding: 15px;
  border-radius: 6px;
  margin-top: 20px;
  position: relative;
}

.btn-close {
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #c62828;
}
</style>
