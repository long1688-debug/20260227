/**
 * 事件总线 - 用于教师端和学生端之间的通信
 */

import { ref } from 'vue';

// 创建事件总线
class EventBus {
  constructor() {
    this.events = {};
  }

  /**
   * 订阅事件
   * @param {string} eventName - 事件名称
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消订阅函数
   */
  on(eventName, callback) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(callback);

    return () => {
      this.off(eventName, callback);
    };
  }

  /**
   * 取消订阅事件
   * @param {string} eventName - 事件名称
   * @param {Function} callback - 回调函数
   */
  off(eventName, callback) {
    if (!this.events[eventName]) return;
    this.events[eventName] = this.events[eventName].filter(cb => cb !== callback);
  }

  /**
   * 触发事件
   * @param {string} eventName - 事件名称
   * @param {*} data - 事件数据
   */
  emit(eventName, data) {
    if (!this.events[eventName]) return;
    this.events[eventName].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`EventBus error: ${error}`);
      }
    });
  }

  /**
   * 一次性订阅事件
   * @param {string} eventName - 事件名称
   * @param {Function} callback - 回调函数
   */
  once(eventName, callback) {
    const wrapper = (data) => {
      callback(data);
      this.off(eventName, wrapper);
    };
    this.on(eventName, wrapper);
  }
}

// 创建全局事件总线实例
export const eventBus = new EventBus();

// 预定义的事件类型
export const EventTypes = {
  // 投票相关事件
  POLL_CREATED: 'poll_created',           // 教师创建投票
  POLL_UPDATED: 'poll_updated',           // 投票更新
  POLL_DELETED: 'poll_deleted',           // 投票删除
  POLL_STARTED: 'poll_started',           // 投票开始
  POLL_ENDED: 'poll_ended',               // 投票结束
  POLL_VOTE: 'poll_vote',                 // 学生投票
  POLL_RESULT: 'poll_result',             // 投票结果

  // 测验相关事件
  QUIZ_CREATED: 'quiz_created',           // 教师创建测验
  QUIZ_STARTED: 'quiz_started',           // 测验开始
  QUIZ_ENDED: 'quiz_ended',               // 测验结束
  QUIZ_ANSWER: 'quiz_answer',             // 学生答题
  QUIZ_SCORE: 'quiz_score',               // 测验成绩

  // 聊天相关事件
  CHAT_MESSAGE: 'chat_message',           // 发送消息
  CHAT_HISTORY: 'chat_history',           // 消息历史

  // 白板相关事件
  WHITEBOARD_DRAW: 'whiteboard_draw',     // 白板绘制
  WHITEBOARD_CLEAR: 'whiteboard_clear',   // 清空白板
  WHITEBOARD_UNDO: 'whiteboard_undo',     // 撤销操作

  // 屏幕共享相关事件
  SCREEN_SHARE_START: 'screen_share_start',
  SCREEN_SHARE_STOP: 'screen_share_stop',

  // 学生相关事件
  STUDENT_JOIN: 'student_join',           // 学生加入
  STUDENT_LEAVE: 'student_leave',         // 学生离开
  STUDENT_HAND_RAISE: 'student_hand_raise', // 学生举手
  STUDENT_STATUS_UPDATE: 'student_status_update', // 学生状态更新

  // 🆕 直播广播事件
  BROADCAST_START: 'broadcast_start',     // 开始直播
  BROADCAST_STOP: 'broadcast_stop',      // 停止直播
  BROADCAST_FRAME: 'broadcast_frame',     // 直播帧数据
  BROADCAST_TYPE_UPDATE: 'broadcast_type_update'  // 直播类型更新
};

export default {
  eventBus,
  EventTypes
};
