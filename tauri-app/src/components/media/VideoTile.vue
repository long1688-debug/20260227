<template>
  <div class="video-tile">
    <video
      ref="videoRef"
      :src="src"
      :poster="poster"
      autoplay
      playsinline
      :muted="isMuted"
      :data-source-id="source.id"
      :data-canvas-index="tile.canvasIndex"
    />

    <!-- 🎯 视频同步管理器（画布区域作为从属） -->
    <VideoSyncManager
      :source-id="source?.id"
      :video-ref="videoRef"
      :index="tile.canvasIndex"
      :is-document-type="false"
      :is-preview-area="false"
      @sync-status-change="handleSyncStatusChange"
    />
  </div>
</template>

<script>
import { ref, computed } from 'vue';
import VideoSyncManager from '@/components/VideoSyncManager.vue';

export default {
  components: {
    VideoSyncManager
  },
  props: {
    source: {
      type: Object,
      required: true
    },
    tile: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    const videoRef = ref(null);

    // 🎯 动态控制静音：画布区域保持静音，由VideoSyncManager统一管理音频
    const isMuted = computed(() => {
      // 画布区域（非预览区域）保持静音
      return !props.tile.isPreviewArea;
    });

    const handleSyncStatusChange = (status) => {
      console.log('[VideoTile] 同步状态变更:', status);
    };

    return {
      videoRef,
      isMuted,
      handleSyncStatusChange
    };
  }
}
</script>

<style scoped>
.video-tile {
  transition: box-shadow 0.2s, border-color 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.video-tile.master {
  box-shadow: 0 0 0 3px #4CAF50, 0 4px 12px rgba(0, 0, 0, 0.4);
}

.tile-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.master-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: #4CAF50;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  z-index: 10;
}

.source-name {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 4px 8px;
  font-size: 12px;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}
</style>
