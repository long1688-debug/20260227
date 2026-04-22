# 🧪 新版系统功能完整性检查报告

**检查日期**: 2026-04-23  
**检查范围**: 从旧版 useVideoStore 迁移到新版 useVideoSync 的所有功能  
**检查人**: AI Assistant  

---

## ✅ 核心状态管理功能对照

### 1. 布局管理功能

| 功能 | 旧版 (useVideoStore) | 新版 (useVideoSync) | 状态 |
|------|---------------------|-------------------|------|
| 获取当前布局 | `videoStore.currentLayout` | `currentLayout` | ✅ 已实现 |
| 切换布局 | `videoStore.setLayout(layout)` | `setLayout(layout, position?)` | ✅ 已实现（增强） |
| 画中画开关 | `videoStore.togglePiP()` | `togglePip()` | ✅ 已实现 |
| 设置PiP位置 | `videoStore.setPipPosition(pos)` | `setPipPosition(position)` | ✅ 已实现 |
| 最大化画布 | `videoStore.maximizeCanvas(idx)` | `maximizeCanvas(canvasIndex)` | ✅ 已实现 |
| 还原布局 | `videoStore.restoreLayout()` | `restoreLayout()` | ✅ 已实现 |
| 清空所有画布 | `videoStore.clearAllCanvases()` | `clearAllCanvases()` | ✅ 已实现 |
| 保存布局配置 | ❌ 无 | `saveCurrentLayoutConfig()` | ✅ 新增 |
| 加载布局配置 | ❌ 无 | `loadLayoutConfig(layoutId)` | ✅ 新增 |

**测试建议**:
```javascript
// 在浏览器Console中测试
const { setLayout, maximizeCanvas, restoreLayout } = useVideoSync()
setLayout(9)  // 切换到9分屏
maximizeCanvas(1)  // 最大化第1个画布
restoreLayout()  // 还原
```

---

### 2. 信号源管理功能

| 功能 | 旧版 (useVideoStore) | 新版 (useVideoSync) | 状态 |
|------|---------------------|-------------------|------|
| 添加信号源 | `videoStore.addSource(src)` | `addSource(source)` | ✅ 已实现 |
| 删除信号源 | `videoStore.removeSource(id)` | `removeSource(sourceId)` | ✅ 已实现（增强清理逻辑） |
| 更新信号源 | `videoStore.updateSource(id, updates)` | `updateSource(sourceId, updates)` | ✅ 已实现 |
| 设置画布源 | `videoStore.setCanvasSource(idx, src)` | `setCanvasSource(index, source)` | ✅ 已实现 |
| 获取画布的源 | `videoStore.getSourceByCanvasIndex(idx)` | `getSourceByCanvasIndex(index)` | ✅ 已实现 |
| 检查画布是否有源 | `videoStore.hasSourceAtCanvas(idx)` | `hasSourceAtCanvas(index)` | ✅ 已实现 |
| 添加到预览列表 | ❌ 内部方法 | `addVideoSource(source)` | ✅ 公开 |
| 从预览移除 | ❌ 内部方法 | `removeVideoSource(sourceId)` | ✅ 公开 |

**测试建议**:
```javascript
const { addSource, removeSource, setCanvasSource } = useVideoSync()

// 添加信号源
addSource({ id: 'cam1', type: 'camera', name: '摄像头1' })

// 设置到画布
setCanvasSource(1, { id: 'cam1', type: 'camera', name: '摄像头1' })

// 删除信号源（自动清理所有映射）
removeSource('cam1')
```

---

### 3. 录制状态管理功能

| 功能 | 旧版 (useVideoStore) | 新版 (useVideoSync) | 状态 |
|------|---------------------|-------------------|------|
| 设置录制状态 | `videoStore.setCanvasRecordingState()` | `setCanvasRecordingState(index, state)` | ✅ 已实现 |
| 获取录制状态 | `videoStore.getCanvasRecordingState()` | `getCanvasRecordingState(index)` | ✅ 已实现 |
| 清除录制状态 | ❌ 无 | `clearCanvasRecordingState(index)` | ✅ 新增 |
| 获取所有状态 | ❌ 无 | `getAllRecordingStates()` | ✅ 新增 |

**测试建议**:
```javascript
const { setCanvasRecordingState, getCanvasRecordingState } = useVideoSync()

// 设置录制状态
setCanvasRecordingState(1, { recording: true, paused: false })

// 获取状态
const state = getCanvasRecordingState(1)
console.log(state)  // { recording: true, paused: false }
```

---

### 4. 视频同步功能（原有，保持不变）

| 功能 | 状态 | 说明 |
|------|------|------|
| 注册主控视频 | ✅ | `registerMasterVideo(video, sourceId)` |
| 注册从属视频 | ✅ | `registerSlaveVideo(video, canvasId, sourceId)` |
| 注销从属视频 | ✅ | `unregisterSlaveVideo(canvasId, sourceId)` |
| 清除主控 | ✅ | `clearMasterVideo(sourceId)` |
| 设置音频 | ✅ | `setCanvasAudio(canvasId, enabled)` |
| 获取同步状态 | ✅ | `getSyncStatus()` |
| 进度管理 | ✅ | `initSourcePreviewProgress`, `seekPreviewVideo`, 等 |

---

## 📋 测试模块逐项检查

### 🔍 测试模块 1：对话框组件

#### 1.1 录制管理对话框 (RecordingManagerDialog)

**依赖的状态/方法**:
- ✅ `canvasRecordingStates` - 录制状态Map
- ✅ `setCanvasRecordingState` - 设置录制状态
- ✅ `allSources` - 信号源列表（用于音频通道）

