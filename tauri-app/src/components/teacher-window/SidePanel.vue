<template>
  <div class="side-panel">
    <!-- 顶部状态栏 -->
    <div class="status-bar">
      <div class="status-item">
        <span class="status-label">CPU:</span>
        <span class="status-value">{{ cpuUsage }}%</span>
      </div>
      <div class="status-item">
        <span class="status-label">内存:</span>
        <span class="status-value">{{ memoryUsage }} / {{ memoryTotal }}</span>
      </div>
    </div>

    <!-- 快捷操作按钮（统一图标风格） -->
    <div class="quick-actions">
      <button
        class="quick-action-btn"
        :disabled="isStreaming"
        @click="handleStartStream"
        title="开始直播"
      >
        <el-icon><VideoCamera /></el-icon>
        <span>开始直播</span>
      </button>
      <button
        class="quick-action-btn"
        :disabled="!isStreaming"
        @click="handleStopStream"
        title="停止直播"
      >
        <el-icon><VideoPause /></el-icon>
        <span>停止直播</span>
      </button>
      <button
        class="quick-action-btn"
        :disabled="isRecording"
        @click="handleStartRecording"
        title="开始录制"
      >
        <el-icon><VideoCamera /></el-icon>
        <span>开始录制</span>
      </button>
      <button
        class="quick-action-btn"
        :disabled="!isRecording"
        @click="handlePauseRecording"
        :title="isRecordingPaused ? '恢复录制' : '暂停录制'"
      >
        <el-icon><VideoPause /></el-icon>
        <span>{{ isRecordingPaused ? '恢复录制' : '暂停录制' }}</span>
      </button>
      <button
        class="quick-action-btn"
        :disabled="!isRecording"
        @click="handleStopRecording"
        title="停止录制"
      >
        <el-icon><VideoPlay /></el-icon>
        <span>停止录制</span>
      </button>
    </div>

    <!-- 功能标签网格（所有功能统一风格） -->
    <div class="tabs-grid">
      <!-- 第一行：布局、信号源、随堂测试、智能分析 -->
      <button
        v-for="tab in basicTabs"
        :key="tab.name"
        :class="['tab-icon-btn', { active: tab.action === 'dialog' && showVisionDialog ? true : activeTab === tab.name }]"
        @click="handleTabClick(tab)"
        :title="tab.label"
      >
        <component :is="tab.icon" class="tab-icon" />
        <span class="tab-label">{{ tab.label }}</span>
      </button>

      <!-- 第二行：音频、AI语音、屏幕共享、媒体文件 -->
      <button
        v-for="tab in advancedTabs.slice(0, 4)"
        :key="tab.name"
        :class="['tab-icon-btn', { active: activeTab === tab.name }]"
        @click="activeTab = tab.name"
        :title="tab.label"
      >
        <component :is="tab.icon" class="tab-icon" />
        <span class="tab-label">{{ tab.label }}</span>
      </button>

      <!-- 第三行：视频会议、云台控制、文档课件、辅助工具 -->
      <button
        v-for="tab in advancedTabs.slice(4)"
        :key="tab.name"
        :class="['tab-icon-btn', { active: tab.action !== 'window' && activeTab === tab.name }]"
        @click="handleAdvancedTabClick(tab)"
        :title="tab.label"
      >
        <component :is="tab.icon" class="tab-icon" />
        <span class="tab-label">{{ tab.label }}</span>
      </button>
    </div>

    <div class="tab-divider"></div>

    <!-- 标签内容区 -->
    <div class="sidepanel-content-wrapper">
      <SubtitlePanel v-if="activeTab === 'ai-voice'" />
      <WebPanel v-if="activeTab === 'web'" />
      <LayoutPanel v-if="activeTab === 'layout'" @layout-change="$emit('layout-change', $event)" />
      <AudioPanel
        v-if="activeTab === 'audio'"
        @local-video-audio-change="$emit('local-video-audio-change', $event)"
        @system-audio-change="$emit('system-audio-change', $event)"
        @microphone-change="$emit('microphone-change', $event)"
        @speaker-change="$emit('speaker-change', $event)"
      />
      <ScreenSharePanel v-if="activeTab === 'screenShare'" />
      <MediaFilesPanel v-if="activeTab === 'mediaFiles'" />
      <DocumentsPanel v-if="activeTab === 'documents'" />
      <VideoMeetingWindow v-if="activeTab === 'meeting'" />
      <PtzControlPanel v-if="activeTab === 'ptz'" />
      <AidToolsPanel v-if="activeTab === 'aidTools'" ref="aidToolsRef" />
      <!-- 信号源管理面板 - 使用插槽接收父组件内容 -->
      <div v-if="activeTab === 'sources'" class="sources-panel">
        <!-- 🆕 使用独立的信号源管理快捷入口组件 -->
        <SourceManagementShortcut @show-add-source="$emit('show-add-source')" />
      </div>
    </div>

    <!-- 智能分析弹窗 -->
    <el-dialog
      v-model="showVisionDialog"
      title=""
      :show-close="false"
      :close-on-click-modal="false"
      width="90vw"
      top="2vh"
      class="vision-analysis-dialog"
      destroy-on-close
    >
      <template #header>
        <div class="dialog-header">
          <span class="dialog-title">🤖 智能视觉分析</span>
          <span class="dialog-subtitle">YOLO检测 + 考试评判 + 实训管理</span>
        </div>
      </template>
      <div class="dialog-content">
        <VisionAnalysisWindow
          @close="showVisionDialog = false"
          :external-camera-source="currentCameraSource.source"
          :external-camera-stream="currentCameraSource.stream"
        />
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { Grid, VideoCamera, Notebook, Monitor, Document, Film, Microphone, VideoPause, VideoPlay, VideoMeeting, Search } from '@/components/icons';
import { useSourceStore } from '@/stores/sourceStore';
import { useMediaStore } from '@/stores/mediaStore';
import SubtitlePanel from './panels/SubtitlePanel.vue';
import WebPanel from './panels/WebPanel.vue';
import LayoutPanel from './panels/LayoutPanel.vue';
import AudioPanel from './panels/AudioPanel.vue'
import SourceManagementShortcut from './common/SourceManagementShortcut.vue';
import ScreenSharePanel from './panels/ScreenSharePanel.vue';
import MediaFilesPanel from './panels/MediaFilesPanel.vue';
import DocumentsPanel from './panels/DocumentsPanel.vue';
import VisionAnalysisWindow from '@/components/VisionAnalysisWindow.vue';
import AidToolsPanel from './panels/AidToolsPanel.vue';
import VideoMeetingWindow from '@/components/VideoMeetingWindow.vue';
import PtzControlPanel from '@/components/PtzControlPanel.vue';

