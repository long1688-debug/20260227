# 🔍 主画布黑屏问题诊断指南

## 📋 问题描述

用户报告：**拖拽信号源到画布后，主画布显示为黑色**，但：

- ✅ 顶部提示消息显示"已将 XXX 添加到画布 1"
- ✅ 预览栏正常显示信号源
- ❌ 主画布区域显示为黑色

---

## 🔧 已添加的调试日志

已在 `VideoGrid.vue` 中添加了以下调试日志：

### 1. **Props 监控** (第 145-157 行)

```javascript
watch(
  () => [props.canvasSources, props.canvasSourceMap],
  ([sources, sourceMap]) => {
    console.log('[VideoGrid] Props 更新:', {
      sourcesCount: sources.length,
      sources: sources.map(s => ({ id: s.id, name: s.name, type: s.type })),
      sourceMapKeys: Object.keys(sourceMap),
      sourceMap: sourceMap
    });
  },
  { deep: true, immediate: true }
);
```

**作用**: 监控 `canvasSources` 和 `canvasSourceMap` 的变化

---

### 2. **格子数量计算** (第 196 行)

```javascript
console.log(`[VideoGrid] 布局 ${layout} → 格子数量: ${count}`);
```

**作用**: 确认当前布局的格子数量是否正确

---

### 3. **信号源查找过程** (第 325-362 行)

```javascript
const getVideoSource = (index) => {
  const sourceMap = props.canvasSourceMap || {};

  const sourceId = sourceMap[index] ||
                   sourceMap[String(index)] ||
                   sourceMap[Number(index)];

  // 🔍 调试日志：检查信号源查找过程
  if (!sourceId) {
    console.warn(`[VideoGrid] 画布 ${index} 未找到信号源ID`, {
      index,
      canvasSourceMapKeys: Object.keys(sourceMap),
      canvasSourceMap: sourceMap
    });
    return null;
  }

  const source = props.canvasSources.find(s => s.id === sourceId);

  if (!source) {
    console.warn(`[VideoGrid] 画布 ${index} 找到信号源ID但未找到对象`, {
      index,
      sourceId,
      availableSources: props.canvasSources.map(s => ({ id: s.id, name: s.name, type: s.type }))
    });
  } else {
    console.log(`[VideoGrid] ✅ 画布 ${index} 成功获取信号源:`, {
      id: source.id,
      name: source.name,
      type: source.type,
      hasStream: !!source.stream,
      hasUrl: !!source.url
    });
  }

  return source || null;
};
```

**作用**: 详细记录信号源查找的每一步

---

## 📊 诊断步骤

### 步骤 1: 刷新页面并重新测试

1. **刷新浏览器**（Ctrl + F5）
2. **打开控制台**（F12 → Console 标签）
3. **拖拽一个信号源到画布 1**
4. **观察控制台输出**

---

### 步骤 2: 分析控制台日志

#### ✅ **正常情况应该看到**

```
[VideoGrid] Props 更新: {
  sourcesCount: 2,
  sources: [
    { id: "camera_xxx", name: "HD Webcam", type: "localDevice" },
    { id: "video_yyy", name: "测试视频.mp4", type: "localVideo" }
  ],
  sourceMapKeys: ["1"],
  sourceMap: { "1": "camera_xxx" }
}

[VideoGrid] 布局 1 → 格子数量: 1

[VideoGrid] ✅ 画布 1 成功获取信号源: {
  id: "camera_xxx",
  name: "HD Webcam",
  type: "localDevice",
  hasStream: true,
  hasUrl: false
}
```

#### ❌ **异常情况可能看到**

**情况 A: canvasSourceMap 为空**

```
[VideoGrid] Props 更新: {
  sourcesCount: 2,
  sources: [...],
  sourceMapKeys: [],  // ⚠️ 空数组
  sourceMap: {}       // ⚠️ 空对象
}

[VideoGrid] 画布 1 未找到信号源ID {
  index: 1,
  canvasSourceMapKeys: [],
  canvasSourceMap: {}
}
```

**原因**: `handleDropToCanvas` 没有正确更新 `canvasSourceMap`

