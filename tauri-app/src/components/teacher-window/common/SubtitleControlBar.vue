<template>
  <div v-if="hasSubtitles" class="subtitle-control-bar">
    <SubtitleControlItem
      label="📋 管理字幕"
      @click="$emit('manage-subtitles')"
    />
    <SubtitleControlItem
      label="💾 导出全部"
      @click="$emit('export-subtitles')"
    />
    <SubtitleControlItem
      label="📂 导入字幕"
      @click="$emit('import-subtitles')"
    />
    <SubtitleControlItem
      label="清除字幕"
      @click="$emit('clear-subtitles')"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useSubtitleStore } from '@/stores/subtitleStore'
import SubtitleControlItem from './SubtitleControlItem.vue'

const subtitleStore = useSubtitleStore()
const hasSubtitles = computed(() => subtitleStore.subtitles.length > 0)

defineEmits([
  'manage-subtitles',
  'export-subtitles',
  'import-subtitles',
  'clear-subtitles'
])
</script>

<style lang="scss" scoped>
.subtitle-control-bar {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10001;
}
</style>
