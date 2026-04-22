<template>
  <div class="web-panel">
    <div class="panel-header">
      <h3 class="panel-title">随堂测试</h3>
    </div>

    <div class="panel-content">
      <div class="web-features-grid">
        <div v-for="feature in webFeatures" :key="feature.id" class="web-feature-card"
          @click="handleFeatureClick(feature)">
          <div class="feature-icon">{{ feature.icon }}</div>
          <div class="feature-title">{{ feature.title }}</div>
          <div class="feature-desc">{{ feature.description }}</div>
        </div>
      </div>
    </div>

    <!-- 投票模态框 -->
    <el-dialog v-model="showWhiteboard" title="在线白板" width="90%" height="85%">
      <div class="whiteboard-toolbar">
        <el-button-group>
          <el-button v-for="color in colors" :key="color" class="color-btn" :style="{ backgroundColor: color }"
            @click="currentColor = color"></el-button>
        </el-button-group>
        <el-select v-model="brushSize" size="small" style="width: 80px; margin-left: 10px;">
          <el-option label="细" :value="2" />
          <el-option label="中" :value="5" />
          <el-option label="粗" :value="10" />
        </el-select>
        <el-button size="small" @click="clearWhiteboard">清空</el-button>
        <el-button size="small" @click="undoWhiteboard">撤销</el-button>

        <!-- 🆕 白板直播按钮 - 直接开始/停止 -->
        <el-button
          size="small"
          :type="isBroadcasting ? 'danger' : 'success'"
          style="margin-left: auto;"
          @click="handleToggleBroadcast"
        >
          {{ isBroadcasting ? '⏹️ 停止直播' : '📡 直播白板' }}
        </el-button>
      </div>
      <div class="whiteboard-container">
        <canvas ref="whiteboardCanvas" class="whiteboard-canvas" @mousedown="startDraw" @mousemove="drawing"
          @mouseup="stopDraw" @mouseleave="stopDraw"></canvas>
      </div>
    </el-dialog>

    <!-- 投票模态框 -->
    <el-dialog v-model="showPoll" title="创建投票" width="650px">
      <div class="poll-container">
        <el-input v-model="pollTitle" placeholder="请输入投票标题" style="margin-bottom: 15px;" />

        <div style="margin-bottom: 15px;">
          <h4>选择参与投票的学生（默认全部在线学生）</h4>
          <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <el-button size="small" @click="selectAllStudentsForPoll">全选</el-button>
            <el-button size="small" @click="clearSelectedStudentsForPoll">清空</el-button>
          </div>
          <el-table :data="onlineStudents" size="small" max-height="150">
            <el-table-column width="40">
              <template #default="{ row }">
                <el-checkbox :checked="selectedStudentsForPoll.includes(row.id)"
                  @change="toggleStudentForPoll(row.id)" />
              </template>
            </el-table-column>
            <el-table-column prop="name" label="姓名" />
            <el-table-column prop="id" label="ID" />
          </el-table>
        </div>

        <div class="poll-options">
          <div v-for="(option, index) in pollOptions" :key="index" class="poll-option">
            <el-input v-model="option.text" :placeholder="`选项${index + 1}`" />
            <el-button v-if="pollOptions.length > 2" @click="removeOption(index)">删除</el-button>
          </div>
        </div>
        <el-button type="primary" @click="addOption">添加选项</el-button>
        <div class="poll-actions">
          <el-button type="primary" @click="startPoll">开始投票</el-button>
          <el-button @click="viewResults">查看结果</el-button>
          <el-button @click="endPoll">结束投票</el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 测验模态框 -->
    <el-dialog v-model="showQuiz" title="在线测验" width="700px">
      <div class="quiz-container">
        <div style="margin-bottom: 15px;">
          <h4>选择参与测验的学生（默认全部在线学生）</h4>
          <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <el-button size="small" @click="selectAllStudentsForQuiz">全选</el-button>
            <el-button size="small" @click="clearSelectedStudentsForQuiz">清空</el-button>
          </div>
          <el-table :data="onlineStudents" size="small" max-height="120">
            <el-table-column width="40">
              <template #default="{ row }">
                <el-checkbox :checked="selectedStudentsForQuiz.includes(row.id)"
                  @change="toggleStudentForQuiz(row.id)" />
              </template>
            </el-table-column>
            <el-table-column prop="name" label="姓名" />
            <el-table-column prop="id" label="ID" />
          </el-table>
        </div>

        <div style="border-top: 1px solid #eee; padding-top: 15px;">
          <div class="quiz-progress">{{ currentQuestionIndex + 1 }} / {{ quizQuestions.length }}</div>
          <div class="quiz-question">
            <h3>{{ quizQuestions[currentQuestionIndex].question }}</h3>
            <el-radio-group v-model="quizAnswers[currentQuestionIndex]">
              <el-radio v-for="(option, index) in quizQuestions[currentQuestionIndex].options" :key="index"
                :label="option">
                {{ option }}
              </el-radio>
            </el-radio-group>
          </div>
          <div class="quiz-actions">
            <el-button v-if="currentQuestionIndex > 0" @click="prevQuestion">上一题</el-button>
            <el-button v-if="currentQuestionIndex < quizQuestions.length - 1" @click="nextQuestion">下一题</el-button>
            <el-button type="primary" @click="startQuiz">开始测验</el-button>
            <el-button @click="viewQuizResults">查看成绩</el-button>
            <el-button @click="endQuiz">结束测验</el-button>
          </div>
        </div>
      </div>
    </el-dialog>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElTable, ElTableColumn, ElTag, ElCheckbox, ElSelect, ElOption } from 'element-plus';
