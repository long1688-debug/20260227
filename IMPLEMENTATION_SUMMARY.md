# 信号源拖拽到分屏保存功能实现总结

## 概述

根据参考文档，已实现信号源拖拽到分屏并保存状态的功能。该实现参考了 RenderCanvas 架构设计，确保布局切换时信号源状态能够正确保留。

## 核心架构实现

### 1. 布局与信号源分离架构 ✅

**文件**: `useLayoutStates.js`

```
RenderCanvas (画布)
    ├── layouts (map<string, RenderLayout>)  ← 多个布局对象
    │     ├─ layout_1 (单画面)
    │     ├─ layout_2 (双画面)
    │     ├─ layout_4 (四分屏)
    │     └─ ... (最多49分屏 + 4种特殊布局)
    │
    └─ curLayout (当前激活的布局ID)
```

**关键点**:
- ✅ 每个 Layout 独立存储：所有布局对象同时存在于内存中
- ✅ 切换只是改变指针：`switchLayout()` 只改变 `currentLayout` 变量
- ✅ 不销毁旧布局：切换时不会删除或清空任何布局
- ✅ 独立 `slots` 数组：每个 Layout 有自己的信号源映射

### 2. RenderBox 的信号源绑定机制 ✅

**文件**: `useSourceDrag.js`

```javascript
// 信号源绑定到指定槽位（Box）
const handleDropToCanvas = (source, index) => {
  // 保存信号源ID到对应格子的 refId
  canvasSourceMap.value = {
    ...canvasSourceMap.value,
    [index]: source.id  // ⭐ 保存引用ID（refId 持久化）
  };
  
  // 同步保存到 layoutStates
  if (typeof assignSource === 'function') {
    assignSource(index, source.id);
  }
}
```

**关键设计**:
- ✅ refId 持久化：每个格子记住自己绑定的信号源 ID
- ✅ 支持三种拖拽场景：
  - 场景A：网格内交换位置
  - 场景B：网格内移动到空位
  - 场景C：外部资源库覆盖（从预览区域拖拽）
- ✅ 摄像头流克隆：支持同一摄像头在多个格子上显示

### 3. 布局切换流程 ✅

**文件**: `useVideoSync.js`

```javascript
const changeLayout = (layout) => {
  // 步骤1：保存当前布局的信号源状态
  if (oldLayout && oldLayout !== layout) {
    Object.entries(slotsToSave).forEach(([slotIndex, sourceId]) => {
      layoutStates[oldLayout].slots[slotIndex] = sourceId;
    });
  }
  
  // 步骤2：从新布局的独立存储恢复信号源
  const savedSlots = layoutStates[layout]?.slots || {};
  Object.entries(savedSlots).forEach(([slotIndex, sourceId]) => {
    if (sourceId && newValidIndices.has(parseInt(slotIndex))) {
      newMap[slotIndex] = sourceId;  // ⭐ 按原始索引恢复
    }
  });
  
  // 步骤3：更新当前布局指针
  currentLayout.value = layout;
}
```

**执行过程**:
1. 保存当前布局状态到 `layoutStates[oldLayout].slots`
2. 从 `layoutStates[newLayout].slots` 恢复信号源
3. 只恢复在新布局有效范围内的信号源
4. 更新 `currentLayout` 指针
5. 触发 UI 重绘，画面立即恢复显示

### 4. 拖拽信号保留机制 ✅

**保留原理**:

```
布局A (四分屏)                    布局B (九分屏)
┌─────┬─────┐                   ┌───┬───┬───┐
│Cam1 │Cam2 │  ← Box[0].refId   │   │   │   │
│     │     │     = "camera_1"  ├───┼───┼───┤
├─────┼─────┤                   │   │   │   │
│Cam3 │Cam4 │  ← Box[1].refId   ├───┼───┼───┤
│     │     │     = "camera_2"  │   │   │   │
└─────┴─────┘                   └───┴───┴───┘

切换到布局B → 切回布局A
✅ Cam1、Cam2、Cam3、Cam4 全部保留！
```

### 5. 画面正常显示机制 ✅

**文件**: `VideoGrid.vue`

```javascript
// 获取视频源（参考 RenderBox::draw）
const getVideoSource = (index) => {
  const sourceId = sourceMap[index] || 
                   sourceMap[String(index)] || 
                   sourceMap[Number(index)];
  if (!sourceId) return null;
  
  const source = props.canvasSources.find(s => s.id === sourceId);
  return source || null;  // ⭐ 直接返回绑定的信号源
};
```

