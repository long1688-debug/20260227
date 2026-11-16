/**
 * 服务导出索引
 * 集中管理所有服务模块的导出
 */

// WebRTC 服务
export { default as webrtcService } from './webrtcService';
export { default as enhancedWebRTC } from './enhancedWebRTCService';
export { default as tauriWebRTC } from './tauriWebRTCService';  // Tauri 原生 WebRTC 服务

// 视觉分析服务
export { default as tauriVision } from './tauriVisionService';  // Tauri 原生视觉服务

// 媒体相关服务
export { default as captureDeviceService } from './captureDeviceService';
export { default as mediaCodecService } from './mediaCodecService';
export { default as subtitleService } from './subtitleService';
export * as asr from './asr';
export { default as ttsService } from './ttsService';
export { default as videoToSubtitleService } from './videoToSubtitleService';

// 数据相关服务
export { default as apiService } from './apiService';
export { default as cameraDatabaseApi } from './cameraDatabaseApi';
export { default as cocoDatasetService } from './coco-dataset';
export { default as meetingStats } from './meetingStats';

// 导出所有服务
export * from './webrtcService';
export * from './enhancedWebRTCService';
export * from './tauriWebRTCService';
export * from './tauriVisionService';
export * from './apiService';
export * from './cameraDatabaseApi';
export * from './coco-dataset';
export * from './captureDeviceService';
export * from './meetingStats';
export * from './subtitleService';
export * from './ttsService';
export * from './videoToSubtitleService';
