<template>
  <div class="camera-detection-panel">
    <div class="detection-header">
      <h3>📹 摄像头实时检测</h3>
      <p class="subtitle">火焰/烟雾实时检测报警</p>
    </div>

    <!-- 报警弹窗 -->
    <el-dialog
      v-model="showAlarmDialog"
      title="⚠️ 危险警报"
      width="500px"
      :close-on-click-modal="false"
      :show-close="false"
      class="alarm-dialog"
    >
      <div class="alarm-content">
        <div class="alarm-icon">
          <span v-if="alarmType === 'fire'">🔥</span>
          <span v-else>💨</span>
        </div>
        <div class="alarm-info">
          <h2>{{ alarmType === 'fire' ? '检测到火焰！' : '检测到烟雾！' }}</h2>
          <p>{{ alarmType === 'fire' ? '请立即检查现场，确认是否有火灾风险' : '请检查是否有烟雾产生，确认安全' }}</p>
          <p class="alarm-time">检测时间: {{ alarmTime }}</p>
        </div>
        <el-alert
          :title="alarmType === 'fire' ? '火灾风险警告' : '烟雾警告'"
          :type="alarmType === 'fire' ? 'error' : 'warning'"
          :closable="false"
          show-icon
        />
      </div>
      <template #footer>
        <el-button type="danger" @click="acknowledgeAlarm">
          我已知悉，继续监控
        </el-button>
      </template>
    </el-dialog>

    <!-- 检测开关 -->
    <div class="detection-toggles">
      <el-checkbox v-model="enableFireDetection" :disabled="isDetecting">🔥 火焰检测</el-checkbox>
      <el-checkbox v-model="enableSmokeDetection" :disabled="isDetecting">💨 烟雾检测</el-checkbox>
      <el-checkbox v-model="enableAlarmSound" :disabled="isDetecting">🔔 报警声音</el-checkbox>
      <el-checkbox v-model="aiDetectionEnabled" :disabled="isDetecting || aiModelLoading">
        🤖 AI增强 
        {{ aiModelLoading ? '(加载中...)' : 
           (tauriDetectionAvailable ? '(Tauri后端)' : 
            (aiModelLoaded ? '(已就绪)' : '')) }}
      </el-checkbox>
    </div>

    <!-- 信号源选择 -->
    <div class="source-selector">
      <el-select
        v-model="selectedSourceId"
        placeholder="选择要检测的摄像头"
        :disabled="isDetecting"
        style="width: 100%"
        @change="onSourceChange"
      >
        <el-option
          v-for="source in cameraSources"
          :key="source.id"
          :label="source.name"
          :value="source.id"
        >
          <span>{{ source.name }}</span>
          <span style="float: right; color: #8492a6; font-size: 13px">
            {{ getSourceStatusText(source) }}
          </span>
        </el-option>
      </el-select>

      <el-button
        v-if="!isDetecting"
        type="primary"
        @click="startDetection"
        :disabled="!selectedSourceId"
        style="width: 100%; margin-top: 10px"
      >
        🎥 开始检测
      </el-button>

      <el-button
        v-else
        type="danger"
        @click="stopDetection"
        style="width: 100%; margin-top: 10px"
      >
        ⏹️ 停止检测
      </el-button>
    </div>

    <!-- 检测显示区域 -->
    <div v-if="isDetecting && selectedSourceId" class="detection-display">
      <!-- 视频预览 -->
      <div class="video-wrapper">
        <video
          ref="videoElement"
          autoplay
          playsinline
          muted
          class="detection-video"
        ></video>
        <canvas
          ref="detectionCanvas"
          class="detection-overlay"
        ></canvas>
      </div>

      <!-- 检测信息 -->
      <div class="detection-info">
        <div class="stats-row">
          <div class="stat-item">
            <div class="stat-label">帧率</div>
            <div class="stat-value">{{ fps.toFixed(1) }} FPS</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">目标数</div>
            <div class="stat-value">{{ detectedObjects.length }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">时间</div>
            <div class="stat-value">{{ formatTime(uptime) }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">AI模型</div>
            <div class="stat-value">
              <el-tag :type="aiModelLoaded ? 'success' : 'info'" size="small">
                {{ aiModelLoaded ? '已加载' : (aiModelLoading ? '加载中' : '未加载') }}
              </el-tag>
            </div>
          </div>
        </div>

        <!-- 检测到的目标 -->
        <div class="detected-objects" v-if="detectedObjects.length > 0">
          <h4>检测到的目标</h4>
          <div class="tags-container">
            <el-tag
              v-for="(obj, index) in detectedObjects"
              :key="index"
              :type="obj.source === 'ai' ? 'warning' : getConfidenceType(obj.confidence)"
              size="small"
              class="object-tag"
              :effect="obj.source === 'ai' ? 'dark' : 'light'"
            >
              {{ obj.category }} {{ (obj.confidence * 100).toFixed(0) }}% {{ obj.source === 'ai' ? '(AI)' : '(颜色)' }}
            </el-tag>
          </div>
        </div>

        <!-- 检测设置 -->
        <div class="detection-settings">
          <h4>检测设置</h4>
          <el-form label-position="top" size="small">
            <el-form-item label="检测间隔">
              <el-slider
                v-model="detectionInterval"
                :min="100"
                :max="1000"
                :step="100"
                show-input
                input-size="small"
              />
            </el-form-item>
          </el-form>
        </div>
      </div>
    </div>

    <!-- 未选择信号源时的提示 -->
    <div v-else class="empty-state">
      <el-icon :size="64" color="#909399"><VideoCamera /></el-icon>
      <p>选择上方摄像头开始实时检测</p>
      <p class="hint">支持COCO数据集80类物体识别</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { VideoCamera } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

// Props - 从父组件接收信号源列表
const props = defineProps({
  sources: {
    type: Array,
    default: () => []
  }
});

// 过滤出摄像头类型的信号源
const cameraSources = computed(() => {
  return props.sources.filter(s => s.type === 'localCamera');
});

// 状态
const selectedSourceId = ref('');
const isDetecting = ref(false);
const videoElement = ref(null);
const detectionCanvas = ref(null);
const detectedObjects = ref([]);
const detectionInterval = ref(500);
const fps = ref(0);
const uptime = ref(0);

// 火焰/烟雾检测相关
const enableFireDetection = ref(true);
const enableSmokeDetection = ref(true);
const enableAlarmSound = ref(true);
const showAlarmDialog = ref(false);
const alarmType = ref('fire'); // 'fire' or 'smoke'
const alarmTime = ref('');
let lastAlarmTime = 0;
const ALARM_COOLDOWN = 30000; // 30秒内不重复报警

// AI模型相关
const aiModelLoaded = ref(false);
const aiModelLoading = ref(false);
const aiDetectionEnabled = ref(true); // AI增强检测开关
let aiDetector = null;

// Tauri 后端检测
let tauriDetectionAvailable = false;
const useTauriBackend = ref(true); // 优先使用 Tauri 后端

// 定时器
let detectionTimer = null;
let fpsTimer = null;
let uptimeTimer = null;
let mediaStream = null;
let frameCount = 0;

// 获取信号源状态文本
const getSourceStatusText = (source) => {
  return source.status === 'online' ? '✓ 在线' : '○ 离线';
};

// 信号源选择变化
const onSourceChange = () => {
  detectedObjects.value = [];
};

// 开始检测
const startDetection = async () => {
  try {
    const source = props.sources.find(s => s.id === selectedSourceId.value);
    if (!source) {
      ElMessage.warning('请选择有效的摄像头信号源');
      return;
    }

    // 获取摄像头的deviceId
    const deviceId = source.deviceId;
    if (!deviceId) {
      ElMessage.error('该信号源没有配置摄像头设备ID');
      return;
    }

    // 请求摄像头权限并获取视频流
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId } },  // 使用摄像头原始分辨率
      audio: false
    });

    // 绑定到video元素
    if (videoElement.value) {
      videoElement.value.srcObject = mediaStream;
    }

    isDetecting.value = true;
    uptime.value = 0;
    frameCount = 0;

    // 启动计时器
    uptimeTimer = setInterval(() => {
      uptime.value++;
    }, 1000);

    fpsTimer = setInterval(() => {
      fps.value = frameCount;
      frameCount = 0;
    }, 1000);

    // 开始定时检测
    detectionTimer = setInterval(async () => {
      await detectFrame();
    }, detectionInterval.value);

    // 初始化AI模型
    if (aiDetectionEnabled.value) {
      initAIModel();
    }

    ElMessage.success(`已开始检测: ${source.name}`);
  } catch (error) {
    console.error('启动检测失败:', error);
    ElMessage.error('无法启动摄像头: ' + error.message);
  }
};

