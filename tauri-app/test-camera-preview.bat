@echo off
chcp 65001 >nul
REM Tauri 摄像头预览功能测试脚本
REM 用途: 快速启动应用并打开调试工具

echo ====================================
echo 实训教学系统 - 摄像头预览功能测试
echo ====================================
echo.

REM 检查是否在正确的目录
if not exist "package.json" (
    echo [错误] 未找到 package.json，请确保在 tauri-app 目录下运行此脚本
    pause
    exit /b 1
)

echo [提示] 此脚本将:
echo   1. 清理缓存文件
echo   2. 启动 Tauri 开发环境
echo   3. 自动打开浏览器控制台（需要手动按 F12）
echo.
echo [提示] 启动后请执行以下操作:
echo   1. 按 F12 打开开发者工具
echo   2. 切换到 Console 标签
echo   3. 按照 TAURI_STARTUP_GUIDE.md 中的测试步骤操作
echo.

REM 清理缓存
echo [1/3] 清理缓存...
if exist "node_modules\.vite" (
    echo 删除 Vite 缓存...
    rmdir /s /q "node_modules\.vite"
)
if exist "dist" (
    echo 删除构建输出...
    rmdir /s /q "dist"
)
if exist "src-tauri\target\debug\.fingerprint" (
    echo 清理 Rust 指纹缓存...
    rmdir /s /q "src-tauri\target\debug\.fingerprint"
)

REM 检查端口
echo [2/3] 检查端口 5174...
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

REM 启动 Tauri
echo [3/3] 启动 Tauri 开发环境...
echo.
echo ====================================
echo 正在启动应用...
echo ====================================
echo.
echo 📌 重要提示:
echo   - 首次启动可能需要 3-5 分钟（编译 Rust 代码）
echo   - 启动后会自动打开应用窗口
echo   - 请按 F12 打开开发者工具查看日志
echo   - 参考 TAURI_STARTUP_GUIDE.md 进行功能测试
echo.
echo 🔍 测试清单:
echo   ✓ 本地摄像头添加到预览区域
echo   ✓ 网络摄像机（RTSP/FLV/HLS）播放
echo   ✓ 从预览区域拖拽到画布格子
echo   ✓ 多画布显示同一摄像头
echo.
echo 按 Ctrl+C 可停止开发服务器
echo.

npm run tauri:dev

if %errorlevel% neq 0 (
    echo.
    echo ====================================
    echo ❌ 启动失败，请检查错误信息
    echo ====================================
    echo.
    echo 常见问题:
    echo   1. Rust 未安装 - 运行: winget install Rustlang.Rust.MSVC
    echo   2. 端口被占用 - 关闭其他使用 5174 端口的程序
    echo   3. 依赖缺失 - 运行: npm install
    echo.
    pause
    exit /b 1
)

pause
