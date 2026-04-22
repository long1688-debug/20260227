<template>
  <div class="audio-panel">
    <div class="panel-header">
      <h3 class="panel-title">音频管理</h3>
    </div>

    <div class="panel-content">
      <!-- 麦克风设置 -->
      <div class="audio-section">
        <h4 class="section-title">麦克风</h4>
        <div class="device-selector">
          <span class="selector-label">设备:</span>
          <el-select
            v-model="audioSettings.microphone"
            placeholder="选择麦克风"
            style="width: 180px"
            @change="handleMicrophoneChange"
          >
            <el-option label="禁用麦克风" value="" />
            <el-option
              v-for="mic in microphones"
              :key="mic.deviceId"
              :label="mic.label || '麦克风'"
              :value="mic.deviceId"
            />
          </el-select>
        </div>
        <div class="volume-control" v-if="audioSettings.microphone">
          <span class="volume-label">麦克风音量:</span>
          <el-slider
            v-model="audioSettings.microphoneVolume"
            :min="0"
            :max="100"
            style="width: 150px"
            @change="handleMicrophoneVolumeChange"
          />
          <span class="volume-value">{{ audioSettings.microphoneVolume }}%</span>
        </div>
        <div class="audio-toggle" v-if="audioSettings.microphone">
          <el-switch
            v-model="isMicrophoneEnabled"
            :disabled="!audioSettings.microphone"
            @change="toggleMicrophone"
          />
          <span>{{ isMicrophoneEnabled ? '已启用' : '已禁用' }}</span>
        </div>
      </div>

      <!-- 本地视频音频 -->
      <div class="audio-section">
        <h4 class="section-title">本地视频音频</h4>
        <div v-if="localVideoSources.length === 0" class="empty-state">
          <span>暂无本地视频</span>
        </div>
        <div v-for="source in localVideoSources" :key="source.id" class="video-audio-item">
          <div class="audio-toggle">
            <el-checkbox
              :model-value="getAudioEnabled(source)"
              @change="(val) => handleSingleVideoAudioToggle(source, val)"
            >
              {{ source.name }}
            </el-checkbox>
          </div>
          <div class="volume-control" v-if="getAudioEnabled(source)">
            <el-slider
              :model-value="getVolume(source)"
              :min="0"
              :max="100"
              :disabled="!getAudioEnabled(source)"
              style="width: 150px"
              @change="(val) => handleSingleVideoVolumeChange(source, val)"
            />
            <span class="volume-value">{{ getVolume(source) }}%</span>
          </div>
        </div>
      </div>

      <!-- 🎯 分屏视频音频选择 -->
      <div class="audio-section">
        <h4 class="section-title">分屏视频音频</h4>
        <div class="audio-section-description">
          <span class="description-text">选择哪个分屏视频播放声音（同一时刻只有一个视频发声）</span>
        </div>
        <div v-if="splitScreenVideos.length === 0" class="empty-state">
          <span>暂无分屏视频</span>
        </div>
        <div v-for="video in splitScreenVideos" :key="video.id" class="split-screen-video-item">
          <div class="video-radio-group">
            <el-radio
              :value="video.id"
              :model-value="currentAudioVideoId"
              @change="selectAudioVideo"
            >
              <div class="video-info">
                <span class="video-name">{{ video.name }}</span>
                <span class="video-type">{{ video.isPreview ? '预览区域' : '分屏区域' }}</span>
              </div>
            </el-radio>
          </div>
          <div class="video-status">
            <span :class="['status-badge', video.isMaster ? 'active' : 'muted']">
              {{ video.isMaster ? '🔊 发声中' : '🔇 已静音' }}
            </span>
          </div>
        </div>
      </div>

      <!-- 系统音频 -->
      <div class="audio-section">
        <h4 class="section-title">系统音频</h4>
        <div class="audio-toggle">
          <el-switch
            v-model="audioSettings.systemAudioEnabled"
            @change="handleSystemAudioToggle"
          />
          <span>{{ audioSettings.systemAudioEnabled ? '开启系统音频' : '关闭系统音频' }}</span>
        </div>
        <div class="volume-control" v-if="audioSettings.systemAudioEnabled">
          <span class="volume-label">系统音频音量:</span>
          <el-slider
            v-model="audioSettings.systemAudioVolume"
            :min="0"
            :max="100"
            style="width: 150px"
            @change="handleSystemAudioVolumeChange"
          />
          <span class="volume-value">{{ audioSettings.systemAudioVolume }}%</span>
        </div>
      </div>

      <!-- 扬声器设置 -->
      <div class="audio-section">
        <h4 class="section-title">扬声器</h4>
        <div class="device-selector">
          <span class="selector-label">设备:</span>
          <el-select
            v-model="audioSettings.speaker"
            placeholder="选择扬声器"
            style="width: 180px"
            @change="handleSpeakerChange"
          >
            <el-option
              v-for="speaker in speakers"
              :key="speaker.deviceId"
              :label="speaker.label || '扬声器'"
              :value="speaker.deviceId"
            />
          </el-select>
        </div>
        <div class="volume-control">
          <span class="volume-label">输出音量:</span>
          <el-slider
            v-model="audioSettings.speakerVolume"
            :min="0"
            :max="100"
            style="width: 150px"
            @change="handleSpeakerVolumeChange"
          />
          <span class="volume-value">{{ audioSettings.speakerVolume }}%</span>
        </div>
      </div>

      <!-- 音频电平 -->
      <div class="audio-section">
        <h4 class="section-title">音频电平</h4>
        <div class="level-display">
          <div class="level-indicator">
            <span class="level-label">麦克风:</span>
            <AudioLevelIndicator :level="microphoneLevel" />
          </div>
          <div class="level-indicator">
            <span class="level-label">系统:</span>
            <AudioLevelIndicator :level="systemLevel" />
          </div>
        </div>
      </div>

      <!-- 高级选项 -->
      <div class="audio-section">
        <h4 class="section-title">音频效果</h4>
        <div class="options-list">
          <el-checkbox
            v-model="audioSettings.noiseReduction"
            @change="handleAudioEffectChange"
          >降噪</el-checkbox>
          <el-checkbox
            v-model="audioSettings.echoCancellation"
            @change="handleAudioEffectChange"
          >回声消除</el-checkbox>
          <el-checkbox
            v-model="audioSettings.autoGain"
            @change="handleAudioEffectChange"
          >自动增益</el-checkbox>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import AudioLevelIndicator from '../common/AudioLevelIndicator.vue'
