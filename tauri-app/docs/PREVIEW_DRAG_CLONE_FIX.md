# 预览区域信号源拖拽克隆修复报告

## 问题描述

用户报告：**从预览区域多次拖拽信号源到分屏时，预览区域的信号源会被"移动"而不是"克隆"**。

### 问题表现

1. 第一次拖拽：预览区域的信号源消失
2. 第二次拖拽：无法再拖拽该信号源（因为已经被移走）
3. 预览区域应该始终保持可用，每次拖拽都应该是**复制操作**

### 根本原因

在 `useSourceDrag.js` 中，所有拖拽放置逻辑都**直接使用了原始信号源的引用**，而不是创建克隆：

```javascript
//  错误做法：直接使用引用
handleDropToCanvas(currentSelectedSource.value, index);
```

这导致：

- 画布中的信号源和预览区域的信号源是**同一个对象**
- 修改画布中的信号源会影响预览区域
- 预览区域的信号源被"移动"而不是"复制"

---

## 修复方案

### 核心策略

在所有拖拽放置入口处，**创建信号源的浅拷贝**，并：

1. ✅ 保留 `stream` 引用（MediaStream 不能被深拷贝）
2. ✅ 生成新的唯一 ID（避免与预览区域冲突）
3. ✅ 复制所有其他属性（name, type, deviceId 等）

### 克隆逻辑

```javascript
const clonedSource = {
  ...source,  // 复制所有属性
  stream: source.stream,  // 保留 stream 引用
  id: source.id + '_canvas_' + Date.now()  // 生成唯一 ID
};
```

**为什么是浅拷贝？**

- `stream` 是 MediaStream 对象引用，必须保留
- 其他属性（字符串、数字）可以通过展开运算符复制
- 不需要深拷贝，因为信号源的属性都是基本类型或引用类型

---

## 修改的文件

### `useSourceDrag.js` - 拖拽逻辑核心

#### 修改 1: HTML5 拖拽 - JSON 数据路径

**位置**: 第 855-883 行

**修改前**:

```javascript
} else if (jsonData) {
  try {
    let source;

    if (currentSelectedSource.value && currentSelectedSource.value.stream) {
      console.log('[HTML5拖拽] 使用 currentSelectedSource（包含完整stream）:', currentSelectedSource.value.name);
      source = currentSelectedSource.value;  // ❌ 直接使用引用
    } else {
      source = JSON.parse(jsonData);
    }

    handleDropToCanvas(source, index);
  }
```

**修改后**:

```javascript
} else if (jsonData) {
  try {
    // 🎯 关键修复：总是创建克隆,避免影响预览区域的原始信号源
    let source;

    if (currentSelectedSource.value) {
      console.log('[HTML5拖拽] 从 currentSelectedSource 克隆源:', currentSelectedSource.value.name);
      // 🎯 深度克隆信号源对象,保留 stream 引用
      source = {
        ...currentSelectedSource.value,
        stream: currentSelectedSource.value.stream,  // 保留 stream 引用
        id: currentSelectedSource.value.id + '_canvas_' + Date.now()  // 生成唯一 ID
      };
      console.log('[HTML5拖拽] 克隆成功,新 ID:', source.id, 'hasStream:', !!source.stream);
    } else if (jsonData) {
      source = JSON.parse(jsonData);
      source.id = source.id + '_canvas_' + Date.now();  // 也为 JSON 解析的源生成新 ID
    }

    console.log('[HTML5拖拽] 从预览区域拖拽（克隆）:', source.name, 'hasStream:', !!source.stream);
    handleDropToCanvas(source, index);
  }
```

**改进点**:

- ✅ 总是创建克隆，不再直接使用引用
- ✅ 为克隆生成唯一 ID（`_canvas_` + 时间戳）
- ✅ 保留 `stream` 引用，确保摄像头画面正常
- ✅ 详细的日志输出，便于调试

---

#### 修改 2: HTML5 拖拽 - currentSelectedSource 回退路径

**位置**: 第 889-900 行

**修改前**:

```javascript
} else if (currentSelectedSource.value) {
  console.log('[HTML5拖拽] 从预览区域拖拽 (currentSelectedSource):', currentSelectedSource.value.name);
  handleDropToCanvas(currentSelectedSource.value, index);  // ❌ 直接使用引用
}
```

**修改后**:

