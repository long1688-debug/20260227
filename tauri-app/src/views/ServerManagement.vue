<template>
  <div class="server-management">
    <div class="container">
      <!-- 头部 -->
      <div class="header">
        <h1>🖥️ 服务端管理中心</h1>
        <p class="subtitle">Training Teaching System - Server Management</p>
      </div>

      <!-- 系统概览 -->
      <div class="overview-cards">
        <div class="overview-card">
          <div class="card-icon">👥</div>
          <div class="card-content">
            <div class="card-value">{{ stats.onlineUsers }}</div>
            <div class="card-label">在线用户</div>
          </div>
        </div>
        <div class="overview-card">
          <div class="card-icon">📊</div>
          <div class="card-content">
            <div class="card-value">{{ stats.activeSessions }}</div>
            <div class="card-label">活跃会话</div>
          </div>
        </div>
        <div class="overview-card">
          <div class="card-icon">💾</div>
          <div class="card-content">
            <div class="card-value">{{ stats.dataSize }} MB</div>
            <div class="card-label">数据大小</div>
          </div>
        </div>
        <div class="overview-card">
          <div class="card-icon">⏱️</div>
          <div class="card-content">
            <div class="card-value">{{ stats.uptime }}</div>
            <div class="card-label">运行时间</div>
          </div>
        </div>
      </div>

      <!-- 服务状态 -->
      <div class="section">
        <h2>📡 服务状态</h2>
        <div class="services-grid">
          <div v-for="service in services" :key="service.name" class="service-card" :class="{ online: service.online }">
            <div class="service-header">
              <div class="service-info">
                <span class="service-icon">{{ service.icon }}</span>
                <span class="service-name">{{ service.name }}</span>
              </div>
              <span :class="['service-status', service.online ? 'online' : 'offline']">
                {{ service.online ? '运行中' : '已停止' }}
              </span>
            </div>
            <div class="service-details">
              <div class="service-detail">
                <span class="detail-label">端口:</span>
                <span class="detail-value">{{ service.port }}</span>
              </div>
              <div class="service-detail">
                <span class="detail-label">状态:</span>
                <span class="detail-value">{{ service.status }}</span>
              </div>
              <div class="service-detail" v-if="service.online">
                <span class="detail-label">连接数:</span>
                <span class="detail-value">{{ service.connections }}</span>
              </div>
            </div>
            <div class="service-actions">
              <el-button
                v-if="!service.online"
                type="primary"
                size="small"
                @click="startService(service)"
              >
                启动
              </el-button>
              <el-button
                v-else
                type="danger"
                size="small"
                @click="stopService(service)"
              >
                停止
              </el-button>
              <el-button size="small" @click="restartService(service)">重启</el-button>
              <el-button size="small" @click="viewServiceLogs(service)">日志</el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 性能监控 -->
      <div class="section">
        <h2>📈 性能监控</h2>
        <div class="performance-grid">
          <div class="performance-item">
            <div class="perf-header">
              <span>CPU 使用率</span>
              <span class="perf-value">{{ performance.cpu }}%</span>
            </div>
            <el-progress :percentage="performance.cpu" :stroke-width="8" :color="getPerfColor(performance.cpu)" />
          </div>
          <div class="performance-item">
            <div class="perf-header">
              <span>内存使用</span>
              <span class="perf-value">{{ performance.memory }}%</span>
            </div>
            <el-progress :percentage="performance.memory" :stroke-width="8" :color="getPerfColor(performance.memory)" />
          </div>
          <div class="performance-item">
            <div class="perf-header">
              <span>网络流量</span>
              <span class="perf-value">{{ performance.network }} MB/s</span>
            </div>
            <el-progress :percentage="performance.network" :stroke-width="8" :color="getPerfColor(performance.network)" />
          </div>
          <div class="performance-item">
            <div class="perf-header">
              <span>磁盘 I/O</span>
              <span class="perf-value">{{ performance.disk }}%</span>
            </div>
            <el-progress :percentage="performance.disk" :stroke-width="8" :color="getPerfColor(performance.disk)" />
          </div>
        </div>
      </div>

      <!-- 日志查看 -->
      <div class="section">
        <h2>📋 系统日志</h2>
        <div class="log-actions">
          <el-button type="primary" size="small" @click="refreshLogs">刷新</el-button>
          <el-button type="success" size="small" @click="exportLogs">导出</el-button>
          <el-button type="danger" size="small" @click="clearLogs">清空</el-button>
          <el-select v-model="logFilter" placeholder="日志级别" size="small" style="width: 120px">
            <el-option label="全部" value="all" />
            <el-option label="信息" value="info" />
            <el-option label="警告" value="warning" />
            <el-option label="错误" value="error" />
          </el-select>
        </div>
        <div class="log-container">
          <div v-for="(log, index) in filteredLogs" :key="index" class="log-item" :class="log.level">
            <span class="log-time">{{ log.time }}</span>
            <span class="log-level">{{ log.level.toUpperCase() }}</span>
            <span class="log-source">{{ log.source }}</span>
            <span class="log-message">{{ log.message }}</span>
          </div>
        </div>
      </div>

      <!-- 配置管理 -->
      <div class="section">
        <h2>⚙️ 配置管理</h2>
        <el-form label-width="120px" class="config-form">
          <el-form-item label="服务器端口">
            <el-input v-model="config.serverPort" placeholder="8082" />
          </el-form-item>
          <el-form-item label="最大连接数">
            <el-input-number v-model="config.maxConnections" :min="10" :max="1000" />
          </el-form-item>
          <el-form-item label="日志级别">
            <el-select v-model="config.logLevel">
              <el-option label="DEBUG" value="debug" />
              <el-option label="INFO" value="info" />
              <el-option label="WARNING" value="warning" />
              <el-option label="ERROR" value="error" />
            </el-select>
          </el-form-item>
          <el-form-item label="启用 HTTPS">
            <el-switch v-model="config.enableHttps" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="saveConfig">保存配置</el-button>
            <el-button @click="resetConfig">重置</el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const stats = ref({
  onlineUsers: 24,
  activeSessions: 18,
  dataSize: 128,
  uptime: '2天 5小时 30分钟'
});

