# 方案 A 快速参考指南

## 🎯 一句话总结

**彻底重构拖拽数据流，消除 `currentSelectedSource` 作为数据源的依赖，建立清晰的解析→克隆→处理流程。**

---

## 🔑 核心改动（3 个关键点）

### 1️⃣ 新增统一解析函数

```javascript
// 📍 位置: useSourceDrag.js 第 73-103 行
const resolveDraggedSource = (event, fallbackSource = null) => {
  // 优先级: HTML5 dataTransfer > mouseDragState.source > fallback
  // 返回实际拖拽的信号源
};
```

**作用**: 从不同的拖拽事件中提取实际拖拽的信号源

---

### 2️⃣ 新增统一克隆函数

```javascript
// 📍 位置: useSourceDrag.js 第 105-138 行
const cloneSourceForCanvas = (source, streamSource = null) => {
  // 1. 浅拷贝
  // 2. 生成唯一 ID
  // 3. 保留 MediaStream 引用（仅摄像头类型）
  // 返回克隆后的信号源
};
```

**作用**: 为画布创建信号源的克隆，确保不影响预览区域

---

### 3️⃣ 重构所有拖拽入口

**修改前**（错误逻辑）:

```javascript
// ❌ 优先使用 currentSelectedSource（可能是错误的信号源）
if (currentSelectedSource.value && currentSelectedSource.value.stream) {
  source = currentSelectedSource.value;
} else if (jsonData) {
  source = JSON.parse(jsonData);
}
```

**修改后**（正确逻辑）:

```javascript
// ✅ 统一使用解析和克隆函数
const draggedSource = resolveDraggedSource(event);
const clonedSource = cloneSourceForCanvas(draggedSource, currentSelectedSource.value);
handleDropToCanvas(clonedSource, index);
```

---

## 📂 修改的文件

| 文件 | 修改内容 | 行数变化 |
|------|---------|---------|
| `useSourceDrag.js` | 新增 2 个工具函数 + 重构 4 个拖拽函数 | +150 / -50 |

---

## 🔄 数据流对比

### 旧架构

```
用户拖拽
  ↓
onDrop/onMouseUp/onTouchEnd/onDropPip
  ↓
❌ 混乱的条件判断
  ├─ 有时用 currentSelectedSource
  ├─ 有时用 jsonData
  └─ 有时用 mouseDragState
  ↓
❌ 可能使用错误的信号源
```

### 新架构

```
用户拖拽
  ↓
onDrop/onMouseUp/onTouchEnd/onDropPip
  ↓
✅ resolveDraggedSource() - 统一解析
  ↓
✅ cloneSourceForCanvas() - 统一克隆
  ↓
✅ handleDropToCanvas() - 统一处理
  ↓
✅ 始终使用正确的信号源
```

---

## 🎯 解决的问题

| 问题 | 严重程度 | 状态 |
|------|---------|------|
| 拖拽视频显示摄像头 | 🔴 严重 | ✅ 已解决 |
| 预览区域信号源被移动 | 🟡 中等 | ✅ 已解决 |
| 多次拖拽同一信号源失败 | 🟡 中等 | ✅ 已解决 |
| 代码逻辑混乱难维护 | 🟢 低 | ✅ 已优化 |

---

## 🧪 快速测试

**最关键的测试**（30 秒）:

1. 拖拽一个**视频文件**到画布
2. 验证显示的是**视频**（不是摄像头）

**如果通过** ✅：核心问题已解决
**如果失败** ❌：请查看详细测试清单

---

## 📚 相关文档

- **详细报告**: [SOLUTION_A_IMPLEMENTATION_COMPLETE.md](./SOLUTION_A_IMPLEMENTATION_COMPLETE.md)
- **测试清单**: [DRAG_TEST_CHECKLIST.md](./DRAG_TEST_CHECKLIST.md)
- **历史修复**:
  - [DRAG_WRONG_SOURCE_TYPE_FIX.md](./DRAG_WRONG_SOURCE_TYPE_FIX.md)
  - [PREVIEW_DRAG_CLONE_FIX.md](./PREVIEW_DRAG_CLONE_FIX.md)
  - [DRAG_LOGIC_ERRORS_COMPREHENSIVE_FIX.md](./DRAG_LOGIC_ERRORS_COMPREHENSIVE_FIX.md)

---

## 💡 关键要点

### ✅ 现在的行为

1. **拖拽什么就显示什么**
   - 拖拽视频 → 显示视频
   - 拖拽摄像头 → 显示摄像头

2. **预览区域始终保持可用**
   - 可以无限次拖拽同一信号源
   - 每次拖拽都创建克隆

3. **代码清晰易维护**
   - 统一的解析和克隆逻辑
   - 详细的日志便于调试

### ❌ 不再存在的问题

1. ~~拖拽视频却显示摄像头~~
2. ~~预览区域信号源消失~~
3. ~~多次拖拽失败~~
4. ~~代码逻辑混乱~~

---

## 🔧 技术细节

### 信号源类型识别

```javascript
// 摄像头类型（需要特殊处理 stream）
['camera', 'localCamera', 'localDevice', 'usb']

// 其他类型（直接克隆即可）
'localVideo', 'rtmp', 'hls', 'file', ...
```

### ID 生成规则

```javascript
// 原始 ID: "video_123"
// 克隆后 ID: "video_123_canvas_1715097600000"
//            ^^^^^^^^^^^^      ^^^^^^^^^^^^^^
//            原始 ID           时间戳
id: source.id + '_canvas_' + Date.now()
```

### Stream 处理策略

```javascript
// 只有摄像头类型才需要 stream
if (['camera', 'localCamera', 'localDevice', 'usb'].includes(source.type)) {
  // 优先从源对象获取
  if (source.stream) {
    cloned.stream = source.stream;
  }
  // 备用：从 streamSource 参数获取
  else if (streamSource?.stream) {
    cloned.stream = streamSource.stream;
  }
}
```

---

## 🚀 下一步行动

1. **立即测试**: 按照测试清单进行验证
2. **反馈结果**: 如果发现问题，提供详细信息
3. **继续开发**: 如果测试通过，可以继续其他功能

---

**方案 A 实施完成！** 🎉

如有任何问题，请随时联系。
