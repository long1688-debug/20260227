<template>
  <el-dialog
    :model-value="visible"
    title="RTMP推流配置"
    width="600px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:visible', $event)"
    @close="handleClose"
  >
    <div class="rtmp-config">
      <el-alert 
        title="RTMP推流说明" 
        type="info" 
        description="将录制内容实时推流到Bilibili、Twitch、YouTube等平台。请确保网络连接稳定且上行带宽充足。"
        show-icon 
        :closable="false"
        style="margin-bottom: 16px"
      />
      
      <el-form label-width="120px">
        <el-form-item label="直播平台">
          <el-select v-model="selectedPlatform" @change="onPlatformChange" style="width: 100%">
            <el-option label="Bilibili" value="bilibili" />
            <el-option label="Twitch" value="twitch" />
            <el-option label="YouTube" value="youtube" />
            <el-option label="自定义" value="custom" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="RTMP地址" required>
          <el-input 
            v-model="localConfig.rtmp_url" 
            placeholder="rtmp://server/app"
            clearable
          />
          <div class="form-tip">
            {{ platformTips }}
          </div>
        </el-form-item>
        
        <el-form-item label="推流密钥" required>
          <el-input 
            v-model="localConfig.stream_key" 
            type="password" 
            show-password
            placeholder="从直播平台获取的推流密钥"
            clearable
          />
        </el-form-item>
        
        <el-form-item label="视频码率">
          <el-slider 
            v-model="localConfig.bitrate" 
            :min="1000" 
            :max="10000" 
            :step="500"
            show-input
            :format-tooltip="(val) => `${val} kbps`"
          />
          <div class="form-tip">
            推荐：Bilibili 4000-6000，Twitch 3000-6000，YouTube 4500-9000
          </div>
        </el-form-item>
        
        <el-form-item label="分辨率">
          <el-select v-model="localConfig.resolution" style="width: 100%">
            <el-option label="1920x1080 (Full HD)" value="1920x1080" />
            <el-option label="1280x720 (HD)" value="1280x720" />
            <el-option label="960x540 (SD)" value="960x540" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="帧率">
          <el-radio-group v-model="localConfig.frame_rate">
            <el-radio :value="30">30 fps</el-radio>
            <el-radio :value="60">60 fps</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <el-divider />
        
        <el-form-item label="网络检测">
          <el-button size="small" @click="testNetwork" :loading="testing">
            测试上行带宽
          </el-button>
          <span v-if="networkStatus" :class="['status-text', networkStatus.type]">
            {{ networkStatus.message }}
          </span>
        </el-form-item>
      </el-form>
    </div>
    
    <template #footer>
      <el-button @click="handleCancel">取消</el-button>
      <el-button type="primary" @click="handleConfirm" :loading="loading">
        开始推流
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
const testing = ref(false);
const selectedPlatform = ref('bilibili');
const networkStatus = ref(null);

// 平台预设配置
const platformPresets = {
  bilibili: {
    rtmp_url: 'rtmp://live-push.bilivideo.com/live-bvc',
    bitrate: 4000,
    tip: '请在B站直播间获取推流密钥'
  },
  twitch: {
    rtmp_url: 'rtmp://live.twitch.tv/app',
    bitrate: 3500,
    tip: '请在Twitch创作者面板获取推流密钥'
  },
  youtube: {
    rtmp_url: 'rtmp://a.rtmp.youtube.com/live2',
    bitrate: 4500,
    tip: '请在YouTube Studio获取推流密钥'
  },
  custom: {
    rtmp_url: '',
    bitrate: 4000,
    tip: '请输入自定义RTMP服务器地址'
  }
};

const platformTips = computed(() => {
  return platformPresets[selectedPlatform.value]?.tip || '';
});

// 本地配置副本
const localConfig = reactive({
  rtmp_url: '',
  stream_key: '',
  bitrate: 4000,
  resolution: '1920x1080',
  frame_rate: 30
});

// 监听初始配置
watch(() => props.initialConfig, (newConfig) => {
  if (newConfig && newConfig.rtmp_stream) {
    Object.assign(localConfig, newConfig.rtmp_stream);
  }
}, { deep: true });

// 监听对话框打开
watch(() => props.visible, (isVisible) => {
  if (isVisible) {
    if (props.initialConfig?.rtmp_stream) {
      Object.assign(localConfig, JSON.parse(JSON.stringify(props.initialConfig.rtmp_stream)));
    } else {
      // 重置为默认值
      Object.assign(localConfig, {
        rtmp_url: '',
        stream_key: '',
        bitrate: 4000,
        resolution: '1920x1080',
        frame_rate: 30
      });
    }
    networkStatus.value = null;
  }
});

const onPlatformChange = (platform) => {
  const preset = platformPresets[platform];
  if (preset) {
    localConfig.rtmp_url = preset.rtmp_url;
    localConfig.bitrate = preset.bitrate;
  }
};

const testNetwork = async () => {
  testing.value = true;
  try {
    // 模拟网络测试（实际应调用后端API）
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const estimatedBandwidth = Math.random() * 10 + 5; // 模拟5-15 Mbps
    
    if (estimatedBandwidth >= localConfig.bitrate / 1000 * 1.2) {
      networkStatus.value = {
        type: 'success',
        message: `✓ 上行带宽充足 (${estimatedBandwidth.toFixed(1)} Mbps)`
      };
    } else {
      networkStatus.value = {
        type: 'warning',
        message: `⚠ 上行带宽不足 (${estimatedBandwidth.toFixed(1)} Mbps)，建议降低码率`
      };
    }
  } catch (error) {
    networkStatus.value = {
      type: 'error',
      message: '✗ 网络测试失败'
    };
  } finally {
    testing.value = false;
  }
};

const handleConfirm = async () => {
  if (!localConfig.rtmp_url || !localConfig.stream_key) {
    ElMessage.warning('请填写RTMP地址和推流密钥');
    return;
  }
  
  loading.value = true;
  try {
    emit('confirm', { 
      rtmp_stream: { ...localConfig, enabled: true }
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

.status-text {
  margin-left: 10px;
  font-size: 14px;
}

.status-text.success {
  color: #67C23A;
}

.status-text.warning {
  color: #E6A23C;
}

.status-text.error {
  color: #F56C6C;
}
</style>
