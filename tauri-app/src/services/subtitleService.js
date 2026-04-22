// 语音识别和字幕生成服务

/**
 * 增强版语音识别服务类
 * 支持更多配置选项和优化
 */
export class SpeechRecognitionService {
  constructor(options = {}) {
    this.recognition = null;
    this.isRecognizing = false;
    this.onResult = options.onResult || (() => { });
    this.onError = options.onError || (() => { });
    this.onEnd = options.onEnd || (() => { });
    this.lang = options.lang || 'zh-CN';
    this.continuous = options.continuous !== false;
    this.interimResults = options.interimResults !== false;
    this.maxAlternatives = options.maxAlternatives || 1;
    this.useLegacyMode = options.useLegacyMode || false; // 使用旧版模式以提高兼容性

    this.init();
  }

  init() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = this.continuous;
      this.recognition.interimResults = this.interimResults;
      this.recognition.lang = this.lang;
      this.recognition.maxAlternatives = this.maxAlternatives;

      this.setupEventListeners();
    } else {
      console.warn('浏览器不支持语音识别');
    }
  }

  setupEventListeners() {
    if (!this.recognition) return;

    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';
      let confidence = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        // 获取置信度（0-1之间）
        if (result[0].confidence) {
          confidence = result[0].confidence;
        }

        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      this.onResult({
        final: finalTranscript,
        interim: interimTranscript,
        isFinal: !!finalTranscript,
        confidence: confidence // 添加置信度信息
      });
    };

    this.recognition.onerror = (event) => {
      console.error('语音识别错误:', event.error);
      this.onError({
        error: event.error,
        message: this.getErrorMessage(event.error)
      });
    };

    this.recognition.onstart = () => {
      console.log('[语音识别] 识别已开始');
    };

    this.recognition.onspeechstart = () => {
      console.log('[语音识别] 检测到语音开始');
    };

    this.recognition.onspeechend = () => {
      console.log('[语音识别] 检测到语音结束');
    };

    this.recognition.onend = () => {
      console.log('[语音识别] 识别已结束');
      if (this.isRecognizing) {
        // 如果仍在识别状态，重新启动
        try {
          this.recognition.start();
          console.log('[语音识别] 自动重启识别');
        } catch (error) {
          console.warn('[语音识别] 重启识别失败:', error);
        }
      }
      this.onEnd();
    };
  }

  getErrorMessage(error) {
    const errorMessages = {
      'no-speech': '未检测到语音，请检查麦克风连接和音量',
      'audio-capture': '无法捕获音频，请检查麦克风权限',
      'not-allowed': '麦克风权限被拒绝，请在浏览器设置中允许麦克风访问',
      'network': '网络错误，请检查网络连接',
      'aborted': '识别已中止',
      'not-allowed': '麦克风权限被拒绝'
    };
    return errorMessages[error] || `未知错误: ${error}`;
  }

  start() {
    if (!this.recognition) {
      throw new Error('浏览器不支持语音识别');
    }

    if (this.isRecognizing) {
      return false;
    }

    try {
      this.recognition.start();
      this.isRecognizing = true;
      console.log('[语音识别] 启动成功');
      return true;
    } catch (error) {
      console.error('[语音识别] 启动失败:', error);
      return false;
    }
  }

  stop() {
    if (!this.recognition || !this.isRecognizing) {
      return false;
    }

    try {
      this.recognition.stop();
      this.isRecognizing = false;
      console.log('[语音识别] 已停止');
      return true;
    } catch (error) {
      console.error('[语音识别] 停止失败:', error);
      return false;
    }
  }

  setLanguage(lang) {
    this.lang = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
      console.log(`[语音识别] 语言已切换为: ${lang}`);
    }
  }

  destroy() {
    this.stop();
    this.recognition = null;
    console.log('[语音识别] 服务已销毁');
  }
}

/**
 * 字幕管理服务类
 */
export class SubtitleService {
  constructor() {
    this.subtitles = [];
    this.currentTime = 0;
    this.listeners = [];
  }

