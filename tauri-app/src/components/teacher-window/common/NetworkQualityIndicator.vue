<template>
  <div class="network-quality" :class="qualityClass" :title="qualityText">
    {{ qualityIcon }}
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  quality: {
    type: String,
    default: 'good',
    validator: (value) => ['excellent', 'good', 'fair', 'poor', 'offline'].includes(value)
  }
})

const qualityClass = computed(() => `quality-${props.quality}`)

const qualityText = computed(() => {
  const map = {
    excellent: '网络质量极佳',
    good: '网络质量良好',
    fair: '网络质量一般',
    poor: '网络质量较差',
    offline: '网络离线'
  }
  return map[props.quality] || '未知'
})

const qualityIcon = computed(() => {
  const map = {
    excellent: '🟢',
    good: '🟡',
    fair: '🟠',
    poor: '🔴',
    offline: '⚫'
  }
  return map[props.quality] || '❓'
})
</script>

<style lang="scss" scoped>
.network-quality {
  font-size: 14px;
  cursor: help;
}

.quality-excellent { filter: brightness(1.2); }
.quality-good { filter: brightness(1); }
.quality-fair { filter: brightness(0.8); }
.quality-poor { filter: brightness(0.6); }
.quality-offline { filter: brightness(0.4); }
</style>
