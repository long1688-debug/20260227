<template>
  <el-dialog
    v-model="visible"
    title="屏幕共享"
    width="500px"
    top="3vh"
    class="screen-share-dialog-wrapper"
    :z-index="2000"
    append-to-body
  >
    <div class="screen-share-dialog">
      <p>选择要共享的屏幕或窗口：</p>
      <div class="share-options">
        <el-button type="primary" @click="handleStartShare('screen')">
          <el-icon><Monitor /></el-icon>
          共享整个屏幕
        </el-button>
        <el-button type="success" @click="handleStartShare('window')">
          <el-icon><VideoCamera /></el-icon>
          共享窗口
        </el-button>
        <el-button type="info" @click="handleStartShare('tab')">
          <el-icon><Document /></el-icon>
          共享浏览器标签页
        </el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue'
import { Monitor, VideoCamera, Document } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  modelValue: Boolean
})

const emit = defineEmits(['update:modelValue', 'start'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

// 开始屏幕共享
const handleStartShare = async (type) => {
  try {
    let stream = null

    // 根据类型获取不同的媒体流
    switch (type) {
      case 'screen':
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        })
        break
      case 'window':
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: 'window'
          },
          audio: true
        })
        break
      case 'tab':
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: 'browser'
          },
          audio: true
        })
        break
    }

    if (stream) {
      emit('start', { type, stream })
      ElMessage.success(`已开始${getShareTypeName(type)}共享`)
      visible.value = false
    }
  } catch (error) {
    console.error('[ScreenShare] 共享失败:', error)
    if (error.name !== 'NotAllowedError') {
      ElMessage.error('屏幕共享失败: ' + error.message)
    }
  }
}

// 获取共享类型名称
const getShareTypeName = (type) => {
  const names = {
    screen: '屏幕',
    window: '窗口',
    tab: '浏览器标签页'
  }
  return names[type] || '未知'
}
</script>

<style lang="scss" scoped>
// 🎯 滚动条样式 mixin
@mixin custom-scrollbar {
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 3px;

    &:hover {
      background: #555;
    }
  }
}

// 🎯 弹窗包装类样式
.screen-share-dialog-wrapper {
  :deep(.el-dialog__body) {
    max-height: calc(100vh - 150px);
    overflow-y: auto;
    padding: 20px;
    @include custom-scrollbar;
  }
}

.screen-share-dialog {
  p {
    margin-bottom: 20px;
    color: #fff;
    font-size: 14px;
  }

  .share-options {
    display: flex;
    flex-direction: column;
    gap: 12px;

    .el-button {
      width: 100%;
      height: 50px;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
  }
}
</style>
