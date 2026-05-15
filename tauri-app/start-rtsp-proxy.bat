@echo off
echo ========================================
echo   Starting RTSP Proxy Server
echo ========================================
echo.

cd /d "%~dp0rtsp-proxy"

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

echo Starting RTSP Proxy on port 8081...
echo.
start cmd /k "node rtsp-proxy.js"

echo RTSP Proxy server started!
echo HTTP-FLV URL: http://localhost:8081/live/{streamId}.flv
echo WebSocket URL: ws://localhost:8081/live/{streamId}
echo API: http://localhost:8081/api/streams
echo.
pause