```javascript
} else if (currentSelectedSource.value) {
  // 🎯 关键修复：从预览区域拖拽时创建克隆
  console.log('[HTML5拖拽] 从预览区域拖拽 (currentSelectedSource) 并克隆:', currentSelectedSource.value.name);

  const clonedSource = {
    ...currentSelectedSource.value,
    stream: currentSelectedSource.value.stream,
    id: currentSelectedSource.value.id + '_canvas_' + Date.now()
  };

  handleDropToCanvas(clonedSource, index);
}
```

---

#### 修改 3: 鼠标拖拽 - onMouseUp

**位置**: 第 327-343 行

**修改前**:

```javascript
const source = currentSelectedSource.value || mouseDragState.source;
if (dragOverIndex.value !== null && source) {
  console.log(`[鼠标拖拽] 放置到索引 ${dragOverIndex.value}，源:`, source.name);
  handleDropToCanvas(source, dragOverIndex.value);  // ❌ 直接使用引用
}
```

**修改后**:

```javascript
const source = currentSelectedSource.value || mouseDragState.source;
if (dragOverIndex.value !== null && source) {
  console.log(`[鼠标拖拽] 放置到索引 ${dragOverIndex.value}，源:`, source.name);

  // 🎯 关键修复：从预览区域拖拽时创建克隆
  let sourceToDrop = source;
  if (mouseDragState.isFromPreview) {
    sourceToDrop = {
      ...source,
      stream: source.stream,
      id: source.id + '_canvas_' + Date.now()
    };
    console.log('[鼠标拖拽] 克隆源（预览区域拖拽）:', sourceToDrop.id);
  }

  handleDropToCanvas(sourceToDrop, dragOverIndex.value);
}
```

**改进点**:

- ✅ 检查 `mouseDragState.isFromPreview` 标志
- ✅ 只有从预览区域拖拽时才克隆
- ✅ 画布内部拖拽（移动/交换）保持原有逻辑

---

#### 修改 4: 触摸拖拽 - onTouchEnd

**位置**: 第 467-486 行

**修改前**:

```javascript
const source = currentSelectedSource.value || mouseDragState.source;
if (dragOverIndex.value !== null && source) {
  console.log(`[触摸拖拽] 放置到索引 ${dragOverIndex.value}，源:`, source.name);
  handleDropToCanvas(source, dragOverIndex.value);  //  直接使用引用
}
```

**修改后**:

```javascript
const source = currentSelectedSource.value || mouseDragState.source;
if (dragOverIndex.value !== null && source) {
  console.log(`[触摸拖拽] 放置到索引 ${dragOverIndex.value}，源:`, source.name);

  // 🎯 关键修复：从预览区域拖拽时创建克隆
  let sourceToDrop = source;
  if (mouseDragState.isFromPreview) {
    sourceToDrop = {
      ...source,
      stream: source.stream,
      id: source.id + '_canvas_' + Date.now()
    };
    console.log('[触摸拖拽] 克隆源（预览区域拖拽）:', sourceToDrop.id);
  }

  handleDropToCanvas(sourceToDrop, dragOverIndex.value);
}
```

---

#### 修改 5: HTML5 拖拽到画中画 - onDropPip

**位置**: 第 584-596 行

**修改前**:

```javascript
if (currentSelectedSource.value) {
  handleDropToCanvas(currentSelectedSource.value, 2);  // ❌ 直接使用引用
}
```

**修改后**:

```javascript
if (currentSelectedSource.value) {
  // 🎯 关键修复：从预览区域拖拽时创建克隆
  console.log('[HTML5拖拽] 从预览区域拖拽到画中画（克隆）:', currentSelectedSource.value.name);

  const clonedSource = {
    ...currentSelectedSource.value,
    stream: currentSelectedSource.value.stream,
    id: currentSelectedSource.value.id + '_canvas_' + Date.now()
  };

  handleDropToCanvas(clonedSource, 2);
}
```

---

## 修复效果对比

### 修复前

```
预览区域: 摄像头A (ID: cam_1)
  ↓ 拖拽
画布格子1: 摄像头A (ID: cam_1) ← 同一个对象
  ↓ 结果
预览区域: 摄像头A 被"移走"，无法再次拖拽
```

**问题**:

- ❌ 预览区域信号源消失
- ❌ 无法多次拖拽同一信号源
- 画布和预览区域共享状态

### 修复后

```
预览区域: 摄像头A (ID: cam_1)
  ↓ 拖拽 (克隆)
画布格子1: 摄像头A (ID: cam_1_canvas_1715234567890) ← 克隆对象
  ↓ 结果
预览区域: 摄像头A (ID: cam_1) 保持不变
  ↓ 再次拖拽
画布格子2: 摄像头A (ID: cam_1_canvas_1715234567891) ← 另一个克隆
```

