/**
 * RenderLayout - 布局管理类
 * 负责管理画布布局，支持多种布局模式
 */
export class RenderLayout {
  constructor(options = {}) {
    this._id = options.id || `layout-${Date.now()}`;
    this._name = options.name || 'Untitled Layout';
    this._type = options.type || 'grid'; // grid, single, custom
    this._rows = options.rows || 1;
    this._cols = options.cols || 1;
    this._specialType = options.specialType || null; // 新增：特殊布局类型
    this._regions = [];
    this._activeRegion = null;

    // 🎯 核心：独立的 elements 数组（vector<RenderElement>）
    this._elements = [];

    // 布局配置
    this._config = {
      gap: options.gap !== undefined ? options.gap : 0,  // 🎯 修复：gap设为0，完全铺满无间隙
      padding: options.padding || 0,  // 🎯 padding为0，完全铺满
      borderColor: options.borderColor || 'rgba(255, 255, 255, 0.18)',
      activeBorderColor: options.activeBorderColor || '#4CAF50'
    };

    console.log(`[RenderLayout] 创建布局: ${this._id}, 类型: ${this._type}`);
  }

  /**
   * 初始化布局区域
   */
  init(width, height) {
    this._regions = [];
    // 使用传入的尺寸作为可用空间（已在外部处理padding）
    const totalWidth = width;
    const totalHeight = height;

    const layoutType = this._type.startsWith('grid-') ? this._type : this._type;

    switch (layoutType) {
      case 'single':
        this._createSingleRegion(totalWidth, totalHeight);
        break;
      case 'grid':
      case 'grid-1x2':
      case 'grid-2x1':
      case 'grid-2x2':
      case 'grid-2x3':
      case 'grid-3x2':
      case 'grid-3x3':
      case 'grid-4x4':
      case 'grid-5x5':
      case 'grid-6x6':
      case 'grid-7x7':
        this._createGridRegions(totalWidth, totalHeight);
        break;
      case 'grid-3-special':
        this._createGrid3SpecialRegions(totalWidth, totalHeight);
        break;
      case 'special':
        this._createSpecialRegions(totalWidth, totalHeight);
        break;
      case 'free':
        this._createFreeLayoutRegions(totalWidth, totalHeight);
        break;
      default:
        this._createGridRegions(totalWidth, totalHeight);
    }

    console.log('[RenderLayout.init] 布局初始化完成, 区域数:', this._regions.length);
  }

