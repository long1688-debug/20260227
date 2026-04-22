/**
 * Tauri 事件系统
 * 
 * 封装 Tauri 的 event 机制，用于前后端实时通信。
 * 可以替代或补充 WebSocket 在以下场景的使用：
 * - 后端状态变化通知前端（如录制状态、学生上下线）
 * - 前端向后端发送实时指令
 * - 多窗口间通信
 */

// ========== 事件名称常量 ==========

export const Events = {
  // === 后端 -> 前端事件 ===
  BACKEND_READY: 'backend:ready',           // 后端服务就绪
  BACKEND_ERROR: 'backend:error',           // 后端错误
  RECORDING_STARTED: 'recording:started',    // 录制开始
  RECORDING_STOPPED: 'recording:stopped',    // 录制停止
  RECORDING_PAUSED: 'recording:paused',     // 录制暂停
  STUDENT_ONLINE: 'student:online',          // 学生上线
  STUDENT_OFFLINE: 'student:offline',        // 学生下线
  STUDENT_RAISE_HAND: 'student:raise_hand',  // 学生举手
  VISION_RESULT: 'vision:result',            // 视觉分析结果
  WHISPER_TRANSCRIPT: 'whisper:transcript',  // 语音识别结果
  LIVE_STATUS_CHANGED: 'live:status_changed',// 直播状态变更
  SCREEN_SHARE_STATUS: 'screen-share:status',// 屏幕共享状态
  SUBTITLE_UPDATED: 'subtitle:updated',      // 字幕更新
  
  // === 前端 -> 后端事件 ===
  REQUEST_RECORDING: 'request:recording',    // 请求开始/停止录制
  REQUEST_LIVE_CONTROL: 'request:live',      // 请求直播控制
  KICK_STUDENT: 'kick:student',              // 踢出学生
  ANSWER_HAND: 'answer:hand',                // 回应举手
  SEND_EVALUATION: 'send:evaluation',        // 发送评分请求
};

// ========== 事件监听 ==========

/**
 * 监听来自后端的事件（Tauri event）
 * @param {string} eventName - 事件名
 * @param {function} handler - 回调函数 (payload) => void
 * @returns {Promise<function>} 取消监听的函数
 */
export async function onEvent(eventName, handler) {
  if (!window.__TAURI__) {
    console.warn(`[event] 非 Tauri 环境，忽略事件: ${eventName}`);
    return () => {};
  }

  try {
    const { listen } = await import('@tauri-apps/api/event');
    const unlisten = await listen(eventName, (event) => {
      console.log(`[event] 收到事件: ${eventName}`, event.payload);
      handler(event.payload);
    });
    return unlisten;
  } catch (e) {
    console.error(`[event] 监听事件失败 (${eventName}):`, e);
    return () => {};
  }
}

/**
 * 监听一次事件（自动取消）
 */
export async function onceEvent(eventName, handler) {
  if (!window.__TAURI__) return () => {};

  try {
    const { once } = await import('@tauri-apps/api/event');
    await once(eventName, (event) => handler(event.payload));
  } catch (e) {
    console.error(`[event] once 监听失败 (${eventName}):`, e);
  }
}

// ========== 事件发送 ==========

/**
 * 发送事件到后端（Tauri event emit）
 * @param {string} eventName - 事件名
 * @param {*} payload - 数据载荷
 */
export async function emitEvent(eventName, payload) {
  if (!window.__TAURI__) {
    console.log(`[event] 浏览器模式发送事件: ${eventName}`, payload);
    return;
  }

  try {
    const { emit } = await import('@tauri-apps/api/event');
    await emit(eventName, payload);
    console.log(`[event] 发送事件: ${eventName}`);
  } catch (e) {
    console.error(`[event] 发送事件失败 (${eventName}):`, e);
  }
}

// ========== 后端状态监控 ==========

/**
 * 等待后端服务就绪
 * @param {number} timeout - 超时时间(ms)，默认 10000ms
 * @returns {Promise<boolean>}
 */
export async function waitForBackend(timeout = 10000) {
  return new Promise((resolve) => {
    if (!window.__TAURI__) {
      resolve(true); // 浏览器模式直接通过
      return;
    }

    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn('[event] 等待后端超时');
        resolve(false);
      }
    }, timeout);

    onceEvent(Events.BACKEND_READY, () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(true);
      }
    });
  });
}

// ========== WebSocket 兼容层 ==========

/**
 * 创建一个混合通信适配器
 * 优先使用 Tauri Event，降级到 WebSocket
 */
export class HybridTransport {
  constructor() {
    this.ws = null;
    this.useTauri = !!window.__TAURI__;
    this.handlers = new Map();
    this.connected = false;
  }

  /**
   * 连接到后端
   */
  async connect(wsUrl = null) {
    if (this.useTauri) {
      // Tauri 模式：使用 event 系统
      this.connected = true;
      
      // 注册所有预存的事件监听
      for (const [event, handlerList] of this.handlers) {
        for (const handler of handlerList) {
          onEvent(event, handler);
        }
      }
      
      console.log('[transport] 使用 Tauri Event 模式');
      return true;
    }

    // 非 Tauri 模式：使用 WebSocket
    if (!wsUrl) {
      wsUrl = `ws://${window.location.hostname}:8081/ws`;
    }

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        this.connected = true;
        console.log('[transport] WebSocket 已连接');
        resolve(true);
      };

      this.ws.onerror = (err) => {
        console.error('[transport] WebSocket 错误:', err);
        reject(err);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const handlers = this.handlers.get(data.type) || [];
          for (const handler of handlers) {
            handler(data.payload || data);
          }
        } catch (e) {
          console.error('[transport] 解析消息失败:', e);
        }
      };
    });
  }

  /**
   * 订阅事件
   */
  on(event, handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event).push(handler);

    // 如果已连接，立即注册
    if (this.connected && this.useTauri) {
      onEvent(event, handler);
    }
  }

  /**
   * 发送消息
   */
  send(type, payload) {
    if (this.useTauri) {
      emitEvent(type, payload);
    } else if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...payload }));
    } else {
      console.warn('[transport] 未连接，无法发送消息');
    }
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.handlers.clear();
  }
}

// 默认导出
export default {
  Events,
  onEvent,
  onceEvent,
  emitEvent,
  waitForBackend,
  HybridTransport,
};
