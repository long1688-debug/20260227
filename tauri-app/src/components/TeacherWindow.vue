<template>
  <div class="teacher-window">
    <!-- 许可证验证 -->
    <LicenseGuard
      v-if="!licenseVerified"
      @license-verified="onLicenseVerified"
      @license-failed="onLicenseFailed"
    />

    <!-- 主教师界面 -->
    <div v-else class="app-shell">
      <!-- 标题栏 -->
      <TitleBar>
        <template #toolbar>
          <!-- 🆕 使用独立的视频操作工具栏组件 -->
          <VideoOperationToolbar
            :is-recording="isRecording"
            :is-recording-paused="isRecordingPaused"
            :is-annotation-enabled="isAnnotationEnabled"
            @enable-annotation="enableAnnotationForAll"
            @recording-command="handleRecordingCommand"
            @pause-recording="handlePauseAllCanvasRecording"
            @stop-recording="handleStopAllCanvasRecording"
            @show-recording-dialog="showRecordingDialog = true"
            @show-settings-dialog="showSettingsDialog = true"
          />
        </template>
      </TitleBar>

      <!-- 主内容区 -->
      <div class="main-content-wrapper">
        <!-- 左侧内容区（视频 + 预览栏） -->
        <div class="content-area">
          <div class="main-content">
            <!-- 视频区域 -->
            <div class="video-area">
              <!-- 🆕 渲染引擎主画布（覆盖模式） -->
              <div class="render-overlay" v-if="useRenderEngine">
                <RenderEngineWrapper
                  ref="renderEngineRef"
                  :sources="mappedRenderSources"
                  :layout-type="convertLayoutType(currentLayout)"
                  :width="1280"
                  :height="720"
                  :auto-start="true"
                  @ready="onRenderReady"
                  @error="onRenderError"
                  @source-ready="onSourceReady"
                  @source-error="onSourceError"
                  @element-click="onRenderElementClick"
                  @layout-change="onLayoutChange"
                />

                <!-- 浮动工具栏 -->
                <div class="render-floating-toolbar">
                  <button class="tool-btn" @click="toggleDrawingMode" :class="{ active: isDrawingMode }">
                    <span>✏️</span>
                  </button>
                  <button class="tool-btn" @click="captureScreen">
                    <span>📷</span>
                  </button>
                  <button class="tool-btn" @click="switchRenderLayout">
                    <span>🔀</span>
                  </button>
                  <button class="tool-btn" @click="toggleRenderEngine">
                    <span>{{ useRenderEngine ? '🔄' : '🎬' }}</span>
                  </button>
                </div>

                <!-- YOLO 检测模式状态指示器 -->
                <div class="yolo-status-indicator">
                  <div class="status-row">
                    <span class="status-label">网络:</span>
                    <span class="status-value" :style="{ color: getNetworkStatusText.color }">
                      {{ getNetworkStatusText.icon }} {{ getNetworkStatusText.text }}
                    </span>
                  </div>
                  <div class="status-row">
                    <span class="status-label">检测模式:</span>
                    <span class="status-value" :style="{ color: getDetectionModeText.color }">
                      {{ getDetectionModeText.icon }} {{ getDetectionModeText.text }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- 🆕 标准视频网格（传统模式） -->
              <VideoSection
                v-if="!useRenderEngine"
                :current-layout="currentLayout"
                :canvas-sources="mappedCanvasSources"
                :canvas-source-map="canvasSourceMap"
                :drag-over-index="dragOverIndex"
                :network-quality="networkQuality"
                :custom-grid-count="customGridCount"
                :is-maximized="isMaximized"
                :maximized-index="maximizedIndex"
                :global-subtitle="globalSubtitle"
                :subtitle-visible="subtitleVisible"
                :current-subtitle-text="currentSubtitleText"
                @show-recording-dialog="showRecordingDialog = true"
                @show-settings-dialog="showSettingsDialog = true"
                @show-multicam-dialog="showMulticamDialog = true"
                @show-vr-dialog="showVRDialog = true"
                @show-chromakey-dialog="showChromakeyDialog = true"
                @show-subtitle-dialog="showSubtitleDialog = true"
                @show-video-to-subtitle-dialog="showVideoToSubtitleDialog = true"
                @export-subtitles="handleExportSubtitles"
                @import-subtitles="handleImportSubtitles"
                @clear-subtitles="handleClearSubtitles"
                @toggle-maximize="handleToggleMaximize"
                @show-network-detail="handleShowNetworkDetail"
              />
            </div>

            <!-- 信号源预览栏（固定在内容区底部） -->
            <div class="global-preview-bar">
              <SourcePreviewBar
                ref="sourcePreviewBarRef"
                @rename-source="handleOpenRenameSource"
                @remove-source="handleRemoveSource"
                @drag-start="handleDragStart"
                @drag-end="handleDragEnd"
                @mouse-down="processMouseDown"
                @touch-start="processTouchStart"
              />
            </div>
          </div>
        </div>

        <!-- 右侧边栏（拉通到最底部） -->
        <SidePanel
          ref="sidePanelRef"
          @start-stream="handleStartStream"
          @stop-stream="handleStopStream"
          @start-recording="handleStartRecording"
          @pause-recording="handlePauseRecording"
          @stop-recording="handleStopRecording"
          @rename-source="handleOpenRenameSource"
          @local-video-audio-change="handleLocalVideoAudioChange"
          @system-audio-change="handleSystemAudioChange"
          @layout-change="handleLayoutChange"
        >
          <template #layout>
            <div class="panel-header">
              <h3>场景布局</h3>
            </div>
            <!-- 🆕 使用独立的布局管理面板组件 -->
            <LayoutManagementPanel
              :current-layout="currentLayout"
              :custom-grid-count="customGridCount"
              @layout-change="handleLayoutChange"
              @custom-count-change="handleCustomCountChange"
            />
          </template>

          <!-- 🎯 信号源管理面板（已移除，点击信号源按钮直接弹出添加对话框） -->
          <template #sources>
            <div style="padding: 20px; text-align: center; color: #778DA9;">
              请通过"信号源"按钮弹出管理对话框
            </div>
          </template>
        </SidePanel>

        <!--  AI语音助手组件 -->
        <VoiceAssistant />
      </div>

      <!-- 全局对话框和组件 -->
      <RecordingManagerDialog
        v-model="showRecordingDialog"
        :recording-config="recordingConfig"
        :audio-channels="audioChannels"
        :recording-templates="recordingTemplates"
        :recordings="recordings"
        :recording-filter="recordingFilter"
        @play-recording="handleOpenPlayback"
        @load-recordings="loadRecordings"
      />
      <SettingsDialog v-model="showSettingsDialog" :settings="settings" />
      <SubtitleManagerDialog v-model="showSubtitleDialog" />
      <AddSourceDialog
        v-model="showAddSourceDialog"
        :local-devices="localDevices"
        :capture-devices="captureDevicesList"
        :scanner-devices="scannerDevicesList"
        :sources="sourceStore.sources"
        @submit-source-form="handleSubmitNewSource"
        @add-to-preview="handleAddToPreview"
        @remove-from-preview="handleRemoveFromPreview"
        @rename-source="handleRenameSource"
        @delete-source="handleDeleteSource"
      />
      <ScreenShareDialog v-model="showScreenShareDialog" />

      <!-- 多路音视频编解码对话框 -->
      <MediaCodecDialog v-model="showMediaCodecDialog" />

      <!-- 其他功能对话框 -->
      <PlaybackDialog
        v-model="showPlaybackDialog"
        :video-url="playbackVideoUrl"
      />
      <NetworkDetailDialog
        v-model="showNetworkDetailDialog"
        :network-detail="currentNetworkDetail"
      />
      <RenameSourceDialog
        v-model="showRenameSourceDialog"
        :source="renameSourceTarget"
        @rename="handleRenameSource"
      />

      <!-- 🆕 使用独立的字幕编辑对话框组件 -->
      <SubtitleEditDialog
        v-model="showSubtitleEditDialog"
        :subtitle="editingSubtitle"
        @save="saveEditedSubtitle"
      />

      <!-- 🆕 使用独立的字幕导入对话框组件 -->
      <!-- 🆕 使用独立的字幕导入对话框组件 -->
      <SubtitleImportDialog
        v-model="showSubtitleImportDialog"
        @import-subtitles="handleImportSubtitles"
      />

      <!-- 🆕 使用独立的全局通知容器组件（已替代 HandRaiseNotification） -->
      <GlobalNotifications
        :hand-raise-notifications="handRaiseNotifications"
        @accept-hand-raise="handleHandRaiseAccept"
        @reject-hand-raise="handleHandRaiseReject"
        @close-notification="handleCloseNotification"
      />

      <!-- 🆕 使用独立的弹窗窗口容器组件 -->
      <TeleportedWindows
        :show-video-meeting="showVideoMeetingWindow"
        :show-vision-analysis="showVisionAnalysis"
        :show-analysis-window="showAnalysisWindow"
        :show-web-window="showWebWindow"
        @close-video-meeting="showVideoMeetingWindow = false"
        @close-vision-analysis="showVisionAnalysis = false"
        @close-analysis-window="showAnalysisWindow = false"
        @close-web-window="showWebWindow = false"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled, Refresh } from '@element-plus/icons-vue'
import TitleBar from './TitleBar.vue'
import { audioMixer } from '@/utils/audioMixer'
// 🆕 重构新增组件
import VideoOperationToolbar from './teacher-window/toolbar/VideoOperationToolbar.vue'
import LayoutManagementPanel from './teacher-window/panels/LayoutManagementPanel.vue'
import SubtitleEditDialog from './teacher-window/dialogs/SubtitleEditDialog.vue'
import SubtitleImportDialog from './teacher-window/dialogs/SubtitleImportDialog.vue'
// 🆕 重构新增组件（第二阶段）
import DropOverlay from './teacher-window/common/DropOverlay.vue'
import SourceManagementShortcut from './teacher-window/common/SourceManagementShortcut.vue'
import GlobalNotifications from './teacher-window/common/GlobalNotifications.vue'
import TeleportedWindows from './teacher-window/common/TeleportedWindows.vue'
import VideoSection from './teacher-window/layout/VideoSection.vue'
import SourcePreviewBar from './teacher-window/layout/SourcePreviewBar.vue'
import SidePanel from './teacher-window/SidePanel.vue'
import RecordingManagerDialog from './teacher-window/dialogs/RecordingManagerDialog.vue'
import SettingsDialog from './teacher-window/dialogs/SettingsDialog.vue'
import SubtitleManagerDialog from './teacher-window/dialogs/SubtitleManagerDialog.vue'
import AddSourceDialog from './teacher-window/dialogs/AddSourceDialog.vue'
// 🎯 预留功能组件（多机位、VR录制、色键抠像、视频转字幕）
import MulticamDialog from './teacher-window/dialogs/MulticamDialog.vue'
import VrRecordingDialog from './teacher-window/dialogs/VrRecordingDialog.vue'
import ChromakeyDialog from './teacher-window/dialogs/ChromakeyDialog.vue'
import VideoToSubtitleDialog from './teacher-window/dialogs/VideoToSubtitleDialog.vue'
// 🆕 许可证验证组件
import LicenseGuard from './LicenseGuard.vue'
import ScreenShareDialog from './teacher-window/dialogs/ScreenShareDialog.vue'
import PlaybackDialog from './teacher-window/dialogs/PlaybackDialog.vue'
import NetworkDetailDialog from './teacher-window/dialogs/NetworkDetailDialog.vue'
import RenameSourceDialog from './teacher-window/dialogs/RenameSourceDialog.vue'
import MediaCodecDialog from './teacher-window/dialogs/MediaCodecDialog.vue'
import VideoMeetingWindow from './VideoMeetingWindow.vue'
// 🆕 渲染引擎组件
import RenderEngineWrapper from './render/RenderEngineWrapper.vue'
import CameraPreview from './render/CameraPreview.vue'
// 🆕 AI语音助手组件
import VoiceAssistant from './VoiceAssistant.vue'
import {
  EditPen,
  VideoCamera,
  VideoPause,
  VideoPlay,
  VideoStop,
  Connection,
  FolderOpened,
  Setting,
  ArrowDown
} from './icons'
// ============================================
// 核心 Composables - 必须导入才能正常工作
// ============================================
import { useRecording } from '@/composables/useRecording'
import { useVideoSync } from '@/composables/useVideoSync'
import { useNetworkMonitor } from '@/composables/useNetworkMonitor'
import { useAudioMonitor } from '@/composables/useAudioMonitor'
import { useSourceDrag } from '@/composables/useSourceDrag'
import { useSettings } from '@/composables/useSettings'

// 🆕 业务逻辑 Composables（新创建）
import { useSubtitleManager } from '@/composables/useSubtitleManager'
import { useLayoutManager } from '@/composables/useLayoutManager'
import { useLayoutStates } from '@/composables/useLayoutStates'
import { useSourceManager } from '@/composables/useSourceManager'
import { useAudioManager } from '@/composables/useAudioManager'
import { useLiveStream } from '@/composables/useLiveStream'
import { useTTSAnnouncements } from '@/composables/useTTS'

// ============================================
// Pinia Stores - 状态管理
// ============================================
import { useStudentStore, useTaskStore, useVisionStore, useSourceStore } from '@/stores'
import { useCanvasStore } from '@/stores/canvasStore'
import { useSubtitleStore } from '@/stores/subtitleStore'
import { useAudioStore } from '@/stores/audioStore'
import { useLiveStreamingStore } from '@/stores/liveStreamingStore'
import { useMediaStore } from '@/stores/mediaStore'
import { useVideoSourceManager } from '@/utils/videoSource'
import apiService from '@/services/apiService'
import { proxyLocalVideo, proxyNetworkStream, stopStreamProxy, controlStreamAudio } from '@/utils/cpp-bridge.js'
import { minimizeWindow, maximizeWindow, closeApp } from '@/utils/tauri-api.js'
import { listCaptureDevices, filterCaptureCards, filterDocumentScanners } from '@/services/captureDeviceService'
import { speechRecognition } from '@/services/subtitleService'

// 🎯 提前初始化 stores（用于 window.__sourceStore 和 window.__canvasStore）
const studentStore = useStudentStore()
const taskStore = useTaskStore()
const visionStore = useVisionStore()
const sourceStore = useSourceStore()
const canvasStore = useCanvasStore()
const subtitleStore = useSubtitleStore()
const audioStore = useAudioStore()
const liveStreamingStore = useLiveStreamingStore()
const mediaStore = useMediaStore()
const videoSourceManager = useVideoSourceManager()

// ============================================
// 🆕 TTS 语音播报初始化
// ============================================
const tts = useTTSAnnouncements()

// ============================================
// 初始化核心 Composables
// ============================================
const {
  // 录制相关
  recordingConfig,
  audioChannels,
  recordings,
  recordingTemplates,
  sourceRecordingState,
  canvasRecordingStates,
  previewRecordingStates,
  currentRecordingSession,
  showPlaybackDialog,
  showRecordingDialog,
  playbackVideoRef,
  recordingFilter,

  // 多机位功能
  startMulticamRecording,
  stopMulticamRecording,
  activeCameraIndex,
  switchCamera,

  // VR/360°视频功能
  vrRecordingState,
  startVrRecording,
  stopVrRecording,

  // 音频管理
  toggleNoiseReduction,
  setChannelEnabled,

  // 模板管理
  loadTemplates: loadRecordingTemplates,
  saveTemplate,
  deleteTemplate: deleteRecordingTemplate,

  // 画布录制控制
  startAllCanvasRecording,
  pauseAllCanvasRecording,
  stopAllCanvasRecording,
  resumeAllCanvasRecording,

  // 录制文件管理
  loadRecordings: loadRecordingsFromComposable,
  deleteRecording: deleteRecordingFromComposable
} = useRecording()

const {
  // 视频同步相关
  currentLayout,
  pipVisible,
  pipPosition,
  changeLayout,
  togglePip,
  addVideoSource,
  removeVideoSource,
  setVideoPreviewRef,
  setCanvasSource,
  videoPreviews,
  canvasSourceMap,
  videoPreviewRefs,
  // 🎯 视频同步调用函数
  registerMasterVideo,
  registerSlaveVideo,
  unregisterSlaveVideo,
  clearMasterVideo,
  checkAudioSync,
  getSyncStatus,
  addSource: addSourceToVideoSync  // 获取useVideoSync的addSource函数
} = useVideoSync()

// 🎯 初始化布局状态管理 - 确保 window.__layoutStates 被正确设置
const { layoutStates, assignSource, saveToStorage } = useLayoutStates()

// 🎯 确保 window.__layoutStates 已初始化
if (typeof window !== 'undefined' && !window.__layoutStates) {
  window.__layoutStates = layoutStates
  console.log('[TeacherWindow] 初始化 window.__layoutStates')
}

// 🎯 确保 window.__sourceStore 已初始化（用于获取信号源类型）
if (typeof window !== 'undefined' && !window.__sourceStore) {
  window.__sourceStore = sourceStore
  console.log('[TeacherWindow] 初始化 window.__sourceStore')
}

const {
  // 网络监控相关
  networkQuality,
  startNetworkMonitoring: startNetworkMonitor,
  stopNetworkMonitoring: stopNetworkMonitor
} = useNetworkMonitor()

