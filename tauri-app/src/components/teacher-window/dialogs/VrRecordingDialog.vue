<template>
  <el-dialog
    v-model="visible"
    title="VR/360° 视频录制设置"
    width="700px"
    top="3vh"
    :close-on-click-modal="false"
    class="vr-dialog-wrapper"
    @close="handleClose"
    :z-index="2000"
    append-to-body
  >
    <el-form :model="config" label-width="140px">
      <!-- 输入类型 -->
      <el-form-item label="相机类型">
        <el-select v-model="config.vr_config.input_type" @change="onInputChange">
          <el-option label="双镜头 Fisheye" value="dual_fisheye">
            <div>
              <div>双镜头 Fisheye</div>
              <div style="font-size: 12px; color: #778DA9">Insta360 ONE X/X2/X3, GoPro MAX</div>
            </div>
          </el-option>
          <el-option label="单镜头 Fisheye" value="single_fisheye">
            <div>
              <div>单镜头 Fisheye</div>
              <div style="font-size: 12px; color: #778DA9">Ricoh Theta Z1, Samsung Gear 360</div>
            </div>
          </el-option>
          <el-option label="全景直出" value="panoramic">
            <div>
              <div>全景直出</div>
              <div style="font-size: 12px; color: #778DA9">已转换为全景格式的视频</div>
            </div>
          </el-option>
        </el-select>
      </el-form-item>

      <!-- 投影方式 -->
      <el-form-item label="投影方式">
        <el-select v-model="config.vr_config.projection">
          <el-option label="等距柱状投影" value="equirectangular">
            <div>
              <div>等距柱状投影 (Equirectangular)</div>
              <div style="font-size: 12px; color: #778DA9">最常用，兼容性最好，2:1比例</div>
            </div>
          </el-option>
          <el-option label="立方体贴图" value="cubemap">
            <div>
              <div>立方体贴图 (Cubemap)</div>
              <div style="font-size: 12px; color: #778DA9">用于特定VR应用</div>
            </div>
          </el-option>
        </el-select>
      </el-form-item>

      <!-- 视野 -->
      <el-form-item label="视野角度">
        <el-radio-group v-model="config.vr_config.fov">
          <el-radio :value="180">180°</el-radio>
          <el-radio :value="270">270°</el-radio>
          <el-radio :value="360">360°</el-radio>
        </el-radio-group>
      </el-form-item>

      <!-- 立体模式 -->
      <el-form-item label="立体模式">
        <el-select v-model="config.vr_config.stereo_mode">
          <el-option label="单眼 (Mono)" value="mono">
            <div>
              <div>单眼 (Mono)</div>
              <div style="font-size: 12px; color: #778DA9">普通360°视频</div>
            </div>
          </el-option>
          <el-option label="立体 (Stereo)" value="stereo">
            <div>
              <div>立体 (Stereo)</div>
              <div style="font-size: 12px; color: #778DA9">左右眼分别录制，VR头显显示</div>
            </div>
          </el-option>
        </el-select>
      </el-form-item>

      <!-- 输出分辨率 -->
      <el-form-item label="输出分辨率">
        <el-select v-model="config.resolution">
          <el-option label="7680x3840 (8K)" value="7680x3840" />
          <el-option label="5760x2880 (6K)" value="5760x2880" />
          <el-option label="3840x1920 (4K)" value="3840x1920" />
          <el-option label="2880x1440 (3K)" value="2880x1440" />
          <el-option label="1920x960 (2K)" value="1920x960" />
        </el-select>
        <div class="form-tip">
          VR视频通常采用2:1比例以覆盖360°全景
        </div>
      </el-form-item>

      <!-- 编码器 -->
      <el-form-item label="编码器">
        <el-select v-model="config.encoder">
          <el-option label="libx264 (CPU)" value="libx264" />
          <el-option label="h264_nvenc (NVIDIA)" value="h264_nvenc">
            <div>
              <div>h264_nvenc (NVIDIA)</div>
              <div style="font-size: 12px; color: #778DA9">推荐：高性能GPU编码</div>
            </div>
          </el-option>
          <el-option label="h264_qsv (Intel)" value="h264_qsv" />
        </el-select>
      </el-form-item>

      <el-form-item label="码率">
        <el-input-number v-model="config.bitrate" :min="2000" :max="30000" :step="1000" />
        <span style="margin-left: 8px">kbps</span>
        <div class="form-tip">
          建议4K使用10000-15000 kbps以获得最佳质量
        </div>
      </el-form-item>

      <!-- 预览信息 -->
      <el-divider />
      <div class="preview-info">
        <h4>输出预览</h4>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">投影:</span>
            <span class="info-value">{{ config.vr_config.projection }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">视野:</span>
            <span class="info-value">{{ config.vr_config.fov }}°</span>
          </div>
          <div class="info-item">
            <span class="info-label">立体:</span>
            <span class="info-value">{{ config.vr_config.stereo_mode }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">分辨率:</span>
            <span class="info-value">{{ config.resolution }}</span>
          </div>
        </div>
        <el-alert
          type="info"
          :closable="false"
          style="margin-top: 12px"
        >
          <template #title>
            录制的视频将自动添加VR元数据，可直接上传到YouTube等平台识别为360°视频
          </template>
        </el-alert>
      </div>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleStart">开始录制</el-button>
    </template>
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

const { startVrRecording } = useRecording()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const config = reactive({
  vr_config: {
    enabled: true,
    input_type: 'dual_fisheye',
    projection: 'equirectangular',
    fov: 360,
    stereo_mode: 'mono'
  },
  resolution: '3840x1920',
  frame_rate: 30,
  encoder: 'libx264',
  bitrate: 12000
})

const onInputChange = () => {
  const typeMap = {
    dual_fisheye: 3840,
    single_fisheye: 2880,
    panoramic: 1920
  }
  const height = typeMap[config.vr_config.input_type] || 1920
  config.resolution = `${height * 2}x${height}`
}

const handleStart = async () => {
  try {
    await startVrRecording(config)
    emit('start', { config })
    visible.value = false
    ElMessage.success('VR录制已开始')
  } catch (error) {
    ElMessage.error(`启动失败: ${error.message}`)
  }
}

const handleClose = () => {
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
.vr-dialog-wrapper {
  :deep(.el-dialog__body) {
    max-height: calc(100vh - 150px);
    overflow-y: auto;
    padding: 20px;
    @include custom-scrollbar;
  }
}

.preview-info {
  background: #0F2035;
  border-radius: 6px;
  padding: 15px;
}

.preview-info h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #E0E1DD;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.info-item {
  display: flex;
  justify-content: space-between;
}

.info-label {
  font-size: 13px;
  color: #778DA9;
}

.info-value {
  font-size: 13px;
  color: #E0E1DD;
  font-weight: 500;
}

.form-tip {
  font-size: 12px;
  color: #778DA9;
  margin-top: 4px;
  line-height: 1.5;
}
</style>
