<template>
  <div class="video-header">
    <div class="video-actions">
      <!-- 第一组：摄像头操作 -->
      <button class="action-btn" @click="enableAnnotationForAll" title="启用批注">
        <el-icon><EditPen /></el-icon>
        <span>批注</span>
      </button>

      <!-- 第二组：录制功能 -->
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

      <button
        class="action-btn"
        :class="{ active: isRecordingPaused }"
        @click="pauseAllCanvasRecording"
        title="暂停录制"
      >
        <el-icon><VideoPause /></el-icon>
        <span>暂停录制</span>
      </button>
      <button
        class="action-btn"
        :class="{ active: isRecording }"
        @click="stopAllCanvasRecording"
        title="停止录制"
      >
        <el-icon><VideoStop /></el-icon>
        <span>停止录制</span>
      </button>

      <!-- 第四组：推流和管理 -->
      <button class="action-btn" @click="$emit('show-rtmp-dialog')" title="RTMP推流">
        <el-icon><Connection /></el-icon>
        <span>RTMP推流</span>
      </button>
      <button class="action-btn" @click="$emit('show-recording-dialog')" title="录制管理">
        <el-icon><FolderOpened /></el-icon>
        <span>录制管理</span>
      </button>
      <button class="action-btn" @click="$emit('show-settings-dialog')" title="设置">
        <el-icon><Setting /></el-icon>
        <span>设置</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  EditPen,
  VideoCamera,
  VideoPause,
  VideoPlay,
  VideoStop,
  Connection,
  FolderOpened,
  Setting,
  ArrowDown
} from '@/components/icons'

const props = defineProps({
  // 移除 currentLayout 和 customGridCount props
})

const emit = defineEmits([
  'show-recording-dialog',
  'show-settings-dialog',
  'show-multicam-dialog',
  'show-rtmp-dialog',
  'show-vr-dialog',
  'show-chromakey-dialog',
  'start-multi-recording',  // 触发预览区域录制(轻量级 MediaRecorder)
  'stop-multi-recording'
])

const isRecording = ref(false)
const isRecordingPaused = ref(false)

// 保留此函数以防其他地方引用
const refreshAllCameras = () => {
  ElMessage.info('刷新所有摄像头')
}

const handleRecordingCommand = (command) => {
  if (command === 'multicam') {
    // 触发多路摄像头录制 - 控制预览区域的单个信号源
    console.log('[录制-预览区域] 触发多路摄像头录制')
    emit('start-multi-recording')
  } else if (command === 'chromakey') {
    emit('show-chromakey-dialog')
  } else if (command === 'vr') {
    emit('show-vr-dialog')
  }
}

// 移除 handleLayoutChange 和 handleCustomCountChange 函数

const enableAnnotationForAll = () => {
  ElMessage.info('启用批注模式')
}

// 注意: 这些函数仅用于本地状态显示,实际录制由 TeacherWindow 处理
const startAllCanvasRecording = () => {
  isRecording.value = true
  isRecordingPaused.value = false
  ElMessage.success('开始录制所有画布')
}

const pauseAllCanvasRecording = () => {
  isRecordingPaused.value = !isRecordingPaused.value
  ElMessage.warning(isRecordingPaused.value ? '恢复录制' : '暂停录制')
}

const stopAllCanvasRecording = () => {
  isRecording.value = false
  isRecordingPaused.value = false
  ElMessage.error('停止录制')
  // 触发停止多路录制 - 控制预览区域
  console.log('[录制-预览区域] 停止多路录制')
  emit('stop-multi-recording')
}
</script>

<style lang="scss" scoped>
.video-header {
  height: 50px;
  background: #0D1B2A;
  display: flex;
  align-items: center;
  padding: 0 15px;
  flex-shrink: 0;
  border-bottom: 1px solid #1A2A3A;
}

.video-actions {
  display: flex;
  gap: 4px;
  flex-wrap: nowrap;
  align-items: center;

  .action-btn {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 5px 8px;
    border: none;
    background: #0F2035;
    color: #E0E1DD;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 12px;
    font-family: inherit;
    white-space: nowrap;

    &:hover {
      background: #415A77;
      transform: translateY(-2px);
    }

    &.active {
      background: #4CC9F0;
      color: #0D1B2A;
      font-weight: 600;
    }

    .el-icon {
      font-size: 16px;
    }

    .dropdown-icon {
      font-size: 12px;
      margin-left: 2px;
    }
  }
}
</style>
