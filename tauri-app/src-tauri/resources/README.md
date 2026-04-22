# Tauri 资源文件

此目录用于存放需要在 Tauri 桌面应用中打包的静态资源文件。

## 模型文件

### YOLO 模型

1. **下载模型**：
   ```bash
   # 在 tauri-app 目录下执行
   mkdir -p src-tauri/resources/models
   npx transformers-cli download-model Xenova/yolov8n-quantized ./src-tauri/resources/models/yolov8n.onnx
   ```

2. **Windows 下载方式**：
   ```powershell
   cd tauri-app
   mkdir src-tauri\resources\models
   # 使用 PowerShell 下载量化模型
   Invoke-WebRequest -Uri "https://huggingface.co/Xenova/yolov8n-quantized/resolve/main/onnx/model.onnx" -OutFile "src-tauri\resources\models\yolov8n.onnx"
   ```

3. **手动下载**：
   - 访问 https://huggingface.co/Xenova/yolov8n-quantized
   - 下载 `onnx/model.onnx` 文件
   - 重命名为 `yolov8n.onnx`
   - 放到 `src-tauri/resources/models/` 目录

## 构建说明

打包后，模型文件将位于：
- Windows: `%APPDATA%\实训教学系统 - 教师端\resources\models\`
- macOS: `~/Library/Application Support/com.training.teaching.teacher/resources/models/`
- Linux: `~/.config/com.training.teaching.teacher/resources/models/`

## 访问路径

在 WebView 中访问：
```javascript
// Tauri 环境
'resource:///models/yolov8n.onnx'

// 开发环境
'/models/yolov8n.onnx'
```
