<template>
  <div class="about-in-settings">
    <!-- 应用 Logo 和名称 -->
    <div class="app-identity">
      <div class="app-logo">🎓</div>
      <h1 class="app-name">{{ appInfo.name }}</h1>
      <div class="app-version">v{{ appInfo.version }}</div>
    </div>

    <!-- 应用简介 -->
    <div class="app-description">
      <p>{{ appInfo.description }}</p>
    </div>

    <!-- 联系信息和售后服务 -->
    <div class="info-row">
      <!-- 联系信息 -->
      <div class="info-column">
        <h3>🏛️ 联系信息</h3>
        <div class="compact-info">
          <div class="info-line">
            <span class="info-label">名称：</span>
            <span class="info-value">{{ companyInfo.name }}</span>
          </div>
          <div class="info-line">
            <span class="info-label">地址：</span>
            <span class="info-value">{{ companyInfo.address }}</span>
          </div>
          <div class="info-line">
            <span class="info-label">官网：</span>
            <span class="info-value">{{ companyInfo.website }}</span>
          </div>
          <div class="info-line">
            <span class="info-label">邮箱：</span>
            <span class="info-value">{{ companyInfo.email }}</span>
          </div>
        </div>
      </div>

      <!-- 售后服务 -->
      <div class="info-column">
        <h3>📞 售后服务</h3>
        <div class="compact-info">
          <div class="info-line">
            <span class="info-label">电话：</span>
            <span class="info-value phone">{{ companyInfo.supportPhone }}</span>
          </div>
          <div class="info-line">
            <span class="info-label">时间：</span>
            <span class="info-value">{{ companyInfo.supportHours }}</span>
          </div>
          <div class="info-line">
            <span class="info-label">QQ：</span>
            <span class="info-value">{{ companyInfo.onlineSupport }}</span>
          </div>
          <div class="info-line">
            <span class="info-label">技术：</span>
            <span class="info-value">{{ companyInfo.techSupport }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 技术栈 -->
    <div class="tech-section">
      <h3>🛠️ 技术栈</h3>
      <div class="tech-stack">
        <el-tag v-for="tech in techStack" :key="tech" size="small" class="tech-tag">
          {{ tech }}
        </el-tag>
      </div>
    </div>

    <!-- 版权信息 -->
    <div class="copyright-section">
      <p class="copyright">{{ copyrightInfo.text }}</p>
    </div>
  </div>
</template>

<script setup>
const appInfo = {
  name: '实训教学实践系统',
  version: '2.0.0',
  build: '20260402',
  description: '一款基于 AI 视觉识别和语音识别的现代化实训教学系统，支持多屏互动、实时字幕、直播管理等功能。'
};

const companyInfo = {
  name: '某某教育科技有限公司',
  address: '北京市海淀区中关村科技园 XX 号',
  website: 'www.example.com',
  email: 'info@example.com',
  supportPhone: '400-XXX-XXXX',
  supportHours: '周一至周日 9:00-18:00',
  onlineSupport: 'QQ: XXXX-XXXX',
  onlineHours: '每天 8:00-22:00',
  techSupport: 'support@example.com'
};

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

const copyrightInfo = {
  text: '© 2024-2026 某某教育科技有限公司 版权所有',
  subtext: '本软件受著作权法和国际条约保护，未经授权复制或分发将受到法律追究。'
};
</script>

<style lang="scss" scoped>
.about-in-settings {
  padding: 5px;
}

.app-identity {
  text-align: center;
  padding: 8px 0 5px;
  border-bottom: 1px solid #3a3a5a;
  margin-bottom: 10px;
}

.app-logo {
  font-size: 40px;
  margin-bottom: 5px;
  line-height: 1;
}

.app-name {
  font-size: 18px;
  color: #fff;
  margin: 5px 0;
}

.app-version {
  font-size: 12px;
  color: #909399;
  background: #2a2a4a;
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
}

.app-description {
  text-align: center;
  color: #ccc;
  font-size: 12px;
  line-height: 1.4;
  margin-bottom: 12px;
  padding: 0 5px;
}

.info-row {
  display: flex;
  gap: 15px;
  margin-bottom: 12px;
}

.info-column {
  flex: 1;
  
  h3 {
    font-size: 13px;
    color: #fff;
    margin: 0 0 8px 0;
    padding-bottom: 5px;
    border-bottom: 1px solid #4a4a6a;
  }
}

.compact-info {
  background: #1e1e3f;
  border-radius: 6px;
  padding: 8px;
}

.info-line {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
  font-size: 11px;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.info-label {
  color: #909399;
  white-space: nowrap;
}

.info-value {
  color: #fff;
  word-break: break-all;
  
  &.phone {
    color: #67c23a;
    font-weight: 500;
  }
}

.tech-section {
  margin-bottom: 10px;
  
  h3 {
    font-size: 13px;
    color: #fff;
    margin: 0 0 8px 0;
    padding-bottom: 5px;
    border-bottom: 1px solid #4a4a6a;
  }
}

.tech-stack {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tech-tag {
  padding: 4px 10px;
  font-size: 11px;
}

.copyright-section {
  text-align: center;
  padding: 8px 0 3px;
  border-top: 1px solid #3a3a5a;
  margin-top: 8px;
}

.copyright {
  color: #909399;
  font-size: 11px;
  line-height: 1.5;
  margin: 3px 0;
}
</style>
