<template>
  <div class="analysis-panel">
    <!-- 顶部状态栏 -->
    <div class="top-status-bar">
      <span class="status-indicator" :class="detectionStatus"></span>
      <span class="status-text">{{ statusText }}</span>
      <span class="score-badge" v-if="finalScore > 0">{{ finalScore }}分</span>
      <!-- 🆕 全屏按钮 -->
      <button class="fullscreen-btn" @click="openFullscreen" title="打开全屏模式">
        🔍
      </button>
      <!-- 🆕 直播按钮 - 直接开始/停止 -->
      <button 
        class="broadcast-btn"
        :class="{ active: isBroadcasting }"
        @click="handleToggleBroadcast"
      >
        {{ isBroadcasting ? '⏹️' : '📡' }}
      </button>
      <el-tag v-if="isBroadcasting" type="danger" size="small" effect="dark">
        🔴 {{ formattedDuration }}
      </el-tag>
    </div>

    <!-- 配置选项 -->
    <div class="panel-section">
      <div class="section-header">
        <span class="section-icon">⚙️</span>
        <span>检测配置</span>
      </div>
      <div class="config-grid">
        <label class="config-toggle">
          <input type="checkbox" v-model="config.faceDetect">
          <span class="toggle-label">👤 人脸检测</span>
        </label>
        <label class="config-toggle">
          <input type="checkbox" v-model="config.yoloDetect">
          <span class="toggle-label">🔬 实验检测</span>
        </label>
        <label class="config-toggle">
          <input type="checkbox" v-model="config.emotionDetect">
          <span class="toggle-label">😊 情绪分析</span>
        </label>
      </div>
    </div>

    <!-- 视频源选择 -->
    <div class="panel-section">
      <div class="section-header">
        <span class="section-icon">📹</span>
        <span>视频源</span>
      </div>
      <div class="source-buttons">
        <button class="source-btn" @click="loadCamera">
          <span class="btn-icon">📷</span>
          <span>摄像头</span>
        </button>
        <button class="source-btn" @click="loadLocalVideo">
          <span class="btn-icon">🎬</span>
          <span>本地视频</span>
        </button>
        <button class="source-btn" @click="loadImage">
          <span class="btn-icon">🖼️</span>
          <span>加载图片</span>
        </button>
      </div>
      <!-- 网络摄像头输入 -->
      <div class="network-source">
        <input 
          type="text" 
          v-model="videoUrl" 
          placeholder="rtsp://或http://地址"
          class="url-input"
        >
        <button class="connect-btn" @click="connectCamera">连接</button>
      </div>
    </div>

    <!-- 实时检测控制 -->
    <div class="panel-section">
      <div class="section-header">
        <span class="section-icon">🎯</span>
        <span>检测控制</span>
        <span class="badge" :class="detectionStatus">{{ detectionStatusText }}</span>
      </div>
      <div class="control-buttons">
        <button 
          class="control-btn start" 
          @click="startDetection"
          :disabled="detectionStatus === 'running' || !hasVideoSource"
        >
          ▶️ 开始
        </button>
        <button 
          class="control-btn stop" 
          @click="stopDetection"
          :disabled="detectionStatus !== 'running'"
        >
          ⏹️ 停止
        </button>
        <button class="control-btn reload" @click="reloadModel">
          🔄 重载
        </button>
      </div>
    </div>

    <!-- 快捷命令 -->
    <div class="panel-section">
      <div class="section-header">
        <span class="section-icon">⌨️</span>
        <span>快捷命令</span>
      </div>
      <div class="command-grid">
        <button class="cmd-btn" @click="sendCommand('检测：重新检测')">重新检测</button>
        <button class="cmd-btn" @click="sendCommand('检测：清除结果')">清除结果</button>
        <button class="cmd-btn" @click="sendCommand('检测：暂停')">暂停</button>
        <button class="cmd-btn" @click="sendCommand('检测：继续')">继续</button>
      </div>
    </div>

    <!-- 视频预览 -->
    <div class="panel-section video-preview-section" v-if="videoElement || videoSource">
      <div class="section-header">
        <span class="section-icon">📺</span>
        <span>视频预览</span>
      </div>
      <div class="video-container">
        <video 
          ref="videoRef"
          class="preview-video"
          :src="videoSource"
          muted
          playsinline
          @loadedmetadata="onVideoLoaded"
        ></video>
        <canvas ref="overlayCanvas" class="overlay-canvas"></canvas>
        <div v-if="!videoSource" class="video-placeholder">
          <span>等待视频源...</span>
        </div>
      </div>
    </div>

    <!-- 检测结果 -->
    <div class="panel-section">
      <div class="section-header">
        <span class="section-icon">📊</span>
        <span>检测结果</span>
        <span class="count-badge">{{ detectionResults.length }}</span>
      </div>
      <div class="results-list" v-if="detectionResults.length > 0">
        <div 
          v-for="(result, index) in detectionResults" 
          :key="index"
          class="result-card"
        >
          <div class="result-main">
            <span class="result-type-badge">{{ result.type }}</span>
            <span class="result-label">{{ result.label }}</span>
          </div>
          <div class="result-confidence">
            {{ (result.confidence * 100).toFixed(0) }}%
          </div>
        </div>
      </div>
      <div class="empty-results" v-else>
        <span>暂无检测结果</span>
      </div>
    </div>

    <!-- 最终得分 -->
    <div class="panel-section score-section" v-if="finalScore > 0">
      <div class="section-header">
        <span class="section-icon">🏆</span>
        <span>综合评分</span>
      </div>
      <div class="score-display">
        <div class="score-value">{{ finalScore }}</div>
        <div class="score-label">分</div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="panel-section actions-section">
      <button class="action-btn confirm" @click="confirmResult" :disabled="detectionResults.length === 0">
        ✅ 确认结果
      </button>
      <button class="action-btn export" @click="exportData" :disabled="detectionResults.length === 0">
        📥 导出数据
      </button>
    </div>

    <!-- 日志区域 -->
    <div class="panel-section log-section">
      <div class="section-header">
        <span class="section-icon">📝</span>
        <span>操作日志</span>
        <button class="clear-log-btn" @click="clearLogs">清空</button>
      </div>
      <div class="log-content" ref="logContainer">
        <div 
          v-for="(log, index) in logs" 
          :key="index"
          class="log-item"
          :class="log.type"
        >
          <span class="log-time">{{ log.time }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { usePanelBroadcast } from '@/composables/usePanelBroadcast'

// 🆕 直播功能 - 直接推流到学生端
const {
  isBroadcasting,
  broadcastDuration,
  viewerCount,
  formattedDuration,
  startBroadcast,
  stopBroadcast,
  initBroadcast
} = usePanelBroadcast({ streamName: 'analysis-panel' })

// 切换直播状态 - 直接开始/停止，无需配置
const handleToggleBroadcast = async () => {
  if (isBroadcasting.value) {
    await stopBroadcast()
    addLog('🛑 停止分析直播', 'warning')
    ElMessage.info('分析直播已停止')
  } else {
    // 直接开始直播，无需配置
    await startBroadcast('analysis')
    addLog('📡 开始分析直播，学生端正在接收', 'success')
    ElMessage.success('分析直播已开始')
  }
}

// 打开全屏分析窗口
const openFullscreen = () => {
  window.dispatchEvent(new CustomEvent('open-analysis-window'))
  addLog('正在打开全屏分析窗口...')
}

// 配置
const config = reactive({
  faceDetect: true,
  yoloDetect: true,
  emotionDetect: false
})

// 视频相关
const videoUrl = ref('')
const videoSource = ref('')
const videoElement = ref(null)
const videoRef = ref(null)
const overlayCanvas = ref(null)
const hasVideoSource = computed(() => !!videoSource.value)

// 检测状态
const detectionStatus = ref('idle') // idle, loading, running, stopped

const detectionStatusText = computed(() => {
  const map = {
    idle: '就绪',
    loading: '加载中',
    running: '运行中',
    stopped: '已停止'
  }
  return map[detectionStatus.value] || '就绪'
})

const statusText = computed(() => {
  if (detectionStatus.value === 'running') return '检测进行中...'
  if (detectionStatus.value === 'loading') return '模型加载中...'
  if (videoSource.value) return '已加载视频源'
  return '等待检测...'
})

// 最终得分
const finalScore = ref(0)

// 检测结果
const detectionResults = ref([])

// 日志
const logs = ref([])
const logContainer = ref(null)

// 添加日志
const addLog = (message, type = 'info') => {
  const now = new Date()
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
  logs.value.push({ time, message, type })
  
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })
  
  // 限制日志数量
  if (logs.value.length > 100) {
    logs.value.shift()
  }
}

