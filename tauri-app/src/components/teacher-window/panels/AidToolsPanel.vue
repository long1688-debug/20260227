<template>
  <div class="aid-tools-panel">
    <div class="panel-content">
    <!-- 计时器 -->
    <div class="tool-section">
      <div class="section-header">
        <h4 class="section-title">⏱️ 计时器</h4>
        <el-tag size="small" :type="timerRunning ? 'success' : 'info'">
          {{ timerRunning ? '运行中' : '已停止' }}
        </el-tag>
      </div>
      <div class="timer-display">
        <span class="timer-value">{{ formatTimerTime(timerSeconds) }}</span>
      </div>
      <div class="timer-controls">
        <el-button type="success" size="small" @click="startTimer" :disabled="timerRunning">
          ▶️ 开始
        </el-button>
        <el-button type="warning" size="small" @click="pauseTimer" :disabled="!timerRunning">
          ⏸️ 暂停
        </el-button>
        <el-button type="info" size="small" @click="resetTimer">
          🔄 重置
        </el-button>
      </div>
    </div>

    <!-- 倒计时 -->
    <div class="tool-section">
      <div class="section-header">
        <h4 class="section-title">⏳ 倒计时</h4>
        <el-tag size="small" :type="countdownRunning ? 'danger' : 'info'">
          {{ countdownRunning ? '倒计时中' : '已停止' }}
        </el-tag>
      </div>
      <div class="countdown-input">
        <el-input-number v-model="countdownMinutes" :min="0" :max="999" size="small" />
        <span class="countdown-label">分钟</span>
        <el-input-number v-model="countdownSeconds" :min="0" :max="59" size="small" />
        <span class="countdown-label">秒</span>
      </div>
      <div class="timer-display">
        <span class="timer-value" :class="{ 'countdown-warning': countdownTimeLeft <= 10 && countdownTimeLeft > 0 }">
          {{ formatTimerTime(countdownTimeLeft) }}
        </span>
      </div>
      <div class="timer-controls">
        <el-button type="danger" size="small" @click="startCountdown" :disabled="countdownRunning || countdownTimeLeft <= 0">
          ▶️ 开始
        </el-button>
        <el-button type="warning" size="small" @click="pauseCountdown" :disabled="!countdownRunning">
          ⏸️ 暂停
        </el-button>
        <el-button type="info" size="small" @click="resetCountdown">
          🔄 重置
        </el-button>
      </div>
    </div>

    <!-- 台标 -->
    <div class="tool-section">
      <div class="section-header">
        <h4 class="section-title">🏷️ 台标</h4>
        <el-switch v-model="showLogo" active-text="显示" inactive-text="隐藏" />
      </div>
      <div class="logo-config" v-if="showLogo">
        <div class="config-item">
          <label>台标文字</label>
          <el-input v-model="logoText" placeholder="输入台标文字" size="small" />
        </div>
        <div class="config-item">
          <label>位置</label>
          <el-select v-model="logoPosition" size="small" placeholder="选择位置">
            <el-option label="左上" value="top-left" />
            <el-option label="右上" value="top-right" />
            <el-option label="左下" value="bottom-left" />
            <el-option label="右下" value="bottom-right" />
          </el-select>
        </div>
        <div class="config-item">
          <label>颜色</label>
          <el-color-picker v-model="logoColor" size="small" />
        </div>
      </div>
    </div>

    <!-- 思维导图 -->
    <div class="tool-section">
      <div class="section-header">
        <h4 class="section-title">🧠 思维导图</h4>
      </div>
      <div class="mindmap-controls">
        <el-button type="primary" size="small" @click="loadMindmapFile">
          📂 加载思维导图
        </el-button>
        <el-button type="info" size="small" @click="clearMindmap" :disabled="!mindmapLoaded">
          🗑️ 清除
        </el-button>
      </div>
      <div class="mindmap-preview" v-if="mindmapLoaded">
        <div class="mindmap-info">
          <span>已加载: {{ mindmapFileName }}</span>
        </div>
      </div>
      <div class="mindmap-hint" v-else>
        <p>支持格式: JSON, XMind, PNG, JPG, SVG</p>
        <p>将自动渲染或显示为图片</p>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

// 计时器
const timerSeconds = ref(0)
const timerRunning = ref(false)
let timerInterval = null

