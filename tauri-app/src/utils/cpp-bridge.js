/**
 * 原生通信桥接层
 *
 * 统一管理前端与后端的通信，支持三层架构：
 * 1. Tauri IPC (主要) - Rust 后端命令调用
 * 2. WebView2 Bridge (备选) - C++ 原生后端
 * 3. 模拟模式 (开发) - 浏览器环境空操作
 */

// ========== 运行时环境检测 ==========

/** @type {'tauri' | 'webview2' | 'browser' | null} */
let _runtimeEnv = null;

export function getRuntimeEnvironment() {
  if (_runtimeEnv) return _runtimeEnv;

  if (window.__TAURI__) {
    _runtimeEnv = 'tauri';
  } else if (window.chrome?.webview) {
    _runtimeEnv = 'webview2';
  } else {
    _runtimeEnv = 'browser';
  }

  return _runtimeEnv;
}

export function isTauriEnvironment() {
  return !!window.__TAURI__;
}

export function isWebView2Environment() {
  return !!(window.chrome && window.chrome.webview);
}

// ========== 统一通信接口 ==========

/**
 * 发送原生命令（自动选择通信通道）
 * Tauri 环境 -> invoke()
 * WebView2 -> postMessage
 * Browser -> console.warn + resolve(null)
 */
export async function sendNativeCommand(command, data = {}) {
  const env = getRuntimeEnvironment();

  switch (env) {
    case 'tauri': {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        // 将 snake_case 命令转为 kebab-case（Tauri 风格）
        const tauriCommand = command.replace(/_([a-z])/g, (_, c) => '-' + c);
        return await invoke(tauriCommand, data);
      } catch (e) {
        console.warn(`[native-bridge] Tauri 调用失败 (${command}):`, e);
        return { success: false, error: e.message };
      }
    }

    case 'webview2':
      return sendToWebView2(command, data);

    default:
      console.warn(`[native-bridge] 浏览器环境，忽略命令: ${command}`);
      return { success: false, message: 'Not in native environment' };
  }
}

// ========== WebView2 通信层 ==========