// 加载摄像头
const loadCamera = async () => {
  try {
    addLog('正在请求摄像头权限...', 'info')
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    
    // 创建视频 URL
    videoSource.value = '' // 清空之前的源
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      videoRef.value.play()
    }
    
    addLog('摄像头已连接', 'success')
    ElMessage.success('摄像头已连接')
  } catch (error) {
    addLog('摄像头访问失败: ' + error.message, 'error')
    ElMessage.error('无法访问摄像头')
  }
}

// 加载本地视频
const loadLocalVideo = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'video/*'
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (file) {
      videoSource.value = URL.createObjectURL(file)
      addLog('已加载视频: ' + file.name, 'success')
    }
  }
  input.click()
}

// 加载图片
const loadImage = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (file) {
      videoSource.value = URL.createObjectURL(file)
      addLog('已加载图片: ' + file.name, 'success')
    }
  }
  input.click()
}

// 连接网络摄像头
const connectCamera = () => {
  if (!videoUrl.value) {
    ElMessage.warning('请输入视频地址')
    return
  }
  videoSource.value = videoUrl.value
  addLog('已连接: ' + videoUrl.value, 'success')
  ElMessage.success('网络摄像头已连接')
}

// 视频加载完成
const onVideoLoaded = () => {
  addLog('视频加载完成', 'success')
}

