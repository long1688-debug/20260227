@echo off
chcp 936 >nul
title 实训教学系统 - Node.js 服务器
echo ==========================================
echo   实训教学系统 - Node.js 服务器
echo ==========================================
echo.
cd /d "%~dp0"

echo [1/2] 检查 Node.js 安装...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js
    echo 下载地址：https://nodejs.org/
    pause
    exit /b 1
)
echo [成功] Node.js 已安装 - node --version
echo.

echo [2/2] 启动服务器...
if not exist "node_modules" (
    echo [提示] 正在安装依赖...
    call npm install
) else (
    echo [成功] 依赖已安装
)

echo.
echo ==========================================
echo   服务器启动中...
echo ==========================================
echo.
echo   HTTP 端口：8080
echo   WebSocket 端口：8081
echo.
echo   访问地址：
echo   - 系统首页：http://localhost:8080
echo   - 学生端：http://localhost:8080/student/training.html
echo   - 教师端：http://localhost:8080/teacher/management.html
echo   - 视觉分析：http://localhost:8080/vision_analysis.html
echo   - API 测试：http://localhost:8080/api_test.html
echo.
echo   按 Ctrl+C 停止服务器
echo.

node server.js

if %errorlevel% neq 0 (
    echo.
    echo [错误] 服务器运行异常退出
    pause
)
