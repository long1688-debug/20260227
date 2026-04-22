<template>
  <el-dialog
    v-model="visible"
    title=""
    fullscreen
    :close-on-click-modal="false"
    class="settings-dialog-wrapper"
    :z-index="2000"
    append-to-body
    :show-close="false"
  >
    <template #header>
      <div class="dialog-header">
        <span class="dialog-title">系统设置</span>
        <div class="header-actions">
          <el-button @click="handleResetSettings" size="small">
            <el-icon><RefreshLeft /></el-icon> 恢复默认
          </el-button>
          <el-button type="primary" @click="handleSaveSettings" size="small">
            <el-icon><Check /></el-icon> 保存设置
          </el-button>
          <el-button @click="visible = false" size="small">关闭</el-button>
        </div>
      </div>
    </template>
    <div class="settings-dialog-content">
      <el-tabs v-model="activeTab" class="settings-tabs">
        <!-- 录像设置 -->
        <el-tab-pane label="录像" name="recording">
          <div class="settings-section">
            <el-form label-width="140px">
              <el-form-item label="录制分辨率">
                <el-select v-model="settings.videoResolution" placeholder="请选择分辨率" style="width: 200px">
                  <el-option label="4K (3840×2160)" value="4k" />
                  <el-option label="2K (2560×1440)" value="2k" />
                  <el-option label="1080P (1920×1080)" value="1080p" />
                  <el-option label="720P (1280×720)" value="720p" />
                </el-select>
              </el-form-item>

              <el-form-item label="视频帧率">
                <el-select v-model="settings.videoFrameRate" placeholder="请选择帧率" style="width: 150px">
                  <el-option label="60 FPS" :value="60" />
                  <el-option label="30 FPS" :value="30" />
                  <el-option label="24 FPS" :value="24" />
                  <el-option label="15 FPS" :value="15" />
                </el-select>
              </el-form-item>

              <el-form-item label="视频码率">
                <el-select v-model="settings.videoBitrate" placeholder="请选择码率" style="width: 150px">
                  <el-option label="8000 kbps" :value="8000" />
                  <el-option label="6000 kbps" :value="6000" />
                  <el-option label="4000 kbps" :value="4000" />
                  <el-option label="2500 kbps" :value="2500" />
                  <el-option label="1500 kbps" :value="1500" />
                  <el-option label="自定义" :value="0" />
                </el-select>
                <el-input-number
                  v-if="settings.videoBitrate === 0"
                  v-model="customVideoBitrate"
                  :min="500"
                  :max="20000"
                  :step="100"
                  style="margin-left: 10px"
                />
                <span class="form-tip" style="margin-left: 10px">kbps</span>
              </el-form-item>

              <el-form-item label="视频编码器">
                <el-select v-model="settings.videoEncoder" placeholder="请选择编码器">
                  <el-option label="H.264 (兼容性好)" value="h264" />
                  <el-option label="H.265 (高效压缩)" value="h265" />
                  <el-option label="VP9 (Web 优化)" value="vp9" />
                </el-select>
              </el-form-item>

              <el-form-item label="输出格式">
                <el-select v-model="settings.outputFormat" placeholder="请选择输出格式">
                  <el-option label="MP4 (H.264)" value="mp4" />
                  <el-option label="MKV (H.264)" value="mkv" />
                  <el-option label="WebM (VP9)" value="webm" />
                </el-select>
              </el-form-item>

              <el-form-item label="音频源">
                <el-select v-model="settings.audioSource" placeholder="请选择音频源">
                  <el-option label="无音频" value="none" />
                  <el-option label="麦克风" value="mic" />
                  <el-option label="系统音频" value="system" />
                  <el-option label="多路混合" value="mixed" />
                </el-select>
              </el-form-item>

              <el-form-item label="音频降噪">
                <el-switch v-model="settings.enableNoiseReduction" />
              </el-form-item>

              <el-form-item label="监听音频">
                <el-switch v-model="settings.enableAudioMonitoring" />
              </el-form-item>

              <el-form-item label="音频混合比例" v-if="settings.audioSource === 'mixed'">
                <el-slider v-model="settings.audioMixRatio" :min="0" :max="100" />
                <span class="form-tip">{{ settings.audioMixRatio }}%</span>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <!-- RTMP 推流设置 -->
        <el-tab-pane label="RTMP 推流" name="rtmp">
          <div class="settings-section">
            <el-alert
              title="RTMP 推流设置"
              type="info"
              :closable="false"
              show-icon
              style="margin-bottom: 20px"
            >
              配置 RTMP 推流地址，供其他平台拉取直播画面使用。推流开关控制是否启用 RTMP 推流功能。
            </el-alert>
            
            <el-form label-width="140px">
              <el-form-item label="推流开关">
                <el-switch v-model="settings.enableRtmp" />
                <span class="form-tip" style="margin-left: 10px">
                  {{ settings.enableRtmp ? '已启用' : '已禁用' }}
                </span>
              </el-form-item>
              
              <el-form-item label="流媒体地址">
                <el-input 
                  v-model="settings.rtmpUrl" 
                  placeholder="rtmp://your-server.com/live"
                  :disabled="!settings.enableRtmp"
                  style="width: 350px"
                />
                <span class="form-hint" style="margin-left: 10px">
                  其他平台可使用此地址拉取直播画面
                </span>
              </el-form-item>
              
              <el-form-item label="推流密钥">
                <el-input 
                  v-model="settings.rtmpStreamKey" 
                  type="password" 
                  placeholder="请输入推流密钥（可选）"
                  show-password
                  :disabled="!settings.enableRtmp"
                  style="width: 250px"
                />
              </el-form-item>
              
              <el-divider content-position="left">推流状态</el-divider>
              
              <div class="rtmp-status">
                <div class="status-item">
                  <span class="status-label">推流状态:</span>
                  <el-tag :type="rtmpStreamingStatus.isStreaming ? 'success' : 'info'">
                    {{ rtmpStreamingStatus.isStreaming ? '推流中' : '未推流' }}
                  </el-tag>
                </div>
                <div class="status-item">
                  <span class="status-label">持续时间:</span>
                  <span class="status-value">{{ rtmpStreamingStatus.duration }}</span>
                </div>
                <div class="status-item">
                  <span class="status-label">推流地址:</span>
                  <span class="status-value">{{ settings.rtmpUrl || '未配置' }}</span>
                </div>
              </div>
              
              <el-form-item style="margin-top: 20px">
                <el-button 
                  v-if="rtmpStreamingStatus.isStreaming" 
                  type="danger" 
                  @click="handleStopRtmp"
                >
                  停止推流
                </el-button>
                <el-button 
                  v-else 
                  type="primary" 
                  @click="handleStartRtmp"
                  :disabled="!settings.enableRtmp || !settings.rtmpUrl"
                >
                  开始推流
                </el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <!-- 多路音视频编解码 -->
        <el-tab-pane label="多路编解码" name="codec">
          <div class="settings-section">
            <div class="codec-settings-container">
              <!-- 硬件加速检测 -->
              <div class="codec-card">
                <div class="card-header">
                  <h4>🖥️ 硬件加速能力</h4>
                  <el-button 
                    type="primary" 
                    size="small" 
                    @click="detectHardwareAccel"
                    :loading="detectingHardware"
                  >
                    {{ detectingHardware ? '检测中...' : '重新检测' }}
                  </el-button>
                </div>
                
                <div v-if="hardwareCaps" class="caps-grid">
                  <div class="cap-item">
                    <span class="cap-label">NVIDIA NVENC:</span>
                    <el-tag :type="hardwareCaps.has_nvidia ? 'success' : 'info'" size="small">
                      {{ hardwareCaps.has_nvidia ? '✅ 支持' : '❌ 不支持' }}
                    </el-tag>
                  </div>
                  <div class="cap-item">
                    <span class="cap-label">Intel QSV:</span>
                    <el-tag :type="hardwareCaps.has_intel_qsv ? 'success' : 'info'" size="small">
                      {{ hardwareCaps.has_intel_qsv ? '✅ 支持' : '❌ 不支持' }}
                    </el-tag>
                  </div>
                  <div class="cap-item">
                    <span class="cap-label">AMD AMF:</span>
                    <el-tag :type="hardwareCaps.has_amd_amf ? 'success' : 'info'" size="small">
                      {{ hardwareCaps.has_amd_amf ? '✅ 支持' : '❌ 不支持' }}
                    </el-tag>
                  </div>
                  <div class="cap-item full-width">
                    <span class="cap-label">推荐编码器:</span>
                    <el-tag type="warning">{{ hardwareCaps.recommended_encoder }}</el-tag>
                  </div>
                  <div v-if="hardwareCaps.gpu_memory_mb" class="cap-item full-width">
                    <span class="cap-label">GPU 显存:</span>
                    <span>{{ hardwareCaps.gpu_memory_mb }} MB</span>
                  </div>
                </div>
                
                <el-empty 
                  v-else 
                  description="点击检测按钮查看硬件加速能力" 
                  :image-size="80"
                />
              </div>

              <!-- 默认编码配置 -->
              <div class="codec-card">
                <div class="card-header">
                  <h4>⚙️ 默认编码配置</h4>
                </div>
                
                <el-form label-width="120px" size="default">
                  <el-form-item label="视频编码器">
                    <el-select v-model="codecSettings.defaultEncoder" style="width: 100%">
                      <el-option label="H.264 (兼容性好)" value="h264" />
                      <el-option label="H.265 (高效压缩)" value="h265" />
                    </el-select>
                  </el-form-item>
                  
                  <el-form-item label="硬件加速">
                    <el-switch
                      v-model="codecSettings.enableHardwareAccel"
                      active-text="启用"
                      inactive-text="禁用"
                    />
                    <span class="form-hint">（推荐启用以降低 CPU 负载）</span>
                  </el-form-item>
                  
                  <el-form-item label="默认分辨率">
                    <el-select v-model="codecSettings.defaultResolution" style="width: 100%">
                      <el-option label="1920×1080 (Full HD)" value="1920x1080" />
                      <el-option label="1280×720 (HD)" value="1280x720" />
                      <el-option label="640×480 (SD)" value="640x480" />
                    </el-select>
                  </el-form-item>
                  
                  <el-form-item label="默认帧率">
                    <el-slider 
                      v-model="codecSettings.defaultFramerate" 
                      :min="15" 
                      :max="60" 
                      :step="5"
                      show-input
                    />
                  </el-form-item>
                  
                  <el-form-item label="编码预设">
                    <el-select v-model="codecSettings.defaultPreset" style="width: 100%">
                      <el-option label="ultrafast (最快)" value="ultrafast" />
                      <el-option label="fast (快速)" value="fast" />
                      <el-option label="medium (平衡)" value="medium" />
                      <el-option label="slow (高质量)" value="slow" />
                    </el-select>
                  </el-form-item>
                  
                  <el-form-item label="CRF 质量">
                    <el-slider 
                      v-model="codecSettings.defaultCrf" 
                      :min="18" 
                      :max="28" 
                      :step="1"
                      show-input
                    />
                    <span class="form-hint">（越小质量越高，文件越大）</span>
                  </el-form-item>
                  
                  <el-form-item label="默认码率">
                    <el-input-number
                      v-model="codecSettings.defaultBitrate"
                      :min="1000"
                      :max="20000"
                      :step="500"
                      style="width: 100%"
                    />
                    <span class="form-hint">kbps</span>
                  </el-form-item>
                </el-form>
              </div>

              <!-- 录制模式配置 -->
              <div class="codec-card">
                <div class="card-header">
                  <h4>🎯 录制模式配置</h4>
                </div>
                
                <el-form label-width="120px" size="default">
                  <el-form-item label="默认录制模式">
                    <el-radio-group v-model="codecSettings.defaultRecordMode">
                      <el-radio value="multi">多路独立</el-radio>
                      <el-radio value="pip">画中画</el-radio>
                      <el-radio value="grid">网格布局</el-radio>
                    </el-radio-group>
                  </el-form-item>
                  
                  <el-form-item label="网格布局尺寸" v-if="codecSettings.defaultRecordMode === 'grid'">
                    <el-select v-model="codecSettings.gridLayoutSize" style="width: 100%">
                      <el-option label="2×2 (4路)" value="2x2" />
                      <el-option label="3×3 (9路)" value="3x3" />
                      <el-option label="4×4 (16路)" value="4x4" />
                    </el-select>
                  </el-form-item>
                  
                  <el-form-item label="PiP 窗口位置">
                    <el-select v-model="codecSettings.pipPosition" style="width: 100%">
                      <el-option label="右上角" value="top-right" />
                      <el-option label="左上角" value="top-left" />
                      <el-option label="右下角" value="bottom-right" />
                      <el-option label="左下角" value="bottom-left" />
                    </el-select>
                  </el-form-item>
                  
                  <el-form-item label="PiP 窗口大小">
                    <el-select v-model="codecSettings.pipSize" style="width: 100%">
                      <el-option label="小 (480×270)" value="small" />
                      <el-option label="中 (640×360)" value="medium" />
                      <el-option label="大 (960×540)" value="large" />
                    </el-select>
                  </el-form-item>
                </el-form>
              </div>

              <!-- 性能监控配置 -->
              <div class="codec-card">
                <div class="card-header">
                  <h4>📊 性能监控配置</h4>
                </div>
                
                <el-form label-width="140px" size="default">
                  <el-form-item label="监控更新间隔">
                    <el-select v-model="codecSettings.monitorInterval" style="width: 100%">
                      <el-option label="1 秒" :value="1000" />
                      <el-option label="2 秒" :value="2000" />
                      <el-option label="5 秒" :value="5000" />
                    </el-select>
                  </el-form-item>
                  
                  <el-form-item label="FPS 告警阈值">
                    <el-input-number
                      v-model="codecSettings.fpsWarningThreshold"
                      :min="10"
                      :max="30"
                      :step="5"
                      style="width: 100%"
                    />
                    <span class="form-hint">FPS</span>
                  </el-form-item>
                  
                  <el-form-item label="CPU 告警阈值">
                    <el-input-number
                      v-model="codecSettings.cpuWarningThreshold"
                      :min="50"
                      :max="95"
                      :step="5"
                      style="width: 100%"
                    />
                    <span class="form-hint">%</span>
                  </el-form-item>
                  
                  <el-form-item label="丢帧告警阈值">
                    <el-input-number
                      v-model="codecSettings.droppedFramesThreshold"
                      :min="50"
                      :max="500"
                      :step="50"
                      style="width: 100%"
                    />
                    <span class="form-hint">帧</span>
                  </el-form-item>
                  
                  <el-form-item label="启用声音告警">
                    <el-switch v-model="codecSettings.enableSoundAlert" />
                  </el-form-item>
                </el-form>
              </div>

              <!-- 输出配置 -->
              <div class="codec-card">
                <div class="card-header">
                  <h4>💾 输出配置</h4>
                </div>
                
                <el-form label-width="120px" size="default">
                  <el-form-item label="默认输出目录">
                    <el-input v-model="codecSettings.defaultOutputDir" readonly>
                      <template #append>
                        <el-button @click="selectOutputDir">浏览...</el-button>
                      </template>
                    </el-input>
                  </el-form-item>
                  
                  <el-form-item label="文件命名格式">
                    <el-select v-model="codecSettings.fileNameFormat" style="width: 100%">
                      <el-option label="session_YYYYMMDD_HHMMSS" value="session_timestamp" />
                      <el-option label="recording_YYYYMMDD_HHMMSS" value="recording_timestamp" />
                      <el-option label="自定义前缀 + 时间戳" value="custom_timestamp" />
                    </el-select>
                  </el-form-item>
                  
                  <el-form-item label="自定义前缀" v-if="codecSettings.fileNameFormat === 'custom_timestamp'">
                    <el-input v-model="codecSettings.customPrefix" placeholder="例如：lecture_" />
                  </el-form-item>
                  
                  <el-form-item label="自动清理旧文件">
                    <el-switch v-model="codecSettings.autoCleanup" />
                  </el-form-item>
                  
                  <el-form-item label="保留天数" v-if="codecSettings.autoCleanup">
                    <el-input-number
                      v-model="codecSettings.retentionDays"
                      :min="1"
                      :max="365"
                      :step="1"
                      style="width: 100%"
                    />
                    <span class="form-hint">天</span>
                  </el-form-item>
                </el-form>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- 关于 -->
        <el-tab-pane label="关于" name="about">
          <div class="about-in-settings">
            <slot name="about">
              <el-empty description="关于信息待配置" />
            </slot>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { RefreshLeft, Check } from '@/components/icons';
