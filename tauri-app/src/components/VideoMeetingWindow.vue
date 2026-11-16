<template>
  <div class="video-meeting-window">
    <!-- 标题栏 -->
    <div class="title-bar">
      <div class="window-title">
        <span v-if="isMeetingActive">{{ currentMeeting.name }}</span>
        <span v-else>视频会议</span>
      </div>
      <div class="window-spacer"></div>
      <div class="window-controls">
        <button class="window-btn close" @click="handleClose">
          <el-icon><Close /></el-icon>
        </button>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="main-content">
      <!-- 会话前状态：创建/加入会议 -->
      <div v-if="!isMeetingActive" class="meeting-entry">
        <div class="entry-container">
          <div class="entry-tabs">
            <button
              :class="['entry-tab', { active: entryMode === 'create' }]"
              @click="entryMode = 'create'"
            >
              创建会议
            </button>
            <button
              :class="['entry-tab', { active: entryMode === 'join' }]"
              @click="entryMode = 'join'"
            >
              加入会议
            </button>
            <button
              :class="['entry-tab', { active: entryMode === 'schedule' }]"
              @click="entryMode = 'schedule'"
            >
              预约会议
            </button>
          </div>

          <!-- 创建会议 -->
          <div v-if="entryMode === 'create'" class="entry-form">
            <div class="form-group">
              <label>会议名称</label>
              <input v-model="newMeetingName" placeholder="输入会议名称" />
            </div>
            <div class="form-group">
              <label>会议密码（可选）</label>
              <input v-model="newMeetingPassword" type="password" placeholder="设置会议密码" />
            </div>
            <div class="form-group checkbox">
              <input v-model="requirePassword" type="checkbox" id="require-pwd" />
              <label for="require-pwd">启用密码</label>
            </div>
            <button class="submit-btn" @click="createMeeting">创建并开始</button>
          </div>

          <!-- 加入会议 -->
          <div v-if="entryMode === 'join'" class="entry-form">
            <div class="form-group">
              <label>会议ID</label>
              <input v-model="joinMeetingId" placeholder="输入会议ID" />
            </div>
            <div class="form-group">
              <label>会议密码</label>
              <input v-model="joinMeetingPassword" type="password" placeholder="输入会议密码" />
            </div>
            <div class="form-group checkbox">
              <input v-model="saveMeetingInfo" type="checkbox" id="save-info" />
              <label for="save-info">记住会议信息</label>
            </div>
            <button class="submit-btn" @click="joinMeeting">加入会议</button>
          </div>

          <!-- 预约会议 -->
          <div v-if="entryMode === 'schedule'" class="entry-form">
            <div class="form-group">
              <label>会议名称</label>
              <input v-model="scheduleMeetingName" placeholder="输入会议名称" />
            </div>
            <div class="form-group">
              <label>会议日期</label>
              <input v-model="scheduleMeetingDate" type="date" />
            </div>
            <div class="form-group">
              <label>会议时间</label>
              <input v-model="scheduleMeetingTime" type="time" />
            </div>
            <div class="form-group">
              <label>会议密码（可选）</label>
              <input v-model="scheduleMeetingPassword" type="password" placeholder="设置会议密码" />
            </div>
            <div class="form-group checkbox">
              <input v-model="scheduleRequirePassword" type="checkbox" id="schedule-pwd" />
              <label for="schedule-pwd">启用密码</label>
            </div>
            <button class="submit-btn" @click="scheduleMeeting">预约会议</button>
          </div>

          <!-- 预约会议列表 -->
          <div class="scheduled-list">
            <div class="section-header">
              <span class="section-title">预约会议</span>
            </div>
            <div v-if="scheduledMeetings.length === 0" class="empty-state">
              暂无预约会议
            </div>
            <div v-else class="meeting-list">
              <div
                v-for="meeting in scheduledMeetings"
                :key="meeting.id"
                class="meeting-item"
              >
                <div class="meeting-info">
                  <div class="meeting-name">{{ meeting.name }}</div>
                  <div class="meeting-time">
                    {{ formatDate(meeting.scheduledTime) }} {{ meeting.scheduledTime.split('T')[1]?.slice(0, 5) }}
                  </div>
                </div>
                <div class="meeting-status">
                  <span :class="['status-badge', meeting.status]">{{ getMeetingStatusText(meeting.status) }}</span>
                </div>
                <div class="meeting-actions">
                  <button v-if="meeting.status === 'upcoming'" class="action-btn primary" @click="joinScheduledMeeting(meeting)">
                    加入
                  </button>
                  <button class="action-btn danger" @click="cancelScheduledMeeting(meeting)">
                    取消
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 会议进行中状态 -->
      <div v-else class="meeting-active">
        <!-- 视频网格区域 -->
        <div class="video-grid-container">
          <div class="video-grid" :class="`grid-${videoGridLayout}`">
            <!-- 本地视频 -->
            <div class="video-item local">
              <div class="video-placeholder">
                <el-icon><User /></el-icon>
                <span>我 (教师)</span>
              </div>
              <div class="video-status-badge online">在线</div>
            </div>

            <!-- 远程视频 -->
            <div
              v-for="participant in remoteParticipants"
              :key="participant.id"
              class="video-item"
              :class="{
                muted: participant.muted,
                speaking: participant.speaking,
                'video-disabled': !participant.videoEnabled
              }"
              :data-participant-id="participant.id"
            >
              <!-- 视频元素 -->
              <video
                v-if="participant.stream && participant.videoEnabled"
                ref="remoteVideoElements"
                autoplay
                playsinline
                :muted="participant.muted"
                @loadedmetadata="onVideoLoaded(participant.id)"
                @play="onVideoPlay(participant.id)"
              ></video>

              <!-- 视频占位符（视频关闭时显示） -->
              <div v-else class="video-placeholder">
                <el-icon><User /></el-icon>
                <span>{{ participant.name }}</span>
              </div>

              <div class="video-status-badge" :class="participant.status">
                {{ getStatusText(participant.status) }}
              </div>
              <div v-if="participant.muted" class="mute-indicator">
                <el-icon><VideoPause /></el-icon>
              </div>
              <div v-if="!participant.videoEnabled" class="video-disabled-indicator">
                <el-icon><VideoCamera /></el-icon>
              </div>
            </div>
          </div>
        </div>

        <!-- 侧边栏控制面板 -->
        <div class="side-panel">
          <!-- 会议信息 -->
          <div class="panel-section">
            <div class="panel-title">会议信息</div>
            <div class="meeting-info-card">
              <div class="info-row">
                <span class="info-label">会议名称：</span>
                <span class="info-value">{{ currentMeeting.name }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">会议ID：</span>
                <span class="info-value meeting-id">{{ currentMeeting.id }}</span>
                <button class="copy-btn" @click="copyMeetingId">
                  <el-icon><CopyDocument /></el-icon>
                </button>
              </div>
              <div class="info-row">
                <span class="info-label">会议时长：</span>
                <span class="info-value">{{ meetingDuration }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">参会人数：</span>
                <span class="info-value">{{ localParticipants.length + remoteParticipants.length }}/{{ maxParticipants + 1 }}</span>
              </div>
            </div>
          </div>

          <!-- 互动模式 -->
          <div class="panel-section">
            <div class="panel-title">互动模式</div>
            <div class="mode-buttons">
              <button
                :class="['mode-btn', { active: meetingMode === 'video' }]"
                @click="setMeetingMode('video')"
              >
                <el-icon><VideoCamera /></el-icon>
                <span>视频互动</span>
              </button>
              <button
                :class="['mode-btn', { active: meetingMode === 'screen' }]"
                @click="setMeetingMode('screen')"
              >
                <el-icon><Monitor /></el-icon>
                <span>屏幕共享</span>
              </button>
            </div>
          </div>

          <!-- 屏幕共享远程控制 -->
          <div v-if="meetingMode === 'screen'" class="panel-section">
            <div class="panel-title">屏幕控制</div>
            <button
              class="remote-control-btn"
              :disabled="!isRemoteControlEnabled"
              @click="toggleRemoteControl"
            >
              <el-icon><Monitor /></el-icon>
              <span>{{ isRemoteControlActive ? '停止远程控制' : '发起远程控制' }}</span>
            </button>
          </div>

          <!-- 参会者列表 -->
          <div class="panel-section">
            <div class="panel-title">
              <span>远程参会</span>
              <span class="count">{{ remoteParticipants.length }}/{{ maxParticipants }}</span>
            </div>
            <!-- 测试按钮 -->
            <div class="test-controls">
              <button class="test-btn" @click="addParticipant">
                <el-icon><User /></el-icon>
                <span>模拟加入</span>
              </button>
            </div>
            <div class="participants-list">
              <div
                v-for="participant in remoteParticipants"
                :key="participant.id"
                class="participant-item"
              >
                <div class="participant-avatar">
                  <el-icon><User /></el-icon>
                </div>
                <div class="participant-info">
                  <div class="participant-name">{{ participant.name }}</div>
                  <div class="participant-status" :class="participant.status">
                    {{ getStatusText(participant.status) }}
                  </div>
                </div>
                <div class="participant-actions">
                  <button
                    class="action-btn-small"
                    @click="toggleMute(participant)"
                    :title="participant.muted ? '取消静音' : '静音'"
                  >
                    <el-icon>
                      <Microphone v-if="!participant.muted" />
                      <VideoPause v-else />
                    </el-icon>
                  </button>
                  <button
                    class="action-btn-small"
                    @click="toggleVideo(participant)"
                    :title="participant.videoEnabled ? '关闭视频' : '开启视频'"
                  >
                    <el-icon><VideoCamera /></el-icon>
                  </button>
                  <button
                    class="action-btn-small danger"
                    @click="removeParticipant(participant)"
                    title="移除参会者"
                  >
                    <el-icon><VideoStop /></el-icon>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 📝 会议纪要 -->
          <div class="panel-section meeting-notes-section">
            <div class="panel-title">
              <span>会议纪要</span>
              <el-tag v-if="meetingNotes.length > 0" size="small" type="success">{{ meetingNotes.length }}条</el-tag>
            </div>

            <!-- 会议记录控制 -->
            <div class="meeting-notes-controls">
              <button
                class="notes-control-btn"
                :class="{ active: isRecordingNotes }"
                @click="toggleMeetingNotesRecording"
                :disabled="!isMeetingActive"
              >
                <el-icon><Microphone v-if="!isRecordingNotes" /><VideoStop v-else /></el-icon>
                <span>{{ isRecordingNotes ? '停止记录' : '开始记录' }}</span>
              </button>
            </div>

            <!-- 会议记录列表 -->
            <div class="meeting-notes-list" v-if="meetingNotes.length > 0">
              <div
                v-for="(note, index) in meetingNotes"
                :key="index"
                class="note-item"
              >
                <div class="note-header">
                  <span class="note-time">{{ formatNoteTime(note.timestamp) }}</span>
                  <span class="note-speaker">{{ note.speaker || '未知' }}</span>
                </div>
                <div class="note-content">{{ note.content }}</div>
              </div>
            </div>
            <div v-else class="empty-notes">
              <el-empty description="暂无会议记录" :image-size="80" />
            </div>

            <!-- 导出按钮 -->
            <div class="meeting-notes-actions" v-if="meetingNotes.length > 0">
              <button class="export-btn" @click="exportMeetingNotes('txt')">
                <el-icon><Document /></el-icon>
                <span>导出TXT</span>
              </button>
              <button class="export-btn" @click="exportMeetingNotes('json')">
                <el-icon><Files /></el-icon>
                <span>导出JSON</span>
              </button>
            </div>
          </div>

          <!-- 邀请按钮 -->
          <div class="panel-section">
            <button class="invite-btn" @click="inviteParticipants">
              <el-icon><CopyDocument /></el-icon>
              <span>复制邀请信息</span>
            </button>
          </div>

          <!-- 会议控制 -->
          <div class="panel-section controls">
            <div class="control-row">
              <button
                class="control-btn"
                :class="{ recording: isRecording }"
                :disabled="!isMeetingActive"
                @click="toggleRecord"
              >
                <el-icon><VideoCamera /></el-icon>
                <span>{{ isRecording ? '停止录制' : '开始录制' }}</span>
              </button>
            </div>
            <button
              class="control-btn end-meeting"
              @click="toggleMeeting"
            >
              <el-icon><VideoStop /></el-icon>
              <span>结束会议</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { SpeechRecognizer, isAsrSupported } from '@/services/asr';
import { ref, computed, watch, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { VideoCamera, User, Monitor, Microphone, VideoStop, VideoPause, CopyDocument, Close, Document, Files } from '@/components/icons';
import webrtcService from '@/services/webrtcService';
import meetingStatsService from '@/services/meetingStats';

// 入口模式：create = 创建会议, join = 加入会议, schedule = 预约会议
const entryMode = ref('create');

// 创建会议表单
const newMeetingName = ref('');
const newMeetingPassword = ref('');
const requirePassword = ref(false);

// 加入会议表单
const joinMeetingId = ref('');
const joinMeetingPassword = ref('');
const saveMeetingInfo = ref(false);

// 预约会议表单
const scheduleMeetingName = ref('');
const scheduleMeetingDate = ref('');
const scheduleMeetingTime = ref('');
const scheduleMeetingPassword = ref('');
const scheduleRequirePassword = ref(false);

// 会议模式：video = 视频互动, screen = 屏幕共享
const meetingMode = ref('video');

// 会议状态
const isMeetingActive = ref(false);
const isRecording = ref(false);
const isRemoteControlEnabled = ref(true);
const isRemoteControlActive = ref(false);

// WebRTC 连接状态
const isWebRTCConnected = ref(false);
const webRTCInitializing = ref(false);

// 屏幕共享状态
const screenShareStream = ref(null);
const isScreenSharing = ref(false);

// 录制状态
const mediaRecorder = null;
const recordedChunks = [];
const recordedBlob = ref(null);

// 📝 会议记录状态
const isRecordingNotes = ref(false);
const meetingNotes = ref([]);
let speechRecognition = null;

// 自动布局计算属性 - 根据参会人数自动调整
const videoGridLayout = computed(() => {
  const totalParticipants = localParticipants.value.length + remoteParticipants.value.length;

  // 根据总人数返回网格布局
  if (totalParticipants <= 1) return 1;      // 1格：1x1
  if (totalParticipants <= 4) return 2;      // 4格：2x2
  if (totalParticipants <= 9) return 3;      // 9格：3x3
  if (totalParticipants <= 16) return 4;     // 16格：4x4
  if (totalParticipants <= 25) return 5;     // 25格：5x5
  if (totalParticipants <= 36) return 6;     // 36格：6x6
  return 7;                                    // 49格：7x7（最大支持49人）
});

// 最大参会人数
const maxParticipants = 10;

// 当前会议信息
const currentMeeting = ref({
  id: '',
  name: '',
  password: '',
  createdBy: ''
});

// 预约会议列表
const scheduledMeetings = ref([
  {
    id: 'MTG-2024-001',
    name: '实训示教会议',
    scheduledTime: '2024-12-20T14:00',
    password: '123456',
    status: 'upcoming'
  }
]);

// 本地参会者
const localParticipants = ref([
  { id: 'local-1', name: '我 (教师)', status: 'online' }
]);

// 远程参会者（模拟数据）
const remoteParticipants = ref([
  { id: 'remote-1', name: '推车-01', status: 'online', muted: false, speaking: false, videoEnabled: true },
  { id: 'remote-2', name: '推车-02', status: 'online', muted: false, speaking: false, videoEnabled: true },
  { id: 'remote-3', name: '推车-03', status: 'offline', muted: true, speaking: false, videoEnabled: true }
]);

// 🎯 视频元素引用
const remoteVideoElements = ref([]);

// 🎯 视频加载完成处理
const onVideoLoaded = (participantId) => {
  const participant = remoteParticipants.value.find(p => p.id === participantId);
  if (participant && participant.stream) {
    const videoElement = remoteVideoElements.value.find((el, index) =>
      remoteParticipants.value[index]?.id === participantId
    );
    if (videoElement) {
      videoElement.srcObject = participant.stream;
      console.log(`[视频会议] ${participant.name} 视频元素已加载`);
    }
  }
};

// 🎯 视频播放处理
const onVideoPlay = (participantId) => {
  console.log(`[视频会议] 参会者 ${participantId} 视频开始播放`);
};

// 添加参会者
const addParticipant = () => {
  const existingCount = remoteParticipants.value.length;
  if (existingCount >= maxParticipants) {
    ElMessage.warning(`已达到最大参会人数限制（${maxParticipants}人）`);
    return;
  }

  const newParticipant = {
    id: `remote-${Date.now()}`,
    name: `推车-${String(existingCount + 1).padStart(2, '0')}`,
    status: 'online',
    muted: false,
    speaking: false,
    videoEnabled: true
  };

  remoteParticipants.value.push(newParticipant);

  // 记录统计（模拟）
  meetingStatsService.logParticipantJoin(newParticipant);

  ElMessage.success(`${newParticipant.name} 已加入会议`);
};

// 移除参会者
const removeParticipant = (participant) => {
  const index = remoteParticipants.value.findIndex(p => p.id === participant.id);
  if (index !== -1) {
    remoteParticipants.value.splice(index, 1);

    // 记录统计
    meetingStatsService.logParticipantLeave(participant.id);

    ElMessage.info(`${participant.name} 已离开会议`);
  }
};

// 切换视频开关（是否显示视频画面）
const toggleVideo = (participant) => {
  participant.videoEnabled = !participant.videoEnabled;
  console.log(`[视频会议] ${participant.name} 视频画面${participant.videoEnabled ? '已开启' : '已关闭'}`);

  // 🎯 关联到视频显示区域：通过视频元素控制显示/隐藏
  if (participant.stream) {
    const videoElement = document.querySelector(`[data-participant-id="${participant.id}"] video`);
    if (videoElement) {
      if (participant.videoEnabled) {
        videoElement.style.display = 'block';
        console.log(`[视频会议] 已显示 ${participant.name} 的视频画面`);
      } else {
        videoElement.style.display = 'none';
        console.log(`[视频会议] 已隐藏 ${participant.name} 的视频画面`);
      }
    }
  }

  // 通过 WebRTC 发送视频状态变化
  if (webrtcService.connected) {
    webrtcService.broadcastData({
      type: 'video-state-change',
      participantId: participant.id,
      videoEnabled: participant.videoEnabled
    });
  }

  ElMessage.success(`${participant.name} 视频${participant.videoEnabled ? '已开启' : '已关闭'}`);
};

// 会议时长
const meetingStartTime = ref(null);
const meetingDuration = computed(() => {
  if (!meetingStartTime.value) return '00:00:00';
  const diff = Date.now() - meetingStartTime.value;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
});

// 自动布局切换监听
let lastLayout = 1;
watch(videoGridLayout, (newLayout) => {
  if (isMeetingActive.value && newLayout !== lastLayout) {
    const layoutNames = {
      1: '1格',
      2: '4格',
      3: '9格',
      4: '16格',
      5: '25格',
      6: '36格',
      7: '49格'
    };
    const layoutName = layoutNames[newLayout] || `${newLayout}格`;
    console.log(`[视频会议] 自动布局切换: ${layoutName}`);
    ElMessage.success(`参会人数变化，自动切换到${layoutName}布局`);
    lastLayout = newLayout;
  }
});

// 关闭窗口
const handleClose = () => {
  if (isMeetingActive.value) {
    ElMessage.warning('会议正在进行中，请先结束会议');
    return;
  }
  window.dispatchEvent(new CustomEvent('close-video-meeting'));
};

// 生成会议ID
const generateMeetingId = () => {
  const prefix = 'MTG';
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${dateStr}-${randomStr}`;
};

// 创建会议
const createMeeting = async () => {
  if (!newMeetingName.value.trim()) {
    ElMessage.warning('请输入会议名称');
    return;
  }

  try {
    webRTCInitializing.value = true;

    // 初始化 WebRTC 服务
    await webrtcService.initialize('ws://localhost:8080/webrtc');

    // 获取本地媒体流
    await webrtcService.getLocalStream({ video: true, audio: true });

    const meetingId = generateMeetingId();
    currentMeeting.value = {
      id: meetingId,
      name: newMeetingName.value,
      password: requirePassword.value ? newMeetingPassword.value : '',
      createdBy: 'local'
    };

    // 加入会议
    await webrtcService.joinMeeting(currentMeeting.value);

    // 开始统计会话
    meetingStatsService.startSession(currentMeeting.value);

    isMeetingActive.value = true;
    isWebRTCConnected.value = true;
    meetingStartTime.value = Date.now();

    // 设置 WebRTC 回调
    setupWebRTCCallbacks();

    ElMessage.success(`会议已创建\n会议ID：${meetingId}`);

    // 清空表单
    newMeetingName.value = '';
    newMeetingPassword.value = '';
    requirePassword.value = false;
  } catch (error) {
    console.error('[视频会议] 创建会议失败:', error);
    ElMessage.error(`创建会议失败: ${error.message}`);
  } finally {
    webRTCInitializing.value = false;
  }
};

// 加入会议
const joinMeeting = async () => {
  if (!joinMeetingId.value.trim()) {
    ElMessage.warning('请输入会议ID');
    return;
  }

  try {
    webRTCInitializing.value = true;

    // 初始化 WebRTC 服务
    await webrtcService.initialize('ws://localhost:8080/webrtc');

    // 获取本地媒体流
    await webrtcService.getLocalStream({ video: true, audio: true });

    currentMeeting.value = {
      id: joinMeetingId.value,
      name: '远程会议',
      password: joinMeetingPassword.value,
      createdBy: 'remote'
    };

    // 加入会议
    await webrtcService.joinMeeting(currentMeeting.value);

    isMeetingActive.value = true;
    isWebRTCConnected.value = true;
    meetingStartTime.value = Date.now();

    // 设置 WebRTC 回调
    setupWebRTCCallbacks();

    ElMessage.success('已成功加入会议');

    if (saveMeetingInfo.value) {
      localStorage.setItem('lastMeetingId', joinMeetingId.value);
    }
  } catch (error) {
    console.error('[视频会议] 加入会议失败:', error);
    ElMessage.error(`加入会议失败: ${error.message}`);
  } finally {
    webRTCInitializing.value = false;
  }
};

// 预约会议
const scheduleMeeting = () => {
  if (!scheduleMeetingName.value.trim()) {
    ElMessage.warning('请输入会议名称');
    return;
  }
  if (!scheduleMeetingDate.value || !scheduleMeetingTime.value) {
    ElMessage.warning('请选择会议日期和时间');
    return;
  }

  const scheduledTime = `${scheduleMeetingDate.value}T${scheduleMeetingTime.value}`;
  const meetingId = generateMeetingId();

  scheduledMeetings.value.push({
    id: meetingId,
    name: scheduleMeetingName.value,
    scheduledTime,
    password: scheduleRequirePassword.value ? scheduleMeetingPassword.value : '',
    status: 'upcoming'
  });

  ElMessage.success(`会议已预约\n会议ID：${meetingId}\n时间：${formatDate(scheduledTime)}`);

  scheduleMeetingName.value = '';
  scheduleMeetingDate.value = '';
  scheduleMeetingTime.value = '';
  scheduleMeetingPassword.value = '';
  scheduleRequirePassword.value = false;
};

// 加入预约会议
const joinScheduledMeeting = (meeting) => {
  currentMeeting.value = {
    id: meeting.id,
    name: meeting.name,
    password: meeting.password,
    createdBy: 'local'
  };

  isMeetingActive.value = true;
  meetingStartTime.value = Date.now();
  ElMessage.success('已成功加入会议');
};

// 取消预约会议
const cancelScheduledMeeting = (meeting) => {
  const index = scheduledMeetings.value.findIndex(m => m.id === meeting.id);
  if (index !== -1) {
    scheduledMeetings.value.splice(index, 1);
    ElMessage.info('预约会议已取消');
  }
};

// 结束会议
const toggleMeeting = () => {
  // 结束统计会话
  const session = meetingStatsService.endSession();
  if (session) {
    console.log('[视频会议] 会议统计:', meetingStatsService.formatDuration(session.duration));
    meetingStatsService.saveToLocalStorage();
  }

  // 关闭 WebRTC 连接
  webrtcService.closeAll();
  isWebRTCConnected.value = false;

  isMeetingActive.value = false;
  isRecording.value = false;
  isRemoteControlActive.value = false;
  meetingStartTime.value = null;
  currentMeeting.value = { id: '', name: '', password: '', createdBy: '' };

  // 清空远程参会者
  remoteParticipants.value = [];

  ElMessage.info('会议已结束');
};

// 复制会议ID
const copyMeetingId = () => {
  const meetingInfo = `会议ID: ${currentMeeting.value.id}\n会议名称: ${currentMeeting.value.name}`;
  navigator.clipboard.writeText(meetingInfo);
  ElMessage.success('会议信息已复制到剪贴板');
};

// 复制邀请信息
const inviteParticipants = () => {
  const inviteInfo = `邀请您参加视频会议\n会议ID: ${currentMeeting.value.id}\n会议名称: ${currentMeeting.value.name}${currentMeeting.value.password ? `\n会议密码: ${currentMeeting.value.password}` : ''}`;
  navigator.clipboard.writeText(inviteInfo);
  ElMessage.success('邀请信息已复制到剪贴板');
};

// 设置会议模式
const setMeetingMode = async (mode) => {
  if (mode === 'screen' && !isScreenSharing.value) {
    // 切换到屏幕共享模式
    try {
      await startScreenShare();
    } catch (error) {
      console.error('[视频会议] 启动屏幕共享失败:', error);
      ElMessage.error('启动屏幕共享失败');
      return;
    }
  } else if (mode === 'video' && isScreenSharing.value) {
    // 切换到视频模式，停止屏幕共享
    stopScreenShare();
  }

  meetingMode.value = mode;
  ElMessage.success(`已切换到${mode === 'video' ? '视频互动' : '屏幕共享'}模式`);
};

// 开始屏幕共享
const startScreenShare = async () => {
  try {
    console.log('[视频会议] 启动屏幕共享');

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: 'always'
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100
      }
    });

    screenShareStream.value = stream;
    isScreenSharing.value = true;

    // 替换本地视频轨道
    const localStream = webrtcService.getLocalMediaStream();
    if (localStream) {
      const videoTracks = stream.getVideoTracks();
      const peerConnections = webrtcService.peers;

      // 向所有 P2P 连接替换视频轨道
      peerConnections.forEach((pc, peerId) => {
        const senders = pc.getSenders();
        const videoSender = senders.find(sender =>
          sender.track && sender.track.kind === 'video'
        );

        if (videoSender && videoTracks.length > 0) {
          videoSender.replaceTrack(videoTracks[0]);
          console.log('[视频会议] 已替换视频轨道到:', peerId);
        }
      });
    }

    // 监听流结束事件
    stream.getVideoTracks()[0].onended = () => {
      console.log('[视频会议] 屏幕共享已停止');
      stopScreenShare();
    };

    ElMessage.success('屏幕共享已启动');

    // 记录统计
    meetingStatsService.logScreenShare(true);
  } catch (error) {
    console.error('[视频会议] 屏幕共享失败:', error);
    if (error.name === 'NotAllowedError') {
      ElMessage.warning('用户取消了屏幕共享');
    } else {
      throw error;
    }
  }
};

// 停止屏幕共享
const stopScreenShare = () => {
  try {
    console.log('[视频会议] 停止屏幕共享');

    if (screenShareStream.value) {
      screenShareStream.value.getTracks().forEach(track => track.stop());
      screenShareStream.value = null;
    }

    isScreenSharing.value = false;

    // 恢复摄像头视频
    const localStream = webrtcService.getLocalMediaStream();
    if (localStream) {
      const peerConnections = webrtcService.peers;

      peerConnections.forEach((pc, peerId) => {
        const senders = pc.getSenders();
        const videoSender = senders.find(sender =>
          sender.track && sender.track.kind === 'video'
        );

        const cameraTrack = localStream.getVideoTracks()[0];
        if (videoSender && cameraTrack) {
          videoSender.replaceTrack(cameraTrack);
          console.log('[视频会议] 已恢复摄像头视频到:', peerId);
        }
      });
    }

    // 切换回视频模式
    if (meetingMode.value === 'screen') {
      meetingMode.value = 'video';
    }

    ElMessage.info('屏幕共享已停止');

    // 记录统计
    meetingStatsService.logScreenShare(false);
  } catch (error) {
    console.error('[视频会议] 停止屏幕共享失败:', error);
  }
};

// 切换录制
const toggleRecord = async () => {
  if (!isRecording.value) {
    // 开始录制
    await startRecording();
  } else {
    // 停止录制
    stopRecording();
  }
};

// 开始录制
const startRecording = async () => {
  try {
    console.log('[视频会议] 开始录制');

    // 记录统计
    meetingStatsService.logRecordingStart();

    // 创建 MediaStream 用于录制
    const streams = [];

    // 添加本地流
    const localStream = webrtcService.getLocalMediaStream();
    if (localStream) {
      streams.push(localStream);
    }

    // 添加所有远程流
    webrtcService.remoteStreams.forEach((stream, peerId) => {
      streams.push(stream);
    });

    // 合并所有音频轨道（避免音频冲突）
    const audioTracks = streams.flatMap(s => s.getAudioTracks());
    const videoTracks = streams.flatMap(s => s.getVideoTracks());

    // 创建新的 MediaStream（只保留第一个视频轨道，但保留所有音频轨道）
    const combinedStream = new MediaStream([
      ...(videoTracks.length > 0 ? [videoTracks[0]] : []),
      ...audioTracks
    ]);

    // 创建 MediaRecorder
    const options = { mimeType: 'video/webm; codecs=vp9' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'video/webm; codecs=vp8';
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm';
      }
    }

    const recorder = new MediaRecorder(combinedStream, options);
    recordedChunks.length = 0;

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      recordedBlob.value = blob;
      console.log('[视频会议] 录制完成, 大小:', blob.size, 'bytes');
      ElMessage.success(`录制已完成，文件大小: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

      // 记录统计
      meetingStatsService.logRecordingEnd({
        mimeType: blob.type,
        size: blob.size
      });

      // 下载录制文件
      downloadRecording(blob);
    };

    recorder.start(1000); // 每秒收集一次数据
    window.videoMeetingRecorder = recorder;

    isRecording.value = true;
    ElMessage.success('互动录制已开始');
  } catch (error) {
    console.error('[视频会议] 开始录制失败:', error);
    ElMessage.error('开始录制失败');
  }
};

// 停止录制
const stopRecording = () => {
  try {
    console.log('[视频会议] 停止录制');

    const recorder = window.videoMeetingRecorder;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();

      // 记录统计
      meetingStatsService.logRecordingEnd({
        mimeType: recordedBlob.value?.type,
        size: recordedBlob.value?.size
      });
    }

    isRecording.value = false;
    ElMessage.info('互动录制已停止');
  } catch (error) {
    console.error('[视频会议] 停止录制失败:', error);
  }
};

