import { ref } from 'vue';
import { audioMixer } from '@/utils/audioMixer';
import { ElMessage } from 'element-plus';

/**
 * 麦克风管理 Composable
 * 处理麦克风的开启、关闭和音频路由
 */
export function useMicrophone() {
  const micStream = ref(null);
  const isMicEnabled = ref(false);

  /**
   * 启动麦克风
   * @returns {Promise<boolean>} 是否成功
   */
  const startMicrophone = async () => {
    try {
      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      micStream.value = stream;
      isMicEnabled.value = true;
      
      // 初始化AudioContext并注册流
      await audioMixer.resume();
      audioMixer.registerStream('microphone', stream);
      
      ElMessage.success('麦克风已开启');
      return true;
    } catch (error) {
      console.error('[useMicrophone] 无法访问麦克风:', error);
      ElMessage.error('无法访问麦克风，请检查权限设置');
      return false;
    }
  };

  /**
   * 停止麦克风
   */
  const stopMicrophone = () => {
    if (micStream.value) {
      // 停止所有音轨
      micStream.value.getTracks().forEach(track => track.stop());
      
      // 断开音频连接
      audioMixer.disconnectSource('microphone');
      
      micStream.value = null;
      isMicEnabled.value = false;
      
      ElMessage.info('麦克风已关闭');
    }
  };

  /**
   * 切换麦克风状态
   */
  const toggleMicrophone = async () => {
    if (isMicEnabled.value) {
      stopMicrophone();
    } else {
      await startMicrophone();
    }
  };

  return {
    micStream,
    isMicEnabled,
    startMicrophone,
    stopMicrophone,
    toggleMicrophone
  };
}
