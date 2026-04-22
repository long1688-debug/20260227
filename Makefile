# 实训教学系统 - Makefile
# 用于快速执行常见开发任务（Tauri + Vue3 + Node.js）
# Windows 用户可使用 nmake 或 wsl make

.PHONY: help dev dev-watch dev-full dev-backend up down restart logs build clean health install-all doctor ports tauri-dev tauri-build

# 默认目标
help:
	@echo "============================================"
	@echo "  实训教学系统 - 开发命令 (Tauri v2)"
	@echo "============================================"
	@echo ""
	@echo "一键编译与启动:"
	@echo "  make all          - 一键编译并启动所有服务 (开发者模式)"
	@echo "  make build-all    - 一键编译所有组件 (不启动)"
	@echo "  make prod         - 生产模式编译 (可执行文件)"
	@echo "  make clean-all    - 清理 + 编译 + 启动"
	@echo ""
	@echo "本地开发:"
	@echo "  make dev          - 启动 Node.js 后端服务"
	@echo "  make dev-watch    - 后端 + Vite 前端热重载"
	@echo "  make dev-full     - 全栈开发模式"
	@echo "  make dev-backend  - 仅后端双服务"
	@echo ""
	@echo "Tauri 开发:"
	@echo "  make tauri-dev    - Tauri 开发模式"
	@echo "  make tauri-build - Tauri 构建安装包"
	@echo ""
	@echo "Docker 开发:"
	@echo "  make up           - 启动 Docker 容器"
	@echo "  make down         - 停止 Docker 容器"
	@echo "  make restart      - 重启 Docker 容器"
	@echo "  make logs         - 查看容器日志"
	@echo "  make build        - 构建 Docker 镜像"
	@echo ""
	@echo "健康检查:"
	@echo "  make health       - 检查所有服务健康状态"
	@echo "  make check        - 快速检查服务状态"
	@echo ""
	@echo "其他:"
	@echo "  make install-all  - 安装所有依赖"
	@echo "  make clean        - 清理构建文件"
	@echo "  make doctor       - 检查开发环境"
	@echo "  make ports        - 检查端口占用"
	@echo ""

# 本地开发
dev:
	@echo "启动本地开发模式..."
	npm run dev

dev-watch:
	@echo "启动后端 + Vite 前端..."
	npm run dev:watch

dev-full:
	@echo "启动全栈开发环境..."
	npm run dev:full

dev-backend:
	@echo "启动后端双服务..."
	npm run dev:backend

# Tauri 开发
tauri-dev:
	@echo "启动 Tauri 开发模式..."
	cd tauri-app && npm run tauri:dev

tauri-build:
	@echo "构建 Tauri 安装包..."
	cd tauri-app && npm run tauri:build

# Docker 操作
up:
	@echo "启动 Docker 容器..."
	docker-compose -f docker-compose.dev.yml up -d
	@echo "容器已启动，使用 'make logs' 查看日志"

down:
	@echo "停止 Docker 容器..."
	docker-compose -f docker-compose.dev.yml down

restart:
	@echo "重启 Docker 容器..."
	docker-compose -f docker-compose.dev.yml restart

logs:
	docker-compose -f docker-compose.dev.yml logs -f

logs-api:
	docker-compose -f docker-compose.dev.yml logs -f api-server

logs-license:
	docker-compose -f docker-compose.dev.yml logs -f license-server

logs-ws:
	docker-compose -f docker-compose.dev.yml logs -f ws-server

logs-vite:
	docker-compose -f docker-compose.dev.yml logs -f vite-dev

build:
	@echo "构建 Docker 镜像..."
	docker-compose -f docker-compose.dev.yml build --no-cache

build-up:
	@echo "构建并启动..."
	docker-compose -f docker-compose.dev.yml up -d --build

docker-dev:
	@echo "构建并启动所有容器..."
	docker-compose -f docker-compose.dev.yml up --build

# 健康检查
health:
	@echo "执行服务健康检查..."
	npm run health

check:
	@echo "快速检查服务状态..."
	@echo "检查 API 服务器..."
	@curl -s http://localhost:8080/health || echo "API 服务器未响应"
	@echo ""
	@echo "检查许可证服务..."
	@curl -s http://localhost:8082/health || echo "许可证服务器未响应"
	@echo ""
	@echo "检查 WebSocket..."
	@powershell -Command "Test-NetConnection -ComputerName localhost -Port 8081 -InformationLevel Quiet" || echo "WebSocket 未监听"
	@echo ""