// 下载录制文件
const downloadRecording = (blob) => {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting_${currentMeeting.value.id}_${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('[视频会议] 下载录制失败:', error);
  }
};

// 切换远程控制
const toggleRemoteControl = async () => {
  if (isRemoteControlActive.value) {
    // 停止远程控制
    isRemoteControlActive.value = false;
    ElMessage.info('远程控制已停止');
  } else {
    // 发起远程控制
    try {
      // 发送远程控制请求到所有参会者
      webrtcService.broadcastData({
        type: 'remote-control-request',
        from: webrtcService.participantId,
        timestamp: new Date().toISOString()
      });

      isRemoteControlActive.value = true;
      ElMessage.success('已发起远程控制请求');

      // 记录统计
      meetingStatsService.logRemoteControl(true);
    } catch (error) {
      console.error('[视频会议] 远程控制失败:', error);
      ElMessage.error('发起远程控制失败');
    }
  }
};

// 静音/取消静音（关联到"音频"面板的设置）
const toggleMute = (participant) => {
  participant.muted = !participant.muted;
  console.log(`[视频会议] ${participant.name} 静音状态: ${participant.muted}`);

  // 🎯 关联到"音频"选项：控制音频轨道的启用/禁用
  if (participant.stream) {
    const audioTracks = participant.stream.getAudioTracks();
    audioTracks.forEach(track => {
      track.enabled = !participant.muted;
      console.log(`[视频会议] ${participant.name} 音频轨道${participant.muted ? '已禁用' : '已启用'}`);
    });
  }

  // 🎯 同步到 TeacherWindow 的音频设置
  if (window.teacherWindowAudioSettings) {
    window.teacherWindowAudioSettings.participantMuted = {
      participantId: participant.id,
      muted: participant.muted
    };

    // 发送事件到 TeacherWindow
    window.dispatchEvent(new CustomEvent('video-meeting-audio-state', {
      detail: {
        participantId: participant.id,
        muted: participant.muted
      }
    }));

    console.log('[视频会议] 音频状态已同步到 TeacherWindow');
  }

  // 通过 WebRTC 发送静音状态变化
  if (webrtcService.connected) {
    webrtcService.broadcastData({
      type: 'audio-state-change',
      participantId: participant.id,
      muted: participant.muted
    });
  }

  ElMessage.success(`${participant.name} 已${participant.muted ? '静音' : '取消静音'}`);
};

