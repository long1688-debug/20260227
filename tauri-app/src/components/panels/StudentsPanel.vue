<template>
  <div class="students-panel">
    <el-table :data="students" style="width: 100%" :header-cell-style="{ background: '#0A1525', color: '#FFFFFF' }">
      <el-table-column prop="name" label="姓名" width="100" />
      <el-table-column prop="id" label="学号" width="100" />
      <el-table-column prop="class" label="班级" width="150" />
      <el-table-column prop="status" label="状态">
        <template #default="scope">
          <span :class="['status-text', scope.row.statusClass]">
            {{ scope.row.status }}
          </span>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const students = ref([
  { name: '张三', id: '20240001', class: '新能源汽车 1 班', status: '训练中', statusClass: 'training' },
  { name: '李四', id: '20240002', class: '新能源汽车 1 班', status: '等待中', statusClass: 'waiting' },
  { name: '王五', id: '20240003', class: '新能源汽车 1 班', status: '已完成', statusClass: 'completed' }
]);
</script>

<style lang="scss" scoped>
.students-panel {
  height: 100%;
  overflow: auto;
}

:deep(.el-table) {
  background: #0A1525;
  
  .el-table__header th {
    background: #0A1525 !important;
    color: #FFFFFF;
    border-color: #1A2A3A;
  }
  
  .el-table__row {
    background: #0A1525;
    
    &:hover {
      background: #1A2A3A !important;
    }
    
    td {
      border-color: #1A2A3A;
      color: #FFFFFF;
    }
  }
}

.status-text {
  &.training {
    color: #00BFFF;
  }
  
  &.waiting {
    color: #AAAAAA;
  }
  
  &.completed {
    color: #00FF00;
  }
}
</style>
