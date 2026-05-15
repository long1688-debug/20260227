# 拖拽问题修复说明

## 问题描述

从预览区域拖拽信号源到视频展示区域后，再次拖拽时会出现问题：信号源似乎"留在"了预览区域，或者拖拽行为异常。

## 根本原因

在 `useSourceDrag.js` 中，拖拽状态管理存在以下问题：

1. **状态未完全清理**：在拖拽放置完成后，`mouseDragState.source` 和 `currentSelectedSource.value` 没有被清除
2. **状态残留导致重复使用**：下次拖拽时，如果 `resolveDraggedSource` 无法从事件中获取数据，会回退使用旧的 `mouseDragState.source`，导致错误的信号源被放置
3. **TeacherWindow.vue 中的事件传递问题**：`handleVideoDrop` 函数传递的是一个简化的对象 `{ ...source, dataTransfer: {} }`，而不是完整的拖拽事件，导致 `resolveDraggedSource` 无法正确解析

## 修复方案

### 1. 修复 TeacherWindow.vue 中的 handleVideoDrop

**文件**: `tauri-app/src/components/TeacherWindow.vue`

**修改位置**: 第3527-3533行

**修改内容**:

```javascript
// 创建一个模拟的拖拽事件对象，包含必要的 dataTransfer 信息
const mockEvent = {
  preventDefault: () => {},
  dataTransfer: {
    getData: (key) => {
      if (key === 'sourceId') return sourceId;
      if (key === 'sourceType') return sourceType;
      if (key === 'sourceName') return sourceName;
      if (key === 'application/json') return JSON.stringify(source);
      return '';
    }
  }
};
handleDrop(mockEvent, index)
```

**说明**: 创建一个包含完整 `dataTransfer` 接口的模拟事件对象，确保 `resolveDraggedSource` 能正确解析信号源数据。

### 2. 修复 useSourceDrag.js 中的状态清理

**文件**: `tauri-app/src/composables/useSourceDrag.js`

#### 修改1: handleDrop 函数（第802-811行）

```javascript
// 重置拖拽状态
dragOverIndex.value = null;
isDraggingSource.value = false;
mouseDragState.isDragging = false;
mouseDragState.source = null;  // 🎯 关键修复：清除源引用，防止重复使用
currentSelectedSource.value = null;  // 🎯 清除当前选中源
```

#### 修改2: handleMouseUp 函数（第490-496行）

```javascript
// 结束拖拽状态
mouseDragState.isDragging = false;
mouseDragState.source = null;  // 🎯 关键修复：清除源引用，防止重复使用

// 🎯 重置 isDraggingSource 状态，允许 VideoSection 处理 HTML5 原生拖拽事件
isDraggingSource.value = null;
dragOverIndex.value = null;
currentSelectedSource.value = null;  // 🎯 清除当前选中源
```

#### 修改3: onTouchEnd 函数（第636-643行）

```javascript
// 重置拖拽状态
mouseDragState.isDragging = false;
mouseDragState.source = null;
mouseDragState.isFromPreview = false;  // 🎯 重置拖拽来源标志
dragOverIndex.value = null;
isDraggingSource.value = null;
draggedSourceType.value = null;
currentSelectedSource.value = null;  // 🎯 清除当前选中源
```

#### 修改4: onDrop 函数（第919-922行）

```javascript
dragOverIndex.value = null;
isDraggingSource.value = null;
currentSelectedSource.value = null;  // 🎯 清除当前选中源
mouseDragState.source = null;  // 🎯 清除鼠标拖拽状态中的源
```

#### 修改5: onDropPip 函数（第751-754行）

```javascript
dragOverIndex.value = null;
isDraggingSource.value = null;
currentSelectedSource.value = null;  // 🎯 清除当前选中源
mouseDragState.source = null;  // 🎯 清除鼠标拖拽状态中的源
```

## 修复效果

1. ✅ 每次拖拽放置后，所有拖拽状态都会被完全清除
2. ✅ 下次拖拽时，不会使用上次残留的状态
3. ✅ 从预览区域拖拽到视频展示区域后，可以正常进行下一次拖拽
4. ✅ 支持多种拖拽方式（鼠标拖拽、触摸拖拽、HTML5拖拽）的状态一致性

## 测试建议

1. **基本拖拽测试**:
   - 从预览区域拖拽一个摄像头到视频格子
   - 确认视频正常显示
   - 再次从预览区域拖拽另一个信号源到不同的视频格子
   - 确认两次拖拽都正常工作

2. **多次拖拽测试**:
   - 连续拖拽多个信号源到不同的视频格子
   - 确认每次拖拽都能正确放置
   - 确认没有状态污染

3. **混合拖拽测试**:
   - 使用鼠标拖拽
   - 使用触摸屏拖拽（如果有触控设备）
   - 确认两种方式的拖拽都能正常工作

4. **边界情况测试**:
   - 拖拽到无效区域（释放到空白处）
   - 拖拽过程中取消（按ESC或点击其他地方）
   - 确认状态能正确清理

## 相关文件

- `tauri-app/src/components/TeacherWindow.vue`
- `tauri-app/src/composables/useSourceDrag.js`
- `tauri-app/src/components/teacher-window/layout/SourcePreviewBar.vue`
- `tauri-app/src/components/teacher-window/video/VideoGrid.vue`

## 注意事项

1. 所有拖拽相关的状态清理必须保持一致
2. `mouseDragState.source` 和 `currentSelectedSource.value` 必须在每次拖拽结束后清除
3. 模拟事件对象必须实现完整的 `dataTransfer` 接口
4. 保持克隆机制不变，确保预览区域的原始源不被移除
