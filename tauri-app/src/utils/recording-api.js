/**
 * Tauri API 封装 - 录制管理
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

/**
 * 监听录制进度事件
 */
export function onRecordingProgress(callback) {
  return listen('recording-progress', (event) => {
    console.log('[Tauri Event] 录制进度更新:', event.payload);
    callback(event.payload);
  });
}

/**
 * 监听录制帧数据（用于实时预览）
 */
export function onRecordingFrame(callback) {
  return listen('recording-frame', (event) => {
    callback(event.payload); // { session_id, frame_data (base64), timestamp }
  });
}

/**
 * 开始画布录制
 */
export async function startCanvasRecording(params) {
  try {
    console.log('[Tauri API] startCanvasRecording 调用, 参数:', params);
    const result = await invoke('start_canvas_recording', params);
    console.log('[Tauri API] startCanvasRecording 成功:', result);
    return result;
  } catch (error) {
    console.error('[Tauri API] startCanvasRecording 失败:', error);
    throw error;
  }
}

/**
 * 开始预览录制
 */
export async function startPreviewRecording(params) {
  try {
    console.log('[Tauri API] startPreviewRecording 调用, 参数:', params);
    const result = await invoke('start_preview_recording', params);
    console.log('[Tauri API] startPreviewRecording 成功:', result);
    return result;
  } catch (error) {
    console.error('[Tauri API] startPreviewRecording 失败:', error);
    throw error;
  }
}

/**
 * 暂停录制
 */
export async function pauseRecording(sessionId) {
  try {
    console.log('[Tauri API] pauseRecording 调用, sessionId:', sessionId);
    const result = await invoke('pause_recording', { session_id: sessionId });
    console.log('[Tauri API] pauseRecording 成功');
    return result;
  } catch (error) {
    console.error('[Tauri API] pauseRecording 失败:', error);
    throw error;
  }
}

/**
 * 恢复录制
 */
export async function resumeRecording(sessionId) {
  try {
    console.log('[Tauri API] resumeRecording 调用, sessionId:', sessionId);
    const result = await invoke('resume_recording', { session_id: sessionId });
    console.log('[Tauri API] resumeRecording 成功');
    return result;
  } catch (error) {
    console.error('[Tauri API] resumeRecording 失败:', error);
    throw error;
  }
}

/**
 * 停止录制
 */
export async function stopRecording(sessionId) {
  try {
    console.log('[Tauri API] stopRecording 调用, sessionId:', sessionId);
    const result = await invoke('stop_recording', { session_id: sessionId });
    console.log('[Tauri API] stopRecording 成功, 文件路径:', result);
    return result;
  } catch (error) {
    console.error('[Tauri API] stopRecording 失败:', error);
    throw error;
  }
}

/**
 * 获取活跃录制会话
 */
export async function getActiveRecordings() {
  try {
    console.log('[Tauri API] getActiveRecordings 调用');
    const result = await invoke('get_active_recordings');
    console.log('[Tauri API] getActiveRecordings 成功, 会话数:', result.length);
    return result;
  } catch (error) {
    console.error('[Tauri API] getActiveRecordings 失败:', error);
    throw error;
  }
}

/**
 * 保存录制模板
 */
export async function saveRecordingTemplate(template) {
  try {
    console.log('[Tauri API] saveRecordingTemplate 调用');
    const result = await invoke('save_recording_template', { template });
    console.log('[Tauri API] saveRecordingTemplate 成功');
    return result;
  } catch (error) {
    console.error('[Tauri API] saveRecordingTemplate 失败:', error);
    throw error;
  }
}

/**
 * 加载所有录制模板
 */
export async function loadRecordingTemplates() {
  try {
    console.log('[Tauri API] loadRecordingTemplates 调用');
    const result = await invoke('load_recording_templates');
    console.log('[Tauri API] loadRecordingTemplates 成功, 模板数:', result.length);
    return result;
  } catch (error) {
    console.error('[Tauri API] loadRecordingTemplates 失败:', error);
    throw error;
  }
}

