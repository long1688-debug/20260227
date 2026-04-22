/**
 * RenderWindow - 窗口抽象
 * 负责管理渲染窗口的创建、尺寸调整和事件处理
 */
export class RenderWindow {
  constructor(options = {}) {
    this._id = options.id || `window-${Date.now()}`;
    this._title = options.title || 'Render Window';
    this._width = options.width || 800;
    this._height = options.height || 600;
    this._x = options.x || 0;
    this._y = options.y || 0;
    this._visible = options.visible !== undefined ? options.visible : true;
    this._minimized = false;
    this._maximized = false;
    
    // DOM元素
    this._container = null;
    this._canvas = null;
    
    // 子窗口
    this._children = [];
    
    // 事件处理器
    this._handlers = {
      resize: [],
      move: [],
      close: [],
      focus: [],
      blur: []
    };
    
    console.log(`[RenderWindow] 创建窗口: ${this._id}`);
  }
  
  /**
   * 创建窗口
   * @param {HTMLElement} parent - 父容器
   */
  create(parent) {
    // 创建窗口容器
    this._container = document.createElement('div');
    this._container.id = this._id;
    this._container.className = 'render-window';
    this._container.style.cssText = `
      position: absolute;
      left: ${this._x}px;
      top: ${this._y}px;
      width: ${this._width}px;
      height: ${this._height}px;
      background: #1B263B;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      overflow: hidden;
      z-index: 100;
    `;
    
    // 创建标题栏
    const titleBar = document.createElement('div');
    titleBar.className = 'render-window-titlebar';
    titleBar.style.cssText = `
      height: 32px;
      background: #0D1B2A;
      display: flex;
      align-items: center;
      padding: 0 12px;
      cursor: move;
    `;
    
    const titleText = document.createElement('span');
    titleText.textContent = this._title;
    titleText.style.color = '#E0E0E0';
    titleText.style.fontSize = '14px';
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
      margin-left: auto;
      width: 24px;
      height: 24px;
      border: none;
      background: rgba(255, 255, 255, 0.1);
      color: #E0E0E0;
      border-radius: 4px;
      cursor: pointer;
    `;
    closeBtn.addEventListener('click', () => this.close());
    
    titleBar.appendChild(titleText);
    titleBar.appendChild(closeBtn);
    
    // 创建内容区域
    const contentArea = document.createElement('div');
    contentArea.className = 'render-window-content';
    contentArea.style.cssText = `
      height: calc(100% - 32px);
      position: relative;
    `;
    
    // 创建画布
    this._canvas = document.createElement('canvas');
    this._canvas.width = this._width;
    this._canvas.height = this._height - 32;
    this._canvas.style.width = '100%';
    this._canvas.style.height = '100%';
    
    contentArea.appendChild(this._canvas);
    this._container.appendChild(titleBar);
    this._container.appendChild(contentArea);
    
    if (parent) {
      parent.appendChild(this._container);
    }
    
    // 设置可见性
    this._container.style.display = this._visible ? 'block' : 'none';
    
    console.log(`[RenderWindow] 窗口创建完成: ${this._id}`);
  }
  
  /**
   * 显示窗口
   */
  show() {
    if (this._container) {
      this._container.style.display = 'block';
      this._visible = true;
    }
  }
  
  /**
   * 隐藏窗口
   */
  hide() {
    if (this._container) {
      this._container.style.display = 'none';
      this._visible = false;
    }
  }
  
  /**
   * 最小化窗口
   */
  minimize() {
    this._minimized = true;
    this._maximized = false;
    this.hide();
    this._emit('resize', { width: 0, height: 0 });
  }
  
  /**
   * 最大化窗口
   */
  maximize() {
    if (this._container && this._container.parentElement) {
      const parentRect = this._container.parentElement.getBoundingClientRect();
      this._x = 0;
      this._y = 0;
      this._width = parentRect.width;
      this._height = parentRect.height;
      this._updatePosition();
      this._updateSize();
      this._maximized = true;
      this._minimized = false;
      this._emit('resize', { width: this._width, height: this._height });
    }
  }
  
  /**
   * 还原窗口
   */
  restore() {
    this._maximized = false;
    this._minimized = false;
    this.show();
    this._updatePosition();
    this._updateSize();
    this._emit('resize', { width: this._width, height: this._height });
  }
  
  /**
   * 关闭窗口
   */
  close() {
    this._emit('close');
    if (this._container && this._container.parentElement) {
      this._container.parentElement.removeChild(this._container);
    }
  }
  
  /**
   * 设置窗口位置
   */
  setPosition(x, y) {
    this._x = x;
    this._y = y;
    this._updatePosition();
    this._emit('move', { x, y });
  }
  
  /**
   * 设置窗口尺寸
   */
  setSize(width, height) {
    this._width = width;
    this._height = height;
    this._updateSize();
    this._emit('resize', { width, height });
  }
  
  /**
   * 更新位置
   */
  _updatePosition() {
    if (this._container) {
      this._container.style.left = `${this._x}px`;
      this._container.style.top = `${this._y}px`;
    }
  }
  
  /**
   * 更新尺寸
   */
  _updateSize() {
    if (this._container) {
      this._container.style.width = `${this._width}px`;
      this._container.style.height = `${this._height}px`;
    }
    if (this._canvas) {
      this._canvas.width = this._width;
      this._canvas.height = this._height - 32;
    }
  }
  
  /**
   * 添加子窗口
   */
  addChild(window) {
    if (window instanceof RenderWindow) {
      this._children.push(window);
    }
  }
  
  /**
   * 移除子窗口
   */
  removeChild(window) {
    const index = this._children.indexOf(window);
    if (index !== -1) {
      this._children.splice(index, 1);
    }
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
        console.error(`[RenderWindow] 事件 ${eventName} 处理失败:`, error);
      }
    });
  }
  
  /**
   * 获取画布元素
   */
  get canvas() {
    return this._canvas;
  }
  
  /**
   * 获取窗口属性
   */
  get id() { return this._id; }
  get title() { return this._title; }
  set title(value) { this._title = value; }
  get width() { return this._width; }
  get height() { return this._height; }
  get x() { return this._x; }
  get y() { return this._y; }
  get visible() { return this._visible; }
  get minimized() { return this._minimized; }
  get maximized() { return this._maximized; }
}