  addSubtitle(subtitle) {
    const newSubtitle = {
      id: Date.now(),
      startTime: subtitle.startTime || this.formatTime(this.currentTime),
      endTime: subtitle.endTime || this.formatTime(this.currentTime + 5),
      text: subtitle.text || '',
      ...subtitle
    };
    this.subtitles.push(newSubtitle);
    this.notifyListeners('add', newSubtitle);
    return newSubtitle;
  }

  updateSubtitle(id, updates) {
    const index = this.subtitles.findIndex(s => s.id === id);
    if (index > -1) {
      this.subtitles[index] = { ...this.subtitles[index], ...updates };
      this.notifyListeners('update', this.subtitles[index]);
    }
  }

  removeSubtitle(id) {
    const index = this.subtitles.findIndex(s => s.id === id);
    if (index > -1) {
      const removed = this.subtitles.splice(index, 1)[0];
      this.notifyListeners('remove', removed);
    }
  }

  getSubtitleAtTime(time) {
    return this.subtitles.find(subtitle => {
      return time >= this.parseTime(subtitle.startTime) && time <= this.parseTime(subtitle.endTime);
    });
  }

  getAllSubtitles() {
    return [...this.subtitles];
  }

  clearSubtitles() {
    this.subtitles = [];
    this.notifyListeners('clear', null);
  }

  exportSRT() {
    let srtContent = '';
    this.subtitles.forEach((subtitle, index) => {
      srtContent += `${index + 1}\n`;
      srtContent += `${subtitle.startTime} --> ${subtitle.endTime}\n`;
      srtContent += `${subtitle.text}\n\n`;
    });
    return srtContent;
  }

  importSRT(srtContent) {
    this.subtitles = [];
    const lines = srtContent.split('\n');
    let currentSubtitle = null;
    let index = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line === String(index)) {
        // 序号行
        if (currentSubtitle) {
          this.subtitles.push(currentSubtitle);
        }
        currentSubtitle = { id: Date.now() + index, startTime: '', endTime: '', text: '' };
        index++;
      } else if (line.includes('-->')) {
        // 时间行
        const times = line.split('-->');
        if (times.length === 2 && currentSubtitle) {
          currentSubtitle.startTime = times[0].trim();
          currentSubtitle.endTime = times[1].trim();
        }
      } else if (line && currentSubtitle) {
        // 文本行
        currentSubtitle.text += (currentSubtitle.text ? '\n' : '') + line;
      }
    }

    if (currentSubtitle) {
      this.subtitles.push(currentSubtitle);
    }

    return this.subtitles;
  }

  exportVTT() {
    let vttContent = 'WEBVTT\n\n';
    this.subtitles.forEach((subtitle) => {
      vttContent += `${subtitle.startTime} --> ${subtitle.endTime}\n`;
      vttContent += `${subtitle.text}\n\n`;
    });
    return vttContent;
  }

  importVTT(vttContent) {
    // VTT 格式与 SRT 类似，但时间格式不同
    this.importSRT(vttContent.replace('WEBVTT\n\n', ''));
    return this.subtitles;
  }

  saveToStorage(key) {
    const data = JSON.stringify(this.subtitles);
    localStorage.setItem(key, data);
  }

  loadFromStorage(key) {
    const data = localStorage.getItem(key);
    if (data) {
      try {
        this.subtitles = JSON.parse(data);
        return this.subtitles;
      } catch (error) {
        console.error('加载字幕失败:', error);
      }
    }
    return [];
  }

  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
  }

  parseTime(timeString) {
    // 解析时间字符串为秒
    const parts = timeString.replace(',', '.').split(':');
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;

    return hours * 3600 + minutes * 60 + seconds;
  }

  addListener(callback) {
    this.listeners.push(callback);
  }

  removeListener(callback) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      callback(event, data);
    });
  }

  mergeAdjacentSubtitles(gapThreshold = 1) {
    const merged = [];
    let previous = null;

    for (const subtitle of this.subtitles) {
      if (previous) {
        const prevEnd = this.parseTime(previous.endTime);
        const currStart = this.parseTime(subtitle.startTime);

        if (currStart - prevEnd <= gapThreshold) {
          // 合并字幕
          previous.endTime = subtitle.endTime;
          previous.text += ' ' + subtitle.text;
          continue;
        }
      }

      merged.push(subtitle);
      previous = subtitle;
    }

    this.subtitles = merged;
    this.notifyListeners('merge', null);
    return this.subtitles;
  }

  splitLongSubtitles(maxLength = 50) {
    const split = [];

    for (const subtitle of this.subtitles) {
      const text = subtitle.text.trim();
      if (text.length <= maxLength) {
        split.push(subtitle);
        continue;
      }

      // 拆分长字幕
      const words = text.split('');
      const middle = Math.ceil(words.length / 2);
      const firstHalf = words.slice(0, middle).join('');
      const secondHalf = words.slice(middle).join('');

      const startTime = this.parseTime(subtitle.startTime);
      const endTime = this.parseTime(subtitle.endTime);
      const duration = (endTime - startTime) / 2;

      split.push({
        ...subtitle,
        id: subtitle.id + '_1',
        text: firstHalf,
        endTime: this.formatTime(startTime + duration)
      });

      split.push({
        ...subtitle,
        id: subtitle.id + '_2',
        text: secondHalf,
        startTime: this.formatTime(startTime + duration)
      });
    }

    this.subtitles = split;
    this.notifyListeners('split', null);
    return this.subtitles;
  }
}

