<template>
  <el-dialog
    :model-value="visible"
    title="多机位录制配置"
    width="800px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:visible', $event)"
    @close="handleClose"
  >
    <div class="multicam-config">
      <el-alert 
        title="多机位录制说明" 
        type="info" 
        description="支持同时录制多个摄像头画面，可随时切换活动摄像头。建议使用GPU编码器以获得最佳性能。"
        show-icon 
        :closable="false"
        style="margin-bottom: 16px"
      />
      
      <el-form label-width="120px">
        <el-form-item label="摄像头列表">
          <div class="camera-list">
            <div v-for="(cam, index) in localConfig.cameras" :key="index" class="camera-item">
              <el-input 
                v-model="cam.name" 
                placeholder="摄像头名称" 
                style="width: 150px; margin-right: 10px" 
              />
              <el-input 
                v-model="cam.device_path" 
                placeholder="设备路径（如：USB Camera 1）" 
                style="width: 250px; margin-right: 10px" 
              />
              <el-select v-model="cam.resolution" style="width: 140px; margin-right: 10px">
                <el-option label="1920x1080" value="1920x1080" />
                <el-option label="1280x720" value="1280x720" />
                <el-option label="640x480" value="640x480" />
              </el-select>
              <el-button type="danger" size="small" @click="removeCamera(index)">删除</el-button>
            </div>
            <el-button type="primary" size="small" @click="addCamera" style="margin-top: 10px">
              <el-icon><Plus /></el-icon> 添加摄像头
            </el-button>
          </div>
        </el-form-item>
        
        <el-form-item label="切换模式">
          <el-radio-group v-model="localConfig.switch_mode">
            <el-radio value="manual">手动切换</el-radio>
            <el-radio value="auto">自动切换</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item label="自动切换间隔" v-if="localConfig.switch_mode === 'auto'">
          <el-input-number v-model="localConfig.auto_switch_interval" :min="5" :max="300" /> 秒
        </el-form-item>
      </el-form>
    </div>
    
    <template #footer>
      <el-button @click="handleCancel">取消</el-button>
      <el-button type="primary" @click="handleConfirm" :loading="loading">开始录制</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch } from 'vue';
import { ElMessage } from 'element-plus';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  initialConfig: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['update:visible', 'confirm']);

const loading = ref(false);

// 本地配置副本，避免直接修改props
const localConfig = reactive({
  cameras: [
    { id: 'cam1', name: '摄像头1', device_path: '', resolution: '1920x1080', frame_rate: 30 }
  ],
  switch_mode: 'manual',
  auto_switch_interval: 30
});

// 监听初始配置变化
watch(() => props.initialConfig, (newConfig) => {
  if (newConfig && Object.keys(newConfig).length > 0) {
    Object.assign(localConfig, newConfig);
  }
}, { deep: true });

// 监听对话框打开，重置配置
watch(() => props.visible, (isVisible) => {
  if (isVisible && props.initialConfig && Object.keys(props.initialConfig).length > 0) {
    Object.assign(localConfig, JSON.parse(JSON.stringify(props.initialConfig)));
  } else if (isVisible) {
    // 重置为默认值
    localConfig.cameras = [
      { id: 'cam1', name: '摄像头1', device_path: '', resolution: '1920x1080', frame_rate: 30 }
    ];
    localConfig.switch_mode = 'manual';
    localConfig.auto_switch_interval = 30;
  }
});

const addCamera = () => {
  localConfig.cameras.push({
    id: `cam${localConfig.cameras.length + 1}`,
    name: `摄像头${localConfig.cameras.length + 1}`,
    device_path: '',
    resolution: '1920x1080',
    frame_rate: 30
  });
};

const removeCamera = (index) => {
  if (localConfig.cameras.length <= 1) {
    ElMessage.warning('至少需要保留一个摄像头');
    return;
  }
  localConfig.cameras.splice(index, 1);
};

const handleConfirm = async () => {
  // 验证摄像头配置
  const invalidCameras = localConfig.cameras.filter(cam => !cam.device_path.trim());
  if (invalidCameras.length > 0) {
    ElMessage.warning('请为所有摄像头填写设备路径');
    return;
  }
  
  loading.value = true;
  try {
    emit('confirm', { ...JSON.parse(JSON.stringify(localConfig)) });
  } catch (error) {
    console.error('确认配置失败:', error);
    ElMessage.error('配置错误');
  } finally {
    loading.value = false;
  }
};

const handleCancel = () => {
  emit('update:visible', false);
};

const handleClose = () => {
  emit('update:visible', false);
};
</script>

<style scoped>
.camera-list {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 15px;
  background: #f5f7fa;
}

.camera-item {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  padding: 10px;
  background: white;
  border-radius: 4px;
}

.camera-item:last-child {
  margin-bottom: 0;
}
</style>
