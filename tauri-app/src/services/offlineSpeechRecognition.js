// 离线语音识别服务 - 使用 Whisper.cpp
// 完全本地运行，无需联网

import Worker from '@/workers/whisper-worker.js';

/**
 * 离线语音识别服务类
 */
export class OfflineSpeechRecognitionService {
  constructor(options = {}) {
    this.worker = null;
    this.isRecognizing = false;
    this.onResult = options.onResult || (() => {});
    this.onError = options.onError || (() => {});
    this.onEnd = options.onEnd || (() => {});
    this.lang = options.lang || 'zh';
    this.model = options.model || 'tiny'; // tiny, base, small, medium, large

    this.init();
  }

  async init() {
    try {
      // 初始化 Web Worker
      this.worker = new Worker();
      
      this.worker.onmessage = (event) => {
        const { type, data } = event.data;
        
        switch (type) {
          case 'ready':
            console.log('Whisper 模型已加载');
            break;
            
          case 'result':
            this.onResult({
              final: data.text,
              interim: '',
              isFinal: true,
              segments: data.segments
            });
            break;
            
          case 'error':
            this.onError({
              error: data.error,
              message: data.message
            });
            break;
            
          case 'end':
            this.onEnd();
            break;
        }
      };

      // 加载模型
      this.worker.postMessage({
        type: 'init',
        data: {
          model: this.model,
          lang: this.lang
        }
      });

    } catch (error) {
      console.error('初始化离线语音识别失败:', error);
      this.onError({
        error: 'init_failed',
        message: '初始化失败，请确保模型文件存在'
      });
    }
  }

  async start(audioData) {
    if (!this.worker) {
      throw new Error('服务未初始化');
    }

    if (this.isRecognizing) {
      return false;
    }

    try {
      this.isRecognizing = true;
      
      this.worker.postMessage({
        type: 'transcribe',
        data: {
          audio: audioData,
          language: this.lang
        }
      });

      return true;
    } catch (error) {
      console.error('开始识别失败:', error);
      this.isRecognizing = false;
      return false;
    }
  }

  stop() {
    if (this.worker && this.isRecognizing) {
      this.worker.postMessage({
        type: 'stop'
      });
      this.isRecognizing = false;
      return true;
    }
    return false;
  }

  setLanguage(lang) {
    this.lang = lang;
    if (this.worker) {
      this.worker.postMessage({
        type: 'set_language',
        data: { language: lang }
      });
    }
  }

  destroy() {
    this.stop();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

/**
 * 实时音频流识别服务
 */
export class OfflineStreamRecognitionService {
  constructor(options = {}) {
    this.recognition = null;
    this.audioContext = null;
    this.mediaStream = null;
    this.processor = null;
    this.isRecognizing = false;
    this.onResult = options.onResult || (() => {});
    this.onError = options.onError || (() => {});
    this.onEnd = options.onEnd || (() => {});
    this.lang = options.lang || 'zh';
    this.model = options.model || 'tiny';
    this.bufferSize = options.bufferSize || 4096;
    this.recognitionInterval = options.recognitionInterval || 3000; // 3秒识别一次
  }

  async init() {
    try {
      // 创建音频上下文
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });

      // 初始化识别服务
      this.recognition = new OfflineSpeechRecognitionService({
        lang: this.lang,
        model: this.model,
        onResult: this.onResult,
        onError: this.onError,
        onEnd: this.onEnd
      });

      await this.recognition.init();
    } catch (error) {
      console.error('初始化音频识别服务失败:', error);
      throw error;
    }
  }

