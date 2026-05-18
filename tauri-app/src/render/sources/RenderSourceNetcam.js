/**
 * RenderSourceNetcam - 网络摄像头数据源
 * 支持 RTSP、RTMP、HTTP 流等网络视频流
 */
import { RenderSource } from './RenderSource.js';
import { startRtspStream, ensureRtspProxyRunning } from '../../utils/rtsp-proxy-api.js';
import { ZLMediaKitWebRTCPlayer } from '../../utils/zlm-webrtc-player.js';

export class RenderSourceNetcam extends RenderSource {
  constructor(options = {}) {
    super({ ...options, type: 'netcam' });

    this._protocol = options.protocol || 'rtsp'; // rtsp, rtmp, http
    this._credentials = options.credentials || {
      username: '',
      password: ''
    };
    this._streamType = options.streamType || 'tcp'; // tcp, udp

    // 播放器引用
    this._flvPlayer = null;
    this._webrtcPlayer = null;  // 🎯 WebRTC 播放器（低延迟 <200ms）
    this._videoElement = null;
    this._flvUrl = null;       // 🎯 保存 ZLMediaKit 返回的 FLV 地址
    this._webrtcUrl = null;    // 🎯 保存 ZLMediaKit 返回的 WebRTC 信令地址
    this._playMode = 'webrtc'; // 🎯 播放模式：webrtc（优先）| flv（降级）

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
    // 🎯 先确保 ZLMediaKit 流媒体服务在运行
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

    // 🎯 调用 Tauri 后端命令，通过 ZLMediaKit 代理 RTSP 流
    const streamId = this._properties?.networkCamera?.streamId || String(this.id);
    try {
      const result = await startRtspStream(effectiveUrl, streamId);
      this._flvUrl = result.flvUrl || 'http://127.0.0.1:801/live/' + streamId + '.flv';
      this._webrtcUrl = result.webrtcUrl || 'http://127.0.0.1:801/index/api/webrtc?app=live&stream=' + streamId + '&type=play';
      this._playMode = result.playMode || 'webrtc';

      console.log('[RenderSourceNetcam] RTSP 代理已启动 (ZLMediaKit): ' + effectiveUrl);
      console.log('  - WebRTC URL: ' + this._webrtcUrl);
      console.log('  - FLV URL: ' + this._flvUrl);
      console.log('  - 播放模式: ' + this._playMode);
    } catch (err) {
      reject(new Error('启动 RTSP 流转发失败: ' + err.message));
      return;
    }

    // 🎯 优先使用 WebRTC（延迟 <200ms），不支持时降级到 FLV
    if (this._playMode === 'webrtc' && typeof RTCPeerConnection !== 'undefined') {
      this._loadWebRTCPlayer(streamId, resolve, reject);
    } else {
      this._loadFlvPlayer(this._flvUrl, resolve, reject);
    }
  }

  /**
   * 加载 WebRTC 播放器（低延迟 <200ms）
   * @param {string} streamId - 流 ID
   */
  async _loadWebRTCPlayer(streamId, resolve, reject) {
    console.log('[RenderSourceNetcam] 🎯 使用 WebRTC 播放（低延迟模式）, streamId: ' + streamId);

    try {
      this._webrtcPlayer = new ZLMediaKitWebRTCPlayer(this._videoElement, {
        streamId: streamId,
        host: '127.0.0.1',
        httpPort: 801,
        enableAudio: true,
        enableVideo: true,
        onConnected: () => {
          console.log('[RenderSourceNetcam] ✅ WebRTC 连接成功');
        },
        onDisconnected: () => {
          console.warn('[RenderSourceNetcam] ⚠️ WebRTC 连接断开，尝试降级到 FLV...');
          // WebRTC 断开时降级到 FLV
          this._webrtcPlayer = null;
          this._playMode = 'flv';
          this._loadFlvPlayer(this._flvUrl, resolve, reject);
        },
        onError: (err) => {
          console.warn('[RenderSourceNetcam] ⚠️ WebRTC 错误，降级到 FLV:', err.message);
          // WebRTC 失败时降级到 FLV
          this._webrtcPlayer = null;
          this._playMode = 'flv';
          this._loadFlvPlayer(this._flvUrl, resolve, reject);
        },
        onStats: (stats) => {
          // 可用于显示延迟信息
          if (stats.transport.rtt > 0) {
            this._emit('stats', { rtt: stats.transport.rtt, mode: 'webrtc' });
          }
        }
      });

      await this._webrtcPlayer.connect();

      this._isReady = true;
      this._emit('ready');
      resolve();

    } catch (err) {
      console.warn('[RenderSourceNetcam] ⚠️ WebRTC 连接失败，降级到 FLV:', err.message);
      // WebRTC 连接失败，降级到 FLV
      this._webrtcPlayer = null;
      this._playMode = 'flv';
      this._loadFlvPlayer(this._flvUrl, resolve, reject);
    }
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
          // 通过 ZLMediaKit 输出的 HTTP-FLV 流使用 type: 'flv'
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

    if (this._webrtcPlayer) {
      this._webrtcPlayer.destroy();
      this._webrtcPlayer = null;
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
