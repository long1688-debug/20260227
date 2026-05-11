<template>
  <div class="mindmap-container">
    <!-- 思维导图画布 -->
    <div v-if="mindmapData" class="mindmap-canvas">
      <div class="mindmap-content">
        <h2>{{ mindmapData.title || '思维导图' }}</h2>
        <p class="placeholder-text">思维导图功能开发中...</p>
        <p class="hint-text">建议使用以下库实现：</p>
        <ul class="library-list">
          <li>🌳 <strong>jsmind</strong> - 轻量级 JavaScript 思维导图库</li>
          <li>🧠 <strong>mind-elixir</strong> - 现代化的思维导图编辑器</li>
          <li>📊 <strong>d3.js</strong> - 数据可视化库（可自定义实现）</li>
        </ul>
      </div>
    </div>
    
    <!-- 空状态 -->
    <div v-else class="empty-state">
      <el-icon :size="64"><Connection /></el-icon>
      <h3>暂无思维导图</h3>
      <p>请加载或创建新的思维导图</p>
      <el-button type="primary" @click="createNewMindmap">
        <el-icon><Plus /></el-icon>
        创建新导图
      </el-button>
    </div>
    
    <!-- 工具栏 -->
    <div class="mindmap-toolbar" v-if="mindmapData">
      <el-button-group>
        <el-button size="small" @click="zoomIn">
          <el-icon><ZoomIn /></el-icon>
        </el-button>
        <el-button size="small" @click="zoomOut">
          <el-icon><ZoomOut /></el-icon>
        </el-button>
        <el-button size="small" @click="resetZoom">
          <el-icon><Refresh /></el-icon>
        </el-button>
      </el-button-group>
      
      <el-button-group style="margin-left: 12px;">
        <el-button size="small" @click="exportMindmap">
          <el-icon><Download /></el-icon>
          导出
        </el-button>
        <el-button size="small" @click="saveMindmap">
          <el-icon><Document /></el-icon>
          保存
        </el-button>
      </el-button-group>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Connection, Plus, ZoomIn, ZoomOut, Refresh, Download, Document } from '@element-plus/icons-vue';

// 状态
const mindmapData = ref(null);
const zoom = ref(1);

// 方法
const createNewMindmap = () => {
  // TODO: 实现创建新思维导图的逻辑
  mindmapData.value = {
    title: '新建思维导图',
    root: {
      id: 'root',
      topic: '中心主题',
      children: []
    }
  };
  ElMessage.success('已创建新的思维导图');
};

const loadMindmap = (file) => {
  // TODO: 实现加载思维导图文件的逻辑
  // 支持 .xmind, .mm, .json 等格式
  console.log('[MindMap] 加载文件:', file.name);
  ElMessage.info('思维导图加载功能待实现');
};

const zoomIn = () => {
  zoom.value = Math.min(zoom.value + 0.1, 2);
};

const zoomOut = () => {
  zoom.value = Math.max(zoom.value - 0.1, 0.5);
};

const resetZoom = () => {
  zoom.value = 1;
};

const exportMindmap = () => {
  // TODO: 实现导出功能
  ElMessage.info('导出功能待实现');
};

const saveMindmap = () => {
  // TODO: 实现保存功能
  ElMessage.info('保存功能待实现');
};

onMounted(() => {
  // 初始化时可以加载默认数据或从 store 获取
  console.log('[MindMap] 组件已挂载');
});

// 暴露方法给父组件
defineExpose({
  loadMindmap,
  createNewMindmap
});
</script>

<style scoped lang="scss">
.mindmap-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
  position: relative;
}

.mindmap-canvas {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.mindmap-content {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  padding: 40px;
  max-width: 800px;
  width: 100%;
  text-align: center;
  
  h2 {
    margin: 0 0 20px;
    color: #303133;
    font-size: 24px;
  }
  
  .placeholder-text {
    font-size: 16px;
    color: #909399;
    margin-bottom: 24px;
  }
  
  .hint-text {
    font-size: 14px;
    color: #606266;
    margin-bottom: 16px;
  }
  
  .library-list {
    list-style: none;
    padding: 0;
    margin: 0;
    text-align: left;
    
    li {
      padding: 12px 16px;
      margin-bottom: 8px;
      background: #f5f7fa;
      border-radius: 4px;
      font-size: 14px;
      color: #606266;
      transition: all 0.3s;
      
      &:hover {
        background: #e8f4ff;
        transform: translateX(4px);
      }
      
      strong {
        color: #409eff;
      }
    }
  }
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #909399;
  
  h3 {
    margin: 0;
    font-size: 18px;
    color: #606266;
  }
  
  p {
    margin: 0;
    font-size: 14px;
  }
}

.mindmap-toolbar {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  gap: 8px;
  z-index: 10;
  background: rgba(255, 255, 255, 0.9);
  padding: 8px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>