// 倒计时
const countdownMinutes = ref(5)
const countdownSeconds = ref(0)
const countdownTimeLeft = ref(0)
const countdownRunning = ref(false)
let countdownInterval = null

// 台标
const showLogo = ref(false)
const logoText = ref('智慧课堂')
const logoPosition = ref('top-left')
const logoColor = ref('#FFFFFF')

// 思维导图
const mindmapLoaded = ref(false)
const mindmapFileName = ref('')

// 初始化倒计时
watch(() => countdownMinutes.value, () => {
  countdownTimeLeft.value = countdownMinutes.value * 60 + countdownSeconds.value
})
watch(() => countdownSeconds.value, () => {
  countdownTimeLeft.value = countdownMinutes.value * 60 + countdownSeconds.value
}, { immediate: true })

// 计时器方法
const startTimer = () => {
  if (timerInterval) clearInterval(timerInterval)
  timerRunning.value = true
  timerInterval = setInterval(() => {
    timerSeconds.value++
  }, 1000)
}

const pauseTimer = () => {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  timerRunning.value = false
}

const resetTimer = () => {
  pauseTimer()
  timerSeconds.value = 0
}

const formatTimerTime = (seconds) => {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// 倒计时方法
const startCountdown = () => {
  if (countdownInterval) clearInterval(countdownInterval)
  countdownTimeLeft.value = countdownMinutes.value * 60 + countdownSeconds.value
  countdownRunning.value = true
  countdownInterval = setInterval(() => {
    if (countdownTimeLeft.value > 0) {
      countdownTimeLeft.value--
    } else {
      pauseCountdown()
      ElMessage.warning('⏰ 倒计时结束！')
    }
  }, 1000)
}

const pauseCountdown = () => {
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
  countdownRunning.value = false
}

const resetCountdown = () => {
  pauseCountdown()
  countdownTimeLeft.value = countdownMinutes.value * 60 + countdownSeconds.value
}

// 思维导图加载
const loadMindmapFile = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,.mm,.xmind,.png,.jpg,.jpeg,.svg'
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (file) {
      mindmapFileName.value = file.name
      mindmapLoaded.value = true
      ElMessage.success('思维导图已加载')
    }
  }
  input.click()
}

const clearMindmap = () => {
  mindmapLoaded.value = false
  mindmapFileName.value = ''
}

// 暴露台标状态给父组件
defineExpose({
  showLogo,
  logoText,
  logoPosition,
  logoColor
})
</script>

<style lang="scss" scoped>
.aid-tools-panel {
  display: flex;
  flex-direction: column;
  padding: 12px;
  overflow: hidden;
  flex: 1;
  min-height: 0;
  height: 100%;

  .panel-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
  }

  .tool-section {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 12px;

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;

      .section-title {
        font-size: 13px;
        font-weight: 600;
        color: #E0E1DD;
        margin: 0;
      }
    }
  }

  .timer-display {
    text-align: center;
    margin: 12px 0;

    .timer-value {
      font-size: 28px;
      font-weight: 700;
      color: #778DA9;
      font-family: 'Monaco', 'Menlo', monospace;
    }

    .countdown-warning {
      color: #FF6B6B;
      animation: blink 0.5s infinite;
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  }

  .timer-controls {
    display: flex;
    gap: 6px;
    justify-content: center;

    :deep(.el-button) {
      flex: 1;
      padding: 6px 8px;
      font-size: 12px;
    }
  }

  .countdown-input {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;

    :deep(.el-input-number) {
      width: 80px;
    }

    .countdown-label {
      color: #778DA9;
      font-size: 12px;
    }
  }

  .logo-config {
    .config-item {
      margin-bottom: 10px;

      label {
        display: block;
        color: #778DA9;
        font-size: 12px;
        margin-bottom: 4px;
      }
    }
  }

  .mindmap-controls {
    display: flex;
    gap: 8px;

    :deep(.el-button) {
      flex: 1;
      font-size: 12px;
    }
  }

  .mindmap-preview {
    margin-top: 8px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;

    .mindmap-info {
      font-size: 12px;
      color: #778DA9;
      word-break: break-all;
    }
  }

  .mindmap-hint {
    margin-top: 8px;
    font-size: 11px;
    color: #6B7280;

    p {
      margin: 4px 0;
    }
  }
}
</style>