// 停止检测
const stopDetection = () => {
  // 停止媒体流
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }

  // 清除定时器
  if (detectionTimer) {
    clearInterval(detectionTimer);
    detectionTimer = null;
  }
  if (fpsTimer) {
    clearInterval(fpsTimer);
    fpsTimer = null;
  }
  if (uptimeTimer) {
    clearInterval(uptimeTimer);
    uptimeTimer = null;
  }

  // 清空视频
  if (videoElement.value) {
    videoElement.value.srcObject = null;
  }

  isDetecting.value = false;
  detectedObjects.value = [];
  fps.value = 0;
  uptime.value = 0;

  ElMessage.info('已停止检测');
};

// 检测帧（基于颜色分析的火焰/烟雾检测 + AI增强）
const detectFrame = async () => {
  if (!videoElement.value || !detectionCanvas.value) return;
  if (videoElement.value.readyState < 2) return;

  try {
    const video = videoElement.value;
    const canvas = detectionCanvas.value;

    // 设置画布尺寸匹配视频
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 清空之前的检测结果
    detectedObjects.value = [];

    // 组合检测：颜色预检测 + AI增强检测
    const allDetections = await combinedDetection(video, ctx);
    detectedObjects.value = allDetections;

    // 绘制检测框
    allDetections.forEach(obj => {
      const color = obj.source === 'ai' ? '#FFD700' : (obj.category.includes('火焰') ? '#FF4500' : '#808080');
      drawDetectionBox(ctx, obj, color);
    });

    // 更新检测信息
    updateDetectionInfo();

    frameCount++;
  } catch (error) {
    console.error('检测帧失败:', error);
  }
};

