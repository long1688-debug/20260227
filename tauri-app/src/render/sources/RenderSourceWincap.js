/**
 * RenderSourceWincap - 窗口捕获数据源
 * 用于捕获特定窗口内容
 */
import { RenderSource } from './RenderSource.js';

export class RenderSourceWincap extends RenderSource {
  constructor(options = {}) {
    super({ ...options, type: 'wincap' });
    
    this._windowId = options.windowId || '';
    this._captureOptions = options.captureOptions || {
      video: {
        displaySurface: 'window',
        logicalSurface: true,
        cursor: 'always'
      },
      audio: false
    };
    
    // 视频元素用于预览
    this._videoElement = null;
  }
  
  /**
   * 初始化窗口捕获
   */
  async _initialize() {
    // 如果指定了窗口ID，尝试捕获特定窗口
    if (this._windowId) {
      this._captureOptions.video.deviceId = { exact: this._windowId };
    }
    
    // 请求窗口捕获权限
    this._stream = await navigator.mediaDevices.getDisplayMedia(this._captureOptions);
    
    // 创建视频元素用于预览
    this._videoElement = document.createElement('video');
    this._videoElement.srcObject = this._stream;
    this._videoElement.muted = true;
    this._videoElement.autoplay = true;
    this._videoElement.playsinline = true;
    
    // 监听用户停止共享
    this._stream.addEventListener('inactive', () => {
      console.log('[RenderSourceWincap] 用户停止了窗口捕获');
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
    }
    
    console.log(`[RenderSourceWincap] 窗口捕获初始化成功: ${this._windowId || '用户选择的窗口'}`);
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
        console.warn('[RenderSourceWincap] 播放失败:', error);
      }
    }
    
    this._isPlaying = true;
    this._emit('play');
  }
  
  /**
   * 切换捕获窗口
   */
  async switchWindow(windowId) {
    // 停止当前流
    if (this._stream) {
      this.dispose();
    }
    
    // 设置新窗口ID
    this._windowId = windowId;
    this._isReady = false;
    this._stream = null;
    
    // 重新初始化
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
   * 获取窗口ID
   */
  get windowId() {
    return this._windowId;
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
  
  /**
   * 静态方法：获取可用窗口列表
   */
  static async getWindows() {
    try {
      // 实际项目中需要使用原生API获取窗口列表
      // 这里返回模拟数据
      return [
        { id: 'window-1', name: '浏览器窗口' },
        { id: 'window-2', name: '文档编辑器' },
        { id: 'window-3', name: '视频播放器' }
      ];
    } catch (error) {
      console.error('[RenderSourceWincap] 获取窗口列表失败:', error);
      return [];
    }
  }
}
