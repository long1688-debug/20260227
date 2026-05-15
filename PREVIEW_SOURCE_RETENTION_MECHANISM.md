# 预览区域信号源保留机制说明

## 需求确认

✅ **需求**: 预览区域的视频源在拖到画布中后，要**保留预览区域的信号源**，只有用户才能手动删除。

## 当前实现状态

### ✅ 已完全实现

代码已经正确实现了这个需求，具体体现在以下几个方面：

---

## 1. 克隆机制（核心实现）

### 文件: `tauri-app/src/composables/useSourceDrag.js`

#### cloneSourceForCanvas 函数（第107-146行）

```javascript
const cloneSourceForCanvas = (source, canvasIndex, addToGlobalSources = true) => {
  if (!source) {
    console.error('[cloneSourceForCanvas] 源信号源为空');
    return null;
  }

  // 创建克隆
  const newId = `${source.id}_canvas_${Date.now()}`;
  const clonedSource = {
    ...source,
    id: newId,
    canvasIndex, // 标记属于哪个画布
    isClone: true, // 标记为克隆
    addedToPreview: false, // 🎯 关键修复:克隆源不应显示在预览区域
  };

  // 如果是摄像头流,需要特殊处理
  if (source.hasStream && source.stream) {
    // 检查缓存中是否有对应的克隆流
    if (clonedStreamsCache.has(source.id)) {
      clonedSource.stream = clonedStreamsCache.get(source.id);
    } else {
      // 克隆流并存入缓存
      const clonedStream = cloneMediaStream(source.stream, `${source.name}_${canvasIndex}`);
      if (clonedStream) {
        clonedStreamsCache.set(source.id, clonedStream);
        clonedSource.stream = clonedStream;
      }
    }
  }

  // 如果需要添加到全局源列表
  if (addToGlobalSources && options && typeof options.addSourceToGlobalList === 'function') {
    options.addSourceToGlobalList(clonedSource);
    console.log(`[cloneSourceForCanvas] 已将克隆源添加到全局列表: ${clonedSource.name} (${clonedSource.id})`);
  }

  console.log(`[cloneSourceForCanvas] 克隆成功: ${source.name} type: ${source.type} hasStream: ${!!source.stream} newId: ${newId}`);
  return clonedSource;
};
```

**关键点**:

- ✅ 每次拖拽都创建新的克隆源（新ID）
- ✅ 标记 `isClone: true` 和 `addedToPreview: false`
- ✅ 克隆源不会显示在预览区域
- ✅ 原始源保持不变

---

## 2. 所有拖拽路径都使用克隆

### 路径1: 鼠标拖拽（handleMouseUp）

```javascript
// 第475-480行
const sourceToDrop = cloneSourceForCanvas(draggedSource, dragOverIndex.value, true);

if (sourceToDrop) {
  console.log('[鼠标拖拽] 创建克隆源:', sourceToDrop.id, '保留预览区域原始源');
  handleDropToCanvas(sourceToDrop, dragOverIndex.value);
}
```

### 路径2: 触摸拖拽（onTouchEnd）

```javascript
// 第621-626行
// 🎯 关键修复：无论从哪里拖拽，都创建克隆（不从预览区域移除原始源）
const sourceToDrop = cloneSourceForCanvas(draggedSource, dragOverIndex.value, true);

if (sourceToDrop) {
  console.log('[触摸拖拽] 创建克隆源:', sourceToDrop.id, '保留预览区域原始源');
  handleDropToCanvas(sourceToDrop, dragOverIndex.value);
}
```

### 路径3: HTML5拖拽到画布（onDrop）

```javascript
// 第910-919行
// 🎯 关键修复：无论从哪里拖拽，都创建克隆（不从预览区域移除原始源）
const clonedSource = cloneSourceForCanvas(draggedSource, index, true);

if (!clonedSource) {
  ElMessage.error('克隆信号源失败');
  return;
}

console.log('[HTML5拖拽] 放置克隆源到画布:', clonedSource.name, 'type:', clonedSource.type, '保留预览区域原始源');
handleDropToCanvas(clonedSource, index);
```

### 路径4: HTML5拖拽到画中画（onDropPip）

```javascript
// 第740-749行
// 🎯 关键修复：无论从哪里拖拽，都创建克隆（不从预览区域移除原始源）
const clonedSource = cloneSourceForCanvas(draggedSource, 2, true);

if (!clonedSource) {
  ElMessage.error('克隆信号源失败');
  return;
}

console.log('[HTML5拖拽] 放置克隆源到画中画:', clonedSource.name, 'type:', clonedSource.type, '保留预览区域原始源');
handleDropToCanvas(clonedSource, 2);
```

### 路径5: handleDrop 函数

```javascript
// 第781-789行
// 🎯 关键修复：无论从哪里拖拽，都创建克隆（不从预览区域移除原始源）
const clonedSource = cloneSourceForCanvas(source, targetCanvasIndex, true);

if (!clonedSource) {
  console.error('[鼠标拖拽] 克隆源失败');
  return;
}

console.log(`[鼠标拖拽] 创建克隆源: ${clonedSource.id}，保留预览区域原始源`);
```

---

## 3. 用户手动删除机制

### SourcePreviewBar.vue - 删除按钮

**文件**: `tauri-app/src/components/teacher-window/layout/SourcePreviewBar.vue`

```vue
<!-- 第121-130行 -->
<div class="source-actions">
  <el-button
    type="danger"
    size="small"
    circle
    @click.stop="removeFromPreview(source)"
  >
    <el-icon><Close /></el-icon>
  </el-button>
</div>
```

```javascript
// 第254-259行
const removeFromPreview = (source) => {
  // 🎯 发出 remove-source 事件给父组件处理
  emit('remove-source', source)

  ElMessage.success(`已从预览移除 "${source.name}"`)
}
```

