// 视频网格容器组件 - 使用 DnD Kit 管理拖拽
// 支持从预览区域拖拽信号源到网格、双击全屏、布局切换状态保留

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragCancelEvent
} from '@dnd-kit/core';
import { VideoCell } from './VideoCell';
import { useLayoutStore } from '../store/layoutStore';
import { CellConfig } from '../types/layout';
import { clsx } from 'clsx';

// 测试视频流 URL
const TEST_STREAM_URL = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

interface GridContainerProps {
  cells: CellConfig[];
  onCellDoubleClick?: (cell: CellConfig) => void;
  onDrop?: (event: DragOverEvent, cellId: string) => void;
}

const GridContainer: React.FC<GridContainerProps> = ({
  cells,
  onCellDoubleClick,
  onDrop
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: 'grid-container'
  });

  // 处理拖放到网格空白区域
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    // 如果有数据传递，允许放置
    if (event.dataTransfer?.types.includes('application/json')) {
      event.dataTransfer.dropEffect = 'copy';
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'relative w-full h-full bg-gray-950 overflow-hidden rounded-lg shadow-inner',
        isOver && 'ring-2 ring-blue-500 ring-inset'
      )}
      onDragOver={handleDragOver}
      onDrop={(e) => {
        e.preventDefault();
        if (onDrop && cells.length > 0) {
          // 拖放到空白区域时，选择第一个空单元格
          const emptyCell = cells.find(c => !c.sourceId);
          if (emptyCell) {
            onDrop({} as DragOverEvent, emptyCell.id);
          }
        }
      }}
    >
      {cells.map(cell => (
        <VideoCell
          key={cell.id}
          cell={cell}
          onDoubleClick={onCellDoubleClick}
          onDrop={onDrop}
        />
      ))}

      {/* 空状态 */}
      {cells.length === 0 && (
        <EmptyState />
      )}

      {/* 网格背景（仅在自由布局显示） */}
      <GridBackground />

      {/* 拖放提示 */}
      {isOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
          <div className="px-6 py-3 bg-blue-600 rounded-lg text-white text-lg font-medium">
            释放以放置信号源
          </div>
        </div>
      )}
    </div>
  );
};

const GridBackground: React.FC = () => {
  const isFreeMode = useLayoutStore(state => state.isFreeMode);

  if (!isFreeMode) return null;

  return (
    <div className="absolute inset-0 pointer-events-none opacity-10">
      <svg width="100%" height="100%">
        {/* 水平线 */}
        {[...Array(20)].map((_, i) => (
          <line
            key={`h-${i}`}
            x1="0"
            y1={`${i * 5}%`}
            x2="100%"
            y2={`${i * 5}%`}
            stroke="#666"
            strokeWidth="0.5"
          />
        ))}
        {/* 垂直线 */}
        {[...Array(20)].map((_, i) => (
          <line
            key={`v-${i}`}
            x1={`${i * 5}%`}
            y1="0"
            x2={`${i * 5}%`}
            y2="100%"
            stroke="#666"
            strokeWidth="0.5"
          />
        ))}
      </svg>
    </div>
  );
};

const EmptyState: React.FC = () => {
  const { addFreeCell } = useLayoutStore();

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-gray-700 m-2 rounded-lg">
      <div className="text-6xl mb-4 opacity-30">🎬</div>
      <p className="mb-4 text-sm">自由布局模式 - 暂无画面</p>
      <button
        type="button"
        onClick={addFreeCell}
        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors flex items-center gap-2"
      >
        <span>+</span>
        <span>添加画面</span>
      </button>
    </div>
  );
};