// 获取状态文本
const getStatusText = (status) => {
  const statusMap = {
    online: '在线',
    offline: '离线',
    connecting: '连接中'
  };
  return statusMap[status] || '未知';
};

// 获取会议状态文本
const getMeetingStatusText = (status) => {
  const statusMap = {
    upcoming: '即将开始',
    ongoing: '进行中',
    ended: '已结束',
    cancelled: '已取消'
  };
  return statusMap[status] || '未知';
};

// 格式化日期
const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 设置 WebRTC 回调
const setupWebRTCCallbacks = () => {
  // 参会者加入回调
  webrtcService.on('participant-join', (participant) => {
    console.log('[视频会议] 参会者加入:', participant);

    // 记录统计
    meetingStatsService.logParticipantJoin(participant);

    // 添加到远程参会者列表
    const newParticipant = {
      id: participant.id,
      name: participant.name || `参会者-${participant.id.slice(-4)}`,
      status: 'online',
      muted: false,
      speaking: false,
      videoEnabled: true
    };

    // 检查是否已存在
    const exists = remoteParticipants.value.find(p => p.id === participant.id);
    if (!exists) {
      remoteParticipants.value.push(newParticipant);
    }
  });

  // 参会者离开回调
  webrtcService.on('participant-leave', (participantId) => {
    console.log('[视频会议] 参会者离开:', participantId);

    // 记录统计
    meetingStatsService.logParticipantLeave(participantId);

    // 从远程参会者列表中移除
    const index = remoteParticipants.value.findIndex(p => p.id === participantId);
    if (index !== -1) {
      const participant = remoteParticipants.value[index];
      remoteParticipants.value.splice(index, 1);
      ElMessage.info(`${participant.name} 已离开会议`);
    }
  });

  // 远程流回调
  webrtcService.on('remote-stream', (peerId, stream) => {
    console.log('[视频会议] 收到远程流:', peerId);

    // 找到对应的参会者并关联流
    const participant = remoteParticipants.value.find(p => p.id === peerId);
    if (participant) {
      participant.stream = stream;

      // 🎯 关联到视频显示区域
      nextTick(() => {
        const videoElement = remoteVideoElements.value.find((el, index) =>
          remoteParticipants.value[index]?.id === peerId
        );
        if (videoElement) {
          videoElement.srcObject = stream;
          console.log(`[视频会议] ${participant.name} 的流已关联到视频元素`);
        }
      });
    }
  });
};

