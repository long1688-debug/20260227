# useVideoSync 快速参考

## 🚀 基本用法

```javascript
import { useVideoSync } from '@/composables/useVideoSync'

const {
  // 状态
  currentLayout,
  videoPreviews,
  canvasSourceMap,
  allSources,
  
  // 布局管理
  setLayout,
  togglePip,
  maximizeCanvas,
  restoreLayout,
  
  // 信号源管理
  setCanvasSource,
  removeSource,
  updateSource,
  addSource,
  
  // 录制状态
  setCanvasRecordingState,
  getCanvasRecordingState
} = useVideoSync()
```

---

## 📋 常用API速查

### 布局切换
```javascript
// 切换到9分屏
setLayout(9)

// 切换到画中画（右下）
setLayout(2, 'pip-right-bottom')

// 最大化第3个画布
maximizeCanvas(3)

// 还原布局
restoreLayout()
```

### 信号源管理
```javascript
// 设置画布1的信号源
setCanvasSource(1, sourceObject)

// 清空画布1
setCanvasSource(1, null)

// 删除信号源（自动清理所有映射）
removeSource(sourceId)

// 更新信号源名称
updateSource(sourceId, { name: '新名称' })
```

### 录制状态
```javascript
// 设置画布1为录制中
setCanvasRecordingState(1, { recording: true, paused: false })

// 获取画布1的录制状态
const state = getCanvasRecordingState(1)
// 返回: { recording: boolean, paused: boolean }
```

### 数组初始化（布局切换时）
```javascript
// 初始化为9个元素（用于9分屏）
initVideoPreviewsLength(9)
```

---

## ⚠️ 禁止操作

### ❌ 错误做法
```javascript
// 禁止直接修改数组
videoPreviews.value.push(source)
videoPreviews.value.splice(index, 1)
canvasSourceMap.value[key] = sourceId
delete canvasSourceMap.value[key]

// 禁止直接赋值
videoPreviews.value = []
canvasSourceMap.value = {}
```

### ✅ 正确做法
```javascript
// 使用方法
addVideoSource(source)
removeVideoSource(sourceId)
setCanvasSource(canvasIndex, source)
initVideoPreviewsLength(length)

// 清空时使用专用方法
clearAllCanvases()
```

---

## 🔄 迁移对照

| 旧版 (useVideoStore) | 新版 (useVideoSync) |
|---------------------|-------------------|
| `videoStore.setLayout(9)` | `setLayout(9)` |
| `videoStore.setCanvasSource(1, src)` | `setCanvasSource(1, src)` |
| `videoStore.removeSource(id)` | `removeSource(id)` |
| `videoStore.togglePiP()` | `togglePip()` |
| `videoStore.maximizeCanvas(1)` | `maximizeCanvas(1)` |
| `videoStore.setCanvasRecordingState()` | `setCanvasRecordingState()` |

---

## 📦 完整导出列表

### 状态 (States)
- `currentLayout` - 当前布局
- `pipVisible` - 画中画可见性
- `pipPosition` - 画中画位置
- `videoPreviews` - 视频预览列表
- `canvasSourceMap` - 画布-源映射
- `allSources` - 所有信号源
- `isMaximized` - 是否最大化
- `maximizedIndex` - 最大化的画布索引
- `canvasRecordingStates` - 录制状态Map

### 布局管理 (Layout)
- `changeLayout(layout)` - 切换布局
- `setLayout(layout, position?)` - 切换布局（带配置保存）
- `togglePip()` - 切换画中画
- `setPipPosition(position)` - 设置画中画位置
- `maximizeCanvas(index)` - 最大化画布
- `restoreLayout()` - 还原布局
- `clearAllCanvases()` - 清空所有画布
- `saveCurrentLayoutConfig()` - 保存当前配置
- `loadLayoutConfig(layoutId)` - 加载配置

### 信号源管理 (Sources)
- `addSource(source)` - 添加信号源
- `removeSource(sourceId)` - 删除信号源
- `updateSource(sourceId, updates)` - 更新信号源
- `setCanvasSource(index, source)` - 设置画布源
- `addVideoSource(source)` - 添加到预览列表
- `removeVideoSource(sourceId)` - 从预览移除
- `getSourceByCanvasIndex(index)` - 获取画布的源
- `hasSourceAtCanvas(index)` - 检查是否有源
- `initVideoPreviewsLength(length)` - 初始化数组长度

### 录制管理 (Recording)
- `setCanvasRecordingState(index, state)` - 设置录制状态
- `getCanvasRecordingState(index)` - 获取录制状态
- `clearCanvasRecordingState(index)` - 清除录制状态
- `getAllRecordingStates()` - 获取所有状态

### 视频同步 (Sync)
- `registerMasterVideo(video, sourceId)` - 注册主控
- `registerSlaveVideo(video, canvasId, sourceId)` - 注册从属
- `unregisterSlaveVideo(canvasId, sourceId)` - 注销从属
- `clearMasterVideo(sourceId)` - 清除主控
- `setCanvasAudio(canvasId, enabled)` - 设置音频
- `getSyncStatus()` - 获取同步状态

### 工具 (Utils)
- `reset()` - 重置所有状态
- `cleanup()` - 清理资源
- `setVideoPreviewRef(sourceId, ref)` - 设置引用
- `getPreviewProgress(sourceId)` - 获取进度
- `seekPreviewVideo(sourceId, time)` - 跳转进度
- `formatPreviewTime(seconds)` - 格式化时间

---

## 💡 最佳实践

### 1. 布局切换流程
```javascript
const handleLayoutChange = async (newLayout) => {
  // 1. 使用 setLayout 自动保存/加载配置
  setLayout(newLayout)
  
  // 2. 如需手动初始化数组
  const gridCount = getVisibleCanvasIndices(newLayout).length
  initVideoPreviewsLength(gridCount)
  
  // 3. 恢复具体的视频源映射
  // ...
}
```

### 2. 删除信号源流程
```javascript
const handleDeleteSource = (sourceId) => {
  // removeSource 会自动处理：
  // - 从 canvasSourceMap 移除
  // - 从 videoPreviews 移除
  // - 从 allSources 移除
  // - 清理同步系统注册
  removeSource(sourceId)
}
```

### 3. 添加信号源到画布
```javascript
const handleAddToCanvas = (canvasIndex, source) => {
  // setCanvasSource 会自动处理：
  // - 添加到 allSources（如果不存在）
  // - 添加到 videoPreviews（如果不存在）
  // - 更新 canvasSourceMap
  setCanvasSource(canvasIndex, source)
}
```

---

## 🔗 相关文档

- [详细迁移指南](./MIGRATION_GUIDE_VIDEO_SYNC.md)
- [清理报告](./CLEANUP_REPORT_VIDEO_STORE.md)
- [Vue状态管理规范](memory://ed2a26f9-186c-472b-a3ad-ee3d86c48492)

---

*最后更新: 2026-04-23*
