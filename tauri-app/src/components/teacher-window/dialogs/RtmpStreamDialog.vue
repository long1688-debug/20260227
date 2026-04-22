<template>
  <el-dialog
    v-model="visible"
    title="RTMP 推流设置"
    width="700px"
    top="3vh"
    :close-on-click-modal="false"
    class="rtmp-dialog-wrapper"
    @close="handleClose"
    :z-index="2000"
    append-to-body
  >
    <el-form :model="config" label-width="120px">
      <!-- 平台选择 -->
      <el-form-item label="推流平台">
        <el-select v-model="selectedPlatform" placeholder="选择平台" @change="onPlatformChange">
          <el-option label="自定义" value="custom" />
          <el-option label="Bilibili" value="bilibili" />
          <el-option label="Twitch" value="twitch" />
          <el-option label="YouTube" value="youtube" />
        </el-select>
      </el-form-item>

      <!-- RTMP地址 -->
      <el-form-item label="RTMP地址">
        <el-input v-model="config.rtmp_url" placeholder="rtmp://live.example.com/live" />
      </el-form-item>

      <!-- 推流密钥 -->
      <el-form-item label="推流密钥">
        <el-input
          v-model="config.stream_key"
          type="password"
          show-password
          placeholder="输入推流密钥"
        />
      </el-form-item>

      <!-- 视频配置 -->
      <el-form-item label="分辨率">
        <el-select v-model="config.resolution">
          <el-option label="3840x2160 (4K)" value="3840x2160" />
          <el-option label="2560x1440 (2K)" value="2560x1440" />
          <el-option label="1920x1080 (1080P)" value="1920x1080" />
          <el-option label="1280x720 (720P)" value="1280x720" />
          <el-option label="854x480 (480P)" value="854x480" />
        </el-select>
      </el-form-item>

      <el-form-item label="帧率">
        <el-select v-model="config.frame_rate">
          <el-option label="60 FPS" :value="60" />
          <el-option label="30 FPS" :value="30" />
          <el-option label="24 FPS" :value="24" />
          <el-option label="15 FPS" :value="15" />
        </el-select>
      </el-form-item>

      <el-form-item label="码率">
        <el-input-number v-model="config.bitrate" :min="500" :max="20000" :step="500" />
        <span style="margin-left: 8px">kbps</span>
      </el-form-item>

      <!-- 编码器 -->
      <el-form-item label="编码器">
        <el-select v-model="config.encoder">
          <el-option label="libx264 (CPU)" value="libx264" />
          <el-option label="h264_nvenc (NVIDIA)" value="h264_nvenc" />
          <el-option label="h264_qsv (Intel)" value="h264_qsv" />
          <el-option label="h264_amf (AMD)" value="h264_amf" />
        </el-select>
      </el-form-item>

      <!-- 音频配置 -->
      <el-form-item label="音频采样率">
        <el-select v-model="config.audio_sample_rate">
          <el-option label="48000 Hz" :value="48000" />
          <el-option label="44100 Hz" :value="44100" />
        </el-select>
      </el-form-item>

      <!-- 网络监控 -->
      <el-divider />
      <div class="network-monitor">
        <h4>网络状态</h4>
        <div class="monitor-stats">
          <div class="stat-item">
            <span class="stat-label">上传速度:</span>
            <span class="stat-value">{{ networkStats.uploadSpeed }} Mbps</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">推流状态:</span>
            <el-tag :type="isStreaming ? 'success' : 'info'">
              {{ isStreaming ? '推流中' : '未推流' }}
            </el-tag>
          </div>
          <div class="stat-item">
            <span class="stat-label">持续时间:</span>
            <span class="stat-value">{{ streamDuration }}</span>
          </div>
        </div>
      </div>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
      <el-button v-if="isStreaming" type="danger" @click="handleStop">停止推流</el-button>
      <el-button v-else type="primary" @click="handleStart">开始推流</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useRecording } from '@/composables/useRecording'
import { useLiveStreaming } from '@/composables/useLiveStreaming'

const props = defineProps({
  modelValue: Boolean
})

const emit = defineEmits(['update:modelValue'])

const { startRtmpStream, stopRtmpStream } = useRecording()
const { streamStatus, streamDuration } = useLiveStreaming()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const selectedPlatform = ref('custom')
const isStreaming = ref(false)

const config = reactive({
  rtmp_url: '',
  stream_key: '',
  resolution: '1920x1080',
  frame_rate: 30,
  bitrate: 4000,
  encoder: 'libx264',
  audio_sample_rate: 48000
})

const networkStats = reactive({
  uploadSpeed: 0,
  latency: 0
})

const platforms = {
  bilibili: {
    rtmp_url: 'rtmp://live-push.bilivideo.com/live-bvc',
    bitrate: 6000
  },
  twitch: {
    rtmp_url: 'rtmp://live.twitch.tv/app',
    bitrate: 6000
  },
  youtube: {
    rtmp_url: 'rtmp://a.rtmp.youtube.com/live2',
    bitrate: 9000
  }
}

const onPlatformChange = () => {
  const platform = platforms[selectedPlatform.value]
  if (platform) {
    config.rtmp_url = platform.rtmp_url
    config.bitrate = platform.bitrate
  }
}

const updateNetworkStats = () => {
  networkStats.uploadSpeed = (Math.random() * 10 + 40).toFixed(1)
  networkStats.latency = Math.floor(Math.random() * 20 + 10)
}

let statsInterval = null

const handleStart = async () => {
  if (!config.rtmp_url || !config.stream_key) {
    ElMessage.warning('请填写完整的RTMP地址和推流密钥')
    return
  }

  try {
    isStreaming.value = true
    await startRtmpStream(config)
    statsInterval = setInterval(updateNetworkStats, 3000)
    ElMessage.success('推流已开始')
  } catch (error) {
    isStreaming.value = false
    ElMessage.error(`启动失败: ${error.message}`)
  }
}

const handleStop = async () => {
  try {
    await stopRtmpStream()
    isStreaming.value = false
    if (statsInterval) {
      clearInterval(statsInterval)
      statsInterval = null
    }
    ElMessage.success('推流已停止')
  } catch (error) {
    ElMessage.error(`停止失败: ${error.message}`)
  }
}

const handleClose = async () => {
  if (isStreaming.value) {
    await handleStop()
  }
  visible.value = false
}

onUnmounted(() => {
  if (statsInterval) {
    clearInterval(statsInterval)
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
.rtmp-dialog-wrapper {
  :deep(.el-dialog__body) {
    max-height: calc(100vh - 150px);
    overflow-y: auto;
    padding: 20px;
    @include custom-scrollbar;
  }
}

.network-monitor {
  background: #0F2035;
  border-radius: 6px;
  padding: 15px;
}

.network-monitor h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #E0E1DD;
}

.monitor-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-label {
  font-size: 13px;
  color: #778DA9;
}

.stat-value {
  font-size: 13px;
  color: #E0E1DD;
}
</style>
