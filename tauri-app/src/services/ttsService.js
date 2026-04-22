// AI 文字转语音 (TTS) 服务
// 支持多种后端：浏览器原生、Web Speech API、Tauri 原生插件

/**
 * TTS 配置选项
 */
export const ttsConfig = {
  // 默认语音配置
  default: {
    lang: 'zh-CN',
    rate: 1.0,        // 语速 0.1-10
    pitch: 1.0,       // 音调 0-2
    volume: 1.0,      // 音量 0-1
    voice: null       // 特定语音
  },

  // 语音类型预设
  presets: {
    narration: { rate: 0.9, pitch: 0.95, volume: 1.0 },   // 旁白
    announcement: { rate: 1.0, pitch: 1.0, volume: 1.0 },   // 公告
    warning: { rate: 1.1, pitch: 1.1, volume: 1.0 },       // 警告
    gentle: { rate: 0.8, pitch: 0.9, volume: 0.8 }         // 温和提示
  }
};

/**
 * TTS 服务类
 * 支持浏览器原生 API 和 Tauri TTS 插件
 */
export class TTSService {
  constructor(options = {}) {
    this.synth = null;
    this.ttsPlugin = null;
    this.isSpeaking = false;
    this.queue = [];
    this.currentUtterance = null;
    this.onStart = options.onStart || (() => {});
    this.onEnd = options.onEnd || (() => {});
    this.onError = options.onError || ((e) => console.error('[TTS]', e));
    this.onProgress = options.onProgress || (() => {});

    // 配置
    this.config = { ...ttsConfig.default, ...options };

    // 可用语音列表
    this.voices = [];

    // 后端类型
    this.backend = 'browser'; // 'browser' | 'tauri'

    this.init();
  }

  /**
   * 初始化 TTS 服务
   */
  async init() {
    // 优先尝试 Tauri TTS 插件
    await this.initTauriPlugin();

    // 如果 Tauri 插件不可用，使用浏览器原生 API
    if (this.backend !== 'tauri') {
      this.initBrowserTTS();
    }
  }

  /**
   * 初始化 Tauri TTS 插件
   * 注意：@tauri-apps/plugin-tts 插件当前不可用，使用浏览器原生 TTS
   */
  async initTauriPlugin() {
    // Tauri TTS 插件暂不可用，直接使用浏览器原生 TTS
    console.log('[TTS] Tauri TTS 插件未安装，使用浏览器原生 TTS');
    this.backend = 'browser';
  }

  /**
   * 初始化浏览器原生 TTS
   */
  initBrowserTTS() {
    if ('speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();

      // 监听语音列表变化
      this.synth.onvoiceschanged = () => {
        this.loadVoices();
      };

      console.log('[TTS] 浏览器 TTS API 已初始化');
    } else {
      console.warn('[TTS] 浏览器不支持 speechSynthesis');
    }
  }

  /**
   * 加载可用语音
   */
  loadVoices() {
    if (!this.synth) return;

    this.voices = this.synth.getVoices();

    // 按语言分组
    this.voicesByLang = {};
    this.voices.forEach(voice => {
      const lang = voice.lang.split('-')[0];
      if (!this.voicesByLang[lang]) {
        this.voicesByLang[lang] = [];
      }
      this.voicesByLang[lang].push(voice);
    });

    console.log(`[TTS] 已加载 ${this.voices.length} 个语音`);
  }

  /**
   * 获取中文语音
   */
  getChineseVoice() {
    const chineseVoices = this.voices.filter(v =>
      v.lang.includes('zh') || v.lang.includes('CN')
    );

    if (chineseVoices.length > 0) {
      // 优先选择女性声音
      const femaleVoice = chineseVoices.find(v =>
        v.name.includes('female') ||
        v.name.includes('Female') ||
        v.name.includes('女') ||
        v.name.includes('Microsoft') ||
        v.name.includes('Google')
      );
      return femaleVoice || chineseVoices[0];
    }

    return null;
  }

  /**
   * 获取英文语音
   */
  getEnglishVoice() {
    const englishVoices = this.voices.filter(v =>
      v.lang.includes('en')
    );

    return englishVoices[0] || null;
  }

  /**
   * 设置语音参数
   */
  setConfig(config) {
    this.config = { ...this.config, ...config };
  }

  /**
   * 使用预设
   */
  usePreset(presetName) {
    if (ttsConfig.presets[presetName]) {
      this.setConfig(ttsConfig.presets[presetName]);
      console.log(`[TTS] 使用预设: ${presetName}`);
    }
  }

