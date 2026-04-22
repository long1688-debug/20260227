// 布局选择器组件 - 切换不同视频布局

import React, { useCallback } from 'react';
import { useLayoutStore } from '../store/layoutStore';
import { getLayoutIndexList, LAYOUT_REGISTRY } from '../utils/layoutEngine';
import { clsx } from 'clsx';

interface LayoutButtonProps {
  index: number;
  name: string;
  isActive: boolean;
  onClick: () => void;
}

const LayoutButton: React.FC<LayoutButtonProps> = ({
  name,
  isActive,
  onClick
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'px-3 py-1.5 text-xs rounded transition-all duration-150 font-medium',
        'border border-transparent',
        isActive
          ? 'bg-blue-600 text-white shadow-md'
          : 'bg-gray-700/80 text-gray-300 hover:bg-gray-600 hover:text-white'
      )}
      title={`切换到${name}`}
    >
      {name}
    </button>
  );
};

export const LayoutSelector: React.FC = () => {
  const { setLayout, currentIndex, saveLayout } = useLayoutStore();
  const layoutIndices = getLayoutIndexList();

  const handleLayoutChange = useCallback((index: number) => {
    setLayout(index);
  }, [setLayout]);

  const handleSave = useCallback(async () => {
    await saveLayout();
  }, [saveLayout]);

  // 布局分组
  const gridLayouts = layoutIndices.filter(
    idx => LAYOUT_REGISTRY[idx]?.type === 'grid'
  );
  const specialLayouts = layoutIndices.filter(
    idx => LAYOUT_REGISTRY[idx]?.type === 'special'
  );
  const freeLayouts = layoutIndices.filter(
    idx => LAYOUT_REGISTRY[idx]?.type === 'free'
  );

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-800/90 border-b border-gray-700 select-none">
      {/* 标准网格布局 */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-gray-500 mr-1">网格:</span>
        {gridLayouts.map(idx => (
          <LayoutButton
            key={idx}
            index={idx}
            name={LAYOUT_REGISTRY[idx]?.name || `布局${idx}`}
            isActive={currentIndex === idx}
            onClick={() => handleLayoutChange(idx)}
          />
        ))}
      </div>

      {/* 分隔线 */}
      <div className="w-px h-5 bg-gray-600 mx-2" />

      {/* 特殊布局 */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-gray-500 mr-1">特殊:</span>
        {specialLayouts.map(idx => (
          <LayoutButton
            key={idx}
            index={idx}
            name={LAYOUT_REGISTRY[idx]?.name || `布局${idx}`}
            isActive={currentIndex === idx}
            onClick={() => handleLayoutChange(idx)}
          />
        ))}
      </div>

      {/* 分隔线 */}
      <div className="w-px h-5 bg-gray-600 mx-2" />

      {/* 自由布局 */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-gray-500 mr-1">自由:</span>
        {freeLayouts.map(idx => (
          <LayoutButton
            key={idx}
            index={idx}
            name={LAYOUT_REGISTRY[idx]?.name || `布局${idx}`}
            isActive={currentIndex === idx}
            onClick={() => handleLayoutChange(idx)}
          />
        ))}
      </div>

      {/* 右侧操作按钮 */}
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          className="px-3 py-1 text-xs bg-green-600/80 hover:bg-green-500 text-white rounded transition-colors"
          title="保存当前布局"
        >
          保存
        </button>
      </div>
    </div>
  );
};

export default LayoutSelector;
