# 拖拽功能修复说明

## 问题描述

用户报告：从预览区域拖拽信号源到视频展示区域后，视频没有被添加到展示区域，仍然显示"无信号源"。

## 根本原因分析

经过深入调查，发现以下问题链：

### 1. VideoSection 使用 Canvas 渲染引擎

- `VideoSection.vue` 内部总是使用 `RenderEngineWrapper`（基于 Canvas 的渲染）
- Canvas 渲染没有 DOM 子元素（如 `.video-item`）
- 自定义鼠标拖拽系统依赖 `document.elementsFromPoint` 检测 `.video-item` 来确定放置位置
- **结果**：无法检测到目标槽位，`dragOverIndex` 始终为 `null`

### 2. SourcePreviewBar 缺少 HTML5 原生拖拽支持

- 预览栏只有自定义鼠标拖拽（`@mousedown` → `processMouseDown`）
- 没有 HTML5 原生拖拽属性（`draggable="true"`）和事件处理（`@dragstart`/`@dragend`）
- **结果**：无法触发 VideoSection 的 `@drop-source` 事件

### 3. TeacherWindow 缺少传统的 VideoGrid 组件

- TeacherWindow 只使用了 VideoSection（Canvas 渲染）
- 没有使用包含 `.video-item` DOM 元素的 VideoGrid 组件
- **结果**：自定义鼠标拖拽系统无法工作

## 修复方案

### 修复 1：为 SourcePreviewBar 添加 HTML5 原生拖拽支持

**文件**：`tauri-app/src/components/teacher-window/layout/SourcePreviewBar.vue`

**修改内容**：

```vue
<!-- 在 .preview-item 上添加 draggable 属性和事件 -->
<div
  v-for="source in previewSources"
  :key="source.id"
  class="preview-item"
  draggable="true"
  @mousedown="onMouseDown($event, source)"
  @touchstart="onTouchStart($event, source)"
  @click="selectSource(source)"
  @dragstart="onDragStart($event, source)"
  @dragend="onDragEnd($event, source)"
>
```

**onDragStart 函数**（已存在，无需修改）：

```javascript
const onDragStart = (event, source) => {
  console.log('[SourcePreviewBar] HTML5 拖拽开始:', source.name, source.type, source.id)

  isDragging.value = true
  draggingSourceId.value = source.id

  // 设置拖拽数据 - 关键：必须设置 JSON 格式的数据
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('sourceId', source.id)
  event.dataTransfer.setData('sourceType', source.type)
  event.dataTransfer.setData('sourceName', source.name)
  event.dataTransfer.setData('application/json', JSON.stringify(source))

  // 设置拖拽图像（可选）
  if (event.currentTarget) {
    const dragImage = event.currentTarget.cloneNode(true)
    dragImage.style.opacity = '0.8'
    dragImage.style.width = '180px'
    document.body.appendChild(dragImage)
    event.dataTransfer.setDragImage(dragImage, 90, 60)
    setTimeout(() => document.body.removeChild(dragImage), 0)
  }

  // 🎯 发出事件给父组件
  emit('drag-start', source)
}
```

### 修复 2：将 TeacherWindow 中的 VideoSection 替换为 VideoGrid

**文件**：`tauri-app/src/components/TeacherWindow.vue`

**步骤 1**：复制 VideoGrid.vue 组件

```bash
copy ".kilo\worktrees\translucent-concrete\tauri-app\src\components\teacher-window\video\VideoGrid.vue" "tauri-app\src\components\teacher-window\video\VideoGrid.vue"
```

**步骤 2**：修改导入语句

```javascript
// 修改前
import VideoSection from './teacher-window/layout/VideoSection.vue'

// 修改后
import VideoGrid from './teacher-window/video/VideoGrid.vue'
```

**步骤 3**：修改模板中的组件使用

```vue
<!-- 修改前 -->
<VideoSection
  v-if="!useRenderEngine"
  :current-layout="currentLayout"
  :canvas-sources="mappedCanvasSources"
  :canvas-source-map="canvasSourceMap"
  ...
/>

<!-- 修改后 -->
<VideoGrid
  v-if="!useRenderEngine"
  :current-layout="currentLayout"
  :canvas-source-map="canvasSourceMap"
  :all-sources="allSources"
  ...
  @drop="handleVideoGridDrop"
/>
```

**关键变化**：

- 移除了 `:canvas-sources="mappedCanvasSources"`（VideoGrid 不需要）
- 添加了 `:all-sources="allSources"`（VideoGrid 需要这个 prop）
- 添加了 `@drop="handleVideoGridDrop"` 事件监听

### 修复 3：添加 handleVideoGridDrop 处理函数

**文件**：`tauri-app/src/components/TeacherWindow.vue`

**新增函数**：

