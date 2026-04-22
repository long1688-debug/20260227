<template>
  <div class="webpage-viewer">
    <!-- iframe容器 -->
    <div class="iframe-container">
      <iframe
        v-if="validUrl && !error"
        :src="url"
        :sandbox="sandboxAttributes"
        class="webpage-iframe"
        @load="onIframeLoad"
        @error="onIframeError"
        referrerpolicy="no-referrer"
        loading="lazy"
      ></iframe>

      <!-- 加载状态 -->
      <div v-else-if="loading && validUrl" class="loading-state">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>加载中...</span>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="error-state">
        <el-icon><WarningFilled /></el-icon>
        <span>{{ errorMessage }}</span>
        <el-button size="small" type="primary" @click="reload">重新加载</el-button>
      </div>

      <!-- 空状态（URL无效或未配置） -->
      <div v-else class="empty-state">
        <el-icon><Link /></el-icon>
        <span>未配置网页地址</span>
        <p class="hint">请在信号源配置中设置有效的URL（http:// 或 https://）</p>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar" v-if="showToolbar">
      <el-button-group>
        <el-button
          size="small"
          :icon="Refresh"
          @click="reload"
          :disabled="!validUrl"
        >
          刷新
        </el-button>

        <el-button
          size="small"
          :icon="Back"
          @click="goBack"
          :disabled="!canGoBack"
        >
          后退
        </el-button>

        <el-button
          size="small"
          :icon="Right"
          @click="goForward"
          :disabled="!canGoForward"
        >
          前进
        </el-button>

        <el-button
          size="small"
          :icon="FullScreen"
          @click="toggleFullscreen"
          :disabled="!validUrl"
        >
          全屏
        </el-button>
      </el-button-group>

      <div class="zoom-controls">
        <el-button size="small" :icon="Minus" @click="zoomOut" :disabled="zoom <= 50">-</el-button>
        <span class="zoom-level">{{ zoom }}%</span>
        <el-button size="small" :icon="Plus" @click="zoomIn" :disabled="zoom >= 200">+</el-button>
        <el-button size="small" @click="resetZoom">重置</el-button>
      </div>
    </div>

    <!-- 信息栏 -->
    <div class="info-bar" v-if="showInfo && validUrl">
      <el-link :href="url" target="_blank" type="primary" :underline="false">
        {{ displayUrl }}
      </el-link>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { Loading, WarningFilled, Link, Refresh, Back, Right, FullScreen, Minus, Plus } from '@element-plus/icons-vue';

