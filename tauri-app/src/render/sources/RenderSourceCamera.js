/**
 * RenderSourceCamera - 本地摄像头数据源
 */
import { RenderSource } from './RenderSource.js';

export class RenderSourceCamera extends RenderSource {
  constructor(options = {}) {
    super({ ...options, type: 'camera' });
    
    this._deviceId = options.deviceId || '';
    this._constraints = options.constraints || {
      video: true,
      audio: false
    };
    
    // 如果指定了设备ID，添加到约束中
    if (this._deviceId) {
      this._constraints.video = { deviceId: this._deviceId };
    }
    
    // 视频元素用于预览
    this._videoElement = null;
  }
  
  /**
   * 初始化摄像头
   */
  async _initialize() {
    // 请求摄像头权限并获取流
    this._stream = await navigator.mediaDevices.getUserMedia(this._constraints);
    
    // 创建视频元素用于预览
    this._videoElement = document.createElement('video');
    this._videoElement.srcObject = this._stream;
    this._videoElement.muted = true; // 摄像头默认静音
    this._videoElement.autoplay = true;
    this._videoElement.playsinline = true;
    
    // 监听轨道结束
    this._stream.getTracks().forEach(track => {
      track.addEventListener('ended', () => {
        this._isPlaying = false;
        this._emit('ended');
      });
      
      track.addEventListener('mute', () => {
        console.log('[RenderSourceCamera] 轨道静音');
      });
      
      track.addEventListener('unmute', () => {
        console.log('[RenderSourceCamera] 轨道取消静音');
      });
    });
    
    // 获取视频轨道信息
    const videoTrack = this._stream.getVideoTracks()[0];
    if (videoTrack) {
      const settings = videoTrack.getSettings();
      this._properties.width = settings.width;
      this._properties.height = settings.height;
      this._properties.frameRate = settings.frameRate;
    }
    
    console.log(`[RenderSourceCamera] 摄像头初始化成功: ${this._deviceId || '默认设备'}`);
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
        console.warn('[RenderSourceCamera] 播放失败:', error);
      }
    }
    
    this._isPlaying = true;
    this._emit('play');
  }
  
  /**
   * 暂停
   */
  pause() {
    if (this._stream) {
      this._stream.getVideoTracks().forEach(track => {
        track.enabled = false;
      });
    }
    super.pause();
  }
  
  /**
   * 停止
   */
  stop() {
    if (this._stream) {
      this._stream.getVideoTracks().forEach(track => {
        track.enabled = true;
      });
    }
    super.stop();
  }
  
  /**
   * 切换摄像头
   */
  async switchCamera(deviceId) {
    // 停止当前流
    if (this._stream) {
      this.dispose();
    }
    
    // 设置新设备ID
    this._deviceId = deviceId;
    this._constraints.video.deviceId = deviceId;
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
   * 获取设备ID
   */
  get deviceId() {
    return this._deviceId;
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
   * 静态方法：获取可用摄像头列表
   */
  static async getDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'videoinput');
    } catch (error) {
      console.error('[RenderSourceCamera] 获取设备列表失败:', error);
      return [];
    }
  }
}
