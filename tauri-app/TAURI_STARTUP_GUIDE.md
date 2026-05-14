# Tauri 原生桌面应用 - 摄像头预览功能启动指南

## 📋 前置要求

### 1. 系统环境检查

在启动 Tauri 应用之前，请确保已安装以下依赖：

#### Windows 系统
```bash
# 检查 Node.js（建议 v18+）
node --version

# 检查 npm
npm --version

# 检查 Rust（必需）
rustc --version
cargo --version

# 如果未安装 Rust，使用 winget 安装
winget install Rustlang.Rust.MSVC
```

#### macOS 系统
```bash
# 检查 Homebrew
brew --version

# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Xcode Command Line Tools
xcode-select --install
```

#### Linux 系统
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y libgtk-3-dev libwebkit2gtk-4.0-dev libappindicator3-dev librsvg2-dev patchelf

# Fedora
sudo dnf install gtk3-devel webkit2gtk4.0-devel libappindicator-gtk3-devel librsvg2-devel patchelf
```

### 2. 项目依赖安装

```bash
# 进入 tauri-app 目录
cd f:\20260227\tauri-app

# 安装前端依赖
npm install

# 验证依赖安装
npm list @tauri-apps/api
npm list flv.js
npm list hls.js
```

## 🚀 启动 Tauri 开发环境

### 方式 1: 使用启动脚本（推荐）

Windows 用户可以直接运行提供的批处理脚本：

```bash
# 双击运行或在命令行执行
.\start-tauri-dev.bat
```

该脚本会自动：
- ✅ 检查 Node.js 和 Rust 是否安装
- ✅ 清理端口 5174（如果被占用）
- ✅ 清理 Vite 缓存
- ✅ 启动 Tauri 开发服务器

### 方式 2: 手动启动

```bash
# 进入 tauri-app 目录
cd f:\20260227\tauri-app

# 启动 Tauri 开发模式
npm run tauri:dev
```

**首次启动说明**：
- 第一次编译可能需要 **3-5 分钟**（编译 Rust 代码）
- 后续启动会快很多（使用缓存）
- 启动成功后会自动打开应用窗口

### 方式 3: 仅启动前端（用于调试）

如果只想测试前端代码，不启动 Tauri 原生窗口：

```bash
# 仅启动 Vite 开发服务器
npm run dev

# 访问 http://127.0.0.1:5174
```

## 🔧 后端服务配置

### RTSP 转 HTTP 服务

Tauri 后端内置了 FFmpeg RTSP 转码功能，无需额外配置。但需要确保：

1. **FFmpeg 可用**（可选，用于高级功能）
   ```bash
   # 检查 FFmpeg 是否安装
   ffmpeg -version
   
   # Windows: 下载并添加到 PATH
   # https://www.gyan.dev/ffmpeg/builds/
   
   # macOS
   brew install ffmpeg
   
   # Linux
   sudo apt install ffmpeg
   ```

2. **ZLMediaKit 服务**（可选，用于高性能流媒体）
   - Tauri 应用会自动管理 ZLMediaKit
   - 通过 `start_zlmediakit` 命令启动

### ONVIF 设备发现

Tauri 后端支持 ONVIF 协议自动发现网络摄像机：

```javascript
// 在前端调用
const { invoke } = await import('@tauri-apps/api/core')

// 扫描局域网内的 ONVIF 设备
const devices = await invoke('onvif_discover_devices', {
  timeout: 5000,  // 超时时间（毫秒）
})

console.log('发现的设备:', devices)
```

## 🧪 功能测试

### 测试 1: 本地摄像头

1. **启动应用后**，点击"添加信号源"按钮
2. 选择 **"本地设备" → "USB摄像头"**
3. 从下拉列表选择摄像头设备
4. 点击"确定"

**预期结果**：
- ✅ 信号源出现在底部预览栏
- ✅ 摄像头画面正常显示
- ✅ 控制台显示 `[SourcePreviewBar] 摄像头流获取成功`

**如果失败**：
```javascript
// 在浏览器控制台（F12）执行
// 检查摄像头权限
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => {
    console.log('摄像头权限正常')
    stream.getTracks().forEach(track => track.stop())
  })
  .catch(err => console.error('摄像头错误:', err))
```

### 测试 2: 网络摄像机（RTSP）

1. 点击"添加信号源"
2. 选择 **"网络设备" → "网络摄像机"**
3. 填写信息：
   ```
   协议类型: RTSP
   流媒体地址: rtsp://192.168.1.100:554/stream
   用户名: admin（如果需要）
   密码: 123456（如果需要）
   ```
4. 点击"确定"

**预期结果**：
- ✅ 显示"正在连接..."加载状态
- ✅ 几秒后显示实时视频
- ✅ 控制台显示 `[网络摄像机] 播放成功`

**调试技巧**：
```bash
# 使用 VLC 测试 RTSP 流地址
vlc rtsp://192.168.1.100:554/stream

