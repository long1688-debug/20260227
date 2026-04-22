<template>
  <div class="source-management-shortcut">
    <el-empty 
      :image-size="80" 
      description="请通过「信号源」按钮弹出管理对话框"
    >
      <template #description>
        <p class="empty-text">
          点击侧边栏顶部的
          <el-button 
            type="primary" 
            size="small" 
            @click="$emit('show-add-source')"
          >
            <el-icon><Plus /></el-icon>
            信号源
          </el-button>
          按钮添加和管理信号源
        </p>
      </template>
    </el-empty>
    
    <!-- 快捷操作提示 -->
    <div class="quick-tips">
      <div class="tip-item">
        <el-icon><InfoFilled /></el-icon>
        <span>支持拖拽信号源到画布</span>
      </div>
      <div class="tip-item">
        <el-icon><InfoFilled /></el-icon>
        <span>双击视频格子可最大化</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Plus, InfoFilled } from '@element-plus/icons-vue'

interface Emits {
  (e: 'show-add-source'): void
}

const emit = defineEmits<Emits>()
</script>

<style scoped lang="scss">
.source-management-shortcut {
  padding: 20px;
  text-align: center;
  color: #778DA9;
}

.empty-text {
  font-size: 14px;
  line-height: 1.6;
  margin-top: 8px;
  
  .el-button {
    vertical-align: middle;
  }
}

.quick-tips {
  margin-top: 20px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
  text-align: left;
}

.tip-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;

  &:last-child {
    margin-bottom: 0;
  }

  .el-icon {
    font-size: 14px;
    color: #409eff;
  }
}
</style>
