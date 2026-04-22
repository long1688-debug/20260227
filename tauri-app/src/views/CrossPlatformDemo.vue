/**
 * 跨平台适配使用示例
 * 
 * 演示如何在实际页面中应用跨平台适配功能
 */

<template>
  <AdaptiveContainer 
    :show-sidebar="true"
    :show-header="true"
    :show-footer="true"
    custom-class="demo-page"
  >
    <!-- 侧边栏插槽 -->
    <template #sidebar>
      <div class="sidebar-menu">
        <h3>功能菜单</h3>
        <el-menu :default-active="activeMenu">
          <el-menu-item index="1">
            <el-icon><VideoCamera /></el-icon>
            <span>视频录制</span>
          </el-menu-item>
          <el-menu-item index="2">
            <el-icon><Microphone /></el-icon>
            <span>音频设置</span>
          </el-menu-item>
          <el-menu-item index="3">
            <el-icon><Setting /></el-icon>
            <span>系统配置</span>
          </el-menu-item>
        </el-menu>
        
        <!-- 平台信息卡片 -->
        <el-card class="platform-info-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span>平台信息</span>
            </div>
          </template>
          <div class="info-item">
            <label>平台类型:</label>
            <span>{{ platformInfo?.platform || '检测中...' }}</span>
          </div>
          <div class="info-item">
            <label>输入方式:</label>
            <span>{{ platformInfo?.inputMode || '检测中...' }}</span>
          </div>
          <div class="info-item">
            <label>布局模式:</label>
            <span>{{ platformInfo?.layoutMode || '检测中...' }}</span>
          </div>
          <div class="info-item">
            <label>硬件加速:</label>
            <el-tag :type="platformInfo?.hardwareAccelerated ? 'success' : 'warning'" size="small">
              {{ platformInfo?.hardwareAccelerated ? '已启用' : '未启用' }}
            </el-tag>
          </div>
        </el-card>
      </div>
    </template>

    <!-- 顶部导航插槽 -->
    <template #header>
      <div class="header-content">
        <h2>跨平台适配演示</h2>
        <div class="header-actions">
          <!-- 根据平台显示不同的按钮尺寸 -->
          <el-button 
            type="primary"
            :size="isTouchMode ? 'large' : 'default'"
            @click="handleTest"
          >
            测试按钮
          </el-button>
          
          <el-button 
            :size="isTouchMode ? 'large' : 'default'"
            @click="toggleLayout"
          >
            切换布局
          </el-button>
        </div>
      </div>
    </template>

    <!-- 主内容区 -->
    <div class="demo-content">
      <el-row :gutter="20">
        <!-- 平台特性卡片 -->
        <el-col :xs="24" :sm="12" :md="8" :lg="6">
          <el-card class="feature-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <el-icon :size="24"><Monitor /></el-icon>
                <span>Windows 桌面</span>
              </div>
            </template>
            <p>传统键鼠操作体验</p>
            <ul>
              <li>✓ 快捷键支持</li>
              <li>✓ 鼠标悬停效果</li>
              <li>✓ 标准按钮尺寸</li>
              <li>✓ 侧边栏导航</li>
            </ul>
          </el-card>
        </el-col>

        <el-col :xs="24" :sm="12" :md="8" :lg="6">
          <el-card class="feature-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <el-icon :size="24"><Pointer /></el-icon>
                <span>触控屏优化</span>
              </div>
            </template>
            <p>触摸手势优化体验</p>
            <ul>
              <li>✓ 增大点击区域</li>
              <li>✓ 手势滑动切换</li>
              <li>✓ 激活反馈动画</li>
              <li>✓ 虚拟键盘支持</li>
            </ul>
          </el-card>
        </el-col>

        <el-col :xs="24" :sm="12" :md="8" :lg="6">
          <el-card class="feature-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <el-icon :size="24"><Cellphone /></el-icon>
                <span>Android 平板</span>
              </div>
            </template>
            <p>移动端优化体验</p>
            <ul>
              <li>✓ 底部Tab导航</li>
              <li>✓ 横竖屏自适应</li>
              <li>✓ Material Design</li>
              <li>✓ 权限管理</li>
            </ul>
          </el-card>
        </el-col>

        <el-col :xs="24" :sm="12" :md="8" :lg="6">
          <el-card class="feature-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <el-icon :size="24"><Platform /></el-icon>
                <span>信创系统</span>
              </div>
            </template>
            <p>国产系统兼容支持</p>
            <ul>
              <li>✓ UOS/麒麟适配</li>
              <li>✓ 中文字体优化</li>
              <li>✓ 本地化支持</li>
              <li>✓ 安全合规</li>
            </ul>
          </el-card>
        </el-col>
      </el-row>

      <!-- 布局模式切换器 -->
      <el-card class="layout-switcher" shadow="never" style="margin-top: 20px;">
        <template #header>
          <div class="card-header">
            <span>布局模式切换</span>
            <el-tag>{{ currentLayout }}</el-tag>
          </div>
        </template>
        
        <el-radio-group v-model="selectedLayout" @change="handleLayoutChange">
          <el-radio-button value="desktop_sidebar">
            桌面侧边栏
          </el-radio-button>
          <el-radio-button value="tablet_bottom_tab">
            平板底部Tab
          </el-radio-button>
          <el-radio-button value="large_screen_grid">
            大屏网格
          </el-radio-button>
          <el-radio-button value="compact_single">
            紧凑单页
          </el-radio-button>
        </el-radio-group>
        
        <el-alert
          title="提示"
          type="info"
          :closable="false"
          style="margin-top: 16px;"
        >
          当前检测到的是 <strong>{{ platformInfo?.platform }}</strong> 平台，
          推荐使用 <strong>{{ recommendedLayout }}</strong> 布局模式。
          您可以手动切换查看不同效果。
        </el-alert>
      </el-card>

      <!-- 触控测试区域 -->
      <el-card v-if="isTouchMode" class="touch-test-area" shadow="never" style="margin-top: 20px;">
        <template #header>
          <div class="card-header">
            <span>触控测试区域</span>
            <el-tag type="success">触控模式已启用</el-tag>
          </div>
        </template>
        
        <div class="touch-buttons">
          <el-button 
            v-for="i in 6" 
            :key="i"
            size="large"
            :style="{ margin: '8px' }"
            @click="handleTouchTest(i)"
          >
            按钮 {{ i }}
          </el-button>
        </div>
        
        <p class="hint-text">
          提示：触控模式下按钮尺寸为 48×48px，符合 Material Design 规范
        </p>
      </el-card>
    </div>

    <!-- 底部操作栏（仅触控模式显示） -->
    <template #footer>
      <div class="footer-actions">
        <el-button type="primary" round>
          <el-icon><VideoCamera /></el-icon>
          <span>开始录制</span>
        </el-button>
        <el-button round>
          <el-icon><Setting /></el-icon>
          <span>设置</span>
        </el-button>
      </div>
    </template>
  </AdaptiveContainer>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { 
  VideoCamera, 
  Microphone, 
  Setting, 
  Monitor, 
  Pointer, 
  Cellphone, 
  Platform 
} from '@element-plus/icons-vue';
import AdaptiveContainer from '@/components/AdaptiveContainer.vue';
import { useAdaptiveLayout } from '@/composables/useAdaptiveLayout';
import { detectPlatform, LayoutMode } from '@/utils/platformDetector';

