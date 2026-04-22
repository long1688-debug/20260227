<template>
  <div class="system-registration">
    <div class="section-header">
      <h3>设备绑定</h3>
      <p>将当前设备与管理员平台关联，用于远程管理和监控</p>
    </div>

    <!-- 设备绑定状态 -->
    <div class="device-binding-status">
      <el-card class="status-card">
        <div class="status-content">
          <div class="status-icon">
            <el-icon v-if="isDeviceBound" color="#67C23A"><CircleCheck /></el-icon>
            <el-icon v-else color="#E6A23C"><Warning /></el-icon>
          </div>
          <div class="status-info">
            <h4>{{ isDeviceBound ? '设备已绑定' : '设备未绑定' }}</h4>
            <p v-if="isDeviceBound">当前设备已成功与管理员平台关联</p>
            <p v-else>当前设备尚未与管理员平台关联</p>
          </div>
          <div class="status-actions">
            <el-button 
              v-if="!isDeviceBound" 
              type="primary" 
              @click="bindDevice"
            >
              绑定设备
            </el-button>
            <el-button 
              v-else 
              @click="unbindDevice"
            >
              解绑设备
            </el-button>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 设备信息 -->
    <div v-if="isDeviceBound" class="device-info">
      <h4>设备信息</h4>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="设备ID">
          {{ deviceInfo.deviceId }}
        </el-descriptions-item>
        <el-descriptions-item label="设备名称">
          {{ deviceInfo.deviceName }}
        </el-descriptions-item>
        <el-descriptions-item label="绑定时间">
          {{ formatDate(deviceInfo.bindTime) }}
        </el-descriptions-item>
        <el-descriptions-item label="网络状态">
          <el-tag :type="deviceInfo.networkStatus === 'online' ? 'success' : 'info'">
            {{ deviceInfo.networkStatus === 'online' ? '在线' : '离线' }}
          </el-tag>
        </el-descriptions-item>
      </el-descriptions>
    </div>

    <!-- 许可证激活（保留现有功能） -->
    <div class="license-section">
      <div class="section-header">
        <h3>许可证激活</h3>
        <p>激活许可证以解锁完整功能</p>
      </div>
      
      <el-card class="license-card">
        <div class="license-content">
          <div class="license-status">
            <div class="status-icon">
              <el-icon v-if="isLicenseActive" color="#67C23A"><CircleCheck /></el-icon>
              <el-icon v-else color="#F56C6C"><CircleClose /></el-icon>
            </div>
            <div class="status-info">
              <h4>{{ isLicenseActive ? '许可证已激活' : '许可证未激活' }}</h4>
              <p v-if="isLicenseActive">
                当前许可证类型：{{ licenseInfo.licenseType }}，
                有效期至：{{ formatDate(licenseInfo.expiryDate) }}
              </p>
              <p v-else>当前许可证未激活，部分功能受限</p>
            </div>
          </div>

          <div v-if="!isLicenseActive" class="license-activation-form">
            <el-form :model="licenseForm" :rules="licenseRules" label-width="120px">
              <el-form-item label="机器码">
                <el-input v-model="licenseForm.machineCode" readonly>
                  <template #append>
                    <el-button @click="copyMachineCode">复制</el-button>
                  </template>
                </el-input>
              </el-form-item>

              <el-form-item label="许可证密钥" prop="licenseKey">
                <el-input 
                  v-model="licenseForm.licenseKey" 
                  placeholder="请输入许可证密钥"
                />
              </el-form-item>

              <el-form-item label="用户名" prop="userName">
                <el-input 
                  v-model="licenseForm.userName" 
                  placeholder="请输入用户名"
                />
              </el-form-item>

              <el-form-item>
                <el-button 
                  type="primary" 
                  @click="activateLicense" 
                  :loading="activatingLicense"
                >
                  激活许可证
                </el-button>
              </el-form-item>
            </el-form>
          </div>

          <div v-else class="license-details">
            <el-button @click="showLicenseDetails = true">查看许可证详情</el-button>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 许可证详情对话框 -->
    <el-dialog v-model="showLicenseDetails" title="许可证详情" width="500px">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="许可证状态">
          <el-tag type="success">已激活</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="用户名称">
          {{ licenseInfo.userName }}
        </el-descriptions-item>
        <el-descriptions-item label="许可证类型">
          {{ licenseInfo.licenseType === 'permanent' ? '永久版' : '订阅版' }}
        </el-descriptions-item>
        <el-descriptions-item label="激活时间">
          {{ formatDate(licenseInfo.activationDate) }}
        </el-descriptions-item>
        <el-descriptions-item label="有效期至">
          {{ formatDate(licenseInfo.expiryDate) }}
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="showLicenseDetails = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { CircleCheck, CircleClose, Warning } from '@element-plus/icons-vue';

