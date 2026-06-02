/**
 * Tauri + mpv 嵌入式播放器客户端
 *
 * 基于 libmpv 的高性能视频播放能力，支持多种流媒体协议
 * 延迟低至 0.5~2 秒，彻底解决前端 FLV 播放失败和高延迟问题
 *
 * 支持的协议：
 * - RTSP (TCP 传输，更稳定)
 * - RTMP / RTMPS
 * - HTTP-FLV
 * - HLS (m3u8)
 * - HTTP/HTTPS 流
 * - 本地文件
 * - UDP / TCP 流
 *
 * 使用示例：
 * const player = new MpvPlayer('player1', { lowLatency: true });
 * await player.playStream('rtsp://camera:554/stream');
 */

import { invoke } from '@tauri-apps/api/core';

export class MpvPlayer {
  /**
   * 创建 mpv 播放器实例
   * @param {string} playerId - 播放器唯一标识
   * @param {Object} options - 配置选项
   * @param {boolean} [options.lowLatency=true] - 是否启用低延迟模式
   * @param {boolean} [options.autoCreate=true] - 是否自动创建播放器实例
   */
  constructor(playerId, options = {}) {
    this._playerId = playerId;
    this._isCreated = false;
    this._isPlaying = false;
    this._volume = 100;
    this._isMuted = false;
    this._lowLatency = options.lowLatency !== false;
    this._autoCreate = options.autoCreate !== false;

    // 事件回调
    this._onPlay = null;
    this._onPause = null;
    this._onStop = null;
    this._onError = null;
    this._onStats = null;

    // 统计信息定时器
    this._statsInterval = null;

    // 如果自动创建，立即创建播放器实例
    if (this._autoCreate) {
      this.create().catch(console.warn);
    }
  }

  /**
   * 获取播放器ID
   */
  get playerId() {
    return this._playerId;
  }

  /**
   * 获取播放状态
   */
  get isPlaying() {
    return this._isPlaying;
  }

  /**
   * 获取音量
   */
  get volume() {
    return this._volume;
  }

  /**
   * 获取静音状态
   */
  get isMuted() {
    return this._isMuted;
  }

  /**
   * 设置事件回调
   * @param {string} eventName - 事件名称
   * @param {Function} handler - 回调函数
   */
  on(eventName, handler) {
    switch (eventName) {
      case 'play':
        this._onPlay = handler;
        break;
      case 'pause':
        this._onPause = handler;
        break;
      case 'stop':
        this._onStop = handler;
        break;
      case 'error':
        this._onError = handler;
        break;
      case 'stats':
        this._onStats = handler;
        break;
      default:
        console.warn(`[MpvPlayer] 未知事件: ${eventName}`);
    }
  }

  /**
   * 创建播放器实例
   * @param {boolean} [lowLatency] - 是否启用低延迟模式（覆盖构造函数设置）
   */
  async create(lowLatency) {
    if (this._isCreated) {
      console.warn(`[MpvPlayer] 播放器 ${this._playerId} 已创建`);
      return;
    }

    try {
      const result = await invoke('mpv_create_player', {
        player_id: this._playerId,
        low_latency: lowLatency !== undefined ? lowLatency : this._lowLatency
      });
      console.log(`[MpvPlayer] ${result}`);
      this._isCreated = true;
    } catch (error) {
      console.error(`[MpvPlayer] 创建播放器失败:`, error);
      this._onError?.(error);
      throw error;
    }
  }

  /**
   * 销毁播放器实例
   */
  async destroy() {
    if (!this._isCreated) {
      return;
    }

    // 停止统计信息监控
    this._stopStatsMonitor();

    try {
      const result = await invoke('mpv_destroy_player', {
        player_id: this._playerId
      });
      console.log(`[MpvPlayer] ${result}`);
      this._isCreated = false;
      this._isPlaying = false;
    } catch (error) {
      console.error(`[MpvPlayer] 销毁播放器失败:`, error);
      this._onError?.(error);
    }
  }

