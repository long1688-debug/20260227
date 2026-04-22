<template>
  <el-dialog
    v-model="visible"
    title="多机位录制设置"
    width="800px"
    top="3vh"
    :close-on-click-modal="false"
    class="multicam-dialog-wrapper"
    @close="handleClose"
    :z-index="2000"
    append-to-body
  >
    <el-form :model="config" label-width="120px">
      <!-- 摄像头列表 -->
      <el-form-item label="摄像头">
        <div class="camera-list">
          <div
            v-for="(camera, index) in config.cameras"
            :key="camera.id"
            class="camera-item"
            :class="{ active: activeCameraIndex === index }"
          >
            <div class="camera-info">
              <span class="camera-name">{{ camera.name }}</span>
              <span class="camera-device">{{ camera.device_path }}</span>
            </div>
            <div class="camera-config">
              <el-select v-model="camera.resolution" size="small" style="width: 120px; margin-right: 8px">
                <el-option label="1920x1080" value="1920x1080" />
                <el-option label="1280x720" value="1280x720" />
                <el-option label="854x480" value="854x480" />
              </el-select>
              <el-select v-model="camera.frame_rate" size="small" style="width: 80px">
                <el-option label="30" :value="30" />
                <el-option label="24" :value="24" />
                <el-option label="15" :value="15" />
              </el-select>
            </div>
            <div class="camera-actions">
              <el-button size="small" @click="switchActiveCamera(index)">切换</el-button>
              <el-button size="small" type="danger" @click="removeCamera(index)">删除</el-button>
            </div>
          </div>

          <el-button
            v-if="config.cameras.length < 4"
            class="add-camera-btn"
            @click="showAddCameraDialog = true"
          >
            + 添加摄像头
          </el-button>
        </div>
      </el-form-item>

      <!-- 切换模式 -->
      <el-form-item label="切换模式">
        <el-radio-group v-model="config.switch_mode">
          <el-radio value="manual">手动切换</el-radio>
          <el-radio value="auto">自动切换</el-radio>
        </el-radio-group>
      </el-form-item>

      <!-- 自动切换间隔 -->
      <el-form-item v-if="config.switch_mode === 'auto'" label="切换间隔">
        <el-input-number v-model="config.auto_switch_interval" :min="5" :max="300" :step="5" />
        <span style="margin-left: 8px">秒</span>
      </el-form-item>

      <!-- 输出配置 -->
      <el-form-item label="输出分辨率">
        <el-select v-model="outputConfig.resolution">
          <el-option label="1920x1080" value="1920x1080" />
          <el-option label="1280x720" value="1280x720" />
          <el-option label="854x480" value="854x480" />
        </el-select>
      </el-form-item>

      <el-form-item label="编码器">
        <el-select v-model="outputConfig.encoder">
          <el-option label="libx264 (CPU)" value="libx264" />
          <el-option label="h264_nvenc (NVIDIA)" value="h264_nvenc" />
          <el-option label="h264_qsv (Intel)" value="h264_qsv" />
          <el-option label="h264_amf (AMD)" value="h264_amf" />
        </el-select>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleStart">开始录制</el-button>
    </template>

    <!-- 添加摄像头对话框 -->
    <el-dialog
      v-model="showAddCameraDialog"
      title="添加摄像头"
      width="500px"
      append-to-body
    >
      <el-form :model="newCamera" label-width="100px">
        <el-form-item label="名称">
          <el-input v-model="newCamera.name" placeholder="摄像头名称" />
        </el-form-item>
        <el-form-item label="设备路径">
          <el-input v-model="newCamera.device_path" placeholder="USB Camera 1" />
          <div class="form-tip">
            Windows: 使用设备管理器中的友好名称<br>
            查看命令: Get-PnpDevice | Where-Object {$_.FriendlyName -like "*camera*"}
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddCameraDialog = false">取消</el-button>
        <el-button type="primary" @click="addCamera">添加</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useRecording } from '@/composables/useRecording'