import { useStudentStore } from '@/stores/studentStore';
import { eventBus, EventTypes } from '@/utils/eventBus';

// 打开全屏 Web 窗口
const openFullscreen = () => {
  window.dispatchEvent(new CustomEvent('open-web-window'))
  ElMessage.info('正在打开全屏 Web 窗口...')
}

const emit = defineEmits(['open-feature']);
const studentStore = useStudentStore();

// 获取在线学生列表
const onlineStudents = computed(() => studentStore.students.filter(s => s.online));

const webFeatures = [
  { id: 'poll', icon: '📊', title: '投票', description: '实时投票和问卷调查' },
  { id: 'quiz', icon: '❓', title: '测验', description: '在线测验和自动评分' }
]

// 投票功能
const showPoll = ref(false);
const pollTitle = ref('');
const pollOptions = ref([{ text: '' }, { text: '' }]);
const pollResults = ref([]);
const isPollActive = ref(false);
const selectedStudentsForPoll = ref([]);

const addOption = () => {
  pollOptions.value.push({ text: '' });
};

const removeOption = (index) => {
  pollOptions.value.splice(index, 1);
};

const toggleStudentForPoll = (studentId) => {
  const index = selectedStudentsForPoll.value.indexOf(studentId);
  if (index === -1) {
    selectedStudentsForPoll.value.push(studentId);
  } else {
    selectedStudentsForPoll.value.splice(index, 1);
  }
};

const selectAllStudentsForPoll = () => {
  selectedStudentsForPoll.value = onlineStudents.value.map(s => s.id);
};

const clearSelectedStudentsForPoll = () => {
  selectedStudentsForPoll.value = [];
};

const startPoll = () => {
  if (!pollTitle.value) {
    ElMessage.warning('请输入投票标题');
    return;
  }
  const validOptions = pollOptions.value.filter(o => o.text.trim());
  if (validOptions.length < 2) {
    ElMessage.warning('至少需要2个有效选项');
    return;
  }

  // 选择的学生或所有在线学生
  const targetStudents = selectedStudentsForPoll.value.length > 0
    ? selectedStudentsForPoll.value
    : onlineStudents.value.map(s => s.id);

  // 创建投票数据
  const pollData = {
    id: Date.now().toString(),
    title: pollTitle.value,
    options: validOptions,
    targetStudents,
    createdAt: new Date().toISOString()
  };

  // 发送投票事件到学生端
  eventBus.emit(EventTypes.POLL_CREATED, pollData);
  eventBus.emit(EventTypes.POLL_STARTED, pollData.id);

  isPollActive.value = true;
  pollResults.value = validOptions.map(o => ({ text: o.text, votes: 0, voters: [] }));

  ElMessage.success(`投票已开始，已发送给 ${targetStudents.length} 名学生`);
  showPoll.value = false;
};

const viewResults = () => {
  if (!isPollActive.value) {
    ElMessage.info('暂无投票进行中');
    return;
  }

  const totalVotes = pollResults.value.reduce((sum, r) => sum + r.votes, 0);
  const resultsText = pollResults.value.map(r => `${r.text}: ${r.votes}票 (${totalVotes > 0 ? Math.round(r.votes / totalVotes * 100) : 0}%)`).join('\n');

  ElMessage.info(`投票结果:\n${resultsText}\n\n总票数: ${totalVotes}`);
};

const endPoll = () => {
  if (!isPollActive.value) {
    ElMessage.info('暂无投票进行中');
    return;
  }

  eventBus.emit(EventTypes.POLL_ENDED, { pollId: Date.now().toString() });
  isPollActive.value = false;
  ElMessage.success('投票已结束');
};

