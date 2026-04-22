/**
 * 自适应容器组件
 * 
 * 根据平台类型和布局模式自动调整容器样式，
 * 提供统一的跨平台UI封装。
 */

<template>
  <div 
    :class="['adaptive-container', containerClass, customClass]"
    :style="containerStyle"
  >
    <!-- 侧边栏（根据布局模式显示/隐藏） -->
    <aside 
      v-if="showSidebar" 
      :class="['adaptive-sidebar', sidebarClass]"
      :style="sidebarStyle"
    >
      <slot name="sidebar">
        <!-- 默认侧边栏内容 -->
        <div class="sidebar-content">
          <slot name="sidebar-default"></slot>
        </div>
      </slot>
    </aside>

    <!-- 主内容区 -->
    <main 
      :class="['adaptive-main', mainClass]"
      :style="mainStyle"
    >
      <!-- 顶部导航（平板模式显示底部） -->
      <header 
        v-if="showHeader" 
        :class="['adaptive-header', { 'bottom-nav': isTablet }]"
      >
        <slot name="header"></slot>
      </header>

      <!-- 主要内容 -->
      <div class="adaptive-content">
        <slot></slot>
      </div>

      <!-- 底部操作栏（触控模式显示） -->
      <footer 
        v-if="showFooter && isTouchMode" 
        class="adaptive-footer"
      >
        <slot name="footer"></slot>
      </footer>
    </main>

    <!-- 悬浮控制面板（大屏模式显示） -->
    <div 
      v-if="showFloatingPanel" 
      class="floating-panel"
      :style="floatingPanelStyle"
    >
      <slot name="floating-panel"></slot>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useAdaptiveLayout } from '@/composables/useAdaptiveLayout';
import { getPlatformCSSClass } from '@/utils/platformDetector';

const props = defineProps({
  // 是否显示侧边栏
  showSidebar: {
    type: Boolean,
    default: true
  },
  
  // 是否显示顶部导航
  showHeader: {
    type: Boolean,
    default: true
  },
  
  // 是否显示底部操作栏
  showFooter: {
    type: Boolean,
    default: false
  },
  
  // 自定义类名
  customClass: {
    type: String,
    default: ''
  },
  
  // 侧边栏宽度覆盖
  sidebarWidth: {
    type: String,
    default: null
  }
});

const {
  currentLayout,
  isTouchMode,
  layoutConfig,
  isDesktop,
  isTablet,
  isLargeScreen,
  isCompact,
  containerClass
} = useAdaptiveLayout();

// 计算属性
const showFloatingPanel = computed(() => 
  layoutConfig.value.showFloatingPanel
);

const sidebarStyle = computed(() => {
  const style = {};
  
  if (props.sidebarWidth) {
    style.width = props.sidebarWidth;
  } else if (layoutConfig.value.sidebarWidth) {
    style.width = layoutConfig.value.sidebarWidth;
  }
  
  if (layoutConfig.value.sidebarHeight) {
    style.height = layoutConfig.value.sidebarHeight;
  }
  
  return style;
});

const mainStyle = computed(() => ({
  padding: layoutConfig.value.contentPadding
}));

const floatingPanelStyle = computed(() => ({
  position: 'fixed',
  top: '20px',
  right: '20px',
  zIndex: 1000,
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  padding: '16px'
}));

// 暴露方法给父组件
defineExpose({
  currentLayout,
  isTouchMode,
  isDesktop,
  isTablet,
  isLargeScreen,
  isCompact
});
</script>

<style scoped>
.adaptive-container {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.adaptive-sidebar {
  transition: all 0.3s ease;
  background-color: var(--el-bg-color-overlay);
  border-right: 1px solid var(--el-border-color-light);
  overflow-y: auto;
  overflow-x: hidden;
}

.adaptive-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: all 0.3s ease;
}

.adaptive-header {
  padding: 16px 20px;
  background-color: var(--el-bg-color-overlay);
  border-bottom: 1px solid var(--el-border-color-light);
}

/* 平板模式：底部导航 */
.bottom-nav {
  order: 2;
  border-bottom: none;
  border-top: 1px solid var(--el-border-color-light);
}

.adaptive-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.adaptive-footer {
  padding: 12px 20px;
  background-color: var(--el-bg-color-overlay);
  border-top: 1px solid var(--el-border-color-light);
}

.floating-panel {
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* 触控优化 */
:deep(.touch-optimized) {
  .adaptive-sidebar,
  .adaptive-header,
  .adaptive-footer {
    /* 增大滚动区域 */
    ::-webkit-scrollbar {
      width: 8px;
    }
    
    ::-webkit-scrollbar-thumb {
      background-color: rgba(0, 0, 0, 0.2);
      border-radius: 4px;
    }
  }
}

/* 紧凑模式优化 */
.layout-compact_single {
  .adaptive-main {
    padding: 0;
  }
  
  .adaptive-content {
    padding: 8px;
  }
}

/* 大屏模式优化 */
.layout-large_screen_grid {
  .adaptive-content {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 24px;
  }
}
</style>
