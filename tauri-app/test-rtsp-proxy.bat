@echo off
echo ========================================
echo   Testing RTSP Proxy Server
echo ========================================
echo.

cd /d "%~dp0rtsp-proxy"

echo Checking Node.js version...
node --version
echo.

echo Checking dependencies...
npm list
echo.

echo Starting RTSP Proxy server in test mode...
echo Press Ctrl+C to stop the server
echo.

node rtsp-proxy.js
