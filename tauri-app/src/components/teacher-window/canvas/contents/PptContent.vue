<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import {
  Files, Loading, WarningFilled,
  ArrowLeft, ArrowRight, VideoPlay, VideoPause, FullScreen
} from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import parsePPTX from 'pptx-parser'; // 🎯 导入 pptx-parser 默认导出函数

const props = defineProps({
  source: Object
});

const emit = defineEmits(['upload-ppt']);

// 状态管理
const isLoading = ref(false);
const hasError = ref(false);
const errorMessage = ref('');
const currentSlideIndex = ref(0);
const totalSlides = ref(0);
const isPlaying = ref(false);
const autoplayInterval = ref(null);
const isFullscreen = ref(false); // 🎯 全屏状态

// 🎯 PPT 数据结构
const slides = ref([]); // 存储解析后的幻灯片数据
const slideImages = ref([]); // 保留兼容旧代码

/**
 * 验证PPT源是否有效
 */
const isValidSource = computed(() => {
  return props.source?.type === 'ppt' && props.source?.file;
});

/**
 * 获取当前幻灯片图片（兼容旧逻辑）
 */
const currentSlideImage = computed(() => {
  if (!slideImages.value || slideImages.value.length === 0) return null;
  return slideImages.value[currentSlideIndex.value];
});

/**
 * 🎯 获取当前幻灯片内容
 */
const currentSlide = computed(() => {
  if (!slides.value || slides.value.length === 0) return null;
  return slides.value[currentSlideIndex.value];
});

/**
 * 获取幻灯片容器样式
 */
const slideStyle = computed(() => {
  const settings = props.source?.properties || {};
  return {
    background: settings.backgroundColor || '#2d3748'
  };
});

/**
 * 🎯 进入全屏模式
 */
const enterFullscreen = () => {
  const container = document.querySelector('.ppt-container');
  if (container) {
    if (container.requestFullscreen) {
      container.requestFullscreen();
    } else if (container.webkitRequestFullscreen) {
      container.webkitRequestFullscreen();
    } else if (container.msRequestFullscreen) {
      container.msRequestFullscreen();
    }
    isFullscreen.value = true;
  }
};

/**
 * 🎯 退出全屏模式
 */
const exitFullscreen = () => {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen();
  }
  isFullscreen.value = false;
};

/**
 * 🎯 切换全屏
 */
const toggleFullscreen = () => {
  if (isFullscreen.value) {
    exitFullscreen();
  } else {
    enterFullscreen();
  }
};

/**
 * 上一页
 */
const previousSlide = () => {
  if (currentSlideIndex.value > 0) {
    currentSlideIndex.value--;
  }
};

/**
 * 下一页
 */
const nextSlide = () => {
  if (currentSlideIndex.value < totalSlides.value - 1) {
    currentSlideIndex.value++;
  } else if (props.source?.properties?.loop) {
    // 如果启用了循环播放
    currentSlideIndex.value = 0;
  } else {
    // 停止自动播放
    stopAutoplay();
  }
};

/**
 * 切换自动播放
 */
const toggleAutoplay = () => {
  if (isPlaying.value) {
    stopAutoplay();
  } else {
    startAutoplay();
  }
};

/**
 * 开始自动播放
 */
const startAutoplay = () => {
  const interval = (props.source?.properties?.slideInterval || 5) * 1000;
  autoplayInterval.value = setInterval(() => {
    nextSlide();
  }, interval);
  isPlaying.value = true;
};

/**
 * 停止自动播放
 */
const stopAutoplay = () => {
  if (autoplayInterval.value) {
    clearInterval(autoplayInterval.value);
    autoplayInterval.value = null;
  }
  isPlaying.value = false;
};

/**
 * 上传PPT
 */
const handleUpload = () => {
  emit('upload-ppt');
};

/**
 * 重试加载
 */
const retryLoad = () => {
  hasError.value = false;
  loadPpt();
};

/**
 * 🎯 将幻灯片内容渲染为 HTML
 */