```javascript
// 🎯 处理 VideoGrid 的 HTML5 拖拽放置事件
const handleVideoGridDrop = (event, index) => {
  console.log('[TeacherWindow] 从VideoGrid接收HTML5拖拽放置事件:', { index })

  try {
    // 获取拖拽的数据
    const sourceId = event.dataTransfer?.getData('sourceId')
    const sourceType = event.dataTransfer?.getData('sourceType')
    const sourceName = event.dataTransfer?.getData('sourceName')
    const jsonData = event.dataTransfer?.getData('application/json')

    console.log('[TeacherWindow] VideoGrid拖拽数据:', { sourceId, sourceType, sourceName })

    let source = null

    // 优先从 JSON 数据解析
    if (jsonData) {
      try {
        source = JSON.parse(jsonData)
        console.log('[TeacherWindow] 从 JSON 解析信号源:', source.name)
      } catch (e) {
        console.error('[TeacherWindow] JSON 解析失败:', e)
      }
    }

    // 如果没有 JSON 数据，构造基本对象
    if (!source && sourceId) {
      source = {
        id: sourceId,
        type: sourceType,
        name: sourceName
      }
      console.log('[TeacherWindow] 构造基本信号源对象')
    }

    if (!source) {
      console.warn('[TeacherWindow] 未找到有效的信号源数据')
      return
    }

    // 🎯 使用与 handleDropSource 相同的逻辑
    const clonedSource = cloneSourceForCanvas(source, index, true)
    if (!clonedSource) {
      console.error('[TeacherWindow] 克隆源失败')
      ElMessage.error('添加信号源失败')
      return
    }

    canvasSourceMap.value[index] = clonedSource

    const layout = typeof currentLayout === 'object' && 'value' in currentLayout ? currentLayout.value : currentLayout
    if (typeof assignSource === 'function') {
      assignSource(index, clonedSource.id)
    }

    if (typeof saveToStorage === 'function') {
      saveToStorage()
    }

    ElMessage.success(`已将 "${source.name}" 添加到画布 ${index}`)
  } catch (error) {
    console.error('[TeacherWindow] 处理VideoGrid拖拽放置失败:', error)
    ElMessage.error('拖拽失败: ' + error.message)
  }
}
```

## 工作流程

修复后的完整拖拽流程：

1. **用户在预览区域点击并拖动信号源**
   - 触发 `@dragstart` 事件
   - `onDragStart` 设置拖拽数据（sourceId, sourceType, sourceName, JSON）

2. **用户拖动到 VideoGrid 的某个槽位上方**
   - `.video-item` 元素有 `@dragover.prevent` 和 `@drop.prevent`
   - 浏览器显示拖拽反馈

3. **用户释放鼠标**
   - 触发 `@drop` 事件
   - VideoGrid 的 `onDrop` 函数发出 `drop` 事件给父组件

4. **TeacherWindow 接收 drop 事件**
   - 调用 `handleVideoGridDrop(event, index)`
   - 解析拖拽数据（从 dataTransfer 获取 source 信息）
   - 调用 `cloneSourceForCanvas` 创建克隆源
   - 更新 `canvasSourceMap.value[index] = clonedSource`
   - 调用 `assignSource` 保存状态
   - 调用 `saveToStorage` 持久化

5. **VideoGrid 重新渲染**
   - `canvasSourceMap` 是响应式的
   - VideoGrid 的 `getVideoSource(index)` 会返回新添加的源
   - 视频自动显示在对应的槽位中

6. **预览区域保持不变**
   - 原始源仍在预览区域
   - 只有通过删除按钮才能移除预览源

## 技术要点

### 1. HTML5 拖拽 vs 自定义鼠标拖拽

| 特性 | HTML5 原生拖拽 | 自定义鼠标拖拽 |
|------|---------------|---------------|
| 实现方式 | `draggable` + `dataTransfer` | `mousedown/mousemove/mouseup` |
| DOM 要求 | 任何可拖拽元素 | 需要检测目标元素 |
| Canvas 兼容 | ✅ 支持 | ❌ 不支持（无法检测 Canvas 内部） |
| 跨窗口拖拽 | ✅ 支持 | ❌ 不支持 |
| 自定义外观 | 有限制 | 完全自定义 |

### 2. 为什么选择 HTML5 拖拽

- **Canvas 兼容性**：VideoGrid 使用 `.video-item` DOM 元素，可以被检测到
- **简单可靠**：浏览器原生支持，无需复杂的坐标计算
- **标准协议**：`dataTransfer` API 是 Web 标准，广泛支持

### 3. 克隆机制

所有拖拽操作都使用克隆机制：

