<template>
  <div class="doc-pager" v-if="totalPages > 1">
    <div class="pager-controls">
      <el-button 
        :disabled="currentPage <= 1"
        @click="prevPage"
        class="pager-btn"
      >
        上一页
      </el-button>
      
      <span class="page-info">
        {{ currentPage }} / {{ totalPages }}
      </span>
      
      <el-button 
        :disabled="currentPage >= totalPages"
        @click="nextPage"
        class="pager-btn"
      >
        下一页
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, defineProps, defineEmits } from 'vue'

const props = defineProps({
  totalPages: {
    type: Number,
    required: true
  },
  currentPage: {
    type: Number,
    default: 1
  }
})

const emit = defineEmits(['update:currentPage', 'prev-page', 'next-page'])

const prevPage = () => {
  if (props.currentPage > 1) {
    emit('update:currentPage', props.currentPage - 1)
    emit('prev-page')
  }
}

const nextPage = () => {
  if (props.currentPage < props.totalPages) {
    emit('update:currentPage', props.currentPage + 1)
    emit('next-page')
  }
}
</script>

<style scoped>
.doc-pager {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10005;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 20px;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  backdrop-filter: blur(4px);
}

.pager-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pager-btn {
  background: rgba(255, 255, 255, 0.15);
  border: none;
  color: white;
  padding: 6px 12px;
}

.pager-btn:not(.is-disabled):hover {
  background: rgba(255, 255, 255, 0.25);
}

.page-info {
  color: white;
  min-width: 60px;
  text-align: center;
  font-family: monospace;
}
</style>