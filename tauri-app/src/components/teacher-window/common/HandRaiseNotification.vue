<template>
  <transition name="slide-in">
    <div v-if="visible" class="hand-raise-notification">
      <div class="notification-content">
        <div class="notification-icon">🙋</div>
        <div class="notification-info">
          <div class="notification-title">学生举手</div>
          <div class="notification-message">{{ studentName }} 正在举手</div>
        </div>
        <div class="notification-actions">
          <el-button size="small" type="primary" @click="handleAccept">接受</el-button>
          <el-button size="small" @click="handleReject">忽略</el-button>
        </div>
      </div>
      <button class="notification-close" @click="handleClose">×</button>
    </div>
  </transition>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  show: Boolean,
  studentName: {
    type: String,
    default: '未知学生'
  },
  duration: {
    type: Number,
    default: 10000
  }
})

const emit = defineEmits(['accept', 'reject', 'close'])

const visible = ref(false)
let timer = null

const showNotification = () => {
  visible.value = true
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    visible.value = false
  }, props.duration)
}

const hideNotification = () => {
  visible.value = false
  if (timer) clearTimeout(timer)
}

const handleAccept = () => {
  emit('accept')
  hideNotification()
}

const handleReject = () => {
  emit('reject')
  hideNotification()
}

const handleClose = () => {
  emit('close')
  hideNotification()
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    showNotification()
  } else {
    hideNotification()
  }
})
</script>

<style lang="scss" scoped>
.hand-raise-notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9999;
  background: #0F2035;
  border: 2px solid #FFA500;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  min-width: 320px;
}

.notification-content {
  display: flex;
  align-items: center;
  padding: 16px;
  gap: 12px;
}

.notification-icon {
  font-size: 32px;
}

.notification-info {
  flex: 1;
}

.notification-title {
  font-size: 14px;
  font-weight: 600;
  color: #FFA500;
  margin-bottom: 4px;
}

.notification-message {
  font-size: 13px;
  color: #E0E1DD;
}

.notification-actions {
  display: flex;
  gap: 8px;
}

.notification-close {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: #778DA9;
  font-size: 16px;
  cursor: pointer;
  border-radius: 4px;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #FFFFFF;
  }
}

.slide-in-enter-active,
.slide-in-leave-active {
  transition: all 0.3s ease;
}

.slide-in-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.slide-in-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