// 加载保存的会议信息
const loadSavedMeetingInfo = () => {
  const lastMeetingId = localStorage.getItem('lastMeetingId');
  if (lastMeetingId) {
    joinMeetingId.value = lastMeetingId;
  }
};

// 📝 会议记录相关方法

// 切换会议记录状态
const toggleMeetingNotesRecording = () => {
  if (isRecordingNotes.value) {
    stopMeetingNotesRecording();
  } else {
    startMeetingNotesRecording();
  }
};

// 开始会议记录
const startMeetingNotesRecording = () => {
  if (!isAsrSupported()) {
    ElMessage.warning('您的浏览器不支持语音识别功能');
    return;
  }

  const SpeechRecognition = SpeechRecognizer;
  speechRecognition = new SpeechRecognition();
  speechRecognition.lang = 'zh-CN';
  speechRecognition.continuous = true;
  speechRecognition.interimResults = false;

  speechRecognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript;
    if (transcript.trim()) {
      addMeetingNote(transcript.trim());
    }
  };

  speechRecognition.onerror = (event) => {
    console.error('[会议记录] 语音识别错误:', event.error);
    if (event.error === 'not-allowed') {
      ElMessage.error('未授权使用麦克风，请检查浏览器权限设置');
      stopMeetingNotesRecording();
    }
  };

  speechRecognition.onend = () => {
    // 如果仍在记录状态，自动重启
    if (isRecordingNotes.value) {
      try {
        speechRecognition.start();
      } catch (e) {
        console.warn('[会议记录] 重启识别失败:', e);
      }
    }
  };

  try {
    speechRecognition.start();
    isRecordingNotes.value = true;
    ElMessage.success('会议记录已开始');
  } catch (e) {
    console.error('[会议记录] 启动失败:', e);
    ElMessage.error('启动会议记录失败');
  }
};

