/**
 * 跨平台设备检测与适配工具
 * 
 * 提供统一的平台检测、设备类型识别和UI适配方案，
 * 支持 Windows/Android/Linux(信创) 多平台运行。
 */

// 平台类型枚举
export const PlatformType = {
  WINDOWS_DESKTOP: 'windows_desktop',      // Windows 桌面（键鼠）
  WINDOWS_TOUCH: 'windows_touch',          // Windows 触控屏
  ANDROID_TABLET: 'android_tablet',        // Android 平板
  ANDROID_AIO: 'android_aio',              // Android 一体机
  LINUX_UOS: 'linux_uos',                  // 统信 UOS
  LINUX_KYLIN: 'linux_kylin',              // 麒麟系统
  LINUX_GENERIC: 'linux_generic',          // 其他 Linux
  BROWSER: 'browser'                       // 浏览器开发模式
};

// 输入方式枚举
export const InputMode = {
  MOUSE_KEYBOARD: 'mouse_keyboard',  // 键鼠操作
  TOUCH: 'touch',                    // 触摸操作
  HYBRID: 'hybrid'                   // 混合操作（触控+键鼠）
};

// UI 布局模式枚举（OME）
export const LayoutMode = {
  DESKTOP_SIDEBAR: 'desktop_sidebar',    // 桌面侧边栏模式
  TABLET_BOTTOM_TAB: 'tablet_bottom_tab', // 平板底部Tab模式
  LARGE_SCREEN_GRID: 'large_screen_grid', // 大屏网格模式
  COMPACT_SINGLE: 'compact_single'        // 紧凑单页模式
};

// 平台信息接口
export class PlatformInfo {
  constructor() {
    this.platform = PlatformType.BROWSER;
    this.inputMode = InputMode.MOUSE_KEYBOARD;
    this.layoutMode = LayoutMode.DESKTOP_SIDEBAR;
    this.isTouchCapable = false;
    this.screenWidth = window.innerWidth;
    this.screenHeight = window.innerHeight;
    this.pixelRatio = window.devicePixelRatio || 1;
    this.osVersion = '';
    this.deviceModel = '';
    this.hardwareAccelerated = false;
  }
}

let platformInfo = null;

/**
 * 检测当前运行平台
 */
export async function detectPlatform() {
  if (platformInfo) return platformInfo;

  platformInfo = new PlatformInfo();

  try {
    // 尝试获取 Tauri 平台信息
    const { platform, osVersion, arch } = await getTauriPlatformInfo();
    
    if (platform === 'win32') {
      platformInfo.platform = await isTouchDevice() 
        ? PlatformType.WINDOWS_TOUCH 
        : PlatformType.WINDOWS_DESKTOP;
      platformInfo.osVersion = `Windows ${osVersion}`;
    } else if (platform === 'android') {
      platformInfo.platform = await isTabletDevice() 
        ? PlatformType.ANDROID_TABLET 
        : PlatformType.ANDROID_AIO;
      platformInfo.osVersion = `Android ${osVersion}`;
    } else if (platform === 'linux') {
      platformInfo.platform = await detectLinuxDistro();
      platformInfo.osVersion = osVersion;
    }
    
    platformInfo.deviceModel = await getDeviceModel();
    platformInfo.hardwareAccelerated = await checkHardwareAcceleration();
  } catch (error) {
    console.warn('[PlatformDetector] 无法获取 Tauri 平台信息，使用 Web API:', error);
    // Fallback: 使用 Web API 检测
    detectPlatformFromWeb();
  }

  // 检测输入方式
  platformInfo.inputMode = await detectInputMode();
  
  // 确定布局模式
  platformInfo.layoutMode = determineLayoutMode();

  console.log('[PlatformDetector] 平台检测结果:', platformInfo);
  return platformInfo;
}

/**
 * 从 Web API 检测平台（浏览器环境 Fallback）
 */
function detectPlatformFromWeb() {
  const ua = navigator.userAgent.toLowerCase();
  
  if (ua.includes('win')) {
    platformInfo.platform = PlatformType.WINDOWS_DESKTOP;
    platformInfo.osVersion = 'Windows (Web)';
  } else if (ua.includes('android')) {
    platformInfo.platform = PlatformType.ANDROID_TABLET;
    platformInfo.osVersion = 'Android (Web)';
  } else if (ua.includes('linux')) {
    platformInfo.platform = PlatformType.LINUX_GENERIC;
    platformInfo.osVersion = 'Linux (Web)';
  }
}

/**
 * 获取 Tauri 平台信息
 */
async function getTauriPlatformInfo() {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const info = await invoke('get_platform_info');
    return {
      platform: info.platform,
      osVersion: info.os_version,
      arch: info.arch
    };
  } catch (error) {
    throw new Error('Tauri API not available');
  }
}

/**
 * 检测设备是否支持触摸
 */
async function isTouchDevice() {
  // Tauri 方式
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('is_touch_device');
  } catch {
    // Web API Fallback
    return ('ontouchstart' in window) || 
           (navigator.maxTouchPoints > 0) || 
           (navigator.msMaxTouchPoints > 0);
  }
}