export const VideoGrid: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerRect, setContainerRect] = useState({ width: 0, height: 0 });
  const [maximizedCell, setMaximizedCell] = useState<CellConfig | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const {
    cells,
    updateCellPosition,
    bindSource,
    isFreeMode,
    currentIndex,
    saveSnapshot
  } = useLayoutStore();

  // 传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5 // 拖拽开始前需要移动的距离
      }
    })
  );

  // 监听容器尺寸变化
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(entries => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setContainerRect({ width, height });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 拖拽开始处理
  const handleDragStart = useCallback((event: DragStartEvent) => {
    console.log('[VideoGrid] 拖拽开始:', event.active.id);
    setIsDraggingOver(true);
  }, []);

  // 拖拽结束处理
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, delta } = event;
    const cellId = active.id as string;

    setIsDraggingOver(false);

    // 检查是否从外部拖入（不是单元格内部拖拽）
    const isCell = cells.find(c => c.id === cellId);
    if (isCell) {
      // 单元格内部拖拽
      if (!isFreeMode || containerRect.width === 0) return;

      // 计算新位置
      const newX = Math.max(0, Math.min(95, isCell.x + (delta.x / containerRect.width) * 100));
      const newY = Math.max(0, Math.min(95, isCell.y + (delta.y / containerRect.height) * 100));

      updateCellPosition(cellId, newX, newY, containerRect.width, containerRect.height);
    }
  }, [cells, containerRect, isFreeMode, updateCellPosition]);

  // 拖拽取消处理
  const handleDragCancel = useCallback((event: DragCancelEvent) => {
    console.log('[VideoGrid] 拖拽取消');
    setIsDraggingOver(false);
  }, []);

  // 拖拽经过处理
  const handleDragOver = useCallback((event: DragOverEvent) => {
    // 处理外部拖入
    const { activatorEvent } = event;
    if (activatorEvent.dataTransfer) {
      activatorEvent.preventDefault();
      activatorEvent.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  // 处理放置事件
  const handleDrop = useCallback((event: DragOverEvent, cellId: string) => {
    const { activatorEvent } = event;
    if (!activatorEvent.dataTransfer) return;

    // 获取拖拽的数据
    const jsonData = activatorEvent.dataTransfer.getData('application/json');
    if (jsonData) {
      try {
        const source = JSON.parse(jsonData);
        console.log('[VideoGrid] 放置信号源:', source.name, '到单元格:', cellId);

        // 绑定信号源到单元格
        bindSource(cellId, source.id, source.streamUrl || TEST_STREAM_URL);

        // 保存布局快照
        saveSnapshot();
      } catch (e) {
        console.error('[VideoGrid] 解析拖拽数据失败:', e);
      }
    }
  }, [bindSource, saveSnapshot]);

  // 双击最大化
  const handleCellDoubleClick = useCallback((cell: CellConfig) => {
    if (maximizedCell?.id === cell.id) {
      setMaximizedCell(null);
    } else {
      setMaximizedCell(cell);
    }
  }, [maximizedCell]);

  // ESC 退出最大化
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && maximizedCell) {
        setMaximizedCell(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [maximizedCell]);

  // 最大化时的遮罩
  const MaximizedOverlay: React.FC<{ cell: CellConfig }> = ({ cell }) => (
    <div
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center cursor-pointer"
      onDoubleClick={() => setMaximizedCell(null)}
      onClick={() => setMaximizedCell(null)}
    >
      <div className="relative w-full h-full" onClick={(e) => e.stopPropagation()}>
        {cell.streamUrl ? (
          <video
            className="w-full h-full object-contain"
            autoPlay
            muted
            playsInline
            loop
            src={cell.streamUrl}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-6xl mb-4 opacity-30">📺</div>
              <p className="text-sm">{cell.name || `画面 ${cell.id}`}</p>
            </div>
          </div>
        )}

        {/* 画面信息 */}
        <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/60 rounded text-white text-sm">
          {cell.name || `画面 ${cell.id}`}
          {cell.sourceId && <span className="ml-2 text-gray-400">| {cell.sourceId}</span>}
        </div>
      </div>

      {/* 退出提示 */}
      <div className="absolute top-4 right-4 px-4 py-2 bg-black/60 hover:bg-black/80 rounded text-white text-sm transition-colors pointer-events-auto">
        <span className="flex items-center gap-2">
          <span>🖱️</span>
          <span>双击或按 ESC 退出全屏</span>
        </span>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="w-full h-full">
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        onDragOver={handleDragOver}
      >
        <GridContainer
          cells={cells}
          onCellDoubleClick={handleCellDoubleClick}
          onDrop={handleDrop}
        />
      </DndContext>

      {/* 最大化覆盖层 */}
      {maximizedCell && <MaximizedOverlay cell={maximizedCell} />}

      {/* 布局信息提示 */}
      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-gray-400 pointer-events-none">
        布局: {currentIndex} | 画面数: {cells.length}
        {isFreeMode && ' | 自由布局'}
        {isDraggingOver && ' | 拖拽中...'}
      </div>
    </div>
  );
};

export default VideoGrid;
