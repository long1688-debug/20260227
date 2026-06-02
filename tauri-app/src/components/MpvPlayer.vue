<template>
  <!-- mpv播放器组件 - 无 DOM 输出，仅处理流逻辑 -->
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue';
import { MpvPlayer } from '@/utils/mpv-player';

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
let mpvPlayer = null;

// 生成唯一的播放器ID
const generatePlayerId = () => {
  return `mpv_${props.sourceId || Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const initMpvPlayer = async (streamUrl) => {
  // 清理旧播放器
  cleanupMpvPlayer();

  try {
    // 检查 mpv 是否可用
    const isMpvAvailable = await MpvPlayer.isAvailable();
    if (!isMpvAvailable) {
      console.warn('[MpvPlayer] mpv 不可用，回退到原生播放');
      fallbackToNative(streamUrl);
      return;
    }

    // 创建 mpv 播放器实例
    const playerId = generatePlayerId();
    mpvPlayer = new MpvPlayer(playerId, { autoCreate: true });

    // 设置事件回调
    mpvPlayer.on('play', () => {
      console.log('[MpvPlayer] mpv 播放开始');
      isStreaming.value = true;
      streamType.value = 'MPV';
      emit('stream-start', { streamUrl, sourceId: props.sourceId });
    });

    mpvPlayer.on('pause', () => {
      console.log('[MpvPlayer] mpv 播放暂停');
    });

    mpvPlayer.on('stop', () => {
      console.log('[MpvPlayer] mpv 播放停止');
      isStreaming.value = false;
      emit('stream-end', { sourceId: props.sourceId });
    });

    mpvPlayer.on('error', (error) => {
      console.error('[MpvPlayer] mpv 播放器错误:', error);
      emit('stream-error', { error, sourceId: props.sourceId });
      // 失败时回退到原生播放
      fallbackToNative(streamUrl);
    });

    mpvPlayer.on('stats', (stats) => {
      // 统计信息回调
      console.debug('[MpvPlayer] 统计信息:', stats);
    });

    // 播放 RTSP 流
    await mpvPlayer.playRtsp(streamUrl);
    
    console.log('[MpvPlayer] mpv 播放器初始化完成');
    
  } catch (error) {
    console.error('[MpvPlayer] 初始化 mpv 播放器失败:', error);
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
  console.log('[MpvPlayer] 回退到原生播放');
  
  // 设置原生video的事件处理
  props.videoRef.value.addEventListener('error', (event) => {
    console.error('[MpvPlayer] 原生播放错误:', event);
    emit('stream-error', { error: event, sourceId: props.sourceId });
  });
  
  props.videoRef.value.addEventListener('play', () => {
    emit('stream-start', { streamUrl, sourceId: props.sourceId });
  });
  
  props.videoRef.value.addEventListener('ended', () => {
    emit('stream-end', { sourceId: props.sourceId });
  });
};

const cleanupMpvPlayer = async () => {
  if (mpvPlayer) {
    try {
      await mpvPlayer.destroy();
      mpvPlayer = null;
    } catch (error) {
      console.warn('[MpvPlayer] 销毁 mpv 播放器时出错:', error);
    }
  }
  isStreaming.value = false;
  streamType.value = '';
};

watch(() => props.streamUrl, (newUrl) => {
  if (newUrl) {
    initMpvPlayer(newUrl);
  }
});

onUnmounted(() => {
  cleanupMpvPlayer();
});

defineExpose({
  initMpvPlayer,
  cleanupMpvPlayer,
  isStreaming: () => isStreaming.value,
  streamType: () => streamType.value
});
</script>

<style scoped lang="scss">
/* 无样式 - 纯逻辑组件 */
</style>