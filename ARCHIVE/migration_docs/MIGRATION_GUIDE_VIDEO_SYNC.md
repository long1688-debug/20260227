# 视频状态管理系统迁移指南

## 📋 概述

本项目已完成从双轨制状态管理（`useVideoStore` + `useVideoSync`）到单一系统（`useVideoSync`）的迁移。

**迁移日期**: 2026-04-23  
**影响范围**: 所有视频网格、信号源管理、布局切换相关功能

---

## 🎯 迁移原因

### 问题背景
之前项目中存在两套并行的状态管理系统：
1. **旧版系统**: `useVideoStore` (Pinia Store)
2. **新版系统**: `useVideoSync` (Composable)

这导致了以下问题：
- ❌ 状态不一致：不同组件使用不同的状态源
- ❌ 数据不同步：修改一个系统的状态，另一个系统感知不到
- ❌ 维护困难：需要同时维护两套API
- ❌ Bug频发：布局切换、信号源删除等操作容易出现残留或错误

### 解决方案
统一使用 `useVideoSync` composable，废弃 `useVideoStore`。

---

## ✅ 已完成的迁移

### 1. useVideoSync 功能增强

新增了以下功能（从 `useVideoStore` 迁移）：

#### 信号源管理
```javascript
// 新增方法
addSource(source)              // 添加信号源到完整列表
removeSource(sourceId)         // 删除信号源（包含所有清理逻辑）
updateSource(sourceId, updates) // 更新信号源信息
setCanvasSource(canvasIndex, source) // 设置画布的信号源
getSourceByCanvasIndex(index)  // 获取指定画布的源
hasSourceAtCanvas(index)       // 检查画布是否有信号源
```

#### 录制状态管理
```javascript
setCanvasRecordingState(index, state)    // 设置画布录制状态
getCanvasRecordingState(index)           // 获取画布录制状态
clearCanvasRecordingState(index)         // 清除画布录制状态
getAllRecordingStates()                  // 获取所有录制状态
```

#### 布局配置管理
```javascript
setLayout(layout, position)            // 切换布局（自动保存/加载配置）
saveCurrentLayoutConfig()               // 保存当前布局配置
loadLayoutConfig(layoutId)              // 加载指定布局配置
maximizeCanvas(canvasIndex)             // 最大化画布
restoreLayout()                         // 还原布局
clearAllCanvases()                      // 清空所有画布
```

#### 数组初始化
```javascript
initVideoPreviewsLength(length)  // 初始化 videoPreviews 数组长度
```

### 2. 组件迁移清单

| 组件文件 | 迁移状态 | 主要改动 |
|---------|---------|---------|
| `TeacherWindow.vue` | ✅ 完成 | 移除直接操作数组代码，使用新API |
| `EnhancedTeacherWindow.vue` | ✅ 完成 | 从 useVideoStore 切换到 useVideoSync |
| `VideoGrid.vue` | ✅ 完成 | 从 useVideoStore 切换到 useVideoSync |
| `EnhancedVideoGrid.vue` | ✅ 完成 | 统一使用 useVideoSync 的状态 |
| `useRecording.js` | ✅ 完成 | 替换 videoStore 引用为 useVideoSync |

### 3. 代码改进示例

#### ❌ 旧版代码（直接操作数组）
```javascript
// TeacherWindow.vue - 旧版
videoPreviews.value.push(null)
videoPreviews.value.splice(sourceIndex, 1)
videoPreviews.value = Array(gridCount).fill(null)
```

#### ✅ 新版代码（使用方法）
```javascript
// TeacherWindow.vue - 新版
initVideoPreviewsLength(requiredLength)
removeVideoSource(sourceId)  // 内部处理所有清理
initVideoPreviewsLength(gridCount)
```

---

## 🔄 迁移对照表

### API 映射关系

