# TeacherWindow.vue 手动重构指南

**重要提示**: 由于 TeacherWindow.vue 文件过大（3688行），自动化工具容易产生错误。建议按照以下步骤手动执行重构。

---

## 📋 前置准备

### 1. 确认新组件已创建

✅ 以下4个组件已成功创建：
- `src/components/teacher-window/toolbar/VideoOperationToolbar.vue`
- `src/components/teacher-window/panels/LayoutManagementPanel.vue`
- `src/components/teacher-window/dialogs/SubtitleEditDialog.vue`
- `src/components/teacher-window/dialogs/SubtitleImportDialog.vue`

### 2. 备份当前文件

```bash
cd f:\20260227
git add tauri-app/src/components/TeacherWindow.vue
git commit -m "backup: TeacherWindow.vue before refactoring"
```

---

## 🔧 重构步骤（按顺序执行）

### 步骤 1: 添加组件导入（第 372-395 行附近）

**找到位置**: 在 `<script setup>` 部分的 import 语句区域

**查找关键字**: `import TitleBar from './TitleBar.vue'`

**在此行之后添加**:
```javascript
// 🆕 重构新增组件
import VideoOperationToolbar from './teacher-window/toolbar/VideoOperationToolbar.vue'
import LayoutManagementPanel from './teacher-window/panels/LayoutManagementPanel.vue'
import SubtitleEditDialog from './teacher-window/dialogs/SubtitleEditDialog.vue'
import SubtitleImportDialog from './teacher-window/dialogs/SubtitleImportDialog.vue'
```

**验证**: 保存文件后运行 `get_problems` 检查语法错误

---

### 步骤 2: 替换视频操作工具栏（第 4-68 行）

**找到位置**: 
```vue
<TitleBar>
  <template #toolbar>
    <div class="video-actions">
      <!-- 批注按钮 -->
      ...
    </div>
  </template>
</TitleBar>
```

**替换为**:
```vue
<TitleBar>
  <template #toolbar>
    <!-- 🆕 使用独立的视频操作工具栏组件 -->
    <VideoOperationToolbar
      :is-recording="isRecording"
      :is-recording-paused="isRecordingPaused"
      :is-annotation-enabled="isAnnotationEnabled"
      :is-rtmp-streaming="rtmpStreamingState?.isStreaming || false"
      @enable-annotation="enableAnnotationForAll"
      @recording-command="handleRecordingCommand"
      @pause-recording="handlePauseAllCanvasRecording"
      @stop-recording="handleStopAllCanvasRecording"
      @show-rtmp-dialog="showRtmpDialog = true"
      @show-recording-dialog="showRecordingDialog = true"
      @show-settings-dialog="showSettingsDialog = true"
    />
  </template>
</TitleBar>
```

**删除内容**: 第 6-67 行的所有按钮代码（保留 `<TitleBar>` 和 `</TitleBar>` 标签）

**验证**: 
- 确保没有多余的 `</div>` 或 `</template>` 标签
- 运行应用测试视频操作按钮功能

---

### 步骤 3: 替换布局管理面板（第 139-208 行）

**找到位置**: SidePanel 的 `#layout` slot
```vue
<template #layout>
  <div class="panel-header">
    <h3>场景布局</h3>
  </div>
  <div class="layout-panel">
    <!-- 基础分屏布局 -->
    ...
  </div>
</template>
```

**替换为**:
```vue
<template #layout>
  <div class="panel-header">
    <h3>场景布局</h3>
  </div>
  <!-- 🆕 使用独立的布局管理面板组件 -->
  <LayoutManagementPanel
    :current-layout="currentLayout"
    :pip-visible="pipVisible"
    :pip-position="pipPosition"
    :custom-grid-count="customGridCount"
    @layout-change="handleLayoutChange"
    @pip-toggle="handlePipToggle"
    @custom-count-change="handleCustomCountChange"
  />
</template>
```

**删除内容**: 第 140-207 行的所有布局选择代码（保留 `<template #layout>` 和 `</template>` 标签）

**注意**: 需要创建 `handlePipToggle` 函数（如果不存在）

**添加函数** (在 script 部分):
```javascript
/**
 * 处理画中画切换
 */
const handlePipToggle = (position) => {
  if (position) {
    pipPosition.value = position
    pipVisible.value = true
  } else {
    pipVisible.value = false
  }
}
```

**验证**: 测试布局切换功能是否正常

---

### 步骤 4: 替换字幕编辑对话框（第 380-407 行）

**找到位置**:
```vue
<!-- 字幕编辑对话框 -->
<el-dialog
  v-model="showSubtitleEditDialog"
  title="编辑字幕"
  width="600px"
>
  <el-form :model="editingSubtitle" label-width="100px">
    ...
  </el-form>
  <template #footer>
    ...
  </template>
</el-dialog>
```

