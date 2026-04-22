<template>
  <div class="audio-level-indicator" title="音频电平">
    <div class="audio-bar-container">
      <div
        v-for="i in 10"
        :key="i"
        class="audio-bar"
        :class="{ active: i <= level, warning: level > 8 && i === level, danger: level >= 10 && i === level }"
      />
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  level: {
    type: Number,
    default: 0,
    validator: (value) => value >= 0 && value <= 10
  }
})
</script>

<style lang="scss" scoped>
.audio-level-indicator {
  display: flex;
  align-items: center;
  gap: 2px;
}

.audio-bar-container {
  display: flex;
  gap: 2px;
  align-items: flex-end;
  height: 20px;
}

.audio-bar {
  width: 3px;
  background: #333;
  border-radius: 1px;
  transition: background 0.1s;
  
  @for $i from 1 through 10 {
    &:nth-child(#{$i}) {
      height: #{$i * 2}px;
    }
  }
  
  &.active {
    background: #4CAF50;
  }
  
  &.active.warning {
    background: #FFC107;
  }
  
  &.active.danger {
    background: #F44336;
  }
}
</style>
