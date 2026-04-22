<template>
  <div class="vision-analysis-panel">
    <!-- 标签页切换 -->
    <el-tabs v-model="activeTab" class="panel-tabs">
      <!-- 检测模式 -->
      <el-tab-pane label="🔬 检测" name="detection">
        <!-- 全屏按钮 -->
        <button class="fullscreen-btn" @click="openFullscreen">
          🔍 打开全屏模式
        </button>

        <!-- YOLO 模型状态 -->
        <div class="model-status-section">
          <div class="section-title">YOLO 模型状态</div>
          <div class="status-indicators">
            <el-tag
              :type="modelStatusTagType"
              size="small"
              effect="plain"
            >
              {{ modelStatusText }}
            </el-tag>
            <el-tag
              v-if="modelStatus === 'ready'"
              :type="isOnline ? 'success' : 'warning'"
              size="small"
            >
              {{ isOnline ? '🌐 在线' : '📴 离线' }}
            </el-tag>
          </div>
          <div class="detection-mode">
            当前模式: {{ detectionModeText }}
          </div>
          <el-button
            size="small"
            type="primary"
            @click="reloadModel"
            :loading="modelStatus === 'loading'"
            class="reload-btn"
          >
            🔄 重载模型
          </el-button>
        </div>

        <!-- 视频源选择 -->
        <div class="video-source-section">
          <div class="section-title">视频源</div>
          <div class="source-buttons">
            <button class="source-btn" @click="loadCamera">
              📷 摄像头
            </button>
            <button class="source-btn" @click="loadLocalVideo">
              🎬 本地视频
            </button>
            <button class="source-btn" @click="loadImage">
              🖼️ 加载图片
            </button>
            <button class="source-btn" @click="loadDocument">
              📄 文档
            </button>
            <button class="source-btn" @click="loadWebpage">
              🌐 网页
            </button>
            <button class="source-btn" @click="loadMindmap">
              🧠 思维导图
            </button>
          </div>
        </div>

        <!-- 实时检测控制 -->
        <div class="detection-control-section">
          <div class="section-title">
            <span>实时检测</span>
            <span class="status-badge" :class="detectionStatus">
              {{ detectionStatus === 'running' ? '运行中' : '已停止' }}
            </span>
          </div>
          <div class="control-buttons">
            <el-button
              type="success"
              size="small"
              @click="startDetection"
              :disabled="detectionStatus === 'running' || !hasVideoSource"
            >
              ▶️ 开始检测
            </el-button>
            <el-button
              type="danger"
              size="small"
              @click="stopDetection"
              :disabled="detectionStatus !== 'running'"
            >
              ⏹️ 停止检测
            </el-button>
          </div>
        </div>

        <!-- 检测配置 -->
        <div class="config-section">
          <div class="section-title">检测配置</div>
          <div class="config-item">
            <input type="checkbox" id="face-detect" v-model="config.faceDetect">
            <label for="face-detect">人脸检测</label>
          </div>
          <div class="config-item">
            <input type="checkbox" id="object-detect" v-model="config.objectDetect">
            <label for="object-detect">物体检测 (YOLO)</label>
          </div>
          <div class="config-item">
            <input type="checkbox" id="attention-monitor" v-model="config.attentionMonitor">
            <label for="attention-monitor">专注度监测</label>
          </div>
          <div class="threshold-control">
            <label>检测阈值: {{ config.yoloThreshold }}</label>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.1"
              v-model.number="config.yoloThreshold"
            />
          </div>
        </div>

        <!-- 检测结果 -->
        <div class="results-section">
          <div class="section-title">
            <span>检测结果</span>
            <span class="result-count">{{ objectResults.length }} 个物体</span>
          </div>
          <div class="results-list">
            <div v-if="objectResults.length === 0" class="no-results">
              暂无检测结果
            </div>
            <div
              v-for="(obj, index) in objectResults"
              :key="index"
              class="result-item"
            >
              <div class="result-label">{{ obj.label }}</div>
              <div class="result-confidence">
                {{ (obj.confidence * 100).toFixed(1) }}%
              </div>
            </div>
          </div>
        </div>

        <!-- 专注度 -->
        <div class="attention-section">
          <div class="section-title">专注度</div>
          <div class="attention-score">
            <div class="score-value">{{ attentionScore }}</div>
            <div class="score-label">分</div>
          </div>
        </div>

        <!-- 视频预览 -->
        <div class="video-preview-section" v-if="videoElement">
          <div class="video-container" @click="togglePlay">
            <video
              ref="videoRef"
              class="preview-video"
              :src="videoSource"
              muted
              playsinline
              @timeupdate="updateProgress"
              @loadedmetadata="onVideoLoaded"
              @click.stop="togglePlay"
            ></video>
            <canvas ref="overlayCanvas" class="overlay-canvas"></canvas>
            <!-- 播放控制覆盖层 -->
            <div class="video-controls-overlay" v-if="isVideoSource">
              <!-- 暂停图标 -->
              <div class="pause-indicator" v-if="!isPlaying && showPauseIndicator">
                ⏸️
              </div>
              <!-- 进度条 -->
              <div class="video-progress-bar">
                <div class="progress-time">{{ formatTime(currentTime) }}</div>
                <input
                  type="range"
                  class="progress-slider"
                  min="0"
                  :max="duration"
                  :value="currentTime"
                  @input="seekVideo($event)"
                  @click.stop
                />
                <div class="progress-time">{{ formatTime(duration) }}</div>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 实训管理 -->
      <el-tab-pane label="🔧 实训" name="training">
        <div class="training-section">
          <div class="section-header">
            <h4 class="section-title">实训管理</h4>
            <el-button type="primary" size="small" @click="showCreateTrainingDialog = true">
              新建实训
            </el-button>
          </div>

          <div class="training-list">
            <div v-for="training in trainingList" :key="training.id" class="training-card">
              <div class="training-header">
                <span class="training-name">{{ training.name }}</span>
                <el-tag :type="getTrainingStatusType(training.status)" size="small">
                  {{ training.status }}
                </el-tag>
              </div>
              <div class="training-info">
                <span>参与学生: {{ training.studentCount }}</span>
                <span>进度: {{ training.progress }}%</span>
              </div>
              <div class="training-progress">
                <el-progress :percentage="training.progress" :status="getProgressStatus(training.progress)" />
              </div>
              <div class="training-actions">
                <el-button size="small" @click="handleViewTraining(training)">查看</el-button>
                <el-button size="small" type="primary" @click="handleStartTraining(training)">开始</el-button>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 录制管理 -->
      <el-tab-pane label="🎬 录制" name="recording">
        <div class="recording-section">
          <div class="section-header">
            <h4 class="section-title">录制管理</h4>
          </div>

          <!-- 录制控制 -->
          <div class="recording-controls">
            <button
              class="recording-btn"
              :class="{ recording: isRecording, paused: isRecordingPaused }"
              @click="toggleRecording"
            >
              <span class="recording-icon">
                <span v-if="isRecording" class="recording-dot"></span>
                {{ isRecording ? (isRecordingPaused ? '⏸️ 恢复' : '⏸️ 暂停') : '🔴 开始录制' }}
              </span>
            </button>

            <button
              class="recording-btn stop"
              :disabled="!isRecording"
              @click="stopRecording"
            >
              ⏹️ 停止录制
            </button>
          </div>

          <!-- 录制状态 -->
          <div class="recording-status" v-if="isRecording">
            <div class="status-row">
              <span class="status-label">录制时长:</span>
              <span class="status-value">{{ recordingTime }}</span>
            </div>
            <div class="status-row">
              <span class="status-label">状态:</span>
              <el-tag :type="isRecordingPaused ? 'warning' : 'success'" size="small">
                {{ isRecordingPaused ? '已暂停' : '录制中' }}
              </el-tag>
            </div>
          </div>

          <!-- 录制选项 -->
          <div class="recording-options">
            <div class="section-title">录制选项</div>
            <div class="config-item">
              <input type="checkbox" id="record-screen" v-model="recordConfig.recordScreen">
              <label for="record-screen">录制屏幕</label>
            </div>
            <div class="config-item">
              <input type="checkbox" id="record-camera" v-model="recordConfig.recordCamera">
              <label for="record-camera">录制摄像头</label>
            </div>
            <div class="config-item">
              <input type="checkbox" id="record-audio" v-model="recordConfig.recordAudio">
              <label for="record-audio">录制音频</label>
            </div>
            <div class="config-item">
              <input type="checkbox" id="show-overlay" v-model="recordConfig.showOverlay">
              <label for="show-overlay">显示检测标注</label>
            </div>
          </div>

          <!-- 录制历史 -->
          <div class="recording-history">
            <div class="section-title">录制历史</div>
            <div class="history-list">
              <div v-for="record in recordingHistory" :key="record.id" class="history-item">
                <div class="history-info">
                  <span class="history-name">{{ record.name }}</span>
                  <span class="history-meta">{{ record.duration }} | {{ record.date }}</span>
                </div>
                <div class="history-actions">
                  <el-button size="small" @click="playRecord(record)">播放</el-button>
                  <el-button size="small" type="danger" @click="deleteRecord(record)">删除</el-button>
                </div>
              </div>
              <div v-if="recordingHistory.length === 0" class="no-records">
                暂无录制记录
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- COCO 数据集 -->
      <el-tab-pane label="📚 COCO" name="coco">
        <!-- 数据集配置 -->
        <div class="coco-config-section">
          <div class="section-header">
            <h4 class="section-title">COCO 数据集</h4>
          </div>

          <!-- 数据集路径 -->
          <div class="config-item">
            <label>数据集路径:</label>
            <el-input
              v-model="cocoConfig.localPath"
              size="small"
              placeholder="F:\\coco"
              @change="updateCocoPath"
            />
          </div>

          <!-- 数据集选择 -->
          <div class="config-item">
            <label>数据集类型:</label>
            <el-radio-group v-model="cocoConfig.datasetType" size="small">
              <el-radio-button label="val2017">验证集</el-radio-button>
              <el-radio-button label="train2017">训练集</el-radio-button>
            </el-radio-group>
          </div>

          <el-button size="small" type="primary" @click="loadCocoDataset" :loading="cocoLoading">
            📂 加载数据集
          </el-button>

          <div class="coco-stats" v-if="cocoImages.length > 0">
            <span class="stat">图片数量: {{ cocoImages.length }}</span>
            <span class="stat">当前: {{ currentCocoIndex + 1 }} / {{ cocoImages.length }}</span>
          </div>
        </div>

        <!-- 功能选择 -->
        <div class="coco-features">
          <div class="feature-tabs">
            <button
              v-for="feature in cocoFeatures"
              :key="feature.key"
              class="feature-btn"
              :class="{ active: activeCocoFeature === feature.key }"
              @click="activeCocoFeature = feature.key"
            >
              {{ feature.icon }} {{ feature.name }}
            </button>
          </div>

          <!-- 参考图片对照 -->
          <div v-if="activeCocoFeature === 'reference'" class="feature-panel">
            <div class="feature-header">
              <h4>参考图片对照</h4>
              <el-button size="small" @click="showReferenceHelp = true">帮助</el-button>
            </div>

            <div class="category-select">
              <el-select v-model="selectedCategory" placeholder="选择物体类别" size="small" @change="loadReferenceImages">
                <el-option v-for="cat in cocoCategories" :key="cat" :label="cat" :value="cat" />
              </el-select>
            </div>

            <div class="reference-gallery" v-if="referenceImages.length > 0">
              <div v-for="(img, idx) in referenceImages" :key="idx" class="reference-item">
                <div class="reference-preview">{{ img.name }}</div>
                <div class="reference-info">
                  <el-tag size="small" type="success">{{ img.detectedObjects?.length || 0 }} 个检测</el-tag>
                </div>
              </div>
            </div>
            <div v-else class="empty-hint">
              选择类别后加载参考图片
            </div>
          </div>

          <!-- 批量测试 -->
          <div v-if="activeCocoFeature === 'batch'" class="feature-panel">
            <div class="feature-header">
              <h4>批量测试</h4>
            </div>

            <div class="batch-config">
              <div class="config-item">
                <label>测试数量:</label>
                <el-input-number v-model="batchConfig.maxImages" :min="10" :max="500" :step="10" size="small" />
              </div>
              <div class="config-item">
                <label>置信度阈值:</label>
                <el-slider v-model="batchConfig.minConfidence" :min="0.1" :max="0.9" :step="0.1" :show-tooltip="true" />
              </div>
            </div>

            <div class="batch-controls">
              <el-button
                v-if="batchTestStatus !== 'running'"
                type="primary"
                size="small"
                @click="startBatchTest"
                :disabled="cocoImages.length === 0"
              >
                ▶️ 开始测试
              </el-button>
              <el-button
                v-else
                type="danger"
                size="small"
                @click="stopBatchTest"
              >
                ⏹️ 停止测试
              </el-button>
            </div>

            <!-- 测试进度 -->
            <div class="batch-progress" v-if="batchTestStatus === 'running'">
              <el-progress :percentage="batchProgress" :status="batchProgress < 100 ? '' : 'success'" />
              <span class="progress-text">已测试 {{ batchProgress }} 张图片</span>
            </div>

            <!-- 测试结果 -->
            <div class="batch-results" v-if="batchTestStatus === 'completed'">
              <div class="result-summary">
                <div class="result-item">
                  <span class="label">测试总数:</span>
                  <span class="value">{{ batchStats.total }}</span>
                </div>
                <div class="result-item">
                  <span class="label">准确率:</span>
                  <span class="value highlight">{{ batchStats.accuracy }}%</span>
                </div>
                <div class="result-item">
                  <span class="label">总检测数:</span>
                  <span class="value">{{ batchStats.totalDetections }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 教学演示 -->
          <div v-if="activeCocoFeature === 'demo'" class="feature-panel">
            <div class="feature-header">
              <h4>教学演示</h4>
            </div>

            <div class="demo-controls">
              <el-button
                v-if="demoStatus !== 'running'"
                type="success"
                size="small"
                @click="startTeachingDemo"
                :disabled="cocoImages.length === 0"
              >
                ▶️ 开始演示
              </el-button>
              <el-button
                v-else
                type="warning"
                size="small"
                @click="stopTeachingDemo"
              >
                ⏸️ 停止演示
              </el-button>
            </div>

            <div class="demo-preview" v-if="currentDemoImage">
              <div class="demo-image">{{ currentDemoImage.name }}</div>
              <div class="demo-step">第 {{ demoStep }} / 5 步</div>
            </div>

            <!-- 演示历史 -->
            <div class="demo-history" v-if="demoResults.length > 0">
              <h5>演示结果</h5>
              <div v-for="(item, idx) in demoResults" :key="idx" class="demo-item">
                <span class="demo-name">{{ item.name }}</span>
                <el-tag size="small" type="info">{{ item.result?.objects?.length || 0 }} 物体</el-tag>
              </div>
            </div>
          </div>

          <!-- 考试评分 -->
          <div v-if="activeCocoFeature === 'exam'" class="feature-panel">
            <div class="feature-header">
              <h4>实操视频考试</h4>
            </div>

            <!-- 考试配置 -->
            <div class="exam-config" v-if="examStatus === 'idle'">
              <div class="config-item">
                <label>考试时长(秒):</label>
                <el-input-number v-model="examConfig.duration" :min="30" :max="300" :step="30" size="small" />
              </div>
              <div class="config-item">
                <label>检测物体:</label>
                <el-select v-model="examConfig.requiredObjects" multiple placeholder="选择检测物体" size="small">
                  <el-option v-for="cat in cocoCategories" :key="cat" :label="cat" :value="cat" />
                </el-select>
              </div>
              <div class="config-item">
                <label>置信度阈值:</label>
                <el-slider v-model="examConfig.minConfidence" :min="0.1" :max="0.9" :step="0.1" :show-tooltip="true" />
              </div>
              <el-button type="primary" @click="startExam">🎬 开始考试</el-button>
            </div>

            <!-- 考试中 -->
            <div class="exam-recording" v-if="examStatus === 'recording'">
              <div class="exam-timer">
                <span class="timer-label">剩余时间:</span>
                <span class="timer-value">{{ examTimeLeft }}s</span>
              </div>
              <div class="exam-progress">
                <el-progress :percentage="examProgress" status="warning" />
              </div>
              <div class="exam-frames">
                已采集 {{ examFrameCount }} 帧
              </div>
              <el-button type="danger" @click="finishExam">📤 交卷</el-button>
            </div>

            <!-- 考试结果 -->
            <div class="exam-results" v-if="examStatus === 'completed'">
              <div class="exam-score">
                <span class="score-label">考试得分</span>
                <span class="score-value">{{ examScore }}分</span>
              </div>

              <div class="exam-details">
                <div class="detail-item">
                  <span>考试时长:</span>
                  <span>{{ examConfig.duration }}秒</span>
                </div>
                <div class="detail-item">
                  <span>采集帧数:</span>
                  <span>{{ examFrameCount }}</span>
                </div>
                <div class="detail-item">
                  <span>检测物体:</span>
                  <span>{{ examConfig.requiredObjects.join(', ') }}</span>
                </div>
              </div>

              <!-- 各项得分 -->
              <div class="object-scores" v-if="examObjectScores.length > 0">
                <h5>各项得分</h5>
                <div v-for="item in examObjectScores" :key="item.object" class="score-item">
                  <span class="object-name">{{ item.object }}</span>
                  <div class="score-bar">
                    <el-progress :percentage="item.score" :status="item.score >= 60 ? 'success' : 'exception'" />
                  </div>
                  <span class="detection-rate">{{ item.detectionRate }}%</span>
                </div>
              </div>

              <el-button type="primary" @click="resetExam">🔄 重新开始考试</el-button>
            </div>
          </div>
        </div>

        <!-- COCO 图片浏览器 -->
        <div class="coco-browser" v-if="cocoImages.length > 0 && showCocoBrowser">
          <div class="browser-header">
            <h4>COCO 图片浏览</h4>
            <el-button size="small" @click="showCocoBrowser = false">关闭</el-button>
          </div>
          <div class="browser-controls">
            <el-button size="small" @click="prevCocoImage">◀️ 上一张</el-button>
            <span class="browser-index">{{ currentCocoIndex + 1 }} / {{ cocoImages.length }}</span>
            <el-button size="small" @click="nextCocoImage">下一张 ▶️</el-button>
          </div>
          <div class="browser-image" v-if="currentCocoImage">
            <div class="image-name">{{ currentCocoImage.name }}</div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 新建实训对话框 -->
    <el-dialog v-model="showCreateTrainingDialog" title="新建实训" width="400px">
      <el-form :model="newTraining" label-width="80px">
        <el-form-item label="实训名称">
          <el-input v-model="newTraining.name" placeholder="请输入实训名称" />
        </el-form-item>
        <el-form-item label="实训描述">
          <el-input v-model="newTraining.description" type="textarea" placeholder="请输入实训描述" />
        </el-form-item>
        <el-form-item label="参与学生">
          <el-input-number v-model="newTraining.studentCount" :min="1" :max="100" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateTrainingDialog = false">取消</el-button>
        <el-button type="primary" @click="createTraining">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onUnmounted, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useVisionStore } from '@/stores/visionStore'

