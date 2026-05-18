<template>
  <div v-if="showSubtitle" class="global-subtitle-overlay">
    <div class="global-subtitle-text">{{ subtitleText }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useSubtitleStore } from '@/stores/subtitleStore'

const subtitleStore = useSubtitleStore()

// 计算属性：决定显示哪种字幕
const hasRegularSubtitles = computed(() => subtitleStore.subtitles.length > 0)
const showSubtitle = computed(() => {
  // 如果启用了实时字幕，则显示实时字幕；否则显示常规字幕
  if (subtitleStore.isRealtimeSubtitleEnabled && subtitleStore.realtimeSubtitleText) {
    return true
  }
  return hasRegularSubtitles.value && subtitleStore.currentSubtitle
})

const subtitleText = computed(() => {
  // 如果启用了实时字幕，则显示实时字幕；否则显示常规字幕
  if (subtitleStore.isRealtimeSubtitleEnabled && subtitleStore.realtimeSubtitleText) {
    return subtitleStore.realtimeSubtitleText
  }
  return subtitleStore.currentSubtitle
})
</script>

<style lang="scss" scoped>
.global-subtitle-overlay {
  position: absolute;
  bottom: 30px;
  left: 0;
  right: 0;
  padding: 0 40px;
  background: transparent;
  z-index: 10000;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;

  .global-subtitle-text {
    display: inline-block;
    padding: 10px 20px;
    background: rgba(0, 0, 0, 0.75);
    color: #ffffff;
    font-size: 22px;
    font-weight: 500;
    font-family: "Microsoft YaHei", "微软雅黑", "PingFang SC", "苹方", "Noto Sans SC", sans-serif;
    text-align: center;
    border-radius: 6px;
    text-shadow: 1px 1px 4px rgba(0, 0, 0, 0.9);
    line-height: 1.6;
    max-width: 85%;
  }
}
</style>
