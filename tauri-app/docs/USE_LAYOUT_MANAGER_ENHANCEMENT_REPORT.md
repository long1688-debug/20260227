# useLayoutManager.ts 布局增强修改报告

**修改时间**: 2026-04-30  
**状态**: ✅ **已完成**

---

## 🎯 修改目标

1. ✅ 增加 16、25、36、49 屏布局支持
2. ✅ 将画中画改为固定模式（移除开关功能）
3. ✅ 简化 API，移除 `pipVisible` 相关逻辑

---

## 📋 主要变更

### 1️⃣ 新增布局类型枚举

**修改前**:
```typescript
export enum LayoutType {
  FREE = 0,        // 自由布局
  SINGLE = 1,      // 单屏
  DOUBLE = 2,      // 双屏
  TRIPLE = 3,      // 三屏
  QUAD = 4,        // 四屏
  SIX = 6,         // 六屏
  NINE = 9         // 九屏
}
```

**修改后**:
```typescript
export enum LayoutType {
  FREE = 0,        // 自由布局
  SINGLE = 1,      // 单屏
  DOUBLE = 2,      // 双屏
  TRIPLE = 3,      // 三屏
  QUAD = 4,        // 四屏
  SIX = 6,         // 六屏
  NINE = 9,        // 九屏
  SIXTEEN = 16,    // ✨ 十六屏
  TWENTY_FIVE = 25, // ✨ 二十五屏
  THIRTY_SIX = 36,  // ✨ 三十六屏
  FORTY_NINE = 49   // ✨ 四十九屏
}
```

---

### 2️⃣ 画中画改为固定模式

#### 接口变更

**LayoutInfo 接口**:
```typescript
// 修改前
interface LayoutInfo {
  type: number
  pipVisible: boolean    // ❌ 移除
  pipPosition: string
}

// 修改后
interface LayoutInfo {
  type: number
  pipPosition: string    // ✅ 固定显示，只需位置
}
```

**LayoutStoreLike 接口**:
```typescript
// 修改前
interface LayoutStoreLike {
  setLayout: (layout: LayoutInfo) => void
  setPipVisible: (visible: boolean) => void  // ❌ 移除
  setPipPosition: (position: string) => void
  setCustomGridCount: (count: number) => void
}

// 修改后
interface LayoutStoreLike {
  setLayout: (layout: LayoutInfo) => void
  setPipPosition: (position: string) => void  // ✅ 保留
  setCustomGridCount: (count: number) => void
}
```

---

### 3️⃣ 返回值变更

**UseLayoutManagerReturn 接口**:
```typescript
// 修改前
interface UseLayoutManagerReturn {
  currentLayout: Ref<number>
  pipVisible: Ref<boolean>          // ❌ 移除
  pipPosition: Ref<string>
  customGridCount: Ref<number>
  handleLayoutChange: (...) => Promise<void>
  handlePipToggle: (position?: string) => void  // ❌ 移除
  handleCustomCountChange: (value: number) => void
}

// 修改后
interface UseLayoutManagerReturn {
  currentLayout: Ref<number>
  pipPosition: Ref<string>           // ✅ 保留
  customGridCount: Ref<number>
  handleLayoutChange: (...) => Promise<void>
  setPipPosition: (position: string) => void  // ✨ 新增
  handleCustomCountChange: (value: number) => void
}
```

---

### 4️⃣ 函数变更

#### 移除的函数
- ❌ `handlePipToggle(position?: string)` - 画中画切换（已废弃）

#### 新增的函数
- ✨ `setPipPosition(position: string)` - 设置画中画位置

**新函数实现**:
```typescript
/**
 * 设置画中画位置
 * @param position 画中画位置
 */
const setPipPosition = (position: string) => {
  try {
    pipPosition.value = position
    console.log('[布局管理] 设置画中画位置:', position)
    
    // 更新 store
    if (layoutStore) {
      layoutStore.setPipPosition(position)
    }
  } catch (error) {
    console.error('[布局管理] 设置画中画位置失败:', error)
    ElMessage.error('设置失败')
  }
}
```

