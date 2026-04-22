/**
 * 视频文件实时转字幕服务
 * 监听视频文件的音频流，实时转换为字幕
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { ElMessage } from 'element-plus';
import { ref } from 'vue';

// 字幕数据结构
export class SubtitleData {
  constructor(text) {
    this.text = text;
    this.timestamp = Date.now();
  }
}

/**
 * 视频文件实时转字幕服务
 */
class VideoToSubtitleService {
  constructor() {
    this.isRecognizing = false;
    this.currentVideoPath = null;
    this.currentVideoElement = null;
    this.subtitleText = ref('');
    this.listeners = [];
    this.speechResultListener = null;
    this.audioContext = null;
    this.mediaElementSource = null;
    this.scriptProcessor = null;
    this.isBlobMode = false;
    this.recognitionInterval = null;
  }

  /**
   * 添加字幕监听器
   */
  addSubtitleListener(listener) {
    this.listeners.push(listener);
  }

  /**
   * 移除字幕监听器
   */
  removeSubtitleListener(listener) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 通知所有监听器
   */
  notifyListeners(subtitle) {
    this.listeners.forEach(listener => listener(subtitle));
  }

  /**
   * 更新字幕文本
   */
  updateSubtitle(text) {
    this.subtitleText.value = text;
    this.notifyListeners(new SubtitleData(text));
  }

  /**
   * 开始监听视频音频并实时转字幕
   */
  async startVideoSubtitle(videoPathOrElement, options = {}) {
    const {
      language = 'zh',
      modelType = 'tiny',
      onProgress = null
    } = options;

    if (this.isRecognizing) {
      console.warn('[视频转字幕] 识别已在运行');
      return;
    }

    try {
      // 判断是文件路径还是视频元素
      const isVideoElement = videoPathOrElement instanceof HTMLVideoElement;

      if (isVideoElement) {
        console.log('[视频转字幕] 使用 Blob URL 模式，直接从视频元素捕获音频');
        this.isBlobMode = true;
        this.currentVideoElement = videoPathOrElement;

        // 使用 Web Audio API 直接从视频元素捕获音频
        await this.startBlobModeSubtitle(videoPathOrElement, options);
      } else {
        console.log('[视频转字幕] 使用文件模式，通过 Tauri 后端捕获音频');
        this.isBlobMode = false;
        this.currentVideoPath = videoPathOrElement;

        // 检查视频文件是否存在
        const fileExists = await invoke('file_exists', { path: videoPathOrElement });
        if (!fileExists) {
          throw new Error('视频文件不存在');
        }

        this.currentVideoPath = videoPathOrElement;
        this.isRecognizing = true;

        // 监听语音识别结果事件
        this.speechResultListener = await listen('video_speech_result', (event) => {
          console.log('[视频转字幕] 收到识别结果:', event.payload);
          const result = event.payload;

          if (result && result.text) {
            this.updateSubtitle(result.text);
          }
        });

        // 调用 Tauri 后端开始视频音频监听
        await invoke('start_video_audio_capture', {
          videoPath: videoPathOrElement,
          language,
          modelType
        });

        if (onProgress) {
          onProgress({
            isRecognizing: true,
            videoPath: videoPathOrElement
          });
        }

        ElMessage.success('视频字幕识别已启动');
      }

    } catch (error) {
      console.error('[视频转字幕] 启动失败:', error);
      this.isRecognizing = false;

      // 检查是否是"视频音频捕获已在运行"的错误
      if (error.message && error.message.includes('视频音频捕获已在运行')) {
        ElMessage.warning('视频音频捕获已在运行，请先停止当前的视频转字幕功能');
      } else if (error.message && error.message.includes('Whisper 未初始化')) {
        ElMessage.error('Whisper 未初始化，请先初始化 Whisper 模型');
      } else {
        ElMessage.error('启动视频字幕识别失败: ' + error.message);
      }
      throw error;
    }
  }

