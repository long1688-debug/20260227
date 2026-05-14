// 视频布局引擎 - 负责布局注册与计算
// 支持多布局独立状态，切换布局时保留每个布局的信号源

import { LayoutDefinition, CellConfig, LAYOUT_INDICES } from '../types/layout';

/**
 * 生成网格布局（通用）
 * @param rows 行数
 * @param cols 列数
 * @param prefix 单元格ID前缀
 * @returns 单元格配置数组
 */
export function generateGrid(rows: number, cols: number, prefix: string = 'c'): CellConfig[] {
  const cells: CellConfig[] = [];
  const w = 100 / cols;
  const h = 100 / rows;

  for (let i = 0; i < rows * cols; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    cells.push({
      id: `${prefix}-${r}-${c}`,
      x: c * w,
      y: r * h,
      width: w,
      height: h
    });
  }

  return cells;
}

/**
 * 布局注册表 - 定义所有可用布局
 * 索引对应：
 * 1-1分屏、2-2分屏、3-3分屏、4-4分屏、5-6分屏、7-9分屏、10-16分屏、
 * 11-25分屏、12-36分屏、13-49分屏、14-特殊布局1、15-特殊布局2、
 * 16-特殊布局3、17-特殊布局4、18-自由布局
 */
export const LAYOUT_REGISTRY: Record<number, LayoutDefinition> = {
  // 1分屏
  [LAYOUT_INDICES.LAYOUT_1]: {
    index: LAYOUT_INDICES.LAYOUT_1,
    name: '1分屏',
    type: 'grid',
    cells: [
      { id: 'c0', x: 0, y: 0, width: 100, height: 100 }
    ]
  },

  // 2分屏（左右）
  [LAYOUT_INDICES.LAYOUT_2]: {
    index: LAYOUT_INDICES.LAYOUT_2,
    name: '2分屏',
    type: 'grid',
    cells: [
      { id: 'c0', x: 0, y: 0, width: 50, height: 100 },
      { id: 'c1', x: 50, y: 0, width: 50, height: 100 }
    ]
  },

  // 3分屏（左二右一）
  [LAYOUT_INDICES.LAYOUT_3]: {
    index: LAYOUT_INDICES.LAYOUT_3,
    name: '3分屏',
    type: 'grid',
    cells: [
      { id: 'c0', x: 0, y: 0, width: 66.666, height: 50 },
      { id: 'c1', x: 0, y: 50, width: 66.666, height: 50 },
      { id: 'c2', x: 66.666, y: 0, width: 33.334, height: 100 }
    ]
  },

  // 4分屏（2x2）
  [LAYOUT_INDICES.LAYOUT_4]: {
    index: LAYOUT_INDICES.LAYOUT_4,
    name: '4分屏',
    type: 'grid',
    cells: generateGrid(2, 2)
  },

  // 6分屏（2x3）
  [LAYOUT_INDICES.LAYOUT_6]: {
    index: LAYOUT_INDICES.LAYOUT_6,
    name: '6分屏',
    type: 'grid',
    cells: generateGrid(2, 3)
  },

  // 9分屏（3x3）
  [LAYOUT_INDICES.LAYOUT_9]: {
    index: LAYOUT_INDICES.LAYOUT_9,
    name: '9分屏',
    type: 'grid',
    cells: generateGrid(3, 3)
  },

  // 16分屏（4x4）
  [LAYOUT_INDICES.LAYOUT_16]: {
    index: LAYOUT_INDICES.LAYOUT_16,
    name: '16分屏',
    type: 'grid',
    cells: generateGrid(4, 4)
  },

  // 25分屏（5x5）
  [LAYOUT_INDICES.LAYOUT_25]: {
    index: LAYOUT_INDICES.LAYOUT_25,
    name: '25分屏',
    type: 'grid',
    cells: generateGrid(5, 5)
  },

  // 36分屏（6x6）
  [LAYOUT_INDICES.LAYOUT_36]: {
    index: LAYOUT_INDICES.LAYOUT_36,
    name: '36分屏',
    type: 'grid',
    cells: generateGrid(6, 6)
  },

  // 49分屏（7x7）
  [LAYOUT_INDICES.LAYOUT_49]: {
    index: LAYOUT_INDICES.LAYOUT_49,
    name: '49分屏',
    type: 'grid',
    cells: generateGrid(7, 7)
  },

  // 特殊布局1（1大1小：小的左上角）
  [LAYOUT_INDICES.LAYOUT_SPECIAL_1]: {
    index: LAYOUT_INDICES.LAYOUT_SPECIAL_1,
    name: '特殊布局1',
    type: 'special',
    cells: [
      { id: 'main', x: 25, y: 0, width: 75, height: 100 },
      { id: 'sub', x: 0, y: 0, width: 25, height: 25 }
    ]
  },

  // 特殊布局2（1大1小：小的左下角）
  [LAYOUT_INDICES.LAYOUT_SPECIAL_2]: {
    index: LAYOUT_INDICES.LAYOUT_SPECIAL_2,
    name: '特殊布局2',
    type: 'special',
    cells: [
      { id: 'main', x: 25, y: 0, width: 75, height: 100 },
      { id: 'sub', x: 0, y: 75, width: 25, height: 25 }
    ]
  },

  // 特殊布局3（1大1小：小的右上角）
  [LAYOUT_INDICES.LAYOUT_SPECIAL_3]: {
    index: LAYOUT_INDICES.LAYOUT_SPECIAL_3,
    name: '特殊布局3',
    type: 'special',
    cells: [
      { id: 'main', x: 0, y: 0, width: 75, height: 100 },
      { id: 'sub', x: 75, y: 0, width: 25, height: 25 }
    ]
  },

  // 特殊布局4（1大1小：小的右下角）
  [LAYOUT_INDICES.LAYOUT_SPECIAL_4]: {
    index: LAYOUT_INDICES.LAYOUT_SPECIAL_4,
    name: '特殊布局4',
    type: 'special',
    cells: [
      { id: 'main', x: 0, y: 0, width: 75, height: 100 },
      { id: 'sub', x: 75, y: 75, width: 25, height: 25 }
    ]
  },

  // 自由布局
  [LAYOUT_INDICES.LAYOUT_FREE]: {
    index: LAYOUT_INDICES.LAYOUT_FREE,
    name: '自由布局',
    type: 'free',
    cells: []
  }
};

