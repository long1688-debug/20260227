<template>
  <div class="license-guard">
    <!-- 许可证未激活状态 -->
    <div v-if="!isActivated" class="license-activation">
      <div class="activation-header">
        <h2>软件许可证激活</h2>
        <p>请激活软件许可证以继续使用教师端功能</p>
      </div>

      <div class="activation-content">
        <!-- 机器码显示 -->
        <div class="machine-code-section">
          <h3>机器码</h3>
          <div class="machine-code-display">
            <el-input
              v-model="machineCode"
              readonly
              size="large"
            >
              <template #append>
                <el-button @click="copyMachineCode" icon="CopyDocument">
                  复制
                </el-button>
              </template>
            </el-input>
          </div>
          <p class="machine-code-hint">
            请将此机器码提供给管理员获取许可证密钥
          </p>
        </div>

        <!-- 许可证激活输入 -->
        <div class="license-activation-section">
          <h3>许可证激活</h3>
          <el-form @submit.prevent="activateLicense" :model="activationForm" :rules="activationRules">
            <el-form-item label="许可证密钥" prop="registrationCode">
              <el-input
                v-model="activationForm.registrationCode"
                placeholder="请输入许可证密钥"
                size="large"
                :disabled="activating"
              />
            </el-form-item>
            <el-form-item label="用户名" prop="userName">
              <el-input
                v-model="activationForm.userName"
                placeholder="请输入用户名"
                size="large"
                :disabled="activating"
              />
            </el-form-item>
            <el-form-item>
              <el-button
                type="primary"
                size="large"
                @click="activateLicense"
                :loading="activating"
                style="width: 100%;"
              >
                {{ activating ? '激活中...' : '激活许可证' }}
              </el-button>
            </el-form-item>
          </el-form>
        </div>

        <!-- 试用信息 -->
        <div class="trial-info" v-if="trialInfo">
          <el-alert
            title="试用版"
            :description="`剩余试用时间: ${trialInfo.remaining} 毫秒`"
            type="info"
            show-icon
            :closable="false"
          />
        </div>

        <!-- 服务器状态 -->
        <div class="server-status">
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="许可证服务器">
              <el-tag :type="serverOnline ? 'success' : 'danger'">
                {{ serverOnline ? '在线' : '离线' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="服务器地址">
              http://localhost:8080
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 试用按钮 -->
        <div class="trial-button-section">
          <el-button 
            type="warning" 
            size="large" 
            plain
            @click="startTrial"
            :loading="startingTrial"
            style="width: 100%;"
          >
            ⏳ 未注册试用30分钟
          </el-button>
          <p class="trial-hint">试用期间可体验全部功能，到期后需激活许可证才能继续使用</p>
        </div>
        
        <!-- 退出应用按钮 -->
        <div class="exit-section">
          <el-button 
            type="info" 
            size="large" 
            plain
            @click="exitApplication"
            style="width: 100%;"
          >
            退出应用
          </el-button>
        </div>
      </div>
    </div>

    <!-- 许可证已激活状态 -->
    <div v-else class="license-activated">
      <div class="activation-success">
        <el-result
          icon="success"
          title="许可证已激活"
          :sub-title="`欢迎使用 ${registrationInfo?.user_name || '用户'}`"
        >
          <template #extra>
            <el-button type="primary" @click="$emit('license-verified')">
              进入系统
            </el-button>
            <el-button @click="showLicenseDetails = true">
              查看详情
            </el-button>
          </template>
        </el-result>
      </div>
    </div>

    <!-- 许可证详情对话框 -->
    <el-dialog
      v-model="showLicenseDetails"
      title="许可证信息"
      width="500px"
    >
      <el-descriptions :column="1" border>
        <el-descriptions-item label="激活状态">
          <el-tag type="success">已激活</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="用户名">
          {{ registrationInfo?.user_name }}
        </el-descriptions-item>
        <el-descriptions-item label="机器码">
          {{ registrationInfo?.machine_code }}
        </el-descriptions-item>
        <el-descriptions-item label="许可证密钥">
          {{ registrationInfo?.registration_code }}
        </el-descriptions-item>
        <el-descriptions-item label="许可证类型">
          {{ registrationInfo?.license_type === 'permanent' ? '永久版' : '试用版' }}
        </el-descriptions-item>
        <el-descriptions-item label="激活时间">
          {{ formatDate(registrationInfo?.register_date) }}
        </el-descriptions-item>
        <el-descriptions-item v-if="registrationInfo?.expiry_date" label="到期时间">
          {{ formatDate(registrationInfo?.expiry_date) }}
        </el-descriptions-item>
      </el-descriptions>

      <template #footer>
        <el-button @click="showLicenseDetails = false">关闭</el-button>
        <el-button type="danger" @click="deactivateLicense">停用许可证</el-button>
      </template>
    </el-dialog>

    <!-- 试用到期提示对话框 -->
    <el-dialog
      v-model="showTrialExpiredDialog"
      title="试用时间到"
      width="450px"
      :close-on-click-modal="false"
      :show-close="false"
    >
      <div style="text-align: center;">
        <el-alert
          title="试用时间到，请注册"
          type="warning"
          :closable="false"
          show-icon
          style="margin-bottom: 20px;"
        >
          <template #default>
            <p>您的 {{ TRIAL_MINUTES }} 分钟试用时间已到期</p>
            <p>请购买正式版本或联系供应商获取许可证密钥</p>
          </template>
        </el-alert>
        <div style="margin-top: 20px;">
          <p style="color: #909399; font-size: 14px;">联系方式</p>
          <p>📞 售后服务电话：400-XXX-XXXX</p>
          <p>📧 邮箱：support@example.com</p>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="exitApplication">退出应用</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

// Props
const props = defineProps({
  autoCheck: {
    type: Boolean,
    default: true
  }
});

// Emits
const emit = defineEmits(['license-verified', 'license-failed']);

// 响应式数据
const machineCode = ref('');
const isActivated = ref(false);
const registrationInfo = ref(null);
const trialInfo = ref(null);
const serverOnline = ref(false);
const activating = ref(false);
const showLicenseDetails = ref(false);

const activationForm = ref({
  registrationCode: '',
  userName: ''
});

const activationRules = {
  registrationCode: [
    { required: true, message: '请输入注册码', trigger: 'blur' },
    { min: 20, message: '注册码格式不正确', trigger: 'blur' }
  ],
  userName: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, message: '用户名至少2个字符', trigger: 'blur' }
  ]
};