// 媒体和信号源 Store
const sourceStore = useSourceStore();
const mediaStore = useMediaStore();

const emit = defineEmits([
  'start-stream',
  'stop-stream',
  'start-recording',
  'pause-recording',
  'stop-recording',
  'rename-source',
  'local-video-audio-change',
  'system-audio-change',
  'microphone-change',
  'speaker-change',
  'layout-change',
  'show-add-source'
]);

const activeTab = ref('mediaFiles');

// 辅助工具引用
const aidToolsRef = ref(null)

// 智能分析弹窗
const showVisionDialog = ref(false);

// 获取当前选中的摄像头源及其流
const currentCameraSource = computed(() => {
  // 从 sourceStore 中查找摄像头源
  const cameraSources = sourceStore.sources.filter(s =>
    s.type === 'camera' || s.type === 'localCamera'
  );

  // 如果有摄像头源，返回第一个（主摄像头）
  if (cameraSources.length > 0) {
    return {
      source: cameraSources[0],
      stream: cameraSources[0].stream || null
    };
  }

  return { source: null, stream: null };
});

// 系统状态
const cpuUsage = ref(0);
const memoryUsage = ref('0G');
const memoryTotal = ref('15G');

// 录制和直播状态
const isRecording = ref(false);
const isRecordingPaused = ref(false);
const isStreaming = ref(false);

// 定时器
let systemMonitorInterval = null;

// 更新系统状态
const updateSystemStatus = () => {
  // 模拟系统状态更新（实际应该从 useNetworkMonitor 或其他地方获取）
  // CPU 使用率
  cpuUsage.value = (Math.random() * 10 + 2).toFixed(1);

  // 内存使用
  const usedGB = (Math.random() * 3 + 12).toFixed(1);
  memoryUsage.value = `${usedGB}G`;
};

// 开始直播
const handleStartStream = () => {
  console.log('[SidePanel] 开始直播')
  emit('start-stream')
};

