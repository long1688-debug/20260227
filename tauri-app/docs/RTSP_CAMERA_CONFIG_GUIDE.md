# 网络摄像机 RTSP 地址配置指南

## 📋 目录

- [快速开始](#快速开始)
- [智能地址获取策略](#智能地址获取策略)
- [各品牌 RTSP 地址格式](#各品牌-rtsp-地址格式)
- [使用 ODM 获取准确地址](#使用-odm-获取准确地址)
- [常见问题排查](#常见问题排查)
- [已验证设备列表](#已验证设备列表)

---

## 🚀 快速开始

### 方式一：ONVIF 自动获取（推荐）

1. **添加网络摄像机**时选择协议为 `ONVIF`
2. 填写以下信息：
   - IP 地址：例如 `192.168.5.165`
   - ONVIF 端口：通常是 `2000`、`80` 或 `8080`
   - 用户名/密码：摄像机的登录凭证
   - **摄像头品牌**（可选）：选择对应品牌可提高成功率

3. 点击 **"自动获取RTSP地址"** 按钮

系统会尝试通过 ONVIF 协议自动从摄像机获取正确的 RTSP 流地址。

### 方式二：手动指定 RTSP 地址

如果 ONVIF 协议不可用，可以手动输入 RTSP 地址：

```
rtsp://[IP地址]:554/[路径]
```

例如：

- 海康威视：`rtsp://192.168.1.100:554/h264/ch1/main/av_stream`
- 大华：`rtsp://192.168.1.100:554/cam/realmonitor?channel=1&subtype=0`
- 雄迈：`rtsp://192.168.5.165:554/live/av0`

---

## 🎯 智能地址获取策略

系统采用**三层回退策略**自动获取 RTSP 地址：

```mermaid
graph TD
    A[开始添加摄像机] --> B{ONVIF 可用?}
    B -->|是| C[✅ 使用 ONVIF 返回的地址]
    B -->|否| D{是否已验证过?}
    D -->|是| E[✅ 使用已验证的地址]
    D -->|否| F{品牌已知?}
    F -->|是| G[使用品牌模板]
    F -->|否| H[使用通用模板]
    G --> I{后端验证成功?}
    H --> I
    I -->|是| J[✅ 使用验证通过的地址]
    I -->|否| K[用户手动指定]
    K --> L[✅ 用户输入的地址]
```

### 策略说明

#### 策略 1：已验证地址优先

如果该 IP 地址之前已成功连接过，系统会直接使用已验证的 RTSP 地址。

**示例**：

```javascript
// 已验证的设备会自动记住
VERIFIED_RTSP_URLS = {
  '192.168.5.165': 'rtsp://192.168.5.165:554/live/av0'
}
```

#### 策略 2：品牌模板匹配

根据选择的摄像头品牌，使用对应的 RTSP 地址模板。

**支持的品牌**：

- 海康威视 (Hikvision)
- 大华 (Dahua)
- 宇视 (Uniview)
- 安讯士 (Axis)
- 雄迈 (Xiongmai)
- TP-Link
- 其他/通用 (Generic)

#### 策略 3：通用模板回退

如果无法识别品牌，使用常见的通用 RTSP 地址格式进行尝试。

---

## 📺 各品牌 RTSP 地址格式

### 海康威视 (Hikvision)

**主码流（高清）**：

```
rtsp://[IP]:554/h264/ch1/main/av_stream
rtsp://[IP]/h264/ch1/main/av_stream
```

**子码流（流畅）**：

```
rtsp://[IP]:554/h264/ch1/sub/av_stream
```

**新固件版本**：

```
rtsp://[IP]:554/Streaming/Channels/101  // 主码流
rtsp://[IP]:554/Streaming/Channels/102  // 子码流
```

**认证格式**：

```
rtsp://admin:password@[IP]:554/h264/ch1/main/av_stream
```

---

### 大华 (Dahua)

**主码流**：

```
rtsp://[IP]:554/cam/realmonitor?channel=1&subtype=0
rtsp://[IP]/cam/realmonitor?channel=1&subtype=0
```

**子码流**：

```
rtsp://[IP]:554/cam/realmonitor?channel=1&subtype=1
```

**多通道**：

```
rtsp://[IP]:554/cam/realmonitor?channel=2&subtype=0  // 第2通道
```

**认证格式**：

```
rtsp://admin:password@[IP]:554/cam/realmonitor?channel=1&subtype=0
```

---

### 宇视 (Uniview)

**标准格式**：

```
rtsp://[IP]:554/stream
rtsp://[IP]:554/unicast/c1/s1/live
```

**多通道**：

```
rtsp://[IP]:554/unicast/c2/s1/live  // 第2通道
```

---

### 安讯士 (Axis)

**标准格式**：

```
rtsp://[IP]:554/axis-media/media.amp
rtsp://[IP]:554/axis-media/media.3gp
```

**MJPEG 流**：

```
rtsp://[IP]:554/axis-media/media.mjpeg
```

---

### 雄迈 (Xiongmai / XM)

**标准格式**：

```
rtsp://[IP]:554/live/av0
rtsp://[IP]:554/user=admin&password=&channel=1&stream=0.sdp
```

**注意**：雄迈摄像头的密码字段可能为空

---

### TP-Link

**标准格式**：

```
rtsp://[IP]:554/stream1  // 主码流
rtsp://[IP]:554/stream2  // 子码流
```

---

### 通用格式（未知品牌）

如果不确定品牌，可以尝试以下通用格式：

```
rtsp://[IP]:554/live/ch1
rtsp://[IP]:554/Streaming/Channels/101
rtsp://[IP]:554/Streaming/Channels/102
rtsp://[IP]:8554/live
```

---

## 🔍 使用 ODM 获取准确地址

### 什么是 ODM？

**ONVIF Device Manager (ODM)** 是一个 Windows 平台的 ONVIF 设备诊断工具，可以准确获取摄像机的配置信息。

### 下载 ODM

- 官网：<https://sourceforge.net/projects/onvifdm/>
- 版本：推荐使用最新稳定版

### 使用步骤

#### 1. 发现设备

1. 打开 ODM
2. 点击左上角 **"Discover"** 按钮
3. 等待扫描完成，列表中会显示所有 ONVIF 设备

#### 2. 添加设备

1. 右键点击发现的设备
2. 选择 **"Add to device list"**
3. 输入用户名和密码
4. 点击 **"OK"**

#### 3. 查看关键信息

在 ODM 界面中，切换到以下标签页获取信息：

##### Device Information（设备信息）

- **Manufacturer**：制造商（用于品牌识别）
- **Model**：型号
- **Firmware Version**：固件版本
- **ONVIF Version**：ONVIF 协议版本（如 2.4、2.5）

##### Services（服务）

- **Media Service URL**：Media 服务端点（重要！）
  - 示例：`http://192.168.5.165:2000/onvif/Media`
- **PTZ Service URL**：云台控制服务端点
- **Device Service URL**：设备服务端点

##### Profiles（配置文件）

- **Profile Token**：视频配置标识符
  - 示例：`Profile_1`、`MainStream`
- **Encoding**：编码格式（H.264/H.265）
- **Resolution**：分辨率（如 1920x1080）

##### Live Video → Show RTSP URL

1. 切换到 **Live Video** 标签
2. 右键点击视频画面
3. 选择 **"Show RTSP URL"**
4. 复制显示的完整 RTSP 地址

**这是最准确的 RTSP 地址！**

##### Network（网络）

- **RTSP Port**：RTSP 端口（默认 554）
- **HTTP Port**：HTTP 端口（默认 80）
- **RTSP over TCP**：是否支持 TCP 传输

---

## ❓ 常见问题排查

### 问题 1：ONVIF 协议返回 404 错误

**症状**：

```
ONVIF端口 2000 失败: 获取流地址失败: 设备返回错误: HTTP 404
```

**原因**：

- ONVIF 服务端点路径不正确
- 设备不支持 ONVIF 协议
- 端口号错误

**解决方案**：

1. **使用 ODM 获取正确的 Media Service URL**
   - 参考上文 "使用 ODM 获取准确地址"

2. **尝试常见端口**

   ```
   80, 8000, 8080, 8899, 2000
   ```

3. **回退到 RTSP 手动指定**
   - 选择协议为 `RTSP`
   - 直接输入 RTSP 地址

---

### 问题 2：RTSP 连接失败

**症状**：

```
无法连接到RTSP流，请检查地址和网络连接
```

**排查步骤**：

1. **使用 VLC 测试 RTSP 地址**
   - 打开 VLC 播放器
   - 菜单：媒体 → 打开网络串流
   - 输入 RTSP 地址
   - 点击播放

2. **检查网络连接**

   ```powershell
   Test-NetConnection 192.168.5.165 -Port 554
   ```

3. **确认用户名密码正确**
   - 某些摄像头需要认证
   - 尝试将认证信息嵌入 URL：

     ```
     rtsp://admin:password@192.168.5.165:554/live/av0
     ```

4. **检查防火墙设置**
   - 确保 554 端口未被阻止
   - 临时关闭防火墙测试

---

### 问题 3：视频卡顿或延迟高

**解决方案**：

1. **使用子码流**
   - 主码流：高清但带宽占用大
   - 子码流：流畅适合预览

2. **启用 RTSP over TCP**
   - 在代码中设置传输协议为 TCP
   - 减少丢包导致的卡顿

3. **降低分辨率**
   - 在摄像机 Web 界面调整分辨率
   - 或使用子码流

---

### 问题 4：ZLMediaKit 启动失败

**症状**：

```
ZLMediaKit 启动失败：端口未监听
```

**解决方案**：

1. **检查 ZLMediaKit 是否已安装**

   ```bash
   # Windows
   where ffmpeg

   # Linux
   which ffmpeg
   ```

2. **检查端口占用**

   ```powershell
   netstat -ano | findstr :801
   ```

3. **重启应用**
   - 关闭应用后重新打开
   - ZLMediaKit 会自动启动

---

## ✅ 已验证设备列表

以下是已通过测试的设备配置：

| IP 地址 | 品牌 | RTSP 地址 | 状态 | 备注 |
|---------|------|-----------|------|------|
| 192.168.5.165 | 雄迈 | `rtsp://192.168.5.165:554/live/av0` | ✅ 已验证 | VLC 测试通过 |
| ... | ... | ... | ... | 添加更多设备 |

### 如何添加已验证设备

在 `VideoPreview.vue` 中添加新的映射：

```javascript
const VERIFIED_RTSP_URLS = {
  '192.168.5.165': 'rtsp://192.168.5.165:554/live/av0',
  '192.168.1.100': 'rtsp://192.168.1.100:554/h264/ch1/main/av_stream',
  // 添加更多...
};
```

---

## 🛠️ 高级配置

### 自定义品牌模板

如果需要添加新的品牌模板，编辑 `VideoPreview.vue`：

```javascript
const BRAND_RTSP_TEMPLATES = {
  // 现有品牌...

  // 添加新品牌
  yourbrand: [
    'rtsp://{ip}:554/your/path/here',
    'rtsp://{ip}:554/another/path',
  ],
};
```

### 品牌自动识别

系统会根据以下信息自动识别品牌：

1. **用户手动选择**（优先级最高）
2. **ONVIF Manufacturer 字段**
3. **ONVIF Model 字段**
4. **已有 streamUrl 的路径特征**

识别规则位于 `detectCameraBrand()` 函数中。

---

## 📞 技术支持

如果遇到无法解决的问题，请提供以下信息：

1. **摄像头品牌和型号**
2. **ONVIF 版本**（通过 ODM 查看）
3. **完整的错误日志**
4. **VLC 测试结果**
5. **ODM 截图**（特别是 Services 和 Live Video 标签）

---

## 📝 更新日志

- **2026-05-17**：初始版本，支持 7 个主流品牌
- **2026-05-17**：添加智能回退策略
- **2026-05-17**：添加已验证设备 192.168.5.165

---

**最后更新**：2026-05-17
