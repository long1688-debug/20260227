<template>
  <div id="app" class="app">
    <!-- 加载状态指示器（仅 Tauri 模式下显示后端等待状态） -->
    <div v-if="backendLoading" class="backend-loading">
      <div class="loading-content">
        <div class="spinner"></div>
        <p>正在启动后端服务...</p>
      </div>
    </div>

    <!-- 主路由视图 -->
    <router-view />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { 
  initDeviceDetection, 
  setupBreakpointListener, 
  getDeviceInfo,
  DeviceType 
} from '@/utils/device';

const backendLoading = ref(false);

onMounted(async () => {
  console.log('App mounted');

  // 初始化设备检测（必须在应用挂载前完成）
  initDeviceDetection();
  setupBreakpointListener();
  
  // 获取设备信息并暴露到全局
  const deviceInfo = getDeviceInfo();
  window.__DEVICE_INFO__ = deviceInfo;
  console.log('[DeviceInfo] 设备信息:', deviceInfo);

  // 根据设备类型设置不同的应用行为
  setupDeviceSpecificBehavior(deviceInfo);

  // Tauri 环境检测与初始化
  if (window.__TAURI__) {
    console.log('Running in Tauri environment');
    window.__RUNTIME_ENV__ = 'tauri';

    // 初始化 Tauri 增强功能
    await initTauriFeatures();
  } else {
    console.log('Running in browser environment');
    window.__RUNTIME_ENV__ = 'browser';
  }
});

/**
 * 根据设备类型设置特定行为
 */
function setupDeviceSpecificBehavior(deviceInfo) {
  switch (deviceInfo.deviceType) {
    case DeviceType.WINDOWS_TABLET:
      console.log('[Device] Windows 平板模式 - 启用触控优化');
      setupTouchOptimizations();
      break;
    case DeviceType.ANDROID_TABLET:
      console.log('[Device] Android 平板模式 - 启用触控优化和Material Design风格');
      setupTouchOptimizations();
      setupMaterialDesignStyles();
      break;
    case DeviceType.LINUX_UOS:
      console.log('[Device] UOS 系统 - 启用信创系统优化');
      setupXinchuangOptimizations();
      break;
    case DeviceType.LINUX_KYLIN:
      console.log('[Device] 麒麟系统 - 启用信创系统优化');
      setupXinchuangOptimizations();
      break;
    default:
      console.log('[Device] 桌面模式');
  }
}

/**
 * 设置触控优化
 */
function setupTouchOptimizations() {
  // 添加触控优化类
  document.documentElement.classList.add('touch-optimized');
  
  // 设置触摸动作支持
  document.documentElement.style.touchAction = 'manipulation';
  
  // 增加按钮点击区域
  document.documentElement.style.setProperty('--button-min-width', '48px');
  document.documentElement.style.setProperty('--button-min-height', '48px');
}

/**
 * 设置 Material Design 风格
 */
function setupMaterialDesignStyles() {
  document.documentElement.classList.add('material-design');
}

/**
 * 设置信创系统优化
 */
function setupXinchuangOptimizations() {
  document.documentElement.classList.add('xinchuang-optimized');
  
  // 信创系统字体优化
  document.documentElement.style.fontFamily = 'Noto Sans SC, Microsoft YaHei, sans-serif';
}

/**
 * Tauri 特有功能初始化
 */
