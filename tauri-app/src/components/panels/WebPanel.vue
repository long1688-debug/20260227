<template>
  <div class="web-panel">
    <div class="web-buttons">
      <el-button
        v-for="item in webItems"
        :key="item.name"
        :icon="item.icon"
        @click="handleClick(item.action)"
      >
        {{ item.label }}
      </el-button>
    </div>
  </div>
</template>

<script setup>
const WEB_FEATURES_BASE_URL = 'http://127.0.0.1:8080/web';

// 打开外部链接的辅助函数
const openExternal = async (url) => {
  try {
    const { open } = await import('@tauri-apps/plugin-shell');
    await open(url);
  } catch (e) {
    console.error('使用 Tauri shell 打开链接失败:', e);
    window.open(url, '_blank');
  }
};

const webItems = [
  { name: 'student', label: '👨‍🎓 学生实训', action: 'student', icon: 'User' },
  { name: 'teacher', label: '📊 教师管理', action: 'teacher', icon: 'DataAnalysis' },
  { name: 'vision', label: '👁️ 视觉分析', action: 'vision', icon: 'View' },
  { name: 'api', label: '🔧 API 测试', action: 'api', icon: 'Tools' },
  { name: 'index', label: '🏠 系统首页', action: 'index', icon: 'HomeFilled' },
  { name: 'status', label: '🔍 服务状态', action: 'status', icon: 'Search' }
];

const handleClick = async (action) => {
  console.log('Web action:', action);
  const urls = {
    student: `${WEB_FEATURES_BASE_URL}/student-training.html`,
    teacher: `${WEB_FEATURES_BASE_URL}/teacher-management.html`,
    vision: `${WEB_FEATURES_BASE_URL}/vision-analysis.html`,
    api: `${WEB_FEATURES_BASE_URL}/api-test.html`,
    index: `${WEB_FEATURES_BASE_URL}/index.html`,
    status: `${WEB_FEATURES_BASE_URL}/service-status.html`
  };

  if (urls[action]) {
    await openExternal(urls[action]);
  }
};
</script>

<style lang="scss" scoped>
.web-panel {
  padding: 15px;
  height: 100%;
}

.web-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.el-button {
  height: 50px;
  font-size: 14px;
  background: #1A2A3A;
  border-color: #4A90E2;
  color: #FFFFFF;

  &:hover {
    background: #2A3A4A;
    border-color: #00BFFF;
    color: #FFFFFF;
  }
}
</style>