/**
 * 字幕生成器 - 模拟 AI 生成
 */
export class SubtitleGenerator {
  constructor() {
    this.isGenerating = false;
    this.progress = 0;
  }

  async generateFromAudio(audioFile, options = {}) {
    if (this.isGenerating) {
      throw new Error('正在生成中');
    }

    this.isGenerating = true;
    this.progress = 0;

    try {
      // 模拟生成过程
      // 实际项目中应该调用后端 AI 服务
      const duration = audioFile.duration || 60;
      const stepDuration = 1000;
      const totalSteps = Math.ceil(duration / stepDuration);

      for (let i = 0; i < totalSteps; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        this.progress = ((i + 1) / totalSteps) * 100;
      }

      // 生成示例字幕
      const subtitles = this.generateSampleSubtitles(duration);
      return subtitles;
    } finally {
      this.isGenerating = false;
      this.progress = 0;
    }
  }

  generateSampleSubtitles(duration) {
    const subtitles = [];
    const sampleTexts = [
      '大家好，欢迎来到今天的课程',
      '今天我们要学习的是计算机网络基础',
      '首先，让我们了解一下什么是网络协议',
      '网络协议是计算机网络中通信双方必须遵守的规则',
      '常见的网络协议包括 TCP/IP、HTTP、FTP 等',
      'TCP/IP 是互联网的基础协议',
      'HTTP 是用于传输网页的协议',
      'FTP 是用于文件传输的协议',
      '接下来，我们学习如何配置网络',
      '希望大家认真学习，有问题随时提问'
    ];

    let currentTime = 0;
    const segmentDuration = duration / sampleTexts.length;

    for (let i = 0; i < sampleTexts.length; i++) {
      const startTime = currentTime;
      const endTime = currentTime + segmentDuration;

      subtitles.push({
        id: Date.now() + i,
        startTime: this.formatSeconds(startTime),
        endTime: this.formatSeconds(endTime),
        text: sampleTexts[i]
      });

      currentTime = endTime;
    }

    return subtitles;
  }

  formatSeconds(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
  }

  onProgress(callback) {
    this.progressCallback = callback;
  }

  updateProgress() {
    if (this.progressCallback) {
      this.progressCallback(this.progress);
    }
  }
}

// 导出单例实例
export const speechRecognition = new SpeechRecognitionService();
export const subtitleService = new SubtitleService();
export const subtitleGenerator = new SubtitleGenerator();
