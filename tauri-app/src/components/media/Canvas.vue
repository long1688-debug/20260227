<template>
  <div
    id="canvas-container"
    class="canvas"
    @drop="handleDrop"
    @dragover="handleDragOver"
  >
    <!-- 视频块列表 -->
    <VideoTile
      v-for="tile in tiles"
      :key="tile.id"
      :tile="tile"
      :source="sources.get(tile.sourceId)"
      @update-position="handleUpdatePosition"
      @set-master="handleSetMaster"
    />
    
    <!-- 空状态提示 -->
    <div v-if="tiles.length === 0" class="empty-state">
      <el-icon :size="48"><Upload /></el-icon>
      <p>拖拽视频或摄像头到此区域</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { Upload } from '@element-plus/icons-vue';
import { useMediaStore } from '@/stores/mediaStore';
import VideoTile from './VideoTile.vue';
import { v4 as uuidv4 } from 'uuid';

const mediaStore = useMediaStore();

// Computed
const sources = computed(() => mediaStore.sources);
const tiles = computed(() => mediaStore.tiles);

// Methods
const handleDrop = (e) => {
  e.preventDefault();
  
  const sourceId = e.dataTransfer.getData('text/plain');
  if (!sourceId) return;
  
  const source = sources.value.get(sourceId);
  if (!source) {
    console.warn('[Canvas] 未找到源:', sourceId);
    return;
  }
  
  // 计算放置位置
  const container = e.currentTarget;
  const rect = container.getBoundingClientRect();
  const x = e.clientX - rect.left - 160; // 假设tile宽度320,偏移一半
  const y = e.clientY - rect.top - 90;   // 假设tile高度180
  
  // 检查该sourceId是否已有主音频tile
  const existingMaster = tiles.value.find(
    t => t.sourceId === sourceId && t.isAudioMaster
  );
  
  // 创建新的tile
  const newTileId = uuidv4();
  const newTile = {
    id: newTileId,
    sourceId,
    position: {
      x: Math.max(0, Math.min(x, rect.width - 320)),
      y: Math.max(0, Math.min(y, rect.height - 180))
    },
    size: { width: 320, height: 180 },
    isAudioMaster: !existingMaster // 如果没有主音频,则自动成为主音频
  };
  
  // 添加到store
  mediaStore.addTile(newTile);
  
  // 如果没有主音频,则设置该tile为主音频
  if (!existingMaster) {
    mediaStore.setTileMaster(newTileId, sourceId);
  }
  
  console.log('[Canvas] 添加画布块:', newTileId, '源:', sourceId);
};

const handleDragOver = (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
};

const handleUpdatePosition = ({ tileId, position }) => {
  mediaStore.updateTile(tileId, { position });
};

const handleSetMaster = (tileId, sourceId) => {
  mediaStore.setTileMaster(tileId, sourceId);
};
</script>

<style scoped>
.canvas {
  position: relative;
  width: 100%;
  height: 100%;
  background: #1e1e1e;
  overflow: hidden;
  border: 2px dashed #444;
  border-radius: 8px;
}

.empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #888;
  text-align: center;
}

.empty-state p {
  margin-top: 12px;
  font-size: 14px;
}
</style>
