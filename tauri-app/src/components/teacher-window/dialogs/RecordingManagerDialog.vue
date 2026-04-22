<template>
  <el-dialog
    v-model="visible"
    title=""
    fullscreen
    :close-on-click-modal="false"
    class="recording-dialog-wrapper"
    :z-index="2000"
    append-to-body
    :show-close="false"
  >
    <template #header>
      <div class="dialog-header">
        <span class="dialog-title">录制文件管理</span>
        <el-button @click="visible = false" size="small">关闭</el-button>
      </div>
    </template>
    <div class="recording-dialog-content">
      <!-- 录制配置 -->
      <el-card class="recording-config-card" shadow="never" style="margin-bottom: 16px">
        <template #header>
          <div class="card-header">
            <span>录制配置</span>
          </div>
        </template>
        
        <el-form :model="recordingConfig" label-width="120px" size="small">
          <el-row :gutter="20">
            <el-col :span="8">
              <el-form-item label="输出格式">
                <el-select v-model="recordingConfig.outputFormat" style="width: 100%">
                  <el-option label="MP4 (.mp4)" value="mp4" />
                  <el-option label="MKV (.mkv)" value="mkv" />
                </el-select>
              </el-form-item>
            </el-col>
            
            <el-col :span="8">
              <el-form-item label="编码器">
                <el-select v-model="recordingConfig.encoder" style="width: 100%">
                  <el-option label="CPU (H.264)" value="h264" />
                  <el-option label="NVIDIA GPU" value="h264_nvenc" />
                  <el-option label="Intel QuickSync" value="h264_qsv" />
                  <el-option label="AMD AMF" value="h264_amf" />
                </el-select>
              </el-form-item>
            </el-col>
            
            <el-col :span="8">
              <el-form-item label="编码预设">
                <el-select v-model="recordingConfig.preset" style="width: 100%">
                  <el-option label="超快 (文件大)" value="ultrafast" />
                  <el-option label="快速" value="fast" />
                  <el-option label="中等 (推荐)" value="medium" />
                  <el-option label="慢速 (文件小)" value="slow" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="20">
            <el-col :span="8">
              <el-form-item label="视频质量 (CRF)">
                <el-slider 
                  v-model="recordingConfig.crf" 
                  :min="0" 
                  :max="51" 
                  :step="1"
                  show-input
                />
                <div style="font-size: 12px; color: #909399; margin-top: 5px">
                  值越小质量越高，推荐 23
                </div>
              </el-form-item>
            </el-col>
            
            <el-col :span="8">
              <el-form-item label="自动分段">
                <el-switch v-model="recordingConfig.autoSegment" />
                <span style="margin-left: 10px; font-size: 12px; color: #909399">
                  每 {{ recordingConfig.segmentDuration }} 分钟
                </span>
              </el-form-item>
            </el-col>
            
            <el-col :span="8">
              <el-form-item label="音频混合">
                <el-switch v-model="recordingConfig.enableAudioMix" />
              </el-form-item>
            </el-col>
          </el-row>

          <!-- 高级功能配置 -->
          <el-divider content-position="left">高级功能</el-divider>
          
          <!-- 绿幕抠像 -->
          <el-row :gutter="20">
            <el-col :span="8">
              <el-form-item label="启用绿幕">
                <el-switch v-model="recordingConfig.enableChromakey" />
              </el-form-item>
            </el-col>
            
            <el-col :span="16" v-if="recordingConfig.enableChromakey">
              <el-row :gutter="10">
                <el-col :span="8">
                  <el-form-item label="颜色">
                    <el-color-picker v-model="recordingConfig.chromakeyColor" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="相似度">
                    <el-slider v-model="recordingConfig.chromakeySimilarity" :min="0" :max="1" :step="0.1" show-input />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="混合度">
                    <el-slider v-model="recordingConfig.chromakeyBlend" :min="0" :max="1" :step="0.1" show-input />
                  </el-form-item>
                </el-col>
              </el-row>
            </el-col>
          </el-row>

          <!-- RTMP推流 -->
          <el-row :gutter="20">
            <el-col :span="8">
              <el-form-item label="启用RTMP推流">
                <el-switch v-model="recordingConfig.enableRtmp" />
              </el-form-item>
            </el-col>
            
            <el-col :span="16" v-if="recordingConfig.enableRtmp">
              <el-row :gutter="10">
                <el-col :span="12">
                  <el-form-item label="RTMP地址">
                    <el-input v-model="recordingConfig.rtmpUrl" placeholder="rtmp://server/app" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="推流密钥">
                    <el-input v-model="recordingConfig.streamKey" type="password" show-password />
                  </el-form-item>
                </el-col>
                <el-col :span="4">
                  <el-form-item label="码率">
                    <el-input-number v-model="recordingConfig.rtmpBitrate" :min="1000" :max="10000" :step="500" style="width: 100%" />
                  </el-form-item>
                </el-col>
              </el-row>
            </el-col>
          </el-row>

          <!-- VR/360°录制 -->
          <el-row :gutter="20">
            <el-col :span="8">
              <el-form-item label="启用VR录制">
                <el-switch v-model="recordingConfig.enableVr" />
              </el-form-item>
            </el-col>
            
            <el-col :span="16" v-if="recordingConfig.enableVr">
              <el-row :gutter="10">
                <el-col :span="8">
                  <el-form-item label="投影方式">
                    <el-select v-model="recordingConfig.vrProjection" style="width: 100%">
                      <el-option label="等距柱状" value="equirectangular" />
                      <el-option label="立方体贴图" value="cubemap" />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="输入类型">
                    <el-select v-model="recordingConfig.vrInputType" style="width: 100%">
                      <el-option label="双fisheye" value="dual_fisheye" />
                      <el-option label="单fisheye" value="single_fisheye" />
                      <el-option label="全景" value="panoramic" />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="视野角度">
                    <el-input-number v-model="recordingConfig.vrFov" :min="90" :max="360" :step="90" style="width: 100%" />
                  </el-form-item>
                </el-col>
              </el-row>
            </el-col>
          </el-row>
        </el-form>
      </el-card>
      
      <!-- 音频通道管理 -->
      <el-card class="audio-channels-card" shadow="never" style="margin-bottom: 16px">
        <template #header>
          <div class="card-header">
            <span>音频通道管理</span>
            <div style="margin-left: auto">
              <el-button size="small" @click="handleToggleNoiseReduction">
                {{ noiseReductionEnabled ? '关闭降噪' : '开启降噪' }}
              </el-button>
            </div>
          </div>
        </template>
        
        <div v-if="audioChannels.length === 0" class="empty-audio-channels">
          <el-empty description="暂无音频通道" :image-size="80" />
        </div>
        
        <div v-else class="audio-channels-list">
          <div v-for="channel in audioChannels" :key="channel.id" class="audio-channel-item">
            <div class="channel-info">
              <el-checkbox 
                :model-value="channel.enabled" 
                @change="(val) => handleSetChannelEnabled(channel.id, val)"
              >
                {{ channel.name }}
              </el-checkbox>
            </div>
            
            <div class="channel-controls">
              <el-button 
                :type="channel.muted ? 'danger' : 'default'" 
                size="small"
                @click="handleSetChannelMute(channel.id, !channel.muted)"
              >
                {{ channel.muted ? '取消静音' : '静音' }}
              </el-button>
              
              <el-slider
                :model-value="channel.volume"
                :min="0"
                :max="1"
                :step="0.1"
                style="width: 120px; margin: 0 10px"
                @input="(val) => handleSetChannelVolume(channel.id, val)"
              />
              
              <el-button 
                type="danger" 
                size="small"
                @click="handleRemoveAudioChannel(channel.id)"
              >
                移除
              </el-button>
            </div>
          </div>
        </div>
      </el-card>
      
      <!-- 录制模板管理 -->
      <el-card class="templates-card" shadow="never" style="margin-bottom: 16px">
        <template #header>
          <div class="card-header">
            <span>录制模板管理</span>
            <div style="margin-left: auto">
              <el-button type="primary" size="small" @click="handleSaveCurrentAsTemplate">
                <el-icon><Plus /></el-icon> 保存当前配置为模板
              </el-button>
            </div>
          </div>
        </template>
        
        <div v-if="recordingTemplates.length === 0" class="empty-templates">
          <el-empty description="暂无录制模板" :image-size="80">
            <el-button type="primary" @click="handleSaveCurrentAsTemplate">创建第一个模板</el-button>
          </el-empty>
        </div>
        
        <div v-else class="templates-list">
          <el-row :gutter="16">
            <el-col 
              v-for="template in recordingTemplates" 
              :key="template.id" 
              :span="8"
              style="margin-bottom: 16px"
            >
              <el-card shadow="hover" class="template-card">
                <div class="template-header">
                  <h4>{{ template.name }}</h4>
                  <el-button 
                    type="danger" 
                    size="small" 
                    circle
                    @click="handleDeleteTemplate(template.id)"
                  >
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </div>
                
                <p class="template-description">{{ template.description || '无描述' }}</p>
                
                <div class="template-info">
                  <el-tag size="small">{{ template.config.outputFormat.toUpperCase() }}</el-tag>
                  <el-tag size="small" type="success">{{ template.config.encoder }}</el-tag>
                  <el-tag size="small" type="warning">CRF: {{ template.config.crf }}</el-tag>
                </div>
                
                <div class="template-actions">
                  <el-button 
                    type="primary" 
                    size="small" 
                    style="width: 100%"
                    @click="handleApplyTemplate(template)"
                  >
                    应用此模板
                  </el-button>
                </div>
              </el-card>
            </el-col>
          </el-row>
        </div>
      </el-card>
      
      <!-- 录制文件列表 -->
      <el-card class="recordings-list-card" shadow="never">
        <template #header>
          <div class="card-header">
            <span>录制文件列表</span>
            <div style="margin-left: auto; display: flex; gap: 10px">
              <el-select v-model="recordingFilterModel" size="small" style="width: 120px">
                <el-option label="全部" value="all" />
                <el-option label="摄像头" value="camera" />
                <el-option label="本地视频" value="local" />
                <el-option label="屏幕共享" value="screen" />
              </el-select>
              <el-button type="primary" size="small" @click="handleLoadRecordings">
                <el-icon><Refresh /></el-icon> 刷新列表
              </el-button>
            </div>
          </div>
        </template>
        
        <el-table :data="filteredRecordings" style="width: 100%" max-height="300">
          <el-table-column prop="name" label="文件名" min-width="200" />
          <el-table-column prop="type" label="类型" width="100">
            <template #default="{ row }">
              <el-tag :type="getSourceTypeTag(row.type)">
                {{ getSourceTypeLabel(row.type) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="canvas" label="画布" width="80" />
          <el-table-column prop="duration" label="时长" width="100" />
          <el-table-column prop="size" label="文件大小" width="100" />
          <el-table-column prop="createTime" label="创建时间" width="180" />
          <el-table-column label="操作" fixed="right" width="200">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="handlePlayRecording(row)">
                回放
              </el-button>
              <el-button type="success" size="small" @click="handleExportRecording(row)">
                导出
              </el-button>
              <el-button type="danger" size="small" @click="handleDeleteRecording(row)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue';
import { Refresh, Delete, Plus } from '@/components/icons';
import { SOURCE_TYPE_OPTIONS } from '@/constants/sourceTypes';

// ==================== Props & Emits ====================

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  recordingConfig: {
    type: Object,
    default: () => ({})
  },
  audioChannels: {
    type: Array,
    default: () => []
  },
  recordingTemplates: {
    type: Array,
    default: () => []
  },
  recordings: {
    type: Array,
    default: () => []
  },
  recordingFilter: {
    type: String,
    default: 'all'
  },
  noiseReductionEnabled: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'update:modelValue',
  'update:recordingFilter',
  'toggle-noise-reduction',
  'set-channel-enabled',
  'set-channel-mute',
  'set-channel-volume',
  'remove-audio-channel',
  'save-template',
  'delete-template',
  'apply-template',
  'load-recordings',
  'play-recording',
  'export-recording',
  'delete-recording'
]);

