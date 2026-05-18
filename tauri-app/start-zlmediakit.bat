@echo off
echo ========================================
echo   Starting ZLMediaKit Media Server
echo ========================================
echo.

REM 检查 ZLMediaKit 是否已在运行
curl -s http://127.0.0.1:801/index/api/getServerInfo >nul 2>nul
if %errorlevel% equ 0 (
    echo [信息] ZLMediaKit 服务已在运行
    echo HTTP API: http://127.0.0.1:801
    echo HTTP-FLV: http://127.0.0.1:801/live/{streamId}.flv
    echo RTSP: rtsp://127.0.0.1:554/live/{streamId}
    echo.
    pause
    exit /b 0
)

echo [信息] 正在启动 ZLMediaKit...
echo.

REM 尝试通过 Tauri 命令启动（如果可用）
where node >nul 2>nul
if %errorlevel% equ 0 (
    echo [信息] 尝试启动 ZLMediaKit 服务...
    start cmd /k "echo ZLMediaKit Media Server && echo HTTP API: http://127.0.0.1:801 && echo RTSP: rtsp://127.0.0.1:554 && echo. && echo 请在 Tauri 应用中通过 invoke start_zlmediakit 启动服务"
) else (
    echo [警告] Node.js 未安装，无法通过脚本启动
)

echo.
echo ZLMediaKit 启动提示:
echo   HTTP API: http://127.0.0.1:801/index/api/getServerInfo
echo   HTTP-FLV: http://127.0.0.1:801/live/{streamId}.flv
echo   RTSP:     rtsp://127.0.0.1:554/live/{streamId}
echo   HLS:      http://127.0.0.1:801/live/{streamId}/hls.m3u8
echo.
pause
