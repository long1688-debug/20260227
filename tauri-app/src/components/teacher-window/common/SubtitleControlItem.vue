<template>
  <button class="subtitle-control-item" @click="$emit('click')">
    {{ label }}
  </button>
</template>

<script setup>
defineProps({
  label: {
    type: String,
    required: true
  }
})

defineEmits(['click'])
</script>

<style lang="scss" scoped>
.subtitle-control-item {
  padding: 4px 8px;
  margin-left: 4px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  
  &:hover {
    background: rgba(0, 0, 0, 0.8);
  }
}
</style>