const visionStore = useVisionStore()

// 活动标签页
const activeTab = ref('detection')

// 模型状态
const modelStatus = computed(() => visionStore.yoloStatus || 'idle')
const isOnline = computed(() => visionStore.isOnline !== undefined ? visionStore.isOnline : navigator.onLine)
const detectionModeText = computed(() => visionStore.detectionModeText || '未知模式')

const modelStatusTagType = computed(() => {
  if (modelStatus.value === 'loading') return 'info'
  if (modelStatus.value === 'error') return 'danger'
  if (modelStatus.value === 'ready') return 'success'
  return 'info'
})

const modelStatusText = computed(() => {
  const statusMap = {
    idle: '待机中',
    loading: '加载中...',
    ready: '已就绪',
    error: '加载失败'
  }
  return statusMap[modelStatus.value] || '未知'
})

// 检测状态
const detectionStatus = ref('stopped')
const hasVideoSource = ref(false)
const objectResults = ref([])
const attentionScore = ref(0)
const logs = ref(['YOLO 视觉分析模块已加载'])

// 视频元素
const videoRef = ref(null)
const overlayCanvas = ref(null)
const videoSource = ref('')
const videoElement = ref(false)

// 视频播放控制
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const showPauseIndicator = ref(false)
const isVideoSource = ref(false)

