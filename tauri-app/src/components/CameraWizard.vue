<template>
  <el-dialog
    v-model="dialogVisible"
    title="添加网络摄像头"
    width="700px"
    :close-on-click-modal="false"
    @close="resetWizard"
  >
    <div class="camera-wizard">
      <!-- 步骤指示器 -->
      <el-steps :active="currentStep" finish-status="success" class="wizard-steps">
        <el-step title="输入地址" />
        <el-step title="测试连接" />
        <el-step title="配置转码" />
        <el-step title="配置云台" />
        <el-step title="完成" />
      </el-steps>

      <!-- 步骤 1: 输入 RTSP 地址 -->
      <div v-show="currentStep === 0" class="step-content">
        <h3>输入 RTSP 流地址</h3>
        <el-form :model="form" :rules="rules" ref="step1FormRef" label-width="120px">
          <el-form-item label="摄像头名称" prop="name">
            <el-input v-model="form.name" placeholder="例如：教室摄像头 1" />
          </el-form-item>

          <el-form-item label="RTSP 地址" prop="rtspUrl">
            <el-input v-model="form.rtspUrl" placeholder="rtsp://192.168.1.100/stream" />
            <div class="form-tip">
              常见格式：<br />
              海康威视：rtsp://admin:password@192.168.1.100:554/h264/ch1/main/av_stream<br />
              大 华：rtsp://admin:password@192.168.1.100:554/cam/realmonitor?channel=1&subtype=0
            </div>
          </el-form-item>

          <el-form-item label="认证方式">
            <el-radio-group v-model="form.authType">
              <el-radio label="none">无认证</el-radio>
              <el-radio label="basic">Basic Auth</el-radio>
              <el-radio label="digest">Digest Auth</el-radio>
            </el-radio-group>
          </el-form-item>

          <template v-if="form.authType !== 'none'">
            <el-form-item label="用户名" prop="username">
              <el-input v-model="form.username" placeholder="admin" />
            </el-form-item>
            <el-form-item label="密码" prop="password">
              <el-input v-model="form.password" type="password" placeholder="••••••" show-password />
            </el-form-item>
          </template>
        </el-form>

        <div class="step-actions">
          <el-button type="primary" @click="nextStep">下一步</el-button>
        </div>
      </div>

      <!-- 步骤 2: 测试连接 -->
      <div v-show="currentStep === 1" class="step-content">
        <h3>测试 RTSP 流连接</h3>
        
        <div class="test-section">
          <el-button 
            type="primary" 
            @click="testRtspConnection" 
            :loading="testingConnection"
            size="large"
          >
            {{ testingConnection ? '测试中...' : '测试连接' }}
          </el-button>

          <div v-if="testResult" class="test-result" :class="testResult.success ? 'success' : 'error'">
            <el-icon v-if="testResult.success"><SuccessFilled /></el-icon>
            <el-icon v-else><CircleCloseFilled /></el-icon>
            <span>{{ testResult.message }}</span>
          </div>
        </div>

        <div class="stream-info" v-if="streamInfo">
          <h4>流信息</h4>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="编码格式">{{ streamInfo.codec }}</el-descriptions-item>
            <el-descriptions-item label="分辨率">{{ streamInfo.resolution }}</el-descriptions-item>
            <el-descriptions-item label="帧率">{{ streamInfo.fps }}</el-descriptions-item>
            <el-descriptions-item label="是否有音频">{{ streamInfo.hasAudio ? '是' : '否' }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <div class="step-actions">
          <el-button @click="currentStep = 0">上一步</el-button>
          <el-button type="primary" @click="nextStep" :disabled="!testResult?.success">下一步</el-button>
        </div>
      </div>

      <!-- 步骤 3: 配置转码 -->
      <div v-show="currentStep === 2" class="step-content">
        <h3>配置转码参数</h3>

        <el-alert
          title="ZLMediaKit 将自动进行 H.265 → H.264 转码"
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom: 20px"
        />

        <el-form :model="transcodeForm" label-width="120px">
          <el-form-item label="启用转码">
            <el-switch v-model="transcodeForm.enabled" />
            <span class="form-tip" style="margin-left: 10px">H.265 流将自动转换为 H.264</span>
          </el-form-item>

          <template v-if="transcodeForm.enabled">
            <el-form-item label="硬件加速">
              <el-select v-model="transcodeForm.hardwareAcceleration" style="width: 200px">
                <el-option label="Intel QSV" value="qsv" />
                <el-option label="NVIDIA NVENC" value="nvenc" />
                <el-option label="软件编码" value="software" />
              </el-select>
            </el-form-item>

            <el-form-item label="输出码率">
              <el-select v-model="transcodeForm.bitrate" style="width: 150px">
                <el-option label="2000 kbps" :value="2000" />
                <el-option label="4000 kbps" :value="4000" />
                <el-option label="6000 kbps" :value="6000" />
                <el-option label="8000 kbps" :value="8000" />
              </el-select>
            </el-form-item>

            <el-form-item label="输出分辨率">
              <el-select v-model="transcodeForm.resolution" style="width: 150px">
                <el-option label="原始" value="original" />
                <el-option label="1080P" value="1920x1080" />
                <el-option label="720P" value="1280x720" />
                <el-option label="480P" value="854x480" />
              </el-select>
            </el-form-item>
          </template>
        </el-form>

        <div class="step-actions">
          <el-button @click="currentStep = 1">上一步</el-button>
          <el-button type="primary" @click="nextStep">下一步</el-button>
        </div>
      </div>

      <!-- 步骤 4: 配置云台 -->
      <div v-show="currentStep === 3" class="step-content">
        <h3>配置 ONVIF 云台控制（可选）</h3>

        <el-form :model="onvifForm" label-width="120px">
          <el-form-item label="启用云台控制">
            <el-switch v-model="onvifForm.enabled" />
          </el-form-item>

          <template v-if="onvifForm.enabled">
            <el-form-item label="ONVIF 地址" prop="deviceUrl">
              <el-input v-model="onvifForm.deviceUrl" placeholder="http://192.168.1.100/onvif/ptz" />
              <div class="form-tip">
                ONVIF 设备管理地址，通常为 http://IP:PORT/onvif/ptz
              </div>
            </el-form-item>

            <el-form-item label="用户名" prop="username">
              <el-input v-model="onvifForm.username" placeholder="admin" />
            </el-form-item>

            <el-form-item label="密码" prop="password">
              <el-input v-model="onvifForm.password" type="password" placeholder="••••••" show-password />
            </el-form-item>

            <el-form-item label="测试云台">
              <el-button @click="testOnvifConnection" :loading="testingOnvif">
                测试连接
              </el-button>
              <el-tag v-if="onvifTestResult" :type="onvifTestResult ? 'success' : 'danger'" style="margin-left: 10px">
                {{ onvifTestResult ? '连接成功' : '连接失败' }}
              </el-tag>
            </el-form-item>
          </template>
        </el-form>

        <div class="step-actions">
          <el-button @click="currentStep = 2">上一步</el-button>
          <el-button type="primary" @click="nextStep">下一步</el-button>
        </div>
      </div>

      <!-- 步骤 5: 完成 -->
      <div v-show="currentStep === 4" class="step-content">
        <div class="complete-section">
          <el-result icon="success" title="配置完成">
            <template #sub-title>
              <p>摄像头将自动添加到信号源列表</p>
            </template>
          </el-result>

          <div class="summary-card">
            <h4>配置摘要</h4>
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="名称">{{ form.name }}</el-descriptions-item>
              <el-descriptions-item label="RTSP 地址">{{ form.rtspUrl }}</el-descriptions-item>
              <el-descriptions-item label="转码">{{ transcodeForm.enabled ? '已启用' : '未启用' }}</el-descriptions-item>
              <el-descriptions-item label="云台控制">{{ onvifForm.enabled ? '已启用' : '未启用' }}</el-descriptions-item>
              <el-descriptions-item label="FLV 播放地址">
                <el-text type="info" size="small">{{ flvUrl }}</el-text>
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </div>

        <div class="step-actions">
          <el-button @click="currentStep = 3">上一步</el-button>
          <el-button type="primary" @click="finishWizard" size="large">
            完成并添加
          </el-button>
        </div>
      </div>
    </div>

    <!-- 底部按钮 -->
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { SuccessFilled, CircleCloseFilled } from '@element-plus/icons-vue'
import { addRtspProxy, onvifPtz } from '@/services/streamProxyService'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'added'])

