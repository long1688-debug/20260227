<template>
  <Transition name="fade">
    <div 
      v-if="visible" 
      class="drop-overlay"
      :class="[`drop-overlay--${type}`, { 'drop-overlay--active': isActive }]"
    >
      <div class="drop-overlay__content">
        <el-icon class="drop-overlay__icon"><Plus /></el-icon>
        <span class="drop-overlay__text">{{ overlayText }}</span>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Plus } from '@element-plus/icons-vue'

interface Props {
  /** 是否显示覆盖层 */
  visible: boolean
  /** 覆盖层类型 */
  type?: 'video' | 'pip' | 'canvas'
  /** 是否处于激活状态（拖拽中） */
  isActive?: boolean
  /** 自定义提示文本 */
  customText?: string
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  type: 'video',
  isActive: false,
  customText: ''
})

/**
 * 计算属性：覆盖层提示文本
 */
const overlayText = computed(() => {
  if (props.customText) return props.customText
  
  const textMap: Record<string, string> = {
    video: '释放以添加视频源',
    pip: '释放以设置画中画',
    canvas: '释放到画布区域'
  }
  
  return textMap[props.type] || '释放以添加'
})
</script>

<style scoped lang="scss">
.drop-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(64, 158, 255, 0.1);
  border: 2px dashed #409eff;
  border-radius: 8px;
  z-index: 10;
  transition: all 0.3s ease;

  &--active {
    background: rgba(64, 158, 255, 0.2);
    border-color: #66b1ff;
    transform: scale(1.02);
  }

  &--video {
    border-color: #409eff;
  }

  &--pip {
    border-color: #67c23a;
    background: rgba(103, 194, 58, 0.1);
  }

  &--canvas {
    border-color: #e6a23c;
    background: rgba(230, 162, 60, 0.1);
  }

  &__content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: #409eff;
  }

  &__icon {
    font-size: 32px;
    animation: pulse 1.5s ease-in-out infinite;
  }

  &__text {
    font-size: 14px;
    font-weight: 500;
  }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
