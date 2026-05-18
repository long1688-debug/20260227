<template>
  <div class="subtitle-panel">
    <!-- AI语音功能切换标签 -->
    <div class="function-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab-btn', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        <el-icon><component :is="tab.icon" /></el-icon>
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <!-- 实时字幕功能 -->
    <div v-if="activeTab === 'realtime'" class="tab-content">
      <div class="status-section">
        <div class="status-item">
          <span class="status-label">状态：</span>
          <span :class="['status-value', subtitleEnabled ? 'active' : 'inactive']">
            {{ subtitleEnabled ? '已开启' : '已关闭' }}
          </span>
        </div>
        <button
          :class="['toggle-btn', { active: subtitleEnabled }]"
          @click="toggleSubtitle"
        >
          <el-icon><component :is="subtitleEnabled ? VideoPause : VideoPlay" /></el-icon>
          <span>{{ subtitleEnabled ? '关闭字幕' : '开启字幕' }}</span>
        </button>
      </div>

      <div class="settings-section">
        <div class="section-title">识别设置</div>
        <div class="setting-item">
          <label>识别语言</label>
          <select v-model="subtitleLanguage">
            <option value="zh-CN">中文</option>
            <option value="en-US">英文</option>
            <option value="zh-CN+en-US">中英混合</option>
          </select>
        </div>
        <div class="setting-item">
          <label>识别模型</label>
          <select v-model="subtitleModel">
            <option value="whisper-tiny">Whisper Tiny（快速）</option>
            <option value="whisper-base">Whisper Base</option>
            <option value="whisper-small">Whisper Small</option>
            <option value="whisper-medium">Whisper Medium（精准）</option>
          </select>
        </div>
      </div>

      <div class="current-subtitle">
        <div class="section-title">当前字幕</div>
        <div class="subtitle-display">
          <span v-if="currentSubtitleText">{{ currentSubtitleText }}</span>
          <span v-else class="placeholder">等待语音输入...</span>
        </div>
      </div>

      <div class="subtitle-stats">
        <div class="stat-item">
          <div class="stat-label">已生成字幕</div>
          <div class="stat-value">{{ subtitleCount }} 条</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">录制时长</div>
          <div class="stat-value">{{ formatDuration(totalDuration) }}</div>
        </div>
      </div>
    </div>

    <!-- 视频生成字幕功能 -->
    <div v-if="activeTab === 'video'" class="tab-content">
      <div class="section-title">选择视频源</div>
      <div class="video-source-list">
        <div
          v-for="video in videoSources"
          :key="video.id"
          :class="['video-source-item', { selected: selectedVideo?.id === video.id }]"
          @click="selectedVideo = video"
        >
          <div class="source-name">{{ video.name }}</div>
          <div class="source-type">{{ video.type }}</div>
        </div>
      </div>

      <div class="settings-section">
        <div class="section-title">生成设置</div>
        <div class="setting-item">
          <label>识别语言</label>
          <select v-model="videoSubtitleLanguage">
            <option value="zh-CN">中文</option>
            <option value="en-US">英文</option>
            <option value="zh-CN+en-US">中英混合</option>
          </select>
        </div>
        <div class="setting-item">
          <label>识别模型</label>
          <select v-model="videoSubtitleModel">
            <option value="whisper-tiny">Whisper Tiny（快速）</option>
            <option value="whisper-base">Whisper Base</option>
            <option value="whisper-small">Whisper Small</option>
            <option value="whisper-medium">Whisper Medium（精准）</option>
          </select>
        </div>
      </div>

      <div class="action-section">
        <button
          class="action-btn primary"
          :disabled="!selectedVideo || isGenerating"
          @click="startGenerateSubtitle"
        >
          <el-icon><VideoPlay v-if="!isGenerating" /><Loading v-else /></el-icon>
          <span>{{ isGenerating ? '生成中...' : '开始生成字幕' }}</span>
        </button>
      </div>

      <div v-if="generatedSubtitles.length > 0" class="result-section">
        <div class="section-title">生成结果</div>
        <div class="subtitle-preview">
          <div
            v-for="(subtitle, index) in generatedSubtitles.slice(0, 5)"
            :key="index"
            class="subtitle-item"
          >
            <div class="subtitle-time">{{ subtitle.startTime }}</div>
            <div class="subtitle-text">{{ subtitle.text }}</div>
          </div>
        </div>
        <div class="result-actions">
          <button class="action-btn" @click="viewFullSubtitles">查看全部</button>
          <button class="action-btn" @click="importSubtitles">导入到编辑器</button>
        </div>
      </div>
    </div>

    <!-- 字幕管理功能 -->
    <div v-if="activeTab === 'manage'" class="tab-content">
      <div class="filter-section">
        <div class="filter-row">
          <label>搜索字幕</label>
          <input
            v-model="searchText"
            placeholder="输入关键词搜索..."
            @input="filterSubtitles"
          />
        </div>
        <div class="filter-row">
          <label>日期范围</label>
          <input type="date" v-model="startDate" />
          <span>至</span>
          <input type="date" v-model="endDate" />
        </div>
      </div>

      <div class="subtitle-list">
        <div
          v-for="subtitle in filteredSubtitles.slice(0, 50)"
          :key="subtitle.id"
          class="subtitle-list-item"
          @click="editSubtitle(subtitle)"
        >
          <div class="list-time">{{ subtitle.startTime }}</div>
          <div class="list-text">{{ subtitle.text }}</div>
          <div class="list-actions">
            <button class="icon-btn" @click.stop="editSubtitle(subtitle)" title="编辑">
              <el-icon><Edit /></el-icon>
            </button>
            <button class="icon-btn" @click.stop="deleteSubtitle(subtitle)" title="删除">
              <el-icon><Delete /></el-icon>
            </button>
          </div>
        </div>
        <div v-if="filteredSubtitles.length === 0" class="empty-state">
          暂无字幕数据
        </div>
      </div>

      <div class="batch-actions">
        <button class="action-btn" @click="exportSubtitles">
          <el-icon><Download /></el-icon>
          <span>导出字幕</span>
        </button>
        <button class="action-btn danger" @click="clearAllSubtitles">
          <el-icon><Delete /></el-icon>
          <span>清空全部</span>
        </button>
      </div>
    </div>

    <!-- 语音助手功能 -->
    <div v-if="activeTab === 'voice'" class="tab-content">
      <!-- 唤醒词设置 -->
      <div class="settings-section">
        <div class="section-title">唤醒词设置</div>
        <div class="input-group">
          <label>当前唤醒词：</label>
          <div class="wake-word-display">{{ wakeWord }}</div>
        </div>
        <div class="input-group">
          <label>修改唤醒词：</label>
          <input
            v-model="newWakeWord"
            placeholder="输入新的唤醒词"
            @keyup.enter="updateWakeWord"
          />
          <button class="btn-small" @click="updateWakeWord">确定</button>
        </div>
      </div>

      <!-- 语音命令列表 -->
      <div class="section-title">支持的命令</div>
      <div class="command-list">
        <div
          v-for="command in voiceCommands"
          :key="command.id"
          class="command-item"
        >
          <div class="command-icon">
            <el-icon><component :is="command.icon" /></el-icon>
          </div>
          <div class="command-info">
            <div class="command-phrase">「{{ command.phrase }}」</div>
            <div class="command-desc">{{ command.description }}</div>
          </div>
          <div class="command-status">
            <span v-if="lastCommand === command.id" class="status-badge success">已执行</span>
          </div>
        </div>
      </div>

      <!-- 最近执行的命令 -->
      <div class="section-title" style="margin-top: 16px;">最近命令</div>
      <div v-if="recentCommands.length === 0" class="empty-state">
        暂无执行记录
      </div>
      <div v-else class="recent-list">
        <div
          v-for="(cmd, index) in recentCommands"
          :key="index"
          class="recent-item"
        >
          <div class="recent-time">{{ cmd.time }}</div>
          <div class="recent-cmd">{{ cmd.command }}</div>
          <div :class="['recent-result', cmd.success ? 'success' : 'error']">
            {{ cmd.success ? '成功' : '失败' }}
          </div>
        </div>
      </div>

      <!-- 快捷操作 -->
      <div class="action-section">
        <button class="action-btn" @click="toggleListening">
          <el-icon><VideoPlay v-if="!isListening" /><VideoStop v-else /></el-icon>
          <span>{{ isListening ? '停止监听' : '开始监听' }}</span>
        </button>
        <button class="action-btn" @click="clearHistory">
          <el-icon><Delete /></el-icon>
          <span>清空记录</span>
        </button>
      </div>
    </div>

    <!-- 字幕编辑对话框 -->
    <div v-if="showEditDialog" class="dialog-overlay" @click.self="showEditDialog = false">
      <div class="dialog">
        <div class="dialog-header">
          <div class="dialog-title">编辑字幕</div>
          <button class="dialog-close" @click="showEditDialog = false">
            <el-icon><Close /></el-icon>
          </button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>开始时间</label>
            <input v-model="editingSubtitle.startTime" type="text" />
          </div>
          <div class="form-group">
            <label>结束时间</label>
            <input v-model="editingSubtitle.endTime" type="text" />
          </div>
          <div class="form-group">
            <label>字幕内容</label>
            <textarea v-model="editingSubtitle.text" rows="3"></textarea>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="dialog-btn" @click="showEditDialog = false">取消</button>
          <button class="dialog-btn primary" @click="saveSubtitle">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import {
  VideoPlay, VideoPause, VideoStop, Loading, Edit, Delete, Download, Close,
  Microphone, VideoCamera, Document, Grid, Monitor
} from '@/components/icons';

