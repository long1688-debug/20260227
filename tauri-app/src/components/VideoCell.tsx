// 单个视频画面单元格组件
// 支持从预览区域拖拽信号源到单元格

import React, { useCallback, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useLayoutStore } from '../store/layoutStore';
import { CellConfig } from '../types/layout';
import { clsx } from 'clsx';

// 测试视频流 URL
const TEST_STREAM_URL = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

interface VideoCellProps {
  cell: CellConfig;
  onDoubleClick?: (cell: CellConfig) => void;
  onDrop?: (event: React.DragEvent, cellId: string) => void;
}

export const VideoCell: React.FC<VideoCellProps> = ({
  cell,
  onDoubleClick,
  onDrop
}) => {
  const { removeCell, bindSource, unbindSource, isFreeMode } = useLayoutStore();
  const [isHovered, setIsHovered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  // isPlaying 用于将来扩展播放控制功能
  void isPlaying;

  // DnD 可拖拽配置（仅自由布局模式下可拖拽）
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging
  } = useDraggable({
    id: cell.id,
    data: {
      type: 'video-cell',
      cellId: cell.id
    },
    disabled: !isFreeMode
  });

  // 计算样式
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${cell.x}%`,
    top: `${cell.y}%`,
    width: `${cell.width}%`,
    height: `${cell.height}%`,
    transform: transform
      ? `translate(${transform.x}px, ${transform.y}px)`
      : undefined,
    zIndex: isDragging ? 100 : 1,
    transition: isDragging ? 'none' : 'all 0.15s ease',
    cursor: isDragging ? 'grabbing' : 'grab',
    boxSizing: 'border-box',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    backgroundColor: '#0a0f1a',
    overflow: 'hidden',
    borderRadius: '4px',
    boxShadow: isDragging
      ? '0 8px 32px rgba(0, 0, 0, 0.5)'
      : '0 2px 8px rgba(0, 0, 0, 0.3)'
  };

  // 处理拖放进入
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    setIsDragOver(true);
  }, []);

  // 处理拖放离开
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  // 处理放置
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    // 获取拖拽的数据
    const jsonData = e.dataTransfer.getData('application/json');
    if (jsonData) {
      try {
        const source = JSON.parse(jsonData);
        console.log('[VideoCell] 放置信号源:', source.name, '到单元格:', cell.id);

        // 绑定信号源到单元格
        bindSource(cell.id, source.id, source.streamUrl || TEST_STREAM_URL);
        setIsPlaying(true);
      } catch (err) {
        console.error('[VideoCell] 解析拖拽数据失败:', err);
      }
    }

    // 调用父组件的 onDrop
    onDrop?.(e, cell.id);
  }, [cell.id, bindSource, onDrop]);

  // 模拟绑定视频流
  const handleBindStream = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    bindSource(cell.id, `source-${cell.id}`, TEST_STREAM_URL);
    setIsPlaying(true);
  }, [cell.id, bindSource]);

  // 解绑视频流
  const handleUnbindStream = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    unbindSource(cell.id);
    setIsPlaying(false);
  }, [cell.id, unbindSource]);

  // 删除单元格（仅自由布局）
  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    removeCell(cell.id);
  }, [cell.id, removeCell]);

  // 双击最大化
  const handleDoubleClick = useCallback(() => {
    onDoubleClick?.(cell);
  }, [cell, onDoubleClick]);

  // 视频播放状态变化
  const handleVideoStatusChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={handleDoubleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={clsx(
        'video-cell group',
        isDragging && 'video-cell-dragging',
        isDragOver && 'video-cell-drag-over'
      )}
    >
      {/* 视频内容 */}
      {cell.streamUrl ? (
        <>
          <video
            className="w-full h-full object-cover"
            autoPlay
            muted
            playsInline
            loop
            src={cell.streamUrl}
            onPlay={() => handleVideoStatusChange(true)}
            onPause={() => handleVideoStatusChange(false)}
          />
          {/* 播放状态指示 */}
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 rounded text-xs text-green-400 flex items-center gap-1">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            LIVE
          </div>
        </>
      ) : (
        /* 空单元格占位 */
        <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 select-none">
          <div className="text-4xl mb-2 opacity-30">📺</div>
          <div className="text-xs text-gray-600 mb-2">{cell.name || `画面 ${cell.id}`}</div>
          <button
            type="button"
            onClick={handleBindStream}
            onPointerDown={(e) => e.stopPropagation()}
            className="px-3 py-1 bg-blue-600/80 hover:bg-blue-500 rounded text-xs transition-colors"
          >
            模拟绑定
          </button>
        </div>
      )}

      {/* 拖放覆盖层 */}
      {isDragOver && (
        <div className="absolute inset-0 bg-blue-500/30 flex items-center justify-center pointer-events-none">
          <div className="px-4 py-2 bg-blue-600 rounded-lg text-white text-sm font-medium">
            {cell.sourceId ? '替换信号源' : '放置信号源'}
          </div>
        </div>
      )}

      {/* 源信息叠加层 */}
      {cell.sourceId && (
        <div className="absolute top-2 right-12 px-2 py-0.5 bg-black/60 rounded text-xs text-white/80">
          {cell.sourceId}
        </div>
      )}

      {/* 操作按钮覆盖层 */}
      <div
        className={clsx(
          'absolute inset-0 bg-black/40 transition-opacity duration-150',
          isHovered || isDragging ? 'opacity-100' : 'opacity-0',
          'flex items-center justify-center gap-2'
        )}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* 解绑按钮 */}
        {cell.streamUrl && (
          <button
            type="button"
            onClick={handleUnbindStream}
            className="px-3 py-1.5 bg-yellow-600/90 hover:bg-yellow-500 rounded text-xs transition-colors"
          >
            解绑
          </button>
        )}
        {/* 删除按钮（仅自由布局） */}
        {isFreeMode && (
          <button
            type="button"
            onClick={handleRemove}
            className="px-3 py-1.5 bg-red-600/90 hover:bg-red-500 rounded text-xs transition-colors"
          >
            删除
          </button>
        )}
      </div>

      {/* 右下角拖拽指示器（仅自由布局） */}
      {isFreeMode && (
        <div
          className={clsx(
            'absolute bottom-1 right-1 w-3 h-3 cursor-se-resize opacity-0 group-hover:opacity-50 transition-opacity',
            'border-r-2 border-b-2 border-gray-400'
          )}
        />
      )}
    </div>
  );
};

export default VideoCell;