- `cloneSourceForCanvas(source, canvasIndex, addToGlobalSources = true)`
- 创建新 ID：`${source.id}_canvas_${Date.now()}`
- 标记为克隆：`isClone: true`, `addedToPreview: false`
- 克隆流缓存：避免重复克隆 MediaStream
- 添加到全局列表：通过 `addSourceToGlobalList` 回调

### 4. 响应式更新

- `canvasSourceMap` 是 Vue ref，更新后自动触发重新渲染
- `allSources` 是 computed，从 `sourceStore.sources` 派生
- 克隆源添加到 `sourceStore.sources` 后，`allSources` 自动更新
- VideoGrid 根据 `canvasSourceMap` 和 `allSources` 渲染视频

## 测试验证

### 测试步骤

1. **启动应用**

   ```bash
   cd tauri-app
   npm run tauri dev
   ```

2. **添加信号源到预览区域**
   - 点击"信号源"按钮
   - 选择一个摄像头或本地视频
   - 点击"添加到预览"

3. **拖拽到视频展示区域**
   - 从左下角预览区域点击并拖动信号源
   - 拖动到中间的视频展示区域
   - 释放鼠标

4. **验证结果**
   - ✅ 视频应该显示在视频展示区域的第一个槽位
   - ✅ 预览区域的原始源仍然存在
   - ✅ 控制台应该有日志输出：

     ```
     [SourcePreviewBar] HTML5 拖拽开始: xxx
     [TeacherWindow] 从VideoGrid接收HTML5拖拽放置事件: { index: 1 }
     [TeacherWindow] VideoGrid拖拽数据: { sourceId: '...', sourceType: '...', sourceName: '...' }
     [TeacherWindow] 从 JSON 解析信号源: xxx
     [cloneSourceForCanvas] 克隆成功: xxx type: xxx hasStream: true newId: xxx_canvas_xxx
     [TeacherWindow] 已将 "xxx" 添加到画布 1
     ```

5. **测试多次拖拽**
   - 再次拖拽同一个源到不同的槽位
   - 应该创建新的克隆，显示在不同的位置
   - 预览区域仍然只有一个原始源

6. **测试删除**
   - 点击预览区域的删除按钮
   - 原始源被移除
   - 画布上的克隆源不受影响

### 预期行为

- ✅ 拖拽成功：视频显示在目标槽位
- ✅ 预览保留：原始源仍在预览区域
- ✅ 克隆隔离：每个槽位有独立的克隆源
- ✅ 状态持久：刷新页面后布局保持不变

## 注意事项

### 1. useRenderEngine 标志

- `useRenderEngine` 默认为 `false`
- 当为 `false` 时，使用 VideoGrid（传统 DOM 渲染）
- 当为 `true` 时，使用 RenderEngineWrapper（Canvas 渲染）
- **当前修复只针对 `useRenderEngine = false` 的情况**

### 2. 如果需要启用 Canvas 渲染

如果未来需要启用 `useRenderEngine = true`，需要：

- 为 RenderEngineWrapper 添加拖拽支持
- 或者继续使用 HTML5 拖拽，但修改 VideoSection 以正确处理

### 3. 性能考虑

- HTML5 拖拽比自定义鼠标拖拽更轻量
- 不需要频繁的 `elementsFromPoint` 检测
- 浏览器优化了拖拽事件的派发

### 4. 兼容性

- HTML5 拖拽在所有现代浏览器中都支持
- Tauri 基于 Chromium，完全支持 HTML5 拖拽
- 移动端可能需要额外的触摸事件处理

## 相关文件清单

### 修改的文件

1. `tauri-app/src/components/teacher-window/layout/SourcePreviewBar.vue`
   - 添加 `draggable="true"` 属性
   - 添加 `@dragstart` 和 `@dragend` 事件监听

2. `tauri-app/src/components/TeacherWindow.vue`
   - 导入 VideoGrid 替代 VideoSection
   - 修改模板使用 VideoGrid 组件
   - 添加 `handleVideoGridDrop` 函数
   - 添加 `@drop` 事件监听

### 新增的文件

1. `tauri-app/src/components/teacher-window/video/VideoGrid.vue`
   - 从 worktrees 复制的传统视频网格组件
   - 包含 `.video-item` DOM 元素
   - 支持 HTML5 拖拽

### 保持不变的文件

- `tauri-app/src/composables/useSourceDrag.js`
  - 克隆逻辑保持不变
  - 自定义鼠标拖拽逻辑保持不变（用于其他场景）

- `tauri-app/src/components/teacher-window/layout/VideoSection.vue`
  - 保留用于 Canvas 渲染模式
  - 当 `useRenderEngine = true` 时使用

## 总结

本次修复通过以下三个关键改动解决了拖拽失败的问题：

1. **为 SourcePreviewBar 添加 HTML5 原生拖拽支持**
   - 使预览项可以被拖拽
   - 设置正确的拖拽数据

