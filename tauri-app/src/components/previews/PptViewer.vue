<template>
  <div class="ppt-viewer">
    <!-- PPT容器 -->
    <div class="ppt-container">
      <!-- 加载中 -->
      <div v-if="status === 'loading'" class="loading-state">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>正在加载PPT...</span>
        <div class="progress-bar" v-if="loadProgress > 0">
          <div class="progress-fill" :style="{ width: loadProgress + '%' }"></div>
        </div>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="status === 'error'" class="error-state">
        <el-icon><WarningFilled /></el-icon>
        <span>{{ errorMessage }}</span>
        <el-button size="small" type="primary" @click="reload">重新加载</el-button>
      </div>

      <!-- PPT内容 -->
      <div v-else-if="status === 'ready' && slides.length > 0" class="slides-container">
        <div
          class="slide-wrapper"
          :style="{ transform: `translateX(-${currentSlide * 100}%)` }"
        >
          <div
            v-for="(slide, index) in slides"
            :key="index"
            class="slide"
            :class="{ active: index === currentSlide }"
          >
            <img
              v-if="slide.type === 'image'"
              :src="slide.content"
              :alt="`第${index + 1}页`"
              class="slide-image"
            />
            <iframe
              v-else-if="slide.type === 'html'"
              :srcdoc="slide.content"
              class="slide-html"
              sandbox="allow-same-origin"
            ></iframe>
          </div>
        </div>

        <!-- 幻灯片导航 -->
        <div class="slide-nav">
          <el-button
            circle
            size="small"
            :icon="ArrowLeft"
            @click="prevSlide"
            :disabled="currentSlide === 0"
          />
          
          <div class="slide-counter">
            {{ currentSlide + 1 }} / {{ slides.length }}
          </div>

          <el-button
            circle
            size="small"
            :icon="ArrowRight"
            @click="nextSlide"
            :disabled="currentSlide >= slides.length - 1"
          />
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="empty-state">
        <el-icon><Document /></el-icon>
        <span>未加载PPT文件</span>
        <p class="hint">请在信号源配置中选择PPT文件</p>
      </div>
    </div>

    <!-- 控制栏 -->
    <div class="control-bar" v-if="status === 'ready' && slides.length > 0">
      <div class="playback-controls">
        <el-button
          size="small"
          :type="autoPlay ? 'success' : ''"
          :icon="autoPlay ? VideoPause : VideoPlay"
          @click="toggleAutoPlay"
        >
          {{ autoPlay ? '停止播放' : '自动播放' }}
        </el-button>

        <div class="interval-control" v-if="autoPlay">
          <span>间隔:</span>
          <el-input-number
            v-model="playInterval"
            :min="1"
            :max="300"
            size="small"
            controls-position="right"
          />
          <span>秒</span>
        </div>
      </div>

      <div class="view-controls">
        <el-button
          size="small"
          :icon="FullScreen"
          @click="toggleFullscreen"
        >
          全屏
        </el-button>
      </div>
    </div>

    <!-- 信息栏 -->
    <div class="info-bar" v-if="showInfo && fileName">
      <span class="file-name">{{ fileName }}</span>
      <span class="slide-info">{{ currentSlide + 1 }}/{{ slides.length }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { Loading, WarningFilled, Document, ArrowLeft, ArrowRight, VideoPlay, VideoPause, FullScreen } from '@element-plus/icons-vue';

const props = defineProps({
  sourceId: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    default: ''
  },
  fileName: {
    type: String,
    default: ''
  },
  autoPlay: {
    type: Boolean,
    default: false
  },
  playInterval: {
    type: Number,
    default: 10 // 秒
  },
  showInfo: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['slide-change', 'play-state-change']);

const status = ref('idle'); // idle, loading, ready, error
const errorMessage = ref('');
const loadProgress = ref(0);
const slides = ref([]);
const currentSlide = ref(0);
const isPlaying = ref(false);
let autoPlayTimer = null;

// 切换自动播放
const toggleAutoPlay = () => {
  isPlaying.value = !isPlaying.value;
  
  if (isPlaying.value) {
    startAutoPlay();
  } else {
    stopAutoPlay();
  }
  
  emit('play-state-change', isPlaying.value);
};

// 开始自动播放
const startAutoPlay = () => {
  if (autoPlayTimer) {
    clearInterval(autoPlayTimer);
  }
  
  autoPlayTimer = setInterval(() => {
    if (currentSlide.value < slides.value.length - 1) {
      nextSlide();
    } else {
      // 循环播放
      currentSlide.value = 0;
    }
  }, props.playInterval * 1000);
};

// 停止自动播放
const stopAutoPlay = () => {
  if (autoPlayTimer) {
    clearInterval(autoPlayTimer);
    autoPlayTimer = null;
  }
};

// 上一页
const prevSlide = () => {
  if (currentSlide.value > 0) {
    currentSlide.value--;
    emit('slide-change', currentSlide.value);
  }
};

// 下一页
const nextSlide = () => {
  if (currentSlide.value < slides.value.length - 1) {
    currentSlide.value++;
    emit('slide-change', currentSlide.value);
  }
};

// 全屏
const toggleFullscreen = () => {
  const container = document.querySelector('.ppt-container');
  if (!container) return;

  if (!document.fullscreenElement) {
    container.requestFullscreen().catch(err => {
      console.error('全屏失败:', err);
    });
  } else {
    document.exitFullscreen();
  }
};

// 加载PPT文件
const loadPPT = async () => {
  if (!props.filePath) {
    status.value = 'error';
    errorMessage.value = '未指定文件路径';
    return;
  }

  status.value = 'loading';
  loadProgress.value = 0;

  try {
    // TODO: 调用Tauri后端API转换PPT为图片/HTML
    // const result = await invoke('convert_ppt_to_slides', {
    //   file_path: props.filePath
    // });
    
    // 临时模拟数据
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    slides.value = [
      { type: 'image', content: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmZmIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI0OCIgZmlsbD0iIzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlBQVCBjb250ZW50PC90ZXh0Pjwvc3ZnPg==' },
      { type: 'image', content: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmZmIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI0OCIgZmlsbD0iIzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlNsZGUgMjwvdGV4dD48L3N2Zz4=' },
      { type: 'image', content: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmZmIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI0OCIgZmlsbD0iIzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlNsaWRlIDM8L3RleHQ+PC9zdmc+' }
    ];
    
    loadProgress.value = 100;
    status.value = 'ready';
    
    // 如果设置了自动播放，开始播放
    if (props.autoPlay) {
      isPlaying.value = true;
      startAutoPlay();
    }
  } catch (error) {
    console.error('PPT加载失败:', error);
    status.value = 'error';
    errorMessage.value = error.message || 'PPT文件加载失败';
  }
};

// 重新加载
const reload = () => {
  cleanup();
  loadPPT();
};

// 清理资源
const cleanup = () => {
  stopAutoPlay();
  slides.value = [];
  currentSlide.value = 0;
};

onMounted(() => {
  loadPPT();
});

onUnmounted(() => {
  cleanup();
});

// 监听文件路径变化
watch(() => props.filePath, () => {
  cleanup();
  loadPPT();
});

// 监听播放间隔变化
watch(() => props.playInterval, () => {
  if (isPlaying.value) {
    stopAutoPlay();
    startAutoPlay();
  }
});

// 暴露方法
defineExpose({
  reload,
  goToSlide: (index) => {
    if (index >= 0 && index < slides.value.length) {
      currentSlide.value = index;
    }
  },
  getCurrentSlide: () => currentSlide.value
});
</script>

<style scoped lang="scss">
.ppt-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;

  .ppt-container {
    flex: 1;
    position: relative;
    overflow: hidden;
    background: white;

    .loading-state,
    .error-state,
    .empty-state {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      color: #909399;
      font-size: 14px;

      .el-icon {
        font-size: 48px;
      }

      .progress-bar {
        width: 200px;
        height: 4px;
        background: #e4e7ed;
        border-radius: 2px;
        overflow: hidden;
        margin-top: 8px;

        .progress-fill {
          height: 100%;
          background: #409eff;
          transition: width 0.3s ease;
        }
      }

      .hint {
        font-size: 12px;
        color: #c0c4cc;
        margin: 0;
      }
    }

    .error-state {
      color: #f56c6c;
    }

    .slides-container {
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;

      .slide-wrapper {
        display: flex;
        width: 100%;
        height: 100%;
        transition: transform 0.3s ease;

        .slide {
          min-width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;

          .slide-image {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
          }

          .slide-html {
            width: 100%;
            height: 100%;
            border: none;
          }
        }
      }

      .slide-nav {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 8px 16px;
        background: rgba(0, 0, 0, 0.6);
        border-radius: 20px;
        color: white;

        .slide-counter {
          min-width: 60px;
          text-align: center;
          font-size: 14px;
        }
      }
    }
  }

  .control-bar {
    padding: 12px;
    background: white;
    border-top: 1px solid #e4e7ed;
    display: flex;
    justify-content: space-between;
    align-items: center;

    .playback-controls {
      display: flex;
      align-items: center;
      gap: 12px;

      .interval-control {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #606266;
      }
    }
  }

  .info-bar {
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    font-size: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;

    .file-name {
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .slide-info {
      color: #909399;
    }
  }
}
</style>
