@echo off
chcp 936 >nul
echo ========================================
echo   服务器打包脚本
echo ========================================
echo.
cd /d "%~dp0"

:: 检查 Node.js 是否安装
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    echo 下载地址：https://nodejs.org/
    pause
    exit /b 1
)

:: 检查 pkg 是否安装
where pkg >nul 2>&1
if %errorlevel% neq 0 (
    echo [信息] 正在安装 pkg 工具...
    call npm install -g pkg
    if %errorlevel% neq 0 (
        echo [错误] pkg 安装失败
        pause
        exit /b 1
    )
)

:: 安装依赖
if not exist "node_modules" (
    echo [信息] 正在安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
)

:: 删除旧的打包文件
if exist "dist" (
    echo [信息] 删除旧的打包文件...
    rmdir /s /q dist
)

:: 创建输出目录
if not exist "dist" mkdir dist

echo [信息] 开始打包服务器...
call pkg . --targets node18-win-x64 --output dist/TrainingTeachingSystem-Server.exe
if %errorlevel% neq 0 (
    echo [错误] 服务器打包失败
    pause
    exit /b 1
)

:: 复制数据文件
if exist "data" (
    echo [信息] 复制数据文件...
    xcopy /E /I /Y "data" "dist\data" >nul
)

:: 复制配置文件
if exist "config" (
    echo [信息] 复制配置文件...
    xcopy /E /I /Y "config" "dist\config" >nul
)

echo.
echo ========================================
echo   服务器打包完成！
echo ========================================
echo.
echo 输出文件：dist\TrainingTeachingSystem-Server.exe
echo.
pause
