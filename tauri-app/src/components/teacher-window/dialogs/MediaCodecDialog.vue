<template>
  <el-dialog
    v-model="visible"
    title="多路音视频编解码"
    width="900px"
    top="3vh"
    :close-on-click-modal="false"
    class="media-codec-dialog-wrapper"
    @close="handleClose"
    :z-index="2000"
    append-to-body
  >
    <div class="media-codec-dialog">
      <!-- 硬件加速状态 -->
      <div class="section hardware-status">
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
        <el-button 
          type="primary" 
          size="small"
          @click="detectHardware" 
          :loading="detecting"
        >
          {{ detecting ? '检测中...' : '重新检测' }}
        </el-button>
      </div>

      <!-- 录制配置 -->
      <div class="section recording-config">
        <h3>⚙️ 录制配置</h3>
        
        <!-- 视频流列表 -->
        <div class="stream-list">
          <div v-for="(stream, index) in videoStreams" :key="index" class="stream-item">
            <div class="stream-header">
              <span class="stream-title">流 {{ index + 1 }}</span>
              <el-button 
                type="danger" 
                size="small" 
                text
                @click="removeVideoStream(index)"
              >
                删除
              </el-button>
            </div>
            
            <el-form label-width="100px" size="small">
              <el-form-item label="源类型:">
                <el-select v-model="stream.source_type" style="width: 100%">
                  <el-option label="摄像头" value="camera" />
                  <el-option label="屏幕捕获" value="screen" />
                  <el-option label="RTSP 流" value="rtsp" />
                  <el-option label="视频文件" value="file" />
                </el-select>
              </el-form-item>
              
              <el-form-item label="源路径:">
                <el-input 
                  v-model="stream.source_path" 
                  placeholder="设备名或URL"
                />
              </el-form-item>
              
              <el-row :gutter="10">
                <el-col :span="12">
                  <el-form-item label="分辨率:">
                    <el-select v-model="stream.resolution" style="width: 100%">
                      <el-option label="1920×1080" value="1920x1080" />
                      <el-option label="1280×720" value="1280x720" />
                      <el-option label="640×480" value="640x480" />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="帧率:">
                    <el-input-number 
                      v-model="stream.framerate"
                      :min="15"
                      :max="60"
                      style="width: 100%"
                    />
                  </el-form-item>
                </el-col>
              </el-row>
              
              <el-form-item label="硬件加速:">
                <el-select v-model="stream.hardware_accel" style="width: 100%">
                  <el-option label="无 (CPU)" value="None" />
                  <el-option label="NVIDIA NVENC" value="NVENC" />
                  <el-option label="Intel QSV" value="QSV" />
                  <el-option label="AMD AMF" value="AMF" />
                </el-select>
              </el-form-item>
            </el-form>
          </div>
          
          <el-button 
            type="success" 
            @click="addVideoStream"
            style="width: 100%; margin-top: 10px"
          >
            + 添加视频流
          </el-button>
        </div>

        <!-- 输出设置 -->
        <div class="output-settings">
          <el-form label-width="100px" size="small">
            <el-form-item label="输出目录:">
              <el-input v-model="outputDir" placeholder="选择输出目录" readonly>
                <template #append>
                  <el-button @click="selectOutputDir">浏览...</el-button>
                </template>
              </el-input>
            </el-form-item>
            
            <el-form-item label="录制模式:">
              <el-radio-group v-model="recordingMode">
                <el-radio value="multi">多路独立录制</el-radio>
                <el-radio value="pip">画中画混流</el-radio>
                <el-radio value="grid">网格布局混流</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-form>
        </div>
      </div>

      <!-- 控制按钮 -->
      <div class="control-buttons">
        <el-button 
          type="primary" 
          size="large"
          @click="startRecording" 
          :disabled="isRecording || !canStart"
          :loading="starting"
        >
          ▶️ 开始录制
        </el-button>
        <el-button 
          @click="pauseRecording" 
          :disabled="!isRecording || isPaused"
        >
          ⏸️ 暂停
        </el-button>
        <el-button 
          @click="resumeRecording" 
          :disabled="!isPaused"
        >
          ▶️ 恢复
        </el-button>
        <el-button 
          type="danger"
          @click="stopRecording" 
          :disabled="!isRecording"
          :loading="stopping"
        >
          ⏹️ 停止
        </el-button>
      </div>

      <!-- 活动会话列表 -->
      <div class="section active-sessions" v-if="activeSessions.length > 0">
        <h3>📹 活动会话 ({{ activeSessions.length }})</h3>
        <div v-for="session in activeSessions" :key="session.session_id" class="session-card">
          <div class="session-header">
            <span class="session-id">{{ session.session_id }}</span>
            <el-tag 
              :type="getSessionStatusType(session.status)"
              size="small"
            >
              {{ getStatusText(session.status) }}
            </el-tag>
          </div>
          <div class="session-info">
            <p>类型: {{ session.session_type }}</p>
            <p>视频流数: {{ session.video_streams.length }}</p>
            <p>音频流数: {{ session.audio_streams.length }}</p>
            <p>时长: {{ formatDuration(session.duration) }}</p>
            <p class="output-path">输出: {{ session.output_path }}</p>
          </div>
          <div class="session-actions">
            <el-button 
              size="small" 
              type="danger"
              @click="stopSession(session.session_id)"
            >
              停止
            </el-button>
          </div>
        </div>
      </div>

      <!-- 性能监控面板 -->
      <div class="section performance-monitor" v-if="performanceStats">
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
          <div class="stat-item full-width">
            <label>缓冲区健康</label>
            <div class="health-bar-container">
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
    </div>

    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { open } from '@tauri-apps/plugin-dialog'
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