**替换为**:
```vue
<!-- 🆕 使用独立的字幕编辑对话框组件 -->
<SubtitleEditDialog
  v-model="showSubtitleEditDialog"
  :subtitle="editingSubtitle"
  @save="saveEditedSubtitle"
/>
```

**删除内容**: 整个 `<el-dialog>` 块（包括注释）

**验证**: 测试字幕编辑功能

---

### 步骤 5: 替换字幕导入对话框（第 409-459 行）

**找到位置**:
```vue
<!-- 字幕导入对话框 -->
<el-dialog
  v-model="showSubtitleImportDialog"
  title="导入字幕"
  width="700px"
>
  <div class="subtitle-import-dialog">
    ...
  </div>
  <template #footer>
    ...
  </template>
</el-dialog>
```

**替换为**:
```vue
<!-- 🆕 使用独立的字幕导入对话框组件 -->
<SubtitleImportDialog
  v-model="showSubtitleImportDialog"
  @import-subtitles="handleImportSubtitles"
/>
```

**删除内容**: 整个 `<el-dialog>` 块（包括注释）

**注意**: 确保 `handleImportSubtitles` 函数存在

**查找函数**:
```javascript
const handleImportSubtitles = (subtitles) => {
  // 实现导入逻辑
}
```

如果不存在，需要添加此函数。

**验证**: 测试字幕导入功能

---

## ✅ 验证清单

完成所有步骤后，逐项检查：

### 编译验证
- [ ] 运行 `npm run dev` 无编译错误
- [ ] 浏览器控制台无 Vue 警告
- [ ] `get_problems` 无语法错误

### 功能验证
- [ ] 视频操作工具栏按钮点击正常
- [ ] 录制下拉菜单展开正常
- [ ] 布局切换功能正常（单屏/双屏/画中画等）
- [ ] 字幕编辑对话框打开/保存正常
- [ ] 字幕导入对话框文件上传正常

### 性能验证
- [ ] 页面加载速度无明显下降
- [ ] 组件渲染无闪烁
- [ ] 内存占用稳定

---

## ⚠️ 常见问题与解决方案

### 问题 1: 模板标签不匹配

**症状**: `Invalid end tag` 错误

**原因**: 删除代码时误删了闭合标签

**解决**: 
1. 检查每个 opening tag 是否有对应的 closing tag
2. 使用 VSCode 的括号匹配功能辅助检查
3. 从 Git 恢复后重新执行

### 问题 2: Props 类型错误

**症状**: TypeScript 类型检查失败

**原因**: 传递的 props 类型与组件定义不符

**解决**:
1. 检查 VideoOperationToolbar 的 props 定义
2. 确保 `isRecording`, `isRecordingPaused` 等变量存在且类型正确
3. 如有必要，添加默认值：`:is-recording="isRecording || false"`

### 问题 3: 事件未触发

**症状**: 点击按钮无反应

**原因**: emit 事件未正确透传

**解决**:
1. 检查子组件是否正确调用 `emit()`
2. 检查父组件是否正确监听事件（`@event-name`）
3. 在浏览器控制台查看是否有事件监听错误

### 问题 4: 样式丢失

**症状**: 按钮/面板样式异常

**原因**: scoped 样式未正确继承

**解决**:
1. 检查新组件是否包含必要的样式
2. 如需全局样式，移除 `scoped` 属性
3. 使用 `:deep()` 选择器穿透样式

---

## 📊 预期效果

完成重构后：

| 指标 | 重构前 | 重构后 | 减少幅度 |
|------|--------|--------|---------|
| **文件大小** | 3,688 行 | ~2,900 行 | -21% |
| **模板行数** | ~500 行 | ~200 行 | -60% |
| **内联组件** | 4 个 | 0 个 | -100% |
| **可复用组件** | 0 个 | 4 个 | +∞ |

---

## 🎯 下一步工作

完成本阶段后，继续执行：

1. **删除废弃代码**
   - 删除未使用的 ref/reactive 变量
   - 删除已迁移到子组件的函数
   - 清理未使用的 imports

2. **TypeScript 化**
   - 为 TeacherWindow.vue 添加 `.ts` 扩展名
   - 为所有 props/emits 添加类型定义
   - 为 Composables 添加返回类型

3. **状态管理优化**
   - 将局部状态迁移至 Pinia Store
   - 统一通过 Composable 管理状态
   - 消除 ref/reactive 混用

---

## 📝 变更记录

| 日期 | 操作 | 状态 | 备注 |
|------|------|------|------|
| 2026-04-30 | 创建重构指南 | ✅ 完成 | 提供详细的手动操作步骤 |
| 2026-04-30 | 创建4个新组件 | ✅ 完成 | VideoOperationToolbar, LayoutManagementPanel, SubtitleEditDialog, SubtitleImportDialog |

---

**最后更新**: 2026-04-30  
**下次更新**: 完成手动重构后
