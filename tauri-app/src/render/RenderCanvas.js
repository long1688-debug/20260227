/**
 * RenderCanvas - 主渲染画布
 * 核心功能：
 * - 布局管理（添加、切换、删除）
 * - 用户交互（鼠标、触摸）
 * - 标注绘制（画笔、标记、橡皮擦）
 * - 截图保存
 */
export class RenderCanvas {
  constructor(options = {}) {
    this._canvas = null;
    this._context = null;
    this._width = options.width || 1920;
    this._height = options.height || 1080;

    // 🎯 布局管理 - 所有布局对象同时存在于内存中
    this._layouts = new Map();  // map<string, RenderLayout>
    this._currentLayout = null; // 当前激活的布局ID
    this._previousLayout = null; // 上一个布局ID（用于切换事件）

    // 🎯 新增：布局配置持久化
    this._layoutConfigs = new Map(); // 存储每个布局的信号源绑定配置

    // 元素管理
    this._elements = [];

    // 标注状态
    this._isDrawing = false;
    this._drawMode = 'none'; // none, pen, marker, eraser
    this._drawColor = '#FF0000';
    this._drawWidth = 2;
    this._lastPos = { x: 0, y: 0 };

    // 截图状态
    this._isCapturing = false;
    this._captureRect = null;

    // 事件处理器
    this._handlers = {
      mouseDown: [],
      mouseMove: [],
      mouseUp: [],
      touchStart: [],
      touchMove: [],
      touchEnd: [],
      layoutChange: [],
      layoutChanged: [], // 🎯 新增：布局切换完成事件
      elementAdd: [],
      elementRemove: []
    };

    console.log('[RenderCanvas] 创建主渲染画布');
  }

  /**
   * 初始化画布
   * @param {HTMLCanvasElement} canvas - 画布元素
   */
  init(canvas) {
    this._canvas = canvas;
    this._context = canvas.getContext('2d');
    this._width = canvas.width;
    this._height = canvas.height;

    // 设置画布样式
    this._canvas.style.cssText = `
      width: ${this._width}px;
      height: ${this._height}px;
      background: #0D1B2A;
      cursor: default;
    `;

    // 绑定事件
    this._bindEvents();

    console.log('[RenderCanvas] 画布初始化完成');
  }

  /**
   * 绑定事件
   */
  _bindEvents() {
    this._canvas.addEventListener('mousedown', this._handleMouseDown.bind(this));
    this._canvas.addEventListener('mousemove', this._handleMouseMove.bind(this));
    this._canvas.addEventListener('mouseup', this._handleMouseUp.bind(this));
    this._canvas.addEventListener('mouseleave', this._handleMouseUp.bind(this));

    this._canvas.addEventListener('touchstart', this._handleTouchStart.bind(this));
    this._canvas.addEventListener('touchmove', this._handleTouchMove.bind(this));
    this._canvas.addEventListener('touchend', this._handleTouchEnd.bind(this));
  }

  /**
   * 鼠标按下处理
   */
  _handleMouseDown(event) {
    const rect = this._canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    this._lastPos = { x, y };

    if (this._drawMode !== 'none') {
      this._isDrawing = true;
      if (this._drawMode === 'pen' || this._drawMode === 'marker') {
        this._context.beginPath();
        this._context.moveTo(x, y);
        this._context.strokeStyle = this._drawColor;
        this._context.lineWidth = this._drawWidth;
        this._context.lineCap = 'round';
        this._context.lineJoin = 'round';
      }
    }

    this._emit('mouseDown', { x, y, event });
  }

  /**
   * 鼠标移动处理
   */
  _handleMouseMove(event) {
    const rect = this._canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (this._isDrawing && this._drawMode !== 'none') {
      if (this._drawMode === 'pen' || this._drawMode === 'marker') {
        this._context.lineTo(x, y);
        this._context.stroke();
      } else if (this._drawMode === 'eraser') {
        this._context.clearRect(x - this._drawWidth, y - this._drawWidth, this._drawWidth * 2, this._drawWidth * 2);
      }
    }

    this._lastPos = { x, y };
    this._emit('mouseMove', { x, y, event });
  }

  /**
   * 鼠标释放处理
   */
  _handleMouseUp(event) {
    const rect = this._canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (this._isDrawing && this._drawMode !== 'none') {
      if (this._drawMode === 'pen' || this._drawMode === 'marker') {
        this._context.lineTo(x, y);
        this._context.stroke();
      }
      this._isDrawing = false;
    }

    this._emit('mouseUp', { x, y, event });
  }

  /**
   * 触摸开始处理
   */
  _handleTouchStart(event) {
    event.preventDefault();
    const touch = event.touches[0];
    const rect = this._canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    this._lastPos = { x, y };
    this._emit('touchStart', { x, y, event });
  }

  /**
   * 触摸移动处理
   */
  _handleTouchMove(event) {
    event.preventDefault();
    const touch = event.touches[0];
    const rect = this._canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    if (this._isDrawing && this._drawMode !== 'none') {
      if (this._drawMode === 'pen' || this._drawMode === 'marker') {
        this._context.lineTo(x, y);
        this._context.stroke();
      } else if (this._drawMode === 'eraser') {
        this._context.clearRect(x - this._drawWidth, y - this._drawWidth, this._drawWidth * 2, this._drawWidth * 2);
      }
    }

    this._lastPos = { x, y };
    this._emit('touchMove', { x, y, event });
  }

