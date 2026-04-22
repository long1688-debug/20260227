/**
 * RenderSource - 数据源抽象基类
 * 所有数据源的抽象基类
 */
export class RenderSource {
  constructor(options = {}) {
    this._id = options.id || `source-${Date.now()}`;
    this._name = options.name || 'Untitled Source';
    this._type = options.type || 'unknown';
    this._url = options.url || '';
    this._stream = options.stream || null;
    this._properties = options.properties || {};
    
    // 状态
    this._isReady = false;
    this._isPlaying = false;
    this._isMuted = true; // 默认静音，需要用户在音频管理中手动开启
    this._volume = 1;
    this._duration = 0;
    this._currentTime = 0;
    
    // 事件处理器
    this._handlers = {
      ready: [],
      play: [],
      pause: [],
      stop: [],
      error: [],
      timeUpdate: [],
      ended: []
    };
    
    console.log(`[RenderSource] 创建数据源: ${this._id}, 类型: ${this._type}`);
  }
  
  /**
   * 初始化数据源
   */
  async init() {
    try {
      await this._initialize();
      this._isReady = true;
      this._emit('ready');
      console.log(`[RenderSource] 数据源初始化完成: ${this._id}`);
    } catch (error) {
      console.error(`[RenderSource] 数据源初始化失败:`, error);
      this._emit('error', { error });
    }
  }
  
  /**
   * 初始化实现（由子类实现）
   */
  async _initialize() {
    // 默认实现
  }
  
  /**
   * 播放
   */
  async play() {
    if (!this._isReady) {
      await this.init();
    }
    this._isPlaying = true;
    this._emit('play');
  }
  
  /**
   * 暂停
   */
  pause() {
    this._isPlaying = false;
    this._emit('pause');
  }
  
  /**
   * 停止
   */
  stop() {
    this._isPlaying = false;
    this._currentTime = 0;
    this._emit('stop');
  }
  
  /**
   * 设置静音
   */
  setMuted(muted) {
    this._isMuted = muted;
  }
  
  /**
   * 设置音量
   */
  setVolume(volume) {
    this._volume = Math.max(0, Math.min(1, volume));
  }
  
  /**
   * 释放资源
   */
  dispose() {
    if (this._stream) {
      this._stream.getTracks().forEach(track => track.stop());
      this._stream = null;
    }
    console.log(`[RenderSource] 数据源已释放: ${this._id}`);
  }
  
  /**
   * 注册事件处理器
   */
  on(eventName, handler) {
    if (this._handlers[eventName]) {
      this._handlers[eventName].push(handler);
    }
  }
  
  /**
   * 取消事件处理器
   */
  off(eventName, handler) {
    if (this._handlers[eventName]) {
      this._handlers[eventName] = this._handlers[eventName].filter(h => h !== handler);
    }
  }
  
  /**
   * 触发事件
   */
  _emit(eventName, data) {
    this._handlers[eventName]?.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`[RenderSource] 事件 ${eventName} 处理失败:`, error);
      }
    });
  }
  
  /**
   * 获取属性
   */
  get id() { return this._id; }
  get name() { return this._name; }
  set name(value) { this._name = value; }
  get type() { return this._type; }
  get url() { return this._url; }
  get stream() { return this._stream; }
  get properties() { return { ...this._properties }; }
  get isReady() { return this._isReady; }
  get isPlaying() { return this._isPlaying; }
  get isMuted() { return this._isMuted; }
  get volume() { return this._volume; }
  get duration() { return this._duration; }
  get currentTime() { return this._currentTime; }
}
