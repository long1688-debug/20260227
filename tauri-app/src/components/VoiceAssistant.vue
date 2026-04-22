<template>
  <div
    class="voice-assistant"
    :class="{ listening: isListening, speaking: isSpeaking }"
    :style="{ left: position.x + 'px', top: position.y + 'px', right: 'auto', bottom: 'auto' }"
  >
    <!-- 状态指示器 -->
    <div
      class="status-indicator"
      @click="handleClick"
      @mousedown="startDrag"
    >
      <div class="status-ring"></div>
      <div class="status-ring status-ring-2"></div>
      <div class="status-ring status-ring-3"></div>
      <div class="mic-icon">
        <el-icon v-if="isSpeaking"><Volume /></el-icon>
        <el-icon v-else><Microphone /></el-icon>
      </div>
    </div>

    <!-- 语音助手面板 -->
    <div class="assistant-panel" v-if="showPanel">
      <div class="panel-header">
        <div class="panel-title">
          <el-icon><Microphone /></el-icon>
          <span>语音助手</span>
        </div>
        <button class="close-btn" @click="showPanel = false">
          <el-icon><Close /></el-icon>
        </button>
      </div>

      <!-- 唤醒词设置 -->
      <div class="panel-section">
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

      <!-- TTS 语音设置 -->
      <div class="panel-section">
        <div class="section-title">语音播报设置</div>
        <div class="tts-toggle">
          <label class="tts-switch">
            <input type="checkbox" v-model="ttsEnabled" @change="onTTSSettingChange" />
            <span class="tts-slider"></span>
          </label>
          <span class="tts-label">{{ ttsEnabled ? '开启语音播报' : '关闭语音播报' }}</span>
        </div>

        <div class="tts-controls" v-if="ttsEnabled">
          <div class="tts-control-item">
            <label>语速：{{ ttsRate.toFixed(1) }}x</label>
            <input
              type="range"
              v-model.number="ttsRate"
              min="0.5"
              max="2.0"
              step="0.1"
              @change="onTTSSettingChange"
            />
          </div>

          <div class="tts-control-item">
            <label>音量：{{ Math.round(ttsVolume * 100) }}%</label>
            <input
              type="range"
              v-model.number="ttsVolume"
              min="0"
              max="1"
              step="0.1"
              @change="onTTSSettingChange"
            />
          </div>

          <div class="tts-control-item">
            <label>语音风格：</label>
            <select v-model="ttsVoiceType" @change="onTTSSettingChange">
              <option value="narration">旁白</option>
              <option value="announcement">公告</option>
              <option value="warning">警告</option>
              <option value="gentle">温和</option>
            </select>
          </div>

          <button class="test-tts-btn" @click="testTTS" :disabled="isSpeaking">
            <el-icon><Volume /></el-icon>
            <span>{{ isSpeaking ? '播放中...' : '测试语音' }}</span>
          </button>
        </div>
      </div>

      <!-- 语音命令列表 -->
      <div class="panel-section">
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
      </div>

      <!-- 最近执行的命令 -->
      <div class="panel-section">
        <div class="section-title">最近命令</div>
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
      </div>

      <!-- 当前识别的语音 -->
      <div class="panel-section current-speech">
        <div class="speech-label">正在识别：</div>
        <div class="speech-text">
          <span v-if="currentSpeech">{{ currentSpeech }}</span>
          <span v-else class="placeholder">等待语音输入...</span>
        </div>
      </div>

      <!-- 快捷操作 -->
      <div class="panel-section">
        <div class="section-title">快捷操作</div>
        <div class="quick-actions">
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
    </div>

    <!-- 状态提示 -->
    <div class="status-toast" :class="{ show: showToast }">
      <div class="toast-icon">
        <el-icon><Check v-if="toastType === 'success'" /><Warning v-else /></el-icon>
      </div>
      <div class="toast-message">{{ toastMessage }}</div>
    </div>

    <!-- 面板切换按钮 -->
    <button class="panel-toggle-btn" @click="showPanel = !showPanel">
      <el-icon><Setting /></el-icon>
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import {
  Microphone, VideoCamera, VideoPlay, VideoStop, VideoPause,
  Grid, Monitor, Document as DocIcon, Close, Check,
  Warning, Setting, Delete, Volume
} from '@/components/icons';
import { ttsService, TTSService } from '@/services/ttsService';

