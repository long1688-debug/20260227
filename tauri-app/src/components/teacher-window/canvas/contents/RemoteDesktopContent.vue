<template>
  <div class="remote-desktop-content">
    <!-- 远程桌面连接成功 -->
    <div v-if="isConnected" class="remote-desktop-container">
      <!-- 远程桌面画面 -->
      <video
        ref="videoRef"
        class="remote-video"
        :style="videoStyle"
        autoplay
        playsinline
      ></video>

      <!-- 连接信息覆盖层 -->
      <div class="connection-info">
        <el-tag size="small" type="success">
          <el-icon><CircleCheck /></el-icon>
          已连接
        </el-tag>
        <span class="address">{{ connectionAddress }}</span>
      </div>

      <!-- 控制栏 -->
      <div class="controls-bar">
        <el-button-group size="small">
          <el-button @click="toggleFullscreen">
            <el-icon><FullScreen /></el-icon>
            全屏
          </el-button>
          <el-button @click="sendCtrlAltDel">
            <el-icon><RefreshRight /></el-icon>
            Ctrl+Alt+Del
          </el-button>
          <el-button @click="disconnect" type="danger">
            <el-icon><SwitchButton /></el-icon>
            断开
          </el-button>
        </el-button-group>
      </div>
    </div>

    <!-- 连接中 -->
    <div v-else-if="isConnecting" class="connecting-state">
      <el-icon class="is-loading" :size="64"><Loading /></el-icon>
      <p>正在连接远程桌面...</p>
      <small>{{ connectionAddress }}</small>
    </div>

    <!-- 连接失败 -->
    <div v-else-if="hasError" class="error-state">
      <el-icon :size="64"><WarningFilled /></el-icon>
      <p>连接失败</p>
      <small>{{ errorMessage }}</small>
      <div class="error-actions">
        <el-button size="small" type="primary" @click="retryConnect">
          <el-icon><Refresh /></el-icon>
          重试
        </el-button>
        <el-button size="small" @click="editConfig">
          <el-icon><Edit /></el-icon>
          编辑配置
        </el-button>
      </div>
    </div>

    <!-- 默认占位符 -->
    <div v-else class="placeholder">
      <el-icon :size="64"><Monitor /></el-icon>
      <p>远程桌面</p>
      <small>支持 RDP, VNC, SSH 协议</small>
      <el-button size="small" type="primary" style="margin-top: 12px" @click="handleConnect">
        连接远程桌面
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import {
  Monitor, Loading, WarningFilled,
  CircleCheck, FullScreen, RefreshRight,
  SwitchButton, Refresh, Edit
} from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

const props = defineProps({
  source: Object
});

const emit = defineEmits(['connect', 'disconnect']);

// 状态管理
const videoRef = ref(null);
const isConnecting = ref(false);
const isConnected = ref(false);
const hasError = ref(false);
const errorMessage = ref('');

// 远程桌面连接
let remoteConnection = null;

/**
 * 获取连接地址
 */
const connectionAddress = computed(() => {
  return props.source?.properties?.remoteAddress || '';
});

/**
 * 获取视频样式
 */
const videoStyle = computed(() => {
  return {
    cursor: props.source?.properties?.showCursor !== false ? 'default' : 'none'
  };
});

/**
 * 连接远程桌面
 */
const handleConnect = () => {
  emit('connect');
};

/**
 * 重试连接
 */
const retryConnect = () => {
  hasError.value = false;
  connect();
};

/**
 * 编辑配置
 */
const editConfig = () => {
  ElMessage.info('请在添加信号源对话框中编辑远程桌面配置');
};

/**
 * 断开连接
 */
const disconnect = () => {
  if (remoteConnection) {
    // 🎯 注意：实际应用中，这里应该调用远程桌面库的断开方法
    // 例如：remoteConnection.disconnect()
    console.log('[RemoteDesktopContent] 断开连接');
    remoteConnection = null;
  }

  isConnected.value = false;
  emit('disconnect');
  ElMessage.info('已断开远程桌面连接');
};

/**
 * 切换全屏
 */
const toggleFullscreen = () => {
  if (!videoRef.value) return;

  if (!document.fullscreenElement) {
    videoRef.value.requestFullscreen().catch(err => {
      console.error('[RemoteDesktopContent] 全屏失败:', err);
      ElMessage.error('全屏失败');
    });
  } else {
    document.exitFullscreen();
  }
};

/**
 * 发送 Ctrl+Alt+Del
 */
