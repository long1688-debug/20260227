/**
 * RenderSourceDesktop - 桌面捕获数据源
 */
import { RenderSource } from './RenderSource.js';

export class RenderSourceDesktop extends RenderSource {
  constructor(options = {}) {
    super({ ...options, type: 'desktop' });
    
    this._displayMediaOptions = options.displayMediaOptions || {
      video: {
        displaySurface: 'monitor', // monitor, window, application, browser
        logicalSurface: true,
        cursor: 'always' // never, always, motion
      },
      audio: false
    };
    
    // 视频元素用于预览
    this._videoElement = null;
  }
  
  /**
   * 初始化桌面捕获
   */
  async _initialize() {
    // 请求屏幕共享权限
    this._stream = await navigator.mediaDevices.getDisplayMedia(this._displayMediaOptions);
    
    // 创建视频元素用于预览
    this._videoElement = document.createElement('video');
    this._videoElement.srcObject = this._stream;
    this._videoElement.muted = true;
    this._videoElement.autoplay = true;
    this._videoElement.playsinline = true;
    
    // 监听用户停止共享
    this._stream.addEventListener('inactive', () => {
      console.log('[RenderSourceDesktop] 用户停止了屏幕共享');
      this._isPlaying = false;
      this._emit('ended');
    });
    
    // 获取视频轨道信息
    const videoTrack = this._stream.getVideoTracks()[0];
    if (videoTrack) {
      const settings = videoTrack.getSettings();
      this._properties.width = settings.width;
      this._properties.height = settings.height;
      this._properties.frameRate = settings.frameRate;
      
      // 获取捕获的显示信息
      if ('getDisplayMedia' in navigator.mediaDevices) {
        const capabilities = videoTrack.getCapabilities?.();
        if (capabilities) {
          this._properties.displaySurface = capabilities.displaySurface;
        }
      }
    }
    
    console.log('[RenderSourceDesktop] 桌面捕获初始化成功');
  }
  
  /**
   * 播放
   */
  async play() {
    if (!this._isReady) {
      await this.init();
    }
    
    if (this._videoElement) {
      try {
        await this._videoElement.play();
      } catch (error) {
        console.warn('[RenderSourceDesktop] 播放失败:', error);
      }
    }
    
    this._isPlaying = true;
    this._emit('play');
  }
  
  /**
   * 停止并重新选择捕获源
   */
  async reselectSource() {
    // 停止当前流
    if (this._stream) {
      this.dispose();
    }
    
    // 重新初始化
    this._isReady = false;
    this._stream = null;
    
    await this.init();
    await this.play();
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
    if (this._videoElement) {
      this._videoElement.srcObject = null;
      this._videoElement = null;
    }
    super.dispose();
  }
}