const services = ref([
  {
    name: 'C++ 服务端',
    icon: '🔧',
    online: true,
    port: 8082,
    status: '正常运行',
    connections: 24
  },
  {
    name: 'HTTP 服务',
    icon: '🌐',
    online: true,
    port: 8080,
    status: '正常运行',
    connections: 156
  },
  {
    name: 'ZLMediaKit',
    icon: '📡',
    online: true,
    port: 801,
    status: '正常运行',
    connections: 42
  },
  {
    name: '数据库',
    icon: '💾',
    online: true,
    port: 3306,
    status: '连接正常',
    connections: 1
  },
  {
    name: 'Redis 缓存',
    icon: '⚡',
    online: false,
    port: 6379,
    status: '已停止',
    connections: 0
  }
]);

const performance = ref({
  cpu: 45,
  memory: 62,
  network: 78,
  disk: 23
});

const logFilter = ref('all');

const logs = ref([
  { time: '2024-02-28 10:00:00', level: 'info', source: 'Server', message: '系统启动成功' },
  { time: '2024-02-28 10:01:23', level: 'info', source: 'Network', message: '新客户端连接: 192.168.1.100' },
  { time: '2024-02-28 10:02:15', level: 'warning', source: 'Auth', message: '用户登录失败: 用户名不存在' },
  { time: '2024-02-28 10:03:45', level: 'info', source: 'Database', message: '数据备份完成' },
  { time: '2024-02-28 10:05:12', level: 'error', source: 'Stream', message: '视频流中断: 连接超时' },
  { time: '2024-02-28 10:06:33', level: 'info', source: 'Network', message: '客户端断开连接: 192.168.1.105' }
]);

const config = ref({
  serverPort: '8082',
  maxConnections: 100,
  logLevel: 'info',
  enableHttps: false
});

const filteredLogs = computed(() => {
  if (logFilter.value === 'all') {
    return logs.value;
  }
  return logs.value.filter(log => log.level === logFilter.value);
});

const getPerfColor = (value) => {
  if (value < 50) return '#4ade80';
  if (value < 80) return '#facc15';
  return '#ef4444';
};

const startService = (service) => {
  console.log('启动服务:', service.name);
  service.online = true;
};

const stopService = (service) => {
  console.log('停止服务:', service.name);
  service.online = false;
};

const restartService = (service) => {
  console.log('重启服务:', service.name);
};

const viewServiceLogs = (service) => {
  console.log('查看日志:', service.name);
};

