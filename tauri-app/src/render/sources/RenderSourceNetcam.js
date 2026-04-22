/**
 * RenderSourceNetcam - 网络摄像头数据源
 * 支持 RTSP、RTMP、HTTP 流等网络视频流
 */
import { RenderSource } from './RenderSource.js';

export class RenderSourceNetcam extends RenderSource {
  constructor(options = {}) {
    super({ ...options, type: 'netcam' });
    
    this._protocol = options.protocol || 'rtsp'; // rtsp, rtmp, http
    this._credentials = options.credentials || {
      username: '',
      password: ''
    };
    this._streamType = options.streamType || 'tcp'; // tcp, udp
    
    // FLV 播放器引用
    this._flvPlayer = null;
    this._videoElement = null;
    
    // 重连机制
    this._reconnectAttempts = 0;
    this._maxReconnectAttempts = 5;
    this._reconnectDelay = 3000;
    this._reconnectTimer = null;
  }
  
  /**
   * 初始化网络摄像头
   */
  async _initialize() {
    return new Promise((resolve, reject) => {
      // 创建视频元素
      this._videoElement = document.createElement('video');
      this._videoElement.muted = this._isMuted;
      this._videoElement.volume = this._volume;
      this._videoElement.autoplay = true;
      this._videoElement.playsinline = true;
      
      // 根据协议选择播放方式
      if (this._protocol === 'rtsp') {
        this._setupRtspStream(resolve, reject);
      } else if (this._protocol === 'rtmp') {
        this._setupRtmpStream(resolve, reject);
      } else {
        this._setupHttpStream(resolve, reject);
      }
    });
  }
  
  /**
   * 设置 RTSP 流
   */
  _setupRtspStream(resolve, reject) {
    // RTSP 需要通过 WebSocket 代理或转换
    console.log(`[RenderSourceNetcam] 设置 RTSP 流: ${this._url}`);
    
    // 尝试创建流（实际项目中需要 RTSP 转 WebSocket 服务）
    this._isReady = true;
    this._emit('ready');
    resolve();
  }
  
  /**
   * 设置 RTMP 流
   */
  _setupRtmpStream(resolve, reject) {
    console.log(`[RenderSourceNetcam] 设置 RTMP 流: ${this._url}`);
    
    // 尝试使用 FLV 播放器
    this._loadFlvPlayer(resolve, reject);
  }
  
  /**
   * 设置 HTTP 流
   */
  _setupHttpStream(resolve, reject) {
    console.log(`[RenderSourceNetcam] 设置 HTTP 流: ${this._url}`);
    
    // 直接设置视频源
    this._videoElement.src = this._url;
    
    this._videoElement.addEventListener('loadedmetadata', () => {
      this._duration = this._videoElement.duration;
      this._isReady = true;
      this._emit('ready');
      resolve();
    });
    
    this._videoElement.addEventListener('error', () => {
      reject(new Error('加载网络流失败'));
    });
    
    this._videoElement.load();
  }
  
  /**
   * 加载 FLV 播放器
   */
  _loadFlvPlayer(resolve, reject) {
    // 检查是否有 FLV 播放器库可用
    if (window.flvjs) {
      try {
        this._flvPlayer = flvjs.createPlayer({
          type: 'rtmp',
          url: this._url
        });
        
        this._flvPlayer.attachMediaElement(this._videoElement);
        this._flvPlayer.load();
        
        this._flvPlayer.on(flvjs.Events.LOADING_COMPLETE, () => {
          this._isReady = true;
          this._emit('ready');
          resolve();
        });
        
        this._flvPlayer.on(flvjs.Events.ERROR, (error) => {
          reject(new Error(`FLV 播放器错误: ${error}`));
        });
      } catch (error) {
        reject(error);
      }
    } else {
      // 没有 FLV 播放器，尝试直接播放
      this._videoElement.src = this._url;
      this._videoElement.load();
      
      this._videoElement.addEventListener('loadedmetadata', () => {
        this._isReady = true;
        this._emit('ready');
        resolve();
      });
    }
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
        console.warn('[RenderSourceNetcam] 播放失败:', error);
        this._attemptReconnect();
      }
    }
    
    if (this._flvPlayer) {
      this._flvPlayer.play();
    }
    
    this._isPlaying = true;
    this._emit('play');
  }
  
  /**
   * 暂停
   */
  pause() {
    if (this._videoElement) {
      this._videoElement.pause();
    }
    if (this._flvPlayer) {
      this._flvPlayer.pause();
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
    if (this._flvPlayer) {
      this._flvPlayer.pause();
    }
    super.stop();
  }
  
  /**
   * 尝试重新连接
   */
  _attemptReconnect() {
    if (this._reconnectAttempts >= this._maxReconnectAttempts) {
      console.error('[RenderSourceNetcam] 达到最大重连次数');
      this._emit('error', { error: new Error('无法连接到网络摄像头') });
      return;
    }
    
    this._reconnectAttempts++;
    console.log(`[RenderSourceNetcam] 尝试重新连接 (${this._reconnectAttempts}/${this._maxReconnectAttempts})`);
    
    this._reconnectTimer = setTimeout(() => {
      this.stop();
      this.init().then(() => this.play()).catch(() => this._attemptReconnect());
    }, this._reconnectDelay);
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
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
    }
    
    if (this._flvPlayer) {
      this._flvPlayer.destroy();
      this._flvPlayer = null;
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
  get protocol() { return this._protocol; }
}