  /**
   * 播放任意流媒体（自动识别协议）
   * @param {string} streamUrl - 流地址（RTSP/RTMP/FLV/HLS/HTTP等）
   * @returns {Promise<void>}
   */
  async playStream(streamUrl) {
    if (!this._isCreated) {
      await this.create();
    }

    try {
      const result = await invoke('mpv_play_stream', {
        player_id: this._playerId,
        stream_url: streamUrl
      });
      console.log(`[MpvPlayer] ${result}`);
      this._isPlaying = true;

      // 启动统计信息监控
      this._startStatsMonitor();

      // 触发播放事件
      this._onPlay?.();
    } catch (error) {
      console.error(`[MpvPlayer] 播放流失败:`, error);
      this._isPlaying = false;
      this._onError?.(error);
      throw error;
    }
  }

  /**
   * 播放 RTSP 流
   * @param {string} rtspUrl - RTSP 流地址
   * @returns {Promise<void>}
   */
  async playRtsp(rtspUrl) {
    return this.playStream(rtspUrl);
  }

  /**
   * 播放 RTMP 流
   * @param {string} rtmpUrl - RTMP 流地址
   * @returns {Promise<void>}
   */
  async playRtmp(rtmpUrl) {
    return this.playStream(rtmpUrl);
  }

  /**
   * 播放 FLV 流
   * @param {string} flvUrl - FLV 流地址
   * @returns {Promise<void>}
   */
  async playFlv(flvUrl) {
    return this.playStream(flvUrl);
  }

  /**
   * 播放 HLS 流
   * @param {string} hlsUrl - HLS 流地址（.m3u8）
   * @returns {Promise<void>}
   */
  async playHls(hlsUrl) {
    return this.playStream(hlsUrl);
  }

  /**
   * 播放本地文件
   * @param {string} filePath - 本地文件路径
   * @returns {Promise<void>}
   */
  async playFile(filePath) {
    return this.playStream(filePath);
  }

  /**
   * 停止播放
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this._isCreated) {
      return;
    }

    try {
      const result = await invoke('mpv_stop', {
        player_id: this._playerId
      });
      console.log(`[MpvPlayer] ${result}`);
      this._isPlaying = false;

      // 停止统计信息监控
      this._stopStatsMonitor();

      // 触发停止事件
      this._onStop?.();
    } catch (error) {
      console.error(`[MpvPlayer] 停止播放失败:`, error);
      this._onError?.(error);
    }
  }

  /**
   * 暂停播放
   * @returns {Promise<void>}
   */
  async pause() {
    if (!this._isCreated || !this._isPlaying) {
      return;
    }

    try {
      const result = await invoke('mpv_pause', {
        player_id: this._playerId
      });
      console.log(`[MpvPlayer] ${result}`);
      this._isPlaying = false;

      // 触发暂停事件
      this._onPause?.();
    } catch (error) {
      console.error(`[MpvPlayer] 暂停失败:`, error);
      this._onError?.(error);
    }
  }

  /**
   * 恢复播放
   * @returns {Promise<void>}
   */
  async resume() {
    if (!this._isCreated) {
      return;
    }

    try {
      const result = await invoke('mpv_resume', {
        player_id: this._playerId
      });
      console.log(`[MpvPlayer] ${result}`);
      this._isPlaying = true;

      // 启动统计信息监控
      this._startStatsMonitor();

      // 触发播放事件
      this._onPlay?.();
    } catch (error) {
      console.error(`[MpvPlayer] 恢复播放失败:`, error);
      this._onError?.(error);
    }
  }

  /**
   * 设置音量
   * @param {number} volume - 音量值（0-100）
   * @returns {Promise<void>}
   */
  async setVolume(volume) {
    if (!this._isCreated) {
      return;
    }

    // 限制音量范围
    const clampedVolume = Math.max(0, Math.min(100, volume));

    try {
      const result = await invoke('mpv_set_volume', {
        player_id: this._playerId,
        volume: clampedVolume
      });
      console.log(`[MpvPlayer] ${result}`);
      this._volume = clampedVolume;
    } catch (error) {
      console.error(`[MpvPlayer] 设置音量失败:`, error);
      this._onError?.(error);
    }
  }

