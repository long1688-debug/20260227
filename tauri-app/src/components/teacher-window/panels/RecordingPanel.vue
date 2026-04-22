<template>
  <div class="recording-panel">
    <!-- 录制模式切换 -->
    <div class="mode-tabs">
      <button
        :class="['mode-tab', { active: recordingMode === 'single' }]"
        @click="recordingMode = 'single'"
      >
        <el-icon><VideoCamera /></el-icon>
        <span>画面录制</span>
      </button>
      <button
        :class="['mode-tab', { active: recordingMode === 'multi' }]"
        @click="recordingMode = 'multi'"
      >
        <el-icon><VideoCamera /></el-icon>
        <span>多路录制</span>
      </button>
    </div>

    <!-- 画面录制模式 -->
    <div v-if="recordingMode === 'single'" class="mode-content">
      <div class="section-title">录制设置</div>

      <!-- 音频源选择 -->
      <div class="audio-section">
        <div class="section-subtitle">音频源</div>
        <div class="audio-options">
          <label class="audio-option">
            <input type="radio" v-model="audioSource" value="none" />
            <span>无音频</span>
          </label>
          <label class="audio-option">
            <input type="radio" v-model="audioSource" value="mic" />
            <span>麦克风</span>
          </label>
          <label class="audio-option">
            <input type="radio" v-model="audioSource" value="system" />
            <span>系统音频</span>
          </label>
          <label class="audio-option">
            <input type="radio" v-model="audioSource" value="mixed" />
            <span>多路混合</span>
          </label>
        </div>
      </div>

      <!-- 音频设置 -->
      <div v-if="audioSource !== 'none'" class="audio-settings">
        <div class="section-subtitle">音频设置</div>
        <div class="setting-row">
          <label>监听音频</label>
          <input type="checkbox" v-model="enableAudioMonitoring" />
        </div>
        <div class="setting-row">
          <label>接收端静音</label>
          <input type="checkbox" v-model="muteOnReceive" />
        </div>
        <div class="setting-row">
          <label>音频降噪</label>
          <input type="checkbox" v-model="enableNoiseReduction" />
        </div>
        <div v-if="audioSource === 'mixed'" class="setting-row">
          <label>音频混合比例</label>
          <div class="range-slider">
            <input type="range" v-model="audioMixRatio" min="0" max="100" />
            <span class="range-value">{{ audioMixRatio }}%</span>
          </div>
        </div>
      </div>

      <!-- 录制格式 -->
      <div class="format-section">
        <div class="section-subtitle">输出格式</div>
        <select v-model="recordingFormat">
          <option value="mp4">MP4 (H.264)</option>
          <option value="mkv">MKV (H.264)</option>
          <option value="webm">WebM (VP9)</option>
        </select>
      </div>

      <!-- 录制控制 -->
      <div class="recording-controls">
        <div class="control-status">
          <div class="status-item">
            <span class="label">录制状态：</span>
            <span :class="['value', { recording: isRecording, paused: isRecordingPaused }]">
              {{ recordingStatus }}
            </span>
          </div>
          <div class="status-item">
            <span class="label">录制时长：</span>
            <span class="value">{{ recordingDuration }}</span>
          </div>
        </div>
        <div class="control-buttons">
          <button
            :class="['control-btn', 'start-btn', { disabled: isRecording }]"
            :disabled="isRecording"
            @click="startRecording"
          >
            <el-icon><VideoCamera /></el-icon>
            <span>开始录制</span>
          </button>
          <button
            :class="['control-btn', 'pause-btn', { disabled: !isRecording || isRecordingPaused }]"
            :disabled="!isRecording || isRecordingPaused"
            @click="pauseRecording"
          >
            <el-icon><VideoPause /></el-icon>
            <span>暂停录制</span>
          </button>
          <button
            :class="['control-btn', 'resume-btn', { disabled: !isRecordingPaused }]"
            :disabled="!isRecordingPaused"
            @click="resumeRecording"
          >
            <el-icon><VideoPlay /></el-icon>
            <span>恢复录制</span>
          </button>
          <button
            :class="['control-btn', 'stop-btn', { disabled: !isRecording && !isRecordingPaused }]"
            :disabled="!isRecording && !isRecordingPaused"
            @click="stopRecording"
          >
            <el-icon><VideoStop /></el-icon>
            <span>停止录制</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 多路录制模式 -->
    <div v-if="recordingMode === 'multi'" class="mode-content">
      <div class="section-title">多路摄像头录制</div>

      <!-- 摄像头列表 -->
      <div class="camera-list">
        <div class="section-subtitle">选择摄像头</div>
        <div class="camera-grid">
          <div
            v-for="camera in cameras"
            :key="camera.id"
            :class="['camera-item', {
              selected: selectedCameras.includes(camera.id),
              recording: cameraRecordingStates[camera.id]
            }]"
            @click="toggleCamera(camera.id)"
          >
            <div class="camera-icon">
              <el-icon><VideoCamera /></el-icon>
            </div>
            <div class="camera-name">{{ camera.name }}</div>
            <div class="camera-status">
              <span v-if="cameraRecordingStates[camera.id]" class="status-text recording">录制中</span>
              <span v-else-if="selectedCameras.includes(camera.id)" class="status-text selected">已选择</span>
              <span v-else class="status-text">未选择</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 多路录制设置 -->
      <div class="multi-settings">
        <div class="section-subtitle">录制设置</div>
        <div class="setting-row">
          <label>输出格式</label>
          <select v-model="multiRecordingFormat">
            <option value="mp4">MP4</option>
            <option value="mkv">MKV</option>
          </select>
        </div>
        <div class="setting-row">
          <label>保存路径</label>
          <input type="text" v-model="multiSavePath" readonly />
          <button class="btn-small" @click="selectSavePath">浏览</button>
        </div>
        <div class="setting-row">
          <label>文件命名</label>
          <select v-model="fileNaming">
            <option value="time">时间戳</option>
            <option value="camera">摄像头名称</option>
            <option value="both">时间+摄像头</option>
          </select>
        </div>
      </div>

      <!-- 多路录制控制 -->
      <div class="multi-recording-controls">
        <div class="control-status">
          <div class="status-item">
            <span class="label">选中摄像头：</span>
            <span class="value">{{ selectedCameras.length }}</span>
          </div>
          <div class="status-item">
            <span class="label">录制中：</span>
            <span class="value">{{ recordingCount }}</span>
          </div>
        </div>
        <div class="control-buttons">
          <button
            :class="['control-btn', 'start-btn', { disabled: selectedCameras.length === 0 }]"
            :disabled="selectedCameras.length === 0"
            @click="startMultiRecording"
          >
            <el-icon><VideoCamera /></el-icon>
            <span>开始录制全部</span>
          </button>
          <button
            :class="['control-btn', 'stop-btn', { disabled: recordingCount === 0 }]"
            :disabled="recordingCount === 0"
            @click="stopMultiRecording"
          >
            <el-icon><VideoStop /></el-icon>
            <span>停止全部录制</span>
          </button>
        </div>
      </div>

      <!-- 录制列表 -->
      <div v-if="recordingFiles.length > 0" class="recording-list">
        <div class="section-subtitle">录制文件</div>
        <div class="file-list">
          <div
            v-for="file in recordingFiles"
            :key="file.id"
            class="file-item"
          >
            <div class="file-icon">
              <el-icon><Film /></el-icon>
            </div>
            <div class="file-info">
              <div class="file-name">{{ file.name }}</div>
              <div class="file-meta">{{ file.size }} · {{ file.duration }}</div>
            </div>
            <div class="file-actions">
              <button class="icon-btn" @click="openFile(file)" title="打开">
                <el-icon><FolderOpened /></el-icon>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { VideoCamera, VideoPause, VideoPlay, VideoStop, Film, FolderOpened } from '@/components/icons';
