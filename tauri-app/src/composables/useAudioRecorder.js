import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';

/**
 * 音频录制 Composable
 * 提供完整的音频录制功能，包括麦克风录制、系统音频录制和混音录制
 */
export function useAudioRecorder() {
  // 录制状态
  const isRecording = ref(false);
  const recordingDuration = ref(0);
  const recordingLevel = ref(0);
  
  // 录制配置
  const recordingConfig = ref({
    audioBitsPerSample: 16,
    sampleRate: 44100,
    numberOfChannels: 2,
    mimeType: 'audio/webm;codecs=opus'
  });
  
  // 媒体录制器
  let mediaRecorder = null;
  let audioChunks = [];
  let recordingInterval = null;
  let audioContext = null;
  let analyser = null;
  let microphoneStream = null;
  
  // 计算属性
  const formattedDuration = computed(() => {
    const seconds = Math.floor(recordingDuration.value);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  });
  
  /**
   * 获取可用的 MIME 类型
   */
  const getSupportedMimeType = () => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/wav'
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log('[AudioRecorder] 支持的 MIME 类型:', type);
        return type;
      }
    }
    
    console.warn('[AudioRecorder] 没有找到首选的 MIME 类型，使用默认');
    return '';
  };
  
  /**
   * 开始录制
   * @param {Object} options - 录制选项
   * @param {MediaStream} options.stream - 要录制的媒体流
   * @param {string} options.source - 录制来源 ('microphone', 'system', 'mixed')
   */
  const startRecording = async (options = {}) => {
    try {
      const { stream, source = 'microphone' } = options;
      
      // 如果没有传入流，获取麦克风流
      let targetStream = stream;
      if (!targetStream) {
        if (source === 'microphone') {
          targetStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
        } else if (source === 'mixed') {
          // 混音录制需要从 audioMixer 获取混合流
          const { audioMixer } = await import('@/utils/audioMixer');
          if (audioMixer.context) {
            const dest = audioMixer.context.createMediaStreamDestination();
            audioMixer.masterGain.connect(dest);
            targetStream = dest.stream;
          } else {
            ElMessage.warning('请先初始化音频混音器');
            return false;
          }
        }
      }
      
      if (!targetStream) {
        ElMessage.error('无法获取音频流');
        return false;
      }
      
      // 初始化音频分析器用于电平显示
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const sourceNode = audioContext.createMediaStreamSource(targetStream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      sourceNode.connect(analyser);
      
      // 创建媒体录制器
      const mimeType = recordingConfig.value.mimeType || getSupportedMimeType();
      
      try {
        mediaRecorder = new MediaRecorder(targetStream, { mimeType });
      } catch (e) {
        console.warn('[AudioRecorder] 指定 MIME 类型失败，使用默认:', e);
        mediaRecorder = new MediaRecorder(targetStream);
      }
      
      audioChunks = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        console.log('[AudioRecorder] 录制已停止');
      };
      
      mediaRecorder.onerror = (error) => {
        console.error('[AudioRecorder] 录制错误:', error);
        ElMessage.error('录制过程中发生错误');
      };
      
      // 开始录制
      mediaRecorder.start(100); // 每 100ms 收集一次数据
      isRecording.value = true;
      recordingDuration.value = 0;
      
      // 保存流引用
      microphoneStream = targetStream;
      
      // 开始计时和电平监控
      recordingInterval = setInterval(() => {
        recordingDuration.value++;
        updateRecordingLevel();
      }, 1000);
      
      ElMessage.success('开始录制音频');
      console.log('[AudioRecorder] 开始录制，来源:', source);
      return true;
      
    } catch (error) {
      console.error('[AudioRecorder] 开始录制失败:', error);
      ElMessage.error('无法开始录制: ' + error.message);
      return false;
    }
  };
  
  /**
   * 更新录制电平
   */
  const updateRecordingLevel = () => {
    if (!analyser) return;
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    recordingLevel.value = Math.round((average / 255) * 100);
  };
  
  /**
   * 停止录制
   * @returns {Promise<Blob>} 录制的音频 Blob
   */
  const stopRecording = async () => {
    return new Promise((resolve, reject) => {
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        console.warn('[AudioRecorder] 没有正在进行的录制');
        resolve(null);
        return;
      }
      
      mediaRecorder.onstop = async () => {
        try {
          // 创建 Blob
          const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
          
          // 清理资源
          cleanup();
          
          ElMessage.success('录制已完成');
          console.log('[AudioRecorder] 录制完成，时长:', formattedDuration.value);
          resolve(audioBlob);
        } catch (error) {
          console.error('[AudioRecorder] 处理录制数据失败:', error);
          reject(error);
        }
      };
      
      mediaRecorder.stop();
      isRecording.value = false;
    });
  };
  
  /**
   * 暂停录制
   */
  const pauseRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      isRecording.value = false;
      if (recordingInterval) {
        clearInterval(recordingInterval);
      }
      ElMessage.info('录制已暂停');
      console.log('[AudioRecorder] 录制已暂停');
    }
  };
  
  /**
   * 恢复录制
   */
  const resumeRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      isRecording.value = true;
      
      recordingInterval = setInterval(() => {
        recordingDuration.value++;
        updateRecordingLevel();
      }, 1000);
      
      ElMessage.info('录制已恢复');
      console.log('[AudioRecorder] 录制已恢复');
    }
  };
  
  /**
   * 下载录制的音频
   * @param {Blob} audioBlob - 音频 Blob
   * @param {string} filename - 文件名
   */
  const downloadRecording = (audioBlob, filename = 'recording.webm') => {
    if (!audioBlob) {
      ElMessage.error('没有可下载的录音');
      return;
    }
    
    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    ElMessage.success('录音已下载');
    console.log('[AudioRecorder] 录音已下载:', filename);
  };
  
  /**
   * 将录制的音频转换为 Base64
   * @param {Blob} audioBlob - 音频 Blob
   * @returns {Promise<string>} Base64 字符串
   */
  const blobToBase64 = (audioBlob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });
  };
  
  /**
   * 清理资源
   */
  const cleanup = () => {
    if (recordingInterval) {
      clearInterval(recordingInterval);
      recordingInterval = null;
    }
    
    if (microphoneStream) {
      microphoneStream.getTracks().forEach(track => track.stop());
      microphoneStream = null;
    }
    
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
    
    analyser = null;
    recordingLevel.value = 0;
  };
  
  return {
    // 状态
    isRecording,
    recordingDuration,
    recordingLevel,
    recordingConfig,
    
    // 计算属性
    formattedDuration,
    
    // 方法
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    downloadRecording,
    blobToBase64,
    cleanup
  };
}