// 标签页
const tabs = [
  { id: 'voice', label: '语音助手', icon: Microphone },
  { id: 'realtime', label: '实时字幕', icon: Microphone },
  { id: 'video', label: '视频转字幕', icon: VideoCamera },
  { id: 'manage', label: '字幕管理', icon: Document }
];
const activeTab = ref('voice');

// 实时字幕
const subtitleEnabled = ref(false);
const subtitleLanguage = ref('zh-CN');
const subtitleModel = ref('whisper-base');
const currentSubtitleText = ref('');
const subtitleCount = ref(0);
const totalDuration = ref(0);

// 视频生成字幕
const selectedVideo = ref(null);
const videoSources = ref([]);
const videoSubtitleLanguage = ref('zh-CN');
const videoSubtitleModel = ref('whisper-base');
const isGenerating = ref(false);
const generatedSubtitles = ref([]);

// 字幕管理
const searchText = ref('');
const startDate = ref('');
const endDate = ref('');
const filteredSubtitles = ref([]);
const showEditDialog = ref(false);
const editingSubtitle = ref({
  id: '',
  startTime: '',
  endTime: '',
  text: ''
});

// 语音助手
const isListening = ref(false);
const wakeWord = ref('小助手');
const newWakeWord = ref('');
const lastCommand = ref(null);
const recentCommands = ref([]);