// 配置
const config = reactive({
  faceDetect: true,
  objectDetect: true,
  attentionMonitor: true,
  yoloThreshold: 0.5
})

// 实训管理
const trainingList = ref([
  { id: 1, name: '基础焊接实训', studentCount: 25, progress: 65, status: 'ongoing' },
  { id: 2, name: '电路设计实训', studentCount: 20, progress: 30, status: 'ongoing' },
  { id: 3, name: '电子产品组装', studentCount: 15, progress: 100, status: 'completed' }
])
const showCreateTrainingDialog = ref(false)
const newTraining = reactive({
  name: '',
  description: '',
  studentCount: 10
})

// 录制管理
const isRecording = ref(false)
const isRecordingPaused = ref(false)
const recordingTime = ref('00:00')
const recordingHistory = ref([
  { id: 1, name: '实训一_2025-03-10', duration: '12:35', date: '2025-03-10' },
  { id: 2, name: '实训二_2025-03-11', duration: '08:22', date: '2025-03-11' }
])
const recordConfig = reactive({
  recordScreen: true,
  recordCamera: true,
  recordAudio: true,
  showOverlay: true
})

let recordingInterval = null
let recordingSeconds = 0

// ============ COCO 数据集相关 ============
// COCO 类别列表（80类）
const cocoCategories = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
  'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
  'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
  'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
  'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
  'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
  'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair',
  'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
  'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator',
  'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
]

