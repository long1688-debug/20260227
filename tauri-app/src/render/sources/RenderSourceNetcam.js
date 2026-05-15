/**
 * RenderSourceNetcam - 网络摄像头数据源
 * 支持 RTSP、RTMP、HTTP 流等网络视频流
 */
import { RenderSource } from './RenderSource.js';
import { startRtspStream, ensureRtspProxyRunning } from '../../utils/rtsp-proxy-api.js';

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
    this._flvUrl = null;       // 🎯 保存 rtsp-proxy 返回的 FLV 地址

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
  async _setupRtspStream(resolve, reject) {
    // 🎯 先确保 rtsp-proxy 服务在运行
    try {
      await ensureRtspProxyRunning();
    } catch (err) {
      reject(new Error(`RTSP 代理服务启动失败: ${err.message}`));
      return;
    }

    // 🎯 防御性兜底：若 this._url 是 ONVIF 服务端点（http(s)://*/onvif/*）
    // 并非 RTSP 流地址，先通过 Tauri ONVIF GetStreamUri 解析出真实 RTSP uri
    let effectiveUrl = this._url;
    if (/^https?:\/\/[^/]+\/onvif\//i.test(this._url)) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const addrMatch = this._url.match(/^https?:\/\/([^:/]+)(?::(\d+))?/);
        if (addrMatch) {
          const ip = addrMatch[1];
          const port = parseInt(addrMatch[2] || '80', 10);
          const creds = this._properties?.credentials || this._properties || {};
          const uriResult = await invoke('get_onvif_stream_uri', {
            ip,
            port,
            username: creds.username || '',
            password: creds.password || '',
          });
          if (uriResult?.uri) {
            effectiveUrl = uriResult.uri;
            console.log(`[RenderSourceNetcam] ONVIF→RTSP解析成功: ${this._url} → ${effectiveUrl}`);
          }
        }
      } catch (e) {
        console.warn('[RenderSourceNetcam] ONVIF RTSP解析失败，尝试直接使用原地址:', e.message);
      }
    }

    // 🎯 调用 Tauri 后端命令，通过 Node.js rtsp-proxy 将 RTSP 转为 HTTP-FLV
    const streamId = this._properties?.networkCamera?.streamId || `${this.id}`;
    try {
      const result = await startRtspStream(effectiveUrl, streamId);
      this._flvUrl = result.flvUrl || `http://127.0.0.1:8081/live/${streamId}.flv`;

      console.log(`[RenderSourceNetcam] RTSP → FLV 代理已启动: ${effectiveUrl} → ${this._flvUrl}`);
    } catch (err) {
      reject(new Error(`启动 RTSP 流转发失败: ${err.message}`));
      return;
    }

    // 🎯 用 flv.js 播放 HTTP-FLV 流
    this._loadFlvPlayer(this._flvUrl, resolve, reject);
  }

  /**
   * 设置 RTMP 流
   */
  _setupRtmpStream(resolve, reject) {
    console.log(`[RenderSourceNetcam] 设置 RTMP 流: ${this._url}`);

    // 尝试使用 FLV 播放器
    this._loadFlvPlayer(this._url, resolve, reject);
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
   * @param {string} [flvUrl] - FLV 流地址（RTSP 代理转 FLV 时传入）
   */
  _loadFlvPlayer(flvUrl, resolve, reject) {
    if (window.flvjs) {
      try {
        this._flvPlayer = flvjs.createPlayer({
          // 通过 rtsp-proxy 输出的 HTTP-FLV 流使用 type: 'flv'
          type: flvUrl ? 'flv' : 'rtmp',
          url: flvUrl || this._url,

          // 低延迟配置
          isLive: true,                      // 直播模式（禁用尾帧缓冲）
          lazyLoad: false,                   // 关闭懒加载（立即起播）
          autoCleanupSourceBuffer: false,    // ← 关键：禁止 flv.js 自动清理已用过的 SourceBuffer
          // 否则播放器内部会定期丢弃未消费帧，导致 drawImage 拿到陈旧画面
          stashInitialSize: 1024 * 1024,     // 预分配 1MB append buffer（减少初始段插入开销）
          enableWorker: true                 // ✅ off-main-thread 解复用，降低主线程压力
        });

        this._flvPlayer.attachMediaElement(this._videoElement);
        this._flvPlayer.load();

        // 🎯 MEDIA_INFO：仅在流元数据解析完成、首帧进入 readyState=3 时触发
        // 比 LOADING_COMPLETE 更早、更可靠地反映"可开始渲染"的状态
        this._flvPlayer.on(flvjs.Events.MEDIA_INFO, () => {
          this._isReady = true;
          this._emit('ready');
          resolve();
        });

        // ERROR：仅在严重错误时 reject，超时降级由 _attemptReconnect 处理
        this._flvPlayer.on(flvjs.Events.ERROR, (err) => {
          const errObj = err instanceof Error ? err : new Error(String(err));
          if (errObj.message.includes('m3u8')) {
            // FLV over HTTP 连接失败：降级为直接 HLS 尝试（兼容性兜底）
            console.warn('[RenderSourceNetcam] FLV 流不可用，降级 HLS:', errObj.message);
          }
          reject(errObj);
        });

      } catch (error) {
        reject(error);
      }
    } else {
      // flv.js 未加载：降级到原生 video
      this._videoElement.src = flvUrl || this._url;
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
