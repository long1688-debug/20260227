<template>
  <div class="webpage-content">
    <!-- 只有在有有效URL时才渲染iframe -->
    <iframe
      v-if="isValidUrl && !hasError"
      :key="iframeKey"
      ref="iframeRef"
      :src="iframeSrc"
      :style="iframeStyle"
      frameborder="0"
      class="webpage-frame"
      :sandbox="sandboxAttribute"
      @error="handleIframeError"
      @load="handleIframeLoad"
    />

    <!-- 加载状态 -->
    <div v-else-if="isLoading" class="loading-state">
      <el-icon class="is-loading" :size="32"><Loading /></el-icon>
      <p>加载中...</p>
      <small>{{ currentUrl }}</small>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="hasError" class="error-state">
      <el-icon :size="48"><WarningFilled /></el-icon>
      <p>加载失败</p>
      <small>{{ errorMessage || '请检查URL是否有效' }}</small>
      <div class="error-actions">
        <el-button size="small" type="primary" @click="retryLoad">重试</el-button>
        <el-button size="small" @click="openInNewTab">在新标签页打开</el-button>
      </div>
    </div>

    <!-- 默认占位符 -->
    <div v-else class="placeholder">
      <el-icon :size="48"><Link /></el-icon>
      <p>未配置网页URL</p>
      <small>请在属性面板中设置有效的HTTP/HTTPS地址</small>
      <el-button size="small" type="primary" style="margin-top: 12px" @click="handleSetUrl">
        设置URL
      </el-button>
    </div>

    <!-- 缩放控制（可选） -->
    <div v-if="showZoomControl && isValidUrl" class="zoom-controls">
      <el-button-group size="small">
        <el-button :disabled="zoomLevel <= 25" @click="zoomOut">
          <el-icon><ZoomOut /></el-icon>
        </el-button>
        <el-button disabled>{{ zoomLevel }}%</el-button>
        <el-button :disabled="zoomLevel >= 300" @click="zoomIn">
          <el-icon><ZoomIn /></el-icon>
        </el-button>
      </el-button-group>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { Link, Loading, WarningFilled, ZoomIn, ZoomOut } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

const props = defineProps({
  source: Object
});

const emit = defineEmits(['set-url', 'zoom-change']);

// 状态管理
const isLoading = ref(false);
const hasError = ref(false);
const errorMessage = ref('');
const iframeRef = ref(null);
const iframeKey = ref(0); // 用于强制重新渲染iframe
const zoomLevel = ref(100);
const showZoomControl = ref(false);

/**
 * 获取当前URL
 */
const currentUrl = computed(() => {
  return props.source?.properties?.url || '';
});

/**
 * 验证URL是否有效
 */
const isValidUrl = computed(() => {
  const url = currentUrl.value;
  if (!url || typeof url !== 'string') return false;

  // 只允许 http 和 https 协议
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
});

/**
 * 获取iframe src（支持缩放）
 */
const iframeSrc = computed(() => {
  const url = currentUrl.value;
  if (!isValidUrl.value) return '';

  // 使用Chrome Transform Origin API来实现缩放
  // 注意：这只是一种简单实现，可能不适用于所有网页
  return url;
});

/**
 * 获取iframe样式（支持缩放）
 */
const iframeStyle = computed(() => {
  if (zoomLevel.value === 100) {
    return {};
  }

  return {
    transform: `scale(${zoomLevel.value / 100})`,
    transformOrigin: 'top left',
    width: `${10000 / zoomLevel.value}%`,
    height: `${10000 / zoomLevel.value}%`
  };
});

/**
 * 获取sandbox属性
 */
const sandboxAttribute = computed(() => {
  const settings = props.source?.properties || {};
  const permissions = [];

  if (settings.sandbox !== false) {
    // 沙箱模式，限制权限
    permissions.push('allow-same-origin');
    if (settings.javascriptEnabled !== false) {
      permissions.push('allow-scripts');
    }
    permissions.push('allow-forms');
    permissions.push('allow-popups');
  } else {
    // 非沙箱模式，允许更多权限
    permissions.push('allow-same-origin');
    permissions.push('allow-scripts');
    permissions.push('allow-forms');
    permissions.push('allow-popups');
    permissions.push('allow-modals');
    permissions.push('allow-orientation-lock');
    permissions.push('allow-pointer-lock');
    permissions.push('allow-presentation');
    permissions.push('allow-top-navigation');
  }

  return permissions.join(' ');
});

/**
 * iframe 加载成功
 */
const handleIframeLoad = () => {
  isLoading.value = false;
  hasError.value = false;
  console.log('[WebpageContent] 页面加载成功:', currentUrl.value);
};

/**
 * iframe 加载失败
 */
const handleIframeError = () => {
  isLoading.value = false;
  hasError.value = true;
  errorMessage.value = '无法加载该网页,可能是跨域限制或URL无效';
  console.error('[WebpageContent] 页面加载失败:', currentUrl.value);
};

/**
 * 重试加载
 */
const retryLoad = () => {
  hasError.value = false;
  isLoading.value = true;
  iframeKey.value++; // 强制重新渲染iframe
  setTimeout(() => {
    isLoading.value = false;
  }, 2000);
};

/**
 * 在新标签页打开
 */
const openInNewTab = () => {
  if (currentUrl.value) {
    window.open(currentUrl.value, '_blank');
  }
};

/**
 * 设置URL
 */
const handleSetUrl = () => {
  emit('set-url');
};

/**
 * 缩放
 */
const zoomIn = () => {
  if (zoomLevel.value < 300) {
    zoomLevel.value = Math.min(300, zoomLevel.value + 25);
    emit('zoom-change', zoomLevel.value);
  }
};

const zoomOut = () => {
  if (zoomLevel.value > 25) {
    zoomLevel.value = Math.max(25, zoomLevel.value - 25);
    emit('zoom-change', zoomLevel.value);
  }
};

// 监听URL变化
watch(() => currentUrl.value, (newUrl, oldUrl) => {
  if (newUrl && newUrl !== oldUrl) {
    isLoading.value = true;
    hasError.value = false;
    iframeKey.value++; // 强制重新加载
  }
});

// 监听缩放级别变化
watch(() => props.source?.properties?.zoomLevel, (newLevel) => {
  if (newLevel && newLevel !== zoomLevel.value) {
    zoomLevel.value = newLevel;
    showZoomControl.value = true;
  }
}, { immediate: true });
</script>

<style scoped lang="scss">
.webpage-content {
  width: 100%;
  height: 100%;
  background: #fff;
  position: relative;
  overflow: hidden;

  .webpage-frame {
    width: 100%;
    height: 100%;
    border: none;
    transition: transform 0.3s ease;
  }

  .loading-state,
  .error-state,
  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #718096;
    gap: 12px;
    padding: 20px;

    p {
      margin: 0;
      font-size: 14px;
      font-weight: 500;
    }

    small {
      font-size: 12px;
      opacity: 0.7;
      text-align: center;
      max-width: 80%;
      word-break: break-all;
    }

    .error-actions {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }
  }

  .error-state {
    color: #e53e3e;

    small {
      color: #718096;
    }
  }

  .zoom-controls {
    position: absolute;
    bottom: 12px;
    right: 12px;
    background: rgba(255, 255, 255, 0.95);
    padding: 4px;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 10;
  }
}
</style>
