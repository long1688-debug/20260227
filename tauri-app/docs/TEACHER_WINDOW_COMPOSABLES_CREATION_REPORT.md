# TeacherWindow.vue Composables 创建报告

**执行时间**: 2026-04-30  
**状态**: ✅ **已完成**（5/5 Composables 已创建）

---

## 🎉 成果总结

### 核心成就

✅ **成功创建 5 个业务逻辑 Composables**
- 全部使用 TypeScript
- 完整的类型定义和接口
- 遵循 Vue 3 Composition API 最佳实践
- 采用依赖注入模式，不直接依赖 Pinia stores

---

## 📋 Composables 清单

### 1️⃣ **useSubtitleManager.ts** - 字幕管理

**路径**: `src/composables/useSubtitleManager.ts`

**职责**:
- 管理字幕的编辑、导入、删除等操作
- 与 subtitleStore 交互（通过参数传入）
- 提供字幕相关的业务逻辑

**接口定义**:
```typescript
interface SubtitleItem {
  startTime: string
  endTime: string
  text: string
  index?: number
}

interface SubtitleStoreLike {
  subtitles: SubtitleItem[]
  updateSubtitle: (index: number, data: Partial<SubtitleItem>) => void
  removeSubtitle: (index: number) => void
  addSubtitle: (subtitle: Omit<SubtitleItem, 'index'>) => void
}
```

**返回值**:
```typescript
{
  showSubtitleEditDialog: Ref<boolean>
  editingSubtitle: Ref<SubtitleItem | null>
  editSubtitle: (videoIndex: number, subtitleIndex: number) => void
  saveEditedSubtitle: () => void
  deleteSubtitle: (videoIndex: number, subtitleIndex: number) => void
  handleImportSubtitles: (subtitles: SubtitleItem[]) => void
}
```

**使用示例**:
```typescript
import { useSubtitleManager } from '@/composables/useSubtitleManager'
import { useSubtitleStore } from '@/stores/subtitleStore'

const subtitleStore = useSubtitleStore()
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
```

---

### 2️⃣ **useLayoutManager.ts** - 布局管理

**路径**: `src/composables/useLayoutManager.ts`

**职责**:
- 管理分屏布局切换（1/2/3/4/6/9 宫格）
- 管理画中画布局（位置切换、显示/隐藏）
- 管理自由布局和自定义格子数量

**枚举定义**:
```typescript
enum LayoutType {
  FREE = 0,        // 自由布局
  SINGLE = 1,      // 单屏
  DOUBLE = 2,      // 双屏
  TRIPLE = 3,      // 三屏
  QUAD = 4,        // 四屏
  SIX = 6,         // 六屏
  NINE = 9         // 九屏
}

enum PipPosition {
  TOP_LEFT = 'top-left',
  TOP_RIGHT = 'top-right',
  BOTTOM_LEFT = 'bottom-left',
  BOTTOM_RIGHT = 'bottom-right'
}
```

**返回值**:
```typescript
{
  currentLayout: Ref<number>
  pipVisible: Ref<boolean>
  pipPosition: Ref<string>
  customGridCount: Ref<number>
  handleLayoutChange: (newLayout: number, pipPosition?: string) => Promise<void>
  handlePipToggle: (position?: string) => void
  handleCustomCountChange: (value: number) => void
}
```

---

### 3️⃣ **useSourceManager.ts** - 信号源管理

**路径**: `src/composables/useSourceManager.ts`

**职责**:
- 管理信号源的添加、删除、重命名等操作
- 管理采集卡设备列表
- 管理高拍仪设备列表

**枚举定义**:
```typescript
enum SourceType {
  CAMERA = 'camera',
  CAPTURE_CARD = 'captureCard',
  SCANNER = 'scanner',
  SCREEN = 'screen',
  FILE = 'file',
  RTMP = 'rtmp'
}
```

**返回值**:
```typescript
{
  showAddSourceDialog: Ref<boolean>
  captureDevices: Ref<CaptureDevice[]>
  scannerDevices: Ref<CaptureDevice[]>
  openAddSourceDialog: () => void
  closeAddSourceDialog: () => void
  addSource: (source: Partial<VideoSource>) => Promise<void>
  deleteSource: (sourceId: string) => void
  renameSource: (sourceId: string, newName: string) => void
  refreshDevices: () => Promise<void>
}
```

