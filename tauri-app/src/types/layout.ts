// 视频布局类型定义

export interface CellConfig {
  id: string;
  x: number;      // 0~100 百分比
  y: number;
  width: number;
  height: number;
  streamUrl?: string;
  sourceId?: string;
  name?: string;
}

export interface LayoutDefinition {
  index: number;
  name: string;
  type: 'grid' | 'special' | 'free';
  cells: CellConfig[];
}

export interface LayoutPayload {
  index: number;
  name: string;
  cells: CellDto[];
}

export interface CellDto {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  stream_url?: string;
}

// 布局索引常量
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
} as const;

export type LayoutIndex = typeof LAYOUT_INDICES[keyof typeof LAYOUT_INDICES];