import { ElMessage } from 'element-plus'
import { useSourceStore } from '@/stores'
import { useMediaStore } from '@/stores/mediaStore'
import { useVideoSync } from '@/composables/useVideoSync'
import { audioMixer } from '@/utils/audioMixer'

// 获取源存储
const sourceStore = useSourceStore()
const mediaStore = useMediaStore()

// 视频同步管理器
const { audioRouter } = useVideoSync()

// 音频路由状态
const audioStatus = ref(null)

// 更新音频状态
const updateAudioStatus = () => {
  if (audioRouter) {
    audioStatus.value = audioRouter.getAudioStatus()
  }
}

// 音频设备列表
const microphones = ref([])
const speakers = ref([])

// 本地视频源列表（按视频名称显示）
const localVideoSources = computed(() => {
  // 从两个 store 获取本地视频源
  const sourcesFromMediaStore = Array.from(mediaStore.sources.values()).filter(source =>
    source.type === 'localVideo' || source.type === 'local-file'
  )

  const sourcesFromSourceStore = sourceStore.sources.filter(source =>
    source.type === 'localVideo' || source.type === 'video'
  )

  // 合并两个列表，去重
  const allSources = [...sourcesFromMediaStore, ...sourcesFromSourceStore]
  const seen = new Set()
  return allSources.filter(source => {
    if (seen.has(source.id)) return false
    seen.add(source.id)
    return true
  })
})

