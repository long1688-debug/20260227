<template>
  <div class="registration-in-settings">
    <el-alert
      title="许可证激活功能已迁移"
      type="info"
      description="许可证激活功能现已在启动时的许可证验证页面提供，此处不再重复提供。"
      show-icon
      :closable="false"
    />

    <div class="info-section">
      <h4>关于许可证激活</h4>
      <p>许可证激活功能用于激活软件的完整功能，您需要：</p>
      <ul>
        <li>向供应商获取许可证密钥</li>
        <li>使用当前设备的机器码换取许可证密钥</li>
        <li>在首次启动软件时完成许可证激活</li>
      </ul>
    </div>

    <div class="redirect-section">
      <el-card>
        <div class="card-content">
          <p>如需激活许可证，请在软件启动时完成激活流程。</p>
          <p>如遇到许可证相关问题，请联系技术支持。</p>
          <el-button 
            type="primary" 
            @click="contactSupport"
            style="margin-top: 15px;"
          >
            联系技术支持
          </el-button>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ElMessage } from 'element-plus';

const contactSupport = () => {
  ElMessage.info('请联系技术支持: support@example.com 或拨打 400-XXX-XXXX');
};
</script>

<style scoped>
.registration-in-settings {
  padding: 20px;
}

.info-section {
  margin: 20px 0;
}

.info-section h4 {
  margin-bottom: 10px;
}

.info-section ul {
  padding-left: 20px;
}

.redirect-section {
  margin-top: 20px;
}

.card-content {
  text-align: center;
}
</style>
