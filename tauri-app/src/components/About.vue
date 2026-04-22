<template>
  <div class="about-container">
    <div class="about-content">
      <!-- 软件 Logo 和名称 -->
      <div class="app-identity">
        <div class="app-logo">🎓</div>
        <h1 class="app-name">{{ appInfo.name }}</h1>
        <div class="app-version">版本 {{ appInfo.version }}</div>
      </div>

      <!-- 软件简介 -->
      <div class="app-description">
        <p>{{ appInfo.description }}</p>
      </div>

      <!-- 公司信息 -->
      <div class="info-section">
        <h3>🏢 公司信息</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-icon">🏛️</span>
            <div class="info-detail">
              <div class="info-label">公司名称</div>
              <div class="info-value">{{ companyInfo.name }}</div>
            </div>
          </div>
          <div class="info-item">
            <span class="info-icon">📍</span>
            <div class="info-detail">
              <div class="info-label">公司地址</div>
              <div class="info-value">{{ companyInfo.address }}</div>
            </div>
          </div>
          <div class="info-item">
            <span class="info-icon">🌐</span>
            <div class="info-detail">
              <div class="info-label">官方网站</div>
              <div class="info-value website">{{ companyInfo.website }}</div>
            </div>
          </div>
          <div class="info-item">
            <span class="info-icon">📧</span>
            <div class="info-detail">
              <div class="info-label">电子邮箱</div>
              <div class="info-value">{{ companyInfo.email }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 售后服务 -->
      <div class="info-section">
        <h3>📞 售后服务</h3>
        <div class="support-cards">
          <div class="support-card">
            <div class="support-icon">📞</div>
            <div class="support-info">
              <div class="support-label">售后服务电话</div>
              <div class="support-value phone">{{ companyInfo.supportPhone }}</div>
              <div class="support-hours">服务时间：{{ companyInfo.supportHours }}</div>
            </div>
          </div>
          <div class="support-card">
            <div class="support-icon">💬</div>
            <div class="support-info">
              <div class="support-label">在线客服</div>
              <div class="support-value">{{ companyInfo.onlineSupport }}</div>
              <div class="support-hours">工作时间：{{ companyInfo.onlineHours }}</div>
            </div>
          </div>
          <div class="support-card">
            <div class="support-icon">📱</div>
            <div class="support-info">
              <div class="support-label">技术支持</div>
              <div class="support-value">{{ companyInfo.techSupport }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 技术栈信息 -->
      <div class="info-section">
        <h3>🛠️ 技术栈</h3>
        <div class="tech-stack">
          <el-tag v-for="tech in techStack" :key="tech" size="large" class="tech-tag">
            {{ tech }}
          </el-tag>
        </div>
      </div>

      <!-- 版权信息 -->
      <div class="copyright-section">
        <div class="copyright">
          <p>{{ copyrightInfo.text }}</p>
          <p class="copyright-sub">{{ copyrightInfo.subtext }}</p>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-buttons">
        <el-button @click="checkUpdate">
          🔍 检查更新
        </el-button>
        <el-button @click="viewLicense">
          📄 查看许可
        </el-button>
        <el-button @click="openHelpCenter">
          ❓帮助中心
        </el-button>
      </div>

      <!-- 更新日志对话框 -->
      <el-dialog
        v-model="showUpdateDialog"
        title="检查更新"
        width="500px"
      >
        <div v-if="updateInfo" class="update-content">
          <div class="update-status" :class="updateInfo.hasUpdate ? 'has-update' : 'up-to-date'">
            <span class="status-icon">{{ updateInfo.hasUpdate ? '🎉' : '✅' }}</span>
            <span class="status-text">{{ updateInfo.message }}</span>
          </div>
          <div v-if="updateInfo.hasUpdate" class="update-details">
            <h4>新版本特性：</h4>
            <ul>
              <li v-for="(feature, index) in updateInfo.features" :key="index">
                {{ feature }}
              </li>
            </ul>
          </div>
        </div>
        <template #footer>
          <el-button @click="showUpdateDialog = false">关闭</el-button>
          <el-button v-if="updateInfo?.hasUpdate" type="primary" @click="downloadUpdate" :loading="downloadingUpdate">
            {{ downloadingUpdate ? '下载中...' : '立即下载并安装' }}
          </el-button>
      </el-dialog>

      <!-- 许可协议对话框 -->
      <el-dialog
        v-model="showLicenseDialog"
        title="软件许可协议"
        width="600px"
      >
        <div class="license-content">
          <h4>软件许可协议</h4>
          <div class="license-text">
            <p>1. 本软件受著作权法保护。</p>
            <p>2. 未经授权，不得复制、修改、分发本软件。</p>
            <p>3. 本软件按"原样"提供，不提供任何明示或暗示的保证。</p>
            <p>4. 在适用法律允许的最大范围内，作者不对任何损害负责。</p>
            <p>5. 使用本软件即表示您同意本许可协议的所有条款。</p>
          </div>
        </div>
        <template #footer>
          <el-button @click="showLicenseDialog = false">关闭</el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { invoke, getSystemInfo } from '../utils/tauri-api.js';

// 动态导入 Tauri updater API + 获取真实版本号
let checkUpdateFn = null;
let installUpdateFn = null;

onMounted(async () => {
  // 尝试从 Tauri 获取真实应用版本
  try {
    if (window.__TAURI__) {
      const { getVersion } = await import('@tauri-apps/api/app');
      appInfo.version = await getVersion();
    }
  } catch { /* 使用默认版本号 */ }

  // 加载 updater API
  try {
    const updater = await import('@tauri-apps/plugin-updater');
    checkUpdateFn = updater.check;
    installUpdateFn = updater.install;
    console.log('[About] Updater API 加载成功');
  } catch {
    console.warn('[About] 非 Tauri 环境，更新功能不可用');
  }
});

const showUpdateDialog = ref(false);
const showLicenseDialog = ref(false);
const updateInfo = ref(null);

// 应用信息 - 动态版本号
const appInfo = reactive({
  name: '实训教学实践系统',
  version: '2.0.0',
  build: '20260402',
  description: '一款基于 AI 视觉识别和语音识别的现代化实训教学系统，支持多屏互动、实时字幕、直播管理等功能。'
});

// 公司信息
const companyInfo = reactive({
  name: '某某教育科技有限公司',
  address: '北京市海淀区中关村科技园 XX 号',
  website: 'www.example.com',
  email: 'info@example.com',
  supportPhone: '400-XXX-XXXX',
  supportHours: '周一至周日 9:00-18:00',
  onlineSupport: 'QQ: XXXX-XXXX',
  onlineHours: '每天 8:00-22:00',
  techSupport: 'support@example.com'
});

// 技术栈
const techStack = [
  'Tauri 2.0',
  'Vue 3.x',
  'Element Plus',
  'Node.js',
  'C++',
  'Whisper ASR',
  'OpenCV',
  'WebSocket'
];

// 版权信息
const copyrightInfo = reactive({
  text: '© 2024-2026 某某教育科技有限公司 版权所有',
  subtext: '本软件受著作权法和国际条约保护，未经授权复制或分发将受到法律追究。'
});

// 检查更新
const checkingUpdate = ref(false);
const downloadingUpdate = ref(false);

const checkUpdate = async () => {
  showUpdateDialog.value = true;
  updateInfo.value = null;

  if (!checkUpdateFn) {
    // 非 Tauri 环境：模拟
    await new Promise(resolve => setTimeout(resolve, 1000));
    updateInfo.value = {
      hasUpdate: false,
      message: '当前已是最新版本（开发模式）',
      currentVersion: appInfo.version,
      features: []
    };
    return;
  }

  checkingUpdate.value = true;
  try {
    const update = await checkUpdateFn();
    if (update && update.available) {
      const manifest = update.manifest || {};
      updateInfo.value = {
        hasUpdate: true,
        message: `发现新版本 ${manifest.version || 'unknown'}`,
        currentVersion: appInfo.version,
        newVersion: manifest.version,
        features: (manifest.body || '').split('\n').filter(Boolean),
        releaseNotes: manifest.notes || '',
        date: manifest.date || ''
      };
      ElMessage.success('发现新版本！');
    } else {
      updateInfo.value = {
        hasUpdate: false,
        message: '当前已是最新版本',
        currentVersion: appInfo.version,
        features: []
      };
    }
  } catch (error) {
    console.error('检查更新失败:', error);
    updateInfo.value = {
      hasUpdate: false,
      message: `检查失败: ${error.message}`,
      currentVersion: appInfo.version,
      features: []
    };
    ElMessage.error('检查更新失败，请稍后重试');
  } finally {
    checkingUpdate.value = false;
  }
};

// 下载并安装更新
const downloadUpdate = async () => {
  if (!checkUpdateFn) {
    ElMessage.info('开发模式不支持自动更新');
    return;
  }

  downloadingUpdate.value = true;
  try {
    const update = await checkUpdateFn();
    if (!update?.available) {
      ElMessage.info('没有可用的更新');
      return;
    }

    ElMessage.info('正在下载更新...');
    
    // 下载并安装（Tauri updater 会处理下载进度和重启）
    await installUpdateFn(update);
    
    // 如果 installUpdate 没有触发重启（如需要手动确认）
    ElMessage.success('更新已就绪，将在下次启动时安装');
  } catch (error) {
    console.error('下载更新失败:', error);
    ElMessage.error(`更新失败: ${error.message}`);
  } finally {
    downloadingUpdate.value = false;
  }
};

// 查看许可
const viewLicense = () => {
  showLicenseDialog.value = true;
};

// 打开帮助中心
const openHelpCenter = () => {
  ElMessage.info('正在打开帮助中心...');
  // 使用 tauri-plugin-shell 的 open() 方法打开帮助中心
};

// 打开外部链接
const openExternal = async (url) => {
  try {
    const { open } = await import('@tauri-apps/plugin-shell');
    await open(url);
  } catch (e) {
    window.open(url, '_blank');
  }
};
</script>

<style lang="scss" scoped>
.about-container {
  padding: 10px;
  max-height: 50vh;
  overflow-y: auto;
}

.about-content {
  max-width: 800px;
  margin: 0 auto;
}

.app-identity {
  text-align: center;
  padding: 40px 0;
  border-bottom: 1px solid #3a3a5a;
  margin-bottom: 30px;
}

.app-logo {
  font-size: 80px;
  margin-bottom: 15px;
}

.app-name {
  font-size: 32px;
  color: #fff;
  margin: 10px 0;
}

.app-version {
  font-size: 16px;
  color: #909399;
  background: #2a2a4a;
  display: inline-block;
  padding: 6px 16px;
  border-radius: 20px;
}

.app-description {
  text-align: center;
  color: #ccc;
  font-size: 16px;
  line-height: 1.8;
  margin-bottom: 40px;
  padding: 0 20px;
}

.info-section {
  margin-bottom: 30px;

  h3 {
    font-size: 20px;
    color: #fff;
    margin: 0 0 20px 0;
    padding-bottom: 10px;
    border-bottom: 2px solid #4a4a6a;
  }
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.info-item {
  display: flex;
  align-items: flex-start;
  gap: 15px;
  padding: 15px;
  background: #1e1e3f;
  border-radius: 8px;
}

.info-icon {
  font-size: 24px;
}

.info-detail {
  flex: 1;
}

.info-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 5px;
}

.info-value {
  font-size: 14px;
  color: #fff;

  &.website {
    color: #409eff;
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }
}

.support-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.support-card {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
  background: #1e1e3f;
  border-radius: 8px;
  text-align: center;
}

.support-icon {
  font-size: 32px;
}

.support-info {
  flex: 1;
}

.support-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
}

.support-value {
  font-size: 16px;
  color: #fff;
  font-weight: 500;

  &.phone {
    color: #67c23a;
    font-size: 18px;
  }
}

.support-hours {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}

.tech-stack {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tech-tag {
  padding: 10px 20px;
  font-size: 14px;
}

.copyright-section {
  text-align: center;
  padding: 30px 0;
  border-top: 1px solid #3a3a5a;
  margin-top: 40px;
}

.copyright {
  color: #909399;
  font-size: 14px;
  line-height: 2;

  .copyright-sub {
    font-size: 12px;
    color: #666;
  }
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-top: 30px;
  padding-top: 30px;
  border-top: 1px solid #3a3a5a;
}

.update-content {
  .update-status {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 15px;
    border-radius: 8px;
    margin-bottom: 20px;

    &.has-update {
      background: #f0f9ff;
      border: 1px solid #409eff;

      .status-text {
        color: #409eff;
      }
    }

    &.up-to-date {
      background: #f0f9ffeb;
      border: 1px solid #67c23a;

      .status-text {
        color: #67c23a;
      }
    }
  }

  .status-icon {
    font-size: 24px;
  }

  .status-text {
    font-size: 16px;
    font-weight: 500;
  }

  .update-details {
    h4 {
      margin: 0 0 10px 0;
      color: #fff;
    }

    ul {
      color: #ccc;
      padding-left: 20px;
      line-height: 1.8;
    }
  }
}

.license-content {
  h4 {
    margin: 0 0 15px 0;
    color: #fff;
  }

  .license-text {
    max-height: 300px;
    overflow-y: auto;
    background: #1e1e3f;
    padding: 15px;
    border-radius: 8px;

    p {
      color: #ccc;
      line-height: 1.8;
      margin: 10px 0;
    }
  }
}

/* 响应式 */
@media (max-width: 768px) {
  .info-grid {
    grid-template-columns: 1fr;
  }

  .support-cards {
    grid-template-columns: 1fr;
  }
}
</style>
