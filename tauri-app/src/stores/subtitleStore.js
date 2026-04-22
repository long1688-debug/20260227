import { defineStore } from 'pinia'
import apiService from '@/services/apiService'

export const useSubtitleStore = defineStore('subtitle', {
  state: () => ({
    subtitles: [],
    currentSubtitle: '',
    isGenerating: false,
    videoId: null
  }),

  getters: {
    hasSubtitles: (state) => state.subtitles.length > 0,
    subtitleCount: (state) => state.subtitles.length
  },

  actions: {
    addSubtitle(subtitle) {
      this.subtitles.push(subtitle)
    },

    clearSubtitles() {
      this.subtitles = []
      this.currentSubtitle = ''
    },

    setCurrentSubtitle(text) {
      this.currentSubtitle = text
    },

    syncSubtitle(currentTime) {
      const subtitle = this.subtitles.find(sub => {
        const startTime = this.parseTime(sub.startTime)
        const endTime = this.parseTime(sub.endTime)
        return currentTime >= startTime && currentTime <= endTime
      })
      this.currentSubtitle = subtitle?.text || ''
    },

    parseTime(timeStr) {
      const [hours, minutes, seconds] = timeStr.split(':').map(Number)
      return hours * 3600 + minutes * 60 + seconds
    },

    exportSubtitles(format = 'srt') {
      if (format === 'srt') {
        return this.subtitles.map((sub, index) => {
          return `${index + 1}\n${sub.startTime} --> ${sub.endTime}\n${sub.text}\n`
        }).join('\n')
      }
      return ''
    },

    // ============ API 方法 ============

    /**
     * 从API加载字幕
     */
    async fetchSubtitles(videoId) {
      try {
        console.log('[SubtitleStore] 从API加载字幕:', videoId)
        this.videoId = videoId
        const result = await apiService.getSubtitles(videoId)
        if (result && result.subtitles) {
          this.subtitles = result.subtitles
          console.log(`[SubtitleStore] 加载了 ${this.subtitles.length} 条字幕`)
        }
      } catch (error) {
        console.warn('[SubtitleStore] 加载字幕失败:', error)
      }
    },

    /**
     * 保存字幕到API
     */
    async saveSubtitles(subtitleData) {
      try {
        console.log('[SubtitleStore] 保存字幕到API')
        await apiService.saveSubtitle(subtitleData)
        console.log('[SubtitleStore] 字幕保存成功')
      } catch (error) {
        console.error('[SubtitleStore] 保存字幕失败:', error)
        throw error
      }
    },

    /**
     * 更新字幕
     */
    async updateSubtitle(subtitleId, subtitleData) {
      try {
        console.log('[SubtitleStore] 更新字幕:', subtitleId)
        await apiService.updateSubtitle(subtitleId, subtitleData)
        
        // 更新本地状态
        const index = this.subtitles.findIndex(s => s.id === subtitleId)
        if (index !== -1) {
          this.subtitles[index] = { ...this.subtitles[index], ...subtitleData }
        }
        
        console.log('[SubtitleStore] 字幕更新成功')
      } catch (error) {
        console.error('[SubtitleStore] 更新字幕失败:', error)
        throw error
      }
    },

    /**
     * 删除字幕
     */
    async deleteSubtitle(subtitleId) {
      try {
        console.log('[SubtitleStore] 删除字幕:', subtitleId)
        await apiService.deleteSubtitle(subtitleId)
        
        // 更新本地状态
        this.subtitles = this.subtitles.filter(s => s.id !== subtitleId)
        
        console.log('[SubtitleStore] 字幕删除成功')
      } catch (error) {
        console.error('[SubtitleStore] 删除字幕失败:', error)
        throw error
      }
    },

    /**
     * 导出字幕
     */
    async exportSubtitlesFromApi(videoId, format = 'srt') {
      try {
        console.log('[SubtitleStore] 从API导出字幕:', videoId)
        const result = await apiService.exportSubtitles(videoId, format)
        return result
      } catch (error) {
        console.error('[SubtitleStore] 导出字幕失败:', error)
        throw error
      }
    }
  }
})