# 检查 Tauri 后端日志
# 查看控制台输出的 [RTSP] 相关日志
```

### 测试 3: ONVIF 设备自动发现

1. 打开 **"摄像机发现"** 面板
2. 选择 **"🌐 多网卡扫描（推荐）"**
3. 点击 **"开始扫描"**
4. 等待扫描完成（约 10-30 秒）
5. 在发现的设备列表中点击 **"注册"**

**预期结果**：
- ✅ 自动发现局域网内的 ONVIF 设备
- ✅ 显示设备 IP、型号、RTSP 地址
- ✅ 点击注册后自动添加到预览区域

### 测试 4: 拖拽到画布

1. 确保预览区域有信号源
2. **鼠标左键按住**预览区域的信号源
3. **拖拽**到任意画布格子
4. **释放鼠标**

**预期结果**：
- ✅ 信号源克隆到画布格子
- ✅ 原预览区域的信号源保持不变
- ✅ 控制台显示 `[handleDropToCanvas] 放置到画布 X`

**验证克隆**：
```javascript
// 在控制台执行
console.log('所有信号源:', window.__sourceStore?.sources)
// 应该看到原始源和克隆源（ID 包含 _canvas_ 后缀）
```

### 测试 5: 多画布显示同一摄像头

1. 将一个摄像头拖拽到 **画布 1**
2. 再次将同一个摄像头从预览区域拖拽到 **画布 2**
3. 观察两个画布

**预期结果**：
- ✅ 两个画布都显示相同的摄像头画面
- ✅ 音频只在第一个画布播放（避免回声）
- ✅ 控制台显示 `[cloneSourceForCanvas] 克隆成功`

## 🐛 常见问题排查

### 问题 1: Tauri 启动失败

**症状**：`npm run tauri:dev` 报错

**解决方案**：
```bash
# 1. 清理缓存
rm -rf node_modules/.vite
rm -rf dist
rm -rf src-tauri/target/debug

# 2. 重新安装依赖
npm install

# 3. 更新 Rust
rustup update

# 4. 重新启动
npm run tauri:dev
```

### 问题 2: 摄像头显示黑屏

**检查清单**：
- [ ] 浏览器是否授予摄像头权限？
- [ ] 其他程序是否占用了摄像头？
- [ ] 摄像头硬件是否正常？

**解决步骤**：
1. 刷新页面重新请求权限
2. 关闭 Zoom、Teams、微信等程序
3. 在系统设置中检查摄像头权限
4. 尝试更换 USB 端口

### 问题 3: RTSP 流连接超时

**检查清单**：
- [ ] RTSP 流地址是否正确？
- [ ] 使用 VLC 能否打开该地址？
- [ ] 防火墙是否阻止了 RTSP 端口（554）？
- [ ] Tauri 后端是否正常运行？

**解决步骤**：
```bash
# 1. 用 VLC 测试
vlc rtsp://192.168.1.100:554/stream

# 2. 检查网络连接
ping 192.168.1.100

# 3. 查看 Tauri 后端日志
# 在启动终端中查看 [RTSP] 相关日志

# 4. 尝试提供 HTTP-FLV 或 HLS 格式
# 例如: http://192.168.1.100:8080/live.flv
```

### 问题 4: 拖拽后画布不显示视频

**调试代码**：
```javascript
// 在浏览器控制台执行
console.log('画布映射:', window.__canvasSourceMap)
console.log('视频预览:', window.__videoPreviews)
console.log('所有源:', window.__sourceStore?.sources)

// 检查是否有错误日志
// 查找 [handleDropToCanvas] 相关日志
```

### 问题 5: ONVIF 扫描无结果

**可能原因**：
- ONVIF 设备未开机或未连接到网络
- 防火墙阻止了 ONVIF 发现协议（UDP 3702）
- 设备不在同一网段

**解决步骤**：
```bash
# 1. 确认设备 IP 地址
ping <设备IP>

# 2. 检查防火墙设置
# 允许 UDP 3702 端口

# 3. 手动添加设备
# 不使用自动发现，直接输入 RTSP 地址
```

## 📊 性能优化建议

### 1. 限制同时播放的 RTSP 流数量

```javascript
// 建议不超过 4 路 RTSP 流
// 不使用时及时从预览区域移除
```

### 2. 合理管理摄像头资源

- 同一摄像头在多个画布显示时会自动克隆流
- 避免创建过多克隆导致内存泄漏
- 组件卸载时自动清理资源

### 3. 定期清理无用信号源

```javascript
// 在控制台执行
// 列出所有信号源
window.__sourceStore?.sources.forEach(s => {
  console.log(`${s.name} (${s.type})`)
})

