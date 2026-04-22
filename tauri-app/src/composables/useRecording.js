import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
// 🎯 迁移：使用 useVideoSync 替代 useVideoStore
import { useVideoSync } from '@/composables/useVideoSync';
import { isSourceRecordable } from '@/constants/sourceTypes';
import {
  startCanvasRecording as tauriStartCanvasRecording,
  startPreviewRecording as tauriStartPreviewRecording,
  pauseRecording as tauriPauseRecording,
  resumeRecording as tauriResumeRecording,
  stopRecording as tauriStopRecording,
  getActiveRecordings as tauriGetActiveRecordings,
  onRecordingProgress,
  saveRecordingTemplate as tauriSaveTemplate,
  loadRecordingTemplates as tauriLoadTemplates,
  deleteRecordingTemplate as tauriDeleteTemplate,
  switchActiveCamera as tauriSwitchCamera,
  startMulticamRecording as tauriStartMulticam,
  startRtmpStreaming as tauriStartRtmp,
  stopRtmpStreaming as tauriStopRtmp,
  startVrRecording as tauriStartVr
} from '@/utils/recording-api';
// 导入新的视频管理 API
import { generateVideoFilename, finalizeVideo, getVideoDir, onVideoFinalized, onVideosCleaned, listRecordedVideos, deleteRecordedVideo } from '@/utils/video-management-api';
// 导入 Tauri shell API 用于打开文件位置
import { open } from '@tauri-apps/plugin-shell';

/**
 * 录制管理 Composable - Tauri增强版
 * 使用后端FFmpeg实现真正的MP4/MKV录制
 */
