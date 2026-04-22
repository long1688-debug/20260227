# 布局切换功能修复说明

## 修复内容

### 问题描述

在 Tauri 桌面应用中，点击右侧面板的布局按钮时出现"切换布局失败"错误。

### 根本原因

在 `TeacherWindow.vue` 的 `handleLayoutChange` 函数中，`isNewFreeLayout` 常量被声明了两次：

- 第一次在第 1857 行
- 第二次在第 1892 行（已删除）

这导致 JavaScript 抛出 "Identifier 'isNewFreeLayout' has already been declared" 错误。

### 修复方案

1. **修复变量作用域问题**
   - 将 `isNewFreeLayout` 和 `isOldFreeLayout` 的声明移到 if 块外部（第 1842-1843 行）
   - 确保在函数开头就声明这两个变量，无论 if 条件是否满足都能访问
   - 添加注释说明必须在 if 块外声明

2. **增强错误处理**
   - 添加参数验证（检查 undefined/null）
   - 增强日志输出（包含类型信息、堆栈跟踪）
   - 添加安全检查（防止记录状态时再次出错）
   - 改进错误消息（显示具体错误原因）

3. **优化代码结构**
   - 将 `isNewFreeLayout` 和 `isOldFreeLayout` 统一在函数开头声明
   - 确保所有使用该变量的地方都能正确访问

## 验证步骤

### 1. 启动应用

```bash
cd f:\20260227\tauri-app
npm run tauri dev
```

### 2. 打开开发者工具

在 Tauri 应用中按 `Ctrl+Shift+I`（Windows）打开开发者工具

### 3. 测试布局切换

1. 点击右侧面板的"布局"按钮
2. 尝试切换到不同的布局：
   - 1分屏
   - 2分屏
   - 4分屏
   - 9分屏
   - 16分屏
   - 特殊布局
   - 自由布局

### 4. 检查控制台日志

应该看到以下日志：

```
[布局切换] handleLayoutChange 被调用: newLayout=1, typeof=number
[布局切换] oldLayout=18, currentLayout.value=18
[布局切换] 保存旧布局 18 的状态
[布局切换] 已保存自由布局 18 的信号源: X 个
[布局切换] 从 layoutStates 加载新布局 1 的配置
[布局切换] 新布局有效索引: [1]
```

### 5. 验证功能

- ✅ 布局切换成功，无错误提示
- ✅ 信号源正确显示在新布局中
- ✅ 布局状态正确保存和恢复
- ✅ 可以在不同布局之间自由切换

## 修改的文件

- `f:\20260227\tauri-app\src\components\TeacherWindow.vue`
  - 第 1824-2066 行：`handleLayoutChange` 函数

## 技术细节

### 变量作用域

```javascript
const handleLayoutChange = async (newLayout) => {
  // 统一在此处声明
  const isOldFreeLayout = oldLayout === 18 || oldLayout === 'free'
  const isNewFreeLayout = newLayout === 18 || newLayout === 'free'

  // 后续代码直接使用，不再重新声明
  if (isNewFreeLayout) {
    // ...
  }
}
```

### 错误处理增强

```javascript
try {
  // 布局切换逻辑
} catch (error) {
  console.error('[布局切换] 切换布局失败:', error)
  console.error('[布局切换] 错误堆栈:', error.stack)
  try {
    console.error('[布局切换] 当前状态:', {
      newLayout,
      currentLayout: currentLayout?.value,
      canvasSourceMap: canvasSourceMap?.value || {},
      videoPreviewsCount: videoPreviews?.value?.length || 0
    })
  } catch (logError) {
    console.error('[布局切换] 记录状态时出错:', logError)
  }
  ElMessage.error('切换布局失败: ' + (error.message || '未知错误'))
}
```

## 注意事项

1. **热模块替换（HMR）**
   - Vite 会自动检测文件变化并更新
   - 如果更新未生效，可以手动刷新页面（Ctrl+R）

2. **布局状态持久化**
   - 布局状态保存在 `window.__layoutStates` 中
   - 切换布局时会保存旧布局状态并恢复新布局状态

3. **自由布局特殊处理**
   - 自由布局（索引 18）使用 `canvasStore.sources` 管理信号源
   - 标准布局使用 `canvasSourceMap` 管理信号源

## 常见问题

### Q: 切换布局后信号源丢失？

A: 检查 `window.__layoutStates` 是否正确保存和恢复。查看控制台日志确认信号源是否正确克隆。

### Q: 自由布局切换后画布为空？

A: 这是正常行为。自由布局需要手动添加信号源到画布。

### Q: 特殊布局显示不正确？

A: 检查 `getVisibleCanvasIndices` 函数是否正确返回索引数组。

## 相关代码

- 布局配置：`f:\20260227\tauri-app\src\composables\useLayoutConfig.ts`
- 视频同步：`f:\20260227\tauri-app\src\composables\useVideoSync.js`
- 布局面板：`f:\20260227\tauri-app\src\components\teacher-window\panels\LayoutPanel.vue`
- 侧边面板：`f:\20260227\tauri-app\src\components\teacher-window\SidePanel.vue`
