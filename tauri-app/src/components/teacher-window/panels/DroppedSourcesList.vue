<template>
  <div class="dropped-sources-panel">
    <!-- 标题栏 -->
    <div class="panel-header">
      <h3>已放置信号源</h3>
      <span class="source-count">{{ placedSources.length }} 个</span>
    </div>

    <!-- 信号源列表 -->
    <div class="dropped-sources-list">
      <div v-if="placedSources.length === 0" class="empty-state">
        <div class="empty-icon">📺</div>
        <p>视频区域暂无信号源</p>
        <p class="empty-hint">从预览区域拖拽信号源到视频区域</p>
      </div>

      <div v-else class="sources-list">
        <div
          v-for="item in placedSources"
          :key="item.source.id"
          class="dropped-source-item"
          :class="{
            'is-maximized': item.canvasIndex === maximizedIndex,
            'is-active': selectedSourceId === item.source.id
          }"
        >
          <!-- 信号源信息 -->
          <div class="source-main" @click="handleSelectSource(item.source)">
            <div class="source-icon">{{ getSourceTypeIcon(item.source.type) }}</div>
            <div class="source-info">
              <div class="source-name-row">
                <span class="source-name">{{ item.source.name }}</span>
                <el-tag
                  v-if="item.source.isClone"
                  type="info"
                  size="small"
                  effect="plain"
                >
                  克隆
                </el-tag>
              </div>
              <div class="source-meta">
                <span class="canvas-badge">
                  <el-icon><VideoCamera /></el-icon>
                  画面 {{ item.canvasIndex }}
                </span>
                <span class="source-type">{{ getSourceTypeLabel(item.source.type) }}</span>
              </div>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="source-actions">
            <el-button
              size="small"
              :type="selectedSourceId === item.source.id ? 'primary' : 'default'"
              @click.stop="handleSelectSource(item.source)"
              title="选中信号源"
            >
              <el-icon><Select /></el-icon>
            </el-button>
            <el-button
              size="small"
              type="warning"
              @click.stop="handleRemoveFromCanvas(item.canvasIndex, item.source)"
              title="从视频区域移除"
            >
              <el-icon><Close /></el-icon>
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 批量操作 -->
    <div v-if="placedSources.length > 0" class="bulk-actions">
      <el-button size="small" @click="handleClearAll" type="danger" plain>
        <el-icon><Delete /></el-icon>
        清空所有
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { VideoCamera, Select, Close, Delete } from '@element-plus/icons-vue'
import { useCanvasStore } from '@/stores/canvasStore'
import { useSourceStore } from '@/stores/sourceStore'
import { useLayoutStates } from '@/composables/useLayoutStates'

const props = defineProps({
  canvasSourceMap: {
    type: Object,
    default: () => ({})
  },
  allSources: {
    type: Array,
    default: () => []
  },
  currentLayout: {
    type: Number,
    default: 1
  },
  maximizedIndex: {
    type: Number,
    default: null
  }
})

const emit = defineEmits(['source-selected', 'remove-from-canvas', 'clear-all'])

// Store
const canvasStore = useCanvasStore()
const sourceStore = useSourceStore()

// 选中的源ID
const selectedSourceId = ref(null)

// 计算已放置的信号源列表
const placedSources = computed(() => {
  const result = []

  // 遍历 canvasSourceMap，获取每个画布上的源
  Object.entries(props.canvasSourceMap).forEach(([canvasIndex, sourceId]) => {
    if (sourceId) {
      const source = props.allSources.find(s => s.id === sourceId)
      if (source) {
        result.push({
          canvasIndex: parseInt(canvasIndex),
          source: source
        })
      }
    }
  })

  // 按画布索引排序
  return result.sort((a, b) => a.canvasIndex - b.canvasIndex)
})

// 获取源类型图标
const getSourceTypeIcon = (type) => {
  const icons = {
    localCamera: '📹',
    captureCard: '🎥',
    documentScanner: '📷',
    networkCamera: '🌐',
    mrCamera: '🥽',
    remoteDesktop: '🖥️',
    remoteCamera: '📡',
    mobileCamera: '📱',
    mobileScreen: '📲',
    localVideo: '🎬',
    networkStream: '📺',
    webpage: '🌍',
    ppt: '📊',
    word: '📝',
    mindmap: '🧠'
  }
  return icons[type] || '📺'
}

