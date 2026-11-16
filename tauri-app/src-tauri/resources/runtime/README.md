# 运行时依赖（随安装包分发）

本目录的内容会通过 `tauri.conf.json` 的 `bundle.resources` 和 `installer/teacher.iss` 安装到 `<安装目录>\runtime\`。
程序按 `bin_resolver.rs` 的顺序查找：环境变量 → `<exe 目录>\runtime\<子目录>\` → 开发时的本目录 → PATH。

二进制文件不入库，请在打包前运行 `scripts/prepare-runtime.ps1` 生成：

```
runtime/
  ffmpeg/ffmpeg.exe, ffprobe.exe      # 自动下载（gyan.dev release essentials）
  node/node.exe                       # 自动下载（Node.js 20 便携版），用于运行 server/
  server/                             # 复制 ../../server，并 npm ci --omit=dev
  zlmediakit/MediaServer.exe + config.ini 等   # 从 -ZLMediaKitDir 复制（需自行编译/准备）
  models/whisper/ggml-base.bin        # 打包机下载一次（-WhisperModel 选型号，-WhisperModelDir 用本地文件）；运行时不联网
  models/detection/yolox_nano.onnx    # 物体检测模型（YOLOX-Nano，Apache-2.0），打包机下载一次
  MicrosoftEdgeWebview2Setup.exe      # 自动下载，Inno Setup 在目标机缺 WebView2 时静默安装
```

环境变量覆盖：`FFMPEG_PATH`、`ZLMEDIAKIT_PATH`、`NODE_PATH_EXE`。