// COCO 配置
const cocoConfig = reactive({
  localPath: 'F:\\\\coco',
  datasetType: 'val2017'
})
const cocoLoading = ref(false)
const cocoImages = ref([])
const currentCocoIndex = ref(0)
const showCocoBrowser = ref(false)

// COCO 功能相关
const cocoFeatures = [
  { key: 'reference', name: '参考对照', icon: '🖼️' },
  { key: 'batch', name: '批量测试', icon: '🧪' },
  { key: 'demo', name: '教学演示', icon: '📺' },
  { key: 'exam', name: '考试评分', icon: '📝' }
]
const activeCocoFeature = ref('reference')

// 参考图片对照
const selectedCategory = ref('')
const referenceImages = ref([])
const showReferenceHelp = ref(false)

// 批量测试
const batchTestStatus = ref('idle')
const batchConfig = reactive({
  maxImages: 50,
  minConfidence: 0.5
})
const batchProgress = ref(0)
const batchStats = ref({ total: 0, correct: 0, accuracy: 0, totalDetections: 0 })

// 教学演示
const demoStatus = ref('idle')
const demoStep = ref(0)
const demoResults = ref([])
const currentDemoImage = ref(null)

// 考试评分
const examStatus = ref('idle')
const examConfig = reactive({
  duration: 60,
  requiredObjects: [],
  minConfidence: 0.5
})
const examTimeLeft = ref(0)
const examFrameCount = ref(0)
const examScore = ref(0)
const examObjectScores = ref([])
let examTimer = null
let examInterval = null

// 计算属性
const currentCocoImage = computed(() => {
  if (cocoImages.value.length === 0) return null
  return cocoImages.value[currentCocoIndex.value]
})

// COCO 功能方法
const updateCocoPath = () => {
  visionStore.setCocoDatasetPath(cocoConfig.localPath)
}

const loadCocoDataset = async () => {
  cocoLoading.value = true
  try {
    const isVal = cocoConfig.datasetType === 'val2017'
    const images = await visionStore.loadCocoDatasetImages(isVal)
    cocoImages.value = images
    currentCocoIndex.value = 0

    if (images.length > 0) {
      ElMessage.success(`已加载 ${images.length} 张图片`)
      showCocoBrowser.value = true
    } else {
      ElMessage.warning('未找到图片，请检查数据集路径是否正确')
    }
  } catch (error) {
    ElMessage.error('加载数据集失败: ' + error.message)
  } finally {
    cocoLoading.value = false
  }
}

const nextCocoImage = () => {
  if (cocoImages.value.length === 0) return
  currentCocoIndex.value = (currentCocoIndex.value + 1) % cocoImages.value.length
}

const prevCocoImage = () => {
  if (cocoImages.value.length === 0) return
  currentCocoIndex.value = (currentCocoIndex.value - 1 + cocoImages.value.length) % cocoImages.value.length
}

// 参考图片对照方法
const loadReferenceImages = async () => {
  if (!selectedCategory.value) return

  try {
    ElMessage.info(`正在搜索 ${selectedCategory.value} 相关图片...`)
    const images = await visionStore.getReferenceImagesForCategory(selectedCategory.value, 6)
    referenceImages.value = images

    if (images.length > 0) {
      ElMessage.success(`找到 ${images.length} 张参考图片`)
    } else {
      ElMessage.warning('未找到相关图片')
    }
  } catch (error) {
    ElMessage.error('加载参考图片失败: ' + error.message)
  }
}

// 批量测试方法
const startBatchTest = async () => {
  if (cocoImages.value.length === 0) {
    ElMessage.warning('请先加载数据集')
    return
  }

  batchTestStatus.value = 'running'
  batchProgress.value = 0

  try {
    const result = await visionStore.startBatchTest({
      maxImages: batchConfig.maxImages
    })

    // 监听进度更新
    const checkProgress = setInterval(() => {
      const state = visionStore.$state
      if (state.batchTestProgress !== undefined) {
        batchProgress.value = Math.round((state.batchTestProgress / state.batchTestTotal) * 100)
      }
      if (batchTestStatus.value !== 'running') {
        clearInterval(checkProgress)
      }
    }, 500)

    // 等待完成
    await new Promise((resolve) => {
      const checkDone = setInterval(() => {
        if (batchTestStatus.value === 'completed') {
          clearInterval(checkDone)
          resolve()
        }
      }, 100)
    })

    batchStats.value = visionStore.getBatchTestStats()
    ElMessage.success(`批量测试完成！准确率: ${batchStats.value.accuracy}%`)
  } catch (error) {
    ElMessage.error('批量测试失败: ' + error.message)
    batchTestStatus.value = 'idle'
  }
}

const stopBatchTest = () => {
  visionStore.stopBatchTest()
  batchTestStatus.value = 'idle'
  batchProgress.value = 0
}

// 教学演示方法
const startTeachingDemo = async () => {
  if (cocoImages.value.length === 0) {
    ElMessage.warning('请先加载数据集')
    return
  }

  demoStatus.value = 'running'
  demoResults.value = []

  try {
    ElMessage.info('开始教学演示...')
    const results = await visionStore.startTeachingDemo()
    demoResults.value = results
    ElMessage.success('教学演示完成')
  } catch (error) {
    ElMessage.error('教学演示失败: ' + error.message)
  } finally {
    demoStatus.value = 'idle'
  }
}

const stopTeachingDemo = () => {
  visionStore.stopTeachingDemo()
  demoStatus.value = 'idle'
}

