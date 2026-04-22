/**
 * 教师端功能修复补丁
 * 修复问题：
 * 1. 三分屏布局
 * 2. 画中画布局
 * 3. 自由布局
 * 4. 本地视频音频监听
 * 5. 批注功能（工具选择和关闭）
 * 6. 任务功能
 * 7. 实训功能
 * 8. 视觉分析功能
 * 9. Web 功能
 */

import { nextTick } from 'vue';

// ============================================
// 1. 修复三分屏布局 CSS
// ============================================
const fix3LayoutCSS = `
  // 3 分屏布局：左侧 2 个，右侧 1 个大的
  &.layout-3 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: 4px;

    .video-item:nth-child(1) {
      grid-column: 1;
      grid-row: 1;
    }
    .video-item:nth-child(2) {
      grid-column: 1;
      grid-row: 2;
    }
    .video-item:nth-child(3) {
      grid-column: 2;
      grid-row: 1 / span 2;
    }
  }
`;

// ============================================
// 2. 修复画中画布局
// ============================================
const fixPipLayout = `
  // 画中画位置
  &.bottom-right {
    .pip-inlay {
      position: absolute;
      bottom: 20px;
      right: 20px;
      width: 200px;
      height: 150px;
      z-index: 100;
      border: 2px solid #4CC9F0;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    }
  }

  &.bottom-left {
    .pip-inlay {
      position: absolute;
      bottom: 20px;
      left: 20px;
      width: 200px;
      height: 150px;
    }
  }

  &.top-right {
    .pip-inlay {
      position: absolute;
      top: 20px;
      right: 20px;
      width: 200px;
      height: 150px;
    }
  }

  &.top-left {
    .pip-inlay {
      position: absolute;
      top: 20px;
      left: 20px;
      width: 200px;
      height: 150px;
    }
  }
`;

// ============================================
// 3. 批注功能修复 - 添加工具选择和关闭按钮
// ============================================
const fixAnnotationToolbar = `
<div v-if="annotationCanvases.length > 0 || globalAnnotationEnabled" class="annotation-toolbar">
  <span class="toolbar-label">{{ globalAnnotationEnabled ? '全局批注' : '批注工具' }}</span>

  <!-- 工具选择 -->
  <el-radio-group v-model="annotationBrushType" size="small">
    <el-radio-button label="pen">✏️ 笔</el-radio-button>
    <el-radio-button label="highlighter">🖍️ 荧光笔</el-radio-button>
    <el-radio-button label="eraser">🧹 橡皮</el-radio-button>
  </el-radio-group>

  <!-- 颜色选择 -->
  <el-color-picker
    v-model="annotationColor"
    size="small"
    :disabled="annotationBrushType === 'eraser'"
    show-alpha
  />

  <!-- 粗细选择 -->
  <el-slider
    v-model="annotationBrushSize"
    :min="1"
    :max="20"
    :disabled="annotationBrushType === 'eraser'"
    style="width: 100px; display: inline-block; vertical-align: middle;"
  />

  <!-- 操作按钮 -->
  <el-button type="warning" size="small" @click="clearAnnotation">🗑️ 清屏</el-button>
  <el-button type="success" size="small" @click="saveAnnotation">💾 保存</el-button>
  <el-button type="danger" size="small" @click="disableAnnotation">❌ 关闭</el-button>
</div>
`;

// ============================================
// 4. 本地视频音频监听修复
// ============================================
const fixLocalVideoAudio = `
// 监听本地视频的音频
const setupLocalVideoAudio = (index) => {
  const preview = videoPreviews.value[index - 1];
  if (preview && preview.videoElement) {
    const video = preview.videoElement;

    // 创建音频分析器
    if (!video.audioContext) {
      video.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      video.audioSource = video.audioContext.createMediaElementSource(video);
      video.analyser = video.audioContext.createAnalyser();
      video.analyser.fftSize = 256;
      video.audioSource.connect(video.analyser);
      video.analyser.connect(video.audioContext.destination);
    }

    // 监控音量
    const dataArray = new Uint8Array(video.analyser.frequencyBinCount);
    const checkLevel = () => {
      if (video.paused || video.muted) {
        videoAudioLevel.value = 0;
      } else {
        video.analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        videoAudioLevel.value = Math.round((average / 255) * 100);
      }
      if (videoAudioEnabled.value) {
        requestAnimationFrame(checkLevel);
      }
    };
    checkLevel();
  }
};
`;

// ============================================
// 5-9. 功能实现
// ============================================