const props = defineProps({
  modelValue: Boolean
})

const emit = defineEmits(['update:modelValue', 'start'])

const { startMulticamRecording, stopMulticamRecording, switchCamera } = useRecording()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const activeCameraIndex = ref(0)
const showAddCameraDialog = ref(false)
const isRecording = ref(false)

const config = reactive({
  cameras: [
    { id: 'cam1', name: 'Camera 1', device_path: 'USB Camera 1', resolution: '1920x1080', frame_rate: 30 },
    { id: 'cam2', name: 'Camera 2', device_path: 'Integrated Webcam', resolution: '1920x1080', frame_rate: 30 }
  ],
  switch_mode: 'manual',
  auto_switch_interval: 30
})

const outputConfig = reactive({
  resolution: '1920x1080',
  encoder: 'libx264',
  bitrate: 4000,
  output_path: ''
})

const newCamera = reactive({
  name: '',
  device_path: ''
})

const addCamera = () => {
  if (!newCamera.name || !newCamera.device_path) {
    ElMessage.warning('请填写完整的摄像头信息')
    return
  }

  config.cameras.push({
    id: `cam${Date.now()}`,
    name: newCamera.name,
    device_path: newCamera.device_path,
    resolution: '1920x1080',
    frame_rate: 30
  })

  newCamera.name = ''
  newCamera.device_path = ''
  showAddCameraDialog.value = false
  ElMessage.success('摄像头已添加')
}

const removeCamera = (index) => {
  if (config.cameras.length <= 1) {
    ElMessage.warning('至少需要保留一个摄像头')
    return
  }
  config.cameras.splice(index, 1)
  if (activeCameraIndex.value >= config.cameras.length) {
    activeCameraIndex.value = config.cameras.length - 1
  }
}

const switchActiveCamera = (index) => {
  activeCameraIndex.value = index
  ElMessage.success(`已切换到 ${config.cameras[index].name}`)
}

const handleStart = async () => {
  try {
    isRecording.value = true
    await startMulticamRecording(config, outputConfig)
    emit('start', { config, outputConfig })
    visible.value = false
    ElMessage.success('多机位录制已开始')
  } catch (error) {
    isRecording.value = false
    ElMessage.error(`启动失败: ${error.message}`)
  }
}

const handleClose = async () => {
  if (isRecording.value) {
    await stopMulticamRecording()
    isRecording.value = false
  }
  visible.value = false
}
</script>

<style lang="scss" scoped>
// 🎯 滚动条样式 mixin
@mixin custom-scrollbar {
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 3px;

    &:hover {
      background: #555;
    }
  }
}

// 🎯 弹窗包装类样式
.multicam-dialog-wrapper {
  :deep(.el-dialog__body) {
    max-height: calc(100vh - 150px);
    overflow-y: auto;
    padding: 20px;
    @include custom-scrollbar;
  }
}

.camera-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.camera-item {
  background: #0F2035;
  border: 1px solid #1A2A3A;
  border-radius: 6px;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 15px;

  &.active {
    border-color: #4CC9F0;
    background: rgba(76, 201, 240, 0.1);
  }
}

.camera-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.camera-name {
  font-size: 14px;
  font-weight: 500;
  color: #E0E1DD;
}

.camera-device {
  font-size: 12px;
  color: #778DA9;
}

.camera-config {
  display: flex;
  gap: 8px;
}

.camera-actions {
  display: flex;
  gap: 8px;
}

.add-camera-btn {
  width: 100%;
  border: 1px dashed #4CC9F0;
  color: #4CC9F0;

  &:hover {
    border-color: #4CC9F0;
    background: rgba(76, 201, 240, 0.1);
  }
}

.form-tip {
  font-size: 12px;
  color: #778DA9;
  margin-top: 4px;
  line-height: 1.5;
}
</style>