const props = defineProps({
  sourceId: {
    type: String,
    required: true
  },
  url: {
    type: String,
    default: ''
  },
  zoom: {
    type: Number,
    default: 100 // 50-200
  },
  disableJavaScript: {
    type: Boolean,
    default: false
  },
  showToolbar: {
    type: Boolean,
    default: true
  },
  showInfo: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['load', 'error']);

const loading = ref(false);
const error = ref(false);
const errorMessage = ref('');
const canGoBack = ref(false);
const canGoForward = ref(false);
const currentZoom = ref(props.zoom);
const historyStack = ref([]); // URL历史记录
const historyIndex = ref(-1); // 当前历史位置

// 验证URL（严格模式）
const validUrl = computed(() => {
  if (!props.url || props.url.trim() === '') return false;
  
  // 只允许 http:// 和 https:// 协议
  const urlPattern = /^https?:\/\/.+/i;
  return urlPattern.test(props.url);
});

// 显示URL（截断过长部分）
const displayUrl = computed(() => {
  if (!props.url) return '';
  return props.url.length > 60 ? props.url.substring(0, 57) + '...' : props.url;
});

// Sandbox属性（增强安全性）
const sandboxAttributes = computed(() => {
  let attrs = 'allow-same-origin allow-forms allow-popups allow-downloads';
  if (!props.disableJavaScript) {
    attrs += ' allow-scripts';
  }
  return attrs;
});

// 更新导航按钮状态
const updateNavigationState = () => {
  canGoBack.value = historyIndex.value > 0;
  canGoForward.value = historyIndex.value < historyStack.value.length - 1;
};

// 监听URL变化,更新历史记录
watch(() => props.url, (newUrl) => {
  if (newUrl && validUrl.value) {
    // 如果是新的URL,添加到历史记录
    if (historyIndex.value === -1 || historyStack.value[historyIndex.value] !== newUrl) {
      // 清除当前位置之后的历史
      historyStack.value = historyStack.value.slice(0, historyIndex.value + 1);
      historyStack.value.push(newUrl);
      historyIndex.value = historyStack.value.length - 1;
      
      // 更新导航按钮状态
      updateNavigationState();
    }
  }
}, { immediate: true });

// iframe加载完成
const onIframeLoad = () => {
  loading.value = false;
  error.value = false;
  emit('load', props.url);
};

// iframe加载错误
const onIframeError = () => {
  loading.value = false;
  error.value = true;
  errorMessage.value = '网页加载失败，请检查URL是否正确';
  emit('error', props.url);
};

// 重新加载
const reload = () => {
  if (!validUrl.value) return;
  
  loading.value = true;
  error.value = false;
  
  // 通过改变key强制重新加载iframe
  const iframe = document.querySelector('.webpage-iframe');
  if (iframe) {
    iframe.src = iframe.src;
  }
};

// 后退
const goBack = () => {
  if (!canGoBack.value) return;
  
  historyIndex.value--;
  const previousUrl = historyStack.value[historyIndex.value];
  
  if (previousUrl) {
    loading.value = true;
    error.value = false;
    
    const iframe = document.querySelector('.webpage-iframe');
    if (iframe) {
      iframe.src = previousUrl;
    }
    
    updateNavigationState();
  }
};

// 前进
const goForward = () => {
  if (!canGoForward.value) return;
  
  historyIndex.value++;
  const nextUrl = historyStack.value[historyIndex.value];
  
  if (nextUrl) {
    loading.value = true;
    error.value = false;
    
    const iframe = document.querySelector('.webpage-iframe');
    if (iframe) {
      iframe.src = nextUrl;
    }
    
    updateNavigationState();
  }
};

// 全屏
const toggleFullscreen = () => {
  const container = document.querySelector('.iframe-container');
  if (!container) return;

  if (!document.fullscreenElement) {
    container.requestFullscreen().catch(err => {
      console.error('全屏失败:', err);
    });
  } else {
    document.exitFullscreen();
  }
};

// 缩放控制
const zoomIn = () => {
  if (currentZoom.value < 200) {
    currentZoom.value += 10;
    applyZoom();
  }
};

const zoomOut = () => {
  if (currentZoom.value > 50) {
    currentZoom.value -= 10;
    applyZoom();
  }
};

const resetZoom = () => {
  currentZoom.value = 100;
  applyZoom();
};

const applyZoom = () => {
  const iframe = document.querySelector('.webpage-iframe');
  if (iframe) {
    iframe.style.transform = `scale(${currentZoom.value / 100})`;
    iframe.style.transformOrigin = 'top left';
  }
};

// 监听URL变化
watch(() => props.url, () => {
  if (validUrl.value) {
    loading.value = true;
    error.value = false;
  }
});

// 暴露方法
defineExpose({
  reload,
  getZoom: () => currentZoom.value
});
</script>

<style scoped lang="scss">
.webpage-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;

  .iframe-container {
    flex: 1;
    position: relative;
    overflow: hidden;
    background: #f5f7fa;

    .webpage-iframe {
      width: 100%;
      height: 100%;
      border: none;
      transition: transform 0.3s ease;
    }

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

      .hint {
        font-size: 12px;
        color: #c0c4cc;
        margin: 0;
      }
    }

    .error-state {
      color: #f56c6c;
    }
  }

  .toolbar {
    padding: 8px 12px;
    background: #f5f7fa;
    border-top: 1px solid #e4e7ed;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;

    .zoom-controls {
      display: flex;
      align-items: center;
      gap: 8px;

      .zoom-level {
        min-width: 50px;
        text-align: center;
        font-size: 12px;
        color: #606266;
      }
    }
  }

  .info-bar {
    padding: 6px 12px;
    background: white;
    border-top: 1px solid #e4e7ed;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
