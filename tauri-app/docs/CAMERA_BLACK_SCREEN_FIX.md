# 摄像头画面黑屏问题修复报告

## 问题描述

用户报告"摄像头画面有问题",具体表现为:

- **预览栏**: "HD Webcam" 摄像头显示正常画面
- **主画布**: 拖拽到主画布后显示黑屏

## 问题根源分析

### 根本原因

摄像头信号源在创建时**没有获取实际的 MediaStream**,导致:

1. 预览栏(SourcePreviewBar)通过 `initCameraStream` 函数独立获取 stream 并显示
2. 但这个 stream **只存在于 SourcePreviewBar 内部**,没有保存到 source 对象
3. 当拖拽到主画布时,VideoPreview 组件尝试使用 `props.videoSource.stream`,但该属性为 `undefined`
4. 结果:主画布无法播放,显示黑屏

### 技术细节

#### 1. handleSubmitNewSource 缺少 stream 获取

**文件**: `f:\20260227\tauri-app\src\components\TeacherWindow.vue` (第3662-3666行)

```javascript
// ❌ 修复前:只保存元数据,没有获取 stream
if (formData.type === 'localCamera') {
  newSource.deviceId = formData.deviceId
  newSource.resolution = '1920x1080'
  newSource.fps = 30
  // 缺少: navigator.mediaDevices.getUserMedia()
}
```

#### 2. 拖拽数据序列化丢失 stream

**文件**: `f:\20260227\tauri-app\src\composables\useSourceDrag.js` (第858行)

```javascript
// ❌ 修复前:JSON.parse 无法序列化 MediaStream
const source = JSON.parse(jsonData);
// jsonData 来自: JSON.stringify(source) - stream 属性被丢失
```

**原因**: `MediaStream` 对象无法被 `JSON.stringify` 序列化,会被忽略。

## 修复方案

### 修复1: 在创建摄像头时立即获取 MediaStream

**文件**: `f:\20260227\tauri-app\src\components\TeacherWindow.vue`

**位置**: `handleSubmitNewSource` 函数 (第3662-3682行)

```javascript
// ✅ 修复后:立即获取摄像头的 MediaStream
if (formData.type === 'localCamera') {
  newSource.deviceId = formData.deviceId
  newSource.resolution = '1920x1080'
  newSource.fps = 30

  // 🎯 关键修复:立即获取摄像头的 MediaStream
  try {
    console.log('[TeacherWindow] 正在获取摄像头流:', formData.deviceId)
    const constraints = {
      video: formData.deviceId ? { deviceId: formData.deviceId } : true,
      audio: true
    }
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    newSource.stream = stream
    console.log('[TeacherWindow] 摄像头流获取成功:', stream.id)
  } catch (error) {
    console.error('[TeacherWindow] 获取摄像头流失败:', error)
    ElMessage.error('无法访问摄像头: ' + error.message)
    return // 终止添加流程
  }
}
```

**效果**:

- ✅ 摄像头源对象包含完整的 MediaStream
- ✅ 如果获取失败,提前终止添加流程并提示用户
- ✅ 支持指定 deviceId 或自动选择默认摄像头

### 修复2: 拖拽时优先使用 currentSelectedSource

**文件**: `f:\20260227\tauri-app\src\composables\useSourceDrag.js`

**位置**: `onDrop` 函数 (第855-877行)

```javascript
// ✅ 修复后:优先使用 currentSelectedSource(包含完整stream)
} else if (jsonData) {
  // 🎯 关键修复:从 SourcePreviewBar 拖拽过来的数据
  try {
    // 🎯 优先使用 currentSelectedSource,因为它包含完整的 stream 对象
    // JSON.parse 会丢失 MediaStream(无法序列化)
    let source;

    if (currentSelectedSource.value && currentSelectedSource.value.stream) {
      console.log('[HTML5拖拽] 使用 currentSelectedSource(包含完整stream):', currentSelectedSource.value.name);
      source = currentSelectedSource.value;
    } else {
      // 备用方案:从 JSON 解析(不包含 stream)
      console.log('[HTML5拖拽] 从 JSON 解析源数据(不包含stream)');
      source = JSON.parse(jsonData);
    }

    console.log('[HTML5拖拽] 从预览区域拖拽:', source.name, 'hasStream:', !!source.stream);
    handleDropToCanvas(source, index);
  } catch (parseError) {
    console.error('[HTML5拖拽] 解析失败:', parseError);
    ElMessage.error('解析信号源数据失败');
  }
}
```

**工作原理**:

1. 用户在预览栏点击摄像头 → `handleMouseDown` 调用 `onMouseDown(event, source)`
2. `onMouseDown` 设置 `currentSelectedSource.value = source`(包含完整 stream)
3. 用户拖拽到画布 → `onDrop` 触发
4. `onDrop` 优先使用 `currentSelectedSource.value`(包含 stream),而不是 `JSON.parse(jsonData)`(丢失 stream)
5. `handleDropToCanvas` 接收到包含 stream 的 source 对象
6. VideoPlayer.setVideoSource 正确设置 `video.srcObject = source.stream`
7. ✅ 摄像头画面正常显示

## 验证步骤

### 测试场景1: 添加新摄像头

