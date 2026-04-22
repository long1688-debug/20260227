<template>
  <div class="realtime-subtitle-panel">
    <el-card>
      <template #header>
        <div class="panel-header">
          <span>实时字幕</span>
          <el-switch v-model="enabled" @change="handleToggle" />
        </div>
      </template>

      <div v-if="enabled" class="panel-content">
        <!-- 音频设备选择 -->
        <div class="section">
          <div class="section-title">音频设备</div>
          <AudioDeviceSelector />
        </div>

        <!-- 音频可视化 -->
        <div class="section">
          <div class="section-title">音频波形</div>
          <AudioVisualizer :width="300" :height="80" />
        </div>

        <!-- 音频设置 -->
        <div class="section">
          <div class="section-title">音频处理</div>
          <AudioSettings @settings-change="handleSettingsChange" />
        </div>

        <!-- 字幕显示 -->
        <div class="section">
          <div class="section-title">识别结果</div>
          <div class="subtitle-display">
            <div v-if="subtitleText" class="subtitle-text">{{ subtitleText }}</div>
            <div v-else class="subtitle-placeholder">等待语音输入...</div>
          </div>
        </div>

        <!-- 识别状态 -->
        <div class="status-bar">
          <el-tag :type="isRecognizing ? 'success' : 'info'" size="small">
            {{ isRecognizing ? '识别中' : '待机' }}
          </el-tag>
          <el-tag v-if="lastRecognitionTime" type="info" size="small">
            {{ formatTime(lastRecognitionTime) }}
          </el-tag>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import AudioDeviceSelector from './AudioDeviceSelector.vue';
import AudioVisualizer from './AudioVisualizer.vue';
import AudioSettings from './AudioSettings.vue';
import { useRealtimeSubtitle } from '@/composables/useRealtimeSubtitle';

const {
  subtitleText,
  isRecognizing,
  startRealtimeSubtitle,
  stopRealtimeSubtitle,
  updateRecognitionSettings,
  addRecognitionCompleteListener,
  removeRecognitionCompleteListener
} = useRealtimeSubtitle();

const enabled = ref(false);
const lastRecognitionTime = ref(null);

// 切换实时字幕
const handleToggle = async () => {
  if (enabled.value) {
    await startRealtimeSubtitle();
    ElMessage.success('实时字幕已启动');
  } else {
    await stopRealtimeSubtitle();
    ElMessage.info('实时字幕已停止');
  }
};

// 处理设置变化
const handleSettingsChange = async (settings) => {
  console.log('音频设置已更新:', settings);

  try {
    // 将设置发送到后端
    const success = await updateRecognitionSettings(settings);
    if (success) {
      ElMessage.success('识别设置已保存');
    }
  } catch (error) {
    console.error('保存识别设置失败:', error);
    ElMessage.error('保存识别设置失败');
  }
};

// 格式化时间
const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const now = new Date();
  const diff = Math.floor((now - timestamp) / 1000);

  if (diff < 60) return `${diff}秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  return `${Math.floor(diff / 3600)}小时前`;
};

// 监听识别完成事件
const handleRecognitionComplete = (result) => {
  console.log('识别完成:', result);
  // 更新最后识别时间
  lastRecognitionTime.value = Date.now();
};

// 添加识别完成事件监听
onMounted(() => {
  addRecognitionCompleteListener(handleRecognitionComplete);
});

// 移除识别完成事件监听
onUnmounted(() => {
  removeRecognitionCompleteListener(handleRecognitionComplete);
});
</script>

<style scoped>
.realtime-subtitle-panel {
  max-width: 400px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 14px;
  font-weight: bold;
  color: #303133;
}

.subtitle-display {
  min-height: 60px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
  border-left: 3px solid #409eff;
}

.subtitle-text {
  font-size: 14px;
  line-height: 1.6;
  color: #303133;
}

.subtitle-placeholder {
  font-size: 14px;
  color: #909399;
  font-style: italic;
}

.status-bar {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