---

### 4️⃣ **useAudioManager.ts** - 音频管理

**路径**: `src/composables/useAudioManager.ts`

**职责**:
- 管理麦克风设备选择和状态
- 管理音频混音器控制
- 管理音频监控和可视化

**返回值**:
```typescript
{
  microphoneDevices: Ref<AudioDevice[]>
  selectedMicrophoneId: Ref<string>
  audioChannels: Ref<AudioChannel[]>
  refreshMicrophones: () => Promise<void>
  selectMicrophone: (deviceId: string) => void
  toggleMicrophoneMute: () => void
  adjustChannelVolume: (channelId: string, volume: number) => void
  toggleChannelMute: (channelId: string) => void
}
```

**特性**:
- 自动枚举系统音频设备
- 音量范围限制（0-100）
- 静音状态切换

---

### 5️⃣ **useLiveStream.ts** - 直播管理

**路径**: `src/composables/useLiveStream.ts`

**职责**:
- 管理 RTMP 推流状态和配置
- 管理直播开始/停止
- 管理直播统计信息

**接口定义**:
```typescript
interface RtmpConfig {
  url: string
  streamKey: string
  bitrate: number
  resolution: string
  fps: number
}

interface LiveStreamState {
  isStreaming: boolean
  startTime?: number
  duration?: number
  viewers?: number
  bitrate?: number
}
```

**返回值**:
```typescript
{
  showRtmpDialog: Ref<boolean>
  rtmpConfig: Ref<RtmpConfig>
  liveStreamState: Ref<LiveStreamState>
  openRtmpDialog: () => void
  closeRtmpDialog: () => void
  startLiveStream: () => Promise<void>
  stopLiveStream: () => Promise<void>
  updateRtmpConfig: (config: Partial<RtmpConfig>) => void
  saveRtmpConfig: () => void
}
```

---

## 🔧 设计亮点

### 1. 依赖注入模式

所有 Composables 都采用**依赖注入**模式，而非直接 import stores：

```typescript
// ❌ 错误做法（硬编码依赖）
import { useSubtitleStore } from '@/stores/subtitleStore'

export function useSubtitleManager() {
  const store = useSubtitleStore()  // 紧耦合
}

// ✅ 正确做法（依赖注入）
export function useSubtitleManager(options: {
  subtitleStore?: SubtitleStoreLike
} = {}) {
  const store = options.subtitleStore  // 松耦合
}
```

**优势**:
- ✅ 易于单元测试（可以传入 mock store）
- ✅ 灵活性高（可以使用不同的 store 实现）
- ✅ 避免循环依赖
- ✅ 符合 SOLID 原则

---

### 2. 完整的 TypeScript 类型定义

每个 Composable 都有：
- ✅ Props 接口（Options）
- ✅ Return 接口
- ✅ 数据模型接口
- ✅ Store 接口（Like 模式）

**示例**:
```typescript
interface UseSubtitleManagerOptions {
  subtitleStore?: SubtitleStoreLike
  showSubtitleEditDialog?: Ref<boolean>
  editingSubtitle?: Ref<SubtitleItem | null>
}

interface UseSubtitleManagerReturn {
  showSubtitleEditDialog: Ref<boolean>
  editingSubtitle: Ref<SubtitleItem | null>
  editSubtitle: (videoIndex: number, subtitleIndex: number) => void
  // ...
}
```

---

### 3. 统一的错误处理

所有函数都包含 try-catch 块：

```typescript
const saveEditedSubtitle = () => {
  try {
    if (!subtitleStore) {
      console.warn('[字幕管理] subtitleStore 未提供')
      return
    }
    
    // 业务逻辑...
    
    ElMessage.success('字幕保存成功')
  } catch (error) {
    console.error('[字幕管理] 保存字幕失败:', error)
    ElMessage.error('保存字幕失败')
  }
}
```

**特点**:
- ✅ 防御性检查（store 是否存在）
- ✅ 用户友好的错误提示（ElMessage）
- ✅ 详细的控制台日志（便于调试）

---

### 4. 响应式引用管理

支持外部传入或内部创建：