  /**
   * 设置静音
   * @param {boolean} mute - 是否静音
   * @returns {Promise<void>}
   */
  async setMute(mute) {
    if (!this._isCreated) {
      return;
    }

    try {
      const result = await invoke('mpv_set_mute', {
        player_id: this._playerId,
        mute
      });
      console.log(`[MpvPlayer] ${result}`);
      this._isMuted = mute;
    } catch (error) {
      console.error(`[MpvPlayer] 设置静音失败:`, error);
      this._onError?.(error);
    }
  }

  /**
   * 获取播放位置
   * @returns {Promise<number>} - 当前播放位置（秒）
   */
  async getPosition() {
    if (!this._isCreated) {
      return 0;
    }

    try {
      const position = await invoke('mpv_get_position', {
        player_id: this._playerId
      });
      return position;
    } catch (error) {
      console.error(`[MpvPlayer] 获取播放位置失败:`, error);
      return 0;
    }
  }

  /**
   * 获取播放时长
   * @returns {Promise<number>} - 播放时长（秒）
   */
  async getDuration() {
    if (!this._isCreated) {
      return 0;
    }

    try {
      const duration = await invoke('mpv_get_duration', {
        player_id: this._playerId
      });
      return duration;
    } catch (error) {
      console.error(`[MpvPlayer] 获取时长失败:`, error);
      return 0;
    }
  }

  /**
   * 跳转到指定位置
   * @param {number} position - 目标位置（秒）
   * @returns {Promise<void>}
   */
  async seek(position) {
    if (!this._isCreated) {
      return;
    }

    try {
      const result = await invoke('mpv_seek', {
        player_id: this._playerId,
        position
      });
      console.log(`[MpvPlayer] ${result}`);
    } catch (error) {
      console.error(`[MpvPlayer] 跳转失败:`, error);
      this._onError?.(error);
    }
  }

  /**
   * 获取播放状态
   * @returns {Promise<string>} - 播放状态字符串
   */
  async getState() {
    if (!this._isCreated) {
      return 'stopped';
    }

    try {
      const state = await invoke('mpv_get_state', {
        player_id: this._playerId
      });
      return state;
    } catch (error) {
      console.error(`[MpvPlayer] 获取状态失败:`, error);
      return 'error';
    }
  }

  /**
   * 获取播放统计信息
   * @returns {Promise<Object>} - 统计信息对象
   */
  async getStats() {
    if (!this._isCreated) {
      return null;
    }

    try {
      const stats = await invoke('mpv_get_stats', {
        player_id: this._playerId
      });
      return stats;
    } catch (error) {
      console.error(`[MpvPlayer] 获取统计信息失败:`, error);
      return null;
    }
  }

  /**
   * 截图
   * @param {string} path - 保存路径
   * @returns {Promise<string>} - 结果消息
   */
  async screenshot(path) {
    if (!this._isCreated) {
      throw new Error('播放器未创建');
    }

    try {
      const result = await invoke('mpv_screenshot', {
        player_id: this._playerId,
        path
      });
      console.log(`[MpvPlayer] ${result}`);
      return result;
    } catch (error) {
      console.error(`[MpvPlayer] 截图失败:`, error);
      this._onError?.(error);
      throw error;
    }
  }

  /**
   * 开始录制
   * @param {string} path - 录制文件保存路径
   * @returns {Promise<string>} - 结果消息
   */
  async startRecording(path) {
    if (!this._isCreated) {
      throw new Error('播放器未创建');
    }

    try {
      const result = await invoke('mpv_start_recording', {
        player_id: this._playerId,
        path
      });
      console.log(`[MpvPlayer] ${result}`);
      return result;
    } catch (error) {
      console.error(`[MpvPlayer] 开始录制失败:`, error);
      this._onError?.(error);
      throw error;
    }
  }

