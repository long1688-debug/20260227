<template>
  <div class="render-engine-wrapper" ref="containerRef">
    <canvas
      ref="canvasRef"
      class="render-canvas"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
    ></canvas>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <span class="loading-text">{{ loadingText }}</span>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-overlay">
      <span class="error-icon">⚠️</span>
      <span class="error-text">{{ error }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, shallowRef } from 'vue';
import {
  RenderEngine,
  RenderCanvas,
  RenderLayout,
  LayoutFactory,
  RenderBox,
  SourceFactory,
  SOURCE_TYPES
} from '../../render';

const props = defineProps({
  sources: {
    type: Array,
    default: () => []
  },
  layoutType: {
    type: String,
    default: 'single'
  },
  width: {
    type: Number,
    default: 1920
  },
  height: {
    type: Number,
    default: 1080
  },
  autoStart: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits([
  'ready',
  'error',
  'source-ready',
  'source-error',
  'layout-change',
  'element-click'
]);

// Refs
const containerRef = ref(null);
const canvasRef = ref(null);

// State
const isLoading = ref(true);
const loadingText = ref('初始化渲染引擎...');
const error = ref(null);
const actualWidth = ref(props.width);
const actualHeight = ref(props.height);

// 渲染引擎实例
const renderEngine = shallowRef(null);
const renderCanvas = shallowRef(null);
const currentLayout = shallowRef(null);
const renderBoxes = ref([]);
const sourceMap = ref(new Map());

// 获取容器尺寸
const getContainerSize = () => {
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }
  return { width: props.width, height: props.height };
};

// 更新实际尺寸（优先使用传入的props尺寸）
const updateActualSize = () => {
  const size = getContainerSize();
  // 🎯 优先使用props传入的尺寸，确保与父组件一致
  actualWidth.value = props.width > 0 ? props.width : size.width;
  actualHeight.value = props.height > 0 ? props.height : size.height;
};

// 初始化渲染引擎
const initEngine = async () => {
  try {
    if (!canvasRef.value) {
      throw new Error('画布元素不存在');
    }

    // 获取容器实际尺寸
    updateActualSize();

    // 设置画布尺寸 - 使用设备像素比以获得更清晰的渲染
    const dpr = window.devicePixelRatio || 1;
    canvasRef.value.width = actualWidth.value * dpr;
    canvasRef.value.height = actualHeight.value * dpr;
    canvasRef.value.style.width = actualWidth.value + 'px';
    canvasRef.value.style.height = actualHeight.value + 'px';

    // 初始化渲染引擎
    renderEngine.value = new RenderEngine({
      width: actualWidth.value,
      height: actualHeight.value,
      fps: 60
    });
    renderEngine.value.init(canvasRef.value);

    // 初始化渲染画布
    renderCanvas.value = new RenderCanvas({
      width: actualWidth.value,
      height: actualHeight.value
    });
    // 传入逻辑尺寸（未乘以dpr）用于布局计算
    renderCanvas.value.init(canvasRef.value, actualWidth.value, actualHeight.value);

    console.log('[RenderEngineWrapper] 画布尺寸:', {
      canvasWidth: canvasRef.value.width,
      canvasHeight: canvasRef.value.height,
      styleWidth: canvasRef.value.style.width,
      styleHeight: canvasRef.value.style.height,
      propsWidth: props.width,
      propsHeight: props.height,
      containerRect: containerRef.value?.getBoundingClientRect()
    });

    // 设置画布缩放以匹配设备像素比
    const ctx = canvasRef.value.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    // 设置布局
    await setLayout(props.layoutType);

    // 注册渲染回调
    renderEngine.value.on('render', (context) => {
      const currentLayout = renderCanvas.value.getLayout(renderCanvas.value._currentLayout);
      if (currentLayout) {
        renderCanvas.value.draw(context);
      }
    });

    // 注册 Overlay 回调，确保布局边框/网格在渲染后始终绘制
    renderEngine.value.on('drawOverlay', (context) => {
      const currentLayout = renderCanvas.value.getLayout(renderCanvas.value._currentLayout);
      if (currentLayout && currentLayout.drawOverlay) {
        currentLayout.drawOverlay(context);
      }
    });

    // 加载数据源
    await loadSources();

    // 启动渲染引擎
    renderEngine.value.start();

    isLoading.value = false;
    emit('ready');

    console.log('[RenderEngineWrapper] 渲染引擎初始化完成');
  } catch (err) {
    error.value = err.message;
    emit('error', { error: err });
    console.error('[RenderEngineWrapper] 初始化失败:', err);
  }
};

// 设置布局
const setLayout = async (layoutType) => {
  try {
    loadingText.value = '设置布局...';

    //  修复：创建布局时指定gap和padding，确保网格铺满整个区域
    currentLayout.value = LayoutFactory.create(layoutType, {
      id: `layout-${Date.now()}`,
      name: getLayoutName(layoutType),
      gap: 0,        // 🎯 修复：网格间距0px，完全铺满无间隙
      padding: 0     // 🎯 无padding，完全铺满
    });

    // 初始化布局 - 使用实际容器尺寸
    currentLayout.value.init(actualWidth.value, actualHeight.value);

    // 添加到渲染画布
    renderCanvas.value.addLayout(currentLayout.value);
    renderCanvas.value.switchLayout(currentLayout.value.id);

    emit('layout-change', { layoutType, layout: currentLayout.value });
  } catch (err) {
    throw new Error(`设置布局失败: ${err.message}`);
  }
};

// 获取布局名称
const getLayoutName = (type) => {
  const names = {
    'single': '单画面',
    'grid-1x2': '1x2 网格',
    'grid-2x1': '2x1 网格',
    'grid-2x2': '2x2 网格',
    'grid-3x3': '3x3 网格',
    'picture-in-picture': '画中画'
  };
  return names[type] || type;
};

// 加载数据源
const loadSources = async () => {
  try {
    loadingText.value = '加载视频源...';
    console.log('[RenderEngineWrapper] loadSources 开始, sources:', props.sources.length);

    // 清理现有源
    renderBoxes.value.forEach(box => {
      box.dispose();
    });
    renderBoxes.value = [];
    sourceMap.value.clear();

    // 创建渲染盒子
    for (const sourceData of props.sources) {
      const index = props.sources.indexOf(sourceData);
      await createRenderBox(sourceData, index);
    }

    console.log('[RenderEngineWrapper] 数据源加载完成, boxes:', renderBoxes.value.length);
  } catch (err) {
    throw new Error(`加载数据源失败: ${err.message}`);
  }
};

// 创建渲染盒子
const createRenderBox = async (sourceData, index) => {
  try {
    console.log('[RenderEngineWrapper] createRenderBox:', sourceData.id, sourceData.type, 'index:', index);

    // 创建数据源
    const source = SourceFactory.create(sourceData.type, {
      id: sourceData.id,
      name: sourceData.name,
      url: sourceData.url,
      deviceId: sourceData.deviceId,
      stream: sourceData.stream,
      properties: sourceData.properties
    });

    // 保存到映射
    sourceMap.value.set(sourceData.id, source);

    // 获取布局区域
    const regions = currentLayout.value?.regions || [];
    const region = regions[index] || { x: 0, y: 0, width: actualWidth.value, height: actualHeight.value };

    // 创建渲染盒子
    const box = new RenderBox({
      id: `box-${sourceData.id}`,
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      fillMode: 'contain'
    });

    // 设置源
    box.setSource({
      type: sourceData.type,
      url: sourceData.url,
      stream: sourceData.stream,
      deviceId: sourceData.deviceId
    });

    // 添加到渲染画布
    renderCanvas.value.addElement(box);
    renderBoxes.value.push(box);

    // 监听数据源事件
    source.on('ready', () => {
      emit('source-ready', { sourceId: sourceData.id });
      console.log(`[RenderEngineWrapper] 数据源就绪: ${sourceData.name}`);
    });

    source.on('error', (e) => {
      emit('source-error', { sourceId: sourceData.id, error: e.error });
      console.error(`[RenderEngineWrapper] 数据源错误: ${sourceData.name}`, e.error);
    });

    // 如果自动启动，初始化数据源
    if (props.autoStart) {
      await source.init();
      await source.play();
    }

    return box;
  } catch (err) {
    console.error(`[RenderEngineWrapper] 创建渲染盒子失败: ${sourceData.name}`, err);
    emit('source-error', { sourceId: sourceData.id, error: err });
  }
};

// 添加数据源
const addSource = async (sourceData) => {
  console.log('[RenderEngineWrapper] addSource 被调用:', sourceData.id, sourceData.type);
  const index = props.sources.length;
  await createRenderBox(sourceData, index);
};

// 移除数据源
const removeSource = (sourceId) => {
  const boxIndex = renderBoxes.value.findIndex(box => box.id === `box-${sourceId}`);
  if (boxIndex !== -1) {
    const box = renderBoxes.value[boxIndex];
    box.dispose();
    renderCanvas.value.removeElement(box.id);
    renderBoxes.value.splice(boxIndex, 1);
  }

  const source = sourceMap.value.get(sourceId);
  if (source) {
    source.dispose();
    sourceMap.value.delete(sourceId);
  }
};

// 更新数据源
const updateSource = async (sourceId, updates) => {
  const source = sourceMap.value.get(sourceId);
  if (source) {
    if (updates.name) source.name = updates.name;
    if (updates.muted !== undefined) source.setMuted(updates.muted);
    if (updates.volume !== undefined) source.setVolume(updates.volume);
  }

  const box = renderBoxes.value.find(b => b.id === `box-${sourceId}`);
  if (box) {
    if (updates.fillMode) box.fillMode = updates.fillMode;
  }
};

// 切换布局
const switchLayout = async (layoutType) => {
  await setLayout(layoutType);

  // 更新渲染盒子位置
  const regions = currentLayout.value?.regions || [];
  renderBoxes.value.forEach((box, index) => {
    const region = regions[index];
    if (region) {
      box.setPosition(region.x, region.y);
      box.setSize(region.width, region.height);
    }
  });
};

// 截图
const capture = (rect = null) => {
  if (renderCanvas.value) {
    return renderCanvas.value.capture(rect);
  }
  return null;
};

// 双击检测
let lastClickTime = 0;
let lastClickElement = null;

// 鼠标事件处理
const handleMouseDown = (e) => {
  const rect = canvasRef.value.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // 检查点击的元素
  const elements = renderCanvas.value?.elements || [];
  const clickedElement = elements.find(el => el.containsPoint(x, y));

  if (clickedElement) {
    emit('element-click', { element: clickedElement, x, y });

    // 双击检测
    const currentTime = new Date().getTime();
    if (currentTime - lastClickTime < 300 && lastClickElement === clickedElement.id) {
      // 双击事件
      console.log('[RenderEngineWrapper] 双击元素:', clickedElement.id);
      emit('element-dblclick', { element: clickedElement, x, y });
    }
    lastClickTime = currentTime;
    lastClickElement = clickedElement.id;
  } else {
    lastClickTime = 0;
    lastClickElement = null;
  }
};

const handleMouseMove = () => {};
const handleMouseUp = () => {};
const handleTouchStart = () => {};
const handleTouchMove = () => {};
const handleTouchEnd = () => {};

// 监听数据源变化
watch(() => props.sources, async (newSources, oldSources) => {
  if (!renderCanvas.value) return;

  console.log('[RenderEngineWrapper] sources 变化:', {
    newSources: newSources?.length,
    oldSources: oldSources?.length,
    elements: renderCanvas.value.elements.length
  });

  // 移除已删除的源
  if (oldSources) {
    const oldIds = new Set(oldSources.map(s => s.id));
    newSources.forEach(s => oldIds.delete(s.id));
    oldIds.forEach(id => removeSource(id));
  }

  // 添加新源
  const existingIds = new Set(renderBoxes.value.map(b => b.id.replace('box-', '')));
  for (const source of newSources) {
    if (!existingIds.has(source.id)) {
      await addSource(source);
    }
  }

  // 布局变化时重新排列源的位置
  if (currentLayout.value) {
    const regions = currentLayout.value.regions || [];
    console.log('[RenderEngineWrapper] 更新盒子位置, regions:', regions.length);
    renderBoxes.value.forEach((box, index) => {
      const region = regions[index];
      if (region) {
        box.setPosition(region.x, region.y);
        box.setSize(region.width, region.height);
      }
    });
  }
}, { deep: true });

// 监听布局变化
watch(() => props.layoutType, (newType) => {
  if (renderCanvas.value && newType) {
    switchLayout(newType);
  }
});

// 处理尺寸变化
const handleResize = async (newWidth, newHeight) => {
  if (!canvasRef.value || !renderEngine.value || !renderCanvas.value) return;

  // 更新实际尺寸
  actualWidth.value = newWidth;
  actualHeight.value = newHeight;

  console.log(`[RenderEngineWrapper] 尺寸变化: ${newWidth}x${newHeight}`);

  // 更新画布尺寸
  const dpr = window.devicePixelRatio || 1;
  canvasRef.value.width = newWidth * dpr;
  canvasRef.value.height = newHeight * dpr;
  canvasRef.value.style.width = newWidth + 'px';
  canvasRef.value.style.height = newHeight + 'px';

  // 重新设置缩放
  const ctx = canvasRef.value.getContext('2d');
  if (ctx) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.restore();
  }

  // 更新渲染引擎和画布尺寸
  renderEngine.value.width = newWidth;
  renderEngine.value.height = newHeight;
  renderCanvas.value.width = newWidth;
  renderCanvas.value.height = newHeight;

  // 重新初始化布局
  if (currentLayout.value) {
    currentLayout.value.init(newWidth, newHeight);
  }

  // 更新渲染盒子位置和尺寸
  const regions = currentLayout.value?.regions || [];
  renderBoxes.value.forEach((box, index) => {
    const region = regions[index];
    if (region) {
      box.setPosition(region.x, region.y);
      box.setSize(region.width, region.height);
    }
  });
};