---

### 5️⃣ handleLayoutChange 函数优化

**修改前**:
```typescript
const handleLayoutChange = async (newLayout: number, pipPos?: string) => {
  // ...
  if (pipPos !== undefined) {
    if (pipPos) {
      pipPosition.value = pipPos
      pipVisible.value = true    // ❌ 需要控制显示/隐藏
    } else {
      pipVisible.value = false
    }
  }
  
  if (layoutStore) {
    layoutStore.setLayout({
      type: newLayout,
      pipVisible: pipVisible.value,  // ❌ 需要传递可见性
      pipPosition: pipPosition.value
    })
  }
  // ...
}
```

**修改后**:
```typescript
const handleLayoutChange = async (newLayout: number, pipPos?: string) => {
  // ...
  // 如果提供了画中画位置，更新画中画位置
  if (pipPos !== undefined && pipPos) {
    pipPosition.value = pipPos
  }
  
  if (layoutStore) {
    layoutStore.setLayout({
      type: newLayout,
      pipPosition: pipPosition.value  // ✅ 只需位置
    })
  }
  // ...
}
```

---

### 6️⃣ getLayoutName 函数扩展

**修改前**:
```typescript
const getLayoutName = (layout: number): string => {
  const names: Record<number, string> = {
    [LayoutType.FREE]: '自由',
    [LayoutType.SINGLE]: '单屏',
    [LayoutType.DOUBLE]: '双屏',
    [LayoutType.TRIPLE]: '三屏',
    [LayoutType.QUAD]: '四屏',
    [LayoutType.SIX]: '六屏',
    [LayoutType.NINE]: '九屏'
  }
  return names[layout] || '未知'
}
```

**修改后**:
```typescript
const getLayoutName = (layout: number): string => {
  const names: Record<number, string> = {
    [LayoutType.FREE]: '自由',
    [LayoutType.SINGLE]: '单屏',
    [LayoutType.DOUBLE]: '双屏',
    [LayoutType.TRIPLE]: '三屏',
    [LayoutType.QUAD]: '四屏',
    [LayoutType.SIX]: '六屏',
    [LayoutType.NINE]: '九屏',
    [LayoutType.SIXTEEN]: '十六屏',       // ✨ 新增
    [LayoutType.TWENTY_FIVE]: '二十五屏', // ✨ 新增
    [LayoutType.THIRTY_SIX]: '三十六屏',  // ✨ 新增
    [LayoutType.FORTY_NINE]: '四十九屏'   // ✨ 新增
  }
  return names[layout] || '未知'
}
```

---

## 📊 布局网格对照表

| 布局类型 | 枚举值 | 网格尺寸 | 适用场景 |
|---------|--------|---------|---------|
| 单屏 | `SINGLE = 1` | 1×1 | 单一视频源 |
| 双屏 | `DOUBLE = 2` | 1×2 | 教师+学生 |
| 三屏 | `TRIPLE = 3` | 1×3 | 教师+学生+课件 |
| 四屏 | `QUAD = 4` | 2×2 | 标准四分屏 |
| 六屏 | `SIX = 6` | 2×3 | 多机位监控 |
| 九屏 | `NINE = 9` | 3×3 | 大型课堂 |
| **十六屏** | **`SIXTEEN = 16`** | **4×4** | **✨ 超大型教室** |
| **二十五屏** | **`TWENTY_FIVE = 25`** | **5×5** | **✨ 会议室监控** |
| **三十六屏** | **`THIRTY_SIX = 36`** | **6×6** | **✨ 多教室集中监控** |
| **四十九屏** | **`FORTY_NINE = 49`** | **7×7** | **✨ 全校监控中心** |

---

## 🎨 画中画固定模式说明

### 设计理念

**修改前**: 画中画需要手动开启/关闭，增加了用户操作复杂度