// 语音命令列表
const voiceCommands = [
  {
    id: 'start-stream',
    phrase: '开始直播',
    description: '启动直播推流',
    icon: VideoPlay
  },
  {
    id: 'stop-stream',
    phrase: '停止直播',
    description: '停止直播推流',
    icon: VideoPause
  },
  {
    id: 'start-recording',
    phrase: '开始录制',
    description: '启动本地录制',
    icon: VideoCamera
  },
  {
    id: 'pause-recording',
    phrase: '暂停录制',
    description: '暂停录制',
    icon: VideoPause
  },
  {
    id: 'stop-recording',
    phrase: '停止录制',
    description: '停止本地录制',
    icon: VideoPause
  },
  {
    id: 'next-layout',
    phrase: '切换下一个场景',
    description: '切换到下一个布局',
    icon: Grid
  },
  {
    id: 'show-desktop',
    phrase: '展示桌面',
    description: '共享屏幕/桌面',
    icon: Monitor
  },
  {
    id: 'return-teaching',
    phrase: '返回示教',
    description: '返回示教模式',
    icon: Document
  },
  {
    id: 'quick-record',
    phrase: '一键录制',
    description: '快速开始录制',
    icon: VideoCamera
  }
];

// 切换字幕开关
const toggleSubtitle = () => {
  subtitleEnabled.value = !subtitleEnabled.value;
  if (subtitleEnabled.value) {
    window.dispatchEvent(new CustomEvent('start-asr'));
    ElMessage.success('实时字幕已开启');
  } else {
    window.dispatchEvent(new CustomEvent('stop-asr'));
    ElMessage.info('实时字幕已关闭');
  }
};

