<template>
  <el-dialog
    v-model="visible"
    title="视频转字幕"
    width="600px"
    top="3vh"
    :close-on-click-modal="false"
    class="video-subtitle-dialog-wrapper"
    :z-index="2000"
    append-to-body
  >
    <div class="video-to-subtitle-dialog">
      <el-alert
        title="监听预览区域视频实时转字幕"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      >
        将实时监听预览区域中视频的音频流并转换为字幕
      </el-alert>

      <div v-if="previewVideos.length > 0" class="video-list">
        <h4>可用视频</h4>
        <el-radio-group v-model="selectedVideoIndex">
          <el-radio
            v-for="(video, index) in previewVideos"
            :key="index"
            :value="index"
            @change="onPreviewVideoSelected(index)"
          >
            {{ video.name }}
          </el-radio>
        </el-radio-group>
      </div>

      <div v-else class="no-video">
        <el-empty description="预览区域没有可用的视频" />
      </div>

      <div class="subtitle-options">
        <h4>字幕选项</h4>
        <el-form label-width="120px">
          <el-form-item label="语言">
            <el-select v-model="subtitleLanguage">
              <el-option label="中文" value="zh" />
              <el-option label="英文" value="en" />
              <el-option label="日文" value="ja" />
              <el-option label="韩文" value="ko" />
            </el-select>
          </el-form-item>
          <el-form-item label="模型">
            <el-select v-model="subtitleModel">
              <el-option label="Tiny (最快)" value="tiny" />
              <el-option label="Base (平衡)" value="base" />
              <el-option label="Small (准确)" value="small" />
              <el-option label="Medium (更准确)" value="medium" />
              <el-option label="Large (最准确)" value="large" />
            </el-select>
          </el-form-item>
        </el-form>
      </div>

      <div v-if="isRunning" class="status-section">
        <el-tag type="success" size="large">正在识别中...</el-tag>
        <div class="subtitle-preview">
          {{ subtitleText || '等待语音输入...' }}
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
      <el-button
        :type="isRunning ? 'danger' : 'primary'"
        @click="handleToggle"
        :disabled="selectedVideoIndex === -1"
      >
        {{ isRunning ? '停止识别' : '开始识别' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useSubtitleStore } from '@/stores/subtitleStore'

const props = defineProps({
  modelValue: Boolean,
  videoSources: {
    type: Array,
    default: () => []
  },
  videoToSubtitleService: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update:modelValue', 'start', 'stop'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

// 状态管理
const selectedVideoIndex = ref(-1)
const subtitleLanguage = ref('zh')
const subtitleModel = ref('base')
const isRunning = ref(false)
const subtitleText = ref('')

// 字幕保存
const subtitleStore = useSubtitleStore()
const currentSubtitles = ref([]) // 当前识别的字幕
let subtitleIndexCounter = 0

// 计算属性：获取预览视频列表
const previewVideos = computed(() => {
  return props.videoSources.filter(source => source.type === 'local' || source.type === 'network')
})

// 选择视频
const onPreviewVideoSelected = (index) => {
  console.log('[VideoToSubtitle] 选中视频索引:', index)
}

// 切换识别状态
const handleToggle = async () => {
  if (isRunning.value) {
    // 停止识别并保存字幕
    await props.videoToSubtitleService.stop()

    // 保存识别的字幕到 subtitleStore
    if (currentSubtitles.value.length > 0) {
      const video = previewVideos.value[selectedVideoIndex.value]
      subtitleStore.addSubtitles({
        videoId: video.id,
        videoName: video.name,
        subtitles: currentSubtitles.value
      })
      ElMessage.success(`已保存 ${currentSubtitles.value.length} 条字幕`)
    }

    isRunning.value = false
    subtitleText.value = ''
    currentSubtitles.value = []
    subtitleIndexCounter = 0
    emit('stop')
    ElMessage.success('已停止视频转字幕')
  } else {
    // 开始识别
    if (selectedVideoIndex.value === -1) {
      ElMessage.warning('请先选择一个视频')
      return
    }

    const video = previewVideos.value[selectedVideoIndex.value]
    if (!video) {
      ElMessage.error('选中的视频不存在')
      return
    }

    try {
      // 重置字幕计数器
      subtitleIndexCounter = 0
      currentSubtitles.value = []

      // 添加字幕监听器
      props.videoToSubtitleService.addSubtitleListener((subtitle) => {
        subtitleText.value = subtitle.text

        // 自动保存字幕到 store
        const subtitleEntry = {
          index: ++subtitleIndexCounter,
          startTime: formatTime(subtitle.startTime),
          endTime: formatTime(subtitle.endTime),
          text: subtitle.text
        }
        currentSubtitles.value.push(subtitleEntry)

        // 实时保存到 store
        subtitleStore.addSubtitle({
          videoId: video.id,
          videoName: video.name,
          ...subtitleEntry
        })
      })

      // 启动视频转字幕
      await props.videoToSubtitleService.start(video, {
        language: subtitleLanguage.value,
        model: subtitleModel.value
      })

      isRunning.value = true
      emit('start', { video, language: subtitleLanguage.value, model: subtitleModel.value })
      ElMessage.success('已开始视频转字幕')
    } catch (error) {
      console.error('[VideoToSubtitle] 启动失败:', error)
      ElMessage.error('启动失败: ' + error.message)
    }
  }
}

// 格式化时间为 SRT 格式
const formatTime = (seconds) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)

  const formatNum = (num) => String(num).padStart(2, '0')

  return `${formatNum(hours)}:${formatNum(minutes)}:${formatNum(secs)},${String(ms).padStart(3, '0')}`
}

// 关闭对话框
const handleClose = () => {
  if (isRunning.value) {
    props.videoToSubtitleService.stop()
    isRunning.value = false
  }
  visible.value = false
}
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
.video-subtitle-dialog-wrapper {
  :deep(.el-dialog__body) {
    max-height: calc(100vh - 150px);
    overflow-y: auto;
    padding: 20px;
    @include custom-scrollbar;
  }
}

.video-to-subtitle-dialog {
  .video-list {
    margin-bottom: 20px;

    h4 {
      margin-bottom: 10px;
      color: #fff;
    }

    :deep(.el-radio-group) {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
  }

  .no-video {
    margin-bottom: 20px;
  }

  .subtitle-options {
    margin-bottom: 20px;

    h4 {
      margin-bottom: 10px;
      color: #fff;
    }
  }

  .status-section {
    margin-top: 20px;
    padding: 15px;
    background: rgba(0, 255, 0, 0.1);
    border-radius: 4px;

    .subtitle-preview {
      margin-top: 10px;
      padding: 10px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 4px;
      color: #fff;
      min-height: 40px;
      word-wrap: break-word;
    }
  }
}
</style>
