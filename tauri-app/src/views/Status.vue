<template>
  <div class="status-view">
    <!-- 标题栏 -->
    <div class="title-bar">
      <div class="title">
        <span class="title-icon">📊</span>
        <span>实训教学系统 - 系统状态分析</span>
      </div>
      <div class="window-controls">
        <button class="control-btn" @click="goBack" title="返回"><span>←</span></button>
        <button class="control-btn" @click="minimize" title="最小化"><span>－</span></button>
        <button class="control-btn" @click="maximize" title="最大化"><span>□</span></button>
        <button class="control-btn close" @click="close" title="关闭"><span>×</span></button>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="main-content">
      <!-- 顶部概览卡片 -->
      <div class="overview-cards">
        <div class="overview-card">
          <div class="card-icon green">🟢</div>
          <div class="card-content">
            <div class="card-value">{{ onlineServices }}</div>
            <div class="card-label">在线服务</div>
          </div>
        </div>
        <div class="overview-card">
          <div class="card-icon blue">🔵</div>
          <div class="card-content">
            <div class="card-value">{{ totalServices }}</div>
            <div class="card-label">服务总数</div>
          </div>
        </div>
        <div class="overview-card">
          <div class="card-icon purple">🟣</div>
          <div class="card-content">
            <div class="card-value">{{ activeConnections }}</div>
            <div class="card-label">活跃连接</div>
          </div>
        </div>
        <div class="overview-card">
          <div class="card-icon orange">🟠</div>
          <div class="card-content">
            <div class="card-value">{{ systemUptime }}</div>
            <div class="card-label">系统运行时间</div>
          </div>
        </div>
      </div>

      <!-- 状态网格 -->
      <div class="status-grid">
        <!-- 资源使用情况 -->
        <div class="status-panel">
          <div class="panel-header">
            <h3>💻 资源使用情况</h3>
            <span class="update-time">更新时间: {{ lastUpdateTime }}</span>
          </div>
          <div class="resource-list">
            <div class="resource-item">
              <div class="resource-header">
                <span class="resource-name">CPU 使用率</span>
                <span class="resource-value">{{ cpuUsage }}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: cpuUsage + '%', backgroundColor: getCpuColor(cpuUsage) }"></div>
              </div>
            </div>
            <div class="resource-item">
              <div class="resource-header">
                <span class="resource-name">内存使用</span>
                <span class="resource-value">{{ memoryUsed }} / {{ memoryTotal }}</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: memoryPercent + '%', backgroundColor: getMemoryColor(memoryPercent) }"></div>
              </div>
            </div>
            <div class="resource-item">
              <div class="resource-header">
                <span class="resource-name">磁盘空间</span>
                <span class="resource-value">{{ diskUsed }} / {{ diskTotal }}</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: diskPercent + '%', backgroundColor: getDiskColor(diskPercent) }"></div>
              </div>
            </div>
            <div class="resource-item">
              <div class="resource-header">
                <span class="resource-name">网络带宽</span>
                <span class="resource-value">{{ networkUsage }} Mbps</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: networkPercent + '%', backgroundColor: getNetworkColor(networkPercent) }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 服务状态列表 -->
        <div class="status-panel">
          <div class="panel-header">
            <h3>🔧 服务状态</h3>
            <button class="refresh-btn" @click="refreshServices">🔄 刷新</button>
          </div>
          <div class="service-list">
            <div
              v-for="service in services"
              :key="service.name"
              :class="['service-item', service.status]"
            >
              <div class="service-status-dot"></div>
              <div class="service-info">
                <div class="service-name">{{ service.name }}</div>
                <div class="service-desc">{{ service.description }}</div>
              </div>
              <div class="service-meta">
                <span class="service-port">{{ service.port }}</span>
                <span :class="['service-status-text', service.status]">
                  {{ service.status === 'online' ? '运行中' : service.status === 'warning' ? '警告' : '离线' }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 连接统计 -->
        <div class="status-panel">
          <div class="panel-header">
            <h3>🔗 连接统计</h3>
          </div>
          <div class="connection-stats">
            <div class="connection-item">
              <div class="connection-icon">👨‍🎓</div>
              <div class="connection-info">
                <div class="connection-value">{{ studentConnections }}</div>
                <div class="connection-label">学生连接</div>
              </div>
            </div>
            <div class="connection-item">
              <div class="connection-icon">👨‍🏫</div>
              <div class="connection-info">
                <div class="connection-value">{{ teacherConnections }}</div>
                <div class="connection-label">教师连接</div>
              </div>
            </div>
            <div class="connection-item">
              <div class="connection-icon">📡</div>
              <div class="connection-info">
                <div class="connection-value">{{ apiConnections }}</div>
                <div class="connection-label">API 连接</div>
              </div>
            </div>
            <div class="connection-item">
              <div class="connection-icon">💬</div>
              <div class="connection-info">
                <div class="connection-value">{{ messageQueue }}</div>
                <div class="connection-label">消息队列</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 性能指标 -->
        <div class="status-panel">
          <div class="panel-header">
            <h3>📈 性能指标</h3>
          </div>
          <div class="performance-list">
            <div class="performance-item">
              <span class="performance-name">平均响应时间</span>
              <span class="performance-value good">{{ avgResponseTime }}ms</span>
            </div>
            <div class="performance-item">
              <span class="performance-name">请求成功率</span>
              <span class="performance-value good">{{ requestSuccessRate }}%</span>
            </div>
            <div class="performance-item">
              <span class="performance-name">并发处理数</span>
              <span class="performance-value">{{ concurrentRequests }}</span>
            </div>
            <div class="performance-item">
              <span class="performance-name">数据吞吐量</span>
              <span class="performance-value">{{ dataThroughput }} MB/s</span>
            </div>
            <div class="performance-item">
              <span class="performance-name">缓存命中率</span>
              <span class="performance-value good">{{ cacheHitRate }}%</span>
            </div>
            <div class="performance-item">
              <span class="performance-name">数据库连接池</span>
              <span class="performance-value">{{ dbConnections }}/{{ dbMaxConnections }}</span>
            </div>
          </div>
        </div>

        <!-- 最近活动日志 -->
        <div class="status-panel activity-panel">
          <div class="panel-header">
            <h3>📝 最近活动</h3>
          </div>
          <div class="activity-list">
            <div v-for="activity in recentActivities" :key="activity.id" class="activity-item">
              <span class="activity-time">{{ activity.time }}</span>
              <span class="activity-icon">{{ activity.icon }}</span>
              <span class="activity-message">{{ activity.message }}</span>
            </div>
          </div>
        </div>

        <!-- 系统健康度 -->
        <div class="status-panel health-panel">
          <div class="panel-header">
            <h3>❤️ 系统健康度</h3>
          </div>
          <div class="health-ring">
            <div class="ring-chart">
              <svg viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#1a1a2e"
                  stroke-width="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  :stroke="healthColor"
                  stroke-width="8"
                  stroke-linecap="round"
                  :stroke-dasharray="circumference"
                  :stroke-dashoffset="strokeDashoffset"
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div class="ring-center">
                <div class="ring-value">{{ healthScore }}</div>
                <div class="ring-label">健康度</div>
              </div>
            </div>
          </div>
          <div class="health-details">
            <div :class="['health-detail', 'cpu']">
              <span class="detail-label">CPU</span>
              <span :class="['detail-value', getHealthStatus(cpuUsage)]">{{ cpuUsage }}%</span>
            </div>
            <div :class="['health-detail', 'memory']">
              <span class="detail-label">内存</span>
              <span :class="['detail-value', getHealthStatus(memoryPercent)]">{{ memoryPercent }}%</span>
            </div>
            <div :class="['health-detail', 'disk']">
              <span class="detail-label">磁盘</span>
              <span :class="['detail-value', getHealthStatus(diskPercent)]">{{ diskPercent }}%</span>
            </div>
            <div :class="['health-detail', 'network']">
              <span class="detail-label">网络</span>
              <span :class="['detail-value', getHealthStatus(networkPercent)]">{{ networkPercent }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { minimizeWindow, maximizeWindow, closeApp } from '../utils/tauri-api.js';

const router = useRouter();

// 导航和窗口控制
const goBack = () => {
  router.push('/');
};

const minimize = () => {
  minimizeWindow();
};

const maximize = () => {
  maximizeWindow();
};

const close = () => {
  closeApp();
};

// 概览数据
const onlineServices = ref(7);
const totalServices = ref(8);
const activeConnections = ref(124);
const systemUptime = ref('23天 14小时');

// 资源使用数据
const cpuUsage = ref(35);
const memoryUsed = ref('8.5 GB');
const memoryTotal = ref('16 GB');
const memoryPercent = ref(53);
const diskUsed = ref('245 GB');
const diskTotal = ref('512 GB');
const diskPercent = ref(48);
const networkUsage = ref(128);
const networkPercent = ref(32);

// 服务列表
const services = ref([
  { name: '流媒体服务', description: '视频流推送服务', port: 'RTMP 1935', status: 'online' },
  { name: 'API 网关', description: 'REST API 服务', port: 'HTTP 8080', status: 'online' },
  { name: '数据库服务', description: 'MySQL 数据库', port: '3306', status: 'online' },
  { name: '消息队列', description: 'Redis 缓存队列', port: '6379', status: 'online' },
  { name: '认证服务', description: 'OAuth2 认证中心', port: 'HTTP 9090', status: 'online' },
  { name: '文件存储', description: '分布式文件存储', port: 'HTTP 9000', status: 'online' },
  { name: 'AI 分析服务', description: '视觉分析引擎', port: 'gRPC 50051', status: 'warning' },
  { name: '日志服务', description: '日志收集存储', port: 'UDP 514', status: 'offline' },
]);

// 连接统计
const studentConnections = ref(89);
const teacherConnections = ref(12);
const apiConnections = ref(23);
const messageQueue = ref(156);

// 性能指标
const avgResponseTime = ref(45);
const requestSuccessRate = ref(99.8);
const concurrentRequests = ref(284);
const dataThroughput = ref(12.5);
const cacheHitRate = ref(92);
const dbConnections = ref(15);
const dbMaxConnections = ref(20);

// 最近活动
const recentActivities = ref([
  { id: 1, time: '刚刚', icon: '📤', message: '学生张三提交了实验报告' },
  { id: 2, time: '2分钟前', icon: '🔗', message: '新连接: 学生李四' },
  { id: 3, time: '5分钟前', icon: '📊', message: 'AI分析完成: 专注度报告生成' },
  { id: 4, time: '8分钟前', icon: '📁', message: '文件上传: 实验数据.zip' },
  { id: 5, time: '12分钟前', icon: '🔄', message: '服务心跳检测完成' },
]);

// 系统健康度
const healthScore = ref(87);
const lastUpdateTime = ref('2024-01-15 14:32:18');

// 图表计算
const circumference = 2 * Math.PI * 40;
const strokeDashoffset = computed(() => {
  return circumference - (healthScore.value / 100) * circumference;
});

const healthColor = computed(() => {
  if (healthScore.value >= 80) return '#4ADE80';
  if (healthScore.value >= 60) return '#FACC15';
  return '#F87171';
});

// 颜色函数
const getCpuColor = (usage) => {
  if (usage >= 90) return '#F87171';
  if (usage >= 70) return '#FBBF24';
  return '#4ADE80';
};

const getMemoryColor = (usage) => {
  if (usage >= 90) return '#F87171';
  if (usage >= 70) return '#FBBF24';
  return '#60A5FA';
};

const getDiskColor = (usage) => {
  if (usage >= 90) return '#F87171';
  if (usage >= 70) return '#FBBF24';
  return '#A78BFA';
};

const getNetworkColor = (usage) => {
  if (usage >= 90) return '#F87171';
  if (usage >= 70) return '#FBBF24';
  return '#34D399';
};

const getHealthStatus = (value) => {
  if (value >= 90) return 'danger';
  if (value >= 70) return 'warning';
  return 'good';
};

// 刷新服务状态
const refreshServices = () => {
  services.value = services.value.map(s => ({
    ...s,
    status: Math.random() > 0.1 ? 'online' : (Math.random() > 0.5 ? 'warning' : 'offline')
  }));
  onlineServices.value = services.value.filter(s => s.status === 'online').length;
  updateTime();
};

const updateTime = () => {
  const now = new Date();
  lastUpdateTime.value = now.toLocaleString('zh-CN');
};

// 模拟数据更新
let updateInterval = null;

const simulateUpdate = () => {
  cpuUsage.value = Math.floor(Math.random() * 40) + 20;
  memoryPercent.value = Math.floor(Math.random() * 20) + 45;
  diskPercent.value = Math.floor(Math.random() * 10) + 45;
  networkPercent.value = Math.floor(Math.random() * 40) + 15;
  networkUsage.value = networkPercent.value * 4;

  activeConnections.value = Math.floor(Math.random() * 50) + 100;
  healthScore.value = Math.floor(Math.random() * 15) + 80;

  updateTime();
};

onMounted(() => {
  updateInterval = setInterval(simulateUpdate, 5000);
});

onUnmounted(() => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});
</script>

<style lang="scss" scoped>
.status-view {
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #0D1B2A 0%, #1B263B 100%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.title-bar {
  height: 40px;
  min-height: 40px;
  background: #1B263B;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  -webkit-app-region: drag;
  flex-shrink: 0;

  .title {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #E0E1DD;
    font-size: 14px;
    font-weight: 500;

    .title-icon {
      font-size: 16px;
    }
  }

  .window-controls {
    display: flex;
    gap: 8px;
    -webkit-app-region: no-drag;
    flex-shrink: 0;

    .control-btn {
      width: 32px;
      height: 32px;
      min-width: 32px;
      min-height: 32px;
      border: none;
      background: #415A77;
      color: #E0E1DD;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;

      &:hover {
        background: #778DA9;
      }

      &.close:hover {
        background: #E63946;
      }
    }
  }
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.overview-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 24px;

  .overview-card {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.3s;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
    }

    .card-icon {
      font-size: 32px;

      &.green { color: #4ADE80; }
      &.blue { color: #60A5FA; }
      &.purple { color: #A78BFA; }
      &.orange { color: #FB923C; }
    }

    .card-content {
      .card-value {
        font-size: 28px;
        font-weight: bold;
        color: #FFFFFF;
        margin-bottom: 4px;
      }

      .card-label {
        font-size: 14px;
        color: #A8A8A8;
      }
    }
  }
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.status-panel {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

    h3 {
      color: #FFFFFF;
      font-size: 16px;
      margin: 0;
    }

    .update-time {
      font-size: 12px;
      color: #6B7280;
    }

    .refresh-btn {
      background: #415A77;
      border: none;
      color: #E0E1DD;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: #778DA9;
      }
    }
  }
}

.resource-list {
  .resource-item {
    margin-bottom: 16px;

    &:last-child {
      margin-bottom: 0;
    }

    .resource-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;

      .resource-name {
        color: #E0E1DD;
        font-size: 14px;
      }

      .resource-value {
        color: #FFFFFF;
        font-weight: 500;
        font-size: 14px;
      }
    }

    .progress-bar {
      height: 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      overflow: hidden;

      .progress-fill {
        height: 100%;
        border-radius: 4px;
        transition: width 0.5s ease;
      }
    }
  }
}

.service-list {
  .service-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 8px;
    transition: all 0.2s;

    &:last-child {
      margin-bottom: 0;
    }

    &.online {
      background: rgba(74, 222, 128, 0.1);
      .service-status-dot { background: #4ADE80; }
    }

    &.warning {
      background: rgba(251, 191, 36, 0.1);
      .service-status-dot { background: #FBBF24; }
    }

    &.offline {
      background: rgba(248, 113, 113, 0.1);
      .service-status-dot { background: #F87171; }
    }

    .service-status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .service-info {
      flex: 1;
      min-width: 0;

      .service-name {
        color: #FFFFFF;
        font-size: 14px;
        font-weight: 500;
        margin-bottom: 2px;
      }

      .service-desc {
        color: #6B7280;
        font-size: 12px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .service-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;

      .service-port {
        font-size: 12px;
        color: #6B7280;
        font-family: monospace;
      }

      .service-status-text {
        font-size: 12px;
        font-weight: 500;
        padding: 2px 8px;
        border-radius: 10px;

        &.online {
          color: #4ADE80;
          background: rgba(74, 222, 128, 0.2);
        }

        &.warning {
          color: #FBBF24;
          background: rgba(251, 191, 36, 0.2);
        }

        &.offline {
          color: #F87171;
          background: rgba(248, 113, 113, 0.2);
        }
      }
    }
  }
}

.connection-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;

  .connection-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;

    .connection-icon {
      font-size: 28px;
    }

    .connection-info {
      .connection-value {
        font-size: 24px;
        font-weight: bold;
        color: #FFFFFF;
        margin-bottom: 2px;
      }

      .connection-label {
        font-size: 12px;
        color: #6B7280;
      }
    }
  }
}

.performance-list {
  .performance-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);

    &:last-child {
      border-bottom: none;
    }

    .performance-name {
      color: #A8A8A8;
      font-size: 14px;
    }

    .performance-value {
      color: #FFFFFF;
      font-weight: 500;
      font-size: 14px;

      &.good {
        color: #4ADE80;
      }
    }
  }
}

.activity-panel {
  grid-column: span 1;

  .activity-list {
    max-height: 200px;
    overflow-y: auto;

    .activity-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);

      &:last-child {
        border-bottom: none;
      }

      .activity-time {
        color: #6B7280;
        font-size: 12px;
        width: 60px;
        flex-shrink: 0;
      }

      .activity-icon {
        font-size: 16px;
        width: 24px;
        text-align: center;
      }

      .activity-message {
        color: #E0E1DD;
        font-size: 13px;
        flex: 1;
      }
    }
  }
}

