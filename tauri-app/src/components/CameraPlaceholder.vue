<template>
  <div class="camera-placeholder" @click="handleClick">
    <span class="camera-icon">📹</span>
    <span class="camera-text">点击启用摄像头</span>
    <el-button size="small" type="primary" @click.stop="handleEnable">
      启用摄像头
    </el-button>
  </div>
</template>

<script setup>
const emit = defineEmits(['enable']);

const handleClick = () => {
  emit('enable');
};

const handleEnable = () => {
  emit('enable');
};
</script>

<style scoped lang="scss">
.camera-placeholder {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.6);
  padding: 32px 48px;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.8);
    transform: translate(-50%, -50%) scale(1.05);
  }

  .camera-icon {
    font-size: 64px;
  }

  .camera-text {
    color: #ADB5BD;
    font-size: 14px;
  }

  .el-button {
    margin-top: 8px;
  }
}
</style>