// ==================== Computed ====================

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const recordingFilterModel = computed({
  get: () => props.recordingFilter,
  set: (val) => emit('update:recordingFilter', val)
});

const filteredRecordings = computed(() => {
  if (props.recordingFilter === 'all') {
    return props.recordings;
  }
  return props.recordings.filter(r => r.type === props.recordingFilter);
});

// ==================== Methods ====================

// 工具函数
function getSourceTypeTag(type) {
  const option = SOURCE_TYPE_OPTIONS.find(opt => opt.value === type);
  return option?.tag || '';
}

function getSourceTypeLabel(type) {
  const option = SOURCE_TYPE_OPTIONS.find(opt => opt.value === type);
  return option?.label || type;
}

// 事件处理函数
function handleToggleNoiseReduction() {
  emit('toggle-noise-reduction', !props.noiseReductionEnabled);
}

function handleSetChannelEnabled(channelId, enabled) {
  emit('set-channel-enabled', channelId, enabled);
}

function handleSetChannelMute(channelId, muted) {
  emit('set-channel-mute', channelId, muted);
}

function handleSetChannelVolume(channelId, volume) {
  emit('set-channel-volume', channelId, volume);
}

function handleRemoveAudioChannel(channelId) {
  emit('remove-audio-channel', channelId);
}