// 停止会议记录
const stopMeetingNotesRecording = () => {
  if (speechRecognition) {
    speechRecognition.stop();
    speechRecognition = null;
  }
  isRecordingNotes.value = false;
  ElMessage.info('会议记录已停止');
};

// 添加会议记录
const addMeetingNote = (content) => {
  const note = {
    timestamp: Date.now(),
    content: content,
    speaker: '教师'
  };
  meetingNotes.value.push(note);
  console.log('[会议记录] 新增记录:', note);
};

// 格式化记录时间
const formatNoteTime = (timestamp) => {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

// 导出会议记录
const exportMeetingNotes = (format) => {
  if (meetingNotes.value.length === 0) {
    ElMessage.warning('暂无会议记录可导出');
    return;
  }

  let content = '';
  let filename = '';
  let mimeType = '';

  if (format === 'txt') {
    content = meetingNotes.value.map(note =>
      `[${formatNoteTime(note.timestamp)}] ${note.speaker}: ${note.content}`
    ).join('\n\n');
    filename = `会议纪要_${new Date().toISOString().slice(0, 10)}.txt`;
    mimeType = 'text/plain;charset=utf-8';
  } else if (format === 'json') {
    content = JSON.stringify(meetingNotes.value, null, 2);
    filename = `会议纪要_${new Date().toISOString().slice(0, 10)}.json`;
    mimeType = 'application/json;charset=utf-8';
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  ElMessage.success(`会议记录已导出为${format.toUpperCase()}格式`);
};

// 初始化
loadSavedMeetingInfo();

// 组件卸载时清理
onUnmounted(() => {
  if (isWebRTCConnected.value) {
    webrtcService.closeAll();
  }
  // 清理会议记录
  if (isRecordingNotes.value) {
    stopMeetingNotesRecording();
  }
});
</script>

<style lang="scss" scoped>
.video-meeting-window {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 95vw;
  height: 95vh;
  max-width: 1600px;
  max-height: 1000px;
  min-width: 800px;
  min-height: 600px;
  display: flex;
  flex-direction: column;
  background: #0D1B2A;
  color: #E0E1DD;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  border: 1px solid #2d3a4f;
  z-index: 9999;
  overflow: hidden;

  /* 超大屏幕优化 */
  @media (min-width: 1920px) {
    max-width: 1800px;
    max-height: 1100px;
  }

  /* 响应式设计 */
  @media (max-width: 1024px) {
    width: 98vw;
    height: 98vh;
    min-width: 600px;
    min-height: 500px;
  }

  @media (max-width: 768px) {
    width: 100vw;
    height: 100vh;
    min-width: auto;
    min-height: auto;
    border-radius: 0;
    top: 0;
    left: 0;
    transform: none;
  }
}

/* 标题栏 */
.title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  background: #141f2e;
  border-bottom: 1px solid #2d3a4f;
  flex-shrink: 0;
  -webkit-app-region: drag;
  padding: 0 16px;

  /* 响应式调整 */
  @media (max-width: 768px) {
    height: 40px;
    padding: 0 12px;
  }

  .window-title {
    font-size: 13px;
    font-weight: 500;
    flex: 1;
    text-align: center;

    /* 响应式调整 */
    @media (max-width: 768px) {
      font-size: 14px;
    }
  }

  .window-spacer {
    width: 32px;
    flex-shrink: 0;

    /* 响应式调整 */
    @media (max-width: 768px) {
      width: 24px;
    }
  }

  .window-controls {
    display: flex;
    -webkit-app-region: no-drag;
    flex-shrink: 0;

    .window-btn {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      color: #E0E1DD;
      cursor: pointer;
      transition: background 0.2s;
      border-radius: 6px;

      &:hover {
        background: rgba(255, 82, 82, 0.2);
        color: #FF5252;
      }

      &:active {
        background: rgba(255, 82, 82, 0.4);
      }

      /* 响应式调整 */
      @media (max-width: 768px) {
        width: 36px;
        height: 36px;
      }

      .el-icon {
        font-size: 14px;

        /* 响应式调整 */
        @media (max-width: 768px) {
          font-size: 16px;
        }
      }

      &.close {
        &:hover {
          background: #FF5252;
          color: white;
        }
      }
    }
  }
}

/* 主内容区 */
.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;

  /* 响应式：小屏幕时改变布局 */
  @media (max-width: 768px) {
    flex-direction: column;
  }
}