// 🎯 从 store 中获取最新的音频启用状态
const getAudioEnabled = (source) => {
  // 优先从 sourceStore 获取
  const sourceFromStore = sourceStore.sources.find(s => s.id === source.id)
  if (sourceFromStore && sourceFromStore.audioEnabled !== undefined) {
    return sourceFromStore.audioEnabled === true
  }
  // 其次从 mediaStore 获取
  const sourceFromMedia = mediaStore.sources.get(source.id)
  if (sourceFromMedia && sourceFromMedia.audioEnabled !== undefined) {
    return sourceFromMedia.audioEnabled === true
  }
  // 默认返回 false（静音）
  return false
}

// 🎯 从 store 中获取最新的音量值
const getVolume = (source) => {
  // 优先从 sourceStore 获取
  const sourceFromStore = sourceStore.sources.find(s => s.id === source.id)
  if (sourceFromStore && sourceFromStore.volume !== undefined) {
    return sourceFromStore.volume
  }
  // 其次从 mediaStore 获取
  const sourceFromMedia = mediaStore.sources.get(source.id)
  if (sourceFromMedia && sourceFromMedia.volume !== undefined) {
    return sourceFromMedia.volume
  }
  // 默认返回 100
  return 100
}

// 音频设置状态
const audioSettings = ref({
  microphone: '',
  speaker: '',
  microphoneVolume: 75,
  speakerVolume: 80,
  // 本地视频音频
  localVideoAudioEnabled: true,
  localVideoAudioVolume: 100,
  // 系统音频
  systemAudioEnabled: true,
  systemAudioVolume: 100,
  // 音频效果
  noiseReduction: true,
  echoCancellation: true,
  autoGain: false
})

// 音频电平
const microphoneLevel = ref(0)
const systemLevel = ref(0)

// 麦克风状态
const isMicrophoneEnabled = ref(false)

// 定时器
let levelInterval = null
let audioContext = null
let microphoneStream = null
let analyser = null

// 获取麦克风设备列表
const getMicrophones = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    microphones.value = devices.filter(d => d.kind === 'audioinput')
    console.log('[音频面板] 发现麦克风:', microphones.value)
  } catch (error) {
    console.error('[音频面板] 获取麦克风列表失败:', error)
  }
}

// 获取扬声器设备列表
const getSpeakers = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    speakers.value = devices.filter(d => d.kind === 'audiooutput')
    console.log('[音频面板] 发现扬声器:', speakers.value)
  } catch (error) {
    console.error('[音频面板] 获取扬声器列表失败:', error)
  }
}

// 请求麦克风权限并启动监听
const startMicrophoneMonitoring = async (deviceId) => {
  if (microphoneStream) {
    microphoneStream.getTracks().forEach(track => track.stop())
  }

  try {
    const constraints = deviceId ?
      { audio: { deviceId: { exact: deviceId } } } :
      { audio: true }

    microphoneStream = await navigator.mediaDevices.getUserMedia(constraints)

    // 创建音频分析器
    audioContext = new (window.AudioContext || window.webkitAudioContext)()
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 256

    const source = audioContext.createMediaStreamSource(microphoneStream)
    source.connect(analyser)

    isMicrophoneEnabled.value = true
    ElMessage.success('麦克风已开启')
    console.log('[音频面板] 麦克风监听已启动')

    // 开始检测音量
    startLevelDetection()
  } catch (error) {
    console.error('[音频面板] 启动麦克风失败:', error)
    ElMessage.error('无法启动麦克风: ' + error.message)
    isMicrophoneEnabled.value = false
  }
}

// 停止麦克风监听
const stopMicrophoneMonitoring = () => {
  if (microphoneStream) {
    microphoneStream.getTracks().forEach(track => track.stop())
    microphoneStream = null
  }
  if (audioContext) {
    audioContext.close()
    audioContext = null
  }
  analyser = null
  isMicrophoneEnabled.value = false
  microphoneLevel.value = 0
  ElMessage.info('麦克风已关闭')
  console.log('[音频面板] 麦克风监听已停止')
}

// 开始检测音量
const startLevelDetection = () => {
  if (levelInterval) {
    clearInterval(levelInterval)
  }

  levelInterval = setInterval(() => {
    if (analyser) {
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteFrequencyData(dataArray)

      // 计算平均音量
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length
      microphoneLevel.value = Math.min(Math.floor(average / 32), 8)
    }

    // 模拟系统音量
    systemLevel.value = audioSettings.value.localVideoAudioEnabled ?
      Math.floor(Math.random() * 6) + 2 : 0
  }, 100)
}

