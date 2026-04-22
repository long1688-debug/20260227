<template>
  <div class="video-item" :class="layoutClass" @dragover.prevent @drop="handleDrop">
    <div class="video-container">
      <video
        ref="videoRef"
        class="video-element"
        :src="videoSrc"
        :muted="isMuted"
        autoplay
        playsinline
        poster="data:,"
        @loadedmetadata="onLoadedMetadata"
        @error="onError"
      />

      <div v-if="isLoading" class="video-loading">
        <span class="loading-spinner"></span>
        <span class="loading-text">加载中...</span>
      </div>

      <div v-if="error" class="video-error">
        <span class="error-icon">⚠️</span>
        <span class="error-text">{{ error }}</span>
      </div>

      <div class="video-overlay">
        <div class="video-name">{{ videoName }}</div>
        <div class="video-indicators">
          <NetworkQualityIndicator v-if="networkQuality" :quality="networkQuality" />
          <AudioLevelIndicator v-if="audioLevel !== null" :level="audioLevel" />
        </div>
      </div>

      <div class="video-controls">
        <el-button size="small" @click="togglePlay">
          {{ isPlaying ? '⏸️' : '▶️' }}
        </el-button>
        <el-button size="small" @click="toggleMute">
          {{ isMuted ? '🔇' : '🔊' }}
        </el-button>
        <el-button size="small" @click="$emit('toggle-recording')">
          {{ isRecording ? '🔴' : '⏺️' }}
        </el-button>
        <el-button size="small" @click="$emit('fullscreen')">⛶</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import NetworkQualityIndicator from '../common/NetworkQualityIndicator.vue'
import AudioLevelIndicator from '../common/AudioLevelIndicator.vue'

const props = defineProps({
  videoData: {
    type: Object,
    required: true
  },
  layoutMode: {
    type: String,
    default: 'grid'
  }
})

const emit = defineEmits(['toggle-recording', 'fullscreen', 'drag-start', 'drop'])

const videoRef = ref(null)
const isLoading = ref(true)
const error = ref(null)
const isPlaying = ref(false)
const isMuted = ref(false)
const isRecording = ref(false)
const networkQuality = ref(null)
const audioLevel = ref(null)

const videoSrc = computed(() => props.videoData?.src || '')
const videoName = computed(() => props.videoData?.name || '未命名视频')

const layoutClass = computed(() => `layout-${props.layoutMode}`)

const onLoadedMetadata = () => {
  isLoading.value = false
  error.value = null
}

const onError = (e) => {
  isLoading.value = false
  error.value = '视频加载失败'
  console.error('Video error:', e)
}

const togglePlay = () => {
  if (videoRef.value) {
    if (videoRef.value.paused) {
      videoRef.value.play()
      isPlaying.value = true
    } else {
      videoRef.value.pause()
      isPlaying.value = false
    }
  }
}

const toggleMute = () => {
  isMuted.value = !isMuted.value
}

const handleDrop = (e) => {
  const data = e.dataTransfer.getData('source')
  if (data) {
    emit('drop', JSON.parse(data))
  }
}

defineExpose({
  videoRef,
  getCurrentTime: () => videoRef.value?.currentTime || 0,
  setCurrentTime: (time) => {
    if (videoRef.value) {
      videoRef.value.currentTime = time
    }
  }
})
</script>

<style lang="scss" scoped>
.video-item {
  position: relative;
  background: #000;
  overflow: hidden;
  border-radius: 4px;
  border: 1px solid #1A2A3A;

  &.layout-grid {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.video-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-element {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  background: #000;  /* 🎯 黑色背景,避免绿色闪烁 */
}

.video-loading,
.video-error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: #FFF;
}

.loading-spinner {
  display: inline-block;
  width: 30px;
  height: 30px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: #FFF;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.video-overlay {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.6);
  padding: 5px 10px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.video-name {
  font-size: 12px;
  color: #FFF;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
}

.video-indicators {
  display: flex;
  gap: 5px;
}

.video-controls {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.6);
  padding: 5px;
  border-radius: 4px;
  display: flex;
  gap: 5px;
  opacity: 0;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }
}

.video-item:hover .video-controls {
  opacity: 1;
}
</style>