/* 会议入口 */
.meeting-entry {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 24px 40px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;

  /* 响应式调整 */
  @media (max-width: 768px) {
    padding: 16px 20px;
  }

  .entry-container {
    width: 100%;
    max-width: 500px;
    background: #141f2e;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    margin: auto 0;

    /* 响应式调整 */
    @media (max-width: 768px) {
      max-width: 100%;
      padding: 16px;
      margin: 0;
    }
  }

    .entry-tabs {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
      margin-bottom: 20px;

      /* 响应式调整 */
      @media (max-width: 768px) {
        gap: 6px;
        margin-bottom: 16px;
      }

      .entry-tab {
        padding: 12px;
        background: #0D1B2A;
        border: 1px solid #415A77;
        border-radius: 6px;
        color: #E0E1DD;
        cursor: pointer;
        transition: all 0.2s;
        font-family: inherit;
        font-size: 13px;

        /* 响应式调整 */
        @media (max-width: 768px) {
          padding: 10px 8px;
          font-size: 12px;
        }

      &:hover {
        background: #415A77;
      }

      &.active {
        background: #4CC9F0;
        color: #0D1B2A;
        border-color: #4CC9F0;
        font-weight: 600;
      }
    }
  }

  .entry-form {
    .form-group {
      margin-bottom: 16px;

      /* 响应式调整 */
      @media (max-width: 768px) {
        margin-bottom: 12px;
      }

      &:last-child {
        margin-bottom: 0;
      }

      label {
        display: block;
        color: #778DA9;
        font-size: 13px;
        margin-bottom: 6px;

        /* 响应式调整 */
        @media (max-width: 768px) {
          font-size: 12px;
          margin-bottom: 4px;
        }
      }

      input[type="text"],
      input[type="password"],
      input[type="date"],
      input[type="time"] {
        width: 100%;
        padding: 12px;
        background: #0D1B2A;
        border: 1px solid #415A77;
        border-radius: 6px;
        color: #E0E1DD;
        font-size: 14px;
        font-family: inherit;

        /* 响应式调整 */
        @media (max-width: 768px) {
          padding: 10px;
          font-size: 13px;
        }

        &::placeholder {
          color: #778DA9;
        }

        &:focus {
          outline: none;
          border-color: #4CC9F0;
        }
      }

      &.checkbox {
        display: flex;
        align-items: center;
        gap: 8px;

        /* 响应式调整 */
        @media (max-width: 768px) {
          gap: 6px;
        }

        input[type="checkbox"] {
          width: 16px;
          height: 16px;
          cursor: pointer;

          /* 响应式调整 */
          @media (max-width: 768px) {
            width: 14px;
            height: 14px;
          }
        }

        label {
          margin-bottom: 0;
          cursor: pointer;
        }
      }
    }

    .submit-btn {
      width: 100%;
      padding: 14px;
      background: #4CC9F0;
      border: none;
      border-radius: 6px;
      color: #0D1B2A;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;
      margin-top: 8px;

      /* 响应式调整 */
      @media (max-width: 768px) {
        padding: 12px;
        font-size: 14px;
        margin-top: 6px;
      }

      &:hover {
        background: #38B6FF;
      }
    }
  }

  .scheduled-list {
    margin-top: 20px;

    .section-header {
      margin-bottom: 12px;

      .section-title {
        color: #E0E1DD;
        font-size: 14px;
        font-weight: 500;
      }
    }

    .empty-state {
      color: #778DA9;
      text-align: center;
      padding: 30px;
      font-size: 13px;
    }

    .meeting-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .meeting-item {
      background: #0D1B2A;
      border-radius: 8px;
      padding: 12px;
      border: 1px solid #2d3a4f;

      .meeting-info {
        margin-bottom: 8px;

        .meeting-name {
          color: #E0E1DD;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 4px;
        }

        .meeting-time {
          color: #778DA9;
          font-size: 11px;
        }
      }

      .meeting-status {
        margin-bottom: 8px;

        .status-badge {
          padding: 3px 8px;
          border-radius: 10px;
          font-size: 11px;

          &.upcoming {
            background: rgba(247, 184, 1, 0.2);
            color: #F7B801;
          }

          &.ongoing {
            background: rgba(76, 201, 240, 0.2);
            color: #4CC9F0;
          }

          &.ended {
            background: rgba(119, 141, 169, 0.2);
            color: #778DA9;
          }

          &.cancelled {
            background: rgba(255, 82, 82, 0.2);
            color: #FF5252;
          }
        }
      }

      .meeting-actions {
        display: flex;
        gap: 8px;

        .action-btn {
          flex: 1;
          padding: 8px;
          border: none;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;

          &.primary {
            background: #4CC9F0;
            color: #0D1B2A;

            &:hover {
              background: #38B6FF;
            }
          }

          &.danger {
            background: #FF5252;
            color: #E0E1DD;

            &:hover {
              background: #E53935;
            }
          }
        }
      }
    }
  }
}

