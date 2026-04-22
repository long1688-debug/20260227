<template>
  <el-dialog
    v-model="visible"
    title="重命名信号源"
    width="400px"
    top="3vh"
    class="rename-source-dialog-wrapper"
    @close="resetForm"
    :z-index="2000"
    append-to-body
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="80px"
    >
      <el-form-item label="信号源名称" prop="name">
        <el-input
          v-model="form.name"
          placeholder="请输入信号源名称"
          maxlength="50"
          show-word-limit
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleCancel">取消</el-button>
      <el-button type="primary" @click="handleSubmit">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  source: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:modelValue', 'rename'])

const visible = ref(props.modelValue)
const formRef = ref(null)
const form = reactive({
  name: ''
})

const rules = {
  name: [
    { required: true, message: '请输入信号源名称', trigger: 'blur' },
    { min: 1, max: 50, message: '长度在 1 到 50 个字符', trigger: 'blur' }
  ]
}

watch(() => props.modelValue, (val) => {
  visible.value = val
  if (val && props.source) {
    form.name = props.source.name || ''
  }
})

watch(visible, (val) => {
  emit('update:modelValue', val)
})

const resetForm = () => {
  form.name = ''
  if (formRef.value) {
    formRef.value.clearValidate()
  }
}

const handleCancel = () => {
  visible.value = false
}

const handleSubmit = async () => {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
    
    if (!props.source) {
      ElMessage.error('信号源信息不存在')
      return
    }
    
    emit('rename', props.source.id, form.name)
    ElMessage.success('重命名成功')
    visible.value = false
  } catch (error) {
    console.error('表单验证失败:', error)
  }
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
.rename-source-dialog-wrapper {
  :deep(.el-dialog__body) {
    max-height: calc(100vh - 150px);
    overflow-y: auto;
    padding: 20px;
    @include custom-scrollbar;
  }
}

.rename-source-dialog {
  :deep(.el-form-item) {
    margin-bottom: 20px;
  }
}
</style>
