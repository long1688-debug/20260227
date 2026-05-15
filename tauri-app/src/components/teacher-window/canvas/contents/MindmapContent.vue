<template>
  <div class="mindmap-content">
    <!-- 思维导图容器 -->
    <div v-if="isValidSource" class="mindmap-container">
      <div ref="mindmapCanvas" class="mindmap-canvas"></div>

      <!-- 工具栏 -->
      <div class="toolbar">
        <el-button-group size="small">
          <el-button :disabled="zoomLevel <= 50" @click="zoomOut">
            <el-icon><ZoomOut /></el-icon>
          </el-button>
          <el-button disabled>{{ zoomLevel }}%</el-button>
          <el-button :disabled="zoomLevel >= 200" @click="zoomIn">
            <el-icon><ZoomIn /></el-icon>
          </el-button>
        </el-button-group>
        <el-button size="small" @click="fitToScreen">
          <el-icon><FullScreen /></el-icon>
          适应屏幕
        </el-button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-else-if="isLoading" class="loading-state">
      <el-icon class="is-loading" :size="48"><Loading /></el-icon>
      <p>加载中...</p>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="hasError" class="error-state">
      <el-icon :size="48"><WarningFilled /></el-icon>
      <p>思维导图加载失败</p>
      <small>{{ errorMessage || '请检查文件是否有效' }}</small>
      <el-button size="small" type="primary" style="margin-top: 12px" @click="retryLoad">
        重试
      </el-button>
    </div>

    <!-- 默认占位符 -->
    <div v-else class="placeholder">
      <el-icon :size="64"><Connection /></el-icon>
      <p>思维导图</p>
      <small>支持 .mm, .json, .xml 格式</small>
      <el-button size="small" type="primary" style="margin-top: 12px" @click="handleUpload">
        上传导图
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { Connection, Loading, WarningFilled, ZoomIn, ZoomOut, FullScreen } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

const props = defineProps({
  source: Object
});

const emit = defineEmits(['upload-mindmap']);

// 状态管理
const mindmapCanvas = ref(null);
const isLoading = ref(false);
const hasError = ref(false);
const errorMessage = ref('');
const zoomLevel = ref(100);

// 思维导图实例
let mindmapInstance = null;

/**
 * 验证源是否有效
 */
const isValidSource = computed(() => {
  return props.source?.type === 'mindmap' && props.source?.file;
});

/**
 * 缩放控制
 */
const zoomIn = () => {
  if (zoomLevel.value < 200) {
    zoomLevel.value = Math.min(200, zoomLevel.value + 10);
    applyZoom();
  }
};

const zoomOut = () => {
  if (zoomLevel.value > 50) {
    zoomLevel.value = Math.max(50, zoomLevel.value - 10);
    applyZoom();
  }
};

const fitToScreen = () => {
  zoomLevel.value = 100;
  applyZoom();
};

const applyZoom = () => {
  if (mindmapCanvas.value) {
    mindmapCanvas.value.style.transform = `scale(${zoomLevel.value / 100})`;
  }
};

/**
 * 上传导图
 */
const handleUpload = () => {
  emit('upload-mindmap');
};

/**
 * 重试加载
 */
const retryLoad = () => {
  hasError.value = false;
  loadMindmap();
};

/**
 * 加载思维导图
 */
const loadMindmap = async () => {
  if (!isValidSource.value || !mindmapCanvas.value) return;

  isLoading.value = true;
  hasError.value = false;

  try {
    const file = props.source.file;
    const fileName = file?.name || '';
    const fileExt = fileName.split('.').pop()?.toLowerCase();

    // 🎯 注意：实际应用中，这里应该集成真实的思维导图库
    // 例如：MindElixir, MindMap.js, KityMinder等
    // 这里我们提供一个简单的模拟实现

    // 模拟加载延迟
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 根据文件类型选择不同的解析方式
    if (fileExt === 'json') {
      await loadFromJson(file);
    } else if (fileExt === 'xml' || fileExt === 'mm') {
      await loadFromXml(file);
    } else {
      // 默认使用JSON格式
      await loadFromJson(file);
    }

    isLoading.value = false;
    console.log('[MindmapContent] 思维导图加载成功');
  } catch (error) {
    console.error('[MindmapContent] 思维导图加载失败:', error);
    hasError.value = true;
    errorMessage.value = error.message || '文件解析失败';
    isLoading.value = false;
  }
};

