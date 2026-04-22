<!-- 来自 vue-app 的简单应用界�?-->
<template>
  <div class="container">
    <div class="logo">🎓</div>
    <h1>实训教学系统</h1>

    <div class="status" :class="statusClass">
      <h3>📊 系统状�?/h3>
      <p>{{ statusText }}</p>
    </div>

    <ul class="info-list">
      <li>
        <span class="label">服务端口</span>
        <span class="value">{{ port }}</span>
      </li>
      <li>
        <span class="label">运行时间</span>
        <span class="value">{{ uptime }}</span>
      </li>
      <li>
        <span class="label">连接�?/span>
        <span class="value">{{ clients }}</span>
      </li>
    </ul>

    <div class="btn-group">
      <button class="btn" @click="startService">▶️ 启动服务</button>
      <button class="btn btn-danger" @click="stopService">⏹️ 停止服务</button>
      <button class="btn" @click="refresh">🔄 刷新</button>
    </div>

    <div class="message-log" v-if="messages.length > 0">
      <h4>消息日志</h4>
      <ul>
        <li v-for="(msg, index) in messages" :key="index">{{ msg }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

const statusText = ref('初始化中...');
const port = ref(8082);
const uptime = ref('00:00:00');
const clients = ref(0);
const messages = ref([]);

const statusClass = computed(() => {
  if (statusText.value.includes('�?)) return 'status-success';
  if (statusText.value.includes('⚠️')) return 'status-warning';
  if (statusText.value.includes('�?)) return 'status-error';
  return '';
});

let simulateInterval = null;

const handleMessage = (data) => {
  try {
    const msg = JSON.parse(data);

    if (msg.status) {
      statusText.value = msg.status;
    }
    if (msg.uptime) {
      uptime.value = msg.uptime;
    }
    if (msg.clients !== undefined) {
      clients.value = msg.clients;
    }

    log('收到消息�? + data);
  } catch (e) {
    log('收到消息�? + data);
  }
};

const sendMessage = (msg) => {
  if (window.chrome?.webview) {
    window.chrome.webview.postMessage(msg);
    log('发送消息（WebView2）：' + msg);
  } else if (window.__TAURI__) {
    log('发送消息（Tauri）：' + msg);
  } else {
    log('发送消息（模拟）：' + msg);
  }
};

const startService = () => {
  sendMessage('start');
  statusText.value = '🔄 正在启动...';
  setTimeout(() => {
    statusText.value = '�?服务运行�?;
  }, 1000);
};

const stopService = () => {
  sendMessage('stop');
  statusText.value = '⏹️ 正在停止...';
  setTimeout(() => {
    statusText.value = '⏹️ 服务已停�?;
  }, 1000);
};

const refresh = () => {
  sendMessage('refresh');
  log('刷新状�?);
};

const log = (msg) => {
  const time = new Date().toLocaleTimeString();
  messages.value.unshift(`[${time}] ${msg}`);
  if (messages.value.length > 10) {
    messages.value.pop();
  }
};

const simulateData = () => {
  simulateInterval = setInterval(() => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    uptime.value = `${hours}:${minutes}:${seconds}`;
    clients.value = Math.floor(Math.random() * 10);
  }, 1000);
};

onMounted(() => {
  // 监听来自 C++ 的消�?  if (window.chrome?.webview) {
    window.chrome.webview.addEventListener('message', (event) => {
      handleMessage(event.data);
    });
    log('已连接到 C++ 后端 (WebView2)');
  } else {
    log('运行在独立模式（�?C++ 后端�?);
    simulateData();
  }

  statusText.value = '�?服务运行�?;
});

onUnmounted(() => {
  if (simulateInterval) {
    clearInterval(simulateInterval);
  }
});
</script>

<style lang="scss" scoped>
.container {
  background: white;
  border-radius: 15px;
  padding: 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 600px;
  width: 90%;
  margin: 50px auto;
}

.logo {
  text-align: center;
  font-size: 64px;
  margin-bottom: 20px;
}

h1 {
  color: #333;
  text-align: center;
  margin-bottom: 30px;
  font-size: 28px;
}

.status {
  padding: 20px;
  border-radius: 8px;
  margin: 20px 0;
  border-left: 4px solid #667eea;
  background: #e7f3ff;

  h3 {
    color: #667eea;
    margin-bottom: 10px;
  }

  p {
    color: #666;
    font-size: 16px;
  }
}

.status-success {
  background: #e7f7ef;
  border-left-color: #52c41a;

  h3 {
    color: #52c41a;
  }
}

.status-warning {
  background: #fff7e6;
  border-left-color: #faad14;

  h3 {
    color: #faad14;
  }
}

.status-error {
  background: #fff1f0;
  border-left-color: #f5222d;

  h3 {
    color: #f5222d;
  }
}

.info-list {
  list-style: none;
  margin: 20px 0;

  li {
    padding: 10px 0;
    border-bottom: 1px solid #eee;
    display: flex;
    justify-content: space-between;

    &:last-child {
      border-bottom: none;
    }

    .label {
      color: #666;
    }

    .value {
      color: #333;
      font-weight: bold;
    }
  }
}

.btn-group {
  text-align: center;
  margin-top: 25px;

  .btn {
    display: inline-block;
    padding: 12px 30px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    margin: 5px;
    font-size: 16px;
    transition: transform 0.2s;

    &:hover {
      transform: translateY(-2px);
    }

    &:active {
      transform: translateY(0);
    }

    &.btn-danger {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }
  }
}

.message-log {
  margin-top: 30px;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 8px;
  max-height: 200px;
  overflow-y: auto;

  h4 {
    color: #666;
    margin-bottom: 10px;
    font-size: 14px;
  }

  ul {
    list-style: none;

    li {
      font-size: 12px;
      color: #666;
      padding: 5px 0;
      border-bottom: 1px solid #e0e0e0;

      &:last-child {
        border-bottom: none;
      }
    }
  }
}
</style>
