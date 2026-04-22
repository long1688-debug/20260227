/**
 * 音频混音器核心类
 * 使用 Web Audio API 实现多路音频混合和选择输出
 * 增强版：添加了更多音频处理功能
 */
export class AudioMixer {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.destinationNode = null;

    // 存储每个源对应的音频节点
    this.sourceNodes = new Map();
    this.gainNodes = new Map();
    this.processors = new Map(); // 存储处理器节点

    // 当前激活的音频源(由下拉菜单控制,只输出选中源的音频)
    this.activeSourceId = null;

    // 是否已初始化
    this.initialized = false;

    // 存储每个源的音量值
    this.storedVolumes = new Map();

    // 音频分析器
    this.analyser = null;
  }

  /**
   * 初始化 AudioContext(必须在用户交互后调用)
   */
  async init() {
    if (this.initialized) return;

    try {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      
      // 初始挂起,等待用户交互
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }

      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 1.0;
      this.destinationNode = this.context.destination;
      this.masterGain.connect(this.destinationNode);

      // 创建分析器用于电平监测
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      this.masterGain.connect(this.analyser);

      this.initialized = true;
      console.log('[AudioMixer] 初始化成功');
    } catch (error) {
      console.error('[AudioMixer] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 恢复 AudioContext(用户交互时调用)
   */
  async resume() {
    if (!this.context) {
      await this.init();
      return;
    }

    if (this.context.state === 'suspended') {
      await this.context.resume();
      console.log('[AudioMixer] AudioContext 已恢复');
    }
  }

  /**
   * 注册视频元素(用于本地文件)
   * @param {string} sourceId - 源ID
   * @param {HTMLVideoElement} videoElement - 视频元素
   * @param {boolean} audioEnabled - 是否启用音频（可选，默认true）
   * @param {number} volume - 音量（可选，默认100）
   */
  registerVideoElement(sourceId, videoElement, audioEnabled = true, volume = 100) {
    if (!this.context) {
      console.warn('[AudioMixer] AudioContext 未初始化,跳过注册');
      return;
    }

    if (this.sourceNodes.has(sourceId)) {
      console.log('[AudioMixer] 视频元素已注册:', sourceId);
      return;
    }

    try {
      const source = this.context.createMediaElementSource(videoElement);
      const gainNode = this.context.createGain();
      // 根据 audioEnabled 状态设置初始音量，不再默认静音
      gainNode.gain.value = audioEnabled ? (volume / 100) : 0;

      source.connect(gainNode).connect(this.masterGain);

      this.sourceNodes.set(sourceId, source);
      this.gainNodes.set(sourceId, gainNode);

      console.log('[AudioMixer] 视频元素注册成功:', sourceId, '音频状态:', audioEnabled, '音量:', volume);
    } catch (error) {
      console.warn('[AudioMixer] 视频元素注册失败:', error);
    }
  }

  /**
   * 注册 MediaStream(用于摄像头和麦克风)
   * @param {string} sourceId - 源ID
   * @param {MediaStream} stream - 媒体流
   */
  registerStream(sourceId, stream) {
    if (!this.context) {
      console.warn('[AudioMixer] AudioContext 未初始化,跳过注册');
      return;
    }

    if (this.sourceNodes.has(sourceId)) {
      console.log('[AudioMixer] 媒体流已注册:', sourceId);
      return;
    }

    try {
      const source = this.context.createMediaStreamSource(stream);
      const gainNode = this.context.createGain();
      gainNode.gain.value = 0; // 默认静音

      source.connect(gainNode).connect(this.masterGain);

      this.sourceNodes.set(sourceId, source);
      this.gainNodes.set(sourceId, gainNode);

      console.log('[AudioMixer] 媒体流注册成功:', sourceId);
    } catch (error) {
      console.error('[AudioMixer] 媒体流注册失败:', error);
    }
  }

  /**
   * 设置当前激活的音频源(下拉菜单选择)
   * @param {string|null} sourceId - 源ID,null表示无音频输出
   */
  setActiveSource(sourceId) {
    this.activeSourceId = sourceId;

    // 所有增益节点设为0
    this.gainNodes.forEach((gain) => {
      gain.gain.value = 0;
    });

    // 激活选中的源 - 使用之前设置的音量值，而不是硬编码为1.0
    if (sourceId && this.gainNodes.has(sourceId)) {
      const gain = this.gainNodes.get(sourceId);
      // 🎯 关键修复：使用存储的音量值，而不是硬编码为1.0
      gain.gain.value = this.storedVolumes.get(sourceId) || 1.0;
      console.log('[AudioMixer] 激活音频源:', sourceId, '音量:', gain.gain.value);
    } else {
      console.log('[AudioMixer] 关闭所有音频输出');
    }
  }

  /**
   * 设置特定源的音量
   * @param {string} sourceId - 源ID
   * @param {number} volume - 音量 0-1
   */
  setVolume(sourceId, volume) {
    const gain = this.gainNodes.get(sourceId);
    if (gain) {
      gain.gain.value = Math.max(0, Math.min(1, volume));
      // 存储音量值，以便激活时使用
      this.storedVolumes.set(sourceId, gain.gain.value);
      console.log('[AudioMixer] 设置音量:', sourceId, volume);
    }
  }

  /**
   * 为特定源添加音频处理器
   * @param {string} sourceId - 源ID
   * @param {string} processorType - 处理器类型 ('equalizer', 'compressor', 'filter')
   * @param {Object} options - 处理器选项
   */
  addProcessor(sourceId, processorType, options = {}) {
    if (!this.context) {
      console.warn('[AudioMixer] AudioContext 未初始化,无法添加处理器');
      return null;
    }

    let processor = null;

    switch (processorType) {
      case 'equalizer':
        // 创建参数化均衡器
        processor = this.context.createBiquadFilter();
        processor.type = 'peaking';
        processor.frequency.value = options.frequency || 1000;
        processor.Q.value = options.Q || 1;
        processor.gain.value = options.gain || 0;
        break;

      case 'compressor':
        // 创建压缩器
        processor = this.context.createDynamicsCompressor();
        processor.threshold.value = options.threshold || -24;
        processor.knee.value = options.knee || 30;
        processor.ratio.value = options.ratio || 12;
        processor.attack.value = options.attack || 0.003;
        processor.release.value = options.release || 0.25;
        break;

      case 'highpass':
        // 创建高通滤波器
        processor = this.context.createBiquadFilter();
        processor.type = 'highpass';
        processor.frequency.value = options.frequency || 80;
        processor.Q.value = options.Q || 0.7;
        break;

      case 'lowpass':
        // 创建低通滤波器
        processor = this.context.createBiquadFilter();
        processor.type = 'lowpass';
        processor.frequency.value = options.frequency || 8000;
        processor.Q.value = options.Q || 0.7;
        break;

      default:
        console.warn('[AudioMixer] 未知处理器类型:', processorType);
        return null;
    }

    if (processor) {
      // 存储处理器以便后续管理
      const key = `${sourceId}_${processorType}`;
      this.processors.set(key, processor);
      
      // 如果源已存在，重新连接节点链
      const gain = this.gainNodes.get(sourceId);
      if (gain) {
        // 断开并重新连接
        gain.disconnect();
        processor.connect(gain);
      }

      console.log('[AudioMixer] 添加音频处理器:', key, processorType);
    }

    return processor;
  }

  /**
   * 移除特定源的音频处理器
   * @param {string} sourceId - 源ID
   * @param {string} processorType - 处理器类型
   */
  removeProcessor(sourceId, processorType) {
    const key = `${sourceId}_${processorType}`;
    const processor = this.processors.get(key);
    
    if (processor) {
      processor.disconnect();
      this.processors.delete(key);
      console.log('[AudioMixer] 移除音频处理器:', key);
    }
  }

  /**
   * 获取主电平
   * @returns {number} 电平值 0-100
   */
  getMasterLevel() {
    if (!this.analyser) return 0;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    return Math.round((average / 255) * 100);
  }

  /**
   * 获取频率数据用于可视化
   * @returns {Uint8Array} 频率数据
   */
  getFrequencyData() {
    if (!this.analyser) return new Uint8Array(0);

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  /**
   * 获取波形数据
   * @returns {Uint8Array} 波形数据
   */
  getWaveformData() {
    if (!this.analyser) return new Uint8Array(0);

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(dataArray);
    return dataArray;
  }

  /**
   * 设置主音量
   * @param {number} volume - 音量 0-1
   */
  setMasterVolume(volume) {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
      console.log('[AudioMixer] 设置主音量:', volume);
    }
  }

  /**
   * 获取所有已注册的源信息
   * @returns {Array} 源信息列表
   */
  getSourceInfo() {
    const sources = [];
    
    this.sourceNodes.forEach((source, id) => {
      const gain = this.gainNodes.get(id);
      sources.push({
        id,
        volume: gain ? gain.gain.value : 0,
        storedVolume: this.storedVolumes.get(id) || 1.0,
        isActive: id === this.activeSourceId
      });
    });

    return sources;
  }

  /**
   * 清理资源
   * @param {string} sourceId - 源ID
   */
  disconnectSource(sourceId) {
    const source = this.sourceNodes.get(sourceId);
    const gain = this.gainNodes.get(sourceId);

    if (source) {
      source.disconnect();
      this.sourceNodes.delete(sourceId);
    }

    if (gain) {
      gain.disconnect();
      this.gainNodes.delete(sourceId);
    }

    console.log('[AudioMixer] 断开连接:', sourceId);
  }

  /**
   * 获取所有已注册的音频源 ID 列表(用于下拉菜单)
   * @returns {string[]} 源ID列表
   */
  getRegisteredSources() {
    return Array.from(this.sourceNodes.keys());
  }

  /**
   * 获取当前激活的音频源
   * @returns {string|null} 源ID
   */
  getActiveSource() {
    return this.activeSourceId;
  }

  /**
   * 关闭 AudioContext
   */
  close() {
    if (this.context && this.context.state !== 'closed') {
      // 断开所有处理器
      this.processors.forEach((processor) => {
        processor.disconnect();
      });
      this.processors.clear();

      // 断开所有源节点
      this.sourceNodes.forEach((source) => {
        source.disconnect();
      });
      this.sourceNodes.clear();

      // 断开所有增益节点
      this.gainNodes.forEach((gain) => {
        gain.disconnect();
      });
      this.gainNodes.clear();

      this.context.close();
      this.initialized = false;
      this.analyser = null;
      console.log('[AudioMixer] 已关闭');
    }
  }
}

// 单例导出
export const audioMixer = new AudioMixer();
