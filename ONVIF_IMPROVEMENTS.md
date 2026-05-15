# ONVIF 摄像机支持改进方案

## 问题描述

在添加网络摄像机时，系统尝试通过ONVIF协议获取RTSP流地址，但经常失败，返回"HTTP 404 - 所有 GetProfiles 路径均失败"的错误。这导致后续的FLV播放也失败。

## 解决方案

### 1. 后端改进 (Rust)

#### 1.1 扩展ONVIF路径搜索

在 `tauri-app/src-tauri/src/ptz/onvif.rs` 中：

- 增加了更多的ONVIF服务路径尝试（从原来的9个增加到20个）
- 添加了通用Profile Token降级方案，当标准方法失败时尝试常见的Token名称

#### 1.2 新增备选方案命令

在 `tauri-app/src-tauri/src/ptz_commands.rs` 中：

- 添加了 `try_common_rtsp_templates` 命令，当ONVIF失败时提供备选方案
- 实现了 `generate_rtsp_templates` 函数，根据品牌和端口生成常见的RTSP URL模板
- 支持海康威视、大华、Axis等主流品牌的特定RTSP格式

#### 1.3 注册新命令

在 `tauri-app/src-tauri/src/main.rs` 中：

- 注册了新的Tauri命令 `try_common_rtsp_templates`

### 2. 前端改进 (Vue)

#### 2.1 TeacherWindow.vue

- 增强了错误处理，提供更详细的错误信息
- 当ONVIF失败时，自动尝试使用新的备选方案
- 添加了用户友好的提示信息，说明可能的失败原因

#### 2.2 VideoPreview.vue

- 已有类似的备选方案机制，保持不变

### 3. 测试工具

创建了 `test-onvif-fallback.js` 测试脚本，用于验证改进效果

## 使用方法

### 对于用户

1. 添加网络摄像机时，如果ONVIF协议失败，系统会自动尝试备选方案
2. 用户可以在控制台看到详细的错误信息和处理过程
3. 如果所有方法都失败，系统会回退到用户输入的原始地址

### 对于开发者

1. 运行测试脚本验证功能：

   ```javascript
   // 在浏览器控制台中运行
   await window.testOnvifFallback()
   ```

2. 查看日志了解详细处理过程：
   - `[TeacherWindow]` 开头的日志显示前端处理过程
   - Rust后端日志显示ONVIF和RTSP模板尝试过程

## 技术细节

### ONVIF路径扩展

新增的ONVIF服务路径包括：

- `/onvif`, `/onvif/services`, `/onvif/service`
- `/onvif/api`, `/api/onvif`
- `/onvif/v1`, `/onvif/v2`
- `/onvif/wsdl`, `/onvif/soap`
- `/wsdl`, `/`

### RTSP模板生成

根据品牌生成特定的RTSP URL格式：

- 海康威视: `rtsp://ip:port/h264/ch1/main/av_stream`
- 大华: `rtsp://ip:port/cam/realmonitor?channel=1&subtype=0`
- Axis: `rtsp://ip:port/axis-media/media.amp`
- 默认: `rtsp://ip:port/stream`, `rtsp://ip:port/live`, `rtsp://ip:port/video`

### 认证处理

如果设备需要认证，系统会自动将用户名和密码添加到RTSP URL中：

```
rtsp://username:password@ip:port/path
```

## 预期效果

1. 提高ONVIF摄像机的兼容性
2. 减少因ONVIF失败导致的添加失败
3. 提供更好的用户体验和错误提示
4. 支持更多品牌和型号的摄像机

## 注意事项

1. 某些摄像机可能需要特定的配置才能正常工作
2. 防火墙设置可能影响ONVIF和RTSP连接
3. 确保摄像机支持标准ONVIF协议或常见RTSP格式