// 试用相关
const startingTrial = ref(false);
const showTrialExpiredDialog = ref(false);
const TRIAL_MINUTES = 30;

// 计算属性
const isTrialExpired = computed(() => {
  if (!trialInfo.value) return false;
  return trialInfo.value.remaining <= 0;
});

// 方法
onMounted(async () => {
  if (props.autoCheck) {
    await checkLicenseStatus();
    await checkServerStatus();
  }
});

async function checkLicenseStatus() {
  try {
    if (window.__TAURI__) {
      const { invoke } = await import('@tauri-apps/api/core');
      const status = await invoke('get_registration_status');

      machineCode.value = status.machine_code;
      isActivated.value = status.activated;

      if (status.activated && status.info) {
        registrationInfo.value = status.info;
      }

      if (status.trial) {
        trialInfo.value = status.trial;
      }
    } else {
      // 浏览器模式下的模拟数据
      machineCode.value = 'BROWSER-MOCKUP-' + Math.random().toString(36).substr(2, 9).toUpperCase();
      isActivated.value = false;
      trialInfo.value = {
        start_time: Date.now(),
        remaining: 24 * 60 * 60 * 1000 // 24小时
      };
    }
  } catch (error) {
    console.error('检查许可证状态失败:', error);
    ElMessage.error('检查许可证状态失败');
    emit('license-failed', error);
  }
}