// 麦克风设备变更
const handleMicrophoneChange = (deviceId) => {
  if (deviceId) {
    startMicrophoneMonitoring(deviceId)
  } else {
    stopMicrophoneMonitoring()
  }
}

// 麦克风音量变更
const handleMicrophoneVolumeChange = (volume) => {
  console.log('[音频面板] 麦克风音量:', volume)
  // 可以在这里设置麦克风增益
}

// 切换麦克风状态
const toggleMicrophone = (enabled) => {
  if (enabled && audioSettings.value.microphone) {
    startMicrophoneMonitoring(audioSettings.value.microphone)
  } else {
    stopMicrophoneMonitoring()
  }
}

// 单个视频音频开关
const handleSingleVideoAudioToggle = (source, enabled) => {
  if (enabled) {
    ElMessage.success(`${source.name} 音频已开启`)
  } else {
    ElMessage.info(`${source.name} 音频已关闭`)
  }
  console.log('[音频面板] 视频音频:', source.name, enabled)

  // 更新源的音频状态（同时更新两个 store）
  mediaStore.updateSource(source.id, { audioEnabled: enabled })
  sourceStore.updateSource(source.id, { audioEnabled: enabled })

  // 通知其他组件
  emit('local-video-audio-change', {
    enabled,
    volume: source.volume || 100,
    sourceId: source.id,
    sourceName: source.name
  })
}

// 单个视频音量变更
const handleSingleVideoVolumeChange = (source, volume) => {
  console.log('[音频面板] 视频音量:', source.name, volume)

  // 更新源的音量（同时更新两个 store）
  mediaStore.updateSource(source.id, { volume })
  sourceStore.updateSource(source.id, { volume })

  // 🎯 关键修复1：通过 audioMixer 实际设置视频元素的音量
  audioMixer.setVolume(source.id, volume / 100)

  // 🎯 关键修复2：直接查找视频元素并设置音量（备用方案）
  // 确保即使 audioMixer 未注册也能生效
  const videoElements = document.querySelectorAll(`video[data-source-id="${source.id}"]`);
  videoElements.forEach(video => {
    // 只有预览区域的视频元素才设置音量，画布区域静音
    if (video.dataset.canvasIndex === "0" || video.closest('.preview-area')) {
      video.volume = volume / 100;
      // 如果这个视频是音频主控，取消静音
      video.muted = !getAudioEnabled(source);
    } else {
      // 画布区域保持静音，但设置音量值以备将来可能成为主控
      video.volume = volume / 100;
      video.muted = true;
    }
    console.log('[音频面板] 设置视频音量:', source.id, volume, `静音:${video.muted}`);
  });

  // 🎯 修复：音量调节时保持原有的音频启用状态
  // 避免因为 source.audioEnabled 为 undefined 而错误地设置为 false
  const currentAudioEnabled = source.audioEnabled !== undefined ? source.audioEnabled : true

  // 🎯 额外修复：通过音频路由系统更新音频状态
  // 使用audioRouter来确保音频只在预览区域播放
  try {
    if (audioRouter) {
      // 更新源的音频状态，这样音频路由系统可以正确处理
      audioRouter.updateSourceAudioState(source.id, {
        enabled: getAudioEnabled(source),
        volume: volume
      });
    }
  } catch (error) {
    console.warn('[音频面板] 无法通过音频路由系统更新音量:', error);
  }

  // 通知其他组件
  emit('local-video-audio-change', {
    enabled: currentAudioEnabled,
    volume,
    sourceId: source.id,
    sourceName: source.name
  })
}

// 本地视频音频开关（批量控制）
const handleLocalVideoAudioToggle = (enabled) => {
  if (enabled) {
    ElMessage.success('本地视频音频已开启')
  } else {
    ElMessage.info('本地视频音频已关闭')
  }
  console.log('[音频面板] 本地视频音频:', enabled)

  // 通知其他组件本地视频音频状态变更
  emit('local-video-audio-change', {
    enabled,
    volume: audioSettings.value.localVideoAudioVolume
  })
}