// 开始生成字幕
const startGenerateSubtitle = () => {
  if (!selectedVideo.value) {
    ElMessage.warning('请选择视频源');
    return;
  }

  isGenerating.value = true;
  ElMessage.info('开始生成字幕...');

  setTimeout(() => {
    isGenerating.value = false;
    generatedSubtitles.value = [
      { id: 1, startTime: '00:00:01', endTime: '00:00:03', text: '欢迎大家来到本次课程' },
      { id: 2, startTime: '00:00:04', endTime: '00:00:06', text: '今天我们学习的是' },
      { id: 3, startTime: '00:00:07', endTime: '00:00:10', text: '人工智能的基本概念' }
    ];
    ElMessage.success('字幕生成完成');
  }, 2000);
};

// 查看全部字幕
const viewFullSubtitles = () => {
  activeTab.value = 'manage';
};

// 导入字幕
const importSubtitles = () => {
  ElMessage.success('字幕已导入到编辑器');
};

// 编辑字幕
const editSubtitle = (subtitle) => {
  editingSubtitle.value = { ...subtitle };
  showEditDialog.value = true;
};

// 保存字幕
const saveSubtitle = () => {
  showEditDialog.value = false;
  ElMessage.success('字幕已保存');
};

// 删除字幕
const deleteSubtitle = (subtitle) => {
  const index = filteredSubtitles.value.findIndex(s => s.id === subtitle.id);
  if (index !== -1) {
    filteredSubtitles.value.splice(index, 1);
    ElMessage.success('字幕已删除');
  }
};

// 过滤字幕
const filterSubtitles = () => {
  filteredSubtitles.value = [...filteredSubtitles.value];
};

// 导出字幕
const exportSubtitles = () => {
  ElMessage.success('字幕已导出');
};

// 清空全部字幕
const clearAllSubtitles = () => {
  filteredSubtitles.value = [];
  ElMessage.success('所有字幕已清空');
};

// 更新唤醒词
const updateWakeWord = () => {
  if (!newWakeWord.value.trim()) {
    ElMessage.warning('请输入新的唤醒词');
    return;
  }
  wakeWord.value = newWakeWord.value.trim();
  newWakeWord.value = '';
  ElMessage.success(`唤醒词已更新为「${wakeWord.value}」`);
  localStorage.setItem('voiceWakeWord', wakeWord.value);
  window.dispatchEvent(new CustomEvent('voice-wake-word-changed', { detail: { wakeWord: wakeWord.value } }));
};

// 切换监听
const toggleListening = () => {
  isListening.value = !isListening.value;
  if (isListening.value) {
    window.dispatchEvent(new CustomEvent('voice-start-listening'));
    ElMessage.success('语音监听已启动，说「' + wakeWord.value + '」唤醒');
  } else {
    window.dispatchEvent(new CustomEvent('voice-stop-listening'));
    ElMessage.info('语音监听已停止');
  }
};

// 清空历史记录
const clearHistory = () => {
  recentCommands.value = [];
  ElMessage.info('历史记录已清空');
};

// 格式化时长
const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};
</script>

<style lang="scss" scoped>
.subtitle-panel {
  display: flex;
  flex-direction: column;
  padding: 4px;
  overflow: hidden;
  flex: 1;
  min-height: 0;
  height: 100%;
}

/* 功能标签 */
.function-tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 12px;
  background: #0D1B2A;
  border-radius: 8px;
  flex-shrink: 0;

  .tab-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px;
    background: #141f2e;
    border: 1px solid #2d3a4f;
    border-radius: 6px;
    color: #778DA9;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;

    &:hover {
      background: #415A77;
      color: #E0E1DD;
    }

    &.active {
      background: #4CC9F0;
      color: #0D1B2A;
      border-color: #4CC9F0;

      .el-icon {
        color: #0D1B2A;
      }
    }

    .el-icon {
      font-size: 20px;
    }

    span {
      font-size: 11px;
    }
  }
}

.tab-content {
  flex: 1;
  background: #0D1B2A;
  border-radius: 8px;
  padding: 12px;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

.section-title {
  color: #E0E1DD;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 10px;
}

/* 实时字幕 */
.status-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #141f2e;
  border-radius: 6px;
  margin-bottom: 12px;

  .status-item {
    display: flex;
    align-items: center;
    gap: 8px;

    .status-label {
      color: #778DA9;
      font-size: 12px;
    }

    .status-value {
      font-size: 12px;
      font-weight: 500;

      &.active {
        color: #4CC9F0;
      }

      &.inactive {
        color: #778DA9;
      }
    }
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: #415A77;
    border: none;
    border-radius: 6px;
    color: #E0E1DD;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
    font-size: 12px;

    &:hover {
      background: #778DA9;
    }

    &.active {
      background: #4CC9F0;
      color: #0D1B2A;
    }

    .el-icon {
      font-size: 16px;
    }
  }
}