  /**
   * 停止录制
   * @returns {Promise<string>} - 结果消息
   */
  async stopRecording() {
    if (!this._isCreated) {
      throw new Error('播放器未创建');
    }

    try {
      const result = await invoke('mpv_stop_recording', {
        player_id: this._playerId
      });
      console.log(`[MpvPlayer] ${result}`);
      return result;
    } catch (error) {
      console.error(`[MpvPlayer] 停止录制失败:`, error);
      this._onError?.(error);
      throw error;
    }
  }

  /**
   * 启动统计信息监控
   */
  _startStatsMonitor() {
    if (this._statsInterval) {
      return;
    }

    this._statsInterval = setInterval(async () => {
      if (!this._isPlaying) {
        this._stopStatsMonitor();
        return;
      }

      try {
        const stats = await this.getStats();
        if (stats) {
          this._onStats?.(stats);
        }
      } catch (error) {
        console.warn(`[MpvPlayer] 统计信息获取失败:`, error);
      }
    }, 1000);
  }

  /**
   * 停止统计信息监控
   */
  _stopStatsMonitor() {
    if (this._statsInterval) {
      clearInterval(this._statsInterval);
      this._statsInterval = null;
    }
  }

  /**
   * 检查 mpv 是否可用
   * @returns {Promise<boolean>} - mpv 是否可用
   */
  static async isAvailable() {
    try {
      const available = await invoke('mpv_is_available');
      return available;
    } catch (error) {
      console.error('[MpvPlayer] 检查 mpv 可用性失败:', error);
      return false;
    }
  }

  /**
   * 获取支持的协议列表
   * @returns {Promise<Array<string>>} - 支持的协议列表
   */
  static async getSupportedProtocols() {
    try {
      const protocols = await invoke('mpv_get_supported_protocols');
      return protocols;
    } catch (error) {
      console.error('[MpvPlayer] 获取支持的协议列表失败:', error);
      return [];
    }
  }

  /**
   * 获取所有播放器实例列表
   * @returns {Promise<Array<string>>} - 播放器ID列表
   */
  static async listPlayers() {
    try {
      const players = await invoke('mpv_list_players');
      return players;
    } catch (error) {
      console.error('[MpvPlayer] 获取播放器列表失败:', error);
      return [];
    }
  }
}

/**
 * 创建 mpv 播放器并播放流媒体
 * @param {string} playerId - 播放器ID
 * @param {string} streamUrl - 流地址
 * @param {Object} options - 配置选项
 * @returns {Promise<MpvPlayer>}
 */
export async function createMpvPlayer(playerId, streamUrl, options = {}) {
  const player = new MpvPlayer(playerId, {
    autoCreate: true,
    lowLatency: options.lowLatency !== false
  });

  if (streamUrl) {
    await player.playStream(streamUrl);
  }

  return player;
}

/**
 * 创建 RTSP 播放器（低延迟模式）
 * @param {string} playerId - 播放器ID
 * @param {string} rtspUrl - RTSP 流地址
 * @returns {Promise<MpvPlayer>}
 */
export async function createRtspPlayer(playerId, rtspUrl) {
  return createMpvPlayer(playerId, rtspUrl, { lowLatency: true });
}

/**
 * 创建 FLV 播放器
 * @param {string} playerId - 播放器ID
 * @param {string} flvUrl - FLV 流地址
 * @returns {Promise<MpvPlayer>}
 */
export async function createFlvPlayer(playerId, flvUrl) {
  return createMpvPlayer(playerId, flvUrl, { lowLatency: true });
}

/**
 * 创建 HLS 播放器
 * @param {string} playerId - 播放器ID
 * @param {string} hlsUrl - HLS 流地址
 * @returns {Promise<MpvPlayer>}
 */
export async function createHlsPlayer(playerId, hlsUrl) {
  return createMpvPlayer(playerId, hlsUrl, { lowLatency: false });
}