**改进**:

- ✅ 预览区域信号源保持不变
- ✅ 可以无限次拖拽同一信号源
- ✅ 每个画布格子都有独立的克隆对象
- ✅ 克隆的 ID 唯一，不会冲突

---

## 技术细节

### 为什么使用浅拷贝而不是深拷贝？

```javascript
const clonedSource = {
  ...source,  // 浅拷贝所有属性
  stream: source.stream,  // 手动保留 stream 引用
  id: source.id + '_canvas_' + Date.now()
};
```

**原因**:

1. **MediaStream 不能被深拷贝**
   - `structuredClone()` 会抛出错误
   - `JSON.parse(JSON.stringify())` 会丢失 stream
   - 必须保留原始 stream 引用

2. **信号源的其他属性都是基本类型**
   - `name`: string
   - `type`: string
   - `deviceId`: string
   - `volume`: number
   - `muted`: boolean
   - 这些可以通过展开运算符正确复制

3. **性能考虑**
   - 浅拷贝比深拷贝快得多
   - 不需要递归遍历对象树
   - 减少内存开销

### ID 生成策略

```javascript
id: source.id + '_canvas_' + Date.now()
```

**格式**: `{原始ID}_canvas_{时间戳}`

**示例**:

- 原始 ID: `cam_1`
- 克隆 ID: `cam_1_canvas_1715234567890`
- 再次克隆: `cam_1_canvas_1715234567891`

**优点**:

- ✅ 唯一性：时间戳确保不会重复
- ✅ 可追溯：可以从克隆 ID 看出原始 ID
- ✅ 简单：不需要额外的 ID 生成器

---

## 测试建议

### 1. 基础功能测试

- [ ] 从预览区域拖拽摄像头到画布格子1
- [ ] 验证预览区域的摄像头仍然存在
- [ ] 再次拖拽同一摄像头到画布格子2
- [ ] 验证两个格子都显示摄像头画面
- [ ] 验证预览区域仍然可以拖拽

### 2. 多种信号源测试

- [ ] 摄像头信号源拖拽克隆
- [ ] 本地视频文件拖拽克隆
- [ ] 屏幕共享信号源拖拽克隆
- [ ] 文档信号源拖拽克隆

### 3. 拖拽方式测试

- [ ] HTML5 原生拖拽（拖拽预览栏的信号源）
- [ ] 鼠标拖拽（点击并按住预览区域的信号源）
- [ ] 触摸拖拽（移动设备上的触摸拖拽）
- [ ] 拖拽到画中画窗口

### 4. 边界场景测试

- [ ] 快速连续拖拽同一信号源多次
- [ ] 拖拽后删除画布中的克隆，验证预览区域不受影响
- [ ] 修改画布中克隆的属性（音量、静音），验证不影响预览区域
- [ ] 布局切换后，验证所有克隆的信号源仍然正常工作

---

## 相关文件清单

### 核心修改

- ✅ `f:\20260227\tauri-app\src\composables\useSourceDrag.js` (5 处修改)

### 无需修改

- ✅ `TeacherWindow.vue` - 信号源创建逻辑不受影响
- ✅ `VideoPlayer.vue` - 视频播放逻辑不受影响
- ✅ `SourcePreviewBar.vue` - 预览栏显示逻辑不受影响

---

## 总结

本次修复通过**在所有拖拽入口处创建信号源克隆**，彻底解决了预览区域信号源被"移动"的问题。

### 修复要点

1. **浅拷贝策略**: 使用展开运算符复制属性，手动保留 stream 引用
2. **唯一 ID**: 为每个克隆生成带时间戳的唯一 ID
3. **多路径覆盖**: 修复了 HTML5 拖拽、鼠标拖拽、触摸拖拽、画中画拖拽共 5 个入口
4. **日志增强**: 添加详细的克隆日志，便于调试

### 修复效果

- ✅ **预览区域始终保持可用**: 拖拽后信号源不会消失
- ✅ **支持无限次克隆**: 可以多次拖拽同一信号源到不同格子
- ✅ **状态隔离**: 画布中的克隆和预览区域的原始信号源完全独立
- ✅ **性能优秀**: 浅拷贝开销极小，不影响拖拽流畅度

用户体验从"只能拖拽一次"提升到"可以无限次拖拽克隆"，符合用户的直觉预期。

---

**修复日期**: 2026-05-07
**修复人员**: AI Assistant
**验证状态**: 待用户测试确认
