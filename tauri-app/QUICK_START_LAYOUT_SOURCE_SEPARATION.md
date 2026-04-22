# 渲染系统布局与信号源分离架构 - 快速启动指南

## 🚀 快速开始

### 1. 启动开发环境

```bash
cd tauri-app
npm run dev
```

### 2. 打开教师窗口

在应用中导航到教师窗口页面，您将看到新的渲染系统已生效。

---

## 🔍 验证实施成功

### 方法1: 浏览器控制台检查

打开浏览器开发者工具（F12），在 Console 中执行：

```javascript
// 检查 RenderCanvas 是否已增强
console.log('RenderCanvas layouts:', window.__renderCanvas?.layouts);
console.log('Current layout:', window.__renderCanvas?.currentLayout);

// 检查 layoutStates 是否可用
console.log('Layout states:', window.__layoutStates);
```

**预期输出:**

- ✅ `window.__renderCanvas.layouts` 应该是一个 Map 对象
- ✅ `window.__layoutStates` 应该包含多个布局的状态

---

### 方法2: 功能测试

1. **选择4分屏布局**
2. **拖拽一个摄像头到左上角格子**
3. **切换到9分屏布局**
4. **切换回4分屏布局**
5. **观察画面是否恢复**

如果画面恢复显示，说明实施成功！✅

---

## 📊 核心 API 使用

### 获取当前布局信息

```javascript
// 获取 RenderCanvas 实例
const canvas = window.__renderCanvas;

// 获取当前布局ID
const currentLayoutId = canvas.currentLayout;

// 获取当前布局对象
const currentLayout = canvas.getLayout(currentLayoutId);

// 获取布局的所有元素
const elements = currentLayout.elements;

// 检查第一个 Box 的状态
const firstBox = elements[0];
console.log({
  refId: firstBox.refId,
  sourceType: firstBox.sourceType,
  haveSource: firstBox.haveSource
});
```

---

### 手动切换布局

```javascript
// 通过 useVideoSync composable
import { useVideoSync } from '@/composables/useVideoSync';

const { setLayout } = useVideoSync();

// 切换到4分屏
setLayout(4);

// 切换到9分屏
setLayout(7); // 注意：7对应9分屏
```

---

### 检查布局状态

```javascript
// 查看某个布局的信号源配置
const layoutId = 4; // 4分屏
const slots = window.__layoutStates[layoutId].slots;

console.log(`Layout ${layoutId} slots:`, slots);
// 输出示例: { 0: "camera_123", 1: "video_456", 2: null, 3: "camera_789" }
```

---

## 🐛 故障排查

### 问题: 看不到 window.__renderCanvas

**原因:** RenderCanvas 实例未暴露到全局

**解决方案:**
在 `RenderEngineWrapper.vue` 或相关组件中添加：

```javascript
onMounted(() => {
  if (renderCanvas.value) {
    window.__renderCanvas = renderCanvas.value;
    console.log('[Debug] RenderCanvas exposed to window');
  }
});
```

---

### 问题: 布局切换后画面不恢复

**检查步骤:**

1. 检查 layoutStates 是否有数据

```javascript
console.log(window.__layoutStates[4]);
```

1. 检查 Box 的 refId

```javascript
const box = window.__renderCanvas.getLayout(4).elements[0];
console.log('refId:', box.refId);
```

1. 检查 canvasSourceMap

```javascript
import { useVideoSync } from '@/composables/useVideoSync';
const { canvasSourceMap } = useVideoSync();
console.log(canvasSourceMap.value);
```

**可能原因:**

- ❌ layoutStates 为空 → 保存/加载逻辑有问题
- ❌ refId 为 null → setSource() 未被调用
- ❌ canvasSourceMap 为空 → loadLayoutConfig() 失败

---

### 问题: 控制台报错 "box.setSource is not a function"

**原因:** 获取的不是 RenderBox 实例

**解决方案:**

检查 `getRenderBoxByIndex()` 返回的对象类型：

```javascript
const box = getRenderBoxByIndex(0);
console.log('Box type:', box?.constructor?.name);
console.log('Has setSource:', typeof box?.setSource === 'function');
```

如果不是 RenderBox，检查：

- Layout 的 elements 数组是否正确填充
- 元素类型是否正确

---

## 📈 性能监控

### 实时监控布局切换性能

```javascript
// 添加性能监听器
let switchCount = 0;
let totalTime = 0;

window.__renderCanvas.on('layoutChanged', (data) => {
  switchCount++;
  console.log(`Layout switched: ${data.oldLayout} -> ${data.newLayout}`);
  console.log(`Total switches: ${switchCount}`);
});
```

### 内存监控

```javascript
// 监控内存使用
setInterval(() => {
  if (performance.memory) {
    const usedMB = performance.memory.usedJSHeapSize / 1048576;
    console.log(`Memory usage: ${usedMB.toFixed(2)} MB`);
  }
}, 5000);
```

---

## 🎯 常用调试命令

### 查看所有布局

```javascript
window.__renderCanvas.layouts.forEach((layout, id) => {
  console.log(`Layout ${id}:`, {
    type: layout._type,
    elements: layout.elements.length,
    regions: layout.regions.length
  });
});
```

### 查看某个 Box 的详细信息

```javascript
const layoutId = 4;
const boxIndex = 0;

const box = window.__renderCanvas.getLayout(layoutId).elements[boxIndex];

console.log('Box details:', {
  id: box.id,
  refId: box.refId,
  sourceType: box.sourceType,
  haveSource: box.haveSource,
  hasError: box._hasError,
  errorMessage: box._errorMessage
});
```

### 清空所有布局状态

```javascript
// 警告：这将清除所有布局的信号源配置
Object.keys(window.__layoutStates).forEach(layoutId => {
  window.__layoutStates[layoutId].slots = {};
});

console.log('All layout states cleared');
```

---

## 📚 相关文档

- **完整测试指南**: [LAYOUT_SOURCE_SEPARATION_TEST.md](./LAYOUT_SOURCE_SEPARATION_TEST.md)
- **实施总结**: [LAYOUT_SOURCE_SEPARATION_IMPLEMENTATION_SUMMARY.md](./LAYOUT_SOURCE_SEPARATION_IMPLEMENTATION_SUMMARY.md)
- **原始计划**: 参见计划文件

---

## 💡 提示和技巧

### 技巧1: 快速重置测试环境

```javascript
// 在控制台中执行
location.reload();
```

### 技巧2: 导出布局配置用于备份

```javascript
// 导出所有布局状态
const backup = JSON.stringify(window.__layoutStates, null, 2);
console.log(backup);

// 可以复制到文本文件保存
```

### 技巧3: 导入布局配置

```javascript
// 从备份恢复
const backup = `{...}`; // 粘贴之前导出的 JSON
const parsed = JSON.parse(backup);

Object.keys(parsed).forEach(layoutId => {
  window.__layoutStates[layoutId].slots = parsed[layoutId].slots;
});

console.log('Layout states restored');
```

---

## 🎉 成功标志

如果您能看到以下内容，说明实施成功：

✅ 控制台无错误
✅ 可以正常拖拽信号源到画布
✅ 布局切换流畅无卡顿
✅ 切换回原布局时画面恢复
✅ `window.__renderCanvas` 和 `window.__layoutStates` 可访问

恭喜！您已成功部署新的渲染系统架构！🚀