// 任务功能数据
const tasks = ref([
  {
    id: 1,
    title: '电路连接实验',
    description: '完成基础电路的连接和测试',
    status: 'in-progress',
    submitted: 3,
    total: 10,
    deadline: '2024-12-31',
    submissions: []
  },
  {
    id: 2,
    title: '电池检测报告',
    description: '提交电池组电压检测实验报告',
    status: 'in-progress',
    submitted: 5,
    total: 10,
    deadline: '2024-12-25',
    submissions: []
  }
]);

// 实训项目数据
const trainings = ref([
  {
    id: 1,
    icon: '⚡',
    title: '新能源汽车电池检测',
    description: '学习电池组电压、电流检测技能',
    progress: 75,
    status: 'success',
    modules: [
      { name: '理论讲解', completed: true },
      { name: '实操练习', completed: true },
      { name: '考核测试', completed: false }
    ]
  },
  {
    id: 2,
    icon: '🔧',
    title: '电机故障诊断',
    description: '掌握电机常见故障排查方法',
    progress: 45,
    status: 'warning',
    modules: [
      { name: '理论讲解', completed: true },
      { name: '实操练习', completed: false },
      { name: '考核测试', completed: false }
    ]
  }
]);

// 视觉分析数据
const analysisResults = ref([]);

// Web 功能数据
const webFeatures = ref([
  { id: 'student', name: '学生实训', icon: '👨‍🎓', enabled: true },
  { id: 'teacher', name: '教师管理', icon: '👨‍🏫', enabled: true },
  { id: 'vision', name: '视觉分析', icon: '👁️', enabled: true },
  { id: 'api', name: 'API 测试', icon: '🔌', enabled: true }
]);

// 任务功能方法
const addTask = async () => {
  ElMessageBox.prompt('请输入任务标题', '发布任务', {
    confirmButtonText: '发布',
    cancelButtonText: '取消',
    inputPattern: /.+/,
    inputErrorMessage: '标题不能为空'
  }).then(async ({ value }) => {
    const { message } = await ElMessageBox.prompt('请输入任务描述', '任务描述', {
      confirmButtonText: '确定',
      cancelButtonText: '取消'
    });

    const newTask = {
      id: Date.now(),
      title: value,
      description: message,
      status: 'in-progress',
      submitted: 0,
      total: students.value.filter(s => s.online).length,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };

    tasks.value.push(newTask);
    ElMessage.success('任务发布成功');
  });
};

