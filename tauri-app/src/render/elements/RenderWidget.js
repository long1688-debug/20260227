/**
 * RenderWidget - 控件盒子
 * 用于渲染UI控件，如按钮、文本、进度条等
 */
import { RenderElement } from '../RenderElement.js';

export class RenderWidget extends RenderElement {
  constructor(options = {}) {
    super(options);
    
    this._type = options.type || 'text'; // text, button, progress, checkbox, slider
    this._text = options.text || '';
    this._fontSize = options.fontSize || 14;
    this._fontFamily = options.fontFamily || 'sans-serif';
    this._textColor = options.textColor || '#E0E0E0';
    this._backgroundColor = options.backgroundColor || 'rgba(45, 62, 80, 0.8)';
    this._borderColor = options.borderColor || '#4A6785';
    this._borderWidth = options.borderWidth || 1;
    this._borderRadius = options.borderRadius || 4;
    
    // 按钮状态
    this._isPressed = false;
    this._isHovered = false;
    
    // 进度条
    this._progress = options.progress || 0;
    
    // 复选框
    this._checked = options.checked || false;
    
    // 滑块
    this._value = options.value || 0;
    this._minValue = options.minValue || 0;
    this._maxValue = options.maxValue || 100;
    
    // 事件回调
    this._onClick = options.onClick || null;
    
    console.log(`[RenderWidget] 创建控件盒子: ${this._id}, 类型: ${this._type}`);
  }
  
  /**
   * 绘制元素
   */
  _drawSelf(context) {
    switch (this._type) {
      case 'text':
        this._drawText(context);
        break;
      case 'button':
        this._drawButton(context);
        break;
      case 'progress':
        this._drawProgress(context);
        break;
      case 'checkbox':
        this._drawCheckbox(context);
        break;
      case 'slider':
        this._drawSlider(context);
        break;
      default:
        this._drawText(context);
    }
  }
  
  /**
   * 绘制文本
   */
  _drawText(context) {
    context.font = `${this._fontSize}px ${this._fontFamily}`;
    context.fillStyle = this._textColor;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(this._text, this._x + this._width / 2, this._y + this._height / 2);
  }
  
  /**
   * 绘制按钮
   */
  _drawButton(context) {
    // 绘制背景
    const bgColor = this._isPressed ? '#1E3A5F' : this._isHovered ? '#3A5F7A' : this._backgroundColor;
    context.fillStyle = bgColor;
    
    this._roundRect(context, this._x, this._y, this._width, this._height, this._borderRadius);
    context.fill();
    
    // 绘制边框
    context.strokeStyle = this._borderColor;
    context.lineWidth = this._borderWidth;
    this._roundRect(context, this._x, this._y, this._width, this._height, this._borderRadius);
    context.stroke();
    
    // 绘制文本
    context.font = `${this._fontSize}px ${this._fontFamily}`;
    context.fillStyle = this._textColor;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(this._text, this._x + this._width / 2, this._y + this._height / 2);
  }
  
  /**
   * 绘制进度条
   */
  _drawProgress(context) {
    // 绘制背景
    context.fillStyle = '#1B263B';
    this._roundRect(context, this._x, this._y, this._width, this._height, this._borderRadius);
    context.fill();
    
    // 绘制进度
    const progressWidth = this._width * Math.min(1, this._progress);
    const gradient = context.createLinearGradient(this._x, this._y, this._x + progressWidth, this._y);
    gradient.addColorStop(0, '#3498DB');
    gradient.addColorStop(1, '#2980B9');
    context.fillStyle = gradient;
    this._roundRect(context, this._x, this._y, progressWidth, this._height, this._borderRadius);
    context.fill();
    
    // 绘制边框
    context.strokeStyle = this._borderColor;
    context.lineWidth = this._borderWidth;
    this._roundRect(context, this._x, this._y, this._width, this._height, this._borderRadius);
    context.stroke();
    
    // 绘制百分比文本
    context.font = '12px sans-serif';
    context.fillStyle = '#E0E0E0';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(`${Math.round(this._progress * 100)}%`, this._x + this._width / 2, this._y + this._height / 2);
  }
  
  /**
   * 绘制复选框
   */
  _drawCheckbox(context) {
    // 绘制背景
    context.fillStyle = this._backgroundColor;
    context.fillRect(this._x, this._y, this._width, this._height);
    
    // 绘制边框
    context.strokeStyle = this._checked ? '#4CAF50' : this._borderColor;
    context.lineWidth = this._borderWidth;
    context.strokeRect(this._x, this._y, this._width, this._height);
    
    // 绘制勾选标记
    if (this._checked) {
      context.strokeStyle = '#4CAF50';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(this._x + 4, this._y + this._height / 2);
      context.lineTo(this._x + this._width / 3, this._y + this._height - 4);
      context.lineTo(this._x + this._width - 4, this._y + 4);
      context.stroke();
    }
  }
  
  /**
   * 绘制滑块
   */
  _drawSlider(context) {
    // 计算位置
    const range = this._maxValue - this._minValue;
    const ratio = (this._value - this._minValue) / range;
    const thumbX = this._x + 10 + (this._width - 20) * ratio;
    const thumbRadius = 8;
    
    // 绘制轨道背景
    context.fillStyle = '#1B263B';
    context.fillRect(this._x, this._y + this._height / 2 - 4, this._width, 8);
    
    // 绘制轨道填充
    context.fillStyle = '#3498DB';
    context.fillRect(this._x, this._y + this._height / 2 - 4, thumbX - this._x + thumbRadius, 8);
    
    // 绘制滑块
    context.fillStyle = '#FFFFFF';
    context.beginPath();
    context.arc(thumbX, this._y + this._height / 2, thumbRadius, 0, Math.PI * 2);
    context.fill();
    
    context.strokeStyle = '#3498DB';
    context.lineWidth = 2;
    context.stroke();
  }
  
  /**
   * 绘制圆角矩形
   */
  _roundRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
  }
  
  /**
   * 处理点击
   */
  handleClick() {
    if (this._onClick) {
      this._onClick();
    }
    
    if (this._type === 'checkbox') {
      this._checked = !this._checked;
    }
  }
  
  /**
   * 设置按钮状态
   */
  setPressed(pressed) {
    this._isPressed = pressed;
  }
  
  setHovered(hovered) {
    this._isHovered = hovered;
  }
  
  /**
   * 设置属性
   */
  set text(value) { this._text = value; }
  set progress(value) { this._progress = Math.max(0, Math.min(1, value)); }
  set checked(value) { this._checked = value; }
  set value(value) { this._value = Math.max(this._minValue, Math.min(this._maxValue, value)); }
  
  /**
   * 获取属性
   */
  get type() { return this._type; }
  get text() { return this._text; }
  get progress() { return this._progress; }
  get checked() { return this._checked; }
  get value() { return this._value; }
  get isPressed() { return this._isPressed; }
  get isHovered() { return this._isHovered; }
}
