<template>
  <div class="advanced-recording-test">
    <el-card class="header-card">
      <h2>🎬 高级录制功能测试</h2>
      <p style="color: #909399; margin-top: 10px">
        本页面用于测试多机位录制、RTMP推流和VR/360°视频录制功能
      </p>
    </el-card>

    <!-- 多机位录制测试 -->
    <el-card class="test-section" style="margin-top: 20px">
      <template #header>
        <div class="card-header">
          <span>📹 多机位录制测试</span>
          <el-tag v-if="multicamSessionId" type="success">录制中</el-tag>
        </div>
      </template>
      
      <el-form label-width="120px">
        <el-form-item label="摄像头配置">
          <div v-for="(cam, index) in multicamConfig.cameras" :key="index" style="margin-bottom: 10px">
            <el-input v-model="cam.name" placeholder="名称" style="width: 150px; margin-right: 10px" />
            <el-input v-model="cam.device_path" placeholder="设备路径" style="width: 200px; margin-right: 10px" />
            <el-button @click="removeCamera(index)" size="small" type="danger">删除</el-button>
          </div>
          <el-button @click="addCamera" size="small" type="primary">添加摄像头</el-button>
        </el-form-item>
        
        <el-form-item label="切换模式">
          <el-radio-group v-model="multicamConfig.switch_mode">
            <el-radio value="manual">手动</el-radio>
            <el-radio value="auto">自动</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item>
          <el-button 
            v-if="!multicamSessionId" 
            type="primary" 
            @click="startMulticam"
            :loading="starting"
          >
            开始多机位录制
          </el-button>
          <el-button 
            v-else 
            type="danger" 
            @click="stopMulticam"
          >
            停止录制
          </el-button>
          
          <el-button 
            v-if="multicamSessionId" 
            @click="switchToNextCamera"
          >
            切换到下一个摄像头 (当前: {{ activeCameraIndex + 1 }})
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- RTMP推流测试 -->
    <el-card class="test-section" style="margin-top: 20px">
      <template #header>
        <div class="card-header">
          <span>📡 RTMP推流测试</span>
          <el-tag v-if="rtmpStreamingState.isStreaming" type="success">推流中</el-tag>
        </div>
      </template>
      
      <el-form label-width="120px">
        <el-form-item label="RTMP地址">
          <el-input v-model="rtmpConfig.url" placeholder="rtmp://server/app" />
        </el-form-item>
        
        <el-form-item label="推流密钥">
          <el-input v-model="rtmpConfig.streamKey" type="password" show-password />
        </el-form-item>
        
        <el-form-item label="码率(kbps)">
          <el-input-number v-model="rtmpConfig.bitrate" :min="1000" :max="10000" :step="500" />
        </el-form-item>
        
        <el-form-item>
          <el-button 
            v-if="!rtmpStreamingState.isStreaming" 
            type="primary" 
            @click="startRtmp"
            :loading="starting"
          >
            开始推流
          </el-button>
          <el-button 
            v-else 
            type="danger" 
            @click="stopRtmp"
          >
            停止推流
          </el-button>
          
          <div v-if="rtmpStreamingState.streamUrl" style="margin-top: 10px; font-size: 12px; color: #67C23A">
            推流地址: {{ rtmpStreamingState.streamUrl }}
          </div>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- VR/360°录制测试 -->
    <el-card class="test-section" style="margin-top: 20px">
      <template #header>
        <div class="card-header">
          <span>🌐 VR/360°视频录制测试</span>
          <el-tag v-if="vrRecordingState.isRecording" type="success">录制中</el-tag>
        </div>
      </template>
      
      <el-form label-width="120px">
        <el-form-item label="相机设备">
          <el-input v-model="vrConfig.cameraDevice" placeholder="例如：USB Camera VR" />
        </el-form-item>
        
        <el-form-item label="投影方式">
          <el-radio-group v-model="vrConfig.projection">
            <el-radio value="equirectangular">等距柱状</el-radio>
            <el-radio value="cubemap">立方体贴图</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item label="输入类型">
          <el-select v-model="vrConfig.input_type" style="width: 100%">
            <el-option label="双fisheye (Insta360/GoPro MAX)" value="dual_fisheye" />
            <el-option label="单fisheye (Ricoh Theta)" value="single_fisheye" />
            <el-option label="全景视频" value="panoramic" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="视野角度">
          <el-slider v-model="vrConfig.fov" :min="90" :max="360" :step="90" show-input />
        </el-form-item>
        
        <el-form-item>
          <el-button 
            v-if="!vrRecordingState.isRecording" 
            type="primary" 
            @click="startVr"
            :loading="starting"
          >
            开始VR录制
          </el-button>
          <el-button 
            v-else 
            type="danger" 
            @click="stopVr"
          >
            停止录制
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 日志输出 -->
    <el-card class="log-section" style="margin-top: 20px">
      <template #header>
        <div class="card-header">
          <span>📋 操作日志</span>
          <el-button size="small" @click="clearLogs">清空</el-button>
        </div>
      </template>
      
      <div class="log-container">
        <div v-for="(log, index) in logs" :key="index" class="log-item">
          <span class="log-time">{{ log.time }}</span>
          <span :class="['log-message', log.type]">{{ log.message }}</span>
        </div>
        <div v-if="logs.length === 0" class="empty-log">
          暂无日志
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRecording } from '@/composables/useRecording';
import { ElMessage } from 'element-plus';

const { 
  startMulticamRecording, stopMulticamRecording, switchCamera,
  startRtmpStream, stopRtmpStream,
  startVrRecording, stopVrRecording,
  recordingConfig,
  multicamSessionId,
  activeCameraIndex,
  rtmpStreamingState,
  vrRecordingState
} = useRecording();