export function useRecording() {
  // 🎯 迁移：从 useVideoSync 获取状态和方法
  const {
    getSourceByCanvasIndex,
    setCanvasRecordingState,
    canvasRecordingStates: syncCanvasRecordingStates
  } = useVideoSync();

  // 源录制状态
  const sourceRecordingState = reactive({
    camera: false,
    localVideo: false
  });

  // 画布录制状态
  const canvasRecordingStates = ref(new Map());

  // 预览区域录制状态
  const previewRecordingStates = ref(new Map());

  // 录制配置
  const recordingConfig = reactive({
    outputFormat: 'mp4', // mp4 或 mkv
    encoder: 'h264', // h264, h264_nvenc, h264_qsv, h264_amf
    preset: 'medium', // ultrafast, fast, medium, slow
    crf: 23, // 0-51, 质量因子
    autoSegment: false,
    segmentDuration: 30, // 分钟
    enableAudioMix: true, // 是否启用音频混合
    noiseReduction: false, // 是否启用降噪
    recordingMode: 'canvas', // 'canvas' 或 'preview'

    // 水印配置
    enableWatermark: false,
    watermarkText: '',
    watermarkPosition: 'bottom-right',
    watermarkFontSize: 24,
    watermarkColor: '#FFFFFF',

    // 绿幕配置
    enableChromakey: false,
    chromakeyColor: '#00FF00',
    chromakeySimilarity: 0.4,
    chromakeyBlend: 0.1,

    // RTMP推流配置
    enableRtmp: false,
    rtmpUrl: '',
    streamKey: '',
    rtmpBitrate: 4000,
    resolution: '1920x1080',
    frameRate: 30,

    // VR/360°录制配置
    enableVr: false,
    vrProjection: 'equirectangular',
    vrInputType: 'dual_fisheye',
    vrFov: 360
  });

  // 音频通道管理
  const audioChannels = ref([]);

  // 当前录制会话
  const currentRecordingSession = ref({
    isRecording: false,
    isPaused: false,
    startTime: null,
    recordingId: null,
    pauseCount: 0,
    recordingMode: 'canvas', // 当前录制模式
    videoSources: [], // 录制的视频源
    audioSources: [] // 录制的音频源
  });

  // 录制文件列表
  const recordings = ref([]);
  const showPlaybackDialog = ref(false);
  const showRecordingDialog = ref(false);
  const playbackVideoRef = ref(null);
  const recordingFilter = ref('all');

  // 录制计时器
  let recordingTimer = null;
  let recordingTime = ref('00:00:00');

  // 音频管理相关
  let audioContext = null;
  let masterGainNode = null;
  let noiseReductionNode = null;
  let audioDestination = null;

  // 降噪配置
  const noiseReductionConfig = reactive({
    enabled: false,
    strength: 0.5, // 0-1
    threshold: -50 // dB
  });

  // 录制模板
  const recordingTemplates = ref([]);

  // 多机位状态
  const multicamSessionId = ref(null);
  const activeCameraIndex = ref(0);

  // RTMP推流状态
  const rtmpStreamingState = reactive({
    isStreaming: false,
    sessionId: null,
    streamUrl: null,
    startTime: null
  });

  // VR录制状态
  const vrRecordingState = reactive({
    isRecording: false,
    sessionId: null,
    projection: 'equirectangular'
  });

  /**
   * 初始化音频系统
   */
  const initAudioSystem = async () => {
    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // 创建主增益节点
        masterGainNode = audioContext.createGain();
        masterGainNode.gain.value = 1.0;

        // 创建降噪节点（如果启用）
        if (noiseReductionConfig.enabled) {
          createNoiseReductionNode();
        }

        // 连接到输出
        if (noiseReductionNode) {
          noiseReductionNode.connect(masterGainNode);
          masterGainNode.connect(audioContext.destination);
        } else {
          masterGainNode.connect(audioContext.destination);
        }

        audioDestination = masterGainNode;
        console.log('[音频] 音频系统初始化成功');
      }
      return true;
    } catch (error) {
      console.error('[音频] 初始化失败:', error);
      return false;
    }
  };

  /**
   * 创建降噪节点
   */
  const createNoiseReductionNode = () => {
    // 使用简单的滤波器实现降噪
    const filter = audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 100; // 切除低频噪音
    filter.Q.value = 1;

    noiseReductionNode = filter;
    console.log('[音频] 降噪节点已创建');
  };

  /**
   * 添加音频通道
   */
  const addAudioChannel = async (sourceId, mediaStream, sourceName) => {
    try {
      await initAudioSystem();

      const audioTracks = mediaStream.getAudioTracks();
      if (audioTracks.length === 0) {
        console.warn('[音频] 媒体流中没有音频轨道');
        return null;
      }

      // 创建 MediaStreamSource
      const source = audioContext.createMediaStreamSource(mediaStream);

      // 创建通道配置
      const channel = {
        id: sourceId,
        name: sourceName || `音频通道 ${audioChannels.value.length + 1}`,
        source: source,
        gainNode: audioContext.createGain(),
        muted: false,
        volume: 1.0,
        enabled: true,
        noiseReduction: noiseReductionConfig.enabled
      };

      // 设置初始音量
      channel.gainNode.gain.value = channel.volume;

      // 连接音频图
      if (channel.noiseReduction && noiseReductionNode) {
        source.connect(channel.gainNode);
        channel.gainNode.connect(noiseReductionNode);
      } else {
        source.connect(channel.gainNode);
        channel.gainNode.connect(masterGainNode);
      }

      audioChannels.value.push(channel);
      console.log('[音频] 已添加音频通道:', sourceId);

      return channel;
    } catch (error) {
      console.error('[音频] 添加通道失败:', error);
      return null;
    }
  };

  /**
   * 移除音频通道
   */
  const removeAudioChannel = (sourceId) => {
    const index = audioChannels.value.findIndex(ch => ch.id === sourceId);
    if (index !== -1) {
      const channel = audioChannels.value[index];

      // 断开连接
      channel.source.disconnect();
      channel.gainNode.disconnect();

      audioChannels.value.splice(index, 1);
      console.log('[音频] 已移除音频通道:', sourceId);
    }
  };

  /**
   * 设置通道静音
   */
  const setChannelMute = (sourceId, muted) => {
    const channel = audioChannels.value.find(ch => ch.id === sourceId);
    if (channel) {
      channel.muted = muted;
      channel.gainNode.gain.value = muted ? 0 : channel.volume;
      console.log(`[音频] 通道 ${sourceId} 静音:`, muted);
    }
  };

  /**
   * 设置通道音量
   */
  const setChannelVolume = (sourceId, volume) => {
    const channel = audioChannels.value.find(ch => ch.id === sourceId);
    if (channel) {
      channel.volume = volume;
      if (!channel.muted) {
        channel.gainNode.gain.value = volume;
      }
      console.log(`[音频] 通道 ${sourceId} 音量:`, volume);
    }
  };

  /**
   * 启用/禁用通道
   */
  const setChannelEnabled = (sourceId, enabled) => {
    const channel = audioChannels.value.find(ch => ch.id === sourceId);
    if (channel) {
      channel.enabled = enabled;
      if (enabled) {
        channel.gainNode.connect(noiseReductionNode || masterGainNode);
      } else {
        channel.gainNode.disconnect();
      }
      console.log(`[音频] 通道 ${sourceId} 启用:`, enabled);
    }
  };

  /**
   * 切换降噪
   */
  const toggleNoiseReduction = (enabled) => {
    noiseReductionConfig.enabled = enabled;
    recordingConfig.noiseReduction = enabled;

    if (enabled && !noiseReductionNode) {
      createNoiseReductionNode();

      // 重新连接所有通道
      audioChannels.value.forEach(channel => {
        channel.gainNode.disconnect();
        channel.gainNode.connect(noiseReductionNode);
      });

      noiseReductionNode.connect(masterGainNode);
    } else if (!enabled && noiseReductionNode) {
      // 断开降噪节点
      audioChannels.value.forEach(channel => {
        channel.gainNode.disconnect();
        channel.gainNode.connect(masterGainNode);
      });

      noiseReductionNode.disconnect();
      noiseReductionNode = null;
    }

    console.log('[音频] 降噪:', enabled);
  };

  /**
   * 获取混合音频流
   */
  const getMixedAudioStream = () => {
    if (!audioContext) {
      console.warn('[音频] 音频系统未初始化');
      return null;
    }

    // 创建目的地节点用于录制
    const destination = audioContext.createMediaStreamDestination();
    masterGainNode.connect(destination);

    return destination.stream;
  };

  /**
   * 开始录制指定预览区域
   */
  const startPreviewRecording = async (index, videoElement, sourceName, sourceType) => {
    try {
      // 🎯 迁移：从 useVideoSync 获取最新信号源信息（如果未提供）
      const storeSource = getSourceByCanvasIndex(index);
      const actualSourceName = storeSource?.name || sourceName;
      const actualSourceType = storeSource?.type || sourceType;

      // 验证信号源类型
      if (!isSourceRecordable(actualSourceType)) {
        console.warn(`[预览录制] 不支持的信号源类型: ${actualSourceType}`);
        ElMessage.warning(`"${actualSourceType}" 类型的信号源暂不支持录制`);
        return;
      }

      const state = previewRecordingStates.value.get(index);
      if (!state) {
        previewRecordingStates.value.set(index, {
          recording: true,
          paused: false,
          mediaRecorder: null,
          recordedChunks: [],
          videoElement: videoElement,
          sourceName: actualSourceName,
          sourceType: actualSourceType
        });
      } else {
        state.recording = true;
        state.paused = false;
      }

      // 🎯 迁移：同步到 useVideoSync
      setCanvasRecordingState(index, {
        recording: true,
        paused: false
      });

      // 开始实际录制
      if (videoElement) {
        await startActualPreviewRecording(index, videoElement, actualSourceName, actualSourceType);
      }

      console.log(`[预览录制] 预览 ${index} 开始录制`);
      ElMessage.success(`预览 ${index} 开始录制`);
    } catch (error) {
      console.error(`[预览录制] 预览 ${index} 开始录制失败:`, error);
      ElMessage.error(`预览 ${index} 录制启动失败`);
    }
  };

  /**
   * 验证信号源是否适合录制
   */
  const validateSourceForRecording = async (index, videoElement, sourceType) => {
    const errors = [];

    // 1. 验证 videoElement
    if (!videoElement) {
      errors.push('视频元素不存在');
      return { valid: false, errors };
    }

    // 🎯 迁移：从 useVideoSync 验证信号源是否存在
    const source = getSourceByCanvasIndex(index);
    if (!source) {
      errors.push('信号源已被移除');
      return { valid: false, errors };
    }

    // 3. 检查设备权限（摄像头）
    if (sourceType === 'camera' || sourceType === 'mobileCamera') {
      try {
        const permission = await navigator.permissions.query({ name: 'camera' });
        if (permission.state === 'denied') {
          errors.push('摄像头权限被拒绝');
          return { valid: false, errors };
        }
      } catch (e) {
        console.warn('[录制] 无法查询摄像头权限:', e);
      }
    }

    // 4. 检查浏览器支持
    if (!videoElement.captureStream && !videoElement.mozCaptureStream) {
      errors.push('当前浏览器不支持视频流捕获');
      return { valid: false, errors };
    }

    return { valid: true, errors: [] };
  };

  /**
   * 实际开始预览录制
   */
  const startActualPreviewRecording = async (index, videoElement, sourceName, sourceType) => {
    try {
      // 预检
      const validation = await validateSourceForRecording(index, videoElement, sourceType);
      if (!validation.valid) {
        throw new Error(`信号源验证失败: ${validation.errors.join(', ')}`);
      }

      const state = previewRecordingStates.value.get(index);
      if (!state) return;

      // 记录开始时间
      state.startTime = Date.now();

      // 捕获视频流
      const stream = videoElement.captureStream ?
        videoElement.captureStream() :
        videoElement.mozCaptureStream();

      if (!stream || stream.getVideoTracks().length === 0) {
        throw new Error('无法获取视频流，请检查设备连接');
      }

      // 配置音频
      if (recordingConfig.enableAudioMix) {
        const audioStream = getMixedAudioStream();
        if (audioStream) {
          const combinedStream = new MediaStream([
            ...stream.getVideoTracks(),
            ...audioStream.getAudioTracks()
          ]);
          state.mediaRecorder = new MediaRecorder(combinedStream, {
            mimeType: getMimeType()
          });
        } else {
          state.mediaRecorder = new MediaRecorder(stream, {
            mimeType: getMimeType()
          });
        }
      } else {
        state.mediaRecorder = new MediaRecorder(stream, {
          mimeType: getMimeType()
        });
      }

      state.recordedChunks = [];

      state.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          state.recordedChunks.push(event.data);
        }
      };

      state.mediaRecorder.onstop = async () => {
        const blob = new Blob(state.recordedChunks, { type: getMimeType() });
        // 立即释放 chunks 内存
        state.recordedChunks = [];
        await savePreviewRecordingFile(index, blob, state.sourceName, state.sourceType);
      };

      state.mediaRecorder.start(1000);

    } catch (error) {
      console.error(`[预览录制] 实际录制启动失败:`, error);
      ElMessage.error(error.message);
      throw error;
    }
  };

  /**
   * 保存预览录制文件 - 使用统一命名系统
   */
  const savePreviewRecordingFile = async (index, blob, sourceName, sourceType) => {
    try {
      // 确定信号源类型标签
      const typeLabel = sourceType === 'camera' ? '摄像头' : '远程桌面';
      const context = 'preview'; // 预览区域

      // 清理信号源名称
      const cleanSourceName = (sourceName || `${typeLabel}_${index}`).replace(/[\\/:*?"<>|]/g, '_');

      // 使用 Rust 后端生成标准化文件名
      const extension = recordingConfig.outputFormat || 'webm';
      const filename = await generateVideoFilename(context, cleanSourceName, extension);

      console.log(`[预览录制] 生成标准化文件名: ${filename}`);

      // 获取录制目录
      const dir = await getVideoDir();
      const fullPath = `${dir}/${filename}`;

      // Tauri v2 暂不支持直接写入二进制文件，使用前端下载方案
      console.log('[预览录制] 使用前端下载方案保存文件');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      const savedPath = filename;
      console.log(`[预览录制] 文件已触发下载: ${filename}`);

      // 计算真实时长
      const state = previewRecordingStates.value.get(index);
      const actualDurationSec = state?.startTime
        ? (Date.now() - state.startTime) / 1000
        : blob.size / (250 * 1024); // 回退估算

      // 注册到策略引擎（触发自动清理和索引）
      try {
        await finalizeVideo(filename, 'mediarecorder', actualDurationSec);
        console.log('[预览录制] 视频已注册到策略引擎');
      } catch (error) {
        console.warn('[预览录制] 注册视频失败（不影响使用）:', error);
      }

      // 添加到录制列表
      recordings.value.unshift({
        id: Date.now().toString(),
        name: filename,
        type: sourceType,
        canvas: index,
        duration: formatDuration(actualDurationSec),
        size: formatFileSize(blob.size),
        createTime: new Date().toLocaleString(),
        sourceName: sourceName,
        path: savedPath || filename,
        timestamp: new Date().toISOString()
      });

      ElMessage.success(`录制已保存: ${filename}`);
    } catch (error) {
      console.error('[预览录制] 保存文件失败:', error);
      ElMessage.error('保存录制文件失败');
    }
  };

  /**
   * 开始录制指定画布 (使用Tauri后端FFmpeg)
   */
  const startCanvasRecording = async (index, videoElement, sourceName) => {
    try {
      // 生成会话ID
      const sessionId = `canvas_${index}_${Date.now()}`;

      // 获取画布位置和尺寸（需要从DOM获取）
      const canvasElement = document.querySelector(`[data-index="${index}"]`);
      if (!canvasElement) {
        throw new Error(`找不到画布元素: ${index}`);
      }

      const rect = canvasElement.getBoundingClientRect();
      const x = Math.round(rect.left);
      const y = Math.round(rect.top);
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);

      // 构建录制配置
      const config = {
        output_format: recordingConfig.outputFormat,
        encoder: recordingConfig.encoder,
        preset: recordingConfig.preset,
        crf: recordingConfig.crf,
        resolution: `${width}x${height}`,
        frame_rate: 30,
        video_bitrate: 4000,
        audio_enabled: recordingConfig.enableAudioMix,
        audio_channels: audioChannels.value.filter(ch => ch.enabled && !ch.muted),
        watermark: recordingConfig.enableWatermark ? {
          text: recordingConfig.watermarkText,
          position: recordingConfig.watermarkPosition,
          font_size: recordingConfig.watermarkFontSize,
          color: recordingConfig.watermarkColor
        } : null
      };

      // 调用Tauri后端API
      const outputPath = await tauriStartCanvasRecording({
        session_id: sessionId,
        x,
        y,
        width,
        height,
        config
      });

      // 更新状态
      canvasRecordingStates.value.set(index, {
        recording: true,
        paused: false,
        sessionId,
        outputPath,
        mediaRecorder: null,
        recordedChunks: [],
        videoElement: videoElement,
        sourceName: sourceName
      });

      console.log(`[录制] 画布 ${index} 开始录制, 输出: ${outputPath}`);
      ElMessage.success(`画布 ${index} 开始录制`);
    } catch (error) {
      console.error(`[录制] 画布 ${index} 开始录制失败:`, error);
      ElMessage.error(`画布 ${index} 录制启动失败: ${error.message || error}`);
    }
  };

  /**
   * 实际开始录制 (使用 MediaRecorder API)
   */
  const startActualRecording = async (index, videoElement, sourceName) => {
    try {
      const state = canvasRecordingStates.value.get(index);
      if (!state) return;

      // 捕获视频流
      const stream = videoElement.captureStream ?
        videoElement.captureStream() :
        videoElement.mozCaptureStream();

      if (!stream) {
        throw new Error('无法获取视频流');
      }

      // 配置音频
      if (recordingConfig.enableAudioMix) {
        const audioStream = getMixedAudioStream();
        if (audioStream) {
          // 合并视频和音频流
          const combinedStream = new MediaStream([
            ...stream.getVideoTracks(),
            ...audioStream.getAudioTracks()
          ]);
          state.mediaRecorder = new MediaRecorder(combinedStream, {
            mimeType: getMimeType()
          });
        } else {
          state.mediaRecorder = new MediaRecorder(stream, {
            mimeType: getMimeType()
          });
        }
      } else {
        state.mediaRecorder = new MediaRecorder(stream, {
          mimeType: getMimeType()
        });
      }

      state.recordedChunks = [];

      state.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          state.recordedChunks.push(event.data);
        }
      };

      state.mediaRecorder.onstop = async () => {
        const blob = new Blob(state.recordedChunks, { type: getMimeType() });
        await saveRecordingFile(index, blob, state.sourceName);
      };

      state.mediaRecorder.start(1000); // 每秒收集一次数据

    } catch (error) {
      console.error(`[录制] 实际录制启动失败:`, error);
      throw error;
    }
  };

  /**
   * 获取正确的 MIME 类型
   */
  const getMimeType = () => {
    const format = recordingConfig.outputFormat;
    if (format === 'mkv') {
      return 'video/webm'; // WebM 容器
    }
    return 'video/webm;codecs=vp9'; // MP4 使用 WebM 格式 (浏览器支持限制)
  };

  /**
   * 保存录制文件
   */
  const saveRecordingFile = async (index, blob, sourceName) => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${timestamp}_${sourceName || `camera_${index}`}.${recordingConfig.outputFormat}`;

      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      // 添加到录制列表
      recordings.value.unshift({
        id: Date.now().toString(),
        name: fileName,
        type: 'camera',
        canvas: index,
        duration: recordingTime.value,
        size: formatFileSize(blob.size),
        createTime: new Date().toLocaleString(),
        sourceName: sourceName
      });

      ElMessage.success(`录制已保存: ${fileName}`);
    } catch (error) {
      console.error('[录制] 保存文件失败:', error);
      ElMessage.error('保存录制文件失败');
    }
  };

  /**
   * 格式化文件大小
   */
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  /**
   * 格式化时长（秒转为HH:MM:SS）
   */
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  /**
   * 暂停指定预览的录制
   */
  const pausePreviewRecording = (index) => {
    try {
      const state = previewRecordingStates.value.get(index);
      if (state && state.recording && !state.paused && state.mediaRecorder) {
        if (state.mediaRecorder.state === 'recording') {
          state.mediaRecorder.pause();
          state.paused = true;

          // 🎯 迁移：同步到 useVideoSync
          setCanvasRecordingState(index, {
            recording: true,
            paused: true
          });

          console.log(`[预览录制] 预览 ${index} 暂停录制`);
          ElMessage.info(`预览 ${index} 录制已暂停`);
        }
      }
    } catch (error) {
      console.error(`[预览录制] 预览 ${index} 暂停录制失败:`, error);
    }
  };

  /**
   * 恢复指定预览的录制
   */
  const resumePreviewRecording = (index) => {
    try {
      const state = previewRecordingStates.value.get(index);
      if (state && state.recording && state.paused && state.mediaRecorder) {
        if (state.mediaRecorder.state === 'paused') {
          state.mediaRecorder.resume();
          state.paused = false;

          // 🎯 迁移：同步到 useVideoSync
          setCanvasRecordingState(index, {
            recording: true,
            paused: false
          });

          console.log(`[预览录制] 预览 ${index} 恢复录制`);
          ElMessage.success(`预览 ${index} 录制已恢复`);
        }
      }
    } catch (error) {
      console.error(`[预览录制] 预览 ${index} 恢复录制失败:`, error);
    }
  };

  /**
   * 停止指定预览的录制
   */
  const stopPreviewRecording = async (index) => {
    try {
      const state = previewRecordingStates.value.get(index);
      if (state && state.recording) {
        if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
          state.mediaRecorder.stop();
        }
        state.recording = false;
        state.paused = false;

        // 🎯 迁移：同步到 useVideoSync
        setCanvasRecordingState(index, {
          recording: false,
          paused: false
        });

        console.log(`[预览录制] 预览 ${index} 停止录制`);
      }
    } catch (error) {
      console.error(`[预览录制] 预览 ${index} 停止录制失败:`, error);
    }
  };

  /**
   * 暂停指定画布的录制
   */
  const pauseCanvasRecording = async (index) => {
    try {
      const state = canvasRecordingStates.value.get(index);
      if (state && state.recording && !state.paused && state.sessionId) {
        await tauriPauseRecording(state.sessionId);
        state.paused = true;
        currentRecordingSession.value.pauseCount++;
        console.log(`[录制] 画布 ${index} 暂停录制`);
        ElMessage.info(`画布 ${index} 录制已暂停`);
      }
    } catch (error) {
      console.error(`[录制] 画布 ${index} 暂停录制失败:`, error);
      ElMessage.error('暂停录制失败');
    }
  };

  /**
   * 恢复指定画布的录制
   */
  const resumeCanvasRecording = async (index) => {
    try {
      const state = canvasRecordingStates.value.get(index);
      if (state && state.recording && state.paused && state.sessionId) {
        await tauriResumeRecording(state.sessionId);
        state.paused = false;
        console.log(`[录制] 画布 ${index} 恢复录制`);
        ElMessage.success(`画布 ${index} 录制已恢复`);
      }
    } catch (error) {
      console.error(`[录制] 画布 ${index} 恢复录制失败:`, error);
      ElMessage.error('恢复录制失败');
    }
  };

  /**
   * 停止指定画布的录制
   */
  const stopCanvasRecording = async (index) => {
    try {
      const state = canvasRecordingStates.value.get(index);
      if (state && state.recording && state.sessionId) {
        const outputPath = await tauriStopRecording(state.sessionId);
        state.recording = false;
        state.paused = false;

        // 添加到录制列表
        recordings.value.unshift({
          id: Date.now().toString(),
          name: outputPath.split('\\').pop() || outputPath.split('/').pop(),
          type: 'canvas',
          canvas: index,
          duration: formatDuration(state.duration || 0),
          size: '计算中...',
          createTime: new Date().toLocaleString(),
          sourceName: state.sourceName,
          path: outputPath
        });

        console.log(`[录制] 画布 ${index} 停止录制, 文件: ${outputPath}`);
        ElMessage.success(`录制已保存: ${outputPath}`);
      }
    } catch (error) {
      console.error(`[录制] 画布 ${index} 停止录制失败:`, error);
      ElMessage.error('停止录制失败');
    }
  };

  /**
   * 一键录制所有预览区域（只录制摄像头和远程桌面）
   */
  const startAllPreviewRecording = async (previewSources) => {
    try {
      let successCount = 0;
      let skippedCount = 0;

      // 记录开始时间
      currentRecordingSession.value.startTime = new Date();
      currentRecordingSession.value.isRecording = true;
      currentRecordingSession.value.isPaused = false;
      currentRecordingSession.value.pauseCount = 0;
      currentRecordingSession.value.recordingMode = 'preview';

      // 启动计时器
      startRecordingTimer();

      // 遍历所有预览源
      if (previewSources && Array.isArray(previewSources)) {
        for (const source of previewSources) {
          try {
            // 跳过本地视频
            if (source.type === 'local') {
              skippedCount++;
              console.log(`[预览录制] 跳过本地视频: ${source.name}`);
              continue;
            }

            await startPreviewRecording(
              source.index,
              source.videoElement,
              source.name,
              source.type
            );
            successCount++;
          } catch (error) {
            console.warn(`[预览录制] 预览 ${source.index} 录制失败:`, error);
          }
        }
      }

      ElMessage.success(`已开始录制 ${successCount} 个预览源${skippedCount > 0 ? `，跳过 ${skippedCount} 个本地视频` : ''}`);
    } catch (error) {
      console.error('[预览录制] 一键录制失败:', error);
      ElMessage.error('一键录制失败');
    }
  };

  /**
   * 暂停所有预览的录制
   */
  const pauseAllPreviewRecording = () => {
    try {
      let count = 0;
      previewRecordingStates.value.forEach((state, index) => {
        if (state && state.recording && !state.paused) {
          pausePreviewRecording(index);
          count++;
        }
      });
      currentRecordingSession.value.isPaused = true;
      if (count > 0) {
        ElMessage.success(`已暂停 ${count} 个预览录制`);
      }
    } catch (error) {
      console.error('[预览录制] 暂停所有录制失败:', error);
    }
  };

  /**
   * 恢复所有预览的录制
   */
  const resumeAllPreviewRecording = () => {
    try {
      let count = 0;
      previewRecordingStates.value.forEach((state, index) => {
        if (state && state.recording && state.paused) {
          resumePreviewRecording(index);
          count++;
        }
      });
      currentRecordingSession.value.isPaused = false;
      if (count > 0) {
        ElMessage.success(`已恢复 ${count} 个预览录制`);
      }
    } catch (error) {
      console.error('[预览录制] 恢复所有录制失败:', error);
    }
  };

  /**
   * 停止所有预览的录制
   */
  const stopAllPreviewRecording = async () => {
    try {
      let count = 0;
      const promises = [];

      console.log('[预览录制] 开始停止所有预览录制...');

      previewRecordingStates.value.forEach((state, index) => {
        if (state && state.recording) {
          console.log(`[预览录制] 停止预览 ${index}: ${state.sourceName} (${state.sourceType})`);
          promises.push(stopPreviewRecording(index));
          count++;
        }
      });

      await Promise.all(promises);
      currentRecordingSession.value.isRecording = false;
      currentRecordingSession.value.isPaused = false;

      // 停止计时器
      stopRecordingTimer();

      console.log(`[预览录制] 已停止 ${count} 个预览录制,文件已保存`);

      if (count > 0) {
        ElMessage.success(`已停止 ${count} 个预览录制,文件已保存到下载目录`);
      } else {
        ElMessage.info('没有正在进行的录制');
      }
    } catch (error) {
      console.error('[预览录制] 停止所有录制失败:', error);
      ElMessage.error('停止录制失败');
    }
  };

  /**
   * 获取预览录制状态
   */
  const getPreviewRecordingState = (index) => {
    return previewRecordingStates.value.get(index) || { recording: false, paused: false };
  };

  /**
   * 一键录制所有画布
   */
  const startAllCanvasRecording = async () => {
    try {
      // 获取当前所有活跃的预览
      const count = 36; // 最多录制 36 个画布
      let successCount = 0;

      // 记录开始时间
      currentRecordingSession.value.startTime = new Date();
      currentRecordingSession.value.isRecording = true;
      currentRecordingSession.value.isPaused = false;
      currentRecordingSession.value.pauseCount = 0;

      // 启动计时器
      startRecordingTimer();

      for (let i = 1; i <= count; i++) {
        try {
          await startCanvasRecording(i);
          successCount++;
        } catch (error) {
          console.warn(`[录制] 画布 ${i} 录制失败:`, error);
        }
      }

      ElMessage.success(`已开始录制 ${successCount} 个画布`);
    } catch (error) {
      console.error('[录制] 一键录制失败:', error);
      ElMessage.error('一键录制失败');
    }
  };

  /**
   * 启动录制计时器
   */
  const startRecordingTimer = () => {
    if (recordingTimer) return;

    let seconds = 0;
    recordingTimer = setInterval(() => {
      seconds++;
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      recordingTime.value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }, 1000);
  };

  /**
   * 停止录制计时器
   */
  const stopRecordingTimer = () => {
    if (recordingTimer) {
      clearInterval(recordingTimer);
      recordingTimer = null;
      recordingTime.value = '00:00:00';
    }
  };

  /**
   * 暂停所有画布的录制
   */
  const pauseAllCanvasRecording = () => {
    try {
      let count = 0;
      canvasRecordingStates.value.forEach((state, index) => {
        if (state && state.recording && !state.paused) {
          pauseCanvasRecording(index);
          count++;
        }
      });
      currentRecordingSession.value.isPaused = true;
      if (count > 0) {
        ElMessage.success(`已暂停 ${count} 个画布录制`);
      }
    } catch (error) {
      console.error('[录制] 暂停所有录制失败:', error);
    }
  };

  /**
   * 恢复所有画布的录制
   */
  const resumeAllCanvasRecording = () => {
    try {
      let count = 0;
      canvasRecordingStates.value.forEach((state, index) => {
        if (state && state.recording && state.paused) {
          resumeCanvasRecording(index);
          count++;
        }
      });
      currentRecordingSession.value.isPaused = false;
      if (count > 0) {
        ElMessage.success(`已恢复 ${count} 个画布录制`);
      }
    } catch (error) {
      console.error('[录制] 恢复所有录制失败:', error);
    }
  };

  /**
   * 停止所有画布的录制
   */
  const stopAllCanvasRecording = async () => {
    try {
      let count = 0;
      const promises = [];

      canvasRecordingStates.value.forEach((state, index) => {
        if (state && state.recording) {
          promises.push(stopCanvasRecording(index));
          count++;
        }
      });

      await Promise.all(promises);
      currentRecordingSession.value.isRecording = false;
      currentRecordingSession.value.isPaused = false;

      // 停止计时器
      stopRecordingTimer();

      if (count > 0) {
        ElMessage.success(`已停止 ${count} 个画布录制`);
      }
    } catch (error) {
      console.error('[录制] 停止所有录制失败:', error);
      ElMessage.error('停止录制失败');
    }
  };

  /**
   * 获取画布录制状态
   */
  const getCanvasRecordingState = (index) => {
    return canvasRecordingStates.value.get(index) || { recording: false, paused: false };
  };

  /**
   * 获取当前录制会话状态
   */
  const getCurrentRecordingStatus = () => {
    return { ...currentRecordingSession.value, recordingTime: recordingTime.value };
  };

  /**
   * 加载录制文件列表
   */
  const loadRecordings = async () => {
    try {
      console.log('[录制] 开始加载录制文件列表...');
      // 从后端 API 获取录制视频列表
      const videoList = await listRecordedVideos();

      // 转换为前端需要的格式
      recordings.value = videoList.map(video => ({
        id: video.id || video.filename,
        name: video.filename,
        type: video.source_type || 'canvas',
        canvas: video.canvas_index || 0,
        duration: formatDuration(video.duration_sec || 0),
        size: formatFileSize(video.file_size_bytes || 0),
        createTime: video.created_at ? formatDateTime(video.created_at) : new Date().toLocaleString(),
        sourceName: video.source_name || '未知来源',
        path: video.file_path || video.filename,
        timestamp: video.created_at || new Date().toISOString(),
        url: video.file_path ? `file://${video.file_path}` : null
      }));

      console.log(`[录制] 加载了 ${recordings.value.length} 个录制文件`);
      ElMessage.success(`录制列表已刷新，共 ${recordings.value.length} 个文件`);
    } catch (error) {
      console.error('[录制] 加载录制列表失败:', error);
      ElMessage.error('加载录制列表失败');
    }
  };

  /**
   * 格式化日期时间
   */
  const formatDateTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  /**
   * 播放录制文件
   */
  const playRecording = async (recording) => {
    try {
      showPlaybackDialog.value = true;

      // 等待 DOM 更新后播放
      await new Promise(resolve => setTimeout(resolve, 100));

      if (playbackVideoRef.value) {
        playbackVideoRef.value.src = recording.url;
        await playbackVideoRef.value.play().catch(err => {
          console.warn('[录制] 自动播放被阻止:', err);
        });
      }
    } catch (error) {
      console.error('[录制] 播放录制文件失败:', error);
      ElMessage.error('播放失败');
    }
  };

  /**
   * 导出录制文件（复制到指定位置或打开文件所在目录）
   */
  const exportRecording = async (recording) => {
    try {
      console.log('[录制] 导出录制文件:', recording.name);

      // 如果有完整路径，尝试打开文件所在目录
      if (recording.path && recording.path.includes('/')) {
        // 提取目录路径
        const dirPath = recording.path.substring(0, recording.path.lastIndexOf('/'));
        try {
          await open(dirPath);
          ElMessage.success(`已打开文件所在目录: ${dirPath}`);
          return;
        } catch (openError) {
          console.warn('[录制] 打开目录失败，尝试其他方式:', openError);
        }
      }

      // 备用方案：创建下载链接
      if (recording.url) {
        const link = document.createElement('a');
        link.href = recording.url;
        link.download = recording.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        ElMessage.success(`已触发下载: ${recording.name}`);
      } else {
        ElMessage.info('该录制文件暂无法导出');
      }
    } catch (error) {
      // 用户取消导出是正常行为
      if (error !== 'cancel') {
        console.error('[录制] 导出失败:', error);
        ElMessage.error('导出失败');
      }
    }
  };

  /**
   * 删除录制文件
   */
  const deleteRecording = async (recording) => {
    try {
      await ElMessageBox.confirm(
        `确定删除录制文件 "${recording.name}" 吗?`,
        '提示',
        {
          type: 'warning',
          confirmButtonText: '确定删除',
          cancelButtonText: '取消'
        }
      );

      // 调用后端 API 删除文件
      try {
        await deleteRecordedVideo(recording.name);
        console.log('[录制] 后端删除成功:', recording.name);
      } catch (backendError) {
        console.warn('[录制] 后端删除失败，继续清理前端列表:', backendError);
      }

      // 从前端列表中移除
      recordings.value = recordings.value.filter(r => r.id !== recording.id);
      ElMessage.success('删除成功');
    } catch (error) {
      // 用户取消删除是正常行为
      if (error !== 'cancel') {
        console.error('[录制] 删除失败:', error);
        ElMessage.error('删除失败');
      }
    }
  };

  /**
   * 获取筛选后的录制列表
   */
  const getFilteredRecordings = () => {
    if (recordingFilter.value === 'all') {
      return recordings.value;
    }
    return recordings.value.filter(r => r.type === recordingFilter.value);
  };

  /**
   * 获取录制路径类型标签
   */
  const getSourceTypeTag = (type) => {
    const tags = {
      camera: 'success',
      local: '',
      screen: 'warning'
    };
    return tags[type] || '';
  };

  /**
   * 获取录制路径类型标签文字
   */
  const getSourceTypeLabel = (type) => {
    const labels = {
      camera: '摄像头',
      local: '本地视频',
      screen: '屏幕共享'
    };
    return labels[type] || type;
  };

  /**
   * 清理资源
   */
  const cleanup = () => {
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }

    audioChannels.value = [];
    noiseReductionNode = null;
    masterGainNode = null;

    console.log('[录制] 资源已清理');
  };

  // 录制进度状态
  const recordingProgress = ref(new Map()); // sessionId -> { duration, fileSize, isPaused }

  /**
   * 切换活动摄像头（多机位）
   */
  const switchCamera = async (sessionId, cameraIndex) => {
    try {
      await tauriSwitchCamera(sessionId, cameraIndex);
      activeCameraIndex.value = cameraIndex;
      ElMessage.success(`已切换到摄像头 ${cameraIndex + 1}`);
    } catch (error) {
      console.error('[录制] 切换摄像头失败:', error);
      ElMessage.error('切换摄像头失败');
    }
  };

  /**
   * 开始多机位录制
   */
  const startMulticamRecording = async (cameraConfig, recordingConfig) => {
    try {
      const sessionId = `multicam_${Date.now()}`;
      const outputPath = await tauriStartMulticam(sessionId, cameraConfig, recordingConfig);

      multicamSessionId.value = sessionId;
      activeCameraIndex.value = 0;

      ElMessage.success('多机位录制已开始');
      return { sessionId, outputPath };
    } catch (error) {
      console.error('[录制] 多机位录制失败:', error);
      ElMessage.error('多机位录制失败');
      throw error;
    }
  };

  /**
   * 停止多机位录制
   */
  const stopMulticamRecording = async () => {
    if (!multicamSessionId.value) {
      ElMessage.warning('没有活跃的多机位录制会话');
      return;
    }

    try {
      await tauriStopRecording(multicamSessionId.value);
      multicamSessionId.value = null;
      ElMessage.success('多机位录制已停止');
    } catch (error) {
      console.error('[录制] 停止多机位录制失败:', error);
      ElMessage.error('停止多机位录制失败');
    }
  };

  /**
   * 开始RTMP推流
   */
  const startRtmpStream = async (sourceElement, config) => {
    try {
      const sessionId = `rtmp_${Date.now()}`;

      // 获取源元素的位置和尺寸
      const rect = sourceElement.getBoundingClientRect();
      const x = Math.round(rect.left);
      const y = Math.round(rect.top);
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);

      const streamUrl = await tauriStartRtmp(sessionId, x, y, width, height, config);

      rtmpStreamingState.isStreaming = true;
      rtmpStreamingState.sessionId = sessionId;
      rtmpStreamingState.streamUrl = streamUrl;
      rtmpStreamingState.startTime = Date.now();

      ElMessage.success(`RTMP推流已启动: ${streamUrl}`);
      return { sessionId, streamUrl };
    } catch (error) {
      console.error('[录制] RTMP推流失败:', error);
      ElMessage.error('RTMP推流失败');
      throw error;
    }
  };

  /**
   * 停止RTMP推流
   */
  const stopRtmpStream = async () => {
    if (!rtmpStreamingState.sessionId) {
      ElMessage.warning('没有活跃的RTMP推流会话');
      return;
    }

    try {
      await tauriStopRtmp(rtmpStreamingState.sessionId);

      rtmpStreamingState.isStreaming = false;
      rtmpStreamingState.sessionId = null;
      rtmpStreamingState.streamUrl = null;
      rtmpStreamingState.startTime = null;

      ElMessage.success('RTMP推流已停止');
    } catch (error) {
      console.error('[录制] 停止RTMP推流失败:', error);
      ElMessage.error('停止RTMP推流失败');
    }
  };

  /**
   * 开始VR/360°视频录制
   */
  const startVrRecording = async (cameraDevice, config) => {
    try {
      const sessionId = `vr_${Date.now()}`;
      const outputPath = await tauriStartVr(sessionId, cameraDevice, config);

      vrRecordingState.isRecording = true;
      vrRecordingState.sessionId = sessionId;
      vrRecordingState.projection = config.vr_config?.projection || 'equirectangular';

      ElMessage.success('VR/360°视频录制已开始');
      return { sessionId, outputPath };
    } catch (error) {
      console.error('[录制] VR录制失败:', error);
      ElMessage.error('VR/360°视频录制失败');
      throw error;
    }
  };

  /**
   * 停止VR/360°视频录制
   */
  const stopVrRecording = async () => {
    if (!vrRecordingState.sessionId) {
      ElMessage.warning('没有活跃的VR录制会话');
      return;
    }

    try {
      await tauriStopRecording(vrRecordingState.sessionId);

      vrRecordingState.isRecording = false;
      vrRecordingState.sessionId = null;

      ElMessage.success('VR/360°视频录制已停止');
    } catch (error) {
      console.error('[录制] 停止VR录制失败:', error);
      ElMessage.error('停止VR/360°视频录制失败');
    }
  };

  /**
   * 加载所有录制模板
   */
  const loadTemplates = async () => {
    try {
      const templates = await tauriLoadTemplates();
      recordingTemplates.value = templates;
      console.log(`[录制] 加载了 ${templates.length} 个模板`);
    } catch (error) {
      console.error('[录制] 加载模板失败:', error);
      ElMessage.error('加载模板失败');
    }
  };

  /**
   * 保存录制模板
   */
  const saveTemplate = async (template) => {
    try {
      await tauriSaveTemplate(template);
      console.log('[录制] 模板保存成功:', template.name);
    } catch (error) {
      console.error('[录制] 保存模板失败:', error);
      throw error;
    }
  };

  /**
   * 删除录制模板
   */
  const deleteTemplate = async (templateId) => {
    try {
      await ElMessageBox.confirm('确定要删除此模板吗？', '警告', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      });

      await tauriDeleteTemplate(templateId);
      await loadTemplates(); // 重新加载列表

      ElMessage.success('模板已删除');
    } catch (error) {
      if (error !== 'cancel') {
        console.error('[录制] 删除模板失败:', error);
        ElMessage.error('删除模板失败');
      }
    }
  };

  /**
   * 应用模板到当前配置
   */
  const applyTemplate = (template) => {
    // 复制模板配置到当前配置
    Object.assign(recordingConfig, template.config);
    ElMessage.success(`已应用模板: ${template.name}`);
  };

  // 组件挂载时加载模板
  onMounted(() => {
    loadTemplates();
  });

  /**
   * 初始化进度监听
   */
  const initProgressListener = () => {
    const unlisten = onRecordingProgress((payload) => {
      const { session_id, duration, file_size, is_paused } = payload;

      // 更新进度状态
      recordingProgress.value.set(session_id, {
        duration,
        fileSize: file_size,
        isPaused: is_paused,
        formattedDuration: formatDuration(duration),
        formattedSize: formatFileSize(file_size)
      });

      // 查找对应的画布索引并更新UI
      canvasRecordingStates.value.forEach((state, index) => {
        if (state.sessionId === session_id) {
          state.duration = duration;
          state.fileSize = file_size;
        }
      });
    });

    return unlisten;
  };

  // 组件挂载时启动监听
  let progressUnlisten = null;
  let videoFinalizedUnlisten = null;
  let videosCleanedUnlisten = null;
  let isListening = false; // 🎯 添加标志防止重复注册

  onMounted(() => {
    // 🎯 防止重复注册监听器
    if (isListening) return;
    isListening = true;
    
    progressUnlisten = initProgressListener();

    // 监听视频完成事件
    videoFinalizedUnlisten = onVideoFinalized((metadata) => {
      console.log('[录制管理] 视频已完成并注册:', metadata);
      // 可以在这里触发 UI 更新或其他逻辑
    });

    // 监听视频清理事件
    videosCleanedUnlisten = onVideosCleaned((removedFiles) => {
      console.log('[录制管理] 后台清理完成，删除的文件:', removedFiles);
      ElMessage.info(`已自动清理 ${removedFiles.length} 个旧视频文件`);
      // 刷新录制列表
      loadRecordings();
    });
  });

  onUnmounted(() => {
    // 🎯 修复：添加 typeof 检查，确保是函数后再调用
    if (typeof progressUnlisten === 'function') {
      progressUnlisten();
    }
    if (typeof videoFinalizedUnlisten === 'function') {
      videoFinalizedUnlisten();
    }
    if (typeof videosCleanedUnlisten === 'function') {
      videosCleanedUnlisten();
    }
    // 🎯 重置监听标志
    isListening = false;
  });

  /**
   * 获取指定会话的进度信息
   */
  const getRecordingProgress = (sessionId) => {
    return recordingProgress.value.get(sessionId);
  };

  return {
    // 状态
    sourceRecordingState,
    canvasRecordingStates,
    previewRecordingStates,
    recordings,
    showPlaybackDialog,
    showRecordingDialog,
    playbackVideoRef,
    recordingFilter,
    recordingConfig,
    audioChannels,
    currentRecordingSession,
    recordingTime,
    noiseReductionConfig,
    recordingProgress,
    recordingTemplates,

    // 多机位功能
    multicamSessionId,
    activeCameraIndex,
    switchCamera,
    startMulticamRecording,
    stopMulticamRecording,

    // RTMP推流功能
    rtmpStreamingState,
    startRtmpStream,
    stopRtmpStream,

    // VR/360°视频功能
    vrRecordingState,
    startVrRecording,
    stopVrRecording,

    // 画布录制控制
    startCanvasRecording,
    pauseCanvasRecording,
    resumeCanvasRecording,
    stopCanvasRecording,
    startAllCanvasRecording,
    pauseAllCanvasRecording,
    resumeAllCanvasRecording,
    stopAllCanvasRecording,
    getCanvasRecordingState,

    // 预览录制控制
    startPreviewRecording,
    pausePreviewRecording,
    resumePreviewRecording,
    stopPreviewRecording,
    startAllPreviewRecording,
    pauseAllPreviewRecording,
    resumeAllPreviewRecording,
    stopAllPreviewRecording,
    getPreviewRecordingState,

    // 通用录制控制
    getCurrentRecordingStatus,

    // 音频管理
    initAudioSystem,
    addAudioChannel,
    removeAudioChannel,
    setChannelMute,
    setChannelVolume,
    setChannelEnabled,
    toggleNoiseReduction,
    getMixedAudioStream,

    // 录制文件管理
    loadRecordings,
    playRecording,
    exportRecording,
    deleteRecording,
    getFilteredRecordings,

    // 模板管理
    loadTemplates,
    saveTemplate,
    deleteTemplate,
    applyTemplate,

    // 清理
    cleanup,
    getRecordingProgress
  };
}
