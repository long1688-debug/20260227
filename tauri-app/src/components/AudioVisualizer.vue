<template>
  <div class="audio-visualizer" :class="[`mode-${mode}`, { animated: isAnimating }]">
    <canvas ref="canvas" :width="width" :height="height"></canvas>
    <div v-if="!hasData" class="visualizer-placeholder">
      <span>{{ placeholder }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { listen } from '@tauri-apps/api/event'

const props = defineProps({
  // 画布尺寸
  width: {
    type: Number,
    default: 300
  },
  height: {
    type: Number,
    default: 100
  },
  // 条形数量
  barCount: {
    type: Number,
    default: 32
  },
  // 显示模式：bars（条形）、waveform（波形）
  mode: {
    type: String,
    default: 'bars',
    validator: (value) => ['bars', 'waveform'].includes(value)
  },
  // 主题颜色
  themeColor: {
    type: String,
    default: '#409eff'
  },
  // 占位符文本
  placeholder: {
    type: String,
    default: '无音频信号'
  },
  // 是否使用后端音频数据
  useBackendData: {
    type: Boolean,
    default: true
  },
  // 自定义颜色数组（用于渐变）
  gradientColors: {
    type: Array,
    default: () => ['#67c23a', '#409eff']
  }
})

const emit = defineEmits(['level-change'])

const canvas = ref(null)
let ctx = null
let animationId = null
let audioDataListener = null
let currentAudioData = []
let isAnimating = ref(false)
let hasData = ref(false)
let currentLevel = ref(0)

// 获取渐变颜色
const getGradientColor = (ratio) => {
  const colors = props.gradientColors
  if (colors.length === 1) return colors[0]
  
  const segment = 1 / (colors.length - 1)
  const index = Math.floor(ratio / segment)
  const localRatio = (ratio - index * segment) / segment
  
  if (index >= colors.length - 1) return colors[colors.length - 1]
  
  // 线性插值
  const c1 = hexToRgb(colors[index])
  const c2 = hexToRgb(colors[index + 1])
  
  return `rgb(${Math.round(c1.r + (c2.r - c1.r) * localRatio)}, ${Math.round(c1.g + (c2.g - c1.g) * localRatio)}, ${Math.round(c1.b + (c2.b - c1.b) * localRatio)})`
}

// HEX 转 RGB
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 }
}

// 初始化 Canvas
const initCanvas = () => {
  if (canvas.value) {
    ctx = canvas.value.getContext('2d')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
  }
}

// 绘制条形图
const drawBars = (audioData) => {
  if (!ctx) return
  
  const { width, height, barCount } = props
  
  // 清除画布
  ctx.clearRect(0, 0, width, height)
  
  if (audioData.length === 0) {
    // 绘制静音线
    ctx.beginPath()
    ctx.moveTo(0, height / 2)
    ctx.lineTo(width, height / 2)
    ctx.strokeStyle = props.themeColor
    ctx.lineWidth = 1
    ctx.stroke()
    return
  }
  
  // 计算每个柱子的宽度
  const barWidth = width / barCount
  
  // 计算每个柱子的数据
  const chunkSize = Math.floor(audioData.length / barCount)
  
  for (let i = 0; i < barCount; i++) {
    // 计算当前柱子的平均音量
    let sum = 0
    for (let j = 0; j < chunkSize && i * chunkSize + j < audioData.length; j++) {
      sum += Math.abs(audioData[i * chunkSize + j])
    }
    const average = sum / chunkSize
    
    // 计算柱子高度
    const barHeight = Math.min(average * height * 2, height)
    
    // 绘制柱子
    const x = i * barWidth
    const y = (height - barHeight) / 2
    
    // 创建渐变
    const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight)
    const ratio = i / barCount
    gradient.addColorStop(0, getGradientColor(ratio))
    gradient.addColorStop(1, props.themeColor)
    
    ctx.fillStyle = gradient
    ctx.fillRect(x + 1, y, barWidth - 2, barHeight)
  }
  
  // 更新电平
  updateLevel(audioData)
}