const {
  // 音频监控相关
  audioLevels,
  startAudioMonitor,
  stopAudioMonitor
} = useAudioMonitor()

const {
  // 设置相关
  settings,
  showSettingsDialog,
  loadSettings,
  saveSettings,
  resetSettings
} = useSettings()

// ============================================
// 初始化 Pinia Stores
// ============================================
// Stores 已在上方提前初始化

// ============================================
// 🆕 许可证验证相关状态
// ============================================
const licenseVerified = ref(false) // 许可证是否已验证通过

// 🎯 信号源拖拽管理（支持从预览区拖拽到画布网格）
// 🎯 修复：重命名解构以避免与 useVideoSync 冲突
const {
  dragOverIndex,
  draggedSourceType,
  isDraggingSource,
  currentSelectedSource,
  canvasSourceMap: dragCanvasSourceMap,  // 重命名以避免冲突
  videoPreviews: dragVideoPreviews,  // 🎯 修复：重命名解构以避免与 useVideoSync 冲突
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  handleDrop,
  setCurrentSelectedSource,
  setVideoPreviews
} = useSourceDrag({
  // 🎯 关键修复：传递 canvasSourceMap，确保拖拽更新的是正确的映射
  canvasSourceMap,
  saveLayoutMap: saveToStorage,
  assignSource,
  currentLayout,
  allSources: sourceStore.sources,  // 传递所有源给useSourceDrag
  addSourceToGlobalList: (source) => {
    // 将克隆的源添加到源存储中
    if (!sourceStore.sources.some(s => s.id === source.id)) {
      sourceStore.sources.push(source);
      console.log(`[TeacherWindow] 已将克隆源添加到全局列表: ${source.name} (${source.id})`);
    }

    // 同时将克隆的源添加到useVideoSync的源列表中
    if (typeof addSourceToVideoSync === 'function') {
      addSourceToVideoSync(source);
      console.log(`[TeacherWindow] 已将克隆源添加到VideoSync列表: ${source.name} (${source.id})`);
    }
  }
})


// ============================================
// 拖拽事件处理函数（供 VideoSection 调用）
// ============================================
const onDragOver = (event, index) => {
  if (typeof handleMouseDown === 'function') {
    // 使用 handleMouseDown 内部的拖拽逻辑
  }
  dragOverIndex.value = index
}

const onDragLeave = (event) => {
  dragOverIndex.value = null
}

const onDrop = (event, index) => {
  if (typeof handleDrop === 'function') {
    const source = {
      id: event?.dataTransfer?.getData('sourceId') || `drop_${Date.now()}`,
      type: event?.dataTransfer?.getData('sourceType') || 'localVideo',
      name: event?.dataTransfer?.getData('sourceName') || 'Dropped Source'
    }
    handleDrop(event, index)
  }
}

// ============================================
// 设置对话框相关状态
// ============================================
const settingsActiveTab = ref('recording')
const customVideoBitrate = ref(0)
const customLiveBitrate = ref(0)

// ============================================
// 信号源管理相关状态
// ============================================
// 🎯 修复：allSources 应该从 sourceStore 同步获取
const allSources = computed(() => {
  return sourceStore.sources.map(source => ({
    ...source,
    // 确保 addedToPreview 属性存在
    addedToPreview: source.addedToPreview || false
  }))
})

// 将画布源映射转换为渲染引擎所需的格式
const mappedRenderSources = computed(() => {
  if (!useRenderEngine.value) return []

  const sources = []

  // 根据canvasSourceMap映射，将当前布局的源转换为渲染引擎格式
  const validIndices = getVisibleCanvasIndices(currentLayout.value)

  validIndices.forEach(index => {
    const sourceId = canvasSourceMap.value[index]
    if (sourceId) {
      const source = allSources.value.find(s => s.id === sourceId)
      if (source) {
        // 转换为渲染引擎需要的格式
        sources.push({
          id: source.id,
          name: source.name,
          type: mapSourceType(source.type), // 映射到渲染引擎支持的类型
          url: source.url,
          deviceId: source.deviceId,
          stream: source.stream,
          properties: source.properties || {}
        })
      }
    }
  })

  return sources
})

// 将画布源映射转换为VideoGrid所需的格式
const mappedCanvasSources = computed(() => {
  // 保持原有的映射逻辑，用于兼容目的（当useRenderEngine为false时）
  return allSources.value.filter(source => {
    // 检查这个源是否在当前布局的canvasSourceMap中
    return Object.values(canvasSourceMap.value).some(id => id === source.id)
  })
})

const currentPage = ref(1)
const pageSize = ref(6) // 每页显示 6 个信号源
const previewVideoRefs = ref([]) // 源预览窗口视频引用

// ============================================
// 🆕 渲染引擎相关状态
// ============================================
const renderEngineRef = ref(null) // 渲染引擎组件引用
const selectedCameraId = ref('') // 当前选中的摄像头ID
const activeSources = ref([]) // 活跃的视频源列表
const renderLayoutType = ref('single') // 当前渲染布局类型
const isDrawingMode = ref(false) // 是否处于绘制模式
 const useRenderEngine = ref(true) // 是否启用渲染引擎覆盖模式，默认为true

// 将源类型映射到渲染引擎支持的类型
const mapSourceType = (sourceType) => {
  const typeMap = {
    'localVideo': 'video',
    'localDevice': 'camera',
    'networkCamera': 'netcam',
    'remoteDesktop': 'desktop',
    'screenShare': 'screen',
    'localCamera': 'camera',
    'ppt': 'web',
    'pptx': 'web',
    'word': 'web',
    'doc': 'web',
    'docx': 'web',
    'pdf': 'web'
  }

  return typeMap[sourceType] || 'video'
}

// 将布局编号转换为渲染引擎支持的布局类型
const convertLayoutType = (layoutNum) => {
  const layoutMap = {
    1: 'single',
    2: 'grid-1x2',
    3: 'grid-1x2',
    4: 'grid-2x2',
    5: 'grid-2x2',
    7: 'grid-3x3',
    10: 'grid-3x3',
    11: 'grid-3x3',
    12: 'grid-3x3',
    13: 'grid-3x3',
    18: 'single',
  }

  return layoutMap[layoutNum] || 'single'
}

// ============================================
// 音频监控相关状态
// ============================================
const enableAudioMonitor = ref(false) // 监听
const enableTerminalMute = ref(false) // 终端静音
const enableAudioNoiseReduction = ref(false) // 音频降噪

// ============================================
// 学生、任务等管理状态
// ============================================
const activeTab = ref('students')
const students = ref([])
const tasks = ref([])
const trainings = ref([])
const analysisResults = ref([])

// ============================================
// 直播相关状态
// ============================================
const isLive = ref(false)
const liveStreamUrl = ref('')

// ============================================
// 举手相关状态
// ============================================
const handRaiseNotifications = ref([])
const handRaiseSound = ref(null)

// ============================================
// 服务器状态相关
// ============================================
// 服务器状态已移至服务端管理

// ============================================
// Web 功能导航
// ============================================
const WEB_FEATURES_BASE_URL = 'http://127.0.0.1:8080/web'

// 打开外部链接的辅助函数
const openExternal = async (url) => {
  try {
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(url)
  } catch (e) {
    console.error('使用 Tauri shell 打开链接失败:', e)
    window.open(url, '_blank')
  }
}

const openWebFeature = async (feature) => {
  const featureUrls = {
    student: `${WEB_FEATURES_BASE_URL}/student-training.html`,
    teacher: `${WEB_FEATURES_BASE_URL}/teacher-management.html`,
    vision: `${WEB_FEATURES_BASE_URL}/vision-analysis.html`,
    api: `${WEB_FEATURES_BASE_URL}/api-test.html`,
    home: `${WEB_FEATURES_BASE_URL}/index.html`,
    status: `${WEB_FEATURES_BASE_URL}/service-status.html`
  }

  const url = featureUrls[feature]
  if (url) {
    await openExternal(url)
  } else {
    ElMessage.warning(`功能 "${feature}" 暂未实现`)
  }
}

const openWebFunctions = async () => {
  await openExternal(`${WEB_FEATURES_BASE_URL}/index.html`)
}

// ============================================
// 布局变化监听
// ============================================
let isHandlingLayoutChange = false

// 监听布局变化，保存和恢复每个布局的独立状态
watch(currentLayout, (newLayout, oldLayout) => {
  // 如果是 handleLayoutChange 触发的，跳过处理
  if (isHandlingLayoutChange) {
    console.log(`[布局切换] watch 跳过（handleLayoutChange 已处理）`)
    isHandlingLayoutChange = false
    return
  }

  console.log(`[布局切换] watch 触发 - oldLayout: ${oldLayout}, newLayout: ${newLayout}`)

  // 保存旧布局的状态（oldLayout 为 undefined 表示初始化，不需要保存）
  if (oldLayout !== undefined && oldLayout !== newLayout) {
    console.log(`[布局切换] 从 ${oldLayout} 分屏切换到 ${newLayout} 分屏`)

    // 🎯 保存旧布局的状态（只保存批注，不操作 canvasSourceMap）
    saveCurrentLayoutState(oldLayout)

    // 🎯 切换时强制 maximizedIndex = null
    maximizedIndex.value = null
    isMaximized.value = false

    // 🎯 切换时重置视频预览区域状态（让 VideoPreview 组件重新挂载）
    // 注意：不操作 canvasSourceMap，让 useVideoSync.js 统一处理
    videoPreviews.value = []
  } else if (oldLayout === undefined) {
    console.log(`[布局切换] 初始化布局 ${newLayout}`)
  }
})

// ============================================
// 本地状态定义 (非 Composable 管理的)
// ============================================

// 🎯 注意：handRaiseNotification 已废弃，使用 handRaiseNotifications 数组替代
// const handRaiseNotification = ref({
//   show: false,
//   studentName: ''
// })

// 初始化示例数据
const initializeSampleData = () => {
  // 初始化学生数据
  if (students.value.length === 0) {
    students.value = [
      { id: 'S001', name: '张三', online: true, handRaised: false },
      { id: 'S002', name: '李四', online: true, handRaised: false },
      { id: 'S003', name: '王五', online: false, handRaised: false }
    ]
  }

  // 初始化任务数据
  if (tasks.value.length === 0) {
    tasks.value = [
      { id: 'T001', title: '第一章练习', status: 'completed', description: '完成第一章的练习题', submitted: 5, total: 10 },
      { id: 'T002', title: '第二章测试', status: 'in_progress', description: '进行第二章的测试', submitted: 3, total: 10 }
    ]
  }

  // 初始化实训数据
  if (trainings.value.length === 0) {
    trainings.value = [
      { id: 'TR001', title: '基础操作训练', description: '掌握基本操作', progress: 80, status: 'success', icon: '🎯' },
      { id: 'TR002', title: '高级功能训练', description: '学习高级功能', progress: 45, status: 'warning', icon: '🚀' }
    ]
  }

  // 初始化视觉分析数据
  if (analysisResults.value.length === 0) {
    analysisResults.value = [
      { id: 'A001', studentName: '张三', type: '专注度', focus: 85, emotion: '专注', behavior: '积极参与', time: '13:30' },
      { id: 'A002', studentName: '李四', type: '情绪', focus: 72, emotion: '平静', behavior: '认真听讲', time: '13:35' }
    ]
  }

  console.log('[TeacherWindow] 已初始化示例数据')
}

// 高级录制功能对话框
const showMulticamDialog = ref(false)
const showVrDialog = ref(false)
const showChromakeyDialog = ref(false)

// 视频会议窗口
const showVideoMeetingWindow = ref(false)

// 🆕 智能视觉分析窗口（YOLO检测+考试评判）
const showVisionAnalysis = ref(false)

// Analysis 全屏窗口
const showAnalysisWindow = ref(false)

// Web 全屏窗口
const showWebWindow = ref(false)

// 布局选项
// 🎯 2026-04-20 更新：统一使用新布局索引
const basicLayouts = [
  { label: '1 分屏', value: 1 },
  { label: '2 分屏', value: 2 },
  { label: '3 分屏', value: 3 },
  { label: '4 分屏', value: 4 },
  { label: '6 分屏', value: 5 },   // 新索引: 5
  { label: '9 分屏', value: 7 },   // 新索引: 7
  { label: '16 分屏', value: 10 },  // 新索引: 10
  { label: '25 分屏', value: 11 }, // 新索引: 11
  { label: '36 分屏', value: 12 }, // 新索引: 12
  { label: '49 分屏', value: 13 }  // 新索引: 13
]

// 基础功能对话框
// showRecordingDialog 已从 useRecording 导入
// showSettingsDialog 已从 useSettings 导入
// showPlaybackDialog 已从 useRecording 导入
const showSubtitleDialog = ref(false)
const showAddSourceDialog = ref(false)
const showRenameSourceDialog = ref(false)
const renameSourceTarget = ref(null)
const showSubtitleEditDialog = ref(false)
const showSubtitleImportDialog = ref(false)
const showVideoToSubtitleDialog = ref(false)
const showScreenShareDialog = ref(false)

// 多路音视频编解码对话框
const showMediaCodecDialog = ref(false)

// 其他功能对话框
const scannerDevicesList = ref([])
const captureDevicesList = ref([]) // 采集设备列表
const localDevices = ref([]) // 本地摄像头设备列表
const playbackVideoUrl = ref('') // 回放视频URL
const showNetworkDetailDialog = ref(false) // 网络详情对话框

// 字幕编辑相关
const exportedSubtitles = ref([])
const editingSubtitle = ref(null)

// 绿幕配置
const chromakeyConfig = reactive({
  enabled: false,
  color: '0x00FF00',
  similarity: 0.4,
  blend: 0.1,
  background_image: ''
})

// 双击放大相关状态
const isMaximized = ref(false)
const maximizedIndex = ref(null) // 使用 null 表示没有最大化

// 自由布局自定义格子数量
const customGridCount = ref(4) // 默认4个格子
const MAX_CUSTOM_GRID_COUNT = 49

const handleCustomCountChange = (value) => {
  console.log('[TeacherWindow] 自定义格子数量变更:', value)
  ElMessage.success(`自定义格子数量已设置为 ${value}`)
}

// 字幕状态
const globalSubtitle = ref('')
const subtitleVisible = ref(true)
const currentSubtitleText = ref('')

// 字幕管理相关状态
const generatedSubtitles = ref([]) // 所有生成的字幕数据
const activeSubtitleTab = ref('list')
const exportFormat = ref('srt')
const exporting = ref(false)
const exportPreview = ref('')
const subtitleLanguage = ref('zh')
const subtitleModel = ref('tiny')
const selectedVideoIndex = ref(-1)
const previewVideos = ref([])
const isVideoSubtitleRunning = ref(false)
const videoSubtitleText = ref('')

// 网络质量详情
const currentNetworkDetail = ref(null)

// 拖拽状态
// SidePanel 引用
const sidePanelRef = ref(null)

// 多机位会话ID
const multicamSessionId = ref('default')

// ASR 运行状态
const isASRRunning = ref(false)

// 全局批注相关
const globalAnnotationEnabled = ref(false)
const isAnnotationEnabled = computed(() => globalAnnotationEnabled.value)
const globalAnnotationCanvasRef = ref(null)
const isGlobalDrawing = ref(false)
const annotationBrushType = ref('pen')
const annotationColor = ref('#ff0000')
const annotationBrushSize = ref(3)
let lastGlobalX = 0
let lastGlobalY = 0

// 工具栏录制状态
const isRecording = ref(false)
const isRecordingPaused = ref(false)

// ============================================
// 暴露全局方法供子组件调用
// ============================================

// ============================================
// 🆕 许可证验证方法
// ============================================
const onLicenseVerified = () => {
  licenseVerified.value = true
  ElMessage.success('许可证验证成功，欢迎使用教师端！')
  console.log('[TeacherWindow] 许可证验证通过，进入教师界面')
}

const onLicenseFailed = (error) => {
  console.error('[TeacherWindow] 许可证验证失败:', error)
  ElMessage.error('许可证验证失败，请检查许可证服务器状态')
}

// ============================================
// 窗口控制函数
// ============================================
const minimize = async () => {
  try {
    await minimizeWindow()
    console.log('[TeacherWindow] 窗口已最小化')
  } catch (error) {
    console.error('[TeacherWindow] 最小化窗口失败:', error)
    ElMessage.error('最小化窗口失败')
  }
}

const maximize = async () => {
  try {
    await maximizeWindow()
    console.log('[TeacherWindow] 窗口最大化状态已切换')
  } catch (error) {
    console.error('[TeacherWindow] 最大化窗口失败:', error)
    ElMessage.error('最大化窗口失败')
  }
}

const close = async () => {
  try {
    await closeApp()
    console.log('[TeacherWindow] 窗口已关闭')
  } catch (error) {
    console.error('[TeacherWindow] 关闭窗口失败:', error)
    ElMessage.error('关闭窗口失败')
  }
}

// ============================================
// VideoHeader 按钮功能实现
// ============================================

// 刷新所有摄像头
const refreshAllCameras = async () => {
  try {
    ElMessage.info('正在刷新所有摄像头...')
    if (videoSourceManager && videoSourceManager.refreshDevices) {
      await videoSourceManager.refreshDevices()
    }
    ElMessage.success('摄像头刷新成功')
  } catch (error) {
    console.error('刷新摄像头失败', error)
    ElMessage.error('刷新摄像头失败')
  }
}