/* 会议进行中 */
.meeting-active {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 视频网格 */
.video-grid-container {
  flex: 1;
  padding: 16px;
  overflow: auto;

  /* 响应式调整 */
  @media (max-width: 768px) {
    padding: 8px;
    flex: 1;
    order: 1;
  }

  .video-grid {
    display: grid;
    gap: 12px;
    height: 100%;

    /* 响应式：自动调整网格列数 */
    @media (max-width: 1024px) {
      gap: 8px;
    }

    @media (max-width: 768px) {
      gap: 6px;
    }

    &.grid-1 {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr;
    }

    &.grid-2 {
      grid-template-columns: repeat(2, 1fr);
      grid-template-rows: repeat(2, 1fr);
    }

    &.grid-3 {
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(3, 1fr);
    }

    &.grid-4 {
      grid-template-columns: repeat(4, 1fr);
      grid-template-rows: repeat(4, 1fr);
    }

    &.grid-5 {
      grid-template-columns: repeat(5, 1fr);
      grid-template-rows: repeat(5, 1fr);
    }

    &.grid-6 {
      grid-template-columns: repeat(6, 1fr);
      grid-template-rows: repeat(6, 1fr);
    }

    &.grid-7 {
      grid-template-columns: repeat(7, 1fr);
      grid-template-rows: repeat(7, 1fr);
    }

    .video-item {
      background: #141f2e;
      border-radius: 8px;
      border: 2px solid #2d3a4f;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
      transition: all 0.2s;

      /* 响应式调整 */
      @media (max-width: 768px) {
        border-width: 1px;
        border-radius: 6px;
      }

      /* 视频元素 */
      video {
        width: 100%;
        height: 100%;
        object-fit: cover;
        position: absolute;
        top: 0;
        left: 0;
        background: #000;
      }

      .video-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        color: #778DA9;
        position: relative;
        z-index: 1;

        .el-icon {
          font-size: 48px;
        }

        span {
          font-size: 14px;
        }

        /* 响应式调整 */
        @media (max-width: 768px) {
          .el-icon {
            font-size: 32px;
          }

          span {
            font-size: 12px;
          }
        }
      }

      &.speaking {
        border-color: #4CC9F0;
      }

      &.muted {
        opacity: 0.8;
      }

      /* 视频禁用状态 */
      &.video-disabled {
        background: #0D1B2A;

        .video-placeholder {
          opacity: 0.5;
        }

        video {
          display: none;
        }
      }

      .video-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        color: #778DA9;

        .el-icon {
          font-size: 48px;
        }

        span {
          font-size: 14px;
        }
      }

      .video-status-badge {
        position: absolute;
        top: 8px;
        left: 8px;
        padding: 3px 8px;
        border-radius: 10px;
        font-size: 11px;
        z-index: 2;

        &.online {
          background: rgba(76, 201, 240, 0.2);
          color: #4CC9F0;
        }

        &.offline {
          background: rgba(119, 141, 169, 0.2);
          color: #778DA9;
        }

        &.connecting {
          background: rgba(247, 184, 1, 0.2);
          color: #F7B801;
        }
      }

      .mute-indicator {
        position: absolute;
        bottom: 8px;
        right: 8px;
        background: rgba(0, 0, 0, 0.7);
        border-radius: 50%;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2;

        .el-icon {
          font-size: 16px;
        }
      }

      /* 视频禁用指示器 */
      .video-disabled-indicator {
        position: absolute;
        bottom: 8px;
        left: 8px;
        background: rgba(255, 82, 82, 0.7);
        border-radius: 50%;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2;

        .el-icon {
          font-size: 16px;
        }
      }

      &.local {
        background: #0D1B2A;
      }
    }
  }
}

