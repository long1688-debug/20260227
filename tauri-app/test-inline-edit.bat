@echo off
chcp 65001 >nul
echo ========================================
echo   网络摄像机行内编辑功能 - 快速测试
echo ========================================
echo.
echo 📋 测试步骤:
echo.
echo 1. 启动Tauri开发服务器
echo 2. 打开摄像机发现面板
echo 3. 扫描网络设备
echo 4. 测试行内编辑功能
echo.
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] 检查依赖...
if not exist "node_modules" (
    echo ⚠️  未检测到node_modules,正在安装依赖...
    call npm install
    if errorlevel 1 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
    echo ✅ 依赖安装完成
) else (
    echo ✅ 依赖已存在
)

echo.
echo [2/3] 启动Tauri开发服务器...
echo 💡 提示: 按 Ctrl+C 可停止服务器
echo.

start npm run tauri dev

echo.
echo [3/3] 等待应用启动...
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo ✅ 应用已启动!
echo ========================================
echo.
echo 🎯 测试清单:
echo.
echo □ 1. 点击"🌐 多网卡扫描(推荐)"
echo □ 2. 点击"开始扫描"按钮
echo □ 3. 等待扫描完成,查看设备列表
echo □ 4. 找到任意设备,点击"✏️ 编辑"
echo □ 5. 修改IP地址、端口、用户名或密码
echo □ 6. 点击"💾 保存"验证保存功能
echo □ 7. 再次编辑,点击"❌ 取消"验证恢复功能
echo □ 8. 尝试输入无效IP(如999.999.999.999)验证格式检查
echo.
echo 📖 详细文档: CAMERA_CONFIG_ENHANCEMENT_GUIDE.md
echo.
echo ========================================
echo.

pause