async function checkServerStatus() {
  try {
    const response = await fetch('http://localhost:8080/api/health');
    serverOnline.value = response.ok;
  } catch (error) {
    serverOnline.value = false;
  }
}

// 开始试用
let trialTimer = null;
async function startTrial() {
  startingTrial.value = true;
  
  try {
    if (window.__TAURI__) {
      const { invoke } = await import('@tauri-apps/api/core');
      // 使用后端的试用功能（30天试用）
      const result = await invoke('get_registration_status');
      
      if (result.trial) {
        // 保存试用开始时间和结束时间到 localStorage
        const trialStart = Date.now();
        const trialEnd = trialStart + (TRIAL_MINUTES * 60 * 1000);
        localStorage.setItem('trial_start', trialStart.toString());
        localStorage.setItem('trial_end', trialEnd.toString());
        localStorage.setItem('trial_mode', 'true');
        
        ElMessage.success(`已开始${TRIAL_MINUTES}分钟试用`);
        emit('license-verified');
        
        // 设置30分钟后弹窗
        setTimeout(() => {
          showTrialExpiredDialog.value = true;
        }, TRIAL_MINUTES * 60 * 1000);
      }
    } else {
      // 浏览器模式
      const trialStart = Date.now();
      const trialEnd = trialStart + (TRIAL_MINUTES * 60 * 1000);
      localStorage.setItem('trial_start', trialStart.toString());
      localStorage.setItem('trial_end', trialEnd.toString());
      localStorage.setItem('trial_mode', 'true');
      
      ElMessage.success(`已开始${TRIAL_MINUTES}分钟试用`);
      emit('license-verified');
      
      setTimeout(() => {
        showTrialExpiredDialog.value = true;
      }, TRIAL_MINUTES * 60 * 1000);
    }
  } catch (error) {
    console.error('启动试用失败:', error);
    ElMessage.error('启动试用失败');
  } finally {
    startingTrial.value = false;
  }
}

async function activateLicense() {
  if (!activationForm.value.registrationCode || !activationForm.value.userName) {
    ElMessage.warning('请填写完整信息');
    return;
  }

  activating.value = true;

  try {
    if (window.__TAURI__) {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke('activate_registration', {
        registrationCode: activationForm.value.registrationCode,
        userName: activationForm.value.userName
      });

      if (result.success) {
        ElMessage.success('许可证激活成功！');
        await checkLicenseStatus(); // 重新检查状态
        emit('license-verified');
      } else {
        ElMessage.error(result.message || '激活失败');
      }
    } else {
      ElMessage.info('浏览器模式下无法执行激活操作');
    }
  } catch (error) {
    console.error('激活许可证失败:', error);
    ElMessage.error('激活失败: ' + error.message);
  } finally {
    activating.value = false;
  }
}

async function deactivateLicense() {
  try {
    await ElMessageBox.confirm(
      '确定要停用许可证吗？停用后需要重新激活才能使用。',
      '确认停用',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    if (window.__TAURI__) {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke('deactivate_registration');

      if (result.success) {
        ElMessage.success('许可证已停用');
        await checkLicenseStatus();
        showLicenseDetails.value = false;
      } else {
        ElMessage.error(result.message || '停用失败');
      }
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('停用许可证失败:', error);
      ElMessage.error('停用失败: ' + error.message);
    }
  }
}

function copyMachineCode() {
  navigator.clipboard.writeText(machineCode.value).then(() => {
    ElMessage.success('机器码已复制到剪贴板');
  }).catch(() => {
    // 降级方案：创建临时输入框
    const textArea = document.createElement('textarea');
    textArea.value = machineCode.value;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    ElMessage.success('机器码已复制到剪贴板');
  });
}

function formatDate(dateStr) {
  if (!dateStr) return '未知';
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN');
  } catch {
    return dateStr;
  }
}