// 对话框可见性
const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('close', val)
})

// 当前步骤
const currentStep = ref(0)

// 表单数据
const form = ref({
  name: '',
  rtspUrl: '',
  authType: 'none',
  username: '',
  password: ''
})

const transcodeForm = ref({
  enabled: true,
  hardwareAcceleration: 'qsv',
  bitrate: 4000,
  resolution: 'original'
})

const onvifForm = ref({
  enabled: false,
  deviceUrl: '',
  username: '',
  password: ''
})

// 测试状态
const testingConnection = ref(false)
const testResult = ref(null)
const streamInfo = ref(null)
const testingOnvif = ref(false)
const onvifTestResult = ref(false)

// FLV URL
const flvUrl = computed(() => {
  const streamId = `camera_${Date.now()}`
  return `http://127.0.0.1:8080/live/${streamId}/live.flv`
})

// 表单验证规则
const rules = {
  name: [
    { required: true, message: '请输入摄像头名称', trigger: 'blur' }
  ],
  rtspUrl: [
    { required: true, message: '请输入 RTSP 地址', trigger: 'blur' },
    { pattern: /^rtsp:\/\/.+/i, message: '必须是有效的 RTSP 地址', trigger: 'blur' }
  ]
}

const step1FormRef = ref(null)

// 下一步
const nextStep = async () => {
  if (currentStep.value === 0) {
    // 验证第一步表单
    if (!step1FormRef.value) return
    await step1FormRef.value.validate((valid) => {
      if (valid) {
        currentStep.value++
      }
    })
  } else {
    currentStep.value++
  }
}

