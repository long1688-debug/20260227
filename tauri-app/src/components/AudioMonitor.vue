<template>
  <div class="audio-monitor">
    <!-- 麦克风监听 -->
    <div class="audio-section">
      <h4>麦克风监听</h4>
      <div class="audio-device-card">
        <div class="device-info">
          <el-select 
            :model-value="selectedMicrophone" 
            placeholder="选择麦克风" 
            @change="$emit('microphone-change', $event)"
            style="width: 100%;"
          >
            <el-option 
              v-for="device in microphones" 
              :key="device.deviceId" 
              :label="device.label" 
              :value="device.deviceId" 
            />
          </el-select>
          
          <!-- 音频级别指示器 -->
          <div class="audio-level-indicator">
            <div class="level-bar">
              <div class="level-fill" :style="{ width: microphoneLevel + '%' }"></div>
            </div>
            <span class="level-text">{{ microphoneLevel }}%</span>
          </div>
        </div>
        
        <!-- 音量控制 -->
        <div class="volume-control">
          <span class="volume-label">音量</span>
          <el-slider 
            :model-value="microphoneVolume" 
            :min="0" 
            :max="100" 
            @change="$emit('microphone-volume-change', $event)"
            style="width: 120px;"
          />
          <span class="volume-value">{{ microphoneVolume }}%</span>
        </div>
        
        <el-button
          :type="microphoneEnabled ? 'danger' : 'success'"
          size="small"
          @click="$emit('toggle-microphone')"
        >
          {{ microphoneEnabled ? '禁用' : '启用' }}
        </el-button>
      </div>
    </div>

    <!-- 本地视频音频 -->
    <div class="audio-section">
      <h4>本地视频音频</h4>
      <div class="audio-device-card">
        <div class="device-info">
          <el-select 
            :model-value="selectedVideoAudio" 
            placeholder="选择视频音频" 
            @change="$emit('video-audio-change', $event)"
            style="width: 100%;"
          >
            <el-option label="全部视频" value="all" />
            <el-option 
              v-for="source in videoSources" 
              :key="source.id" 
              :label="source.name" 
              :value="source.id" 
            />
          </el-select>
          
          <div class="audio-level-indicator">
            <div class="level-bar">
              <div class="level-fill" :style="{ width: videoAudioLevel + '%' }"></div>
            </div>
            <span class="level-text">{{ videoAudioLevel }}%</span>
          </div>
        </div>
        
        <div class="volume-control">
          <span class="volume-label">音量</span>
          <el-slider 
            :model-value="videoAudioVolume" 
            :min="0" 
            :max="100" 
            @change="$emit('video-audio-volume-change', $event)"
            style="width: 120px;"
          />
          <span class="volume-value">{{ videoAudioVolume }}%</span>
        </div>
        
        <el-button
          :type="videoAudioEnabled ? 'danger' : 'success'"
          size="small"
          @click="$emit('toggle-video-audio')"
        >
          {{ videoAudioEnabled ? '静音' : '取消静音' }}
        </el-button>
      </div>
    </div>

    <!-- 系统音频 -->
    <div class="audio-section">
      <h4>系统音频</h4>
      <div class="audio-device-card">
        <div class="device-info">
          <span class="device-status">
            {{ systemAudioEnabled ? '系统音频已启用' : '系统音频已禁用' }}
          </span>
        </div>
        
        <div class="volume-control">
          <span class="volume-label">音量</span>
          <el-slider 
            :model-value="systemAudioVolume" 
            :min="0" 
            :max="100" 
            @change="$emit('system-audio-volume-change', $event)"
            style="width: 120px;"
          />
          <span class="volume-value">{{ systemAudioVolume }}%</span>
        </div>
        
        <el-button
          :type="systemAudioEnabled ? 'danger' : 'success'"
          size="small"
          @click="$emit('toggle-system-audio')"
        >
          {{ systemAudioEnabled ? '禁用' : '启用' }}
        </el-button>
      </div>
    </div>

    <!-- 刷新按钮 -->
    <el-button 
      type="primary" 
      size="small" 
      @click="$emit('refresh-devices')"
      style="margin-top: 12px;"
    >
      <el-icon><Refresh /></el-icon> 刷新设备
    </el-button>
  </div>
</template>

<script setup>
const props = defineProps({
  microphones: {
    type: Array,
    default: () => []
  },
  selectedMicrophone: {
    type: String,
    default: ''
  },
  microphoneEnabled: {
    type: Boolean,
    default: true
  },
  microphoneVolume: {
    type: Number,
    default: 100
  },
  microphoneLevel: {
    type: Number,
    default: 0
  },
  selectedVideoAudio: {
    type: String,
    default: 'all'
  },
  videoAudioEnabled: {
    type: Boolean,
    default: true
  },
  videoAudioVolume: {
    type: Number,
    default: 100
  },
  videoAudioLevel: {
    type: Number,
    default: 0
  },
  systemAudioEnabled: {
    type: Boolean,
    default: true
  },
  systemAudioVolume: {
    type: Number,
    default: 80
  },
  videoSources: {
    type: Array,
    default: () => []
  }
});

defineEmits([
  'microphone-change',
  'microphone-volume-change',
  'toggle-microphone',
  'video-audio-change',
  'video-audio-volume-change',
  'toggle-video-audio',
  'system-audio-volume-change',
  'toggle-system-audio',
  'refresh-devices'
]);
</script>

<style scoped lang="scss">
.audio-monitor {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.audio-section {
  h4 {
    margin: 0 0 8px 0;
    color: var(--text-primary, #E0E1DD);
    font-size: 14px;
  }
}

.audio-device-card {
  background: var(--bg-secondary, #1B263B);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid var(--border-color, #415A77);
}

.device-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.audio-level-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .level-bar {
    flex: 1;
    height: 8px;
    background: var(--bg-primary, #0D1B2A);
    border-radius: 4px;
    overflow: hidden;
    
    .level-fill {
      height: 100%;
      background: linear-gradient(90deg, 
        var(--color-success, #06D6A0) 0%, 
        var(--color-warning, #FFD166) 70%, 
        var(--color-danger, #EF476F) 100%
      );
      transition: width 0.1s ease;
    }
  }
  
  .level-text {
    font-size: 12px;
    color: var(--text-secondary, #ADB5BD);
    min-width: 40px;
    text-align: right;
  }
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .volume-label {
    font-size: 12px;
    color: var(--text-secondary, #ADB5BD);
  }
  
  .volume-value {
    font-size: 12px;
    color: var(--text-primary, #E0E1DD);
    min-width: 45px;
    text-align: right;
  }
}

.device-status {
  font-size: 13px;
  color: var(--text-secondary, #ADB5BD);
}
</style>