```typescript
const showSubtitleEditDialog = options.showSubtitleEditDialog || ref(false)
const editingSubtitle = options.editingSubtitle || ref<SubtitleItem | null>(null)
```

**优势**:
- ✅ 可以与现有组件的状态无缝集成
- ✅ 也可以独立使用（自动创建内部状态）
- ✅ 灵活适配不同场景

---

## 📊 代码量统计

| Composable | 行数 | 接口数 | 函数数 | 复杂度 |
|-----------|------|-------|--------|--------|
| useSubtitleManager | ~170 | 3 | 4 | 低 |
| useLayoutManager | ~180 | 4 | 3 | 中 |
| useSourceManager | ~200 | 4 | 5 | 中 |
| useAudioManager | ~190 | 3 | 4 | 中 |
| useLiveStream | ~210 | 3 | 5 | 中 |
| **总计** | **~950 行** | **17** | **21** | **中** |

---

## 🎯 下一步行动

### 立即执行（今天）

1. ⏳ **在 TeacherWindow.vue 中引入 Composables**
   ```typescript
   import { useSubtitleManager } from '@/composables/useSubtitleManager'
   import { useLayoutManager } from '@/composables/useLayoutManager'
   // ...
   ```

2. ⏳ **迁移现有逻辑到 Composables**
   - 将 TeacherWindow.vue 中的字幕相关函数替换为 Composable
   - 将布局相关函数替换为 Composable
   - 将信号源相关函数替换为 Composable
   - 将音频相关函数替换为 Composable
   - 将直播相关函数替换为 Composable

3. ⏳ **验证功能正常**
   - 编译无错误
   - 运行时功能正常
   - 状态同步正确

### 本周完成

4. ⏳ **删除废弃代码**
   - 清理 TeacherWindow.vue 中已迁移的函数
   - 删除未使用的 ref/reactive 变量
   - 移除冗余 imports

5. ⏳ **编写单元测试**
   - 为每个 Composable 编写单元测试
   - 测试边界情况
   - 测试错误处理

---

## ⚠️ 注意事项

### 1. Store 接口兼容性

确保实际的 store 实现了 Composable 定义的 Like 接口：

```typescript
// 在 subtitleStore.js 中
export const useSubtitleStore = defineStore('subtitle', {
  state: () => ({
    subtitles: []
  }),
  actions: {
    updateSubtitle(index, data) { /* ... */ },
    removeSubtitle(index) { /* ... */ },
    addSubtitle(subtitle) { /* ... */ }
  }
})
```

### 2. 响应式引用共享

当在多个组件中使用同一个 Composable 时，确保传入相同的 refs：

```typescript
// 父组件
const showSubtitleEditDialog = ref(false)
const { editSubtitle } = useSubtitleManager({ showSubtitleEditDialog })

// 子组件（需要传入相同的 ref）
const { saveEditedSubtitle } = useSubtitleManager({ showSubtitleEditDialog })
```

### 3. 生命周期管理

Composables 中如果有副作用（如事件监听），需要在组件卸载时清理：

```typescript
import { onUnmounted } from 'vue'

export function useAudioManager() {
  const cleanup = () => {
    // 清理事件监听器等
  }
  
  onUnmounted(cleanup)
  
  return { /* ... */ }
}
```

---

## 📝 变更记录

| 日期 | 操作 | 负责人 | 备注 |
|------|------|--------|------|
| 2026-04-30 | 创建 5 个 Composables | AI Assistant | useSubtitleManager, useLayoutManager, useSourceManager, useAudioManager, useLiveStream |

---

## 🎊 总结

本次成功创建了 **5 个高质量、类型安全的业务逻辑 Composables**，标志着 TeacherWindow.vue 重构进入了逻辑迁移阶段：

**核心成果**:
- ✅ 创建了 5 个 Composables（总计 ~950 行）
- ✅ 所有 Composables 具备完整的 TypeScript 类型定义
- ✅ 采用依赖注入模式，避免硬编码依赖
- ✅ 统一的错误处理和日志记录
- ✅ 灵活的响应式引用管理

**下一步**:
将这些 Composables 集成到 TeacherWindow.vue 中，替换现有的内联函数，进一步减少代码量并提升可维护性。

---

**报告生成时间**: 2026-04-30 15:00  
**下次更新**: 完成 Composables 集成和废弃代码清理后
