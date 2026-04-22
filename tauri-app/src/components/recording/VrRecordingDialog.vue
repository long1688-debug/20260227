<template>
  <el-dialog
    :model-value="visible"
    title="VR/360°视频录制配置"
    width="650px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:visible', $event)"
    @close="handleClose"
  >
    <div class="vr-config">
      <el-alert 
        title="VR录制说明" 
        type="info" 
        description="支持Insta360、GoPro MAX等全景相机。输出视频可在YouTube、Facebook等平台作为360°视频播放。"
        show-icon 
        :closable="false"
        style="margin-bottom: 16px"
      />
      
      <el-form label-width="120px">
        <el-form-item label="相机设备" required>
          <el-input 
            v-model="localConfig.cameraDevice" 
            placeholder="例如：USB Camera VR 或 Insta360"
            clearable
          />
          <div class="form-tip">
            请在Windows设备管理器中查看相机名称
          </div>
        </el-form-item>
        
        <el-form-item label="投影方式">
          <el-radio-group v-model="localConfig.projection">
            <el-radio value="equirectangular">等距柱状投影</el-radio>
            <el-radio value="cubemap">立方体贴图</el-radio>
          </el-radio-group>
          <div class="form-tip">
            推荐使用等距柱状投影，兼容性最好（YouTube/Facebook原生支持）
          </div>
        </el-form-item>
        
        <el-form-item label="输入类型">
          <el-select v-model="localConfig.input_type" style="width: 100%">
            <el-option label="双fisheye镜头 (Insta360 ONE X/X2/X3, GoPro MAX)" value="dual_fisheye" />
            <el-option label="单fisheye镜头 (Ricoh Theta Z1, Samsung Gear 360)" value="single_fisheye" />
            <el-option label="已经是全景视频 (专业相机直出)" value="panoramic" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="视野角度(FOV)">
          <el-slider 
            v-model="localConfig.fov" 
            :min="90" 
            :max="360" 
            :step="90" 
            show-input
            :marks="{ 90: '90°', 180: '180°', 270: '270°', 360: '360°' }"
          />
        </el-form-item>
        
        <el-form-item label="立体模式">
          <el-radio-group v-model="localConfig.stereo_mode">
            <el-radio value="mono">单目（推荐）</el-radio>
            <el-radio value="stereo">立体（实验性）</el-radio>
          </el-radio-group>
          <div class="form-tip">
            单目模式兼容性更好，立体模式需要专用播放器
          </div>
        </el-form-item>
        
        <el-divider />
        
        <el-form-item label="输出格式">
          <el-tag size="large" type="success">MP4 (H.264)</el-tag>
          <span style="margin-left: 10px; color: #909399; font-size: 12px">
            自动添加VR元数据供播放器识别
          </span>
        </el-form-item>
        
        <el-form-item label="性能提示">
          <el-alert 
            :title="performanceTip" 
            :type="performanceType" 
            show-icon 
            :closable="false"
          />
        </el-form-item>
      </el-form>
    </div>
    
    <template #footer>
      <el-button @click="handleCancel">取消</el-button>
      <el-button type="primary" @click="handleConfirm" :loading="loading">
        开始VR录制
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';
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

// 本地配置副本
const localConfig = reactive({
  cameraDevice: '',
  projection: 'equirectangular',
  input_type: 'dual_fisheye',
  fov: 360,
  stereo_mode: 'mono'
});

// 性能提示
const performanceTip = computed(() => {
  if (localConfig.fov >= 360 && localConfig.input_type !== 'panoramic') {
    return '360°全景录制需要高性能GPU，建议使用NVENC/QSV硬件加速编码器';
  }
  return 'VR录制会占用较多CPU资源，建议关闭其他后台程序';
});

const performanceType = computed(() => {
  return localConfig.fov >= 360 ? 'warning' : 'info';
});

// 监听初始配置
watch(() => props.initialConfig, (newConfig) => {
  if (newConfig && newConfig.vr_config) {
    Object.assign(localConfig, newConfig.vr_config);
  }
}, { deep: true });

// 监听对话框打开
watch(() => props.visible, (isVisible) => {
  if (isVisible) {
    if (props.initialConfig?.vr_config) {
      Object.assign(localConfig, JSON.parse(JSON.stringify(props.initialConfig.vr_config)));
    } else {
      // 重置为默认值
      Object.assign(localConfig, {
        cameraDevice: '',
        projection: 'equirectangular',
        input_type: 'dual_fisheye',
        fov: 360,
        stereo_mode: 'mono'
      });
    }
  }
});

const handleConfirm = async () => {
  if (!localConfig.cameraDevice.trim()) {
    ElMessage.warning('请填写相机设备名称');
    return;
  }
  
  loading.value = true;
  try {
    emit('confirm', { 
      vr_config: { ...localConfig, enabled: true }
    });
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
.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}
</style>