  /**
   * 触摸结束处理
   */
  _handleTouchEnd(event) {
    event.preventDefault();
    this._isDrawing = false;
    this._emit('touchEnd', { event });
  }

  /**
   * 添加布局
   */
  addLayout(layout) {
    if (layout && layout.id) {
      this._layouts.set(layout.id, layout);
      if (!this._currentLayout) {
        this._currentLayout = layout.id;
      }
      this._emit('layoutChange', { layoutId: layout.id });
    }
  }

  /**
   * 🎯 核心方法：切换布局（仅改变指针，不销毁旧布局）
   * 参考: RenderCanvas.cpp - 第396行 setLayout()
   */
  switchLayout(layoutId) {
    const layout = this.getLayout(layoutId);
    if (layout && layoutId !== this._currentLayout) {
      // ⭐ 只改变当前布局指针
      this._previousLayout = this._currentLayout;
      this._currentLayout = layoutId;

      // ⭐ 发出切换信号，通知UI更新
      this._emit('layoutChanged', {
        oldLayout: this._previousLayout,
        newLayout: layoutId
      });

      console.log(`[RenderCanvas] 布局已切换: ${this._previousLayout} -> ${layoutId}`);
      return true;
    }
    return false;
  }

  /**
   * 🎯 获取指定布局
   */
  getLayout(layoutId) {
    return this._layouts.get(layoutId);
  }

  /**
   * 删除布局
   */
  removeLayout(layoutId) {
    this._layouts.delete(layoutId);
    if (this._currentLayout === layoutId) {
      this._currentLayout = this._layouts.size > 0 ? this._layouts.keys().next().value : null;
    }
    this._emit('layoutChange', { layoutId: this._currentLayout });
  }

  /**
   * 🎯 保存布局配置（信号源绑定信息）
   */
  saveLayoutConfig(layoutId, config) {
    if (layoutId) {
      this._layoutConfigs.set(layoutId, { ...config });
      console.log(`[RenderCanvas] 已保存布局 ${layoutId} 的配置`);
    }
  }

  /**
   * 🎯 加载布局配置
   */
  loadLayoutConfig(layoutId) {
    if (layoutId && this._layoutConfigs.has(layoutId)) {
      const config = this._layoutConfigs.get(layoutId);
      console.log(`[RenderCanvas] 已加载布局 ${layoutId} 的配置`);
      return { ...config };
    }
    return null;
  }

  /**
   * 添加渲染元素
   */
  addElement(element) {
    this._elements.push(element);
    this._emit('elementAdd', { element });
  }

  /**
   * 移除渲染元素
   */
  removeElement(elementId) {
    const index = this._elements.findIndex(el => el.id === elementId);
    if (index !== -1) {
      const removed = this._elements.splice(index, 1)[0];
      this._emit('elementRemove', { element: removed });
    }
  }

  /**
   * 设置绘制模式
   */
  setDrawMode(mode) {
    this._drawMode = mode;
    this._canvas.style.cursor = mode === 'none' ? 'default' :
      mode === 'eraser' ? 'crosshair' : 'crosshair';
  }

  /**
   * 设置绘制颜色
   */
  setDrawColor(color) {
    this._drawColor = color;
  }

  /**
   * 设置绘制宽度
   */
  setDrawWidth(width) {
    this._drawWidth = width;
  }

  /**
   * 清除标注
   */
  clearAnnotations() {
    // 重新绘制所有元素，清除标注层
    this.draw();
  }

  /**
   * 开始截图
   */
  startCapture() {
    this._isCapturing = true;
    this._captureRect = null;
  }

  /**
   * 结束截图并保存
   */
  endCapture() {
    if (this._isCapturing) {
      this._isCapturing = false;
      return this.capture();
    }
    return null;
  }

  /**
   * 截图保存
   */
  capture(rect = null) {
    const captureRect = rect || { x: 0, y: 0, width: this._width, height: this._height };

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = captureRect.width;
    tempCanvas.height = captureRect.height;

    const tempContext = tempCanvas.getContext('2d');
    tempContext.drawImage(
      this._canvas,
      captureRect.x, captureRect.y,
      captureRect.width, captureRect.height,
      0, 0,
      captureRect.width, captureRect.height
    );

    // 下载截图
    const link = document.createElement('a');
    link.download = `capture_${Date.now()}.png`;
    link.href = tempCanvas.toDataURL('image/png');
    link.click();

    return tempCanvas.toDataURL('image/png');
  }

  /**
   * 绘制画布
   */
  draw() {
    // 清空画布
    this._context.fillStyle = '#0D1B2A';
    this._context.fillRect(0, 0, this._width, this._height);

    // 绘制所有元素
    this._elements.forEach(element => {
      if (element.draw) {
        element.draw(this._context);
      }
    });
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
        console.error(`[RenderCanvas] 事件 ${eventName} 处理失败:`, error);
      }
    });
  }

  /**
   * 获取画布属性
   */
  get canvas() { return this._canvas; }
  get context() { return this._context; }
  get width() { return this._width; }
  get height() { return this._height; }
  get currentLayout() { return this._currentLayout; }
  get previousLayout() { return this._previousLayout; }
  get elements() { return [...this._elements]; }
  get drawMode() { return this._drawMode; }
  get layouts() { return this._layouts; }
}