import { useRecording } from '@/composables/useRecording';

// 使用录制 composable
const {
  // 状态
  recordingTime,
  recordingConfig,
  currentRecordingSession,

  // 画布录制控制
  startAllCanvasRecording,
  pauseAllCanvasRecording,
  resumeAllCanvasRecording,
  stopAllCanvasRecording,

  // 预览录制控制
  startAllPreviewRecording,
  pauseAllPreviewRecording,
  resumeAllPreviewRecording,
  stopAllPreviewRecording,

  // 音频管理
  initAudioSystem,
  toggleNoiseReduction,

  // 清理
  cleanup
} = useRecording();

// 组件挂载时初始化
onMounted(async () => {
  // 初始化音频系统
  await initAudioSystem();
  // 设置默认录制格式
  recordingConfig.outputFormat = 'mp4';
  // 启用音频混合
  recordingConfig.enableAudioMix = true;
});

// 组件卸载时清理
onUnmounted(() => {
  cleanup();
});

// 录制模式
const recordingMode = ref('single');

// 画面录制设置
const audioSource = ref('mic');
const enableAudioMonitoring = ref(true);
const muteOnReceive = ref(false);
const enableNoiseReduction = ref(true);
const audioMixRatio = ref(50);
const recordingFormat = ref('mp4');