**显示保证**:
- ✅ 实时渲染：每次绘制都获取最新信号源
- ✅ 自动更新：响应式数据绑定自动刷新
- ✅ 文档支持：PPT、Word、PDF、Excel、TXT、图片等

### 6. 持久化存储 ✅

**文件**: `useLayoutStates.js`

```javascript
// 保存布局状态到 localStorage
const saveToStorage = () => {
  const data = {};
  Object.keys(layoutStates).forEach(layout => {
    data[layout] = {
      slots: layoutStates[layout].slots,
      maximizedIndex: layoutStates[layout].maximizedIndex
    };
  });
  localStorage.setItem("video_wall_layout_states", JSON.stringify(data));
};

// 从 localStorage 加载布局状态
const loadFromStorage = () => {
  const saved = localStorage.getItem("video_wall_layout_states");
  if (saved) {
    const parsed = JSON.parse(saved);
    // 恢复到 layoutStates
  }
};
```

## 完整工作流程

```
用户操作                          系统响应
─────────                         ─────────

1. 选择"4分屏"布局
       ↓
   changeLayout(4)
       ↓
   currentLayout = 4
       ↓
   从 layoutStates[4].slots 恢复信号源
       ↓
   UI重绘，显示4个格子

2. 拖拽"摄像头1"到左上角格子
       ↓
   handleDropToCanvas(camera1, 1)
       ↓
   canvasSourceMap[1] = "camera_1"  ⭐ 持久化
       ↓
   layoutStates[4].slots[1] = "camera_1"
       ↓
   画面开始显示

3. 拖拽"视频文件"到右下角格子
       ↓
   canvasSourceMap[4] = "video_1"  ⭐ 持久化
       ↓
   画面开始显示

4. 切换到"9分屏"布局
       ↓
   changeLayout(7)
       ↓
   保存 layoutStates[4].slots
       ↓
   从 layoutStates[7].slots 恢复
       ↓
   显示9个格子
       ↓
   ⭐ layout_4 的所有信号源状态保留在内存中

5. 切换回"4分屏"布局
       ↓
   changeLayout(4)
       ↓
   currentLayout = 4
       ↓
   ⭐ canvasSourceMap[1] 仍然是 "camera_1"
   ⭐ canvasSourceMap[4] 仍然是 "video_1"
       ↓
   画面立即恢复显示！
```

## 关键技术总结

| 技术点 | 实现方式 | 作用 |
|--------|----------|------|
| 布局持久化 | `layoutStates` 对象存储所有布局 | 切换不销毁 |
| 信号源绑定 | `canvasSourceMap[index] = sourceId` | 记住绑定关系 |
| 独立状态 | 每个 Layout 有独立的 slots 对象 | 互不干扰 |
| 实时渲染 | `getVideoSource(index)` 获取最新源 | 画面流畅 |
| 持久化存储 | localStorage 保存/加载 | 页面刷新后保留 |
| 响应式更新 | Vue 3 reactive/ref | 自动刷新 UI |

## 为什么能实现"切换保留"？

**核心原因**:

1. **布局对象不销毁**：所有 Layout 对象一直存在于 `layoutStates` 中
2. **Box 状态持久化**：每个格子的信号源 ID 永久保存在 `slots` 中
3. **切换只是换指针**：`changeLayout()` 只改变 `currentLayout`，不做任何清理
4. **独立存储**：每个布局的 `slots` 完全独立，物理隔离

## 文件修改记录

1. **`useVideoSync.js`**: 优化 `changeLayout` 函数，移除智能映射，改为直接按原始索引恢复信号源
2. **`useSourceDrag.js`**: 添加详细的 RenderBox 信号源绑定机制注释
3. **`useLayoutStates.js`**: 添加 RenderCanvas 架构说明注释
4. **`VideoGrid.vue`**: 添加画面显示机制注释

## 测试建议

1. **拖拽测试**：从预览区域拖拽信号源到不同格子
2. **布局切换测试**：切换不同分屏布局，验证信号源是否正确保留
3. **持久化测试**：刷新页面，验证布局状态是否从 localStorage 恢复
4. **摄像头测试**：拖拽摄像头到多个格子，验证流克隆是否正常工作