  /**
   * 停止视频字幕识别
   */
  async stopVideoSubtitle() {
    if (!this.isRecognizing) {
      console.warn('[视频转字幕] 识别未运行');
      return;
    }

    try {
      console.log('[视频转字幕] 停止监听视频:', this.currentVideoPath);

      // 停止浏览器原生 SpeechRecognition
      if (this.browserRecognition) {
        try {
          this.browserRecognition.stop();
          this.browserRecognition.onresult = null;
          this.browserRecognition.onerror = null;
          this.browserRecognition.onend = null;
          this.browserRecognition = null;
          console.log('[视频转字幕] ✅ 已停止浏览器语音识别');
        } catch (e) {
          console.warn('[视频转字幕] 停止浏览器语音识别失败:', e);
        }
      }

      // 如果是 Blob URL 模式，清理 Web Audio API 资源
      if (this.isBlobMode) {
        console.log('[视频转字幕] 停止 Blob URL 模式，清理 Web Audio API 资源');

        // 停止视频播放
        if (this.currentVideoElement) {
          this.currentVideoElement.pause();
          this.currentVideoElement = null;
        }

        // 清理 ScriptProcessor
        if (this.scriptProcessor) {
          this.scriptProcessor.disconnect();
          this.scriptProcessor.onaudioprocess = null;
          this.scriptProcessor = null;
        }

        // 清理 MediaElementSource
        if (this.mediaElementSource) {
          this.mediaElementSource.disconnect();
          this.mediaElementSource = null;
        }

        // 清理 AudioContext
        if (this.audioContext) {
          this.audioContext.close();
          this.audioContext = null;
        }

        // 停止识别间隔
        if (this.recognitionInterval) {
          clearInterval(this.recognitionInterval);
          this.recognitionInterval = null;
        }
      } else {
        // 文件模式：停止音频捕获
        console.log('[视频转字幕] 停止文件模式，停止音频捕获');
        await invoke('stop_video_audio_capture');
      }

      // 取消事件监听
      if (this.speechResultListener) {
        this.speechResultListener();
        this.speechResultListener = null;
      }

      this.isRecognizing = false;
      this.currentVideoPath = null;
      this.currentVideoElement = null;
      this.updateSubtitle('');

      ElMessage.info('视频字幕识别已停止');
    } catch (error) {
      console.error('[视频转字幕] 停止失败:', error);
      ElMessage.error('停止视频字幕识别失败: ' + error.message);
      throw error;
    }
  }

  /**
   * 使用浏览器原生 SpeechRecognition API (最简单方案)
   */
  async startBrowserSpeechRecognition(videoElement, options = {}) {
    const {
      language = 'zh-CN',
      onProgress = null
    } = options;

    if (this.isRecognizing) {
      console.warn('[视频转字幕] 识别已在运行');
      return;
    }

    // 检查浏览器是否支持 SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      ElMessage.error('您的浏览器不支持语音识别功能，请使用 Chrome 或 Edge 浏览器');
      throw new Error('浏览器不支持 SpeechRecognition API');
    }

    try {
      console.log('[视频转字幕] ✅ 使用浏览器原生 SpeechRecognition API');

      // 创建语音识别实例
      this.browserRecognition = new SpeechRecognition();
      this.browserRecognition.continuous = true; // 持续识别
      this.browserRecognition.interimResults = true; // 返回临时结果
      this.browserRecognition.lang = language;
      this.browserRecognition.maxAlternatives = 1;

      // 监听识别结果
      this.browserRecognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        // 优先显示最终结果，否则显示临时结果
        const displayText = finalTranscript || interimTranscript;
        if (displayText.trim()) {
          this.updateSubtitle(displayText.trim());
          console.log('[视频转字幕] 📝 识别结果:', displayText);
        }
      };

      this.browserRecognition.onerror = (event) => {
        console.error('[视频转字幕] ❌ 识别错误:', event.error);
        if (event.error === 'not-allowed') {
          ElMessage.error('麦克风权限被拒绝，请允许麦克风访问');
        } else if (event.error === 'no-speech') {
          console.warn('[视频转字幕] ⚠️ 未检测到语音');
        }
      };

      this.browserRecognition.onend = () => {
        console.log('[视频转字幕] 识别结束');
        // 如果仍在识别状态，自动重启(实现持续识别)
        if (this.isRecognizing) {
          try {
            this.browserRecognition.start();
          } catch (e) {
            console.warn('[视频转字幕] 重启识别失败:', e);
          }
        }
      };

      // 开始识别
      this.browserRecognition.start();
      this.isRecognizing = true;
      this.currentVideoElement = videoElement;

      if (onProgress) {
        onProgress({
          isRecognizing: true,
          videoPath: videoElement.src
        });
      }