1. 打开 TeacherWindow
2. 点击"添加信号源"按钮
3. 选择"本地摄像头"类型
4. 选择摄像头设备(如 "HD Webcam")
5. 点击"确定"

**预期结果**:

- ✅ 摄像头出现在预览栏,画面正常
- ✅ 控制台显示: `[TeacherWindow] 摄像头流获取成功: xxx`
- ✅ source 对象包含 `stream` 属性

### 测试场景2: 拖拽到主画布

1. 从预览栏拖拽摄像头到任意视频格子
2. 释放鼠标

**预期结果**:

- ✅ 摄像头画面在主画布正常显示
- ✅ 控制台显示: `[HTML5拖拽] 使用 currentSelectedSource(包含完整stream)`
- ✅ 控制台显示: `[VideoPlayer.setVideoSource] 设置 MediaStream`
- ✅ 无黑屏现象

### 测试场景3: 多格子显示同一摄像头

1. 将同一摄像头拖拽到多个不同的视频格子

**预期结果**:

- ✅ 所有格子都显示相同的摄像头画面
- ✅ 控制台显示: `[拖拽] 检测到摄像头源,准备设置视频流`
- ✅ useSourceDrag 中的 `cloneMediaStream` 函数正确克隆流

## 相关文件清单

### 修改的文件

1. **f:\20260227\tauri-app\src\components\TeacherWindow.vue**
   - 修改 `handleSubmitNewSource` 函数
   - 添加 getUserMedia 调用获取摄像头 stream

2. **f:\20260227\tauri-app\src\composables\useSourceDrag.js**
   - 修改 `onDrop` 函数
   - 优先使用 currentSelectedSource 而非 JSON.parse

### 相关但未修改的文件

1. **f:\20260227\tauri-app\src\components\teacher-window\layout\SourcePreviewBar.vue**
   - 已有 `initCameraStream` 函数处理预览栏摄像头
   - 已有 drag-start/mouse-down 事件发出

2. **f:\20260227\tauri-app\src\components\VideoPreview.vue**
   - 已有 watch videoSource 逻辑
   - 已有 setVideoSource 方法调用

3. **f:\20260227\tauri-app\src\components\VideoPlayer.vue**
   - 已有 setVideoSource 方法处理 MediaStream
   - 第425-428行: `video.srcObject = source.stream`

## 技术要点

### MediaStream 序列化问题

```javascript
// ❌ 错误:MediaStream 无法被 JSON 序列化
const source = { id: 'camera-1', type: 'localCamera', stream: mediaStream };
const json = JSON.stringify(source);
// json = '{"id":"camera-1","type":"localCamera"}' - stream 丢失!

// ✅ 正确:保持对象引用,避免序列化
currentSelectedSource.value = source; // 保持完整对象引用
```

### 摄像头权限请求

```javascript
// 请求摄像头和麦克风权限
const stream = await navigator.mediaDevices.getUserMedia({
  video: { deviceId: 'xxx' }, // 可选:指定设备ID
  audio: true                  // 同时请求音频
});
```

### 流克隆(多格子显示)

useSourceDrag.js 中已有 `cloneMediaStream` 函数,用于支持同一摄像头在多个格子显示:

```javascript
const clonedStream = cloneMediaStream(source.stream, `格子${index}`);
preview.setVideoSource({
  ...source,
  stream: clonedStream,
  isClonedStream: true  // 标记为克隆流,避免清理时被停止
});
```

## 注意事项

### 1. 摄像头权限

- 用户必须授予浏览器/应用摄像头和麦克风权限
- 如果拒绝权限,`getUserMedia` 会抛出异常
- 修复后的代码会捕获异常并提示用户

### 2. 资源清理

- 每个 MediaStream 都需要在不再使用时停止轨道
- SourcePreviewBar 在 `onUnmounted` 时清理所有流
- VideoPlayer 在 `setVideoSource` 时停止之前的流

### 3. 性能考虑

- 同一摄像头在多个格子显示时,使用流克隆而非重新获取
- 避免重复调用 `getUserMedia`,减少性能开销

## 后续优化建议

### 1. 统一摄像头管理

考虑创建专门的 `useCameraManager` composable:

- 集中管理所有摄像头流
- 自动处理流的获取、克隆、清理
- 提供缓存机制,避免重复获取同一设备的流

### 2. 错误处理增强

- 区分不同类型的错误(权限拒绝、设备占用、硬件故障)
- 提供更友好的用户提示
- 提供重试机制

### 3. 流状态监控

- 监控流的活跃状态
- 检测流中断并自动恢复
- 显示流质量指标(分辨率、帧率)

## 总结

本次修复解决了摄像头画面黑屏的核心问题:

1. ✅ **源头修复**: 在创建摄像头时立即获取 MediaStream
2. ✅ **传输修复**: 拖拽时保持 stream 引用,避免 JSON 序列化丢失
3. ✅ **完整链路**: 从创建 → 预览 → 拖拽 → 画布显示,整个流程都能正确处理 stream

修复后,摄像头信号源能够:

- ✅ 在预览栏正常显示
- ✅ 拖拽到主画布正常显示
- ✅ 支持多格子同时显示
- ✅ 正确的资源管理和清理
