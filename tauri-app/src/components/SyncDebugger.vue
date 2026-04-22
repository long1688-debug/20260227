<template>
  <div class="sync-debugger" v-if="enabled">
    <div class="debugger-header">
      <h3>🔍 视频同步调试器</h3>
      <button @click="refreshStatus" class="refresh-btn">刷新</button>
      <button @click="toggleEnabled" class="close-btn">✕</button>
    </div>

    <div class="debugger-content">
      <!-- 状态复制器状态 -->
      <section class="debug-section">
        <h4>📡 状态复制器</h4>
        <div class="status-item">
          <span class="label">主控:</span>
          <span class="value">{{ status.replicator.master || '无' }}</span>
        </div>
        
        <div class="slaves-list" v-if="status.replicator.slaves.length > 0">
          <h5>从属列表 ({{ status.replicator.slaves.length }})</h5>
          <div 
            v-for="slave in status.replicator.slaves" 
            :key="slave.id" 
            class="slave-item"
            :class="{ 'out-of-sync': isOutOfSync(slave) }"
          >
            <span class="slave-id">{{ slave.id }}</span>
            <span class="slave-time">{{ slave.currentTime.toFixed(2) }}s</span>
            <span class="slave-status" :class="{ 'playing': slave.isPlaying }">
              {{ slave.isPlaying ? '▶️ 播放' : '⏸️ 暂停' }}
            </span>
            <span class="slave-sync" :class="{ 'enabled': slave.syncEnabled }">
              {{ slave.syncEnabled ? '✅ 同步' : '❌ 禁用' }}
            </span>
          </div>
        </div>
        <div v-else class="empty-state">无从属视频</div>
      </section>

      <!-- 音频路由器状态 -->
      <section class="debug-section">
        <h4>🔊 音频路由器</h4>
        <div class="status-item">
          <span class="label">主音频源:</span>
          <span class="value">{{ status.audio.master || '无' }}</span>
        </div>

        <div class="audio-outputs" v-if="status.audio.outputs.length > 0">
          <div 
            v-for="output in status.audio.outputs" 
            :key="output.id" 
            class="audio-item"
            :class="{ 'is-master': output.isMaster }"
          >
            <span class="audio-id">{{ output.id }}</span>
            <span class="audio-status">
              {{ output.isMaster ? '🔊 主音频' : '🔇 静音' }}
            </span>
            <span class="audio-muted">{{ output.muted ? '已静音' : '未静音' }}</span>
          </div>
        </div>
        <div v-else class="empty-state">无音频输出</div>
      </section>

      <!-- 时间差监控 -->
      <section class="debug-section" v-if="status.replicator.master">
        <h4>⏱️ 时间差监控</h4>
        <div class="time-diffs">
          <div 
            v-for="slave in status.replicator.slaves" 
            :key="slave.id" 
            class="diff-item"
          >
            <span class="diff-id">{{ slave.id }}</span>
            <span class="diff-value">{{ getTimeDiff(slave).toFixed(3) }}s</span>
            <span class="diff-status" :class="getDiffClass(getTimeDiff(slave))">
              {{ getDiffLabel(getTimeDiff(slave)) }}
            </span>
          </div>
        </div>
      </section>
    </div>
  </div>

  <!-- 悬浮按钮 -->
  <button class="debugger-toggle" @click="toggleEnabled" v-if="!enabled">
    🔍
  </button>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useVideoSync } from '@/composables/useVideoSync';

const props = defineProps({
  defaultEnabled: {
    type: Boolean,
    default: false
  }
});

const { getSyncStatus, stateReplicator } = useVideoSync();

const enabled = ref(props.defaultEnabled);
const status = ref({
  replicator: { master: null, slaves: [] },
  audio: { master: null, outputs: [] }
});

let refreshInterval = null;

const toggleEnabled = () => {
  enabled.value = !enabled.value;
  
  if (enabled.value) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
};

const refreshStatus = () => {
  try {
    status.value = getSyncStatus();
  } catch (error) {
    console.error('[SyncDebugger] 获取状态失败:', error);
  }
};

const startAutoRefresh = () => {
  refreshStatus();
  refreshInterval = setInterval(refreshStatus, 1000);
};

