import { ref, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';

/**
 * 音频监控 Composable
 * 处理麦克风、本地视频和系统音频的监听和控制
 * 支持多通道音频路由和输出设备管理
 */
export function useAudioMonitor() {
  // 麦克风相关
  const microphones = ref([]);
  const selectedMicrophone = ref('');
  const microphoneEnabled = ref(true);
  const microphoneVolume = ref(100);
  const microphoneLevel = ref(0);
  let microphoneStream = null;
  let microphoneAnalyser = null;
  let microphoneLevelInterval = null;

  // 为每个麦克风添加 enabled 和 volume 属性
  const initMicrophoneProperties = () => {
    microphones.value.forEach(mic => {
      if (mic.enabled === undefined) {
        mic.enabled = false;
      }
      if (mic.volume === undefined) {
        mic.volume = 100;
      }
    });
  };

  // 输出设备（扬声器）相关
  const speakers = ref([]);
  const selectedSpeaker = ref('');
  let audioDestination = null;

  // 本地视频音频相关（🎯 已弃用：现在直接从 allSources 获取）
  const selectedVideoAudio = ref('all'); // 当前选择的视频音频源
  const videoAudioEnabled = ref(true); // 本地视频音频是否启用
  const videoAudioVolume = ref(100); // 本地视频音频音量
  const videoAudioLevel = ref(0); // 本地视频音频级别
  let videoAudioAnalyser = null;
  let videoAudioLevelInterval = null;

  // 系统音频相关
  const systemAudioEnabled = ref(true);
  const systemAudioVolume = ref(80);

  // 音频上下文
  let audioContext = null;

  // 音频路由节点
  let audioRouter = null;
  let mixedAudioDestination = null;

  /**
   * 刷新音频设备列表（输入和输出设备）
   */
  const refreshAudioDevices = async () => {
    try {
      // 请求权限
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (error) {
        console.warn('[音频] 无法获取音频权限:', error);
        ElMessage.warning('无法访问音频设备');
        return;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      microphones.value = devices.filter(d => d.kind === 'audioinput');
      speakers.value = devices.filter(d => d.kind === 'audiooutput');

      // 初始化麦克风属性
      initMicrophoneProperties();

      if (microphones.value.length > 0 && !selectedMicrophone.value) {
        selectedMicrophone.value = microphones.value[0].deviceId;
      }

      if (speakers.value.length > 0 && !selectedSpeaker.value) {
        selectedSpeaker.value = speakers.value[0].deviceId;
      }

      console.log('[音频] 设备列表已刷新:', {
        microphones: microphones.value.length,
        speakers: speakers.value.length
      });
    } catch (error) {
      console.error('[音频] 刷新音频设备失败:', error);
      ElMessage.error('刷新音频设备失败');
    }
  };

  /**
   * 启动麦克风音量级别监控
   * 同时将音频路由到输出设备（扬声器）以便听到声音
   * 添加音频滤波器降低电流声和底噪
   */
  const startMicrophoneLevelMonitoring = async () => {
    try {
      // 如果已有音频上下文,先关闭
      if (audioContext && audioContext.state !== 'closed') {
        await audioContext.close();
        audioContext = null;
      }

      if (!selectedMicrophone.value) {
        return;
      }

      // 获取麦克风流（启用降噪和回声消除）
      microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: selectedMicrophone.value },
          echoCancellation: true, // 启用回声消除
          noiseSuppression: true, // 启用降噪
          autoGainControl: true // 启用自动增益控制
        }
      });

      // 创建音频上下文
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(microphoneStream);

      // 创建分析器用于音量检测
      microphoneAnalyser = audioContext.createAnalyser();
      microphoneAnalyser.fftSize = 256;

      // ===== 添加音频滤波器降低电流声 =====

      // 1. 高通滤波器 - 滤除低频噪音（电流声通常在低频）
      const highpassFilter = audioContext.createBiquadFilter();
      highpassFilter.type = 'highpass';
      highpassFilter.frequency.value = 80; // 截止频率 80Hz，滤除 80Hz 以下的低频噪音
      highpassFilter.Q.value = 0.7;

      // 2. 低通滤波器 - 滤除高频噪音（嘶嘶声、电流高频）
      const lowpassFilter = audioContext.createBiquadFilter();
      lowpassFilter.type = 'lowpass';
      lowpassFilter.frequency.value = 8000; // 截止频率 8kHz，保留人声范围
      lowpassFilter.Q.value = 0.7;

      // 3. 峰值滤波器 - 增强人声频率范围 (300Hz - 3kHz)
      const peakingFilter = audioContext.createBiquadFilter();
      peakingFilter.type = 'peaking';
      peakingFilter.frequency.value = 1000; // 中心频率 1kHz（人声主要频率）
      peakingFilter.Q.value = 1;
      peakingFilter.gain.value = 3; // 增益 3dB

      // 4. 压缩器 - 降低爆音和电流峰值
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.knee.value = 30;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;

      // ===== 连接音频处理链 =====
      // 麦克风 -> 高通滤波 -> 低通滤波 -> 峰值滤波 -> 压缩器 -> 分析器 -> 输出
      source.connect(highpassFilter);
      highpassFilter.connect(lowpassFilter);
      lowpassFilter.connect(peakingFilter);
      peakingFilter.connect(compressor);
      compressor.connect(microphoneAnalyser);

      // 关键：将麦克风音频连接到输出设备（扬声器）
      const destination = audioContext.createMediaStreamDestination();
      microphoneAnalyser.connect(destination);

      // 创建一个 Audio 元素来播放麦克风声音
      const audioOutput = new Audio();
      audioOutput.srcObject = destination.stream;
      audioOutput.muted = false;
      audioOutput.volume = microphoneVolume.value / 100;

      // 🎯 修复：处理浏览器自动播放策略阻止的异常
      await audioOutput.play().catch(err => {
        console.warn('[音频] 麦克风播放被浏览器阻止:', err);
        // 不抛出错误，允许继续执行
      });

      // 保存 audioOutput 引用以便后续控制
      window.microphoneAudioOutput = audioOutput;

      const dataArray = new Uint8Array(microphoneAnalyser.frequencyBinCount);

      // 清除之前的定时器
      if (microphoneLevelInterval) {
        clearInterval(microphoneLevelInterval);
      }

      microphoneLevelInterval = setInterval(() => {
        if (!microphoneAnalyser) return;

        microphoneAnalyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        microphoneLevel.value = Math.round((average / 255) * 100);
      }, 50);

      console.log('[音频] 麦克风监控已启动，音频已路由到输出设备');
      console.log('[音频] 已启用音频滤波器：高通(80Hz) + 低通(8kHz) + 压缩器');
    } catch (error) {
      console.error('[音频] 启动麦克风监控失败:', error);
      ElMessage.error('无法启动麦克风监控');
    }
  };

  /**
   * 停止麦克风监控
   */
  const stopMicrophoneMonitoring = () => {
    if (microphoneLevelInterval) {
      clearInterval(microphoneLevelInterval);
      microphoneLevelInterval = null;
    }

    if (microphoneStream) {
      microphoneStream.getTracks().forEach(track => track.stop());
      microphoneStream = null;
    }

    if (microphoneAnalyser) {
      microphoneAnalyser = null;
    }
  };

  /**
   * 切换麦克风
   */
  const toggleMicrophone = async () => {
    try {
      microphoneEnabled.value = !microphoneEnabled.value;

      if (microphoneEnabled.value) {
        await startMicrophoneLevelMonitoring();
        ElMessage.success('麦克风已启用');
      } else {
        stopMicrophoneMonitoring();
        microphoneLevel.value = 0;
        ElMessage.info('麦克风已禁用');
      }
    } catch (error) {
      console.error('[音频] 切换麦克风失败:', error);
      ElMessage.error('切换麦克风失败');
    }
  };

  /**
   * 麦克风设备变更
   */
  const onMicrophoneChange = async () => {
    try {
      stopMicrophoneMonitoring();

      if (microphoneEnabled.value) {
        await startMicrophoneLevelMonitoring();
      }
    } catch (error) {
      console.error('[音频] 切换麦克风设备失败:', error);
      ElMessage.error('切换设备失败');
    }
  };

  /**
   * 麦克风音量变更
   */
  const onMicrophoneVolumeChange = () => {
    // 应用音量设置到音频输出
    if (window.microphoneAudioOutput) {
      window.microphoneAudioOutput.volume = microphoneVolume.value / 100;
    }
    console.log('[音频] 麦克风音量:', microphoneVolume.value);
  };

  /**
   * 系统音频音量变更
   */
  const onSystemAudioVolumeChange = () => {
    try {
      const volume = systemAudioVolume.value / 100;

      // 更新所有视频元素的音量
      const allVideos = document.querySelectorAll('video');
      allVideos.forEach(video => {
        if (video && video.tagName === 'VIDEO') {
          // 只更新非麦克风预览的视频
          if (!video.classList.contains('microphone-preview')) {
            video.volume = volume;
          }
        }
      });

      // 更新全局引用
      window.systemAudioVolume = volume;

      console.log('[音频] 系统音频音量已设置:', systemAudioVolume.value);
    } catch (error) {
      console.error('[音频] 设置系统音频音量失败:', error);
    }
  };

  /**
   * 切换系统音频
   */
  const toggleSystemAudio = () => {
    try {
      systemAudioEnabled.value = !systemAudioEnabled.value;
      ElMessage.success(systemAudioEnabled.value ? '系统音频已启用' : '系统音频已禁用');
    } catch (error) {
      console.error('[音频] 切换系统音频失败:', error);
      ElMessage.error('切换失败');
    }
  };

  /**
   * 添加本地视频信号源
   * 🎯 已简化：不再维护 videoSources 数组，只确保属性存在
   */
  const addVideoSource = (source) => {
    if (source && source.type === 'localVideo') {
      // 确保音频属性存在（如果尚未设置）
      if (source.audioEnabled === undefined) {
        source.audioEnabled = false; // 默认禁用音频
      }
      if (source.volume === undefined) {
        source.volume = 100; // 默认音量100%
      }
      if (source.muted === undefined) {
        source.muted = true; // 默认静音
      }

      console.log('[音频] 添加本地视频信号源:', source.name, {
        audioEnabled: source.audioEnabled,
        volume: source.volume,
        muted: source.muted
      });
    }
  };

  /**
   * 移除本地视频信号源
   * 🎯 已简化：不再维护 videoSources 数组
   */
  const removeVideoSource = (sourceId) => {
    console.log('[音频] 移除本地视频信号源:', sourceId);
    // 🎯 不再需要操作 videoSources 数组
    // 如果当前选择的是被移除的源，重置为 'all'
    if (selectedVideoAudio.value === sourceId) {
      selectedVideoAudio.value = 'all';
    }
  };

  /**
   * 切换本地视频音频
   */
  const toggleVideoAudio = () => {
    videoAudioEnabled.value = !videoAudioEnabled.value;
    ElMessage.success(videoAudioEnabled.value ? '本地视频音频已启用' : '本地视频音频已禁用');
    console.log('[音频] 本地视频音频:', videoAudioEnabled.value ? '启用' : '禁用');
  };

  /**
   * 本地视频音频选择变更
   */
  const onVideoAudioChange = (sourceId) => {
    selectedVideoAudio.value = sourceId;
    console.log('[音频] 选择视频音频源:', sourceId);
    // 应用音频路由
    applyAudioRouting();
  };

  /**
   * 选择输出设备（扬声器）
   */
  const selectSpeaker = async (deviceId) => {
    try {
      selectedSpeaker.value = deviceId;

      // 如果有活跃的音频上下文，需要重新创建输出
      if (audioContext && audioContext.state === 'running') {
        await setupAudioRouting();
      }

      ElMessage.success('音频输出设备已切换');
      console.log('[音频] 已选择输出设备:', deviceId);
    } catch (error) {
      console.error('[音频] 切换输出设备失败:', error);
      ElMessage.error('切换输出设备失败');
    }
  };

  /**
   * 设置音频路由
   */
  const setupAudioRouting = async () => {
    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      // 创建音频路由节点
      if (!audioRouter) {
        audioRouter = audioContext.createGain();
        audioRouter.gain.value = 1;
      }

      // 创建混合音频目标
      if (!mixedAudioDestination) {
        mixedAudioDestination = audioContext.createMediaStreamDestination();
      }

      // 连接路由到混合目标
      audioRouter.connect(mixedAudioDestination);

      console.log('[音频] 音频路由已设置');
    } catch (error) {
      console.error('[音频] 设置音频路由失败:', error);
    }
  };

  /**
   * 应用音频路由配置
   */
  const applyAudioRouting = () => {
    try {
      // 根据当前设置路由音频
      const routes = [];

      if (microphoneEnabled.value && microphoneStream) {
        routes.push({ type: 'microphone', enabled: true });
      }

      if (videoAudioEnabled.value && selectedVideoAudio.value !== 'all') {
        routes.push({ type: 'video', sourceId: selectedVideoAudio.value, enabled: true });
      }

      if (systemAudioEnabled.value) {
        routes.push({ type: 'system', enabled: true });
      }

      console.log('[音频] 应用音频路由:', routes);
    } catch (error) {
      console.error('[音频] 应用音频路由失败:', error);
    }
  };

  /**
   * 获取当前音频路由配置
   */
  const getAudioRoutingConfig = () => {
    return {
      microphone: {
        enabled: microphoneEnabled.value,
        deviceId: selectedMicrophone.value,
        volume: microphoneVolume.value
      },
      videoAudio: {
        enabled: videoAudioEnabled.value,
        sourceId: selectedVideoAudio.value,
        volume: videoAudioVolume.value
      },
      systemAudio: {
        enabled: systemAudioEnabled.value,
        volume: systemAudioVolume.value
      },
      outputDevice: {
        deviceId: selectedSpeaker.value
      }
    };
  };

  /**
   * 本地视频音频音量变更
   */
  const onVideoAudioVolumeChange = () => {
    // 应用本地视频音频音量设置到所有本地视频元素
    console.log('[音频] 本地视频音频音量:', videoAudioVolume.value);

    // 查找所有本地视频元素并应用音量
    const volume = videoAudioVolume.value / 100;

    // 更新 SourceManager 中的预览视频音量
    const previewVideos = document.querySelectorAll('.source-preview-card .preview-video');
    previewVideos.forEach(video => {
      if (video && video.tagName === 'VIDEO') {
        video.volume = volume;
        console.log(`[音频] 更新预览视频音量: ${volume}`);
      }
    });

    // 更新 VideoPreview 组件中的视频音量（画布）
    const canvasVideos = document.querySelectorAll('.video-preview .video-element');
    canvasVideos.forEach(video => {
      if (video && video.tagName === 'VIDEO' && !video.muted) {
        video.volume = volume;
        console.log(`[音频] 更新画布视频音量: ${volume}`);
      }
    });

    // 保存到全局引用，供其他组件使用
    window.videoAudioVolume = volume;
  };

  /**
   * 清理资源
   */
  const cleanup = () => {
    stopMicrophoneMonitoring();

    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close();
      audioContext = null;
    }

    console.log('[音频] 已清理所有音频资源');
  };

  return {
    // 麦克风
    microphones,
    selectedMicrophone,
    microphoneEnabled,
    microphoneVolume,
    microphoneLevel,

    // 输出设备（扬声器）
    speakers,
    selectedSpeaker,

    // 本地视频音频（🎯 videoSources 已移除，现在直接从 allSources 获取）
    selectedVideoAudio,
    videoAudioEnabled,
    videoAudioVolume,
    videoAudioLevel,

    // 系统音频
    systemAudioEnabled,
    systemAudioVolume,

    // 方法
    refreshAudioDevices,
    startMicrophoneLevelMonitoring,
    stopMicrophoneMonitoring,
    toggleMicrophone,
    onMicrophoneChange,
    onMicrophoneVolumeChange,
    onSystemAudioVolumeChange,
    toggleSystemAudio,
    addVideoSource,
    removeVideoSource,
    toggleVideoAudio,
    onVideoAudioChange,
    onVideoAudioVolumeChange,

    // 音频路由方法
    selectSpeaker,
    setupAudioRouting,
    applyAudioRouting,
    getAudioRoutingConfig,

    cleanup
  };
}
