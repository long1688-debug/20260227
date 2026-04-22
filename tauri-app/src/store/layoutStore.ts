// 视频布局状态管理 - 使用 Zustand

import { create } from 'zustand';
import { CellConfig, LAYOUT_INDICES } from '../types/layout';
import { initLayout, createFreeCell, snapToGrid } from '../utils/layoutEngine';

interface LayoutState {
  // 当前布局索引
  currentIndex: number;
  // 当前单元格配置
  cells: CellConfig[];
  // 是否为自由布局模式
  isFreeMode: boolean;
  // 拖拽吸附网格大小
  snapGridSize: number;

  // 设置布局
  setLayout: (index: number) => void;
  // 更新单元格
  updateCell: (id: string, updates: Partial<CellConfig>) => void;
  // 添加自由布局单元格
  addFreeCell: () => void;
  // 移除单元格
  removeCell: (id: string) => void;
  // 清空所有单元格
  clearCells: () => void;
  // 绑定视频源到单元格
  bindSource: (cellId: string, sourceId: string, streamUrl?: string) => void;
  // 解绑单元格视频源
  unbindSource: (cellId: string) => void;
  // 吸附并更新位置（用于自由布局拖拽）
  updateCellPosition: (id: string, x: number, y: number, containerWidth: number, containerHeight: number) => void;
  // 设置吸附网格大小
  setSnapGridSize: (size: number) => void;
  // 保存布局到本地存储
  saveLayout: () => Promise<void>;
  // 从本地存储加载布局
  loadLayout: () => Promise<void>;
}

const STORAGE_KEY = 'video-layout-config';

export const useLayoutStore = create<LayoutState>((set, get) => ({
  currentIndex: LAYOUT_INDICES.LAYOUT_1,
  cells: initLayout(LAYOUT_INDICES.LAYOUT_1),
  isFreeMode: false,
  snapGridSize: 5,

  setLayout: (index) => {
    const isFree = index === LAYOUT_INDICES.LAYOUT_FREE;
    const cells = initLayout(index);
    set({
      currentIndex: index,
      cells,
      isFreeMode: isFree
    });
  },

  updateCell: (id, updates) => {
    set((state) => ({
      cells: state.cells.map(c => c.id === id ? { ...c, ...updates } : c)
    }));
  },

  addFreeCell: () => {
    const state = get();
    if (state.cells.length >= 49) {
      console.warn('自由布局最多支持49个单元格');
      return;
    }
    const newCell = createFreeCell(state.cells.length);
    set({
      cells: [...state.cells, newCell],
      isFreeMode: true
    });
  },

  removeCell: (id) => {
    set((state) => ({
      cells: state.cells.filter(c => c.id !== id)
    }));
  },

  clearCells: () => {
    set({ cells: [] });
  },

  bindSource: (cellId, sourceId, streamUrl) => {
    set((state) => ({
      cells: state.cells.map(c =>
        c.id === cellId
          ? { ...c, sourceId, streamUrl: streamUrl || c.streamUrl }
          : c
      )
    }));
  },

  unbindSource: (cellId) => {
    set((state) => ({
      cells: state.cells.map(c =>
        c.id === cellId
          ? { ...c, sourceId: undefined, streamUrl: undefined }
          : c
      )
    }));
  },

  updateCellPosition: (id, x, y, containerWidth, containerHeight) => {
    const state = get();
    const cell = state.cells.find(c => c.id === id);
    if (!cell) return;

    // 计算百分比
    let newX = (x / containerWidth) * 100;
    let newY = (y / containerHeight) * 100;

    // 吸附到网格
    newX = snapToGrid(Math.max(0, Math.min(95, newX)), state.snapGridSize);
    newY = snapToGrid(Math.max(0, Math.min(95, newY)), state.snapGridSize);

    set((state) => ({
      cells: state.cells.map(c =>
        c.id === id ? { ...c, x: newX, y: newY } : c
      )
    }));
  },

  setSnapGridSize: (size) => {
    set({ snapGridSize: size });
  },

  saveLayout: async () => {
    const state = get();
    const config = {
      currentIndex: state.currentIndex,
      cells: state.cells,
      timestamp: Date.now()
    };

    try {
      // 使用 Tauri fs 插件保存
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('save_layout', {
        payload: {
          index: config.currentIndex,
          name: `布局_${config.currentIndex}`,
          cells: config.cells.map(c => ({
            id: c.id,
            x: c.x,
            y: c.y,
            width: c.width,
            height: c.height,
            stream_url: c.streamUrl
          }))
        }
      });

      // 同时保存到 localStorage 作为备份
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      console.log('[LayoutStore] 布局已保存:', config.currentIndex);
    } catch (error) {
      console.error('[LayoutStore] 保存布局失败:', error);
      // 降级到 localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }
  },

  loadLayout: async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const cells = await invoke('load_layout', { index: get().currentIndex });

      if (cells && Array.isArray(cells)) {
        set({
          cells: cells.map((c: any) => ({
            id: c.id,
            x: c.x,
            y: c.y,
            width: c.width,
            height: c.height,
            streamUrl: c.stream_url
          }))
        });
      }
    } catch (error) {
      console.warn('[LayoutStore] 从Tauri加载布局失败，尝试从localStorage加载:', error);

      // 从 localStorage 加载
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const config = JSON.parse(saved);
          set({
            currentIndex: config.currentIndex,
            cells: config.cells
          });
        } catch (e) {
          console.error('[LayoutStore] 解析保存的布局失败:', e);
        }
      }
    }
  }
}));

// 选择器：获取当前布局定义
export const useCurrentLayout = () => {
  const currentIndex = useLayoutStore(state => state.currentIndex);
  const { LAYOUT_REGISTRY } = require('../utils/layoutEngine');
  return LAYOUT_REGISTRY[currentIndex];
};

// 选择器：获取单元格数量
export const useCellCount = () => {
  return useLayoutStore(state => state.cells.length);
};

// 选择器：检查是否为自由布局
export const useIsFreeMode = () => {
  return useLayoutStore(state => state.isFreeMode);
};