import { detectHardwareAcceleration } from '@/services/mediaCodecService';
import { open } from '@tauri-apps/plugin-dialog';
import { ElMessage } from 'element-plus';

// ==================== Props & Emits ====================

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  settings: {
    type: Object,
    default: () => ({})
  },
  activeTab: {
    type: String,
    default: 'recording'
  }
});

const emit = defineEmits([
  'update:modelValue',
  'update:activeTab',
  'save-settings',
  'reset-settings'
]);

// ==================== State ====================

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const activeTab = computed({
  get: () => props.activeTab,
  set: (val) => emit('update:activeTab', val)
});

// 自定义码率（内部状态）
const customVideoBitrate = ref(4000);

// 多路编解码相关状态
const detectingHardware = ref(false);
const hardwareCaps = ref(null);

// RTMP 推流相关状态
const rtmpStreamingStatus = ref({
  isStreaming: false,
  duration: '00:00',
  bitrate: 0
});

let rtmpTimer = null;
let rtmpStartTime = null;

// 开始 RTMP 推流
function handleStartRtmp() {
  if (!props.settings.enableRtmp || !props.settings.rtmpUrl) {
    ElMessage.warning('请先配置 RTMP 地址');
    return;
  }
  
  // TODO: 调用后端 API 开始 RTMP 推流
  // 这里先模拟推流状态
  rtmpStreamingStatus.value.isStreaming = true;
  rtmpStartTime = Date.now();
  
  // 启动计时器
  rtmpTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - rtmpStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    rtmpStreamingStatus.value.duration = 
      `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, 1000);
  
  ElMessage.success('RTMP 推流已开始');
  
  // 可以在这里触发其他平台的"开始直播"回调
  if (window.onRtmpStreamStart) {
    window.onRtmpStreamStart({
      url: props.settings.rtmpUrl,
      streamKey: props.settings.rtmpStreamKey
    });
  }
}

// 停止 RTMP 推流
function handleStopRtmp() {
  rtmpStreamingStatus.value.isStreaming = false;
  rtmpStreamingStatus.value.duration = '00:00';
  
  if (rtmpTimer) {
    clearInterval(rtmpTimer);
    rtmpTimer = null;
  }
  
  ElMessage.info('RTMP 推流已停止');
  
  // 可以在这里触发其他平台的"停止直播"回调
  if (window.onRtmpStreamStop) {
    window.onRtmpStreamStop();
  }
}

// 监听 RTMP 推流状态变化（供外部调用）
function updateRtmpStatus(status) {
  if (status.isStreaming) {
    rtmpStartTime = Date.now();
    rtmpTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - rtmpStartTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      rtmpStreamingStatus.value.duration = 
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, 1000);
  } else {
    if (rtmpTimer) {
      clearInterval(rtmpTimer);
      rtmpTimer = null;
    }
  }
  rtmpStreamingStatus.value = { ...rtmpStreamingStatus.value, ...status };
}

// 编解码设置
const codecSettings = ref({
  // 硬件加速
  enableHardwareAccel: true,
  
  // 编码配置
  defaultEncoder: 'h264',
  defaultResolution: '1920x1080',
  defaultFramerate: 30,
  defaultPreset: 'fast',
  defaultCrf: 23,
  defaultBitrate: 6000,
  
  // 录制模式
  defaultRecordMode: 'multi',
  gridLayoutSize: '2x2',
  pipPosition: 'top-right',
  pipSize: 'medium',
  
  // 性能监控
  monitorInterval: 2000,
  fpsWarningThreshold: 20,
  cpuWarningThreshold: 80,
  droppedFramesThreshold: 100,
  enableSoundAlert: false,
  
  // 输出配置
  defaultOutputDir: 'C:/Recordings',
  fileNameFormat: 'session_timestamp',
  customPrefix: '',
  autoCleanup: false,
  retentionDays: 30
});

// 硬件加速检测
async function detectHardwareAccel() {
  detectingHardware.value = true;
  
  try {
    hardwareCaps.value = await detectHardwareAcceleration();
    ElMessage.success('硬件加速检测完成');
  } catch (error) {
    ElMessage.error(`检测失败: ${error}`);
  } finally {
    detectingHardware.value = false;
  }
}

// 选择输出目录
async function selectOutputDir() {
  try {
    const selected = await open({
      directory: true,
      multiple: false,
      title: '选择录制输出目录'
    });
    
    if (selected) {
      codecSettings.value.defaultOutputDir = selected;
    }
  } catch (error) {
    ElMessage.error(`选择目录失败: ${error}`);
  }
}

// 监听自定义码率变化，同步到 settings
watch(customVideoBitrate, (val) => {
  if (props.settings.videoBitrate === 0) {
    emit('save-settings', { ...props.settings, videoBitrate: val });
  }
});

// ==================== Lifecycle ====================

onMounted(() => {
  // 加载保存的编解码设置
  try {
    const saved = localStorage.getItem('codecSettings');
    if (saved) {
      codecSettings.value = { ...codecSettings.value, ...JSON.parse(saved) };
    }
  } catch (error) {
    console.error('加载编解码设置失败:', error);
  }
  
  // 自动检测硬件加速
  detectHardwareAccel();
});

// ==================== Computed ====================

const showFooterButtons = computed(() => {
  return ['recording', 'video', 'rtmp', 'codec'].includes(activeTab.value);
});

// ==================== Methods ====================

function handleSaveSettings() {
  // 如果选择了自定义码率，使用自定义值
  const updatedSettings = { ...props.settings };
  
  if (updatedSettings.videoBitrate === 0) {
    updatedSettings.videoBitrate = customVideoBitrate.value;
  }
  
  // 保存编解码设置到 localStorage
  try {
    localStorage.setItem('codecSettings', JSON.stringify(codecSettings.value));
    ElMessage.success('设置已保存');
  } catch (error) {
    console.error('保存编解码设置失败:', error);
  }
  
  emit('save-settings', updatedSettings);
}

function handleResetSettings() {
  // 重置编解码设置为默认值
  codecSettings.value = {
    enableHardwareAccel: true,
    defaultEncoder: 'h264',
    defaultResolution: '1920x1080',
    defaultFramerate: 30,
    defaultPreset: 'fast',
    defaultCrf: 23,
    defaultBitrate: 6000,
    defaultRecordMode: 'multi',
    gridLayoutSize: '2x2',
    pipPosition: 'top-right',
    pipSize: 'medium',
    monitorInterval: 2000,
    fpsWarningThreshold: 20,
    cpuWarningThreshold: 80,
    droppedFramesThreshold: 100,
    enableSoundAlert: false,
    defaultOutputDir: 'C:/Recordings',
    fileNameFormat: 'session_timestamp',
    customPrefix: '',
    autoCleanup: false,
    retentionDays: 30
  };
  
  emit('reset-settings');
}
</script>

<style scoped lang="scss">
@import '@/styles/variables.scss';

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
.settings-dialog-wrapper {
  :deep(.el-dialog__body) {
    max-height: calc(100vh - 150px);
    overflow-y: auto;
    padding: 0;
    @include custom-scrollbar;
  }
}

// 对话框头部样式
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  
  .dialog-title {
    font-size: 16px;
    font-weight: 600;
    color: #E0E1DD;
  }
  
  .header-actions {
    display: flex;
    gap: 10px;
  }
}

.settings-dialog-content {
  padding: 20px;
}

.settings-tabs {
  :deep(.el-tabs__content) {
    padding-top: 20px;
  }
}

.settings-section {
  padding: 10px 20px;
}

.form-tip {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.registration-in-settings,
.about-in-settings {
  padding: 20px;
}

/* 多路编解码样式 */
.codec-settings-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 20px;
}

.codec-card {
  background: #141f2e;
  border: 1px solid #1A2A3A;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    border-bottom: 1px solid #1A2A3A;
    padding-bottom: 10px;

    h4 {
      margin: 0;
      font-size: $font-size-base;
      color: #E0E1DD;
      font-weight: 600;
    }
  }
}

.caps-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;

  .cap-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    background: $bg-color-page;
    border-radius: 4px;
    transition: background 0.2s ease;

    &:hover {
      background: lighten($bg-color-page, 3%);
    }

    &.full-width {
      grid-column: span 2;
    }

    .cap-label {
      font-weight: 500;
      color: $text-secondary;
      font-size: $font-size-sm;
    }
  }
}

.form-hint {
  font-size: $font-size-xs;
  color: $text-secondary;
  margin-left: 8px;
  font-style: italic;
}

/* RTMP 推流状态样式 */
.rtmp-status {
  background: $bg-color-page;
  border: 1px solid #1A2A3A;
  border-radius: 8px;
  padding: 15px;
  margin-top: 10px;
  
  .status-item {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
    
    &:last-child {
      margin-bottom: 0;
    }
    
    .status-label {
      width: 100px;
      font-size: $font-size-sm;
      color: $text-secondary;
    }
    
    .status-value {
      font-size: $font-size-sm;
      color: $text-primary;
      font-family: monospace;
    }
  }
}

/* 响应式调整 */
@media (max-width: 768px) {
  .codec-settings-container {
    grid-template-columns: 1fr;
  }
  
  .caps-grid {
    grid-template-columns: 1fr;
    
    .cap-item.full-width {
      grid-column: span 1;
    }
  }
}
</style>