/* 侧边栏 */
.side-panel {
  width: 320px;
  background: #141f2e;
  border-left: 1px solid #2d3a4f;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex-shrink: 0;

  /* 响应式调整 */
  @media (max-width: 1024px) {
    width: 280px;
  }

  @media (max-width: 768px) {
    width: 100%;
    height: 35%;
    border-left: none;
    border-top: 1px solid #2d3a4f;
    order: 2;
  }

  .panel-section {
    padding: 16px;
    border-bottom: 1px solid #2d3a4f;

    /* 响应式调整 */
    @media (max-width: 768px) {
      padding: 12px 8px;
    }

    &:last-child {
      border-bottom: none;
    }

    .panel-title {
      color: #E0E1DD;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;

      /* 响应式调整 */
      @media (max-width: 768px) {
        font-size: 13px;
        margin-bottom: 8px;
      }

      .count {
        background: #415A77;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 11px;
      }
    }
  }

  .meeting-info-card {
    background: #0D1B2A;
    border-radius: 8px;
    padding: 12px;

    .info-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;

      &:last-child {
        margin-bottom: 0;
      }

      .info-label {
        color: #778DA9;
        font-size: 12px;
      }

      .info-value {
        color: #E0E1DD;
        font-size: 12px;
        font-weight: 500;

        &.meeting-id {
          font-family: monospace;
          color: #4CC9F0;
        }
      }

      .copy-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px;
        background: #415A77;
        border: none;
        border-radius: 4px;
        color: #E0E1DD;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
          background: #4CC9F0;
          color: #0D1B2A;
        }

        .el-icon {
          font-size: 14px;
        }
      }
    }
  }

  .mode-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;

    /* 响应式调整 */
    @media (max-width: 768px) {
      gap: 6px;
    }

    .mode-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 12px;
      background: #0D1B2A;
      border: 1px solid #2d3a4f;
      border-radius: 6px;
      color: #E0E1DD;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;

      /* 响应式调整 */
      @media (max-width: 768px) {
        padding: 8px;
        gap: 4px;
      }

      &:hover {
        background: #415A77;
      }

      &.active {
        background: #4CC9F0;
        color: #0D1B2A;
        border-color: #4CC9F0;
      }

      .el-icon {
        font-size: 24px;

        /* 响应式调整 */
        @media (max-width: 768px) {
          font-size: 20px;
        }
      }

      span {
        font-size: 11px;

        /* 响应式调整 */
        @media (max-width: 768px) {
          font-size: 10px;
        }
      }
    }
  }

  .remote-control-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    background: #415A77;
    border: none;
    border-radius: 6px;
    color: #E0E1DD;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;

    &:hover:not(:disabled) {
      background: #778DA9;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .test-controls {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;

    .test-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 12px;
      background: #4CC9F0;
      border: none;
      border-radius: 4px;
      color: #0D1B2A;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;
      font-size: 11px;

      &:hover {
        background: #38B6FF;
      }

      .el-icon {
        font-size: 14px;
      }
    }
  }

  .participants-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 300px;
    overflow-y: auto;

    /* 响应式调整 */
    @media (max-width: 768px) {
      max-height: 150px;
      gap: 6px;
    }

    .participant-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px;
      background: #0D1B2A;
      border-radius: 6px;
      border: 1px solid #2d3a4f;

      /* 响应式调整 */
      @media (max-width: 768px) {
        padding: 8px;
        gap: 8px;
      }

      .participant-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #415A77;
        display: flex;
        align-items: center;
        justify-content: center;

        /* 响应式调整 */
        @media (max-width: 768px) {
          width: 28px;
          height: 28px;
        }

        .el-icon {
          font-size: 16px;
          color: #E0E1DD;

          /* 响应式调整 */
          @media (max-width: 768px) {
            font-size: 14px;
          }
        }
      }

      .participant-info {
        flex: 1;

        .participant-name {
          color: #E0E1DD;
          font-size: 12px;
          margin-bottom: 2px;

          /* 响应式调整 */
          @media (max-width: 768px) {
            font-size: 11px;
          }
        }

        .participant-status {
          font-size: 10px;

          /* 响应式调整 */
          @media (max-width: 768px) {
            font-size: 9px;
          }

          &.online {
            color: #4CC9F0;
          }

          &.offline {
            color: #778DA9;
          }

          &.connecting {
            color: #F7B801;
          }
        }
      }

      .participant-actions {
        display: flex;
        gap: 6px;

        .action-btn-small {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background: transparent;
          border: 1px solid #415A77;
          border-radius: 50%;
          color: #E0E1DD;
          cursor: pointer;
          transition: all 0.2s;

          &:hover:not(.danger) {
            background: #415A77;
          }

          &.danger {
            border-color: #FF5252;
            color: #FF5252;

            &:hover {
              background: rgba(255, 82, 82, 0.2);
            }
          }

          .el-icon {
            font-size: 12px;
          }
        }
      }
    }
  }

  /* 📝 会议纪要样式 */
  .meeting-notes-section {
    .meeting-notes-controls {
      margin-bottom: 12px;

      .notes-control-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px;
        background: #415A77;
        border: none;
        border-radius: 6px;
        color: #E0E1DD;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;

        &:hover:not(:disabled) {
          background: #5a7a9a;
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        &.active {
          background: #FF5252;

          &:hover {
            background: #ff6b6b;
          }
        }

        .el-icon {
          font-size: 16px;
        }
      }
    }

    .meeting-notes-list {
      max-height: 250px;
      overflow-y: auto;
      margin-bottom: 12px;

      .note-item {
        padding: 10px;
        background: #0D1B2A;
        border-radius: 6px;
        border: 1px solid #2d3a4f;
        margin-bottom: 8px;

        .note-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;

          .note-time {
            font-size: 11px;
            color: #778DA9;
            font-family: 'Courier New', monospace;
          }

          .note-speaker {
            font-size: 11px;
            color: #4CC9F0;
            font-weight: 500;
          }
        }

        .note-content {
          font-size: 13px;
          color: #E0E1DD;
          line-height: 1.5;
          word-wrap: break-word;
        }
      }
    }

    .empty-notes {
      padding: 20px 0;
    }

    .meeting-notes-actions {
      display: flex;
      gap: 8px;

      .export-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 8px;
        background: #1B263B;
        border: 1px solid #415A77;
        border-radius: 6px;
        color: #E0E1DD;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
          background: #415A77;
        }

        .el-icon {
          font-size: 14px;
        }
      }
    }
  }

  .invite-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    background: #415A77;
    border: none;
    border-radius: 6px;
    color: #E0E1DD;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;

    &:hover {
      background: #778DA9;
    }

    .el-icon {
      font-size: 18px;
    }

    span {
      font-size: 13px;
    }
  }

  .panel-section.controls {
    .control-row {
      margin-bottom: 8px;

      /* 响应式调整 */
      @media (max-width: 768px) {
        margin-bottom: 6px;
      }
    }

    .control-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px;
      background: #0D1B2A;
      border: 1px solid #415A77;
      border-radius: 6px;
      color: #E0E1DD;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;

      /* 响应式调整 */
      @media (max-width: 768px) {
        padding: 10px 8px;
        gap: 6px;
      }

      &:hover:not(:disabled) {
        background: #415A77;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      &.recording {
        background: #F7B801;
        border-color: #F7B801;
        animation: pulse 1.5s ease-in-out infinite;
      }

      &.end-meeting {
        background: #FF5252;
        border-color: #FF5252;

        &:hover {
          background: #E53935;
        }
      }

      .el-icon {
        font-size: 20px;

        /* 响应式调整 */
        @media (max-width: 768px) {
          font-size: 18px;
        }
      }

      span {
        font-size: 13px;

        /* 响应式调整 */
        @media (max-width: 768px) {
          font-size: 12px;
        }
      }
    }
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
</style>
