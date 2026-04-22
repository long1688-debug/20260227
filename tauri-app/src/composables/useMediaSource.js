import { ref, computed } from 'vue';
import { useMediaStore } from '@/stores/mediaStore';
import { audioMixer } from '@/utils/audioMixer';
import { ElMessage } from 'element-plus';

/**
 * 媒体源管理 Composable
 * 处理摄像头和本地视频的添加、播放控制
 */
export function useMediaSource() {
  const mediaStore = useMediaStore();
  
  /**
   * 添加摄像头源
   * @returns {Promise<Object|null>} 视频源对象或null
   */
  const addCameraSource = async () => {
    try {
      // 请求摄像头和麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      const id = `camera-${Date.now()}`;
      const source = {
        id,
        type: 'camera',
        name: `摄像头 ${mediaStore.cameraSources.length + 1}`,
        stream,
        duration: Infinity,
        currentTime: 0,
        isPlaying: true,
        volume: 1,
        muted: false
      };

      // 注册音频流到混音器
      await audioMixer.resume();
      audioMixer.registerStream(id, stream);
      
      // 添加到store
      mediaStore.addSource(source);
      
      ElMessage.success('摄像头已添加');
      return source;
    } catch (error) {
      console.error('[useMediaSource] 无法访问摄像头:', error);
      ElMessage.error('无法访问摄像头，请检查权限设置');
      return null;
    }
  };

  /**
   * 添加本地视频源
   * @param {File} file - 视频文件
   * @returns {Promise<Object|null>} 视频源对象或null
   */
  const addLocalVideoSource = async (file) => {
    try {
      const objectUrl = URL.createObjectURL(file);
      
      // 创建临时视频元素获取元数据
      const videoEl = document.createElement('video');
      videoEl.src = objectUrl;
      
      await new Promise((resolve, reject) => {
        videoEl.onloadedmetadata = () => resolve();
        videoEl.onerror = () => reject(new Error('无法加载视频文件'));
      });

      const id = `local-${file.name}-${Date.now()}`;
      const source = {
        id,
        type: 'localVideo',
        name: file.name,
        file,
        objectUrl,
        duration: videoEl.duration,
        currentTime: 0,
        isPlaying: false,
        volume: 100,
        muted: false,
        audioEnabled: true  // 本地视频默认启用音频
      };

      // 添加到store
      mediaStore.addSource(source);
      
      ElMessage.success('视频已添加');
      return source;
    } catch (error) {
      console.error('[useMediaSource] 添加本地视频失败:', error);
      ElMessage.error('添加视频失败: ' + error.message);
      return null;
    }
  };

  /**
   * 切换播放/暂停状态
   * @param {string} sourceId - 源ID
   */
  const togglePlayPause = (sourceId) => {
    const source = mediaStore.sources.get(sourceId);
    if (source) {
      mediaStore.updateSource(sourceId, { 
        isPlaying: !source.isPlaying 
      });
    }
  };

  /**
   * 跳转到指定时间
   * @param {string} sourceId - 源ID
   * @param {number} time - 时间(秒)
   */
  const seek = (sourceId, time) => {
    const source = mediaStore.sources.get(sourceId);
    if (source && time >= 0 && time <= source.duration) {
      mediaStore.updateSource(sourceId, { currentTime: time });
    }
  };

  /**
   * 移除视频源
   * @param {string} sourceId - 源ID
   */
  const removeSource = (sourceId) => {
    const source = mediaStore.sources.get(sourceId);
    
    // 清理资源
    if (source) {
      // 停止媒体流
      if (source.stream) {
        source.stream.getTracks().forEach(track => track.stop());
      }
      
      // 释放Object URL
      if (source.objectUrl) {
        URL.revokeObjectURL(source.objectUrl);
      }
      
      // 断开音频连接
      audioMixer.disconnectSource(sourceId);
      
      // 从store中移除
      mediaStore.removeSource(sourceId);
      
      ElMessage.info('视频源已移除');
    }
  };

  return {
    addCameraSource,
    addLocalVideoSource,
    togglePlayPause,
    seek,
    removeSource
  };
}
