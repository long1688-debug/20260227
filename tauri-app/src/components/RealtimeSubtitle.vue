<template>
  <!-- 实时字幕组件 -->
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue';
import { useRealtimeSubtitle } from '@/composables/useRealtimeSubtitle';

const props = defineProps({
  enabled: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'subtitle-change',
  'recognizing-change',
  'error'
]);

const subtitleText = ref('');
const isRecognizing = ref(false);

const {
  subtitleText: internalSubtitleText,
  isRecognizing: internalIsRecognizing,
  startRealtimeSubtitle,
  stopRealtimeSubtitle
} = useRealtimeSubtitle();

const toggleRealtimeSubtitle = async () => {
  try {
    if (internalIsRecognizing.value) {
      await stopRealtimeSubtitle();
      isRecognizing.value = false;
      emit('recognizing-change', false);
    } else {
      await startRealtimeSubtitle();
      isRecognizing.value = true;
      emit('recognizing-change', true);
    }
  } catch (error) {
    console.error('[RealtimeSubtitle] 切换字幕状态失败:', error);
    emit('error', error);
  }
};

const startSubtitle = async () => {
  try {
    await startRealtimeSubtitle();
    isRecognizing.value = true;
    emit('recognizing-change', true);
  } catch (error) {
    console.error('[RealtimeSubtitle] 启动字幕失败:', error);
    emit('error', error);
  }
};

const stopSubtitle = async () => {
  try {
    await stopRealtimeSubtitle();
    isRecognizing.value = false;
    emit('recognizing-change', false);
  } catch (error) {
    console.error('[RealtimeSubtitle] 停止字幕失败:', error);
    emit('error', error);
  }
};

watch(internalSubtitleText, (newText) => {
  subtitleText.value = newText;
  emit('subtitle-change', newText);
});

watch(internalIsRecognizing, (newVal) => {
  isRecognizing.value = newVal;
});

watch(() => props.enabled, (newVal) => {
  if (newVal && !isRecognizing.value) {
    startSubtitle();
  } else if (!newVal && isRecognizing.value) {
    stopSubtitle();
  }
});

onUnmounted(() => {
  if (isRecognizing.value) {
    stopRealtimeSubtitle();
  }
});

defineExpose({
  toggleRealtimeSubtitle,
  startSubtitle,
  stopSubtitle,
  subtitleText,
  isRecognizing
});
</script>

<style scoped lang="scss">
/* 无样式 - 纯逻辑组件 */
</style>
