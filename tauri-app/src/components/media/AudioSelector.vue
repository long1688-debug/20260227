<template>
  <div class="audio-selector">
    <!-- 麦克风开关 -->
    <el-button
      :type="isMicEnabled ? 'danger' : 'primary'"
      @click="handleMicToggle"
    >
      <el-icon><Microphone /></el-icon>
      {{ isMicEnabled ? '关闭麦克风' : '开启麦克风' }}
    </el-button>
    
    <!-- 音频源选择下拉框 -->
    <el-select
      v-model="selectedAudioSource"
      placeholder="选择音频输出"
      style="width: 200px"
      @change="handleSourceChange"
    >
      <el-option label="-- 无音频输出 --" value="" />
      <el-option
        v-for="sourceId in audioSourceList"
        :key="sourceId"
        :label="getSourceLabel(sourceId)"
        :value="sourceId"
      />
    </el-select>
    
    <!-- 当前播放状态 -->
    <span class="current-status">
      当前播放: {{ currentAudioLabel }}
    </span>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Microphone } from '@element-plus/icons-vue';
import { useMediaStore } from '@/stores/mediaStore';
import { useMicrophone } from '@/composables/useMicrophone';
import { audioMixer } from '@/utils/audioMixer';

const mediaStore = useMediaStore();
const { isMicEnabled, toggleMicrophone } = useMicrophone();

// State
const audioSourceList = ref([]);
const selectedAudioSource = ref('');

// Computed
const currentAudioLabel = computed(() => {
  const activeId = mediaStore.activeAudioSourceId;
  if (!activeId) return '无';
  
  const source = mediaStore.sources.get(activeId);
  if (activeId === 'microphone') return '麦克风';
  if (source) return source.name;
  return '未知源';
});

// Methods
const updateSourceList = () => {
  const sources = audioMixer.getRegisteredSources();
  audioSourceList.value = sources;
};

const getSourceLabel = (sourceId) => {
  if (sourceId === 'microphone') return '麦克风';
  
  const source = mediaStore.sources.get(sourceId);
  return source ? source.name : `视频源 ${sourceId.slice(0, 8)}`;
};

const handleMicToggle = async () => {
  await toggleMicrophone();
  
  // 如果当前激活的是麦克风,切换为无
  if (mediaStore.activeAudioSourceId === 'microphone' && !isMicEnabled.value) {
    mediaStore.setActiveAudioSource(null);
    selectedAudioSource.value = '';
  }
};

const handleSourceChange = (value) => {
  mediaStore.setActiveAudioSource(value || null);
};

// Lifecycle
let updateInterval = null;

onMounted(() => {
  // 每秒更新一次音频源列表
  updateSourceList();
  updateInterval = setInterval(updateSourceList, 1000);
  
  // 同步当前选中的音频源
  selectedAudioSource.value = mediaStore.activeAudioSourceId || '';
});

onUnmounted(() => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});
</script>

<style scoped>
.audio-selector {
  display: flex;
  align-items: center;
  gap: 16px;
}

.current-status {
  font-size: 14px;
  color: #666;
  min-width: 150px;
}
</style>