**解决方案**: 检查 `useSourceDrag.js` 中的 `handleDropToCanvas` 函数

---

**情况 B: canvasSources 为空**

```
[VideoGrid] Props 更新: {
  sourcesCount: 0,  // ⚠️ 空数组
  sources: [],
  sourceMapKeys: ["1"],
  sourceMap: { "1": "camera_xxx" }
}

[VideoGrid] 画布 1 找到信号源ID但未找到对象 {
  index: 1,
  sourceId: "camera_xxx",
  availableSources: []  // ⚠️ 空数组
}
```

**原因**: `sourceStore.sources` 没有包含信号源

**解决方案**: 检查 `TeacherWindow.vue` 中 `sourceStore` 的初始化

---

**情况 C: 键类型不匹配**

```
[VideoGrid] Props 更新: {
  sourcesCount: 2,
  sources: [...],
  sourceMapKeys: ["1"],  // 字符串键
  sourceMap: { "1": "camera_xxx" }
}

[VideoGrid] 画布 1 未找到信号源ID {
  index: 1,  // 数字索引
  canvasSourceMapKeys: ["1"],
  canvasSourceMap: { "1": "camera_xxx" }
}
```

**原因**: `canvasSourceMap` 使用字符串键 `"1"`，但 `index` 是数字 `1`

**解决方案**: 代码已经处理了这种情况（尝试三种键类型），但如果仍然失败，需要统一键类型

---

### 步骤 3: 检查 DOM 结构

在浏览器开发者工具中：

1. **切换到 Elements 标签**
2. **搜索 `.video-item[data-index="1"]`**
3. **检查是否有 `<video-preview>` 组件**
4. **检查 `<video>` 元素的属性**:
   - `srcObject` 是否设置？
   - `src` 是否设置？
   - 是否有错误信息？

---

### 步骤 4: 检查 VideoPreview 组件

如果 `getVideoSource` 返回了正确的信号源，但画布仍然黑屏，问题可能在 `VideoPreview` 组件内部。

**检查点**:

1. `VideoPreview` 是否正确接收了 `video-source` prop？
2. `VideoPreview` 内部是否正确设置了 `<video>` 元素的 `srcObject` 或 `src`？
3. 是否有播放错误？

---

## 🎯 可能的修复方案

根据诊断结果，可能的修复方案：

### 方案 1: 修复 canvasSourceMap 更新逻辑

如果 `canvasSourceMap` 为空，检查 `useSourceDrag.js` 中的 `handleDropToCanvas` 函数：

```javascript
// 确保正确更新 canvasSourceMap
canvasSourceMap.value[index] = source.id;
```

---

### 方案 2: 修复 sourceStore 同步

如果 `canvasSources` 为空，检查 `TeacherWindow.vue` 中如何传递 `allSources`：

```vue
<VideoSection
  :all-sources="Array.from(sourceStore.sources.values())"
  ...
/>
```

确保 `sourceStore.sources` 包含拖拽的信号源。

---

### 方案 3: 统一键类型

如果键类型不匹配，统一使用字符串键：

```javascript
// 在 handleDropToCanvas 中
canvasSourceMap.value[String(index)] = source.id;

// 在 getVideoSource 中
const sourceId = sourceMap[String(index)];
```

---

## 📝 下一步行动

请按照以下步骤操作：

1. **刷新页面**（Ctrl + F5）
2. **拖拽信号源到画布**
3. **复制完整的控制台日志**（从 `[VideoGrid] Props 更新` 开始的所有相关日志）
4. **提供给我分析**

我会根据日志内容为您提供精确的修复方案！🚀

---

## 🔗 相关文件

- [VideoGrid.vue](file://f:\20260227\tauri-app\src\components\teacher-window\video\VideoGrid.vue) - 视频网格组件（已添加调试日志）
- [useSourceDrag.js](file://f:\20260227\tauri-app\src\composables\useSourceDrag.js) - 拖拽逻辑
- [TeacherWindow.vue](file://f:\20260227\tauri-app\src\components\TeacherWindow.vue) - 主窗口组件
- [VideoSection.vue](file://f:\20260227\tauri-app\src\components\teacher-window\layout\VideoSection.vue) - 视频区域组件
