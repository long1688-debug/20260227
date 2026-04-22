<template>
  <el-dialog
    v-model="visible"
    title="编辑字幕"
    width="600px"
    @close="handleClose"
  >
    <el-form :model="localSubtitle" label-width="100px">
      <el-form-item label="开始时间">
        <el-input 
          v-model="localSubtitle.startTime" 
          placeholder="00:00:00,000"
          @input="validateTimeFormat('startTime')"
        />
      </el-form-item>
      <el-form-item label="结束时间">
        <el-input 
          v-model="localSubtitle.endTime" 
          placeholder="00:00:00,000"
          @input="validateTimeFormat('endTime')"
        />
      </el-form-item>
      <el-form-item label="字幕内容">
        <el-input
          v-model="localSubtitle.text"
          type="textarea"
          :rows="4"
          placeholder="输入字幕内容"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleCancel">取消</el-button>
      <el-button type="primary" @click="handleSave" :disabled="!isValid">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface SubtitleItem {
  index?: number
  startTime: string
  endTime: string
  text: string
}

interface Props {
  modelValue: boolean
  subtitle: SubtitleItem | null
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  subtitle: null
})

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', subtitle: SubtitleItem): void
}

const emit = defineEmits<Emits>()

// 本地副本用于表单编辑
const localSubtitle = ref<SubtitleItem>({
  startTime: '',
  endTime: '',
  text: ''
})

// 监听 props 变化同步到本地
watch(() => props.subtitle, (newVal) => {
  if (newVal) {
    localSubtitle.value = { ...newVal }
  }
}, { immediate: true })

/**
 * 计算属性：对话框可见性
 */
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

/**
 * 验证时间格式
 */
const isValidTimeFormat = (time: string): boolean => {
  const timeRegex = /^\d{2}:\d{2}:\d{2},\d{3}$/
  return timeRegex.test(time)
}

/**
 * 验证表单有效性
 */
const isValid = computed(() => {
  return (
    isValidTimeFormat(localSubtitle.value.startTime) &&
    isValidTimeFormat(localSubtitle.value.endTime) &&
    localSubtitle.value.text.trim().length > 0
  )
})

/**
 * 验证时间格式并显示提示
 */
const validateTimeFormat = (field: 'startTime' | 'endTime') => {
  const time = localSubtitle.value[field]
  if (time && !isValidTimeFormat(time)) {
    // 不阻止输入，但可以在 UI 上显示错误状态
  }
}

/**
 * 处理保存
 */
const handleSave = () => {
  if (!isValid.value) return
  
  emit('save', { ...localSubtitle.value })
  handleClose()
}

/**
 * 处理取消
 */
const handleCancel = () => {
  handleClose()
}

/**
 * 关闭对话框并重置表单
 */
const handleClose = () => {
  emit('update:modelValue', false)
  // 重置为初始值
  if (props.subtitle) {
    localSubtitle.value = { ...props.subtitle }
  }
}
</script>

<style scoped lang="scss">
// 使用 Element Plus 默认样式，无需额外自定义
</style>
