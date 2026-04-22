import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

/**
 * 媒体状态管理 Store
 * 管理视频源、画布块和音频选择
 */
export const useMediaStore = defineStore('media', () => {
  // 所有视频源 Map<sourceId, VideoSource>
  const sources = ref(new Map());

  // 画布上的视频块列表
  const tiles = ref([]);

  // 当前激活的音频源ID(用于整体输出切换)
  const activeAudioSourceId = ref(null);

  // ============================================
  // 计算属性
  // ============================================

  /**
   * 获取所有摄像头源
   */
  const cameraSources = computed(() => {
    return Array.from(sources.value.values()).filter(s => s.type === 'camera');
  });

  /**
   * 获取所有本地视频源
   */
  const localVideoSources = computed(() => {
    return Array.from(sources.value.values()).filter(s => s.type === 'local-file');
  });

  /**
   * 获取所有麦克风源
   */
  const microphoneSources = computed(() => {
    return Array.from(sources.value.values()).filter(s => s.type === 'microphone');
  });

  /**
   * 获取指定源的所有画布块
   */
  const getTilesBySource = (sourceId) => {
    return tiles.value.filter(t => t.sourceId === sourceId);
  };

  // ============================================
  // 源操作
  // ============================================

  /**
   * 添加视频源
   * @param {Object} source - 视频源对象
   */
  function addSource(source) {
    sources.value.set(source.id, source);
    console.log('[MediaStore] 添加源:', source.id, source.name);
  }

  /**
   * 更新视频源
   * @param {string} id - 源ID
   * @param {Object} updates - 更新字段
   */
  function updateSource(id, updates) {
    const source = sources.value.get(id);
    if (source) {
      Object.assign(source, updates);
      // 触发响应式更新
      sources.value = new Map(sources.value);
    }
  }

  /**
   * 移除视频源
   * @param {string} id - 源ID
   */
  function removeSource(id) {
    sources.value.delete(id);
    
    // 同时删除关联的所有 tiles
    tiles.value = tiles.value.filter(t => t.sourceId !== id);
    
    // 如果删除的是当前激活的音频源,清空激活状态
    if (activeAudioSourceId.value === id) {
      activeAudioSourceId.value = null;
    }
    
    console.log('[MediaStore] 移除源:', id);
  }

  // ============================================
  // Tile 操作
  // ============================================

  /**
   * 添加画布块
   * @param {Object} tile - 画布块对象
   */
  function addTile(tile) {
    tiles.value.push(tile);
    console.log('[MediaStore] 添加画布块:', tile.id);
  }

  /**
   * 更新画布块
   * @param {string} id - 画布块ID
   * @param {Object} updates - 更新字段
   */
  function updateTile(id, updates) {
    const tile = tiles.value.find(t => t.id === id);
    if (tile) {
      Object.assign(tile, updates);
      // 触发响应式更新
      tiles.value = [...tiles.value];
    }
  }

  /**
   * 移除画布块
   * @param {string} id - 画布块ID
   */
  function removeTile(id) {
    tiles.value = tiles.value.filter(t => t.id !== id);
    console.log('[MediaStore] 移除画布块:', id);
  }

  /**
   * 设置画布块为主音频
   * @param {string} tileId - 画布块ID
   * @param {string} sourceId - 源ID
   */
  function setTileMaster(tileId, sourceId) {
    // 先将同一 sourceId 下的所有 tile 设为非主音频
    tiles.value.forEach(t => {
      if (t.sourceId === sourceId) {
        t.isAudioMaster = false;
      }
    });

    // 再将指定 tile 设为主音频
    const tile = tiles.value.find(t => t.id === tileId);
    if (tile && tile.sourceId === sourceId) {
      tile.isAudioMaster = true;
      console.log('[MediaStore] 设置主音频:', tileId, sourceId);
    }

    // 触发响应式更新
    tiles.value = [...tiles.value];
  }

  // ============================================
  // 全局音频选择
  // ============================================

  /**
   * 设置激活的音频源
   * @param {string|null} sourceId - 源ID,null表示无音频输出
   */
  function setActiveAudioSource(sourceId) {
    activeAudioSourceId.value = sourceId;
    console.log('[MediaStore] 设置激活音频源:', sourceId);
  }

  return {
    // State
    sources,
    tiles,
    activeAudioSourceId,

    // Getters
    cameraSources,
    localVideoSources,
    microphoneSources,
    getTilesBySource,

    // Actions
    addSource,
    updateSource,
    removeSource,
    addTile,
    updateTile,
    removeTile,
    setTileMaster,
    setActiveAudioSource
  };
});
