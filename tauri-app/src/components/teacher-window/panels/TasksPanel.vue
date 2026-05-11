/**
 * 任务管理面板组件
 * 
 * @description 提供考试/实训任务的管理功能，包括：
 * - 任务列表展示（类型、状态、截止时间）
 * - 创建和编辑任务
 * - 发布和管理任务
 * - 任务删除等功能
 * 
 * @usage
 * 1. 在 SidePanel 中使用（作为快速管理入口）
 * 2. 在 VisionAnalysisWindow 的任务模式中复用（需要提取为子组件）
 * 
 * @note
 * - 此组件与 VisionAnalysisWindow 中的任务管理功能重复
 * - 建议后续统一使用此组件或将其逻辑整合到 AI 分析窗口
 */
<template>
  <div class="tasks-panel">
    <div class="panel-header">
      <h3 class="panel-title">任务管理</h3>
      <div class="panel-actions">
        <el-button type="primary" size="small" @click="handleAddTask">新建任务</el-button>
      </div>
    </div>

    <div class="panel-content">
      <el-table :data="tasks" height="100%" stripe>
        <el-table-column prop="id" label="ID" width="50" />
        <el-table-column prop="name" label="任务名称" width="150" />
        <el-table-column prop="type" label="类型" width="80">
          <template #default="{ row }">
            <el-tag>{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="deadline" label="截止时间" width="150" />
        <el-table-column label="操作" fixed="right" width="180">
          <template #default="{ row }">
            <button class="table-action-btn table-action-btn-default" @click="handleEdit(row)">编辑</button>
            <button class="table-action-btn table-action-btn-primary" @click="handlePublish(row)">发布</button>
            <button class="table-action-btn table-action-btn-danger" @click="handleDelete(row)">删除</button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useTaskStore } from '@/stores/taskStore'

const taskStore = useTaskStore()
const tasks = computed(() => taskStore.tasks)

const getStatusType = (status) => {
  const map = { draft: 'info', published: 'success', closed: 'danger' }
  return map[status] || 'info'
}

const handleAddTask = () => {
  ElMessage.info('打开新建任务对话框')
}

const handleEdit = (task) => {
  ElMessage.info(`编辑任务: ${task.name}`)
}

const handlePublish = (task) => {
  taskStore.publishTask(task.id)
  ElMessage.success('任务已发布')
}

const handleDelete = (task) => {
  taskStore.deleteTask(task.id)
  ElMessage.success('任务已删除')
}

onMounted(() => {
  taskStore.fetchTasks()
})
</script>

<style lang="scss" scoped>
.tasks-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  background: #0D1B2A;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;

  :deep(.el-button) {
    padding: 5px 10px;
    font-size: 11px;
  }
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #E0E1DD;
  margin: 0;
}

.panel-actions {
  display: flex;
  gap: 6px;
}

.panel-content {
  flex: 1;
  overflow: hidden;

  :deep(.el-table) {
    --el-table-bg-color: #0D1B2A !important;
    --el-table-header-bg-color: #141f2e !important;
    --el-table-header-text-color: #E0E1DD !important;
    --el-table-row-hover-bg-color: rgba(255, 255, 255, 0.05) !important;
    --el-table-row-bg-color: #0D1B2A !important;
    --el-table-row-bg-color-hover: rgba(255, 255, 255, 0.05) !important;
    --el-table-row-bg-color-striped: #141f2e !important;
    --el-table-border-color: #1A2A3A !important;
    --el-table-text-color: #E0E1DD !important;

    background: #0D1B2A !important;

    &::before {
      background: transparent !important;
      height: 0 !important;
    }

    // 表头整体
    .el-table__header {
      background: #141f2e !important;
    }

    // 表头包装器
    .el-table__header-wrapper {
      background: #141f2e !important;

      .el-table__header-row {
        background: #141f2e !important;

        .el-table__cell {
          color: #E0E1DD !important;
          border-bottom: 1px solid #2d3a4f !important;
          background: #141f2e !important;
        }
      }

      // 表头 th 元素
      thead {
        background: #141f2e !important;

        tr {
          background: #141f2e !important;

          th {
            background: #141f2e !important;
            color: #E0E1DD !important;
            border-bottom-color: #2d3a4f !important;
          }
        }
      }
    }

    // 表头单元格直接覆盖
    .el-table__header-cell {
      background: #141f2e !important;
      color: #E0E1DD !important;
    }

    .el-table__body-wrapper {
      background: #0D1B2A !important;

      .el-table__row {
        background: #0D1B2A !important;

        &.el-table__row--striped {
          background: #141f2e !important;
        }

        .el-table__cell {
          color: #E0E1DD !important;
          border-bottom: 1px solid #1A2A3A !important;
          background: inherit !important;
        }

        &:hover {
          background: rgba(255, 255, 255, 0.05) !important;

          .el-table__cell {
            background: rgba(255, 255, 255, 0.05) !important;
          }
        }
      }
    }

    .el-tag {
      background: rgba(255, 255, 255, 0.1) !important;
      color: #E0E1DD !important;
      border: none !important;
    }
  }
}

// 统一表格操作按钮样式
.table-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-right: 4px;
  font-family: inherit;
  white-space: nowrap;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }
}

.table-action-btn-primary {
  background: linear-gradient(135deg, #4a90d9 0%, #357abd 100%);
  color: #fff;

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #5a9fe9 0%, #458acd 100%);
  }
}

.table-action-btn-default {
  background: rgba(255, 255, 255, 0.1);
  color: #e8e8e8;
  border: 1px solid rgba(255, 255, 255, 0.2);

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.18);
    border-color: rgba(255, 255, 255, 0.3);
  }
}

.table-action-btn-danger {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: #fff;

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
  }
}