// 状态
const isListening = ref(false);
const isSpeaking = ref(false);
const showPanel = ref(false);
const currentSpeech = ref('');
const wakeWord = ref('小助手');
const newWakeWord = ref('');
const lastCommand = ref(null);
const showToast = ref(false);
const toastMessage = ref('');
const toastType = ref('success');

// 拖拽相关状态
const isDragging = ref(false);
const position = reactive({
  x: window.innerWidth - 84, // 初始位置：右侧 24px + 60px 图标宽度
  y: window.innerHeight - 84  // 初始位置：底部 24px + 60px 图标高度
});
const dragOffset = reactive({ x: 0, y: 0 });
let dragStartTime = 0;

// TTS 相关状态
const ttsEnabled = ref(true);
const ttsRate = ref(1.0);
const ttsVolume = ref(1.0);
const ttsVoiceType = ref('narration');
const ttsVoices = ref([]);

// TTS 实例
let tts = null;

// 最近执行的命令
const recentCommands = ref([]);

// 识别监听器
let recognition = null;
let recognitionInterval = null;

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
    icon: VideoStop
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
    icon: VideoStop
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
    icon: DocIcon
  },
  {
    id: 'quick-record',
    phrase: '一键录制',
    description: '快速开始录制',
    icon: VideoCamera
  }
];

// 初始化语音识别
const initRecognition = () => {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      isListening.value = true;
      console.log('[VoiceAssistant] 语音识别已启动');
    };

    recognition.onend = () => {
      isListening.value = false;
      // 如果需要持续监听，可以在这里重新启动
      if (isListening.value) {
        recognition.start();
      }
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (interimTranscript) {
        currentSpeech.value = interimTranscript;
      }

      if (finalTranscript) {
        currentSpeech.value = '';
        processVoiceCommand(finalTranscript);
      }
    };

    recognition.onerror = (event) => {
      console.error('[VoiceAssistant] 语音识别错误:', event.error);
      if (event.error === 'not-allowed') {
        ElMessage.error('未授权使用麦克风，请检查浏览器权限设置');
        isListening.value = false;
      }
    };
  } else {
    console.warn('[VoiceAssistant] 浏览器不支持语音识别');
    ElMessage.warning('您的浏览器不支持语音识别功能');
  }
};

// 切换监听状态
const toggleListening = () => {
  if (!recognition) {
    initRecognition();
    if (!recognition) return;
  }

  if (isListening.value) {
    recognition.stop();
    isListening.value = false;
    ElMessage.info('语音监听已停止');
  } else {
    try {
      recognition.start();
      ElMessage.success('语音监听已启动，说「' + wakeWord.value + '」唤醒');
    } catch (e) {
      console.error('[VoiceAssistant] 启动失败:', e);
    }
  }
};

// 处理点击事件（区分拖拽和点击）
const handleClick = () => {
  // 如果拖拽时间很短，认为是点击
  const dragDuration = Date.now() - dragStartTime;
  if (dragDuration < 200) {
    toggleListening();
  }
};

// 开始拖拽
const startDrag = (e) => {
  // 防止拖拽时触发点击事件
  if (e.button !== 0) return; // 只响应左键

  dragStartTime = Date.now();
  isDragging.value = true;

  // 计算鼠标相对于元素左上角的偏移
  const rect = e.currentTarget.getBoundingClientRect();
  dragOffset.x = e.clientX - rect.left;
  dragOffset.y = e.clientY - rect.top;

  // 阻止默认行为和事件冒泡
  e.preventDefault();
  e.stopPropagation();

  // 添加全局事件监听
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);

  // 添加拖拽时的样式
  document.body.style.cursor = 'grabbing';
  document.body.style.userSelect = 'none';
};

