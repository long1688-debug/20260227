<template>
  <div class="layout-switcher">
    <div class="layout-buttons">
      <el-tooltip
        v-for="layout in layoutOptions"
        :key="layout.value"
        :content="layout.label"
        placement="top"
      >
        <button
          class="layout-btn"
          :class="{ active: currentLayout === layout.value }"
          @click="handleLayoutChange(layout.value)"
        >
          <span class="layout-icon" v-html="layout.icon"></span>
          <span class="layout-label">{{ layout.value }}</span>
        </button>
      </el-tooltip>
    </div>

    <!-- 自定义网格数量输入 -->
    <div class="custom-grid-input" v-if="showCustomInput">
      <el-input-number
        v-model="customGridCount"
        :min="1"
        :max="49"
        size="small"
        @change="handleCustomChange"
      />
      <el-button type="primary" size="small" @click="applyCustomGrid">
        应用
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useVideoSync } from '@/composables/useVideoSync'

const emit = defineEmits(['layout-change'])

const { currentLayout, setLayout } = useVideoSync()

const customGridCount = ref(4)
const showCustomInput = ref(false)

const layoutOptions = [
  // 新布局索引: 1-1分屏, 2-2分屏, 3-3分屏, 4-4分屏, 5-6分屏, 7-9分屏, 10-16分屏, 11-25分屏, 12-36分屏, 13-49分屏
  { value: 1, label: '1画面', icon: '▢' },
  { value: 2, label: '2画面', icon: '▢▢' },
  { value: 3, label: '3画面', icon: '▢▢▢' },
  { value: 4, label: '4画面', icon: '▢▢<br/>▢▢' },
  { value: 5, label: '6画面', icon: '▢▢▢<br/>▢▢▢' },
  { value: 7, label: '9画面', icon: '▢▢▢<br/>▢▢▢<br/>▢▢▢' },
  { value: 10, label: '16画面', icon: '▢▢▢▢<br/>▢▢▢▢<br/>▢▢▢▢<br/>▢▢▢▢' },
  { value: 11, label: '25画面', icon: '▢▢▢▢▢<br/>▢▢▢▢▢<br/>▢▢▢▢▢<br/>▢▢▢▢▢<br/>▢▢▢▢▢' },
  { value: 12, label: '36画面', icon: '▢▢▢▢▢▢<br/>▢▢▢▢▢▢<br/>▢▢▢▢▢▢<br/>▢▢▢▢▢▢<br/>▢▢▢▢▢▢<br/>▢▢▢▢▢▢' },
  { value: 13, label: '49画面', icon: '▢▢▢▢▢▢▢<br/>▢▢▢▢▢▢▢<br/>▢▢▢▢▢▢▢<br/>▢▢▢▢▢▢▢<br/>▢▢▢▢▢▢▢<br/>▢▢▢▢▢▢▢<br/>▢▢▢▢▢▢▢' },
  // 特殊布局（14-17）
  { value: 14, label: '特殊1', icon: '▢▢<br/>▢▢' },
  { value: 15, label: '特殊2', icon: '▢▢<br/>▢▢' },
  { value: 16, label: '特殊3', icon: '▢▢<br/>▢▢' },
  { value: 17, label: '特殊4', icon: '▢▢<br/>▢▢' },
  // 自由布局（18）
  { value: 18, label: '自由布局', icon: '⚙' }
]

const handleLayoutChange = (layout) => {
  if (layout === -1) {
    showCustomInput.value = !showCustomInput.value
    return
  }
  setLayout(layout)
  emit('layout-change', layout)
}

const handleCustomChange = (value) => {
  customGridCount.value = value
}

const applyCustomGrid = () => {
  setLayout(customGridCount.value)
  emit('layout-change', customGridCount.value)
  showCustomInput.value = false
}
</script>

<style scoped>
.layout-switcher {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 8px;
}

.layout-buttons {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.layout-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  cursor: pointer;
  transition: all 0.2s;
}

.layout-btn:hover {
  background: rgba(76, 201, 240, 0.3);
  border-color: rgba(76, 201, 240, 0.5);
}

.layout-btn.active {
  background: rgba(76, 201, 240, 0.5);
  border-color: #4cc9f0;
}

.layout-icon {
  font-size: 10px;
  line-height: 1.2;
  text-align: center;
}

.layout-label {
  font-size: 10px;
  margin-top: 2px;
}

.custom-grid-input {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