// 火焰检测 - 基于颜色分析
const detectFire = (video, ctx) => {
  const detections = [];
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');

  tempCanvas.width = 64; // 缩小以提高性能
  tempCanvas.height = 48;

  tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
  const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
  const data = imageData.data;

  let firePixels = 0;
  let minX = tempCanvas.width, maxX = 0, minY = tempCanvas.height, maxY = 0;

  for (let y = 0; y < tempCanvas.height; y++) {
    for (let x = 0; x < tempCanvas.width; x++) {
      const i = (y * tempCanvas.width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // 火焰颜色特征：红色/橙色高亮度
      if (r > 150 && r > g * 1.5 && r > b * 2 && r > 200) {
        firePixels++;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }

  // 如果检测到足够的火焰像素，触发报警
  const threshold = (tempCanvas.width * tempCanvas.height) * 0.02; // 至少2%的像素
  if (firePixels > threshold) {
    // 映射回原始坐标
    const scaleX = video.videoWidth / tempCanvas.width;
    const scaleY = video.videoHeight / tempCanvas.height;

    const fireDetection = {
      category: '🔥 火焰',
      confidence: Math.min(firePixels / (tempCanvas.width * tempCanvas.height * 0.1), 1),
      x: minX * scaleX,
      y: minY * scaleY,
      width: (maxX - minX) * scaleX,
      height: (maxY - minY) * scaleY
    };

    detections.push(fireDetection);
    drawDetectionBox(ctx, fireDetection, '#FF4500');

    // 触发报警
    triggerAlarm('fire');
  }

  return detections;
};

// 烟雾检测 - 基于灰度分析
const detectSmoke = (video, ctx) => {
  const detections = [];
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');

  tempCanvas.width = 64;
  tempCanvas.height = 48;

  tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
  const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
  const data = imageData.data;

  let smokePixels = 0;
  let minX = tempCanvas.width, maxX = 0, minY = tempCanvas.height, maxY = 0;

  for (let y = 0; y < tempCanvas.height; y++) {
    for (let x = 0; x < tempCanvas.width; x++) {
      const i = (y * tempCanvas.width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // 烟雾特征：灰色/白色，低饱和度
      const brightness = (r + g + b) / 3;
      const saturation = Math.max(r, g, b) - Math.min(r, g, b);

      if (brightness > 150 && brightness < 240 && saturation < 50) {
        smokePixels++;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }

  // 如果检测到足够的烟雾像素
  const threshold = (tempCanvas.width * tempCanvas.height) * 0.03;
  if (smokePixels > threshold) {
    const scaleX = video.videoWidth / tempCanvas.width;
    const scaleY = video.videoHeight / tempCanvas.height;

    const smokeDetection = {
      category: '💨 烟雾',
      confidence: Math.min(smokePixels / (tempCanvas.width * tempCanvas.height * 0.1), 1),
      x: minX * scaleX,
      y: minY * scaleY,
      width: (maxX - minX) * scaleX,
      height: (maxY - minY) * scaleY
    };

    detections.push(smokeDetection);
    drawDetectionBox(ctx, smokeDetection, '#808080');

    // 触发报警
    triggerAlarm('smoke');
  }

  return detections;
};

// 触发报警
const triggerAlarm = (type) => {
  const now = Date.now();

  // 冷却期内不重复报警
  if (now - lastAlarmTime < ALARM_COOLDOWN) return;

  lastAlarmTime = now;
  alarmType.value = type;
  alarmTime.value = new Date().toLocaleString('zh-CN');

  // 显示报警弹窗
  showAlarmDialog.value = true;

  // 播放报警声音
  if (enableAlarmSound.value) {
    playAlarmSound();
  }
};

// 播放报警声音
const playAlarmSound = () => {
  const win = window as unknown as { webkitAudioContext?: typeof AudioContext };
  const AudioContextClass = window.AudioContext || win.webkitAudioContext;
  if (!AudioContextClass) return;
  const audioContext = new AudioContextClass();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.value = 800;
  oscillator.type = 'sine';
  gainNode.gain.value = 0.3;

  oscillator.start();

  // 报警声音模式：响3次
  let beepCount = 0;
  const beepInterval = setInterval(() => {
    beepCount++;
    if (beepCount % 2 === 0) {
      oscillator.frequency.value = 800;
      gainNode.gain.value = 0.3;
    } else {
      oscillator.frequency.value = 600;
      gainNode.gain.value = 0.2;
    }

    if (beepCount >= 6) {
      clearInterval(beepInterval);
      oscillator.stop();
      audioContext.close();
    }
  }, 200);
};

// 确认报警
const acknowledgeAlarm = () => {
  showAlarmDialog.value = false;
};

// 更新检测信息
const updateDetectionInfo = () => {
  // 更新模型状态
  if (aiModelLoaded.value) {
    // 可以显示AI模型状态
  }
};

// 初始化AI模型
const initAIModel = async () => {
  if (aiModelLoaded.value || aiModelLoading.value) return;

  aiModelLoading.value = true;

  // 检测 Tauri 环境
  const isTauri = !!window.__TAURI__;

  if (isTauri && useTauriBackend.value) {
    // Tauri 环境：优先尝试使用后端检测
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      // 测试后端是否可用
      await invoke('quick_color_check', { base64Image: '' });
      tauriDetectionAvailable = true;
      aiModelLoaded.value = true;
      ElMessage.success('Tauri 火焰检测后端已就绪');
    } catch (e) {
      console.log('Tauri 后端不可用，将使用前端检测');
      tauriDetectionAvailable = false;
    }
  }

  // 如果 Tauri 后端不可用，尝试加载前端 AI 模型
  if (!tauriDetectionAvailable) {
    ElMessage.info('正在加载AI检测模型，请稍候...');

    try {
      const { pipeline, env } = await import('@xenova/transformers');
      env.allowLocalModels = true;
      env.useBrowserCache = true;
      aiDetector = await pipeline('object-detection', 'Xenova/yolov8-tiny', {
        quantized: true,
      });
      aiModelLoaded.value = true;
      ElMessage.success('AI检测模型加载完成');
    } catch (error) {
      console.error('加载AI模型失败:', error);
      ElMessage.warning('AI模型加载失败，将使用基础颜色检测');
    }
  }

  aiModelLoading.value = false;
};

// 使用AI模型检测
const detectWithAI = async (video) => {
  if (!aiDetector || !aiDetectionEnabled.value) return [];

  try {
    // 使用AI模型检测
    const results = await aiDetector(video.srcObject ? video : video, {
      timeout: 5000,
    });

    const detections = [];

    for (const result of results) {
      const label = result.label.toLowerCase();
      const score = result.score;

      // 检测火源/火焰相关物体 (COCO数据集中 fire 可能不被直接识别)
      // 检查标签是否包含火相关词汇
      const isFireRelated = ['fire', 'flame', 'burning', 'smoke'].some(
        keyword => label.includes(keyword)
      );

      // COCO数据集有 fire extinguisher (灭火器) 和 oven (炉子)
      // 这些高置信度检测也可能提示火灾风险
      const isHazardRelated = ['fire extinguisher', 'oven', 'stove'].some(
        keyword => label.includes(keyword)
      );

      if (isFireRelated || (isHazardRelated && score > 0.5)) {
        detections.push({
          category: `🔥 ${result.label}`,
          confidence: score,
          x: result.box.x1,
          y: result.box.y1,
          width: result.box.x2 - result.box.x1,
          height: result.box.y2 - result.box.y1,
          source: 'ai'
        });
      }
    }

    return detections;
  } catch (error) {
    console.error('AI检测失败:', error);
    return [];
  }
};

// 组合检测：颜色 + AI + Tauri后端
const combinedDetection = async (video, ctx) => {
  const allDetections = [];

  // 1. 颜色预检测 (快速)
  if (enableFireDetection.value) {
    const fireResults = detectFire(video, ctx);
    allDetections.push(...fireResults);
  }

  if (enableSmokeDetection.value) {
    const smokeResults = detectSmoke(video, ctx);
    allDetections.push(...smokeResults);
  }

  // 2. Tauri 后端精确检测 (优先)
  if (tauriDetectionAvailable && aiDetectionEnabled.value) {
    try {
      const tauriResults = await detectWithTauri(video);
      allDetections.push(...tauriResults);
    } catch (e) {
      // Tauri检测失败不影响其他检测
    }
  }

  // 3. AI前端增强检测 (备选)
  else if (aiModelLoaded.value && aiDetectionEnabled.value && !tauriDetectionAvailable) {
    try {
      const aiResults = await detectWithAI(video);
      allDetections.push(...aiResults);
    } catch (e) {
      // AI检测失败不影响颜色检测
    }
  }

  return allDetections;
};

// 使用 Tauri 后端检测
const detectWithTauri = async (video) => {
  const detections = [];

  try {
    const { invoke } = await import('@tauri-apps/api/core');

    // 将视频帧转换为 Base64
    const base64Image = await videoFrameToBase64(video);

    // 调用后端检测
    const result = await invoke('detect_fire_smoke', { base64Image });

    if (result.detections) {
      for (const det of result.detections) {
        detections.push({
          category: det.category === 'fire' ? '🔥 火焰' : '💨 烟雾',
          confidence: det.confidence,
          x: det.x,
          y: det.y,
          width: det.width,
          height: det.height,
          source: 'tauri'
        });
      }
    }

    return detections;
  } catch (error) {
    console.error('Tauri检测失败:', error);
    return [];
  }
};

// 将视频帧转换为 Base64
const videoFrameToBase64 = (video) => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1]; // 移除 data:image/... 前缀
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      } else {
        reject(new Error('无法创建图像'));
      }
    }, 'image/jpeg', 0.8);
  });
};

