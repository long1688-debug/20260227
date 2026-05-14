<template>
  <div class="layout-panel">
    <div class="panel-content">
      <div class="layout-section">
        <h4 class="section-title">网格布局</h4>
        <div class="layout-grid">
          <div
            v-for="layout in gridLayouts"
            :key="layout.id"
            class="layout-item"
            :class="{ active: currentLayout === layout.id }"
            @click="handleSelectLayout(layout.id)"
          >
            <div class="layout-preview" :data-count="layout.count">
              <div v-for="i in layout.count" :key="i" class="layout-cell" />
            </div>
            <span class="layout-name">{{ layout.name }}</span>
          </div>
        </div>
      </div>

      <div class="layout-section">
        <h4 class="section-title">特殊布局</h4>
        <div class="layout-grid">
          <div
            v-for="layout in specialLayouts"
            :key="layout.id"
            class="layout-item"
            :class="{ active: currentLayout === layout.id }"
            @click="handleSelectLayout(layout.id)"
          >
            <div class="layout-preview special-layout" :data-special-type="layout.specialType">
              <div class="special-main"></div>
              <div class="special-sub"></div>
            </div>
            <span class="layout-name">{{ layout.name }}</span>
          </div>
        </div>
      </div>

      <div class="layout-section">
        <h4 class="section-title">自由布局</h4>
        <div class="layout-grid">
          <div
            class="layout-item"
            :class="{ active: currentLayout === freeLayoutId }"
            @click="handleSelectLayout(freeLayoutId)"
          >
            <div class="layout-preview free-preview">
              <div class="free-shape shape-1"></div>
              <div class="free-shape shape-2"></div>
              <div class="free-shape shape-3"></div>
            </div>
            <span class="layout-name">自由布局</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useVideoSync } from '@/composables/useVideoSync'
import {
  LAYOUT_INDICES,
  LAYOUT_REGISTRY,
  getLayoutIndexList
} from '@/composables/useLayoutConfig'

// 接收布局相关状态和方法
const {
  currentLayout
} = useVideoSync()

// 自由布局 ID
const freeLayoutId = LAYOUT_INDICES.LAYOUT_FREE

// 获取所有网格布局
const gridLayouts = computed(() => {
  return getLayoutIndexList()
    .filter(idx => LAYOUT_REGISTRY[idx]?.type === 'grid')
    .map(idx => {
      const layout = LAYOUT_REGISTRY[idx]
      return {
        id: idx,
        name: layout.name,
        count: layout.cells.length
      }
    })
})

// 获取特殊布局
const specialLayouts = computed(() => {
  return getLayoutIndexList()
    .filter(idx => LAYOUT_REGISTRY[idx]?.type === 'special')
    .map(idx => {
      const layout = LAYOUT_REGISTRY[idx]
      // 根据布局索引确定特殊类型
      let specialType = 'special-1'
      if (idx === LAYOUT_INDICES.LAYOUT_SPECIAL_1) specialType = 'special-1'
      else if (idx === LAYOUT_INDICES.LAYOUT_SPECIAL_2) specialType = 'special-2'
      else if (idx === LAYOUT_INDICES.LAYOUT_SPECIAL_3) specialType = 'special-3'
      else if (idx === LAYOUT_INDICES.LAYOUT_SPECIAL_4) specialType = 'special-4'

      return {
        id: idx,
        name: layout.name,
        count: layout.cells.length,
        specialType
      }
    })
})

// 分页相关状态已移除 - 所有布局一次性显示

// 定义 emit
const emit = defineEmits(['layout-change'])

const handleSelectLayout = (layoutId) => {
  // 🎯 通过 emit 通知父组件处理布局切换
  // 避免直接调用导致的双重管理冲突
  emit('layout-change', layoutId)

  const layout = LAYOUT_REGISTRY[layoutId]
  // ElMessage 已在父组件 TeacherWindow 的 handleLayoutChange 中处理
}
</script>

<style lang="scss" scoped>
.layout-panel {
  display: flex;
  flex-direction: column;
  padding: 8px;
  background: #0D1B2A;
  border-radius: 8px;
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow-y: auto;
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.layout-section {
  margin-bottom: 0; // 使用flex gap控制间距
  width: 100%; // ✅ 确保占满容器宽度
  min-width: 0; // ✅ 允许收缩

  &:last-child {
    margin-bottom: 0;
  }
}

.section-title {
  font-size: 12px;
  font-weight: 500;
  color: #E0E1DD;
  margin: 0 0 5px 0;
  line-height: 1.2;
}

.layout-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 5px;
  min-width: 0;
}


