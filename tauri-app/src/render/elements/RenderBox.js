/**
 * RenderBox - 视频盒子
 * 用于渲染视频流和图像内容
 */
import { RenderElement } from '../RenderElement.js';

export class RenderBox extends RenderElement {
  constructor(options = {}) {
    super(options);

    // 🎯 核心字段：信号源绑定信息（持久化）
    this._refId = null;           // 绑定的信号源ID（⭐ 持久化保存）
    this._sourceType = null;      // 信号源类型（⭐ 持久化保存）

    this._source = options.source || null;
    this._stream = options.stream || null;
    this._videoElement = null;
    this._image = null;
    this._aspectRatio = options.aspectRatio || 16 / 9;
    this._fillMode = options.fillMode || 'contain'; // contain, cover, fill

    // 🎯 新增：信号源事件订阅
    this._sourceSubscriptions = [];

    // 🆕 批注支持
    this._annotations = []; // 批注列表
    this._annotationCanvas = null; // 批注层 Canvas

    // 🆕 PTZ 控制配置
    this._ptzConfig = null;

    // 🆕 文档渲染支持
    this._documentRenderer = null;
    this._documentCanvas = null;

    // 加载状态
    this._isLoading = false;
    this._hasError = false;
    this._errorMessage = '';

    // 播放状态
    this._isPlaying = false;
    this._isMuted = true; // 默认静音，需要用户在音频管理中手动开启
    this._volume = 1;

    console.log(`[RenderBox] 创建视频盒子: ${this._id}`);
  }

  /**
   * 🎯 核心方法：设置信号源（参考 RenderBox.cpp setSource）
   *
   * void RenderBox::setSource(RenderSource* rs) {
   *     if (rs != nullptr) {
   *         refId = rs->getId();        // ⭐ 保存引用ID
   *         sourceType = rs->getType(); // ⭐ 保存类型
   *         detach();                   // 断开旧连接
   *         renderImage = new RenderImage(rs, window);
   *         connection = rs->sig_closed.connect(...);
   *     }
   * }
   */
  setSource(source) {
    if (source) {
      // ⭐ 保存引用ID和类型（持久化）
      this._refId = source.id;
      this._sourceType = source.type;

      // 断开旧连接
      this._detachSource();

      // 创建新的渲染对象
      this._source = source;

      // ⭐ 订阅信号源事件
      this._subscribeToSource(source);

      // 加载源
      this._loadSource();

      console.log(`[RenderBox] 信号源已绑定: refId=${this._refId}, type=${this._sourceType}`);
    } else {
      // 清空信号源
      this._detachSource();
      this._refId = null;
      this._sourceType = null;
      this._source = null;
    }
  }

  /**
   * 断开旧信号源连接
   */
  _detachSource() {
    // 取消所有订阅
    this._sourceSubscriptions.forEach(unsubscribe => unsubscribe());
    this._sourceSubscriptions = [];

    // 释放旧的媒体资源
    if (this._videoElement) {
      if (this._videoElement.srcObject) {
        this._videoElement.srcObject.getTracks().forEach(track => track.stop());
      }
      this._videoElement.src = '';
      this._videoElement = null;
    }
    this._image = null;
    this._stream = null;
  }

  /**
   * 订阅信号源事件
   */
  _subscribeToSource(source) {
    // 订阅信号源更新事件（实时渲染）
    const updateHandler = () => {
      // 当信号源更新时，触发重绘
      if (this._parent && this._parent.requestRedraw) {
        this._parent.requestRedraw();
      }
    };

    if (source.on) {
      source.on('updated', updateHandler);
      this._sourceSubscriptions.push(() => source.off('updated', updateHandler));

      // 订阅信号源关闭事件
      const closeHandler = () => {
        console.log(`[RenderBox] 信号源已关闭: ${this._refId}`);
        this._onSourceClosed();
      };
      source.on('closed', closeHandler);
      this._sourceSubscriptions.push(() => source.off('closed', closeHandler));
    }
  }

  /**
   * 信号源关闭处理
   */
  _onSourceClosed() {
    this._detachSource();
    this._refId = null;
    this._sourceType = null;
    this._hasError = true;
    this._errorMessage = '信号源已关闭';
  }

