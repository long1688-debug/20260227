@echo off
chcp 936 >nul
title 实训教学系统 - 服务器安装
echo ==========================================
echo   实训教学系统 - 服务器安装
echo ==========================================
echo.
cd /d "%~dp0"

echo [1/3] 检查 Node.js 安装...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    echo 下载地址：https://nodejs.org/
    pause
    exit /b 1
)
echo [成功] Node.js 已安装 - node --version
echo.

echo [2/3] 安装 npm 依赖...
call npm install
if %errorlevel% neq 0 (
    echo [错误] 依赖安装失败
    pause
    exit /b 1
)
echo [成功] 依赖安装完成
echo.

echo [3/3] 验证安装...
node -e "require('ws'); console.log('ws 模块验证成功')"
if %errorlevel% neq 0 (
    echo [错误] 模块验证失败
    pause
    exit /b 1
)
echo.

echo ==========================================
echo   安装完成
echo ==========================================
echo.
echo 现在可以运行服务器：start_server.bat
echo.
echo 默认账户：admin / admin123
echo 教师账户：teacher1 / teacher123
echo.
pause