async function initTauriFeatures() {
  try {
    const appModule = await import('@tauri-apps/api/app');
    const { getCurrentWindow } = await import('@tauri-apps/api/window');

    // 获取应用信息
    try {
      const name = await appModule.getName();
      const version = await appModule.getVersion();
      window.__APP_INFO__ = { name, version };
      console.log(`[App] 应用: ${name} v${version}`);
    } catch {}

    // 🎯 关键修复：动态调整窗口尺寸以排除任务栏
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const { primaryMonitor } = await import('@tauri-apps/api/window');
      const { LogicalSize, LogicalPosition } = await import('@tauri-apps/api/dpi');

      const appWindow = getCurrentWindow();

      // 获取主显示器信息
      const monitor = await primaryMonitor();

      if (monitor) {
        // Tauri v2: monitor.workArea 和 monitor.size 都是 { width, height } 对象
        // workArea 可能包含 position: { x, y }
        const screenSize = monitor.size;
        const workArea = monitor.workArea || monitor.size;

        // 安全获取尺寸值（兼容不同返回格式）
        const screenW = screenSize?.width ?? 0;
        const screenH = screenSize?.height ?? 0;
        const workW = workArea?.width ?? screenW;
        const workH = workArea?.height ?? screenH;
        const workX = workArea?.position?.x ?? 0;
        const workY = workArea?.position?.y ?? 0;

        console.log(`[App] 屏幕尺寸: ${screenW}x${screenH}`);
        console.log(`[App] 工作区域: ${workW}x${workH}`);

        // 计算任务栏高度
        const taskbarHeight = screenH - workH;
        console.log(`[App] 任务栏高度: ${taskbarHeight}px`);

        // 设置 CSS 变量供组件使用（仅在有效值时设置）
        if (taskbarHeight > 0 && !isNaN(taskbarHeight)) {
          document.documentElement.style.setProperty('--taskbar-height', `${taskbarHeight}px`);
        } else {
          document.documentElement.style.setProperty('--taskbar-height', '0px');
        }
        if (workH > 0 && !isNaN(workH)) {
          document.documentElement.style.setProperty('--safe-viewport-height', `${workH}px`);
        }

        console.log(`[App] 已设置CSS变量: --taskbar-height=${taskbarHeight}px, --safe-viewport-height=${workH}px`);

        // 🎯 关键：强制调整窗口大小以匹配工作区域
        try {
          const currentSize = await appWindow.outerSize();
          const currentPosition = await appWindow.outerPosition();

          console.log(`[App] 当前窗口: ${currentSize.width}x${currentSize.height} @ (${currentPosition.x}, ${currentPosition.y})`);

          // 🎯 修复：Tauri v2 使用 LogicalSize 和 LogicalPosition（从 @tauri-apps/api/dpi 导入）
          if (workW > 0 && workH > 0) {
            const sizeObj = new LogicalSize(workW, workH);
            await appWindow.setSize(sizeObj);

            const positionObj = new LogicalPosition(workX, workY);
            await appWindow.setPosition(positionObj);

            console.log(`[App] 已调整窗口到工作区域: ${workW}x${workH} @ (${workX}, ${workY})`);
          } else {
            console.warn('[App] 工作区域尺寸无效，跳过窗口调整');
          }
        } catch (resizeError) {
          console.warn('[App] 调整窗口尺寸失败:', resizeError);
        }
      } else {
        console.warn('[App] 无法获取显示器信息');
      }

    } catch (error) {
      console.warn('[App] 窗口尺寸调整失败:', error);
    }

    // 监听应用就绪事件
    try {
      const { listen } = await import('@tauri-apps/api/event');
      await listen('app:ready', () => {
        console.log('[App] 后端已就绪');
        backendLoading.value = false;
      });

      // 同时监听后端就绪事件
      listen('backend:ready', () => {
        backendLoading.value = false;
      });
    } catch {}

    // 禁止拖放文件到窗口（防止意外导航）
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());

  } catch (error) {
    console.warn('[App] Tauri 特性初始化失败:', error);
  }
}
</script>

<style lang="scss">
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: #1a1a2e;
}

.app {
  width: 100%;
  height: 100%;
}

/* Element Plus 样式覆盖 */
::deep(.el-button) {
  border-radius: 6px;
}

::deep(.el-input) {
  .el-input__wrapper {
    border-radius: 6px;
  }
}

::deep(.el-select) {
  .el-input__wrapper {
    border-radius: 6px;
  }
}

::deep(.el-card) {
  border-radius: 12px;
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* 后端加载状态 */
.backend-loading {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(26, 26, 46, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;

  .loading-content {
    text-align: center;
    color: #fff;

    p {
      margin-top: 16px;
      font-size: 14px;
      color: #909399;
    }
  }

  .spinner {
    width: 40px;
    height: 40px;
    margin: 0 auto;
    border: 3px solid rgba(64, 158, 255, 0.2);
    border-top-color: #409eff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