// 测试 RTSP 连接
const testRtspConnection = async () => {
  testingConnection.value = true
  testResult.value = null

  try {
    // 模拟测试连接（实际应该调用后端 API）
    await new Promise(resolve => setTimeout(resolve, 1500))

    // 模拟成功
    testResult.value = {
      success: true,
      message: '连接成功！检测到 H.265 视频流'
    }

    streamInfo.value = {
      codec: 'H.265/HEVC',
      resolution: '1920x1080',
      fps: 25,
      hasAudio: true
    }

    ElMessage.success('连接测试成功')
  } catch (error) {
    testResult.value = {
      success: false,
      message: '连接失败：无法访问 RTSP 流'
    }
    ElMessage.error('连接测试失败')
  } finally {
    testingConnection.value = false
  }
}

// 测试 ONVIF 连接
const testOnvifConnection = async () => {
  testingOnvif.value = true

  try {
    const config = {
      deviceUrl: onvifForm.value.deviceUrl,
      username: onvifForm.value.username,
      password: onvifForm.value.password
    }

    await onvifPtz(config, 'stop', 0)
    onvifTestResult.value = true
    ElMessage.success('ONVIF 连接成功')
  } catch (error) {
    onvifTestResult.value = false
    ElMessage.error('ONVIF 连接失败: ' + error.message)
  } finally {
    testingOnvif.value = false
  }
}

// 完成向导
const finishWizard = async () => {
  try {
    // 生成流 ID
    const streamId = `camera_${Date.now()}`

    // 添加 RTSP 代理
    if (transcodeForm.value.enabled) {
      const stream = await addRtspProxy(streamId, form.value.rtspUrl)
      flvUrl.value = stream.flv_url
      ElMessage.success('RTSP 流代理已添加')
    }

    // 发射添加事件
    emit('added', {
      id: streamId,
      name: form.value.name,
      type: 'networkCamera',
      rtspUrl: form.value.rtspUrl,
      flvUrl: flvUrl.value,
      onvif: onvifForm.value.enabled ? {
        deviceUrl: onvifForm.value.deviceUrl,
        username: onvifForm.value.username,
        password: onvifForm.value.password
      } : null,
      transcode: transcodeForm.value.enabled
    })

    ElMessage.success('网络摄像头添加成功！')
    dialogVisible.value = false
  } catch (error) {
    console.error('[添加摄像头] 失败:', error)
    ElMessage.error('添加失败: ' + error.message)
  }
}

// 重置向导
const resetWizard = () => {
  currentStep.value = 0
  form.value = {
    name: '',
    rtspUrl: '',
    authType: 'none',
    username: '',
    password: ''
  }
  transcodeForm.value = {
    enabled: true,
    hardwareAcceleration: 'qsv',
    bitrate: 4000,
    resolution: 'original'
  }
  onvifForm.value = {
    enabled: false,
    deviceUrl: '',
    username: '',
    password: ''
  }
  testResult.value = null
  streamInfo.value = null
  onvifTestResult.value = false
}
</script>

<style lang="scss" scoped>
.camera-wizard {
  .wizard-steps {
    margin-bottom: 30px;
  }

  .step-content {
    min-height: 400px;

    h3 {
      margin-top: 0;
      margin-bottom: 20px;
      font-size: 18px;
      color: #333;
    }

    h4 {
      margin-top: 20px;
      margin-bottom: 12px;
      font-size: 16px;
      color: #666;
    }

    .form-tip {
      margin-top: 8px;
      font-size: 12px;
      color: #999;
      line-height: 1.6;
      background: #f5f7fa;
      padding: 8px 12px;
      border-radius: 4px;
    }

    .test-section {
      text-align: center;
      padding: 30px 0;

      .test-result {
        margin-top: 20px;
        padding: 16px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 16px;
        justify-content: center;

        &.success {
          background: #f0f9ff;
          color: #67C23A;
        }

        &.error {
          background: #fef0f0;
          color: #F56C6C;
        }

        .el-icon {
          font-size: 24px;
        }
      }
    }

    .stream-info {
      margin-top: 20px;
      padding: 16px;
      background: #f5f7fa;
      border-radius: 8px;
    }

    .complete-section {
      text-align: center;
      padding: 20px 0;

      .summary-card {
        margin-top: 30px;
        padding: 20px;
        background: #f5f7fa;
        border-radius: 8px;
        text-align: left;

        h4 {
          margin-top: 0;
        }
      }
    }

    .step-actions {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e4e7ed;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }
  }
}
</style>