// 绘制波形图
const drawWaveform = (audioData) => {
  if (!ctx) return
  
  const { width, height } = props
  
  // 清除画布
  ctx.clearRect(0, 0, width, height)
  
  if (audioData.length === 0) {
    // 绘制静音线
    ctx.beginPath()
    ctx.moveTo(0, height / 2)
    ctx.lineTo(width, height / 2)
    ctx.strokeStyle = props.themeColor
    ctx.lineWidth = 1
    ctx.stroke()
    return
  }
  
  // 绘制中心线
  ctx.strokeStyle = 'rgba(128, 128, 128, 0.3)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, height / 2)
  ctx.lineTo(width, height / 2)
  ctx.stroke()
  
  // 绘制波形
  ctx.strokeStyle = props.themeColor
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  
  const sliceWidth = width / audioData.length
  let x = 0
  
  for (let i = 0; i < audioData.length; i++) {
    const v = audioData[i] / 128.0
    const y = (v * height) / 2
    
    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
    
    x += sliceWidth
  }
  
  ctx.stroke()
  
  // 填充波形下方区域
  ctx.lineTo(width, height / 2)
  ctx.lineTo(0, height / 2)
  ctx.closePath()
  ctx.fillStyle = `${props.themeColor}33`
  ctx.fill()
  
  // 更新电平
  updateLevel(audioData)
}

// 更新电平
const updateLevel = (audioData) => {
  if (!audioData || audioData.length === 0) return
  
  const sum = audioData.reduce((a, b) => a + Math.abs(b), 0)
  const average = sum / audioData.length
  const level = Math.round(Math.min(average * 100, 100))
  
  if (level !== currentLevel.value) {
    currentLevel.value = level
    emit('level-change', level)
  }
}

// 模拟数据动画
const simulateAnimation = () => {
  if (props.useBackendData) return
  
  // 生成模拟数据
  const simulatedData = []
  for (let i = 0; i < 128; i++) {
    simulatedData.push(Math.random() * 0.5 + Math.sin(Date.now() / 500 + i * 0.1) * 0.3)
  }
  
  if (props.mode === 'bars') {
    drawBars(simulatedData)
  } else {
    drawWaveform(simulatedData)
  }
  
  hasData.value = true
}

// 动画循环
const animate = () => {
  isAnimating.value = true
  
  if (props.useBackendData && currentAudioData.length > 0) {
    if (props.mode === 'bars') {
      drawBars(currentAudioData)
    } else {
      drawWaveform(currentAudioData)
    }
    hasData.value = true
  } else if (!props.useBackendData) {
    simulateAnimation()
  }
  
  animationId = requestAnimationFrame(animate)
}

// 开始动画
const startAnimation = () => {
  if (!animationId) {
    animate()
  }
}

// 停止动画
const stopAnimation = () => {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
  isAnimating.value = false
}

// 获取当前电平
const getCurrentLevel = () => {
  return currentLevel.value
}

// 导出方法
defineExpose({
  startAnimation,
  stopAnimation,
  getCurrentLevel
})

onMounted(() => {
  initCanvas()
  
  // 监听后端音频数据
  if (props.useBackendData) {
    listen('audio_data', (event) => {
      currentAudioData = event.payload || []
    }).then(listener => {
      audioDataListener = listener
    })
  }
  
  // 开始绘制
  startAnimation()
})

onUnmounted(() => {
  // 取消监听
  if (audioDataListener) {
    audioDataListener()
  }
  
  // 停止动画
  stopAnimation()
})

// 监听模式变化
watch(() => props.mode, () => {
  initCanvas()
})
</script>

<style scoped lang="scss">
.audio-visualizer {
  position: relative;
  display: inline-block;
  background: linear-gradient(180deg, #f5f7fa 0%, #e4e7ed 100%);
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  
  &.animated {
    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, v-bind(themeColor), transparent);
      animation: scan 2s linear infinite;
    }
  }
}

@keyframes scan {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.visualizer-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(245, 247, 250, 0.9);
  color: #909399;
  font-size: 12px;
  pointer-events: none;
}

canvas {
  display: block;
}
</style>
