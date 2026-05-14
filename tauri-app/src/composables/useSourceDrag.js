import { ref, nextTick } from 'vue';
import { ElMessage } from 'element-plus';

/**
 * 🎯 新增：克隆 MediaStream 以支持同一摄像头在多个格子上显示
 * @param {MediaStream} stream - 原始媒体流
 * @param {string} suffix - 后缀标识
 * @returns {MediaStream} - 克隆的媒体流
 */
const cloneMediaStream = (stream, suffix = '') => {
  if (!stream) return null;

  try {
    const clonedStream = new MediaStream();
    stream.getTracks().forEach(track => {
      // 🎯 注意：克隆的轨道是独立的，但共享原始源的媒体数据
      clonedStream.addTrack(track.clone());
    });
    console.log(`[MediaStream] 克隆流 ${suffix}: 原始轨道数=${stream.getTracks().length}, 克隆轨道数=${clonedStream.getTracks().length}`);
    return clonedStream;
  } catch (error) {
    console.error('[MediaStream] 克隆流失败:', error);
    return stream; // 降级：返回原始流
  }
};

/**
 * 信号源拖拽管理 Composable
 * 处理信号源从列表拖拽到画布网格的逻辑
 * 使用鼠标事件替代 HTML5 拖拽 API，以兼容 Tauri 桌面应用
 */
