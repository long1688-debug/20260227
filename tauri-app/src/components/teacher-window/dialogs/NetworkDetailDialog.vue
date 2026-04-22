<template>
  <el-dialog
    v-model="visible"
    title="网络质量详情"
    width="600px"
    top="3vh"
    class="network-detail-dialog-wrapper"
    :z-index="2000"
    append-to-body
  >
    <div v-if="networkDetail" class="network-detail">
      <div class="detail-item">
        <span class="label">画布编号:</span>
        <span class="value">{{ networkDetail.canvas }}</span>
      </div>
      <div class="detail-item">
        <span class="label">带宽:</span>
        <span class="value">{{ networkDetail.bandwidth }} Mbps</span>
      </div>
      <div class="detail-item">
        <span class="label">延迟:</span>
        <span class="value">{{ networkDetail.latency }} ms</span>
      </div>
      <div class="detail-item">
        <span class="label">丢包率:</span>
        <span class="value">{{ networkDetail.packetLoss }}%</span>
      </div>
      <div class="detail-item">
        <span class="label">网络质量:</span>
        <el-tag :type="getQualityTag(networkDetail.quality)">
          {{ getQualityLabel(networkDetail.quality) }}
        </el-tag>
      </div>
    </div>
    <div v-else class="empty-state">
      <p>暂无网络质量数据</p>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  networkDetail: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:modelValue'])

const visible = ref(props.modelValue)

watch(() => props.modelValue, (val) => {
  visible.value = val
})

watch(visible, (val) => {
  emit('update:modelValue', val)
})

const getQualityTag = (quality) => {
  const map = {
    good: 'success',
    fair: 'warning',
    poor: 'danger'
  }
  return map[quality] || 'info'
}

const getQualityLabel = (quality) => {
  const map = {
    good: '优秀',
    fair: '一般',
    poor: '较差'
  }
  return map[quality] || '未知'
}
</script>

<style lang="scss" scoped>
// 🎯 滚动条样式 mixin
@mixin custom-scrollbar {
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 3px;

    &:hover {
      background: #555;
    }
  }
}

// 🎯 弹窗包装类样式
.network-detail-dialog-wrapper {
  :deep(.el-dialog__body) {
    max-height: calc(100vh - 150px);
    overflow-y: auto;
    padding: 0;
    @include custom-scrollbar;
  }
}

.network-detail {
  padding: 20px;
}

.detail-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #eee;

  &:last-child {
    border-bottom: none;
  }
}

.label {
  width: 100px;
  text-align: right;
  margin-right: 16px;
  color: #606266;
  font-weight: 500;
}

.value {
  flex: 1;
  color: #303133;
  font-size: 14px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #909399;
}
</style>