# 依赖安装
install-all:
	@echo "安装所有依赖..."
	npm install --legacy-peer-deps
	cd server && npm install --legacy-peer-deps
	cd tauri-app && npm install --legacy-peer-deps
	@echo "依赖安装完成"

# 清理
clean:
	@echo "清理构建文件..."
	-if exist node_modules rmdir /s /q node_modules
	-if exist server\node_modules rmdir /s /q server\node_modules
	-if exist tauri-app\node_modules rmdir /s /q tauri-app\node_modules
	-if exist server\dist rmdir /s /q server\dist
	-if exist tauri-app\dist rmdir /s /q tauri-app\dist
	-if exist tauri-app\src-tauri\target rmdir /s /q tauri-app\src-tauri\target
	@echo "清理完成"

clean-docker:
	@echo "清理 Docker 资源..."
	docker-compose -f docker-compose.dev.yml down -v
	docker system prune -f

# 开发环境检查
doctor:
	@echo "检查开发环境..."
	@echo ""
	@echo "Node.js 版本:"
	@node --version || echo "Node.js 未安装"
	@echo ""
	@echo "npm 版本:"
	@npm --version || echo "npm 未安装"
	@echo ""
	@echo "Rust 版本:"
	@rustc --version || echo "Rust 未安装 (Tauri 需要)"
	@echo ""
	@echo "Docker 版本:"
	@docker --version || echo "Docker 未安装"
	@echo ""
	@echo "Docker Compose 版本:"
	@docker-compose --version || echo "Docker Compose 未安装"
	@echo ""

# 端口检查（Windows）
ports:
	@echo "检查端口占用情况..."
	@netstat -ano | findstr ":8080 " || echo "端口 8080 未被占用"
	@netstat -ano | findstr ":8081 " || echo "端口 8081 未被占用"
	@netstat -ano | findstr ":8082 " || echo "端口 8082 未被占用"
	@netstat -ano | findstr ":5173 " || echo "端口 5173 未被占用"

# ========================================
# 一键编译与启动
# ========================================

# 一键编译并启动所有服务（开发者模式）
all:
	@echo "启动一键编译与启动流程..."
	@if exist build-all.ps1 ( \
		powershell -ExecutionPolicy Bypass -File build-all.ps1 -DevMode \
	) else if exist build-all.bat ( \
		build-all.bat \
	) else ( \
		echo "错误：未找到 build-all.bat 或 build-all.ps1"; \
		exit 1 \
	)

# 仅编译所有组件（不启动服务）
build-all:
	@echo "编译所有组件..."
	@if exist build-all.ps1 ( \
		powershell -ExecutionPolicy Bypass -File build-all.ps1 -BuildOnly \
	) else if exist build-all.bat ( \
		powershell -ExecutionPolicy Bypass -Command "cd '$(CURDIR)'; .\build-all.bat" \
	) else ( \
		echo "手动执行编译..."; \
		npm install --legacy-peer-deps; \
		cd server && npm install --legacy-peer-deps && npm run build; \
		cd ../tauri-app && npm install --legacy-peer-deps; \
		echo "编译完成" \
	)

# 生产模式编译（可执行文件）
prod:
	@echo "生产模式编译..."
	@if exist build-all.ps1 ( \
		powershell -ExecutionPolicy Bypass -File build-all.ps1 -ProdMode -Clean \
	) else ( \
		echo "手动执行生产构建..."; \
		cd server && npm install --legacy-peer-deps && npm run build; \
		cd ../tauri-app && npm install --legacy-peer-deps && npm run tauri:build; \
		echo "生产构建完成" \
	)

# 清理 + 编译 + 启动
clean-all: clean build-all
	@echo "清理并启动服务..."
	@$(MAKE) all

# 快速启动开发者模式（仅启动服务，不编译）
run:
	@echo "快速启动开发者模式..."
	@if exist build-all.ps1 ( \
		powershell -ExecutionPolicy Bypass -File build-all.ps1 -DevMode \
	) else if exist build-all.bat ( \
		build-all.bat \
	) else ( \
		npm run dev:backend \
	)

# 服务健康检查（增强版）
check-all: check
	@echo ""
	@echo "增强健康检查..."
	@echo "检查 Tauri 开发服务器..."
	@curl -s http://localhost:5173 >nul 2>&1 && echo "[OK] Vite 开发服务器 (5173)" || echo "[XX] Vite 开发服务器未响应"
	@echo ""
	@echo "提示：使用 'make all' 一键启动所有服务"
