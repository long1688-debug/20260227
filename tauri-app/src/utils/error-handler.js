/**
 * 统一错误处理和工具函数
 */

import { ElMessage } from 'element-plus';

/**
 * 错误类型枚举
 */
export const ErrorTypes = {
  NETWORK: 'NETWORK_ERROR',
  API: 'API_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  PERMISSION: 'PERMISSION_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR'
};

/**
 * 错误消息映射
 */
const ERROR_MESSAGES = {
  [ErrorTypes.NETWORK]: '网络连接失败，请检查网络或服务器状态',
  [ErrorTypes.API]: 'API 请求失败，请稍后重试',
  [ErrorTypes.VALIDATION]: '数据验证失败，请检查输入',
  [ErrorTypes.PERMISSION]: '权限不足，无法执行此操作',
  [ErrorTypes.UNKNOWN]: '发生未知错误，请联系管理员'
};

/**
 * 统一错误处理类
 */
class ErrorHandler {
  constructor() {
    this.errorCallbacks = [];
  }

  /**
   * 注册错误回调
   */
  onError(callback) {
    this.errorCallbacks.push(callback);
  }

  /**
   * 处理错误
   */
  handleError(error, context = {}) {
    const errorInfo = this.parseError(error);
    
    // 触发回调
    this.errorCallbacks.forEach(callback => {
      try {
        callback(errorInfo, context);
      } catch (e) {
        console.error('Error callback failed:', e);
      }
    });

    // 记录日志
    console.error('[ErrorHandler]', errorInfo.type, errorInfo.message, context);

    return errorInfo;
  }

  /**
   * 解析错误
   */
  parseError(error) {
    let type = ErrorTypes.UNKNOWN;
    let message = error.message || '未知错误';
    let status = null;

    // 网络错误
    if (error.message?.includes('NetworkError') || 
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('ECONNREFUSED')) {
      type = ErrorTypes.NETWORK;
      message = ERROR_MESSAGES[ErrorTypes.NETWORK];
    }
    
    // HTTP 错误
    if (error.message?.includes('HTTP')) {
      type = ErrorTypes.API;
      const match = error.message.match(/HTTP (\d+)/);
      status = match ? parseInt(match[1]) : null;
      
      if (status === 401) {
        type = ErrorTypes.PERMISSION;
        message = '登录已过期，请重新登录';
      } else if (status === 403) {
        type = ErrorTypes.PERMISSION;
        message = ERROR_MESSAGES[ErrorTypes.PERMISSION];
      } else if (status === 404) {
        message = '请求的资源不存在';
      } else if (status >= 500) {
        message = '服务器错误，请稍后重试';
      } else {
        message = ERROR_MESSAGES[ErrorTypes.API];
      }
    }

    // 验证错误
    if (error.message?.includes('validation') || 
        error.message?.includes('invalid')) {
      type = ErrorTypes.VALIDATION;
      message = ERROR_MESSAGES[ErrorTypes.VALIDATION];
    }

    return {
      type,
      message,
      originalMessage: error.message,
      status,
      stack: error.stack
    };
  }

  /**
   * 显示错误消息
   */
  showError(error, options = {}) {
    const errorInfo = this.parseError(error);
    const message = options.message || errorInfo.message;
    
    ElMessage.error({
      message,
      duration: options.duration || 3000,
      showClose: options.showClose !== false
    });

    return errorInfo;
  }

  /**
   * 显示成功消息
   */
  showSuccess(message, options = {}) {
    ElMessage.success({
      message,
      duration: options.duration || 2000,
      showClose: options.showClose !== false
    });
  }

  /**
   * 显示警告消息
   */
  showWarning(message, options = {}) {
    ElMessage.warning({
      message,
      duration: options.duration || 3000,
      showClose: options.showClose !== false
    });
  }

  /**
   * 显示信息消息
   */
  showInfo(message, options = {}) {
    ElMessage.info({
      message,
      duration: options.duration || 3000,
      showClose: options.showClose !== false
    });
  }
}

// 创建单例
export const errorHandler = new ErrorHandler();

/**
 * 异步操作包装器 - 自动处理错误
 * @param {Promise} promise - 异步操作
 * @param {Object} options - 选项
 * @param {boolean} options.showError - 是否显示错误消息
 * @param {string} options.errorMessage - 自定义错误消息
 * @param {Function} options.onError - 错误回调
 */
export async function wrapAsync(promise, options = {}) {
  try {
    const result = await promise;
    return { success: true, data: result };
  } catch (error) {
    const errorInfo = errorHandler.handleError(error, options);
    
    if (options.showError !== false) {
      errorHandler.showError(error, {
        message: options.errorMessage
      });
    }
    
    if (options.onError) {
      options.onError(errorInfo);
    }
    
    return { success: false, error: errorInfo };
  }
}

/**
 * 防抖函数
 */
export function debounce(fn, delay = 300) {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

/**
 * 节流函数
 */
export function throttle(fn, delay = 300) {
  let lastTime = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastTime >= delay) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}

/**
 * 格式化时间
 */
export function formatTime(date, format = 'YYYY-MM-DD HH:mm:ss') {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

/**
 * 格式化时长
 */
export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * 生成随机 ID
 */
export function generateId(prefix = '') {
  return prefix + Date.now() + Math.random().toString(36).substr(2, 9);
}

/**
 * 深拷贝
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (obj instanceof Object) {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
  return obj;
}

/**
 * 本地存储工具
 */
export const storage = {
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Storage get error:', error);
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Storage set error:', error);
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Storage remove error:', error);
      return false;
    }
  },

  clear() {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('Storage clear error:', error);
      return false;
    }
  }
};

export default {
  errorHandler,
  wrapAsync,
  debounce,
  throttle,
  formatTime,
  formatFileSize,
  formatDuration,
  generateId,
  deepClone,
  storage,
  ErrorTypes
};
