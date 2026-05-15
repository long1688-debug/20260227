@echo off
chcp 65001 >nul
echo ========================================
echo   启动 Tauri + RTSP代理
echo ========================================
echo.
echo [信息] 切换到 tauri-app 目录...
cd /d "%~dp0tauri-app"

echo [信息] 启动 RTSP代理 + Tauri...
echo.
npm run tauri:dev

pause
