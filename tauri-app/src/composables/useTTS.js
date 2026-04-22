import { onMounted, onUnmounted } from 'vue';
import { useTTSStore } from '../stores/ttsStore.js';

/**
 * TTS composable
 * 方便在组件中使用 TTS 功能
 */
export function useTTS() {
  const ttsStore = useTTSStore();

  // 初始化
  onMounted(() => {
    ttsStore.init();
  });

  // 清理
  onUnmounted(() => {
    ttsStore.stop();
  });

  return {
    // 状态
    enabled: ttsStore.enabled,
    isSpeaking: ttsStore.isSpeaking,
    rate: ttsStore.rate,
    volume: ttsStore.volume,
    pitch: ttsStore.pitch,
    voiceType: ttsStore.voiceType,
    backend: ttsStore.backend,
    isAvailable: ttsStore.isAvailable,

    // 方法
    speak: ttsStore.speak,
    speakWithMessage: ttsStore.speakWithMessage,
    stop: ttsStore.stop,
    pause: ttsStore.pause,
    resume: ttsStore.resume,
    setConfig: ttsStore.setConfig,
    usePreset: ttsStore.usePreset,

    // 便捷快捷方法
    say: (text) => ttsStore.speak(text),
    announce: (text) => ttsStore.speak(text, { voiceType: 'announcement' }),
    warn: (text) => ttsStore.speak(text, { voiceType: 'warning' }),
    gentle: (text) => ttsStore.speak(text, { voiceType: 'gentle' }),

    // 预设播报
    presets: {
      startLive: () => ttsStore.speakWithMessage('直播已开始', '直播开始'),
      stopLive: () => ttsStore.speakWithMessage('直播已停止', '直播停止'),
      startRecord: () => ttsStore.speakWithMessage('录制已开始', '录制开始'),
      stopRecord: () => ttsStore.speakWithMessage('录制已停止', '录制停止'),
      pauseRecord: () => ttsStore.speakWithMessage('录制已暂停', '录制暂停'),
      resumeRecord: () => ttsStore.speakWithMessage('录制已恢复', '录制恢复'),
      switchScene: () => ttsStore.speakWithMessage('场景已切换', '切换场景'),
      sourceAdded: () => ttsStore.speakWithMessage('已添加素材', '添加素材'),
      sourceRemoved: () => ttsStore.speakWithMessage('已移除素材', '移除素材'),
      settingsSaved: () => ttsStore.speakWithMessage('设置已保存', '保存设置'),
      error: (msg) => ttsStore.speakWithMessage(`发生错误：${msg}`, '错误提示')
    }
  };
}

/**
 * 组合快捷语音播报
 */
export function useTTSAnnouncements() {
  const ttsStore = useTTSStore();

  return {
    // 录制相关
    recordingStarted: () => ttsStore.speak('录制已开始'),
    recordingStopped: () => ttsStore.speak('录制已停止'),
    recordingPaused: () => ttsStore.speak('录制已暂停'),
    recordingResumed: () => ttsStore.speak('录制已恢复'),

    // 直播相关
    liveStarted: () => ttsStore.speak('直播已开始'),
    liveStopped: () => ttsStore.speak('直播已停止'),

    // 场景切换
    sceneSwitched: (sceneName) => ttsStore.speak(`已切换到${sceneName}`),

    // 素材操作
    sourceAdded: (sourceName) => ttsStore.speak(`已添加${sourceName}`),
    sourceRemoved: (sourceName) => ttsStore.speak(`已移除${sourceName}`),

    // 警告提示
    lowDisk: () => ttsStore.speak('磁盘空间不足，请及时清理', { voiceType: 'warning' }),
    networkPoor: () => ttsStore.speak('网络质量不佳', { voiceType: 'warning' }),
    encodingError: () => ttsStore.speak('编码错误，请检查设置', { voiceType: 'warning' }),

    // 欢迎/问候
    welcome: () => ttsStore.speak('欢迎使用实训教学系统', { voiceType: 'gentle' }),
    goodbye: () => ttsStore.speak('感谢使用，下次再见', { voiceType: 'gentle' }),

    // 自定义播报
    custom: (text, options = {}) => ttsStore.speak(text, options)
  };
}