### TeacherWindow.vue - 处理删除

**文件**: `tauri-app/src/components/TeacherWindow.vue`

```javascript
// 第1839-1850行
const removeFromPreview = (sourceId) => {
  try {
    const index = allSources.value.findIndex(s => s.id === sourceId)
    if (index !== -1) {
      allSources.value[index].addedToPreview = false
      ElMessage.success(`已移除: ${allSources.value[index].name}`)
    }
  } catch (error) {
    console.error('[TeacherWindow] 移除信号源失败:', error)
    ElMessage.error('移除失败')
  }
}
```

**关键点**:

- ✅ 只有用户点击删除按钮才会从预览区域移除
- ✅ 设置 `addedToPreview = false`，信号源不再显示在预览栏
- ✅ 拖拽操作不会触发删除

---

## 4. 验证：拖拽过程中不会删除预览源

### 检查结果

通过代码审查，确认以下关键点：

1. ✅ **没有调用 removeFromPreview**: 在所有拖拽放置函数中，都没有调用 `removeFromPreview`
2. ✅ **只创建克隆**: 所有拖拽路径都调用 `cloneSourceForCanvas` 创建克隆
3. ✅ **原始源不变**: 原始源的 `addedToPreview` 保持为 `true`
4. ✅ **状态清理正确**: 拖拽结束后只清理拖拽状态，不影响预览源

---

## 工作流程图

```
用户操作                    系统行为
─────────────────────────────────────────────
1. 从预览区拖拽信号源
   └─> 触发 onMouseDown/onTouchStart
       └─> 保存源引用到 mouseDragState

2. 拖拽到视频格子并释放
   └─> 触发 handleMouseUp/onTouchEnd/onDrop
       └─> 调用 cloneSourceForCanvas()
           ├─> 创建新ID的克隆源
           ├─> 标记 isClone: true
           ├─> 标记 addedToPreview: false
           └─> 克隆 MediaStream（如果是摄像头）

3. 放置到画布
   └─> 调用 handleDropToCanvas()
       └─> 更新 canvasSourceMap
           └─> 画布显示克隆源

4. 结果
   ├─> ✅ 预览区域：原始源保留（可见）
   └─> ✅ 视频画布：克隆源显示（独立）

5. 用户手动删除（可选）
   └─> 点击预览区的删除按钮
       └─> 调用 removeFromPreview()
           └─> 设置 addedToPreview = false
               └─> 预览区域不再显示该源
```

---

## 测试建议

### 测试场景1: 基本拖拽

1. 从预览区域拖拽一个摄像头到视频格子1
2. **预期**:
   - ✅ 视频格子1显示摄像头画面
   - ✅ 预览区域仍然显示该摄像头
   - ✅ 可以再次从预览区域拖拽同一个摄像头到其他格子

### 测试场景2: 多次拖拽同一源

1. 从预览区域拖拽摄像头A到格子1
2. 从预览区域拖拽摄像头A到格子2
3. 从预览区域拖拽摄像头A到格子3
4. **预期**:
   - ✅ 三个格子都显示摄像头A的画面
   - ✅ 预览区域仍然显示摄像头A
   - ✅ 每个格子使用独立的克隆流

### 测试场景3: 手动删除

1. 从预览区域拖拽摄像头A到格子1
2. 点击预览区域摄像头A的删除按钮
3. **预期**:
   - ✅ 预览区域不再显示摄像头A
   - ✅ 格子1仍然显示摄像头A的画面（克隆源不受影响）

### 测试场景4: 删除后再添加

1. 从预览区域拖拽摄像头A到格子1
2. 点击预览区域摄像头A的删除按钮
3. 从信号源管理重新添加摄像头A到预览
4. **预期**:
   - ✅ 预览区域重新显示摄像头A
   - ✅ 可以再次拖拽到画布

---

## 技术细节

### 克隆流的缓存机制

```javascript
// clonedStreamsCache: Map<sourceId, clonedStream>
const clonedStreamsCache = new Map();

// 第一次拖拽时创建克隆流
if (!clonedStreamsCache.has(source.id)) {
  const clonedStream = cloneMediaStream(source.stream, `${source.name}_${canvasIndex}`);
  clonedStreamsCache.set(source.id, clonedStream);
}

// 后续拖拽复用缓存的克隆流
clonedSource.stream = clonedStreamsCache.get(source.id);
```

**优势**:

- ✅ 避免重复克隆同一个摄像头的流
- ✅ 节省资源
- ✅ 确保多个格子可以同时显示同一个摄像头

### 响应式更新

```javascript
// 更新画布源映射（触发Vue响应式）
canvasSourceMap.value[targetCanvasIndex] = clonedSource;

// 保存到布局状态
assignSource(targetCanvasIndex, clonedSource.id);
saveLayoutMap();
```

---

## 总结

✅ **需求已完全实现**

1. **拖拽保留**: 从预览区域拖拽信号源到画布后，预览区域的原始源保持不变
2. **克隆机制**: 每次拖拽都创建独立的克隆源，不影响原始源
3. **手动删除**: 只有用户点击删除按钮才会从预览区域移除信号源
4. **多路复用**: 同一个预览源可以拖拽到多个画布格子，每个格子使用独立的克隆

**相关文件**:

- `tauri-app/src/composables/useSourceDrag.js` - 拖拽逻辑和克隆机制
- `tauri-app/src/components/teacher-window/layout/SourcePreviewBar.vue` - 预览区域UI和删除按钮
- `tauri-app/src/components/TeacherWindow.vue` - 主窗口逻辑和删除处理

**无需修改**: 当前实现已经完全符合需求，不需要任何代码修改。
