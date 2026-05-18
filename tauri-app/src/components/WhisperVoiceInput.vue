<template>
  <div class="whisper-voice-input" :class="{ recording: isRecording }">
    <!-- 语音输入按钮 -->
    <button
      class="voice-input-btn"
      @click="toggleRecording"
      :disabled="!whisperReady || isProcessing"
      :title="whisperReady ? (isRecording ? '停止录音' : '开始语音输入') : 'Whisper 未初始化'"
    >
      <el-icon v-if="isProcessing" class="rotating"><Loading /></el-icon>
      <el-icon v-else-if="isRecording" class="recording-icon"><Microphone /></el-icon>
      <el-icon v-else><Microphone /></el-icon>
      <span class="btn-text">
        {{ isProcessing ? '处理中...' : (isRecording ? '录音中...' : '语音输入') }}
      </span>
    </button>

    <!-- 实时字幕显示区域 -->
    <div v-if="showSubtitle" class="realtime-subtitle">
      <div class="subtitle-header">
        <span class="subtitle-label">实时字幕</span>
        <el-tag size="small" :type="subtitleStatus === 'recording' ? 'warning' : 'success'">
          {{ subtitleStatus === 'recording' ? '录音中' : '已完成' }}
        </el-tag>
      </div>

      <div class="subtitle-content">
        <p v-if="currentText" class="current-text">{{ currentText }}</p>
        <p v-else class="placeholder-text">等待语音输入...</p>

        <!-- 历史字幕（可折叠） -->
        <div v-if="historySegments.length > 0" class="history-section">
          <div class="history-toggle" @click="showHistory = !showHistory">
            <el-icon><ArrowDown v-if="!showHistory" /><ArrowUp v-else /></el-icon>
            <span>显示历史记录 ({{ historySegments.length }})</span>
          </div>

          <div v-show="showHistory" class="history-list">
            <div
              v-for="(seg, index) in historySegments"
              :key="index"
              class="history-item"
            >
              <span class="history-time">[{{ formatTime(seg.start) }}]</span>
              <span class="history-text">{{ seg.text }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 配置面板 -->
    <div class="config-panel" v-if="showConfig">
      <div class="config-header">
        <span>Whisper 配置</span>
        <el-button size="small" @click="showConfig = false">关闭</el-button>
      </div>

      <div class="config-content">
        <el-form label-width="100px" size="small">
          <el-form-item label="模型类型">
            <el-select v-model="config.modelType" @change="reinitialize">
              <el-option label="Tiny (最快)" value="tiny" />
              <el-option label="Base (推荐)" value="base" />
              <el-option label="Small (准确)" value="small" />
              <el-option label="Medium (专业)" value="medium" />
            </el-select>
          </el-form-item>

          <el-form-item label="语言">
            <el-select v-model="config.language">
              <el-option label="中文" value="zh" />
              <el-option label="英文" value="en" />
              <el-option label="日语" value="ja" />
              <el-option label="韩语" value="ko" />
            </el-select>
          </el-form-item>

          <el-form-item label="录制时长">
            <el-slider
              v-model="recordDuration"
              :min="3"
              :max="30"
              :step="1"
              show-input
            />
          </el-form-item>

          <el-form-item>
            <el-button type="primary" @click="saveConfig">保存配置</el-button>
            <el-button @click="resetConfig">恢复默认</el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Microphone, Loading, ArrowDown, ArrowUp } from '@element-plus/icons-vue'
import {
  initWhisper,
  recognizeAudio,
  cleanupWhisper,
  getWhisperStatus,
  type WhisperConfig,
  type WhisperResult,
  type WhisperSegment
} from '@/utils/whisper'

// ==================== 状态管理 ====================

const isRecording = ref(false)
const isProcessing = ref(false)
const whisperReady = ref(false)
const showSubtitle = ref(true)
const showHistory = ref(false)
const showConfig = ref(false)
const subtitleStatus = ref<'idle' | 'recording' | 'completed'>('idle')