// 拖拽中
const onDrag = (e) => {
  if (!isDragging.value) return;

  // 计算新位置
  let newX = e.clientX - dragOffset.x;
  let newY = e.clientY - dragOffset.y;

  // 边界限制：防止拖出屏幕
  const iconSize = 60;
  const maxX = window.innerWidth - iconSize;
  const maxY = window.innerHeight - iconSize;

  newX = Math.max(0, Math.min(newX, maxX));
  newY = Math.max(0, Math.min(newY, maxY));

  position.x = newX;
  position.y = newY;
};

// 停止拖拽
const stopDrag = () => {
  if (!isDragging.value) return;

  isDragging.value = false;

  // 移除全局事件监听
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);

  // 恢复默认样式
  document.body.style.cursor = '';
  document.body.style.userSelect = '';

  // 保存位置到 localStorage
  savePosition();
};

// 保存位置
const savePosition = () => {
  localStorage.setItem('voiceAssistantPosition', JSON.stringify(position));
};

// 加载保存的位置
const loadPosition = () => {
  const savedPosition = localStorage.getItem('voiceAssistantPosition');
  if (savedPosition) {
    try {
      const pos = JSON.parse(savedPosition);
      // 验证位置是否在有效范围内
      const iconSize = 60;
      const maxX = window.innerWidth - iconSize;
      const maxY = window.innerHeight - iconSize;

      position.x = Math.max(0, Math.min(pos.x, maxX));
      position.y = Math.max(0, Math.min(pos.y, maxY));
    } catch (e) {
      console.error('[VoiceAssistant] 加载位置失败:', e);
    }
  }
};

// 处理语音命令
const processVoiceCommand = (text) => {
  console.log('[VoiceAssistant] 识别到语音:', text);
  const normalizedText = text.toLowerCase().trim();

  // 检查是否包含唤醒词
  if (!normalizedText.includes(wakeWord.value.toLowerCase())) {
    return;
  }

  // 移除唤醒词
  const commandText = normalizedText.replace(wakeWord.value.toLowerCase(), '').trim();

  // 匹配命令
  const command = voiceCommands.find(cmd =>
    commandText.includes(cmd.phrase.toLowerCase())
  );

  if (command) {
    executeCommand(command);
  } else {
    ElMessage.info('未识别到有效命令');
    addRecentCommand(text, false);
  }
};

// 执行命令
const executeCommand = (command) => {
  console.log('[VoiceAssistant] 执行命令:', command.id);

  // 触发相应的事件
  switch (command.id) {
    case 'start-stream':
      window.dispatchEvent(new CustomEvent('voice-start-stream'));
      break;
    case 'stop-stream':
      window.dispatchEvent(new CustomEvent('voice-stop-stream'));
      break;
    case 'start-recording':
      window.dispatchEvent(new CustomEvent('voice-start-recording'));
      break;
    case 'pause-recording':
      window.dispatchEvent(new CustomEvent('voice-pause-recording'));
      break;
    case 'stop-recording':
      window.dispatchEvent(new CustomEvent('voice-stop-recording'));
      break;
    case 'next-layout':
      window.dispatchEvent(new CustomEvent('voice-next-layout'));
      break;
    case 'show-desktop':
      window.dispatchEvent(new CustomEvent('voice-show-desktop'));
      break;
    case 'return-teaching':
      window.dispatchEvent(new CustomEvent('voice-return-teaching'));
      break;
    case 'quick-record':
      window.dispatchEvent(new CustomEvent('voice-quick-record'));
      break;
  }

  lastCommand.value = command.id;
  addRecentCommand(command.phrase, true);
  showToastMessage(`已执行：${command.description}`, 'success');

  // TTS 播报结果
  speakCommandResult(command);

  // 3秒后清除最后执行的命令标记
  setTimeout(() => {
    lastCommand.value = null;
  }, 3000);
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
};