// 删除不需要的信号源
window.__sourceStore?.removeSource(sourceId)
```

## 🔍 调试工具

### 浏览器控制台命令

```javascript
// 1. 检查摄像头权限
async function testCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    console.log('✅ 摄像头权限正常')
    stream.getTracks().forEach(track => track.stop())
  } catch (err) {
    console.error('❌ 摄像头错误:', err)
  }
}

// 2. 列出所有可用摄像头
async function listCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices()
  const cameras = devices.filter(d => d.kind === 'videoinput')
  console.log('可用摄像头:', cameras.map(c => ({
    label: c.label || '未命名',
    deviceId: c.deviceId
  })))
}

// 3. 检查预览区域状态
function checkPreviewStatus() {
  const store = window.__sourceStore
  if (!store) {
    console.error('❌ sourceStore 未初始化')
    return
  }
  
  console.log('预览源数量:', store.previewSources.length)
  console.log('预览源列表:', store.previewSources.map(s => ({
    id: s.id,
    name: s.name,
    type: s.type,
    hasStream: !!s.stream,
    addedToPreview: s.addedToPreview
  })))
}

// 4. 检查画布映射
function checkCanvasMapping() {
  const map = window.__canvasSourceMap
  if (!map) {
    console.error('❌ canvasSourceMap 未初始化')
    return
  }
  
  console.log('画布映射:', map)
  Object.entries(map).forEach(([index, sourceId]) => {
    const store = window.__sourceStore
    const source = store?.sources.find(s => s.id === sourceId)
    console.log(`画布 ${index}:`, source ? source.name : '空')
  })
}

// 5. 检查网络摄像机状态
function checkNetworkCameras() {
  console.log('网络摄像机就绪:', window.__networkCameraReady)
  console.log('网络摄像机错误:', window.__networkCameraError)
  console.log('网络摄像机状态:', window.__networkCameraStatus)
}

// 执行所有检查
testCamera()
listCameras()
checkPreviewStatus()
checkCanvasMapping()
checkNetworkCameras()
```

### Tauri 后端日志

在启动 Tauri 的终端窗口中，可以查看后端日志：

```
[RTSP] 流已启动: session=xxx, url=http://127.0.0.1:8080/stream.mjpg
[ONVIF] 发现设备: 192.168.1.100
[Camera] 摄像头流已启动: /dev/video0
```

## 📦 构建生产版本

当开发完成后，可以构建生产版本：

```bash
# 构建 Windows 安装包
npm run tauri:build

# 生成的文件位置
# tauri-app/src-tauri/target/release/bundle/
# ├── msi/实训教学系统-教师端_x.x.x_x64.msi
# └── nsis/实训教学系统-教师端_x.x.x_x64-setup.exe
```

## 📞 获取帮助

如果遇到问题，请提供以下信息：

1. **问题描述**：清晰描述发生了什么
2. **复现步骤**：详细的操作步骤
3. **控制台日志**：复制完整的浏览器控制台输出
4. **Tauri 日志**：复制终端中的后端日志
5. **环境信息**：
   - 操作系统版本
   - Node.js 版本：`node --version`
   - Rust 版本：`rustc --version`
   - Tauri 版本：`tauri --version`

示例：
```
问题: RTSP 流连接超时

步骤:
1. 添加网络摄像机
2. 输入 rtsp://192.168.1.100:554/stream
3. 点击确定
4. 等待 15 秒后显示"连接超时"

浏览器控制台日志:
[网络摄像机] 开始播放: 教室摄像头
[网络摄像机] 检测到 RTSP 流，尝试通过 Tauri 转换...
[网络摄像机] 播放失败: Error: RTSP 转换超时

Tauri 后端日志:
[RTSP] 尝试启动流: rtsp://192.168.1.100:554/stream
[RTSP] FFmpeg 进程启动失败: ffprobe not found

环境:
- Windows 11 22H2
- Node.js 18.19.0
- Rust 1.75.0
- Tauri 2.0.0
```

## ✅ 验证清单

在提交代码或报告问题前，请确认：

- [ ] Tauri 应用可以正常启动
- [ ] 本地摄像头可以添加到预览区域并显示画面
- [ ] 网络摄像机（RTSP/FLV/HLS）可以成功播放
- [ ] 从预览区域拖拽信号源到画布格子正常工作
- [ ] 多个画布可以同时显示同一个摄像头的不同克隆
- [ ] 错误提示清晰明确
- [ ] 组件卸载时正确清理资源（停止流、销毁播放器）
- [ ] 控制台没有未处理的错误

---

**祝测试顺利！如有问题，请随时联系开发团队。** 🎉