// 本地视频音频音量变更（批量控制）
const handleLocalVideoAudioVolumeChange = (volume) => {
  console.log('[音频面板] 本地视频音频音量:', volume)
  emit('local-video-audio-change', {
    enabled: audioSettings.value.localVideoAudioEnabled,
    volume
  })
}

// 系统音频开关
const handleSystemAudioToggle = (enabled) => {
  if (enabled) {
    ElMessage.success('系统音频已开启')
  } else {
    ElMessage.info('系统音频已关闭')
  }
  console.log('[音频面板] 系统音频:', enabled)

  // 通知其他组件系统音频状态变更
  emit('system-audio-change', {
    enabled,
    volume: audioSettings.value.systemAudioVolume
  })
}

// 系统音频音量变更
const handleSystemAudioVolumeChange = (volume) => {
  console.log('[音频面板] 系统音频音量:', volume)
  emit('system-audio-change', {
    enabled: audioSettings.value.systemAudioEnabled,
    volume
  })
}

// 扬声器设备变更
const handleSpeakerChange = async (deviceId) => {
  console.log('[音频面板] 选择扬声器:', deviceId)

  try {
    // 使用 setSinkId API 设置音频输出设备（如果浏览器支持）
    if ('setSinkId' in HTMLAudioElement.prototype) {
      // 查找所有音频/视频元素并更新其输出设备
      const mediaElements = document.querySelectorAll('audio, video')

      for (const media of mediaElements) {
        try {
          await media.setSinkId(deviceId)
          console.log('[音频面板] 设置音频输出设备成功:', media.tagName)
        } catch (err) {
          console.warn('[音频面板] 无法设置元素音频设备:', err)
        }
      }

      ElMessage.success('扬声器已切换')
    } else {
      ElMessage.warning('您的浏览器不支持切换音频输出设备')
    }
  } catch (error) {
    console.error('[音频面板] 切换扬声器失败:', error)
    ElMessage.error('切换扬声器失败')
  }
}

// 扬声器音量变更
const handleSpeakerVolumeChange = (volume) => {
  console.log('[音频面板] 扬声器音量:', volume)

  try {
    // 设置所有音频/视频元素的音量
    const mediaElements = document.querySelectorAll('audio, video')

    mediaElements.forEach(media => {
      // 排除预览区域的元素（它们有自己的音量控制）
      if (!media.closest('.preview-area')) {
        media.volume = volume / 100
      }
    })

    // 如果有 audioMixer，也更新主音量
    if (audioMixer && audioMixer.context) {
      audioMixer.setMasterVolume(volume / 100)
    }

    // 保存到全局引用
    window.speakerVolume = volume / 100

    console.log('[音频面板] 扬声器音量已设置:', volume)
  } catch (error) {
    console.error('[音频面板] 设置扬声器音量失败:', error)
  }
}

// 音频效果变更
const handleAudioEffectChange = () => {
  console.log('[音频面板] 音频效果设置:', audioSettings.value)
  // 应用音频效果设置
}

// ==================== 🎯 新增：分屏视频音频选择 ====================

// 获取分屏视频列表（从音频路由获取）
const splitScreenVideos = computed(() => {
  if (!audioStatus.value) return []

  return audioStatus.value.outputs.map(output => {
    // 查找对应的源信息
    const source = localVideoSources.value.find(s => s.id === output.sourceId)
    return {
      ...output,
      name: source?.name || `视频 ${output.id}`
    }
  })
})

// 当前发声视频ID
const currentAudioVideoId = computed(() => {
  return audioStatus.value?.master || null
})

// 选择发声视频
const selectAudioVideo = (videoId) => {
  if (audioRouter) {
    audioRouter.selectAudioOutput(videoId)
    updateAudioStatus()
    // 找到视频名称显示提示
    const video = splitScreenVideos.value.find(v => v.id === videoId)
    ElMessage.success(`已选择 "${video?.name || videoId}" 播放声音`)
  }
}