// 状态
const starting = ref(false);
const logs = ref([]);

// 多机位配置
const multicamConfig = reactive({
  cameras: [
    { id: 'cam1', name: '摄像头1', device_path: '', resolution: '1920x1080', frame_rate: 30 }
  ],
  switch_mode: 'manual'
});

// RTMP配置
const rtmpConfig = reactive({
  url: 'rtmp://live.bilibili.com/live',
  streamKey: '',
  bitrate: 4000
});

// VR配置
const vrConfig = reactive({
  cameraDevice: '',
  projection: 'equirectangular',
  input_type: 'dual_fisheye',
  fov: 360
});

// 工具函数
const addLog = (message, type = 'info') => {
  const time = new Date().toLocaleTimeString();
  logs.value.unshift({ time, message, type });
  if (logs.value.length > 50) {
    logs.value.pop();
  }
};

const clearLogs = () => {
  logs.value = [];
};

// 多机位功能
const addCamera = () => {
  multicamConfig.cameras.push({
    id: `cam${multicamConfig.cameras.length + 1}`,
    name: `摄像头${multicamConfig.cameras.length + 1}`,
    device_path: '',
    resolution: '1920x1080',
    frame_rate: 30
  });
};

const removeCamera = (index) => {
  if (multicamConfig.cameras.length <= 1) {
    ElMessage.warning('至少保留一个摄像头');
    return;
  }
  multicamConfig.cameras.splice(index, 1);
};

const startMulticam = async () => {
  const invalidCameras = multicamConfig.cameras.filter(cam => !cam.device_path.trim());
  if (invalidCameras.length > 0) {
    ElMessage.warning('请填写所有摄像头的设备路径');
    return;
  }
  
  starting.value = true;
  try {
    await startMulticamRecording(multicamConfig, recordingConfig);
    addLog('多机位录制已开始', 'success');
    ElMessage.success('多机位录制已开始');
  } catch (error) {
    addLog(`多机位录制失败: ${error.message}`, 'error');
    ElMessage.error('启动失败');
  } finally {
    starting.value = false;
  }
};

const stopMulticam = async () => {
  try {
    await stopMulticamRecording();
    addLog('多机位录制已停止', 'info');
    ElMessage.success('录制已停止');
  } catch (error) {
    addLog(`停止失败: ${error.message}`, 'error');
  }
};

const switchToNextCamera = async () => {
  if (!multicamSessionId.value) return;
  
  const nextIndex = (activeCameraIndex.value + 1) % multicamConfig.cameras.length;
  try {
    await switchCamera(multicamSessionId.value, nextIndex);
    addLog(`切换到摄像头 ${nextIndex + 1}`, 'info');
  } catch (error) {
    addLog(`切换失败: ${error.message}`, 'error');
  }
};

// RTMP推流功能
const startRtmp = async () => {
  if (!rtmpConfig.url || !rtmpConfig.streamKey) {
    ElMessage.warning('请填写RTMP地址和推流密钥');
    return;
  }
  
  starting.value = true;
  try {
    const config = {
      ...recordingConfig,
      rtmp_stream: {
        enabled: true,
        rtmp_url: rtmpConfig.url,
        stream_key: rtmpConfig.streamKey,
        bitrate: rtmpConfig.bitrate,
        resolution: '1920x1080',
        frame_rate: 30
      }
    };
    
    await startRtmpStream(document.body, config);
    addLog(`RTMP推流已启动: ${rtmpConfig.url}`, 'success');
    ElMessage.success('推流已启动');
  } catch (error) {
    addLog(`RTMP推流失败: ${error.message}`, 'error');
    ElMessage.error('启动失败');
  } finally {
    starting.value = false;
  }
};

const stopRtmp = async () => {
  try {
    await stopRtmpStream();
    addLog('RTMP推流已停止', 'info');
    ElMessage.success('推流已停止');
  } catch (error) {
    addLog(`停止失败: ${error.message}`, 'error');
  }
};

// VR录制功能
const startVr = async () => {
  if (!vrConfig.cameraDevice.trim()) {
    ElMessage.warning('请填写相机设备名称');
    return;
  }
  
  starting.value = true;
  try {
    const config = {
      ...recordingConfig,
      vr_config: {
        enabled: true,
        projection: vrConfig.projection,
        fov: vrConfig.fov,
        stereo_mode: 'mono',
        input_type: vrConfig.input_type
      }
    };
    
    await startVrRecording(vrConfig.cameraDevice, config);
    addLog(`VR录制已开始 (${vrConfig.projection})`, 'success');
    ElMessage.success('VR录制已开始');
  } catch (error) {
    addLog(`VR录制失败: ${error.message}`, 'error');
    ElMessage.error('启动失败');
  } finally {
    starting.value = false;
  }
};

const stopVr = async () => {
  try {
    await stopVrRecording();
    addLog('VR录制已停止', 'info');
    ElMessage.success('录制已停止');
  } catch (error) {
    addLog(`停止失败: ${error.message}`, 'error');
  }
};
</script>

<style scoped>
.advanced-recording-test {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.header-card h2 {
  margin: 0;
  color: #303133;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.test-section {
  border-left: 4px solid #409EFF;
}

.log-section {
  border-left: 4px solid #67C23A;
}

.log-container {
  max-height: 300px;
  overflow-y: auto;
  background: #f5f7fa;
  padding: 10px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.log-item {
  padding: 5px 0;
  border-bottom: 1px solid #e4e7ed;
}

.log-time {
  color: #909399;
  margin-right: 10px;
}

.log-message {
  color: #606266;
}

.log-message.success {
  color: #67C23A;
}

.log-message.error {
  color: #F56C6C;
}

.empty-log {
  text-align: center;
  color: #C0C4CC;
  padding: 20px;
}
</style>