export function useSourceDrag(options = {}) {
  // 🎯 画中画支持：传入懒加载函数获取 pipVideoPreview 和 pipVisible
  // 使用函数避免在 useSourceDrag 调用时 pipVideoPreview/pipVisible 未定义的问题
  const {
    videoPreviews,           // 预览区域的视频源数组
    canvasSourceMap,         // 画布源映射
    // ... 其他依赖
    getPipVideoPreview,      // 懒加载函数：获取画中画视频预览组件
    getPipVisible,           // 懒加载函数：获取画中画可见状态
    // ... 其他依赖
  } = options

  const getCurrentLayoutValue = () => {
    if (currentLayout && typeof currentLayout === 'object' && 'value' in currentLayout) {
      return currentLayout.value;
    }
    return currentLayout;
  };

  // 拖拽状态
  const dragOverIndex = ref(null);
  const draggedSourceType = ref(null);
  const isDraggingSource = ref(null);
  const currentSelectedSource = ref(null);

  // 🎯 缓存：存储已克隆的摄像头流，key 为 source.id，value 为克隆的流
  const clonedStreamsCache = new Map();

  // 鼠标拖拽状态
  let mouseDragState = {
    isDragging: false,
    source: null,
    startX: 0,
    startY: 0,
    ghostElement: null,
    isFromPreview: false  // 🎯 标识是否从预览区域拖拽
  };

  // 🎯 方案A：统一的拖拽信号源解析函数
  // 从不同的拖拽事件中提取实际拖拽的信号源
  const resolveDraggedSource = (event, fallbackSource = null) => {
    // 1. 优先从 HTML5 dataTransfer 获取
    if (event?.dataTransfer) {
      const jsonData = event.dataTransfer.getData('application/json');
      if (jsonData) {
        try {
          const parsed = JSON.parse(jsonData);
          console.log('[resolveDraggedSource] 从 HTML5 拖拽解析:', parsed.name, 'type:', parsed.type, 'id:', parsed.id);
          return parsed;
        } catch (e) {
          console.error('[resolveDraggedSource] JSON 解析失败:', e);
        }
      }
    }

    // 2. 从 mouseDragState 获取（鼠标/触摸拖拽）
    if (mouseDragState.source) {
      console.log('[resolveDraggedSource] 从 mouseDragState 获取:', mouseDragState.source.name, 'type:', mouseDragState.source.type);
      return mouseDragState.source;
    }

    // 3. 最后使用 fallback（不应该走到这里）
    if (fallbackSource) {
      console.warn('[resolveDraggedSource] 使用 fallback:', fallbackSource.name);
      return fallbackSource;
    }

    console.error('[resolveDraggedSource] 无法解析拖拽的信号源');
    return null;
  };

  // 🎯 方案A：统一的信号源克隆函数
  // 确保每次拖拽都创建克隆，不影响预览区域
  const cloneSourceForCanvas = (source, canvasIndex, addToGlobalSources = true) => {
    if (!source) {
      console.error('[cloneSourceForCanvas] 源信号源为空');
      return null;
    }

    // 创建克隆
    const newId = `${source.id}_canvas_${Date.now()}`;
    const clonedSource = {
      ...source,
      id: newId,
      canvasIndex, // 标记属于哪个画布
      isClone: true, // 标记为克隆
    };

    // 如果是摄像头流，需要特殊处理
    if (source.hasStream && source.stream) {
      // 检查缓存中是否有对应的克隆流
      if (clonedStreamsCache.has(source.id)) {
        clonedSource.stream = clonedStreamsCache.get(source.id);
      } else {
        // 克隆流并存入缓存
        const clonedStream = cloneMediaStream(source.stream, `${source.name}_${canvasIndex}`);
        if (clonedStream) {
          clonedStreamsCache.set(source.id, clonedStream);
          clonedSource.stream = clonedStream;
        }
      }
    }

    // 如果需要添加到全局源列表
    if (addToGlobalSources && options && typeof options.addSourceToGlobalList === 'function') {
      options.addSourceToGlobalList(clonedSource);
      console.log(`[cloneSourceForCanvas] 已将克隆源添加到全局列表: ${clonedSource.name} (${clonedSource.id})`);
    }

    console.log(`[cloneSourceForCanvas] 克隆成功: ${source.name} type: ${source.type} hasStream: ${!!source.stream} newId: ${newId}`);
    return clonedSource;
  };

  // 🎯 需求8：实时流性能优化 - 拖拽时暂停渲染
  const pausedVideos = new Map(); // 存储暂停的视频元素及其状态

  // 🎯 性能优化：暂停/恢复视频渲染
  const pauseVideoRendering = () => {
    console.log('[性能优化] 暂停所有视频渲染');
    if (videoPreviews.value && Array.isArray(videoPreviews.value)) {
      videoPreviews.value.forEach((previewRef, index) => {
        if (previewRef && typeof previewRef.pauseVideo === 'function') {
          console.log(`[性能优化] 暂停画布 ${index} 的视频`);
          previewRef.pauseVideo();
        }
      });
    }
  };

  const resumeVideoRendering = () => {
    console.log('[性能优化] 恢复所有视频渲染');
    if (videoPreviews.value && Array.isArray(videoPreviews.value)) {
      videoPreviews.value.forEach((previewRef, index) => {
        if (previewRef && typeof previewRef.resumeVideo === 'function') {
          console.log(`[性能优化] 恢复画布 ${index} 的视频`);
          previewRef.resumeVideo();
        }
      });
    }
  };

  // 🎯 为触摸拖拽添加的别名函数
  const pauseAllVideosForDrag = pauseVideoRendering;
  const resumeAllVideosAfterDrag = resumeVideoRendering;

  /**
   * 获取或创建视频文件的 blob URL
   * 如果同一文件已经被拖拽过，复用已有的 blob URL
   */
  const getOrCreateVideoBlobUrl = (file) => {
    if (!file) return null;

    // 直接创建新的 blob URL
    const url = URL.createObjectURL(file);
    console.log(`[视频拖拽] 创建 blob URL 用于本地视频文件`);
    return url;
  };

  /**
   * 释放视频文件的 blob URL
   */
  const releaseVideoBlobUrl = (url) => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
      console.log(`[视频拖拽] 释放 blob URL`);
    }
  };

  /**
   * 创建拖拽的幽灵元素
   */
  const createDragGhost = (source, x, y) => {
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost-element';
    ghost.innerHTML = `
      <div class="drag-ghost-content">
        <span class="drag-ghost-icon">${getSourceIcon(source.type)}</span>
        <span class="drag-ghost-name">${source.name}</span>
      </div>
    `;
    ghost.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      padding: 8px 16px;
      background: rgba(76, 201, 240, 0.9);
      color: white;
      border-radius: 6px;
      font-size: 12px;
      pointer-events: none;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      transform: translate(-50%, -50%);
    `;
    document.body.appendChild(ghost);
    return ghost;
  };

  /**
   * 获取源类型图标
   */
  const getSourceIcon = (type) => {
    const icons = {
      localCamera: '📹',
      captureCard: '🎥',
      documentScanner: '📷',
      networkCamera: '🌐',
      mrCamera: '🥽',
      remoteDesktop: '🖥️',
      remoteCamera: '📡',
      mobileCamera: '📱',
      mobileScreen: '📲',
      localVideo: '🎬',
      networkStream: '📺',
      webpage: '🌍',
      ppt: '📊',
      word: '📝',
      mindmap: '🧠'
    };
    return icons[type] || '📺';
  };

  // 🎯 处理鼠标拖拽开始
  const handleMouseDown = (source, event, isFromPreview = false) => {
    console.log(`[鼠标拖拽] 开始拖拽: ${source.name} ${source.type}`);
    mouseDragState = {
      isDragging: true,
      source: { ...source }, // 创建副本防止意外修改
      startX: event.clientX,
      startY: event.clientY,
      ghostElement: null,
      isFromPreview
    };

    // 创建拖拽ghost元素
    const ghost = document.createElement('div');
    ghost.style.cssText = `
      position: fixed;
      top: ${event.clientY}px;
      left: ${event.clientX}px;
      padding: 8px 12px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      border-radius: 4px;
      font-size: 14px;
      pointer-events: none;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;
    ghost.textContent = source.name;
    document.body.appendChild(ghost);
    mouseDragState.ghostElement = ghost;

    // 添加mousemove和mouseup事件监听器
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // 性能优化：暂停视频渲染
    pauseVideoRendering();
  };

  /**
   * 鼠标移动 - 拖拽中
   */
  const onMouseMove = (event) => {
    if (!mouseDragState.isDragging) return;

    event.preventDefault();

    // 更新幽灵元素位置
    if (mouseDragState.ghostElement) {
      mouseDragState.ghostElement.style.left = `${event.clientX}px`;
      mouseDragState.ghostElement.style.top = `${event.clientY}px`;
      // 🎯 临时隐藏幽灵元素，避免遮挡检测
      mouseDragState.ghostElement.style.pointerEvents = 'none';
    }

    // 检测鼠标下方的元素
    const elements = document.elementsFromPoint(event.clientX, event.clientY) || [];

    // 恢复幽灵元素的 pointer-events
    if (mouseDragState.ghostElement) {
      mouseDragState.ghostElement.style.pointerEvents = 'none'; // 保持 none，让鼠标事件穿透
    }

    if (elements.length === 0) {
      console.log('[鼠标拖拽] 未检测到元素');
      dragOverIndex.value = null;
      return;
    }

    // 查找最上层的 video-item，优先 PIP / 小窗口内的节点
    let foundIndex = null;
    for (const el of elements) {
      // 🎯 修复：同时检测 .video-item 和 .cell-wrapper-mask（遮罩层）
      const videoItem = el.closest ? (el.closest('.video-item') || el.closest('.cell-wrapper-mask')) : null;
      if (videoItem) {
        // 如果是遮罩层，需要找到其父级的 .video-item
        const actualVideoItem = videoItem.classList.contains('video-item') ? videoItem : videoItem.parentElement?.closest('.video-item');
        if (actualVideoItem && actualVideoItem.dataset && actualVideoItem.dataset.index) {
          const index = parseInt(actualVideoItem.dataset.index, 10);
          if (!isNaN(index)) {
            foundIndex = index;
            break;
          }
        }
      }
    }

    if (foundIndex !== null) {
      dragOverIndex.value = foundIndex;
      console.log(`[鼠标拖拽] 检测到画布 ${foundIndex}`);
    } else {
      dragOverIndex.value = null;
    }
  };

  // 处理鼠标移动
  const handleMouseMove = (event) => {
    if (!mouseDragState.isDragging) return;

    // 更新ghost元素位置
    if (mouseDragState.ghostElement) {
      mouseDragState.ghostElement.style.left = `${event.clientX + 10}px`;
      mouseDragState.ghostElement.style.top = `${event.clientY + 10}px`;
    }
  };

  // 处理鼠标释放
  const handleMouseUp = () => {
    if (!mouseDragState.isDragging) return;

    // 移除事件监听器
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);

    // 清理ghost元素
    if (mouseDragState.ghostElement) {
      document.body.removeChild(mouseDragState.ghostElement);
      mouseDragState.ghostElement = null;
    }

    // 性能优化：恢复视频渲染
    resumeVideoRendering();

    console.log('[鼠标拖拽] 放置，目标索引:', dragOverIndex.value);
    console.log('[鼠标拖拽] mouseDragState.source:', mouseDragState.source);

    // 🎯 关键修复：处理鼠标拖拽放置（与触摸拖拽保持一致）
    const draggedSource = resolveDraggedSource(null, mouseDragState.source);
    if (draggedSource && dragOverIndex.value !== null) {
      console.log(`[鼠标拖拽] 放置到索引 ${dragOverIndex.value}，源:`, draggedSource.name);

      // 只有从预览区域拖拽时才创建克隆
      let sourceToDrop = draggedSource;
      if (mouseDragState.isFromPreview) {
        sourceToDrop = cloneSourceForCanvas(draggedSource);
        console.log('[鼠标拖拽] 从预览区域拖拽，创建克隆:', sourceToDrop.id);
      }

      handleDropToCanvas(sourceToDrop, dragOverIndex.value);
    } else if (!draggedSource) {
      console.warn('[鼠标拖拽] 未找到有效的信号源数据');
    } else if (dragOverIndex.value === null) {
      console.warn('[鼠标拖拽] 未放置到有效区域');
    }

    // 结束拖拽状态
    mouseDragState.isDragging = false;
    mouseDragState.source = null;
    dragOverIndex.value = null;
  };

  /**
   * 🎯 触摸开始 - 触控设备拖拽起点
   */
  const onTouchStart = (event, source) => {
    // 阻止默认行为（防止滚动）
    event.preventDefault();
    event.stopPropagation();

    const touch = event.touches[0];
    console.log('[触摸拖拽] 开始拖拽:', source.name, source.type);

    // 🎯 需求8修复：暂停所有视频渲染以提升性能
    pauseAllVideosForDrag();

    // 设置拖拽状态
    mouseDragState.isDragging = true;
    mouseDragState.source = source;
    mouseDragState.startX = touch.clientX;
    mouseDragState.startY = touch.clientY;
    mouseDragState.isFromPreview = true;  // 🎯 标识从预览区域开始拖拽

    // 创建幽灵元素
    mouseDragState.ghostElement = createDragGhost(source, touch.clientX, touch.clientY);

    // 保存源对象引用
    currentSelectedSource.value = source;
    isDraggingSource.value = source.id;
    draggedSourceType.value = source.type;

    // 添加全局触摸事件监听
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('touchcancel', onTouchEnd);
  };

  /**
   * 🎯 触摸移动 - 触控设备拖拽中
   */
  const onTouchMove = (event) => {
    if (!mouseDragState.isDragging) return;

    event.preventDefault();

    const touch = event.touches[0];

    // 更新幽灵元素位置
    if (mouseDragState.ghostElement) {
      mouseDragState.ghostElement.style.left = `${touch.clientX}px`;
      mouseDragState.ghostElement.style.top = `${touch.clientY}px`;
      mouseDragState.ghostElement.style.pointerEvents = 'none';
    }

    // 检测触摸点下方的元素
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);

    if (!elementBelow) {
      console.log('[触摸拖拽] 未检测到元素');
      return;
    }

    // 查找 video-item（现在画中画是独立的布局，不再需要检测 pip-inlay）
    // 🎯 修复：同时检测 .video-item 和 .cell-wrapper-mask（遮罩层）
    let videoItem = elementBelow.closest('.video-item');
    if (!videoItem) {
      const maskElement = elementBelow.closest('.cell-wrapper-mask');
      if (maskElement) {
        videoItem = maskElement.parentElement?.closest('.video-item');
      }
    }

    if (videoItem) {
      const index = parseInt(videoItem.dataset.index);
      if (!isNaN(index)) {
        dragOverIndex.value = index;
        console.log(`[触摸拖拽] 检测到画布 ${index}`);
      }
    } else {
      dragOverIndex.value = null;
    }
  };

  /**
   * 🎯 触摸结束 - 触控设备放置
   */
  const onTouchEnd = (event) => {
    if (!mouseDragState.isDragging) return;

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    console.log('[触摸拖拽] 放置，目标索引:', dragOverIndex.value);
    console.log('[触摸拖拽] currentSelectedSource:', currentSelectedSource.value);

    // 🎯 需求8修复：恢复所有视频渲染
    resumeAllVideosAfterDrag();

    // 移除幽灵元素
    if (mouseDragState.ghostElement) {
      mouseDragState.ghostElement.remove();
      mouseDragState.ghostElement = null;
    }

    // 移除全局事件监听
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
    document.removeEventListener('touchcancel', onTouchEnd);

    // 🎯 方案A：统一的拖拽信号源解析
    const draggedSource = resolveDraggedSource(null);
    if (!draggedSource) {
      console.warn('[触摸拖拽] 未找到有效的信号源数据');
      ElMessage.warning('拖拽数据无效，请重试');
      return;
    }

    // 处理放置逻辑
    if (dragOverIndex.value !== null) {
      console.log(`[触摸拖拽] 放置到索引 ${dragOverIndex.value}，源:`, draggedSource.name);

      // 只有从预览区域拖拽时才创建克隆
      let sourceToDrop = draggedSource;
      if (mouseDragState.isFromPreview) {
        sourceToDrop = cloneSourceForCanvas(draggedSource);
        console.log('[触摸拖拽] 从预览区域拖拽，创建克隆:', sourceToDrop.id);
      }

      handleDropToCanvas(sourceToDrop, dragOverIndex.value);
    } else {
      console.warn('[触摸拖拽] 未放置到有效区域', { dragOverIndex: dragOverIndex.value });
      ElMessage.warning('未放置到有效区域');
    }

    // 重置拖拽状态
    mouseDragState.isDragging = false;
    mouseDragState.source = null;
    mouseDragState.isFromPreview = false;  // 🎯 重置拖拽来源标志
    dragOverIndex.value = null;
    isDraggingSource.value = null;
    draggedSourceType.value = null;
  };

  /**
   * HTML5 拖拽开始（保留作为备用）
   */
  const onSourceDragStart = (event, source) => {
    try {
      event.dataTransfer.setData('sourceType', source.type);
      event.dataTransfer.setData('sourceId', source.id);
      event.dataTransfer.setData('text/plain', source.id);
      event.dataTransfer.effectAllowed = 'copy';

      if (event.currentTarget) {
        event.dataTransfer.setDragImage(event.currentTarget, 0, 0);
      }

      currentSelectedSource.value = source;
      isDraggingSource.value = source.id;

      console.log('[HTML5拖拽] 开始拖拽信号源:', source.name, '类型:', source.type, 'ID:', source.id);
    } catch (error) {
      console.error('[HTML5拖拽] 拖拽开始失败:', error);
    }
  };

  /**
   * HTML5 拖拽中
   */
  const onSourceDrag = (event, source) => {
    // 拖拽过程中的视觉反馈可以在这里处理
  };

  /**
   * HTML5 拖拽结束
   */
  const onSourceDragEnd = (event) => {
    console.log('[HTML5拖拽] 拖拽结束，currentSelectedSource:', currentSelectedSource.value);
  };

  /**
   * HTML5 拖拽覆盖到画布网格
   */
  const onDragOver = (event, index) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    dragOverIndex.value = index;
  };

  /**
   * HTML5 拖拽离开画布网格
   */
  const onDragLeave = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      dragOverIndex.value = null;
    }
  };

  /**
   * HTML5 拖拽覆盖到画中画窗口
   */
  const onDragOverPip = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    dragOverIndex.value = 2;
  };

  /**
   * HTML5 拖拽离开画中画窗口
   */
  const onDragLeavePip = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      if (dragOverIndex.value === 2) {
        dragOverIndex.value = null;
      }
    }
  };

  /**
   * HTML5 放置到画中画窗口
   */
  const onDropPip = (event) => {
    try {
      event.preventDefault();
      event.stopPropagation();

      console.log('[HTML5拖拽] 放置到画中画');

      //  方案A：统一的拖拽信号源解析和克隆
      const draggedSource = resolveDraggedSource(event);
      if (!draggedSource) {
        console.warn('[HTML5拖拽] 未找到有效的信号源数据');
        ElMessage.warning('拖拽数据无效，请重试');
        return;
      }

      // 创建克隆
      const clonedSource = cloneSourceForCanvas(draggedSource, currentSelectedSource.value);
      if (!clonedSource) {
        ElMessage.error('克隆信号源失败');
        return;
      }

      console.log('[HTML5拖拽] 放置克隆源到画中画:', clonedSource.name, 'type:', clonedSource.type);
      handleDropToCanvas(clonedSource, 2);

      dragOverIndex.value = null;
      isDraggingSource.value = null;
    } catch (error) {
      console.error('[HTML5拖拽] 放置失败:', error);
      ElMessage.error('放置失败');
    }
  };

  // 🎯 处理放置事件
  const handleDrop = (event, targetCanvasIndex) => {
    event.preventDefault();
    
    console.log(`[鼠标拖拽] 放置，目标索引: ${targetCanvasIndex}`);
    console.log(`[鼠标拖拽] currentSelectedSource:`, currentSelectedSource.value);
    console.log(`[鼠标拖拽] mouseDragState.source:`, mouseDragState.source);

    // 解析拖拽的信号源
    const source = resolveDraggedSource(event, currentSelectedSource.value || mouseDragState.source);
    if (!source) {
      console.error('[鼠标拖拽] 无法解析信号源');
      return;
    }

    console.log(`[鼠标拖拽] 放置到索引 ${targetCanvasIndex}，源: ${source.name}`);
    
    // 克隆源以适配画布 - 现在传递画布索引并添加到全局源列表
    const clonedSource = cloneSourceForCanvas(source, targetCanvasIndex, true);
    if (!clonedSource) {
      console.error('[鼠标拖拽] 克隆源失败');
      return;
    }

    // 更新画布源映射
    canvasSourceMap.value[targetCanvasIndex] = clonedSource;

    // 保存到布局状态
    const layout = getCurrentLayoutValue();
    if (typeof assignSource === 'function') {
      assignSource(targetCanvasIndex, clonedSource.id);
      console.log(`[拖拽] ✅ 已保存到 layoutStates: 布局${layout} 槽位${targetCanvasIndex} -> ${clonedSource.id}`);
    }

    // 通知布局管理器
    if (typeof saveLayoutMap === 'function') {
      saveLayoutMap();
      console.log(`[拖拽] ✅ 已保存布局状态到 localStorage，槽位${targetCanvasIndex} -> ${clonedSource.id}`);
    }

    // 重置拖拽状态
    dragOverIndex.value = null;
    isDraggingSource.value = false;
    mouseDragState.isDragging = false;
    
    // 隐藏ghost元素
    if (mouseDragState.ghostElement) {
      document.body.removeChild(mouseDragState.ghostElement);
      mouseDragState.ghostElement = null;
    }

    console.log(`[拖拽] canvasSourceMap 更新:`, canvasSourceMap.value);
    console.log(`[拖拽] 画布已重新渲染`);
  };

  // 🎯 为触摸拖拽和 HTML5 拖拽添加的放置到画布函数（别名）
  // 必须在 handleDrop 定义之后
  const handleDropToCanvas = handleDrop;

  /**
   * 设置视频源（辅助函数）
   */
  const setupVideoSource = (videoEl, source) => {
    console.log('[拖拽] setupVideoSource 被调用，源类型:', source.type);

    // 🎯 关键修复：先停止当前播放，避免 AbortError
    if (videoEl) {
      videoEl.pause();
      // 停止旧的流轨道
      if (videoEl.srcObject) {
        const oldTracks = videoEl.srcObject.getTracks();
        if (oldTracks) {
          oldTracks.forEach(track => track.stop());
        }
      }
    }

    if (source.url) {
      videoEl.src = source.url;
      videoEl.load();
      // 🎯 关键修复：延迟播放，确保视频已加载
      videoEl.addEventListener('canplay', () => {
        videoEl.play().catch(err => {
          if (err.name !== 'AbortError') {
            console.error('[拖拽] 视频播放失败:', err);
          }
        });
      }, { once: true });
    } else if (source.file) {
      const url = URL.createObjectURL(source.file);
      videoEl.src = url;
      videoEl.load();
      // 🎯 关键修复：延迟播放，确保视频已加载
      videoEl.addEventListener('canplay', () => {
        videoEl.play().catch(err => {
          if (err.name !== 'AbortError') {
            console.error('[拖拽] 视频播放失败:', err);
          }
        });
      }, { once: true });
    }
  };

  /**
   * HTML5 放置到画布网格
   */
  const onDrop = async (event, index) => {
    try {
      event.preventDefault();

      console.log('[HTML5拖拽] 放置到画布', index);

      // 处理文件拖拽
      const files = event.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('video/')) {
          const url = URL.createObjectURL(file);
          const source = {
            id: 'local_' + Date.now(),
            type: 'localVideo',
            name: file.name,
            url: url,
            file: file
          };
          console.log('[HTML5拖拽] 处理本地视频文件:', source.name);
          handleDropToCanvas(source, index);
        } else {
          ElMessage.error('请拖拽视频文件');
        }
        return;
      }

      //  方案A：统一的拖拽信号源解析和克隆
      const draggedSource = resolveDraggedSource(event);
      if (!draggedSource) {
        console.warn('[HTML5拖拽] 未找到有效的信号源数据');
        ElMessage.warning('拖拽数据无效，请重试');
        return;
      }

      // 创建克隆（从预览区域拖拽时）
      const clonedSource = cloneSourceForCanvas(draggedSource, currentSelectedSource.value);
      if (!clonedSource) {
        ElMessage.error('克隆信号源失败');
        return;
      }

      console.log('[HTML5拖拽] 放置克隆源到画布:', clonedSource.name, 'type:', clonedSource.type);
      handleDropToCanvas(clonedSource, index);

      dragOverIndex.value = null;
      isDraggingSource.value = null;
    } catch (error) {
      console.error('[HTML5拖拽] 放置失败:', error);
      ElMessage.error('放置失败');
    }
  };

  /**
   * 处理本地视频文件拖拽
   */
  const handleLocalVideoDrop = async (event, index) => {
    try {
      const files = event.dataTransfer.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      if (!file.type.startsWith('video/')) {
        ElMessage.error('请拖拽视频文件');
        return;
      }

      const url = URL.createObjectURL(file);
      const source = {
        id: 'local_' + Date.now(),
        type: 'localVideo',
        name: file.name,
        url: url,
        file: file
      };

      handleDropToCanvas(source, index);
    } catch (error) {
      console.error('[拖拽] 处理视频文件失败:', error);
      ElMessage.error('添加视频失败');
    }
  };

  /**
   * 从画布移除源（不释放 Blob URL，因为源可能再次添加）
   */
  const removeFromCanvas = (sourceId) => {
    try {
      console.log('[拖拽] 从画布移除源:', sourceId);

      // 找到源所在的画布索引
      const canvasIndex = Object.keys(canvasSourceMap.value).find(index =>
        canvasSourceMap.value[index] === sourceId
      );

      if (canvasIndex === undefined) {
        console.log('[拖拽] 源不在任何画布中:', sourceId);
        return;
      }

      // 清除画布源映射
      canvasSourceMap.value[canvasIndex] = null;
      console.log(`[拖拽] 已清除画布 ${canvasIndex} 的源映射`);

      // 清除 VideoPreview 组件的内容
      const previewIndex = parseInt(canvasIndex) - 1;
      const preview = videoPreviews.value[previewIndex];

      if (preview) {
        console.log(`[拖拽] 清除 VideoPreview 组件内容，索引: ${previewIndex}`);
        // 🎯 关键修复：使用 clearVideoSourceWithoutRevoke 不释放 Blob URL
        // 因为信号源还在 allSources 中，可能再次添加
        if (typeof preview.clearVideoSourceWithoutRevoke === 'function') {
          preview.clearVideoSourceWithoutRevoke();
          console.log('[拖拽] 已调用 clearVideoSourceWithoutRevoke 清空视频（保留 Blob URL）');
        } else if (typeof preview.clearVideoSource === 'function') {
          // 备用方案：如果没有 clearVideoSourceWithoutRevoke，使用 clearVideoSource
          preview.clearVideoSource();
          console.log('[拖拽] 已调用 clearVideoSource 清空视频');
        } else if (typeof preview.clearSource === 'function') {
          preview.clearSource();
        } else if (typeof preview.setVideoFile === 'function') {
          // 如果没有 clearVideoSource，尝试设置空值
          preview.setVideoFile(null, null);
        }
      } else {
        console.warn(`[拖拽] 未找到 VideoPreview 组件，索引: ${previewIndex}`);
      }

      console.log(`[拖拽] 成功从画布 ${canvasIndex} 移除源: ${sourceId}`);
    } catch (error) {
      console.error('[拖拽] 从画布移除源失败:', error);
    }
  };

  /**
   * 清理拖拽状态
   */
  const cleanupDragState = () => {
    dragOverIndex.value = null;
    draggedSourceType.value = null;
    isDraggingSource.value = null;
    currentSelectedSource.value = null;
    mouseDragState.isDragging = false;
    if (mouseDragState.ghostElement) {
      mouseDragState.ghostElement.remove();
      mouseDragState.ghostElement = null;
    }
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  /**
   * 🎯 根据索引获取 RenderBox
   * 从当前布局中查找对应的 Box
   */
  const getRenderBoxByIndex = (index) => {
    if (!currentLayout || !layoutStates) return null;
    
    const layoutValue = typeof currentLayout === 'object' && 'value' in currentLayout 
      ? currentLayout.value 
      : currentLayout;
    
    const layoutState = layoutStates[layoutValue];
    if (!layoutState || !layoutState.boxes) return null;
    
    return layoutState.boxes[index] || null;
  };

  // ============================================
  // 返回所有需要的响应式状态和方法
  // ============================================
  return {
    // 响应式状态
    dragOverIndex,
    draggedSourceType,
    isDraggingSource,
    currentSelectedSource,
    canvasSourceMap,
    videoPreviews,
    
    // 鼠标拖拽方法
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    
    // HTML5 拖拽方法
    onSourceDragStart,
    onSourceDrag,
    onSourceDragEnd,
    onDragOver,
    onDragLeave,
    onDrop,
    
    // 画中画拖拽方法
    onDragOverPip,
    onDragLeavePip,
    onDropPip,
    
    // 触摸拖拽方法
    onTouchStart,
    
    // 放置处理方法
    handleDrop,
    handleDropToCanvas,
    
    // 辅助方法
    setCurrentSelectedSource: (source) => {
      currentSelectedSource.value = source;
    },
    setVideoPreviews: (previews) => {
      videoPreviews.value = previews;
    },
    setupVideoSource,
    removeFromCanvas,
    cleanupDragState,
    getRenderBoxByIndex,
    
    // 性能优化方法
    pauseVideoRendering,
    resumeVideoRendering
  };
}