const sendCtrlAltDel = () => {
  // 🎯 注意：实际应用中，这里应该通过远程桌面协议发送快捷键
  ElMessage.info('Ctrl+Alt+Del 已发送');
};

/**
 * 连接远程桌面
 */
const connect = async () => {
  const address = connectionAddress.value;
  if (!address) {
    ElMessage.error('请先配置远程桌面地址');
    return;
  }

  isConnecting.value = true;
  hasError.value = false;

  try {
    const protocol = props.source?.properties?.remoteProtocol || 'rdp';
    const username = props.source?.properties?.username || '';
    const password = props.source?.properties?.password || '';

    console.log('[RemoteDesktopContent] 连接远程桌面:', {
      address,
      protocol,
      username
    });

    // 🎯 注意：实际应用中，这里应该集成真实的远程桌面库
    // 例如：
    // - RDP: 使用 webRDP 或 FreeRDP
    // - VNC: 使用 noVNC
    // - SSH: 使用 xterm.js
    // 这里我们提供一个模拟实现

    // 模拟连接延迟
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 模拟连接成功
    isConnected.value = true;
    isConnecting.value = false;

    // 创建模拟的视频流（实际应用中应该使用真实的远程桌面流）
    if (videoRef.value && navigator.mediaDevices?.getDisplayMedia) {
      try {
        // 尝试获取屏幕共享作为模拟
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: props.source?.properties?.showCursor !== false ? 'always' : 'never'
          },
          audio: props.source?.properties?.enableAudio
        });

        videoRef.value.srcObject = stream;

        stream.getVideoTracks()[0].onended = () => {
          disconnect();
        };
      } catch (err) {
        console.warn('[RemoteDesktopContent] 无法获取屏幕流，使用占位符');
        // 创建占位符视频
        createPlaceholderVideo();
      }
    } else {
      createPlaceholderVideo();
    }

    ElMessage.success('远程桌面连接成功');
  } catch (error) {
    console.error('[RemoteDesktopContent] 连接失败:', error);
    hasError.value = true;
    errorMessage.value = error.message || '无法连接到远程桌面';
    isConnecting.value = false;
    ElMessage.error('远程桌面连接失败: ' + errorMessage.value);
  }
};

/**
 * 创建占位符视频
 */
const createPlaceholderVideo = () => {
  if (!videoRef.value) return;

  // 创建一个简单的占位视频
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');

  // 绘制背景
  ctx.fillStyle = '#1a202c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 绘制文字
  ctx.fillStyle = '#a0aec0';
  ctx.font = '48px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('远程桌面 - ' + connectionAddress.value, canvas.width / 2, canvas.height / 2);

  // 转换为视频流
  const stream = canvas.captureStream(30);
  videoRef.value.srcObject = stream;
};

// 监听source变化
watch(() => props.source?.id, (newId, oldId) => {
  if (newId && newId !== oldId) {
    // 如果之前有连接，先断开
    if (isConnected.value) {
      disconnect();
    }

    // 自动连接
    if (props.source?.properties?.remoteAddress) {
      connect();
    }
  }
});

// 组件卸载时清理连接
onUnmounted(() => {
  if (isConnected.value) {
    disconnect();
  }
});
</script>

<style scoped lang="scss">
.remote-desktop-content {
  width: 100%;
  height: 100%;
  background: #000;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .remote-desktop-container {
    flex: 1;
    position: relative;
    display: flex;
    flex-direction: column;

    .remote-video {
      flex: 1;
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
    }

    .connection-info {
      position: absolute;
      top: 12px;
      left: 12px;
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(0, 0, 0, 0.7);
      padding: 8px 12px;
      border-radius: 6px;
      backdrop-filter: blur(4px);

      .address {
        color: #fff;
        font-size: 14px;
        font-weight: 500;
      }
    }

    .controls-bar {
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.7);
      padding: 8px;
      border-radius: 6px;
      backdrop-filter: blur(4px);
    }
  }

  .connecting-state,
  .error-state,
  .placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #a0aec0;
    gap: 16px;
    padding: 20px;

    p {
      margin: 0;
      font-size: 18px;
      font-weight: 500;
    }

    small {
      font-size: 13px;
      opacity: 0.7;
      text-align: center;
      max-width: 80%;
    }

    .error-actions {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }
  }

  .connecting-state {
    color: #4299e1;
  }

  .error-state {
    color: #fc8181;
  }
}
</style>