// 使用自适应布局
const {
  currentLayout,
  isTouchMode,
  platformInfo,
  setLayoutMode
} = useAdaptiveLayout();

// 状态
const activeMenu = ref('1');
const selectedLayout = ref(currentLayout.value);

// 计算推荐布局
const recommendedLayout = computed(() => {
  if (!platformInfo.value) return '自动检测中';
  
  switch (platformInfo.value.layoutMode) {
    case LayoutMode.DESKTOP_SIDEBAR:
      return '桌面侧边栏';
    case LayoutMode.TABLET_BOTTOM_TAB:
      return '平板底部Tab';
    case LayoutMode.LARGE_SCREEN_GRID:
      return '大屏网格';
    case LayoutMode.COMPACT_SINGLE:
      return '紧凑单页';
    default:
      return '未知';
  }
});

// 初始化
onMounted(async () => {
  // 平台信息已在 useAdaptiveLayout 中检测
  console.log('平台信息:', platformInfo.value);
});

// 事件处理
function handleTest() {
  ElMessage.success(`测试按钮被点击！平台: ${platformInfo.value?.platform}`);
}

function toggleLayout() {
  const layouts = Object.values(LayoutMode);
  const currentIndex = layouts.indexOf(currentLayout.value);
  const nextIndex = (currentIndex + 1) % layouts.length;
  setLayoutMode(layouts[nextIndex]);
  selectedLayout.value = layouts[nextIndex];
  
  ElMessage.info(`切换到: ${layouts[nextIndex]}`);
}

function handleLayoutChange(layout) {
  setLayoutMode(layout);
  ElMessage.success(`已切换到 ${layout} 模式`);
}

function handleTouchTest(index) {
  ElMessage.success(`触控按钮 ${index} 被点击！`);
}
</script>

<style scoped>
.demo-page {
  height: 100vh;
}

.sidebar-menu {
  padding: 16px;
}

.platform-info-card {
  margin-top: 20px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.info-item:last-child {
  border-bottom: none;
}

.info-item label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.info-item span {
  font-size: 14px;
  font-weight: 500;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.demo-content {
  padding: 20px;
}

.feature-card {
  height: 100%;
  transition: transform 0.3s ease;
}

.feature-card:hover {
  transform: translateY(-4px);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.feature-card ul {
  list-style: none;
  padding: 0;
  margin: 12px 0 0 0;
}

.feature-card li {
  padding: 4px 0;
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.layout-switcher {
  margin-top: 20px;
}

.touch-test-area {
  background-color: var(--el-color-primary-light-9);
  border: 2px dashed var(--el-color-primary);
}

.touch-buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  padding: 20px 0;
}

.hint-text {
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 14px;
  margin-top: 12px;
}

.footer-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
  padding: 8px 0;
}

/* 触控优化 */
:deep(.touch-optimized) {
  .feature-card {
    cursor: pointer;
  }
  
  .el-button {
    min-width: 48px;
    min-height: 48px;
  }
}
</style>
