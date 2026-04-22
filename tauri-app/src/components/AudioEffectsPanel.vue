<template>
  <div class="audio-effects-panel">
    <div class="panel-header">
      <h3 class="panel-title">音频效果</h3>
      <el-select 
        v-model="currentPreset" 
        size="small"
        placeholder="选择预设"
        style="width: 120px"
        @change="handlePresetChange"
      >
        <el-option 
          v-for="(preset, key) in audioPresets" 
          :key="key" 
          :label="preset.name" 
          :value="key"
        />
      </el-select>
    </div>

    <div class="effects-list">
      <!-- 降噪 -->
      <div class="effect-item">
        <div class="effect-header">
          <span class="effect-name">降噪</span>
          <el-switch 
            v-model="effects.noiseReduction" 
            @change="handleEffectChange"
          />
        </div>
        <div class="effect-description">
          减少背景噪音，提高语音清晰度
        </div>
      </div>

      <!-- 噪声抑制级别 -->
      <div class="effect-item" v-if="effects.noiseReduction">
        <div class="effect-header">
          <span class="effect-name">降噪强度</span>
        </div>
        <el-slider
          v-model="effects.noiseSuppressionLevel"
          :min="0"
          :max="1"
          :step="0.1"
          :disabled="!effects.noiseReduction"
          @change="handleEffectChange"
        />
        <div class="effect-value">
          {{ Math.round(effects.noiseSuppressionLevel * 100) }}%
        </div>
      </div>

      <!-- 回声消除 -->
      <div class="effect-item">
        <div class="effect-header">
          <span class="effect-name">回声消除</span>
          <el-switch 
            v-model="effects.echoCancellation" 
            @change="handleEffectChange"
          />
        </div>
        <div class="effect-description">
          消除扬声器声音被麦克风拾取的回声
        </div>
      </div>

      <!-- 自动增益 -->
      <div class="effect-item">
        <div class="effect-header">
          <span class="effect-name">自动增益</span>
          <el-switch 
            v-model="effects.autoGain" 
            @change="handleEffectChange"
          />
        </div>
        <div class="effect-description">
          自动调整音量，保持稳定的输出电平
        </div>
      </div>

      <!-- 噪声门 -->
      <div class="effect-item">
        <div class="effect-header">
          <span class="effect-name">噪声门</span>
        </div>
        <el-slider
          v-model="effects.noiseGate"
          :min="0"
          :max="0.1"
          :step="0.01"
          @change="handleEffectChange"
        />
        <div class="effect-value">
          {{ (effects.noiseGate * 100).toFixed(1) }}%
        </div>
      </div>
    </div>

    <!-- 保存自定义预设 -->
    <div class="preset-actions">
      <el-button 
        type="primary" 
        size="small"
        @click="showSaveDialog = true"
      >
        保存当前设置
      </el-button>
      <el-button 
        size="small"
        @click="resetToDefault"
      >
        重置
      </el-button>
    </div>

    <!-- 保存预设对话框 -->
    <el-dialog
      v-model="showSaveDialog"
      title="保存音频预设"
      width="400px"
    >
      <el-form>
        <el-form-item label="预设名称">
          <el-input 
            v-model="newPresetName" 
            placeholder="请输入预设名称"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSaveDialog = false">取消</el-button>
        <el-button type="primary" @click="saveCustomPreset">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useAudioStore } from '@/stores/audioStore'
import { ElMessage } from 'element-plus'

const audioStore = useAudioStore()

// 音频效果设置
const effects = ref({ ...audioStore.audioEffects })

// 当前预设
const currentPreset = ref(audioStore.currentPreset)

// 所有预设
const audioPresets = computed(() => audioStore.audioPresets)

// 保存对话框
const showSaveDialog = ref(false)
const newPresetName = ref('')

// 监听 store 变化
watch(
  () => audioStore.audioEffects,
  (newEffects) => {
    effects.value = { ...newEffects }
  },
  { deep: true }
)

watch(
  () => audioStore.currentPreset,
  (newPreset) => {
    currentPreset.value = newPreset
  }
)

// 处理预设变化
const handlePresetChange = (presetKey) => {
  audioStore.applyPreset(presetKey)
  effects.value = { ...audioStore.audioEffects }
}

// 处理效果变化
const handleEffectChange = () => {
  audioStore.updateAudioEffects(effects.value)
  currentPreset.value = 'custom'
}

// 保存自定义预设
const saveCustomPreset = () => {
  if (!newPresetName.value.trim()) {
    ElMessage.warning('请输入预设名称')
    return
  }
  
  // 这里可以扩展保存自定义预设的功能
  ElMessage.success('预设已保存')
  showSaveDialog.value = false
  newPresetName.value = ''
}

// 重置为默认值
const resetToDefault = () => {
  audioStore.applyPreset('default')
  effects.value = { ...audioStore.audioEffects }
  currentPreset.value = 'default'
  ElMessage.success('已重置为默认设置')
}
</script>

<style scoped lang="scss">
.audio-effects-panel {
  padding: 16px;
  background: var(--bg-secondary, #1B263B);
  border-radius: 8px;
  border: 1px solid var(--border-color, #415A77);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color, #415A77);
}

.panel-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #E0E1DD);
}

.effects-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.effect-item {
  padding: 12px;
  background: var(--bg-primary, #0D1B2A);
  border-radius: 6px;
  border: 1px solid var(--border-color, #415A77);
}

.effect-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.effect-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary, #E0E1DD);
}

.effect-description {
  font-size: 12px;
  color: var(--text-secondary, #ADB5BD);
  margin-top: 4px;
}

.effect-value {
  font-size: 12px;
  color: var(--text-secondary, #ADB5BD);
  text-align: center;
  margin-top: 4px;
}

.preset-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color, #415A77);
}
</style>
