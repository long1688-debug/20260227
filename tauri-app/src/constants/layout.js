/**
 * 布局配置常量
 * 定义视频网格的18种分屏布局模式
 * 
 * 更新时间: 2026-04-20 - 统一使用新布局索引方案
 */

/**
 * 布局索引常量 - 与 useLayoutConfig.ts 保持一致
 * 
 * 布局索引对应关系:
 * 1-1分屏、2-2分屏、3-3分屏、4-4分屏、5-6分屏、7-9分屏、10-16分屏、
 * 11-25分屏、12-36分屏、13-49分屏、14-特殊布局1、15-特殊布局2、
 * 16-特殊布局3、17-特殊布局4、18-自由布局
 */
export const LAYOUT_INDICES = {
  LAYOUT_1: 1,      // 1分屏
  LAYOUT_2: 2,      // 2分屏
  LAYOUT_3: 3,      // 3分屏
  LAYOUT_4: 4,      // 4分屏
  LAYOUT_6: 5,      // 6分屏
  LAYOUT_9: 7,      // 9分屏
  LAYOUT_16: 10,    // 16分屏
  LAYOUT_25: 11,    // 25分屏
  LAYOUT_36: 12,    // 36分屏
  LAYOUT_49: 13,    // 49分屏
  LAYOUT_SPECIAL_1: 14,  // 特殊布局1（1大1小：小的左上角）
  LAYOUT_SPECIAL_2: 15,  // 特殊布局2（1大1小：小的左下角）
  LAYOUT_SPECIAL_3: 16,  // 特殊布局3（1大1小：小的右上角）
  LAYOUT_SPECIAL_4: 17,  // 特殊布局4（1大1小：小的右下角）
  LAYOUT_FREE: 18,       // 自由布局
}

/**
 * 默认布局
 */
export const DEFAULT_LAYOUT = LAYOUT_INDICES.LAYOUT_1;

/**
 * 最大支持的画面数量
 */
export const MAX_GRID_SIZE = 49;

/**
 * 根据布局索引获取 CSS Grid 样式
 * @param {number} layoutIndex - 布局索引（1-18）
 * @param {boolean} isMaximized - 是否最大化模式
 * @returns {object} CSS Grid 配置
 */
export function getGridStyle(layoutIndex, isMaximized = false) {
  // 放大模式下只显示一个视频
  if (isMaximized) {
    return {
      gridTemplateColumns: '1fr',
      gridTemplateRows: '1fr'
    };
  }

  // 布局索引到格子数量的映射
  const layoutCellMap = {
    [LAYOUT_INDICES.LAYOUT_1]: { cols: 1, rows: 1 },
    [LAYOUT_INDICES.LAYOUT_2]: { cols: 2, rows: 1 },
    [LAYOUT_INDICES.LAYOUT_3]: { cols: 2, rows: 2, custom: true }, // 左二右一
    [LAYOUT_INDICES.LAYOUT_4]: { cols: 2, rows: 2 },
    [LAYOUT_INDICES.LAYOUT_6]: { cols: 3, rows: 2 },
    [LAYOUT_INDICES.LAYOUT_9]: { cols: 3, rows: 3 },
    [LAYOUT_INDICES.LAYOUT_16]: { cols: 4, rows: 4 },
    [LAYOUT_INDICES.LAYOUT_25]: { cols: 5, rows: 5 },
    [LAYOUT_INDICES.LAYOUT_36]: { cols: 6, rows: 6 },
    [LAYOUT_INDICES.LAYOUT_49]: { cols: 7, rows: 7 },
  };

  // 特殊布局：返回固定样式
  if (layoutIndex >= LAYOUT_INDICES.LAYOUT_SPECIAL_1 && layoutIndex <= LAYOUT_INDICES.LAYOUT_SPECIAL_4) {
    return {
      gridTemplateColumns: 'repeat(4, 1fr)',
      gridTemplateRows: 'repeat(4, 1fr)'
    };
  }

  // 自由布局：动态计算行列
  if (layoutIndex === LAYOUT_INDICES.LAYOUT_FREE) {
    return {
      display: 'block',
      position: 'relative'
    };
  }

  const config = layoutCellMap[layoutIndex];
  if (config) {
    if (config.custom) {
      // 3分屏特殊处理
      return {
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr'
      };
    }
    return {
      gridTemplateColumns: `repeat(${config.cols}, 1fr)`,
      gridTemplateRows: `repeat(${config.rows}, 1fr)`
    };
  }

  // 默认返回1分屏
  return {
    gridTemplateColumns: '1fr',
    gridTemplateRows: '1fr'
  };
}