const stopAutoRefresh = () => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
};

const isOutOfSync = (slave) => {
  if (!stateReplicator.masterVideo) return false;
  const timeDiff = Math.abs(slave.currentTime - stateReplicator.masterVideo.currentTime);
  return timeDiff > stateReplicator.syncThreshold;
};

const getTimeDiff = (slave) => {
  if (!stateReplicator.masterVideo) return 0;
  return Math.abs(slave.currentTime - stateReplicator.masterVideo.currentTime);
};

const getDiffClass = (diff) => {
  if (diff < 0.1) return 'good';
  if (diff < 0.3) return 'warning';
  return 'error';
};

const getDiffLabel = (diff) => {
  if (diff < 0.1) return '✅ 同步';
  if (diff < 0.3) return '⚠️ 偏差';
  return '❌ 失步';
};

onMounted(() => {
  if (enabled.value) {
    startAutoRefresh();
  }
});

onUnmounted(() => {
  stopAutoRefresh();
});
</script>

<style scoped lang="scss">
.sync-debugger {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 400px;
  max-height: 600px;
  background: rgba(0, 0, 0, 0.95);
  color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  z-index: 9999;
  overflow: hidden;
  font-family: 'Courier New', monospace;
  font-size: 12px;

  .debugger-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: #1a1a1a;
    border-bottom: 1px solid #333;

    h3 {
      margin: 0;
      font-size: 14px;
    }

    button {
      padding: 4px 8px;
      margin-left: 8px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: background 0.2s;

      &.refresh-btn {
        background: #4CC9F0;
        color: #000;

        &:hover {
          background: #3AB5D9;
        }
      }

      &.close-btn {
        background: #EF476F;
        color: #fff;

        &:hover {
          background: #D63A5F;
        }
      }
    }
  }

  .debugger-content {
    padding: 12px;
    overflow-y: auto;
    max-height: 550px;
  }

  .debug-section {
    margin-bottom: 16px;

    h4 {
      margin: 0 0 8px 0;
      font-size: 13px;
      color: #4CC9F0;
      border-bottom: 1px solid #333;
      padding-bottom: 4px;
    }

    h5 {
      margin: 8px 0 4px 0;
      font-size: 12px;
      color: #FFD166;
    }
  }

  .status-item {
    display: flex;
    justify-content: space-between;
    padding: 4px 8px;
    background: #1a1a1a;
    border-radius: 4px;
    margin-bottom: 4px;

    .label {
      color: #888;
    }

    .value {
      color: #06D6A0;
      font-weight: bold;
    }
  }

  .slaves-list, .audio-outputs {
    .slave-item, .audio-item {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 6px 8px;
      background: #1a1a1a;
      border-radius: 4px;
      margin-bottom: 4px;
      align-items: center;

      &.out-of-sync, &.is-master {
        border-left: 3px solid #FFD166;
      }
    }

    .slave-id, .audio-id {
      color: #4CC9F0;
      font-weight: bold;
    }

    .slave-time {
      color: #fff;
    }

    .slave-status, .audio-status {
      &.playing {
        color: #06D6A0;
      }
    }

    .slave-sync {
      color: #666;

      &.enabled {
        color: #06D6A0;
      }
    }

    .audio-muted {
      color: #888;
    }
  }

  .time-diffs {
    .diff-item {
      display: flex;
      justify-content: space-between;
      padding: 4px 8px;
      background: #1a1a1a;
      border-radius: 4px;
      margin-bottom: 4px;

      .diff-id {
        color: #4CC9F0;
      }

      .diff-value {
        color: #fff;
        font-weight: bold;
      }

      .diff-status {
        &.good {
          color: #06D6A0;
        }

        &.warning {
          color: #FFD166;
        }

        &.error {
          color: #EF476F;
        }
      }
    }
  }

  .empty-state {
    padding: 8px;
    color: #666;
    text-align: center;
    font-style: italic;
  }
}

.debugger-toggle {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #4CC9F0;
  border: none;
  font-size: 24px;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  z-index: 9998;
  transition: all 0.2s;

  &:hover {
    background: #3AB5D9;
    transform: scale(1.1);
  }
}
</style>
