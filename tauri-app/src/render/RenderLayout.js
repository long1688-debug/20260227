/**
 * RenderLayout - 布局管理类
 * 负责管理画布布局，支持多种布局模式
 */
export class RenderLayout {
  constructor(options = {}) {
    this._id = options.id || `layout-${Date.now()}`;
    this._name = options.name || 'Untitled Layout';
    this._type = options.type || 'grid'; // grid, single, picture-in-picture, custom
    this._rows = options.rows || 1;
    this._cols = options.cols || 1;
    this._regions = [];
    this._activeRegion = null;

    // 🎯 核心：独立的 elements 数组（vector<RenderElement>）
    this._elements = [];

    // 布局配置
    this._config = {
      gap: options.gap || 4,
      padding: options.padding || 8,
      borderColor: options.borderColor || 'rgba(255, 255, 255, 0.1)',
      activeBorderColor: options.activeBorderColor || '#4CAF50'
    };

    console.log(`[RenderLayout] 创建布局: ${this._id}, 类型: ${this._type}`);
  }

  /**
   * 初始化布局区域
   */
  init(width, height) {
    this._regions = [];
    const totalWidth = width - this._config.padding * 2;
    const totalHeight = height - this._config.padding * 2;

    switch (this._type) {
      case 'single':
        this._createSingleRegion(totalWidth, totalHeight);
        break;
      case 'grid':
        this._createGridRegions(totalWidth, totalHeight);
        break;
      case 'picture-in-picture':
        this._createPictureInPictureRegions(totalWidth, totalHeight);
        break;
      default:
        this._createGridRegions(totalWidth, totalHeight);
    }

    console.log(`[RenderLayout] 布局 ${this._id} 初始化完成，区域数: ${this._regions.length}`);
  }

  /**
   * 创建单区域布局
   */
  _createSingleRegion(width, height) {
    this._regions.push({
      id: 'region-0',
      x: this._config.padding,
      y: this._config.padding,
      width: width,
      height: height,
      sourceId: null,
      visible: true
    });
  }

  /**
   * 创建网格区域布局
   */
  _createGridRegions(width, height) {
    const regionWidth = (width - this._config.gap * (this._cols - 1)) / this._cols;
    const regionHeight = (height - this._config.gap * (this._rows - 1)) / this._rows;

    let index = 0;
    for (let row = 0; row < this._rows; row++) {
      for (let col = 0; col < this._cols; col++) {
        this._regions.push({
          id: `region-${index}`,
          x: this._config.padding + col * (regionWidth + this._config.gap),
          y: this._config.padding + row * (regionHeight + this._config.gap),
          width: regionWidth,
          height: regionHeight,
          sourceId: null,
          visible: true
        });
        index++;
      }
    }
  }

  /**
   * 创建画中画布局
   */
  _createPictureInPictureRegions(width, height) {
    // 主区域占大部分
    this._regions.push({
      id: 'region-main',
      x: this._config.padding,
      y: this._config.padding,
      width: width,
      height: height,
      sourceId: null,
      visible: true
    });

    // 小窗口
    const pipWidth = 240;
    const pipHeight = 135;
    this._regions.push({
      id: 'region-pip',
      x: width - pipWidth - this._config.padding - 16,
      y: height - pipHeight - this._config.padding - 16,
      width: pipWidth,
      height: pipHeight,
      sourceId: null,
      visible: true
    });
  }

  /**
   * 绘制布局
   */
  draw(context) {
    this._regions.forEach(region => {
      if (!region.visible) return;

      // 绘制区域边框
      context.strokeStyle = region.id === this._activeRegion ?
        this._config.activeBorderColor : this._config.borderColor;
      context.lineWidth = region.id === this._activeRegion ? 2 : 1;
      context.strokeRect(region.x, region.y, region.width, region.height);

      // 如果没有源，显示占位符
      if (!region.sourceId) {
        context.fillStyle = 'rgba(255, 255, 255, 0.05)';
        context.fillRect(region.x, region.y, region.width, region.height);

        context.fillStyle = 'rgba(255, 255, 255, 0.3)';
        context.font = '14px sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('点击添加源', region.x + region.width / 2, region.y + region.height / 2);
      }
    });
  }

