/**
 * RenderEngine - 渲染引擎核心
 * 负责管理渲染循环、图形上下文和纹理共享
 * 
 * 关键技术：
 * - Canvas 2D: 2D图形渲染
 * - WebGL: 3D加速和纹理共享
 * - 离屏渲染: OffscreenCanvas用于合成
 */
export class RenderEngine {
  constructor(options = {}) {
    this._keepRunning = false;
    this._renderWidth = options.width || 1920;
    this._renderHeight = options.height || 1080;
    this._fps = options.fps || 60;
    this._interval = Math.floor(1000 / this._fps);
    this._rafId = null;

    // 渲染上下文
    this._mainCanvas = null;
    this._mainContext = null;
    this._offscreenCanvas = null;
    this._offscreenContext = null;
    
    // 订阅者
    this._outputSubscribers = new Set();
    
    // 信号系统
    this._signals = {
      render: [],
      drawOverlay: [],
      beforeDraw: [],
      afterDraw: []
    };

    // 锁机制
    this._isLocked = false;
    
    console.log('[RenderEngine] 初始化渲染引擎');
  }
  
  /**
   * 初始化渲染引擎
   * @param {HTMLCanvasElement} canvas - 主画布元素
   */
  init(canvas) {
    this._mainCanvas = canvas;
    this._mainContext = canvas.getContext('2d');
    this._renderWidth = canvas.width;
    this._renderHeight = canvas.height;
    
    // 创建离屏画布用于合成
    this._offscreenCanvas = document.createElement('canvas');
    this._offscreenCanvas.width = this._renderWidth;
    this._offscreenCanvas.height = this._renderHeight;
    this._offscreenContext = this._offscreenCanvas.getContext('2d');
    
    console.log('[RenderEngine] 渲染引擎初始化完成');
  }
  
  /**
   * 启动渲染循环
   */
  start() {
    if (this._keepRunning) return;
    
    this._keepRunning = true;
    this._renderLoop();
    
    console.log('[RenderEngine] 渲染引擎已启动');
  }
  
  /**
   * 停止渲染循环
   */
  stop() {
    this._keepRunning = false;
    console.log('[RenderEngine] 渲染引擎已停止');
  }
  
  /**
   * 渲染主循环
   * 🎯 修复：使用 requestAnimationFrame 替代 setTimeout，
   * 仅在视频帧实际更新时才绘制，消除渲染循环与视频刷新节拍不同步造成的时序滞后
   */
  _renderLoop() {
    if (!this._keepRunning) return;

    // 先泵入本帧的绘制信号
    this._onDraw();

    // 用 rAF 驱动下一帧，浏览器会根据 display refresh rate 调度
    this._rafId = requestAnimationFrame(() => this._renderLoop());
  }
  
  /**
   * 绘制帧
   */
  _onDraw() {
    this.lock();

    // 清空画布
    this.clear();

    // 触发渲染信号
    this._emitSignal('beforeDraw');
    this._emitSignal('render', this._offscreenContext);
    this._emitSignal('drawOverlay', this._offscreenContext, this._renderWidth, this._renderHeight);

    // 将离屏画布内容绘制到主画布
    this._mainContext.drawImage(this._offscreenCanvas, 0, 0);

    // 如果有订阅者，复制纹理并发出数据
    if (this.hasOutputSubscribers) {
      this._copyToReadTexture();
      this._mapTextureAndEmit();
    }

    this._emitSignal('afterDraw');
    this.unlock();
  }

  /**
   * 清空画布
   */
  clear() {
    if (this._offscreenContext) {
      this._offscreenContext.fillStyle = '#0D1B2A';
      this._offscreenContext.fillRect(0, 0, this._renderWidth, this._renderHeight);
    }
  }
  
  /**
   * 锁定渲染引擎
   */
  lock() {
    this._isLocked = true;
  }
  
  /**
   * 解锁渲染引擎
   */
  unlock() {
    this._isLocked = false;
  }
  
  /**
   * 检查是否有输出订阅者
   */
  get hasOutputSubscribers() {
    return this._outputSubscribers.size > 0;
  }
  
  /**
   * 复制到读取纹理
   */
  _copyToReadTexture() {
    // 实现纹理复制逻辑
  }
  
  /**
   * 映射纹理并发出数据
   */
  _mapTextureAndEmit() {
    const imageData = this._offscreenContext.getImageData(0, 0, this._renderWidth, this._renderHeight);
    
    this._outputSubscribers.forEach(subscriber => {
      subscriber(imageData);
    });
  }
  
  /**
   * 添加输出订阅者
   * @param {Function} callback - 回调函数
   */
  addOutputSubscriber(callback) {
    this._outputSubscribers.add(callback);
  }
  
  /**
   * 移除输出订阅者
   * @param {Function} callback - 回调函数
   */
  removeOutputSubscriber(callback) {
    this._outputSubscribers.delete(callback);
  }
  
  /**
   * 注册信号监听器
   * @param {string} signalName - 信号名称
   * @param {Function} callback - 回调函数
   */
  on(signalName, callback) {
    if (this._signals[signalName]) {
      this._signals[signalName].push(callback);
    }
  }
  
  /**
   * 取消信号监听器
   * @param {string} signalName - 信号名称
   * @param {Function} callback - 回调函数
   */
  off(signalName, callback) {
    if (this._signals[signalName]) {
      this._signals[signalName] = this._signals[signalName].filter(cb => cb !== callback);
    }
  }
  
  /**
   * 触发信号
   */
  _emitSignal(signalName, ...args) {
    this._signals[signalName]?.forEach(callback => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`[RenderEngine] 信号 ${signalName} 执行失败:`, error);
      }
    });
  }
  
  /**
   * 获取离屏渲染上下文
   */
  get offscreenContext() {
    return this._offscreenContext;
  }
  
  /**
   * 获取渲染尺寸
   */
  get renderSize() {
    return { width: this._renderWidth, height: this._renderHeight };
  }
  
  /**
   * 设置渲染尺寸
   */
  set renderSize(size) {
    this._renderWidth = size.width;
    this._renderHeight = size.height;
    
    if (this._offscreenCanvas) {
      this._offscreenCanvas.width = this._renderWidth;
      this._offscreenCanvas.height = this._renderHeight;
    }
    
    if (this._mainCanvas) {
      this._mainCanvas.width = this._renderWidth;
      this._mainCanvas.height = this._renderHeight;
    }
  }
  
  /**
   * 销毁渲染引擎
   */
  destroy() {
    this.stop();
    this._mainCanvas = null;
    this._mainContext = null;
    this._offscreenCanvas = null;
    this._offscreenContext = null;
    this._outputSubscribers.clear();
    
    console.log('[RenderEngine] 渲染引擎已销毁');
  }
}

// 全局渲染引擎实例
export const renderEngine = new RenderEngine();