// Props
const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  }
})

// Emits
const emit = defineEmits(['update:modelValue'])

// 状态
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

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
const starting = ref(false)
const stopping = ref(false)
const performanceUnlisten = ref(null)

// 计算属性
const canStart = computed(() => {
  return videoStreams.value.length > 0 && outputDir.value
})

// 方法
async function detectHardware() {
  detecting.value = true
  
  try {
    hardwareCaps.value = await detectHardwareAcceleration()
    ElMessage.success('硬件检测完成')
    
    // 自动为现有流设置推荐的硬件加速
    const accelMap = {
      'h264_nvenc': 'NVENC',
      'h264_qsv': 'QSV',
      'h264_amf': 'AMF',
      'h264_videotoolbox': 'VideoToolbox'
    }
    const recommendedAccel = accelMap[hardwareCaps.value.recommended_encoder] || 'None'
    
    videoStreams.value.forEach(stream => {
      if (stream.hardware_accel === 'None') {
        stream.hardware_accel = recommendedAccel
      }
    })
  } catch (error) {
    ElMessage.error(`检测失败: ${error}`)
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
    ElMessage.error(`选择目录失败: ${error}`)
  }
}

async function startRecording() {
  if (!canStart.value) {
    ElMessage.warning('请至少添加一个视频流并设置输出目录')
    return
  }
  
  starting.value = true
  
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
      ElMessage.success('多路录制已启动')
      
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
      ElMessage.success('画中画录制已启动')
      
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
      ElMessage.success('网格录制已启动')
      
    } else {
      throw new Error('配置不完整或流数量不足')
    }
    
    isRecording.value = true
    isPaused.value = false
    
    // 刷新会话列表
    await refreshSessions()
    
  } catch (error) {
    ElMessage.error(`启动录制失败: ${error}`)
  } finally {
    starting.value = false
  }
}

async function pauseRecording() {
  if (!currentSessionId.value) return
  
  try {
    await pauseCodecSession(currentSessionId.value)
    isPaused.value = true
    ElMessage.info('录制已暂停')
  } catch (error) {
    ElMessage.error(`暂停失败: ${error}`)
  }
}

async function resumeRecording() {
  if (!currentSessionId.value) return
  
  try {
    await resumeCodecSession(currentSessionId.value)
    isPaused.value = false
    ElMessage.success('录制已恢复')
  } catch (error) {
    ElMessage.error(`恢复失败: ${error}`)
  }
}

async function stopRecording() {
  if (!currentSessionId.value) return
  
  stopping.value = true
  
  try {
    await stopCodecSession(currentSessionId.value)
    isRecording.value = false
    isPaused.value = false
    currentSessionId.value = null
    ElMessage.success('录制已停止')
    
    await refreshSessions()
    
  } catch (error) {
    ElMessage.error(`停止失败: ${error}`)
  } finally {
    stopping.value = false
  }
}

async function stopSession(sessionId) {
  try {
    await stopCodecSession(sessionId)
    ElMessage.success('会话已停止')
    await refreshSessions()
  } catch (error) {
    ElMessage.error(`停止会话失败: ${error}`)
  }
}

async function refreshSessions() {
  try {
    activeSessions.value = await getActiveCodecSessions()
  } catch (error) {
    console.error('获取会话列表失败:', error)
  }
}

