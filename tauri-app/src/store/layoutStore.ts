// 视频布局状态管理 - 使用 Zustand
// 支持多布局独立状态保存，切换布局时保留每个布局的信号源

import { create } from 'zustand';
import { CellConfig, LAYOUT_INDICES, LayoutIndex } from '../types/layout';
import { initLayout, createFreeCell, snapToGrid } from '../utils/layoutEngine';

// 每个布局的独立状态
interface LayoutStateSnapshot {
  cells: CellConfig[];
  timestamp: number;
}

interface LayoutState {
  // 当前布局索引
  currentIndex: number;
  // 当前单元格配置
  cells: CellConfig[];
  // 是否为自由布局模式
  isFreeMode: boolean;
  // 拖拽吸附网格大小
  snapGridSize: number;
  // 各布局的独立状态快照（用于切换布局时保留状态）
  layoutSnapshots: Record<number, LayoutStateSnapshot>;

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
  // 保存当前布局状态快照
  saveSnapshot: () => void;
  // 随机填充预览信号源到当前布局
  fillRandomSources: (sources: Array<{ id: string; name: string; streamUrl?: string; type: string }>) => void;
}

const STORAGE_KEY = 'video-layout-config';
const SNAPSHOT_STORAGE_KEY = 'video-layout-snapshots';

// 获取所有布局索引
const getAllLayoutIndices = (): LayoutIndex[] => {
  return Object.values(LAYOUT_INDICES) as LayoutIndex[];
};

// 初始化空快照
const initEmptySnapshots = (): Record<number, LayoutStateSnapshot> => {
  const snapshots: Record<number, LayoutStateSnapshot> = {};
  getAllLayoutIndices().forEach(index => {
    snapshots[index] = {
      cells: initLayout(index),
      timestamp: Date.now()
    };
  });
  return snapshots;
};

export const useLayoutStore = create<LayoutState>((set, get) => ({
  currentIndex: LAYOUT_INDICES.LAYOUT_1,
  cells: initLayout(LAYOUT_INDICES.LAYOUT_1),
  isFreeMode: false,
  snapGridSize: 5,
  layoutSnapshots: initEmptySnapshots(),

  setLayout: (index) => {
    const state = get();
    const isFree = index === LAYOUT_INDICES.LAYOUT_FREE;

    // 先保存当前布局的状态快照
    get().saveSnapshot();

    // 从快照中获取目标布局的状态，如果不存在则初始化
    let targetCells = state.layoutSnapshots[index]?.cells;
    if (!targetCells || targetCells.length === 0) {
      targetCells = initLayout(index);
    }

    set({
      currentIndex: index,
      cells: JSON.parse(JSON.stringify(targetCells)),
      isFreeMode: isFree
    });
  },

  // 保存当前布局状态快照
  saveSnapshot: () => {
    const state = get();
    const snapshot: LayoutStateSnapshot = {
      cells: JSON.parse(JSON.stringify(state.cells)),
      timestamp: Date.now()
    };
    set(prev => ({
      layoutSnapshots: {
        ...prev.layoutSnapshots,
        [prev.currentIndex]: snapshot
      }
    }));
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

  // 随机填充预览信号源到当前布局
  fillRandomSources: (sources) => {
    const state = get();
    const cells = [...state.cells];

    // 打乱单元格顺序
    const shuffledCells = cells.sort(() => Math.random() - 0.5);

    // 打乱信号源顺序
    const shuffledSources = [...sources].sort(() => Math.random() - 0.5);

    // 将信号源分配到单元格
    shuffledCells.forEach((cell, index) => {
      if (index < shuffledSources.length) {
        const source = shuffledSources[index];
        cell.sourceId = source.id;
        cell.streamUrl = source.streamUrl;
        cell.name = source.name;
      }
    });

    set({
      cells: shuffledCells
    });
  },

  saveLayout: async () => {
    const state = get();
    const config = {
      currentIndex: state.currentIndex,
      cells: state.cells,
      layoutSnapshots: state.layoutSnapshots,
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
            stream_url: c.streamUrl,
            source_id: c.sourceId,
            name: c.name
          }))
        }
      });

      // 同时保存到 localStorage 作为备份
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      // 单独保存快照
      localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(state.layoutSnapshots));
      console.log('[LayoutStore] 布局已保存:', config.currentIndex);
    } catch (error) {
      console.error('[LayoutStore] 保存布局失败:', error);
      // 降级到 localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(state.layoutSnapshots));
    }
  },

  loadLayout: async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const data = await invoke('load_layout', { index: get().currentIndex });

      if (data && data.cells && Array.isArray(data.cells)) {
        set({
          cells: data.cells.map((c: any) => ({
            id: c.id,
            x: c.x,
            y: c.y,
            width: c.width,
            height: c.height,
            streamUrl: c.stream_url,
            sourceId: c.source_id,
            name: c.name
          }))
        });
      }
    } catch (error) {
      console.warn('[LayoutStore] 从Tauri加载布局失败，尝试从localStorage加载:', error);

      // 从 localStorage 加载
      const saved = localStorage.getItem(STORAGE_KEY);
      const savedSnapshots = localStorage.getItem(SNAPSHOT_STORAGE_KEY);

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

      if (savedSnapshots) {
        try {
          const snapshots = JSON.parse(savedSnapshots);
          set({
            layoutSnapshots: snapshots
          });
        } catch (e) {
          console.error('[LayoutStore] 解析保存的快照失败:', e);
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

// 选择器：获取所有布局快照
export const useLayoutSnapshots = () => {
  return useLayoutStore(state => state.layoutSnapshots);
};

// 选择器：获取单元格数量
export const useCellCount = () => {
  return useLayoutStore(state => state.cells.length);
};

// 选择器：检查是否为自由布局
export const useIsFreeMode = () => {
  return useLayoutStore(state => state.isFreeMode);
};
