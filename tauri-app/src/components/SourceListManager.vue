<template>
  <div class="source-list-manager">
    <!-- 信号源列表头部 -->
    <div class="list-header">
      <h4>信号源管理 ({{ filteredSources.length }})</h4>
      <div class="header-actions">
        <el-button type="info" size="small" @click="$emit('refresh')">
          <el-icon><Refresh /></el-icon> 刷新
        </el-button>
        <el-button type="primary" size="small" @click="$emit('add')">
          <el-icon><Plus /></el-icon> 添加信号源
        </el-button>
      </div>
    </div>

    <!-- 信号源列表 -->
    <div class="source-list-container">
      <div v-if="filteredSources.length === 0" class="empty-state">
        <el-empty description="暂无信号源" :image-size="80">
          <el-button type="primary" @click="$emit('add')">添加信号源</el-button>
        </el-empty>
      </div>

      <div v-else class="source-list">
        <div
          v-for="source in filteredSources"
          :key="source.id"
          class="source-list-item"
          :class="{ 'added-to-preview': source.addedToPreview }"
        >
          <!-- 信号源信息 -->
          <div class="source-info">
            <div class="source-main-info">
              <span class="source-type-icon">{{ getSourceTypeIcon(source.type) }}</span>
              <div class="source-details">
                <span class="source-name">{{ source.name }}</span>
                <el-tag :type="getSourceTypeTag(source.type)" size="small">
                  {{ getSourceTypeLabel(source.type) }}
                </el-tag>
              </div>
            </div>
            <div class="source-status">
              <span class="status-dot" :class="{ online: source.status === 'online' }"></span>
              <span class="status-text">{{ source.status === 'online' ? '在线' : '离线' }}</span>
              <el-tag v-if="source.addedToPreview" type="success" size="small" effect="plain">
                已添加
              </el-tag>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="source-actions">
            <!-- 添加到预览区域（仅在未添加时显示） -->
            <el-button
              v-if="!source.addedToPreview"
              type="primary"
              size="small"
              @click="handleAddToPreview(source)"
            >
              <el-icon><VideoPlay /></el-icon> 添加到预览
            </el-button>

            <!-- 从预览移除（仅在已添加时显示） -->
            <el-button
              v-else
              type="warning"
              size="small"
              @click="handleRemoveFromPreview(source)"
            >
              <el-icon><Close /></el-icon> 从预览移除
            </el-button>

            <!-- 重命名 -->
            <el-button
              type=""
              size="small"
              @click="handleRename(source)"
            >
              <el-icon><Edit /></el-icon>
            </el-button>

            <!-- 删除（允许删除任何信号源，无论是否已添加到预览） -->
            <el-tooltip
              content="删除信号源"
              placement="top"
            >
              <el-button
                type="danger"
                size="small"
                @click="handleDelete(source.id)"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </el-tooltip>
          </div>
        </div>
      </div>
    </div>

    <!-- 分页控件 -->
    <div v-if="totalPages > 1" class="pagination-container">
      <el-pagination
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :total="allSources.length"
        layout="prev, pager, next"
        :hide-on-single-page="true"
        small
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { ElMessageBox, ElMessage } from 'element-plus';
import { Refresh, Plus, VideoPlay, Close, Edit, Delete } from '@element-plus/icons-vue';
import { SOURCE_TYPE_OPTIONS, getSourceTypeIcon, getSourceTypeLabel, getSourceTypeTag } from '@/constants/sourceTypes';

const props = defineProps({
  allSources: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['refresh', 'add', 'rename', 'delete', 'add-to-preview', 'remove-from-preview']);

// 分页状态
const currentPage = ref(1);
const pageSize = ref(10);

// ==================== 计算属性 ====================

// 定义需要过滤掉的信号源类型（媒体文件、屏幕共享、文档课件等）
// 这些类型应该在右侧面板单独显示，不显示在信号源列表中
const EXCLUDED_SOURCE_TYPES = [
  'localVideo',      // 媒体文件
  'screen',          // 屏幕共享
  'ppt',             // PPT
  'word',            // Word
  'mindmap',         // 思维导图
  'pdf',             // PDF
  'webpage'          // 网页
];

const filteredSources = computed(() => {
  return props.allSources.filter(source => !EXCLUDED_SOURCE_TYPES.includes(source.type));
});

const totalPages = computed(() => {
  return Math.ceil(filteredSources.value.length / pageSize.value);
});

// ==================== 事件处理 ====================

const handleAddToPreview = (source) => {
  // 检查是否已经在画布中
  const canvasIndex = Object.keys(window.canvasSourceMap || {}).find(index =>
    window.canvasSourceMap[index] === source.id
  );

  if (canvasIndex) {
    ElMessage.warning(`${source.name} 已在画布 ${canvasIndex} 中`);
    return;
  }

  emit('add-to-preview', source);
};

const handleRemoveFromPreview = (source) => {
  ElMessageBox.confirm(
    `确定从预览区域移除 "${source.name}" 吗？\n\n注意：这将从画布中移除该信号源，但信号源列表将保留。`,
    '从预览移除',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    emit('remove-from-preview', source.id);
  }).catch(() => {});
};

const handleRename = (source) => {
  emit('rename', source);
};

const handleDelete = (sourceId) => {
  const source = props.allSources.find(s => s.id === sourceId);
  // 即使不在过滤后的列表中，也允许通过 ID 找到并删除原始数据中的项
  if (!source) return;

  ElMessageBox.confirm(
    `确定删除信号源 "${source.name}" 吗？\n\n此操作不可恢复！`,
    '删除信号源',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'error'
    }
  ).then(() => {
    emit('delete', sourceId);
  }).catch(() => {});
};
</script>

<style scoped lang="scss">
@import '@/styles/variables.scss';

.source-list-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
  border-radius: $border-radius-base;
  overflow: hidden;

  .list-header {
    padding: 16px 20px;
    border-bottom: 1px solid $border-color-light;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: $bg-color-page;

    h4 {
      margin: 0;
      font-size: $font-size-lg;
      color: $text-primary;
      font-weight: 600;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }
  }

  .source-list-container {
    flex: 1;
    overflow-y: auto;
    padding: 12px;

    .empty-state {
      padding: 40px 20px;
      text-align: center;
    }

    .source-list {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .source-list-item {
        padding: 16px;
        background: $bg-color;
        border: 1px solid $border-color-base;
        border-radius: $border-radius-base;
        transition: all $transition-base;

        &:hover {
          border-color: $primary-color;
          box-shadow: $box-shadow-sm;
        }

        &.added-to-preview {
          border-left: 3px solid $success-color;
          background: rgba($success-color, 0.05);
        }

        .source-info {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;

          .source-main-info {
            display: flex;
            align-items: center;
            gap: 12px;
            flex: 1;

            .source-type-icon {
              font-size: 28px;
              flex-shrink: 0;
            }

            .source-details {
              display: flex;
              flex-direction: column;
              gap: 6px;

              .source-name {
                font-size: $font-size-base;
                font-weight: 500;
                color: $text-primary;
              }
            }
          }

          .source-status {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;

            .status-dot {
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background: $text-secondary;

              &.online {
                background: $success-color;
                box-shadow: 0 0 8px rgba($success-color, 0.5);
              }
            }

            .status-text {
              font-size: $font-size-sm;
              color: $text-secondary;
            }
          }
        }

        .source-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }
      }
    }
  }

  .pagination-container {
    padding: 12px 20px;
    border-top: 1px solid $border-color-light;
    display: flex;
    justify-content: center;
    background: $bg-color-page;
  }
}
</style>