const enableAnnotationForAll = async () => {
  globalAnnotationEnabled.value = !globalAnnotationEnabled.value
  if (globalAnnotationEnabled.value) {
    ElMessage.success('已启用全局批注')
    await nextTick()
    initGlobalAnnotationCanvas()
  } else {
    ElMessage.info('已关闭全局批注')
    clearGlobalAnnotation()
  }
}

const initGlobalAnnotationCanvas = () => {
  if (globalAnnotationCanvasRef.value) {
    const canvas = globalAnnotationCanvasRef.value
    const videoGrid = canvas.parentElement
    canvas.width = videoGrid.offsetWidth
    canvas.height = videoGrid.offsetHeight
    console.log('[TeacherWindow] 全局批注画布已初始化:', canvas.width, 'x', canvas.height)
  }
}

const startGlobalAnnotation = (e) => {
  isGlobalDrawing.value = true
  lastGlobalX = e.offsetX
  lastGlobalY = e.offsetY
}

const drawGlobalAnnotation = (e) => {
  if (!isGlobalDrawing.value || !globalAnnotationCanvasRef.value) return
  const canvas = globalAnnotationCanvasRef.value
  const ctx = canvas.getContext('2d')

  if (annotationBrushType.value === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.strokeStyle = 'rgba(0, 0, 0, 1)'
    ctx.lineWidth = annotationBrushSize.value * 3
  } else if (annotationBrushType.value === 'highlighter') {
    ctx.globalCompositeOperation = 'source-over'
    const color = annotationColor.value
    const hexColor = color.startsWith('#') ? color : '#' + color
    ctx.strokeStyle = hexColor + '40'
    ctx.lineWidth = annotationBrushSize.value * 2
  } else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = annotationColor.value
    ctx.lineWidth = annotationBrushSize.value
  }

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.beginPath()
  ctx.moveTo(lastGlobalX, lastGlobalY)
  ctx.lineTo(e.offsetX, e.offsetY)
  ctx.stroke()
  lastGlobalX = e.offsetX
  lastGlobalY = e.offsetY
}

const stopGlobalAnnotation = () => {
  isGlobalDrawing.value = false
}

const eraseGlobalAnnotation = () => {
  annotationBrushType.value = 'eraser'
  ElMessage.info('已切换到橡皮擦模式，请在画布上擦除')
}

const clearGlobalAnnotation = () => {
  if (!globalAnnotationCanvasRef.value) return
  const canvas = globalAnnotationCanvasRef.value
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  ctx.globalCompositeOperation = 'source-over'
  ctx.strokeStyle = annotationColor.value
  ctx.lineWidth = annotationBrushSize.value
  ctx.lineCap = 'round'

  ElMessage.success('已清空批注')
}

const saveGlobalAnnotation = async () => {
  if (!globalAnnotationCanvasRef.value) return
  try {
    const canvas = globalAnnotationCanvasRef.value
    const dataUrl = canvas.toDataURL('image/png')

    const link = document.createElement('a')
    link.download = `annotation_${Date.now()}.png`
    link.href = dataUrl
    link.click()

    ElMessage.success('批注已保存')
  } catch (error) {
    console.error('保存批注失败:', error)
    ElMessage.error('保存批注失败')
  }
}

const disableAnnotation = () => {
  globalAnnotationEnabled.value = false
  ElMessage.info('已关闭全局批注')
}

// 启动 ASR (语音识别转字幕)
const startASRForAll = async () => {
  try {
    if (isASRRunning.value) {
      if (speechRecognition && speechRecognition.stop) {
        speechRecognition.stop()
      }
      isASRRunning.value = false
      ElMessage.info('已停止语音识别')
    } else {
      if (speechRecognition && speechRecognition.start) {
        await speechRecognition.start()
      }
      isASRRunning.value = true
      ElMessage.success('已启动语音识别')
    }
  } catch (error) {
    console.error('启动/停止 ASR 失败:', error)
    ElMessage.error('操作失败')
  }
}

// 打开视频转字幕对话框
const openVideoToSubtitleDialog = () => {
  showVideoToSubtitleDialog.value = true
  console.log('[TeacherWindow] 打开视频转字幕对话框')
}

// ============================================
// 录制功能 - 右侧面板控制视频展示区域(画布+音频混合)
// ============================================

// 一键录制所有画布(使用 FFmpeg 后端,支持音频混合)
const handleStartAllCanvasRecording = async () => {
  try {
    console.log('[录制-展示区域] 开始录制视频展示区域(含音频混合)')
    if (typeof startAllCanvasRecording === 'function') {
      await startAllCanvasRecording()
      isRecording.value = true
      isRecordingPaused.value = false
    } else {
      ElMessage.warning('录制功能不可用')
    }
  } catch (error) {
    console.error('[录制-展示区域] 一键录制失败', error)
    ElMessage.error('一键录制失败')
  }
}

// 暂停所有画布录制
const handlePauseAllCanvasRecording = () => {
  try {
    console.log('[录制-展示区域] 暂停/恢复录制')
    if (typeof pauseAllCanvasRecording === 'function') {
      pauseAllCanvasRecording()
      isRecordingPaused.value = !isRecordingPaused.value
    } else {
      ElMessage.warning('录制功能不可用')
    }
  } catch (error) {
    console.error('[录制-展示区域] 暂停录制失败', error)
    ElMessage.error('暂停录制失败')
  }
}

// 停止所有画布录制
const handleStopAllCanvasRecording = async () => {
  try {
    console.log('[录制-展示区域] 停止录制')
    if (typeof stopAllCanvasRecording === 'function') {
      await stopAllCanvasRecording()
    } else {
      ElMessage.warning('录制功能不可用')
    }
    isRecording.value = false
    isRecordingPaused.value = false
  } catch (error) {
    console.error('[录制-展示区域] 停止录制失败', error)
    ElMessage.error('停止录制失败')
  }
}

// ============================================
// 工具栏按钮处理函数
// ============================================

const handleRecordingCommand = (command) => {
  if (command === 'multicam') {
    console.log('[录制-预览区域] 触发多路摄像头录制')
    handleStartMultiRecording()
  } else if (command === 'chromakey') {
    showChromakeyDialog.value = true
  } else if (command === 'vr') {
    showVrDialog.value = true
  }
}

// ============================================
// SidePanel 事件处理函数 - 控制视频展示区域
// ============================================

// 开始直播 - 打开设置中的 RTMP 推流
const handleStartStream = async () => {
  try {
    console.log('[TeacherWindow] 打开 RTMP 推流设置')
    activeTab.value = 'rtmp'
    showSettingsDialog.value = true
  } catch (error) {
    console.error('[TeacherWindow] 打开设置失败', error)
    ElMessage.error('打开设置失败')
  }
}

// 停止直播 - 已在 SettingsDialog 中处理
const handleStopStream = async () => {
  try {
    console.log('[TeacherWindow] 停止直播')
    // RTMP 停止逻辑已在 SettingsDialog 中处理
    // 🆕 语音播报
    tts.liveStopped()
  } catch (error) {
    console.error('[TeacherWindow] 停止直播失败', error)
    ElMessage.error('停止直播失败')
  }
}

// 开始录制（从 SidePanel 调用 - 录制整个视频展示区域）
const handleStartRecording = async () => {
  try {
    console.log('[录制-展示区域] SidePanel 触发开始录制')
    await handleStartAllCanvasRecording()
    // 🆕 语音播报
    tts.recordingStarted()
  } catch (error) {
    console.error('[录制-展示区域] 开始录制失败', error)
    ElMessage.error('开始录制失败')
    tts.error('录制启动失败')
  }
}

// 暂停录制（从 SidePanel 调用）
const handlePauseRecording = async (paused) => {
  try {
    console.log('[录制-展示区域] SidePanel 触发暂停/恢复录制:', paused)
    if (paused) {
      await handlePauseAllCanvasRecording()
      // 🆕 语音播报
      tts.recordingPaused()
    } else {
      if (typeof resumeAllCanvasRecording === 'function') {
        await resumeAllCanvasRecording()
        // 🆕 语音播报
        tts.recordingResumed()
      } else {
        ElMessage.warning('恢复录制功能不可用')
      }
    }
  } catch (error) {
    console.error('[录制-展示区域] 暂停/恢复录制失败', error)
    ElMessage.error('暂停/恢复录制失败')
  }
}

// 停止录制（从 SidePanel 调用）
const handleStopRecording = async () => {
  try {
    console.log('[录制-展示区域] SidePanel 触发停止录制')
    await handleStopAllCanvasRecording()
    // 🆕 语音播报
    tts.recordingStopped()
  } catch (error) {
    console.error('[录制-展示区域] 停止录制失败', error)
    ElMessage.error('停止录制失败')
  }
}

// ============================================
// 多路录制功能 - 顶部工具栏控制预览区域(单个信号源)
// ============================================
const handleStartMultiRecording = async () => {
  try {
    console.log('[录制-预览区域] 顶部工具栏触发多路摄像头录制')
    // 触发录制面板的多路录制开始(使用 MediaRecorder,轻量级)
    window.dispatchEvent(new CustomEvent('start-multi-recording'))
    ElMessage.success('已开始录制所有预览区域摄像头')
    // 🆕 语音播报
    tts.recordingStarted()
  } catch (error) {
    console.error('[录制-预览区域] 开始多路录制失败', error)
    ElMessage.error('开始多路录制失败')
  }
}

const handleStopMultiRecording = async () => {
  try {
    console.log('[录制-预览区域] 顶部工具栏触发停止多路录制')
    // 触发录制面板的多路录制停止
    window.dispatchEvent(new CustomEvent('stop-multi-recording'))
    ElMessage.success('已停止所有摄像头录制')
    // 🆕 语音播报
    tts.recordingStopped()
  } catch (error) {
    console.error('[录制-预览区域] 停止多路录制失败', error)
    ElMessage.error('停止多路录制失败')
  }
}

// ============================================
// 屏幕共享功能
// ============================================
const screenShareStream = ref(null)
const screenShareSourceId = ref(null)

const startScreenShare = async (type) => {
  try {
    let stream = null

    switch (type) {
      case 'screen':
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: true
        })
        break
      case 'window':
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: true
        })
        break
      case 'tab':
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'never' },
          audio: true
        })
        break
      default:
        throw new Error('未知的屏幕共享类型')
    }

    screenShareStream.value = stream

    const screenShareSource = {
      id: `screen_share_${Date.now()}`,
      name: `屏幕共享 - ${type === 'screen' ? '整个屏幕' : type === 'window' ? '窗口' : '标签页'}`,
      type: 'screen',
      stream: stream,
      status: 'online',
      audioEnabled: true,
      volume: 100
    }

    addVideoSource(screenShareSource)
    screenShareSourceId.value = screenShareSource.id

    ElMessage.success('屏幕共享已启动')
    showScreenShareDialog.value = false

    stream.getVideoTracks()[0].onended = () => {
      stopScreenShare()
    }
  } catch (error) {
    console.error('启动屏幕共享失败:', error)
    if (error.name === 'NotAllowedError') {
      ElMessage.warning('用户拒绝了屏幕共享权限')
    } else {
      ElMessage.error('启动屏幕共享失败: ' + error.message)
    }
  }
}

const stopScreenShare = () => {
  if (screenShareStream.value) {
    screenShareStream.value.getTracks().forEach(track => track.stop())
    screenShareStream.value = null
  }

  if (screenShareSourceId.value) {
    removeVideoSource(screenShareSourceId.value)
    screenShareSourceId.value = null
  }

  ElMessage.info('屏幕共享已停止')
}

// ============================================
// 字幕管理功能
// ============================================

// 导出全部字幕
const exportAllSubtitles = async () => {
  try {
    showSubtitleImportDialog.value = false
    showSubtitleDialog.value = true
  } catch (error) {
    console.error('导出字幕失败:', error)
    ElMessage.error('导出字幕失败')
  }
}

// 导入字幕
const importSubtitles = async () => {
  try {
    showSubtitleImportDialog.value = true
  } catch (error) {
    console.error('[TeacherWindow] 导入字幕失败:', error)
    ElMessage.error('导入字幕失败')
  }
}

// 处理字幕文件导入
const handleSubtitleImport = (file) => {
  try {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target.result
        let subtitles = []

        if (file.name.endsWith('.srt')) {
          subtitles = parseSRT(content)
        } else if (file.name.endsWith('.json')) {
          subtitles = JSON.parse(content)
        } else if (file.name.endsWith('.txt')) {
          subtitles = parseTXT(content)
        }

        importedSubtitles.value = subtitles
        ElMessage.success(`成功解析 ${subtitles.length} 条字幕`)
      } catch (error) {
        console.error('[TeacherWindow] 解析字幕文件失败:', error)
        ElMessage.error('解析字幕文件失败: ' + error.message)
      }
    }
    reader.readAsText(file.raw)
  } catch (error) {
    console.error('[TeacherWindow] 导入字幕失败:', error)
    ElMessage.error('导入字幕失败')
  }
}

// 解析 SRT 格式字幕
const parseSRT = (content) => {
  const lines = content.split('\n')
  const subtitles = []
  let currentSubtitle = null
  let lineIndex = 0

  while (lineIndex < lines.length) {
    const line = lines[lineIndex].trim()
    if (!line) {
      if (currentSubtitle && currentSubtitle.text) {
        subtitles.push(currentSubtitle)
      }
      currentSubtitle = null
      lineIndex++
      continue
    }

    if (!currentSubtitle) {
      currentSubtitle = {
        index: parseInt(line),
        startTime: '',
        endTime: '',
        text: ''
      }
      lineIndex++
      continue
    }

    if (currentSubtitle.startTime === '') {
      const timeMatch = line.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/)
      if (timeMatch) {
        currentSubtitle.startTime = timeMatch[1]
        currentSubtitle.endTime = timeMatch[2]
      }
      lineIndex++
      continue
    }

    if (currentSubtitle.text) {
      currentSubtitle.text += '\n' + line
    } else {
      currentSubtitle.text = line
    }
    lineIndex++
  }

  if (currentSubtitle && currentSubtitle.text) {
    subtitles.push(currentSubtitle)
  }

  return subtitles
}

// 解析 TXT 格式字幕（纯文本）
const parseTXT = (content) => {
  const lines = content.split('\n').filter(line => line.trim())
  return lines.map((line, index) => ({
    index: index + 1,
    startTime: '00:00:00,000',
    endTime: '00:00:05,000',
    text: line.trim()
  }))
}

// 确认导入字幕
const confirmImportSubtitles = () => {
  try {
    // 将导入的字幕添加到 subtitleStore
    importedSubtitles.value.forEach(subtitle => {
      subtitleStore.addSubtitle({
        startTime: subtitle.startTime,
        endTime: subtitle.endTime,
        text: subtitle.text
      })
    })

    ElMessage.success(`已导入 ${importedSubtitles.value.length} 条字幕`)
    showSubtitleImportDialog.value = false
    importedSubtitles.value = []
  } catch (error) {
    console.error('[TeacherWindow] 确认导入字幕失败:', error)
    ElMessage.error('导入失败')
  }
}

// 编辑字幕
const editSubtitle = (videoIndex, subtitleIndex) => {
  try {
    // 获取字幕数据并填充到编辑表单
    const subtitles = subtitleStore.subtitles
    if (subtitleIndex >= 0 && subtitleIndex < subtitles.length) {
      const subtitle = subtitles[subtitleIndex]
      editingSubtitle.value = {
        index: subtitleIndex,
        startTime: subtitle.startTime,
        endTime: subtitle.endTime,
        text: subtitle.text
      }
      showSubtitleEditDialog.value = true
    } else {
      ElMessage.warning('字幕不存在')
    }
  } catch (error) {
    console.error('[TeacherWindow] 编辑字幕失败:', error)
    ElMessage.error('编辑失败')
  }
}

// 保存编辑的字幕
const saveEditedSubtitle = () => {
  try {
    // 更新字幕数据
    if (editingSubtitle.value && editingSubtitle.value.index !== undefined) {
      const index = editingSubtitle.value.index
      subtitleStore.subtitles[index] = {
        startTime: editingSubtitle.value.startTime,
        endTime: editingSubtitle.value.endTime,
        text: editingSubtitle.value.text
      }
      ElMessage.success('字幕已保存')
      showSubtitleEditDialog.value = false
      editingSubtitle.value = null
    }
  } catch (error) {
    console.error('[TeacherWindow] 保存字幕失败:', error)
    ElMessage.error('保存失败')
  }
}

// 删除字幕
const deleteSubtitle = (videoIndex, subtitleIndex) => {
  try {
    // 删除指定字幕
    if (subtitleIndex >= 0 && subtitleIndex < subtitleStore.subtitles.length) {
      subtitleStore.subtitles.splice(subtitleIndex, 1)
      ElMessage.success('字幕已删除')
    } else {
      ElMessage.warning('字幕不存在')
    }
  } catch (error) {
    console.error('[TeacherWindow] 删除字幕失败:', error)
    ElMessage.error('删除失败')
  }
}

// 管理字幕
const showSubtitleManager = () => {
  showSubtitleDialog.value = true
}