      ElMessage.success('✅ 视频字幕识别已启动（使用浏览器语音识别）');
    } catch (error) {
      console.error('[视频转字幕] 启动失败:', error);
      this.isRecognizing = false;
      ElMessage.error('启动视频字幕识别失败: ' + error.message);
      throw error;
    }
  }

  /**
   * 使用 Web Audio API 从视频元素捕获音频
   */
  async startBlobModeSubtitle(videoElement, options = {}) {
    const {
      language = 'zh',
      modelType = 'tiny',
      onProgress = null
    } = options;

    if (this.isRecognizing) {
      console.warn('[视频转字幕] 识别已在运行');
      return;
    }

    try {
      console.log('[视频转字幕] 开始从视频元素捕获音频');

      // ⚠️ 检查 Whisper 是否已初始化
      let whisperInitialized = false;
      try {
        whisperInitialized = await invoke('get_whisper_status');
      } catch (error) {
        console.warn('[视频转字幕] Whisper 状态检查失败:', error.message);
      }

      if (!whisperInitialized) {
        console.warn('[视频转字幕] ⚠️ Whisper 未配置，切换到浏览器原生API');
        ElMessage.info({
          message: 'Whisper 未配置，已自动切换到浏览器语音识别（需要麦克风权限）',
          duration: 5000,
          showClose: true
        });
        
        // 使用浏览器原生 SpeechRecognition API
        await this.startBrowserSpeechRecognition(videoElement, {
          language: language === 'zh' ? 'zh-CN' : language,
          onProgress
        });
        return; // 直接返回，不执行后面的 Web Audio API 逻辑
      }

      // 监听后端返回的字幕结果
      this.speechResultListener = await listen('subtitle_result', (event) => {
        console.log('[视频转字幕] 收到识别结果:', event.payload);
        if (event.payload && typeof event.payload === 'string') {
          this.updateSubtitle(event.payload);
        }
      });

      // 初始化 Web Audio API
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      }

      // 创建 MediaElementSource
      this.mediaElementSource = this.audioContext.createMediaElementSource(videoElement);

      // 创建 ScriptProcessor
      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

      // 连接节点
      this.mediaElementSource.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);

      // 处理音频数据
      this.scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
        const inputData = audioProcessingEvent.inputBuffer;
        const inputDataLength = inputData.length;

        // 将音频数据转换为 Int16
        const int16Data = new Int16Array(inputDataLength);
        for (let i = 0; i < inputDataLength; i++) {
          const sample = inputData[i];
          int16Data[i] = Math.max(-32768, Math.min(32767, sample * 32767));
        }

        // 发送音频数据给后端进行识别
        invoke('process_audio_data', {
          audioData: Array.from(int16Data)
        }).catch(error => {
          console.error('[视频转字幕] 处理音频数据失败:', error);
        });
      };

      // 开始识别
      this.isRecognizing = true;
      this.currentVideoElement = videoElement;

      if (onProgress) {
        onProgress({
          isRecognizing: true,
          videoPath: videoElement.src
        });
      }

      ElMessage.success('视频字幕识别已启动');
    } catch (error) {
      console.error('[视频转字幕] 启动失败:', error);
      this.isRecognizing = false;

      // 清理资源
      if (this.speechResultListener) {
        this.speechResultListener();
        this.speechResultListener = null;
      }
      if (this.scriptProcessor) {
        this.scriptProcessor.disconnect();
        this.scriptProcessor.onaudioprocess = null;
        this.scriptProcessor = null;
      }
      if (this.mediaElementSource) {
        this.mediaElementSource.disconnect();
        this.mediaElementSource = null;
      }

      ElMessage.error('启动视频字幕识别失败: ' + error.message);
    }
  }

  /**
   * 获取当前字幕文本
   */
  getSubtitleText() {
    return this.subtitleText.value;
  }

  /**
   * 获取识别状态
   */
  isRunning() {
    return this.isRecognizing;
  }
}

// 导出单例
export const videoToSubtitleService = new VideoToSubtitleService();

// 导出便捷函数
export async function startVideoSubtitle(videoPath, options) {
  return videoToSubtitleService.startVideoSubtitle(videoPath, options);
}

export async function stopVideoSubtitle() {
  return videoToSubtitleService.stopVideoSubtitle();
}

export function getVideoSubtitleText() {
  return videoToSubtitleService.getSubtitleText();
}

export function isVideoSubtitleRunning() {
  return videoToSubtitleService.isRunning();
}