function sendToWebView2(command, data = {}) {
  return new Promise((resolve, reject) => {
    try {
      const messageId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);

      const handler = (event) => {
        try {
          const response = JSON.parse(event.data);
          if (response.command === 'response' && response.messageId === messageId) {
            window.chrome.webview.removeEventListener('message', handler);
            resolve(response);
          }
        } catch (error) {
          reject(error);
        }
      };

      window.chrome.webview.addEventListener('message', handler);

      window.chrome.webview.postMessage({
        command,
        messageId,
        data,
        timestamp: Date.now()
      });

      setTimeout(() => {
        window.chrome.webview.removeEventListener('message', handler);
        resolve({ success: false, message: 'Request timeout' });
      }, 10000);

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 接收来自原生后端的消息（WebView2 / Tauri event）
 */
export function receiveFromNative(callback) {
  const env = getRuntimeEnvironment();

  if (env === 'webview2') {
    window.chrome.webview.addEventListener('message', (event) => {
      try {
        callback(JSON.parse(event.data));
      } catch (error) {
        console.error('[native-bridge] 解析消息失败:', error);
      }
    });
  } else if (env === 'tauri') {
    // Tauri 可以使用 event 监听
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen('native-message', (event) => callback(event.payload));
    }).catch(() => { });
  } else {
    console.warn('[native-bridge] 无法接收原生消息: 非原生环境');
  }
}

// ========== 教师端命令常量 ==========

export const TeacherCommands = {
  START_CAMERA: 'start_camera',
  STOP_CAMERA: 'stop_camera',
  START_SCREEN_SHARE: 'start_screen_share',
  STOP_SCREEN_SHARE: 'stop_screen_share',
  MANAGE_STUDENT: 'manage_student',
  ALLOCATE_TASK: 'allocate_task',
  VIEW_VIDEO: 'view_video',
};

// ========== 学生端命令常量 ==========

export const StudentCommands = {
  START_CAMERA: 'start_camera',
  STOP_CAMERA: 'stop_camera',
  RAISE_HAND: 'raise_hand',
  SUBMIT_TASK: 'submit_task',
  SEND_MESSAGE: 'send_message',
  GET_TASKS: 'get_tasks',
};

// ========== 服务端命令常量 ==========

export const ServerCommands = {
  START_SERVER: 'start_server',
  STOP_SERVER: 'stop_server',
  GET_SERVER_STATUS: 'get_server_status',
  GET_LOGS: 'get_logs',
  MANAGE_CONFIG: 'manage_config',
};

// ========== 网络流媒体方法 ==========

export async function addNetworkStream(name, protocol, url, options = {}) {
  return await sendNativeCommand('add_network_stream', {
    name, protocol, url,
    username: options.username || '',
    password: options.password || ''
  });
}

export async function removeNetworkStream(streamId) {
  return await sendNativeCommand('remove_network_stream', { id: streamId });
}

export async function connectNetworkStream(streamId) {
  return await sendNativeCommand('connect_network_stream', { id: streamId });
}

export async function disconnectNetworkStream(streamId) {
  return await sendNativeCommand('disconnect_network_stream', { id: streamId });
}

export async function getNetworkStreams() {
  return await sendNativeCommand('get_network_streams');
}

// ========== ZLMediaKit 流媒体代理方法 ==========

/**
 * 启动 ZLMediaKit 服务
 * @returns {Promise<string>}
 */
export async function startZLMediaKit() {
  return await sendNativeCommand('start_zlmediakit');
}

/**
 * 停止 ZLMediaKit 服务
 * @returns {Promise<string>}
 */
export async function stopZLMediaKit() {
  return await sendNativeCommand('stop_zlmediakit');
}

/**
 * 检查 ZLMediaKit 服务状态
 * @returns {Promise<Object>} { running: boolean, host: string, port: number, url: string }
 */
export async function checkZLMediaKitStatus() {
  return await sendNativeCommand('check_zlmediakit_status');
}

/**
 * 代理本地视频文件到 ZLMediaKit
 * @param {string} filePath - 本地文件路径（绝对路径）
 * @param {string} streamId - 可选的流 ID，不传则自动生成
 * @returns {Promise<Object>} 流元信息 { id, streamType, flvUrl, wsFlvUrl, webrtcUrl, ... }
 */
export async function proxyLocalVideo(filePath, streamId = null) {
  return await sendNativeCommand('proxy_local_video', {
    file_path: filePath,
    stream_id: streamId
  });
}

/**
 * 代理网络流（RTSP/RTMP）到 ZLMediaKit
 * @param {string} streamUrl - 流 URL（RTSP/RTMP 地址）
 * @param {string} streamType - 流类型：'LocalVideo' | 'NetworkCamera' | 'WebRTC' | 'LocalCamera'
 * @param {string} streamId - 可选的流 ID
 * @param {Object} options - 额外选项 { username, password, enableRetry }
 * @returns {Promise<Object>} 流元信息
 */
export async function proxyNetworkStream(streamUrl, streamType, streamId = null, options = {}) {
  return await sendNativeCommand('proxy_network_stream', {
    stream_url: streamUrl,
    stream_type: streamType,
    stream_id: streamId,
    options: {
      username: options.username || null,
      password: options.password || null,
      enable_retry: options.enableRetry !== undefined ? options.enableRetry : true,
      timeout_sec: options.timeoutSec || null
    }
  });
}

/**
 * 代理 WebRTC 推流到 ZLMediaKit
 * @param {string} streamId - 流 ID
 * @param {Object} options - 推流选项 { app, enableAudio, enableVideo, timeoutSec }
 * @returns {Promise<Object>} 流元信息 { id, streamType, flvUrl, wsFlvUrl, webrtcUrl, webrtcPushUrl, ... }
 */
export async function proxyWebRTCPush(streamId, options = {}) {
  return await sendNativeCommand('proxy_webrtc_push', {
    stream_id: streamId,
    options: {
      app: options.app || null,
      enable_audio: options.enableAudio !== undefined ? options.enableAudio : true,
      enable_video: options.enableVideo !== undefined ? options.enableVideo : true,
      timeout_sec: options.timeoutSec || null
    }
  });
}

/**
 * 代理本地摄像头到 ZLMediaKit（通过 FFmpeg）
 * @param {string} streamId - 流 ID
 * @param {Object} options - 摄像头选项 { deviceId, resolution, framerate, enableAudio, app }
 * @returns {Promise<Object>} 流元信息
 */
export async function proxyLocalCamera(streamId, options = {}) {
  return await sendNativeCommand('proxy_local_camera', {
    stream_id: streamId,
    options: {
      device_id: options.deviceId || null,
      resolution: options.resolution || null,
      framerate: options.framerate || null,
      enable_audio: options.enableAudio !== undefined ? options.enableAudio : true,
      app: options.app || null
    }
  });
}

/**
 * 停止流代理
 * @param {string} streamId - 流 ID
 * @returns {Promise<boolean>}
 */
export async function stopStreamProxy(streamId) {
  return await sendNativeCommand('stop_stream_proxy', {
    stream_id: streamId
  });
}

/**
 * 控制流的音频轨道（静音/恢复）
 * @param {string} streamId - 流 ID
 * @param {boolean} mute - true 为静音，false 为恢复
 * @returns {Promise<boolean>}
 */
export async function controlStreamAudio(streamId, mute) {
  return await sendNativeCommand('control_stream_audio', {
    stream_id: streamId,
    mute: mute
  });
}

/**
 * 获取所有活跃流
 * @returns {Promise<Array>} 活跃流列表
 */
export async function getActiveStreams() {
  return await sendNativeCommand('get_active_streams');
}

/**
 * 检查流状态
 * @param {string} streamId - 流 ID
 * @returns {Promise<Object>} 流元信息
 */
export async function checkStreamStatus(streamId) {
  return await sendNativeCommand('check_stream_status', {
    stream_id: streamId
  });
}

// ========== 远程桌面方法 ==========

export async function startRemoteDesktop(type, url, options = {}) {
  return await sendNativeCommand('start_remote_desktop', {
    type, url,
    username: options.username || '',
    password: options.password || ''
  });
}

export async function stopRemoteDesktop() {
  return await sendNativeCommand('stop_remote_desktop');
}

// ========== 应用类型检测 ==========

export function getAppType() {
  const path = window.location.pathname;
  if (path.includes('/teacher')) return 'teacher';
  if (path.includes('/student')) return 'student';
  if (path.includes('/server')) return 'server';
  return 'unknown';
}

// ========== 默认导出 ==========

export default {
  getRuntimeEnvironment,
  isTauriEnvironment,
  isWebView2Environment,
  sendNativeCommand,
  receiveFromNative,
  TeacherCommands,
  StudentCommands,
  ServerCommands,
  addNetworkStream,
  removeNetworkStream,
  connectNetworkStream,
  disconnectNetworkStream,
  getNetworkStreams,
  // ZLMediaKit 服务管理
  startZLMediaKit,
  stopZLMediaKit,
  checkZLMediaKitStatus,
  // ZLMediaKit 流媒体代理
  proxyLocalVideo,
  proxyNetworkStream,
  proxyWebRTCPush,
  proxyLocalCamera,
  stopStreamProxy,
  controlStreamAudio,
  getActiveStreams,
  checkStreamStatus,
  startRemoteDesktop,
  stopRemoteDesktop,
  getAppType,
};
