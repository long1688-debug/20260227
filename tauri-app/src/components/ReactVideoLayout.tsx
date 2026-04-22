// React 视频布局组件 - 可嵌入 Vue 应用

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../App';

// 创建 React 挂载点并渲染
export function mountReactVideoLayout(containerId: string = 'react-video-layout'): HTMLElement {
  // 创建容器
  let container = document.getElementById(containerId) as HTMLElement;

  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.style.width = '100%';
    container.style.height = '100%';
  }

  // 创建 React Root
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  return container;
}

// 卸载 React 应用
export function unmountReactVideoLayout(containerId: string = 'react-video-layout'): void {
  const container = document.getElementById(containerId);
  if (container) {
    // React 18 需要使用 unmount 方法
    const root = (window as any).__reactRoot?.[containerId];
    if (root) {
      root.unmount();
      delete (window as any).__reactRoot?.[containerId];
    }
    container.remove();
  }
}

// 默认导出挂载函数
export default mountReactVideoLayout;