// 获取源类型标签
const getSourceTypeLabel = (type) => {
  const labels = {
    localCamera: '本地摄像头',
    captureCard: '采集卡',
    documentScanner: '文档扫描仪',
    networkCamera: '网络摄像头',
    mrCamera: 'MR相机',
    remoteDesktop: '远程桌面',
    remoteCamera: '远程摄像头',
    mobileCamera: '移动摄像头',
    mobileScreen: '移动屏幕',
    localVideo: '本地视频',
    networkStream: '网络流',
    webpage: '网页',
    ppt: 'PPT',
    word: 'Word',
    mindmap: '思维导图'
  }
  return labels[type] || type
}

// 选中信号源
const handleSelectSource = (source) => {
  selectedSourceId.value = source.id
  emit('source-selected', source)
}

// 从画布移除信号源
const handleRemoveFromCanvas = async (canvasIndex, source) => {
  try {
    await ElMessageBox.confirm(
      `确定将 "${source.name}" 从画面 ${canvasIndex} 移除吗？`,
      '移除信号源',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    emit('remove-from-canvas', { canvasIndex, sourceId: source.id })
  } catch {
    // 用户取消
  }
}

// 清空所有
const handleClearAll = async () => {
  try {
    await ElMessageBox.confirm(
      `确定清空所有视频区域的信号源吗？`,
      '清空所有信号源',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    emit('clear-all')
  } catch {
    // 用户取消
  }
}
</script>

<style scoped lang="scss">
.dropped-sources-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #f5f7fa;
    border-bottom: 1px solid #e4e7ed;

    h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: #303133;
    }

    .source-count {
      font-size: 12px;
      color: #909399;
      background: #e4e7ed;
      padding: 2px 8px;
      border-radius: 10px;
    }
  }

  .dropped-sources-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      text-align: center;
      color: #909399;

      .empty-icon {
        font-size: 48px;
        margin-bottom: 12px;
        opacity: 0.5;
      }

      p {
        margin: 4px 0;
        font-size: 13px;
      }

      .empty-hint {
        font-size: 12px;
        color: #C0C4CC;
      }
    }

    .sources-list {
      display: flex;
      flex-direction: column;
      gap: 8px;

      .dropped-source-item {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 10px 12px;
        background: #fafafa;
        border: 1px solid #e4e7ed;
        border-radius: 6px;
        transition: all 0.2s;

        &:hover {
          border-color: #409eff;
          background: #ecf5ff;
        }

        &.is-maximized {
          border-color: #e6a23c;
          background: #fdf6ec;
        }

        &.is-active {
          border-color: #409eff;
          background: #ecf5ff;
          box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
        }

        .source-main {
          display: flex;
          gap: 10px;
          flex: 1;
          cursor: pointer;

          .source-icon {
            font-size: 24px;
            flex-shrink: 0;
          }

          .source-info {
            flex: 1;
            min-width: 0;

            .source-name-row {
              display: flex;
              align-items: center;
              gap: 6px;
              margin-bottom: 4px;

              .source-name {
                font-size: 13px;
                font-weight: 500;
                color: #303133;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }
            }

            .source-meta {
              display: flex;
              align-items: center;
              gap: 8px;
              font-size: 11px;
              color: #909399;

              .canvas-badge {
                display: inline-flex;
                align-items: center;
                gap: 3px;
                padding: 1px 6px;
                background: #409eff;
                color: #fff;
                border-radius: 4px;
              }

              .source-type {
                color: #606266;
              }
            }
          }
        }

        .source-actions {
          display: flex;
          gap: 4px;
          flex-shrink: 0;
          margin-left: 8px;
        }
      }
    }
  }

  .bulk-actions {
    padding: 8px 12px;
    border-top: 1px solid #e4e7ed;
    background: #fafafa;

    display: flex;
    justify-content: center;
  }
}
</style>
