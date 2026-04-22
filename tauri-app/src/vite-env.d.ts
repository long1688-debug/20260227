/// <reference types="vite/client" />

// CSS 模块声明
declare module '*.css' {
  const content: string;
  export default content;
}

// 视频布局组件类型声明
declare module '@/components/VideoCell' {
  export const VideoCell: React.FC<VideoCellProps>;
}

declare module '@/components/VideoGrid' {
  export const VideoGrid: React.FC;
}

declare module '@/components/LayoutSelector' {
  export const LayoutSelector: React.FC;
}

declare module '@/store/layoutStore' {
  export const useLayoutStore: any;
  export const useCurrentLayout: any;
  export const useCellCount: any;
  export const useIsFreeMode: any;
}

declare module '@/utils/layoutEngine' {
  export const LAYOUT_REGISTRY: any;
  export const getLayoutIndexList: any;
  export const initLayout: any;
  export const createFreeCell: any;
  export const getLayoutDefinition: any;
  export const snapToGrid: any;
}

declare module '@/types/layout' {
  export interface CellConfig {
    id: string;
    x: number;
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

  export const LAYOUT_INDICES: {
    LAYOUT_1: 1;
    LAYOUT_2: 2;
    LAYOUT_3: 3;
    LAYOUT_4: 4;
    LAYOUT_6: 5;
    LAYOUT_9: 7;
    LAYOUT_16: 10;
    LAYOUT_25: 11;
    LAYOUT_36: 12;
    LAYOUT_49: 13;
    LAYOUT_SPECIAL_1: 14;
    LAYOUT_SPECIAL_2: 15;
    LAYOUT_SPECIAL_3: 16;
    LAYOUT_SPECIAL_4: 17;
    LAYOUT_FREE: 18;
  };
}
