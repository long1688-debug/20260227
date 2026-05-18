@echo off
chcp 65001 >nul
echo ========================================
echo   启动 Tauri + ZLMediaKit
echo ========================================
echo.
echo [信息] 切换到 tauri-app 目录...
cd /d "%~dp0tauri-app"

echo [信息] 启动 ZLMediaKit + Tauri...
echo.
npm run tauri:dev

pause
