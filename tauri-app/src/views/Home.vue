<template>
  <div class="home-container">
    <!-- 头部区域 -->
    <div class="header-section">
      <div class="logo-container">
        <div class="logo-icon">🎓</div>
        <h1>实训教学实践系统</h1>
        <p class="subtitle">Training Teaching Practice System</p>
      </div>
    </div>

    <!-- 功能导航区 -->
    <div class="main-nav-section">
      <h2>系统功能入口</h2>
      <div class="nav-grid">
        <!-- 教师端 -->
        <router-link to="/teacher" class="nav-card teacher-card">
          <div class="nav-icon">👨‍🏫</div>
          <div class="nav-info">
            <h3>教师端</h3>
            <p>视频教学、学生管理、作业批改</p>
          </div>
        </router-link>

        <!-- 学生端 -->
        <router-link to="/student" class="nav-card student-card">
          <div class="nav-icon">👨‍🎓</div>
          <div class="nav-info">
            <h3>学生端</h3>
            <p>在线学习、实验实训、提交报告</p>
          </div>
        </router-link>

        <!-- Web功能 -->
        <router-link to="/web" class="nav-card web-card">
          <div class="nav-icon">🌐</div>
          <div class="nav-info">
            <h3>Web功能</h3>
            <p>学生实训、教师管理、视觉分析</p>
          </div>
        </router-link>

        <!-- 学生管理 -->
        <router-link to="/students" class="nav-card students-card">
          <div class="nav-icon">📚</div>
          <div class="nav-info">
            <h3>学生实训管理</h3>
            <p>学生列表、任务管理、进度追踪</p>
          </div>
        </router-link>

        <!-- 系统状态 -->
        <router-link to="/status" class="nav-card status-card">
          <div class="nav-icon">📊</div>
          <div class="nav-info">
            <h3>系统状态分析</h3>
            <p>资源监控、服务状态、性能指标</p>
          </div>
        </router-link>

        <!-- 服务端管理 -->
        <router-link to="/server" class="nav-card server-card">
          <div class="nav-icon">🖥️</div>
          <div class="nav-info">
            <h3>服务端管理</h3>
            <p>服务器配置、服务监控、日志管理</p>
          </div>
        </router-link>

        <!-- 注册服务器管理 -->
        <router-link to="/license" class="nav-card license-card">
          <div class="nav-icon">🔑</div>
          <div class="nav-info">
            <h3>注册服务器管理</h3>
            <p>许可证管理、服务器注册</p>
          </div>
        </router-link>

        <!-- 系统日志 -->
        <router-link to="/logs" class="nav-card logs-card">
          <div class="nav-icon">📝</div>
          <div class="nav-info">
            <h3>系统日志</h3>
            <p>日志查看、故障排查、审计追踪</p>
          </div>
        </router-link>

        <!-- 思维导图 -->
        <router-link to="/mindmap" class="nav-card mindmap-card">
          <div class="nav-icon">🧠</div>
          <div class="nav-info">
            <h3>思维导图</h3>
            <p>知识梳理、教学规划、创意记录</p>
          </div>
        </router-link>
      </div>
    </div>

    <!-- 底部信息 -->
    <div class="footer-section">
      <p>© 2024 实训教学实践系统 - 版本 1.0.0</p>
    </div>
  </div>
</template>

<script setup>
</script>

<style scoped>
.home-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  color: white;
  display: flex;
  flex-direction: column;
  padding: 40px 20px;
}

.header-section {
  text-align: center;
  margin-bottom: 50px;

  .logo-container {
    display: flex;
    flex-direction: column;
    align-items: center;

    .logo-icon {
      font-size: 80px;
      margin-bottom: 20px;
    }

    h1 {
      font-size: 42px;
      margin: 0 0 12px;
      background: linear-gradient(90deg, #4A90E2, #00BFFF, #4ADE80);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      text-shadow: 0 4px 20px rgba(74, 144, 226, 0.3);
    }

    .subtitle {
      font-size: 18px;
      color: #A8A8A8;
      margin: 0;
    }
  }
}

.main-nav-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;

  h2 {
    font-size: 24px;
    margin-bottom: 30px;
    color: #E0E1DD;
  }

  .nav-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 20px;
    max-width: 1200px;
    width: 100%;
  }

  .nav-card {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    border-radius: 16px;
    padding: 24px;
    display: flex;
    align-items: center;
    gap: 20px;
    text-decoration: none;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.3s;

    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3);
      border-color: #4A90E2;
    }

    .nav-icon {
      font-size: 48px;
      flex-shrink: 0;
    }

    .nav-info {
      flex: 1;
      min-width: 0;

      h3 {
        color: #FFFFFF;
        font-size: 18px;
        margin: 0 0 8px;
      }

      p {
        color: #A8A8A8;
        font-size: 14px;
        margin: 0;
        line-height: 1.5;
      }
    }

    &.teacher-card {
      border-color: rgba(0, 191, 255, 0.3);
      &:hover { border-color: #00BFFF; }
    }

    &.student-card {
      border-color: rgba(74, 144, 226, 0.3);
      &:hover { border-color: #4A90E2; }
    }

    &.web-card {
      border-color: rgba(74, 222, 128, 0.3);
      &:hover { border-color: #4ADE80; }
    }

    &.students-card {
      border-color: rgba(167, 139, 250, 0.3);
      &:hover { border-color: #A78BFA; }
    }

    &.status-card {
      border-color: rgba(251, 146, 60, 0.3);
      &:hover { border-color: #FB923C; }
    }

    &.server-card {
      border-color: rgba(96, 165, 250, 0.3);
      &:hover { border-color: #60A5FA; }
    }

    &.license-card {
      border-color: rgba(250, 204, 21, 0.3);
      &:hover { border-color: #FACC15; }
    }

    &.logs-card {
      border-color: rgba(248, 113, 113, 0.3);
      &:hover { border-color: #F87171; }
    }

    &.mindmap-card {
      border-color: rgba(139, 92, 246, 0.3);
      &:hover { border-color: #8B5CF6; }
    }
  }
}

.footer-section {
  text-align: center;
  margin-top: 50px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);

  p {
    color: #6B7280;
    font-size: 14px;
    margin: 0;
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .header-section .logo-container h1 {
    font-size: 28px;
  }

  .header-section .logo-container .subtitle {
    font-size: 14px;
  }

  .main-nav-section h2 {
    font-size: 20px;
  }

  .nav-grid {
    grid-template-columns: 1fr;
  }

  .nav-card {
    flex-direction: column;
    text-align: center;

    .nav-info p {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}
</style>