const refreshLogs = () => {
  console.log('刷新日志');
};

const exportLogs = () => {
  console.log('导出日志');
};

const clearLogs = () => {
  logs.value = [];
};

const saveConfig = () => {
  console.log('保存配置:', config.value);
};

const resetConfig = () => {
  config.value = {
    serverPort: '8082',
    maxConnections: 100,
    logLevel: 'info',
    enableHttps: false
  };
};
</script>

<style lang="scss" scoped>
.server-management {
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  padding: 40px 20px;
  overflow-y: auto;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;

  .container {
    max-width: 1400px;
    margin: 0 auto;
  }

  .header {
    text-align: center;
    margin-bottom: 40px;

    h1 {
      color: #fff;
      font-size: 36px;
      margin: 0 0 10px;
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    }

    .subtitle {
      color: #a8a8a8;
      font-size: 16px;
      margin: 0;
    }
  }

  .overview-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    margin-bottom: 40px;

    .overview-card {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 24px;
      display: flex;
      align-items: center;
      gap: 20px;
      border: 1px solid rgba(255, 255, 255, 0.1);

      .card-icon {
        font-size: 48px;
      }

      .card-content {
        .card-value {
          color: #fff;
          font-size: 32px;
          font-weight: bold;
          margin-bottom: 4px;
        }

        .card-label {
          color: #a8a8a8;
          font-size: 14px;
        }
      }
    }
  }

  .section {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    border-radius: 16px;
    padding: 30px;
    margin-bottom: 30px;
    border: 1px solid rgba(255, 255, 255, 0.1);

    h2 {
      color: #fff;
      font-size: 24px;
      margin: 0 0 24px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .services-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;

      .service-card {
        background: rgba(0, 0, 0, 0.3);
        border-radius: 12px;
        padding: 20px;
        border: 2px solid transparent;
        transition: all 0.3s;

        &.online {
          border-color: rgba(74, 222, 128, 0.3);
        }

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
        }

        .service-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;

          .service-info {
            display: flex;
            align-items: center;
            gap: 10px;

            .service-icon {
              font-size: 24px;
            }

            .service-name {
              color: #fff;
              font-size: 16px;
              font-weight: 500;
            }
          }

          .service-status {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;

            &.online {
              background: rgba(74, 222, 128, 0.2);
              color: #4ade80;
            }

            &.offline {
              background: rgba(239, 68, 68, 0.2);
              color: #ef4444;
            }
          }
        }

        .service-details {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;

          .service-detail {
            display: flex;
            justify-content: space-between;

            .detail-label {
              color: #a8a8a8;
              font-size: 14px;
            }

            .detail-value {
              color: #fff;
              font-size: 14px;
              font-weight: 500;
            }
          }
        }

        .service-actions {
          display: flex;
          gap: 8px;
        }
      }
    }

    .performance-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;

      .performance-item {
        background: rgba(0, 0, 0, 0.3);
        border-radius: 12px;
        padding: 20px;

        .perf-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;

          span:first-child {
            color: #a8a8a8;
            font-size: 14px;
          }

          .perf-value {
            color: #fff;
            font-size: 20px;
            font-weight: bold;
          }
        }
      }
    }

    .log-actions {
      display: flex;
      gap: 10px;
      margin-bottom: 16px;
    }

    .log-container {
      max-height: 400px;
      overflow-y: auto;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      padding: 16px;

      .log-item {
        display: flex;
        gap: 16px;
        padding: 8px;
        border-radius: 4px;
        margin-bottom: 4px;
        font-family: 'Courier New', monospace;
        font-size: 13px;

        &.info {
          background: rgba(76, 201, 240, 0.1);
          color: #4CC9F0;
        }

        &.warning {
          background: rgba(250, 204, 21, 0.1);
          color: #facc15;
        }

        &.error {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }

        .log-time {
          color: #a8a8a8;
          min-width: 200px;
        }

        .log-level {
          color: #fff;
          font-weight: bold;
          min-width: 80px;
        }

        .log-source {
          color: #a8a8a8;
          min-width: 100px;
        }

        .log-message {
          flex: 1;
          color: #fff;
        }
      }
    }

    .config-form {
      max-width: 600px;

      :deep(.el-form-item__label) {
        color: #a8a8a8;
      }
    }
  }
}
</style>
