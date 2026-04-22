<template>
  <div class="video-meeting-panel">
    <!-- 会话前状态：创建/加入会议 -->
    <div v-if="!isMeetingActive" class="meeting-entry">
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

      <!-- 历史会议/预约会议列表 -->
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

    <!-- 会议进行中状态 -->
    <div v-else class="meeting-active">
      <!-- 会议信息栏 -->
      <div class="meeting-header">
        <div class="meeting-title-section">
          <div class="meeting-title">{{ currentMeeting.name }}</div>
          <div class="meeting-id-section">
            <span class="meeting-id-label">会议ID：</span>
            <span class="meeting-id">{{ currentMeeting.id }}</span>
            <button class="copy-btn" @click="copyMeetingId">
              <el-icon><CopyDocument /></el-icon>
            </button>
          </div>
        </div>
        <div class="meeting-time-section">
          <span class="time-icon">⏱</span>
          <span class="meeting-time">{{ meetingDuration }}</span>
        </div>
      </div>

      <!-- 会议模式切换 -->
      <div class="mode-switch">
        <div class="mode-label">互动模式</div>
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

      <!-- 屏幕共享模式下的远程控制 -->
      <div v-if="meetingMode === 'screen'" class="remote-control-section">
        <button
          class="remote-control-btn"
          :disabled="!isRemoteControlEnabled"
          @click="toggleRemoteControl"
        >
          <el-icon><Monitor /></el-icon>
          <span>{{ isRemoteControlActive ? '停止远程控制' : '发起远程控制' }}</span>
        </button>
      </div>

      <!-- 本地参会者 -->
      <div class="section">
        <div class="section-header">
          <span class="section-title">本地参会</span>
          <span class="participant-count">{{ localParticipants.length }}</span>
        </div>
        <div class="participants-list">
          <div class="participant-card local">
            <div class="participant-avatar">
              <el-icon><User /></el-icon>
            </div>
            <div class="participant-info">
              <div class="participant-name">我 (教师)</div>
              <div class="participant-status online">在线</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 远程参会者 -->
      <div class="section">
        <div class="section-header">
          <span class="section-title">远程参会</span>
          <span class="participant-count">{{ remoteParticipants.length }}/{{ maxParticipants }}</span>
        </div>
        <div class="participants-list">
          <div
            v-for="participant in remoteParticipants"
            :key="participant.id"
            :class="['participant-card', { muted: participant.muted, speaking: participant.speaking }]"
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
                class="action-btn"
                @click="toggleMute(participant)"
                :title="participant.muted ? '取消静音' : '静音'"
              >
                <el-icon>
                  <Microphone v-if="!participant.muted" />
                  <VideoPause v-else />
                </el-icon>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 会议控制 -->
      <div class="meeting-controls">
        <button
          class="control-btn"
          :class="{ active: isRecording }"
          :disabled="!isMeetingActive"
          @click="toggleRecord"
        >
          <el-icon><VideoCamera /></el-icon>
          <span>{{ isRecording ? '停止录制' : '开始录制' }}</span>
        </button>
        <button
          class="control-btn end-meeting"
          @click="toggleMeeting"
        >
          <el-icon><VideoStop /></el-icon>
          <span>结束会议</span>
        </button>
      </div>

      <!-- 邀请参会者 -->
      <div class="invite-section">
        <button class="invite-btn" @click="inviteParticipants">
          <el-icon><CopyDocument /></el-icon>
          <span>复制邀请信息</span>
        </button>
      </div>

      <!-- 会议详情 -->
      <div class="meeting-details">
        <div class="info-item">
          <span class="info-label">当前模式：</span>
          <span class="info-value">{{ meetingMode === 'video' ? '视频互动' : '屏幕共享' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">参会人数：</span>
          <span class="info-value">{{ localParticipants.length + remoteParticipants.length }}/{{ maxParticipants + 1 }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { VideoCamera, User, Monitor, Microphone, VideoStop, VideoPause, CopyDocument } from '@/components/icons';

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
  { id: 'remote-1', name: '推车-01', status: 'online', muted: false, speaking: false },
  { id: 'remote-2', name: '推车-02', status: 'online', muted: false, speaking: false },
  { id: 'remote-3', name: '推车-03', status: 'offline', muted: true, speaking: false }
]);

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

// 生成会议ID
const generateMeetingId = () => {
  const prefix = 'MTG';
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${dateStr}-${randomStr}`;
};

// 创建会议
const createMeeting = () => {
  if (!newMeetingName.value.trim()) {
    ElMessage.warning('请输入会议名称');
    return;
  }

  const meetingId = generateMeetingId();
  currentMeeting.value = {
    id: meetingId,
    name: newMeetingName.value,
    password: requirePassword.value ? newMeetingPassword.value : '',
    createdBy: 'local'
  };

  isMeetingActive.value = true;
  meetingStartTime.value = Date.now();
  ElMessage.success(`会议已创建\n会议ID：${meetingId}`);

  // 清空表单
  newMeetingName.value = '';
  newMeetingPassword.value = '';
  requirePassword.value = false;
};

// 加入会议
const joinMeeting = () => {
  if (!joinMeetingId.value.trim()) {
    ElMessage.warning('请输入会议ID');
    return;
  }

  // 模拟加入会议（实际应该调用服务器API）
  currentMeeting.value = {
    id: joinMeetingId.value,
    name: '远程会议',
    password: joinMeetingPassword.value,
    createdBy: 'remote'
  };

  isMeetingActive.value = true;
  meetingStartTime.value = Date.now();
  ElMessage.success('已成功加入会议');

  if (saveMeetingInfo.value) {
    localStorage.setItem('lastMeetingId', joinMeetingId.value);
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

  // 清空表单
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
  isMeetingActive.value = false;
  isRecording.value = false;
  isRemoteControlActive.value = false;
  meetingStartTime.value = null;
  currentMeeting.value = { id: '', name: '', password: '', createdBy: '' };
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
const setMeetingMode = (mode) => {
  meetingMode.value = mode;
  ElMessage.success(`已切换到${mode === 'video' ? '视频互动' : '屏幕共享'}模式`);
};

// 切换录制
const toggleRecord = () => {
  isRecording.value = !isRecording.value;
  ElMessage[isRecording.value ? 'success' : 'info'](
    isRecording.value ? '互动录制已开始' : '互动录制已停止'
  );
};

// 切换远程控制
const toggleRemoteControl = () => {
  isRemoteControlActive.value = !isRemoteControlActive.value;
  ElMessage.success(
    isRemoteControlActive.value ? '远程控制已开启' : '远程控制已停止'
  );
};

// 静音/取消静音
const toggleMute = (participant) => {
  participant.muted = !participant.muted;
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

// 加载保存的会议信息
const loadSavedMeetingInfo = () => {
  const lastMeetingId = localStorage.getItem('lastMeetingId');
  if (lastMeetingId) {
    joinMeetingId.value = lastMeetingId;
  }
};

// 初始化
loadSavedMeetingInfo();
</script>

<style lang="scss" scoped>
.video-meeting-panel {
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

/* 会议入口 */
.meeting-entry {
  .entry-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    margin-bottom: 12px;

    .entry-tab {
      padding: 10px;
      background: #0D1B2A;
      border: 1px solid #415A77;
      border-radius: 6px;
      color: #E0E1DD;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;
      font-size: 13px;

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
    background: #0D1B2A;
    border-radius: 8px;
    padding: 16px;

    .form-group {
      margin-bottom: 12px;

      &:last-child {
        margin-bottom: 0;
      }

      label {
        display: block;
        color: #778DA9;
        font-size: 12px;
        margin-bottom: 6px;
      }

      input[type="text"],
      input[type="password"],
      input[type="date"],
      input[type="time"] {
        width: 100%;
        padding: 10px 12px;
        background: #141f2e;
        border: 1px solid #415A77;
        border-radius: 6px;
        color: #E0E1DD;
        font-size: 13px;
        font-family: inherit;

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

        input[type="checkbox"] {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }

        label {
          margin-bottom: 0;
          cursor: pointer;
        }
      }
    }

    .submit-btn {
      width: 100%;
      padding: 12px;
      background: #4CC9F0;
      border: none;
      border-radius: 6px;
      color: #0D1B2A;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;

      &:hover {
        background: #38B6FF;
      }
    }
  }

  .scheduled-list {
    background: #0D1B2A;
    border-radius: 8px;
    padding: 12px;

    .section-header {
      margin-bottom: 12px;

      .section-title {
        color: #E0E1DD;
        font-size: 13px;
        font-weight: 500;
      }
    }

    .empty-state {
      color: #778DA9;
      text-align: center;
      padding: 20px;
      font-size: 12px;
    }

    .meeting-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .meeting-item {
      background: #141f2e;
      border-radius: 6px;
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
          padding: 2px 8px;
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
          padding: 6px 12px;
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
  .meeting-header {
    background: #0D1B2A;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 4px;

    .meeting-title-section {
      margin-bottom: 8px;

      .meeting-title {
        color: #E0E1DD;
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 6px;
      }

      .meeting-id-section {
        display: flex;
        align-items: center;
        gap: 8px;

        .meeting-id-label {
          color: #778DA9;
          font-size: 11px;
        }

        .meeting-id {
          color: #4CC9F0;
          font-size: 13px;
          font-weight: 500;
          font-family: monospace;
        }

        .copy-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px 6px;
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

    .meeting-time-section {
      display: flex;
      align-items: center;
      gap: 6px;

      .time-icon {
        font-size: 16px;
      }

      .meeting-time {
        color: #E0E1DD;
        font-size: 14px;
        font-weight: 500;
        font-family: monospace;
      }
    }
  }

  .mode-switch {
    background: #0D1B2A;
    border-radius: 8px;
    padding: 12px;

    .mode-label {
      color: #778DA9;
      font-size: 12px;
      margin-bottom: 8px;
    }

    .mode-buttons {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .mode-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 12px;
      background: #141f2e;
      border: 1px solid #2d3a4f;
      border-radius: 6px;
      color: #E0E1DD;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;

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
      }

      span {
        font-size: 12px;
      }
    }
  }

  .remote-control-section {
    margin-top: 4px;

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
  }

  .section {
    background: #0D1B2A;
    border-radius: 8px;
    padding: 12px;

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;

      .section-title {
        color: #E0E1DD;
        font-size: 13px;
        font-weight: 500;
      }

      .participant-count {
        background: #415A77;
        color: #E0E1DD;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 11px;
      }
    }

    .participants-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
  }

  .participant-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    background: #141f2e;
    border-radius: 6px;
    border: 1px solid transparent;

    &.speaking {
      border-color: #4CC9F0;
      background: rgba(76, 201, 240, 0.1);
    }

    &.muted {
      opacity: 0.7;
    }

    .participant-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #415A77;
      display: flex;
      align-items: center;
      justify-content: center;

      .el-icon {
        font-size: 18px;
        color: #E0E1DD;
      }
    }

    .participant-info {
      flex: 1;

      .participant-name {
        color: #E0E1DD;
        font-size: 13px;
        margin-bottom: 2px;
      }

      .participant-status {
        font-size: 11px;

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
      .action-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        background: transparent;
        border: 1px solid #415A77;
        border-radius: 50%;
        color: #E0E1DD;
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

  .meeting-controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;

    .control-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 12px;
      background: #0D1B2A;
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

      &.active {
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
        font-size: 24px;
      }

      span {
        font-size: 12px;
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

  .invite-section {
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
  }

  .meeting-details {
    background: #0D1B2A;
    border-radius: 8px;
    padding: 12px;

    .info-item {
      display: flex;
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
      }
    }
  }
}
</style>