2. **将 VideoSection 替换为 VideoGrid**
   - 使用包含 `.video-item` DOM 元素的组件
   - 支持 HTML5 拖拽事件

3. **添加 handleVideoGridDrop 处理函数**
   - 解析拖拽数据
   - 克隆源并更新 canvasSourceMap
   - 保存状态到 localStorage

修复后，用户可以成功地从预览区域拖拽信号源到视频展示区域，并且预览区域的原始源会被保留，符合业务需求。

---

## 🔄 后续修复（基于日志分析）

### 问题发现

根据实际运行日志，发现两个额外问题：

#### 1. Vue 类型警告

```
[Vue warn]: Invalid prop: type check failed for prop "isDragging".
Expected Boolean, got String with value "media_1778812554073".
```

**原因**：`isDraggingSource.value` 被设置为 `source.id`（字符串），但组件期望布尔值。

**修复**：在 TeacherWindow.vue 中传递时转换为布尔值

```vue
:is-dragging="!!isDraggingSource"
```

#### 2. 缺少 canvasSources prop

**原因**：VideoGrid 的 `videoSourceCache` 依赖 `props.canvasSources` 来查找视频源，但 TeacherWindow 没有传递这个 prop。

**修复**：添加 `canvasSources` prop

```vue
<VideoGrid
  :canvas-sources="mappedCanvasSources"
  ...
/>
```

### 验证结果

修复后的日志显示：

- ✅ `[鼠标拖拽] 放置到索引 1，源: xVideo #A 2022-06-01 11-23-37.mp4`
- ✅ `[cloneSourceForCanvas] 克隆成功`
- ✅ `[TeacherWindow] 已将克隆源添加到全局列表`
- ✅ 无 Vue 类型警告
- ✅ 视频正确显示在画布槽位中

---

## 📦 额外依赖修复

在实施上述修复后，发现 VideoGrid.vue 依赖多个缺失的组件文件。已从 worktrees 复制以下文件：

### 新增文件

#### 核心组件

1. **tauri-app/src/components/teacher-window/video/VideoGrid.vue**
   - 从 `.kilo/worktrees/translucent-concrete` 复制
   - 传统视频网格组件，支持 HTML5 拖拽

2. **tauri-app/src/components/VideoPreview.vue**
   - 从 `.kilo/worktrees/translucent-concrete` 复制
   - 视频预览组件，用于 VideoGrid 中的视频播放

3. **tauri-app/src/components/PtzControlPanel.vue**
   - 从 `.kilo/worktrees/translucent-concrete` 复制
   - PTZ 云台控制面板组件

#### FreeCanvas 相关组件

1. **tauri-app/src/components/teacher-window/canvas/FreeCanvas.vue**
   - 从 `.kilo/worktrees/translucent-concrete` 复制
   - 自由布局画布组件

2. **tauri-app/src/components/teacher-window/canvas/CanvasSourceItem.vue**
   - 从 `.kilo/worktrees/translucent-concrete` 复制
   - 画布信号源项组件

3. **tauri-app/src/components/teacher-window/canvas/CanvasContextMenu.vue**
   - 从 `.kilo/worktrees/translucent-concrete` 复制
   - 画布右键菜单组件

4. **tauri-app/src/components/teacher-window/canvas/SourcePropertiesDialog.vue**
   - 从 `.kilo/worktrees/translucent-concrete` 复制
   - 信号源属性对话框组件

#### Contents 内容组件（9个）

8-10. **已存在**：PptContent.vue, WordContent.vue, ExcelContent.vue

1. **tauri-app/src/components/teacher-window/canvas/contents/VideoContent.vue**
2. **tauri-app/src/components/teacher-window/canvas/contents/TextContent.vue**
3. **tauri-app/src/components/teacher-window/canvas/contents/ImageContent.vue**
4. **tauri-app/src/components/teacher-window/canvas/contents/WebpageContent.vue**
5. **tauri-app/src/components/teacher-window/canvas/contents/MindmapContent.vue**
6. **tauri-app/src/components/teacher-window/canvas/contents/RemoteDesktopContent.vue**
7. **tauri-app/src/components/teacher-window/canvas/contents/CameraContent.vue**

- 以上7个文件从 `.kilo/worktrees/translucent-concrete` 复制
- 用于在 CanvasSourceItem 中渲染不同类型的信号源

### 修改文件

1. **tauri-app/src/components/teacher-window/video/VideoGrid.vue**
   - 移除了未使用的 `CanvasToolbar` 导入
   - 保留了实际使用的组件导入

### 已存在的依赖（无需操作）

- `PptContent.vue` - 已存在
- `WordContent.vue` - 已存在
- `ExcelContent.vue` - 已存在
- `VideoCamera` 图标 - 已在 `icons/index.js` 中导出
