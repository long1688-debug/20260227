<template>
  <div class="multi-view-manager">
    <!-- 信号源选择按钮 -->
    <el-button type="primary" @click="showSourceSelector = true">
      <el-icon><Plus /></el-icon>
      添加信号源
    </el-button>

    <!-- 信号源选择弹窗 -->
    <SourceSelectorDialog
      v-model="showSourceSelector"
      @select="handleSourceSelect"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { useVideoSync } from '@/composables/useVideoSync'
import { useSourceStore } from '@/stores/sourceStore'
import SourceSelectorDialog from './SourceSelectorDialog.vue'

const emit = defineEmits(['source-added'])

const { setLayout, currentLayout, canvasSourceMap, addSource, setCanvasSource, getVisibleCanvasCount } = useVideoSync()
const sourceStore = useSourceStore()

const showSourceSelector = ref(false)

/**
 * 处理信号源选择
 */
const handleSourceSelect = (source) => {
  console.log('[MultiViewManager] 选择信号源:', source.name)

  // 添加到预览栏
  sourceStore.addSourceToPreview(source)

  // 同时添加到视频同步系统
  addSource(source)

  // 找到第一个空网格并添加
  const currentLayoutVal = currentLayout.value
  const slotCount = getVisibleCanvasCount(currentLayoutVal)
  for (let i = 1; i <= slotCount; i++) {
    if (!canvasSourceMap.value[i]) {
      setCanvasSource(i, source)
      break
    }
  }

  // 触发事件
  emit('source-added', source)
}
</script>

<style scoped>
.multi-view-manager {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 8px;
}
</style>