/**
 * 从JSON加载
 */
const loadFromJson = async (file) => {
  // 实际应用中应该使用真实文件解析
  console.log('[MindmapContent] 从JSON加载:', file.name);

  // 创建模拟的思维导图
  createSimulatedMindmap();
};

/**
 * 从XML加载
 */
const loadFromXml = async (file) => {
  // 实际应用中应该使用真实XML解析
  console.log('[MindmapContent] 从XML加载:', file.name);

  // 创建模拟的思维导图
  createSimulatedMindmap();
};

/**
 * 创建模拟的思维导图（示例）
 */
const createSimulatedMindmap = () => {
  if (!mindmapCanvas.value) return;

  // 清空容器
  mindmapCanvas.value.innerHTML = '';

  // 创建SVG画布
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.style.background = '#f5f5f5';

  // 创建示例节点
  const nodes = [
    { id: 'root', x: 400, y: 300, text: '中心主题', color: '#4299e1', size: 24 },
    { id: 'node1', x: 200, y: 200, text: '分支1', color: '#48bb78', size: 16, parent: 'root' },
    { id: 'node2', x: 600, y: 200, text: '分支2', color: '#ed8936', size: 16, parent: 'root' },
    { id: 'node3', x: 200, y: 400, text: '分支3', color: '#9f7aea', size: 16, parent: 'root' },
    { id: 'node4', x: 600, y: 400, text: '分支4', color: '#f56565', size: 16, parent: 'root' },
  ];

  // 绘制连线
  const connections = nodes.filter(node => node.parent);
  connections.forEach(node => {
    const parent = nodes.find(n => n.id === node.parent);
    if (parent) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', parent.x);
      line.setAttribute('y1', parent.y);
      line.setAttribute('x2', node.x);
      line.setAttribute('y2', node.y);
      line.setAttribute('stroke', '#a0aec0');
      line.setAttribute('stroke-width', '2');
      svg.appendChild(line);
    }
  });

  // 绘制节点
  nodes.forEach(node => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', node.x);
    circle.setAttribute('cy', node.y);
    circle.setAttribute('r', node.size * 2);
    circle.setAttribute('fill', node.color);
    circle.setAttribute('opacity', '0.8');
    svg.appendChild(circle);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', node.x);
    text.setAttribute('y', node.y);
    text.setAttribute('fill', 'white');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-size', node.size);
    text.setAttribute('font-weight', 'bold');
    text.textContent = node.text;
    svg.appendChild(text);
  });

  mindmapCanvas.value.appendChild(svg);
};

// 监听source变化
watch(() => props.source?.id, (newId, oldId) => {
  if (newId && newId !== oldId) {
    loadMindmap();
  }
});

// 组件挂载时加载思维导图
onMounted(() => {
  if (isValidSource.value) {
    loadMindmap();
  }
});
</script>

<style scoped lang="scss">
.mindmap-content {
  width: 100%;
  height: 100%;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .mindmap-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;

    .mindmap-canvas {
      flex: 1;
      width: 100%;
      height: 100%;
      overflow: auto;
      transition: transform 0.3s ease;
      transform-origin: center center;
    }

    .toolbar {
      position: absolute;
      bottom: 12px;
      right: 12px;
      background: rgba(255, 255, 255, 0.95);
      padding: 8px;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      display: flex;
      gap: 8px;
      z-index: 10;
    }
  }

  .loading-state,
  .error-state,
  .placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #718096;
    gap: 16px;
    padding: 20px;

    p {
      margin: 0;
      font-size: 18px;
      font-weight: 500;
    }

    small {
      font-size: 13px;
      opacity: 0.7;
      text-align: center;
      max-width: 80%;
    }
  }

  .error-state {
    color: #fc8181;
  }
}
</style>
