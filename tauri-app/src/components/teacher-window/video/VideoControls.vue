<template>
  <div v-if="showControls" class="video-controls">
    <!-- 播放/暂停按钮 -->
    <el-button
      :icon="isPlaying ? 'VideoPause' : 'VideoPlay'"
      circle
      size="small"
      @click="$emit('toggle-play')"
    />

    <!-- 进度条 -->
    <div class="progress-container">
      <span class="time-label">{{ formatTime(currentTime) }}</span>
      <el-slider
        v-model="progressValue"
        :max="duration || 100"
        :format-tooltip="formatTime"
        @change="handleSeek"
        class="progress-slider"
      />
      <span class="time-label">{{ formatTime(duration) }}</span>
    </div>

    <!-- 音量控制 -->
    <el-button
      :icon="isMuted ? 'Mute' : 'Volume'"
      circle
      size="small"
      @click="$emit('toggle-mute')"
    />
    <el-slider
      v-model="volumeValue"
      :max="100"
      :min="0"
      :step="1"
      @input="handleVolumeChange"
      class="volume-slider"
    />

    <!-- 全屏按钮 -->
    <el-button
      icon="FullScreen"
      circle
      size="small"
      @click="$emit('toggle-fullscreen')"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  showControls: {
    type: Boolean,
    default: true
  },
  isPlaying: {
    type: Boolean,
    default: false
  },
  currentTime: {
    type: Number,
    default: 0
  },
  duration: {
    type: Number,
    default: 0
  },
  volume: {
    type: Number,
    default: 100
  },
  isMuted: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'seek',
  'toggle-play',
  'toggle-mute',
  'volume-change',
  'toggle-fullscreen'
])

// 进度条值（转换为百分比）
const progressValue = computed({
  get: () => props.currentTime,
  set: (value) => emit('seek', value)
})

// 音量值（转换为 0-100）
const volumeValue = computed({
  get: () => props.volume * 100,
  set: (value) => emit('volume-change', value / 100)
})

// 格式化时间显示
const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// 处理进度条拖动
const handleSeek = (value) => {
  emit('seek', value)
}

// 处理音量变化
const handleVolumeChange = (value) => {
  emit('volume-change', value / 100)
}
</script>

<style lang="scss" scoped>
.video-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 4px;
  margin-top: 8px;

  .progress-container {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 200px;

    .time-label {
      font-size: 12px;
      color: white;
      min-width: 40px;
      text-align: center;
    }

    .progress-slider {
      flex: 1;
      
      :deep(.el-slider__bar) {
        background-color: #409eff;
      }
    }
  }

  .volume-slider {
    width: 80px;
    
    :deep(.el-slider__bar) {
      background-color: #67c23a;
    }
  }
}
</style>