// 监听学生投票事件
onMounted(() => {
  eventBus.on(EventTypes.POLL_VOTE, (data) => {
    if (isPollActive.value && pollResults.value.length > 0) {
      const optionIndex = pollResults.value.findIndex(r => r.text === data.option);
      if (optionIndex !== -1 && !pollResults.value[optionIndex].voters.includes(data.studentId)) {
        pollResults.value[optionIndex].votes++;
        pollResults.value[optionIndex].voters.push(data.studentId);
      }
    }
  });
});

// 测验功能
const showQuiz = ref(false);
const quizQuestions = ref([
  { question: 'Vue 3 中用于创建响应式数据的 API 是？', options: ['ref', 'state', 'data', 'observable'], answer: 'ref' },
  { question: '以下哪个不是 JavaScript 的基本数据类型？', options: ['string', 'number', 'array', 'boolean'], answer: 'array' },
  { question: 'CSS 中用于设置弹性布局的属性是？', options: ['display: block', 'display: flex', 'display: inline', 'display: grid'], answer: 'display: flex' },
  { question: 'HTTP 状态码 404 表示？', options: ['服务器错误', '未授权', '资源未找到', '重定向'], answer: '资源未找到' },
  { question: 'Git 中用于创建新分支的命令是？', options: ['git branch', 'git checkout', 'git clone', 'git merge'], answer: 'git branch' }
]);
const quizAnswers = ref({});
const currentQuestionIndex = ref(0);
const isQuizActive = ref(false);
const selectedStudentsForQuiz = ref([]);
const studentScores = ref({});

const prevQuestion = () => {
  if (currentQuestionIndex.value > 0) currentQuestionIndex.value--;
};

const nextQuestion = () => {
  if (currentQuestionIndex.value < quizQuestions.value.length - 1) currentQuestionIndex.value++;
};

const toggleStudentForQuiz = (studentId) => {
  const index = selectedStudentsForQuiz.value.indexOf(studentId);
  if (index === -1) {
    selectedStudentsForQuiz.value.push(studentId);
  } else {
    selectedStudentsForQuiz.value.splice(index, 1);
  }
};

const selectAllStudentsForQuiz = () => {
  selectedStudentsForQuiz.value = onlineStudents.value.map(s => s.id);
};

const clearSelectedStudentsForQuiz = () => {
  selectedStudentsForQuiz.value = [];
};

const startQuiz = () => {
  // 选择的学生或所有在线学生
  const targetStudents = selectedStudentsForQuiz.value.length > 0
    ? selectedStudentsForQuiz.value
    : onlineStudents.value.map(s => s.id);

  // 创建测验数据
  const quizData = {
    id: Date.now().toString(),
    questions: quizQuestions.value,
    targetStudents,
    createdAt: new Date().toISOString()
  };

  // 发送测验事件到学生端
  eventBus.emit(EventTypes.QUIZ_CREATED, quizData);
  eventBus.emit(EventTypes.QUIZ_STARTED, quizData.id);

  isQuizActive.value = true;
  studentScores.value = {};

  ElMessage.success(`测验已开始，已发送给 ${targetStudents.length} 名学生`);
  showQuiz.value = false;
};

const submitQuiz = () => {
  let correct = 0;
  quizQuestions.value.forEach((q, i) => {
    if (quizAnswers.value[i] === q.answer) correct++;
  });
  ElMessage.success(`测验完成！得分：${correct}/${quizQuestions.value.length}`);
  showQuiz.value = false;
};

const viewQuizResults = () => {
  if (!isQuizActive.value) {
    ElMessage.info('暂无测验进行中');
    return;
  }

  const results = Object.entries(studentScores.value).map(([studentId, score]) => {
    const student = studentStore.getStudentById(studentId);
    return `${student?.name || studentId}: ${score}分`;
  });

  if (results.length === 0) {
    ElMessage.info('暂无学生提交答案');
  } else {
    ElMessage.info(`测验成绩:\n${results.join('\n')}`);
  }
};

const endQuiz = () => {
  if (!isQuizActive.value) {
    ElMessage.info('暂无测验进行中');
    return;
  }

  eventBus.emit(EventTypes.QUIZ_ENDED, { quizId: Date.now().toString() });
  isQuizActive.value = false;
  ElMessage.success('测验已结束');
};

// 监听学生答题事件
onMounted(() => {
  eventBus.on(EventTypes.QUIZ_ANSWER, (data) => {
    if (isQuizActive.value && data.quizId) {
      let score = 0;
      quizQuestions.value.forEach((q, i) => {
        if (data.answers[i] === q.answer) score++;
      });
      studentScores.value[data.studentId] = score;
    }
  });
});

// 处理功能点击
const handleFeatureClick = (feature) => {
  emit('open-feature', feature);

  switch (feature.id) {
    case 'poll':
      showPoll.value = true;
      break;
    case 'quiz':
      showQuiz.value = true;
      quizAnswers.value = {};
      currentQuestionIndex.value = 0;
      break;
    default:
      ElMessage.info(`${feature.title}功能开发中`);
  }
};
</script>