// 考试评分方法
const startExam = () => {
  if (examConfig.requiredObjects.length === 0) {
    ElMessage.warning('请选择需要检测的物体类别')
    return
  }

  examStatus.value = 'recording'
  examTimeLeft.value = examConfig.duration
  examFrameCount.value = 0
  examScore.value = 0
  examObjectScores.value = []

  visionStore.startExam({
    duration: examConfig.duration,
    requiredObjects: examConfig.requiredObjects,
    minConfidence: examConfig.minConfidence
  })

  // 倒计时
  examTimer = setInterval(() => {
    examTimeLeft.value--
    if (examTimeLeft.value <= 0) {
      finishExam()
    }
  }, 1000)

  // 模拟帧采集
  examInterval = setInterval(() => {
    examFrameCount.value++
    // 模拟检测结果
    const randomObjects = examConfig.requiredObjects
      .filter(() => Math.random() > 0.3)
      .map(label => ({
        label,
        confidence: 0.5 + Math.random() * 0.5
      }))

    visionStore.addExamFrameResult({ objects: randomObjects })
  }, 1000)

  ElMessage.success(`考试开始！时长 ${examConfig.duration} 秒`)
}

const finishExam = () => {
  clearInterval(examTimer)
  clearInterval(examInterval)

  examStatus.value = 'analyzing'
  ElMessage.info('正在分析考试结果...')

  const result = visionStore.analyzeExamResults({
    requiredObjects: examConfig.requiredObjects,
    minConfidence: examConfig.minConfidence
  })

  examScore.value = result.score
  examObjectScores.value = result.objectScores || []
  examStatus.value = 'completed'

  ElMessage.success(`考试完成！得分: ${examScore.value} 分`)
}

const resetExam = () => {
  visionStore.resetExam()
  examStatus.value = 'idle'
  examScore.value = 0
  examObjectScores.value = []
  examFrameCount.value = 0
  examTimeLeft.value = examConfig.duration
}

// 计算属性
const examProgress = computed(() => {
  if (examConfig.duration === 0) return 0
  return Math.round(((examConfig.duration - examTimeLeft.value) / examConfig.duration) * 100)
})

// 检测循环
let detectionInterval = null

// 添加日志
const addLog = (message) => {
  const time = new Date().toLocaleTimeString()
  logs.value.push(`[${time}] ${message}`)
  if (logs.value.length > 50) {
    logs.value.shift()
  }
}

// 打开全屏 YOLO 窗口
const openFullscreen = () => {
  // 触发事件打开全屏窗口
  window.dispatchEvent(new CustomEvent('open-yolo-window'))
  addLog('正在打开全屏检测窗口...')
}

// 重载模型
const reloadModel = async () => {
  try {
    addLog('正在重载 YOLO 模型...')
    await visionStore.resetYoloModel()
    addLog(`模型重载成功: ${detectionModeText.value}`)
    ElMessage.success('模型重载成功')
  } catch (error) {
    addLog(`模型重载失败: ${error.message}`)
    ElMessage.error('模型重载失败')
  }
}

// 加载摄像头
const loadCamera = async () => {
  try {
    addLog('正在请求摄像头权限...')
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })

    // 创建视频元素
    if (!videoRef.value) {
      videoElement.value = true
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    if (videoRef.value) {
      videoRef.value.srcObject = stream
      videoRef.value.play()
      hasVideoSource.value = true
      addLog('摄像头已连接')
      ElMessage.success('摄像头已连接')
    }
  } catch (error) {
    addLog(`摄像头加载失败: ${error.message}`)
    ElMessage.error('摄像头加载失败')
  }
}

// 加载本地视频
const loadLocalVideo = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'video/*'
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (file) {
      videoSource.value = URL.createObjectURL(file)
      videoElement.value = true
      hasVideoSource.value = true
      isVideoSource.value = true
      addLog(`已加载视频: ${file.name}`)
      ElMessage.success('视频已加载')
    }
  }
  input.click()
}

// 视频加载完成
const onVideoLoaded = () => {
  if (videoRef.value) {
    duration.value = videoRef.value.duration || 0
    currentTime.value = 0
    isPlaying.value = false
  }
}

// 更新进度
const updateProgress = () => {
  if (videoRef.value) {
    currentTime.value = videoRef.value.currentTime || 0
    isPlaying.value = !videoRef.value.paused
  }
}

// 跳转播放
const seekVideo = (event) => {
  const value = event.target.value
  if (videoRef.value) {
    videoRef.value.currentTime = value
    currentTime.value = value
  }
}

// 格式化时间
const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// 切换播放/暂停
const togglePlay = () => {
  if (videoRef.value && isVideoSource.value) {
    if (videoRef.value.paused) {
      videoRef.value.play()
      isPlaying.value = true
      addLog('播放视频')
    } else {
      videoRef.value.pause()
      isPlaying.value = false
      showPauseIndicator.value = true
      addLog('暂停视频')
      setTimeout(() => {
        showPauseIndicator.value = false
      }, 1000)
    }
  }
}

// 加载图片
const loadImage = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async (e) => {
    const file = e.target.files[0]
    if (file) {
      videoSource.value = URL.createObjectURL(file)
      videoElement.value = true
      hasVideoSource.value = true
      isVideoSource.value = false
      addLog(`已加载图片: ${file.name}`)

      // 对图片执行检测
      await performDetection()
      ElMessage.success('图片已加载并检测')
    }
  }
  input.click()
}

// 加载文档
const loadDocument = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt'
  input.onchange = async (e) => {
    const file = e.target.files[0]
    if (file) {
      addLog(`正在加载文档: ${file.name}`)

      // 对于文档类，使用PDF.js或转换为图片
      if (file.type === 'application/pdf') {
        // 使用PDF.js渲染PDF
        const url = URL.createObjectURL(file)
        videoSource.value = url
        videoElement.value = true
        hasVideoSource.value = true
        addLog(`已加载PDF: ${file.name}`)
        ElMessage.success('PDF已加载')
      } else {
        // 其他文档格式，尝试加载为图片或提示用户
        const url = URL.createObjectURL(file)
        videoSource.value = url
        videoElement.value = true
        hasVideoSource.value = true
        addLog(`已加载文档: ${file.name}`)
        ElMessage.success('文档已加载')
      }
    }
  }
  input.click()
}

// 加载网页
const loadWebpage = () => {
  ElMessage.prompt('请输入网页URL', '加载网页', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputPattern: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
    inputErrorMessage: '请输入有效的URL'
  }).then(({ value }) => {
    videoSource.value = value
    videoElement.value = true
    hasVideoSource.value = true
    addLog(`已加载网页: ${value}`)
    ElMessage.success('网页已加载')
  }).catch(() => {
    // 用户取消
  })
}

