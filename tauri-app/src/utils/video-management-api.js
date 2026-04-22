/**
 * Tauri API 封装 - 视频文件命名和策略管理
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

/**
 * 生成标准化录制文件名
 * @param {string} context - 上下文: "preview" 或 "main"
 * @param {string} sourceName - 信号源名称
 * @param {string} extension - 文件扩展名 (如 "mp4", "webm")
 * @returns {Promise<string>} 生成的文件名
 */
export async function generateVideoFilename(context, sourceName, extension) {
  try {
    console.log('[Video Naming API] 生成文件名:', { context, sourceName, extension });
    const filename = await invoke('generate_video_filename_cmd', {
      context,
      sourceName,
      extension
    });
    console.log('[Video Naming API] 生成的文件名:', filename);
    return filename;
  } catch (error) {
    console.error('[Video Naming API] 生成文件名失败:', error);
    throw error;
  }
}

/**
 * 获取录制目录路径
 * @returns {Promise<string>} 录制目录的绝对路径
 */
export async function getVideoDir() {
  try {
    console.log('[Video Policy API] 获取录制目录');
    const dir = await invoke('get_video_dir');
    console.log('[Video Policy API] 录制目录:', dir);
    return dir;
  } catch (error) {
    console.error('[Video Policy API] 获取录制目录失败:', error);
    throw error;
  }
}

/**
 * 完成视频录制并注册到策略引擎
 * @param {string} filename - 文件名
 * @param {string} source - 来源 ("ffmpeg", "mediarecorder", "canvas" 等)
 * @param {number} durationSec - 录制时长(秒)
 * @returns {Promise<Object>} 视频元数据
 */
export async function finalizeVideo(filename, source, durationSec) {
  try {
    console.log('[Video Policy API] 注册视频:', { filename, source, durationSec });
    const metadata = await invoke('finalize_video', {
      filename,
      source,
      durationSec
    });
    console.log('[Video Policy API] 视频注册成功:', metadata);
    return metadata;
  } catch (error) {
    console.error('[Video Policy API] 注册视频失败:', error);
    throw error;
  }
}

/**
 * 获取所有录制的视频列表
 * @returns {Promise<Array>} 视频元数据列表
 */
export async function listRecordedVideos() {
  try {
    console.log('[Video Policy API] 获取视频列表');
    const videos = await invoke('list_recorded_videos');
    console.log('[Video Policy API] 视频列表:', videos);
    return videos;
  } catch (error) {
    console.error('[Video Policy API] 获取视频列表失败:', error);
    throw error;
  }
}

/**
 * 删除指定的录制视频
 * @param {string} filename - 要删除的文件名
 * @returns {Promise<void>}
 */
export async function deleteRecordedVideo(filename) {
  try {
    console.log('[Video Policy API] 删除视频:', filename);
    await invoke('delete_recorded_video', { filename });
    console.log('[Video Policy API] 视频删除成功:', filename);
  } catch (error) {
    console.error('[Video Policy API] 删除视频失败:', error);
    throw error;
  }
}

/**
 * 获取当前清理策略
 * @returns {Promise<Object>} 清理策略配置
 */
export async function getCleanupPolicy() {
  try {
    console.log('[Video Policy API] 获取清理策略');
    const policy = await invoke('get_cleanup_policy');
    console.log('[Video Policy API] 清理策略:', policy);
    return policy;
  } catch (error) {
    console.error('[Video Policy API] 获取清理策略失败:', error);
    throw error;
  }
}

/**
 * 更新清理策略
 * @param {Object} policy - 策略配置
 * @param {number} policy.maxVideos - 最大保留视频数量
 * @param {number} policy.maxAgeDays - 最大保留天数
 * @param {number} policy.maxTotalSizeMb - 最大总大小(MB)
 * @param {boolean} policy.autoCleanup - 是否自动清理
 * @returns {Promise<void>}
 */
export async function setCleanupPolicy({ maxVideos, maxAgeDays, maxTotalSizeMb, autoCleanup }) {
  try {
    console.log('[Video Policy API] 更新清理策略:', { maxVideos, maxAgeDays, maxTotalSizeMb, autoCleanup });
    await invoke('set_cleanup_policy', {
      maxVideos,
      maxAgeDays,
      maxTotalSizeMb,
      autoCleanup
    });
    console.log('[Video Policy API] 清理策略更新成功');
  } catch (error) {
    console.error('[Video Policy API] 更新清理策略失败:', error);
    throw error;
  }
}

/**
 * 监听视频完成事件
 * @param {Function} callback - 回调函数，接收视频元数据
 * @returns {Function} 取消监听的函数
 */
export function onVideoFinalized(callback) {
  console.log('[Video Policy API] 监听视频完成事件');
  return listen('video_finalized', (event) => {
    console.log('[Video Policy Event] 视频完成:', event.payload);
    callback(event.payload);
  });
}

/**
 * 监听视频清理事件
 * @param {Function} callback - 回调函数，接收被删除的文件名列表
 * @returns {Function} 取消监听的函数
 */
export function onVideosCleaned(callback) {
  console.log('[Video Policy API] 监听视频清理事件');
  return listen('videos_cleaned', (event) => {
    console.log('[Video Policy Event] 视频清理完成:', event.payload);
    callback(event.payload);
  });
}
