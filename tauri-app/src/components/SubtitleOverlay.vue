<template>
  <div v-if="subtitleText || realtimeSubtitleText" class="subtitle-overlay">
    <div class="subtitle-text">{{ realtimeSubtitleText || subtitleText }}</div>
  </div>
</template>

<script setup>
defineProps({
  subtitleText: {
    type: String,
    default: ''
  },
  realtimeSubtitleText: {
    type: String,
    default: ''
  }
});
</script>

<style scoped lang="scss">
.subtitle-overlay {
  position: absolute;
  bottom: 48px;
  left: 50%;
  transform: translateX(-50%);
  max-width: 80%;
  text-align: center;
  pointer-events: none;

  .subtitle-text {
    display: inline-block;
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
    padding: 8px 20px;
    border-radius: 20px;
    font-size: 16px;
    line-height: 1.4;
    white-space: pre-wrap;
    word-break: break-word;
  }
}
</style>
