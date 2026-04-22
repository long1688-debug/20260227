import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';

/**
 * 录制管理 Store
 * 管理录制状态、录制文件列表、回放等
 */
export const useRecordingStore = defineStore('recording', () => {
  // ==================== 状态 ====================

  // 录制文件列表
  const recordings = ref([]);

  // 筛选条件
  const filter = ref('all');

  // 对话框状态
  const showRecordingDialog = ref(false);
  const showPlaybackDialog = ref(false);
  const playbackVideoRef = ref(null);

  // 当前播放的录制
  const currentPlayback = ref(null);

  // ==================== 计算属性 ====================

  /**
   * 筛选后的录制列表
   */
  const filteredRecordings = computed(() => {
    if (filter.value === 'all') {
      return recordings.value;
    }
    return recordings.value.filter(r => r.type === filter.value);
  });

  // ==================== 操作 ====================

  /**
   * 加载录制列表
   */
  const loadRecordings = async (apiService) => {
    try {
      // TODO: 从 API 加载
      const result = await apiService.getRecordings(filter.value);
      if (result.success) {
        recordings.value = result.data || [];
        ElMessage.success('录制列表已刷新');
      }
    } catch (error) {
      console.error('[录制] 加载失败:', error);
      ElMessage.error('加载录制列表失败');
    }
  };

  /**
   * 添加录制记录
   */
  const addRecording = (recording) => {
    recordings.value.unshift(recording);
  };

  /**
   * 删除录制文件
   */
  const removeRecording = async (id, apiService) => {
    try {
      // TODO: API 删除
      recordings.value = recordings.value.filter(r => r.id !== id);
      ElMessage.success('删除成功');
    } catch (error) {
      console.error('[录制] 删除失败:', error);
      ElMessage.error('删除失败');
      throw error;
    }
  };

  /**
   * 设置筛选条件
   */
  const setFilter = (newFilter) => {
    filter.value = newFilter;
  };

  /**
   * 播放录制文件
   */
  const playRecording = async (recording) => {
    try {
      currentPlayback.value = recording;
      showPlaybackDialog.value = true;

      // 等待 DOM 更新后播放
      await new Promise(resolve => setTimeout(resolve, 100));

      if (playbackVideoRef.value) {
        playbackVideoRef.value.src = recording.url || `/static/recordings/${recording.name}`;
        await playbackVideoRef.value.play().catch(err => {
          console.warn('[录制] 自动播放被阻止:', err);
          ElMessage.info('请点击视频播放按钮开始播放');
        });
      }
    } catch (error) {
      console.error('[录制] 播放失败:', error);
      ElMessage.error('播放失败');
    }
  };

  /**
   * 导出录制文件
   */
  const exportRecording = async (recording) => {
    try {
      const a = document.createElement('a');
      a.href = recording.url || `/static/recordings/${recording.name}`;
      a.download = recording.name;
      a.click();
      ElMessage.success('导出成功');
    } catch (error) {
      console.error('[录制] 导出失败:', error);
      ElMessage.error('导出失败');
    }
  };

  /**
   * 切换录制对话框显示
   */
  const toggleRecordingDialog = (visible) => {
    showRecordingDialog.value = visible ?? !showRecordingDialog.value;
  };

  /**
   * 切换回放对话框显示
   */
  const togglePlaybackDialog = (visible) => {
    showPlaybackDialog.value = visible ?? !showPlaybackDialog.value;
    if (!showPlaybackDialog.value) {
      currentPlayback.value = null;
    }
  };

  /**
   * 重置 store
   */
  const reset = () => {
    recordings.value = [];
    filter.value = 'all';
    showRecordingDialog.value = false;
    showPlaybackDialog.value = false;
    currentPlayback.value = null;
  };

  return {
    // 状态
    recordings,
    filter,
    showRecordingDialog,
    showPlaybackDialog,
    playbackVideoRef,
    currentPlayback,

    // 计算属性
    filteredRecordings,

    // 操作
    loadRecordings,
    addRecording,
    removeRecording,
    setFilter,
    playRecording,
    exportRecording,
    toggleRecordingDialog,
    togglePlaybackDialog,
    reset
  };
});
