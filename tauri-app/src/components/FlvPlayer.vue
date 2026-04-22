<template>
  <!-- FLV播放器组件 - 无 DOM 输出，仅处理 FLV 流逻辑 -->
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue';
import flvjs from 'flv.js';

const props = defineProps({
  videoRef: {
    type: Object,
    default: null
  },
  streamUrl: {
    type: String,
    default: ''
  },
  sourceId: {
    type: String,
    default: ''
  }
});

const emit = defineEmits([
  'stream-start',
  'stream-error',
  'stream-end',
  'stream-buffer'
]);

const isStreaming = ref(false);
const streamType = ref('');
let flvPlayer = null;

const initFlvPlayer = (streamUrl) => {
  if (!props.videoRef?.value) {
    console.warn('[FlvPlayer] 无法初始化 FLV 播放器：videoRef 不存在');
    return;
  }

  cleanupFlvPlayer();

  try {
    if (!flvjs.isSupported()) {
      console.warn('[FlvPlayer] 浏览器不支持 FLV.js，回退到原生播放');
      props.videoRef.value.src = streamUrl;
      props.videoRef.value.load();
      isStreaming.value = true;
      streamType.value = 'Native';
      emit('stream-start', { streamUrl, sourceId: props.sourceId });
      return;
    }

    flvPlayer = flvjs.createPlayer({
      type: 'flv',
      url: streamUrl,
      isLive: true,
      hasAudio: true,
      hasVideo: true,
      enableStashBuffer: true,
      stashInitialSize: 128
    });

    flvPlayer.attachMediaElement(props.videoRef.value);
    
    flvPlayer.on(flvjs.Events.ERROR, (error) => {
      console.error('[FlvPlayer] FLV 播放器错误:', error);
      emit('stream-error', { error, sourceId: props.sourceId });
    });

    flvPlayer.on(flvjs.Events.LOADING_COMPLETE, () => {
      console.log('[FlvPlayer] FLV 加载完成');
    });

    flvPlayer.on(flvjs.Events.STATISTICS_INFO, (info) => {
      // 统计信息回调
    });

    flvPlayer.load();
    isStreaming.value = true;
    streamType.value = 'FLV';
    emit('stream-start', { streamUrl, sourceId: props.sourceId });
    console.log('[FlvPlayer] FLV 播放器初始化完成');
  } catch (error) {
    console.error('[FlvPlayer] 初始化 FLV 播放器失败:', error);
    emit('stream-error', { error, sourceId: props.sourceId });
    fallbackToNative(streamUrl);
  }
};

const fallbackToNative = (streamUrl) => {
  if (!props.videoRef?.value) return;
  
  props.videoRef.value.src = streamUrl;
  props.videoRef.value.load();
  isStreaming.value = true;
  streamType.value = 'Native';
  console.log('[FlvPlayer] 回退到原生播放');
};

const cleanupFlvPlayer = () => {
  if (flvPlayer) {
    try {
      flvPlayer.destroy();
      flvPlayer = null;
    } catch (error) {
      console.warn('[FlvPlayer] 销毁 FLV 播放器时出错:', error);
    }
  }
  isStreaming.value = false;
  streamType.value = '';
};

watch(() => props.streamUrl, (newUrl) => {
  if (newUrl) {
    initFlvPlayer(newUrl);
  }
});

onUnmounted(() => {
  cleanupFlvPlayer();
});

defineExpose({
  initFlvPlayer,
  cleanupFlvPlayer,
  isStreaming: () => isStreaming.value,
  streamType: () => streamType.value
});
</script>

<style scoped lang="scss">
/* 无样式 - 纯逻辑组件 */
</style>
