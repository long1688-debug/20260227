import { ref, computed } from 'vue'
import { useSubtitleStore } from '@/stores/subtitleStore'
import { videoToSubtitleService } from '@/services/videoToSubtitleService.js'

export function useSubtitle() {
  const subtitleStore = useSubtitleStore()

  const isGenerating = computed(() => subtitleStore.isGenerating)
  const generatedSubtitles = computed(() => subtitleStore.subtitles)
  const currentSubtitleText = computed(() => subtitleStore.currentSubtitle)

  const generateForVideo = async (videoId) => {
    subtitleStore.isGenerating = true
    try {
      const result = await videoToSubtitleService.generateSubtitle(videoId)
      subtitleStore.addSubtitle(result)
      return result
    } catch (error) {
      console.error('生成字幕失败:', error)
      throw error
    } finally {
      subtitleStore.isGenerating = false
    }
  }

  const syncSubtitle = (currentTime) => {
    subtitleStore.syncSubtitle(currentTime)
  }

  const clearSubtitles = () => {
    subtitleStore.clearSubtitles()
  }

  const exportSubtitles = (format = 'srt') => {
    return subtitleStore.exportSubtitles(format)
  }

  return {
    isGenerating,
    generatedSubtitles,
    currentSubtitleText,
    generateForVideo,
    syncSubtitle,
    clearSubtitles,
    exportSubtitles
  }
}