// 清除全部字幕
const clearAllSubtitles = () => {
  try {
    // 从 subtitleStore 清除所有字幕
    subtitleStore.clearSubtitles()
    ElMessage.success('所有字幕已清除')
  } catch (error) {
    console.error('清除字幕失败:', error)
    ElMessage.error('清除字幕失败')
  }
}

// 清除字幕（快捷方式）
const clearSubtitles = () => {
  clearAllSubtitles()
}

// ============================================
// 字幕导出功能
// ============================================

// 导出字幕（根据格式）
const exportSubtitles = async () => {
  try {
    exporting.value = true

    let content = ''
    let filename = `subtitles_${Date.now()}`
    let mimeType = 'text/plain'

    switch (exportFormat.value) {
      case 'srt':
        content = exportToSRT()
        filename += '.srt'
        mimeType = 'text/plain'
        break
      case 'json':
        content = exportToJSON()
        filename += '.json'
        mimeType = 'application/json'
        break
      case 'txt':
        content = exportToTXT()
        filename += '.txt'
        mimeType = 'text/plain'
        break
    }

    exportPreview.value = content

    // 创建下载链接
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)

    ElMessage.success(`字幕已导出为 ${exportFormat.value.toUpperCase()} 格式`)
  } catch (error) {
    console.error('[TeacherWindow] 导出字幕失败:', error)
    ElMessage.error('导出失败: ' + error.message)
  } finally {
    exporting.value = false
  }
}

// 导出为 SRT 格式
const exportToSRT = () => {
  let srtContent = ''
  let globalIndex = 1

  generatedSubtitles.value.forEach(videoSub => {
    if (videoSub.subtitles) {
      videoSub.subtitles.forEach(sub => {
        srtContent += `${globalIndex}\n`
        srtContent += `${sub.startTime} --> ${sub.endTime}\n`
        srtContent += `${sub.text}\n\n`
        globalIndex++
      })
    }
  })

  return srtContent
}

// 导出为 JSON 格式
const exportToJSON = () => {
  return JSON.stringify(generatedSubtitles.value, null, 2)
}

// 导出为 TXT 格式
const exportToTXT = () => {
  let txtContent = ''

  generatedSubtitles.value.forEach(videoSub => {
    if (videoSub.subtitles) {
      txtContent += `=== ${videoSub.videoName} ===\n`
      videoSub.subtitles.forEach(sub => {
        txtContent += `[${sub.startTime}] ${sub.text}\n`
      })
      txtContent += '\n'
    }
  })

  return txtContent
}

// ============================================
// 视频转字幕功能
// ============================================

// 切换视频字幕识别
const toggleVideoSubtitle = async () => {
  try {
    if (isVideoSubtitleRunning.value) {
      // 停止识别
      // TODO: 实现 videoToSubtitleService
      // if (videoToSubtitleService && videoToSubtitleService.stop) {
      //   await videoToSubtitleService.stop()
      // }
      isVideoSubtitleRunning.value = false
      videoSubtitleText.value = ''
      ElMessage.success('已停止视频字幕识别')
    } else {
      // 开始识别
      if (selectedVideoIndex.value === -1) {
        ElMessage.warning('请先选择一个视频')
        return
      }

      // TODO: 实现 videoToSubtitleService
      // if (videoToSubtitleService && videoToSubtitleService.start) {
      //   await videoToSubtitleService.start(
      //     previewVideos.value[selectedVideoIndex.value],
      //     subtitleLanguage.value,
      //     subtitleModel.value
      //   )
      // }
      isVideoSubtitleRunning.value = true
      ElMessage.success('已开始视频字幕识别')
    }
  } catch (error) {
    console.error('[TeacherWindow] 视频字幕识别失败:', error)
    ElMessage.error('操作失败: ' + error.message)
    isVideoSubtitleRunning.value = false
  }
}

// 预览视频选择
const onPreviewVideoSelected = (index) => {
  console.log('[TeacherWindow] 预览视频已选择:', index)
  selectedVideoIndex.value = index
}

// 格式化专注度
const formatFocus = (percentage) => {
  return `${percentage}%`
}

// ============================================
// 信号源管理相关计算属性
// ============================================

// 本地视频源
const localVideoSources = computed(() => {
  return allSources.value.filter(s => s.type === 'localVideo')
})

// 分页显示的信号源
const paginatedSources = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return allSources.value.slice(start, end)
})

// 总页数
const totalPages = computed(() => {
  return Math.ceil(allSources.value.length / pageSize.value)
})

// ============================================
// 信号源管理相关方法
// ============================================

// 从预览区域移除信号源
const removeFromPreview = (sourceId) => {
  try {
    const index = allSources.value.findIndex(s => s.id === sourceId)
    if (index !== -1) {
      allSources.value[index].addedToPreview = false
      ElMessage.success(`已移除: ${allSources.value[index].name}`)
    }
  } catch (error) {
    console.error('[TeacherWindow] 移除信号源失败:', error)
    ElMessage.error('移除失败')
  }
}

// 打开重命名对话框
const openRenameDialog = (source) => {
  renameSourceTarget.value = source
  showRenameSourceDialog.value = true
}

// 信号源类型选项
const sourceTypeOptions = [
  { label: '本地摄像头', value: 'localCamera' },
  { label: '本地视频', value: 'localVideo' },
  { label: '网络摄像头', value: 'networkCamera' },
  { label: '屏幕共享', value: 'screenShare' },
  { label: '远程桌面', value: 'remoteDesktop' }
]


// ============================================
// 布局状态管理方法
// ============================================

// 获取布局状态的键名
const getLayoutKey = (layout) => {
  return String(layout)
}

// 保存当前布局状态
// 注意：信号源状态已由 useVideoSync.js 通过 layoutStates 统一管理
// 这里只保存 TeacherWindow 特有的 UI 状态（如全局批注等）
const saveCurrentLayoutState = (layout) => {
  const layoutKey = getLayoutKey(layout)

  // 保存全局批注状态
  if (globalAnnotationCanvasRef.value && typeof globalAnnotationCanvasRef.value.saveAnnotation === 'function') {
    globalAnnotationCanvasRef.value.saveAnnotation(layoutKey)
  }

  console.log(`[布局状态] 保存布局 ${layoutKey} 的 UI 状态`)
}

// 恢复布局状态
// 注意：信号源状态已由 useVideoSync.js 通过 layoutStates 统一管理
// 这里只恢复 TeacherWindow 特有的 UI 状态（如全局批注等）
const restoreLayoutState = (layout) => {
  const layoutKey = getLayoutKey(layout)

  // 恢复全局批注状态
  if (globalAnnotationCanvasRef.value && typeof globalAnnotationCanvasRef.value.restoreAnnotation === 'function') {
    globalAnnotationCanvasRef.value.restoreAnnotation(layoutKey)
  }

  console.log(`[布局状态] 恢复布局 ${layoutKey} 的 UI 状态`)
}

// 清空所有视频预览
const clearAllVideoPreviews = () => {
  // 清理渲染引擎相关的预览引用
  dragVideoPreviews.value = []

  Object.keys(canvasSourceMap.value).forEach(key => {
    delete canvasSourceMap.value[key]
  })

  // 清空预览组件
  videoPreviews.value = []

  console.log('[布局状态] 已清空所有预览')
}

// 获取指定布局的可见画布索引（新布局索引方案）
// 🎯 2026-04-20 更新：统一使用新布局索引
// 布局索引: 1=1分屏, 2=2分屏, 3=3分屏, 4=4分屏, 5=6分屏, 7=9分屏, 10=16分屏,
//           11=25分屏, 12=36分屏, 13=49分屏, 14-17=特殊布局, 18=自由布局
// 每种布局独立索引范围
const getVisibleCanvasIndices = (layout) => {
  // 新布局索引到格子数量的映射
  const layoutCellMap = {
    1: 1,   // 1分屏
    2: 2,   // 2分屏
    3: 3,   // 3分屏
    4: 4,   // 4分屏
    5: 6,   // 6分屏
    7: 9,   // 9分屏
    10: 16, // 16分屏
    11: 25, // 25分屏
    12: 36, // 36分屏
    13: 49, // 49分屏
    14: 2,  // 特殊布局1
    15: 2,  // 特殊布局2
    16: 2,  // 特殊布局3
    17: 2   // 特殊布局4
  };

  // 特殊布局和自由布局返回空数组（使用不同渲染方式）
  if (layout === 18 || layout === 'free') {
    return [];
  }

  const count = layoutCellMap[layout];
  if (count) {
    return Array.from({ length: count }, (_, i) => i + 1);
  }
  return [1];
}

// ============================================
// 布局切换处理
// ============================================

// 处理布局变化
// 统一使用 window.__layoutStates 进行布局状态管理，避免状态不一致

const handleLayoutChange = async (newLayout) => {
  try {
    console.log(`[布局切换] handleLayoutChange 被调用: newLayout=${newLayout}, typeof=${typeof newLayout}`)

    //  参数验证
    if (newLayout === undefined || newLayout === null) {
      console.error('[布局切换] ❌ 无效的布局参数: newLayout=', newLayout)
      ElMessage.error('布局参数无效')
      return
    }

    // 标记正在处理布局变化，避免 watch 重复处理
    isHandlingLayoutChange = true

    const oldLayout = currentLayout.value
    console.log(`[布局切换] oldLayout=${oldLayout}, currentLayout.value=${currentLayout?.value}`)

    //  统一状态管理：区分标准布局和自由布局（必须在if块外声明）
    const isOldFreeLayout = oldLayout === 18 || oldLayout === 'free'
    const isNewFreeLayout = newLayout === 18 || newLayout === 'free'

    // 🎯 统一状态管理：使用 window.__layoutStates 保存旧布局状态
    if (oldLayout !== newLayout) {
      console.log(`[布局切换] 保存旧布局 ${oldLayout} 的状态`)

      // 确保 window.__layoutStates 存在
      if (!window.__layoutStates) {
        window.__layoutStates = {}
      }

      // 为旧布局创建槽位对象（如果不存在）
      if (!window.__layoutStates[oldLayout]) {
        window.__layoutStates[oldLayout] = { slots: {}, maximizedIndex: null, freeSources: [] }
      }

      if (isOldFreeLayout) {
        // 🎯 自由布局：保存 canvasStore 的 sources 到 window.__layoutStates
        window.__layoutStates[oldLayout].freeSources = JSON.parse(JSON.stringify(canvasStore.sources))
        window.__layoutStates[oldLayout].maximizedIndex = maximizedIndex.value
        console.log(`[布局切换] 已保存自由布局 ${oldLayout} 的信号源:`, canvasStore.sources.length, '个')
      } else {
        // 🎯 标准布局：保存完整的信号源对象（不仅仅是ID）
        const oldSlots = {}
        Object.keys(canvasSourceMap.value).forEach(key => {
          const sourceId = canvasSourceMap.value[key]
          if (sourceId) {
            // 从 allSources 中获取完整的信号源对象
            const source = allSources.value.find(s => s.id === sourceId)
            if (source) {
              // 保存完整的信号源对象，包含所有状态
              oldSlots[key] = JSON.parse(JSON.stringify(source))
              console.log(`[布局切换] 保存信号源: 索引${key} -> ${source.name} (${source.id})`)
            } else {
              // 如果找不到信号源对象，只保存ID
              oldSlots[key] = sourceId
              console.warn(`[布局切换] 找不到信号源 ${sourceId}，只保存ID`)
            }
          }
        })
        window.__layoutStates[oldLayout].slots = oldSlots
        window.__layoutStates[oldLayout].maximizedIndex = maximizedIndex.value
      }

      console.log(`[布局切换] 已保存布局 ${oldLayout} 的状态:`, window.__layoutStates[oldLayout])
    }

    // 🎯 先清空 canvasSourceMap，避免旧布局的信号源残留
    if (!isNewFreeLayout) {
      canvasSourceMap.value = {}
      console.log('[布局切换] 已清空旧分屏布局状态')
    }

    // 更新布局
    currentLayout.value = newLayout

    // 🎯 从 window.__layoutStates 加载新布局的状态
    // 注意：isNewFreeLayout 已在前面声明（函数开头）

    if (window.__layoutStates && window.__layoutStates[newLayout]) {
      const layoutConfig = window.__layoutStates[newLayout]
      console.log(`[布局切换] 从 layoutStates 加载新布局 ${newLayout} 的配置:`, layoutConfig)

      if (isNewFreeLayout) {
        // 🎯 自由布局：从 window.__layoutStates 恢复 canvasStore 的 sources
        if (layoutConfig.freeSources && Array.isArray(layoutConfig.freeSources)) {
          canvasStore.sources = layoutConfig.freeSources
          console.log(`[布局切换] 已恢复自由布局 ${newLayout} 的信号源:`, canvasStore.sources.length, '个')
        } else {
          canvasStore.clearCanvas()
        }
        // 恢复最大化状态
        maximizedIndex.value = layoutConfig.maximizedIndex || null
        isMaximized.value = maximizedIndex.value !== null
      } else {
        // 🎯 标准分屏布局：优先恢复之前保存的配置
        const savedSlots = layoutConfig?.slots
        const validIndices = getVisibleCanvasIndices(newLayout)
        console.log(`[布局切换] 新布局有效索引:`, validIndices)

        // 检查是否有保存的 slots 配置
        const hasSavedConfig = savedSlots && Object.keys(savedSlots).length > 0
        console.log(`[布局切换] 新布局 ${newLayout} 是否已有保存配置:`, hasSavedConfig)

        if (hasSavedConfig) {
          // 🎯 恢复之前保存的分屏信号源配置
          const newCanvasSourceMap = {}
          const sourcesToRestore = []

          validIndices.forEach(index => {
            const key = String(index)
            const slotData = savedSlots[key] || savedSlots[Number(index)] || savedSlots[index]

            if (slotData) {
              let sourceId = null
              let sourceObj = null

              if (typeof slotData === 'string') {
                sourceId = slotData
              } else if (typeof slotData === 'object') {
                sourceId = slotData.id
                sourceObj = slotData
              }

              if (sourceId) {
                newCanvasSourceMap[key] = sourceId
                console.log(`[布局切换] 恢复信号源: 格子${key} -> ${sourceId}`)

                if (sourceObj) {
                  sourcesToRestore.push(sourceObj)
                }
              }
            }
          })

          // 🎯 确保信号源存在于 sourceStore
          sourcesToRestore.forEach(sourceObj => {
            const existsInStore = sourceStore.sources.some(s => s.id === sourceObj.id)
            if (!existsInStore) {
              sourceStore.addSource(sourceObj)
              console.log(`[布局切换] 已恢复信号源到 sourceStore: ${sourceObj.name}`)
            }
          })

          canvasSourceMap.value = newCanvasSourceMap
          console.log(`[布局切换] 已恢复 ${Object.keys(newCanvasSourceMap).length} 个信号源到新布局`)
        } else {
          // 🎯 首次切换到该布局：初始化为空布局，不从预览区域克隆信号源
          // 这样用户必须明确地拖拽信号源到分屏格子，而不是自动填充
          const newCanvasSourceMap = {}

          // 初始化并保存到 layoutStates
          const sourcesToSave = {}

          // 初始化 layoutStates
          window.__layoutStates[newLayout] = {
            slots: sourcesToSave,
            maximizedIndex: null
          }

          canvasSourceMap.value = newCanvasSourceMap
          console.log(`[布局切换] 初始化空布局 ${newLayout}，未从预览区域克隆任何信号源`)
        }

        // 恢复最大化状态
        maximizedIndex.value = layoutConfig.maximizedIndex || null
        isMaximized.value = maximizedIndex.value !== null
      }
    } else {
      // 🎯 如果没有保存的配置，初始化新布局，保持空状态
      console.log(`[布局切换] 新布局 ${newLayout} 没有保存的配置，初始化为空布局`)

      if (isNewFreeLayout) {
        canvasStore.clearCanvas()
      } else {
        // 初始化为空布局，不从预览区域克隆任何信号源
        const newCanvasSourceMap = {}

        // 初始化并保存到 layoutStates
        const sourcesToSave = {}

        // 初始化 layoutStates
        window.__layoutStates[newLayout] = {
          slots: sourcesToSave,
          maximizedIndex: null
        }

        canvasSourceMap.value = newCanvasSourceMap
        console.log(`[布局切换] 初始化空布局 ${newLayout}，未放置任何信号源`)
      }
      maximizedIndex.value = null
      isMaximized.value = false
    }

    console.log(`[布局切换] 最终 canvasSourceMap:`, canvasSourceMap.value)
    ElMessage.success(`已切换到 ${newLayout} 分屏布局`)
  } catch (error) {
    console.error('[布局切换] 切换布局失败:', error)
    console.error('[布局切换] 错误堆栈:', error.stack)
    try {
      console.error('[布局切换] 当前状态:', {
        newLayout,
        currentLayout: currentLayout?.value,
        canvasSourceMap: canvasSourceMap?.value || {},
        videoPreviewsCount: videoPreviews?.value?.length || 0
      })
    } catch (logError) {
      console.error('[布局切换] 记录状态时出错:', logError)
    }
    ElMessage.error('切换布局失败: ' + (error.message || '未知错误'))
  }
}

// 🆕 统一渲染架构处理函数

