// React 入口应用组件 - 视频布局系统

import React from 'react';
import { LayoutSelector } from './components/LayoutSelector';
import { VideoGrid } from './components/VideoGrid';

const App: React.FC = () => {
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white select-none overflow-hidden">
      {/* 顶部布局选择器 */}
      <LayoutSelector />

      {/* 主内容区域 */}
      <main className="flex-1 p-3 overflow-hidden">
        <VideoGrid />
      </main>
    </div>
  );
};

export default App;
