/**
 * 音视频多路混流类型定义
 */

/**
 * 视频源接口
 */
export const VideoSourceType = {
  CAMERA: 'camera',
  LOCAL_FILE: 'local-file',
  MICROPHONE: 'microphone'
};

/**
 * 视频源数据结构
 * @typedef {Object} VideoSource
 * @property {string} id - 唯一标识
 * @property {string} type - 类型: camera | local-file | microphone
 * @property {string} name - 显示名称
 * @property {MediaStream} [stream] - 媒体流(摄像头/麦克风)
 * @property {File} [file] - 文件对象(本地视频)
 * @property {string} [objectUrl] - Blob URL
 * @property {number} duration - 时长(秒),直播为Infinity
 * @property {number} currentTime - 当前播放时间(秒)
 * @property {boolean} isPlaying - 是否正在播放
 * @property {number} volume - 音量 0-1
 * @property {boolean} muted - 是否静音
 */

/**
 * 视频画布块数据结构
 * @typedef {Object} VideoTile
 * @property {string} id - 唯一标识
 * @property {string} sourceId - 关联的视频源ID
 * @property {{x: number, y: number}} position - 位置坐标
 * @property {{width: number, height: number}} size - 尺寸
 * @property {boolean} isAudioMaster - 是否为主音频源
 */

/**
 * 应用状态
 * @typedef {Object} AppState
 * @property {Map<string, VideoSource>} sources - 所有视频源
 * @property {VideoTile[]} tiles - 画布上的视频块
 * @property {string|null} activeAudioSourceId - 当前激活的音频源ID
 */
