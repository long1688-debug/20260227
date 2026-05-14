<template>
  <div class="layout-management-panel">
    <!-- 基础分屏布局 -->
    <div class="layout-section">
      <div class="section-title">基础分屏</div>
      <div class="layout-grid">
        <el-button
          v-for="layout in allLayouts"
          :key="layout.value"
          :type="currentLayout === layout.value ? 'primary' : ''"
          size="small"
          @click="handleLayoutChange(layout.value)"
        >
          {{ layout.label }}
        </el-button>
      </div>
    </div>

    <!-- 特殊布局 -->
    <div class="layout-section">
      <div class="section-title">特殊布局</div>
      <div class="layout-grid">
        <el-button
          v-for="layout in specialLayouts"
          :key="layout.value"
          :type="currentLayout === layout.value ? 'primary' : ''"
          size="small"
          @click="handleLayoutChange(layout.value)"
        >
          {{ layout.label }}
        </el-button>
      </div>
    </div>

    <!-- 自由布局 -->
    <div class="layout-section">
      <div class="section-title">自由布局</div>
      <div class="layout-grid">
        <el-button
          :type="currentLayout === 18 ? 'primary' : ''"
          size="small"
          @click="handleLayoutChange(18)"
        >
          自由画布
        </el-button>
      </div>
    </div>

    <!-- 自定义格子数量 -->
    <div v-if="currentLayout === 18" class="layout-section">
      <div class="section-title">格子数量</div>
      <div class="custom-grid-controls">
        <el-input-number
          v-model="localCustomGridCount"
          :min="1"
          :max="49"
          size="small"
          @change="handleCustomCountChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'

interface LayoutOption {
  value: number
  label: string
}

interface Props {
  /** 当前布局类型 */
  currentLayout: number
  /** 自定义格子数量 */
  customGridCount: number
}

const props = withDefaults(defineProps<Props>(), {
  currentLayout: 1,
  customGridCount: 4
})

interface Emits {
  (e: 'layout-change', layout: number): void
  (e: 'custom-count-change', count: number): void
}

const emit = defineEmits<Emits>()

// 本地副本用于 v-model 双向绑定
const localCustomGridCount = ref(props.customGridCount)

// 监听 props 变化同步到本地
watch(() => props.customGridCount, (newVal) => {
  localCustomGridCount.value = newVal
})

/**
 * 网格布局选项（使用新布局索引）
 */
const allLayouts: LayoutOption[] = [
  // 基础分屏
  { value: 1, label: '单屏' },
  { value: 2, label: '双屏' },
  { value: 3, label: '三屏' },
  { value: 4, label: '四屏' },
  { value: 5, label: '六屏' },
  { value: 7, label: '九屏' },
  { value: 10, label: '十六屏' },
  { value: 11, label: '二十五屏' },
  { value: 12, label: '三十六屏' },
  { value: 13, label: '四十九屏' }
]

/**
 * 特殊布局选项
 */
const specialLayouts: LayoutOption[] = [
  { value: 14, label: '特殊1' },
  { value: 15, label: '特殊2' },
  { value: 16, label: '特殊3' },
  { value: 17, label: '特殊4' }
]

/**
 * 处理布局切换
 */
const handleLayoutChange = (layout: number) => {
  emit('layout-change', layout)
}

/**
 * 处理自定义格子数量变化
 */
const handleCustomCountChange = (value: number) => {
  emit('custom-count-change', value)
}
</script>

<style scoped lang="scss">
.layout-management-panel {
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: #0D1B2A;
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow-y: auto;
}

.layout-section {
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
}

.layout-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 8px;
}

.custom-grid-controls {
  display: flex;
  justify-content: center;
}
</style>