.layout-item {
  background: #0F2035;
  border: 2px solid #1A2A3A;
  border-radius: 4px; // ✅ 进一步减小圆角（从5px降到4px）
  padding: 5px; // ✅ 进一步减小内边距（从6px降到5px）
  cursor: pointer;
  transition: all 0.2s;
  min-width: 0; // ✅ 允许项目收缩

  &:hover {
    border-color: #4CC9F0;
  }

  &.active {
    border-color: #4CC9F0;
    background: rgba(76, 201, 240, 0.1);
  }
}

.layout-preview {
  display: grid;
  gap: 2px;
  margin-bottom: 3px; // ✅ 进一步减小底部间距（从4px降到3px）
  height: 32px; // ✅ 进一步减小预览图高度（从38px降到32px，减少16%）

  &[data-count="1"] { grid-template-columns: 1fr; }
  &[data-count="2"] { grid-template-columns: 1fr 1fr; }
  &[data-count="3"] { grid-template-columns: repeat(3, 1fr); }
  &[data-count="4"] { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
  &[data-count="6"] { grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 1fr 1fr; }
  &[data-count="9"] { grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); }
  &[data-count="16"] { grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(4, 1fr); }
  &[data-count="25"] { grid-template-columns: repeat(5, 1fr); grid-template-rows: repeat(5, 1fr); }
  &[data-count="36"] { grid-template-columns: repeat(6, 1fr); grid-template-rows: repeat(6, 1fr); }
  &[data-count="49"] { grid-template-columns: repeat(7, 1fr); grid-template-rows: repeat(7, 1fr); }
}

.layout-cell {
  background: #1A2A3A;
  border-radius: 1px; // ✅ 减小单元格圆角
}

.layout-name {
  font-size: 9px;
  color: #E0E1DD;
  text-align: center;
  display: block;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%; // ✅ 确保文本不会溢出
}

.pagination-container {
  margin-top: 8px;
  display: flex;
  justify-content: center;

  :deep(.el-pagination) {
    --el-pagination-button-color: #E0E1DD;
    --el-pagination-hover-color: #4CC9F0;
    --el-pagination-bg-color: transparent;

    .btn-prev,
    .btn-next,
    .el-pager li {
      background-color: #0F2035;
      border: 1px solid #1A2A3A;
      color: #E0E1DD;

      &:hover {
        color: #4CC9F0;
        border-color: #4CC9F0;
      }

      &.is-active {
        background-color: #4CC9F0;
        color: #0D1B2A;
        border-color: #4CC9F0;
      }
    }

    .btn-prev:disabled,
    .btn-next:disabled {
      color: #4A5568;
      border-color: #2D3748;
    }
  }
}

// 特殊布局预览样式
.special-layout {
  position: relative;
  background: #1A2A3A;
  border-radius: 3px;
  overflow: hidden;
  height: 32px;

  .special-main {
    position: absolute;
    background: #4CC9F0;
    opacity: 0.8;
  }

  .special-sub {
    position: absolute;
    width: 25%;
    height: 25%;
    background: #F72585;
    border: 1px solid #FFFFFF;
    border-radius: 2px;
    opacity: 0.9;
  }

  // 特殊布局1：主画面在右，子在左上角
  &[data-special-type="special-1"] {
    .special-main {
      top: 0;
      right: 0;
      bottom: 0;
      left: 25%;
    }
    .special-sub {
      top: 3px;
      left: 3px;
    }
  }

  // 特殊布局2：主画面在右，子在左下角
  &[data-special-type="special-2"] {
    .special-main {
      top: 0;
      right: 0;
      bottom: 0;
      left: 25%;
    }
    .special-sub {
      bottom: 3px;
      left: 3px;
    }
  }

  // 特殊布局3：主画面在左，子在右上角
  &[data-special-type="special-3"] {
    .special-main {
      top: 0;
      left: 0;
      bottom: 0;
      right: 25%;
    }
    .special-sub {
      top: 3px;
      right: 3px;
    }
  }

  // 特殊布局4：主画面在左，子在右下角
  &[data-special-type="special-4"] {
    .special-main {
      top: 0;
      left: 0;
      bottom: 0;
      right: 25%;
    }
    .special-sub {
      bottom: 3px;
      right: 3px;
    }
  }
}

// 自由布局预览样式
.free-preview {
  position: relative;
  background: #1A2A3A;
  border-radius: 3px;
  overflow: hidden;
  height: 32px;

  .free-shape {
    position: absolute;
    background: #4CC9F0;
    border: 1px solid #FFFFFF;
    border-radius: 1px;
    opacity: 0.7;

    &.shape-1 {
      width: 36%;
      height: 46%;
      top: 5%;
      left: 5%;
    }

    &.shape-2 {
      width: 31%;
      height: 36%;
      top: 10%;
      right: 10%;
    }

    &.shape-3 {
      width: 46%;
      height: 31%;
      bottom: 5%;
      left: 20%;
    }
  }
}
</style>