// 加载思维导图
const loadMindmap = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,.mm,.xmind,.png,.jpg,.jpeg,.svg'
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (file) {
      addLog(`正在加载思维导图: ${file.name}`)

      // 思维导图格式处理
      const ext = file.name.split('.').pop().toLowerCase()

      if (['png', 'jpg', 'jpeg', 'svg'].includes(ext)) {
        // 图片格式直接显示
        videoSource.value = URL.createObjectURL(file)
        videoElement.value = true
        hasVideoSource.value = true
        addLog(`已加载思维导图图片: ${file.name}`)
        ElMessage.success('思维导图已加载')
      } else {
        // JSON/XMind等格式，提示转换
        ElMessage.info('请将思维导图导出为图片后加载，或直接加载图片格式')
        addLog(`思维导图格式暂不支持，请导出为图片`)
      }
    }
  }
  input.click()
}

// 开始检测
const startDetection = async () => {
  if (!videoRef.value) {
    ElMessage.warning('请先加载视频源')
    return
  }

  try {
    // 预加载模型
    if (modelStatus.value !== 'ready') {
      addLog('正在加载 YOLO 模型...')
      await visionStore.preloadYoloModel()
    }

    detectionStatus.value = 'running'
    addLog('开始实时检测')

    // 启动检测循环
    detectionInterval = setInterval(async () => {
      if (detectionStatus.value === 'running' && videoRef.value) {
        await performDetection()
      }
    }, 500) // 每500ms检测一次
  } catch (error) {
    addLog(`启动检测失败: ${error.message}`)
    ElMessage.error('启动检测失败')
  }
}

// 停止检测
const stopDetection = () => {
  detectionStatus.value = 'stopped'
  if (detectionInterval) {
    clearInterval(detectionInterval)
    detectionInterval = null
  }
  addLog('检测已停止')
}

// 执行检测
const performDetection = async () => {
  if (!videoRef.value) return

  try {
    // 捕获当前帧
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.value.videoWidth || 640
    canvas.height = videoRef.value.videoHeight || 480
    const ctx = canvas.getContext('2d')

    if (videoRef.value.readyState >= 2) {
      ctx.drawImage(videoRef.value, 0, 0, canvas.width, canvas.height)

      // 使用 visionStore 进行分析
      const results = await visionStore.performAnalysis(canvas)

      // 更新结果
      if (results.objects) {
        objectResults.value = results.objects.slice(0, 10)
      }

      if (results.faces) {
        addLog(`检测到 ${results.faces.length} 个人脸`)
      }

      if (results.attention) {
        attentionScore.value = Math.round(results.attention)
      }

      // 绘制检测框
      drawDetectionOverlay(results)
    }
  } catch (error) {
    console.error('[VisionAnalysis] 检测失败:', error)
  }
}

// 绘制检测框
const drawDetectionOverlay = (results) => {
  if (!overlayCanvas.value || !videoRef.value) return

  const canvas = overlayCanvas.value
  canvas.width = videoRef.value.videoWidth || 640
  canvas.height = videoRef.value.videoHeight || 480

  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // 绘制物体检测框
  if (results.objects && config.objectDetect) {
    ctx.strokeStyle = '#00FF00'
    ctx.lineWidth = 2

    for (const obj of results.objects) {
      if (obj.bbox) {
        ctx.strokeRect(obj.bbox.x, obj.bbox.y, obj.bbox.width, obj.bbox.height)
        ctx.fillStyle = '#00FF00'
        ctx.fillText(`${obj.label} ${(obj.confidence * 100).toFixed(0)}%`, obj.bbox.x, obj.bbox.y - 5)
      }
    }
  }

  // 绘制人脸检测框
  if (results.faces && config.faceDetect) {
    ctx.strokeStyle = '#FF00FF'
    ctx.lineWidth = 2

    for (const face of results.faces) {
      if (face.boundingBox) {
        ctx.strokeRect(
          face.boundingBox.x,
          face.boundingBox.y,
          face.boundingBox.width,
          face.boundingBox.height
        )
      }
    }
  }
}

// 实训管理方法
const getTrainingStatusType = (status) => {
  const map = { pending: 'info', ongoing: 'success', completed: 'warning' }
  return map[status] || 'info'
}

const getProgressStatus = (progress) => {
  if (progress >= 100) return 'success'
  if (progress > 50) return 'warning'
  return undefined
}

const handleViewTraining = (training) => {
  ElMessage.info(`查看实训: ${training.name}`)
}

const handleStartTraining = (training) => {
  ElMessage.success(`实训 "${training.name}" 已开始`)
  training.status = 'ongoing'
}

const createTraining = () => {
  if (!newTraining.name) {
    ElMessage.warning('请输入实训名称')
    return
  }

  trainingList.value.push({
    id: Date.now(),
    name: newTraining.name,
    description: newTraining.description,
    studentCount: newTraining.studentCount,
    progress: 0,
    status: 'pending'
  })

  showCreateTrainingDialog.value = false
  newTraining.name = ''
  newTraining.description = ''
  newTraining.studentCount = 10
  ElMessage.success('实训创建成功')
}

// 录制管理方法
const toggleRecording = () => {
  if (isRecording.value) {
    if (isRecordingPaused.value) {
      // 恢复录制
      isRecordingPaused.value = false
      ElMessage.success('录制已恢复')
    } else {
      // 暂停录制
      isRecordingPaused.value = true
      ElMessage.info('录制已暂停')
    }
  } else {
    // 开始录制
    isRecording.value = true
    isRecordingPaused.value = false
    recordingSeconds = 0
    recordingInterval = setInterval(() => {
      if (!isRecordingPaused.value) {
        recordingSeconds++
        const mins = Math.floor(recordingSeconds / 60)
        const secs = recordingSeconds % 60
        recordingTime.value = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      }
    }, 1000)
    ElMessage.success('开始录制')
  }
}

const stopRecording = () => {
  if (recordingInterval) {
    clearInterval(recordingInterval)
    recordingInterval = null
  }

  if (isRecording.value) {
    const date = new Date().toLocaleDateString()
    recordingHistory.value.unshift({
      id: Date.now(),
      name: `录制_${date}`,
      duration: recordingTime.value,
      date: date
    })
  }

  isRecording.value = false
  isRecordingPaused.value = false
  recordingTime.value = '00:00'
  ElMessage.success('录制已停止')
}

const playRecord = (record) => {
  ElMessage.info(`播放: ${record.name}`)
}

const deleteRecord = (record) => {
  const index = recordingHistory.value.findIndex(r => r.id === record.id)
  if (index > -1) {
    recordingHistory.value.splice(index, 1)
    ElMessage.success('录制已删除')
  }
}

// 初始化
onMounted(() => {
  addLog('智能分析面板已加载')
})

// 组件卸载时清理
onUnmounted(() => {
  stopDetection()
  if (recordingInterval) {
    clearInterval(recordingInterval)
  }
  if (videoRef.value && videoRef.value.srcObject) {
    videoRef.value.srcObject.getTracks().forEach(track => track.stop())
  }
})
</script>