.settings-section {
  margin-bottom: 12px;

  .input-group {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;

    label {
      color: #778DA9;
      font-size: 12px;
      white-space: nowrap;
    }

    input {
      flex: 1;
      padding: 8px 12px;
      background: #141f2e;
      border: 1px solid #415A77;
      border-radius: 4px;
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

    .wake-word-display {
      flex: 1;
      padding: 8px 12px;
      background: #141f2e;
      border: 1px solid #4CC9F0;
      border-radius: 4px;
      color: #4CC9F0;
      font-size: 13px;
      font-weight: 500;
    }

    .btn-small {
      padding: 8px 16px;
      background: #4CC9F0;
      border: none;
      border-radius: 4px;
      color: #0D1B2A;
      font-size: 12px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;

      &:hover {
        background: #38B6FF;
      }
    }
  }

  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;

    &:last-child {
      margin-bottom: 0;
    }

    label {
      color: #778DA9;
      font-size: 12px;
    }

    select {
      flex: 1;
      max-width: 180px;
      padding: 6px 10px;
      background: #141f2e;
      border: 1px solid #415A77;
      border-radius: 4px;
      color: #E0E1DD;
      font-size: 12px;
      font-family: inherit;

      &:focus {
        outline: none;
        border-color: #4CC9F0;
      }
    }
  }
}

.current-subtitle {
  margin-bottom: 12px;

  .subtitle-display {
    padding: 12px;
    background: #141f2e;
    border: 1px solid #415A77;
    border-radius: 6px;
    color: #E0E1DD;
    font-size: 13px;
    min-height: 60px;
    line-height: 1.5;

    .placeholder {
      color: #778DA9;
    }
  }
}

.subtitle-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;

  .stat-item {
    background: #141f2e;
    border-radius: 6px;
    padding: 12px;
    text-align: center;

    .stat-label {
      color: #778DA9;
      font-size: 11px;
      margin-bottom: 4px;
    }

    .stat-value {
      color: #E0E1DD;
      font-size: 18px;
      font-weight: 600;
    }
  }
}

/* 视频生成字幕 */
.video-source-list {
  margin-bottom: 12px;
  max-height: 150px;
  overflow-y: auto;

  .video-source-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    background: #141f2e;
    border: 1px solid #2d3a4f;
    border-radius: 6px;
    margin-bottom: 6px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: #415A77;
    }

    &.selected {
      background: rgba(76, 201, 240, 0.1);
      border-color: #4CC9F0;

      .source-name {
        color: #4CC9F0;
      }
    }

    .source-name {
      color: #E0E1DD;
      font-size: 12px;
      font-weight: 500;
    }

    .source-type {
      color: #778DA9;
      font-size: 11px;
    }
  }
}

.action-section {
  margin-bottom: 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;

  .action-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    background: #4CC9F0;
    border: none;
    border-radius: 6px;
    color: #0D1B2A;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;

    &:hover:not(:disabled) {
      background: #38B6FF;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &.danger {
      background: #FF5252;
      color: #E0E1DD;

      &:hover:not(:disabled) {
        background: #E53935;
      }
    }

    .el-icon {
      font-size: 18px;
    }
  }
}

.result-section {
  .subtitle-preview {
    background: #141f2e;
    border-radius: 6px;
    padding: 8px;
    max-height: 200px;
    overflow-y: auto;
    margin-bottom: 8px;

    .subtitle-item {
      display: flex;
      gap: 8px;
      padding: 6px;
      border-bottom: 1px solid #2d3a4f;

      &:last-child {
        border-bottom: none;
      }

      .subtitle-time {
        color: #778DA9;
        font-size: 10px;
        min-width: 60px;
      }

      .subtitle-text {
        color: #E0E1DD;
        font-size: 11px;
        flex: 1;
      }
    }
  }

  .result-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
}

/* 字幕管理 */
.filter-section {
  margin-bottom: 12px;

  .filter-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;

    &:last-child {
      margin-bottom: 0;
    }

    label {
      color: #778DA9;
      font-size: 11px;
      min-width: 60px;
    }

    input[type="text"],
    input[type="date"] {
      flex: 1;
      padding: 6px 10px;
      background: #141f2e;
      border: 1px solid #415A77;
      border-radius: 4px;
      color: #E0E1DD;
      font-size: 11px;
      font-family: inherit;

      &:focus {
        outline: none;
        border-color: #4CC9F0;
      }
    }

    span {
      color: #778DA9;
      font-size: 11px;
    }
  }
}