/**
 * 删除录制模板
 */
export async function deleteRecordingTemplate(templateId) {
  try {
    console.log('[Tauri API] deleteRecordingTemplate 调用, ID:', templateId);
    const result = await invoke('delete_recording_template', { template_id: templateId });
    console.log('[Tauri API] deleteRecordingTemplate 成功');
    return result;
  } catch (error) {
    console.error('[Tauri API] deleteRecordingTemplate 失败:', error);
    throw error;
  }
}

/**
 * 获取最新预览帧
 */
export async function getLatestPreviewFrame(sessionId) {
  try {
    const result = await invoke('get_latest_preview_frame', { session_id: sessionId });
    return result;
  } catch (error) {
    console.error('[Tauri API] getLatestPreviewFrame 失败:', error);
    return null;
  }
}

/**
 * 清理预览帧
 */
export async function cleanupPreviewFrames(sessionId) {
  try {
    await invoke('cleanup_preview_frames', { session_id: sessionId });
  } catch (error) {
    console.error('[Tauri API] cleanupPreviewFrames 失败:', error);
  }
}

/**
 * 切换活动摄像头（多机位）
 */
export async function switchActiveCamera(sessionId, cameraIndex) {
  try {
    console.log('[Tauri API] switchActiveCamera 调用');
    const result = await invoke('switch_active_camera', { 
      session_id: sessionId,
      camera_index: cameraIndex 
    });
    console.log('[Tauri API] switchActiveCamera 成功');
    return result;
  } catch (error) {
    console.error('[Tauri API] switchActiveCamera 失败:', error);
    throw error;
  }
}

/**
 * 开始多机位录制
 */
export async function startMulticamRecording(sessionId, cameraConfig, recordingConfig) {
  try {
    console.log('[Tauri API] startMulticamRecording 调用');
    const result = await invoke('start_multicam_recording', { 
      session_id: sessionId,
      config: cameraConfig,
      recording_config: recordingConfig
    });
    console.log('[Tauri API] startMulticamRecording 成功');
    return result;
  } catch (error) {
    console.error('[Tauri API] startMulticamRecording 失败:', error);
    throw error;
  }
}

/**
 * 开始RTMP推流
 */
export async function startRtmpStreaming(sessionId, sourceX, sourceY, sourceWidth, sourceHeight, config) {
  try {
    console.log('[Tauri API] startRtmpStreaming 调用');
    const result = await invoke('start_rtmp_streaming', { 
      session_id: sessionId,
      source_x: sourceX,
      source_y: sourceY,
      source_width: sourceWidth,
      source_height: sourceHeight,
      config
    });
    console.log('[Tauri API] startRtmpStreaming 成功');
    return result;
  } catch (error) {
    console.error('[Tauri API] startRtmpStreaming 失败:', error);
    throw error;
  }
}

/**
 * 停止RTMP推流
 */
export async function stopRtmpStreaming(sessionId) {
  try {
    console.log('[Tauri API] stopRtmpStreaming 调用');
    const result = await invoke('stop_rtmp_streaming', { session_id: sessionId });
    console.log('[Tauri API] stopRtmpStreaming 成功');
    return result;
  } catch (error) {
    console.error('[Tauri API] stopRtmpStreaming 失败:', error);
    throw error;
  }
}

/**
 * 开始VR/360°视频录制
 */
export async function startVrRecording(sessionId, cameraDevice, config) {
  try {
    console.log('[Tauri API] startVrRecording 调用');
    const result = await invoke('start_vr_recording', { 
      session_id: sessionId,
      camera_device: cameraDevice,
      config
    });
    console.log('[Tauri API] startVrRecording 成功');
    return result;
  } catch (error) {
    console.error('[Tauri API] startVrRecording 失败:', error);
    throw error;
  }
}