// 录制状态
const isRecording = computed(() => currentRecordingSession.isRecording);
const isRecordingPaused = computed(() => currentRecordingSession.isPaused);

// 多路录制 - 从实际的视频源获取摄像头列表
const cameras = ref([]);
const selectedCameras = ref([]);
const cameraRecordingStates = ref({});
const multiRecordingFormat = ref('mp4');
const multiSavePath = ref('');
const fileNaming = ref('both');
const recordingFiles = ref([]);

// 监听视频源变化
const updateCameraList = () => {
  // 从全局状态获取活跃的视频源
  window.addEventListener('update-cameras', (event) => {
    if (event.detail && event.detail.cameras) {
      cameras.value = event.detail.cameras;
    }
  });
};

// 组件挂载时更新摄像头列表
onMounted(() => {
  updateCameraList();
});

// 录制状态显示
const recordingStatus = computed(() => {
  if (!isRecording.value) return '未录制';
  if (isRecordingPaused.value) return '已暂停';
  return '录制中';
});

const recordingDuration = computed(() => {
  return recordingTime.value || '00:00:00';
});

const recordingCount = computed(() => {
  return Object.values(cameraRecordingStates.value).filter(v => v).length;
});

// 画面录制控制 - 连接到实际的录制引擎
const startRecording = async () => {
  try {
    // 更新录制配置
    recordingConfig.outputFormat = recordingFormat.value;
    recordingConfig.enableAudioMix = audioSource.value !== 'none';
    recordingConfig.noiseReduction = enableNoiseReduction.value;
    recordingConfig.enableAudioMix = audioSource.value !== 'none';

    // 启用/禁用降噪
    if (enableNoiseReduction.value) {
      toggleNoiseReduction(true);
    } else {
      toggleNoiseReduction(false);
    }

    // 开始录制所有画布
    await startAllCanvasRecording();

    ElMessage.success('录制已开始');
  } catch (error) {
    console.error('[录制面板] 开始录制失败:', error);
    ElMessage.error('开始录制失败');
  }
};

const pauseRecording = async () => {
  try {
    await pauseAllCanvasRecording();
    ElMessage.info('录制已暂停');
  } catch (error) {
    console.error('[录制面板] 暂停录制失败:', error);
    ElMessage.error('暂停录制失败');
  }
};

const resumeRecording = async () => {
  try {
    await resumeAllCanvasRecording();
    ElMessage.success('录制已恢复');
  } catch (error) {
    console.error('[录制面板] 恢复录制失败:', error);
    ElMessage.error('恢复录制失败');
  }
};

const stopRecording = async () => {
  try {
    await stopAllCanvasRecording();
    ElMessage.success('录制已完成');
  } catch (error) {
    console.error('[录制面板] 停止录制失败:', error);
    ElMessage.error('停止录制失败');
  }
};

// 多路录制控制
const toggleCamera = (cameraId) => {
  const index = selectedCameras.value.indexOf(cameraId);
  if (index > -1) {
    selectedCameras.value.splice(index, 1);
  } else {
    selectedCameras.value.push(cameraId);
  }
};