  /**
   * 朗读文本
   */
  async speak(text, options = {}) {
    if (!text || !text.trim()) {
      return false;
    }

    if (this.backend === 'tauri') {
      return this.speakWithTauri(text, options);
    } else {
      return this.speakWithBrowser(text, options);
    }
  }

  /**
   * 使用 Tauri TTS 插件朗读
   */
  async speakWithTauri(text, options = {}) {
    if (!this.ttsPlugin) {
      this.onError(new Error('TTS 插件不可用'));
      return false;
    }

    try {
      this.isSpeaking = true;
      this.onStart({ text });

      // Tauri TTS 参数转换
      await this.ttsPlugin.speak(text, {
        rate: (options.rate || this.config.rate) * 175, // 转换为 WPM
        pitch: options.pitch || this.config.pitch,
        volume: options.volume || this.config.volume
      });

      this.isSpeaking = false;
      this.onEnd({ text });
      return true;
    } catch (e) {
      console.error('[TTS] Tauri TTS 错误:', e);
      this.isSpeaking = false;
      this.onError(e);
      return false;
    }
  }

  /**
   * 使用浏览器原生 API 朗读
   */
  speakWithBrowser(text, options = {}) {
    if (!this.synth) {
      this.onError(new Error('TTS 服务不可用'));
      return false;
    }

    if (this.isSpeaking) {
      // 添加到队列
      this.queue.push({ text, options });
      console.log(`[TTS] 添加到队列，当前队列长度: ${this.queue.length}`);
      return true;
    }

    // 创建语音合成对象
    const utterance = new SpeechSynthesisUtterance(text);

    // 设置参数
    utterance.lang = options.lang || this.config.lang;
    utterance.rate = options.rate || this.config.rate;
    utterance.pitch = options.pitch || this.config.pitch;
    utterance.volume = options.volume || this.config.volume;

    // 选择语音
    if (options.voice) {
      utterance.voice = options.voice;
    } else if (utterance.lang.includes('zh')) {
      const chineseVoice = this.getChineseVoice();
      if (chineseVoice) utterance.voice = chineseVoice;
    } else if (utterance.lang.includes('en')) {
      const englishVoice = this.getEnglishVoice();
      if (englishVoice) utterance.voice = englishVoice;
    }

    // 事件处理
    utterance.onstart = () => {
      this.isSpeaking = true;
      this.currentUtterance = utterance;
      this.onStart({ text });
      console.log(`[TTS] 开始朗读: ${text.substring(0, 50)}...`);
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.currentUtterance = null;
      this.onEnd({ text });
      this.processQueue();
    };

    utterance.onerror = (event) => {
      this.isSpeaking = false;
      this.currentUtterance = null;
      this.onError(event);
      this.processQueue();
    };

    utterance.onboundary = (event) => {
      this.onProgress({
        name: event.name,
        charIndex: event.charIndex,
        charLength: event.charLength,
        elapsedTime: event.elapsedTime
      });
    };

    // 开始朗读
    this.synth.speak(utterance);
    return true;
  }

  /**
   * 处理队列
   */
  processQueue() {
    if (this.queue.length > 0 && !this.isSpeaking) {
      const next = this.queue.shift();
      setTimeout(() => {
        this.speak(next.text, next.options);
      }, 100);
    }
  }

  /**
   * 停止朗读
   */
  stop() {
    if (this.backend === 'tauri' && this.ttsPlugin) {
      this.ttsPlugin.stop();
    } else if (this.synth) {
      this.synth.cancel();
    }
    this.isSpeaking = false;
    this.queue = [];
    this.currentUtterance = null;
    console.log('[TTS] 已停止');
  }

  /**
   * 暂停朗读
   */
  pause() {
    if (this.backend === 'browser' && this.synth && this.isSpeaking) {
      this.synth.pause();
      console.log('[TTS] 已暂停');
    }
  }

  /**
   * 恢复朗读
   */
  resume() {
    if (this.backend === 'browser' && this.synth) {
      this.synth.resume();
      console.log('[TTS] 已恢复');
    }
  }

  /**
   * 检查是否正在朗读
   */
  getIsSpeaking() {
    return this.isSpeaking;
  }

  /**
   * 获取队列长度
   */
  getQueueLength() {
    return this.queue.length;
  }

  /**
   * 获取可用语音列表
   */
  getAvailableVoices() {
    if (this.backend === 'tauri') {
      return [
        { name: 'System Default', lang: 'zh-CN', localService: true },
        { name: 'System English', lang: 'en-US', localService: true }
      ];
    }
    return this.voices;
  }