const renderSlideToHtml = (slide) => {
  if (!slide) return '';

  // 如果幻灯片已经有 html 属性，直接返回
  if (slide.html) {
    return slide.html;
  }

  // 否则构建 HTML
  let html = `<div class="slide-content" style="background: ${slide.background || '#ffffff'}; width: 100%; height: 100%; position: relative; overflow: hidden;">`;

  // 如果有元素数据，渲染每个元素
  if (slide.elements && Array.isArray(slide.elements)) {
    slide.elements.forEach(element => {
      switch (element.type) {
        case 'text':
          html += `
            <div style="
              position: absolute;
              left: ${element.x || 0}px;
              top: ${element.y || 0}px;
              width: ${element.width || 200}px;
              height: ${element.height || 50}px;
              font-size: ${element.fontSize || 16}px;
              color: ${element.color || '#000000'};
              font-weight: ${element.bold ? 'bold' : 'normal'};
              font-style: ${element.italic ? 'italic' : 'normal'};
            ">${element.text || ''}</div>
          `;
          break;

        case 'image':
          if (element.data) {
            html += `
              <img src="${element.data}" style="
                position: absolute;
                left: ${element.x || 0}px;
                top: ${element.y || 0}px;
                width: ${element.width || 200}px;
                height: ${element.height || 150}px;
              " />
            `;
          }
          break;

        case 'shape':
          html += `
            <div style="
              position: absolute;
              left: ${element.x || 0}px;
              top: ${element.y || 0}px;
              width: ${element.width || 100}px;
              height: ${element.height || 100}px;
              background: ${element.fillColor || '#cccccc'};
              border: ${element.borderWidth || 0}px solid ${element.borderColor || '#000000'};
            "></div>
          `;
          break;
      }
    });
  }

  html += '</div>';
  return html;
};

/**
 * 🎯 解析 PPTX 文件（增强错误处理版）
 */
const parsePptx = async (file) => {
  try {
    console.log('[PptContent] 开始使用 pptx-parser 解析 PPTX 文件:', file?.name || 'unknown');

    // 🎯 安全检查：确保 file 对象存在
    if (!file) {
      throw new Error('文件对象为空');
    }

    // 🎯 关键修复：确保 file 是一个 Blob 对象
    let blobFile = file;

    // 情况1: file 本身就是 Blob（最常见的情况）
    if (file instanceof Blob) {
      blobFile = file;
      console.log('[PptContent] 文件是有效的 Blob 对象');
    }
    // 情况2: file.file 是 Blob（某些组件包装的情况）
    else if (file.file instanceof Blob) {
      blobFile = file.file;
      console.log('[PptContent] 使用 file.file 作为 Blob 对象');
    }
    // 情况3: file 有 url 属性（网络资源，需要联网）
    else if (file.url) {
      console.warn('[PptContent] 检测到 URL 资源，尝试获取...');
      console.warn('[PptContent] 注意：此操作需要网络连接');

      try {
        const response = await fetch(file.url);
        if (!response.ok) {
          throw new Error(`HTTP 请求失败: ${response.status}`);
        }
        blobFile = await response.blob();
        console.log('[PptContent] 已从 URL 获取 Blob');
      } catch (fetchError) {
        console.error('[PptContent] 网络请求失败:', fetchError);
        throw new Error('无法从网络获取文件，请检查网络连接或选择本地文件');
      }
    }
    // 情况4: 其他未知格式
    else {
      console.error('[PptContent] 无效的文件格式:', typeof file);
      throw new Error('不支持的文件格式，请选择 .pptx 格式的本地文件');
    }

    // 最终验证
    if (!(blobFile instanceof Blob)) {
      throw new Error('无法获取有效的 Blob 对象');
    }

    console.log('[PptContent] Blob 对象信息:', {
      size: blobFile.size,
      type: blobFile.type
    });

    // 🎯 安全检查：文件大小限制（防止过大文件导致内存问题）
    const maxFileSize = 100 * 1024 * 1024; // 100MB
    if (blobFile.size > maxFileSize) {
      throw new Error(`文件过大（${(blobFile.size / 1024 / 1024).toFixed(1)}MB），请选择小于 100MB 的文件`);
    }

    // ✅ 修复：直接传递 Blob 给 pptx-parser，而不是先转换为 ArrayBuffer
    // pptx-parser 内部会使用 FileReader 读取 Blob
    // 🎯 添加超时保护，防止解析过久导致应用无响应
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('解析超时，请尝试使用其他方式打开此文件'));
      }, 30000); // 30秒超时
    });

    const parsePromise = parsePPTX(blobFile);
    const result = await Promise.race([parsePromise, timeoutPromise]);

    console.log('[PptContent] pptx-parser 解析结果:', result);
    console.log('[PptContent] 解析结果类型:', typeof result);
    console.log('[PptContent] 解析结果是否为数组:', Array.isArray(result));
    console.log('[PptContent] 解析结果键:', result ? Object.keys(result) : 'null');

    // 🎯 提取幻灯片数据（增强版）
    if (result && result.slides && Array.isArray(result.slides) && result.slides.length > 0) {
      slides.value = result.slides;
      totalSlides.value = result.slides.length;
      console.log('[PptContent] 从 result.slides 提取数据');
    } else if (Array.isArray(result) && result.length > 0) {
      slides.value = result;
      totalSlides.value = result.length;
      console.log('[PptContent] 从数组结果提取数据');
    } else if (result && typeof result === 'object') {
      // 🎯 处理未知格式的对象结果
      console.warn('[PptContent] 解析结果格式未知，尝试提取可用数据');
      // 尝试多种可能的数据结构
      const possibleSlides = result.slides || result.data || result.content || [];
      if (Array.isArray(possibleSlides) && possibleSlides.length > 0) {
        slides.value = possibleSlides;
        totalSlides.value = possibleSlides.length;
      } else {
        throw new Error('解析结果不包含有效的幻灯片数据');
      }
    } else {
      // 兜底处理
      slides.value = [];
      totalSlides.value = 0;
      throw new Error('解析结果格式异常，无法提取幻灯片数据');
    }

    currentSlideIndex.value = 0;
    console.log('[PptContent] PPT 解析成功，共', totalSlides.value, '页');

    return slides.value;
  } catch (err) {
    console.error('[PptContent] PPTX解析失败:', err);
    // 🎯 防止错误消息过长导致UI问题
    const errorMessage = err.message && err.message.length < 200 
      ? err.message 
      : 'PPTX文件解析失败，请尝试其他文件';
    throw new Error(errorMessage);
  }
};