.health-panel {
  grid-column: span 2;

  .health-ring {
    display: flex;
    justify-content: center;
    margin-bottom: 20px;

    .ring-chart {
      position: relative;
      width: 160px;
      height: 160px;

      svg {
        width: 100%;
        height: 100%;
      }

      .ring-center {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;

        .ring-value {
          font-size: 32px;
          font-weight: bold;
          color: #FFFFFF;
          display: block;
        }

        .ring-label {
          font-size: 12px;
          color: #6B7280;
        }
      }
    }
  }

  .health-details {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;

    .health-detail {
      text-align: center;
      padding: 12px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 8px;

      .detail-label {
        display: block;
        color: #6B7280;
        font-size: 12px;
        margin-bottom: 4px;
      }

      .detail-value {
        font-size: 18px;
        font-weight: bold;

        &.good { color: #4ADE80; }
        &.warning { color: #FBBF24; }
        &.danger { color: #F87171; }
      }
    }
  }
}

/* 响应式设计 */
@media (max-width: 1400px) {
  .status-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .health-panel {
    grid-column: span 2;
  }
}

@media (max-width: 768px) {
  .overview-cards {
    grid-template-columns: repeat(2, 1fr);
  }

  .status-grid {
    grid-template-columns: 1fr;
  }

  .health-panel {
    grid-column: span 1;
  }

  .health-details {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