// 停止直播
const handleStopStream = () => {
  console.log('[SidePanel] 停止直播')
  emit('stop-stream')
};

// 开始录制 - 控制视频展示区域(画布+音频混合,使用 FFmpeg)
const handleStartRecording = () => {
  console.log('[录制-展示区域] SidePanel 触发开始录制')
  isRecording.value = true
  isRecordingPaused.value = false
  emit('start-recording')
};

// 暂停录制 - 控制视频展示区域
const handlePauseRecording = () => {
  console.log('[录制-展示区域] SidePanel 触发暂停/恢复录制')
  isRecordingPaused.value = !isRecordingPaused.value
  emit('pause-recording', isRecordingPaused.value)
};

// 停止录制 - 控制视频展示区域
const handleStopRecording = () => {
  console.log('[录制-展示区域] SidePanel 触发停止录制')
  isRecording.value = false
  isRecordingPaused.value = false
  emit('stop-recording')
};

// 处理标签点击
const handleTabClick = (tab) => {
  console.log('[SidePanel] handleTabClick 被调用, tab:', tab)
  if (tab.action === 'dialog') {
    if (tab.name === 'visionAnalysis') {
      // 打开智能分析弹窗
      showVisionDialog.value = true
    } else {
      // 触发添加信号源对话框（包含网络摄像机扫描功能）
      console.log('[SidePanel] 触发 show-add-source-dialog 事件')
      window.dispatchEvent(new CustomEvent('show-add-source-dialog'))
    }
  } else if (tab.action === 'window') {
    // 打开独立窗口
    window.dispatchEvent(new CustomEvent('open-video-meeting-window'))
  } else {
    activeTab.value = tab.name
  }
};

// 处理高级标签点击（包含action的标签）
const handleAdvancedTabClick = (tab) => {
  if (tab.action === 'window') {
    handleTabClick(tab)
  } else {
    activeTab.value = tab.name
  }
};

// 监听 activeTab 变化，重置滚动位置
watch(activeTab, async () => {
  await nextTick()
  const panelContent = document.querySelector('.panel-content')
  if (panelContent) {
    panelContent.scrollTop = 0
  }

  // 修复：确保预览区域位置保持不变
  const previewArea = document.querySelector('.preview-area')
  if (previewArea) {
    // 防止预览区域位置变化
    const currentScrollTop = previewArea.scrollTop
    previewArea.style.position = 'relative'
    previewArea.style.top = '0'
    previewArea.scrollTop = currentScrollTop
  }
});

// 暴露方法供父组件更新状态
defineExpose({
  setRecordingState: (recording, paused) => {
    isRecording.value = recording
    isRecordingPaused.value = paused
  },
  setStreamingState: (streaming) => {
    isStreaming.value = streaming
  },
  setActiveTab: (tab) => {
    activeTab.value = tab
  }
});

// 基础功能标签（网格布局）
const basicTabs = [
  { name: 'layout', label: '布局', icon: Grid },
  { name: 'sources', label: '信号源', icon: VideoCamera, action: 'dialog' },
  { name: 'visionAnalysis', label: '智能分析', icon: Monitor, action: 'dialog' },
  { name: 'web', label: '随堂测试', icon: Monitor }
];

// 高级功能标签
const advancedTabs = [
  { name: 'audio', label: '音频', icon: Microphone },
  { name: 'ai-voice', label: 'AI语音', icon: Microphone },
  { name: 'screenShare', label: '屏幕共享', icon: Monitor },
  { name: 'mediaFiles', label: '媒体文件', icon: Film },
  { name: 'meeting', label: '视频会议', icon: VideoMeeting, action: 'window' },
  { name: 'ptz', label: '云台控制', icon: Monitor },
  { name: 'documents', label: '文档课件', icon: Document },
  { name: 'aidTools', label: '辅助工具', icon: Monitor }
];

// 所有标签（兼容旧代码）
const tabs = [...basicTabs, ...advancedTabs];

// 生命周期
onMounted(() => {
  // 初始化系统状态
  updateSystemStatus()

  // 每3秒更新一次系统状态
  systemMonitorInterval = setInterval(updateSystemStatus, 3000)
});

onUnmounted(() => {
  // 清理定时器
  if (systemMonitorInterval) {
    clearInterval(systemMonitorInterval)
  }
});
</script>

