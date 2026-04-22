<template>
  <div class="media-codec-test">
    <h1>🎬 多路音视频编解码系统测试</h1>
    
    <!-- 快速操作区 -->
    <div class="quick-actions">
      <el-button type="primary" size="large" @click="openCodecDialog">
        📹 打开编解码面板
      </el-button>
      <el-button type="success" size="large" @click="runQuickTest">
        ⚡ 快速测试
      </el-button>
      <el-button @click="showHelp = true">
        ❓ 使用帮助
      </el-button>
    </div>

    <!-- 硬件检测卡片 -->
    <el-card class="test-section">
      <template #header>
        <div class="card-header">
          <span>🖥️ 硬件加速检测</span>
          <el-button type="primary" size="small" @click="detectHardware" :loading="detecting">
            {{ detecting ? '检测中...' : '重新检测' }}
          </el-button>
        </div>
      </template>
      
      <div v-if="hardwareCaps" class="caps-display">
        <el-descriptions :column="3" border>
          <el-descriptions-item label="NVIDIA NVENC">
            <el-tag :type="hardwareCaps.has_nvidia ? 'success' : 'info'">
              {{ hardwareCaps.has_nvidia ? '✅ 支持' : '❌ 不支持' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="Intel QSV">
            <el-tag :type="hardwareCaps.has_intel_qsv ? 'success' : 'info'">
              {{ hardwareCaps.has_intel_qsv ? '✅ 支持' : '❌ 不支持' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="AMD AMF">
            <el-tag :type="hardwareCaps.has_amd_amf ? 'success' : 'info'">
              {{ hardwareCaps.has_amd_amf ? '✅ 支持' : '❌ 不支持' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="推荐编码器" :span="3">
            <el-tag type="warning">{{ hardwareCaps.recommended_encoder }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item 
            v-if="hardwareCaps.gpu_memory_mb" 
            label="GPU 显存" 
            :span="3"
          >
            {{ hardwareCaps.gpu_memory_mb }} MB
          </el-descriptions-item>
        </el-descriptions>
      </div>
      
      <el-empty v-else description="点击检测按钮开始检测硬件能力" />
    </el-card>

    <!-- 录制模式选择 -->
    <el-card class="test-section">
      <template #header>
        <div class="card-header">
          <span>🎯 录制模式选择</span>
        </div>
      </template>
      
      <el-radio-group v-model="testMode" size="large">
        <el-radio-button value="multi">多路独立录制</el-radio-button>
        <el-radio-button value="pip">画中画混流</el-radio-button>
        <el-radio-button value="grid">网格布局混流</el-radio-button>
      </el-radio-group>
      
      <div class="mode-description">
        <p v-if="testMode === 'multi'">
          💡 每路视频单独编码，适合需要后期分别处理的场景
        </p>
        <p v-else-if="testMode === 'pip'">
          💡 主画面 + 小窗口画中画，适合教学录屏、游戏直播等
        </p>
        <p v-else-if="testMode === 'grid'">
          💡 多个视频源均匀分布，适合多机位监控、会议记录等
        </p>
      </div>
    </el-card>

    <!-- 测试配置 -->
    <el-card class="test-section">
      <template #header>
        <div class="card-header">
          <span>⚙️ 测试配置</span>
        </div>
      </template>
      
      <el-form :model="testConfig" label-width="120px">
        <el-form-item label="摄像头设备:">
          <el-select v-model="testConfig.cameraDevice" style="width: 100%">
            <el-option label="默认摄像头" value="Integrated Camera" />
            <el-option label="USB 摄像头" value="USB Camera" />
            <el-option label="虚拟摄像头" value="OBS Virtual Camera" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="分辨率:">
          <el-select v-model="testConfig.resolution" style="width: 100%">
            <el-option label="1920×1080 (Full HD)" value="1920x1080" />
            <el-option label="1280×720 (HD)" value="1280x720" />
            <el-option label="640×480 (SD)" value="640x480" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="帧率:">
          <el-slider 
            v-model="testConfig.framerate" 
            :min="15" 
            :max="60" 
            :step="5"
            show-input
          />
        </el-form-item>
        
        <el-form-item label="硬件加速:">
          <el-switch
            v-model="testConfig.useHardwareAccel"
            active-text="启用"
            inactive-text="禁用"
          />
          <span class="hint">（推荐启用以降低 CPU 负载）</span>
        </el-form-item>
        
        <el-form-item label="输出目录:">
          <el-input v-model="testConfig.outputDir" readonly>
            <template #append>
              <el-button @click="selectOutputDir">浏览...</el-button>
            </template>
          </el-input>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 控制按钮 -->
    <el-card class="test-section">
      <template #header>
        <div class="card-header">
          <span>🎮 录制控制</span>
        </div>
      </template>
      
      <div class="control-buttons">
        <el-button 
          type="primary" 
          size="large"
          @click="startTestRecording" 
          :disabled="isRecording"
          :loading="starting"
        >
          ▶️ 开始测试录制
        </el-button>
        <el-button 
          @click="pauseTestRecording" 
          :disabled="!isRecording || isPaused"
        >
          ⏸️ 暂停
        </el-button>
        <el-button 
          @click="resumeTestRecording" 
          :disabled="!isPaused"
        >
          ▶️ 恢复
        </el-button>
        <el-button 
          type="danger"
          @click="stopTestRecording" 
          :disabled="!isRecording"
          :loading="stopping"
        >
          ⏹️ 停止
        </el-button>
      </div>
      
      <el-alert
        v-if="currentSessionId"
        title="录制进行中"
        type="success"
        :closable="false"
        show-icon
        style="margin-top: 15px"
      >
        <template #default>
          <p>会话 ID: <code>{{ currentSessionId }}</code></p>
          <p>状态: {{ isPaused ? '已暂停' : '录制中' }}</p>
        </template>
      </el-alert>
    </el-card>

    <!-- 性能监控 -->
    <el-card class="test-section" v-if="performanceStats">
      <template #header>
        <div class="card-header">
          <span>📊 实时性能监控</span>
          <el-tag :type="getPerformanceType()">
            {{ getPerformanceText() }}
          </el-tag>
        </div>
      </template>
      
      <el-row :gutter="20">
        <el-col :span="6">
          <div class="stat-box">
            <div class="stat-label">当前 FPS</div>
            <div class="stat-value">{{ performanceStats.fps_current.toFixed(1) }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-box">
            <div class="stat-label">CPU 使用率</div>
            <div class="stat-value" :class="{ warning: performanceStats.cpu_usage_percent > 80 }">
              {{ performanceStats.cpu_usage_percent.toFixed(1) }}%
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-box">
            <div class="stat-label">丢帧数</div>
            <div class="stat-value" :class="{ error: performanceStats.dropped_frames > 100 }">
              {{ performanceStats.dropped_frames }}
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-box">
            <div class="stat-label">缓冲区健康</div>
            <div class="stat-value">
              {{ (performanceStats.buffer_health * 100).toFixed(0) }}%
            </div>
          </div>
        </el-col>
      </el-row>
      
      <el-progress 
        :percentage="performanceStats.buffer_health * 100"
        :color="getHealthColor()"
        :stroke-width="20"
        style="margin-top: 20px"
      />
    </el-card>

    <!-- 活动会话列表 -->
    <el-card class="test-section" v-if="activeSessions.length > 0">
      <template #header>
        <div class="card-header">
          <span>📹 活动会话 ({{ activeSessions.length }})</span>
          <el-button size="small" @click="refreshSessions">刷新</el-button>
        </div>
      </template>
      
      <el-table :data="activeSessions" style="width: 100%">
        <el-table-column prop="session_id" label="会话ID" width="200" />
        <el-table-column prop="session_type" label="类型" width="120" />
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getSessionStatusType(scope.row.status)">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="视频流数" width="100">
          <template #default="scope">
            {{ scope.row.video_streams.length }}
          </template>
        </el-table-column>
        <el-table-column label="时长" width="100">
          <template #default="scope">
            {{ formatDuration(scope.row.duration) }}
          </template>
        </el-table-column>
        <el-table-column prop="output_path" label="输出路径" show-overflow-tooltip />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="scope">
            <el-button 
              size="small" 
              type="danger"
              @click="stopSession(scope.row.session_id)"
            >
              停止
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 帮助对话框 -->
    <el-dialog v-model="showHelp" title="使用帮助" width="700px">
      <div class="help-content">
        <h3>📖 快速开始</h3>
        <ol>
          <li>点击"硬件加速检测"查看系统能力</li>
          <li>选择合适的录制模式（多路/画中画/网格）</li>
          <li>配置摄像头、分辨率、帧率等参数</li>
          <li>选择输出目录</li>
          <li>点击"开始测试录制"</li>
          <li>观察性能监控面板</li>
          <li>完成后点击"停止"</li>
        </ol>
        
        <h3>💡 最佳实践</h3>
        <ul>
          <li><strong>降低 CPU 占用</strong>: 启用硬件加速，降低分辨率和帧率</li>
          <li><strong>提高画质</strong>: 使用更低的 CRF 值（CPU 编码），提高码率</li>
          <li><strong>减少存储</strong>: 使用 H.265 编码，降低码率和分辨率</li>
          <li><strong>避免丢帧</strong>: 确保 CPU/GPU 负载不超过 80%</li>
        </ul>
        
        <h3>⚠️ 注意事项</h3>
        <ul>
          <li>必须安装 FFmpeg 并添加到系统 PATH</li>
          <li>更新显卡驱动以启用硬件加速</li>
          <li>Windows 暂停功能暂未完全实现</li>
          <li>录制文件可能很大，请确保磁盘空间充足</li>
        </ul>
      </div>
    </el-dialog>

    <!-- 编解码对话框组件 -->
    <MediaCodecDialog v-model="showCodecDialog" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { open } from '@tauri-apps/plugin-dialog'
import MediaCodecDialog from '@/components/teacher-window/dialogs/MediaCodecDialog.vue'
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

// 状态
const showCodecDialog = ref(false)
const showHelp = ref(false)
const detecting = ref(false)
const hardwareCaps = ref(null)
const testMode = ref('multi')
const isRecording = ref(false)
const isPaused = ref(false)
const currentSessionId = ref(null)
const activeSessions = ref([])
const performanceStats = ref(null)
const starting = ref(false)
const stopping = ref(false)
const performanceUnlisten = ref(null)

// 测试配置
const testConfig = reactive({
  cameraDevice: 'Integrated Camera',
  resolution: '1920x1080',
  framerate: 30,
  useHardwareAccel: true,
  outputDir: 'C:/Recordings'
})

// 方法
function openCodecDialog() {
  showCodecDialog.value = true
}

async function detectHardware() {
  detecting.value = true
  
  try {
    hardwareCaps.value = await detectHardwareAcceleration()
    ElMessage.success('硬件检测完成')
  } catch (error) {
    ElMessage.error(`检测失败: ${error}`)
  } finally {
    detecting.value = false
  }
}

async function selectOutputDir() {
  try {
    const selected = await open({
      directory: true,
      multiple: false,
      title: '选择录制输出目录'
    })
    
    if (selected) {
      testConfig.outputDir = selected
    }
  } catch (error) {
    ElMessage.error(`选择目录失败: ${error}`)
  }
}

async function runQuickTest() {
  // 自动执行完整测试流程
  await detectHardware()
  
  setTimeout(() => {
    openCodecDialog()
  }, 500)
}

async function startTestRecording() {
  starting.value = true
  
  try {
    const [width, height] = testConfig.resolution.split('x').map(Number)
    
    // 创建视频流配置
    const stream = createDefaultVideoConfig(
      'test_stream',
      'camera',
      testConfig.cameraDevice
    )
    stream.width = width
    stream.height = height
    stream.framerate = testConfig.framerate
    
    // 设置硬件加速
    if (testConfig.useHardwareAccel && hardwareCaps.value) {
      const accelMap = {
        'h264_nvenc': 'NVENC',
        'h264_qsv': 'QSV',
        'h264_amf': 'AMF'
      }
      stream.hardware_accel = accelMap[hardwareCaps.value.recommended_encoder] || 'None'
    } else {
      stream.hardware_accel = 'None'
    }
    
    const sessionId = `test_${Date.now()}`
    
    if (testMode.value === 'multi') {
      currentSessionId.value = await startMultiRecord(
        sessionId,
        [stream],
        [],
        testConfig.outputDir
      )
      ElMessage.success('测试录制已启动')
      
    } else if (testMode.value === 'pip') {
      // 创建第二个虚拟流用于测试
      const stream2 = { ...stream, stream_id: 'test_stream_2' }
      const layout = createPipLayout(stream.stream_id, stream2.stream_id)
      
      currentSessionId.value = await startMixRecording(
        sessionId,
        [stream, stream2],
        [],
        layout,
        `${testConfig.outputDir}/pip_test.mp4`
      )
      ElMessage.success('画中画测试录制已启动')
      
    } else if (testMode.value === 'grid') {
      // 创建4个虚拟流用于测试
      const streams = Array.from({ length: 4 }, (_, i) => ({
        ...stream,
        stream_id: `test_stream_${i}`
      }))
      const streamIds = streams.map(s => s.stream_id)
      const layout = createGridLayout(streamIds)
      
      currentSessionId.value = await startMixRecording(
        sessionId,
        streams,
        [],
        layout,
        `${testConfig.outputDir}/grid_test.mp4`
      )
      ElMessage.success('网格测试录制已启动')
    }
    
    isRecording.value = true
    isPaused.value = false
    
    // 启动性能监控
    startPerformanceMonitoring()
    
    // 刷新会话列表
    await refreshSessions()
    
  } catch (error) {
    ElMessage.error(`启动录制失败: ${error}`)
  } finally {
    starting.value = false
  }
}

async function pauseTestRecording() {
  if (!currentSessionId.value) return
  
  try {
    await pauseCodecSession(currentSessionId.value)
    isPaused.value = true
    ElMessage.info('录制已暂停')
  } catch (error) {
    ElMessage.error(`暂停失败: ${error}`)
  }
}

async function resumeTestRecording() {
  if (!currentSessionId.value) return
  
  try {
    await resumeCodecSession(currentSessionId.value)
    isPaused.value = false
    ElMessage.success('录制已恢复')
  } catch (error) {
    ElMessage.error(`恢复失败: ${error}`)
  }
}

async function stopTestRecording() {
  if (!currentSessionId.value) return
  
  stopping.value = true
  
  try {
    await stopCodecSession(currentSessionId.value)
    isRecording.value = false
    isPaused.value = false
    currentSessionId.value = null
    ElMessage.success('录制已停止')
    
    // 停止性能监控
    stopPerformanceMonitoring()
    
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

function startPerformanceMonitoring() {
  performanceUnlisten.value = onPerformanceUpdate((stats) => {
    if (stats.session_id === currentSessionId.value) {
      performanceStats.value = stats
      
      // 告警检查
      if (stats.fps_current < 20) {
        console.warn('⚠️ 帧率过低:', stats.fps_current)
      }
      if (stats.cpu_usage_percent > 80) {
        console.warn('⚠️ CPU 使用率过高:', stats.cpu_usage_percent)
      }
      if (stats.dropped_frames > 100) {
        console.error('❌ 严重丢帧:', stats.dropped_frames)
      }
    }
  })
}

function stopPerformanceMonitoring() {
  if (performanceUnlisten.value) {
    performanceUnlisten.value()
    performanceUnlisten.value = null
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

function getPerformanceType() {
  if (!performanceStats.value) return 'info'
  
  if (performanceStats.value.fps_current >= 25 && 
      performanceStats.value.cpu_usage_percent < 70) {
    return 'success'
  } else if (performanceStats.value.fps_current >= 15) {
    return 'warning'
  } else {
    return 'danger'
  }
}

function getPerformanceText() {
  if (!performanceStats.value) return '未知'
  
  if (performanceStats.value.fps_current >= 25 && 
      performanceStats.value.cpu_usage_percent < 70) {
    return '✅ 性能良好'
  } else if (performanceStats.value.fps_current >= 15) {
    return '⚠️ 性能一般'
  } else {
    return '❌ 性能较差'
  }
}

function getHealthColor() {
  if (!performanceStats.value) return '#409eff'
  
  const health = performanceStats.value.buffer_health
  if (health > 0.7) return '#67c23a'
  if (health > 0.3) return '#e6a23c'
  return '#f56c6c'
}

// 生命周期
onMounted(async () => {
  // 初始检测硬件
  await detectHardware()
})

onUnmounted(() => {
  stopPerformanceMonitoring()
})
</script>

<style lang="scss" scoped>
.media-codec-test {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
  
  h1 {
    text-align: center;
    color: #303133;
    margin-bottom: 30px;
  }
}

.quick-actions {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin-bottom: 30px;
}

.test-section {
  margin-bottom: 20px;
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}

.caps-display {
  margin-top: 10px;
}

.mode-description {
  margin-top: 15px;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 6px;
  
  p {
    margin: 0;
    color: #606266;
    font-size: 14px;
  }
}

.hint {
  margin-left: 10px;
  font-size: 12px;
  color: #909399;
}

.control-buttons {
  display: flex;
  gap: 10px;
  
  .el-button {
    flex: 1;
  }
}

.stat-box {
  text-align: center;
  padding: 20px;
  background: #f5f7fa;
  border-radius: 8px;
  
  .stat-label {
    font-size: 12px;
    color: #909399;
    margin-bottom: 8px;
  }
  
  .stat-value {
    font-size: 24px;
    font-weight: bold;
    color: #303133;
    
    &.warning {
      color: #e6a23c;
    }
    
    &.error {
      color: #f56c6c;
    }
  }
}

.help-content {
  h3 {
    margin-top: 20px;
    margin-bottom: 10px;
    color: #303133;
    
    &:first-child {
      margin-top: 0;
    }
  }
  
  ol, ul {
    padding-left: 20px;
    
    li {
      margin-bottom: 8px;
      color: #606266;
      line-height: 1.6;
    }
  }
  
  strong {
    color: #303133;
  }
}
</style>
