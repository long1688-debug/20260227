<template>
  <div class="analysis-fullscreen-window">
    <!-- 标题栏 -->
    <div class="window-header">
      <div class="header-title">
        <span class="title-icon">📊</span>
        <span>分析全屏模式</span>
        <el-tag type="info" size="small">
          分析面板
        </el-tag>
      </div>
      <div class="header-actions">
        <el-button 
          size="small" 
          :type="isBroadcasting ? 'danger' : 'success'"
          @click="handleToggleBroadcast"
        >
          {{ isBroadcasting ? '⏹️ 停止直播' : '📡 开始直播' }}
        </el-button>
        <el-tag v-if="isBroadcasting" type="success" size="small" effect="dark">
          🔴 直播中 {{ formattedDuration }}
        </el-tag>
        <el-button size="small" type="danger" @click="$emit('close')">
          ✕ 关闭
        </el-button>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="window-content">
      <div class="analysis-placeholder">
        <div class="placeholder-icon">📊</div>
        <div class="placeholder-text">分析全屏模式</div>
        <div class="placeholder-hint">
          点击下方按钮切换到分析面板进行详细操作
        </div>
        <el-button type="primary" @click="$emit('close')">
          返回分析面板
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { usePanelBroadcast } from '@/composables/usePanelBroadcast'

const emit = defineEmits(['close'])

const {
  isBroadcasting,
  broadcastDuration,
  formattedDuration,
  startBroadcast,
  stopBroadcast
} = usePanelBroadcast({ streamName: 'analysis-fullscreen' })

// 切换直播状态
const handleToggleBroadcast = async () => {
  if (isBroadcasting.value) {
    await stopBroadcast()
    ElMessage.info('分析直播已停止')
  } else {
    await startBroadcast('analysis')
    ElMessage.success('分析直播已开始')
  }
}
</script>

<style scoped lang="scss">
.analysis-fullscreen-window {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: #0d1117;
  z-index: 9999;
  display: flex;
  flex-direction: column;
}

.window-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: #161b22;
  border-bottom: 1px solid #30363d;

  .header-title {
    display: flex;
    align-items: center;
    gap: 10px;

    .title-icon {
      font-size: 20px;
    }

    span {
      font-size: 16px;
      font-weight: 600;
      color: #E0E1DD;
    }
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }
}

.window-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.analysis-placeholder {
  text-align: center;
  color: #8B949E;

  .placeholder-icon {
    font-size: 80px;
    margin-bottom: 20px;
  }

  .placeholder-text {
    font-size: 24px;
    font-weight: 600;
    color: #E0E1DD;
    margin-bottom: 10px;
  }

  .placeholder-hint {
    font-size: 14px;
    margin-bottom: 30px;
  }
}
</style>