<style lang="scss" scoped>
.side-panel {
  width: 380px;
  min-width: 360px;
  max-width: 450px;
  height: 100%; // 🎯 确保侧边栏完全填充父容器高度
  background: #1B263B;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  border-left: 1px solid #2D3A4F;
  border-radius: 8px 0 0 8px;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.2);

  /* 顶部状态栏 */
  .status-bar {
    display: flex;
    justify-content: space-between;
    padding: 12px 16px;
    background: #141f2e;
    border-bottom: 1px solid #2d3a4f;

    .status-item {
      display: flex;
      align-items: center;
      gap: 6px;

      .status-label {
        color: #778DA9;
        font-size: 12px;
      }

      .status-value {
        color: #E0E1DD;
        font-size: 13px;
        font-weight: 500;
      }
    }
  }

  /* 快捷操作按钮 */
  .quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 12px 16px;
    border-bottom: 1px solid #2d3a4f;
    flex-shrink: 0;
    justify-content: center;

    .quick-action-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 10px;
      border: none;
      background: #0F2035;
      color: #E0E1DD;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 12px;
      font-family: inherit;
      white-space: nowrap;

      &:hover:not(:disabled) {
        background: #415A77;
        transform: translateY(-2px);
      }

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .el-icon {
        font-size: 16px;
      }
    }
  }

  /* 功能标签网格 */
  .tabs-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
    padding: 12px;
    border-bottom: 1px solid #2d3a4f;
    flex-shrink: 0;

    .tab-icon-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 10px 6px;
      border: none;
      background: #0D1B2A;
      color: #E0E1DD;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      min-width: 56px;
      min-height: 60px;
      font-family: inherit;

      &:hover {
        background: #415A77;
        transform: translateY(-2px);
      }

      &.active {
        background: #4CC9F0;
        color: #0D1B2A;
        font-weight: 600;
      }

      .tab-icon {
        font-size: 20px;
        margin-bottom: 4px;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
      }

      .tab-label {
        font-size: 11px;
        text-align: center;
        white-space: nowrap;
        line-height: 1.2;
      }
    }
  }

  .tab-divider {
    height: 1px;
    background: #2d3a4f;
    flex-shrink: 0;
  }

  .sidepanel-content-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    padding: 15px; // 统一 padding，避免每个面板自适应不一致

    // 🎯 修复方案：使用父容器 flex 伸缩，避免固定高度导致溢出或未填满
    > * {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;

      // 确保面板内容正确占满父容器
      &.layout-panel,
      &.audio-panel,
      &.media-files-panel,
      &.documents-panel,
      &.aid-tools-panel,
      &.web-panel,
      &.subtitle-panel,
      &.sources-panel,
      &.screen-share-panel {
        flex: 1;
        min-height: 0;
        padding: 0;
        margin: 0;
      }

      // 标题部分固定高度
      .panel-header,
      .function-tabs,
      .tab-content > .panel-header {
        flex-shrink: 0;
      }

      // 内部内容超出时滚动
      .panel-content,
      .tab-content,
      .preview-container,
      .video-wrapper {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
      }

      // 子面板的内部滚动区域
      & .panel-content {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
      }
    }

    // 🎯 修复：确保滚动容器样式一致
    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 3px;

      &:hover {
        background: rgba(255, 255, 255, 0.3);
      }
    }
  }
}

// 智能分析弹窗样式
.dialog-header {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .dialog-title {
    font-size: 18px;
    font-weight: 600;
    color: #E0E1DD;
  }

  .dialog-subtitle {
    font-size: 12px;
    color: #778DA9;
  }
}

.dialog-content {
  height: 85vh;
  padding: 0;
  margin: -10px -20px -30px;
  overflow: hidden;
}

:deep(.vision-analysis-dialog) {
  .el-dialog {
    background: #0D1B2A;
    border-radius: 12px;
    overflow: hidden;
  }

  .el-dialog__header {
    padding: 16px 20px;
    margin: 0;
    background: #1A2A3A;
    border-bottom: 1px solid #2d3a4f;
  }

  .el-dialog__body {
    padding: 0;
    height: calc(85vh - 60px);
    overflow: hidden;
  }

  .el-dialog__headerbtn {
    top: 16px;
    right: 20px;

    .el-dialog__close {
      color: #778DA9;
      font-size: 18px;

      &:hover {
        color: #E0E1DD;
      }
    }
  }
}
</style>