  /**
   * 加载源
   */
  async _loadSource() {
    if (!this._source) return;

    this._isLoading = true;

    try {
      switch (this._source.type) {
        case 'video':
          await this._loadVideo();
          break;
        case 'image':
          await this._loadImage();
          break;
        case 'camera':
        case 'screen':
          await this._loadStream();
          break;
        case 'document': // 🆕 文档类型
          await this._loadDocument();
          break;
        default:
          throw new Error(`未知的源类型: ${this._source.type}`);
      }
    } catch (error) {
      console.error(`[RenderBox] 加载源失败:`, error);
      this._hasError = true;
      this._errorMessage = error.message;
    } finally {
      this._isLoading = false;
    }
  }

  /**
   * 加载视频文件
   */
  async _loadVideo() {
    if (!this._source.url) {
      console.log('[RenderBox._loadVideo] 没有 URL，跳过');
      return;
    }

    console.log('[RenderBox._loadVideo] 开始加载视频:', this._source.url);
    this._videoElement = document.createElement('video');
    this._videoElement.src = this._source.url;
    this._videoElement.crossOrigin = 'anonymous';
    this._videoElement.loop = this._source.loop || false;
    this._videoElement.muted = this._isMuted;
    this._videoElement.volume = this._volume;
    this._videoElement.autoplay = true;

    this._videoElement.onloadedmetadata = () => {
      console.log('[RenderBox._loadVideo] 元数据加载完成, 尺寸:', this._videoElement.videoWidth, 'x', this._videoElement.videoHeight);
    };

    this._videoElement.onplay = () => {
      console.log('[RenderBox._loadVideo] 视频开始播放');
    };

    this._videoElement.onerror = (e) => {
      console.error('[RenderBox._loadVideo] 视频加载错误:', e);
    };

    await this._videoElement.play().catch((e) => {
      console.warn('[RenderBox._loadVideo] 自动播放失败:', e);
    });
    this._isPlaying = true;
  }

  /**
   * 加载图像
   */
  async _loadImage() {
    if (!this._source.url) return;

    return new Promise((resolve, reject) => {
      this._image = new Image();
      this._image.crossOrigin = 'anonymous';
      this._image.onload = () => resolve();
      this._image.onerror = () => reject(new Error('加载图像失败'));
      this._image.src = this._source.url;
    });
  }

  /**
   * 加载流
   */
  async _loadStream() {
    if (!this._source.stream) return;

    this._stream = this._source.stream;

    if (!this._videoElement) {
      this._videoElement = document.createElement('video');
      this._videoElement.muted = this._isMuted;
      this._videoElement.volume = this._volume;
      this._videoElement.autoplay = true;
      this._videoElement.playsinline = true;
    }

    this._videoElement.srcObject = this._stream;
    await this._videoElement.play().catch(() => { });
    this._isPlaying = true;
  }

  /**
   * 🆕 加载文档（PPT/PDF/Word等）
   */
  async _loadDocument() {
    if (!this._source.url && !this._source.content) return;

    try {
      // 创建文档渲染 Canvas
      this._documentCanvas = document.createElement('canvas');
      this._documentCanvas.width = this._width;
      this._documentCanvas.height = this._height;

      const ctx = this._documentCanvas.getContext('2d');

      // 根据文档类型渲染
      if (this._source.contentType === 'image') {
        // 如果是图片格式的文档（如 PPT 导出为图片）
        await this._loadImageAsDocument(ctx);
      } else if (this._source.contentType === 'pdf') {
        // PDF 文档需要使用 pdf.js
        await this._loadPdfAsDocument(ctx);
      } else {
        // 默认显示占位符
        this._renderDocumentPlaceholder(ctx, this._source.name || '文档');
      }

      console.log(`[RenderBox] 文档已加载: ${this._source.name}`);
    } catch (error) {
      console.error(`[RenderBox] 加载文档失败:`, error);
      throw error;
    }
  }

  /**
   * 🆕 以图片方式加载文档
   */
  async _loadImageAsDocument(ctx) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // 计算缩放比例以适应 Canvas
        const scale = Math.min(
          this._width / img.width,
          this._height / img.height
        );
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const x = (this._width - drawWidth) / 2;
        const y = (this._height - drawHeight) / 2;

