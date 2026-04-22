/**
 * 多路音视频编解码服务
 * 
 * 提供 Tauri 后端的多路视频录制、混流、硬件加速等功能的前端接口
 */

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

// ==================== 类型定义 ====================

/**
 * 硬件加速类型
 */
export type HardwareAccelerationType = 
  | 'None'
  | 'NVENC'      // NVIDIA GPU
  | 'QSV'        // Intel QuickSync
  | 'AMF'        // AMD AMF
  | 'VAAPI'      // Linux VAAPI
  | 'VideoToolbox' // macOS VideoToolbox

/**
 * 视频流配置
 */
export interface VideoStreamConfig {
  stream_id: string
  source_type: 'camera' | 'screen' | 'file' | 'rtsp' | 'webrtc'
  source_path: string
  width: number
  height: number
  framerate: number
  bitrate: number // kbps
  codec: 'h264' | 'h265' | 'vp9'
  preset: 'ultrafast' | 'fast' | 'medium' | 'slow'
  crf: number // 0-51
  hardware_accel: HardwareAccelerationType
}

/**
 * 音频流配置
 */
export interface AudioStreamConfig {
  stream_id: string
  source_type: 'microphone' | 'system' | 'file'
  source_path: string
  sample_rate: number // 44100, 48000
  channels: number // 1=mono, 2=stereo
  bitrate: number // kbps
  codec: 'aac' | 'opus' | 'mp3'
}

/**
 * 叠加流配置（用于画中画等）
 */
export interface OverlayStreamConfig {
  stream_id: string
  x: number
  y: number
  width: number
  height: number
  opacity: number // 0.0-1.0
}

/**
 * 混流布局配置
 */
export interface MixLayoutConfig {
  layout_type: 'pip' | 'grid' | 'custom'
  main_stream_id: string
  overlay_streams: OverlayStreamConfig[]
  output_width: number
  output_height: number
}

/**
 * 多路录制会话
 */
export interface MultiCodecSession {
  session_id: string
  session_type: 'multi_record' | 'mix_stream' | 'transcode' | 'single_stream'
  video_streams: VideoStreamConfig[]
  audio_streams: AudioStreamConfig[]
  mix_layout?: MixLayoutConfig
  output_path: string
  output_format: 'mp4' | 'mkv' | 'flv'
  is_active: boolean
  start_time?: number
  duration: number
  status: 'recording' | 'paused' | 'stopped' | 'error'
  error_message?: string
}

/**
 * 硬件加速能力检测
 */
export interface HardwareCapabilities {
  has_nvidia: boolean
  has_intel_qsv: boolean
  has_amd_amf: boolean
  has_vaapi: boolean
  has_videotoolbox: boolean
  recommended_encoder: string
  gpu_memory_mb?: number
}

/**
 * 编解码性能统计
 */
export interface CodecPerformanceStats {
  session_id: string
  fps_current: number
  fps_average: number
  cpu_usage_percent: number
  gpu_usage_percent?: number
  dropped_frames: number
  bitrate_actual: number // kbps
  buffer_health: number // 0.0-1.0
}

// ==================== 核心 API ====================

/**
 * 检测硬件加速能力
 * @returns 硬件加速能力信息
 */
export async function detectHardwareAcceleration(): Promise<HardwareCapabilities> {
  return await invoke('detect_hardware_acceleration')
}

/**
 * 开始多路独立录制
 * @param sessionId 会话 ID
 * @param videoStreams 视频流配置数组
 * @param audioStreams 音频流配置数组
 * @param outputDir 输出目录
 * @returns 会话 ID
 */
export async function startMultiRecord(
  sessionId: string,
  videoStreams: VideoStreamConfig[],
  audioStreams: AudioStreamConfig[],
  outputDir: string
): Promise<string> {
  return await invoke('start_multi_record', {
    sessionId,
    videoStreams,
    audioStreams,
    outputDir
  })
}

/**
 * 开始混流录制（画中画/网格布局）
 * @param sessionId 会话 ID
 * @param videoStreams 视频流配置数组
 * @param audioStreams 音频流配置数组
 * @param mixLayout 混流布局配置
 * @param outputPath 输出文件路径
 * @returns 会话 ID
 */