function getSessionStatusType(status) {
  const map = {
    'recording': 'danger',
    'paused': 'warning',
    'stopped': 'info',
    'error': 'danger'
  }
  return map[status] || 'info'
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

function handleClose() {
  visible.value = false
}

// 监听对话框打开
watch(visible, async (newVal) => {
  if (newVal) {
    // 初始检测硬件
    if (!hardwareCaps.value) {
      await detectHardware()
    }
    
    // 添加默认视频流
    if (videoStreams.value.length === 0) {
      addVideoStream()
    }
    
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
    
    // 清理函数
    onUnmounted(() => {
      if (performanceUnlisten.value) {
        performanceUnlisten.value()
      }
      clearInterval(interval)
    })
  }
})
</script>

<style lang="scss" scoped>
// 🎯 滚动条样式 mixin
@mixin custom-scrollbar {
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 3px;

    &:hover {
      background: #555;
    }
  }
}

// 🎯 弹窗包装类样式
.media-codec-dialog-wrapper {
  :deep(.el-dialog__body) {
    max-height: calc(100vh - 150px);
    overflow-y: auto;
    padding: 0;
    @include custom-scrollbar;
  }
}

.media-codec-dialog {
  padding: 10px;
}

.section {
  margin-bottom: 20px;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 8px;
  
  h3 {
    margin: 0 0 15px 0;
    font-size: 16px;
    color: #303133;
  }
}

// 硬件加速状态
.hardware-status {
  .caps-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px;
    margin-bottom: 15px;
  }
  
  .cap-item {
    background: white;
    padding: 12px;
    border-radius: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: 2px solid transparent;
    transition: all 0.3s;
    
    &.active {
      border-color: #67c23a;
      background: #f0f9ff;
    }
    
    &.recommended {
      border-color: #409eff;
      background: #ecf5ff;
    }
    
    .status, .value {
      font-weight: bold;
      font-size: 14px;
    }
  }
}

// 录制配置
.recording-config {
  .stream-list {
    margin-bottom: 20px;
  }
  
  .stream-item {
    background: white;
    padding: 15px;
    border-radius: 6px;
    margin-bottom: 10px;
    border: 1px solid #dcdfe6;
    
    .stream-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      
      .stream-title {
        font-weight: bold;
        color: #303133;
      }
    }
  }
  
  .output-settings {
    margin-top: 15px;
    padding-top: 15px;
    border-top: 1px solid #dcdfe6;
  }
}

// 控制按钮
.control-buttons {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  
  .el-button {
    flex: 1;
  }
}

// 活动会话
.active-sessions {
  .session-card {
    background: white;
    padding: 15px;
    border-radius: 6px;
    margin-bottom: 10px;
    border: 1px solid #dcdfe6;
    
    .session-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      
      .session-id {
        font-family: monospace;
        font-size: 12px;
        color: #909399;
      }
    }
    
    .session-info {
      p {
        margin: 5px 0;
        font-size: 13px;
        color: #606266;
        
        &.output-path {
          font-size: 12px;
          color: #909399;
          word-break: break-all;
        }
      }
    }
    
    .session-actions {
      margin-top: 10px;
      text-align: right;
    }
  }
}

// 性能监控
.performance-monitor {
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 15px;
  }
  
  .stat-item {
    text-align: center;
    padding: 12px;
    background: white;
    border-radius: 6px;
    border: 1px solid #dcdfe6;
    
    &.full-width {
      grid-column: 1 / -1;
    }
    
    label {
      display: block;
      font-size: 12px;
      color: #909399;
      margin-bottom: 8px;
    }
    
    .stat-value {
      font-size: 20px;
      font-weight: bold;
      color: #303133;
      
      &.warning {
        color: #e6a23c;
      }
      
      &.error {
        color: #f56c6c;
      }
    }
    
    .health-bar-container {
      display: flex;
      align-items: center;
      gap: 10px;
      
      span {
        font-size: 14px;
        font-weight: bold;
        min-width: 40px;
      }
    }
    
    .health-bar {
      flex: 1;
      height: 8px;
      background: #e4e7ed;
      border-radius: 4px;
      overflow: hidden;
      
      .health-fill {
        height: 100%;
        background: #67c23a;
        transition: width 0.3s, background 0.3s;
        
        &.low {
          background: #f56c6c;
        }
        
        &.medium {
          background: #e6a23c;
        }
      }
    }
  }
}
</style>