/**
 * 获取所有布局索引列表（按显示顺序）
 */
export function getLayoutIndexList(): number[] {
  return [
    LAYOUT_INDICES.LAYOUT_1,
    LAYOUT_INDICES.LAYOUT_2,
    LAYOUT_INDICES.LAYOUT_3,
    LAYOUT_INDICES.LAYOUT_4,
    LAYOUT_INDICES.LAYOUT_6,
    LAYOUT_INDICES.LAYOUT_9,
    LAYOUT_INDICES.LAYOUT_16,
    LAYOUT_INDICES.LAYOUT_25,
    LAYOUT_INDICES.LAYOUT_36,
    LAYOUT_INDICES.LAYOUT_49,
    LAYOUT_INDICES.LAYOUT_SPECIAL_1,
    LAYOUT_INDICES.LAYOUT_SPECIAL_2,
    LAYOUT_INDICES.LAYOUT_SPECIAL_3,
    LAYOUT_INDICES.LAYOUT_SPECIAL_4,
    LAYOUT_INDICES.LAYOUT_FREE
  ];
}

/**
 * 初始化布局
 * @param index 布局索引
 * @returns 单元格配置数组（深拷贝）
 */
export function initLayout(index: number): CellConfig[] {
  const def = LAYOUT_REGISTRY[index];
  if (!def) {
    throw new Error(`布局索引 ${index} 未定义`);
  }
  return JSON.parse(JSON.stringify(def.cells));
}

/**
 * 创建自由布局单元格
 * @param index 单元格索引
 * @returns 单元格配置
 */
export function createFreeCell(index: number): CellConfig {
  return {
    id: `free-${Date.now()}-${index}`,
    x: 15 + (index % 4) * 20,
    y: 15 + Math.floor(index / 4) * 20,
    width: 25,
    height: 25
  };
}

/**
 * 获取布局信息
 * @param index 布局索引
 * @returns 布局定义
 */
export function getLayoutDefinition(index: number): LayoutDefinition | undefined {
  return LAYOUT_REGISTRY[index];
}

/**
 * 吸附到网格（用于自由布局）
 * @param value 原始值
 * @param gridSize 网格大小（默认5%）
 * @returns 吸附后的值
 */
export function snapToGrid(value: number, gridSize: number = 5): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * 获取布局的单元格数量
 * @param index 布局索引
 * @returns 单元格数量
 */
export function getLayoutCellCount(index: number): number {
  const def = LAYOUT_REGISTRY[index];
  return def ? def.cells.length : 0;
}

/**
 * 判断是否为网格布局
 * @param index 布局索引
 * @returns 是否为网格布局
 */
export function isGridLayout(index: number): boolean {
  const def = LAYOUT_REGISTRY[index];
  return def ? def.type === 'grid' : false;
}

/**
 * 判断是否为特殊布局
 * @param index 布局索引
 * @returns 是否为特殊布局
 */
export function isSpecialLayout(index: number): boolean {
  const def = LAYOUT_REGISTRY[index];
  return def ? def.type === 'special' : false;
}

/**
 * 判断是否为自由布局
 * @param index 布局索引
 * @returns 是否为自由布局
 */
export function isFreeLayout(index: number): boolean {
  return index === LAYOUT_INDICES.LAYOUT_FREE;
}
