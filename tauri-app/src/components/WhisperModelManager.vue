<template>
  <div class="whisper-model-manager">
    <!-- 面板头部 -->
    <div class="panel-header">
      <div class="panel-title">
        <el-icon><Download /></el-icon>
        <span>Whisper 模型管理</span>
      </div>
      <el-tag size="small" type="info">
        {{ storageUsage.count }} 个模型已下载（{{ storageUsage.totalSizeGB }} GB）
      </el-tag>
    </div>

    <!-- 当前使用模型 -->
    <div class="current-model-section">
      <div class="section-label">当前使用的模型</div>
      <el-select v-model="selectedModel" @change="handleModelSwitch" style="width: 100%">
        <el-option
          v-for="model in downloadedModels"
          :key="model.id"
          :label="`${model.name} (${model.size})`"
          :value="model.id"
        >
          <span>{{ model.name }}</span>
          <span style="float: right; color: #8492a6; font-size: 13px">{{ model.size }}</span>
        </el-option>
      </el-select>
      <div class="model-description">
        {{ currentModelDescription }}
      </div>
    </div>

    <!-- 可用模型列表 -->
    <div class="models-list">
      <div class="section-label">可用模型</div>

      <div
        v-for="model in models"
        :key="model.id"
        class="model-card"
        :class="{ 'is-current': model.id === selectedModel }"
      >
        <div class="model-info">
          <div class="model-name-row">
            <span class="model-name">{{ model.name }}</span>
            <el-tag v-if="model.downloaded" size="small" type="success">已下载</el-tag>
            <el-tag v-else-if="model.downloading" size="small" type="warning">下载中</el-tag>
            <el-tag v-else size="small" type="info">未下载</el-tag>
          </div>
          <div class="model-size">{{ model.size }}</div>
          <div class="model-desc">{{ model.description }}</div>

          <!-- 下载进度条 -->
          <el-progress
            v-if="model.downloading"
            :percentage="model.progress"
            :stroke-width="4"
            style="margin-top: 8px"
          />

          <!-- 错误信息 -->
          <div v-if="model.error" class="model-error">
            <el-icon color="#f56c6c"><WarningFilled /></el-icon>
            <span>{{ model.error }}</span>
          </div>
        </div>

        <div class="model-actions">
          <el-button
            v-if="!model.downloaded && !model.downloading"
            type="primary"
            size="small"
            @click="handleDownload(model.id)"
          >
            下载
          </el-button>

          <el-button
            v-else-if="model.downloading"
            size="small"
            disabled
          >
            {{ model.progress }}%
          </el-button>

          <el-button
            v-else-if="model.id !== selectedModel"
            type="success"
            size="small"
            @click="handleModelSwitch(model.id)"
          >
            切换
          </el-button>

          <el-button
            v-else
            size="small"
            disabled
          >
            使用中
          </el-button>

          <el-button
            v-if="model.downloaded"
            type="danger"
            size="small"
            link
            @click="handleDelete(model.id)"
          >
            删除
          </el-button>
        </div>
      </div>
    </div>

    <!-- 说明信息 -->
    <el-alert
      title="模型说明"
      type="info"
      :closable="false"
      style="margin-top: 16px"
    >
      <template #default>
        <ul style="margin: 0; padding-left: 20px">
          <li><strong>Tiny/Base:</strong> 适合实时语音输入，速度快</li>
          <li><strong>Small/Medium:</strong> 平衡速度和精度，推荐日常使用</li>
          <li><strong>Large:</strong> 最高精度，适合会议记录等场景</li>
          <li>模型文件存储在：~/.cache/whisper/</li>
        </ul>
      </template>
    </el-alert>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, WarningFilled } from '@element-plus/icons-vue'
import {
  getModels,
  getCurrentModel,
  downloadModel,
  deleteModel,
  switchModel,
  getStorageUsage,
  initModelManager,
  type WhisperModel,
  type DownloadProgress
} from '@/utils/whisperModelManager'

// ==================== 状态 ====================

const models = ref<WhisperModel[]>([])
const selectedModel = ref<string>('base')
const storageUsage = ref({ count: 0, totalSizeMB: 0, totalSizeGB: '0.00' })

// ==================== 计算属性 ====================

const downloadedModels = computed(() => {
  return models.value.filter(m => m.downloaded)
})

const currentModelDescription = computed(() => {
  const model = models.value.find(m => m.id === selectedModel.value)
  return model ? model.description : ''
})

// ==================== 方法 ====================

/**
 * 加载模型列表
 */
async function loadModels() {
  await initModelManager()
  models.value = getModels()
  const current = getCurrentModel()
  if (current) {
    selectedModel.value = current.id
  }
  storageUsage.value = getStorageUsage()
}

/**
 * 下载模型
 */
async function handleDownload(modelId: string) {
  try {
    ElMessage.info(`开始下载 ${modelId} 模型...`)

    await downloadModel(modelId, (progress: DownloadProgress) => {
      // 更新 UI（响应式会自动更新）
      console.log('[ModelManager] 下载进度:', progress)
    })

    ElMessage.success(`${modelId} 模型下载完成！`)
    await loadModels() // 重新加载
  } catch (error) {
    ElMessage.error(`下载失败: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * 删除模型
 */
async function handleDelete(modelId: string) {
  try {
    await ElMessageBox.confirm(
      `确定要删除 ${modelId} 模型吗？删除后需要重新下载。`,
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await deleteModel(modelId)
    ElMessage.success('模型删除成功')
    await loadModels() // 重新加载
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(`删除失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

/**
 * 切换模型
 */
async function handleModelSwitch(modelId: string) {
  if (modelId === selectedModel.value) {
    return
  }

  try {
    ElMessage.info(`正在切换到 ${modelId} 模型...`)

    await switchModel(modelId)

    selectedModel.value = modelId
    ElMessage.success('模型切换成功！')
  } catch (error) {
    ElMessage.error(`切换失败: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// ==================== 生命周期 ====================

onMounted(() => {
  loadModels()
})
</script>

<style scoped>
.whisper-model-manager {
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e4e7ed;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.section-label {
  font-size: 14px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 12px;
}

.current-model-section {
  margin-bottom: 20px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 6px;
}

.model-description {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}

.models-list {
  margin-top: 16px;
}

.model-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  margin-bottom: 8px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  transition: all 0.3s;
}

.model-card:hover {
  border-color: #409eff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
}

.model-card.is-current {
  border-color: #67c23a;
  background: #f0f9ff;
}

.model-info {
  flex: 1;
}

.model-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.model-name {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.model-size {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.model-desc {
  font-size: 12px;
  color: #606266;
}

.model-error {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  font-size: 12px;
  color: #f56c6c;
}

.model-actions {
  display: flex;
  gap: 8px;
  margin-left: 12px;
}
</style>