// 开始检测
const startDetection = async () => {
  if (!hasVideoSource.value) {
    ElMessage.warning('请先加载视频源')
    return
  }
  
  detectionStatus.value = 'running'
  addLog('开始检测...', 'info')
  
  // 模拟检测过程
  simulateDetection()
}

// 模拟检测（实际项目中应该调用真实的检测API）
let detectionInterval = null
const simulateDetection = () => {
  if (detectionStatus.value !== 'running') return
  
  // 生成随机检测结果
  const types = ['人脸检测', '行为识别', '物体识别']
  const labels = ['学生A', '举手', '笔记本', '书本', '手机']
  
  if (Math.random() > 0.5) {
    const result = {
      type: types[Math.floor(Math.random() * types.length)],
      label: labels[Math.floor(Math.random() * labels.length)],
      confidence: 0.7 + Math.random() * 0.25
    }
    detectionResults.value.push(result)
    
    // 更新得分
    finalScore.value = Math.min(100, finalScore.value + Math.floor(Math.random() * 5))
  }
  
  detectionInterval = setTimeout(simulateDetection, 2000)
}

// 停止检测
const stopDetection = () => {
  detectionStatus.value = 'stopped'
  if (detectionInterval) {
    clearTimeout(detectionInterval)
    detectionInterval = null
  }
  addLog('检测已停止', 'warning')
}

// 重载模型
const reloadModel = () => {
  detectionStatus.value = 'loading'
  addLog('正在重载检测模型...', 'info')
  
  setTimeout(() => {
    detectionStatus.value = 'idle'
    addLog('模型重载完成', 'success')
    ElMessage.success('模型已重载')
  }, 2000)
}

// 发送命令
const sendCommand = (command) => {
  addLog(command, 'info')
  
  if (command.includes('清除结果')) {
    detectionResults.value = []
    finalScore.value = 0
  }
}

// 确认结果
const confirmResult = () => {
  if (detectionResults.value.length === 0) {
    ElMessage.warning('没有可确认的结果')
    return
  }
  addLog('检测结果已确认', 'success')
  ElMessage.success('结果已确认')
}

