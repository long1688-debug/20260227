import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { SOURCE_TYPES, DEFAULT_SOURCE_CONFIG, generateSourceId } from '@/constants/canvasSourceTypes';

/**
 * 自由布局画布 Store
 * 管理画布上所有信号源的状态和交互
 */
export const useCanvasStore = defineStore('canvas', () => {
  // 画布上的所有信号源
  const sources = ref([]);
  
  // 当前选中的信号源ID
  const selectedSourceId = ref(null);
  
  // 是否处于编辑模式
  const isEditMode = ref(false);
  
  // 画布缩放比例
  const canvasScale = ref(1);
  
  // 画布偏移量
  const canvasOffset = ref({ x: 0, y: 0 });

  // ============================================
  // 计算属性
  // ============================================
  
  /**
   * 按层级排序的信号源列表
   */
  const sortedSources = computed(() => {
    return [...sources.value].sort((a, b) => a.zIndex - b.zIndex);
  });
  
  /**
   * 当前选中的信号源
   */
  const selectedSource = computed(() => {
    return sources.value.find(s => s.id === selectedSourceId.value) || null;
  });
  
  /**
   * 可见的信号源列表
   */
  const visibleSources = computed(() => {
    return sources.value.filter(s => s.visible);
  });

  // ============================================
  // 核心方法
  // ============================================
  
  /**
   * 添加信号源
   */
  function addSource(type, properties = {}) {
    const id = generateSourceId();
    
    // 根据类型设置特定的默认属性
    let typeSpecificDefaults = {};
    switch (type) {
      case SOURCE_TYPES.WEBPAGE:
        // 网页类型不设置默认URL,避免加载无效地址
        typeSpecificDefaults = {
          properties: {
            url: '' // 空字符串,需要用户手动配置
          }
        };
        break;
      case SOURCE_TYPES.VIDEO:
        typeSpecificDefaults = {
          properties: {
            src: '',
            autoplay: true,
            loop: false,
            muted: true
          }
        };
        break;
      case SOURCE_TYPES.IMAGE:
        typeSpecificDefaults = {
          properties: {
            src: '',
            fit: 'contain'
          }
        };
        break;
      case SOURCE_TYPES.TEXT:
        typeSpecificDefaults = {
          properties: {
            content: '双击编辑文本',
            fontSize: 16,
            color: '#ffffff',
            fontFamily: 'Arial, sans-serif',
            textAlign: 'left'
          }
        };
        break;
      case SOURCE_TYPES.PPT:
      case SOURCE_TYPES.WORD:
      case SOURCE_TYPES.PDF:
        // 文档类型
        typeSpecificDefaults = {
          properties: {
            url: '',
            file: null
          }
        };
        break;
      case SOURCE_TYPES.CAMERA:
        typeSpecificDefaults = {
          properties: {
            deviceId: '',
            facingMode: 'user'
          }
        };
        break;
      default:
        typeSpecificDefaults = { properties: {} };
    }
    
    const newSource = {
      id,
      type,
      name: `${getSourceTypeName(type)} ${sources.value.length + 1}`,
      ...DEFAULT_SOURCE_CONFIG,
      ...typeSpecificDefaults,
      ...properties,
      zIndex: sources.value.length + 1
    };
    
    sources.value.push(newSource);
    selectSource(id);
    
    console.log(`[Canvas] 添加信号源: ${newSource.name} (${type})`);
    return newSource;
  }
  
  /**
   * 删除信号源
   */
  function removeSource(sourceId) {
    const index = sources.value.findIndex(s => s.id === sourceId);
    if (index !== -1) {
      const removed = sources.value.splice(index, 1)[0];
      
      // 如果删除的是选中的信号源,清除选中状态
      if (selectedSourceId.value === sourceId) {
        selectedSourceId.value = null;
      }
      
      // 重新调整后续信号源的zIndex
      sources.value.forEach(s => {
        if (s.zIndex > removed.zIndex) {
          s.zIndex--;
        }
      });
      
      console.log(`[Canvas] 删除信号源: ${removed.name}`);
      return true;
    }
    return false;
  }
  
  /**
   * 更新信号源属性
   */
  function updateSource(sourceId, updates) {
    const source = sources.value.find(s => s.id === sourceId);
    if (source) {
      Object.assign(source, updates);
      return true;
    }
    return false;
  }
  
  /**
   * 选中信号源
   */
  function selectSource(sourceId) {
    selectedSourceId.value = sourceId;
  }
  
  /**
   * 取消选中
   */
  function deselectSource() {
    selectedSourceId.value = null;
  }
  
  /**
   * 切换信号源可见性
   */
  function toggleSourceVisibility(sourceId) {
    const source = sources.value.find(s => s.id === sourceId);
    if (source) {
      source.visible = !source.visible;
      return source.visible;
    }
    return false;
  }
  
  /**
   * 切换信号源锁定状态
   */
  function toggleSourceLock(sourceId) {
    const source = sources.value.find(s => s.id === sourceId);
    if (source) {
      source.locked = !source.locked;
      return source.locked;
    }
    return false;
  }

  // ============================================
  // 层级管理
  // ============================================
  
  /**
   * 上移一层
   */
  function moveUpLayer(sourceId) {
    const source = sources.value.find(s => s.id === sourceId);
    if (!source) return false;
    
    const maxZIndex = Math.max(...sources.value.map(s => s.zIndex));
    if (source.zIndex < maxZIndex) {
      source.zIndex++;
      return true;
    }
    return false;
  }
  
  /**
   * 下移一层
   */
  function moveDownLayer(sourceId) {
    const source = sources.value.find(s => s.id === sourceId);
    if (!source) return false;
    
    if (source.zIndex > 1) {
      source.zIndex--;
      return true;
    }
    return false;
  }
  
  /**
   * 置顶
   */
  function bringToFront(sourceId) {
    const source = sources.value.find(s => s.id === sourceId);
    if (!source) return false;
    
    const maxZIndex = Math.max(...sources.value.map(s => s.zIndex));
    source.zIndex = maxZIndex + 1;
    return true;
  }
  
  /**
   * 置底
   */
  function sendToBack(sourceId) {
    const source = sources.value.find(s => s.id === sourceId);
    if (!source) return false;
    
    const minZIndex = Math.min(...sources.value.map(s => s.zIndex));
    source.zIndex = minZIndex - 1;
    return true;
  }

  // ============================================
  // 变换操作
  // ============================================
  
  /**
   * 移动信号源
   */
  function moveSource(sourceId, deltaX, deltaY) {
    const source = sources.value.find(s => s.id === sourceId);
    if (!source || source.locked) return false;
    
    source.x += deltaX;
    source.y += deltaY;
    
    // 边界检查
    source.x = Math.max(0, Math.min(100 - source.width, source.x));
    source.y = Math.max(0, Math.min(100 - source.height, source.y));
    
    return true;
  }
  
  /**
   * 调整信号源大小
   */
  function resizeSource(sourceId, deltaWidth, deltaHeight) {
    const source = sources.value.find(s => s.id === sourceId);
    if (!source || source.locked) return false;
    
    source.width += deltaWidth;
    source.height += deltaHeight;
    
    // 最小尺寸限制
    source.width = Math.max(5, Math.min(100 - source.x, source.width));
    source.height = Math.max(5, Math.min(100 - source.y, source.height));
    
    return true;
  }
  
  /**
   * 旋转信号源
   */
  function rotateSource(sourceId, deltaRotation) {
    const source = sources.value.find(s => s.id === sourceId);
    if (!source || source.locked) return false;
    
    source.rotation = (source.rotation + deltaRotation) % 360;
    return true;
  }

  // ============================================
  // 滤镜管理
  // ============================================
  
  /**
   * 更新滤镜参数
   */
  function updateFilter(sourceId, filterKey, value) {
    const source = sources.value.find(s => s.id === sourceId);
    if (!source || !source.filters) return false;
    
    source.filters[filterKey] = value;
    return true;
  }
  
  /**
   * 重置滤镜
   */
  function resetFilters(sourceId) {
    const source = sources.value.find(s => s.id === sourceId);
    if (!source) return false;
    
    source.filters = { ...DEFAULT_SOURCE_CONFIG.filters };
    return true;
  }
  
  /**
   * 获取CSS滤镜字符串
   */
  function getFilterCSS(sourceId) {
    const source = sources.value.find(s => s.id === sourceId);
    if (!source || !source.filters) return '';
    
    const { brightness, contrast, saturate, blur, grayscale, sepia, hueRotate } = source.filters;
    return `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) blur(${blur}px) grayscale(${grayscale}%) sepia(${sepia}%) hue-rotate(${hueRotate}deg)`;
  }

  // ============================================
  // 工具方法
  // ============================================
  
  /**
   * 清空画布
   */
  function clearCanvas() {
    sources.value = [];
    selectedSourceId.value = null;
    console.log('[Canvas] 画布已清空');
  }
  
  /**
   * 导出画布配置
   */
  function exportCanvasConfig() {
    return {
      sources: sources.value,
      scale: canvasScale.value,
      offset: canvasOffset.value
    };
  }
  
  /**
   * 导入画布配置
   */
  function importCanvasConfig(config) {
    if (config.sources && Array.isArray(config.sources)) {
      sources.value = config.sources;
      canvasScale.value = config.scale || 1;
      canvasOffset.value = config.offset || { x: 0, y: 0 };
      return true;
    }
    return false;
  }
  
  /**
   * 获取信号源类型名称
   */
  function getSourceTypeName(type) {
    const typeNames = {
      [SOURCE_TYPES.VIDEO]: '视频',
      [SOURCE_TYPES.TEXT]: '文字',
      [SOURCE_TYPES.IMAGE]: '图片',
      [SOURCE_TYPES.WEBPAGE]: '网页',
      [SOURCE_TYPES.PPT]: 'PPT',
      [SOURCE_TYPES.WORD]: 'Word',
      [SOURCE_TYPES.PDF]: 'PDF',
      [SOURCE_TYPES.MINDMAP]: '思维导图',
      [SOURCE_TYPES.REMOTE_DESKTOP]: '远程桌面',
      [SOURCE_TYPES.CAMERA]: '摄像机'
    };
    return typeNames[type] || '未知';
  }

  return {
    // 状态
    sources,
    selectedSourceId,
    selectedSource,
    isEditMode,
    canvasScale,
    canvasOffset,
    sortedSources,
    visibleSources,
    
    // 核心方法
    addSource,
    removeSource,
    updateSource,
    selectSource,
    deselectSource,
    toggleSourceVisibility,
    toggleSourceLock,
    
    // 层级管理
    moveUpLayer,
    moveDownLayer,
    bringToFront,
    sendToBack,
    
    // 变换操作
    moveSource,
    resizeSource,
    rotateSource,
    
    // 滤镜管理
    updateFilter,
    resetFilters,
    getFilterCSS,
    
    // 工具方法
    clearCanvas,
    exportCanvasConfig,
    importCanvasConfig,
    getSourceTypeName
  };
});
