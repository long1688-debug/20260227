# 渲染系统布局与信号源分离架构 - 测试验证指南

## 📋 测试概述

本指南用于验证渲染系统布局与信号源分离架构的正确性，确保布局切换时信号源绑定状态完全保留。

## ✅ 核心功能验证

### 1. RenderBox refId 持久化测试

**测试步骤：**

1. 启动应用，打开教师窗口
2. 选择一个4分屏布局
3. 从信号源列表拖拽一个摄像头到左上角格子（索引0）
4. 检查控制台日志，确认看到：

   ```
   [RenderBox] 信号源已绑定: refId=camera_xxx, type=camera
   ```

5. 在浏览器控制台执行：

   ```javascript
   const box = window.__renderCanvas.getLayout(4).elements[0];
   console.log('refId:', box.refId);
   console.log('sourceType:', box.sourceType);
   console.log('haveSource:', box.haveSource);
   ```

**预期结果：**

- ✅ `box.refId` 应该等于摄像头的ID
- ✅ `box.sourceType` 应该等于 'camera'
- ✅ `box.haveSource` 应该为 true

---

### 2. 布局切换信号源保留测试

**测试场景A：四分屏 → 九分屏 → 四分屏**

**测试步骤：**

1. 选择4分屏布局
2. 拖拽摄像头1到格子0（左上角）
3. 拖拽视频文件到格子3（右下角）
4. 记录当前画面显示情况
5. 切换到9分屏布局
6. 立即切换回4分屏布局
7. 观察画面是否恢复

**验证方法：**

```javascript
// 在浏览器控制台执行
const layout4 = window.__renderCanvas.getLayout(4);
console.log('Layout 4 elements count:', layout4.elements.length);

layout4.elements.forEach((box, index) => {
  console.log(`Box ${index}:`, {
    refId: box.refId,
    sourceType: box.sourceType,
    haveSource: box.haveSource
  });
});
```

**预期结果：**

- ✅ Box[0].refId 仍然是 camera_xxx
- ✅ Box[3].refId 仍然是 video_xxx
- ✅ 画面立即恢复显示，无需重新拖拽

---

### 3. 多布局独立状态测试

**测试步骤：**

1. 在4分屏布局中：
   - 格子0: 摄像头1
   - 格子1: 摄像头2
   - 格子2: 空
   - 格子3: 视频文件1

2. 切换到9分屏布局，添加不同的信号源：
   - 格子0: 摄像头3
   - 格子4: 视频文件2

3. 切换回4分屏布局

**验证方法：**

```javascript
// 检查两个布局的状态
const layout4 = window.__renderCanvas.getLayout(4);
const layout9 = window.__renderCanvas.getLayout(9);

console.log('=== Layout 4 ===');
layout4.elements.forEach((box, i) => {
  console.log(`Box ${i}: refId=${box.refId}`);
});

console.log('=== Layout 9 ===');
layout9.elements.forEach((box, i) => {
  console.log(`Box ${i}: refId=${box.refId}`);
});
```

**预期结果：**

- ✅ Layout 4 的 Box[0-3] 保持原有信号源
- ✅ Layout 9 的 Box[0,4] 有自己的信号源
- ✅ 两个布局互不影响

---

### 4. 信号源订阅机制测试

**测试步骤：**

1. 拖拽一个摄像头到画布
2. 断开摄像头（拔掉USB或关闭权限）
3. 观察控制台日志

**预期结果：**

```
[RenderBox] 信号源已关闭: camera_xxx
```

- ✅ Box 自动检测到信号源关闭
- ✅ 显示"信号源已关闭"错误提示
- ✅ refId 被清空

---

### 5. 拖拽放置完整流程测试

**测试步骤：**

1. 从预览区域拖拽信号源到画布格子
2. 检查控制台日志序列：

   ```
   [拖拽] 🎯 外部资源库覆盖: xxx → 格子0
   [拖拽] ✅ 已保存到 layoutStates: 布局4 槽位0 -> source_xxx
   [拖拽] ✅ RenderBox refId 已设置: source_xxx, type: xxx
   ```

**验证方法：**

```javascript
// 检查 layoutStates
console.log(window.__layoutStates[4].slots);

// 检查 canvasSourceMap
console.log(canvasSourceMap.value);
```

**预期结果：**

- ✅ layoutStates[4].slots[0] = source_xxx
- ✅ canvasSourceMap.value[0] = source_xxx
- ✅ RenderBox.refId = source_xxx

---

## 🔍 调试工具

### 全局对象访问

在浏览器控制台中可以使用以下全局对象进行调试：

```javascript
// 访问 RenderCanvas
window.__renderCanvas

// 访问 layoutStates
window.__layoutStates

// 获取当前布局
const currentLayoutId = window.__renderCanvas.currentLayout;

// 获取指定布局
const layout = window.__renderCanvas.getLayout(layoutId);

// 获取布局的所有元素
const elements = layout.elements;

// 检查某个 Box 的状态
const box = elements[0];
console.log({
  id: box.id,
  refId: box.refId,
  sourceType: box.sourceType,
  haveSource: box.haveSource
});
```

### 性能监控

```javascript
// 监控布局切换时间
performance.mark('layout-switch-start');
setLayout(9);
performance.mark('layout-switch-end');
performance.measure('layout-switch', 'layout-switch-start', 'layout-switch-end');
const measure = performance.getEntriesByName('layout-switch')[0];
console.log(`布局切换耗时: ${measure.duration}ms`);
```

