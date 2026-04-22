<template>
  <div class="audio-device-selector">
    <el-select
      v-model="selectedDevice"
      placeholder="选择音频设备"
      @change="handleDeviceChange"
    >
      <el-option
        v-for="device in devices"
        :key="device.name"
        :label="device.name"
        :value="device.name"
      >
        <span>{{ device.name }}</span>
        <span v-if="device.isDefault" class="default-badge">默认</span>
      </el-option>
    </el-select>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { ElMessage } from 'element-plus';

const selectedDevice = ref('');
const devices = ref([]);

// 获取音频设备列表
const fetchDevices = async () => {
  try {
    const deviceList = await invoke('get_audio_devices');
    devices.value = deviceList;

    // 设置默认设备
    const defaultDevice = deviceList.find(d => d.isDefault);
    if (defaultDevice) {
      selectedDevice.value = defaultDevice.name;
    }
  } catch (error) {
    console.error('获取音频设备失败:', error);
    ElMessage.error('获取音频设备失败: ' + error.message);
  }
};

// 设备切换处理
const handleDeviceChange = async (deviceName) => {
  try {
    await invoke('set_audio_device', { deviceName });
    ElMessage.success('音频设备已切换');
  } catch (error) {
    console.error('切换音频设备失败:', error);
    ElMessage.error('切换音频设备失败: ' + error.message);
  }
};

onMounted(() => {
  fetchDevices();
});
</script>

<style scoped>
.audio-device-selector {
  display: inline-block;
}

.default-badge {
  float: right;
  font-size: 12px;
  color: #67c23a;
  background: #f0f9ff;
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