        ctx.drawImage(img, x, y, drawWidth, drawHeight);
        resolve();
      };
      img.onerror = reject;
      img.src = this._source.url;
    });
  }

  /**
   * 🆕 以 PDF 方式加载文档
   */
  async _loadPdfAsDocument(ctx) {
    // TODO: 集成 pdf.js
    // 这里先显示占位符
    this._renderDocumentPlaceholder(ctx, 'PDF 文档');
  }

  /**
   * 🆕 渲染文档占位符
   */
  _renderDocumentPlaceholder(ctx, title) {
    ctx.fillStyle = '#1E3A5F';
    ctx.fillRect(0, 0, this._width, this._height);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, this._width / 2, this._height / 2 - 20);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#CCCCCC';
    ctx.fillText('文档预览', this._width / 2, this._height / 2 + 20);
  }

  /**
   * 绘制元素
   */
  _drawSelf(context) {
    // 绘制背景
    context.fillStyle = '#0D1B2A';
    context.fillRect(this._x, this._y, this._width, this._height);

    if (this._hasError) {
      // 绘制错误信息
      context.fillStyle = '#E74C3C';
      context.font = '14px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(this._errorMessage || '加载失败', this._x + this._width / 2, this._y + this._height / 2);
      return;
    }

    if (this._isLoading) {
      // 绘制加载中
      context.fillStyle = '#3498DB';
      context.font = '14px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('加载中...', this._x + this._width / 2, this._y + this._height / 2);
      return;
    }

    // 🆕 绘制内容（根据类型）
    if (this._documentCanvas) {
      // 绘制文档
      this._drawDocument(context);
    } else if (this._image) {
      // 绘制图像
      this._drawImage(context);
    } else if (this._videoElement) {
      // 绘制视频
      this._drawVideo(context);
    }

    // 🆕 绘制批注层
    if (this._annotations && this._annotations.length > 0) {
      this._drawAnnotations(context);
    }
  }

  /**
   * 绘制图像
   */
  _drawImage(context) {
    if (!this._image) return;

    const { drawX, drawY, drawWidth, drawHeight } = this._calculateDrawArea();

    context.drawImage(this._image, drawX, drawY, drawWidth, drawHeight);
  }

  /**
   * 绘制视频
   */
  _drawVideo(context) {
    if (!this._videoElement) return;

    const { drawX, drawY, drawWidth, drawHeight } = this._calculateDrawArea();

    try {
      context.drawImage(this._videoElement, drawX, drawY, drawWidth, drawHeight);
    } catch (error) {
      console.warn(`[RenderBox] 绘制视频失败:`, error);
    }
  }

  /**
   * 🆕 绘制文档
   */
  _drawDocument(context) {
    if (!this._documentCanvas) return;

    // 将文档 Canvas 绘制到主 Canvas
    context.drawImage(
      this._documentCanvas,
      this._x,
      this._y,
      this._width,
      this._height
    );
  }

  /**
   * 🆕 绘制批注层
   */
  _drawAnnotations(context) {
    context.save();

    // 设置批注样式
    this._annotations.forEach(annotation => {
      switch (annotation.type) {
        case 'line':
          this._drawLineAnnotation(context, annotation);
          break;
        case 'rect':
          this._drawRectAnnotation(context, annotation);
          break;
        case 'circle':
          this._drawCircleAnnotation(context, annotation);
          break;
        case 'text':
          this._drawTextAnnotation(context, annotation);
          break;
        case 'arrow':
          this._drawArrowAnnotation(context, annotation);
          break;
        default:
          console.warn(`[RenderBox] 未知批注类型: ${annotation.type}`);
      }
    });

    context.restore();
  }

  /**
   * 🆕 绘制线条批注
   */
  _drawLineAnnotation(context, annotation) {
    context.strokeStyle = annotation.color || '#FF0000';
    context.lineWidth = annotation.width || 2;
    context.lineCap = 'round';

    context.beginPath();
    context.moveTo(
      this._x + annotation.x1 * this._width,
      this._y + annotation.y1 * this._height
    );
    context.lineTo(
      this._x + annotation.x2 * this._width,
      this._y + annotation.y2 * this._height
    );
    context.stroke();
  }

  /**
   * 🆕 绘制矩形批注
   */
  _drawRectAnnotation(context, annotation) {
    context.strokeStyle = annotation.color || '#FF0000';
    context.lineWidth = annotation.width || 2;

    const x = this._x + annotation.x * this._width;
    const y = this._y + annotation.y * this._height;
    const width = annotation.width_ratio * this._width;
    const height = annotation.height_ratio * this._height;

    context.strokeRect(x, y, width, height);
  }

  /**
   * 🆕 绘制圆形批注
   */
  _drawCircleAnnotation(context, annotation) {
    context.strokeStyle = annotation.color || '#FF0000';
    context.lineWidth = annotation.width || 2;

    const centerX = this._x + annotation.cx * this._width;
    const centerY = this._y + annotation.cy * this._height;
    const radius = annotation.radius * Math.min(this._width, this._height);

    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.stroke();
  }

  /**
   * 🆕 绘制文本批注
   */
  _drawTextAnnotation(context, annotation) {
    context.fillStyle = annotation.color || '#FFFFFF';
    context.font = `${annotation.fontSize || 16}px sans-serif`;
    context.textAlign = annotation.align || 'left';
    context.textBaseline = 'top';

    const x = this._x + annotation.x * this._width;
    const y = this._y + annotation.y * this._height;

    context.fillText(annotation.text, x, y);
  }

  /**
   * 🆕 绘制箭头批注
   */
  _drawArrowAnnotation(context, annotation) {
    context.strokeStyle = annotation.color || '#FF0000';
    context.lineWidth = annotation.width || 2;
    context.lineCap = 'round';

    const startX = this._x + annotation.x1 * this._width;
    const startY = this._y + annotation.y1 * this._height;
    const endX = this._x + annotation.x2 * this._width;
    const endY = this._y + annotation.y2 * this._height;

    // 绘制线条
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.stroke();

    // 绘制箭头头部
    const angle = Math.atan2(endY - startY, endX - startX);
    const arrowLength = 15;
    const arrowAngle = Math.PI / 6;

    context.beginPath();
    context.moveTo(endX, endY);
    context.lineTo(
      endX - arrowLength * Math.cos(angle - arrowAngle),
      endY - arrowLength * Math.sin(angle - arrowAngle)
    );
    context.moveTo(endX, endY);
    context.lineTo(
      endX - arrowLength * Math.cos(angle + arrowAngle),
      endY - arrowLength * Math.sin(angle + arrowAngle)
    );
    context.stroke();
  }

  /**
   * 计算绘制区域
   */
  _calculateDrawArea() {
    const contentAspect = this._image ? this._image.width / this._image.height :
      this._aspectRatio;
    const boxAspect = this._width / this._height;

    let drawWidth, drawHeight, drawX, drawY;

    switch (this._fillMode) {
      case 'cover':
        if (contentAspect > boxAspect) {
          drawWidth = this._width;
          drawHeight = this._width / contentAspect;
        } else {
          drawHeight = this._height;
          drawWidth = this._height * contentAspect;
        }
        break;
      case 'fill':
        drawWidth = this._width;
        drawHeight = this._height;
        break;
      case 'contain':
      default:
        if (contentAspect > boxAspect) {
          drawHeight = this._height;
          drawWidth = this._height * contentAspect;
        } else {
          drawWidth = this._width;
          drawHeight = this._width / contentAspect;
        }
        break;
    }

    drawX = this._x + (this._width - drawWidth) / 2;
    drawY = this._y + (this._height - drawHeight) / 2;

    return { drawX, drawY, drawWidth, drawHeight };
  }

  /**
   * 播放/暂停
   */
  togglePlay() {
    if (this._videoElement) {
      if (this._isPlaying) {
        this._videoElement.pause();
      } else {
        this._videoElement.play().catch(() => { });
      }
      this._isPlaying = !this._isPlaying;
    }
  }

  /**
   * 设置静音
   */
  setMuted(muted) {
    this._isMuted = muted;
    if (this._videoElement) {
      this._videoElement.muted = muted;
    }
  }

  /**
   * 设置音量
   */
  setVolume(volume) {
    this._volume = Math.max(0, Math.min(1, volume));
    if (this._videoElement) {
      this._videoElement.volume = this._volume;
    }
  }

  // 🆕 ============================================
  // 批注管理方法
  // 🆕 ============================================

  /**
   * 🆕 添加批注
   */
  addAnnotation(annotation) {
    this._annotations.push({
      id: annotation.id || Date.now().toString(),
      type: annotation.type, // line, rect, circle, text, arrow
      ...annotation
    });

    // 触发重绘
    if (this._parent && this._parent.requestRedraw) {
      this._parent.requestRedraw();
    }

    console.log(`[RenderBox] 已添加批注: ${annotation.type}`);
  }

  /**
   * 🆕 移除批注
   */
  removeAnnotation(annotationId) {
    const index = this._annotations.findIndex(a => a.id === annotationId);
    if (index !== -1) {
      this._annotations.splice(index, 1);

      // 触发重绘
      if (this._parent && this._parent.requestRedraw) {
        this._parent.requestRedraw();
      }

      console.log(`[RenderBox] 已移除批注: ${annotationId}`);
    }
  }

  /**
   * 🆕 清空所有批注
   */
  clearAnnotations() {
    this._annotations = [];

    // 触发重绘
    if (this._parent && this._parent.requestRedraw) {
      this._parent.requestRedraw();
    }

    console.log(`[RenderBox] 已清空所有批注`);
  }

  /**
   * 🆕 获取所有批注
   */
  getAnnotations() {
    return [...this._annotations];
  }

  // 🆕 ============================================
  // PTZ 控制方法
  // 🆕 ============================================

  /**
   * 🆕 设置 PTZ 配置
   */
  setPtzConfig(config) {
    this._ptzConfig = config;
    console.log(`[RenderBox] 已设置 PTZ 配置:`, config);
  }

  /**
   * 🆕 PTZ 控制命令
   */
  async ptzControl(command) {
    if (!this._ptzConfig) {
      console.warn('[RenderBox] 未配置 PTZ');
      return;
    }

    if (this._sourceType !== 'networkCamera') {
      console.warn('[RenderBox] 只有网络摄像头支持 PTZ 控制');
      return;
    }

    try {
      // TODO: 调用 ONVIF API
      // 这里先模拟 PTZ 控制
      console.log(`[RenderBox] PTZ 控制命令:`, command);

      switch (command.action) {
        case 'move':
          await this._ptzMove(command.direction, command.speed);
          break;
        case 'zoom':
          await this._ptzZoom(command.direction, command.speed);
          break;
        case 'focus':
          await this._ptzFocus(command.direction, command.speed);
          break;
        case 'preset':
          await this._ptzGotoPreset(command.presetId);
          break;
        default:
          throw new Error(`未知 PTZ 命令: ${command.action}`);
      }
    } catch (error) {
      console.error('[RenderBox] PTZ 控制失败:', error);
      throw error;
    }
  }

  /**
   * 🆕 PTZ 移动
   */
  async _ptzMove(direction, speed) {
    console.log(`[RenderBox] PTZ 移动: ${direction}, 速度: ${speed}`);
    // TODO: 实现实际的 ONVIF 移动命令
  }

  /**
   * 🆕 PTZ 变焦
   */
  async _ptzZoom(direction, speed) {
    console.log(`[RenderBox] PTZ 变焦: ${direction}, 速度: ${speed}`);
    // TODO: 实现实际的 ONVIF 变焦命令
  }

  /**
   * 🆕 PTZ 对焦
   */
  async _ptzFocus(direction, speed) {
    console.log(`[RenderBox] PTZ 对焦: ${direction}, 速度: ${speed}`);
    // TODO: 实现实际的 ONVIF 对焦命令
  }

  /**
   * 🆕 PTZ 预置位
   */
  async _ptzGotoPreset(presetId) {
    console.log(`[RenderBox] PTZ 跳转到预置位: ${presetId}`);
    // TODO: 实现实际的 ONVIF 预置位命令
  }

  /**
   * 释放资源
   */
  dispose() {
    // 断开信号源连接
    this._detachSource();

    if (this._videoElement) {
      if (this._videoElement.srcObject) {
        this._videoElement.srcObject.getTracks().forEach(track => track.stop());
      }
      this._videoElement.src = '';
      this._videoElement = null;
    }
    this._image = null;
    this._stream = null;

    // 🆕 清理批注
    this._annotations = [];
    if (this._annotationCanvas) {
      this._annotationCanvas = null;
    }

    // 🆕 清理文档渲染器
    if (this._documentRenderer) {
      this._documentRenderer = null;
    }
    if (this._documentCanvas) {
      this._documentCanvas = null;
    }

    // 🆕 清理 PTZ 配置
    this._ptzConfig = null;

    console.log(`[RenderBox] 已释放资源: ${this._id}`);
  }

  /**
   * 获取属性
   */
  get source() { return this._source; }
  get isPlaying() { return this._isPlaying; }
  get isMuted() { return this._isMuted; }
  get volume() { return this._volume; }
  get fillMode() { return this._fillMode; }
  set fillMode(value) { this._fillMode = value; }

  // 🎯 新增：信号源绑定信息 getter
  get refId() { return this._refId; }
  get sourceType() { return this._sourceType; }
  get haveSource() { return this._refId !== null; }
}