.subtitle-list {
  background: #141f2e;
  border-radius: 6px;
  padding: 8px;
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 12px;

  .subtitle-list-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border-bottom: 1px solid #2d3a4f;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: #0D1B2A;
    }

    &:last-child {
      border-bottom: none;
    }

    .list-time {
      color: #778DA9;
      font-size: 10px;
      min-width: 60px;
    }

    .list-text {
      color: #E0E1DD;
      font-size: 11px;
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .list-actions {
      display: flex;
      gap: 4px;

      .icon-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        background: transparent;
        border: none;
        border-radius: 4px;
        color: #778DA9;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
          background: #415A77;
          color: #E0E1DD;
        }

        .el-icon {
          font-size: 12px;
        }
      }
    }
  }

  .empty-state {
    color: #778DA9;
    text-align: center;
    padding: 30px;
    font-size: 12px;
  }
}

.batch-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

/* 语音助手 */
.command-list {
  max-height: 350px;
  overflow-y: auto;
  margin-bottom: 12px;

  .command-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px;
    background: #141f2e;
    border-radius: 6px;
    margin-bottom: 8px;
    border: 1px solid transparent;

    &:last-child {
      margin-bottom: 0;
    }

    .command-icon {
      width: 32px;
      height: 32px;
      background: #415A77;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;

      .el-icon {
        font-size: 16px;
        color: #E0E1DD;
      }
    }

    .command-info {
      flex: 1;

      .command-phrase {
        color: #4CC9F0;
        font-size: 13px;
        font-weight: 500;
        margin-bottom: 2px;
      }

      .command-desc {
        color: #778DA9;
        font-size: 11px;
      }
    }

    .command-status {
      .status-badge {
        padding: 3px 8px;
        border-radius: 10px;
        font-size: 10px;

        &.success {
          background: rgba(76, 201, 240, 0.2);
          color: #4CC9F0;
        }
      }
    }
  }
}

.recent-list {
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: 12px;

  .recent-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: #141f2e;
    border-radius: 4px;
    margin-bottom: 6px;

    &:last-child {
      margin-bottom: 0;
    }

    .recent-time {
      color: #778DA9;
      font-size: 10px;
      min-width: 50px;
    }

    .recent-cmd {
      flex: 1;
      color: #E0E1DD;
      font-size: 12px;
    }

    .recent-result {
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 10px;

      &.success {
        background: rgba(76, 201, 240, 0.2);
        color: #4CC9F0;
      }

      &.error {
        background: rgba(255, 82, 82, 0.2);
        color: #FF5252;
      }
    }
  }
}

.empty-state {
  color: #778DA9;
  text-align: center;
  padding: 20px;
  font-size: 12px;
}

/* 对话框 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.dialog {
  background: #141f2e;
  border-radius: 12px;
  width: 400px;
  max-width: 90%;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #2d3a4f;

    .dialog-title {
      color: #E0E1DD;
      font-size: 15px;
      font-weight: 500;
    }

    .dialog-close {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      color: #778DA9;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.2s;

      &:hover {
        background: #FF5252;
        color: white;
      }

      .el-icon {
        font-size: 14px;
      }
    }
  }

  .dialog-body {
    padding: 20px;

    .form-group {
      margin-bottom: 16px;

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
      textarea {
        width: 100%;
        padding: 10px 12px;
        background: #0D1B2A;
        border: 1px solid #415A77;
        border-radius: 6px;
        color: #E0E1DD;
        font-size: 13px;
        font-family: inherit;
        resize: vertical;

        &::placeholder {
          color: #778DA9;
        }

        &:focus {
          outline: none;
          border-color: #4CC9F0;
        }
      }
    }
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 16px 20px;
    border-top: 1px solid #2d3a4f;

    .dialog-btn {
      padding: 8px 20px;
      background: #415A77;
      border: none;
      border-radius: 6px;
      color: #E0E1DD;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;

      &:hover {
        background: #778DA9;
      }

      &.primary {
        background: #4CC9F0;
        color: #0D1B2A;

        &:hover {
          background: #38B6FF;
        }
      }
    }
  }
}
</style>
