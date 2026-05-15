@echo off
chcp 65001 >nul
echo ========================================
echo   RTSP Proxy 服务启动脚本
echo ========================================
echo.

REM 检查Node.js是否安装
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [错误] Node.js 未安装或未添加到PATH
    echo 请下载安装 Node.js: https://nodejs.org/
    pause
    exit /b 1
)

echo [信息] Node.js 版本:
node --version
echo.

REM 检查rtsp-proxy.js是否存在
if not exist "rtsp-proxy.js" (
    echo [错误] rtsp-proxy.js 文件不存在
    echo 当前目录: %CD%
    pause
    exit /b 1
)

echo [信息] 找到 rtsp-proxy.js
echo.

REM 检查FFmpeg是否安装
where ffmpeg >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [警告] FFmpeg 未安装或未添加到PATH
    echo RTSP转码功能可能无法正常工作
    echo 请下载 FFmpeg: https://ffmpeg.org/download.html
    echo.
) else (
    echo [信息] FFmpeg 已安装
    ffmpeg -version | findstr "ffmpeg version"
    echo.
)

REM 启动RTSP Proxy服务
echo [信息] 正在启动 RTSP Proxy 服务...
echo [信息] HTTP端口: 8081
echo [信息] 最大并发流数: %MAX_STREAMS% (默认20)
echo [信息] 健康检查: http://localhost:8081/health
echo [信息] API文档: http://localhost:8081/api/streams
echo.
echo ========================================
echo   按 Ctrl+C 停止服务
echo ========================================
echo.

REM 🎯 设置 Node.js 内存限制为 4GB
set NODE_OPTIONS=--max-old-space-size=4096

REM 🎯 设置最大并发流数（可通过环境变量覆盖）
if not defined MAX_STREAMS set MAX_STREAMS=20

node rtsp-proxy.js

pause
