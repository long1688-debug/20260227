<template>
  <div class="license-management">
    <el-container>
      <el-header>
        <h1>注册服务器管理</h1>
      </el-header>
      <el-main>
        <el-card>
          <template #header>
            <div class="card-header">
              <span>机器码</span>
            </div>
          </template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="机器码">
              <el-input v-model="machineCode" readonly>
                <template #append>
                  <el-button @click="copyMachineCode">复制</el-button>
                </template>
              </el-input>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card style="margin-top: 20px;">
          <template #header>
            <div class="card-header">
              <span>注册状态</span>
            </div>
          </template>
          <el-alert
            v-if="registrationStatus.is_activated"
            title="已激活"
            type="success"
            :closable="false"
            show-icon
          />
          <el-alert
            v-else
            title="未激活"
            type="warning"
            :closable="false"
            show-icon
          />
          
          <el-descriptions v-if="registrationStatus.is_activated" :column="1" border style="margin-top: 20px;">
            <el-descriptions-item label="用户名">{{ registrationStatus.user_name }}</el-descriptions-item>
            <el-descriptions-item label="激活时间">{{ registrationStatus.activation_date }}</el-descriptions-item>
            <el-descriptions-item label="到期时间">{{ registrationStatus.expiry_date }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card v-if="!registrationStatus.is_activated" style="margin-top: 20px;">
          <template #header>
            <div class="card-header">
              <span>激活注册</span>
            </div>
          </template>
          <el-form @submit.prevent="activateRegistration">
            <el-form-item label="注册码">
              <el-input v-model="registrationCode" placeholder="请输入注册码" />
            </el-form-item>
            <el-form-item label="用户名">
              <el-input v-model="userName" placeholder="请输入用户名" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="activateRegistration" :loading="activating">
                激活
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card v-else style="margin-top: 20px;">
          <template #header>
            <div class="card-header">
              <span>操作</span>
            </div>
          </template>
          <el-button type="danger" @click="deactivateRegistration" :loading="deactivating">
            停用注册
          </el-button>
        </el-card>

        <el-card style="margin-top: 20px;">
          <template #header>
            <div class="card-header">
              <span>服务器状态</span>
            </div>
          </template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="许可证服务器">
              <el-tag :type="licenseServerStatus === 'online' ? 'success' : 'danger'">
                {{ licenseServerStatus === 'online' ? '在线' : '离线' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="服务器地址">
              http://localhost:8082
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

const machineCode = ref('');
const registrationCode = ref('');
const userName = ref('');
const activating = ref(false);
const deactivating = ref(false);
const registrationStatus = ref({
  is_activated: false,
  user_name: '',
  activation_date: '',
  expiry_date: ''
});
const licenseServerStatus = ref('offline');

onMounted(async () => {
  await loadMachineCode();
  await loadRegistrationStatus();
  await checkLicenseServer();
});

async function loadMachineCode() {
  try {
    if (window.__TAURI__) {
      const { invoke } = await import('@tauri-apps/api/core');
      machineCode.value = await invoke('get_machine_code');
    } else {
      machineCode.value = 'BROWSER-MOCKUP-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    }
  } catch (error) {
    console.error('Failed to load machine code:', error);
    ElMessage.error('获取机器码失败');
  }
}

async function loadRegistrationStatus() {
  try {
    if (window.__TAURI__) {
      const { invoke } = await import('@tauri-apps/api/core');
      registrationStatus.value = await invoke('get_registration_status');
    } else {
      registrationStatus.value = {
        is_activated: false,
        user_name: '',
        activation_date: '',
        expiry_date: ''
      };
    }
  } catch (error) {
    console.error('Failed to load registration status:', error);
  }
}

async function checkLicenseServer() {
  try {
    const response = await fetch('http://localhost:8082/api/health');
    if (response.ok) {
      licenseServerStatus.value = 'online';
    } else {
      licenseServerStatus.value = 'offline';
    }
  } catch (error) {
    licenseServerStatus.value = 'offline';
  }
}

async function activateRegistration() {
  if (!registrationCode.value || !userName.value) {
    ElMessage.warning('请填写完整信息');
    return;
  }

  activating.value = true;
  try {
    if (window.__TAURI__) {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke('activate_registration', {
        registrationCode: registrationCode.value,
        userName: userName.value,
        machineCode: machineCode.value
      });
      
      if (result.success) {
        ElMessage.success('激活成功');
        await loadRegistrationStatus();
      } else {
        ElMessage.error(result.message || '激活失败');
      }
    } else {
      ElMessage.info('浏览器模式下无法执行激活操作');
    }
  } catch (error) {
    console.error('Failed to activate:', error);
    ElMessage.error('激活失败: ' + error.message);
  } finally {
    activating.value = false;
  }
}

async function deactivateRegistration() {
  try {
    await ElMessageBox.confirm(
      '确定要停用注册吗?',
      '确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    deactivating.value = true;
    if (window.__TAURI__) {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke('deactivate_registration');
      
      if (result.success) {
        ElMessage.success('停用成功');
        await loadRegistrationStatus();
      } else {
        ElMessage.error(result.message || '停用失败');
      }
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to deactivate:', error);
      ElMessage.error('停用失败: ' + error.message);
    }
  } finally {
    deactivating.value = false;
  }
}

function copyMachineCode() {
  navigator.clipboard.writeText(machineCode.value).then(() => {
    ElMessage.success('机器码已复制');
  });
}
</script>

<style scoped>
.license-management {
  height: 100vh;
  background: #f5f5f5;
}

.el-header {
  background: #409eff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.el-header h1 {
  margin: 0;
  font-size: 24px;
}

.el-main {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
}
</style>
