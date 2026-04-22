# 拖拽信号源类型错误修复报告

## 问题描述

### 用户报告

**"问题是拖曳的是视频信号，怎么变成摄像头画面了？"**

### 问题表现

- **预览区域**: 左侧是摄像头，右侧是视频文件（汽车实训视频）
- **主画布**: 两个格子都显示**摄像头画面**，而不是视频文件！
- 用户拖拽的是视频文件，但画布显示的是摄像头

### 根本原因

在 `useSourceDrag.js` 的 `onDrop` 函数（HTML5 拖拽）中，存在**严重的逻辑错误**：

```javascript
//  错误的逻辑（修复前）
} else if (jsonData) {
  try {
    let source;

    // 错误：优先使用 currentSelectedSource（当前选中的信号源）
    if (currentSelectedSource.value && currentSelectedSource.value.stream) {
      console.log('[HTML5拖拽] 使用 currentSelectedSource（包含完整stream）:', currentSelectedSource.value.name);
      source = currentSelectedSource.value;  // ❌ 这是摄像头！
    } else {
      // 备用方案：从 JSON 解析（这才是实际拖拽的信号源）
      console.log('[HTML5拖拽] 从 JSON 解析源数据（不包含stream）');
      source = JSON.parse(jsonData);  // ✅ 这是视频文件！
    }

    handleDropToCanvas(source, index);
  }
```

**问题所在**:

1. `jsonData` 包含**实际拖拽的信号源**（视频文件）
2. `currentSelectedSource.value` 是**当前选中的信号源**（摄像头）
3. 代码**错误地优先使用了 `currentSelectedSource.value`**
4. 结果：无论拖拽什么，都克隆了摄像头！

---

## 修复方案

### 核心逻辑修正

**修复后的正确逻辑**：

```javascript
// ✅ 正确的逻辑（修复后）
} else if (jsonData) {
  try {
    // 1. 优先从 JSON 解析实际拖拽的信号源
    const parsedSource = JSON.parse(jsonData);
    console.log('[HTML5拖拽] 从 JSON 解析拖拽的信号源:', parsedSource.name, 'type:', parsedSource.type);

    // 2. 创建克隆，避免影响预览区域
    source = {
      ...parsedSource,
      id: parsedSource.id + '_canvas_' + Date.now()
    };

    // 3. 如果是摄像头类型，需要从 currentSelectedSource 获取 stream
    if (['camera', 'localCamera', 'localDevice', 'usb'].includes(parsedSource.type)) {
      if (currentSelectedSource.value && currentSelectedSource.value.stream) {
        source.stream = currentSelectedSource.value.stream;
        console.log('[HTML5拖拽] 从 currentSelectedSource 获取 stream');
      }
    }

    console.log('[HTML5拖拽] 克隆成功:', source.name, 'hasStream:', !!source.stream);
    handleDropToCanvas(source, index);
  }
```

### 关键改进点

1. **优先使用 `jsonData`**
   - `jsonData` 是实际拖拽的信号源（通过 `JSON.stringify(source)` 序列化）
   - 这是**唯一正确的数据源**

2. **`currentSelectedSource.value` 的作用**
   - 仅用于获取 `stream` 引用（摄像头类型需要）
   - **不再作为信号源数据的主要来源**

3. **信号源类型判断**
   - 只有摄像头类型（`camera`, `localCamera`, `localDevice`, `usb`）才需要从 `currentSelectedSource` 获取 stream
   - 视频文件、文档等类型不需要 stream

---

## 修改的文件

### `useSourceDrag.js` - HTML5 拖拽 onDrop 函数

**位置**: 第 888-912 行

**修改前（错误逻辑）**:

```javascript
} else if (jsonData) {
  try {
    // 错误：优先使用 currentSelectedSource
    if (currentSelectedSource.value && currentSelectedSource.value.stream) {
      source = {
        ...currentSelectedSource.value,  // ❌ 使用了摄像头
        stream: currentSelectedSource.value.stream,
        id: currentSelectedSource.value.id + '_canvas_' + Date.now()
      };
    } else if (jsonData) {
      // 备用：从 JSON 解析
      source = JSON.parse(jsonData);
      source.id = source.id + '_canvas_' + Date.now();
    }

    handleDropToCanvas(source, index);
  }
```

**修改后（正确逻辑）**:

```javascript
} else if (jsonData) {
  try {
    // 1. 优先从 JSON 解析实际拖拽的信号源
    const parsedSource = JSON.parse(jsonData);
    console.log('[HTML5拖拽] 从 JSON 解析拖拽的信号源:', parsedSource.name, 'type:', parsedSource.type);

    // 2. 创建克隆，避免影响预览区域
    source = {
      ...parsedSource,
      id: parsedSource.id + '_canvas_' + Date.now()
    };

    // 3. 如果是摄像头类型，需要从 currentSelectedSource 获取 stream
    if (['camera', 'localCamera', 'localDevice', 'usb'].includes(parsedSource.type)) {
      if (currentSelectedSource.value && currentSelectedSource.value.stream) {
        source.stream = currentSelectedSource.value.stream;
        console.log('[HTML5拖拽] 从 currentSelectedSource 获取 stream');
      }
    }

    console.log('[HTML5拖拽] 克隆成功:', source.name, 'hasStream:', !!source.stream);
    handleDropToCanvas(source, index);
  }
```

