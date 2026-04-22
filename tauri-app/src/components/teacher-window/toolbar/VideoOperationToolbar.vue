<template>
  <div class="video-operation-toolbar">
    <!-- 批注按钮 -->
    <button
      class="action-btn"
      :class="{ active: isAnnotationEnabled }"
      @click="$emit('enable-annotation')"
      title="启用批注"
    >
      <el-icon><EditPen /></el-icon>
      <span>批注</span>
    </button>

    <!-- 录制下拉菜单 -->
    <el-dropdown trigger="click" @command="handleRecordingCommand">
      <button class="action-btn">
        <el-icon><VideoCamera /></el-icon>
        <span>一键录制</span>
        <el-icon class="dropdown-icon"><ArrowDown /></el-icon>
      </button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="multicam">📹 多路摄像头录制</el-dropdown-item>
          <el-dropdown-item command="chromakey">💚 绿幕抠像</el-dropdown-item>
          <el-dropdown-item command="vr">🌐 VR/360°录制</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <!-- 暂停录制 -->
    <button
      class="action-btn"
      :class="{ active: isRecordingPaused }"
      @click="$emit('pause-recording')"
      title="暂停录制"
    >
      <el-icon><VideoPause /></el-icon>
      <span>暂停录制</span>
    </button>

    <!-- 停止录制 -->
    <button
      class="action-btn"
      :class="{ active: isRecording }"
      @click="$emit('stop-recording')"
      title="停止录制"
    >
      <el-icon><VideoStop /></el-icon>
      <span>停止录制</span>
    </button>

    <!-- 录制管理 -->
    <button
      class="action-btn"
      @click="$emit('show-recording-dialog')"
      title="录制管理"
    >
      <el-icon><FolderOpened /></el-icon>
      <span>录制管理</span>
    </button>

    <!-- 设置 -->
    <button
      class="action-btn"
      @click="$emit('show-settings-dialog')"
      title="设置"
    >
      <el-icon><Setting /></el-icon>
      <span>设置</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import {
  EditPen,
  VideoCamera,
  VideoPause,
  VideoStop,
  FolderOpened,
  Setting,
  ArrowDown
} from '../../icons'

interface Props {
  /** 是否正在录制 */
  isRecording?: boolean
  /** 录制是否已暂停 */
  isRecordingPaused?: boolean
  /** 是否启用批注 */
  isAnnotationEnabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isRecording: false,
  isRecordingPaused: false,
  isAnnotationEnabled: false
})

interface Emits {
  (e: 'enable-annotation'): void
  (e: 'recording-command', command: string): void
  (e: 'pause-recording'): void
  (e: 'stop-recording'): void
  (e: 'show-recording-dialog'): void
  (e: 'show-settings-dialog'): void
}

const emit = defineEmits<Emits>()

/**
 * 处理录制命令
 */
const handleRecordingCommand = (command: string) => {
  emit('recording-command', command)
}
</script>

<style lang="scss" scoped>
.video-operation-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: none;
  background: #0F2035;
  color: #E0E1DD;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 12px;
  font-family: inherit;
  white-space: nowrap;
}

.action-btn:hover {
  background: #415A77;
  transform: translateY(-2px);
}

.action-btn.active {
  background: #4CC9F0;
  color: #0D1B2A;
  font-weight: 600;
}

.action-btn .el-icon {
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dropdown-icon {
  font-size: 12px;
  margin-left: 2px;
}

.el-dropdown {
  display: inline-flex;
}

.el-dropdown .action-btn {
  width: auto;
}
</style>