// ==================== TTS 功能 ====================

// 初始化 TTS
const initTTS = () => {
  if (!('speechSynthesis' in window)) {
    console.warn('[VoiceAssistant] 浏览器不支持 TTS');
    return;
  }

  tts = new TTSService({
    onStart: () => {
      isSpeaking.value = true;
    },
    onEnd: () => {
      isSpeaking.value = false;
    },
    onError: (e) => {
      console.error('[VoiceAssistant] TTS 错误:', e);
      isSpeaking.value = false;
    }
  });

  // 加载语音列表
  loadTTSVoices();
  console.log('[VoiceAssistant] TTS 服务已初始化');
};

// 加载 TTS 语音
const loadTTSVoices = () => {
  if (!tts) return;

  // 等待语音加载
  const loadVoices = () => {
    ttsVoices.value = tts.getAvailableVoices();
  };

  if (ttsVoices.value.length === 0) {
    setTimeout(loadVoices, 100);
  } else {
    loadVoices();
  }
};

// TTS 说话
const ttsSpeak = (text) => {
  if (!tts || !ttsEnabled.value) return;

  // 根据语音类型设置参数
  const presets = {
    narration: { rate: 0.9, pitch: 0.95 },
    announcement: { rate: 1.0, pitch: 1.0 },
    warning: { rate: 1.1, pitch: 1.1 },
    gentle: { rate: 0.8, pitch: 0.9 }
  };

  const preset = presets[ttsVoiceType.value] || presets.narration;

  tts.speak(text, {
    rate: ttsRate.value * preset.rate,
    pitch: preset.pitch,
    volume: ttsVolume.value
  });
};

// 停止 TTS 说话
const ttsStop = () => {
  if (tts) {
    tts.stop();
    isSpeaking.value = false;
  }
};

// 测试 TTS
const testTTS = () => {
  ttsSpeak('这是一段测试语音，请问您能听到吗？');
};

// TTS 设置变化
const onTTSSettingChange = () => {
  if (tts) {
    tts.setConfig({
      rate: ttsRate.value,
      volume: ttsVolume.value
    });
    localStorage.setItem('ttsRate', String(ttsRate.value));
    localStorage.setItem('ttsVolume', String(ttsVolume.value));
    localStorage.setItem('ttsVoiceType', ttsVoiceType.value);
    localStorage.setItem('ttsEnabled', String(ttsEnabled.value));
  }
};

// 命令执行后播报
const speakCommandResult = (command) => {
  const responses = {
    'start-stream': '直播已开始',
    'stop-stream': '直播已停止',
    'start-recording': '录制已开始',
    'pause-recording': '录制已暂停',
    'stop-recording': '录制已停止',
    'next-layout': '已切换到下一个场景',
    'show-desktop': '正在展示桌面',
    'return-teaching': '已返回示教模式',
    'quick-record': '一键录制已启动'
  };

  const response = responses[command.id];
  if (response && ttsEnabled.value) {
    ttsSpeak(response);
  }
};

// 添加最近命令记录
const addRecentCommand = (command, success) => {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  recentCommands.value.unshift({
    time,
    command,
    success
  });

  // 只保留最近10条记录
  if (recentCommands.value.length > 10) {
    recentCommands.value = recentCommands.value.slice(0, 10);
  }
};

// 清空历史记录
const clearHistory = () => {
  recentCommands.value = [];
  ElMessage.info('历史记录已清空');
};

// 显示提示消息
const showToastMessage = (message, type) => {
  toastMessage.value = message;
  toastType.value = type;
  showToast.value = true;

  setTimeout(() => {
    showToast.value = false;
  }, 2000);
};

