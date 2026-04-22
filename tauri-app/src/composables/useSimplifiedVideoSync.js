/**
 * 简化版视频同步管理器
 * 
 * 注意：此文件是为兼容旧代码而创建的包装器
 * 实际的视频同步功能委托给 useVideoSync.js
 */

import { useVideoSync } from './useVideoSync';

export function useSimplifiedVideoSync() {
  const { registerMasterVideo, registerSlaveVideo, clearMasterVideo, unregisterSlaveVideo, getSyncStatus, playAll, pauseAll, togglePlayPauseAll, stopAll, seekAll, setPlaybackRate, setVolumeAll, setMuteAll, getAllVideoStates, forceSyncAll, selectAudioOutput, toggleCanvasAudio } = useVideoSync();

  return {
    /**
     * 注册主控视频（预览区域）
     * @param {HTMLVideoElement} videoElement - 视频元素
     * @param {string} sourceId - 信号源ID
     */
    registerMaster: (videoElement, sourceId) => {
      console.log(`[useSimplifiedVideoSync] 注册主控视频: ${sourceId}`);
      registerMasterVideo(videoElement, sourceId);
    },

    /**
     * 注册从属视频（画布区域）
     * @param {HTMLVideoElement} videoElement - 视频元素
     * @param {number|string} canvasId - 画布ID（索引）
     * @param {string} sourceId - 信号源ID
     */
    registerSlave: (videoElement, canvasId, sourceId) => {
      console.log(`[useSimplifiedVideoSync] 注册从属视频: canvasId=${canvasId}, sourceId=${sourceId}`);
      // 🎯 修复：正确传递 canvasId 和 sourceId
      registerSlaveVideo(videoElement, canvasId, sourceId);
    },

    /**
     * 注销主控视频
     * @param {string} sourceId - 信号源ID
     */
    unregisterMaster: (sourceId) => {
      console.log(`[useSimplifiedVideoSync] 注销主控视频: ${sourceId}`);
      clearMasterVideo(sourceId);
    },

    /**
     * 注销从属视频
     * @param {number|string} canvasId - 画布ID（索引）
     * @param {string} sourceId - 信号源ID
     */
    unregisterSlave: (canvasId, sourceId) => {
      console.log(`[useSimplifiedVideoSync] 注销从属视频: canvasId=${canvasId}, sourceId=${sourceId}`);
      // 🎯 修复：正确传递 canvasId 和 sourceId
      unregisterSlaveVideo(canvasId, sourceId);
    },

    /**
     * 获取同步状态
     */
    getSyncStatus,

    // ==================== 🎯 新增：全局播放控制 API ====================

    /**
     * 全局播放 - 播放所有视频
     */
    playAll,

    /**
     * 全局暂停 - 暂停所有视频
     */
    pauseAll,

    /**
     * 全局切换播放/暂停状态
     */
    togglePlayPauseAll,

    /**
     * 全局停止 - 停止所有视频（重置到开始位置）
     */
    stopAll,

    /**
     * 全局跳转 - 同步所有视频到指定时间点
     * @param {number} time - 目标时间（秒）
     * @param {string} [sourceId] - 可选，仅同步指定源的视频
     */
    seekAll,

    /**
     * 设置播放速度
     * @param {number} rate - 播放速度（0.5, 1, 1.5, 2 等）
     * @param {string} [sourceId] - 可选，仅设置指定源的视频
     */
    setPlaybackRate,

    /**
     * 设置音量
     * @param {number} volume - 音量（0-100）
     * @param {string} [sourceId] - 可选，仅设置指定源的视频
     */
    setVolumeAll,

    /**
     * 静音/取消静音所有视频
     * @param {boolean} muted - 是否静音
     * @param {string} [sourceId] - 可选，仅设置指定源的视频
     */
    setMuteAll,

    /**
     * 获取所有视频的播放状态
     * @returns {Object} 包含所有视频状态的对象
     */
    getAllVideoStates,

    /**
     * 强制同步所有视频到主控状态
     */
    forceSyncAll,

    // ==================== 🎯 新增：用户选择音频输出 API ====================

    /**
     * 用户手动选择发声视频
     * @param {string} targetId - 要发声的视频ID（预览ID或画布ID）
     */
    selectAudioOutput,

    /**
     * 切换指定画布的音频状态
     * @param {string} canvasId - 画布ID
     */
    toggleCanvasAudio
  }
}
