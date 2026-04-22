import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { getDefaultRecordingPath, saveSettings as saveSettingsToBackend, getSettings as getSettingsFromBackend } from '../utils/tauri-api.js';
import { open } from '@tauri-apps/plugin-dialog';

/**
 * 设置管理 Composable
 * 处理录像设置、视频参数、直播参数等系统设置
 */
export function useSettings() {
  // 设置对话框状态
  const showSettingsDialog = ref(false);
  const settingsActiveTab = ref('recording');

  // 自定义码率
  const customVideoBitrate = ref(3000);

  // 设置项
  const settings = ref({
    recordingPath: '',
    recordingFormat: 'mp4',
    autoSegment: false,
    videoResolution: '1080p',
    videoFrameRate: 30,
    videoBitrate: 4000,
    videoEncoder: 'h264',
    audioSource: 'mic',
    enableNoiseReduction: true,
    enableAudioMonitoring: true,
    audioMixRatio: 50,
    
    // RTMP 推流设置
    enableRtmp: false,
    rtmpUrl: '',
    rtmpStreamKey: ''
  });

  // 设置项验证规则
  const settingRules = {
    recordingPath: [{ required: true, message: '请选择录像路径', trigger: 'change' }],
    recordingFormat: [{ required: true, message: '请选择格式', trigger: 'change' }],
    videoResolution: [{ required: true, message: '请选择分辨率', trigger: 'change' }],
    videoFrameRate: [{ required: true, message: '请选择帧率', trigger: 'change' }],
    videoBitrate: [{ required: true, message: '请选择码率', trigger: 'change' }],
    liveResolution: [{ required: true, message: '请选择分辨率', trigger: 'change' }],
    liveFrameRate: [{ required: true, message: '请选择帧率', trigger: 'change' }],
    liveBitrate: [{ required: true, message: '请选择码率', trigger: 'change' }]
  };

  /**
   * 加载设置
   */
  const loadSettings = async () => {
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
          // 🎯 修复：确保 defaultPath 是有效的字符串
          if (typeof defaultPath === 'string' && defaultPath) {
            settings.value.recordingPath = defaultPath;
          } else {
            // 浏览器环境下使用默认路径
            settings.value.recordingPath = 'C:/Recordings';
          }
        } catch (error) {
          console.warn('[设置] 无法获取默认录制路径:', error);
          settings.value.recordingPath = 'C:/Recordings';
        }
      }
    } catch (error) {
      console.error('[设置] 加载设置失败:', error);
      ElMessage.warning('加载设置失败,使用默认值');
    }
  };

  /**
   * 选择录像路径
   */
  const selectRecordingPath = async () => {
    try {
      console.log('[设置] ========== 开始选择路径 ==========');
      console.log('[设置] 选择前的 recordingPath:', settings.value.recordingPath);
      
      // 使用 Tauri v2 原生 dialog API
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: settings.value.recordingPath || undefined,
        title: '选择录像文件存放位置'
      });
      
      console.log('[设置] 对话框返回结果:', selected);
      console.log('[设置] 结果类型:', typeof selected);
      console.log('[设置] 结果是否为null:', selected === null);
      console.log('[设置] 结果是否为undefined:', selected === undefined);
      console.log('[设置] JSON.stringify(selected):', JSON.stringify(selected));
      
      // 处理返回值
      if (selected !== null && selected !== undefined) {
        console.log('[设置] 结果不为空，开始提取路径...');
        
        let path = '';
        
        // selected 可能是字符串或 FilePath 对象
        if (typeof selected === 'string') {
          path = selected;
          console.log('[设置] ✅ 结果是字符串路径:', path);
        } else if (selected && typeof selected === 'object') {
          // 如果是对象，尝试提取路径
          console.log('[设置] 结果是对象，keys:', Object.keys(selected));
          
          if (selected.path) {
            path = selected.path;
            console.log('[设置] ✅ 从 selected.path 提取:', path);
          } else if (selected.url) {
            path = selected.url.replace('file://', '');
            console.log('[设置] ✅ 从 selected.url 提取:', path);
          } else {
            path = String(selected);
            console.log('[设置] ⚠️ 转换为字符串:', path);
          }
        } else {
          console.log('[设置] ⚠️ 未知类型:', typeof selected);
          path = String(selected);
        }
        
        console.log('[设置] 最终提取的路径:', path);
        console.log('[设置] 路径长度:', path.length);
        
        if (path && path !== 'null' && path !== 'undefined' && path.trim() !== '') {
          console.log('[设置] 路径有效，准备更新...');
          settings.value.recordingPath = path;
          console.log('[设置] ✅ 已更新 settings.recordingPath:', settings.value.recordingPath);
          console.log('[设置] 更新后完整 settings.value:', settings.value);
          ElMessage.success('路径已更新: ' + path);
          console.log('[设置] ========== 路径选择完成 ==========');
        } else {
          console.warn('[设置] ❌ 路径为空或无效:', path);
          ElMessage.warning('未能获取有效的路径');
        }
      } else {
        console.log('[设置] ℹ️ 用户未选择任何路径');
        ElMessage.info('未选择文件夹');
      }
    } catch (error) {
      console.error('[设置] ❌ 选择路径异常:', error);
      console.error('[设置] 错误堆栈:', error.stack);
      
      if (error.message && error.message.includes('cancelled')) {
        console.log('[设置] ℹ️ 用户取消了路径选择');
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
      // 🎯 修复：确保 defaultPath 是有效的字符串
      if (typeof defaultPath === 'string' && defaultPath) {
        settings.value.recordingPath = defaultPath;
        ElMessage.success('已重置为默认路径');
      } else {
        settings.value.recordingPath = 'C:/Recordings';
        ElMessage.success('已重置为默认路径');
      }
    } catch (error) {
      console.error('[设置] 重置路径失败:', error);
      settings.value.recordingPath = 'C:/Recordings';
      ElMessage.error('重置路径失败，已使用默认路径');
    }
  };

  /**
   * 保存设置
   */
  const saveSettings = async () => {
    try {
      console.log('[保存] ========== 开始保存设置 ==========');
      console.log('[保存] 当前 recordingPath:', settings.value.recordingPath);
      console.log('[保存] recordingPath 类型:', typeof settings.value.recordingPath);
      console.log('[保存] recordingPath 长度:', settings.value.recordingPath ? settings.value.recordingPath.length : 0);
      console.log('[保存] 完整 settings.value:', JSON.parse(JSON.stringify(settings.value)));
      
      // 验证路径是否有效
      if (!settings.value.recordingPath || settings.value.recordingPath.trim() === '') {
        console.error('[保存] ❌ 路径为空，无法保存');
        ElMessage.warning('请先选择录像文件存放位置');
        return;
      }
      
      console.log('[保存] ✅ 路径验证通过，开始保存...');
      
      // 保存到 localStorage
      localStorage.setItem('teacher-settings', JSON.stringify(settings.value));
      console.log('[保存] ✅ 已保存到 localStorage');
      
      // 同时保存到后端（持久化存储）
      try {
        const settingsData = {
          recording_path: settings.value.recordingPath,
          language: 'zh-CN',
          theme: 'dark'
        };
        console.log('[保存] 准备保存到后端的数据:', settingsData);
        console.log('[保存] recording_path 值:', settingsData.recording_path);
        
        await saveSettingsToBackend(settingsData);
        console.log('[保存] ✅ 已保存到后端');
      } catch (backendError) {
        console.error('[保存] ❌ 保存到后端失败:', backendError);
        console.error('[保存] 后端错误类型:', typeof backendError);
        console.error('[保存] 后端错误信息:', backendError.message || backendError);
        ElMessage.error('保存到后端失败: ' + (backendError.message || backendError));
        return;
      }
      
      ElMessage.success('设置已保存');
      showSettingsDialog.value = false;
      console.log('[保存] ========== 保存完成 ==========');
    } catch (error) {
      console.error('[保存] ❌ 保存设置失败:', error);
      ElMessage.error('保存设置失败');
    }
  };

  /**
   * 恢复默认设置
   */
  const resetAllSettings = async () => {
    try {
      // 重置为默认值
      settings.value = {
        recordingPath: settings.value.recordingPath, // 保留路径设置
        recordingFormat: 'mp4',
        autoSegment: false,
        videoResolution: '1080p',
        videoFrameRate: 30,
        videoBitrate: 4000,
        videoEncoder: 'h264',
        audioSource: 'mic',
        enableNoiseReduction: true,
        enableAudioMonitoring: true,
        audioMixRatio: 50,
        
        // RTMP 推流设置
        enableRtmp: false,
        rtmpUrl: '',
        rtmpStreamKey: ''
      };

      customVideoBitrate.value = 3000;

      ElMessage.success('已恢复默认设置');
    } catch (error) {
      console.error('[设置] 恢复默认设置失败:', error);
      ElMessage.error('恢复默认设置失败');
    }
  };

  /**
   * 获取实际使用的视频码率
   */
  const getActualVideoBitrate = () => {
    if (settings.value.videoBitrate === 0) {
      return customVideoBitrate.value;
    }
    return settings.value.videoBitrate;
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

  return {
    // 状态
    showSettingsDialog,
    settingsActiveTab,
    customVideoBitrate,
    settings,
    settingRules,

    // 方法
    loadSettings,
    selectRecordingPath,
    resetRecordingPath,
    saveSettings,
    resetAllSettings,
    getActualVideoBitrate,
    getResolutionSize
  };
}
