/**
 * RenderSourceVideo - 视频文件数据源
 */
import { RenderSource } from './RenderSource.js';

export class RenderSourceVideo extends RenderSource {
  constructor(options = {}) {
    super({ ...options, type: 'video' });
    
    this._videoElement = null;
    this._loop = options.loop || false;
    this._autoplay = options.autoplay || false;
    
    // 更新频率
    this._updateInterval = null;
  }
  
  /**
   * 初始化视频
   */
  async _initialize() {
    return new Promise((resolve, reject) => {
      this._videoElement = document.createElement('video');
      this._videoElement.src = this._url;
      this._videoElement.crossOrigin = 'anonymous';
      this._videoElement.loop = this._loop;
      this._videoElement.muted = this._isMuted;
      this._videoElement.volume = this._volume;
      
      // 监听事件
      this._videoElement.addEventListener('loadedmetadata', () => {
        this._duration = this._videoElement.duration;
        resolve();
      });
      
      this._videoElement.addEventListener('timeupdate', () => {
        this._currentTime = this._videoElement.currentTime;
        this._emit('timeUpdate', { currentTime: this._currentTime });
      });
      
      this._videoElement.addEventListener('ended', () => {
        this._isPlaying = false;
        this._emit('ended');
      });
      
      this._videoElement.addEventListener('error', (event) => {
        reject(new Error(`加载视频失败: ${event.target.error?.message || '未知错误'}`));
      });
      
      // 加载视频
      this._videoElement.load();
    });
  }
  
  /**
   * 播放
   */
  async play() {
    if (!this._isReady) {
      await this.init();
    }
    
    try {
      await this._videoElement.play();
      this._isPlaying = true;
      this._emit('play');
    } catch (error) {
      console.warn('[RenderSourceVideo] 自动播放失败:', error);
    }
  }
  
  /**
   * 暂停
   */
  pause() {
    if (this._videoElement) {
      this._videoElement.pause();
    }
    super.pause();
  }
  
  /**
   * 停止
   */
  stop() {
    if (this._videoElement) {
      this._videoElement.pause();
      this._videoElement.currentTime = 0;
    }
    super.stop();
  }
  
  /**
   * 设置静音
   */
  setMuted(muted) {
    super.setMuted(muted);
    if (this._videoElement) {
      this._videoElement.muted = muted;
    }
  }
  
  /**
   * 设置音量
   */
  setVolume(volume) {
    super.setVolume(volume);
    if (this._videoElement) {
      this._videoElement.volume = volume;
    }
  }
  
  /**
   * 设置播放位置
   */
  seek(time) {
    if (this._videoElement) {
      this._videoElement.currentTime = time;
      this._currentTime = time;
    }
  }
  
  /**
   * 获取视频元素
   */
  get videoElement() {
    return this._videoElement;
  }
  
  /**
   * 释放资源
   */
  dispose() {
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
    }
    if (this._videoElement) {
      this._videoElement.src = '';
      this._videoElement = null;
    }
    super.dispose();
  }
  
  /**
   * 获取属性
   */
  get loop() { return this._loop; }
  set loop(value) { 
    this._loop = value; 
    if (this._videoElement) {
      this._videoElement.loop = value;
    }
  }
}