// 监听 props 尺寸变化
watch(() => [props.width, props.height], async ([newWidth, newHeight]) => {
  await handleResize(newWidth, newHeight);
});

// 监听窗口 resize 事件
const handleWindowResize = () => {
  const size = getContainerSize();
  if (size.width !== actualWidth.value || size.height !== actualHeight.value) {
    handleResize(size.width, size.height);
  }
};

// 生命周期
onMounted(async () => {
  //  等待下一帧，确保容器已正确渲染并计算出实际尺寸
  await new Promise(resolve => requestAnimationFrame(resolve));

  // 🎯 再次检查容器尺寸
  const size = getContainerSize();
  console.log('[RenderEngineWrapper] onMounted 容器尺寸:', size);

  if (size.width > 0 && size.height > 0) {
    await initEngine();
  } else {
    console.warn('[RenderEngineWrapper] 容器尺寸为0，使用默认尺寸初始化');
    await initEngine();
  }

  // 🎯 使用 ResizeObserver 监听容器尺寸变化
  let resizeObserver = null;
  if (window.ResizeObserver && containerRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0 &&
            (Math.abs(width - actualWidth.value) > 1 || Math.abs(height - actualHeight.value) > 1)) {
          console.log('[RenderEngineWrapper] ResizeObserver 触发:', width, height);
          handleResize(width, height);
        }
      }
    });
    resizeObserver.observe(containerRef.value);
  }

  // 添加窗口 resize 监听作为备用
  window.addEventListener('resize', handleWindowResize);

  // 保存 resizeObserver 以便清理
  containerRef.value._resizeObserver = resizeObserver;
});