/**
 * 加载PPT
 */
const loadPpt = async () => {
  if (!isValidSource.value) return;

  isLoading.value = true;
  hasError.value = false;

  try {
    const file = props.source.file;
    const fileName = (file?.name || 'presentation').toLowerCase();
    const fileExt = fileName.split('.').pop();

    console.log('[PptContent] 加载PPT文件:', fileName, '扩展名:', fileExt);

    // 🎯 使用 pptx-parser 解析 .pptx 文件
    if (fileExt === 'pptx') {
      // 解析 PPTX 文件
      const parsedSlides = await parsePptx(file);

      slides.value = parsedSlides;
      totalSlides.value = parsedSlides.length;

      console.log('[PptContent] PPT加载成功:', totalSlides.value, '页');

    } else if (fileExt === 'ppt') {
      throw new Error('.ppt 格式不支持，请转换为 .pptx 或 PDF 格式');
    } else {
      throw new Error('不支持的文件格式: ' + fileExt);
    }

    // 如果启用了自动播放
    if (props.source?.properties?.autoplay) {
      startAutoplay();
    }

    isLoading.value = false;
    console.log('[PptContent] PPT加载成功:', totalSlides.value, '页');
  } catch (error) {
    console.error('[PptContent] PPT加载失败:', error);
    hasError.value = true;
    errorMessage.value = error.message || 'PPT文件解析失败';
    isLoading.value = false;
  }
};

// 监听source变化
watch(() => props.source?.id, (newId, oldId) => {
  if (newId && newId !== oldId) {
    currentSlideIndex.value = 0;
    loadPpt();
  }
});

// 组件挂载时加载PPT
onMounted(() => {
  if (isValidSource.value) {
    loadPpt();
  }
});

/**
 * 🎯 处理键盘事件 - 支持左右方向键翻页
 */
const handleKeydown = (event) => {
  if (!isValidSource.value || hasError.value) return;
  
  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault();
      previousSlide();
      break;
    case 'ArrowRight':
      event.preventDefault();
      nextSlide();
      break;
    case 'PageUp':
      event.preventDefault();
      previousSlide();
      break;
    case 'PageDown':
      event.preventDefault();
      nextSlide();
      break;
  }
};

// 🎯 触摸滑动翻页支持
const touchStartX = ref(0);
const touchStartY = ref(0);
const touchThreshold = 50; // 滑动阈值(像素)

const handleTouchStart = (event) => {
  touchStartX.value = event.touches[0].clientX;
  touchStartY.value = event.touches[0].clientY;
};

const handleTouchEnd = (event) => {
  if (!isValidSource.value || hasError.value) return;
  
  const touchEndX = event.changedTouches[0].clientX;
  const touchEndY = event.changedTouches[0].clientY;
  
  const deltaX = touchEndX - touchStartX.value;
  const deltaY = touchEndY - touchStartY.value;
  
  // 确保是水平滑动（垂直滑动可能是滚动）
  if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > touchThreshold) {
    event.preventDefault();
    if (deltaX > 0) {
      // 向右滑动 -> 上一页
      previousSlide();
    } else {
      // 向左滑动 -> 下一页
      nextSlide();
    }
  }
};