// 设备绑定相关
const isDeviceBound = ref(false);
const deviceInfo = ref({
  deviceId: '',
  deviceName: '',
  bindTime: null as number | null,
  networkStatus: 'offline'
});

// 许可证相关
const isLicenseActive = ref(false);
const licenseInfo = ref({
  licenseType: '',
  userName: '',
  activationDate: null as number | null,
  expiryDate: null as number | null
});
const showLicenseDetails = ref(false);

// 许可证表单
const licenseForm = reactive({
  machineCode: '',
  licenseKey: '',
  userName: ''
});

const licenseRules = {
  licenseKey: [
    { required: true, message: '请输入许可证密钥', trigger: 'blur' },
    { min: 20, message: '许可证密钥格式不正确', trigger: 'blur' }
  ],
  userName: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, message: '用户名至少2个字符', trigger: 'blur' }
  ]
};

const activatingLicense = ref(false);

// 方法
const bindDevice = () => {
  ElMessage.info('设备绑定功能待实现');
  // 实际应用中这里会调用API绑定设备
  isDeviceBound.value = true;
  deviceInfo.value = {
    deviceId: 'DEV-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
    deviceName: '教学设备-' + new Date().getFullYear(),
    bindTime: Date.now(),
    networkStatus: 'online'
  };
};

const unbindDevice = () => {
  ElMessageBox.confirm(
    '确定要解绑当前设备吗？解绑后将无法远程管理此设备。',
    '确认解绑',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    isDeviceBound.value = false;
    deviceInfo.value = {
      deviceId: '',
      deviceName: '',
      bindTime: null,
      networkStatus: 'offline'
    };
    ElMessage.success('设备已解绑');
  }).catch(() => {
    // 取消操作
  });
};

const activateLicense = async () => {
  // 表单验证
  if (!licenseForm.licenseKey || licenseForm.licenseKey.length < 20) {
    ElMessage.error('请输入正确的许可证密钥');
    return;
  }
  if (!licenseForm.userName || licenseForm.userName.length < 2) {
    ElMessage.error('用户名至少2个字符');
    return;
  }

  activatingLicense.value = true;
  try {
    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 模拟激活成功
    isLicenseActive.value = true;
    licenseInfo.value = {
      licenseType: 'permanent',
      userName: licenseForm.userName,
      activationDate: Date.now(),
      expiryDate: null // 永久许可证无过期时间
    };
    
    ElMessage.success('许可证激活成功！');
  } catch (error) {
    ElMessage.error('许可证激活失败，请检查许可证密钥是否正确');
  } finally {
    activatingLicense.value = false;
  }
};

const copyMachineCode = () => {
  // 模拟复制机器码
  navigator.clipboard.writeText(licenseForm.machineCode)
    .then(() => {
      ElMessage.success('机器码已复制到剪贴板');
    })
    .catch(() => {
      ElMessage.error('复制失败');
    });
};

const formatDate = (date: number | null) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN');
};

// 初始化数据
onMounted(() => {
  // 模拟获取机器码
  licenseForm.machineCode = Array.from({length: 5}, () => 
    Math.random().toString(36).substring(2, 8).toUpperCase()
  ).join('-');
});
</script>

<style scoped>
.system-registration {
  padding: 20px;
}

.section-header {
  margin-bottom: 20px;
}

.section-header h3 {
  margin: 0 0 5px 0;
  font-size: 18px;
  font-weight: bold;
}

.section-header p {
  margin: 0;
  color: #606266;
  font-size: 14px;
}

.status-card {
  margin-bottom: 20px;
}

.status-content {
  display: flex;
  align-items: center;
}

.status-icon {
  margin-right: 15px;
  font-size: 24px;
}

.status-info {
  flex: 1;
}

.status-info h4 {
  margin: 0 0 5px 0;
  font-size: 16px;
}

.status-info p {
  margin: 0;
  color: #606266;
  font-size: 14px;
}

.status-actions {
  margin-left: 15px;
}

.device-info {
  margin-bottom: 30px;
}

.license-section {
  margin-top: 30px;
}

.license-card {
  margin-top: 15px;
}

.license-content {
  padding: 10px 0;
}

.license-status {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid #eee;
}

.license-details {
  text-align: center;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
</style>