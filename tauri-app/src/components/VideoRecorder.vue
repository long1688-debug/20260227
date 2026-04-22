<template>
  <!-- 录制控制组件 - 无 DOM 输出，仅处理录制逻辑 -->
</template>

<script setup>
import { ref, watch, onUnmounted, computed } from 'vue';
import { useRecording } from '@/composables/useRecording';

const props = defineProps({
  videoRef: {
    type: Object,
    default: null
  },
  index: {
    type: Number,
    default: 0
  },
  sourceId: {
    type: String,
    default: ''
  }
});

const emit = defineEmits([
  'recording-start',
  'recording-stop',
  'recording-pause',
  'recording-resume',
  'recording-time-update'
]);

const isRecording = ref(false);
const isRecordingPaused = ref(false);
const recordingTime = ref(0);
let recordingTimer = null;

const { 
  startRecording: startRecord, 
  stopRecording: stopRecord, 
  pauseRecording: pauseRecord, 
  resumeRecording: resumeRecord,
  currentRecordingSession,
  recordingTime: recordingTimeState
} = useRecording();

// 从 currentRecordingSession 中提取状态
const recordingState = computed(() => currentRecordingSession.value?.isRecording || false);
const recordingPausedState = computed(() => currentRecordingSession.value?.isPaused || false);

const startRecording = async () => {
  if (!props.videoRef?.value) {
    console.warn('[VideoRecorder] 无法开始录制：videoRef 不存在');
    return;
  }

  try {
    await startRecord(props.videoRef.value, props.index);
    isRecording.value = true;
    isRecordingPaused.value = false;
    startRecordingTimer();
    emit('recording-start', { index: props.index, sourceId: props.sourceId });
    console.log('[VideoRecorder] 开始录制');
  } catch (error) {
    console.error('[VideoRecorder] 开始录制失败:', error);
    throw error;
  }
};

const stopRecording = () => {
  stopRecord(props.index);
  isRecording.value = false;
  isRecordingPaused.value = false;
  stopRecordingTimer();
  emit('recording-stop', { index: props.index, sourceId: props.sourceId });
  console.log('[VideoRecorder] 停止录制');
};

const pauseRecording = () => {
  pauseRecord(props.index);
  isRecordingPaused.value = true;
  stopRecordingTimer();
  emit('recording-pause', { index: props.index, sourceId: props.sourceId });
  console.log('[VideoRecorder] 暂停录制');
};

const resumeRecording = () => {
  resumeRecord(props.index);
  isRecordingPaused.value = false;
  startRecordingTimer();
  emit('recording-resume', { index: props.index, sourceId: props.sourceId });
  console.log('[VideoRecorder] 恢复录制');
};

const startRecordingTimer = () => {
  stopRecordingTimer();
  recordingTimer = setInterval(() => {
    recordingTime.value++;
    emit('recording-time-update', recordingTime.value);
  }, 1000);
};

const stopRecordingTimer = () => {
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
};

watch(recordingState, (newVal) => {
  isRecording.value = newVal;
});

watch(recordingPausedState, (newVal) => {
  isRecordingPaused.value = newVal;
});

watch(recordingTimeState, (newVal) => {
  recordingTime.value = newVal;
});

onUnmounted(() => {
  stopRecordingTimer();
  if (isRecording.value) {
    stopRecording();
  }
});

defineExpose({
  startRecording,
  stopRecording,
  pauseRecording,
  resumeRecording,
  isRecording: () => isRecording.value,
  isRecordingPaused: () => isRecordingPaused.value,
  recordingTime: () => recordingTime.value
});
</script>

<style scoped lang="scss">
/* 无样式 - 纯逻辑组件 */
</style>
