/**
 * RenderShape - 图形盒子
 * 用于绘制各种图形形状，如矩形、圆形、线条、多边形等
 */
import { RenderElement } from '../RenderElement.js';

export class RenderShape extends RenderElement {
  constructor(options = {}) {
    super(options);
    
    this._shapeType = options.shapeType || 'rect'; // rect, circle, line, polygon, path, arc, text
    this._fillColor = options.fillColor || 'rgba(52, 152, 219, 0.5)';
    this._strokeColor = options.strokeColor || '#3498DB';
    this._strokeWidth = options.strokeWidth || 2;
    this._lineCap = options.lineCap || 'round'; // butt, round, square
    this._lineJoin = options.lineJoin || 'round'; // miter, round, bevel
    
    // 图形特定参数
    this._radius = options.radius || 0;
    this._points = options.points || []; // 用于多边形和路径
    this._pathData = options.pathData || ''; // SVG路径数据
    
    // 文本属性
    this._text = options.text || '';
    this._fontSize = options.fontSize || 14;
    this._fontFamily = options.fontFamily || 'sans-serif';
    
    console.log(`[RenderShape] 创建图形盒子: ${this._id}, 类型: ${this._shapeType}`);
  }
  
  /**
   * 绘制元素
   */
  _drawSelf(context) {
    context.fillStyle = this._fillColor;
    context.strokeStyle = this._strokeColor;
    context.lineWidth = this._strokeWidth;
    context.lineCap = this._lineCap;
    context.lineJoin = this._lineJoin;
    
    switch (this._shapeType) {
      case 'rect':
        this._drawRect(context);
        break;
      case 'circle':
        this._drawCircle(context);
        break;
      case 'line':
        this._drawLine(context);
        break;
      case 'polygon':
        this._drawPolygon(context);
        break;
      case 'path':
        this._drawPath(context);
        break;
      case 'arc':
        this._drawArc(context);
        break;
      case 'text':
        this._drawText(context);
        break;
      default:
        this._drawRect(context);
    }
  }
  
  /**
   * 绘制矩形
   */
  _drawRect(context) {
    context.beginPath();
    context.rect(this._x, this._y, this._width, this._height);
    
    if (this._fillColor !== 'transparent') {
      context.fill();
    }
    if (this._strokeWidth > 0) {
      context.stroke();
    }
  }
  
  /**
   * 绘制圆形
   */
  _drawCircle(context) {
    const radius = this._radius || Math.min(this._width, this._height) / 2;
    const centerX = this._x + this._width / 2;
    const centerY = this._y + this._height / 2;
    
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    
    if (this._fillColor !== 'transparent') {
      context.fill();
    }
    if (this._strokeWidth > 0) {
      context.stroke();
    }
  }
  
  /**
   * 绘制线条
   */
  _drawLine(context) {
    context.beginPath();
    context.moveTo(this._x, this._y);
    context.lineTo(this._x + this._width, this._y + this._height);
    context.stroke();
  }
  
  /**
   * 绘制多边形
   */
  _drawPolygon(context) {
    if (this._points.length < 3) return;
    
    context.beginPath();
    context.moveTo(this._x + this._points[0].x, this._y + this._points[0].y);
    
    for (let i = 1; i < this._points.length; i++) {
      context.lineTo(this._x + this._points[i].x, this._y + this._points[i].y);
    }
    
    context.closePath();
    
    if (this._fillColor !== 'transparent') {
      context.fill();
    }
    if (this._strokeWidth > 0) {
      context.stroke();
    }
  }
  
  /**
   * 绘制路径
   */
  _drawPath(context) {
    if (!this._pathData) return;
    
    // 解析SVG路径数据并绘制
    const path = new Path2D(this._pathData);
    
    // 应用变换
    const matrix = new DOMMatrix([1, 0, 0, 1, this._x, this._y]);
    const transformedPath = path.addPath(path, matrix);
    
    if (this._fillColor !== 'transparent') {
      context.fill(transformedPath);
    }
    if (this._strokeWidth > 0) {
      context.stroke(transformedPath);
    }
  }
  
  /**
   * 绘制弧线
   */
  _drawArc(context) {
    const radius = this._radius || Math.min(this._width, this._height) / 2;
    const centerX = this._x + this._width / 2;
    const centerY = this._y + this._height / 2;
    const startAngle = 0;
    const endAngle = Math.PI * 2 * 0.75; // 270度
    
    context.beginPath();
    context.arc(centerX, centerY, radius, startAngle, endAngle);
    
    if (this._fillColor !== 'transparent') {
      context.lineTo(centerX, centerY);
      context.closePath();
      context.fill();
    }
    if (this._strokeWidth > 0) {
      context.stroke();
    }
  }
  
  /**
   * 绘制文本
   */
  _drawText(context) {
    context.font = `${this._fontSize}px ${this._fontFamily}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = this._fillColor;
    context.fillText(this._text, this._x + this._width / 2, this._y + this._height / 2);
    
    if (this._strokeWidth > 0) {
      context.strokeStyle = this._strokeColor;
      context.strokeText(this._text, this._x + this._width / 2, this._y + this._height / 2);
    }
  }
  
  /**
   * 设置路径数据
   */
  setPathData(pathData) {
    this._pathData = pathData;
    this._shapeType = 'path';
  }
  
  /**
   * 设置多边形点
   */
  setPoints(points) {
    this._points = points;
    this._shapeType = 'polygon';
  }
  
  /**
   * 设置属性
   */
  set fillColor(value) { this._fillColor = value; }
  set strokeColor(value) { this._strokeColor = value; }
  set strokeWidth(value) { this._strokeWidth = value; }
  set radius(value) { this._radius = value; }
  set text(value) { this._text = value; }
  set fontSize(value) { this._fontSize = value; }
  
  /**
   * 获取属性
   */
  get shapeType() { return this._shapeType; }
  get fillColor() { return this._fillColor; }
  get strokeColor() { return this._strokeColor; }
  get strokeWidth() { return this._strokeWidth; }
  get radius() { return this._radius; }
  get points() { return [...this._points]; }
}
