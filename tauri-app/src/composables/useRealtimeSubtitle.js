/**
 * 实时字幕 Composable
 * 使用 Tauri 后端 Whisper 实现实时语音转文字
 * 
 * 🎯 全局单例模式：实时字幕是全局功能，不应在每个视频组件中独立管理
 */

import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// 🎯 全局状态（单例）
const subtitleText = ref('');
const isRecognizing = ref(false);
let speechResultListener = null;
let isInitialized = false; // 标记是否已初始化

/**
 * 初始化 Whisper
 */
const initWhisper = async () => {
  try {
    if (isInitialized) {
      return true;
    }

    // 检查 Whisper 状态
    const whisperStatus = await invoke('get_whisper_status');

    if (!whisperStatus) {
      // 初始化 Whisper
      await invoke('init_whisper', {
        config: {
          modelPath: '', // 使用默认路径
          language: 'zh',
          modelType: 'tiny' // 使用 tiny 模型以获得更快速度
        }
      });
    }

    isInitialized = true;
    return true;
  } catch (error) {
    console.error('[实时字幕] 初始化 Whisper 失败:', error);
    ElMessage.error('初始化 Whisper 失败: ' + error.message);
    return false;
  }
};

/**
 * 开始实时字幕识别
 */
const startRealtimeSubtitle = async () => {
  try {
    if (isRecognizing.value) {
      console.warn('[实时字幕] 识别已在运行');
      return;
    }

    // 初始化 Whisper
    const initialized = await initWhisper();
    if (!initialized) {
      return;
    }

    // 启动音频捕获
    await invoke('start_audio_capture');

    // 监听语音识别结果事件
    speechResultListener = await listen('speech_result', (event) => {
      console.log('[实时字幕] 收到识别结果:', event.payload);
      const result = event.payload;

      // 更新字幕文本
      if (result && result.text) {
        subtitleText.value = result.text;
      }
    });

    // 启动语音识别
    await invoke('start_speech_recognition');

    isRecognizing.value = true;
    ElMessage.success('实时字幕已启动');
  } catch (error) {
    console.error('[实时字幕] 启动失败:', error);
    ElMessage.error('启动实时字幕失败: ' + error.message);
  }
};

/**
 * 停止实时字幕识别
 */
const stopRealtimeSubtitle = async () => {
  try {
    // 如果未启动，直接返回，避免重复提示
    if (!isRecognizing.value) {
      return;
    }

    // 停止语音识别
    await invoke('stop_speech_recognition');

    // 停止音频捕获
    await invoke('stop_audio_capture');

    // 取消语音识别结果监听
    if (speechResultListener) {
      speechResultListener();
      speechResultListener = null;
    }

    isRecognizing.value = false;
    subtitleText.value = '';

    ElMessage.info('实时字幕已停止');
  } catch (error) {
    console.error('[实时字幕] 停止失败:', error);
  }
};

// 识别完成事件回调列表
const recognitionCompleteListeners = [];

/**
 * 切换实时字幕
 */
const toggleRealtimeSubtitle = async () => {
  if (isRecognizing.value) {
    await stopRealtimeSubtitle();
  } else {
    await startRealtimeSubtitle();
  }
};

/**
 * 更新识别设置
 */
const updateRecognitionSettings = async (settings) => {
  try {
    console.log('[实时字幕] 更新识别设置:', settings);
    
    // 发送设置到后端
    await invoke('update_recognition_settings', {
      config: {
        language: settings.language || 'zh',
        modelType: settings.modelType || 'tiny',
        sampleRate: settings.sampleRate || 16000,
        vadThreshold: settings.vadThreshold || 0.5,
        enablePunctuation: settings.enablePunctuation !== undefined ? settings.enablePunctuation : true,
        enableSegmentation: settings.enableSegmentation !== undefined ? settings.enableSegmentation : true
      }
    });
    
    ElMessage.success('识别设置已更新');
    return true;
  } catch (error) {
    console.error('[实时字幕] 更新设置失败:', error);
    ElMessage.error('更新识别设置失败: ' + error.message);
    return false;
  }
};

/**
 * 添加识别完成事件监听
 */
const addRecognitionCompleteListener = (listener) => {
  if (typeof listener === 'function') {
    recognitionCompleteListeners.push(listener);
  }
};

/**
 * 移除识别完成事件监听
 */
const removeRecognitionCompleteListener = (listener) => {
  const index = recognitionCompleteListeners.indexOf(listener);
  if (index > -1) {
    recognitionCompleteListeners.splice(index, 1);
  }
};

/**
 * 触发识别完成事件
 */
const triggerRecognitionComplete = (result) => {
  recognitionCompleteListeners.forEach(listener => {
    try {
      listener(result);
    } catch (error) {
      console.error('[实时字幕] 触发识别完成事件失败:', error);
    }
  });
};

/**
 * 🎯 Composable 工厂函数：返回对全局状态的引用
 * 不再在 onUnmounted 中自动停止，由用户手动控制
 */
export function useRealtimeSubtitle() {
  return {
    subtitleText,
    isRecognizing,
    startRealtimeSubtitle,
    stopRealtimeSubtitle,
    toggleRealtimeSubtitle,
    updateRecognitionSettings,
    addRecognitionCompleteListener,
    removeRecognitionCompleteListener
  };
}
