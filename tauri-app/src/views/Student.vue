<template>
  <div class="student-window">
    <!-- 强制直播层 -->
    <forced-live-player
      v-if="showForcedLive"
      :teacher-url="liveUrl"
      :teacher-name="teacherInfo.name"
      :live-title="liveTitle"
      :exit-credentials="exitCredentials"
      @connected="onLiveConnected"
      @disconnected="onLiveDisconnected"
      @subtitle-changed="onSubtitleChanged"
      @recording-changed="onRecordingChanged"
    />

    <!-- 标题栏 -->
    <div class="title-bar">
      <div class="title">
        <span class="title-icon">📚</span>
        <span>实训教学实践系统 - 学生端</span>
      </div>
      <div class="window-controls">
        <button class="control-btn" @click="minimize" title="最小化"><span>－</span></button>
        <button class="control-btn" @click="maximize" title="最大化"><span>□</span></button>
        <button class="control-btn close" @click="close" title="关闭"><span>×</span></button>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="main-container">
      <!-- 侧边栏 -->
      <div class="sidebar">
        <div class="logo-section">
          <div class="logo">👨‍🎓</div>
          <div class="logo-text">学生端</div>
        </div>

        <nav class="nav-menu">
          <button
            v-for="item in menuItems"
            :key="item.key"
            :class="['nav-item', { active: activeMenu === item.key }]"
            @click="activeMenu = item.key"
          >
            <span class="icon">{{ item.icon }}</span>
            <span class="text">{{ item.label }}</span>
          </button>
        </nav>

        <div class="user-info">
          <div class="avatar">👤</div>
          <div class="user-details">
            <div class="name">{{ studentInfo.name }}</div>
            <div class="id">{{ studentInfo.id }}</div>
          </div>
        </div>
      </div>

      <!-- 内容区域 -->
      <div class="content-wrapper">
        <!-- 视频区域 -->
        <div class="video-section">
          <div class="video-container">
            <video ref="videoRef" class="video-element" autoplay muted playsinline></video>
            <div class="video-overlay">
              <div class="video-status-bar">
                <span :class="['status-indicator', isConnected ? 'online' : 'offline']"></span>
                <span class="status-text">{{ isConnected ? '已连接' : '未连接' }}</span>
              </div>

              <!-- 控制按钮 - 居中显示 -->
              <div class="video-controls-center">
                <div class="control-btn-group">
                  <button class="control-btn-round" :class="{ active: cameraEnabled }" @click="toggleCamera" title="摄像头">
                    <span class="btn-icon">{{ cameraEnabled ? '📷' : '🚫' }}</span>
                    <span class="btn-label">摄像头</span>
                  </button>

                  <button class="control-btn-round" :class="{ active: micEnabled }" @click="toggleMic" title="麦克风">
                    <span class="btn-icon">{{ micEnabled ? '🎤' : '🔇' }}</span>
                    <span class="btn-label">麦克风</span>
                  </button>

                  <button class="control-btn-round hand-btn" :class="{ active: isHandRaised, raised: isHandRaised }" @click="toggleHand" title="举手">
                    <span class="btn-icon">✋</span>
                    <span class="btn-label">{{ isHandRaised ? '已举手' : '举手' }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 功能面板 -->
        <div class="panel-section">
          <!-- 连接面板 -->
          <div v-if="activeMenu === 'connect'" class="panel-content connect-panel">
            <div class="panel-header">
              <span class="header-icon">🔌</span>
              <h2>连接服务器</h2>
            </div>
            <div class="panel-body">
              <el-form :model="connection" class="connect-form">
                <div class="form-row">
                  <el-form-item label="服务器地址" class="form-col">
                    <el-input v-model="connection.serverIP" placeholder="127.0.0.1" size="default">
                      <template #prefix>🖥️</template>
                    </el-input>
                  </el-form-item>
                  <el-form-item label="端口" class="form-col">
                    <el-input v-model="connection.serverPort" placeholder="8082" size="default">
                      <template #prefix>🔗</template>
                    </el-input>
                  </el-form-item>
                </div>
                <div class="form-row">
                  <el-form-item label="学生 ID" class="form-col">
                    <el-input v-model="connection.studentId" placeholder="S2024001" size="default">
                      <template #prefix>👨‍🎓</template>
                    </el-input>
                  </el-form-item>
                  <el-form-item label="密码" class="form-col">
                    <el-input v-model="connection.password" type="password" placeholder="请输入密码" size="default">
                      <template #prefix>🔒</template>
                    </el-input>
                  </el-form-item>
                </div>
                <div class="form-actions">
                  <el-button
                    type="primary"
                    @click="handleConnect"
                    :loading="connecting"
                    size="default"
                    class="connect-btn"
                  >
                    <span class="btn-icon">{{ isConnected ? '🔌' : '🔗' }}</span>
                    {{ isConnected ? '断开连接' : '连接服务器' }}
                  </el-button>
                </div>
              </el-form>
            </div>
          </div>

          <!-- 远程设置面板 -->
          <div v-if="activeMenu === 'remote'" class="panel-content remote-panel">
            <div class="panel-header">
              <span class="header-icon">🖥️</span>
              <h2>远程桌面设置</h2>
            </div>
            <div class="panel-body">
              <div class="remote-settings">
                <div class="setting-card">
                  <div class="setting-header">
                    <div class="setting-icon">🖥️</div>
                    <div class="setting-info">
                      <div class="setting-title">允许远程桌面</div>
                      <div class="setting-desc">教师可以查看和控制您的桌面</div>
                    </div>
                    <el-switch
                      v-model="remoteSettings.desktopEnabled"
                      active-color="#4ade80"
                      inactive-color="#6b7280"
                      @change="onRemoteDesktopToggle"
                    />
                  </div>
                  <div v-if="remoteSettings.desktopEnabled" class="setting-details">
                    <div class="detail-item">
                      <span class="detail-label">桌面共享状态</span>
                      <span class="detail-value online">🟢 已启用</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">连接密码</span>
                      <span class="detail-value">{{ remoteSettings.desktopPassword }}</span>
                    </div>
                  </div>
                </div>

                <div class="setting-card">
                  <div class="setting-header">
                    <div class="setting-icon">📷</div>
                    <div class="setting-info">
                      <div class="setting-title">允许摄像头共享</div>
                      <div class="setting-desc">教师可以查看您的摄像头画面</div>
                    </div>
                    <el-switch
                      v-model="remoteSettings.cameraEnabled"
                      active-color="#4ade80"
                      inactive-color="#6b7280"
                      @change="onCameraToggle"
                    />
                  </div>
                  <div v-if="remoteSettings.cameraEnabled" class="setting-details">
                    <div class="detail-item">
                      <span class="detail-label">摄像头状态</span>
                      <span class="detail-value online">🟢 已启用</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">当前设备</span>
                      <span class="detail-value">{{ remoteSettings.cameraDevice }}</span>
                    </div>
                  </div>
                </div>

                <div class="setting-card">
                  <div class="setting-header">
                    <div class="setting-icon">🔊</div>
                    <div class="setting-info">
                      <div class="setting-title">允许音频共享</div>
                      <div class="setting-desc">教师可以听到您的麦克风声音</div>
                    </div>
                    <el-switch
                      v-model="remoteSettings.audioEnabled"
                      active-color="#4ade80"
                      inactive-color="#6b7280"
                      @change="onAudioToggle"
                    />
                  </div>
                  <div v-if="remoteSettings.audioEnabled" class="setting-details">
                    <div class="detail-item">
                      <span class="detail-label">麦克风状态</span>
                      <span class="detail-value online">🟢 已启用</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">当前设备</span>
                      <span class="detail-value">{{ remoteSettings.audioDevice }}</span>
                    </div>
                  </div>
                </div>

                <div class="remote-status">
                  <div class="status-header">
                    <span class="status-icon">🔌</span>
                    <span class="status-title">连接状态</span>
                  </div>
                  <div class="status-content">
                    <div class="status-item">
                      <span class="status-label">教师连接</span>
                      <span :class="['status-indicator', isTeacherConnected ? 'connected' : 'disconnected']">
                        {{ isTeacherConnected ? '已连接' : '未连接' }}
                      </span>
                    </div>
                    <div class="status-item">
                      <span class="status-label">连接时长</span>
                      <span class="status-value">{{ connectionDuration }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 任务面板 -->
          <div v-if="activeMenu === 'tasks'" class="panel-content tasks-panel">
            <div class="panel-header">
              <span class="header-icon">📋</span>
              <h2>我的任务</h2>
            </div>
            <div class="panel-body">
              <div class="task-list">
                <div v-for="task in tasks" :key="task.id" class="task-card" :class="{ completed: task.completed }">
                  <div class="task-card-header">
                    <span class="task-icon">{{ task.completed ? '✅' : '📝' }}</span>
                    <div class="task-title">{{ task.title }}</div>
                    <el-tag :type="task.completed ? 'success' : 'warning'" size="small">
                      {{ task.completed ? '已完成' : '进行中' }}
                    </el-tag>
                  </div>
                  <div class="task-desc">{{ task.description }}</div>
                  <div class="task-actions">
                    <el-button
                      v-if="!task.completed"
                      type="primary"
                      size="small"
                      @click="submitTask(task)"
                      class="submit-btn"
                    >
                      📤 提交
                    </el-button>
                    <span v-else class="completed-badge">✓ 已完成</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 聊天面板 -->
          <div v-if="activeMenu === 'chat'" class="panel-content chat-panel">
            <div class="panel-header">
              <span class="header-icon">💬</span>
              <h2>课堂聊天</h2>
            </div>
            <div class="panel-body chat-body">
              <div class="chat-messages" ref="chatMessagesRef">
                <div
                  v-for="(msg, index) in chatMessages"
                  :key="index"
                  :class="['chat-message', msg.fromMe ? 'my-message' : 'other-message']"
                >
                  <div class="message-avatar">{{ msg.fromMe ? '👨‍🎓' : '👩‍🏫' }}</div>
                  <div class="message-body">
                    <div class="message-header">
                      <span class="message-sender">{{ msg.sender }}</span>
                      <span class="message-time">{{ msg.time }}</span>
                    </div>
                    <div class="message-content">{{ msg.content }}</div>
                  </div>
                </div>
              </div>
              <div class="chat-input-area">
                <el-input
                  v-model="newMessage"
                  placeholder="输入消息..."
                  @keyup.enter="sendMessage"
                  size="large"
                  class="message-input"
                >
                  <template #append>
                    <el-button @click="sendMessage" type="primary">
                      📤 发送
                    </el-button>
                  </template>
                </el-input>
              </div>
            </div>
          </div>

          <!-- 记录面板 -->
          <div v-if="activeMenu === 'records'" class="panel-content records-panel">
            <div class="panel-header">
              <span class="header-icon">📊</span>
              <h2>学习记录</h2>
            </div>
            <div class="panel-body">
              <el-table :data="records" stripe style="width: 100%" class="records-table">
                <el-table-column prop="date" label="日期" width="120">
                  <template #default="{ row }">
                    <span class="date-cell">📅 {{ row.date }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="duration" label="时长" width="100">
                  <template #default="{ row }">
                    <span class="duration-cell">⏱️ {{ row.duration }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="tasks" label="完成任务">
                  <template #default="{ row }">
                    <span class="tasks-cell">📝 {{ row.tasks }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="score" label="得分" width="100">
                  <template #default="{ row }">
                    <el-tag :type="getScoreType(row.score)" size="small">
                      🏆 {{ row.score }}分
                    </el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue';
import ForcedLivePlayer from '../components/ForcedLivePlayer.vue';

const activeMenu = ref('connect');
const videoRef = ref(null);
const chatMessagesRef = ref(null);
const isConnected = ref(false);
const connecting = ref(false);
const cameraEnabled = ref(true);
const micEnabled = ref(true);
const isHandRaised = ref(false);
const newMessage = ref('');

// 强制直播相关
const showForcedLive = ref(false);
const liveUrl = ref('');
const liveTitle = ref('');
const teacherInfo = reactive({
  name: '',
  id: ''
});
const exitCredentials = reactive({
  username: 'admin',
  password: 'admin123'
});

// 录制相关
const isRecordingLive = ref(false);
const isRecordingCamera = ref(false);
const recordingLiveTime = ref(0);
const recordingCameraTime = ref(0);
let recordingLiveInterval = null;
let recordingCameraInterval = null;

// 远程桌面相关
const remoteSettings = reactive({
  desktopEnabled: false,
  cameraEnabled: false,
  audioEnabled: false,
  desktopPassword: generatePassword(),
  cameraDevice: '内置摄像头',
  audioDevice: '内置麦克风'
});

const isTeacherConnected = ref(false);
const connectionDuration = ref('00:00:00');
let connectionTimer = null;

const studentInfo = reactive({
  name: '张三',
  id: 'S2024001'
});

const connection = reactive({
  serverIP: '127.0.0.1',
  serverPort: '8082',
  studentId: 'S2024001',
  password: ''
});

const menuItems = [
  { key: 'connect', label: '连接', icon: '🔌' },
  { key: 'remote', label: '远程设置', icon: '🖥️' },
  { key: 'tasks', label: '任务', icon: '📋' },
  { key: 'chat', label: '聊天', icon: '💬' },
  { key: 'records', label: '记录', icon: '📊' }
];

const tasks = ref([
  { id: 1, title: '完成实验一', description: '完成基础电路连接实验', completed: false },
  { id: 2, title: '提交报告', description: '提交实验报告文档', completed: false },
  { id: 3, title: '在线测试', description: '完成章节测试题', completed: true }
]);

const chatMessages = ref([
  { sender: '教师', content: '同学们请注意，今天课程内容是...', time: '10:00', fromMe: false },
  { sender: '李四', content: '老师，我有点不明白', time: '10:05', fromMe: false }
]);

const records = ref([
  { date: '2024-02-28', duration: '45 分钟', tasks: '3 个', score: '95' },
  { date: '2024-02-27', duration: '60 分钟', tasks: '2 个', score: '88' }
]);

const toggleCamera = () => {
  cameraEnabled.value = !cameraEnabled.value;
};

const toggleMic = () => {
  micEnabled.value = !micEnabled.value;
};

const toggleHand = () => {
  isHandRaised.value = !isHandRaised.value;
};

const submitTask = (task) => {
  task.completed = true;
  ElMessage.success('任务已提交');
};

const sendMessage = () => {
  if (!newMessage.value.trim()) return;

  chatMessages.value.push({
    sender: studentInfo.name,
    content: newMessage.value,
    time: new Date().toLocaleTimeString(),
    fromMe: true
  });

  newMessage.value = '';

  nextTick(() => {
    if (chatMessagesRef.value) {
      chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight;
    }
  });
};

import { minimizeWindow, maximizeWindow, closeApp } from '../utils/tauri-api.js';

const minimize = () => {
  minimizeWindow();
};

const maximize = () => {
  maximizeWindow();
};

const close = () => {
  closeApp();
};

const getScoreType = (score) => {
  if (score >= 90) return 'success';
  if (score >= 80) return 'warning';
  return 'danger';
};

// 远程桌面相关方法
const generatePassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

const onRemoteDesktopToggle = (enabled) => {
  if (enabled) {
    remoteSettings.desktopPassword = generatePassword();
    ElMessage.success('远程桌面已启用，教师可以查看您的桌面');
    // 发送启用通知到服务器
    notifyRemoteDesktopChange('desktop', enabled);
  } else {
    ElMessage.info('远程桌面已禁用');
    notifyRemoteDesktopChange('desktop', enabled);
  }
};

const onCameraToggle = (enabled) => {
  if (enabled) {
    ElMessage.success('摄像头共享已启用');
    notifyRemoteDesktopChange('camera', enabled);
  } else {
    ElMessage.info('摄像头共享已禁用');
    notifyRemoteDesktopChange('camera', enabled);
  }
};

const onAudioToggle = (enabled) => {
  if (enabled) {
    ElMessage.success('音频共享已启用');
    notifyRemoteDesktopChange('audio', enabled);
  } else {
    ElMessage.info('音频共享已禁用');
    notifyRemoteDesktopChange('audio', enabled);
  }
};

const notifyRemoteDesktopChange = async (type, enabled) => {
  if (!isConnected.value) return;

  try {
    // 模拟发送到服务器
    console.log(`[Student] 远程${type}状态变更: ${enabled ? '启用' : '禁用'}`);
  } catch (error) {
    console.error('通知服务器失败:', error);
  }
};

const startConnectionTimer = () => {
  if (connectionTimer) return;
  let seconds = 0;
  connectionTimer = setInterval(() => {
    seconds++;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    connectionDuration.value = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, 1000);
};

const stopConnectionTimer = () => {
  if (connectionTimer) {
    clearInterval(connectionTimer);
    connectionTimer = null;
  }
  connectionDuration.value = '00:00:00';
};

// 强制直播相关方法
const onLiveConnected = () => {
  console.log('已连接到教师直播');
  isConnected.value = true;
};

const onLiveDisconnected = () => {
  console.log('与教师直播断开连接');
  isConnected.value = false;
  showForcedLive.value = false;
};

const onSubtitleChanged = (subtitle) => {
  console.log('字幕更新:', subtitle);
};

const onRecordingChanged = (data) => {
  console.log('录制状态改变:', data);
  if (data.type === 'live') {
    isRecordingLive.value = data.isRecording;
    if (data.isRecording) {
      startRecordingTimer('live');
    } else {
      stopRecordingTimer('live');
    }
  } else if (data.type === 'camera') {
    isRecordingCamera.value = data.isRecording;
    if (data.isRecording) {
      startRecordingTimer('camera');
    } else {
      stopRecordingTimer('camera');
    }
  }
};

const startRecordingTimer = (type) => {
  if (type === 'live' && !recordingLiveInterval) {
    recordingLiveInterval = setInterval(() => {
      recordingLiveTime.value++;
    }, 1000);
  } else if (type === 'camera' && !recordingCameraInterval) {
    recordingCameraInterval = setInterval(() => {
      recordingCameraTime.value++;
    }, 1000);
  }
};

const stopRecordingTimer = (type) => {
  if (type === 'live' && recordingLiveInterval) {
    clearInterval(recordingLiveInterval);
    recordingLiveInterval = null;
    recordingLiveTime.value = 0;
  } else if (type === 'camera' && recordingCameraInterval) {
    clearInterval(recordingCameraInterval);
    recordingCameraInterval = null;
    recordingCameraTime.value = 0;
  }
};

const formatTime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const handleConnect = async () => {
  connecting.value = true;

  try {
    setTimeout(() => {
      isConnected.value = !isConnected.value;

      if (isConnected.value) {
        showForcedLive.value = true;
        liveUrl.value = `ws://${connection.serverIP}:${connection.serverPort}/live`;
        liveTitle.value = '教师直播';
        teacherInfo.name = '教师';
        teacherInfo.id = 'T2024001';
        ElMessage.success('连接成功');
      } else {
        ElMessage.info('已断开连接');
      }

      connecting.value = false;
    }, 1000);
  } catch (error) {
    console.error('连接失败:', error);
    connecting.value = false;
    ElMessage.error('连接失败');
  }
};

onMounted(() => {
  return () => {
    stopRecordingTimer('live');
    stopRecordingTimer('camera');
    stopConnectionTimer();
  };
});
</script>

<style lang="scss" scoped>
.student-window {
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.title-bar {
  height: 48px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(20px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  -webkit-app-region: drag;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

  .title {
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 10px;

    .title-icon {
      font-size: 20px;
    }
  }

  .window-controls {
    display: flex;
    gap: 8px;
    -webkit-app-region: no-drag;

    .control-btn {
      width: 36px;
      height: 36px;
      border: none;
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
      border-radius: 8px;
      cursor: pointer;
      font-size: 18px;
      transition: all 0.2s;

      &:hover {
        background: rgba(233, 69, 96, 0.8);
        transform: scale(1.05);
      }

      &.close:hover {
        background: rgba(233, 69, 96, 1);
      }
    }
  }
}

.main-container {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar {
  width: 220px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(255, 255, 255, 0.1);

  .logo-section {
    padding: 30px 20px;
    text-align: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);

    .logo {
      font-size: 56px;
      margin-bottom: 10px;
    }

    .logo-text {
      color: #fff;
      font-size: 18px;
      font-weight: 600;
    }
  }

  .nav-menu {
    flex: 1;
    padding: 20px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;

    .nav-item {
      display: flex;
      align-items: center;
      padding: 14px 16px;
      gap: 14px;
      border: none;
      background: transparent;
      color: rgba(255, 255, 255, 0.6);
      font-size: 15px;
      cursor: pointer;
      border-radius: 10px;
      transition: all 0.3s;
      font-weight: 500;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
        transform: translateX(5px);
      }

      &.active {
        background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
        color: #fff;
        box-shadow: 0 4px 15px rgba(233, 69, 96, 0.4);

        .icon {
          transform: scale(1.1);
        }
      }

      .icon {
        font-size: 22px;
        transition: transform 0.2s;
      }

      .text {
        flex: 1;
        text-align: left;
      }
    }
  }

  .user-info {
    padding: 20px;
    background: rgba(15, 52, 96, 0.5);
    display: flex;
    align-items: center;
    gap: 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);

    .avatar {
      font-size: 42px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 50%;
      width: 56px;
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .user-details {
      flex: 1;

      .name {
        color: #fff;
        font-size: 15px;
        font-weight: 600;
        margin-bottom: 4px;
      }

      .id {
        color: rgba(255, 255, 255, 0.5);
        font-size: 13px;
      }
    }
  }
}

.content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.video-section {
  flex: 0 0 auto;
  height: 58vh;
  min-height: 320px; // 增加最小高度
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: center;

  .video-container {
    width: 100%;
    max-width: 1100px;
    height: calc(100% - 70px); // 预留 70px 给按钮
    background: #000;
    border-radius: 14px;
    position: relative;
    overflow: visible;
    box-shadow: 0 15px 50px rgba(0, 0, 0, 0.5);

    .video-element {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 14px;
    }

    .video-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 70px; // 底部留出按钮空间
      background: linear-gradient(
        to bottom,
        rgba(0,0,0,0.6) 0%,
        transparent 15%,
        transparent 55%,
        rgba(0,0,0,0.85) 100%
      );
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 16px;
      pointer-events: none;
      border-radius: 14px;

      .video-status-bar {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 14px;
        background: rgba(0, 0, 0, 0.6);
        border-radius: 20px;
        align-self: flex-start;
        backdrop-filter: blur(10px);
        pointer-events: auto;

        .status-indicator {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          animation: pulse 2s infinite;

          &.online {
            background: #4ade80;
            box-shadow: 0 0 15px rgba(74, 222, 128, 0.6);
          }

          &.offline {
            background: #ef4444;
            box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
          }
        }

        .status-text {
          color: #fff;
          font-size: 14px;
          font-weight: 500;
        }
      }

      .video-controls-wrapper {
        position: absolute;
        bottom: -70px; // 在视频容器下方显示
        left: 0;
        right: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        pointer-events: none;

        .video-controls-center {
          display: flex;
          justify-content: center;
          align-items: center;
          pointer-events: auto;

          .control-btn-group {
            display: flex;
            gap: 10px;
            background: rgba(0, 0, 0, 0.8);
            padding: 8px 14px;
            border-radius: 50px;
            backdrop-filter: blur(20px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.1);

            .control-btn-round {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 4px;
              padding: 6px 10px;
              border: 2px solid rgba(255, 255, 255, 0.2);
              background: rgba(255, 255, 255, 0.1);
              color: #fff;
              border-radius: 10px;
              cursor: pointer;
              transition: all 0.3s;
              min-width: 60px;

              &:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
              }

              &.active {
                border-color: #4ade80;
                background: rgba(74, 222, 128, 0.25);
                box-shadow: 0 0 15px rgba(74, 222, 128, 0.3);

                .btn-icon {
                  animation: none;
                }
              }

              &.hand-btn.raised {
                border-color: #e94560;
                background: rgba(233, 69, 96, 0.35);
                box-shadow: 0 0 15px rgba(233, 69, 96, 0.3);

                .btn-icon {
                  animation: wave 1.5s infinite;
                }
              }

              .btn-icon {
                font-size: 20px;
                line-height: 1;
                transition: transform 0.2s;
                display: block;
              }

              .btn-label {
                font-size: 10px;
                color: rgba(255, 255, 255, 0.95);
                font-weight: 500;
                white-space: nowrap;
                text-align: center;
              }
            }
          }
        }
      }
    }
  }
}

.panel-section {
  flex: 1;
  min-height: 0;
  background: rgba(22, 33, 62, 0.95);
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;

  .panel-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;

    .panel-header {
      flex-shrink: 0; // 防止头部被压缩
      padding: 12px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      gap: 12px;

      .header-icon {
        font-size: 28px;
      }

      h2 {
        color: #fff;
        font-size: 18px;
        font-weight: 600;
        margin: 0;
      }
    }

    .panel-body {
      flex: 1;
      padding: 12px 16px;
      overflow-y: auto;
      min-height: 0;

      &::-webkit-scrollbar {
        width: 6px;
      }

      &::-webkit-scrollbar-thumb {
        background: rgba(233, 69, 96, 0.5);
        border-radius: 3px;
      }

      &::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
      }
    }
  }

  .connect-panel {
    .connect-form {
      max-width: 600px;
      margin: 0 auto;

      .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-bottom: 12px;

        .form-col {
          margin-bottom: 0 !important; // 覆盖 el-form-item 默认 margin
        }

        :deep(.el-form-item__label) {
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
          margin-bottom: 4px !important;
        }

        :deep(.el-input__wrapper) {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          padding: 6px 10px;

          .el-input__inner {
            color: #fff;
            font-size: 13px;
          }

          &:focus-within {
            border-color: #e94560;
            box-shadow: 0 0 0 2px rgba(233, 69, 96, 0.2);
          }
        }
      }

      .form-actions {
        margin-top: 16px;
        text-align: center;

        .connect-btn {
          width: 180px;
          height: 38px;
          font-size: 14px;
          font-weight: 600;
          background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
          border: none;
          border-radius: 10px;
          box-shadow: 0 6px 16px rgba(233, 69, 96, 0.4);

          &:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(233, 69, 96, 0.5);
          }

          .btn-icon {
            margin-right: 6px;
            font-size: 16px;
          }
        }
      }
    }
  }

  .tasks-panel {
    .task-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 12px;

      .task-card {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        padding: 14px;
        transition: all 0.3s;

        &:hover {
          background: rgba(255, 255, 255, 0.08);
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
        }

        &.completed {
          border-color: #4ade80;
          background: rgba(74, 222, 128, 0.1);
        }

        .task-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;

          .task-icon {
            font-size: 20px;
          }

          .task-title {
            flex: 1;
            color: #fff;
            font-size: 14px;
            font-weight: 600;
          }
        }

        .task-desc {
          color: rgba(255, 255, 255, 0.6);
          font-size: 13px;
          margin-bottom: 12px;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .task-actions {
          .submit-btn {
            width: 100%;
            border-radius: 6px;
            font-weight: 500;
            font-size: 13px;
            height: 32px;
          }

          .completed-badge {
            color: #4ade80;
            font-size: 13px;
            font-weight: 600;
          }
        }
      }
    }
  }

  .chat-panel {
    .chat-body {
      display: flex;
      flex-direction: column;
      height: 100%;
      max-height: calc(42vh - 50px); // 调整以适应新的视频区域高度
    }

    .chat-messages {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-right: 6px;
      min-height: 0;

      &::-webkit-scrollbar {
        width: 6px;
      }

      &::-webkit-scrollbar-thumb {
        background: rgba(233, 69, 96, 0.5);
        border-radius: 3px;
      }

      .chat-message {
        display: flex;
        gap: 10px;
        max-width: 75%;

        &.my-message {
          align-self: flex-end;
          flex-direction: row-reverse;

          .message-body {
            background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
          }

          .message-header {
            flex-direction: row-reverse;
          }
        }

        &.other-message {
          align-self: flex-start;

          .message-body {
            background: rgba(255, 255, 255, 0.1);
          }
        }

        .message-avatar {
          font-size: 28px;
          width: 36px;
          height: 36px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .message-body {
          padding: 8px 12px;
          border-radius: 12px;
          max-width: 100%;

          .message-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;

            .message-sender {
              color: rgba(255, 255, 255, 0.8);
              font-size: 12px;
              font-weight: 600;
            }

            .message-time {
              color: rgba(255, 255, 255, 0.4);
              font-size: 10px;
            }
          }

          .message-content {
            color: #fff;
            font-size: 13px;
            line-height: 1.4;
            word-break: break-word;
          }
        }
      }
    }

    .chat-input-area {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      flex-shrink: 0;

      .message-input {
        :deep(.el-input__wrapper) {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          padding: 6px 10px;

          .el-input__inner {
            color: #fff;
            font-size: 13px;
          }

          .el-input-group__append {
            background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
            border: none;
            color: #fff;
            font-weight: 600;
            font-size: 13px;
            padding: 8px 14px;

            &:hover {
              background: linear-gradient(135deg, #ff6b6b 0%, #e94560 100%);
            }
          }
        }
      }
    }
  }

  .records-panel {
    .records-table {
      font-size: 13px;

      :deep(.el-table) {
        background: transparent;
        --el-table-tr-bg-color: transparent;
        --el-table-header-bg-color: rgba(255, 255, 255, 0.05);
        --el-table-text-color: rgba(255, 255, 255, 0.8);
        --el-table-header-text-color: rgba(255, 255, 255, 0.6);
        --el-table-row-hover-bg-color: rgba(255, 255, 255, 0.05);
        --el-table-border-color: rgba(255, 255, 255, 0.1);
        font-size: 13px;
      }

      .date-cell, .duration-cell, .tasks-cell {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
      }
    }
  }

  .remote-panel {
    .remote-settings {
      display: flex;
      flex-direction: column;
      gap: 16px;

      .setting-card {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        overflow: hidden;
        transition: all 0.3s;

        &:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .setting-header {
          display: flex;
          align-items: center;
          padding: 14px 16px;
          gap: 12px;

          .setting-icon {
            font-size: 28px;
            width: 48px;
            height: 48px;
            background: rgba(233, 69, 96, 0.2);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .setting-info {
            flex: 1;

            .setting-title {
              color: #fff;
              font-size: 15px;
              font-weight: 600;
              margin-bottom: 2px;
            }

            .setting-desc {
              color: rgba(255, 255, 255, 0.5);
              font-size: 12px;
            }
          }

          :deep(.el-switch) {
            --el-switch-on-color: #4ade80;
            --el-switch-off-color: #6b7280;
          }
        }

        .setting-details {
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.2);
          display: flex;
          gap: 24px;

          .detail-item {
            display: flex;
            flex-direction: column;
            gap: 4px;

            .detail-label {
              color: rgba(255, 255, 255, 0.5);
              font-size: 12px;
            }

            .detail-value {
              color: #fff;
              font-size: 13px;
              font-weight: 500;

              &.online {
                color: #4ade80;
              }
            }
          }
        }
      }

      .remote-status {
        background: rgba(74, 222, 128, 0.1);
        border: 1px solid rgba(74, 222, 128, 0.3);
        border-radius: 12px;
        padding: 16px;

        .status-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;

          .status-icon {
            font-size: 20px;
          }

          .status-title {
            color: #fff;
            font-size: 15px;
            font-weight: 600;
          }
        }

        .status-content {
          display: flex;
          gap: 24px;

          .status-item {
            display: flex;
            flex-direction: column;
            gap: 4px;

            .status-label {
              color: rgba(255, 255, 255, 0.5);
              font-size: 12px;
            }

            .status-indicator {
              font-size: 13px;
              font-weight: 600;
              padding: 4px 12px;
              border-radius: 20px;

              &.connected {
                background: rgba(74, 222, 128, 0.2);
                color: #4ade80;
              }

              &.disconnected {
                background: rgba(239, 68, 68, 0.2);
                color: #ef4444;
              }
            }

            .status-value {
              color: #fff;
              font-size: 14px;
              font-weight: 600;
            }
          }
        }
      }
    }
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.1);
  }
}

@keyframes wave {
  0%, 100% {
    transform: rotate(0deg) scale(1);
  }
  25% {
    transform: rotate(-25deg) scale(1.1);
  }
  50% {
    transform: rotate(0deg) scale(1);
  }
  75% {
    transform: rotate(25deg) scale(1.1);
  }
}
</style>