// 将画布源同步到 allSources
const syncCanvasSourceToAllSources = (canvasIndex) => {
  const sourceId = canvasSourceMap.value[canvasIndex]
  if (!sourceId) return

  // 在 allSources 中查找并更新源
  const sourceIndex = allSources.value.findIndex(s => s.id === sourceId)
  if (sourceIndex !== -1) {
    const canvasSource = allSources.value[sourceIndex]
    // 新架构：无需同步 videoSyncGroupKey，SyncStateReplicator 自动处理
  }
}

// ============================================
// 音频监控相关方法
// ============================================

// 切换麦克风
const onMicrophoneToggle = async (mic) => {
  try {
    if (typeof toggleMicrophone === 'function') {
      await toggleMicrophone(mic)
    }
    if (mic.enabled) {
      if (typeof startMicrophoneLevelMonitoring === 'function') {
        await startMicrophoneLevelMonitoring()
      }
      ElMessage.success(`已启用: ${mic.label || '麦克风'}`)
    } else {
      if (typeof stopMicrophoneMonitoring === 'function') {
        stopMicrophoneMonitoring()
      }
      ElMessage.info(`已禁用: ${mic.label || '麦克风'}`)
    }
  } catch (error) {
    console.error('[音频] 切换麦克风失败:', error)
    mic.enabled = !mic.enabled
    ElMessage.error('操作失败')
  }
}

// 麦克风音量调节
const onMicrophoneVolumeChange = (mic) => {
  try {
    if (typeof originalOnMicrophoneVolumeChange === 'function') {
      originalOnMicrophoneVolumeChange(mic)
    }
    if (window.microphoneAudioOutput) {
      window.microphoneAudioOutput.volume = mic.volume / 100
    }
    console.log(`[音频] 麦克风音量: ${mic.label || '麦克风'} - ${mic.volume}%`)
  } catch (error) {
    console.error('[音频] 调节麦克风音量失败:', error)
  }
}

// 视频音频开关切换
const onVideoAudioToggle = (source) => {
  try {
    if (typeof toggleVideoAudio === 'function') {
      toggleVideoAudio(source)
    }
    if (source.audioEnabled) {
      ElMessage.success(`已启用音频: ${source.name}`)
    } else {
      ElMessage.info(`已禁用音频: ${source.name}`)
    }
  } catch (error) {
    console.error('[音频] 切换视频音频失败:', error)
    source.audioEnabled = !source.audioEnabled
    ElMessage.error('操作失败')
  }
}

// 视频音频音量调节
const onVideoAudioVolumeChange = (source) => {
  try {
    if (typeof originalOnVideoAudioVolumeChange === 'function') {
      originalOnVideoAudioVolumeChange(source)
    }
    console.log(`[音频] 视频音量: ${source.name} - ${source.volume}%`)
  } catch (error) {
    console.error('[音频] 调节视频音量失败:', error)
  }
}

// 🎯 音频状态追踪 - 记录每个源当前正在播放音频的画布索引
const activeAudioSource = ref({}) // sourceId -> canvasIndex

// 更新信号源的音频状态到视频元素
const updateSourceAudioState = (source) => {
  try {
    console.log(`[音频] 更新 ${source.name} 的音频状态:`, {
      audioEnabled: source.audioEnabled,
      muted: source.muted,
      volume: source.volume
    })

    // 统计该源在画布中出现的次数
    const canvasOccurrences = Object.values(canvasSourceMap.value).filter(id => id === source.id).length

    // 🎯 第一步：找出该源在画布中的所有实例
    const sourceCanvasIndices = []
    for (let canvasIndex = 1; canvasIndex <= Object.keys(canvasSourceMap.value).length; canvasIndex++) {
      if (canvasSourceMap.value[canvasIndex] === source.id) {
        sourceCanvasIndices.push(canvasIndex)
      }
    }
    // 🎯 确保数组按数字顺序排序
    sourceCanvasIndices.sort((a, b) => a - b)

    // 🎯 第二步：更新预览区域的视频元素
    // 如果源已添加到画布，预览区域静音；否则预览区域可以播放音频
    // 查找所有具有该 sourceId 的视频元素
    const allVideos = document.querySelectorAll(`video[data-source-id="${source.id}"]`)
    console.log(`[音频] 找到 ${allVideos.length} 个视频元素 for ${source.name}`)

    // 更新 audioMixer 的音量
    const audioVolume = source.audioEnabled ? (source.volume || 100) / 100 : 0
    audioMixer.setVolume(source.id, audioVolume)

    if (allVideos.length > 0) {
      // 预览区域的视频（第一个找到的视频）
      const previewVideo = allVideos[0]
      const shouldMutePreview = canvasOccurrences > 0 || !source.audioEnabled
      previewVideo.muted = shouldMutePreview
      previewVideo.volume = (source.volume || 100) / 100
      console.log(`[音频] ✅ 预览视频 ${source.name}: muted=${previewVideo.muted}, volume=${previewVideo.volume}, 画布实例数=${canvasOccurrences}`)
    }

    // 🎯 第三步：更新画布中的视频元素 - 音频去重核心逻辑
    if (sourceCanvasIndices.length === 0) {
      // 该源未添加到画布，无需处理
      return
    }

    // 确定哪个实例应该播放音频（优先使用之前激活的实例，否则使用第一个）
    const previousActiveIndex = activeAudioSource.value[source.id]
    let shouldPlayAudioIndex = sourceCanvasIndices.includes(previousActiveIndex)
      ? previousActiveIndex
      : sourceCanvasIndices[0]

    // 更新活跃音频源记录
    activeAudioSource.value[source.id] = shouldPlayAudioIndex

    // 🎯 修复：使用 allVideos 数组处理画布中的视频（跳过第一个，因为第一个是预览区域的）
    const canvasVideos = allVideos.length > 1 ? Array.from(allVideos).slice(1) : []

    // 遍历所有画布实例，设置正确的静音状态
    sourceCanvasIndices.forEach((canvasIndex, index) => {
      // 从 canvasVideos 数组中获取对应的视频元素
      const canvasVideo = canvasVideos[index]

      if (canvasVideo) {
        // 判断是否为应该播放音频的实例
        const isAudioInstance = canvasIndex === shouldPlayAudioIndex
        const shouldMute = !source.audioEnabled || !isAudioInstance

        canvasVideo.muted = shouldMute
        canvasVideo.volume = (source.volume || 100) / 100

        console.log(`[音频] ✅ 画布 ${canvasIndex} 视频 ${source.name}: muted=${canvasVideo.muted}, volume=${canvasVideo.volume}, 音频实例=${isAudioInstance}`)
      } else {
        console.log(`[音频] ⚠️ 无法找到画布 ${canvasIndex} 中的视频元素: ${source.name}`)
      }
    })

  } catch (error) {
    console.error('[音频] 更新音频状态失败:', error)
  }
}

// 🎯 全局音频检查 - 确保所有视频源的音频状态正确
const checkAllAudioStates = () => {
  try {
    console.log('[音频] 执行全局音频检查')

    // 获取所有独特的视频源（同时从 sourceStore 和 mediaStore 获取）
    const uniqueSources = new Set()
    Object.values(canvasSourceMap.value).forEach(sourceId => {
      // 先从 mediaStore 查找（本地视频源）
      const mediaSource = mediaStore.sources.get(sourceId)
      if (mediaSource) {
        uniqueSources.add(mediaSource)
      } else {
        // 再从 sourceStore 查找（其他类型源）
        const source = sourceStore.sources.find(s => s.id === sourceId)
        if (source) {
          uniqueSources.add(source)
        }
      }
    })

    // 对每个源执行音频状态更新
    uniqueSources.forEach(source => {
      updateSourceAudioState(source)
    })

    console.log('[音频] 全局音频检查完成')
  } catch (error) {
    console.error('[音频] 全局音频检查失败:', error)
  }
}

// 🎯 当画布源发生变化时，自动检查音频状态
const handleCanvasSourceChange = () => {
  // 延迟执行，确保DOM已更新
  setTimeout(checkAllAudioStates, 100)
}

// 处理本地视频音频变化（从音频面板）
const handleLocalVideoAudioChange = ({ enabled, volume, sourceId }) => {
  try {
    console.log('[音频面板] 本地视频音频变化:', { enabled, volume, sourceId })

    if (sourceId) {
      // 更新指定源的音频状态
      const source = sourceStore.sources.find(s => s.id === sourceId)
      if (source) {
        // 🎯 使用 sourceStore.updateSource 确保响应式更新
        sourceStore.updateSource(sourceId, { audioEnabled: enabled, volume })
        // 获取更新后的源对象
        const updatedSource = sourceStore.sources.find(s => s.id === sourceId)
        if (updatedSource) {
          updateSourceAudioState(updatedSource)
        }
      }
    } else {
      // 更新所有本地视频源的音频状态
      sourceStore.sources.forEach(source => {
        if (source.type === 'localVideo' || source.type === 'local-file') {
          sourceStore.updateSource(source.id, { audioEnabled: enabled, volume })
          const updatedSource = sourceStore.sources.find(s => s.id === source.id)
          if (updatedSource) {
            updateSourceAudioState(updatedSource)
          }
        }
      })
    }
  } catch (error) {
    console.error('[音频面板] 处理本地视频音频变化失败:', error)
  }
}

// 处理系统音频变化（从音频面板）
const handleSystemAudioChange = ({ enabled, volume }) => {
  try {
    console.log('[音频面板] 系统音频变化:', { enabled, volume })

    // 更新所有非麦克风源的音频状态
    sourceStore.sources.forEach(source => {
      if (source.type !== 'microphone') {
        source.audioEnabled = enabled
        source.volume = volume
        updateSourceAudioState(source)
      }
    })
  } catch (error) {
    console.error('[音频面板] 处理系统音频变化失败:', error)
  }
}

// 监听全局音频控制选项变化
watch(enableAudioMonitor, (enabled) => {
  console.log('[音频] 监听模式:', enabled ? '已启用' : '已禁用')
})

watch(enableTerminalMute, (enabled) => {
  console.log('[音频] 终端静音:', enabled ? '已启用' : '已禁用')
})

watch(enableAudioNoiseReduction, (enabled) => {
  console.log('[音频] 音频降噪:', enabled ? '已启用' : '已禁用')
})

// 获取分析类型标签
const getAnalysisTypeTag = (type) => {
  const tags = {
    '专注度': 'success',
    '情绪': 'warning',
    '行为': 'info'
  }
  return tags[type] || 'info'
}

// ============================================
// 设置对话框相关方法
// ============================================

// 选择录制路径
const selectRecordingPath = async () => {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({
      directory: true,
      multiple: false,
      title: '选择录像文件存放位置'
    })
    if (selected) {
      settings.value.recordingPath = selected
      ElMessage.success('已选择: ' + selected)
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('[TeacherWindow] 选择路径失败:', error)
      ElMessage.error('选择路径失败')
    }
  }
}

// 重置录制路径
const resetRecordingPath = () => {
  settings.value.recordingPath = './recordings'
  ElMessage.info('录制路径已重置为默认值')
}

// 重置所有设置
const resetAllSettings = () => {
  try {
    resetSettings()
    settingsActiveTab.value = 'recording'
    ElMessage.success('所有设置已恢复默认')
  } catch (error) {
    console.error('[TeacherWindow] 重置设置失败:', error)
    ElMessage.error('重置失败')
  }
}

// ============================================
// 学生管理相关方法
// ============================================

const addStudent = () => {
  ElMessage.info('添加学生功能开发中')
}

const answerHand = (student) => {
  student.handRaised = false
  ElMessage.success(`已回应 ${student.name} 的举手`)
}

const viewDetail = (student) => {
  ElMessage.info(`查看 ${student.name} 的详情`)
}

const kickStudent = (student) => {
  ElMessage.warning(`已移除 ${student.name}`)
}

// ============================================
// 任务管理相关方法
// ============================================

const addTask = () => {
  ElMessage.info('发布任务功能开发中')
}

const viewTaskDetail = (task) => {
  ElMessage.info(`查看任务: ${task.title}`)
}

// ============================================
// 实训管理相关方法
// ============================================

const startTraining = () => {
  ElMessage.info('开始实训功能开发中')
}

const viewTraining = (training) => {
  ElMessage.info(`查看实训: ${training.title}`)
}

const submitTraining = (training) => {
  ElMessage.success(`已提交实训: ${training.title}`)
}

// ============================================
// 视觉分析相关方法
// ============================================

const isAnalyzing = ref(false)

// 检测模式状态
const detectionMode = ref('online')
const networkStatus = ref(navigator.onLine)

// 监听网络状态变化
window.addEventListener('online', () => {
  networkStatus.value = true
  ElMessage.success('网络已连接')
})
window.addEventListener('offline', () => {
  networkStatus.value = false
  ElMessage.warning('网络已断开，将使用本地模式')
})

// 预加载 YOLO 模型
const preloadYolo = async () => {
  try {
    ElMessage.info('正在加载 YOLO 模型，请稍候...')
    const success = await visionStore.preloadYoloModel()
    updateDetectionMode()

    if (success) {
      ElMessage.success('YOLO 模型加载完成，当前模式: ' + getDetectionModeText.value.icon + ' ' + getDetectionModeText.value.text)
    } else {
      ElMessage.error('YOLO 模型加载失败')
    }
    return success
  } catch (error) {
    console.error('[TeacherWindow] YOLO 预加载失败:', error)
    ElMessage.error('YOLO 模型加载失败: ' + error.message)
    return false
  }
}

// 开始视觉分析
const startAnalysis = async () => {
  if (isAnalyzing.value) {
    ElMessage.warning('分析正在进行中')
    return
  }

  try {
    // 预加载 YOLO 模型
    const loaded = await preloadYolo()
    if (!loaded) {
      return
    }

    // 设置检测阈值
    visionStore.setConfig({ yoloThreshold: 0.6 })

    // 获取视频元素
    const videoElement = playbackVideoRef.value
    if (!videoElement) {
      ElMessage.error('未找到视频元素')
      return
    }

    // 开始分析
    isAnalyzing.value = true
    ElMessage.success('视觉分析已开始')

    // 持续分析视频帧
    const analyzeLoop = async () => {
      if (!isAnalyzing.value) return

      try {
        const canvas = document.createElement('canvas')
        canvas.width = videoElement.videoWidth || 640
        canvas.height = videoElement.videoHeight || 480
        const ctx = canvas.getContext('2d')

        if (videoElement.readyState >= 2) {
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)
          await visionStore.analyzeFrame(canvas)
        }
      } catch (error) {
        console.error('[TeacherWindow] 帧分析失败:', error)
      }

      // 每 500ms 分析一次
      if (isAnalyzing.value) {
        setTimeout(analyzeLoop, 500)
      }
    }

    analyzeLoop()
  } catch (error) {
    console.error('[TeacherWindow] 启动分析失败:', error)
    ElMessage.error('启动分析失败: ' + error.message)
    isAnalyzing.value = false
  }
}

// 停止视觉分析
const stopAnalysis = () => {
  isAnalyzing.value = false
  visionStore.stopAnalysis()
  ElMessage.info('视觉分析已停止')
}

// 更新检测模式状态
const updateDetectionMode = () => {
  detectionMode.value = visionStore.detectionMode || 'online'
  networkStatus.value = visionStore.isOnline !== undefined ? visionStore.isOnline : navigator.onLine
}

// 重载 YOLO 模型
const handleReloadYoloModel = async () => {
  try {
    ElMessage.info('正在重载 YOLO 模型...')
    await visionStore.resetYoloModel()
    updateDetectionMode()

    const mode = visionStore.detectionMode
    const modeText = {
      online: '🌐 在线模式',
      local: '💾 本地模式',
      fallback: '⚠️ 降级模式'
    }

    ElMessage.success(`模型已重载，当前模式: ${modeText[mode] || mode}`)
  } catch (error) {
    console.error('[TeacherWindow] 重载 YOLO 模型失败:', error)
    ElMessage.error('重载 YOLO 模型失败')
  }
}

// 获取检测模式显示文本
const getDetectionModeText = computed(() => {
  const modeMap = {
    online: { text: '在线模式', icon: '🌐', color: '#67C23A' },
    local: { text: '本地模式', icon: '💾', color: '#409EFF' },
    fallback: { text: '降级模式', icon: '⚠️', color: '#E6A23C' }
  }
  return modeMap[detectionMode.value] || modeMap.online
})

// 获取网络状态显示文本
const getNetworkStatusText = computed(() => {
  return networkStatus.value ? { text: '在线', icon: '📶', color: '#67C23A' } : { text: '离线', icon: '📵', color: '#909399' }
})

// ============================================
// 服务管理相关方法
// ============================================
// 服务状态监控已移至服务端


// ============================================
// 直播相关方法
// ============================================

// 开始直播 - 打开设置中的 RTMP 推流
const startLive = async () => {
  try {
    activeTab.value = 'rtmp'
    showSettingsDialog.value = true
    ElMessage.info('请在设置中配置 RTMP 推流')
  } catch (error) {
    console.error('[TeacherWindow] 开始直播失败:', error)
    ElMessage.error('开始直播失败')
  }
}

// 停止直播 - 已在 SettingsDialog 中处理
const stopLive = async () => {
  try {
    isLive.value = false
    liveStreamUrl.value = ''
    ElMessage.success('直播已停止')
  } catch (error) {
    console.error('[TeacherWindow] 停止直播失败:', error)
    ElMessage.error('停止直播失败')
  }
}

// ============================================
// 举手相关方法
// ============================================

