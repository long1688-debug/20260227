@echo off
chcp 65001 >nul
REM Tauri 开发环境启动脚本 (Windows)
REM 用途: 一键启动 Tauri 开发环境

echo ====================================
echo 实训教学系统 - Tauri 开发环境启动
echo ====================================
echo.

REM 检查是否在正确的目录
if not exist "package.json" (
    echo [错误] 未找到 package.json，请确保在 tauri-app 目录下运行此脚本
    pause
    exit /b 1
)

REM 检查 Node.js
echo [1/4] 检查 Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)
node --version

REM 检查 Rust
echo [2/4] 检查 Rust...
where rustc >nul 2>nul
if %errorlevel% neq 0 (
    echo [警告] 未找到 Rust，请先安装 Rust
    echo 下载地址: https://www.rust-lang.org/tools/install
    echo 或者运行: winget install Rustlang.Rust.MSVC
    pause
    exit /b 1
)
rustc --version

REM 检查端口
echo [3/4] 检查端口 5174...
netstat -ano | findstr :5174 >nul 2>nul
if %errorlevel% equ 0 (
    echo [警告] 端口 5174 已被占用
    echo 正在尝试清理端口...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5174') do (
        echo 正在终止进程 %%a...
        taskkill /PID %%a /F >nul 2>nul
    )
    timeout /t 2 >nul
)

REM 清理缓存
echo [4/4] 清理缓存...
if exist "node_modules\.vite" (
    echo 删除 Vite 缓存...
    rmdir /s /q "node_modules\.vite"
)
if exist "dist" (
    echo 删除构建输出...
    rmdir /s /q "dist"
)

REM 启动 Tauri
echo.
echo ====================================
echo 正在启动 Tauri 开发环境...
echo ====================================
echo.
echo 首次启动可能需要 3-5 分钟（编译 Rust 代码）
echo 启动后会自动打开应用窗口
echo.
echo 按 Ctrl+C 可停止开发服务器
echo.

npm run tauri:dev

if %errorlevel% neq 0 (
    echo.
    echo ====================================
    echo 启动失败，请检查错误信息
    echo ====================================
    pause
    exit /b 1
)

pause
