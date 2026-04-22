/**
 * 跨平台自适应布局 Composable
 * 
 * 根据平台类型和屏幕尺寸自动调整UI布局，
 * 支持桌面/平板/大屏等多种模式的无缝切换。
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';
import { 
  detectPlatform, 
  getCurrentPlatform, 
  watchLayoutChanges,
  LayoutMode,
  InputMode,
  getRecommendedButtonSize,
  getMinTouchTarget
} from '@/utils/platformDetector';

export function useAdaptiveLayout() {
  const currentLayout = ref(LayoutMode.DESKTOP_SIDEBAR);
  const isTouchMode = ref(false);
  const buttonSize = ref(getRecommendedButtonSize());
  const minTouchTarget = ref(getMinTouchTarget());
  const platformInfo = ref(null);
  
  // 布局配置
  const layoutConfig = computed(() => {
    switch (currentLayout.value) {
      case LayoutMode.TABLET_BOTTOM_TAB:
        return {
          sidebarPosition: 'bottom',
          sidebarWidth: '100%',
          sidebarHeight: '60px',
          contentPadding: '16px',
          gridSize: '2x2',
          showFloatingPanel: false,
          touchOptimized: true
        };
      
      case LayoutMode.LARGE_SCREEN_GRID:
        return {
          sidebarPosition: 'left',
          sidebarWidth: '280px',
          sidebarHeight: '100%',
          contentPadding: '24px',
          gridSize: '4x4',
          showFloatingPanel: true,
          touchOptimized: false
        };
      
      case LayoutMode.COMPACT_SINGLE:
        return {
          sidebarPosition: 'hidden',
          sidebarWidth: '0',
          sidebarHeight: '0',
          contentPadding: '8px',
          gridSize: '1x1',
          showFloatingPanel: false,
          touchOptimized: true
        };
      
      default: // DESKTOP_SIDEBAR
        return {
          sidebarPosition: 'left',
          sidebarWidth: '240px',
          sidebarHeight: '100%',
          contentPadding: '20px',
          gridSize: '2x2',
          showFloatingPanel: false,
          touchOptimized: false
        };
    }
  });

  // 初始化平台检测
  onMounted(async () => {
    platformInfo.value = await detectPlatform();
    updateLayoutState();
    
    // 监听窗口变化
    const unwatch = watchLayoutChanges((info) => {
      platformInfo.value = info;
      updateLayoutState();
    });
    
    onUnmounted(() => {
      unwatch();
    });
  });

  function updateLayoutState() {
    if (!platformInfo.value) return;
    
    currentLayout.value = platformInfo.value.layoutMode;
    isTouchMode.value = platformInfo.value.inputMode === InputMode.TOUCH || 
                        platformInfo.value.inputMode === InputMode.HYBRID;
    buttonSize.value = getRecommendedButtonSize();
    minTouchTarget.value = getMinTouchTarget();
  }

  // 计算属性
  const isDesktop = computed(() => 
    currentLayout.value === LayoutMode.DESKTOP_SIDEBAR
  );
  
  const isTablet = computed(() => 
    currentLayout.value === LayoutMode.TABLET_BOTTOM_TAB
  );
  
  const isLargeScreen = computed(() => 
    currentLayout.value === LayoutMode.LARGE_SCREEN_GRID
  );
  
  const isCompact = computed(() => 
    currentLayout.value === LayoutMode.COMPACT_SINGLE
  );

  // 获取动态样式类
  const containerClass = computed(() => {
    const classes = [`layout-${currentLayout.value}`];
    if (isTouchMode.value) {
      classes.push('touch-optimized');
    }
    return classes.join(' ');
  });

  // 手动切换布局（用于用户自定义）
  function setLayoutMode(mode) {
    currentLayout.value = mode;
    // 保存到 localStorage
    localStorage.setItem('preferred_layout_mode', mode);
  }

  // 加载用户偏好
  function loadPreferredLayout() {
    const saved = localStorage.getItem('preferred_layout_mode');
    if (saved && Object.values(LayoutMode).includes(saved)) {
      currentLayout.value = saved;
    }
  }

  return {
    currentLayout,
    isTouchMode,
    buttonSize,
    minTouchTarget,
    platformInfo,
    layoutConfig,
    isDesktop,
    isTablet,
    isLargeScreen,
    isCompact,
    containerClass,
    setLayoutMode,
    loadPreferredLayout
  };
}
