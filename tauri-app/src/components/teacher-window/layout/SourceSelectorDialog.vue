<template>
  <el-dialog
    v-model="dialogVisible"
    title="选择信号源"
    width="600px"
    :close-on-click-modal="false"
    class="source-selector-dialog"
  >
    <div class="source-categories">
      <el-tabs v-model="activeCategory">
        <el-tab-pane label="摄像头" name="camera">
          <div class="source-list">
            <div
              v-for="source in cameraSources"
              :key="source.id"
              class="source-item"
              :class="{ selected: selectedSource?.id === source.id }"
              @click="selectSource(source)"
            >
              <div class="source-icon">📹</div>
              <div class="source-info">
                <div class="source-name">{{ source.name }}</div>
                <div class="source-meta">{{ source.resolution || '' }} {{ source.fps ? `${source.fps}fps` : '' }}</div>
              </div>
              <el-icon v-if="selectedSource?.id === source.id" class="check-icon"><Check /></el-icon>
            </div>
            <div v-if="cameraSources.length === 0" class="empty-tip">暂无摄像头</div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="本地视频" name="localVideo">
          <div class="source-list">
            <div
              v-for="source in localVideoSources"
              :key="source.id"
              class="source-item"
              :class="{ selected: selectedSource?.id === source.id }"
              @click="selectSource(source)"
            >
              <div class="source-icon">🎬</div>
              <div class="source-info">
                <div class="source-name">{{ source.name }}</div>
                <div class="source-meta">{{ source.duration || '' }} {{ source.size || '' }}</div>
              </div>
              <el-icon v-if="selectedSource?.id === source.id" class="check-icon"><Check /></el-icon>
            </div>
            <div v-if="localVideoSources.length === 0" class="empty-tip">暂无本地视频</div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="屏幕共享" name="screen">
          <div class="source-list">
            <div
              v-for="source in screenSources"
              :key="source.id"
              class="source-item"
              :class="{ selected: selectedSource?.id === source.id }"
              @click="selectSource(source)"
            >
              <div class="source-icon">🖥️</div>
              <div class="source-info">
                <div class="source-name">{{ source.name }}</div>
                <div class="source-meta">{{ source.resolution || '' }}</div>
              </div>
              <el-icon v-if="selectedSource?.id === source.id" class="check-icon"><Check /></el-icon>
            </div>
            <div v-if="screenSources.length === 0" class="empty-tip">暂无屏幕共享</div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="文档课件" name="document">
          <div class="source-list">
            <div
              v-for="source in documentSources"
              :key="source.id"
              class="source-item"
              :class="{ selected: selectedSource?.id === source.id }"
              @click="selectSource(source)"
            >
              <div class="source-icon">📄</div>
              <div class="source-info">
                <div class="source-name">{{ source.name }}</div>
                <div class="source-meta">{{ getSourceTypeLabel(source.type) }}</div>
              </div>
              <el-icon v-if="selectedSource?.id === source.id" class="check-icon"><Check /></el-icon>
            </div>
            <div v-if="documentSources.length === 0" class="empty-tip">暂无文档课件</div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleCancel">取消</el-button>
        <el-button type="primary" @click="handleConfirm" :disabled="!selectedSource">
          添加到预览
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Check } from '@element-plus/icons-vue'
import { useSourceStore } from '@/stores/sourceStore'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'select'])

const sourceStore = useSourceStore()

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const activeCategory = ref('camera')
const selectedSource = ref(null)

const cameraSources = computed(() => sourceStore.cameraSources)
const localVideoSources = computed(() => sourceStore.localVideoSources)
const screenSources = computed(() => sourceStore.screenSources)
const documentSources = computed(() => sourceStore.documentSources)

const selectSource = (source) => {
  selectedSource.value = source
}

const getSourceTypeLabel = (type) => {
  const labels = {
    ppt: 'PPT',
    word: 'Word',
    pdf: 'PDF',
    mindmap: '思维导图'
  }
  return labels[type] || type
}

const handleCancel = () => {
  selectedSource.value = null
  dialogVisible.value = false
}

const handleConfirm = () => {
  if (selectedSource.value) {
    emit('select', selectedSource.value)
    selectedSource.value = null
    dialogVisible.value = false
  }
}
</script>

<style scoped>
.source-selector-dialog :deep(.el-dialog__body) {
  padding: 0;
}

.source-categories {
  min-height: 300px;
}

.source-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  max-height: 350px;
  overflow-y: auto;
}

.source-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid #eee;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.source-item:hover {
  background: #f5f7fa;
  border-color: #4cc9f0;
}

.source-item.selected {
  background: rgba(76, 201, 240, 0.1);
  border-color: #4cc9f0;
}

.source-icon {
  font-size: 24px;
}

.source-info {
  flex: 1;
}

.source-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.source-meta {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.check-icon {
  color: #4cc9f0;
  font-size: 20px;
}

.empty-tip {
  text-align: center;
  color: #999;
  padding: 40px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
