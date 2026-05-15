<template>
  <div class="canvas-toolbar">
    <el-button-group>
      <el-tooltip content="添加视频" placement="bottom">
        <el-button size="small" @click="addSource('video')">
          <el-icon><VideoPlay /></el-icon>
        </el-button>
      </el-tooltip>
      
      <el-tooltip content="添加文字" placement="bottom">
        <el-button size="small" @click="addSource('text')">
          <el-icon><Document /></el-icon>
        </el-button>
      </el-tooltip>
      
      <el-tooltip content="添加图片" placement="bottom">
        <el-button size="small" @click="addSource('image')">
          <el-icon><Picture /></el-icon>
        </el-button>
      </el-tooltip>
      

      

      

      
      <el-tooltip content="远程桌面" placement="bottom">
        <el-button size="small" @click="addSource('remote_desktop')">
          <el-icon><Monitor /></el-icon>
        </el-button>
      </el-tooltip>
      
      <el-tooltip content="添加摄像机" placement="bottom">
        <el-button size="small" @click="addSource('camera')">
          <el-icon><Camera /></el-icon>
        </el-button>
      </el-tooltip>
    </el-button-group>
    
    <el-divider direction="vertical" />
    
    <el-tooltip content="清空画布" placement="bottom">
      <el-button size="small" type="danger" @click="handleClearCanvas">
        <el-icon><Delete /></el-icon>
      </el-button>
    </el-tooltip>
  </div>
</template>

<script setup>
import { 
  VideoPlay, Document, Picture, Link, Files, 
  Connection, Monitor, Camera, Delete 
} from '@element-plus/icons-vue';
import { useCanvasStore } from '@/stores/canvasStore';
import { ElMessageBox } from 'element-plus';

const canvasStore = useCanvasStore();

const addSource = (type) => {
  canvasStore.addSource(type);
};

const handleClearCanvas = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清空画布吗?此操作不可恢复。',
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );
    canvasStore.clearCanvas();
  } catch {
    // 用户取消
  }
};
</script>

<style scoped lang="scss">
.canvas-toolbar {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(45, 55, 72, 0.95);
  padding: 8px 12px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
