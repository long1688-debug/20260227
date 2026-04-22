<template>
  <transition name="slide-down">
    <div v-if="enabled" class="annotation-toolbar">
      <span class="annotation-toolbar-label">全局标注工具：</span>

      <!-- 笔刷类型选择 -->
      <el-radio-group 
        :model-value="brushType" 
        @update:model-value="$emit('update:brushType', $event)"
        size="small" 
        style="margin-right: 10px;"
      >
        <el-radio-button label="pen">画笔</el-radio-button>
        <el-radio-button label="highlighter">荧光笔</el-radio-button>
        <el-radio-button label="eraser">橡皮</el-radio-button>
      </el-radio-group>

      <!-- 颜色选择 -->
      <el-color-picker 
        :model-value="color" 
        @update:model-value="$emit('update:color', $event)"
        size="small" 
        :disabled="brushType === 'eraser'"
      />

      <!-- 笔刷粗细选择 -->
      <el-select 
        :model-value="brushSize" 
        @update:model-value="$emit('update:brushSize', $event)"
        size="small" 
        style="width: 100px" 
        :disabled="brushType === 'eraser'"
      >
        <el-option label="细" :value="2" />
        <el-option label="中" :value="5" />
        <el-option label="粗" :value="10" />
        <el-option label="特粗" :value="15" />
      </el-select>

      <!-- 功能按钮 -->
      <el-button type="warning" size="small" @click="$emit('erase')">擦除</el-button>
      <el-button type="primary" size="small" @click="$emit('clear')">清屏</el-button>
      <el-button type="success" size="small" @click="$emit('save')">保存</el-button>
      <el-button type="danger" size="small" @click="$emit('update:enabled', false)">关闭</el-button>
    </div>
  </transition>
</template>

<script setup>
const props = defineProps({
  enabled: {
    type: Boolean,
    default: false
  },
  color: {
    type: String,
    default: '#FF0000'
  },
  brushSize: {
    type: Number,
    default: 5
  },
  brushType: {
    type: String,
    default: 'pen',
    validator: (value) => ['pen', 'highlighter', 'eraser'].includes(value)
  }
});

defineEmits([
  'update:enabled',
  'update:color',
  'update:brushSize',
  'update:brushType',
  'clear',
  'erase',
  'save'
]);
</script>

<style scoped lang="scss">
.annotation-toolbar {
  position: fixed;
  top: 50px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-secondary, #1B263B);
  border: 1px solid var(--border-color, #415A77);
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 9999;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

  .annotation-toolbar-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary, #E0E1DD);
    margin-right: 8px;
  }
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateX(-50%) translateY(-20px);
  opacity: 0;
}
</style>
