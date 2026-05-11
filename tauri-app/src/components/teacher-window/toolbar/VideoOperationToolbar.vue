<template>
  <div class="video-operation-toolbar">
    <!-- 标注控制按钮 -->
    <button class="toolbar-btn" :class="{ active: isAnnotationEnabled }" @click="$emit(isAnnotationEnabled ? 'disable-annotation' : 'enable-annotation')">
      <span>✏️</span>
      <span>{{ isAnnotationEnabled ? '标注中' : '批注' }}</span>
    </button>

    <!-- 🎯 预留功能按钮（多机位、色键抠像、VR录制） -->
    <button class="toolbar-btn" @click="$emit('show-multicam-dialog')" title="多机位切换">
      <span>📹</span>
      <span>多机位</span>
    </button>

    <button class="toolbar-btn" @click="$emit('show-chromakey-dialog')" title="色键抠像">
      <span>🎨</span>
      <span>色键</span>
    </button>

    <button class="toolbar-btn" @click="$emit('show-vr-dialog')" title="VR录制">
      <span>🥽</span>
      <span>VR录制</span>
    </button>

    <!-- 暂停录制 -->
    <button
      v-if="isRecording"
      class="toolbar-btn"
      :class="{ active: isRecordingPaused }"
      @click="$emit('pause-recording')"
    >
      <span>⏸️</span>
      <span>{{ isRecordingPaused ? '继续录制' : '暂停录制' }}</span>
    </button>

    <!-- 停止录制 -->
    <button
      v-if="isRecording"
      class="toolbar-btn"
      @click="$emit('stop-recording')"
    >
      <span>⏹️</span>
      <span>停止录制</span>
    </button>

    <!-- 录制管理 -->
    <button class="toolbar-btn" @click="$emit('show-recording-dialog')">
      <span>📁</span>
      <span>录制管理</span>
    </button>

    <!-- 设置 -->
    <button class="toolbar-btn" @click="$emit('show-settings-dialog')">
      <span>⚙️</span>
      <span>设置</span>
    </button>
  </div>
</template>

<script setup>
// 🎯 RecordingFeatureSelector 已删除，功能直接内联到工具栏中

defineProps({
  isRecording: {
    type: Boolean,
    default: false
  },
  isRecordingPaused: {
    type: Boolean,
    default: false
  },
  isAnnotationEnabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'enable-annotation',
  'disable-annotation',
  'show-multicam-dialog',
  'show-chromakey-dialog',
  'show-vr-dialog',
  'pause-recording',
  'stop-recording',
  'show-recording-dialog',
  'show-settings-dialog'
])

</script>

<style lang="scss" scoped>
.video-operation-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  -webkit-app-region: no-drag;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  height: 36px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  color: #e0e1dd;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.25);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }

  &.active {
    background: rgba(76, 201, 240, 0.2);
    border-color: rgba(76, 201, 240, 0.5);
    color: #4cc9f0;
  }

  span:first-child {
    font-size: 16px;
  }

  .dropdown-arrow {
    font-size: 10px;
    opacity: 0.7;
    margin-left: 2px;
  }
}

.el-button-group {
  display: flex;
  
  :deep(.el-button) {
    margin: 0;
  }
}
</style>
