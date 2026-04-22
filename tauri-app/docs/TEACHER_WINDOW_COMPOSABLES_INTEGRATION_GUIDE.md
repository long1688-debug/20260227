# TeacherWindow.vue Composables 集成指南

**创建时间**: 2026-04-30  
**状态**: 📋 **待执行**（需要手动操作）

---

## 🎯 集成目标

将 5 个新创建的 Composables 集成到 [`TeacherWindow.vue`](file://f:\20260227\tauri-app\src\components\TeacherWindow.vue#L1-L1) 中，替换现有的内联函数和状态。

---

## 📋 集成步骤

### 步骤 1: 添加导入语句 ✅ 已完成

在 `TeacherWindow.vue` 的 `<script setup>` 部分，找到现有 Composables 导入位置（约第 245-250 行），添加以下代码：

```javascript
// 🆕 业务逻辑 Composables（新创建）
import { useSubtitleManager } from '@/composables/useSubtitleManager'
import { useLayoutManager } from '@/composables/useLayoutManager'
import { useSourceManager } from '@/composables/useSourceManager'
import { useAudioManager } from '@/composables/useAudioManager'
import { useLiveStream } from '@/composables/useLiveStream'
```

**当前状态**: ✅ 已完成

---

### 步骤 2: 初始化 Composables ⏳ 待执行

在 stores 初始化之后（约第 385 行），添加以下代码：

```javascript
const sourceStore = useSourceStore()
const subtitleStore = useSubtitleStore()
const videoSourceManager = useVideoSourceManager()

// ============================================
// 🆕 业务逻辑 Composables 初始化
// ============================================

// 字幕管理 Composable
const {
  showSubtitleEditDialog,
  editingSubtitle,
  editSubtitle,
  saveEditedSubtitle,
  deleteSubtitle,
  handleImportSubtitles
} = useSubtitleManager({
  subtitleStore,
  showSubtitleEditDialog: ref(false),
  editingSubtitle: ref(null)
})

// 布局管理 Composable（注意：pipVisible 已移除，画中画改为固定模式）
const {
  currentLayout,
  pipPosition,
  customGridCount,
  handleLayoutChange,
  setPipPosition,
  handleCustomCountChange
} = useLayoutManager({
  currentLayout: ref(1), // 默认单屏
  pipPosition: ref('top-right'), // 默认右上角
  customGridCount: ref(4) // 默认4个格子
})

// 信号源管理 Composable
const {
  showAddSourceDialog: showAddSourceDialogFromComposable,
  captureDevices: captureDevicesList,
  scannerDevices: scannerDevicesList,
  openAddSourceDialog,
  closeAddSourceDialog,
  addSource,
  deleteSource,
  renameSource,
  refreshDevices
} = useSourceManager({
  sourceStore,
  showAddSourceDialog: ref(false),
  captureDevices: ref([]),
  scannerDevices: ref([])
})

// 音频管理 Composable
const {
  microphoneDevices,
  selectedMicrophoneId,
  audioChannels,
  refreshMicrophones,
  selectMicrophone,
  toggleMicrophoneMute,
  adjustChannelVolume,
  toggleChannelMute
} = useAudioManager({
  audioStore: undefined, // TODO: 传入 audioStore
  microphoneDevices: ref([]),
  selectedMicrophoneId: ref(''),
  audioChannels: ref([])
})

// 直播管理 Composable
const {
  showRtmpDialog: showRtmpDialogFromComposable,
  rtmpConfig,
  liveStreamState,
  openRtmpDialog,
  closeRtmpDialog,
  startLiveStream,
  stopLiveStream,
  updateRtmpConfig,
  saveRtmpConfig
} = useLiveStream({
  liveStreamingStore: undefined, // TODO: 传入 liveStreamingStore
  showRtmpDialog: ref(false),
  rtmpConfig: ref({
    url: '',
    streamKey: '',
    bitrate: 2500,
    resolution: '1920x1080',
    fps: 30
  }),
  liveStreamState: ref({
    isStreaming: false,
    startTime: undefined,
    duration: 0,
    viewers: 0,
    bitrate: 0
  })
})
```

**注意事项**:
1. ⚠️ `showAddSourceDialog` 重命名为 `showAddSourceDialogFromComposable`，避免与现有变量冲突
2. ⚠️ `showRtmpDialog` 重命名为 `showRtmpDialogFromComposable`，避免与现有变量冲突
3. ⚠️ `audioStore` 和 `liveStreamingStore` 暂时传 `undefined`，需要后续创建对应的 Store

---

### 步骤 3: 删除重复的状态定义 ⏳ 待执行

在步骤 2 完成后，需要删除以下重复的状态定义（约第 606-645 行）：

```javascript
// ❌ 删除这些重复定义
const showSubtitleEditDialog = ref(false)  // 已由 Composable 提供
const customGridCount = ref(4)  // 已由 Composable 提供
const handleCustomCountChange = (value) => { ... }  // 已由 Composable 提供
```

**查找位置**:
- 搜索 `const showSubtitleEditDialog = ref(false)`
- 搜索 `const customGridCount = ref(4)`
- 搜索 `const handleCustomCountChange`

---

### 步骤 4: 删除重复的函数定义 ⏳ 待执行

删除以下已被 Composable 替代的函数：

#### 4.1 字幕相关函数（约第 1266-1320 行）
```javascript
// ❌ 删除这些函数
const editSubtitle = (videoIndex, subtitleIndex) => { ... }
const saveEditedSubtitle = () => { ... }
const deleteSubtitle = (videoIndex, subtitleIndex) => { ... }
```

#### 4.2 布局相关函数（约第 1730-1750 行）
```javascript
// ❌ 删除这些函数
const handlePipToggle = (position) => { ... }  // 已废弃
const handleLayoutChange = async (newLayout, pipPosition = '') => { ... }
```

**注意**: 
- [handlePipToggle](file://f:\20260227\tauri-app\src\composables\useLayoutManager.ts#L130-L148) 已被移除（画中画改为固定模式）
- 使用新的 [setPipPosition](file://f:\20260227\tauri-app\src\composables\useLayoutManager.ts#L130-L148) 函数替代

#### 4.3 字幕导入函数（约第 2549 行）
```javascript
// ❌ 删除这个函数
const handleImportSubtitles = async () => { ... }
```

---

### 步骤 5: 更新模板中的引用 ⏳ 待执行

检查并更新模板中使用这些函数的地方：

#### 5.1 字幕编辑对话框
```vue
<!-- 修改前 -->
<SubtitleEditDialog
  v-model="showSubtitleEditDialog"
  :subtitle="editingSubtitle"
  @save="saveEditedSubtitle"
/>

<!-- 修改后：无需修改，Composable 已提供相同名称 -->
```

#### 5.2 布局管理面板
```vue
<!-- 修改前 -->
<LayoutManagementPanel
  :current-layout="currentLayout"
  :pip-visible="pipVisible"  <!-- ❌ 移除 -->
  :pip-position="pipPosition"
  :custom-grid-count="customGridCount"
  @layout-change="handleLayoutChange"
  @pip-toggle="handlePipToggle"  <!-- ❌ 移除 -->
  @custom-count-change="handleCustomCountChange"
/>

<!-- 修改后 -->
<LayoutManagementPanel
  :current-layout="currentLayout"
  :pip-position="pipPosition"  <!-- ✅ 保留 -->
  :custom-grid-count="customGridCount"
  @layout-change="handleLayoutChange"
  @pip-position-change="setPipPosition"  <!-- ✨ 新增 -->
  @custom-count-change="handleCustomCountChange"
/>
```

#### 5.3 信号源管理
```vue
<!-- 修改前 -->
<SourceManagementShortcut @show-add-source="showAddSourceDialog = true" />

<!-- 修改后 -->
<SourceManagementShortcut @show-add-source="openAddSourceDialog" />
```

---

### 步骤 6: 处理命名冲突 ⏳ 待执行

由于 Composables 返回的变量名可能与现有变量冲突，需要进行重命名或合并：

#### 6.1 showAddSourceDialog
```javascript
// 方案 A: 使用 Composable 提供的版本
const showAddSourceDialog = showAddSourceDialogFromComposable

// 方案 B: 保持现有变量，手动同步
watch(showAddSourceDialogFromComposable, (newVal) => {
  showAddSourceDialog.value = newVal
})
```

#### 6.2 showRtmpDialog
```javascript
// 方案 A: 使用 Composable 提供的版本
const showRtmpDialog = showRtmpDialogFromComposable

// 方案 B: 保持现有变量，手动同步
watch(showRtmpDialogFromComposable, (newVal) => {
  showRtmpDialog.value = newVal
})
```

**推荐**: 使用方案 A，直接使用 Composable 提供的变量

---

### 步骤 7: 验证编译 ⏳ 待执行

完成上述步骤后，执行以下命令验证：

```bash
cd f:\20260227\tauri-app
npm run dev
```

**预期结果**:
- ✅ 无语法错误
- ✅ 无 TypeScript 类型错误
- ✅ Vite 编译成功
- ✅ 应用正常启动

---

### 步骤 8: 功能测试 ⏳ 待执行

在浏览器中测试以下功能：

| 功能模块 | 测试要点 | 状态 |
|---------|---------|------|
| **字幕编辑** | 打开对话框、编辑、保存 | ☐ |
| **字幕导入** | 上传 SRT/JSON/TXT 文件 | ☐ |
| **布局切换** | 切换到 16/25/36/49 屏 | ☐ |
| **画中画** | 切换位置（右上/右下/左上/左下） | ☐ |
| **信号源管理** | 添加、删除、重命名信号源 | ☐ |
| **音频管理** | 选择麦克风、调整音量 | ☐ |
| **直播推流** | 配置 RTMP、开始/停止直播 | ☐ |

---

## ⚠️ 注意事项

### 1. 依赖注入问题

目前 `useAudioManager` 和 `useLiveStream` 的 store 参数传的是 `undefined`，需要：

**选项 A**: 创建对应的 Store
- `audioStore.js` - 音频管理 Store
- `liveStreamingStore.js` - 直播管理 Store

**选项 B**: 暂时不使用这些 Composables 的 store 相关功能
- 仅使用设备枚举等不依赖 store 的功能
- 等到 Store 创建完成后再完整集成

### 2. 画中画固定模式

[useLayoutManager](file://f:\20260227\tauri-app\src\composables\useLayoutManager.ts#L1-L1) 已移除 `pipVisible` 状态，需要：
- 从所有组件中移除画中画开关按钮
- 画中画始终显示，只需设置位置
- 更新 [LayoutManagementPanel.vue](file://f:\20260227\tauri-app\src\components\teacher-window\panels\LayoutManagementPanel.vue#L1-L1) 的 UI

### 3. 新增布局类型

需要在 UI 中添加 16/25/36/49 屏的按钮：
- 更新 [LayoutManagementPanel.vue](file://f:\20260227\tauri-app\src\components\teacher-window\panels\LayoutManagementPanel.vue#L1-L1)
- 确保视频网格能正确渲染超大屏布局

---

## 📊 集成进度跟踪

| 步骤 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 1 | 添加导入语句 | ✅ 已完成 | - |
| 2 | 初始化 Composables | ⏳ 待执行 | 需手动添加代码 |
| 3 | 删除重复状态定义 | ⏳ 待执行 | 约 3-5 处 |
| 4 | 删除重复函数定义 | ⏳ 待执行 | 约 5-7 个函数 |
| 5 | 更新模板引用 | ⏳ 待执行 | 检查所有绑定 |
| 6 | 处理命名冲突 | ⏳ 待执行 | 2 处冲突 |
| 7 | 验证编译 | ⏳ 待执行 | npm run dev |
| 8 | 功能测试 | ⏳ 待执行 | 7 个模块 |

---

## 🔧 自动化脚本建议

为了简化集成过程，可以创建一个自动化脚本：

```javascript
// utils/integrate-composables.js
const fs = require('fs')
const path = require('path')

const teacherWindowPath = path.join(__dirname, '../tauri-app/src/components/TeacherWindow.vue')
let content = fs.readFileSync(teacherWindowPath, 'utf-8')

// 1. 添加导入语句
content = content.replace(
  /import { useSettings } from '@\/composables\/useSettings'/,
  `import { useSettings } from '@/composables/useSettings'

// 🆕 业务逻辑 Composables
import { useSubtitleManager } from '@/composables/useSubtitleManager'
import { useLayoutManager } from '@/composables/useLayoutManager'
import { useSourceManager } from '@/composables/useSourceManager'
import { useAudioManager } from '@/composables/useAudioManager'
import { useLiveStream } from '@/composables/useLiveStream'`
)

// 2. 添加初始化代码（在 stores 初始化后）
// ...

fs.writeFileSync(teacherWindowPath, content)
console.log('✅ Composables 集成完成')
```

---

## 🎊 总结

完成 Composables 集成后，TeacherWindow.vue 将获得以下改进：

**代码质量提升**:
- ✅ 减少 ~200 行内联函数代码
- ✅ 业务逻辑集中管理，易于维护
- ✅ 完整的 TypeScript 类型支持
- ✅ 统一的错误处理机制

**可维护性提升**:
- ✅ 单一职责原则（每个 Composable 专注一个领域）
- ✅ 依赖注入模式（松耦合）
- ✅ 易于单元测试
- ✅ 便于复用

**下一步**:
1. 按照本指南逐步执行集成步骤
2. 创建缺失的 Store（audioStore、liveStreamingStore）
3. 更新相关 UI 组件（LayoutManagementPanel 等）
4. 进行全面功能测试

---

**指南创建时间**: 2026-04-30 15:45  
**预计完成时间**: 1-2 小时（手动操作）
