<template>
  <div 
    class="responsive-layout"
    :class="[
      layoutModeClass,
      { 'touch-optimized': isTouchDevice }
    ]"
  >
    <slot />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue';
import { 
  getDeviceType, 
  isTablet, 
  isMobile, 
  isXinchuangSystem,
  initDeviceDetection,
  setupBreakpointListener,
  DeviceType 
} from '@/utils/device';

const deviceType = computed(() => getDeviceType());
const isTouchDevice = computed(() => isTablet() || isMobile());
const isXinchuang = computed(() => isXinchuangSystem());

const layoutModeClass = computed(() => {
  switch (deviceType.value) {
    case DeviceType.WINDOWS_TABLET:
    case DeviceType.ANDROID_TABLET:
      return 'layout-tablet_bottom_tab';
    case DeviceType.LINUX_UOS:
    case DeviceType.LINUX_KYLIN:
      return 'layout-desktop_sidebar';
    case DeviceType.ANDROID_PHONE:
      return 'layout-compact_single';
    default:
      return 'layout-desktop_sidebar';
  }
});

onMounted(() => {
  initDeviceDetection();
  setupBreakpointListener();
  console.log('[ResponsiveLayout] 设备类型:', deviceType.value);
  console.log('[ResponsiveLayout] 是否触控设备:', isTouchDevice.value);
  console.log('[ResponsiveLayout] 是否信创系统:', isXinchuang.value);
});

onUnmounted(() => {
  // 清理工作
});
</script>

<style scoped>
.responsive-layout {
  min-height: 100vh;
  width: 100%;
}
</style>