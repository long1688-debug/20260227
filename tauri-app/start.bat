@echo off
chcp 65001 >nul
echo ========================================
echo   实训教学系统 - Tauri 快速启动
echo ========================================
echo.

:menu
echo 请选择操作:
echo.
echo  1. 安装依赖 (首次运行)
echo  2. 启动开发模式 (tauri dev)
echo  3. 构建生产版本 (tauri build)
echo  4. 仅启动前端开发服务器
echo  5. 检查环境 (Rust/Node.js)
echo  6. 清理缓存
echo  0. 退出
echo.
set /p choice=请输入选项 (0-6): 

if "%choice%"=="1" goto install
if "%choice%"=="2" goto dev
if "%choice%"=="3" goto build
if "%choice%"=="4" goto frontend-dev
if "%choice%"=="5" goto check-env
if "%choice%"=="6" goto clean
if "%choice%"=="0" goto end
goto menu

:install
echo.
echo [1/2] 安装 Node.js 依赖...
call npm install
if errorlevel 1 (
    echo ❌ Node.js 依赖安装失败
    pause
    goto menu
)
echo.
echo [2/2] Node.js 依赖安装完成!
echo.
echo ✅ 依赖安装完成！
echo.
echo 提示：Rust 依赖会在首次构建时自动安装
echo.
pause
goto menu

:dev
echo.
echo ========================================
echo   启动 Tauri 开发模式
echo ========================================
echo.
echo 请确保:
echo  1. 已安装 Rust 工具链
echo  2. 已安装 Node.js 依赖
echo.
echo 正在启动开发服务器...
echo.
call npm run tauri:dev
goto menu

:build
echo.
echo ========================================
echo   构建生产版本
echo ========================================
echo.
echo 这可能需要 5-10 分钟...
echo 输出目录：src-tauri\target\release\
echo.
call npm run tauri:build
if errorlevel 1 (
    echo.
    echo ❌ 构建失败！
    echo.
    echo 可能的原因:
    echo  1. Rust 未安装或版本过低
    echo  2. Node.js 依赖未安装
    echo  3. 前端代码有错误
    echo.
    pause
    goto menu
)
echo.
echo ✅ 构建完成!
echo.
echo 可执行文件位置:
echo  src-tauri\target\release\实训教学系统 - 教师端.exe
echo.
pause
goto menu

:frontend-dev
echo.
echo [正在启动前端开发服务器...]
echo 访问地址：http://localhost:5173
echo.
call npm run dev
goto menu

:check-env
echo.
echo ========================================
echo   环境检查
echo ========================================
echo.
echo [Node.js]
node --version
npm --version
echo.
echo [Rust]
rustc --version 2>nul
if errorlevel 1 (
    echo ❌ Rust 未安装
    echo 请访问 https://rustup.rs/ 安装 Rust
) else (
    echo ✅ Rust 已安装
)
echo.
cargo --version 2>nul
if errorlevel 1 (
    echo ❌ Cargo 未安装
) else (
    echo ✅ Cargo 已安装
)
echo.
echo [Tauri CLI]
call npm list @tauri-apps/cli 2>nul
if errorlevel 1 (
    echo ⚠️  Tauri CLI 未安装 (会在首次运行时自动安装)
) else (
    echo ✅ Tauri CLI 已安装
)
echo.
echo ========================================
echo   环境检查完成
echo ========================================
echo.
pause
goto menu

:clean
echo.
echo ========================================
echo   清理缓存
echo ========================================
echo.
echo 即将清理:
echo  - node_modules
echo  - dist
echo  - src-tauri/target
echo.
set /p confirm=确认清理？(Y/N): 
if /i not "%confirm%"=="Y" goto menu
echo.
echo [清理中...]
if exist "node_modules" (
    echo 清理 node_modules...
    rmdir /s /q "node_modules"
)
if exist "dist" (
    echo 清理 dist...
    rmdir /s /q "dist"
)
if exist "src-tauri\target" (
    echo 清理 src-tauri/target...
    rmdir /s /q "src-tauri\target"
)
echo.
echo ✅ 清理完成!
echo.
pause
goto menu

:end
echo.
echo 再见!
exit /b 0
