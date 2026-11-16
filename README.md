# 🎓 Training Teaching System - 智能教学录播系统

> 基于 Tauri + Vue 3 + Rust 的跨平台智能教学录播解决方案

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-blue)](https://tauri.app/)
[![Vue](https://img.shields.io/badge/Vue-3.x-green)](https://vuejs.org/)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Android%20%7C%20Linux-lightgrey)]()

---

## ✨ 特性

### 🎯 核心功能

- **多信号源管理**: 支持15种信号源类型（摄像头、采集卡、高拍仪、远程桌面等）
- **智能画布布局**: 拖拽式信号源排列，支持画中画、网格等多种布局
- **专业录制系统**:
  - 前端 MediaRecorder（快速预览录制）
  - 后端 FFmpeg（高质量专业录制，支持硬件加速）
- **实时字幕识别**: 集成 Whisper 离线语音识别
- **PTZ云台控制**: 支持 ONVIF 协议摄像机远程控制
- **音频混音管理**: 多通道音频混合与监控

### 🌍 跨平台支持

- ✅ **Windows 桌面** (x86_64) - 当前重点
- ✅ **Windows 触控屏** - 触摸手势优化
- 🔜 **Android 平板** (ARM/ARM64) - 后期适配
- 🔜 **信创系统** (UOS/麒麟) - 后期适配

### ⚡ 技术优势

- **高性能**: Rust 后端 + 硬件加速编解码（NVENC/QSV/AMF）
- **低延迟**: WebRTC 实时传输，<100ms 端到端延迟
- **离线可用**: 本地部署，无需网络连接
- **可扩展**: 模块化架构，易于添加新功能

---

## 🚀 快速开始

### 前置要求

- **Node.js** >= 18.x
- **Rust** >= 1.70
- **Git** (版本控制)

### 安装 Git（首次使用）

1. **下载 Git for Windows**: <https://git-scm.com/download/win>
2. **运行安装程序**，使用默认选项
3. **重启终端**后验证: `git --version`

### 初始化项目

#### 方法一：自动脚本（推荐）

```bash
# 双击运行
setup-git.bat
```

脚本会自动：

- ✅ 检查 Git 是否安装
- ✅ 初始化 Git 仓库
- ✅ 配置用户信息
- ✅ 创建首次提交

#### 方法二：手动初始化

```bash
# 1. 初始化 Git
git init

# 2. 配置用户信息
git config user.name "Your Name"
git config user.email "your.email@example.com"

# 3. 添加并提交
git add .
git commit -m "Initial commit"
```

### 开发模式

```bash
# 进入 Tauri 应用目录
cd tauri-app

# 安装依赖
npm install

# 启动开发服务器
npm run tauri dev
```

### 生产构建

```bash
# Windows MSI/NSIS 安装包
npm run tauri build

# 输出位置: tauri-app/src-tauri/target/release/bundle/
```

---

## 📁 项目结构

```
training-teaching-system/
├── tauri-app/              # Tauri 桌面应用
│   ├── src/                # Vue 3 前端代码
│   │   ├── components/     # Vue 组件
│   │   ├── composables/    # 组合式函数
│   │   ├── stores/         # Pinia 状态管理
│   │   ├── services/       # API 服务层
│   │   └── views/          # 页面视图
│   ├── src-tauri/          # Rust 后端代码
│   │   ├── src/            # Rust 模块
│   │   │   ├── main.rs     # 入口文件
│   │   │   ├── commands.rs # Tauri 命令
│   │   │   └── capture_device.rs # 采集设备管理
│   │   └── Cargo.toml      # Rust 依赖
│   └── package.json        # Node.js 依赖
│
├── server/                 # Node.js 服务器
│   ├── server.js           # 主服务器
│   ├── license-server.js   # 许可证管理
│   ├── webrtc-signaling-server.js # WebRTC 信令
│   └── web/                # Web 管理界面
│
├── utils/                  # 工具脚本
├── include/                # C/C++ 头文件
├── .gitignore              # Git 忽略规则
├── GIT_GUIDE.md            # Git 使用指南 ⭐
└── README.md               # 本文件
```

---

## 📖 文档

### 开发文档

- 📘 [Git 版本控制指南](GIT_GUIDE.md) - **必读**：版本控制最佳实践
- 📗 [跨平台快速参考](tauri-app/QUICK_REFERENCE.md) - 平台检测与适配
- 📙 [跨平台适配指南](tauri-app/CROSS_PLATFORM_GUIDE.md) - 详细开发文档（待恢复）
- 📕 [实施总结](tauri-app/IMPLEMENTATION_SUMMARY.md) - 技术架构（待恢复）

### 功能文档

- 🎥 [视频录制双场景设计](tauri-app/QUICK_REFERENCE.md#视频录制双场景设计方案) - 顶部工具栏 vs 右侧面板
- 📹 [15种信号源类型](tauri-app/QUICK_REFERENCE.md#支持的信号源类型) - 完整列表与使用说明
- 🎤 [实时字幕识别](server/docs/README.md) - Whisper 集成指南
- 🎮 [PTZ云台控制](tauri-app/QUICK_REFERENCE.md) - ONVIF 协议支持

### 服务器文档

- 🔐 [许可证管理指南](server/docs/LICENSE_MANAGEMENT_GUIDE.md) - 激活码生成与管理
- 🌐 [服务器状态监控](server/docs/SERVER_STATUS.md) - 健康检查与监控
- 🛠️ [部署指南](server/docs/SETUP_COMPLETE.md) - 生产环境部署

---

## 🔧 技术栈

### 前端

- **框架**: Vue 3 (Composition API)
- **构建工具**: Vite
- **UI 库**: Element Plus
- **状态管理**: Pinia
- **路由**: Vue Router
- **样式**: Tailwind CSS + SCSS

### 后端（桌面应用）

- **框架**: Tauri v2
- **语言**: Rust
- **音视频**: FFmpeg + GStreamer
- **硬件加速**: NVENC / QSV / AMF / VAAPI
- **数据库**: SQLite

### 服务器端

- **运行时**: Node.js
- **Web 框架**: Express
- **WebSocket**: ws
- **数据库**: SQLite
- **AI 模型**: Whisper.cpp

---

## 🎯 核心模块

### 1. 信号源管理系统

支持15种信号源类型：

| 类型 | 说明 | 状态 |
|------|------|------|
| 📹 本地摄像头 | USB/内置摄像头 | ✅ 已完成 |
| 🎥 采集卡 | HDMI/SDI/DVI/VGA | ✅ 后端完成 |
| 📷 高拍仪 | 文档扫描仪 | ✅ 后端完成 |
| 🌐 网络摄像机 | RTSP/RTMP/ONVIF | ✅ 已完成 |
| 🥽 MR摄像机 | HoloLens/Quest | 🔜 待开发 |
| 📡 远程摄像头 | 远程桌面画面 | 🔜 待开发 |
| 📱 手机摄像头 | WiFi/USB投屏 | 🔜 待开发 |
| 🖥️ 远程桌面 | RDP/VNC/TeamViewer | ✅ 已完成 |
| 📲 手机桌面 | 移动设备镜像 | 🔜 待开发 |
| 🎬 媒体文件 | MP4/AVI/MKV | ✅ 已完成 |
| 📺 网络串流 | RTMP/HLS/SRT | ✅ 已完成 |
| 🌍 网页 | 嵌入任意网页 | 🔜 待开发 |
| 📊 PPT | PowerPoint演示 | 🔜 待开发 |
| 📝 Word | Word文档 | 🔜 待开发 |
| 🧠 思维导图 | XMind/MindManager | ✅ 已实现 |

### 2. 录制系统

**双场景设计**:

- **场景一**（顶部工具栏）: MediaRecorder 前端录制
  - 适用：快速录制单个预览窗口
  - 格式：WebM
  - 速度：~50ms 即时启动

- **场景二**（右侧面板）: FFmpeg 后端录制
  - 适用：专业录制（多路合成、水印、字幕）
  - 格式：MP4/MKV/WebM
  - 特性：硬件加速、多通道混音

### 3. 跨平台适配

**平台检测**:

```javascript
import { detectPlatform } from '@/utils/platformDetector';

const info = await detectPlatform();
console.log(info.platform);    // 'windows_desktop' | 'android_tablet' | ...
console.log(info.inputMode);   // 'mouse_keyboard' | 'touch' | 'hybrid'
```

**自适应布局**:

```vue
<AdaptiveContainer>
  <template #sidebar>侧边栏</template>
  <main>主内容</main>
  <template #footer v-if="isTouchMode">底部操作栏</template>
</AdaptiveContainer>
```

---

## 🧪 测试

### 单元测试

```bash
cd tauri-app
npm run test
```

### E2E 测试

```bash
npm run test:e2e
```

### 真机测试清单

详见 [触控应用调试与测试最佳实践](tauri-app/QUICK_REFERENCE.md#触控优化要点)

---

## 📦 发布

### Windows

```bash
# MSI 安装包
npm run tauri build -- --bundles msi

# NSIS 安装包
npm run tauri build -- --bundles nsis

# 便携版（ZIP）
npm run tauri build -- --bundles zip
```

### Android（后期）

```bash
npx tauri android build --apk
```

### Linux（后期）

```bash
# AppImage
npx tauri build --target x86_64-unknown-linux-gnu

# DEB/RPM
npx tauri build --target x86_64-unknown-linux-gnu --bundles deb,rpm
```

---

## 🪟 Windows 安装包（Inno Setup）

```powershell
# 1. 准备 ffmpeg / node / server / ZLMediaKit / WebView2 到 tauri-app/src-tauri/resources/runtime/
powershell -ExecutionPolicy Bypass -File scripts\prepare-runtime.ps1 -ZLMediaKitDir <ZLMediaKit 目录>
# 2. Release 构建（不要打包 target\debug）
cd tauri-app; npm run tauri build; cd ..
# 3. 生成安装包 installer\Output\TrainingTeacher-Setup-*.exe
ISCC.exe installer\teacher.iss
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 开发流程

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feat/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feat/amazing-feature`)
5. 创建 Pull Request

### 代码规范

- 遵循 [Vue 风格指南](https://vuejs.org/style-guide/)
- 遵循 [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
- 提交前运行 `npm run lint` 和 `cargo clippy`

---

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

---

## 👥 团队

- **开发团队**: Training Teaching System Team
- **技术支持**: <support@training-system.com>
- **问题反馈**: <https://github.com/training-system/issues>

---

## 🙏 致谢

本项目使用了以下开源项目：

- [Tauri](https://tauri.app/) - 构建更小、更快、更安全的桌面应用
- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架
- [FFmpeg](https://ffmpeg.org/) - 完整的跨平台音视频解决方案
- [Whisper](https://github.com/openai/whisper) - OpenAI 的语音识别模型
- [Element Plus](https://element-plus.org/) - Vue 3 组件库

---

<div align="center">

**Made with ❤️ by Training Teaching System Team**

[⭐ Star this repo](https://github.com/training-system) • [📖 Read the docs](GIT_GUIDE.md) • [🐛 Report a bug](https://github.com/training-system/issues)

</div>