  /**
   * 设置区域源
   */
  setRegionSource(regionId, sourceId) {
    const region = this._regions.find(r => r.id === regionId);
    if (region) {
      region.sourceId = sourceId;
    }
  }

  /**
   * 激活区域
   */
  activateRegion(regionId) {
    this._activeRegion = regionId;
  }

  /**
   * 切换区域可见性
   */
  toggleRegionVisibility(regionId) {
    const region = this._regions.find(r => r.id === regionId);
    if (region) {
      region.visible = !region.visible;
    }
  }

  /**
   * 查找包含点的区域
   */
  findRegionAt(x, y) {
    return this._regions.find(region =>
      region.visible &&
      x >= region.x && x <= region.x + region.width &&
      y >= region.y && y <= region.y + region.height
    );
  }

  /**
   * 获取区域
   */
  getRegion(regionId) {
    return this._regions.find(r => r.id === regionId);
  }

  /**
   * 获取所有区域
   */
  get regions() {
    return [...this._regions];
  }

  /**
   * 🎯 添加元素到当前布局
   */
  appendElement(element) {
    this._elements.push(element);
    element._parent = this;
    console.log(`[RenderLayout] 添加元素到布局 ${this._id}: ${element.id}`);
  }

  /**
   * 🎯 查找指定ID的Box
   */
  findBox(boxId) {
    return this._elements.find(el => el.id === boxId);
  }

  /**
   * 🎯 命中测试（用于拖拽）
   */
  hitTest(x, y, elementType = 'box') {
    for (let i = this._elements.length - 1; i >= 0; i--) {
      const element = this._elements[i];
      if (element.type === elementType && element.containsPoint(x, y)) {
        return element;
      }
    }
    return null;
  }

  /**
   * 🎯 获取所有元素
   */
  get elements() {
    return [...this._elements];
  }

  /**
   * 🎯 请求重绘
   */
  requestRedraw() {
    // 触发父级画布重绘
    // 这里可以通过事件或回调实现
    if (this._onRedraw) {
      this._onRedraw();
    }
  }

  /**
   * 设置重绘回调
   */
  setRedrawCallback(callback) {
    this._onRedraw = callback;
  }

  /**
   * 获取属性
   */
  get id() { return this._id; }
  get name() { return this._name; }
  set name(value) { this._name = value; }
  get type() { return this._type; }
  get activeRegion() { return this._activeRegion; }
}

// 预定义布局类型
export const LAYOUT_TYPES = {
  SINGLE: 'single',
  GRID_1X2: 'grid-1x2',
  GRID_2X1: 'grid-2x1',
  GRID_2X2: 'grid-2x2',
  GRID_3X3: 'grid-3x3',
  PICTURE_IN_PICTURE: 'picture-in-picture'
};

// 创建预定义布局的工厂方法
export class LayoutFactory {
  static create(layoutType, options = {}) {
    const config = { ...options };

    switch (layoutType) {
      case LAYOUT_TYPES.SINGLE:
        return new RenderLayout({ ...config, type: 'single', rows: 1, cols: 1 });
      case LAYOUT_TYPES.GRID_1X2:
        return new RenderLayout({ ...config, type: 'grid', rows: 1, cols: 2 });
      case LAYOUT_TYPES.GRID_2X1:
        return new RenderLayout({ ...config, type: 'grid', rows: 2, cols: 1 });
      case LAYOUT_TYPES.GRID_2X2:
        return new RenderLayout({ ...config, type: 'grid', rows: 2, cols: 2 });
      case LAYOUT_TYPES.GRID_3X3:
        return new RenderLayout({ ...config, type: 'grid', rows: 3, cols: 3 });
      case LAYOUT_TYPES.PICTURE_IN_PICTURE:
        return new RenderLayout({ ...config, type: 'picture-in-picture' });
      default:
        return new RenderLayout({ ...config, type: 'single' });
    }
  }
}
