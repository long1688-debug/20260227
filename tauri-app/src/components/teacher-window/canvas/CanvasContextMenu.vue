<template>
  <div 
    class="canvas-context-menu"
    :style="{ left: x + 'px', top: y + 'px' }"
    @click.stop
  >
    <div class="menu-item" @click="handleAction('delete')">
      <el-icon><Delete /></el-icon>
      <span>删除</span>
    </div>
    
    <el-divider style="margin: 4px 0" />
    
    <div class="menu-item" @click="handleAction('moveUp')">
      <el-icon><Top /></el-icon>
      <span>上移一层</span>
    </div>
    
    <div class="menu-item" @click="handleAction('moveDown')">
      <el-icon><Bottom /></el-icon>
      <span>下移一层</span>
    </div>
    
    <div class="menu-item" @click="handleAction('bringToFront')">
      <el-icon><SortUp /></el-icon>
      <span>置顶</span>
    </div>
    
    <div class="menu-item" @click="handleAction('sendToBack')">
      <el-icon><SortDown /></el-icon>
      <span>置底</span>
    </div>
    
    <el-divider style="margin: 4px 0" />
    
    <div class="menu-item" @click="handleAction('toggleVisibility')">
      <el-icon><component :is="source.visible ? 'Hide' : 'View'" /></el-icon>
      <span>{{ source.visible ? '隐藏' : '显示' }}</span>
    </div>
    
    <div class="menu-item" @click="handleAction('toggleLock')">
      <el-icon><component :is="source.locked ? 'Unlock' : 'Lock'" /></el-icon>
      <span>{{ source.locked ? '解锁' : '锁定' }}</span>
    </div>
    
    <el-divider style="margin: 4px 0" />
    
    <div class="menu-item" @click="handleAction('fullscreen')">
      <el-icon><FullScreen /></el-icon>
      <span>全屏</span>
    </div>
    
    <div class="menu-item" @click="handleAction('properties')">
      <el-icon><Setting /></el-icon>
      <span>属性</span>
    </div>
  </div>
</template>

<script setup>
import { Delete, Top, Bottom, SortUp, SortDown, Hide, View, Lock, Unlock, FullScreen, Setting } from '@element-plus/icons-vue';

const props = defineProps({
  x: Number,
  y: Number,
  source: Object
});

const emit = defineEmits(['close', 'action']);

const handleAction = (action) => {
  emit('action', { action, source: props.source });
};
</script>

<style scoped lang="scss">
.canvas-context-menu {
  position: fixed;
  background: #2d3748;
  border: 1px solid #4a5568;
  border-radius: 6px;
  padding: 6px 0;
  min-width: 160px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 9999;
  
  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    color: white;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.2s;
    
    &:hover {
      background: #4a5568;
    }
    
    .el-icon {
      font-size: 16px;
    }
  }
}
</style>
