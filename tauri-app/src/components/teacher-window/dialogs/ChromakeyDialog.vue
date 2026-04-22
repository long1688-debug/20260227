<template>
  <el-dialog
    v-model="visible"
    title="绿幕抠像设置"
    width="650px"
    top="3vh"
    :close-on-click-modal="false"
    class="chromakey-dialog-wrapper"
    @close="handleClose"
    :z-index="2000"
    append-to-body
  >
    <el-form :model="config" label-width="120px">
      <!-- 启用绿幕 -->
      <el-form-item label="启用绿幕">
        <el-switch v-model="config.chromakey.enabled" />
      </el-form-item>

      <!-- 颜色选择 -->
      <el-form-item label="抠像颜色">
        <el-radio-group v-model="selectedColor" @change="onColorChange">
          <el-radio value="green">
            <div style="display: flex; align-items: center; gap: 8px">
              <div style="width: 24px; height: 24px; background: #00FF00; border-radius: 4px; border: 2px solid #FFFFFF;"></div>
              <span>绿色</span>
            </div>
          </el-radio>
          <el-radio value="blue">
            <div style="display: flex; align-items: center; gap: 8px">
              <div style="width: 24px; height: 24px; background: #0000FF; border-radius: 4px; border: 2px solid #FFFFFF;"></div>
              <span>蓝色</span>
            </div>
          </el-radio>
          <el-radio value="custom">
            <div style="display: flex; align-items: center; gap: 8px">
              <el-color-picker v-model="customColor" size="small" />
              <span>自定义</span>
            </div>
          </el-radio>
        </el-radio-group>
      </el-form-item>

      <!-- 相似度 -->
      <el-form-item label="相似度">
        <el-slider
          v-model="config.chromakey.similarity"
          :min="0.1"
          :max="0.7"
          :step="0.05"
          :format-tooltip="formatTooltip"
        />
        <div class="slider-value">{{ (config.chromakey.similarity * 100).toFixed(0) }}%</div>
        <div class="form-tip">
          控制颜色匹配的严格程度。值越大，匹配范围越广
        </div>
      </el-form-item>

      <!-- 混合度 -->
      <el-form-item label="边缘混合">
        <el-slider
          v-model="config.chromakey.blend"
          :min="0.0"
          :max="0.3"
          :step="0.01"
          :format-tooltip="formatTooltip"
        />
        <div class="slider-value">{{ (config.chromakey.blend * 100).toFixed(0) }}%</div>
        <div class="form-tip">
          控制边缘的平滑程度。值越大，边缘越柔和
        </div>
      </el-form-item>

      <!-- 背景图片 -->
      <el-form-item label="背景图片">
        <div class="background-input">
          <el-input
            v-model="config.chromakey.background_image"
            placeholder="C:\\backgrounds\\classroom.jpg"
            readonly
          />
          <el-button @click="selectBackground">浏览</el-button>
        </div>
        <div class="form-tip">
          选择一张背景图片替换绿幕。支持 JPG/PNG 格式
        </div>
      </el-form-item>

      <!-- 预览 -->
      <el-divider />
      <div class="preview-section">
        <h4>参数预览</h4>
        <div class="preview-grid">
          <div class="preview-card">
            <div class="preview-label">颜色</div>
            <div class="preview-value" :style="{ backgroundColor: previewColor }">
              {{ colorLabel }}
            </div>
          </div>
          <div class="preview-card">
            <div class="preview-label">相似度</div>
            <div class="preview-value">{{ similarityLabel }}</div>
          </div>
          <div class="preview-card">
            <div class="preview-label">混合度</div>
            <div class="preview-value">{{ blendLabel }}</div>
          </div>
        </div>
      </div>

      <!-- 调优建议 -->
      <el-alert
        type="info"
        :closable="false"
        style="margin-top: 15px"
      >
        <template #title>
          <strong>调优建议：</strong>
          <ul style="margin: 8px 0 0 20px; font-size: 13px;">
            <li>确保绿幕均匀受光，避免阴影</li>
            <li>人物与绿幕保持1-2米距离</li>
            <li>避免穿着与绿幕相近颜色的衣物</li>
            <li>先试录一段，根据效果微调参数</li>
          </ul>
        </template>
      </el-alert>
    </el-form>

    <template #footer>
      <el-button @click="handleReset">重置</el-button>
      <el-button type="primary" @click="handleSave">保存配置</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { open } from '@tauri-apps/plugin-dialog'