// 生命周期
onMounted(() => {
  // 加载保存的唤醒词
  const savedWakeWord = localStorage.getItem('voiceWakeWord');
  if (savedWakeWord) {
    wakeWord.value = savedWakeWord;
  }

  // 加载保存的位置
  loadPosition();

  // 加载保存的 TTS 设置
  const savedTTSRate = localStorage.getItem('ttsRate');
  const savedTTSVolume = localStorage.getItem('ttsVolume');
  const savedTTSVoiceType = localStorage.getItem('ttsVoiceType');
  const savedTTSEnabled = localStorage.getItem('ttsEnabled');

  if (savedTTSRate) ttsRate.value = parseFloat(savedTTSRate);
  if (savedTTSVolume) ttsVolume.value = parseFloat(savedTTSVolume);
  if (savedTTSVoiceType) ttsVoiceType.value = savedTTSVoiceType;
  if (savedTTSEnabled !== null) ttsEnabled.value = savedTTSEnabled === 'true';

  // 初始化语音识别
  initRecognition();

  // 初始化 TTS
  initTTS();
});

onUnmounted(() => {
  if (recognition) {
    recognition.stop();
  }
  if (recognitionInterval) {
    clearInterval(recognitionInterval);
  }
  if (tts) {
    tts.destroy();
  }

  // 清理事件监听
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
});
</script>

<style lang="scss" scoped>
.voice-assistant {
  position: fixed;
  z-index: 9999;
}

/* 状态指示器 */
.status-indicator {
  position: relative;
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, #4CC9F0, #4361EE);
  border-radius: 50%;
  cursor: grab;
  box-shadow: 0 4px 20px rgba(76, 201, 240, 0.4);
  transition: all 0.3s ease;
  user-select: none;

  &:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 30px rgba(76, 201, 240, 0.6);
  }

  &:active {
    cursor: grabbing;
  }

  .status-ring {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 60px;
    height: 60px;
    border-radius: 50%;
    border: 3px solid rgba(76, 201, 240, 0.3);
    animation: none;
  }

  &.listening .status-ring {
    animation: ripple 1.5s ease-out infinite;
  }

  &.listening .status-ring-2 {
    animation: ripple 1.5s ease-out 0.5s infinite;
  }

  &.listening .status-ring-3 {
    animation: ripple 1.5s ease-out 1s infinite;
  }

  // TTS 播报时的样式
  &.speaking {
    background: linear-gradient(135deg, #F72585, #B5179E);

    .status-ring {
      border-color: rgba(247, 37, 133, 0.3);
    }

    .mic-icon {
      animation: pulse 0.8s ease-in-out infinite;
    }
  }

  .mic-icon {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-size: 24px;
  }

  &.active .mic-icon {
    animation: pulse 1s ease-in-out infinite;
  }
}

@keyframes ripple {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.8);
    opacity: 0;
  }
}

@keyframes pulse {
  0%, 100% {
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    transform: translate(-50%, -50%) scale(1.1);
  }
}

/* 语音助手面板 */
.assistant-panel {
  position: absolute;
  bottom: 80px;
  right: 0;
  width: 400px;
  max-height: 600px;
  background: #0D1B2A;
  border: 1px solid #2d3a4f;
  border-radius: 12px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: #141f2e;
  border-bottom: 1px solid #2d3a4f;

  .panel-title {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #E0E1DD;
    font-size: 14px;
    font-weight: 500;

    .el-icon {
      font-size: 18px;
    }
  }

  .close-btn {
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
      font-size: 16px;
    }
  }
}

.panel-section {
  padding: 16px 20px;
  border-bottom: 1px solid #2d3a4f;

  &:last-child {
    border-bottom: none;
  }

  .section-title {
    color: #E0E1DD;
    font-size: 13px;
    font-weight: 500;
    margin-bottom: 12px;
  }
}

/* 唤醒词设置 */
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