const startMultiRecording = async () => {
  try {
    if (selectedCameras.value.length === 0) {
      ElMessage.warning('请选择至少一个摄像头');
      return;
    }

    // 更新录制配置
    recordingConfig.outputFormat = multiRecordingFormat.value;
    recordingConfig.enableAudioMix = true;
    recordingConfig.noiseReduction = enableNoiseReduction.value;

    // 获取所有预览源（从实际的视频预览组件获取）
    const previewSources = [];

    // 获取所有预览区域的视频元素
    const videoElements = document.querySelectorAll('.video-preview video, .preview-area video');

    videoElements.forEach((videoElement, index) => {
      const videoContainer = videoElement.closest('.video-preview, .preview-area');
      if (videoContainer) {
        const cameraId = videoContainer.dataset.cameraId || `camera-${index + 1}`;
        const sourceName = videoContainer.dataset.sourceName || `摄像头-${index + 1}`;
        const sourceType = videoContainer.dataset.sourceType || 'camera';

        // 只包含选中的摄像头
        if (selectedCameras.value.includes(cameraId)) {
          previewSources.push({
            index: index + 1,
            videoElement: videoElement,
            name: sourceName,
            type: sourceType
          });
        }
      }
    });

    // 开始录制所有选中的预览区域
    if (previewSources.length > 0) {
      await startAllPreviewRecording(previewSources);

      // 更新摄像头录制状态
      selectedCameras.value.forEach(id => {
        cameraRecordingStates.value[id] = true;
      });

      ElMessage.success(`已开始录制 ${previewSources.length} 个摄像头`);
    } else {
      ElMessage.warning('未找到可录制的摄像头');
    }
  } catch (error) {
    console.error('[录制面板] 开始多路录制失败:', error);
    ElMessage.error('开始多路录制失败');
  }
};

const stopMultiRecording = async () => {
  try {
    // 停止所有预览录制(每个信号源会单独保存文件)
    const fileCount = selectedCameras.value.length;
    await stopAllPreviewRecording();

    // 更新摄像头录制状态
    Object.keys(cameraRecordingStates.value).forEach(id => {
      cameraRecordingStates.value[id] = false;
    });

    console.log(`[录制面板] 多路录制已完成,共生成 ${fileCount} 个文件,已保存到下载目录`);

    ElMessage.success(`多路录制已完成,共 ${fileCount} 个文件已保存到下载目录`);

    // 触发全局事件
    window.dispatchEvent(new CustomEvent('stop-multi-recording'));
  } catch (error) {
    console.error('[录制面板] 停止多路录制失败:', error);
    ElMessage.error('停止多路录制失败');
  }
};

const selectSavePath = () => {
  ElMessage.info('请选择保存路径');
};

const openFile = (file) => {
  ElMessage.success(`打开文件：${file.name}`);
};
</script>

<style lang="scss" scoped>
.recording-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px;
  background: #0D1B2A;
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow-y: auto;
}

.mode-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 12px;
  background: #0D1B2A;
  border-radius: 8px;

  .mode-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 12px;
    background: #141f2e;
    border: 1px solid #2d3a4f;
    border-radius: 6px;
    color: #778DA9;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;

    &:hover {
      background: #415A77;
      color: #E0E1DD;
    }

    &.active {
      background: #4CC9F0;
      color: #0D1B2A;
      border-color: #4CC9F0;

      .el-icon {
        color: #0D1B2A;
      }
    }

    .el-icon {
      font-size: 20px;
    }

    span {
      font-size: 11px;
    }
  }
}

.mode-content {
  background: #0D1B2A;
  border-radius: 8px;
  padding: 12px;
}

.section-title {
  color: #E0E1DD;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 12px;
}

.section-subtitle {
  color: #778DA9;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 8px;
}

.audio-section,
.audio-settings,
.format-section,
.multi-settings {
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }
}

