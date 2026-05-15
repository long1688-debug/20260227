@echo off
chcp 65001 >nul
echo ========================================
echo   启动完整开发环境
echo ========================================
echo.
echo [信息] 切换到 tauri-app 目录...
cd /d "%~dp0tauri-app"

echo [信息] 启动后端 + RTSP代理 + Tauri...
echo.
npm run tauri:dev:with-server

pause
