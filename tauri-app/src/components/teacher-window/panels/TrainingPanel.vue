/**
 * 实训管理面板组件
 * 
 * @description 提供实训项目的管理功能，包括：
 * - 实训项目列表（参与学生数、进度）
 * - 创建新实训项目
 * - 启动和查看实训
 * - 进度跟踪等功能
 * 
 * @usage
 * 1. 在 SidePanel 中使用（作为快速管理入口）
 * 2. 在 VisionAnalysisWindow 的实训模式中复用（需要提取为子组件）
 * 
 * @note
 * - 此组件与 VisionAnalysisWindow 中的实训管理功能重复
 * - 建议后续统一使用此组件或将其逻辑整合到 AI 分析窗口
 */
<template>
  <div class="training-panel">
    <div class="panel-header">
      <h3 class="panel-title">实训管理</h3>
      <div class="panel-actions">
        <el-button type="primary" size="small" @click="handleCreate">新建实训</el-button>
      </div>
    </div>

    <div class="panel-content">
      <div v-for="training in trainings" :key="training.id" class="training-card">
        <div class="training-header">
          <span class="training-name">{{ training.name }}</span>
          <el-tag :type="getStatusType(training.status)">{{ training.status }}</el-tag>
        </div>
        <div class="training-info">
          <span>参与学生: {{ training.studentCount }}</span>
          <span>进度: {{ training.progress }}%</span>
        </div>
        <div class="training-progress">
          <el-progress :percentage="training.progress" :status="getProgressStatus(training.progress)" />
        </div>
        <div class="training-actions">
          <el-button size="small" @click="handleView(training)">查看</el-button>
          <el-button size="small" type="primary" @click="handleStart(training)">开始</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useTrainingStore } from '@/stores/trainingStore'

const trainingStore = useTrainingStore()
const trainings = computed(() => trainingStore.trainings)

const getStatusType = (status) => {
  const map = { pending: 'info', ongoing: 'success', completed: 'danger' }
  return map[status] || 'info'
}

const getProgressStatus = (progress) => {
  if (progress >= 100) return 'success'
  if (progress > 50) return 'warning'
  return undefined
}

const handleCreate = () => {
  ElMessage.info('打开新建实训对话框')
}

const handleView = (training) => {
  ElMessage.info(`查看实训: ${training.name}`)
}

const handleStart = (training) => {
  trainingStore.startTraining(training.id)
  ElMessage.success('实训已开始')
}

onMounted(() => {
  trainingStore.fetchTrainings()
})
</script>

<style lang="scss" scoped>
.training-panel {
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

.panel-content {
  flex: 1;
  overflow-y: auto;
}

.training-card {
  background: #0F2035;
  border: 1px solid #1A2A3A;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 8px;
}

.training-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.training-name {
  font-size: 13px;
  font-weight: 500;
  color: #FFFFFF;
}

.training-info {
  display: flex;
  gap: 10px;
  font-size: 11px;
  color: #778DA9;
  margin-bottom: 8px;
}

.training-progress {
  margin-bottom: 8px;
}

.training-actions {
  display: flex;
  gap: 6px;

  :deep(.el-button) {
    padding: 4px 8px;
    font-size: 11px;
  }
}
</style>