<style lang="scss" scoped>
.web-panel {
  display: flex;
  flex-direction: column;
  padding: 12px;
  overflow: hidden;
  flex: 1;
  min-height: 0;
  height: 100%;
}

.panel-header {
  margin-bottom: 10px;
  flex-shrink: 0;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #E0E1DD;
  margin: 0;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

.web-features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.web-feature-card {
  background: #0F2035;
  border-radius: 6px;
  padding: 10px 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  border: 2px solid transparent;

  &:hover {
    border-color: #4CC9F0;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(76, 201, 240, 0.2);
  }

  .feature-icon {
    font-size: 24px;
    margin-bottom: 6px;
  }

  .feature-title {
    color: #E0E1DD;
    font-size: 12px;
    font-weight: 500;
    margin-bottom: 4px;
  }

  .feature-desc {
    color: #778DA9;
    font-size: 10px;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}

/* 浏览器模态框样式 */
.browser-input-container {
  display: flex;
  gap: 10px;
  padding: 20px;
}

/* 白板样式 */
.whiteboard-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #0A1525;
}

.whiteboard-toolbar {
  padding: 10px;
  background: #0F2035;
  border-bottom: 1px solid #2A3F5F;
  display: flex;
  align-items: center;
}

.color-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid #4A90E2;
  margin: 0 2px;
}

.whiteboard-canvas {
  flex: 1;
  cursor: crosshair;
  background: white;
}

/* 日历样式 */
.calendar-container {
  padding: 10px;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.calendar-grid {
  margin-bottom: 20px;
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 5px;
  margin-bottom: 5px;

  span {
    text-align: center;
    font-weight: 600;
    color: #606266;
    font-size: 12px;
  }
}

.calendar-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 5px;
}

.calendar-day {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: #606266;

  &.other-month {
    color: #c0c4cc;
  }

  &.today {
    background: #4CC9F0;
    color: white;
    font-weight: 600;
  }

  &.selected {
    background: #1B263B;
    color: white;
  }

  &:hover:not(.other-month) {
    background: #e4e7ed;
  }
}

.calendar-events {
  padding-top: 15px;
  border-top: 1px solid #e4e7ed;

  h4 {
    margin-bottom: 10px;
    color: #606266;
    font-size: 14px;
  }
}

.calendar-event {
  display: flex;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;

  .event-time {
    color: #4CC9F0;
    font-weight: 600;
    font-size: 12px;
  }

  .event-title {
    color: #606266;
    font-size: 13px;
  }
}

.no-events {
  color: #909399;
  font-size: 13px;
  text-align: center;
  padding: 20px;
}

/* 投票样式 */
.poll-container {
  padding: 10px;
  background: #0A1525;
}

.poll-options {
  margin: 15px 0;
}

.poll-option {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.poll-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

/* 测验样式 */
.quiz-container {
  padding: 10px;
  background: #0A1525;
}

.quiz-progress {
  text-align: right;
  color: #AAAAAA;
  font-size: 13px;
  margin-bottom: 20px;
}

.quiz-question {
  margin-bottom: 20px;

  h3 {
    color: #FFFFFF;
    font-size: 16px;
    margin-bottom: 15px;
  }
}

.quiz-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

/* 聊天样式 */
.chat-container {
  display: flex;
  flex-direction: column;
  height: 400px;
  background: #0A1525;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  background: #0A1525;
}

.chat-message {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;

  &.self {
    flex-direction: row-reverse;

    .message-content {
      background: #4A90E2;
      color: white;
      border-radius: 12px 12px 0 12px;
    }
  }
}

.message-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #2A3F5F;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #AAAAAA;
  flex-shrink: 0;
}

.message-content {
  max-width: 70%;
  padding: 10px 14px;
  background: #0F2035;
  border-radius: 12px 12px 12px 0;
  font-size: 13px;
  color: #FFFFFF;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.chat-input {
  display: flex;
  gap: 10px;
  padding: 10px;
  border-top: 1px solid #2A3F5F;
  background: #0F2035;
}

// 🆕 RTMP 配置对话框样式
.rtmp-config-form {
  background: #0A1525;
  padding: 10px;

  .form-item {
    margin-bottom: 16px;

    label {
      display: block;
      margin-bottom: 8px;
      font-size: 13px;
      color: #FFFFFF;
    }

    .el-input {
      width: 100%;
    }
  }

  .form-tip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: rgba(74, 144, 226, 0.2);
    border-radius: 6px;
    font-size: 12px;
    color: #4A90E2;
  }
}

// 🆕 白板工具栏布局调整
.whiteboard-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: #0F2035;
  border-radius: 8px 8px 0 0;
  flex-wrap: wrap;
}
</style>