// 绘制检测框
const drawDetectionBox = (ctx, obj, color = '#00FF00') => {
  const { x, y, width, height, category, confidence } = obj;

  // 绘制边界框
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, width, height);

  // 绘制标签背景
  const label = `${category} ${(confidence * 100).toFixed(0)}%`;
  ctx.font = 'bold 18px Arial';
  const textMetrics = ctx.measureText(label);
  const textHeight = 22;

  ctx.fillStyle = color;
  ctx.fillRect(x, y - textHeight, textMetrics.width + 10, textHeight);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(label, x + 5, y - 5);
};

// 获取置信度标签类型
const getConfidenceType = (confidence) => {
  if (confidence > 0.8) return 'success';
  if (confidence > 0.6) return 'warning';
  return 'info';
};

// 格式化时间
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// 清理
onUnmounted(() => {
  stopDetection();
});
</script>

<style lang="scss" scoped>
.camera-detection-panel {
  padding: 15px;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.detection-toggles {
  display: flex;
  gap: 20px;
  margin-bottom: 15px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 8px;

  :deep(.el-checkbox) {
    margin-right: 0;
  }
}

.alarm-content {
  text-align: center;
  padding: 20px;

  .alarm-icon {
    font-size: 80px;
    margin-bottom: 20px;
    animation: pulse 1s infinite;
  }

  .alarm-info {
    margin-bottom: 20px;

    h2 {
      font-size: 24px;
      color: #f56c6c;
      margin: 0 0 10px;
    }

    p {
      color: #606266;
      margin: 5px 0;
    }

    .alarm-time {
      color: #909399;
      font-size: 14px;
    }
  }
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.detection-header {
  margin-bottom: 15px;

  h3 {
    font-size: 18px;
    color: #303133;
    margin: 0 0 5px;
  }

  .subtitle {
    font-size: 13px;
    color: #909399;
    margin: 0;
  }
}

.source-selector {
  margin-bottom: 15px;
}

.detection-display {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.video-wrapper {
  position: relative;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 4/3;
  width: 100%;

  .detection-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .detection-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
}

.detection-info {
  .stats-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 15px;
  }

  .stat-item {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px;
    border-radius: 8px;
    text-align: center;

    .stat-label {
      font-size: 12px;
      opacity: 0.8;
      margin-bottom: 4px;
    }

    .stat-value {
      font-size: 18px;
      font-weight: bold;
    }
  }

  .detected-objects {
    background: #f5f7fa;
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 15px;

    h4 {
      font-size: 14px;
      color: #303133;
      margin: 0 0 10px;
    }

    .tags-container {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;

      .object-tag {
        margin: 0;
      }
    }
  }

  .detection-settings {
    background: #f5f7fa;
    padding: 12px;
    border-radius: 8px;

    h4 {
      font-size: 14px;
      color: #303133;
      margin: 0 0 10px;
    }
  }
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px 20px;

  p {
    color: #909399;
    font-size: 14px;
    margin: 10px 0 5px;

    &.hint {
      font-size: 12px;
      color: #c0c4cc;
    }
  }
}
</style>