function handleSaveCurrentAsTemplate() {
  emit('save-template');
}

function handleDeleteTemplate(templateId) {
  emit('delete-template', templateId);
}

function handleApplyTemplate(template) {
  emit('apply-template', template);
}

function handleLoadRecordings() {
  emit('load-recordings');
}

function handlePlayRecording(recording) {
  // 触发回放事件,传递录制文件路径
  emit('play-recording', recording.filePath || recording.path);
}

function handleExportRecording(recording) {
  emit('export-recording', recording);
}

function handleDeleteRecording(recording) {
  emit('delete-recording', recording);
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
.recording-dialog-wrapper {
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
}

.recording-dialog-content {
  padding: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  font-weight: bold;
}

.empty-audio-channels,
.empty-templates {
  padding: 20px 0;
}

.audio-channels-list {
  .audio-channel-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    border-bottom: 1px solid $border-color-lighter;
    
    &:last-child {
      border-bottom: none;
    }
    
    .channel-info {
      flex: 1;
    }
    
    .channel-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }
}

.templates-list {
  .template-card {
    height: 100%;
    
    .template-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      
      h4 {
        margin: 0;
        font-size: $font-size-base;
      }
    }
    
    .template-description {
      font-size: $font-size-sm;
      color: $text-secondary;
      margin: 8px 0;
      min-height: 40px;
    }
    
    .template-info {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    
    .template-actions {
      margin-top: 12px;
    }
  }
}
</style>