| 旧版 (useVideoStore) | 新版 (useVideoSync) | 说明 |
|---------------------|-------------------|------|
| `videoStore.currentLayout` | `currentLayout` | 直接解构 |
| `videoStore.setLayout(layout)` | `setLayout(layout)` | 同名方法 |
| `videoStore.setCanvasSource(idx, src)` | `setCanvasSource(idx, src)` | 同名方法 |
| `videoStore.removeSource(id)` | `removeSource(id)` | 同名方法 |
| `videoStore.updateSource(id, updates)` | `updateSource(id, updates)` | 同名方法 |
| `videoStore.togglePiP()` | `togglePip()` | 注意大小写 |
| `videoStore.maximizeCanvas(idx)` | `maximizeCanvas(idx)` | 同名方法 |
| `videoStore.restoreLayout()` | `restoreLayout()` | 同名方法 |
| `videoStore.setCanvasRecordingState()` | `setCanvasRecordingState()` | 同名方法 |
| `videoStore.getSourceByCanvasIndex()` | `getSourceByCanvasIndex()` | 同名方法 |
| `videoStore.hasSourceAtCanvas()` | `hasSourceAtCanvas()` | 同名方法 |

### 使用方式对比

#### 旧版用法
```javascript
import { useVideoStore } from '@/stores/video'

const videoStore = useVideoStore()
videoStore.setLayout(9)
videoStore.setCanvasSource(1, source)
```

#### 新版用法
```javascript
import { useVideoSync } from '@/composables/useVideoSync'

const { 
  currentLayout, 
  setLayout, 
  setCanvasSource,
  removeSource,
  updateSource
} = useVideoSync()

setLayout(9)
setCanvasSource(1, source)
```

---

## ⚠️ 注意事项

### 1. 禁止直接操作响应式数组
```javascript
// ❌ 错误：直接修改数组
videoPreviews.value.push(source)
videoPreviews.value.splice(index, 1)
canvasSourceMap.value[key] = sourceId

// ✅ 正确：使用方法
addVideoSource(source)
removeVideoSource(sourceId)
setCanvasSource(canvasIndex, source)
```

### 2. 布局切换时的数组初始化
```javascript
// ✅ 正确做法
const gridCount = getVisibleCanvasIndices(layout).length
initVideoPreviewsLength(gridCount)  // 先初始化长度
// 然后再恢复具体的视频源
```

### 3. 状态同步
所有组件现在共享同一套状态，无需手动同步：
```javascript
// 在任何一个组件中修改状态，其他组件自动感知
const { setLayout } = useVideoSync()
setLayout(9)  // TeacherWindow、VideoGrid 等都会收到更新
```

---

## 🗑️ 废弃文件

### stores/video.js
- **状态**: 已标记为 `@deprecated`
- **保留原因**: 兼容可能的遗留引用
- **计划**: 下一个大版本中彻底删除
- **替代方案**: 使用 `useVideoSync` composable

---

## 🧪 测试清单

迁移后需要验证的功能：

- [ ] 布局切换（1/2/3/4/6/9/16/25/36/49分屏）
- [ ] 画中画模式切换
- [ ] 信号源拖拽到画布
- [ ] 信号源删除（从预览和列表）
- [ ] 信号源重命名
- [ ] 录制状态显示
- [ ] 最大化/还原功能
- [ ] 布局配置保存/恢复

---

## 📚 相关文档

- [Vue多分屏布局状态管理与交互规范](memory://5410fce7-a4b8-45dc-aaf2-fc07672cf903)
- [Vue状态管理规范：禁止直接操作响应式数组](memory://ed2a26f9-186c-472b-a3ad-ee3d86c48492)
- [布局切换时视频预览数组初始化规范](memory://f6549071-bd64-4673-9bce-caf44e7519a7)

---

## 🎉 总结

通过这次迁移，我们：
1. ✅ 消除了状态不一致的问题
2. ✅ 简化了代码架构
3. ✅ 提高了可维护性
4. ✅ 为未来的 TypeScript 迁移奠定基础
5. ✅ 规范化了数组操作流程

**所有新开发的功能应直接使用 `useVideoSync`。**
