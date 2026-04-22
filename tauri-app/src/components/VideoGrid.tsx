// 视频网格容器组件 - 使用 DnD Kit 管理拖拽

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverEvent
} from '@dnd-kit/core';
import { VideoCell } from './VideoCell';
import { useLayoutStore } from '../store/layoutStore';
import { CellConfig } from '../types/layout';
import { clsx } from 'clsx';

interface GridContainerProps {
  cells: CellConfig[];
  onCellDoubleClick?: (cell: CellConfig) => void;
}

const GridContainer: React.FC<GridContainerProps> = ({
  cells,
  onCellDoubleClick
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: 'grid-container'
  });

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'relative w-full h-full bg-gray-950 overflow-hidden rounded-lg shadow-inner',
        isOver && 'ring-2 ring-blue-500 ring-inset'
      )}
    >
      {cells.map(cell => (
        <VideoCell
          key={cell.id}
          cell={cell}
          onDoubleClick={onCellDoubleClick}
        />
      ))}

      {/* 空状态 */}
      {cells.length === 0 && (
        <EmptyState />
      )}

      {/* 网格背景（仅在自由布局显示） */}
      <GridBackground />
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

  const {
    cells,
    updateCellPosition,
    isFreeMode,
    currentIndex
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

  // 拖拽结束处理
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, delta } = event;
    const cellId = active.id as string;

    if (!isFreeMode || containerRect.width === 0) return;

    const cell = cells.find(c => c.id === cellId);
    if (!cell) return;

    // 计算新位置
    const newX = Math.max(0, Math.min(95, cell.x + (delta.x / containerRect.width) * 100));
    const newY = Math.max(0, Math.min(95, cell.y + (delta.y / containerRect.height) * 100));

    updateCellPosition(cellId, newX, newY, containerRect.width, containerRect.height);
  }, [cells, containerRect, isFreeMode, updateCellPosition]);

  // 拖拽中处理（预留扩展）
  const handleDragMove = useCallback((_event: DragOverEvent) => {
    // 可以在这里实现拖拽预览效果
  }, []);

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
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center"
      onDoubleClick={() => setMaximizedCell(null)}
    >
      <div className="relative w-full h-full">
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
      </div>
      {/* 退出按钮 */}
      <button
        type="button"
        onClick={() => setMaximizedCell(null)}
        className="absolute top-4 right-4 px-4 py-2 bg-black/60 hover:bg-black/80 rounded text-white text-sm transition-colors"
      >
        按 ESC 或双击退出
      </button>
    </div>
  );

  return (
    <div ref={containerRef} className="w-full h-full">
      <DndContext
        sensors={sensors}
        onDragEnd={handleDragEnd}
        onDragMove={handleDragMove}
      >
        <GridContainer
          cells={cells}
          onCellDoubleClick={handleCellDoubleClick}
        />
      </DndContext>

      {/* 最大化覆盖层 */}
      {maximizedCell && <MaximizedOverlay cell={maximizedCell} />}

      {/* 布局信息提示 */}
      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-gray-400">
        布局: {currentIndex} | 画面数: {cells.length}
        {isFreeMode && ' | 自由布局'}
      </div>
    </div>
  );
};

export default VideoGrid;