// 当前识别文本
const currentText = ref('')
const historySegments = ref<WhisperSegment[]>([])

// 录制配置
const recordDuration = ref(5) // 秒
const config = reactive<WhisperConfig>({
  modelType: 'base',
  language: 'zh',
  translate: false
})

// 音频相关
let mediaStream: MediaStream | null = null
let mediaRecorder: MediaRecorder | null = null
let audioChunks: BlobPart[] = []

// ==================== 生命周期 ====================

onMounted(async () => {
  await initializeWhisper()
})

onUnmounted(() => {
  stopRecording()
  cleanupWhisper().catch(console.error)
})

// ==================== 核心功能 ====================

/**
 * 初始化 Whisper
 */
async function initializeWhisper() {
  try {
    isProcessing.value = true

    // 检查状态
    const status = await getWhisperStatus()
    if (status.initialized) {
      whisperReady.value = true
      ElMessage.success('Whisper 已就绪')
      return
    }

    // 初始化
    await initWhisper(config)
    whisperReady.value = true

    ElMessage.success(`Whisper 初始化成功 (${config.modelType} 模型)`)
  } catch (error) {
    console.error('[WhisperVoiceInput] 初始化失败:', error)
    ElMessage.error({
      message: 'Whisper 初始化失败，请确保已安装 Python 和 openai-whisper',
      duration: 5000,
      showClose: true
    })
  } finally {
    isProcessing.value = false
  }
}

/**
 * 切换录音状态
 */
async function toggleRecording() {
  if (isRecording.value) {
    await stopRecording()
  } else {
    await startRecording()
  }
}

/**
 * 开始录音
 */
async function startRecording() {
  try {
    // 获取麦克风流
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000
      }
    })

    // 创建 MediaRecorder
    mediaRecorder = new MediaRecorder(mediaStream, {
      mimeType: 'audio/webm;codecs=opus'
    })

    audioChunks = []

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data)
      }
    }

    mediaRecorder.onstop = async () => {
      await processAudio()
    }

    // 开始录音
    mediaRecorder.start()
    isRecording.value = true
    subtitleStatus.value = 'recording'
    currentText.value = ''

    ElMessage.info(`正在录音... (${recordDuration.value}秒)`)

    // 自动停止
    setTimeout(() => {
      if (isRecording.value) {
        stopRecording()
      }
    }, recordDuration.value * 1000)

  } catch (error) {
    console.error('[WhisperVoiceInput] 录音失败:', error)
    ElMessage.error('无法访问麦克风，请检查权限设置')
  }
}

/**
 * 停止录音
 */
async function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop()
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop())
    mediaStream = null
  }

  isRecording.value = false
  isProcessing.value = true
  subtitleStatus.value = 'recording'
}

/**
 * 处理音频并识别
 */
async function processAudio() {
  try {
    if (audioChunks.length === 0) {
      ElMessage.warning('未录制到音频数据')
      return
    }

    // 转换为 PCM 数据
    const blob = new Blob(audioChunks, { type: 'audio/webm' })
    const arrayBuffer = await blob.arrayBuffer()

    // 解码音频
    const audioContext = new AudioContext({ sampleRate: 16000 })
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    // 提取单声道数据
    const channelData = audioBuffer.getChannelData(0)

    // 调用 Whisper 识别
    const result = await recognizeAudio(channelData)

    // 更新显示
    currentText.value = result.fullText
    historySegments.value = [...result.segments, ...historySegments.value].slice(0, 50) // 最多保留50条
    subtitleStatus.value = 'completed'

    // 显示结果
    if (result.fullText.trim()) {
      ElMessage.success({
        message: `识别成功 (${result.processingTimeMs}ms)`,
        duration: 2000
      })

      // 触发事件，供父组件使用
      emit('recognized', {
        text: result.fullText,
        segments: result.segments,
        duration: result.processingTimeMs
      })
    } else {
      ElMessage.warning('未识别到有效内容')
    }

  } catch (error) {
    console.error('[WhisperVoiceInput] 识别失败:', error)
    ElMessage.error({
      message: '语音识别失败: ' + (error as Error).message,
      duration: 5000,
      showClose: true
    })
  } finally {
    isProcessing.value = false
    audioChunks = []
  }
}