// 处理第一个举手的学生
const answerFirstHandRaise = () => {
  if (students.value.length === 0) return

  const handRaisedStudent = students.value.find(s => s.handRaised)
  if (handRaisedStudent) {
    handleHandRaiseAccept()
  }
}

// 计算属性：是否有学生举手
const anyHandRaised = computed(() => {
  return students.value.some(s => s.handRaised)
})

// 计算属性：第一个举手的学生姓名
const firstHandRaisedStudentName = computed(() => {
  const student = students.value.find(s => s.handRaised)
  return student ? student.name : ''
})

// 播放举手提示音
const playHandRaiseSound = () => {
  if (handRaiseSound.value) {
    handRaiseSound.value.play()
  }
}

// 获取网络质量标签
const getNetworkQualityTag = (quality) => {
  const tags = {
    good: 'success',
    fair: 'warning',
    poor: 'danger'
  }
  return tags[quality] || 'info'
}

// 获取网络质量标签文字
const getNetworkQualityLabel = (quality) => {
  const labels = {
    good: '良好',
    fair: '一般',
    poor: '较差'
  }
  return labels[quality] || quality
}

// 获取源类型标签
const getSourceTypeTag = (type) => {
  const tags = {
    camera: 'success',
    local: '',
    screen: 'warning',
    network: 'info'
  }
  return tags[type] || 'info'
}

// 获取源类型标签文字
const getSourceTypeLabel = (type) => {
  const labels = {
    camera: '摄像头',
    local: '本地视频',
    screen: '屏幕共享',
    network: '网络流'
  }
  return labels[type] || type
}

// ============================================
// 布局相关功能
// ============================================

// 布局索引到格子数量的映射
const layoutCellMap = {
  1: { cols: 1, rows: 1 },
  2: { cols: 2, rows: 1 },
  3: { cols: 2, rows: 2, custom: true }, // 3分屏特殊
  4: { cols: 2, rows: 2 },
  5: { cols: 3, rows: 2 }, // 6分屏
  7: { cols: 3, rows: 3 }, // 9分屏
  10: { cols: 4, rows: 4 }, // 16分屏
  11: { cols: 5, rows: 5 }, // 25分屏
  12: { cols: 6, rows: 6 }, // 36分屏
  13: { cols: 7, rows: 7 }, // 49分屏
  14: { cols: 4, rows: 4, special: true }, // 特殊布局1
  15: { cols: 4, rows: 4, special: true }, // 特殊布局2
  16: { cols: 4, rows: 4, special: true }, // 特殊布局3
  17: { cols: 4, rows: 4, special: true }, // 特殊布局4
  18: { free: true } // 自由布局
}

// 计算网格样式
const gridStyle = computed(() => {
  const layout = currentLayout.value

  // 自由布局
  if (layout === 18 || layout === 'free') {
    return {
      display: 'block',
      position: 'relative'
    }
  }

  const config = layoutCellMap[layout]
  if (!config) {
    // 默认返回1分屏
    return {
      'grid-template-columns': '1fr',
      'grid-template-rows': '1fr'
    }
  }

  // 特殊布局
  if (config.special) {
    return {
      'grid-template-columns': 'repeat(4, 1fr)',
      'grid-template-rows': 'repeat(4, 1fr)'
    }
  }

  // 3分屏特殊处理
  if (config.custom) {
    return {
      'grid-template-columns': '1fr 1fr',
      'grid-template-rows': '1fr 1fr'
    }
  }

  // 标准网格
  return {
    'grid-template-columns': `repeat(${config.cols}, 1fr)`,
    'grid-template-rows': `repeat(${config.rows}, 1fr)`
  }
})

// 格式化预览时间
// 格式化时间
const formatTime = (seconds) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

// 格式化预览时间（针对源对象）
const formatPreviewTime = (source) => {
  if (!source.previewProgress) return '00:00:00'
  return formatTime(source.previewProgress.currentTime)
}

// 字幕统计计算属性
const totalSubtitleCount = computed(() => {
  return generatedSubtitles.value.reduce((total, videoSub) => {
    return total + (videoSub.subtitles?.length || 0)
  }, 0)
})

const avgSubtitleCount = computed(() => {
  const videoCount = generatedSubtitles.value.length
  if (videoCount === 0) return 0
  return Math.round(totalSubtitleCount.value / videoCount)
})

const totalDuration = computed(() => {
  let totalSeconds = 0
  generatedSubtitles.value.forEach(videoSub => {
    if (videoSub.subtitles && videoSub.subtitles.length > 0) {
      const lastSub = videoSub.subtitles[videoSub.subtitles.length - 1]
      totalSeconds += parseTimeToSeconds(lastSub.endTime)
    }
  })
  return formatTime(totalSeconds)
})

// 将时间字符串转换为秒数
const parseTimeToSeconds = (timeStr) => {
  const match = timeStr.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/)
  if (!match) return 0
  const [, hours, minutes, seconds, milliseconds] = match
  return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(milliseconds) / 1000
}

// 获取画布对应的源 ID
const getCanvasSourceId = (index) => {
  return canvasSourceMap.value[index] || null
}

// 获取画布对应的视频源
const getCanvasVideoSource = (index) => {
  const sourceId = getCanvasSourceId(index)
  if (!sourceId) return null
  return videoPreviews.value.find(s => s.id === sourceId)
}

// 检查画布是否在当前布局中隐藏
const isHiddenInLayout = (index) => {
  const visibleIndices = getVisibleCanvasIndices(currentLayout.value)
  return !visibleIndices.includes(index)
}

// 获取网络质量
const getNetworkQuality = (index) => {
  // TODO: 根据实际网络质量数据返回
  return 'good'
}

// 获取源类型图标
const getSourceTypeIcon = (type) => {
  const icons = {
    camera: '📷',
    localVideo: '🎬',
    screen: '🖥️',
    network: '🌐',
    usb: '📹'
  }
  return icons[type] || '📺'
}

// ============================================
// 录制文件管理功能
// ============================================

// 播放录制文件
const playRecording = async (recording) => {
  try {
    console.log('[TeacherWindow] 播放录制:', recording)
    playbackVideoUrl.value = recording.url || recording.path
    showPlaybackDialog.value = true

    await nextTick()
    if (playbackVideoRef.value) {
      playbackVideoRef.value.src = playbackVideoUrl.value
      await playbackVideoRef.value.play().catch(err => {
        console.warn('[TeacherWindow] 自动播放被阻止', err)
      })
    }
  } catch (error) {
    console.error('[TeacherWindow] 播放录制文件失败:', error)
    ElMessage.error('播放失败')
  }
}

// 导出录制文件
const exportRecording = async (recording) => {
  try {
    console.log('[TeacherWindow] 导出录制:', recording)

    const { ElMessageBox } = await import('element-plus')
    await ElMessageBox.confirm(
      `确定导出录制文件 "${recording.name}" 吗？`,
      '导出确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'info'
      }
    )

    if (recording.path) {
      const link = document.createElement('a')
      link.href = recording.path
      link.download = recording.name
      link.click()
    }

    if (recording.url) {
      const response = await fetch(recording.url)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = recording.name
      link.click()

      URL.revokeObjectURL(url)
    }

    ElMessage.success('导出成功')
  } catch (error) {
    if (error !== 'cancel') {
      console.error('[TeacherWindow] 导出失败:', error)
      ElMessage.error('导出失败: ' + error.message)
    }
  }
}

