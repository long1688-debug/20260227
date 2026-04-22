# React 视频布局系统集成指南

## 概述

本系统使用 Tauri 2.x + React + TypeScript 实现，支持多种视频分屏布局，包括：
- 1、2、3、4、6、9、16、25、36、49 分屏
- 4 种特殊布局（1大1小）
- 自由布局（可拖拽组合）

## 文件结构

```
src/
├── types/
│   └── layout.ts              # 类型定义
├── utils/
│   └── layoutEngine.ts        # 布局引擎
├── store/
│   └── layoutStore.ts         # Zustand 状态管理
├── components/
│   ├── VideoCell.tsx          # 单个画面单元格
│   ├── VideoGrid.tsx           # 网格容器
│   ├── LayoutSelector.tsx      # 布局选择器
│   └── ReactVideoLayout.tsx   # Vue 集成入口
├── styles/
│   └── video-layout.css       # 样式文件
├── App.tsx                    # React 入口
└── main.tsx                   # React 启动文件
```

## 安装依赖

```bash
cd tauri-app
npm install
```

主要依赖：
- `react`, `react-dom` - React 核心
- `zustand` - 状态管理
- `@dnd-kit/core`, `@dnd-kit/utilities` - 拖拽功能
- `clsx`, `tailwind-merge` - 样式工具

## 开发与构建

### React 独立开发
```bash
npm run dev:react
```

### 构建 React 版本
```bash
npm run build:react
```

### Tauri 开发
```bash
npm run tauri:dev
```

### Tauri 构建
```bash
npm run tauri:build
```

## 使用方式

### 1. React 独立页面
访问 `index-react.html`，运行 `npm run dev:react`

### 2. 在 Vue 应用中嵌入 React
```javascript
// 在 Vue 组件中
import { mountReactVideoLayout, unmountReactVideoLayout } from '@/components/ReactVideoLayout';

// 挂载
onMounted(() => {
  mountReactVideoLayout('react-video-layout');
});

// 卸载
onUnmounted(() => {
  unmountReactVideoLayout();
});
```

## Tauri 后端命令

| 命令 | 说明 | 参数 |
|------|------|------|
| `save_layout` | 保存布局配置 | `{ index, name, cells }` |
| `load_layout` | 加载布局配置 | `index` |
| `list_saved_layouts` | 获取所有已保存布局 | - |
| `delete_layout` | 删除布局 | `index` |
| `export_layout` | 导出布局到文件 | `payload, export_path` |
| `import_layout` | 从文件导入布局 | `import_path` |

### Rust 调用示例

```rust
use tauri::app_handle;
use video_layout::{save_layout, load_layout};

#[tauri::command]
async fn my_save_handler(app_handle: AppHandle, layout_index: u8) -> Result<(), String> {
    let cells = load_layout(app_handle.clone(), layout_index).await?;
    // 处理 cells...
    Ok(())
}
```

## 布局索引说明

| 索引 | 名称 | 类型 |
|------|------|------|
| 1 | 1分屏 | grid |
| 2 | 2分屏 | grid |
| 3 | 3分屏 | grid |
| 4 | 4分屏 | grid |
| 5 | 6分屏 | grid |
| 7 | 9分屏 | grid |
| 10 | 16分屏 | grid |
| 11 | 25分屏 | grid |
| 12 | 36分屏 | grid |
| 13 | 49分屏 | grid |
| 14 | 特殊布局1 | special |
| 15 | 特殊布局2 | special |
| 16 | 特殊布局3 | special |
| 17 | 特殊布局4 | special |
| 18 | 自由布局 | free |

## 性能优化建议

1. **按需解码**：使用 IntersectionObserver 实现可视区域按需解码
2. **自动降级**：>16 屏自动降级为 Canvas 快照或低码流
3. **拖拽吸附**：启用网格吸附（默认 5% 网格）
4. **GPU 加速**：在 tauri.conf.json 添加 GPU 加速参数

```json
{
  "build": {
    "args": [
      "--enable-gpu-rasterization",
      "--enable-features=VaapiVideoDecoder"
    ]
  }
}
```