// ==================== 配置管理 ====================

/**
 * 重新初始化 Whisper
 */
async function reinitialize() {
  await cleanupWhisper()
  await initializeWhisper()
}

/**
 * 保存配置
 */
function saveConfig() {
  localStorage.setItem('whisper-config', JSON.stringify(config))
  ElMessage.success('配置已保存')
  reinitialize()
}

/**
 * 恢复默认配置
 */
function resetConfig() {
  config.modelType = 'base'
  config.language = 'zh'
  config.translate = false
  saveConfig()
}

/**
 * 加载配置
 */
function loadConfig() {
  const saved = localStorage.getItem('whisper-config')
  if (saved) {
    try {
      Object.assign(config, JSON.parse(saved))
    } catch (e) {
      console.error('加载配置失败:', e)
    }
  }
}

// ==================== 工具函数 ====================

/**
 * 格式化时间（秒 → MM:SS）
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// ==================== 事件定义 ====================

const emit = defineEmits<{
  recognized: [data: { text: string; segments: WhisperSegment[]; duration: number }]
}>()

// 暴露方法给父组件
defineExpose({
  startRecording,
  stopRecording,
  initializeWhisper
})

// 加载配置
loadConfig()
</script>

<style scoped lang="scss">
.whisper-voice-input {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.voice-input-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: 2px solid #409eff;
  border-radius: 8px;
  background: white;
  color: #409eff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;

  &:hover:not(:disabled) {
    background: #409eff;
    color: white;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.recording {
    background: #f56c6c;
    border-color: #f56c6c;
    color: white;
    animation: pulse 1.5s infinite;
  }

  .rotating {
    animation: rotate 1s linear infinite;
  }

  .recording-icon {
    animation: pulse-icon 1s infinite;
  }
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245, 108, 108, 0.4); }
  50% { box-shadow: 0 0 0 10px rgba(245, 108, 108, 0); }
}

@keyframes pulse-icon {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.realtime-subtitle {
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: #f5f7fa;
  overflow: hidden;
}

.subtitle-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: #eef1f6;
  border-bottom: 1px solid #dcdfe6;

  .subtitle-label {
    font-weight: 600;
    color: #606266;
  }
}

.subtitle-content {
  padding: 12px;
  max-height: 300px;
  overflow-y: auto;

  .current-text {
    margin: 0;
    padding: 12px;
    background: white;
    border-radius: 6px;
    color: #303133;
    font-size: 15px;
    line-height: 1.6;
    min-height: 50px;
  }

  .placeholder-text {
    margin: 0;
    padding: 12px;
    color: #909399;
    font-style: italic;
    text-align: center;
  }
}

.history-section {
  margin-top: 12px;
  border-top: 1px solid #dcdfe6;
  padding-top: 12px;
}

.history-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px;
  cursor: pointer;
  color: #409eff;
  font-size: 13px;

  &:hover {
    background: #ecf5ff;
    border-radius: 4px;
  }
}

.history-list {
  margin-top: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.history-item {
  display: flex;
  gap: 8px;
  padding: 8px;
  background: white;
  border-radius: 4px;
  margin-bottom: 6px;
  font-size: 13px;

  .history-time {
    color: #909399;
    font-family: monospace;
    flex-shrink: 0;
  }

  .history-text {
    color: #606266;
    flex: 1;
  }
}

.config-panel {
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: white;
  overflow: hidden;
}

.config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: #f5f7fa;
  border-bottom: 1px solid #dcdfe6;
  font-weight: 600;
}

.config-content {
  padding: 16px;
}
</style>
