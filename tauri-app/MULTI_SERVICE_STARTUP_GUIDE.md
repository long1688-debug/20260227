# 多服务启动指南

## 📋 项目服务依赖

本项目包含以下需要同时运行的服务：

| 服务名称 | 端口 | 说明 | 必需性 |
|---------|------|------|--------|
| **RTSP Proxy** | 8081 | RTSP转HTTP-FLV代理服务 | ✅ 必需（网络摄像机） |
| **Tauri应用** | 5173 | 桌面应用程序 | ✅ 必需 |
| **后端API服务器** | 3000 | WebSocket + REST API | ⚠️ 可选（如需后端功能） |

## 🚀 启动方式

### 方式1：标准开发模式（推荐）

只启动RTSP Proxy和Tauri应用：

```bash
cd f:\20260227\tauri-app
npm run tauri:dev
```

**效果：**

- 🔵 RTSP Proxy服务启动（蓝色标签）
- 🟢 Tauri桌面应用启动（绿色标签）
- 按 `Ctrl+C` 会同时停止两个服务

### 方式2：完整开发模式（含后端）

同时启动后端API、RTSP Proxy和Tauri应用：

```bash
cd f:\20260227\tauri-app
npm run tauri:dev:with-server
```

**效果：**

- 🟡 后端API服务器启动（黄色标签）
- 🔵 RTSP Proxy服务启动（蓝色标签）
- 🟢 Tauri桌面应用启动（绿色标签）

### 方式3：严格模式

任何一个服务失败都会终止所有服务：

```bash
npm run tauri:dev:full
```

**适用场景：**

- 测试完整的服务依赖链
- 生产环境部署前验证

## 🔧 单独管理服务

### 检查服务状态

```bash
# 检查RTSP Proxy
npm run rtsp-proxy:check

# 检查后端API
npm run server:check
```

### 单独启动服务

```bash
# 只启动RTSP Proxy
npm run rtsp-proxy:start

# 只启动后端API
npm run server:start
```

## 📊 concurrently 配置详解

### 参数说明

```json
"tauri:dev": "concurrently -n \"RTSP-Proxy,Tauri\" -c \"blue,green\" -k \"npm run rtsp-proxy:start\" \"tauri dev\""
```

| 参数 | 含义 | 示例值 |
|------|------|--------|
| `-n` | 进程名称列表 | `"RTSP-Proxy,Tauri"` |
| `-c` | 进程颜色列表 | `"blue,green"` |
| `-k` | 一个退出时杀死其他 | 防止僵尸进程 |
| `--kill-others-on-fail` | 任一失败则全部终止 | 严格模式 |

### 可用颜色

- `red` - 红色
- `green` - 绿色
- `yellow` - 黄色
- `blue` - 蓝色
- `magenta` - 品红
- `cyan` - 青色
- `white` - 白色
- `gray` - 灰色

## ❓ 常见问题

### Q1: 为什么需要使用 concurrently？

**A:** 因为项目有多个独立的服务需要同时运行：

- RTSP Proxy是独立的Node.js服务
- Tauri是Rust + Vite的桌面应用
- 后端API是另一个Node.js服务

手动在多个终端启动很麻烦，concurrently可以一键启动所有服务。

### Q2: 如果某个服务启动失败怎么办？

**A:**

- 使用 `tauri:dev`（带 `-k`）：一个服务停止会自动停止其他服务
- 使用 `tauri:dev:full`（带 `--kill-others-on-fail`）：一个服务失败会立即终止所有服务

### Q3: 如何查看每个服务的日志？

**A:** concurrently会为每个服务添加彩色前缀：

```
[RTSP-Proxy] RTSP Proxy listening on port 8081
[Tauri]      App ready on http://localhost:5173
```

### Q4: 可以自定义启动顺序吗？

**A:** concurrently默认并行启动。如果需要串行启动，可以使用：

```bash
# 先启动RTSP Proxy，等待3秒后再启动Tauri
"tauri:dev:sequential": "npm run rtsp-proxy:start & sleep 3 && tauri dev"
```

但通常不需要，因为各个服务是独立的。

### Q5: Windows PowerShell中curl命令报错？

**A:** PowerShell的curl是Invoke-WebRequest的别名，使用方式不同。可以：

**方法1：** 使用PowerShell语法

```powershell
Invoke-WebRequest -Uri http://localhost:8081/health -UseBasicParsing
```

**方法2：** 安装真正的curl

```powershell
choco install curl
```

**方法3：** 使用浏览器访问

```
http://localhost:8081/health
```

## 🎯 最佳实践

### 1. 日常开发

```bash
# 只需要网络摄像机功能
npm run tauri:dev
```

### 2. 完整功能测试

```bash
# 需要后端API支持（用户管理、数据存储等）
npm run tauri:dev:with-server
```

### 3. 快速检查服务

```bash
# 打开新终端检查
npm run rtsp-proxy:check
npm run server:check
```

### 4. 清理重启

```bash
# Ctrl+C 停止所有服务
# 然后重新启动
npm run tauri:dev
```

## 📝 添加新服务

如果您需要添加新的依赖服务（例如Redis、数据库等），可以这样扩展：

### 步骤1：在 package.json 中添加启动脚本

```json
{
  "scripts": {
    "redis:start": "redis-server",
    "my-service:start": "cd my-service && npm start"
  }
}
```

### 步骤2：更新 concurrently 配置

```json
{
  "scripts": {
    "tauri:dev:custom": "concurrently -n \"Redis,MyService,RTSP-Proxy,Tauri\" -c \"red,yellow,blue,green\" -k \"npm run redis:start\" \"npm run my-service:start\" \"npm run rtsp-proxy:start\" \"tauri dev\""
  }
}
```

### 步骤3：使用新配置

```bash
npm run tauri:dev:custom
```

## 🔍 故障排查

### 问题1：端口被占用

**症状：** 服务启动失败，提示端口已被占用

**解决：**

```bash
# 查找占用端口的进程
netstat -ano | findstr :8081

# 结束进程（替换PID为实际进程ID）
taskkill /F /PID <PID>
```

### 问题2：RTSP Proxy未启动导致黑屏

**症状：** Tauri应用启动正常，但网络摄像机预览黑屏

**解决：**

```bash
# 检查RTSP Proxy是否运行
npm run rtsp-proxy:check

# 如果没有运行，手动启动
npm run rtsp-proxy:start

# 或者使用完整的启动命令
npm run tauri:dev
```

### 问题3：concurrently 命令未找到

**症状：** 运行 `npm run tauri:dev` 时报错 `concurrently not found`

**解决：**

```bash
# 重新安装依赖
npm install

# 确认 concurrently 已安装
npm list concurrently
```

## 📚 相关文档

- [RTSP Proxy配置指南](./rtsp-proxy/README.md)
- [Tauri开发指南](./TAURI_STARTUP_GUIDE.md)
- [网络摄像机问题解决指南](../网络摄像机问题解决指南.md)
