<template>
  <div class="video-status-overlay">
    <!-- 只在录制时显示录制时间 -->
    <span v-if="recordingTime && recordingTime !== '0' && recordingTime !== 0">{{ recordingTime }}</span>
  </div>
</template>

<script>
export default {
  name: 'VideoStatusOverlay',
  props: {
    recordingTime: {
      type: [String, Number], // ✅ 允许 Number 和 String
      default: '0'
    },
    videoLoading: {
      type: Boolean,
      default: false
    },
    videoError: {
      type: Object,
      default: null
    },
    loadingText: {
      type: String,
      default: ''
    }
  }
}
</script>

<style scoped lang="scss">
.video-status-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.video-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.7);
  padding: 24px 32px;
  border-radius: 12px;

  .loading-spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-top-color: #4CC9F0;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .loading-text {
    color: #fff;
    font-size: 14px;
  }
}

.video-error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.8);
  padding: 24px 32px;
  border-radius: 12px;

  .error-icon {
    font-size: 48px;
  }

  .error-text {
    color: #ff6b6b;
    font-size: 14px;
    font-weight: 500;
  }

  .error-hint {
    color: #ADB5BD;
    font-size: 12px;
  }
}

.streaming-indicator {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.6);
  padding: 6px 12px;
  border-radius: 20px;

  .stream-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ffc107;
    animation: pulse 1.5s ease-in-out infinite;

    &.connected {
      background: #28a745;
      animation: none;
    }
  }

  .stream-text {
    color: #fff;
    font-size: 12px;
  }
}

.recording-indicator {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(220, 53, 69, 0.9);
  padding: 6px 12px;
  border-radius: 20px;

  .rec-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #fff;
    animation: pulse 1s ease-in-out infinite;
  }

  .rec-text {
    color: #fff;
    font-size: 12px;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
