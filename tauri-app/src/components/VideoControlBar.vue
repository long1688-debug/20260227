<template>
  <div class="control-bar">
    <!-- 🎯 流媒体信息 -->
    <div v-if="isStreaming" class="stream-info">
      <el-tag size="small" type="success">ZLMediaKit</el-tag>
      <el-tag v-if="streamType" size="small" type="info">{{ streamType }}</el-tag>
    </div>

    <!-- 视频播放控制 -->
    <VideoControls
      v-if="hasVideoRef"
      :show-controls="true"
      :is-playing="!isPaused"
      :current-time="currentTime"
      :duration="duration"
      :volume="volume"
      :is-muted="isMuted"
      @seek="handleSeek"
      @toggle-play="togglePlayPause"
      @toggle-mute="toggleMute"
      @volume-change="handleVolumeChange"
      @toggle-fullscreen="toggleFullscreen"
    />

    <!-- 录制控制 -->
    <div class="record-controls">
      <el-button
        :type="isRecording ? 'danger' : 'primary'"
        :icon="isRecording ? 'Close' : VideoCamera"
        @click="toggleRecording"
      >
        {{ isRecording ? '停止录制' : '开始录制' }}
      </el-button>

      <!-- 实时字幕控制 -->
      <el-button
        :type="isRecognizing ? 'warning' : 'success'"
        @click="toggleRealtimeSubtitle"
      >
        {{ isRecognizing ? '停止字幕' : '实时字幕' }}
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { VideoCamera } from '@element-plus/icons-vue';
import VideoControls from './teacher-window/video/VideoControls.vue';

const props = defineProps({
  isStreaming: {
    type: Boolean,
    default: false
  },
  streamType: {
    type: String,
    default: ''
  },
  hasVideoRef: {
    type: Boolean,
    default: true
  },
  isPaused: {
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
    default: 1
  },
  isMuted: {
    type: Boolean,
    default: false
  },
  isRecording: {
    type: Boolean,
    default: false
  },
  isRecognizing: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'seek',
  'toggle-play',
  'toggle-mute',
  'volume-change',
  'toggle-fullscreen',
  'toggle-recording',
  'toggle-realtime-subtitle'
]);

const handleSeek = (time) => {
  emit('seek', time);
};

const togglePlayPause = () => {
  emit('toggle-play');
};

const toggleMute = () => {
  emit('toggle-mute');
};

const handleVolumeChange = (volume) => {
  emit('volume-change', volume);
};

const toggleFullscreen = () => {
  emit('toggle-fullscreen');
};

const toggleRecording = () => {
  emit('toggle-recording');
};

const toggleRealtimeSubtitle = () => {
  emit('toggle-realtime-subtitle');
};
</script>

<style scoped lang="scss">
.control-bar {
  background: #1B263B;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  min-height: 60px;

  .stream-info {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .record-controls {
    display: flex;
    gap: 8px;
    margin-left: auto;
  }
}
</style>