// 组件挂载时加载PPT并添加键盘监听
onMounted(() => {
  if (isValidSource.value) {
    loadPpt();
  }
  window.addEventListener('keydown', handleKeydown);
});

// 组件卸载时清理自动播放和键盘监听
onUnmounted(() => {
  stopAutoplay();
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div class="ppt-content">
    <!-- PPT预览容器 -->
    <div v-if="isValidSource" class="ppt-container">
      <!-- 🎯 PPT幻灯片展示 -->
      <div class="slide-display" :style="slideStyle" @touchstart="handleTouchStart" @touchend="handleTouchEnd">
        <!-- 加载中状态 -->
        <div v-if="isLoading" class="loading-state">
          <el-icon class="is-loading" :size="48"><Loading /></el-icon>
          <p>正在解析PPT文件...</p>
        </div>

        <!-- 错误状态 -->
        <div v-else-if="hasError" class="error-state">
          <el-icon :size="48"><WarningFilled /></el-icon>
          <p>{{ errorMessage }}</p>
          <el-button type="primary" @click="retryLoad">重试</el-button>
        </div>

        <!-- 幻灯片内容 -->
        <div v-else-if="currentSlide" class="slide-content">
          <!-- 🎯 渲染当前幻灯片内容 -->
          <div
            v-html="renderSlideToHtml(currentSlide)"
            class="slide-renderer"
          ></div>

          <!-- 幻灯片编号 -->
          <div class="slide-number-overlay">
            {{ currentSlideIndex + 1 }} / {{ totalSlides }}
          </div>
        </div>

        <!-- 无内容时显示占位符 -->
        <div v-else class="slide-info">
          <el-icon :size="64"><Files /></el-icon>
          <p>{{ source.name || '演示文稿' }}</p>
          <div class="slide-number">
            <span class="current">{{ currentSlideIndex + 1 }}</span>
            <span class="separator">/</span>
            <span class="total">{{ totalSlides || '?' }}</span>
          </div>
        </div>
      </div>

      <!-- 控制栏 -->
      <div class="controls-bar">
        <el-button-group>
          <el-button
            :disabled="totalSlides <= 1 || currentSlideIndex <= 0"
            @click="previousSlide"
            size="small"
          >
            <el-icon><ArrowLeft /></el-icon>
            上一页
          </el-button>
          <el-button @click="toggleAutoplay" size="small">
            <el-icon>
              <component :is="isPlaying ? VideoPause : VideoPlay" />
            </el-icon>
            {{ isPlaying ? '暂停' : '播放' }}
          </el-button>
          <el-button
            :disabled="totalSlides <= 1 || currentSlideIndex >= totalSlides - 1"
            @click="nextSlide"
            size="small"
          >
            下一页
            <el-icon><ArrowRight /></el-icon>
          </el-button>
        </el-button-group>

        <div class="slide-indicator">
          幻灯片 {{ currentSlideIndex + 1 }} / {{ totalSlides }}
        </div>

        <!-- 🎯 全屏按钮 -->
        <el-button
          size="small"
          type="primary"
          :icon="FullScreen"
          @click="toggleFullscreen"
        >
          {{ isFullscreen ? '退出全屏' : '全屏放映' }}
        </el-button>
      </div>
    </div>

    <!-- 无效源提示 -->
    <div v-else class="invalid-source">
      <el-icon :size="64"><Files /></el-icon>
      <p>未检测到有效的PPT文件</p>
      <el-button type="primary" @click="handleUpload">上传PPT</el-button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.ppt-content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #1a202c;
}

.ppt-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.slide-display {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #2d3748;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #a0aec0;

  p {
    margin-top: 16px;
    font-size: 14px;
  }
}

.slide-content {
  width: 100%;
  height: 100%;
  position: relative;
}

.slide-renderer {
  width: 100%;
  height: 100%;
  overflow: auto;
}

.slide-number-overlay {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
}

.slide-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.slide-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #a0aec0;

  p {
    margin-top: 16px;
    font-size: 16px;
  }

  .slide-number {
    margin-top: 24px;
    font-size: 18px;

    .current {
      font-weight: bold;
      color: #4CC9F0;
    }

    .separator {
      margin: 0 8px;
      color: #718096;
    }

    .total {
      color: #718096;
    }
  }
}

.controls-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.8);
  border-top: 1px solid #2d3748;
  position: relative;
  z-index: 10;

  .slide-indicator {
    color: #a0aec0;
    font-size: 14px;
    margin: 0 16px;
  }
}

.invalid-source {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #a0aec0;

  p {
    margin: 16px 0;
    font-size: 16px;
  }
}
</style>
