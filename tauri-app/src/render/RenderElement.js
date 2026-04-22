/**
 * RenderElement - 渲染元素基类
 * 所有渲染元素的抽象基类
 */
export class RenderElement {
  constructor(options = {}) {
    this._id = options.id || `element-${Date.now()}`;
    this._x = options.x || 0;
    this._y = options.y || 0;
    this._width = options.width || 0;
    this._height = options.height || 0;
    this._visible = options.visible !== undefined ? options.visible : true;
    this._opacity = options.opacity || 1;
    this._zIndex = options.zIndex || 0;
    this._transform = options.transform || { scale: 1, rotation: 0, skewX: 0, skewY: 0 };
    
    // 锚点位置 (0-1)
    this._anchorX = options.anchorX || 0.5;
    this._anchorY = options.anchorY || 0.5;
    
    // 裁剪区域
    this._clipRect = null;
    
    // 父元素
    this._parent = null;
    
    // 子元素
    this._children = [];
    
    console.log(`[RenderElement] 创建元素: ${this._id}`);
  }
  
  /**
   * 绘制元素
   * @param {CanvasRenderingContext2D} context - 渲染上下文
   */
  draw(context) {
    if (!this._visible) return;
    
    context.save();
    
    // 应用透明度
    context.globalAlpha = this._opacity;
    
    // 应用变换
    this._applyTransform(context);
    
    // 应用裁剪
    if (this._clipRect) {
      context.beginPath();
      context.rect(this._clipRect.x, this._clipRect.y, this._clipRect.width, this._clipRect.height);
      context.clip();
    }
    
    // 绘制自身
    this._drawSelf(context);
    
    // 绘制子元素
    this._drawChildren(context);
    
    context.restore();
  }
  
  /**
   * 应用变换
   */
  _applyTransform(context) {
    // 计算锚点偏移
    const offsetX = this._width * this._anchorX;
    const offsetY = this._height * this._anchorY;
    
    // 平移到位置
    context.translate(this._x + offsetX, this._y + offsetY);
    
    // 应用缩放
    context.scale(this._transform.scale, this._transform.scale);
    
    // 应用旋转
    if (this._transform.rotation !== 0) {
      context.rotate((this._transform.rotation * Math.PI) / 180);
    }
    
    // 应用斜切
    if (this._transform.skewX !== 0) {
      context.transform(1, 0, Math.tan((this._transform.skewX * Math.PI) / 180), 1, 0, 0);
    }
    if (this._transform.skewY !== 0) {
      context.transform(1, Math.tan((this._transform.skewY * Math.PI) / 180), 0, 1, 0, 0);
    }
    
    // 平移回锚点
    context.translate(-offsetX, -offsetY);
  }
  
  /**
   * 绘制自身（由子类实现）
   */
  _drawSelf(context) {
    // 默认实现：绘制一个矩形
    context.fillStyle = '#2D3E50';
    context.fillRect(this._x, this._y, this._width, this._height);
    context.strokeStyle = '#4A6785';
    context.lineWidth = 1;
    context.strokeRect(this._x, this._y, this._width, this._height);
  }
  
  /**
   * 绘制子元素
   */
  _drawChildren(context) {
    // 按 zIndex 排序子元素
    const sortedChildren = [...this._children].sort((a, b) => a.zIndex - b.zIndex);
    
    sortedChildren.forEach(child => {
      child.draw(context);
    });
  }
  
  /**
   * 设置位置
   */
  setPosition(x, y) {
    this._x = x;
    this._y = y;
  }
  
  /**
   * 设置尺寸
   */
  setSize(width, height) {
    this._width = width;
    this._height = height;
  }
  
  /**
   * 设置变换
   */
  setTransform(transform) {
    this._transform = { ...this._transform, ...transform };
  }
  
  /**
   * 设置裁剪区域
   */
  setClipRect(rect) {
    this._clipRect = rect;
  }
  
  /**
   * 添加子元素
   */
  addChild(element) {
    if (element instanceof RenderElement) {
      element._parent = this;
      this._children.push(element);
    }
  }
  
  /**
   * 移除子元素
   */
  removeChild(element) {
    const index = this._children.indexOf(element);
    if (index !== -1) {
      this._children[index]._parent = null;
      this._children.splice(index, 1);
    }
  }
  
  /**
   * 检查点是否在元素内
   */
  containsPoint(x, y) {
    return x >= this._x && x <= this._x + this._width &&
           y >= this._y && y <= this._y + this._height;
  }
  
  /**
   * 获取属性
   */
  get id() { return this._id; }
  get x() { return this._x; }
  get y() { return this._y; }
  get width() { return this._width; }
  get height() { return this._height; }
  get visible() { return this._visible; }
  set visible(value) { this._visible = value; }
  get opacity() { return this._opacity; }
  set opacity(value) { this._opacity = Math.max(0, Math.min(1, value)); }
  get zIndex() { return this._zIndex; }
  set zIndex(value) { this._zIndex = value; }
  get transform() { return { ...this._transform }; }
  get parent() { return this._parent; }
  get children() { return [...this._children]; }
}