/**
 * 检测设备是否为平板
 */
async function isTabletDevice() {
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  const minDimension = Math.min(screenWidth, screenHeight);
  
  // 平板通常最小边 ≥ 600px
  return minDimension >= 600 && await isTouchDevice();
}

/**
 * 检测 Linux 发行版类型
 */
async function detectLinuxDistro() {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const distro = await invoke('get_linux_distro');
    
    if (distro.includes('uos') || distro.includes('uniontech')) {
      return PlatformType.LINUX_UOS;
    } else if (distro.includes('kylin') || distro.includes('neokylin')) {
      return PlatformType.LINUX_KYLIN;
    }
    return PlatformType.LINUX_GENERIC;
  } catch {
    return PlatformType.LINUX_GENERIC;
  }
}

/**
 * 获取设备型号
 */
async function getDeviceModel() {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('get_device_model');
  } catch {
    return navigator.userAgent;
  }
}

/**
 * 检测硬件加速能力
 */
async function checkHardwareAcceleration() {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('check_gpu_acceleration');
  } catch {
    // Web API Fallback: 检查 WebGL 支持
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  }
}

/**
 * 检测输入方式
 */
async function detectInputMode() {
  const hasTouch = await isTouchDevice();
  const hasMouse = !hasTouch || (navigator.maxTouchPoints === 0);
  
  if (hasTouch && hasMouse) {
    return InputMode.HYBRID;
  } else if (hasTouch) {
    return InputMode.TOUCH;
  } else {
    return InputMode.MOUSE_KEYBOARD;
  }
}

/**
 * 根据屏幕尺寸和输入方式确定布局模式
 */
function determineLayoutMode() {
  const { screenWidth, inputMode } = platformInfo;
  
  // 大屏模式（≥ 1920px）
  if (screenWidth >= 1920) {
    return LayoutMode.LARGE_SCREEN_GRID;
  }
  
  // 平板模式（768px ~ 1920px 且触摸操作）
  if (screenWidth >= 768 && screenWidth < 1920 && 
      (inputMode === InputMode.TOUCH || inputMode === InputMode.HYBRID)) {
    return LayoutMode.TABLET_BOTTOM_TAB;
  }
  
  // 紧凑模式（< 768px）
  if (screenWidth < 768) {
    return LayoutMode.COMPACT_SINGLE;
  }
  
  // 默认桌面模式
  return LayoutMode.DESKTOP_SIDEBAR;
}

/**
 * 获取当前平台信息（同步，缓存结果）
 */
export function getCurrentPlatform() {
  if (!platformInfo) {
    console.warn('[PlatformDetector] 平台信息未初始化，调用 detectPlatform()');
    return new PlatformInfo();
  }
  return platformInfo;
}

/**
 * 判断是否为触控设备
 */
export function isTouchPlatform() {
  const info = getCurrentPlatform();
  return info.inputMode === InputMode.TOUCH || 
         info.inputMode === InputMode.HYBRID;
}

/**
 * 判断是否为移动端（Android）
 */
export function isMobilePlatform() {
  const info = getCurrentPlatform();
  return info.platform === PlatformType.ANDROID_TABLET || 
         info.platform === PlatformType.ANDROID_AIO;
}

/**
 * 判断是否为信创系统
 */
export function isXinchuangPlatform() {
  const info = getCurrentPlatform();
  return info.platform === PlatformType.LINUX_UOS || 
         info.platform === PlatformType.LINUX_KYLIN;
}

/**
 * 获取推荐的按钮尺寸（触控优化）
 */
export function getRecommendedButtonSize() {
  const info = getCurrentPlatform();
  
  if (info.inputMode === InputMode.TOUCH) {
    return { width: 48, height: 48, fontSize: 16 }; // 触控优化
  }
  return { width: 32, height: 32, fontSize: 14 }; // 键鼠标准
}

/**
 * 获取推荐的最小点击区域
 */
export function getMinTouchTarget() {
  return isTouchPlatform() ? 44 : 24; // Apple HIG / Material Design 标准
}

/**
 * 获取平台特定的 CSS 类名
 */
export function getPlatformCSSClass() {
  const info = getCurrentPlatform();
  return `platform-${info.platform} input-${info.inputMode} layout-${info.layoutMode}`;
}

/**
 * 监听窗口大小变化，动态调整布局
 */
export function watchLayoutChanges(callback) {
  let resizeTimer = null;
  
  const handleResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (platformInfo) {
        platformInfo.screenWidth = window.innerWidth;
        platformInfo.screenHeight = window.innerHeight;
        platformInfo.layoutMode = determineLayoutMode();
        callback(platformInfo);
      }
    }, 200); // 防抖 200ms
  };
  
  window.addEventListener('resize', handleResize);
  
  // 返回取消监听函数
  return () => {
    window.removeEventListener('resize', handleResize);
    clearTimeout(resizeTimer);
  };
}

/**
 * 重置平台检测（用于热重载或重新检测）
 */
export function resetPlatformDetection() {
  platformInfo = null;
}