/* 命令列表 */
.command-list {
  max-height: 300px;
  overflow-y: auto;

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

/* 最近命令 */
.empty-state {
  color: #778DA9;
  text-align: center;
  padding: 20px;
  font-size: 12px;
}

.recent-list {
  max-height: 200px;
  overflow-y: auto;

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

/* 当前语音 */
.current-speech {
  .speech-label {
    color: #778DA9;
    font-size: 12px;
    margin-bottom: 6px;
  }

  .speech-text {
    padding: 12px;
    background: #141f2e;
    border: 1px solid #415A77;
    border-radius: 6px;
    color: #E0E1DD;
    font-size: 13px;
    min-height: 44px;

    .placeholder {
      color: #778DA9;
    }
  }
}

/* 快捷操作 */
.quick-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;

  .action-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 12px;
    background: #141f2e;
    border: 1px solid #415A77;
    border-radius: 6px;
    color: #E0E1DD;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;

    &:hover {
      background: #415A77;
    }

    .el-icon {
      font-size: 20px;
    }

    span {
      font-size: 11px;
    }
  }
}

/* 状态提示 */
.status-toast {
  position: absolute;
  bottom: 80px;
  right: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #141f2e;
  border: 1px solid #415A77;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  opacity: 0;
  transform: translateY(10px);
  transition: all 0.3s ease;
  pointer-events: none;

  &.show {
    opacity: 1;
    transform: translateY(0);
  }

  .toast-icon {
    .el-icon {
      font-size: 18px;

      &.success {
        color: #4CC9F0;
      }
    }
  }

  .toast-message {
    color: #E0E1DD;
    font-size: 13px;
  }
}

/* 面板切换按钮 */
.panel-toggle-btn {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #141f2e;
  border: 1px solid #415A77;
  border-radius: 50%;
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

/* 滚动条样式 */
.command-list::-webkit-scrollbar,
.recent-list::-webkit-scrollbar {
  width: 6px;
}

.command-list::-webkit-scrollbar-track,
.recent-list::-webkit-scrollbar-track {
  background: #0D1B2A;
}

.command-list::-webkit-scrollbar-thumb,
.recent-list::-webkit-scrollbar-thumb {
  background: #415A77;
  border-radius: 3px;

  &:hover {
    background: #778DA9;
  }
}

/* TTS 语音设置样式 */
.tts-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;

  .tts-label {
    color: #E0E1DD;
    font-size: 12px;
  }
}

.tts-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;

  input {
    opacity: 0;
    width: 0;
    height: 0;

    &:checked + .tts-slider {
      background: #4CC9F0;

      &::before {
        transform: translateX(20px);
      }
    }
  }

  .tts-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #415A77;
    border-radius: 24px;
    transition: 0.3s;

    &::before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background: white;
      border-radius: 50%;
      transition: 0.3s;
    }
  }
}

.tts-controls {
  .tts-control-item {
    margin-bottom: 10px;

    &:last-child {
      margin-bottom: 0;
    }

    label {
      display: block;
      color: #778DA9;
      font-size: 11px;
      margin-bottom: 4px;
    }

    input[type="range"] {
      width: 100%;
      height: 6px;
      background: #415A77;
      border-radius: 3px;
      outline: none;
      appearance: none;

      &::-webkit-slider-thumb {
        appearance: none;
        width: 14px;
        height: 14px;
        background: #4CC9F0;
        border-radius: 50%;
        cursor: pointer;
      }

      &::-moz-range-thumb {
        width: 14px;
        height: 14px;
        background: #4CC9F0;
        border-radius: 50%;
        cursor: pointer;
        border: none;
      }
    }

    select {
      width: 100%;
      padding: 6px 10px;
      background: #141f2e;
      border: 1px solid #415A77;
      border-radius: 4px;
      color: #E0E1DD;
      font-size: 12px;
      font-family: inherit;
      cursor: pointer;

      &:focus {
        outline: none;
        border-color: #4CC9F0;
      }
    }
  }
}

.test-tts-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  background: linear-gradient(135deg, #4CC9F0, #4361EE);
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  margin-top: 12px;

  &:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .el-icon {
    font-size: 14px;
  }
}
</style>