---

## 修复效果对比

### 修复前（错误）

```
预览区域:
  - 摄像头A (currentSelectedSource)
  - 视频文件B (实际拖拽)

用户操作: 拖拽视频文件B
  ↓
代码逻辑: 使用 currentSelectedSource（摄像头A）
  ↓
结果: 画布显示摄像头A ❌
```

**问题**:

- ❌ 拖拽视频，显示摄像头
- ❌ 逻辑错误：使用了错误的数据源
- ❌ 用户体验极差

### 修复后（正确）

```
预览区域:
  - 摄像头A (currentSelectedSource)
  - 视频文件B (实际拖拽)

用户操作: 拖拽视频文件B
  ↓
代码逻辑: 从 jsonData 解析视频文件B，创建克隆
  ↓
结果: 画布显示视频文件B ✅
```

**改进**:

- ✅ 拖拽什么显示什么
- ✅ 逻辑正确：使用实际拖拽的数据源
- ✅ 用户体验正常

---

## 技术细节

### JSON 数据流

**SourcePreviewBar.vue** (拖拽起点):

```javascript
const onDragStart = (event, source) => {
  event.dataTransfer.setData('sourceType', source.type);
  event.dataTransfer.setData('sourceId', source.id);
  event.dataTransfer.setData('application/json', JSON.stringify(source));
  // ...
}
```

**useSourceDrag.js** (拖拽终点):

```javascript
const onDrop = async (event, index) => {
  const jsonData = event.dataTransfer.getData('application/json');
  const parsedSource = JSON.parse(jsonData);  // ✅ 实际拖拽的信号源
  // ...
}
```

### stream 引用的特殊处理

**为什么摄像头需要特殊处理？**

```javascript
// 视频文件不需要 stream
{
  id: 'video_123',
  type: 'localVideo',
  name: 'test.mp4',
  url: 'blob:...'
}

// 摄像头需要 stream
{
  id: 'cam_456',
  type: 'localCamera',
  name: 'HD Webcam',
  stream: MediaStream { id: 'xxx', ... }  // ⚠️ MediaStream 不能通过 JSON 序列化
}
```

**MediaStream 无法序列化**:

- `JSON.stringify()` 会丢失 `stream` 属性
- 所以 `jsonData` 中的摄像头信号源没有 `stream`
- 需要从 `currentSelectedSource.value.stream` 获取

**修复逻辑**:

```javascript
// 1. 从 jsonData 解析信号源（没有 stream）
const parsedSource = JSON.parse(jsonData);

// 2. 创建克隆
source = { ...parsedSource, id: parsedSource.id + '_canvas_' + Date.now() };

// 3. 如果是摄像头类型，补充 stream
if (['camera', 'localCamera', 'localDevice', 'usb'].includes(parsedSource.type)) {
  source.stream = currentSelectedSource.value.stream;
}
```

---

## 测试建议

### 1. 视频文件拖拽测试

- [ ] 从预览区域拖拽视频文件到画布格子1
- [ ] 验证画布显示的是视频文件，而不是摄像头
- [ ] 验证视频可以正常播放

### 2. 摄像头拖拽测试

- [ ] 从预览区域拖拽摄像头到画布格子1
- [ ] 验证画布显示的是摄像头画面
- [ ] 验证摄像头 stream 正常工作

### 3. 混合拖拽测试

- [ ] 拖拽摄像头到格子1
- [ ] 拖拽视频文件到格子2
- [ ] 验证两个格子显示不同的内容
- [ ] 验证预览区域的信号源都保持不变

### 4. 多次拖拽测试

- [ ] 拖拽视频文件到格子1
- [ ] 再次拖拽同一视频文件到格子2
- [ ] 验证两个格子都显示视频文件
- [ ] 验证预览区域的视频文件仍然存在

---

## 相关文件清单

### 核心修改

- ✅ `f:\20260227\tauri-app\src\composables\useSourceDrag.js` (第 888-912 行)

### 相关文件（无需修改）

- ✅ `f:\20260227\tauri-app\src\components\teacher-window\layout\SourcePreviewBar.vue` - 拖拽数据序列化逻辑正确
- ✅ `f:\20260227\tauri-app\src\components\TeacherWindow.vue` - 信号源创建逻辑正确

---

## 总结

本次修复解决了一个**严重的逻辑错误**：拖拽视频文件却显示摄像头画面。

### 错误原因

- **错误地优先使用了 `currentSelectedSource.value`**
- **忽略了 `jsonData` 中的实际拖拽信号源**

### 修复方案

- **优先从 `jsonData` 解析实际拖拽的信号源**
- **仅在摄像头类型时从 `currentSelectedSource` 获取 stream**

### 修复效果

- ✅ 拖拽什么显示什么
- ✅ 视频文件正常显示
- ✅ 摄像头正常显示
- ✅ 预览区域信号源保持不变

这是一个**关键的逻辑修复**，确保了拖拽功能的正确性。

---

**修复日期**: 2026-05-07
**修复人员**: AI Assistant
**验证状态**: 待用户测试确认
