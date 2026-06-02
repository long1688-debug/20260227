<template>
  <div class="webrtc-panel">
    <h3 class="panel-title">WebRTC 视频会议</h3>

    <!-- 状态显示 -->
    <div class="status-section">
      <span class="status-badge" :class="{ connected: isConnected }">
        {{ isConnected ? '已连接' : '未连接' }}
      </span>
      <span class="room-info" v-if="roomId">房间: {{ roomId }}</span>
    </div>

    <!-- 配置区域 -->
    <div class="config-section">
      <div class="form-group">
        <label>房间 ID:</label>
        <input
          v-model="roomInput"
          type="text"
          placeholder="输入房间ID"
          class="form-input"
        />
      </div>
      <div class="form-group">
        <label>您的名称:</label>
        <input
          v-model="peerName"
          type="text"
          placeholder="输入您的名称"
          class="form-input"
        />
      </div>
    </div>

    <!-- 控制按钮 -->
    <div class="button-section">
      <button
        class="btn btn-primary"
        @click="joinRoom"
        :disabled="isConnected || !roomInput"
      >
        加入房间
      </button>
      <button
        class="btn btn-danger"
        @click="leaveRoom"
        :disabled="!isConnected"
      >
        离开房间
      </button>
    </div>

    <!-- 本地预览 -->
    <div class="video-section" v-if="localStream">
      <h4>本地预览</h4>
      <div class="video-container">
        <video
          ref="localVideo"
          :srcObject="localStream"
          autoplay
          muted
          playsinline
          class="video-element"
        />
      </div>
    </div>

    <!-- 远程视频列表 -->
    <div class="remote-section" v-if="remotePeers.length > 0">
      <h4>远程参与者 ({{ remotePeers.length }})</h4>
      <div class="peers-grid">
        <div
          v-for="peer in remotePeers"
          :key="peer.id"
          class="peer-card"
        >
          <div class="peer-name">{{ peer.name }}</div>
          <div class="video-container small">
            <video
              :ref="`remoteVideo-${peer.id}`"
              :srcObject="getRemoteStream(peer.id)"
              autoplay
              playsinline
              class="video-element"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 成员列表 -->
    <div class="members-section" v-if="peers.length > 0">
      <h4>房间成员</h4>
      <ul class="members-list">
        <li v-for="peer in peers" :key="peer.id" class="member-item">
          <span class="member-name">{{ peer.name }}</span>
          <span class="member-status" :class="{ self: peer.id === peerId }">
            {{ peer.id === peerId ? '我' : '' }}
          </span>
        </li>
      </ul>
    </div>

    <!-- 静音控制 -->
    <div class="mute-controls" v-if="localStream">
      <button
        class="btn btn-secondary"
        @click="toggleMute"
        :class="{ active: isAudioMuted }"
      >
        {{ isAudioMuted ? '🔇 取消静音' : '🔊 静音' }}
      </button>
      <button
        class="btn btn-secondary"
        @click="toggleVideo"
        :class="{ active: isVideoMuted }"
      >
        {{ isVideoMuted ? '📹 开启视频' : '📷 关闭视频' }}
      </button>
    </div>

    <!-- 日志输出 -->
    <div class="logs-section">
      <h4>日志</h4>
      <div class="logs-container" ref="logsContainer">
        <div v-for="(log, index) in logs" :key="index" class="log-item">
          <span class="log-time">{{ log.time }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>import { ref, onMounted, onUnmounted } from 'vue';
import { tauriWebRTC } from '@/services';
const roomInput = ref('');
const peerName = ref('用户' + Math.floor(Math.random() * 1000));
const roomId = ref('');
const peerId = ref('');
const isConnected = ref(false);
const localStream = ref(null);
const remotePeers = ref([]);
const peers = ref([]);
const isAudioMuted = ref(false);
const isVideoMuted = ref(false);
const logs = ref([]);
const localVideo = ref(null);
const remoteVideos = ref({});
const addLog = (message) => {
 const time = new Date().toLocaleTimeString();
 logs.value.push({ time, message });
 // 保持日志数量限制
 if (logs.value.length > 50) {
 logs.value.shift();
 }
};
const getRemoteStream = (peerId) => {
 return tauriWebRTC.getRemoteStream(peerId);
};
const joinRoom = async () => {
 try {
 addLog('正在加入房间...');
 // 获取本地媒体流
 localStream.value = await tauriWebRTC.getLocalStream();
 addLog('本地媒体流获取成功');
 // 获取窗口标签（Tauri 窗口标识）
const windowModule = await import('@tauri-apps/api/webviewWindow');
// Tauri v2 兼容性：getCurrentWindow 可能直接导出或在 WebviewWindow 对象中
const getCurrentFn = windowModule.getCurrentWindow || windowModule.WebviewWindow?.getCurrent;
const currentWindow = getCurrentFn ? getCurrentFn() : null;
const windowLabel = currentWindow?.label || 'main';
 // 加入房间
 const result = await tauriWebRTC.joinRoom(roomInput.value, peerName.value, windowLabel);
 roomId.value = roomInput.value;
 peerId.value = tauriWebRTC.getPeerId();
 peers.value = result.peers;
 isConnected.value = true;
 addLog(`成功加入房间: ${roomId.value}`);
 addLog(`当前成员: ${peers.value.length} 人`);
 }
 catch (error) {
 addLog(`加入房间失败: ${error.message}`);
 console.error('加入房间失败:', error);
 }
};
const leaveRoom = async () => {
 try {
 addLog('正在离开房间...');
 await tauriWebRTC.leaveRoom();
 roomId.value = '';
 isConnected.value = false;
 peers.value = [];
 remotePeers.value = [];
 if (localStream.value) {
 localStream.value.getTracks().forEach(track => track.stop());
 localStream.value = null;
 }
 addLog('已离开房间');
 }
 catch (error) {
 addLog(`离开房间失败: ${error.message}`);
 console.error('离开房间失败:', error);
 }
};
const toggleMute = () => {
 isAudioMuted.value = !isAudioMuted.value;
 tauriWebRTC.muteAudio(isAudioMuted.value);
 addLog(isAudioMuted.value ? '已静音' : '已取消静音');
};
const toggleVideo = () => {
 isVideoMuted.value = !isVideoMuted.value;
 tauriWebRTC.muteVideo(isVideoMuted.value);
 addLog(isVideoMuted.value ? '已关闭视频' : '已开启视频');
};
const handlePeerJoined = (data) => {
 addLog(`新成员加入: ${data.name}`);
 // 更新成员列表
 peers.value = [...peers.value, { id: data.id, name: data.name }];
 // 添加到远程成员列表
 if (data.id !== peerId.value) {
 remotePeers.value = [...remotePeers.value, data];
 }
};
const handlePeerLeft = (data) => {
 addLog(`成员离开: ${data.id}`);
 peers.value = peers.value.filter(p => p.id !== data.id);
 remotePeers.value = remotePeers.value.filter(p => p.id !== data.id);
};
const handleRemoteStream = (data) => {
 addLog(`收到远程流: ${data.id}`);
};
onMounted(() => {
 addLog('WebRTC 服务已初始化');
 // 注册事件监听
 tauriWebRTC.on('peer-joined', handlePeerJoined);
 tauriWebRTC.on('peer-left', handlePeerLeft);
 tauriWebRTC.on('remote-stream', handleRemoteStream);
});
onUnmounted(() => {
 // 移除事件监听
 tauriWebRTC.off('peer-joined', handlePeerJoined);
 tauriWebRTC.off('peer-left', handlePeerLeft);
 tauriWebRTC.off('remote-stream', handleRemoteStream);
 // 清理资源
 if (isConnected.value) {
 leaveRoom();
 }
});
</script>

<style scoped>
.webrtc-panel {
  padding: 20px;
  background: #1e1e2e;
  border-radius: 12px;
  min-height: 500px;
}

.panel-title {
  color: #fff;
  margin-bottom: 20px;
  font-size: 18px;
}

.status-section {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.status-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  background: #3a3a4a;
  color: #aaa;
}

.status-badge.connected {
  background: #28a745;
  color: #fff;
}

.room-info {
  color: #888;
  font-size: 14px;
}

.config-section {
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  color: #aaa;
  font-size: 12px;
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #3a3a4a;
  border-radius: 8px;
  background: #2a2a3e;
  color: #fff;
  font-size: 14px;
}

.button-section {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-danger {
  background: #dc2626;
  color: #fff;
}

.btn-danger:hover:not(:disabled) {
  background: #b91c1c;
}

.btn-secondary {
  background: #3a3a4a;
  color: #fff;
}

.btn-secondary:hover {
  background: #4a4a5e;
}

.btn-secondary.active {
  background: #5a5a6e;
}

.video-section, .remote-section {
  margin-bottom: 20px;
}

.video-section h4, .remote-section h4, .members-section h4, .logs-section h4 {
  color: #aaa;
  font-size: 14px;
  margin-bottom: 10px;
}

.video-container {
  width: 100%;
  aspect-ratio: 16/9;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.video-container.small {
  aspect-ratio: 4/3;
}

.video-element {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.peers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}

.peer-card {
  background: #2a2a3e;
  border-radius: 8px;
  padding: 10px;
}

.peer-name {
  color: #aaa;
  font-size: 12px;
  margin-bottom: 8px;
  text-align: center;
}

.members-section {
  margin-bottom: 20px;
}

.members-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.member-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #2a2a3e;
  border-radius: 6px;
  margin-bottom: 6px;
}

.member-name {
  color: #fff;
  font-size: 14px;
}

.member-status {
  color: #3b82f6;
  font-size: 12px;
}

.mute-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.logs-section {
  background: #1a1a28;
  border-radius: 8px;
  padding: 12px;
}

.logs-container {
  max-height: 150px;
  overflow-y: auto;
}

.log-item {
  display: flex;
  gap: 10px;
  font-size: 12px;
  margin-bottom: 4px;
}

.log-time {
  color: #666;
  white-space: nowrap;
}

.log-message {
  color: #888;
}
</style>
