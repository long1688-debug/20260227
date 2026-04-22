# 统一渲染架构 - 拖拽功能修复报告

## 🐛 问题描述

在实施统一渲染架构后，发现**拖拽信号源到画布**功能无法正常工作。

### 错误日志

```
[鼠标拖拽] 开始拖拽: HD Webcam (04f2:b711) localDevice
[鼠标拖拽] 放置，目标索引: null
[鼠标拖拽] 未放置到有效区域
```

### 根本原因

RenderCanvasWrapper 使用的是 **Canvas 元素**，而 Canvas 不支持 HTML5 拖拽 API（`dragover`、`drop` 事件）。

TeacherWindow 中的拖拽系统使用的是**自定义鼠标拖拽**（通过 `mousedown/mousemove/mouseup` 事件），这两个系统不兼容。

---

## ✅ 解决方案

### 方案：在 RenderCanvasWrapper 中添加自定义鼠标拖拽支持

**实施位置**: `tauri-app/src/components/teacher-window/RenderCanvasWrapper.vue`

### 修改内容

#### 1. 添加鼠标事件监听器

在 `onMounted` 中绑定鼠标事件：

```javascript
// 🆕 绑定自定义鼠标拖拽事件（主要方式）
canvasRef.value.addEventListener('mousedown', handleMouseDown);
document.addEventListener('mousemove', handleMouseMove);
document.addEventListener('mouseup', handleMouseUp);
```

在 `onUnmounted` 中清理事件监听：

```javascript
canvasRef.value.removeEventListener('mousedown', handleMouseDown);
document.removeEventListener('mousemove', handleMouseMove);
document.removeEventListener('mouseup', handleMouseUp);
```

#### 2. 实现拖拽处理函数

```javascript
let isDragging = false;
let dragSource = null;

/**
 * 🆕 处理鼠标按下（开始拖拽）
 */
const handleMouseDown = (event) => {
  // 只处理左键
  if (event.button !== 0) return;

  // 从全局状态获取当前选中的信号源
  if (typeof window !== 'undefined' && window.__sourceStore) {
    const selectedSource = window.__sourceStore.currentSelectedSource;
    if (selectedSource) {
      isDragging = true;
      dragSource = selectedSource;
      console.log(`[RenderCanvasWrapper] 开始拖拽: ${selectedSource.name}`);
    }
  }
};

/**
 * 🆕 处理鼠标移动（拖拽中）
 */
const handleMouseMove = (event) => {
  if (!isDragging || !dragSource) return;
  // 可以在这里添加拖拽视觉反馈（如幽灵元素）
};

/**
 * 🆕 处理鼠标释放（放置）
 */
const handleMouseUp = (event) => {
  if (!isDragging || !dragSource || !canvasRef.value) {
    isDragging = false;
    dragSource = null;
    return;
  }

  const rect = canvasRef.value.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const layoutKey = `layout_${currentLayout.value}`;
  const currentLayoutObj = renderCanvas.value.getLayout(layoutKey);

  if (!currentLayoutObj) {
    console.warn('[RenderCanvasWrapper] 当前布局不存在:', layoutKey);
    isDragging = false;
    dragSource = null;
    return;
  }

  // 命中测试找到目标 Box
  const box = currentLayoutObj.hitTest(x, y, 'box');

  if (box) {
    // ⭐ 关键：调用 box.setSource 设置 refId
    box.setSource(dragSource);

    // 更新 layoutStates
    const boxIndex = currentLayoutObj.elements.indexOf(box);
    const slotIndex = boxIndex + 1; // 转换为 1-based

    assignSource(slotIndex, dragSource.id);

    emit('source-dropped', {
      index: slotIndex,
      sourceId: dragSource.id,
      sourceType: dragSource.type
    });

    console.log(`[RenderCanvasWrapper] ✅ 信号源已放置: 格子${slotIndex} -> ${dragSource.name}`);
    console.log(`[RenderCanvasWrapper] Box refId: ${box.refId}, sourceType: ${box.sourceType}`);

    ElMessage.success(`已将 ${dragSource.name} 添加到画布 ${slotIndex}`);
  } else {
    console.log('[RenderCanvasWrapper] 未命中任何 Box，取消拖拽');
  }

  // 重置拖拽状态
  isDragging = false;
  dragSource = null;
};
```

#### 3. 导入 ElMessage

```javascript
import { ElMessage } from 'element-plus';
```

---

## 🎯 工作原理

### 拖拽流程

```
用户在 SourcePreviewBar 中点击信号源
  ↓
window.__sourceStore.currentSelectedSource 被设置
  ↓
用户在 RenderCanvas 上按下鼠标左键
  ↓
handleMouseDown 检测到 currentSelectedSource
  ↓
isDragging = true, dragSource = selectedSource
  ↓
用户移动鼠标（可选的视觉反馈）
  ↓
用户释放鼠标
  ↓
handleMouseUp 计算坐标并执行 hitTest
  ↓
找到目标 Box → box.setSource(dragSource)
  ↓
⭐ 设置 box._refId = dragSource.id（持久化）
  ↓
更新 layoutStates → assignSource(slotIndex, sourceId)
  ↓
触发 'source-dropped' 事件通知父组件
  ↓
显示成功消息
```

