<template>
  <div class="teacher-window-with-render">
    <!-- 顶部工具栏 -->
    <div class="window-header">
      <div class="header-left">
        <span class="window-title">实训教学实践系统 - 教师端</span>
      </div>
      <div class="header-center">
        <div class="layout-selector">
          <button 
            v-for="layout in layoutOptions" 
            :key="layout.type"
            class="layout-btn"
            :class="{ active: currentLayout === layout.type }"
            @click="switchLayout(layout.type)"
            :title="layout.name"
          >
            <span class="layout-icon">{{ layout.icon }}</span>
          </button>
        </div>
      </div>
      <div class="header-right">
        <button class="control-btn" @click="toggleRecording">
          <span>{{ isRecording ? '⏹️ 停止录制' : '⏺️ 开始录制' }}</span>
        </button>
        <button class="control-btn" @click="toggleFullscreen">
          <span>{{ isFullscreen ? '⛶ 退出全屏' : '⛶ 全屏' }}</span>
        </button>
      </div>
    </div>
    
    <!-- 主内容区域 -->
    <div class="main-content">
      <!-- 左侧面板 -->
      <div class="left-panel">
        <!-- 源列表 -->
        <div class="panel-section">
          <h3 class="section-title">视频源</h3>
          <div class="source-list">
            <div 
              v-for="source in sources" 
              :key="source.id"
              class="source-item"
              :class="{ active: selectedSourceId === source.id }"
              @click="selectSource(source.id)"
            >
              <span class="source-icon">{{ getSourceIcon(source.type) }}</span>
              <span class="source-name">{{ source.name }}</span>
              <span class="source-status" :class="source.status"></span>
            </div>
            
            <button class="add-source-btn" @click="showAddSourceDialog = true">
              <span>+ 添加视频源</span>
            </button>
          </div>
        </div>
        
        <!-- 摄像头预览 -->
        <div class="panel-section">
          <h3 class="section-title">摄像头预览</h3>
          <div class="camera-preview-wrapper">
            <CameraPreview 
              v-if="selectedCameraSource"
              :device-id="selectedCameraSource.deviceId"
              :width="320"
              :height="180"
              :show-controls="false"
              :show-selector="true"
              @ready="onCameraReady"
              @error="onCameraError"
            />
            <div v-else class="no-camera">
              <span>请选择摄像头</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 中间渲染区域 -->
      <div class="render-area">
        <RenderEngineWrapper
          ref="renderWrapper"
          :sources="activeSources"
          :layout-type="currentLayout"
          :width="renderWidth"
          :height="renderHeight"
          :auto-start="true"
          @ready="onRenderReady"
          @error="onRenderError"
          @source-ready="onSourceReady"
          @source-error="onSourceError"
          @element-click="onElementClick"
        />
        
        <!-- 浮动工具栏 -->
        <div class="floating-toolbar">
          <button class="tool-btn" @click="toggleDrawing" :class="{ active: isDrawing }">
            <span>✏️</span>
          </button>
          <button class="tool-btn" @click="captureScreen">
            <span>📷</span>
          </button>
          <button class="tool-btn" @click="clearDrawing">
            <span>🗑️</span>
          </button>
        </div>
      </div>
      
      <!-- 右侧面板 -->
      <div class="right-panel">
        <!-- 录制控制 -->
        <div class="panel-section">
          <h3 class="section-title">录制控制</h3>
          <div class="recording-controls">
            <button 
              class="record-btn" 
              :class="{ recording: isRecording }"
              @click="toggleRecording"
            >
              <span class="record-icon">{{ isRecording ? '⏹️' : '⏺️' }}</span>
              <span class="record-text">{{ isRecording ? '停止' : '录制' }}</span>
            </button>
            <div class="recording-info" v-if="isRecording">
              <span class="timer">{{ recordingTime }}</span>
            </div>
          </div>
        </div>
        
        <!-- 字幕控制 -->
        <div class="panel-section">
          <h3 class="section-title">字幕设置</h3>
          <div class="subtitle-controls">
            <label class="checkbox-label">
              <input type="checkbox" v-model="subtitleEnabled" />
              <span>启用字幕</span>
            </label>
            <input 
              type="range" 
              v-model="subtitleSize" 
              min="12" 
              max="32" 
              class="range-input"
            />
            <span class="range-value">字号: {{ subtitleSize }}px</span>
          </div>
        </div>
        
        <!-- 布局信息 -->
        <div class="panel-section">
          <h3 class="section-title">布局信息</h3>
          <div class="layout-info">
            <div class="info-item">
              <span class="info-label">当前布局:</span>
              <span class="info-value">{{ getLayoutName(currentLayout) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">视频数量:</span>
              <span class="info-value">{{ activeSources.length }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 添加源对话框 -->
    <div class="modal-overlay" v-if="showAddSourceDialog" @click.self="showAddSourceDialog = false">
      <div class="modal-content">
        <h3>添加视频源</h3>
        <div class="source-type-grid">
          <button 
            v-for="type in sourceTypes" 
            :key="type.type"
            class="source-type-btn"
            @click="addSource(type.type)"
          >
            <span class="type-icon">{{ type.icon }}</span>
            <span class="type-name">{{ type.name }}</span>
          </button>
        </div>
        <button class="modal-close" @click="showAddSourceDialog = false">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import RenderEngineWrapper from '../render/RenderEngineWrapper.vue';
import CameraPreview from '../render/CameraPreview.vue';
import { SourceFactory, SOURCE_TYPES } from '../../render';

// State
const currentLayout = ref('single');
const isRecording = ref(false);
const isFullscreen = ref(false);
const isDrawing = ref(false);
const subtitleEnabled = ref(true);
const subtitleSize = ref(18);
const showAddSourceDialog = ref(false);
const selectedSourceId = ref('');
const recordingTime = ref('00:00:00');
const renderWidth = ref(1280);
const renderHeight = ref(720);

// Refs
const renderWrapper = ref(null);

// 布局选项
const layoutOptions = [
  { type: 'single', name: '单画面', icon: '▢' },
  { type: 'grid-1x2', name: '二分屏', icon: '▢▢' },
  { type: 'grid-2x2', name: '四宫格', icon: '▢▢\n▢▢' },
  { type: 'grid-3x3', name: '九宫格', icon: '▢▢▢\n▢▢▢\n▢▢▢' },
  { type: 'picture-in-picture', name: '画中画', icon: '◉⊚' }
];

// 数据源类型
const sourceTypes = [
  { type: SOURCE_TYPES.CAMERA, name: '摄像头', icon: '📹' },
  { type: SOURCE_TYPES.DESKTOP, name: '桌面捕获', icon: '🖥️' },
  { type: SOURCE_TYPES.WINCAP, name: '窗口捕获', icon: '🪟' },
  { type: SOURCE_TYPES.NETCAM, name: '网络摄像头', icon: '🌐' },
  { type: SOURCE_TYPES.VIDEO, name: '视频文件', icon: '🎬' },
  { type: SOURCE_TYPES.IMAGE, name: '图片', icon: '🖼️' },
  { type: SOURCE_TYPES.WEB, name: '网页', icon: '🌍' },
  { type: SOURCE_TYPES.MINDMAP, name: '思维导图', icon: '🧠' }
];

// 模拟数据源
const sources = ref([
  {
    id: 'camera-1',
    type: 'camera',
    name: '主摄像头',
    deviceId: '',
    status: 'active'
  },
  {
    id: 'screen-1',
    type: 'desktop',
    name: '桌面共享',
    status: 'inactive'
  },
  {
    id: 'video-1',
    type: 'video',
    name: '教学视频',
    url: '',
    status: 'inactive'
  }
]);

// 计算属性
const activeSources = computed(() => {
  return sources.value
    .filter(s => s.status === 'active')
    .map(s => ({
      id: s.id,
      type: s.type,
      name: s.name,
      url: s.url,
      deviceId: s.deviceId,
      stream: s.stream
    }));
});

const selectedCameraSource = computed(() => {
  return sources.value.find(s => s.type === 'camera' && s.status === 'active');
});

// 获取源图标
const getSourceIcon = (type) => {
  const icons = {
    camera: '📹',
    desktop: '🖥️',
    wincap: '🪟',
    netcam: '🌐',
    video: '🎬',
    image: '🖼️',
    web: '🌍',
    mindmap: '🧠',
    airplay: '📱'
  };
  return icons[type] || '📦';
};

// 获取布局名称
const getLayoutName = (type) => {
  const names = {
    'single': '单画面',
    'grid-1x2': '1x2 网格',
    'grid-2x1': '2x1 网格',
    'grid-2x2': '2x2 网格',
    'grid-3x3': '3x3 网格',
    'picture-in-picture': '画中画'
  };
  return names[type] || type;
};

// 切换布局
const switchLayout = (layoutType) => {
  currentLayout.value = layoutType;
  
  if (renderWrapper.value) {
    renderWrapper.value.switchLayout(layoutType);
  }
};

// 选择源
const selectSource = (sourceId) => {
  selectedSourceId.value = sourceId;
  
  // 切换源的激活状态
  sources.value = sources.value.map(s => ({
    ...s,
    status: s.id === sourceId ? 'active' : s.status
  }));
};

// 添加源
const addSource = async (type) => {
  try {
    const newSource = {
      id: `${type}-${Date.now()}`,
      type,
      name: getSourceTypeName(type),
      status: 'active'
    };
    
    sources.value.push(newSource);
    selectedSourceId.value = newSource.id;
    showAddSourceDialog.value = false;
    
    // 如果是摄像头，初始化
    if (type === 'camera') {
      const cameraSource = SourceFactory.create('camera', {
        id: newSource.id,
        name: newSource.name
      });
      await cameraSource.init();
      await cameraSource.play();
    }
    
    console.log(`[TeacherWindow] 添加源: ${type}`);
  } catch (err) {
    console.error('[TeacherWindow] 添加源失败:', err);
  }
};

// 获取源类型名称
const getSourceTypeName = (type) => {
  const names = {
    camera: '摄像头',
    desktop: '桌面捕获',
    wincap: '窗口捕获',
    netcam: '网络摄像头',
    video: '视频文件',
    image: '图片',
    web: '网页',
    mindmap: '思维导图',
    airplay: 'AirPlay'
  };
  return names[type] || type;
};

// 切换录制
const toggleRecording = () => {
  isRecording.value = !isRecording.value;
  
  if (isRecording.value) {
    startRecordingTimer();
  } else {
    stopRecordingTimer();
  }
};

// 录制计时器
let recordingTimer = null;
let recordingSeconds = 0;

const startRecordingTimer = () => {
  recordingSeconds = 0;
  recordingTimer = setInterval(() => {
    recordingSeconds++;
    const hours = Math.floor(recordingSeconds / 3600);
    const minutes = Math.floor((recordingSeconds % 3600) / 60);
    const seconds = recordingSeconds % 60;
    recordingTime.value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, 1000);
};

const stopRecordingTimer = () => {
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
};

// 切换全屏
const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    isFullscreen.value = true;
  } else {
    document.exitFullscreen();
    isFullscreen.value = false;
  }
};

// 切换绘制模式
const toggleDrawing = () => {
  isDrawing.value = !isDrawing.value;
};

// 截图
const captureScreen = () => {
  if (renderWrapper.value) {
    const dataUrl = renderWrapper.value.capture();
    if (dataUrl) {
      const link = document.createElement('a');
      link.download = `capture_${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    }
  }
};

// 清除绘制
const clearDrawing = () => {
  // 清除画布上的标注
};

// 回调函数
const onRenderReady = () => {
  console.log('[TeacherWindow] 渲染引擎就绪');
};

const onRenderError = (e) => {
  console.error('[TeacherWindow] 渲染引擎错误:', e.error);
};

const onSourceReady = (e) => {
  console.log('[TeacherWindow] 数据源就绪:', e.sourceId);
};

const onSourceError = (e) => {
  console.error('[TeacherWindow] 数据源错误:', e.sourceId, e.error);
};

const onCameraReady = () => {
  console.log('[TeacherWindow] 摄像头就绪');
};

const onCameraError = (e) => {
  console.error('[TeacherWindow] 摄像头错误:', e.error);
};

const onElementClick = (e) => {
  console.log('[TeacherWindow] 元素点击:', e.element.id);
};

// 生命周期
onMounted(() => {
  // 初始化渲染尺寸
  updateRenderSize();
  window.addEventListener('resize', updateRenderSize);
});

onUnmounted(() => {
  stopRecordingTimer();
  window.removeEventListener('resize', updateRenderSize);
});

// 更新渲染尺寸
const updateRenderSize = () => {
  const mainContent = document.querySelector('.main-content');
  if (mainContent) {
    const rect = mainContent.getBoundingClientRect();
    renderWidth.value = rect.width - 400; // 减去两侧面板宽度
    renderHeight.value = rect.height - 60; // 减去头部高度
  }
};
</script>

<style scoped>
.teacher-window-with-render {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: #0D1B2A;
  color: #E0E0E0;
}

.window-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: #1B263B;
  border-bottom: 1px solid #2D3E50;
}

.header-left {
  flex: 1;
}

.window-title {
  font-size: 16px;
  font-weight: bold;
  color: #E0E0E0;
}

.header-center {
  flex: 2;
  display: flex;
  justify-content: center;
}

.layout-selector {
  display: flex;
  gap: 8px;
}

.layout-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 8px;
  color: #E0E0E0;
  cursor: pointer;
  transition: all 0.3s ease;
}

.layout-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.layout-btn.active {
  background: #3498DB;
}

.layout-icon {
  font-size: 14px;
  white-space: pre;
}

.header-right {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.control-btn {
  padding: 8px 16px;
  background: rgba(52, 152, 219, 0.8);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.control-btn:hover {
  background: #3498DB;
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.left-panel {
  width: 200px;
  background: #1B263B;
  border-right: 1px solid #2D3E50;
  padding: 12px;
  overflow-y: auto;
}

.panel-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 12px;
  font-weight: bold;
  color: #9E9E9E;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid #2D3E50;
}

.source-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.source-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.source-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.source-item.active {
  background: #3498DB;
}

.source-icon {
  font-size: 16px;
}

.source-name {
  flex: 1;
  font-size: 13px;
}

.source-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #9E9E9E;
}

.source-status.active {
  background: #4CAF50;
}

.source-status.inactive {
  background: #9E9E9E;
}

.add-source-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  background: transparent;
  border: 1px dashed #4A6785;
  border-radius: 6px;
  color: #9E9E9E;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.add-source-btn:hover {
  border-color: #3498DB;
  color: #3498DB;
}

.camera-preview-wrapper {
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: 8px;
  overflow: hidden;
  background: #0D1B2A;
}

.no-camera {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #9E9E9E;
  font-size: 12px;
}

.render-area {
  flex: 1;
  position: relative;
  background: #0D1B2A;
}

.floating-toolbar {
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
}

.tool-btn:hover {
  background: #3498DB;
  transform: translateY(-2px);
}

.tool-btn.active {
  background: #E74C3C;
}

.right-panel {
  width: 200px;
  background: #1B263B;
  border-left: 1px solid #2D3E50;
  padding: 12px;
  overflow-y: auto;
}

.recording-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.record-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 16px;
  background: #E74C3C;
  border: none;
  border-radius: 12px;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
}

.record-btn:hover {
  background: #C0392B;
}

.record-btn.recording {
  background: #27AE60;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.record-icon {
  font-size: 24px;
}

.record-text {
  font-size: 14px;
}

.recording-info {
  display: flex;
  align-items: center;
}

.timer {
  font-family: 'Courier New', monospace;
  font-size: 24px;
  font-weight: bold;
  color: #E74C3C;
}

.subtitle-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;
}

.checkbox-label input {
  width: 16px;
  height: 16px;
}

.range-input {
  width: 100%;
}

.range-value {
  font-size: 12px;
  color: #9E9E9E;
}

.layout-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-item {
  display: flex;
  justify-content: space-between;
}

.info-label {
  font-size: 12px;
  color: #9E9E9E;
}

.info-value {
  font-size: 12px;
  color: #E0E0E0;
}

/* 模态框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.8);
  z-index: 1000;
}

.modal-content {
  background: #1B263B;
  border-radius: 16px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
}

.modal-content h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  text-align: center;
}

.source-type-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.source-type-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid #2D3E50;
  border-radius: 12px;
  color: #E0E0E0;
  cursor: pointer;
  transition: all 0.3s ease;
}

.source-type-btn:hover {
  background: rgba(52, 152, 219, 0.3);
  border-color: #3498DB;
}

.type-icon {
  font-size: 24px;
}

.type-name {
  font-size: 12px;
}

.modal-close {
  display: block;
  width: 100%;
  padding: 10px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 8px;
  color: #E0E0E0;
  font-size: 14px;
  cursor: pointer;
}

.modal-close:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