// 导出数据
const exportData = () => {
  if (detectionResults.value.length === 0) {
    ElMessage.warning('没有可导出的数据')
    return
  }
  
  const data = {
    timestamp: new Date().toISOString(),
    score: finalScore.value,
    results: detectionResults.value,
    logs: logs.value
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `analysis-result-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
  
  addLog('数据已导出', 'success')
  ElMessage.success('数据导出成功')
}

// 清空日志
const clearLogs = () => {
  logs.value = []
}

// 组件卸载时清理
onUnmounted(() => {
  if (detectionInterval) {
    clearTimeout(detectionInterval)
  }
  // 清理视频流
  if (videoRef.value?.srcObject) {
    videoRef.value.srcObject.getTracks().forEach(track => track.stop())
  }
})

onMounted(() => {
  addLog('分析面板已初始化', 'success')
})
</script>

<style lang="scss" scoped>
.analysis-panel {
  height: 100%;
  overflow-y: auto;
  padding: 12px;
  background: #0D1B2A;
  color: #E0E1DD;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

// 顶部状态栏
.top-status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #1B263B;
  border-radius: 8px;
  border-left: 3px solid #06B6D4;
  
  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #6B7280;
    
    &.running { background: #10B981; animation: pulse 1.5s infinite; }
    &.loading { background: #F59E0B; animation: pulse 0.8s infinite; }
    &.stopped { background: #EF4444; }
    &.idle { background: #6B7280; }
  }
  
  .status-text {
    flex: 1;
    font-size: 12px;
    color: #A0AEC0;
  }
  
  .score-badge {
    background: linear-gradient(135deg, #EF4444, #F59E0B);
    color: #fff;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

// 面板区块
.panel-section {
  background: #1B263B;
  border-radius: 8px;
  padding: 12px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 600;
  color: #778DA9;
  
  .section-icon {
    font-size: 14px;
  }
  
  .badge {
    margin-left: auto;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: 500;
    
    &.running { background: #10B981; color: #fff; }
    &.idle { background: #6B7280; color: #fff; }
    &.stopped { background: #EF4444; color: #fff; }
    &.loading { background: #F59E0B; color: #fff; }
  }
  
  .count-badge {
    margin-left: auto;
    background: #06B6D4;
    color: #fff;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 10px;
  }
}

// 配置网格
.config-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  
  input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: #06B6D4;
  }
  
  .toggle-label {
    font-size: 12px;
    color: #E0E1DD;
  }
}

// 视频源按钮
.source-buttons {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}

.source-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 8px;
  background: #0F2035;
  border: 1px solid #2D4A6F;
  border-radius: 6px;
  color: #E0E1DD;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: #1E3A5F;
    border-color: #06B6D4;
  }
  
  .btn-icon {
    font-size: 18px;
  }
}

.network-source {
  display: flex;
  gap: 8px;
}

.url-input {
  flex: 1;
  padding: 8px 10px;
  background: #0F2035;
  border: 1px solid #2D4A6F;
  border-radius: 4px;
  color: #E0E1DD;
  font-size: 11px;
  
  &::placeholder {
    color: #4B5563;
  }
  
  &:focus {
    outline: none;
    border-color: #06B6D4;
  }
}

.connect-btn {
  padding: 8px 16px;
  background: #06B6D4;
  border: none;
  border-radius: 4px;
  color: #fff;
  font-size: 11px;
  cursor: pointer;
  
  &:hover {
    background: #0891B2;
  }
}

// 检测控制按钮
.control-buttons {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.control-btn {
  padding: 10px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  &.start {
    background: #10B981;
    color: #fff;
    
    &:hover:not(:disabled) { background: #059669; }
  }
  
  &.stop {
    background: #EF4444;
    color: #fff;
    
    &:hover:not(:disabled) { background: #DC2626; }
  }
  
  &.reload {
    background: #6B7280;
    color: #fff;
    
    &:hover:not(:disabled) { background: #4B5563; }
  }
}

// 快捷命令
.command-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.cmd-btn {
  padding: 8px;
  background: transparent;
  border: 1px solid #2D4A6F;
  border-radius: 4px;
  color: #A0AEC0;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: #0F2035;
    border-color: #06B6D4;
    color: #E0E1DD;
  }
}

// 视频预览
.video-preview-section {
  .video-container {
    position: relative;
    width: 100%;
    aspect-ratio: 16/9;
    background: #0F2035;
    border-radius: 6px;
    overflow: hidden;
  }
  
  .preview-video {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  
  .overlay-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  
  .video-placeholder {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #4B5563;
    font-size: 12px;
  }
}

// 检测结果列表
.results-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.result-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: #0F2035;
  border-radius: 6px;
  border-left: 3px solid #06B6D4;
}

.result-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  
  .result-type-badge {
    font-size: 10px;
    color: #06B6D4;
    text-transform: uppercase;
  }
  
  .result-label {
    font-size: 12px;
    color: #E0E1DD;
  }
}

.result-confidence {
  font-size: 14px;
  font-weight: 600;
  color: #10B981;
}

.empty-results {
  text-align: center;
  padding: 20px;
  color: #4B5563;
  font-size: 12px;
}

// 得分区域
.score-section {
  .score-display {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 8px;
  }
  
  .score-value {
    font-size: 48px;
    font-weight: 700;
    background: linear-gradient(135deg, #EF4444, #F59E0B);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .score-label {
    font-size: 18px;
    color: #778DA9;
  }
}

// 操作按钮
.actions-section {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.action-btn {
  padding: 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  &.confirm {
    background: #F59E0B;
    color: #fff;
    
    &:hover:not(:disabled) { background: #D97706; }
  }
  
  &.export {
    background: #3B82F6;
    color: #fff;
    
    &:hover:not(:disabled) { background: #2563EB; }
  }
}

// 日志区域
.log-section {
  flex: 1;
  min-height: 150px;
  
  .section-header {
    .clear-log-btn {
      margin-left: auto;
      padding: 2px 8px;
      background: transparent;
      border: 1px solid #2D4A6F;
      border-radius: 4px;
      color: #6B7280;
      font-size: 10px;
      cursor: pointer;
      
      &:hover {
        border-color: #EF4444;
        color: #EF4444;
      }
    }
  }
}

.log-content {
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.log-item {
  display: flex;
  gap: 8px;
  font-size: 11px;
  padding: 4px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  
  .log-time {
    color: #4B5563;
    font-family: monospace;
  }
  
  .log-message {
    color: #778DA9;
  }
  
  &.success .log-message { color: #10B981; }
  &.error .log-message { color: #EF4444; }
  &.warning .log-message { color: #F59E0B; }
}

// 滚动条样式
.analysis-panel::-webkit-scrollbar,
.log-content::-webkit-scrollbar,
.results-list::-webkit-scrollbar {
  width: 6px;
}

.analysis-panel::-webkit-scrollbar-track,
.log-content::-webkit-scrollbar-track,
.results-list::-webkit-scrollbar-track {
  background: #0F2035;
  border-radius: 3px;
}

.analysis-panel::-webkit-scrollbar-thumb,
.log-content::-webkit-scrollbar-thumb,
.results-list::-webkit-scrollbar-thumb {
  background: #2D4A6F;
  border-radius: 3px;
  
  &:hover {
    background: #3D5A8F;
  }
}

// 🆕 直播按钮样式
.broadcast-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: #1E3A5F;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.2s;
  margin-left: 4px;

  &:hover {
    background: #2D4A6F;
  }

  &.active {
    background: #EF4444;
    animation: pulse-broadcast 1.5s infinite;
  }
}

// 🆕 全屏按钮样式
.fullscreen-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: #1E3A5F;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.2s;
  margin-left: auto;

  &:hover {
    background: #2D4A6F;
    transform: scale(1.1);
  }
}

@keyframes pulse-broadcast {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
  50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
}

// 🆕 RTMP 配置对话框样式
.rtmp-config-form {
  .form-item {
    margin-bottom: 16px;

    label {
      display: block;
      margin-bottom: 8px;
      font-size: 13px;
      color: #E0E1DD;
    }

    .el-input {
      width: 100%;
    }
  }

  .form-tip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: rgba(6, 182, 212, 0.1);
    border-radius: 6px;
    font-size: 12px;
    color: #06B6D4;
  }
}
</style>