.audio-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;

  .audio-option {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px;
    background: #141f2e;
    border: 1px solid #2d3a4f;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: #415A77;
    }

    &:has(input:checked) {
      background: rgba(76, 201, 240, 0.1);
      border-color: #4CC9F0;
    }

    input[type="radio"] {
      cursor: pointer;
    }

    span {
      color: #E0E1DD;
      font-size: 12px;
    }
  }
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;

  label {
    color: #E0E1DD;
    font-size: 12px;
  }

  input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  input[type="text"] {
    flex: 1;
    padding: 6px 10px;
    background: #141f2e;
    border: 1px solid #415A77;
    border-radius: 4px;
    color: #E0E1DD;
    font-size: 12px;
    font-family: inherit;

    &:focus {
      outline: none;
      border-color: #4CC9F0;
    }
  }

  select {
    flex: 1;
    max-width: 200px;
    padding: 6px 10px;
    background: #141f2e;
    border: 1px solid #415A77;
    border-radius: 4px;
    color: #E0E1DD;
    font-size: 12px;
    font-family: inherit;

    &:focus {
      outline: none;
      border-color: #4CC9F0;
    }
  }

  .range-slider {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;

    input[type="range"] {
      flex: 1;
    }

    .range-value {
      color: #4CC9F0;
      font-size: 12px;
      min-width: 40px;
      text-align: right;
    }
  }

  .btn-small {
    padding: 6px 12px;
    background: #415A77;
    border: none;
    border-radius: 4px;
    color: #E0E1DD;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: #778DA9;
    }
  }
}

.recording-controls,
.multi-recording-controls {
  .control-status {
    background: #141f2e;
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 12px;

    .status-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;

      &:last-child {
        margin-bottom: 0;
      }

      .label {
        color: #778DA9;
        font-size: 12px;
      }

      .value {
        color: #E0E1DD;
        font-size: 12px;
        font-weight: 500;

        &.recording {
          color: #4CC9F0;
        }

        &.paused {
          color: #F7B801;
        }
      }
    }
  }

  .control-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
}

.control-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px;
  background: #141f2e;
  border: 1px solid #415A77;
  border-radius: 6px;
  color: #E0E1DD;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;

  &:hover:not(:disabled) {
    background: #415A77;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.start-btn:hover:not(:disabled) {
    background: #4CC9F0;
    color: #0D1B2A;
  }

  &.pause-btn:hover:not(:disabled) {
    background: #F7B801;
    color: #0D1B2A;
  }

  &.stop-btn:hover:not(:disabled) {
    background: #FF5252;
    color: #E0E1DD;
  }

  .el-icon {
    font-size: 20px;
  }

  span {
    font-size: 11px;
  }
}

.camera-list {
  margin-bottom: 16px;
}

.camera-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.camera-item {
  background: #141f2e;
  border: 1px solid #2d3a4f;
  border-radius: 6px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #415A77;
  }

  &.selected {
    background: rgba(76, 201, 240, 0.1);
    border-color: #4CC9F0;
  }

  &.recording {
    border-color: #4CC9F0;
    animation: pulse-recording 1.5s ease-in-out infinite;
  }

  .camera-icon {
    display: flex;
    justify-content: center;
    margin-bottom: 8px;

    .el-icon {
      font-size: 24px;
      color: #778DA9;
    }
  }

  &.selected .camera-icon .el-icon,
  &.recording .camera-icon .el-icon {
    color: #4CC9F0;
  }

  .camera-name {
    color: #E0E1DD;
    font-size: 12px;
    text-align: center;
    margin-bottom: 4px;
  }

  .camera-status {
    text-align: center;

    .status-text {
      font-size: 10px;

      &.selected {
        color: #4CC9F0;
      }

      &.recording {
        color: #FF5252;
      }

      &:not(.selected):not(.recording) {
        color: #778DA9;
      }
    }
  }
}

@keyframes pulse-recording {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.recording-list {
  margin-top: 16px;
}

.file-list {
  max-height: 200px;
  overflow-y: auto;
  background: #141f2e;
  border-radius: 6px;
  padding: 8px;

  .file-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
    border-bottom: 1px solid #2d3a4f;

    &:last-child {
      border-bottom: none;
    }

    .file-icon {
      .el-icon {
        font-size: 20px;
        color: #778DA9;
      }
    }

    .file-info {
      flex: 1;

      .file-name {
        color: #E0E1DD;
        font-size: 12px;
        margin-bottom: 2px;
      }

      .file-meta {
        color: #778DA9;
        font-size: 10px;
      }
    }

    .file-actions {
      .icon-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        background: transparent;
        border: 1px solid #415A77;
        border-radius: 4px;
        color: #778DA9;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
          background: #415A77;
          color: #E0E1DD;
        }

        .el-icon {
          font-size: 14px;
        }
      }
    }
  }
}
</style>
