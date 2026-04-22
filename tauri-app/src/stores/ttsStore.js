import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { TTSService, ttsConfig } from '../services/ttsService.js';

/**
 * TTS 语音播报 Store
 * 管理教师端的语音播报功能
 */
export const useTTSStore = defineStore('tts', () => {
  // ==================== 状态 ====================

  // TTS 服务实例
  let ttsService = null;

  // 是否启用 TTS
  const enabled = ref(true);

  // 是否正在播报
  const isSpeaking = ref(false);

  // 语速 (0.5 - 2.0)
  const rate = ref(1.0);

  // 音量 (0 - 1)
  const volume = ref(1.0);

  // 音调 (0.5 - 2.0)
  const pitch = ref(1.0);

  // 语音风格
  const voiceType = ref('narration');

  // 可用语音列表
  const availableVoices = ref([]);

  // 当前使用的后端
  const backend = ref('browser');

  // 播报历史
  const history = ref([]);

  // 最大历史记录数
  const MAX_HISTORY = 20;

  // ==================== 计算属性 ====================

  const isAvailable = computed(() => {
    return enabled.value && (backend.value === 'browser' || backend.value === 'tauri');
  });

  // ==================== 方法 ====================

  /**
   * 初始化 TTS 服务
   */
  const init = async () => {
    if (ttsService) return;

    ttsService = new TTSService({
      rate: rate.value,
      pitch: pitch.value,
      volume: volume.value,
      onStart: () => {
        isSpeaking.value = true;
        console.log('[TTS Store] 开始播报');
      },
      onEnd: () => {
        isSpeaking.value = false;
        console.log('[TTS Store] 播报完成');
      },
      onError: (e) => {
        isSpeaking.value = false;
        console.error('[TTS Store] 播报错误:', e);
      }
    });

    // 加载语音列表
    availableVoices.value = ttsService.getAvailableVoices();
    backend.value = ttsService.getBackend();

    // 加载保存的设置
    loadSettings();

    console.log('[TTS Store] 初始化完成，后端:', backend.value);
  };

  /**
   * 播报文本
   */
  const speak = (text, options = {}) => {
    if (!enabled.value || !text) return;

    // 如果有自定义选项，合并配置
    const config = {
      rate: options.rate ?? rate.value,
      pitch: options.pitch ?? pitch.value,
      volume: options.volume ?? volume.value,
      voiceType: options.voiceType ?? voiceType.value,
      ...options
    };

    // 应用语音风格预设
    const preset = ttsConfig.presets[config.voiceType];
    if (preset) {
      config.rate = config.rate * preset.rate;
      config.pitch = preset.pitch;
      config.volume = preset.volume;
    }

    // 执行播报
    if (ttsService) {
      ttsService.speak(text, config);

      // 添加到历史记录
      addToHistory(text, 'speak');
    }
  };

  /**
   * 播报并显示提示
   */
  const speakWithMessage = (text, message = null) => {
    speak(text);
    if (message) {
      // 可以在这里添加消息提示
      console.log('[TTS Store]', message);
    }
  };

  /**
   * 停止播报
   */
  const stop = () => {
    if (ttsService) {
      ttsService.stop();
      isSpeaking.value = false;
    }
  };

  /**
   * 暂停播报
   */
  const pause = () => {
    if (ttsService) {
      ttsService.pause();
    }
  };

  /**
   * 恢复播报
   */
  const resume = () => {
    if (ttsService) {
      ttsService.resume();
    }
  };

  /**
   * 设置配置
   */
  const setConfig = (config) => {
    if (config.enabled !== undefined) enabled.value = config.enabled;
    if (config.rate !== undefined) rate.value = config.rate;
    if (config.volume !== undefined) volume.value = config.volume;
    if (config.pitch !== undefined) pitch.value = config.pitch;
    if (config.voiceType !== undefined) voiceType.value = config.voiceType;

    if (ttsService) {
      ttsService.setConfig(config);
    }

    saveSettings();
  };

  /**
   * 使用预设
   */
  const usePreset = (presetName) => {
    if (ttsConfig.presets[presetName]) {
      voiceType.value = presetName;
      const preset = ttsConfig.presets[presetName];
      rate.value = preset.rate;
      pitch.value = preset.pitch;
      volume.value = preset.volume;

      if (ttsService) {
        ttsService.usePreset(presetName);
      }

      saveSettings();
    }
  };

  /**
   * 添加到历史记录
   */
  const addToHistory = (text, type) => {
    history.value.unshift({
      id: Date.now(),
      text,
      type,
      timestamp: new Date().toLocaleTimeString()
    });

    // 限制历史记录数量
    if (history.value.length > MAX_HISTORY) {
      history.value = history.value.slice(0, MAX_HISTORY);
    }
  };

  /**
   * 清空历史记录
   */
  const clearHistory = () => {
    history.value = [];
  };

  /**
   * 保存设置到 localStorage
   */
  const saveSettings = () => {
    const settings = {
      enabled: enabled.value,
      rate: rate.value,
      volume: volume.value,
      pitch: pitch.value,
      voiceType: voiceType.value
    };
    localStorage.setItem('tts-settings', JSON.stringify(settings));
  };

  /**
   * 从 localStorage 加载设置
   */
  const loadSettings = () => {
    try {
      const saved = localStorage.getItem('tts-settings');
      if (saved) {
        const settings = JSON.parse(saved);
        enabled.value = settings.enabled ?? true;
        rate.value = settings.rate ?? 1.0;
        volume.value = settings.volume ?? 1.0;
        pitch.value = settings.pitch ?? 1.0;
        voiceType.value = settings.voiceType ?? 'narration';
      }
    } catch (e) {
      console.warn('[TTS Store] 加载设置失败:', e);
    }
  };

  /**
   * 销毁
   */
  const destroy = () => {
    if (ttsService) {
      ttsService.destroy();
      ttsService = null;
    }
  };

  return {
    // 状态
    enabled,
    isSpeaking,
    rate,
    volume,
    pitch,
    voiceType,
    availableVoices,
    backend,
    history,

    // 计算属性
    isAvailable,

    // 方法
    init,
    speak,
    speakWithMessage,
    stop,
    pause,
    resume,
    setConfig,
    usePreset,
    clearHistory,
    destroy
  };
});