onUnmounted(() => {
  // 移除窗口 resize 监听
  window.removeEventListener('resize', handleWindowResize);

  //  清理 ResizeObserver
  if (containerRef.value && containerRef.value._resizeObserver) {
    containerRef.value._resizeObserver.disconnect();
    containerRef.value._resizeObserver = null;
  }

  // 清理资源
  renderBoxes.value.forEach(box => box.dispose());
  sourceMap.value.forEach(source => source.dispose());

  if (renderEngine.value) {
    renderEngine.value.stop();
    renderEngine.value.destroy();
  }
});

// 暴露方法
defineExpose({
  addSource,
  removeSource,
  updateSource,
  switchLayout,
  capture,
  renderEngine,
  renderCanvas
});
</script>

<style scoped>
.render-engine-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;  /* 🎯 修复：透明背景，避免canvas未铺满时显示背景色 */
}

.render-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.8);
  z-index: 100;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(52, 152, 219, 0.3);
  border-top-color: #3498DB;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  margin-top: 16px;
  color: #E0E0E0;
  font-size: 14px;
}

.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(231, 76, 60, 0.9);
  z-index: 100;
}

.error-icon {
  font-size: 48px;
}

.error-text {
  margin-top: 16px;
  color: white;
  font-size: 14px;
  text-align: center;
  padding: 0 20px;
}
</style>