<style lang="scss" scoped>
.vision-analysis-panel {
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.panel-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;

  :deep(.el-tabs__header) {
    margin: 0;
    flex-shrink: 0;
  }

  :deep(.el-tabs__content) {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  :deep(.el-tabs__nav-wrap::after) {
    background: #2D4A6F;
  }

  :deep(.el-tabs__item) {
    color: #778DA9;
    font-size: 12px;

    &.is-active {
      color: #06B6D4;
    }
  }

  :deep(.el-tabs__active-bar) {
    background: #06B6D4;
  }
}

.fullscreen-btn {
  width: 100%;
  padding: 8px;
  background: linear-gradient(135deg, #06B6D4, #0891B2);
  border: none;
  border-radius: 4px;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 6px;

  &:hover {
    background: linear-gradient(135deg, #0891B2, #0E7490);
    transform: translateY(-1px);
  }
}

.section-title {
  font-size: 10px;
  font-weight: 600;
  color: #778DA9;
  margin-bottom: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 2px;
  border-bottom: 1px solid #2D4A6F;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;

  .section-title {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }
}

.model-status-section,
.video-source-section,
.detection-control-section,
.config-section,
.results-section,
.attention-section,
.training-section,
.recording-section,
.recording-options,
.recording-history {
  background: #1B263B;
  border-radius: 4px;
  padding: 6px;
  margin-bottom: 6px;
}

.status-indicators {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.detection-mode {
  font-size: 9px;
  color: #A0AEC0;
  margin-top: 4px;
}

.reload-btn {
  width: 100%;
  margin-top: 4px;
  font-size: 10px;
  padding: 4px 8px;
}

.source-buttons {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.source-btn {
  padding: 5px 8px;
  background: #0F2035;
  border: 1px solid #2D4A6F;
  border-radius: 3px;
  color: #E0E1DD;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;

  &:hover {
    background: #1E3A5F;
  }
}

.status-badge {
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 3px;
  background: #6B7280;
  color: #fff;

  &.running {
    background: #10B981;
  }
}

.control-buttons {
  display: flex;
  gap: 4px;

  :deep(.el-button) {
    padding: 4px 8px;
    font-size: 10px;
  }
}

.config-item {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
  font-size: 10px;
  color: #E0E1DD;

  input[type="checkbox"] {
    width: 12px;
    height: 12px;
    cursor: pointer;
  }
}

.threshold-control {
  margin-top: 4px;

  label {
    font-size: 9px;
    color: #A0AEC0;
    display: block;
    margin-bottom: 2px;
  }

  input[type="range"] {
    width: 100%;
    height: 4px;
  }
}

.result-count {
  font-size: 9px;
  color: #10B981;
}

.results-list {
  max-height: 80px;
  overflow-y: auto;
}

.no-results {
  font-size: 10px;
  color: #6B7280;
  text-align: center;
  padding: 10px;
}

.result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 5px;
  background: #0F2035;
  border-radius: 3px;
  margin-bottom: 2px;
}

.result-label {
  font-size: 10px;
  color: #E0E1DD;
}

.result-confidence {
  font-size: 9px;
  color: #10B981;
  font-weight: 500;
}

.attention-section {
  display: flex;
  align-items: center;
  gap: 8px;

  .section-title {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }
}

.attention-score {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.score-value {
  font-size: 24px;
  font-weight: 700;
  color: #06B6D4;
}

.score-label {
  font-size: 10px;
  color: #778DA9;
}

// 实训管理样式
.training-list {
  max-height: 300px;
  overflow-y: auto;
}

.training-card {
  background: #0F2035;
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 6px;
}

.training-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.training-name {
  font-size: 11px;
  color: #E0E1DD;
  font-weight: 500;
}

.training-info {
  display: flex;
  gap: 8px;
  font-size: 9px;
  color: #778DA9;
  margin-bottom: 4px;
}

.training-progress {
  margin-bottom: 4px;
}

.training-actions {
  display: flex;
  gap: 4px;

  :deep(.el-button) {
    padding: 2px 6px;
    font-size: 9px;
  }
}

// 录制管理样式
.recording-controls {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.recording-btn {
  flex: 1;
  padding: 8px 12px;
  background: #0F2035;
  border: 1px solid #2D4A6F;
  border-radius: 4px;
  color: #E0E1DD;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;

  &:hover:not(:disabled) {
    background: #1E3A5F;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.recording {
    background: rgba(239, 68, 68, 0.2);
    border-color: #EF4444;
  }

  &.paused {
    background: rgba(234, 179, 8, 0.2);
    border-color: #EAB308;
  }

  &.stop {
    background: #0F2035;
    border-color: #2D4A6F;
  }
}

.recording-icon {
  display: flex;
  align-items: center;
  gap: 4px;
}

.recording-dot {
  width: 8px;
  height: 8px;
  background: #EF4444;
  border-radius: 50%;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.recording-status {
  background: #0F2035;
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 8px;
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;

  &:last-child {
    margin-bottom: 0;
  }
}

.status-label {
  font-size: 10px;
  color: #778DA9;
}

.status-value {
  font-size: 12px;
  color: #E0E1DD;
  font-weight: 600;
}

.history-list {
  max-height: 150px;
  overflow-y: auto;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px;
  background: #0F2035;
  border-radius: 3px;
  margin-bottom: 4px;
}

.history-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.history-name {
  font-size: 10px;
  color: #E0E1DD;
}

.history-meta {
  font-size: 9px;
  color: #778DA9;
}

.history-actions {
  display: flex;
  gap: 4px;

  :deep(.el-button) {
    padding: 2px 6px;
    font-size: 9px;
  }
}

.no-records {
  font-size: 10px;
  color: #6B7280;
  text-align: center;
  padding: 20px;
}

// Element Plus 覆盖
:deep(.el-dialog) {
  --el-dialog-bg-color: #1A2A3A;
}

:deep(.el-input__wrapper) {
  background: #0D1B2A;
}

:deep(.el-progress__text) {
  font-size: 9px !important;
}

// ============ COCO 数据集样式 ============
.coco-config-section,
.coco-features {
  background: #1B263B;
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 8px;
}

.coco-stats {
  display: flex;
  gap: 12px;
  margin-top: 6px;
  font-size: 10px;
  color: #A0AEC0;

  .stat {
    padding: 2px 6px;
    background: #0F2035;
    border-radius: 3px;
  }
}

// COCO 功能标签
.feature-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
}

.feature-btn {
  flex: 1;
  padding: 6px 4px;
  background: #0F2035;
  border: 1px solid #2D4A6F;
  border-radius: 4px;
  color: #E0E1DD;
  font-size: 9px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #1E3A5F;
  }

  &.active {
    background: linear-gradient(135deg, #06B6D4, #0891B2);
    border-color: #06B6D4;
    color: #fff;
  }
}

.feature-panel {
  background: #0F2035;
  border-radius: 4px;
  padding: 8px;

  .feature-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;

    h4 {
      font-size: 11px;
      color: #E0E1DD;
      margin: 0;
    }
  }
}

// 参考图片
.reference-gallery {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.reference-item {
  background: #1B263B;
  border-radius: 4px;
  padding: 6px;
  text-align: center;

  .reference-preview {
    font-size: 9px;
    color: #A0AEC0;
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .reference-info {
    margin-top: 4px;
  }
}

.category-select {
  margin-bottom: 8px;
}

.empty-hint {
  text-align: center;
  padding: 20px;
  color: #6B7280;
  font-size: 10px;
}

// 批量测试
.batch-config {
  .config-item {
    margin-bottom: 8px;

    label {
      display: block;
      font-size: 10px;
      color: #A0AEC0;
      margin-bottom: 4px;
    }
  }
}

.batch-controls {
  margin: 8px 0;
}

.batch-progress {
  margin: 8px 0;

  .progress-text {
    display: block;
    text-align: center;
    font-size: 10px;
    color: #A0AEC0;
    margin-top: 4px;
  }
}

.batch-results {
  margin-top: 8px;
}

.result-summary {
  display: flex;
  justify-content: space-around;
  background: #1B263B;
  border-radius: 4px;
  padding: 8px;

  .result-item {
    text-align: center;

    .label {
      display: block;
      font-size: 9px;
      color: #A0AEC0;
    }

    .value {
      font-size: 14px;
      font-weight: 600;
      color: #E0E1DD;

      &.highlight {
        color: #10B981;
      }
    }
  }
}

// 教学演示
.demo-controls {
  margin-bottom: 8px;
}

.demo-preview {
  background: #1B263B;
  border-radius: 4px;
  padding: 8px;
  text-align: center;
  margin-bottom: 8px;

  .demo-image {
    font-size: 10px;
    color: #E0E1DD;
    margin-bottom: 4px;
  }

  .demo-step {
    font-size: 9px;
    color: #06B6D4;
  }
}

.demo-history {
  margin-top: 8px;

  h5 {
    font-size: 10px;
    color: #A0AEC0;
    margin: 0 0 6px;
  }
}

.demo-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 6px;
  background: #1B263B;
  border-radius: 3px;
  margin-bottom: 4px;

  .demo-name {
    font-size: 9px;
    color: #E0E1DD;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

// 考试评分
.exam-config,
.exam-recording,
.exam-results {
  .config-item {
    margin-bottom: 8px;

    label {
      display: block;
      font-size: 10px;
      color: #A0AEC0;
      margin-bottom: 4px;
    }
  }
}

.exam-recording {
  text-align: center;
  padding: 12px;
  background: #1B263B;
  border-radius: 4px;

  .exam-timer {
    margin-bottom: 8px;

    .timer-label {
      font-size: 10px;
      color: #A0AEC0;
    }

    .timer-value {
      font-size: 24px;
      font-weight: 700;
      color: #F59E0B;
      margin-left: 8px;
    }
  }

  .exam-frames {
    font-size: 10px;
    color: #A0AEC0;
    margin: 8px 0;
  }
}

.exam-results {
  .exam-score {
    text-align: center;
    padding: 16px;
    background: linear-gradient(135deg, #1B263B, #0F2035);
    border-radius: 8px;
    margin-bottom: 12px;

    .score-label {
      display: block;
      font-size: 10px;
      color: #A0AEC0;
      margin-bottom: 4px;
    }

    .score-value {
      font-size: 36px;
      font-weight: 700;
      color: #10B981;
    }
  }

  .exam-details {
    background: #0F2035;
    border-radius: 4px;
    padding: 8px;
    margin-bottom: 12px;

    .detail-item {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      padding: 4px 0;
      border-bottom: 1px solid #1B263B;

      &:last-child {
        border-bottom: none;
      }

      span:first-child {
        color: #A0AEC0;
      }

      span:last-child {
        color: #E0E1DD;
      }
    }
  }
}

.object-scores {
  margin-bottom: 12px;

  h5 {
    font-size: 10px;
    color: #A0AEC0;
    margin: 0 0 8px;
  }
}

.score-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;

  .object-name {
    width: 60px;
    font-size: 9px;
    color: #E0E1DD;
    flex-shrink: 0;
  }

  .score-bar {
    flex: 1;
  }

  .detection-rate {
    width: 40px;
    font-size: 9px;
    color: #A0AEC0;
    text-align: right;
    flex-shrink: 0;
  }
}

// COCO 浏览器
.coco-browser {
  background: #1B263B;
  border-radius: 4px;
  padding: 8px;
  margin-top: 8px;

  .browser-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;

    h4 {
      font-size: 11px;
      color: #E0E1DD;
      margin: 0;
    }
  }

  .browser-controls {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;

    .browser-index {
      font-size: 10px;
      color: #A0AEC0;
      min-width: 60px;
      text-align: center;
    }
  }

  .browser-image {
    text-align: center;

    .image-name {
      font-size: 10px;
      color: #E0E1DD;
      padding: 8px;
      background: #0F2035;
      border-radius: 4px;
    }
  }
}

// Element Plus 组件覆盖
:deep(.el-select) {
  width: 100%;
}

// 视频预览区域
.video-preview-section {
  margin-top: 8px;
  background: #1B263B;
  border-radius: 4px;
  padding: 8px;
}

.video-container {
  position: relative;
  width: 100%;
  background: #000;
  border-radius: 4px;
  overflow: hidden;

  .preview-video {
    width: 100%;
    display: block;
    max-height: 300px;
  }

  .overlay-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  // 视频控制覆盖层
  .video-controls-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
    padding: 8px;
    opacity: 0;
    transition: opacity 0.3s;

    .video-progress-bar {
      display: flex;
      align-items: center;
      gap: 8px;

      .progress-time {
        font-size: 10px;
        color: #fff;
        min-width: 40px;
        text-align: center;
      }

      .progress-slider {
        flex: 1;
        height: 4px;
        -webkit-appearance: none;
        appearance: none;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 2px;
        cursor: pointer;

        &::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px;
          height: 12px;
          background: #415A77;
          border-radius: 50%;
          cursor: pointer;
        }

        &::-moz-range-thumb {
          width: 12px;
          height: 12px;
          background: #415A77;
          border-radius: 50%;
          cursor: pointer;
          border: none;
        }
      }
    }
  }

  // 暂停指示器
  .pause-indicator {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 48px;
    opacity: 0;
    animation: fadeInOut 1s ease-out forwards;
  }

  @keyframes fadeInOut {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
    20% { opacity: 0.8; transform: translate(-50%, -50%) scale(1); }
    80% { opacity: 0.8; }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
  }
}

// 鼠标悬停时显示控制条
.video-container:hover .video-controls-overlay {
  opacity: 1;
}

:deep(.el-radio-button__inner) {
  background: #0F2035;
  border-color: #2D4A6F;
  font-size: 10px;
  padding: 5px 8px;
}

:deep(.el-input-number) {
  width: 100%;
}

:deep(.el-slider) {
  .el-slider__runway {
    background: #0F2035;
  }

  .el-slider__bar {
    background: #06B6D4;
  }

  .el-slider__button {
    border-color: #06B6D4;
  }
}
</style>
