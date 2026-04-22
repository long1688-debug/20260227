import { defineStore } from 'pinia';
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getDefaultRecordingPath, saveSettings as saveSettingsToBackend, getSettings as getSettingsFromBackend } from '../utils/tauri-api.js';
import { open } from '@tauri-apps/plugin-dialog';

/**
 * 系统设置 Store
 * 管理录像设置、视频参数、直播参数等
 */
export const useSettingsStore = defineStore('settings', () => {
  // ==================== 状态 ====================
  
  // 对话框状态
  const showSettingsDialog = ref(false);
  const activeTab = ref('recording');
  
  // 自定义码率
  const customVideoBitrate = ref(3000);
  const customLiveBitrate = ref(2500);
  
  // 设置项
  const settings = ref({
    recordingPath: '',
    recordingFormat: 'mp4',
    autoSegment: false,
    videoResolution: '1080p',
    videoFrameRate: 30,
    videoBitrate: 4000,
    videoEncoder: 'h264',
    
    // RTMP 推流设置
    enableRtmp: false,
    rtmpUrl: '',
    rtmpStreamKey: ''
  });

  // ==================== 操作 ====================

  /**
   * 加载设置
   */
  const loadSettings = async (invoke) => {
    try {
      // 优先从后端加载持久化的设置
      let backendSettings = null;
      try {
        backendSettings = await getSettingsFromBackend();
        console.log('[设置] 从后端加载的设置:', backendSettings);
      } catch (backendError) {
        console.warn('[设置] 从后端加载失败，将使用本地存储:', backendError);
      }
      
      // 从 localStorage 加载
      const savedSettings = localStorage.getItem('teacher-settings');
      
      if (backendSettings && backendSettings.recording_path) {
        // 如果后端有保存的路径，优先使用
        settings.value.recordingPath = backendSettings.recording_path;
        console.log('[设置] 使用后端保存的路径:', backendSettings.recording_path);
      } else if (savedSettings) {
        // 否则使用 localStorage 中的设置
        settings.value = { ...settings.value, ...JSON.parse(savedSettings) };
        console.log('[设置] 使用本地存储的设置');
      } else {
        // 使用默认值
        try {
          const defaultPath = await getDefaultRecordingPath();
          if (defaultPath) {
            settings.value.recordingPath = defaultPath;
          }
        } catch (error) {
          console.warn('[设置] 无法获取默认路径:', error);
        }
      }
    } catch (error) {
      console.error('[设置] 加载失败:', error);
      ElMessage.warning('加载设置失败,使用默认值');
    }
  };

  /**
   * 保存设置
   */
  const saveSettings = async (invoke) => {
    try {
      const settingsToSave = { ...settings.value };
      if (settings.value.videoBitrate === 0) {
        settingsToSave.customVideoBitrate = customVideoBitrate.value;
      }
      if (settings.value.liveBitrate === 0) {
        settingsToSave.customLiveBitrate = customLiveBitrate.value;
      }
      
      // 保存到 localStorage
      localStorage.setItem('teacher-settings', JSON.stringify(settingsToSave));
      
      // 同时保存到后端（持久化存储）
      try {
        await saveSettingsToBackend({
          recording_path: settings.value.recordingPath,
          language: 'zh-CN',
          theme: 'dark'
        });
        console.log('[设置] 已保存到后端');
      } catch (backendError) {
        console.warn('[设置] 保存到后端失败，但已保存到本地:', backendError);
      }
      
      ElMessage.success('设置已保存');
      showSettingsDialog.value = false;
    } catch (error) {
      console.error('[设置] 保存失败:', error);
      ElMessage.error('保存设置失败');
    }
  };

  /**
   * 恢复默认设置
   */
  const resetSettings = async () => {
    try {
      settings.value = {
        recordingPath: settings.value.recordingPath, // 保留路径
        recordingFormat: 'mp4',
        autoSegment: false,
        videoResolution: '1080p',
        videoFrameRate: 30,
        videoBitrate: 4000,
        videoEncoder: 'h264',
        
        // RTMP 推流设置
        enableRtmp: false,
        rtmpUrl: '',
        rtmpStreamKey: ''
      };
      
      customVideoBitrate.value = 3000;
      
      ElMessage.success('已恢复默认设置');
    } catch (error) {
      console.error('[设置] 恢复失败:', error);
      ElMessage.error('恢复默认设置失败');
    }
  };

  /**
   * 更新单个设置项
   */
  const updateSetting = (key, value) => {
    if (key in settings.value) {
      settings.value[key] = value;
    }
  };

  /**
   * 选择录像路径
   */
  const selectRecordingPath = async () => {
    try {
      console.log('[设置] 开始选择路径...');
      
      // 使用 Tauri v2 原生 dialog API
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: settings.value.recordingPath || undefined,
        title: '选择录像文件存放位置'
      });
      
      console.log('[设置] 选择结果:', selected);
      console.log('[设置] 结果类型:', typeof selected);
      
      // 处理返回值
      if (selected) {
        let path = '';
        
        if (typeof selected === 'string') {
          path = selected;
          console.log('[设置] 结果是字符串路径:', path);
        } else if (selected && typeof selected === 'object') {
          if (selected.path) {
            path = selected.path;
            console.log('[设置] 从 selected.path 提取:', path);
          } else if (selected.url) {
            path = selected.url.replace('file://', '');
            console.log('[设置] 从 selected.url 提取:', path);
          } else {
            path = String(selected);
            console.log('[设置] 转换为字符串:', path);
          }
        }
        
        console.log('[设置] 最终提取的路径:', path);
        
        if (path && path !== 'null' && path !== 'undefined') {
          settings.value.recordingPath = path;
          console.log('[设置] 已更新 settings.recordingPath:', settings.value.recordingPath);
          ElMessage.success('路径已更新: ' + path);
        } else {
          console.warn('[设置] 路径为空或无效:', path);
          ElMessage.warning('未能获取有效的路径');
        }
      } else {
        console.log('[设置] 用户未选择任何路径');
        ElMessage.info('未选择文件夹');
      }
    } catch (error) {
      console.error('[设置] 选择路径异常:', error);
      
      if (error.message && error.message.includes('cancelled')) {
        console.log('[设置] 用户取消了路径选择');
        ElMessage.info('已取消选择');
      } else {
        ElMessage.error('选择路径失败: ' + (error.message || error));
      }
    }
  };

  /**
   * 重置录像路径
   */
  const resetRecordingPath = async () => {
    try {
      const defaultPath = await getDefaultRecordingPath();
      if (defaultPath) {
        settings.value.recordingPath = defaultPath;
        ElMessage.success('已恢复默认路径');
      }
    } catch (error) {
      console.error('[设置] 重置路径失败:', error);
      ElMessage.error('重置路径失败');
    }
  };

  /**
   * 获取实际使用的视频码率
   */
  const getActualVideoBitrate = () => {
    return settings.value.videoBitrate === 0 
      ? customVideoBitrate.value 
      : settings.value.videoBitrate;
  };

  /**
   * 获取分辨率尺寸
   */
  const getResolutionSize = (resolutionKey) => {
    const resolutions = {
      '4k': { width: 3840, height: 2160 },
      '2k': { width: 2560, height: 1440 },
      '1080p': { width: 1920, height: 1080 },
      '720p': { width: 1280, height: 720 }
    };
    return resolutions[resolutionKey] || resolutions['1080p'];
  };

  /**
   * 切换设置对话框
   */
  const toggleSettingsDialog = (visible) => {
    showSettingsDialog.value = visible ?? !showSettingsDialog.value;
  };

  /**
   * 设置活动标签页
   */
  const setActiveTab = (tab) => {
    activeTab.value = tab;
  };

  /**
   * 重置 store
   */
  const reset = () => {
    showSettingsDialog.value = false;
    activeTab.value = 'recording';
    customVideoBitrate.value = 3000;
    settings.value = {
      recordingPath: '',
      recordingFormat: 'mp4',
      autoSegment: false,
      videoResolution: '1080p',
      videoFrameRate: 30,
      videoBitrate: 4000,
      videoEncoder: 'h264',
      
      // RTMP 推流设置
      enableRtmp: false,
      rtmpUrl: '',
      rtmpStreamKey: ''
    };
  };

  return {
    // 状态
    showSettingsDialog,
    activeTab,
    customVideoBitrate,
    settings,
    
    // 操作
    loadSettings,
    saveSettings,
    resetSettings,
    updateSetting,
    selectRecordingPath,
    resetRecordingPath,
    getActualVideoBitrate,
    getResolutionSize,
    toggleSettingsDialog,
    setActiveTab,
    reset
  };
});