### 关键点

1. **全局状态共享**: 通过 `window.__sourceStore` 共享当前选中的信号源
2. **Canvas 坐标转换**: 使用 `getBoundingClientRect()` 将屏幕坐标转换为 Canvas 坐标
3. **命中测试**: 使用 `RenderLayout.hitTest()` 找到目标 Box
4. **持久化绑定**: 调用 `box.setSource()` 设置 `refId` 和 `sourceType`
5. **状态同步**: 同时更新 `layoutStates` 确保布局切换时能恢复

---

## 🧪 测试方法

### 1. 启动应用

```bash
cd tauri-app
npm run dev
```

### 2. 添加信号源

1. 点击左侧边栏的"+"按钮
2. 选择"本地摄像头"或"本地视频"
3. 添加一个信号源

### 3. 拖拽信号源到画布

1. 在左侧预览区域点击信号源（选中）
2. 在右侧画布上按住鼠标左键并拖动
3. 释放鼠标

**预期结果**:

- 控制台输出：`[RenderCanvasWrapper] ✅ 信号源已放置: 格子1 -> XXX`
- 控制台输出：`[RenderCanvasWrapper] Box refId: source_xxx, sourceType: camera`
- 弹出提示：`已将 XXX 添加到画布 1`
- 画布上显示信号源画面

### 4. 验证持久化

1. 切换到其他布局（如 2分屏）
2. 再切换回原布局（1分屏）
3. 检查信号源是否仍然显示

**预期结果**:

- 信号源画面立即恢复
- 控制台输出：`[布局切换] 恢复信号源: 格子1 -> source_xxx`

### 5. 验证 refId

在浏览器控制台中执行：

```javascript
const layout1 = window.__renderCanvas.getLayout('layout_1');
console.log('Box 0 refId:', layout1.elements[0].refId);
console.log('Box 0 sourceType:', layout1.elements[0].sourceType);
```

**预期结果**:

- `refId` 不为 null
- `sourceType` 为正确的类型（camera/video等）

---

## 📊 对比测试

### 旧架构（VideoPreview）

```
TeacherWindow → VideoGrid → VideoPreview
  ↓
HTML5 拖拽 API (@dragover, @drop)
  ↓
DOM 元素接收事件
```

**优点**:

- 简单直接
- 浏览器原生支持

**缺点**:

- 每个格子都是独立的 Vue 组件
- 布局切换需要重建大量组件
- 性能较差

### 新架构（RenderCanvas）

```
TeacherWindow → RenderCanvasWrapper → RenderCanvas
  ↓
自定义鼠标拖拽 (mousedown/mousemove/mouseup)
  ↓
Canvas 元素 + hitTest 计算
```

**优点**:

- 单一 Canvas 元素，高性能
- 布局切换只需改变指针
- 支持复杂渲染（批注、PTZ等）

**缺点**:

- 需要手动实现拖拽逻辑
- 坐标计算较复杂

---

## 🔮 后续优化

### 1. 添加拖拽视觉反馈

在 `handleMouseMove` 中添加幽灵元素：

```javascript
const handleMouseMove = (event) => {
  if (!isDragging || !dragSource) return;

  // 创建或更新幽灵元素
  if (!ghostElement) {
    ghostElement = document.createElement('div');
    ghostElement.className = 'drag-ghost';
    ghostElement.textContent = dragSource.name;
    document.body.appendChild(ghostElement);
  }

  ghostElement.style.left = event.clientX + 10 + 'px';
  ghostElement.style.top = event.clientY + 10 + 'px';
};
```

### 2. 支持多信号源同时拖拽

扩展 `dragSource` 为数组：

```javascript
let dragSources = [];

const handleMouseDown = (event) => {
  // 支持多选
  const selectedSources = window.__sourceStore.selectedSources;
  if (selectedSources && selectedSources.length > 0) {
    isDragging = true;
    dragSources = [...selectedSources];
  }
};
```

### 3. 添加拖拽动画

使用 CSS transition 实现平滑的拖拽效果。

### 4. 支持触摸设备

添加 `touchstart/touchmove/touchend` 事件支持。

---

## ✅ 修复完成

**修复日期**: 2026-05-07
**影响文件**: `tauri-app/src/components/teacher-window/RenderCanvasWrapper.vue`
**代码行数**: +95 行
**测试结果**: ✅ 待验证

---

## 📝 注意事项

1. **全局状态依赖**: 此实现依赖 `window.__sourceStore`，确保 TeacherWindow 已初始化它
2. **事件冲突**: 如果同时启用 HTML5 拖拽和自定义拖拽，可能会有冲突，建议只使用一种
3. **性能考虑**: 频繁的 `hitTest` 计算可能影响性能，可以考虑节流优化
4. **兼容性**: 此方案适用于所有现代浏览器

---

**最后更新**: 2026-05-07
**版本**: 1.0.0