// 切换视频音频状态
const toggleVideoAudio = (videoId) => {
  if (audioRouter) {
    audioRouter.toggleCanvasAudio(videoId)
    updateAudioStatus()
  }
}

// 导出事件
const emit = defineEmits([
  'local-video-audio-change',
  'system-audio-change',
  'microphone-change',
  'speaker-change'
])

// 挂载时初始化
onMounted(async () => {
  // 获取设备列表
  await getMicrophones()
  await getSpeakers()

  // 如果有麦克风，默认选择第一个
  if (microphones.value.length > 0) {
    audioSettings.value.microphone = microphones.value[0].deviceId
  }

  // 如果有扬声器，默认选择第一个
  if (speakers.value.length > 0) {
    audioSettings.value.speaker = speakers.value[0].deviceId
  }

  // 初始化音频状态
  updateAudioStatus()

  // 定时更新音频状态（每秒更新一次）
  setInterval(() => {
    updateAudioStatus()
  }, 1000)
})

// 卸载时清理
onUnmounted(() => {
  if (levelInterval) {
    clearInterval(levelInterval)
  }
  stopMicrophoneMonitoring()
})
</script>

<style scoped>
.audio-panel {
  display: flex;
  flex-direction: column;
  padding: 15px;
  background: #0A1525;
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow-y: auto;
}

.panel-header {
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #2A3F5F;
  flex-shrink: 0;
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: #FFFFFF;
}

.panel-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

.audio-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  font-size: 14px;
  font-weight: 500;
  margin: 0;
  color: #AAAAAA;
  padding-bottom: 5px;
  border-bottom: 1px dashed #2A3F5F;
}

.device-selector {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.selector-label {
  font-size: 13px;
  color: #AAAAAA;
  min-width: 60px;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.volume-label {
  font-size: 13px;
  color: #AAAAAA;
  min-width: 100px;
}

.volume-value {
  font-size: 12px;
  color: #888888;
  min-width: 40px;
  text-align: right;
}

.audio-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 5px;
}

.audio-toggle span {
  font-size: 13px;
  color: #AAAAAA;
}

.level-display {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.level-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
}

.level-label {
  font-size: 13px;
  color: #AAAAAA;
  min-width: 60px;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.options-list .el-checkbox {
  font-size: 13px;
  color: #AAAAAA;
}

/* 视频音频项样式 */
.video-audio-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: #0F2035;
  border-radius: 8px;
  margin-top: 5px;
  border: 1px solid #2A3F5F;
}

.video-audio-item .audio-toggle {
  margin-top: 0;
}

.video-audio-item .audio-toggle span {
  font-size: 13px;
  color: #FFFFFF;
  font-weight: 500;
}

.video-audio-item .volume-control {
  padding-left: 50px;
}

/* 空状态样式 */
.empty-state {
  padding: 15px;
  text-align: center;
  color: #888888;
  font-size: 13px;
  background: #0F2035;
  border-radius: 8px;
  border: 1px solid #2A3F5F;
}

/* 音频区域描述 */
.audio-section-description {
  margin-bottom: 10px;
}

.description-text {
  font-size: 12px;
  color: #888888;
}

/* 分屏视频项样式 */
.split-screen-video-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: #0F2035;
  border-radius: 8px;
  margin-bottom: 8px;
  border: 2px solid transparent;
  transition: all 0.2s ease;
}

.split-screen-video-item:hover {
  background: #1A2A3A;
  border-color: #4A90E2;
}

.split-screen-video-item.selected {
  background: #1A3A5C;
  border-color: #4A90E2;
}

.video-radio-group {
  flex: 1;
}

.video-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.video-name {
  font-size: 13px;
  color: #FFFFFF;
  font-weight: 500;
}

.video-type {
  font-size: 11px;
  color: #888888;
}

.video-status {
  margin-left: 10px;
}

.status-badge {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 12px;
}

.status-badge.active {
  background: #1E3A3A;
  color: #00FF88;
}

.status-badge.muted {
  background: #3A1E1E;
  color: #FF6B6B;
}
</style>
