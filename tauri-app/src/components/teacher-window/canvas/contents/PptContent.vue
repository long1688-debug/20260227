<template>
  <div class="ppt-content">
    <!-- PPT 预览容器 -->
    <div v-if="slides.length > 0" class="slides-container">
      <!-- 当前幻灯片 -->
      <div
        class="slide-viewer"
        :style="{ transform: `scale(${zoom})` }"
      >
        <div
          v-for="(slide, index) in slides"
          :key="index"
          class="slide-content"
          :class="{ active: currentSlideIndex === index }"
          v-html="slide.content"
        ></div>
      </div>

      <!-- 幻灯片导航 -->
      <div class="slide-navigation" v-if="slides.length > 1">
        <div class="nav-left">
          <el-button
            size="small"
            :disabled="currentSlideIndex === 0"
            @click="firstSlide"
            :icon="ChevronDoubleLeft"
            title="第一张"
          />
          <el-button
            size="small"
            :disabled="currentSlideIndex === 0"
            @click="prevSlide"
            :icon="ChevronLeft"
            title="上一张"
          />
        </div>

        <div class="nav-center">
          <div class="slide-info">
            <el-input
              v-model.number="pageInput"
              type="number"
              :min="1"
              :max="slides.length"
              class="page-input"
              @change="goToSlide"
              @keyup.enter="goToSlide"
            />
            <span class="slide-divider">/</span>
            <span class="slide-total">{{ slides.length }}</span>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: progressPercent + '%' }"
            ></div>
          </div>
          <!-- 幻灯片缩略图 -->
          <div class="thumbnails">
            <div
              v-for="(slide, index) in slides"
              :key="index"
              class="thumbnail-item"
              :class="{ active: currentSlideIndex === index }"
              @click="goToSlideIndex(index)"
            >
              <span>{{ index + 1 }}</span>
            </div>
          </div>
        </div>

        <div class="nav-right">
          <el-button
            size="small"
            :disabled="currentSlideIndex >= slides.length - 1"
            @click="nextSlide"
            :icon="ArrowRight"
            title="下一张"
          />
          <el-button
            size="small"
            :disabled="currentSlideIndex >= slides.length - 1"
            @click="lastSlide"
            :icon="ArrowRight"
            title="最后一张"
          />
        </div>
      </div>

      <!-- 缩放控制 -->
      <div class="zoom-controls">
        <el-button
          size="small"
          @click="zoomOut"
          :icon="ZoomOut"
          title="缩小"
        />
        <span class="zoom-value">{{ Math.round(zoom * 100) }}%</span>
        <el-button
          size="small"
          @click="zoomIn"
          :icon="ZoomIn"
          title="放大"
        />
        <el-button
          size="small"
          @click="resetZoom"
          :icon="Refresh"
          title="重置"
        />
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-else-if="loading" class="loading-state">
      <el-icon class="is-loading"><Loading /></el-icon>
      <p>正在解析 PPT...</p>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="error-state">
      <el-icon><Warning /></el-icon>
      <p>{{ error }}</p>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <el-icon :size="64"><Document /></el-icon>
      <p>暂无 PPT 内容</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { Document, ArrowLeft, ArrowRight, Loading, Warning, ZoomIn, ZoomOut, Refresh } from '@element-plus/icons-vue';

const props = defineProps({
  source: {
    type: Object,
    required: true
  }
});

// 状态
const slides = ref([]);
const currentSlideIndex = ref(0);
const pageInput = ref(1);
const zoom = ref(1);
const loading = ref(false);
const error = ref('');

// 计算属性
const progressPercent = computed(() => {
  if (slides.value.length <= 1) return 100;
  return ((currentSlideIndex.value + 1) / slides.value.length) * 100;
});

// 方法
const firstSlide = () => {
  currentSlideIndex.value = 0;
  updatePageInput();
};

const prevSlide = () => {
  if (currentSlideIndex.value > 0) {
    currentSlideIndex.value--;
    updatePageInput();
  }
};

const nextSlide = () => {
  if (currentSlideIndex.value < slides.value.length - 1) {
    currentSlideIndex.value++;
    updatePageInput();
  }
};

const lastSlide = () => {
  currentSlideIndex.value = slides.value.length - 1;
  updatePageInput();
};

const goToSlide = () => {
  const page = parseInt(pageInput.value);
  if (page && page >= 1 && page <= slides.value.length) {
    currentSlideIndex.value = page - 1;
  } else {
    updatePageInput();
  }
};

const goToSlideIndex = (index) => {
  currentSlideIndex.value = index;
  updatePageInput();
};

const updatePageInput = () => {
  pageInput.value = currentSlideIndex.value + 1;
};

const zoomIn = () => {
  if (zoom.value < 3) {
    zoom.value += 0.1;
  }
};

const zoomOut = () => {
  if (zoom.value > 0.5) {
    zoom.value -= 0.1;
  }
};

const resetZoom = () => {
  zoom.value = 1;
};