**修改后**: 画中画始终显示，用户只需选择位置即可

### 优势

1. ✅ **简化交互**: 减少一次点击操作
2. ✅ **视觉一致性**: 所有布局下都有画中画，体验统一
3. ✅ **降低学习成本**: 无需理解"开关"概念
4. ✅ **符合直觉**: 小窗口始终存在，更符合用户对"画中画"的认知

### 使用方式

```typescript
// 旧方式（已废弃）
handlePipToggle('top-right')  // 开启/切换位置
handlePipToggle()             // 关闭

// 新方式
setPipPosition('top-right')   // 直接设置位置
```

---

## 🔧 迁移指南

### 对于使用此 Composable 的组件

#### 1. 移除 `pipVisible` 引用

**修改前**:
```typescript
const { 
  currentLayout,
  pipVisible,      // ❌ 移除
  pipPosition,
  customGridCount,
  handleLayoutChange,
  handlePipToggle, // ❌ 移除
  handleCustomCountChange
} = useLayoutManager()
```

**修改后**:
```typescript
const { 
  currentLayout,
  pipPosition,
  customGridCount,
  handleLayoutChange,
  setPipPosition,  // ✨ 新增
  handleCustomCountChange
} = useLayoutManager()
```

#### 2. 替换画中画切换逻辑

**修改前**:
```vue
<!-- 模板中 -->
<button @click="handlePipToggle('top-right')">开启画中画</button>
<button @click="handlePipToggle()">关闭画中画</button>

<!-- 或者条件渲染 -->
<div v-if="pipVisible">画中画内容</div>
```

**修改后**:
```vue
<!-- 模板中 -->
<button @click="setPipPosition('top-right')">右上角</button>
<button @click="setPipPosition('bottom-left')">左下角</button>

<!-- 始终显示，无需条件判断 -->
<div>画中画内容</div>
```

#### 3. 更新 Store 调用

如果你的 store 实现了 `LayoutStoreLike` 接口，需要移除 `setPipVisible` 方法：

**修改前**:
```typescript
// store 中
actions: {
  setPipVisible(visible: boolean) {
    this.pipVisible = visible
  },
  setPipPosition(position: string) {
    this.pipPosition = position
  }
}
```

**修改后**:
```typescript
// store 中
actions: {
  // setPipVisible 已移除
  setPipPosition(position: string) {
    this.pipPosition = position
  }
}
```

---

## ✅ 验证结果

### 编译验证
- ✅ 无语法错误
- ✅ 无 TypeScript 类型错误
- ✅ Vite 编译成功

### 功能验证（待测试）
- ⏳ 16 屏布局切换正常
- ⏳ 25 屏布局切换正常
- ⏳ 36 屏布局切换正常
- ⏳ 49 屏布局切换正常
- ⏳ 画中画位置切换正常
- ⏳ 画中画始终显示

---

## 📝 变更记录

| 日期 | 操作 | 负责人 | 备注 |
|------|------|--------|------|
| 2026-04-30 | 增加 16/25/36/49 屏布局 | AI Assistant | 新增 4 种布局类型 |
| 2026-04-30 | 画中画改为固定模式 | AI Assistant | 移除 pipVisible 和 handlePipToggle |

---

## 🎊 总结

本次修改成功增强了 `useLayoutManager.ts` 的功能：

**核心成果**:
- ✅ 新增 4 种超大屏布局（16/25/36/49）
- ✅ 简化画中画交互（固定显示，只需设置位置）
- ✅ 移除冗余状态（`pipVisible`）
- ✅ 优化 API 设计（更简洁直观）

**影响范围**:
- 需要更新所有使用 `useLayoutManager` 的组件
- 需要更新对应的 Store 实现
- 需要更新相关的 UI 组件（移除画中画开关按钮）

**下一步**:
在 TeacherWindow.vue 和相关组件中应用这些变更，并测试新布局的实际效果。

---

**报告生成时间**: 2026-04-30 15:30
