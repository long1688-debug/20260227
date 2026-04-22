@echo off
chcp 936 >nul
title 实训教学系统 - 服务器启动
echo ==========================================
echo   实训教学系统 - 服务器启动
echo ==========================================
echo.
cd /d "%~dp0"

echo 检查依赖...
if not exist "node_modules" (
    echo [提示] 未检测到 node_modules，正在安装依赖...
    call install.bat
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
)

echo.
echo 启动服务器...
echo.

node server.js

if %errorlevel% neq 0 (
    echo.
    echo [错误] 服务器运行异常退出
    pause
)