// 键盘事件处理
const handleKeydown = (e) => {
  switch (e.key) {
    case 'ArrowLeft':
      if (e.ctrlKey || e.metaKey) {
        firstSlide();
      } else {
        prevSlide();
      }
      break;
    case 'ArrowRight':
      if (e.ctrlKey || e.metaKey) {
        lastSlide();
      } else {
        nextSlide();
      }
      break;
    case 'Home':
      firstSlide();
      break;
    case 'End':
      lastSlide();
      break;
    case '+':
    case '=':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoomIn();
      }
      break;
    case '-':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoomOut();
      }
      break;
    case '0':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        resetZoom();
      }
      break;
  }
};

const loadPpt = async () => {
  if (!props.source) return;

  loading.value = true;
  error.value = '';

  try {
    console.log('[PptContent] 加载 PPT:', props.source.name);

    // 模拟 PPT 内容
    slides.value = [
      {
        content: `<div style="padding: 40px; text-align: center;">
          <h1>${props.source.name}</h1>
          <p style="margin-top: 20px;">欢迎使用文档查看器</p>
          <p style="color: #666;">支持完整的翻页功能</p>
        </div>`
      },
      {
        content: `<div style="padding: 40px;">
          <h2>幻灯片 2 - 功能介绍</h2>
          <ul style="margin-top: 20px;">
            <li>鼠标点击翻页</li>
            <li>键盘快捷键翻页</li>
            <li>页码输入跳转</li>
            <li>缩略图点击切换</li>
          </ul>
        </div>`
      },
      {
        content: `<div style="padding: 40px;">
          <h2>幻灯片 3 - 缩放控制</h2>
          <p style="margin-top: 16px;">支持放大缩小功能，快捷键：</p>
          <ul>
            <li>Ctrl + + : 放大</li>
            <li>Ctrl + - : 缩小</li>
            <li>Ctrl + 0 : 重置</li>
          </ul>
        </div>`
      },
      {
        content: `<div style="padding: 40px; text-align: center;">
          <h2>幻灯片 4 - 结束</h2>
          <p style="margin-top: 20px;">感谢观看！</p>
        </div>`
      }
    ];

    currentSlideIndex.value = 0;
    updatePageInput();

  } catch (err) {
    console.error('[PptContent] 加载失败:', err);
    error.value = 'PPT 加载失败: ' + err.message;
  } finally {
    loading.value = false;
  }
};

// 监听 source 变化
watch(() => props.source, (newSource) => {
  if (newSource) {
    loadPpt();
  }
}, { immediate: true });

// 全屏翻页事件处理
const handleFullscreenPageChange = (e) => {
  if (e.detail && e.detail.sourceId === props.source.id) {
    if (e.detail.direction === 'prev') {
      prevSlide();
    } else if (e.detail.direction === 'next') {
      nextSlide();
    }
  }
};

onMounted(() => {
  loadPpt();
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('doc-page-change', handleFullscreenPageChange);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('doc-page-change', handleFullscreenPageChange);
});
</script>

<style scoped lang="scss">
.ppt-content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden;
}

.slides-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
}

.slide-viewer {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  transform-origin: center center;
}

.slide-content {
  width: 100%;
  max-width: 960px;
  aspect-ratio: 16 / 9;
  background: #fff;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  border-radius: 8px;
  display: none;

  &.active {
    display: block;
  }

  :deep(*) {
    max-width: 100%;
  }

  :deep(h1) {
    font-size: 32px;
    color: #333;
    margin-bottom: 16px;
  }

  :deep(h2) {
    font-size: 24px;
    color: #444;
    margin-bottom: 12px;
  }

  :deep(p) {
    font-size: 16px;
    line-height: 1.8;
    color: #666;
  }

  :deep(ul) {
    padding-left: 24px;
  }

  :deep(li) {
    font-size: 16px;
    line-height: 2;
    color: #555;
  }
}

/* 幻灯片导航 */
.slide-navigation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #f8f9fa;
  border-top: 1px solid #e0e0e0;
}

.nav-left,
.nav-right {
  display: flex;
  gap: 8px;
}

.nav-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.slide-info {
  display: flex;
  align-items: center;
  gap: 4px;
}

.page-input {
  width: 60px;
  text-align: center;
}

.slide-divider {
  color: #999;
}

.slide-total {
  color: #666;
  font-size: 14px;
}

.progress-bar {
  width: 250px;
  height: 4px;
  background: #e0e0e0;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #4299e1;
  transition: width 0.3s ease;
}

/* 缩略图 */
.thumbnails {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
  max-width: 300px;
}

.thumbnail-item {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 12px;
  color: #666;
  transition: all 0.2s;

  &:hover {
    background: #c0c0c0;
  }

  &.active {
    background: #4299e1;
    color: white;
  }
}

/* 缩放控制 */
.zoom-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 10px;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
}

.zoom-value {
  min-width: 60px;
  text-align: center;
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

/* 状态样式 */
.loading-state,
.error-state,
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #999;

  p {
    margin: 0;
    font-size: 14px;
  }
}

.error-state {
  color: #f56c6c;
}
</style>
