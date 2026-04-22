<template>
  <div class="audio-settings">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>音频设置</span>
        </div>
      </template>

      <el-form :model="settings" label-width="120px">
        <el-form-item label="噪声门阈值">
          <el-slider
            v-model="settings.noiseGateThreshold"
            :min="0"
            :max="0.1"
            :step="0.001"
            :format-tooltip="formatThreshold"
            @change="handleSettingsChange"
          />
          <span class="value-display">{{ (settings.noiseGateThreshold * 100).toFixed(1) }}%</span>
        </el-form-item>

        <el-form-item label="噪声抑制">
          <el-slider
            v-model="settings.noiseSuppressionLevel"
            :min="0"
            :max="1"
            :step="0.05"
            :format-tooltip="formatSuppression"
            @change="handleSettingsChange"
          />
          <span class="value-display">{{ (settings.noiseSuppressionLevel * 100).toFixed(0) }}%</span>
        </el-form-item>

        <el-form-item label="回声消除">
          <el-switch
            v-model="settings.echoCancellation"
            @change="handleSettingsChange"
          />
        </el-form-item>

        <el-form-item label="音频归一化">
          <el-switch
            v-model="settings.normalize"
            @change="handleSettingsChange"
          />
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { ElMessage } from 'element-plus';

const emit = defineEmits(['settings-change']);

const settings = reactive({
  noiseGateThreshold: 0.02,
  noiseSuppressionLevel: 0.5,
  echoCancellation: true,
  normalize: true
});

// 格式化阈值显示
const formatThreshold = (value) => {
  return `${(value * 100).toFixed(1)}%`;
};

// 格式化抑制级别显示
const formatSuppression = (value) => {
  return `${(value * 100).toFixed(0)}%`;
};

// 设置变化处理
const handleSettingsChange = () => {
  emit('settings-change', { ...settings });
  ElMessage.success('音频设置已更新');
};
</script>

<style scoped>
.audio-settings {
  max-width: 500px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.value-display {
  margin-left: 16px;
  color: #909399;
  font-size: 14px;
  min-width: 50px;
  display: inline-block;
}
</style>
