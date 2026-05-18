/**
 * 设备检测与平台适配工具
 * 支持 Android 平板、信创系统（UOS/麒麟）、Windows 平板
 */

export const DeviceType = {
  DESKTOP: 'desktop',
  WINDOWS_TABLET: 'windows_tablet',
  ANDROID_TABLET: 'android_tablet',
  ANDROID_PHONE: 'android_phone',
  LINUX_UOS: 'linux_uos',
  LINUX_KYLIN: 'linux_kylin',
  LINUX_GENERIC: 'linux_generic'
};

export const PlatformType = {
  WINDOWS: 'windows',
  ANDROID: 'android',
  LINUX: 'linux',
  MACOS: 'macos',
  IOS: 'ios'
};

/**
 * 获取当前平台类型
 */
export function getPlatform() {
  if (typeof window === 'undefined') {
    return PlatformType.LINUX;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  
  if (userAgent.includes('windows')) {
    return PlatformType.WINDOWS;
  }
  
  if (userAgent.includes('android')) {
    return PlatformType.ANDROID;
  }
  
  if (userAgent.includes('mac os')) {
    return PlatformType.MACOS;
  }
  
  if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
    return PlatformType.IOS;
  }
  
  // 默认认为是 Linux（包括 UOS/麒麟）
  return PlatformType.LINUX;
}

/**
 * 判断是否为平板设备
 */
export function isTablet() {
  if (typeof window === 'undefined') {
    return false;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  
  // 平板通常宽度在 768px 到 1024px 之间
  const isWideEnough = Math.min(screenWidth, screenHeight) >= 768;
  const isNotTooWide = Math.max(screenWidth, screenHeight) <= 1366;
  
  // 检查是否有平板特征
  const hasTabletKeyword = userAgent.includes('tablet') || 
                          userAgent.includes('ipad') || 
                          (userAgent.includes('android') && !userAgent.includes('mobile'));
  
  return hasTabletKeyword || (isWideEnough && isNotTooWide);
}

/**
 * 判断是否为移动端设备
 */
export function isMobile() {
  if (typeof window === 'undefined') {
    return false;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  
  return userAgent.includes('android') || 
         userAgent.includes('iphone') || 
         userAgent.includes('ipad') || 
         userAgent.includes('mobile');
}

/**
 * 判断是否为 UOS 系统
 */
export function isUos() {
  if (typeof window === 'undefined') {
    return false;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const platform = window.navigator.platform || '';
  
  // UOS 系统特征
  return userAgent.includes('uos') || 
         userAgent.includes('uniontech') || 
         platform.toLowerCase().includes('uos');
}

/**
 * 判断是否为麒麟系统
 */
export function isKylin() {
  if (typeof window === 'undefined') {
    return false;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const platform = window.navigator.platform || '';
  
  // 麒麟系统特征
  return userAgent.includes('kylin') || 
         userAgent.includes('kylinos') || 
         platform.toLowerCase().includes('kylin');
}

/**
 * 获取设备类型
 */
export function getDeviceType() {
  const platform = getPlatform();
  
  switch (platform) {
    case PlatformType.WINDOWS:
      return isTablet() ? DeviceType.WINDOWS_TABLET : DeviceType.DESKTOP;
    
    case PlatformType.ANDROID:
      if (isTablet()) {
        return DeviceType.ANDROID_TABLET;
      }
      return DeviceType.ANDROID_PHONE;
    
    case PlatformType.LINUX:
      if (isUos()) {
        return DeviceType.LINUX_UOS;
      }
      if (isKylin()) {
        return DeviceType.LINUX_KYLIN;
      }
      return DeviceType.LINUX_GENERIC;
    
    default:
      return DeviceType.DESKTOP;
  }
}

/**
 * 判断是否为信创系统（UOS/麒麟）
 */
export function isXinchuangSystem() {
  return isUos() || isKylin();
}

/**
 * 获取设备信息
 */
export function getDeviceInfo() {
  if (typeof window === 'undefined') {
    return {
      platform: PlatformType.LINUX,
      deviceType: DeviceType.LINUX_GENERIC,
      isMobile: false,
      isTablet: false,
      isXinchuang: false,
      screenWidth: 1920,
      screenHeight: 1080,
      pixelRatio: 1
    };
  }

  const platform = getPlatform();
  const deviceType = getDeviceType();
  
  return {
    platform,
    deviceType,
    isMobile: isMobile(),
    isTablet: isTablet(),
    isXinchuang: isXinchuangSystem(),
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    pixelRatio: window.devicePixelRatio || 1,
    userAgent: window.navigator.userAgent,
    language: window.navigator.language || 'zh-CN'
  };
}

/**
 * 获取响应式断点
 */
export function getBreakpoint() {
  if (typeof window === 'undefined') {
    return 'xl';
  }

  const width = window.innerWidth;
  
  if (width < 576) return 'xs';
  if (width < 768) return 'sm';
  if (width < 992) return 'md';
  if (width < 1200) return 'lg';
  if (width < 1600) return 'xl';
  return 'xxl';
}

/**
 * 判断当前是否为平板模式（需要特殊适配）
 */
export function isTabletMode() {
  const deviceType = getDeviceType();
  return deviceType === DeviceType.WINDOWS_TABLET || 
         deviceType === DeviceType.ANDROID_TABLET;
}

/**
 * 获取适配建议
 */
export function getAdaptationSuggestions() {
  const deviceInfo = getDeviceInfo();
  const suggestions = [];
  
  // 平板设备建议
  if (deviceInfo.isTablet) {
    suggestions.push('使用触摸友好的大按钮');
    suggestions.push('优化手势操作');
    suggestions.push('调整布局为单列模式');
  }
  
  // 信创系统建议
  if (deviceInfo.isXinchuang) {
    suggestions.push('使用系统原生字体');
    suggestions.push('避免使用非标准 Web API');
    suggestions.push('优化性能以适应国产硬件');
  }
  
  // 移动端建议
  if (deviceInfo.isMobile) {
    suggestions.push('简化页面内容');
    suggestions.push('优化加载速度');
    suggestions.push('支持手势滑动');
  }
  
  return suggestions;
}

/**
 * 初始化设备检测（添加 CSS 类到 html 标签）
 */
export function initDeviceDetection() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const deviceInfo = getDeviceInfo();
  const html = document.documentElement;
  
  // 添加平台类
  html.classList.add(`platform-${deviceInfo.platform}`);
  
  // 添加设备类型类
  html.classList.add(`device-${deviceInfo.deviceType}`);
  
  // 添加平板/移动端类
  if (deviceInfo.isTablet) {
    html.classList.add('is-tablet');
  }
  if (deviceInfo.isMobile) {
    html.classList.add('is-mobile');
  }
  if (deviceInfo.isXinchuang) {
    html.classList.add('is-xinchuang');
  }
  
  // 添加断点类
  html.classList.add(`breakpoint-${getBreakpoint()}`);
  
  console.log('[DeviceDetector] 设备检测初始化完成:', deviceInfo);
}

/**
 * 监听窗口大小变化，更新断点类
 */
export function setupBreakpointListener() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  let currentBreakpoint = getBreakpoint();
  
  window.addEventListener('resize', () => {
    const newBreakpoint = getBreakpoint();
    if (newBreakpoint !== currentBreakpoint) {
      const html = document.documentElement;
      html.classList.remove(`breakpoint-${currentBreakpoint}`);
      html.classList.add(`breakpoint-${newBreakpoint}`);
      currentBreakpoint = newBreakpoint;
    }
  });
}