**需要验证的文件**:
- [ ] `tauri-app/src/components/teacher-window/dialogs/RecordingManagerDialog.vue`
- [ ] `tauri-app/src/composables/useRecording.js` (已迁移到useVideoSync)

**检查结果**: ⏳ 待验证

---

#### 1.2 系统设置对话框 (SettingsDialog)

**依赖的状态/方法**:
- ✅ 不直接依赖视频状态管理
- ✅ 使用独立的 settings store

**需要验证的文件**:
- [ ] `tauri-app/src/components/teacher-window/dialogs/SettingsDialog.vue`

**检查结果**: ✅ 无需迁移（独立模块）

---

#### 1.3 字幕管理对话框 (SubtitleManagerDialog)

**依赖的状态/方法**:
- ✅ 使用独立的 subtitle store

**需要验证的文件**:
- [ ] `tauri-app/src/components/teacher-window/dialogs/SubtitleManagerDialog.vue`

**检查结果**: ✅ 无需迁移（独立模块）

---

#### 1.4 添加信号源对话框 (AddSourceDialog)

**依赖的状态/方法**:
- ✅ `addSource` - 添加信号源
- ✅ `allSources` - 信号源列表
- ✅ `updateSource` - 更新信号源
- ✅ `removeSource` - 删除信号源

**需要验证的文件**:
- [ ] `tauri-app/src/components/teacher-window/dialogs/AddSourceDialog.vue`
- [ ] 确认是否从 useVideoSync 导入所需方法

**检查结果**: ⏳ 待验证

---

### 🔍 测试模块 2：核心 UI 组件

#### 2.1 视频网格容器 (VideoGrid / EnhancedVideoGrid)

**依赖的状态/方法**:
- ✅ `currentLayout` - 当前布局
- ✅ `videoPreviews` - 视频预览列表
- ✅ `canvasSourceMap` - 画布-源映射
- ✅ `pipVisible` - PiP可见性
- ✅ `pipPosition` - PiP位置
- ✅ `isMaximized` - 最大化状态
- ✅ `maximizedIndex` - 最大化的索引
- ✅ `setLayout` - 切换布局
- ✅ `togglePip` - 切换PiP
- ✅ `setPipPosition` - 设置PiP位置
- ✅ `maximizeCanvas` - 最大化画布
- ✅ `restoreLayout` - 还原布局
- ✅ `getSourceByCanvasIndex` - 获取画布的源
- ✅ `hasSourceAtCanvas` - 检查是否有源

**已迁移的组件**:
- ✅ `EnhancedVideoGrid.vue` - 已完成迁移
- ✅ `VideoGrid.vue` - 已完成迁移

**检查结果**: ✅ 已完整迁移

---

#### 2.2 右侧面板容器 (SidePanel)

**依赖的状态/方法**:
- ✅ `currentLayout` - 显示当前布局
- ✅ `setLayout` - 切换布局
- ✅ `allSources` - 信号源列表
- ✅ `addSource` - 添加信号源
- ✅ `removeSource` - 删除信号源

**需要验证的文件**:
- [ ] `tauri-app/src/components/teacher-window/SidePanel.vue`
- [ ] 确认布局选择器、信号源列表等功能正常

**检查结果**: ⏳ 待验证

---

### 🔍 测试模块 3：集成与数据流

#### 3.1 Props/Emits 数据流

**关键检查点**:
1. ✅ TeacherWindow → VideoGrid: `currentLayout`, `videoPreviews`, `canvasSourceMap`
2. ✅ TeacherWindow → SidePanel: `currentLayout`, `allSources`
3. ✅ VideoGrid → TeacherWindow: `@layout-change`, `@source-drop`
4. ✅ SidePanel → TeacherWindow: `@layout-change`, `@add-source`

**已验证的组件**:
- ✅ `TeacherWindow.vue` - 主控制器，已解构所有必要的方法
- ✅ `EnhancedTeacherWindow.vue` - 已迁移

**检查结果**: ✅ 数据流完整

---

#### 3.2 性能测试

**优化措施**:
- ✅ 使用 Composable 减少响应式开销
- ✅ 避免直接操作数组，使用原子方法
- ✅ 统一的狀態源，减少不必要的重渲染

**建议测试项**:
- [ ] FPS 稳定性测试（快速切换布局）
- [ ] 内存泄漏测试（长时间运行）
- [ ] 组件重渲染次数（Vue DevTools）

---

## 🎯 待验证的关键文件清单

### 高优先级（必须检查）

1. **对话框组件**
   - [ ] `RecordingManagerDialog.vue` - 录制管理
   - [ ] `AddSourceDialog.vue` - 添加信号源
   - [ ] `SettingsDialog.vue` - 系统设置（独立，应无问题）
   - [ ] `SubtitleManagerDialog.vue` - 字幕管理（独立，应无问题）

2. **侧边栏组件**
   - [ ] `SidePanel.vue` - 右侧面板
   - [ ] `LayoutSelector.vue` - 布局选择器（如有）
   - [ ] `SourceList.vue` - 信号源列表（如有）

3. **录制相关**
   - [ ] `useRecording.js` - ✅ 已迁移
   - [ ] `RecordingPanel.vue` - 录制面板（如有）

### 中优先级（建议检查）

4. **视频控制组件**
   - [ ] `VideoHeader.vue` - 顶部工具栏
   - [ ] `VideoControls.vue` - 视频控制条

5. **学生/任务相关**
   - [ ] `StudentList.vue` - 学生列表（独立store）
   - [ ] `TaskManager.vue` - 任务管理（独立store）

---

## 🧪 自动化检查脚本

创建一个脚本来验证所有组件是否正确导入了 useVideoSync：