// 退出应用
async function exitApplication() {
  try {
    if (window.__TAURI__) {
      const { app } = await import('@tauri-apps/api/app');
      // Tauri 2.x 退出方式
      await app.exit(0);
    } else {
      // 浏览器模式
      window.close();
    }
  } catch (error) {
    console.error('退出应用失败:', error);
    ElMessage.error('退出应用失败');
  }
}

// 暴露方法供父组件调用
defineExpose({
  checkLicenseStatus,
  activateLicense,
  deactivateLicense,
  startTrial
});
</script>

<style scoped>
.license-guard {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
  box-sizing: border-box;
  overflow: hidden; /* 防止外层滚动 */
}

.license-activation,
.license-activated {
  width: 600px;
  max-width: 90vw;
  max-height: 100vh; /* 使用完整视口高度 */
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  overflow: hidden; /* 隐藏滚动条 */
  display: flex;
  flex-direction: column;
}

.activation-header {
  background: #409eff;
  color: white;
  padding: 16px 30px; /* 进一步减小头部padding */
  text-align: center;
  flex-shrink: 0;
}

.activation-header h2 {
  margin: 0 0 6px 0;
  font-size: 22px; /* 缩小标题 */
  font-weight: 600;
  line-height: 1.2;
}

.activation-header p {
  margin: 0;
  opacity: 0.9;
  font-size: 13px; /* 缩小副标题 */
}

.activation-content {
  padding: 16px 30px 20px 30px; /* 减小padding */
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px; /* 进一步减小间距 */
  overflow: hidden; /* 隐藏内部滚动 */
}

.machine-code-section,
.registration-code-section {
  margin-bottom: 0;
}

.machine-code-section h3,
.registration-code-section h3 {
  margin: 0 0 6px 0;
  color: #303133;
  font-size: 15px; /* 缩小标题 */
  font-weight: 500;
}

.machine-code-display {
  margin-bottom: 4px;
}

.machine-code-hint {
  color: #909399;
  font-size: 11px; /* 进一步缩小字体 */
  margin: 0;
  line-height: 1.3;
}

.trial-info {
  margin-bottom: 0;
}

/* 优化试用版提示框 */
.trial-info :deep(.el-alert) {
  padding: 8px 12px; /* 减小内边距 */
}

.trial-info :deep(.el-alert__title) {
  font-size: 13px; /* 缩小标题 */
}

.trial-info :deep(.el-alert__description) {
  font-size: 12px; /* 缩小描述 */
  margin-top: 2px;
}

.server-status {
  margin-top: 0;
}

/* 优化服务器状态表 */
.server-status :deep(.el-descriptions) {
  font-size: 12px; /* 缩小表格字体 */
}

.trial-button-section {
  margin-top: 0;
  text-align: center;
}

.trial-hint {
  margin-top: 4px;
  font-size: 10px; /* 进一步缩小提示文字 */
  color: #909399;
  line-height: 1.3;
}

.exit-section {
  margin-top: 0;
  text-align: center;
}

.activation-success {
  padding: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.license-activated {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .license-guard {
    padding: 10px;
    align-items: flex-start;
    padding-top: 20px;
  }

  .license-activation,
  .license-activated {
    width: 100%;
    max-width: none;
    max-height: 100vh;
    border-radius: 8px;
  }

  .activation-header {
    padding: 12px 20px;
  }

  .activation-header h2 {
    font-size: 18px;
  }

  .activation-header p {
    font-size: 11px;
  }

  .activation-content {
    padding: 12px 20px 16px 20px;
    gap: 8px;
  }

  .machine-code-section h3,
  .registration-code-section h3 {
    font-size: 13px;
  }
}

@media (max-width: 480px) {
  .license-guard {
    padding: 5px;
  }

  .activation-header {
    padding: 10px 15px;
  }

  .activation-header h2 {
    font-size: 16px;
  }

  .activation-content {
    padding: 10px 15px 14px 15px;
    gap: 6px;
  }
}
</style>
