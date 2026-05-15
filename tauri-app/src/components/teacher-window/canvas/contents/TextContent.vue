<template>
  <div class="text-content" :style="textStyle">
    {{ source.properties?.content || '双击编辑文本' }}
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  source: Object
});

const textStyle = computed(() => ({
  padding: '10px',
  fontSize: (props.source.properties?.fontSize || 16) + 'px',
  color: props.source.properties?.color || '#ffffff',
  fontFamily: props.source.properties?.fontFamily || 'Arial',
  textAlign: props.source.properties?.textAlign || 'left',
  lineHeight: 1.5,
  overflow: 'auto'
}));
</script>

<style scoped lang="scss">
.text-content {
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.3);
  word-wrap: break-word;
  overflow-wrap: break-word;
}
</style>