export async function startMixRecording(
  sessionId: string,
  videoStreams: VideoStreamConfig[],
  audioStreams: AudioStreamConfig[],
  mixLayout: MixLayoutConfig,
  outputPath: string
): Promise<string> {
  return await invoke('start_mix_recording', {
    sessionId,
    videoStreams,
    audioStreams,
    mixLayout,
    outputPath
  })
}

/**
 * 停止编解码会话
 * @param sessionId 会话 ID
 */
export async function stopCodecSession(sessionId: string): Promise<void> {
  return await invoke('stop_codec_session', { sessionId })
}

/**
 * 暂停编解码会话
 * @param sessionId 会话 ID
 */
export async function pauseCodecSession(sessionId: string): Promise<void> {
  return await invoke('pause_codec_session', { sessionId })
}

/**
 * 恢复编解码会话
 * @param sessionId 会话 ID
 */
export async function resumeCodecSession(sessionId: string): Promise<void> {
  return await invoke('resume_codec_session', { sessionId })
}

/**
 * 获取活动会话列表
 * @returns 活动会话数组
 */
export async function getActiveCodecSessions(): Promise<MultiCodecSession[]> {
  return await invoke('get_active_codec_sessions')
}

/**
 * 获取会话详情
 * @param sessionId 会话 ID
 * @returns 会话信息
 */
export async function getCodecSessionInfo(sessionId: string): Promise<MultiCodecSession | null> {
  return await invoke('get_codec_session_info', { sessionId })
}

/**
 * 获取性能统计
 * @param sessionId 会话 ID
 * @returns 性能统计数据
 */
export async function getCodecPerformance(sessionId: string): Promise<CodecPerformanceStats | null> {
  return await invoke('get_codec_performance', { sessionId })
}

// ==================== 事件监听 ====================

/**
 * 监听性能更新事件
 * @param callback 回调函数
 * @returns 取消监听函数（异步）
 */
export async function onPerformanceUpdate(
  callback: (stats: CodecPerformanceStats) => void
): Promise<() => void> {
  const unlisten = await listen('codec-performance-update', (event) => {
    callback(event.payload as CodecPerformanceStats)
  })
  
  return unlisten
}

// ==================== 辅助函数 ====================

/**
 * 创建默认的视频流配置
 */
export function createDefaultVideoConfig(
  streamId: string,
  sourceType: VideoStreamConfig['source_type'],
  sourcePath: string
): VideoStreamConfig {
  return {
    stream_id: streamId,
    source_type: sourceType,
    source_path: sourcePath,
    width: 1920,
    height: 1080,
    framerate: 30,
    bitrate: 5000,
    codec: 'h264',
    preset: 'fast',
    crf: 23,
    hardware_accel: 'None' // 需要调用 detectHardwareAcceleration 后设置
  }
}

/**
 * 创建默认的音频流配置
 */
export function createDefaultAudioConfig(
  streamId: string,
  sourceType: AudioStreamConfig['source_type'],
  sourcePath: string
): AudioStreamConfig {
  return {
    stream_id: streamId,
    source_type: sourceType,
    source_path: sourcePath,
    sample_rate: 48000,
    channels: 2,
    bitrate: 128,
    codec: 'aac'
  }
}

/**
 * 创建画中画布局配置
 */
export function createPipLayout(
  mainStreamId: string,
  pipStreamId: string,
  outputWidth: number = 1920,
  outputHeight: number = 1080,
  pipWidth: number = 480,
  pipHeight: number = 270,
  pipX: number = 1430, // 右下角
  pipY: number = 800
): MixLayoutConfig {
  return {
    layout_type: 'pip',
    main_stream_id: mainStreamId,
    overlay_streams: [
      {
        stream_id: pipStreamId,
        x: pipX,
        y: pipY,
        width: pipWidth,
        height: pipHeight,
        opacity: 1.0
      }
    ],
    output_width: outputWidth,
    output_height: outputHeight
  }
}

/**
 * 创建网格布局配置
 */
export function createGridLayout(
  streamIds: string[],
  outputWidth: number = 1920,
  outputHeight: number = 1080
): MixLayoutConfig {
  return {
    layout_type: 'grid',
    main_stream_id: streamIds[0],
    overlay_streams: streamIds.slice(1).map(id => ({
      stream_id: id,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      opacity: 1.0
    })),
    output_width: outputWidth,
    output_height: outputHeight
  }
}
