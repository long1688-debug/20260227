# 实训教学系统 - 启动指南

## 系统架构

本系统由两部分组成：
1. 后端服务器（Node.js）- 端口 8080
2. 前端应用（Tauri）- 开发模式下默认端口 5174

## 启动步骤

### 1. 启动后端服务器

```bash
cd server
npm install # 如果是首次运行，安装依赖
npm start   # 启动服务器
```

服务器将在 `http://localhost:8080` 上运行。

### 2. 启动前端应用（开发模式）

```bash
cd tauri-app
npm install # 如果是首次运行，安装依赖
npm run dev # 启动前端开发服务器
```

前端将在 `http://localhost:5174` 上运行，并通过代理自动连接到后端API。

## 环境变量配置

如需自定义后端API地址，请创建 `.env` 文件：

```bash
# 在 tauri-app 目录下
cp .env.example .env
```

然后编辑 `.env` 文件：

```bash
# API 服务器地址
VUE_APP_API_BASE_URL=http://your-server-ip:8080

# WebSocket 服务器地址
VUE_APP_WS_BASE_URL=ws://your-server-ip:8080
```

## 重要说明

1. **服务器绑定地址**：后端服务器现在绑定到 `0.0.0.0:8080`，允许从任何接口访问。
2. **开发代理**：前端开发服务器使用代理转发 `/api` 请求到后端服务器。
3. **生产部署**：在生产环境中，确保前后端部署在同一域名下，避免跨域问题。

## 故障排除

如果遇到 `ERR_CONNECTION_REFUSED` 错误：

1. 确保后端服务器已在 `http://localhost:8080` 上启动
2. 检查防火墙设置是否阻止了端口 8080
3. 确认 `.env` 文件中的API地址配置正确
4. 重启前后端服务器

## 生产构建

```bash
# 构建前端
cd tauri-app
npm run build

# 构建后端（可选）
cd server
npm run build
```