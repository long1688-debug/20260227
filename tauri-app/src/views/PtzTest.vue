<template>
  <div class="ptz-test">
    <h2>PTZ 云台控制测试</h2>
    
    <PtzControlPanel />
  </div>
</template>

<script setup>
import PtzControlPanel from '@/components/PtzControlPanel.vue'
</script>

<style scoped>
.ptz-test {
  padding: 20px;
}
</style>