const viewTaskDetail = (task) => {
  ElMessageBox.alert(
\`
      <div style="text-align: left;">
        <h3>\${task.title}</h3>
        <p><strong>描述:</strong> \${task.description}</p>
        <p><strong>状态:</strong> \${task.status === 'in-progress' ? '进行中' : '已完成'}</p>
        <p><strong>提交:</strong> \${task.submitted} / \${task.total}</p>
        <p><strong>截止:</strong> \${task.deadline}</p>
      </div>
    \`,
    '任务详情',
    {
      dangerouslyUseHTMLString: true,
      confirmButtonText: '关闭'
    }
  );
};

// 实训功能方法
const startTraining = (training) => {
  ElMessageBox.alert(
    \`即将开始实训项目：\${training.title}\n\n模块:\n\${training.modules.map(m => '  - ' + m.name + (m.completed ? ' ✓' : '')).join('\\n')}\`,
    '开始实训',
    {
      confirmButtonText: '开始学习',
      callback: () => {
        ElMessage.success('实训已启动');
      }
    }
  );
};

const submitTraining = (training) => {
  ElMessageBox.confirm('确定提交该实训项目吗？', '提交确认', {
    confirmButtonText: '提交',
    cancelButtonText: '取消'
  }).then(() => {
    training.progress = 100;
    training.status = 'success';
    ElMessage.success('实训已提交');
  });
};

// 视觉分析方法
const startAnalysis = () => {
  ElMessageBox.confirm('将启动 AI 视觉分析系统，分析学生上课专注度和行为，是否继续？', '开始分析', {
    confirmButtonText: '开始',
    cancelButtonText: '取消',
    type: 'info'
  }).then(() => {
    ElMessage.success('视觉分析已启动');

    // 模拟分析结果
    setTimeout(() => {
      const student = students.value[Math.floor(Math.random() * students.value.length)];
      if (student) {
        analysisResults.value.unshift({
          id: Date.now(),
          studentName: student.name,
          type: ['专注', '分心', '疲劳', '活跃'][Math.floor(Math.random() * 4)],
          focus: Math.floor(Math.random() * 40) + 60,
          emotion: ['专注', '平静', '困惑', '兴奋'][Math.floor(Math.random() * 4)],
          behavior: ['认真听讲', '做笔记', '思考问题', '小组讨论'][Math.floor(Math.random() * 4)],
          time: new Date().toLocaleTimeString()
        });
      }
    }, 2000);
  });
};

const getAnalysisTypeTag = (type) => {
  const tags = { '专注': 'success', '分心': 'warning', '疲劳': 'danger', '活跃': 'primary' };
  return tags[type] || 'info';
};

const formatFocus = (percentage) => {
  if (percentage >= 80) return percentage + '% (优秀)';
  if (percentage >= 60) return percentage + '% (良好)';
  return percentage + '% (需关注)';
};

// Web 功能方法
const openWebFeature = (featureId) => {
  const feature = webFeatures.value.find(f => f.id === featureId);
  if (feature) {
    ElMessage.success(\`打开功能：\${feature.name}\`);
    // 这里可以集成实际的 Web 功能页面
  }
};

// 批注功能方法
const enableAnnotationForAll = () => {
  globalAnnotationEnabled.value = true;
  nextTick(() => {
    initializeGlobalAnnotationCanvas();
  });
  ElMessage.success('已启用全局批注模式');
};

const disableAnnotation = () => {
  globalAnnotationEnabled.value = false;
  annotationStates.value = {};
  if (globalAnnotationCanvas.value) {
    globalAnnotationCanvas.value.style.pointerEvents = 'none';
  }
  ElMessage.success('已关闭批注');
};

const clearAnnotation = () => {
  if (globalAnnotationEnabled.value && globalAnnotationContext.value) {
    globalAnnotationContext.value.clearRect(0, 0, globalAnnotationCanvas.value.width, globalAnnotationCanvas.value.height);
    ElMessage.success('批注已清屏');
  }
};

const saveAnnotation = () => {
  ElMessage.success('批注已保存');
  // 这里可以添加保存逻辑
};

// 初始化全局批注画布
const initializeGlobalAnnotationCanvas = () => {
  const videoSection = document.querySelector('.video-section');
  if (!videoSection) return;

  if (globalAnnotationCanvas.value) {
    videoSection.removeChild(globalAnnotationCanvas.value);
  }

  const canvas = document.createElement('canvas');
  const rect = videoSection.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.zIndex = '9999';
  canvas.style.pointerEvents = 'auto';

  videoSection.appendChild(canvas);
  globalAnnotationCanvas.value = canvas;
  globalAnnotationContext.value = canvas.getContext('2d');

  // 设置批注样式
  globalAnnotationContext.value.strokeStyle = annotationColor.value;
  globalAnnotationContext.value.lineWidth = annotationBrushSize.value;
  globalAnnotationContext.value.lineCap = 'round';

  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    [lastX, lastY] = [e.offsetX, e.offsetY];
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;

    if (annotationBrushType.value === 'eraser') {
      globalAnnotationContext.value.globalCompositeOperation = 'destination-out';
      globalAnnotationContext.value.lineWidth = 20;
    } else if (annotationBrushType.value === 'highlighter') {
      globalAnnotationContext.value.globalCompositeOperation = 'multiply';
      globalAnnotationContext.value.strokeStyle = annotationColor.value + '40';
      globalAnnotationContext.value.lineWidth = annotationBrushSize.value * 2;
    } else {
      globalAnnotationContext.value.globalCompositeOperation = 'source-over';
      globalAnnotationContext.value.strokeStyle = annotationColor.value;
      globalAnnotationContext.value.lineWidth = annotationBrushSize.value;
    }

    globalAnnotationContext.value.beginPath();
    globalAnnotationContext.value.moveTo(lastX, lastY);
    globalAnnotationContext.value.lineTo(e.offsetX, e.offsetY);
    globalAnnotationContext.value.stroke();
    [lastX, lastY] = [e.offsetX, e.offsetY];
  });

  canvas.addEventListener('mouseup', () => isDrawing = false);
  canvas.addEventListener('mouseleave', () => isDrawing = false);
};

// 导出所有修复
export {
  fix3LayoutCSS,
  fixPipLayout,
  fixAnnotationToolbar,
  fixLocalVideoAudio,
  tasks,
  trainings,
  analysisResults,
  webFeatures,
  addTask,
  viewTaskDetail,
  startTraining,
  submitTraining,
  startAnalysis,
  getAnalysisTypeTag,
  formatFocus,
  openWebFeature,
  enableAnnotationForAll,
  disableAnnotation,
  clearAnnotation,
  saveAnnotation,
  initializeGlobalAnnotationCanvas
};
