<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="$emit('update:visible', $event)"
    title="录制文件管理"
    width="900px"
  >
    <div class="recording-manager">
      <!-- 工具栏 -->
      <div class="recording-toolbar">
        <el-button type="primary" size="small" @click="$emit('refresh')">
          <el-icon><Refresh /></el-icon> 刷新列表
        </el-button>
        <el-select 
          :model-value="filter" 
          @update:model-value="$emit('update:filter', $event)"
          size="small" 
          placeholder="筛选类型" 
          style="width: 150px"
        >
          <el-option label="全部" value="all" />
          <el-option label="摄像头" value="camera" />
          <el-option label="本地视频" value="local" />
          <el-option label="屏幕共享" value="screen" />
        </el-select>
      </div>

      <!-- 录制列表 -->
      <el-table :data="recordings" style="width: 100%" max-height="500">
        <el-table-column prop="name" label="文件名" width="200" />
        <el-table-column prop="type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="getSourceTypeTag(row.type)">
              {{ getSourceTypeLabel(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="canvas" label="画布" width="80" />
        <el-table-column prop="duration" label="时长" width="100" />
        <el-table-column prop="size" label="文件大小" width="100" />
        <el-table-column prop="createTime" label="创建时间" width="180" />
        <el-table-column label="操作" fixed="right" width="200">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="$emit('play', row)">
              回放
            </el-button>
            <el-button type="success" size="small" @click="$emit('export', row)">
              导出
            </el-button>
            <el-button type="danger" size="small" @click="$emit('delete', row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </el-dialog>
</template>

<script setup>
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  recordings: {
    type: Array,
    default: () => []
  },
  filter: {
    type: String,
    default: 'all'
  }
});

defineEmits([
  'update:visible',
  'update:filter',
  'play',
  'export',
  'delete',
  'refresh'
]);

const getSourceTypeTag = (type) => {
  const tags = {
    camera: 'success',
    local: 'info',
    screen: 'warning'
  };
  return tags[type] || 'info';
};
};

const getSourceTypeLabel = (type) => {
  const labels = {
    camera: '摄像头',
    local: '本地视频',
    screen: '屏幕共享'
  };
  return labels[type] || type;
};
</script>

<style scoped lang="scss">
.recording-manager {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.recording-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