// 删除录制文件
const deleteRecording = async (recording) => {
  try {
    console.log('[TeacherWindow] 删除录制:', recording)

    const { ElMessageBox } = await import('element-plus')
    await ElMessageBox.confirm(
      `确定删除录制文件 "${recording.name}" 吗？ 此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    if (typeof deleteRecordingFromComposable === 'function') {
      await deleteRecordingFromComposable(recording)
    } else {
      const index = recordings.value.findIndex(r => r.id === recording.id)
      if (index !== -1) {
        recordings.value.splice(index, 1)
      }
    }

    ElMessage.success('删除成功')
  } catch (error) {
    if (error !== 'cancel') {
      console.error('[TeacherWindow] 删除失败:', error)
      ElMessage.error('删除失败: ' + error.message)
    }
  }
}

// 加载录制文件列表
const loadRecordings = async () => {
  try {
    console.log('[TeacherWindow] 加载录制列表')
    if (typeof loadRecordingsFromComposable === 'function') {
      await loadRecordingsFromComposable()
    } else {
      ElMessage.warning('加载录制列表功能不可用')
    }
  } catch (error) {
    console.error('[TeacherWindow] 加载录制列表失败:', error)
    ElMessage.error('加载录制列表失败: ' + error.message)
  }
}

// 获取过滤后的录制文件
const filteredRecordings = computed(() => {
  if (!recordingFilter.value || recordingFilter.value === 'all') {
    return recordings.value
  }
  return recordings.value.filter(r => r.type === recordingFilter.value)
})

// ============================================
// 多机位和 VR 录制处理函数
// ============================================

// 多机位停止
const handleMulticamStop = async () => {
  try {
    console.log('[TeacherWindow] 停止多机位录制')

    if (typeof stopMulticamRecording === 'function') {
      await stopMulticamRecording()
      console.log('[TeacherWindow] 多机位录制已停止')
    } else {
      ElMessage.warning('多机位录制功能不可用')
    }
  } catch (error) {
    console.error('[TeacherWindow] 停止多机位录制失败', error)
    ElMessage.error('停止多机位录制失败')
  }
}

// 多机位切换摄像头
const handleMulticamSwitchCamera = async (cameraIndex) => {
  try {
    console.log('[TeacherWindow] 切换多机位摄像头:', cameraIndex)

    if (typeof switchCamera === 'function') {
      await switchCamera(multicamSessionId.value, cameraIndex)
      console.log('[TeacherWindow] 已切换到摄像头', cameraIndex)
    } else {
      ElMessage.warning('多机位切换功能不可用')
    }
  } catch (error) {
    console.error('[TeacherWindow] 切换摄像头失败', error)
    ElMessage.error('切换摄像头失败')
  }
}

// VR 录制停止
const handleVrStop = async () => {
  try {
    console.log('[TeacherWindow] 停止 VR 录制')

    if (typeof stopVrRecording === 'function') {
      await stopVrRecording()
      console.log('[TeacherWindow] VR 录制已停止')
    } else {
      ElMessage.warning('VR 录制功能不可用')
    }
  } catch (error) {
    console.error('[TeacherWindow] 停止 VR 录制失败:', error)
    ElMessage.error('停止 VR 录制失败')
  }
}

// ============================================
// 事件处理
// ============================================

// 处理面板切换
const handleSwitchPanel = (e) => {
  console.log('[TeacherWindow] 切换面板:', e.detail?.tab)
  // 可以根据需要实现面板切换逻辑
}

// 处理举手接受
const handleHandRaiseAccept = () => {
  console.log('接受举手')
  // 🎯 handRaiseNotification 已废弃，此函数保留用于兼容
}

// 处理举手拒绝
const handleHandRaiseReject = () => {
  console.log('拒绝举手')
  // 🎯 handRaiseNotification 已废弃，此函数保留用于兼容
}

// 处理关闭通知
const handleCloseNotification = (notificationId) => {
  console.log('关闭通知:', notificationId)
  // 从通知列表中移除指定通知
  const index = handRaiseNotifications.findIndex(n => n.id === notificationId)
  if (index !== -1) {
    handRaiseNotifications.splice(index, 1)
  }
}

// 导出字幕
const handleExportSubtitles = async () => {
  try {
    console.log('[TeacherWindow] 导出全部字幕')
    await exportAllSubtitles()
  } catch (error) {
    console.error('[TeacherWindow] 导出字幕失败:', error)
  }
}

// 导入字幕
const handleImportSubtitles = async () => {
  try {
    console.log('[TeacherWindow] 导入字幕')
    await importSubtitles()
  } catch (error) {
    console.error('[TeacherWindow] 导入字幕失败:', error)
  }
}

// 清除字幕
const handleClearSubtitles = () => {
  try {
    console.log('[TeacherWindow] 清除全部字幕')
    clearAllSubtitles()
  } catch (error) {
    console.error('[TeacherWindow] 清除字幕失败:', error)
  }
}

// 处理多机位录制开始
const handleMulticamStart = async ({ config, outputConfig }) => {
  console.log('多机位录制开始', config, outputConfig)
  try {
    await startMulticamRecording(config, outputConfig)
  } catch (error) {
    console.error('启动多机位录制失败', error)
  }
}

// 🎯 处理显示添加信号源对话框
const handleShowAddSourceDialog = async () => {
  console.log('[TeacherWindow] 接收到打开添加信号源对话框事件')
  console.log('[TeacherWindow] showAddSourceDialog 当前值:', showAddSourceDialog.value)

  // 加载采集设备列表
  await loadCaptureDevices()

  showAddSourceDialog.value = true
  console.log('[TeacherWindow] showAddSourceDialog 设置后值:', showAddSourceDialog.value)
}

/**
 * 加载采集设备列表
 */
const loadCaptureDevices = async () => {
  try {
    console.log('[采集设备] 开始加载设备列表...')
    const devices = await listCaptureDevices()

    // 过滤采集卡和高拍仪
    captureDevicesList.value = filterCaptureCards(devices)
    scannerDevicesList.value = filterDocumentScanners(devices)

    console.log('[采集设备] 加载完成:', {
      total: devices.length,
      captureCards: captureDevicesList.value.length,
      scanners: scannerDevicesList.value.length
    })
  } catch (error) {
    console.error('[采集设备] 加载失败:', error)
    ElMessage.warning('采集设备列表加载失败: ' + error.message)
  }
}

// 加载本地摄像头设备
const loadLocalCameraDevices = async () => {
  try {
    console.log('[本地摄像头] 开始加载设备列表...')

    // 先尝试获取设备列表（即使没有权限也能获取设备数量，只是名称会被隐藏）
    let devices
    try {
      devices = await navigator.mediaDevices.enumerateDevices()
      console.log('[本地摄像头] 设备列表获取成功')
    } catch (enumError) {
      console.error('[本地摄像头] 设备列表获取失败:', enumError)
      // 如果 enumerateDevices 失败，尝试先请求权限
      try {
        await navigator.mediaDevices.getUserMedia({ video: true })
        console.log('[本地摄像头] 摄像头权限已获取')
        devices = await navigator.mediaDevices.enumerateDevices()
      } catch (permError) {
        console.error('[本地摄像头] 权限请求也失败:', permError)
        ElMessage.warning('无法获取摄像头权限，部分功能可能受限')
        localDevices.value = []
        return
      }
    }

    // 获取所有视频输入设备
    const videoDevices = devices.filter(device => device.kind === 'videoinput')

    localDevices.value = videoDevices

    console.log('[本地摄像头] 加载完成:', videoDevices.length, '个设备')
    console.log('[本地摄像头] 设备列表:', videoDevices)

    if (videoDevices.length === 0) {
      console.warn('[本地摄像头] 未检测到摄像头设备')
      // 提供更详细的排查建议
      ElMessage.warning('未检测到USB摄像头设备，请检查：\n1. 摄像头是否正确连接\n2. 摄像头驱动是否已安装\n3. 是否有其他程序正在使用摄像头')
    } else {
      ElMessage.success(`成功加载 ${videoDevices.length} 个摄像头设备`)
    }
  } catch (error) {
    console.error('[本地摄像头] 加载失败:', error)
    ElMessage.error('本地摄像头设备列表加载失败: ' + error.message)
  }
}

// 处理VR录制开始
const handleVrStart = async ({ config }) => {
  console.log('[TeacherWindow] 开始VR录制:', config)
  // TODO: 实现VR录制逻辑
}

// 处理绿幕配置保存
const handleChromakeySave = (config) => {
  Object.assign(chromakeyConfig, config)
  recordingConfig.enableChromakey = config.enabled
  recordingConfig.chromakeyColor = config.color
  recordingConfig.chromakeySimilarity = config.similarity
  recordingConfig.chromakeyBlend = config.blend
  console.log('绿幕配置已保存', chromakeyConfig)
}

// ============================================
// 🆕 渲染引擎相关方法
// ============================================

// 渲染引擎就绪回调
const onRenderReady = () => {
  console.log('[TeacherWindow] 渲染引擎就绪')
}

// 渲染引擎错误回调
const onRenderError = (e) => {
  console.error('[TeacherWindow] 渲染引擎错误:', e.error)
}

// 数据源就绪回调
const onSourceReady = (e) => {
  console.log('[TeacherWindow] 数据源就绪:', e.sourceId)
}

// 数据源错误回调
const onSourceError = (e) => {
  console.error('[TeacherWindow] 数据源错误:', e.sourceId, e.error)
}

// 渲染元素点击回调
const onRenderElementClick = (e) => {
  console.log('[TeacherWindow] 渲染元素点击:', e.element.id)
}

// 切换绘制模式
const toggleDrawingMode = () => {
  isDrawingMode.value = !isDrawingMode.value
  console.log('[TeacherWindow] 绘制模式:', isDrawingMode.value ? '开启' : '关闭')
}

// 截图
const captureScreen = () => {
  if (renderEngineRef.value) {
    const dataUrl = renderEngineRef.value.capture()
    if (dataUrl) {
      const link = document.createElement('a')
      link.download = `capture_${Date.now()}.png`
      link.href = dataUrl
      link.click()
    }
  }
}

// 切换渲染布局
const switchRenderLayout = () => {
  const layouts = ['single', 'grid-1x2', 'grid-2x2', 'grid-3x3', 'picture-in-picture']
  const currentIndex = layouts.indexOf(renderLayoutType.value)
  const nextIndex = (currentIndex + 1) % layouts.length
  renderLayoutType.value = layouts[nextIndex]
  console.log('[TeacherWindow] 切换渲染布局:', renderLayoutType.value)
}

// 添加视频源到渲染引擎
const addSourceToRender = (source) => {
  const exists = activeSources.value.find(s => s.id === source.id)
  if (!exists) {
    activeSources.value.push(source)
    console.log('[TeacherWindow] 添加视频源到渲染引擎:', source.name)
  }
}

// 从渲染引擎移除视频源
const removeSourceFromRender = (sourceId) => {
  activeSources.value = activeSources.value.filter(s => s.id !== sourceId)
  console.log('[TeacherWindow] 从渲染引擎移除视频源:', sourceId)
}

// 选择摄像头
const selectCamera = async (deviceId) => {
  selectedCameraId.value = deviceId
  console.log('[TeacherWindow] 选择摄像头:', deviceId)
}

// 切换渲染引擎模式
const toggleRenderEngine = () => {
  useRenderEngine.value = !useRenderEngine.value
  console.log('[TeacherWindow] 渲染引擎模式:', useRenderEngine.value ? '开启' : '关闭')

  // 如果开启渲染引擎，自动添加第一个摄像头源
  if (useRenderEngine.value && activeSources.value.length === 0) {
    const cameraSource = sourceStore.sources.find(s => s.type === 'camera' || s.type === 'usb')
    if (cameraSource) {
      addSourceToRender(cameraSource)
    }
  }
}

// ============================================
// 视频网格事件处理函数
// ============================================

// 双击视频格子 - 切换最大化显示
const handleDoubleClick = (index) => {
  console.log('[TeacherWindow] 双击视频格子:', index, '当前最大化状态:', isMaximized.value, maximizedIndex.value)

  // 🎯 关键修复：从画布映射中获取信号源，而不是预览列表
  // canvasSourceMap 使用 1-based 索引
  const sourceId = canvasSourceMap.value[index]

  if (!sourceId) {
    console.log('[TeacherWindow] 格子没有视频源，不处理双击')
    ElMessage.warning('请先拖拽信号源到该格子')
    return
  }

  // 🎯 状态机逻辑：切换最大化状态
  // maximizedIndex === index 时还原（设置为 null），否则最大化到该索引
  if (isMaximized.value && maximizedIndex.value === index) {
    // 如果当前已经是最大化且点击的是同一个格子，则取消最大化
    isMaximized.value = false
    maximizedIndex.value = null // 使用 null 保持状态一致
    console.log('[TeacherWindow] 取消最大化')
  } else {
    // 否则设置为最大化
    isMaximized.value = true
    maximizedIndex.value = index
    console.log('[TeacherWindow] 最大化格子:', index)
  }
}

// 录制状态变化
const handleRecordingChanged = (data) => {
  console.log('[TeacherWindow] 录制状态变化', data)

  try {
    if (data && data.index !== undefined) {
      const index = data.index
      const isRecording = data.isRecording

      if (isRecording) {
        if (currentRecordingSession.value) {
          currentRecordingSession.value.isRecording = true
          currentRecordingSession.value.startTime = currentRecordingSession.value.startTime || new Date()
        }
        console.log(`[TeacherWindow] 格子 ${index} 开始录制`)
      } else {
        const stillRecording = canvasRecordingStates.value && Object.values(canvasRecordingStates.value).some(
          state => state && state.recording
        )

        if (currentRecordingSession.value && !stillRecording) {
          currentRecordingSession.value.isRecording = false
          currentRecordingSession.value.startTime = null
        }

        console.log(`[TeacherWindow] 格子 ${index} 停止录制`)
      }
    }
  } catch (error) {
    console.error('[TeacherWindow] 处理录制状态变化失败', error)
  }
}

// 🎯 处理视频格子的拖拽放置（从预览栏拖拽）
const handleVideoDrop = (event, index) => {
  console.log('[TeacherWindow] 视频格子拖拽放置，索引:', index)

  try {
    // 优先尝试获取 JSON 格式的拖拽数据（支持从视频格子/画中画拖拽）
    const jsonData = event.dataTransfer.getData('application/json')

    // 如果是从视频格子拖拽过来的
    if (jsonData) {
      const parsed = JSON.parse(jsonData)
      if (parsed.type === 'canvas') {
        // 从其他视频格子拖拽 - 执行互换
        console.log(`[TeacherWindow] 从格子 ${parsed.index} 拖拽到格子 ${index}`)

        // 获取拖拽来源格子的源
        const sourceId = parsed.sourceId
        const targetSourceId = canvasSourceMap.value[index]

        // 🎯 使用对象展开触发响应式更新
        const newMap = { ...canvasSourceMap.value }

        // 互换两个格子的源
        newMap[parsed.index] = targetSourceId || null
        newMap[index] = sourceId

        canvasSourceMap.value = newMap

        // 查找源名称
        const sourceInfo = allSources.value.find(s => s.id === sourceId)
        const targetInfo = allSources.value.find(s => s.id === targetSourceId)

        ElMessage.success(`已互换 ${sourceInfo?.name || '视频'} 和 ${targetInfo?.name || '空位'}`)
        return
      }
    }

    // 获取信号源数据
    const sourceId = event.dataTransfer?.getData('sourceId')
    const sourceType = event.dataTransfer?.getData('sourceType')
    const sourceName = event.dataTransfer?.getData('sourceName')

    console.log('[TeacherWindow] 拖拽数据:', { sourceId, sourceType, sourceName })

    if (!sourceId) {
      console.warn('[TeacherWindow] 没有找到信号源ID')
      return
    }

    // 从 allSources 中查找信号源
    const source = allSources.value.find(s => s.id === sourceId)

    if (!source) {
      console.error('[TeacherWindow] 未找到信号源:', sourceId)
      ElMessage.error('未找到信号源')
      return
    }

    // 🎯 关键修复：直接调用 handleDrop 处理放置
    if (typeof handleDrop === 'function') {
      handleDrop({ ...source, dataTransfer: {} }, index)
    } else {
      console.error('[TeacherWindow] handleDrop 方法不存在')
      ElMessage.error('拖拽功能不可用')
    }
  } catch (error) {
    console.error('[TeacherWindow] 处理视频拖拽失败:', error)
    ElMessage.error('拖拽失败: ' + error.message)
  }
}

// 🎯 处理从预览栏拖拽事件开始
const handleDragStart = (source) => {
  console.log('[TeacherWindow] 预览栏拖拽开始:', source.name)
  // 设置当前选中的信号源，供放置时使用
  // useSourceDrag 会处理实际拖拽逻辑
}

// 🎯 处理从预览栏拖拽事件结束
const handleDragEnd = () => {
  console.log('[TeacherWindow] 预览栏拖拽结束')
  // 清理拖拽状态
}

// 🎯 处理鼠标按下事件（用于自定义拖拽）
const processMouseDown = (event, source) => {
  console.log('[TeacherWindow] 鼠标按下预览源:', source.name)

  // 🎯 调用 useSourceDrag 的 handleMouseDown 方法处理实际拖拽
  if (typeof handleMouseDown === 'function') {
    handleMouseDown(source, event)  // 修复参数顺序：source在前，event在后
  } else {
    console.error('[TeacherWindow] handleMouseDown 方法不存在')
  }
}

// 🎯 处理触摸开始事件（用于触控设备拖拽）
const processTouchStart = (event, source) => {
  console.log('[TeacherWindow] 触摸开始预览源:', source.name)

  // 🎯 调用 useSourceDrag 的 handleMouseDown 方法处理触摸拖拽（统一使用鼠标事件处理）
  if (typeof handleMouseDown === 'function') {
    handleMouseDown({ touches: [{ clientX: event.touches[0].clientX, clientY: event.touches[0].clientY }] }, source)
  } else {
    console.error('[TeacherWindow] handleMouseDown 方法不存在')
  }
}

// ============================================
// 本地状态定义 (非 Composable 管理的)
// ============================================

// 🎯 注意：handRaiseNotification 已废弃，使用 handRaiseNotifications 数组替代
// const handRaiseNotification = ref({
//   show: false,
//   studentName: ''
// })

// ============================================
// 新增功能的事件处理函数
// ============================================
const handleOpenPlayback = (videoUrl) => {
  playbackVideoUrl.value = videoUrl
  showPlaybackDialog.value = true
}

// 显示网络质量详情
const handleShowNetworkDetail = (detail) => {
  currentNetworkDetail.value = detail
  showNetworkDetailDialog.value = true
}

// 打开重命名对话框
const handleOpenRenameSource = (source) => {
  renameSourceTarget.value = source
  showRenameSourceDialog.value = true
}

// 🎯 刷新信号源列表
const handleRefreshSources = async () => {
  console.log('[TeacherWindow] 刷新信号源列表')
  try {
    // 重新加载本地设备
    await loadLocalCameraDevices()
    ElMessage.success('信号源列表已刷新')
  } catch (error) {
    console.error('[TeacherWindow] 刷新信号源失败:', error)
    ElMessage.error('刷新失败: ' + error.message)
  }
}

// 🎯 添加到预览区域
const handleAddToPreview = (source) => {
  console.log('[TeacherWindow] 添加到预览区域:', source.name, source.id)
  try {
    // 检查是否已经在预览条中
    const existsInPreviews = videoPreviews.value.find(s => s.id === source.id)
    if (existsInPreviews) {
      ElMessage.warning(`${source.name} 已在预览区域中`)
      return
    }

    console.log('[TeacherWindow] 步骤1: 更新 sourceStore 中的信号源状态')
    // 更新 sourceStore 中的信号源状态
    const updateResult = sourceStore.updateSource(source.id, { addedToPreview: true })
    console.log('[TeacherWindow] updateSource 结果:', updateResult)
    console.log('[TeacherWindow] sourcePreviewStatus 当前值:', sourceStore.sourcePreviewStatus[source.id])
    console.log('[TeacherWindow] previewSources 数量:', sourceStore.previewSources.length)

    console.log('[TeacherWindow] 步骤2: 将信号源添加到 videoPreviews 预览条')
    // 将信号源添加到 videoPreviews 预览条
    addVideoSource(source)
    console.log('[TeacherWindow] videoPreviews 数量:', videoPreviews.value.length)

    // 🎯 用户需求：摄像头先添加到预览区域，由用户手动拖曳到画布
    // 不自动映射到画布格子，保持用户控制
    ElMessage.success(`信号源 "${source.name}" 已添加到预览区域，可拖曳到画布格子`)
  } catch (error) {
    console.error('[TeacherWindow] 添加到预览失败:', error)
    ElMessage.error('添加到预览区域失败')
  }
}

// 🎯 从预览区域移除
const handleRemoveFromPreview = (sourceId) => {
  console.log('[TeacherWindow] 从预览区域移除:', sourceId)
  try {
    const source = allSources.value.find(s => s.id === sourceId)
    if (!source) {
      ElMessage.error('未找到信号源')
      return
    }

    // 从画布中移除
    const canvasIndex = Object.keys(canvasSourceMap.value).find(index =>
      canvasSourceMap.value[index] === sourceId
    )

    if (canvasIndex !== undefined) {
      // 🎯 注销从属视频同步
      unregisterSlaveVideo(parseInt(canvasIndex), sourceId)
      delete canvasSourceMap.value[canvasIndex]
      console.log(`[TeacherWindow] 已从画布 ${canvasIndex} 移除: ${source.name}`)
    }

    // 🎯 清理主控视频同步
    clearMasterVideo(sourceId)

    // 从 videoPreviews 中移除
    removeVideoSource(sourceId)

    // 🎯 使用 sourceStore 更新 addedToPreview 状态（保留在信号源列表）
    sourceStore.updateSource(sourceId, { addedToPreview: false })
    console.log(`[TeacherWindow] 已设置 addedToPreview = false: ${source.name}`)

    ElMessage.success(`已从预览区域移除 "${source.name}"，信号源列表保留`)
  } catch (error) {
    console.error('[TeacherWindow] 从预览移除失败:', error)
    ElMessage.error('移除失败')
  }
}

// 🎯 删除信号源
const handleDeleteSource = (sourceId) => {
  console.log('[TeacherWindow] 删除信号源:', sourceId)
  try {
    const source = allSources.value.find(s => s.id === sourceId)
    if (!source) {
      ElMessage.error('未找到信号源')
      return
    }

    // 🎯 如果已添加到预览，先从预览区域移除
    if (source.addedToPreview) {
      // 从画布中移除（如果在画布中）
      const canvasIndex = Object.keys(canvasSourceMap.value).find(index =>
        canvasSourceMap.value[index] === sourceId
      )

      if (canvasIndex !== undefined) {
        // 🎯 注销从属视频同步
        unregisterSlaveVideo(parseInt(canvasIndex), sourceId)
        delete canvasSourceMap.value[canvasIndex]
        console.log(`[TeacherWindow] 已从画布 ${canvasIndex} 移除: ${source.name}`)
      }

      // 🎯 清理主控视频同步
      clearMasterVideo(sourceId)

      // 从 videoPreviews 中移除
      removeVideoSource(sourceId)
    }

    // 从 sourceStore 中移除
    sourceStore.removeSource(sourceId)

    ElMessage.success(`已删除信号源 "${source.name}"`)
  } catch (error) {
    console.error('[TeacherWindow] 删除信号源失败:', error)
    ElMessage.error('删除信号源失败')
  }
}

// 提交新信号源表单
const handleSubmitNewSource = async (formData) => {
  console.log('[TeacherWindow] 提交新信号源表单:', formData)

  try {
    // 生成唯一ID
    const sourceId = 'source_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)

    // 根据类型创建源对象
    let newSource = {
      id: sourceId,
      name: formData.name || `新信号源_${sourceId.slice(-6)}`,
      type: formData.type,
      status: 'online',
      addedToPreview: true,  // 🎯 标记为自动添加到预览区域
      createdAt: new Date().toISOString()
    }

    // 根据不同类型设置特定属性
    if (formData.type === 'localCamera') {
      newSource.deviceId = formData.deviceId
      newSource.resolution = '1920x1080'
      newSource.fps = 30

      // 🎯 关键修复：立即获取摄像头的 MediaStream
      try {
        console.log('[TeacherWindow] 正在获取摄像头流:', formData.deviceId)
        const constraints = {
          video: formData.deviceId ? { deviceId: formData.deviceId } : true,
          audio: true
        }
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        newSource.stream = stream
        console.log('[TeacherWindow] 摄像头流获取成功:', stream.id)
      } catch (error) {
        console.error('[TeacherWindow] 获取摄像头流失败:', error)
        ElMessage.error('无法访问摄像头: ' + error.message)
        return // 终止添加流程
      }
    } else if (formData.type === 'captureCard') {
      newSource.deviceId = formData.deviceId
      newSource.resolution = formData.resolution
      newSource.interfaceType = formData.inputInterface
      newSource.fps = 30
    } else if (formData.type === 'documentScanner') {
      newSource.deviceId = formData.deviceId
      newSource.scanMode = formData.scanMode
      newSource.autoEnhance = formData.autoEnhance
      newSource.autoCrop = formData.autoCrop
      newSource.resolution = '1920x1080'
    } else if (formData.type === 'networkCamera') {
      newSource.protocol = formData.protocol
      newSource.streamUrl = formData.streamUrl
      newSource.needAuth = formData.needAuth
      newSource.username = formData.username
      newSource.password = formData.password
      newSource.resolution = '1920x1080'
    } else if (formData.type === 'networkStream') {
      newSource.protocol = formData.protocol
      newSource.streamUrl = formData.streamUrl
      newSource.bufferTime = formData.bufferTime
      newSource.needAuth = formData.needAuth
      newSource.authToken = formData.authToken
    }

    console.log('[TeacherWindow] 创建新信号源:', newSource)

    // 🎯 保存到 sourceStore
    sourceStore.addSource(newSource)

    // 🎯 立即添加到预览区域
    await nextTick()
    handleAddToPreview(newSource)

    showAddSourceDialog.value = false

  } catch (error) {
    console.error('[TeacherWindow] 添加信号源失败:', error)
    ElMessage.error('添加信号源失败: ' + error.message)
  }
}

// 提交重命名
const handleRenameSource = (sourceId, newName) => {
  console.log('[TeacherWindow] 重命名信号源:', { sourceId, newName })

  try {
    if (!newName || newName.trim() === '') {
      ElMessage.warning('信号源名称不能为空')
      return
    }

    const sourceIndex = videoPreviews.value.findIndex(s => s.id === sourceId)
    if (sourceIndex !== -1) {
      const oldName = videoPreviews.value[sourceIndex].name
      videoPreviews.value[sourceIndex].name = newName.trim()
      console.log(`[TeacherWindow] 信号源已重命名: "${oldName}" -> "${newName}"`)

      ElMessage.success(`信号源 "${newName}" 重命名成功`)

      showRenameSourceDialog.value = false
      renameSourceTarget.value = null
    } else {
      ElMessage.error('未找到要重命名的信号源')
    }
  } catch (error) {
    console.error('[TeacherWindow] 重命名信号源失败:', error)
    ElMessage.error('重命名信号源失败')
  }
}

// ============================================
// SourcePreviewBar 事件处理函数
// ============================================

// 删除信号源
const handleRemoveSource = (source) => {
  console.log('[TeacherWindow] 删除信号源:', source.name, source.id)
  try {
    const sourceIndex = videoPreviews.value.findIndex(s => s.id === source.id)
    if (sourceIndex !== -1) {
      // 🎯 先从 canvasSourceMap 中移除映射关系
      Object.keys(canvasSourceMap.value).forEach(key => {
        if (canvasSourceMap.value[key] === source.id) {
          delete canvasSourceMap.value[key]
          console.log('[TeacherWindow] 已从 canvasSourceMap 移除映射:', key, '->', source.id)
        }
      })

      // ✅ 直接使用解构的 removeVideoSource 函数
      if (typeof removeVideoSource === 'function') {
        removeVideoSource(source.id)
        console.log('[TeacherWindow] 已通过 removeVideoSource 清理源:', source.id)
      } else {
        // 降级方案：手动移除
        videoPreviews.value.splice(sourceIndex, 1)
      }

      ElMessage.success(`已删除信号源 "${source.name}"`)
    }
  } catch (error) {
    console.error('[TeacherWindow] 删除信号源失败:', error)
    ElMessage.error('删除信号源失败')
  }
}

// 预览视频时间更新
const handlePreviewTimeUpdate = ({ event, source }) => {
  console.log(`[TeacherWindow] 预览视频时间更新: ${source.name}`, event.target.currentTime)
}

// 预览视频元数据加载完成
const handlePreviewLoadedMetadata = ({ event, source }) => {
  console.log(`[TeacherWindow] 预览视频元数据加载完成: ${source.name}`, event.target.duration)
}

// 预览视频播放
const handlePreviewPlay = ({ event, source }) => {
  console.log(`[TeacherWindow] 预览视频播放: ${source.name}`)
}

// 预览视频暂停
const handlePreviewPause = ({ event, source }) => {
  console.log(`[TeacherWindow] 预览视频暂停: ${source.name}`)
}

// 预览视频跳转
const handlePreviewSeeked = ({ event, source }) => {
  console.log(`[TeacherWindow] 预览视频跳转: ${source.name}`, event.target.currentTime)
}

// ============================================
// 生命周期钩子
// ============================================

// 🎯 全局调试：暴露字幕相关变量和方法到 window，方便控制台调试
const exposeDebugTools = () => {
  window.generatedSubtitles = generatedSubtitles
  window.currentSubtitleText = currentSubtitleText
  window.videoPreviews = videoPreviews
  window.canvasSourceMap = canvasSourceMap
  window.pipVisible = pipVisible

  window.debugSubtitle = () => {
    console.log('=== 字幕调试信息 ===')
    console.log('字幕数据:', generatedSubtitles.value)
    console.log('videoPreviews:', videoPreviews.value)
    console.log('当前字幕文本:', currentSubtitleText.value)
    console.log('=== 调试信息结束 ===')
  }

  window.debugLayout = () => {
    console.log('=== 布局调试信息 ===')
    console.log('当前布局:', currentLayout.value)
    console.log('画布源映射:', canvasSourceMap.value)
    console.log('layoutStates:', window.__layoutStates)
    console.log('=== 调试信息结束 ===')
  }

  console.log('✅ 调试工具已就绪:')
  console.log('  - window.debugSubtitle() - 字幕调试')
  console.log('  - window.debugLayout() - 布局调试')
}

onMounted(() => {
  console.log('[TeacherWindow] 组件已挂载')
  // 初始化设置
  loadSettings()
  // 加载录制模板
  loadRecordingTemplates()
  // 加载录制列表
  loadRecordings()

  // 🎯 加载设备列表（异步）
  loadCaptureDevices()
  loadLocalCameraDevices()

  // 🎯 初始化默认视频源 - 已禁用，不再自动添加任何源
  // initializeDefaultVideoSources()

  // 🎯 初始化示例数据 - 用于演示
  initializeSampleData()

  // 🎯 暴露调试工具到 window
  exposeDebugTools()

  // 🎯 暴露音频设置到全局，供视频会议窗口使用
  window.teacherWindowAudioSettings = {
    enableAudioMonitor: enableAudioMonitor,
    enableTerminalMute: enableTerminalMute,
    enableAudioNoiseReduction: enableAudioNoiseReduction,
    participantMuted: null
  }

  console.log('[TeacherWindow] 音频设置已暴露到全局')

  // 🎯 监听添加信号源事件
  window.addEventListener('show-add-source-dialog', handleShowAddSourceDialog)

  // 🎯 监听切换面板事件
  window.addEventListener('switch-panel', handleSwitchPanel)

  // 🎯 监听打开视频会议窗口事件
  window.addEventListener('open-video-meeting-window', () => {
    console.log('[TeacherWindow] 打开视频会议窗口')
    showVideoMeetingWindow.value = true
  })

  // 🎯 监听关闭视频会议窗口事件
  window.addEventListener('close-video-meeting', () => {
    console.log('[TeacherWindow] 关闭视频会议窗口')
    showVideoMeetingWindow.value = false
  })

  // 🎯 监听打开 YOLO 全屏窗口事件
  window.addEventListener('open-yolo-window', () => {
    console.log('[TeacherWindow] 打开 YOLO 全屏窗口')
    showYoloWindow.value = true
  })

  // 🎯 监听打开 Analysis 全屏窗口事件
  window.addEventListener('open-analysis-window', () => {
    console.log('[TeacherWindow] 打开 Analysis 全屏窗口')
    showAnalysisWindow.value = true
  })

  // 🎯 监听打开 Web 全屏窗口事件
  window.addEventListener('open-web-window', () => {
    console.log('[TeacherWindow] 打开 Web 全屏窗口')
    showWebWindow.value = true
  })

  // 🎯 监听打开智能视觉分析窗口事件
  window.addEventListener('open-vision-analysis', () => {
    console.log('[TeacherWindow] 打开智能视觉分析窗口')
    showVisionAnalysis.value = true
  })

  // 🎯 监听打开考试评判窗口事件（兼容旧接口）
  window.addEventListener('open-exam-evaluator', () => {
    console.log('[TeacherWindow] 打开考试评判窗口')
    showVisionAnalysis.value = true
  })

  // 🎯 监听视频会议音频状态变化（关联到音频选项）
  window.addEventListener('video-meeting-audio-state', (event) => {
    const { participantId, muted } = event.detail
    console.log('[TeacherWindow] 收到视频会议音频状态变化:', participantId, muted)

    // 更新音频设置
    if (window.teacherWindowAudioSettings) {
      window.teacherWindowAudioSettings.participantMuted = {
        participantId,
        muted
      }

      // 根据全局音频设置处理
      if (enableTerminalMute.value && muted) {
        console.log('[TeacherWindow] 终端静音已启用，应用静音设置')
      }

      if (enableAudioNoiseReduction.value) {
        console.log('[TeacherWindow] 音频降噪已启用')
      }
    }
  })

  // 🎯 监听语音助手事件（从AI语音面板触发）
  window.addEventListener('voice-start-stream', () => handleStartStream())
  window.addEventListener('voice-stop-stream', () => handleStopStream())
  window.addEventListener('voice-start-recording', () => handleStartAllCanvasRecording())
  window.addEventListener('voice-pause-recording', () => handlePauseAllCanvasRecording())
  window.addEventListener('voice-stop-recording', () => handleStopAllCanvasRecording())
  window.addEventListener('voice-next-layout', () => {
    // 新布局索引: 1-1分屏, 2-2分屏, 3-3分屏, 4-4分屏, 5-6分屏, 7-9分屏, 10-16分屏, 11-25分屏, 12-36分屏, 13-49分屏
    const layouts = [1, 2, 3, 4, 5, 7, 10, 11, 12, 13]
    const currentIndex = layouts.indexOf(currentLayout.value)
    const nextIndex = (currentIndex + 1) % layouts.length
    handleLayoutChange(layouts[nextIndex])
  })
  window.addEventListener('voice-show-desktop', () => {
    showScreenShareDialog.value = true
  })
  window.addEventListener('voice-return-teaching', () => {
    handleLayoutChange(1)
  })
  window.addEventListener('voice-quick-record', () => {
    if (!isRecording.value) {
      handleStartAllCanvasRecording()
    }
  })
})

// 🎯 监听sourceStore的变化，同步到videoPreviews
watch(() => sourceStore.sources, (newSources, oldSources) => {
  // 检查是否有新添加的源
  if (newSources.length > oldSources.length) {
    const newSource = newSources[newSources.length - 1]
    // 🎯 信号源添加后自动添加到预览区域（addedToPreview = true）
    if (newSource.addedToPreview) {
      // 检查是否已经存在于 videoPreviews 中
      const existsInPreviews = videoPreviews.value.find(s => s.id === newSource.id)
      if (!existsInPreviews) {
        addVideoSource(newSource)
        console.log('[TeacherWindow] 已将新源自动添加到预览区域:', newSource)
      }
      // 🎯 不再自动映射到画布格子，需要用户手动拖曳
    } else {
      console.log('[TeacherWindow] 新信号源未标记为添加到预览:', newSource.name)
    }
  } else if (newSources.length < oldSources.length) {
    // 检查是否有移除的源
    const removedSource = oldSources.find(old => !newSources.find(n => n.id === old.id))
    if (removedSource) {
      removeVideoSource(removedSource.id)
      // 🎯 从canvasSourceMap中移除对应的映射
      Object.keys(canvasSourceMap.value).forEach(key => {
        if (canvasSourceMap.value[key] === removedSource.id) {
          delete canvasSourceMap.value[key]
          console.log('[TeacherWindow] 已从canvasSourceMap移除映射:', key)
        }
      })
      console.log('[TeacherWindow] 已从videoPreviews移除源:', removedSource)
    }
  } else {
    // 🎯 检查信号源的 addedToPreview 状态变化
    if (newSources.length === oldSources.length) {
      newSources.forEach((newSource, index) => {
        const oldSource = oldSources[index]
        if (oldSource && oldSource.addedToPreview !== newSource.addedToPreview) {
          if (newSource.addedToPreview) {
            // 状态从 false 变为 true：添加到预览区域
            const existsInPreviews = videoPreviews.value.find(s => s.id === newSource.id)
            if (!existsInPreviews) {
              addVideoSource(newSource)
              console.log('[TeacherWindow] 源状态变化，添加到预览区域:', newSource.name)
            }
          } else {
            // 状态从 true 变为 false：从预览区域移除
            removeVideoSource(newSource.id)
            // 从 canvasSourceMap 中移除
            Object.keys(canvasSourceMap.value).forEach(key => {
              if (canvasSourceMap.value[key] === newSource.id) {
                delete canvasSourceMap.value[key]
                console.log('[TeacherWindow] 源状态变化，从画布移除:', key)
              }
            })
            console.log('[TeacherWindow] 源状态变化，从预览区域移除:', newSource.name)
          }
        }
      })
    }
  }
}, { deep: true })

onUnmounted(() => {
  console.log('[TeacherWindow] 组件即将卸载')
  // 清理资源
  if (speechRecognition && speechRecognition.stop) {
    speechRecognition.stop()
  }
  if (screenShareStream.value) {
    stopScreenShare()
  }

  // 🎯 清理事件监听器
  window.removeEventListener('show-add-source-dialog', handleShowAddSourceDialog)
  window.removeEventListener('switch-panel', handleSwitchPanel)
  window.removeEventListener('voice-start-stream', () => handleStartStream())
  window.removeEventListener('voice-stop-stream', () => handleStopStream())
  window.removeEventListener('voice-start-recording', () => handleStartAllCanvasRecording())
  window.removeEventListener('voice-pause-recording', () => handlePauseAllCanvasRecording())
  window.removeEventListener('voice-stop-recording', () => handleStopAllCanvasRecording())
  window.removeEventListener('voice-next-layout', () => {})
  window.removeEventListener('voice-show-desktop', () => {})
  window.removeEventListener('voice-return-teaching', () => {})
  window.removeEventListener('voice-quick-record', () => {})
  window.removeEventListener('open-video-meeting-window', () => {})
  window.removeEventListener('close-video-meeting', () => {})
  window.removeEventListener('open-yolo-window', () => {})
  window.removeEventListener('open-analysis-window', () => {})
  window.removeEventListener('open-web-window', () => {})
  window.removeEventListener('video-meeting-audio-state', () => {})
})

// 🎯 仅在有视频源时才设置 canvasSourceMap
if (videoPreviews.value.length > 0 && Object.keys(canvasSourceMap.value).length === 0) {
  // 将第一个源映射到第一个画布格子
  canvasSourceMap.value[1] = videoPreviews.value[0]?.id
  console.log('[TeacherWindow] 已设置默认画布源映射:', canvasSourceMap.value[1])
}

// 暴露方法给父组件或其他组件调用
defineExpose({
  minimize,
  maximize,
  close,
  refreshAllCameras,
  enableAnnotationForAll,
  startASRForAll,
  openVideoToSubtitleDialog,
  handleStartAllCanvasRecording,
  handlePauseAllCanvasRecording,
  handleStopAllCanvasRecording,
  showPlaybackDialog: handleOpenPlayback,
  showNetworkDetailDialog: handleShowNetworkDetail,
  showRenameSourceDialog: handleOpenRenameSource,
  // 多路音视频编解码
  openMediaCodecDialog: () => showMediaCodecDialog.value = true,
  getVideoPreviewRef: (index) => videoPreviews.value[index],
  restoreLayoutState,
  clearAllVideoPreviews,
  getVisibleCanvasIndices,
  getCanvasSourceId,
  getCanvasVideoSource,
  exportSubtitles,
  importSubtitles,
  clearAllSubtitles,
  showSubtitleManager,
  startLive,
  stopLive,
  addStudent,
  addTask,
  startTraining,
  startAnalysis,
  stopAnalysis,
  preloadYolo,
  isAnalyzing,
  detectionMode,
  networkStatus,
  updateDetectionMode,
  getDetectionModeText,
  getNetworkStatusText
})
</script>

<style lang="scss" scoped>
// 导入全局样式
@import '../styles/variables.scss';
@import '../styles/layout.scss';
@import '../styles/animations.scss';
@import '../styles/teacher-window.scss';

.teacher-window {
  width: 100%;
  min-height: 100vh;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #0A101A;
  color: #FFFFFF;
  overflow: hidden;
}

.app-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

// 主内容区包装器（水平布局：左侧内容区 + 右侧边栏）
.main-content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  overflow: hidden;
  min-height: 0;
  height: 100%;
}

// 左侧内容区（视频 + 预览栏）
// 左侧内容区（视频 + 预览栏）
.left-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  min-height: 0;
}

// 左侧内容区（视频 + 预览栏）
.content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  min-height: 0;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  min-height: 0;  /* 允许 flex 子元素收缩 */
}
.video-area {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-height: 0;  /* 允许 flex 子元素收缩 */
  border: 1px solid #2D3A4F;
  border-radius: 8px;
  margin: 8px;
  box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.4);
}

// 🆕 全局预览栏（固定在内容区底部）
.global-preview-bar {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 140px;
  max-height: 200px;
  background: #0D1B2A;
  border: 1px solid #2D3A4F;
  border-radius: 8px;
  margin: 0 8px 8px 8px;
  box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.3);
  overflow: hidden;

  // 🎯 确保预览栏底部有足够的安全距离，避免被任务栏遮挡
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

// 🆕 渲染引擎覆盖层样式
.render-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #0D1B2A;
  z-index: 50;
}

.render-floating-toolbar {
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: flex;
  gap: 8px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 12px;
  backdrop-filter: blur(10px);
  z-index: 100;
}

.tool-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(52, 152, 219, 0.8);
  border: none;
  border-radius: 8px;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: #3498DB;
    transform: translateY(-2px);
  }

  &.active {
    background: #E74C3C;
  }
}

// YOLO 检测模式状态指示器
.yolo-status-indicator {
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 10px;
  backdrop-filter: blur(10px);
  z-index: 100;
  min-width: 160px;

  .status-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;

    .status-label {
      font-size: 13px;
      color: #909399;
      font-weight: 500;
    }

    .status-value {
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 4px;
    }
  }
}

// 工具栏样式
.video-actions {
  display: flex;
  gap: 4px;
  flex-wrap: nowrap;
  align-items: center;

  .action-btn {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 5px 8px;
    border: none;
    background: #0F2035;
    color: #E0E1DD;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 12px;
    font-family: inherit;
    white-space: nowrap;

    &:hover {
      background: #415A77;
      transform: translateY(-2px);
    }

    &.active {
      background: #4CC9F0;
      color: #0D1B2A;
      font-weight: 600;
    }

    .el-icon {
      font-size: 16px;
    }

    .dropdown-icon {
      font-size: 12px;
      margin-left: 2px;
    }
  }
}

// 布局面板样式
.layout-panel {
  padding: 15px;
}

.layout-section {
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #E0E1DD;
  margin-bottom: 10px;
  padding-left: 5px;
  border-left: 3px solid #4CC9F0;
}

.layout-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;

  .el-button {
    width: 100%;
  }
}

.custom-grid-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 视频会议窗口过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
