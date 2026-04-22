// 录制预设配置
export const RECORDING_PRESETS = {
  HIGH_QUALITY: 'high_quality',
  STANDARD: 'standard',
  LOW_BANDWIDTH: 'low_bandwidth',
  CUSTOM: 'custom'
}

// 预设配置详情
export const RECORDING_PRESET_CONFIGS = {
  [RECORDING_PRESETS.HIGH_QUALITY]: {
    name: '高质量',
    description: '最高画质，适合后期编辑',
    video: {
      codec: 'h264',
      resolution: '1920x1080',
      frameRate: 60,
      bitrate: 8000
    },
    audio: {
      codec: 'aac',
      sampleRate: 48000,
      channels: 2,
      bitrate: 192
    },
    container: 'mp4'
  },
  [RECORDING_PRESETS.STANDARD]: {
    name: '标准',
    description: '平衡画质和文件大小',
    video: {
      codec: 'h264',
      resolution: '1280x720',
      frameRate: 30,
      bitrate: 4000
    },
    audio: {
      codec: 'aac',
      sampleRate: 48000,
      channels: 2,
      bitrate: 128
    },
    container: 'mp4'
  },
  [RECORDING_PRESETS.LOW_BANDWIDTH]: {
    name: '低带宽',
    description: '小文件大小，适合网络传输',
    video: {
      codec: 'h264',
      resolution: '854x480',
      frameRate: 30,
      bitrate: 1500
    },
    audio: {
      codec: 'aac',
      sampleRate: 44100,
      channels: 1,
      bitrate: 64
    },
    container: 'mp4'
  },
  [RECORDING_PRESETS.CUSTOM]: {
    name: '自定义',
    description: '手动配置所有参数',
    video: {
      codec: 'h264',
      resolution: '1280x720',
      frameRate: 30,
      bitrate: 4000
    },
    audio: {
      codec: 'aac',
      sampleRate: 48000,
      channels: 2,
      bitrate: 128
    },
    container: 'mp4'
  }
}

// 支持的编码器
export const VIDEO_CODECS = ['h264', 'h265', 'vp9', 'av1']
export const AUDIO_CODECS = ['aac', 'mp3', 'opus']

// 支持的分辨率
export const RESOLUTIONS = [
  { value: '3840x2160', label: '4K (3840×2160)' },
  { value: '2560x1440', label: '2K (2560×1440)' },
  { value: '1920x1080', label: '1080P (1920×1080)' },
  { value: '1280x720', label: '720P (1280×720)' },
  { value: '854x480', label: '480P (854×480)' },
  { value: '640x360', label: '360P (640×360)' }
]

// 支持的帧率
export const FRAME_RATES = [60, 30, 24, 15]

// 支持的容器格式
export const CONTAINER_FORMATS = [
  { value: 'mp4', label: 'MP4' },
  { value: 'webm', label: 'WebM' },
  { value: 'avi', label: 'AVI' },
  { value: 'mov', label: 'MOV' }
]

// 获取预设列表
export function getPresetList() {
  return Object.keys(RECORDING_PRESETS).map(key => ({
    value: RECORDING_PRESETS[key],
    label: RECORDING_PRESET_CONFIGS[RECORDING_PRESETS[key]].name,
    description: RECORDING_PRESET_CONFIGS[RECORDING_PRESETS[key]].description
  }))
}

// 获取预设配置
export function getPresetConfig(preset) {
  return RECORDING_PRESET_CONFIGS[preset] || RECORDING_PRESET_CONFIGS[RECORDING_PRESETS.STANDARD]
}
