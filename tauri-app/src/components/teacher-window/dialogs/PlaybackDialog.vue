<template>
  <el-dialog
    v-model="visible"
    title="录制回放"
    width="100%"
    :fullscreen="true"
    class="playback-dialog"
  >
    <div class="playback-container">
      <video
        ref="videoRef"
        class="playback-video"
        controls
        autoplay
      ></video>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  videoUrl: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue'])

const visible = ref(props.modelValue)
const videoRef = ref(null)

watch(() => props.modelValue, (val) => {
  visible.value = val
  if (val && props.videoUrl && videoRef.value) {
    videoRef.value.src = props.videoUrl
  }
})

watch(visible, (val) => {
  emit('update:modelValue', val)
  if (!val && videoRef.value) {
    videoRef.value.pause()
    videoRef.value.src = ''
  }
})
</script>

<style lang="scss" scoped>
.playback-dialog {
  :deep(.el-dialog__body) {
    padding: 0;
    height: calc(100vh - 60px);
  }
}

.playback-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}

.playback-video {
  max-width: 100%;
  max-height: 100%;
  outline: none;
}
</style>
