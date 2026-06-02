/**
 * Tauri API 统一封装
 *
 * 提供统一的窗口控制和 IPC 调用接口，
 * 兼容 Tauri 运行时和浏览器开发模式。
 */

// 动态导入 Tauri API（避免浏览器环境报错）
let invokeFn = null;
let getCurrentFn = null;
let minimizeFn = null;
let maximizeFn = null;
let unmaximizeFn = null;
let closeFn = null;
let isMaximizedFn = null;

async function initTauri() {
  if (invokeFn) return; // 已初始化

  try {
    const core = await import('@tauri-apps/api/core');
    invokeFn = core.invoke;

    // 🎯 Tauri v2 兼容性处理：尝试从多个模块获取窗口 API
    let getCurrentWindow = null;

    // 尝试从 @tauri-apps/api/webviewWindow 导入
    try {
      const webviewWindowModule = await import('@tauri-apps/api/webviewWindow');
      getCurrentWindow = webviewWindowModule.getCurrentWindow ||
        webviewWindowModule.WebviewWindow?.getCurrent ||
        webviewWindowModule.default?.getCurrentWindow;
    } catch (e) {
      console.warn('[tauri-api] 无法从 webviewWindow 模块导入:', e.message);
    }

    // 如果从 webviewWindow 没找到，尝试从 @tauri-apps/api/window 导入
    if (!getCurrentWindow) {
      try {
        const windowModule = await import('@tauri-apps/api/window');
        getCurrentWindow = windowModule.getCurrentWindow ||
          windowModule.default?.getCurrentWindow;
      } catch (e) {
        console.warn('[tauri-api] 无法从 window 模块导入:', e.message);
      }
    }

    if (!getCurrentWindow || typeof getCurrentWindow !== 'function') {
      throw new Error('无法获取 getCurrentWindow 方法');
    }

    getCurrentFn = getCurrentWindow;
    const appWindow = getCurrentWindow();

    minimizeFn = appWindow.minimize.bind(appWindow);
    maximizeFn = appWindow.maximize.bind(appWindow);
    unmaximizeFn = appWindow.unmaximize.bind(appWindow);
    closeFn = appWindow.close.bind(appWindow);
    isMaximizedFn = appWindow.isMaximized.bind(appWindow);
    console.log('[tauri-api] Tauri API 初始化成功');
  } catch (e) {
    console.warn('[tauri-api] 非 Tauri 环境，使用模拟模式:', e.message);
    // 浏览器环境的空操作 fallback
    invokeFn = () => Promise.resolve({});
    minimizeFn = () => { };
    maximizeFn = () => { };
    unmaximizeFn = () => { };
    closeFn = () => { window.close(); };
    isMaximizedFn = () => Promise.resolve(false);
  }
}

// 自动初始化（延迟到首次调用）
let initPromise = null;

function ensureInit() {
  if (!initPromise) {
    initPromise = initTauri();
  }
  return initPromise;
}

// ========== 窗口控制（同步，无需 await） ==========

export async function minimizeWindow() {
  await ensureInit();
  return minimizeFn();
}

export async function maximizeWindow() {
  await ensureInit();
  if (await isMaximizedFn()) {
    return unmaximizeFn();
  }
  return maximizeFn();
}

export async function closeApp() {
  await ensureInit();
  return closeFn();
}

export async function openNativeWebviewWindow(label, url, title = '', options = {}) {
  await ensureInit();

  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    let webviewWindow = null;

    if (typeof WebviewWindow.getByLabel === 'function') {
      try {
        webviewWindow = WebviewWindow.getByLabel(label);
      } catch (err) {
        webviewWindow = null;
      }
    }

    if (webviewWindow) {
      webviewWindow.show();
      if (typeof webviewWindow.setFocus === 'function') {
        webviewWindow.setFocus();
      }
      return webviewWindow;
    }

    return new WebviewWindow(label, {
      url,
      title,
      width: options.width || 1280,
      height: options.height || 860,
      resizable: options.resizable !== false,
      center: options.center !== false,
      decorations: options.decorations !== false,
      visible: true,
      ...options
    });
  } catch (err) {
    console.warn('[Tauri API] 无法创建本地 Webview 窗口，回退到浏览器打开:', err);
    window.open(url, '_blank');
    return null;
  }
}

// ========== IPC 命令调用 ==========

export async function invoke(command, args) {
  await ensureInit();
  return invokeFn(command, args);
}

// ========== 授权相关快捷方法 ==========

export async function getRegistrationStatus() {
  return invoke('get_registration_status');
}

export async function getMachineCode() {
  return invoke('get_machine_code');
}

export async function activateRegistration(data) {
  return invoke('activate_registration', data);
}

export async function deactivateRegistration() {
  return invoke('deactivate_registration');
}

export async function exitApplication() {
  // 使用 Tauri 的方式退出应用
  return closeApp();
}

// ========== 设置相关快捷方法 ==========

export async function getSettings() {
  return invoke('get_settings');
}

export async function saveSettings(settings) {
  console.log('[Tauri API] saveSettings 调用, 参数:', settings);
  const result = await invoke('save_settings', { settings });
  console.log('[Tauri API] saveSettings 返回:', result);
  return result;
}

export async function getDefaultRecordingPath() {
  return invoke('get_default_recording_path');
}

export async function selectDirectory() {
  return invoke('select_directory');
}

// ========== 模型管理快捷方法 ==========

export async function listModels() {
  return invoke('list_models');
}

export async function downloadModel(url, filename) {
  return invoke('download_model', { url, filename });
}

export async function deleteModel(filename) {
  return invoke('delete_model', { filename });
}

export async function clearModelCache() {
  return invoke('clear_model_cache');
}

// ========== 文件操作快捷方法 ==========

export async function readFile(path) {
  return invoke('read_file', { path });
}

export async function writeFile(path, content) {
  return invoke('write_file', { path, content });
}

export async function checkFileExists(path) {
  return invoke('file_exists', { path });
}

export async function createDir(path) {
  return invoke('create_dir', { path });
}

// ========== 系统信息 ==========

export async function getSystemInfo() {
  return invoke('get_system_info');
}

export async function checkPortAvailable(port) {
  return invoke('check_port_available', { port });
}

// ========== 后端服务器管理 ==========

export async function startBackendServer() {
  return invoke('start_backend_server');
}

export async function stopBackendServer() {
  return invoke('stop_backend_server');
}

export async function checkBackendStatus() {
  return invoke('check_backend_status');
}