  async startStream() {
    if (this.isRecognizing) {
      return false;
    }

    try {
      // 获取麦克风权限
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000
        }
      });

      // 创建音频处理器
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.processor = this.audioContext.createScriptProcessor(this.bufferSize, 1, 1);

      // 收集音频数据
      const audioBuffer = [];
      this.processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        audioBuffer.push(new Float32Array(inputData));
      };

      // 连接音频节点
      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      this.isRecognizing = true;

      // 定期识别
      this.recognitionTimer = setInterval(async () => {
        if (audioBuffer.length > 0) {
          // 合并音频数据
          const totalLength = audioBuffer.reduce((sum, arr) => sum + arr.length, 0);
          const mergedAudio = new Float32Array(totalLength);
          let offset = 0;
          for (const chunk of audioBuffer) {
            mergedAudio.set(chunk, offset);
            offset += chunk.length;
          }

          // 开始识别
          await this.recognition.start(mergedAudio);
          
          // 清空缓冲区
          audioBuffer.length = 0;
        }
      }, this.recognitionInterval);

      return true;
    } catch (error) {
      console.error('启动音频流识别失败:', error);
      this.onError({
        error: 'stream_start_failed',
        message: '启动音频流失败: ' + error.message
      });
      return false;
    }
  }

  stopStream() {
    if (this.recognitionTimer) {
      clearInterval(this.recognitionTimer);
      this.recognitionTimer = null;
    }

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    this.recognition?.stop();
    this.isRecognizing = false;
  }

  destroy() {
    this.stopStream();
    this.recognition?.destroy();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

/**
 * 使用 Vosk 的离线识别服务（备选方案）
 */
export class VoskOfflineRecognitionService {
  constructor(options = {}) {
    this.recognition = null;
    this.isRecognizing = false;
    this.onResult = options.onResult || (() => {});
    this.onError = options.onError || (() => {});
    this.onEnd = options.onEnd || (() => {});
    this.lang = options.lang || 'zh-CN';
    this.modelPath = options.modelPath || '/models/vosk-model-small-cn-0.22';
    
    this.init();
  }

  async init() {
    try {
      // 动态加载 Vosk 库
      if (!window.vosk) {
        await this.loadVoskLibrary();
      }

      // 创建识别器
      const model = new vosk.Model(this.modelPath);
      this.recognition = new vosk.Recognizer(model, this.modelPath + '/zh-CN');
      
      console.log('Vosk 模型已加载');
    } catch (error) {
      console.error('初始化 Vosk 识别失败:', error);
      this.onError({
        error: 'init_failed',
        message: '初始化失败: ' + error.message
      });
    }
  }

  async loadVoskLibrary() {
    // 动态加载 Vosk 库
    const script = document.createElement('script');
    script.src = '/lib/vosk.js';
    script.async = true;
    
    return new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async processAudio(audioData) {
    if (!this.recognition) {
      throw new Error('识别器未初始化');
    }

    try {
      this.recognition.acceptWaveform(audioData);
      
      if (this.recognition.finalResult) {
        const result = JSON.parse(this.recognition.finalResult);
        this.onResult({
          final: result.text,
          interim: '',
          isFinal: true
        });
      } else if (this.recognition.partialResult) {
        const result = JSON.parse(this.recognition.partialResult);
        this.onResult({
          final: '',
          interim: result.partial,
          isFinal: false
        });
      }
    } catch (error) {
      console.error('处理音频失败:', error);
      this.onError({
        error: 'process_failed',
        message: '处理音频失败: ' + error.message
      });
    }
  }

  async startStream() {
    if (this.isRecognizing) {
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      this.isRecognizing = true;

      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        this.processAudio(inputData);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      return true;
    } catch (error) {
      console.error('启动 Vosk 识别失败:', error);
      this.onError({
        error: 'stream_start_failed',
        message: '启动识别失败: ' + error.message
      });
      return false;
    }
  }

  stop() {
    if (this.recognition) {
      this.recognition.reset();
    }
    this.isRecognizing = false;
  }

  destroy() {
    this.stop();
    this.recognition = null;
  }
}

/**
 * 本地字幕生成服务
 * 使用本地模型生成字幕
 */
export class LocalSubtitleGenerator {
  constructor(options = {}) {
    this.service = null;
    this.isGenerating = false;
    this.progress = 0;
    this.onProgress = options.onProgress || (() => {});
    this.modelType = options.modelType || 'whisper'; // whisper, vosk
  }

  async generateFromFile(file) {
    if (this.isGenerating) {
      throw new Error('正在生成中');
    }

    this.isGenerating = true;
    this.progress = 0;

    try {
      // 创建离线识别服务
      this.service = new OfflineSpeechRecognitionService({
        lang: 'zh',
        model: 'base',
        onResult: (result) => {
          console.log('识别结果:', result);
        }
      });

      await this.service.init();

      // 读取音频文件
      const audioData = await this.readAudioFile(file);

      // 开始识别
      await this.service.start(audioData);

      return [];
    } catch (error) {
      console.error('生成字幕失败:', error);
      throw error;
    } finally {
      this.isGenerating = false;
      this.progress = 0;
      this.service?.destroy();
    }
  }

  async readAudioFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const audioBuffer = await audioContext.decodeAudioData(event.target.result);
          const audioData = audioBuffer.getChannelData(0);
          resolve(audioData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  generateSampleSubtitles(duration) {
    // 模拟字幕生成（实际使用离线模型）
    const subtitles = [
      { startTime: '00:00:00,000', endTime: '00:00:03,500', text: '大家好，欢迎来到今天的课程' },
      { startTime: '00:00:03,500', endTime: '00:00:07,200', text: '今天我们要学习的是计算机网络基础' },
      { startTime: '00:00:07,200', endTime: '00:00:11,800', text: '首先，让我们了解一下什么是网络协议' }
    ];
    return subtitles;
  }
}

// 导出单例实例
export const offlineSpeechRecognition = new OfflineSpeechRecognitionService();
export const offlineStreamRecognition = new OfflineStreamRecognitionService();
export const localSubtitleGenerator = new LocalSubtitleGenerator();
