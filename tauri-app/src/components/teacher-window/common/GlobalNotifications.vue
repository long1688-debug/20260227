<template>
  <div class="global-notifications">
    <!-- 举手通知列表 -->
    <TransitionGroup name="notification-list" tag="div">
      <HandRaiseNotification
        v-for="notification in handRaiseNotifications"
        :key="notification.id"
        :show="true"
        :student-name="notification.studentName"
        @accept="$emit('accept-hand-raise', notification)"
        @reject="$emit('reject-hand-raise', notification)"
        @close="handleClose(notification.id)"
      />
    </TransitionGroup>
    
    <!-- 系统通知（预留扩展） -->
    <!-- TODO: 未来可添加更多通知类型 -->
  </div>
</template>

<script setup lang="ts">
import HandRaiseNotification from './HandRaiseNotification.vue'

interface HandRaiseNotificationItem {
  id: string | number
  studentName: string
  timestamp?: number
}

interface Props {
  /** 举手通知列表 */
  handRaiseNotifications?: HandRaiseNotificationItem[]
}

const props = withDefaults(defineProps<Props>(), {
  handRaiseNotifications: () => []
})

interface Emits {
  (e: 'accept-hand-raise', notification: HandRaiseNotificationItem): void
  (e: 'reject-hand-raise', notification: HandRaiseNotificationItem): void
  (e: 'close-notification', id: string | number): void
}

const emit = defineEmits<Emits>()

/**
 * 处理关闭通知
 */
const handleClose = (id: string | number) => {
  emit('close-notification', id)
}
</script>

<style scoped lang="scss">
.global-notifications {
  position: fixed;
  top: 80px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 400px;
  pointer-events: none;

  // 让子组件恢复指针事件
  > * {
    pointer-events: auto;
  }
}

.notification-list-enter-active,
.notification-list-leave-active {
  transition: all 0.3s ease;
}

.notification-list-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.notification-list-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.notification-list-move {
  transition: transform 0.3s ease;
}
</style>
