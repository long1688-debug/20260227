<template>
  <div class="global-notifications">
    <!-- 举手通知列表 -->
    <TransitionGroup name="notification-list" tag="div">
      <div
        v-for="notification in handRaiseNotifications"
        :key="notification.id"
        class="hand-raise-notification"
      >
        <div class="notification-content">
          <div class="student-avatar">
            {{ notification.studentName.charAt(0) }}
          </div>
          <div class="notification-info">
            <div class="student-name">{{ notification.studentName }}</div>
            <div class="notification-text">申请发言</div>
          </div>
        </div>
        <div class="notification-actions">
          <button 
            class="action-btn accept-btn"
            @click="$emit('accept-hand-raise', notification)"
            title="接受"
          >
            ✓
          </button>
          <button 
            class="action-btn reject-btn"
            @click="$emit('reject-hand-raise', notification)"
            title="拒绝"
          >
            ✕
          </button>
          <button 
            class="action-btn close-btn"
            @click="handleClose(notification.id)"
            title="关闭"
          >
            ×
          </button>
        </div>
      </div>
    </TransitionGroup>
    
    <!-- 系统通知（预留扩展） -->
    <!-- TODO: 未来可添加更多通知类型 -->
  </div>
</template>

<script setup lang="ts">
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

<style lang="scss" scoped>
.global-notifications {
  position: fixed;
  top: 80px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 400px;
}

.hand-raise-notification {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
  animation: slideInRight 0.3s ease-out;
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-width: 320px;
  
  .notification-content {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    
    .student-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: bold;
      color: white;
    }
    
    .notification-info {
      flex: 1;
      
      .student-name {
        font-size: 16px;
        font-weight: 600;
        color: white;
        margin-bottom: 4px;
      }
      
      .notification-text {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.8);
      }
    }
  }
  
  .notification-actions {
    display: flex;
    gap: 8px;
    
    .action-btn {
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 18px;
      font-weight: bold;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      
      &.accept-btn {
        background: rgba(255, 255, 255, 0.9);
        color: #52c41a;
        
        &:hover {
          background: white;
          transform: scale(1.1);
        }
      }
      
      &.reject-btn {
        background: rgba(255, 255, 255, 0.3);
        color: white;
        
        &:hover {
          background: rgba(255, 255, 255, 0.5);
          transform: scale(1.1);
        }
      }
      
      &.close-btn {
        background: transparent;
        color: rgba(255, 255, 255, 0.6);
        font-size: 20px;
        
        &:hover {
          color: white;
          background: rgba(255, 255, 255, 0.1);
        }
      }
    }
  }
}

// 动画效果
@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(100px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.notification-list-enter-active,
.notification-list-leave-active {
  transition: all 0.3s ease;
}

.notification-list-enter-from {
  opacity: 0;
  transform: translateX(100px);
}

.notification-list-leave-to {
  opacity: 0;
  transform: translateX(100px);
}
</style>
