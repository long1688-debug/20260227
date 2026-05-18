<template>
  <Teleport to="body">
    <!-- 视频会议窗口 -->
    <Transition name="fade">
      <VideoMeetingWindow
        v-if="showVideoMeeting"
        @close="$emit('close-video-meeting')"
      />
    </Transition>

    <!-- 智能视觉分析窗口（YOLO检测+考试评判） -->
    <Transition name="fade">
      <VisionAnalysisWindow
        v-if="showVisionAnalysis"
        @close="$emit('close-vision-analysis')"
        :external-camera-source="currentCameraSource.source"
        :external-camera-stream="currentCameraSource.stream"
      />
    </Transition>

    <!-- Analysis 全屏分析窗口 -->
    <Transition name="fade">
      <AnalysisFullscreenWindow
        v-if="showAnalysisWindow"
        @close="$emit('close-analysis-window')"
      />
    </Transition>

    <!-- Web 全屏功能窗口 -->
    <Transition name="fade">
      <WebFullscreenWindow
        v-if="showWebWindow"
        @close="$emit('close-web-window')"
      />
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSourceStore } from '@/stores/sourceStore';
import VideoMeetingWindow from '@/components/VideoMeetingWindow.vue'
import VisionAnalysisWindow from '@/components/VisionAnalysisWindow.vue'
import AnalysisFullscreenWindow from '@/components/AnalysisFullscreenWindow.vue'
import WebFullscreenWindow from '@/components/WebFullscreenWindow.vue'

interface Props {
  /** 是否显示视频会议窗口 */
  showVideoMeeting?: boolean
  /** 是否显示智能视觉分析窗口（YOLO+考试评判） */
  showVisionAnalysis?: boolean
  /** 是否显示 Analysis 全屏窗口 */
  showAnalysisWindow?: boolean
  /** 是否显示 Web 全屏窗口 */
  showWebWindow?: boolean
}

withDefaults(defineProps<Props>(), {
  showVideoMeeting: false,
  showVisionAnalysis: false,
  showAnalysisWindow: false,
  showWebWindow: false
})

interface Emits {
  (e: 'close-video-meeting'): void
  (e: 'close-vision-analysis'): void
  (e: 'close-analysis-window'): void
  (e: 'close-web-window'): void
}

defineEmits<Emits>()

// 获取摄像头源
const sourceStore = useSourceStore();

const currentCameraSource = computed(() => {
  // 从 sourceStore 中查找摄像头源
  const cameraSources = sourceStore.sources.filter(s =>
    s.type === 'camera' || s.type === 'localCamera'
  );

  // 如果有摄像头源，返回第一个（主摄像头）
  if (cameraSources.length > 0) {
    return {
      source: cameraSources[0],
      stream: cameraSources[0].stream || null
    };
  }

  return { source: null, stream: null };
});
</script>

<style scoped lang="scss">
// Teleport 到 body，无需额外样式
// 窗口的样式由子组件自己管理

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