---

## 🐛 常见问题排查

### 问题1: 布局切换后画面不恢复

**可能原因：**

- layoutStates 未正确保存/加载
- RenderBox 实例被销毁重建

**排查步骤：**

```javascript
// 1. 检查 layoutStates 是否有数据
console.log(window.__layoutStates[4]);

// 2. 检查布局对象是否存在
console.log(window.__renderCanvas.layouts.has(4));

// 3. 检查 Box 的 refId
const box = window.__renderCanvas.getLayout(4).elements[0];
console.log(box.refId);
```

**解决方案：**

- 确保 `saveCurrentLayoutConfig()` 在切换前被调用
- 确保 `loadLayoutConfig()` 在切换后被调用

---

### 问题2: refId 为空或 undefined

**可能原因：**

- setSource() 未被正确调用
- source 对象缺少 id 或 type 字段

**排查步骤：**

```javascript
// 1. 检查 source 对象
console.log(source);

// 2. 手动调用 setSource
box.setSource(source);

// 3. 验证 refId
console.log(box.refId);
```

**解决方案：**

- 确保 source 对象有 `id` 和 `type` 字段
- 检查拖拽处理函数是否正确调用 `box.setSource(source)`

---

### 问题3: 不同布局的信号源互相干扰

**可能原因：**

- Layout 的 elements 数组不是独立的
- 多个布局共享同一个 Box 实例

**排查步骤：**

```javascript
// 1. 检查不同布局的 Box 是否是不同实例
const layout4Box0 = window.__renderCanvas.getLayout(4).elements[0];
const layout9Box0 = window.__renderCanvas.getLayout(9).elements[0];

console.log('Same instance?', layout4Box0 === layout9Box0); // 应该是 false

// 2. 检查各自的状态
console.log('Layout 4 Box 0 refId:', layout4Box0.refId);
console.log('Layout 9 Box 0 refId:', layout9Box0.refId);
```

**解决方案：**

- 确保每个 Layout 在构造函数中创建独立的 elements 数组
- 确保 appendElement() 创建新的 Box 实例

---

## 📊 性能基准

### 期望性能指标

| 操作 | 期望耗时 | 说明 |
|------|---------|------|
| 布局切换 | < 50ms | 仅改变指针，无资源清理 |
| 信号源绑定 | < 100ms | 包含流初始化时间 |
| 画面恢复 | < 200ms | 从已有流恢复显示 |
| 内存占用 | 稳定 | 不因切换而增长 |

### 性能测试脚本

```javascript
// 自动化性能测试
async function performanceTest() {
  const iterations = 10;
  let totalTime = 0;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();

    // 切换布局
    setLayout(4);
    await new Promise(resolve => setTimeout(resolve, 10));
    setLayout(9);
    await new Promise(resolve => setTimeout(resolve, 10));
    setLayout(4);

    const end = performance.now();
    totalTime += (end - start);
  }

  console.log(`平均切换耗时: ${totalTime / iterations}ms`);
  console.log(`总迭代次数: ${iterations}`);
}

performanceTest();
```

---

## ✨ 成功标准

所有测试通过后，应满足以下标准：

1. ✅ **布局切换保留**: 切换回原布局时，所有信号源绑定状态完全保留
2. ✅ **画面立即恢复**: 切换回原布局时，画面立即显示，无需重新拖拽
3. ✅ **Box 独立记忆**: 每个 Box 独立记忆自己的信号源（refId 持久化）
4. ✅ **布局互不干扰**: 不同布局的 Box 互不影响
5. ✅ **拖拽永久保存**: 拖拽添加信号源后，状态永久保存
6. ✅ **支持多布局**: 支持最多49分屏 + 4种特殊布局
7. ✅ **性能达标**: 布局切换耗时 < 50ms
8. ✅ **内存稳定**: 多次切换后内存占用稳定

---

## 📝 测试报告模板

```markdown
# 测试报告

**测试日期:** YYYY-MM-DD
**测试人员:** XXX
**应用版本:** vX.X.X

## 测试结果

| 测试项 | 状态 | 备注 |
|--------|------|------|
| RenderBox refId 持久化 | ✅/❌ | |
| 布局切换信号源保留 | ✅/❌ | |
| 多布局独立状态 | ✅/❌ | |
| 信号源订阅机制 | ✅/❌ | |
| 拖拽放置完整流程 | ✅/❌ | |

## 性能数据

- 平均布局切换耗时: XX ms
- 最大内存占用: XX MB
- 内存泄漏检测: ✅/❌

## 发现的问题

1. [问题描述]
   - 复现步骤: ...
   - 严重程度: 高/中/低
   - 建议修复方案: ...

## 结论

✅ 所有测试通过，可以发布
❌ 存在问题，需要修复后重新测试
```

---

## 🚀 下一步

测试通过后，可以进行以下优化：

1. **特效支持**: 在 RenderBox 中添加 HSV/LUT/抠像等特效
2. **RenderImage 抽象**: 创建统一的渲染图像管理层
3. **GPU 加速**: 使用 WebGL/WebGPU 提升渲染性能
4. **布局预设**: 支持用户自定义布局并保存
5. **快捷键**: 添加键盘快捷键快速切换布局
