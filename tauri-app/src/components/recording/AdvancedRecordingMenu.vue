<template>
  <el-dropdown trigger="click" @command="handleCommand">
    <el-button type="primary" size="small">
      高级功能<el-icon class="el-icon--right"><arrow-down /></el-icon>
    </el-button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item command="multicam">
          <el-icon><VideoCamera /></el-icon> 
          多机位录制
          <el-tag v-if="multicamActive" size="small" type="success" style="margin-left: 8px">
            运行中
          </el-tag>
        </el-dropdown-item>
        
        <el-dropdown-item 
          command="rtmp" 
          :disabled="!hasRtmpConfig"
        >
          <el-icon><Connection /></el-icon> 
          RTMP推流
          <el-tag v-if="rtmpStreaming" size="small" type="success" style="margin-left: 8px">
            推流中
          </el-tag>
        </el-dropdown-item>
        
        <el-dropdown-item 
          v-if="rtmpStreaming" 
          command="stop-rtmp"
          divided
        >
          <el-icon><Close /></el-icon> 
          停止RTMP推流
        </el-dropdown-item>
        
        <el-dropdown-item command="vr">
          <el-icon><View /></el-icon> 
          VR/360°录制
          <el-tag v-if="vrRecording" size="small" type="success" style="margin-left: 8px">
            录制中
          </el-tag>
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
  
  <!-- 子对话框 -->
  <MulticamConfigDialog 
    v-model:visible="showMulticamDialog"
    :initial-config="multicamConfig"
    @confirm="handleMulticamConfirm"
  />
  
  <RtmpStreamDialog 
    v-model:visible="showRtmpDialog"
    :initial-config="rtmpConfig"
    @confirm="handleRtmpConfirm"
  />
  
  <VrRecordingDialog 
    v-model:visible="showVrDialog"
    :initial-config="vrConfig"
    @confirm="handleVrConfirm"
  />
</template>

<script setup>
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import MulticamConfigDialog from './MulticamConfigDialog.vue';
import RtmpStreamDialog from './RtmpStreamDialog.vue';
import VrRecordingDialog from './VrRecordingDialog.vue';

const props = defineProps({
  // 状态标志
  multicamActive: {
    type: Boolean,
    default: false
  },
  rtmpStreaming: {
    type: Boolean,
    default: false
  },
  vrRecording: {
    type: Boolean,
    default: false
  },
  // 配置数据
  recordingConfig: {
    type: Object,
    default: () => ({})
  },
  multicamConfig: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits([
  'start-multicam',
  'start-rtmp',
  'stop-rtmp',
  'start-vr'
]);

// 对话框显示状态
const showMulticamDialog = ref(false);
const showRtmpDialog = ref(false);
const showVrDialog = ref(false);

// 是否有RTMP配置
const hasRtmpConfig = computed(() => {
  return props.recordingConfig?.enableRtmp || props.rtmpStreaming;
});

// 本地配置副本
const rtmpConfig = computed(() => ({
  rtmp_stream: props.recordingConfig?.rtmp_stream || {}
}));

const vrConfig = computed(() => ({
  vr_config: props.recordingConfig?.vr_config || {}
}));

const handleCommand = (command) => {
  switch (command) {
    case 'multicam':
      showMulticamDialog.value = true;
      break;
    case 'rtmp':
      showRtmpDialog.value = true;
      break;
    case 'stop-rtmp':
      emit('stop-rtmp');
      break;
    case 'vr':
      showVrDialog.value = true;
      break;
  }
};

const handleMulticamConfirm = (config) => {
  emit('start-multicam', config);
  showMulticamDialog.value = false;
};

const handleRtmpConfirm = (config) => {
  emit('start-rtmp', config);
  showRtmpDialog.value = false;
};

const handleVrConfirm = (config) => {
  emit('start-vr', config);
  showVrDialog.value = false;
};
</script>

<style scoped>
/* 样式继承自父组件 */
</style>