  /**
   * 创建单区域布局
   */
  _createSingleRegion(width, height) {
    // 🎯 1分屏不需要padding，完全铺满整个区域
    this._regions.push({
      id: 'region-0',
      x: 0,
      y: 0,
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
    // 🎯 修复：当gap为0时，直接等分；当gap不为0时，考虑间隙
    const totalGapWidth = this._config.gap * (this._cols - 1);
    const totalGapHeight = this._config.gap * (this._rows - 1);
    
    const regionWidth = (width - totalGapWidth) / this._cols;
    const regionHeight = (height - totalGapHeight) / this._rows;

    let index = 0;
    for (let row = 0; row < this._rows; row++) {
      for (let col = 0; col < this._cols; col++) {
        this._regions.push({
          id: `region-${index}`,
          // 🎯 修复：位置计算考虑间隙，确保最后一个格子正好到达边界
          x: col * (regionWidth + this._config.gap),
          y: row * (regionHeight + this._config.gap),
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
   * 创建3分屏特殊布局（左二右一，左右平分）
   */
  _createGrid3SpecialRegions(width, height) {
    // 🎯 修复：左边两个小区域（上下排列），左右各占50%
    const halfWidth = width / 2;
    const leftRegionHeight = height / 2;

    // 左上区域
    this._regions.push({
      id: 'region-0',
      x: 0,
      y: 0,
      width: halfWidth,
      height: leftRegionHeight,
      sourceId: null,
      visible: true
    });

    // 左下区域 - 🎯 修复：直接占据下半部分，不需要gap
    this._regions.push({
      id: 'region-1',
      x: 0,
      y: leftRegionHeight,
      width: halfWidth,
      height: leftRegionHeight,
      sourceId: null,
      visible: true
    });

    // 右边一个大区域，占满整个高度
    this._regions.push({
      id: 'region-2',
      x: halfWidth,
      y: 0,
      width: halfWidth,
      height: height,
      sourceId: null,
      visible: true
    });
  }

  /**
   * 创建特殊布局（大画面全屏，小画面占4角）
   */
  _createSpecialRegions(width, height) {
    // 🎯 修复：使用相对尺寸而非固定尺寸，确保在不同分辨率下都能正常显示
    const subWidth = width * 0.25;   // 小窗口宽度为总宽度的25%
    const subHeight = height * 0.25; // 小窗口高度为总高度的25%

    // 大画面全屏
    this._regions.push({
      id: 'region-main',
      x: 0,
      y: 0,
      width: width,
      height: height,
      sourceId: null,
      visible: true
    });

    // 1大1小：小的左上角
    if (this._specialType === 'special-1') {
      this._regions.push({
        id: 'region-sub-1',
        x: 0,
        y: 0,
        width: subWidth,
        height: subHeight,
        sourceId: null,
        visible: true
      });
    }

    // 1大1小：小的左下角
    if (this._specialType === 'special-2') {
      this._regions.push({
        id: 'region-sub-2',
        x: 0,
        y: height - subHeight,
        width: subWidth,
        height: subHeight,
        sourceId: null,
        visible: true
      });
    }

    // 1大1小：小的右上角
    if (this._specialType === 'special-3') {
      this._regions.push({
        id: 'region-sub-3',
        x: width - subWidth,
        y: 0,
        width: subWidth,
        height: subHeight,
        sourceId: null,
        visible: true
      });
    }

    // 1大1小：小的右下角
    if (this._specialType === 'special-4') {
      this._regions.push({
        id: 'region-sub-4',
        x: width - subWidth,
        y: height - subHeight,
        width: subWidth,
        height: subHeight,
        sourceId: null,
        visible: true
      });
    }
  }

  /**
   * 创建自由布局
   * 自由布局是一个空白画布，用户可以自由拖入信号源
   * 信号源可以被拖动、放大、缩小，进行自由组合
   */
  _createFreeLayoutRegions(width, height) {
    // 自由布局不创建默认区域，保持完全空白
    // 用户可以自由拖入摄像头、本地视频、本地文档、远程桌面等信号源
    // 每个信号源可以独立拖动和调整大小
    this._regions = [];
  }

  /**
   * 绘制布局
   */
  draw(context) {
    // 自由布局不绘制任何背景，保持完全空白
    if (this._type === 'free') return;

    this._regions.forEach(region => {
      if (!region.visible) return;

      // 如果没有源，显示占位符
      if (!region.sourceId) {
        context.fillStyle = 'rgba(255, 255, 255, 0.05)';
        context.fillRect(region.x, region.y, region.width, region.height);

        context.fillStyle = 'rgba(255, 255, 255, 0.3)';
        context.font = '14px sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('无信号源', region.x + region.width / 2, region.y + region.height / 2);
      }
    });
  }

  /**
   * 在元素之上绘制布局边框
   */
  drawOverlay(context) {
    const isStandardGrid = this._type === 'grid' || /^grid-\d+x\d+$/.test(this._type);

    if (isStandardGrid) {
      this._drawGridLayoutOverlay(context);
    }

    // 自由布局不绘制网格线，保持干净的画布
    // if (this._type === 'free') {
    //   this._drawFreeLayoutGrid(context);
    // }

    this._regions.forEach(region => {
      if (!region.visible) return;

      // 自由布局不显示区域边框
      if (this._type === 'free') return;

      // 只有没有信号源时才显示边界条，添加信号源后边界条消失
      if (!region.sourceId) {
        context.save();
        context.strokeStyle = region.id === this._activeRegion ?
          this._config.activeBorderColor : this._config.borderColor;
        context.lineWidth = region.id === this._activeRegion ? 2 : 1;
        context.strokeRect(region.x, region.y, region.width, region.height);
        context.restore();
      }
    });
  }

  _drawGridLayoutOverlay(context) {
    if (this._regions.length === 0) return;

    const visibleRegions = this._regions.filter(r => r.visible);
    if (visibleRegions.length === 0) return;

    // 获取第一个可见区域作为参考
    const firstRegion = visibleRegions[0];
    const startX = firstRegion.x;
    const startY = firstRegion.y;
    const regionWidth = firstRegion.width;
    const regionHeight = firstRegion.height;

    // 计算网格区域的总宽度和总高度（包含间隙）
    const gridTotalWidth = this._cols * regionWidth + (this._cols - 1) * this._config.gap;
    const gridTotalHeight = this._rows * regionHeight + (this._rows - 1) * this._config.gap;

    const endX = startX + gridTotalWidth;
    const endY = startY + gridTotalHeight;

    context.save();
    // 使用实线和更高的透明度，使网格线更清晰可见
    context.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    context.lineWidth = 2;
    // 移除虚线设置，使用实线
    context.setLineDash([]);

    // 绘制列分隔线（垂直方向）
    if (this._cols > 1) {
      for (let col = 1; col < this._cols; col++) {
        // 分隔线位置 = 起始X + 当前列索引 * (区域宽度 + 间隙)
        const x = startX + col * (regionWidth + this._config.gap);
        context.beginPath();
        context.moveTo(x, startY);
        context.lineTo(x, endY);
        context.stroke();
      }
    }

    // 绘制行分隔线（水平方向）
    if (this._rows > 1) {
      for (let row = 1; row < this._rows; row++) {
        // 分隔线位置 = 起始Y + 当前行索引 * (区域高度 + 间隙)
        const y = startY + row * (regionHeight + this._config.gap);
        context.beginPath();
        context.moveTo(startX, y);
        context.lineTo(endX, y);
        context.stroke();
      }
    }

    context.restore();
  }

  _drawFreeLayoutGrid(context) {
    const region = this._regions[0];
    if (!region || !region.visible) return;

    const gridCount = 20;
    const stepX = region.width / gridCount;
    const stepY = region.height / gridCount;

    context.save();
    context.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    context.lineWidth = 1;

    for (let i = 1; i < gridCount; i++) {
      const x = region.x + stepX * i;
      context.beginPath();
      context.moveTo(x, region.y);
      context.lineTo(x, region.y + region.height);
      context.stroke();
    }

    for (let i = 1; i < gridCount; i++) {
      const y = region.y + stepY * i;
      context.beginPath();
      context.moveTo(region.x, y);
      context.lineTo(region.x + region.width, y);
      context.stroke();
    }

    context.restore();
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
   * 添加自由布局区域
   */
  addFreeRegion(x, y, width, height) {
    const regionId = `region-free-${this._regions.length}`;
    this._regions.push({
      id: regionId,
      x: x,
      y: y,
      width: width,
      height: height,
      sourceId: null,
      visible: true
    });
    return regionId;
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
  // 新增：更多网格布局
  GRID_2X3: 'grid-2x3',    // 6分屏
  GRID_3X2: 'grid-3x2',    // 6分屏
  GRID_4X4: 'grid-4x4',    // 16分屏
  GRID_5X5: 'grid-5x5',    // 25分屏
  GRID_6X6: 'grid-6x6',    // 36分屏
  GRID_7X7: 'grid-7x7',    // 49分屏
  // 特殊布局
  SPECIAL_1: 'special-1',  // 1大1小：小的左上角
  SPECIAL_2: 'special-2',  // 1大1小：小的左下角
  SPECIAL_3: 'special-3',  // 1大1小：小的右上角
  SPECIAL_4: 'special-4',  // 1大1小：小的右下角
  // 特殊网格布局
  GRID_3_SPECIAL: 'grid-3-special',  // 3分屏特殊布局（左二右一）
  FREE: 'free'             // 自由布局
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
      case LAYOUT_TYPES.GRID_2X3:
        return new RenderLayout({ ...config, type: 'grid', rows: 2, cols: 3 });
      case LAYOUT_TYPES.GRID_3X2:
        return new RenderLayout({ ...config, type: 'grid', rows: 3, cols: 2 });
      case LAYOUT_TYPES.GRID_3X3:
        return new RenderLayout({ ...config, type: 'grid', rows: 3, cols: 3 });
      case LAYOUT_TYPES.GRID_4X4:
        return new RenderLayout({ ...config, type: 'grid', rows: 4, cols: 4 });
      case LAYOUT_TYPES.GRID_5X5:
        return new RenderLayout({ ...config, type: 'grid', rows: 5, cols: 5 });
      case LAYOUT_TYPES.GRID_6X6:
        return new RenderLayout({ ...config, type: 'grid', rows: 6, cols: 6 });
      case LAYOUT_TYPES.GRID_7X7:
        return new RenderLayout({ ...config, type: 'grid', rows: 7, cols: 7 });
      case LAYOUT_TYPES.GRID_3_SPECIAL:
        return new RenderLayout({ ...config, type: 'grid-3-special', rows: 2, cols: 2 }); // 使用2x2但特殊处理
      case LAYOUT_TYPES.SPECIAL_1:
      case LAYOUT_TYPES.SPECIAL_2:
      case LAYOUT_TYPES.SPECIAL_3:
      case LAYOUT_TYPES.SPECIAL_4:
        return new RenderLayout({ ...config, type: 'special', specialType: layoutType });
      case LAYOUT_TYPES.FREE:
        return new RenderLayout({ ...config, type: 'free' });
      default:
        // 尝试解析自定义网格布局（格式：grid-NxM）
        if (typeof layoutType === 'string' && layoutType.startsWith('grid-')) {
          const match = layoutType.match(/grid-(\d+)x(\d+)/);
          if (match) {
            const [, rows, cols] = match;
            return new RenderLayout({ ...config, type: 'grid', rows: parseInt(rows), cols: parseInt(cols) });
          }
        }
        return new RenderLayout({ ...config, type: 'single' });
    }
  }
}