  /**
   * 获取当前后端类型
   */
  getBackend() {
    return this.backend;
  }

  /**
   * 销毁服务
   */
  destroy() {
    this.stop();
    this.synth = null;
    this.ttsPlugin = null;
    this.voices = [];
    console.log('[TTS] 服务已销毁');
  }
}

/**
 * AI 语音助手类
 * 结合语音识别和 TTS
 */
export class AIAudioAssistant {
  constructor(options = {}) {
    this.tts = new TTSService(options);
    this.speechRecognition = null;
    this.isListening = false;

    // 配置
    this.wakeWord = options.wakeWord || '小助手';
    this.autoResponse = options.autoResponse !== false;

    // 回调
    this.onWakeWordDetected = options.onWakeWordDetected || (() => {});
    this.onCommandRecognized = options.onCommandRecognized || (() => {});
    this.onSpeakingStart = options.onSpeakingStart || (() => {});
    this.onSpeakingEnd = options.onSpeakingEnd || (() => {});

    // 命令映射
    this.commandHandlers = new Map();

    // 初始化语音识别
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.speechRecognition = new SpeechRecognition();
      this.speechRecognition.lang = options.lang || 'zh-CN';
      this.speechRecognition.continuous = true;
      this.speechRecognition.interimResults = true;

      this.speechRecognition.onresult = (event) => {
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

        if (finalTranscript) {
          this.processCommand(finalTranscript);
        }
      };

      this.speechRecognition.onerror = (event) => {
        if (event.error !== 'no-speech') {
          console.error('[AI助手] 识别错误:', event.error);
        }
      };

      this.speechRecognition.onend = () => {
        if (this.isListening) {
          try {
            this.speechRecognition.start();
          } catch (e) {
            console.warn('[AI助手] 重新启动识别失败');
          }
        }
      };
    }

    // TTS 事件
    this.tts.onStart = () => this.onSpeakingStart();
    this.tts.onEnd = () => this.onSpeakingEnd();
  }

  /**
   * 开始监听
   */
  startListening() {
    if (!this.speechRecognition) {
      console.warn('[AI助手] 语音识别不可用');
      return false;
    }

    if (this.isListening) return true;

    try {
      this.speechRecognition.start();
      this.isListening = true;
      console.log('[AI助手] 开始监听');
      return true;
    } catch (e) {
      console.error('[AI助手] 启动监听失败:', e);
      return false;
    }
  }

  /**
   * 停止监听
   */
  stopListening() {
    if (this.speechRecognition && this.isListening) {
      this.speechRecognition.stop();
      this.isListening = false;
      console.log('[AI助手] 已停止监听');
    }
  }

  /**
   * 处理命令
   */
  processCommand(text) {
    const normalizedText = text.toLowerCase().trim();
    console.log('[AI助手] 识别到:', text);

    // 检查唤醒词
    if (!normalizedText.includes(this.wakeWord.toLowerCase())) {
      return;
    }

    this.onWakeWordDetected(text);

    // 提取命令
    const commandText = normalizedText
      .replace(this.wakeWord.toLowerCase(), '')
      .trim();

    if (!commandText) return;

    // 查找命令处理器
    for (const [pattern, handler] of this.commandHandlers) {
      if (commandText.includes(pattern)) {
        this.onCommandRecognized({ text, pattern, commandText });
        const response = handler(commandText);
        if (response && this.autoResponse) {
          this.speak(response);
        }
        return;
      }
    }

    // 默认回复
    this.speak('抱歉，我没有理解您的命令');
  }

  /**
   * 注册命令
   */
  registerCommand(pattern, handler) {
    this.commandHandlers.set(pattern.toLowerCase(), handler);
  }

  /**
   * 说话
   */
  speak(text, options = {}) {
    return this.tts.speak(text, options);
  }

  /**
   * 停止说话
   */
  stopSpeaking() {
    this.tts.stop();
  }

  /**
   * 设置唤醒词
   */
  setWakeWord(word) {
    this.wakeWord = word;
  }

  /**
   * 销毁
   */
  destroy() {
    this.stopListening();
    this.tts.destroy();
    this.commandHandlers.clear();
  }
}

// 导出单例
export const ttsService = new TTSService();
export const aiAudioAssistant = new AIAudioAssistant();

// 便捷函数
export const speak = (text, options) => ttsService.speak(text, options);
export const stopSpeaking = () => ttsService.stop();
export const pauseSpeaking = () => ttsService.pause();
export const resumeSpeaking = () => ttsService.resume();
