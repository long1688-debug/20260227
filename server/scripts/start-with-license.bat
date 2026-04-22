@echo off
chcp 936 >nul
echo ==========================================
echo   实训教学系统 - 授权服务器启动脚本
echo ==========================================
echo.
cd /d "%~dp0"

echo [1/3] 初始化授权数据...
if not exist "license_data" mkdir license_data

if not exist "license_data\admins.json" (
    echo 正在创建默认管理员账户...
    echo [{"id":1,"username":"admin","password":"$2a$10$rKzV2x4J8Q8q8q8q8q8q8q","email":"admin@system.com","createdAt":"2024-01-01T00:00:00.000Z","lastLogin":null}] > license_data\admins.json
)

if not exist "license_data\codes.json" (
    echo [] > license_data\codes.json
)

if not exist "license_data\activations.json" (
    echo [] > license_data\activations.json
)

echo [完成] 授权数据已初始化
echo.

echo [2/3] 停止运行中的服务器...
for /f "tokens=2" %%i in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
    taskkill /F /PID %%i >nul 2>&1
)
timeout /t 2 /nobreak >nul
echo [完成] 旧进程已停止
echo.

echo [3/3] 启动授权服务器...
echo.
echo ==========================================
echo   服务器信息
echo ==========================================
echo   HTTP 端口：8080
echo   WebSocket 端口：8081
echo   授权管理页面：http://localhost:8080/license-manager
echo   默认管理员：admin / admin123
echo ==========================================
echo.

node server.js

if %errorlevel% neq 0 (
    echo.
    echo [错误] 服务器启动失败
    pause
    exit /b 1
)

pause