const props = defineProps({
  modelValue: Boolean
})

const emit = defineEmits(['update:modelValue', 'save'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const selectedColor = ref('green')
const customColor = ref('#00FF00')

const config = reactive({
  chromakey: {
    enabled: false,
    color: '0x00FF00',
    similarity: 0.4,
    blend: 0.1,
    background_image: ''
  }
})

const colorMap = {
  green: { hex: '0x00FF00', label: '绿色', css: '#00FF00' },
  blue: { hex: '0x0000FF', label: '蓝色', css: '#0000FF' }
}

const previewColor = computed(() => {
  if (selectedColor.value === 'custom') {
    return customColor.value
  }
  return colorMap[selectedColor.value]?.css || '#00FF00'
})

const colorLabel = computed(() => {
  if (selectedColor.value === 'custom') {
    return '自定义'
  }
  return colorMap[selectedColor.value]?.label || '绿色'
})

const similarityLabel = computed(() => {
  const val = config.chromakey.similarity
  if (val < 0.35) return '严格抠像'
  if (val < 0.45) return '中等容差'
  return '宽松抠像'
})

const blendLabel = computed(() => {
  const val = config.chromakey.blend
  if (val < 0.1) return '硬边缘'
  if (val < 0.2) return '轻微混合'
  return '强混合'
})

const onColorChange = () => {
  const color = colorMap[selectedColor.value]
  if (color) {
    config.chromakey.color = color.hex
  }
}

const hexToRrggbb = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `0x${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

const formatTooltip = (val) => {
  return (val * 100).toFixed(0) + '%'
}

const selectBackground = async () => {
  try {
    const selected = await open({
      multiple: false,
      filters: [
        { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'bmp'] }
      ]
    })
    if (selected) {
      config.chromakey.background_image = selected
    }
  } catch (error) {
    console.error('选择文件失败:', error)
  }
}

const handleReset = () => {
  selectedColor.value = 'green'
  config.chromakey = {
    enabled: false,
    color: '0x00FF00',
    similarity: 0.4,
    blend: 0.1,
    background_image: ''
  }
  ElMessage.info('已重置为默认配置')
}

const handleSave = () => {
  if (selectedColor.value === 'custom') {
    config.chromakey.color = hexToRrggbb(customColor.value)
  }
  emit('save', { ...config.chromakey })
  visible.value = false
  ElMessage.success('配置已保存')
}

const handleClose = () => {
  visible.value = false
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
.chromakey-dialog-wrapper {
  :deep(.el-dialog__body) {
    max-height: calc(100vh - 150px);
    overflow-y: auto;
    padding: 20px;
    @include custom-scrollbar;
  }
}

.background-input {
  display: flex;
  gap: 8px;
}

.slider-value {
  font-size: 12px;
  color: #778DA9;
  margin-top: 4px;
  text-align: center;
}

.form-tip {
  font-size: 12px;
  color: #778DA9;
  margin-top: 4px;
  line-height: 1.5;
}

.preview-section {
  background: #0F2035;
  border-radius: 6px;
  padding: 15px;
}

.preview-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #E0E1DD;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.preview-card {
  background: #1A2A3A;
  border-radius: 4px;
  padding: 10px;
  text-align: center;
}

.preview-label {
  font-size: 12px;
  color: #778DA9;
  margin-bottom: 6px;
}

.preview-value {
  font-size: 13px;
  color: #E0E1DD;
  font-weight: 500;
  padding: 6px 12px;
  border-radius: 4px;
  display: inline-block;
}
</style>
