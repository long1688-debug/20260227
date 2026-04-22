/**
 * 音频管理 Store
 * 
 * 职责：
 * - 管理麦克风设备选择和状态
 * - 管理音频混音器控制
 * - 管理音频通道配置
 * - 管理音频效果设置
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAudioStore = defineStore('audio', () => {
  // ============================================
  // 状态定义
  // ============================================
  
  /** 当前选中的麦克风设备 ID */
  const selectedMicrophone = ref('')
  
  /** 麦克风是否静音 */
  const microphoneMuted = ref(false)
  
  /** 麦克风音量 (0-100) */
  const microphoneVolume = ref(80)
  
  /** 麦克风电平 (0-100) */
  const microphoneLevel = ref(0)
  
  /** 音频通道列表 */
  const channels = ref([
    {
      id: 'channel_1',
      name: '通道 1',
      volume: 80,
      muted: false,
      type: 'microphone'
    },
    {
      id: 'channel_2',
      name: '通道 2',
      volume: 70,
      muted: false,
      type: 'system'
    },
    {
      id: 'channel_3',
      name: '通道 3',
      volume: 60,
      muted: true,
      type: 'music'
    }
  ])
  
  /** 可用的麦克风设备列表 */
  const availableMicrophones = ref([])
  
  /** 可用的扬声器设备列表 */
  const availableSpeakers = ref([])
  
  /** 当前选中的扬声器设备 ID */
  const selectedSpeaker = ref('')
  
  /** 扬声器音量 (0-100) */
  const speakerVolume = ref(80)
  
  /** 系统音频音量 (0-100) */
  const systemAudioVolume = ref(80)
  
  /** 系统音频是否启用 */
  const systemAudioEnabled = ref(true)
  
  /** 本地视频音频是否启用 */
  const localVideoAudioEnabled = ref(true)
  
  /** 本地视频音频音量 (0-100) */
  const localVideoAudioVolume = ref(100)
  
  /** 音频效果设置 */
  const audioEffects = ref({
    noiseReduction: true,
    echoCancellation: true,
    autoGain: false,
    noiseGate: 0.02,
    noiseSuppressionLevel: 0.5
  })
  
  /** 音频效果预设 */
  const audioPresets = ref({
    default: 'default',
    voice: {
      name: '语音模式',
      noiseReduction: true,
      echoCancellation: true,
      autoGain: true,
      noiseGate: 0.01,
      noiseSuppressionLevel: 0.3
    },
    music: {
      name: '音乐模式',
      noiseReduction: false,
      echoCancellation: false,
      autoGain: false,
      noiseGate: 0.001,
      noiseSuppressionLevel: 0
    },
    meeting: {
      name: '会议模式',
      noiseReduction: true,
      echoCancellation: true,
      autoGain: true,
      noiseGate: 0.015,
      noiseSuppressionLevel: 0.4
    }
  })
  
  /** 当前使用的预设 */
  const currentPreset = ref('default')

  // ============================================
  // Actions
  // ============================================
  
  /**
   * 设置选中的麦克风设备
   * @param {string} deviceId - 设备 ID
   */
  const setSelectedMicrophone = (deviceId) => {
    selectedMicrophone.value = deviceId
    console.log('[AudioStore] 选中麦克风:', deviceId)
  }
  
  /**
   * 切换麦克风静音状态
   * @returns {boolean} 新的静音状态
   */
  const toggleMicrophoneMute = () => {
    microphoneMuted.value = !microphoneMuted.value
    console.log('[AudioStore] 麦克风静音状态:', microphoneMuted.value ? '已静音' : '已取消静音')
    return microphoneMuted.value
  }
  
  /**
   * 设置麦克风音量
   * @param {number} volume - 音量值 (0-100)
   */
  const setMicrophoneVolume = (volume) => {
    microphoneVolume.value = Math.max(0, Math.min(100, volume))
    console.log('[AudioStore] 麦克风音量:', microphoneVolume.value)
  }
  
  /**
   * 更新麦克风电平
   * @param {number} level - 电平值 (0-100)
   */
  const setMicrophoneLevel = (level) => {
    microphoneLevel.value = Math.max(0, Math.min(100, level))
  }
  
  /**
   * 设置音频通道音量
   * @param {string} channelId - 通道 ID
   * @param {number} volume - 音量值 (0-100)
   */
  const setChannelVolume = (channelId, volume) => {
    const channel = channels.value.find(c => c.id === channelId)
    if (channel) {
      channel.volume = Math.max(0, Math.min(100, volume))
      console.log(`[AudioStore] 通道 ${channelId} 音量:`, channel.volume)
    }
  }
  
  /**
   * 切换音频通道静音状态
   * @param {string} channelId - 通道 ID
   * @returns {boolean} 新的静音状态
   */
  const toggleChannelMute = (channelId) => {
    const channel = channels.value.find(c => c.id === channelId)
    if (channel) {
      channel.muted = !channel.muted
      console.log(`[AudioStore] 通道 ${channelId} 静音状态:`, channel.muted ? '已静音' : '已取消静音')
      return channel.muted
    }
    return false
  }
  
  /**
   * 添加音频通道
   * @param {Object} channel - 通道配置
   */
  const addChannel = (channel) => {
    const newChannel = {
      id: `channel_${Date.now()}`,
      name: channel.name || `通道 ${channels.value.length + 1}`,
      volume: channel.volume || 80,
      muted: channel.muted || false,
      type: channel.type || 'custom'
    }
    channels.value.push(newChannel)
    console.log('[AudioStore] 添加通道:', newChannel)
  }
  
  /**
   * 移除音频通道
   * @param {string} channelId - 通道 ID
   */
  const removeChannel = (channelId) => {
    const index = channels.value.findIndex(c => c.id === channelId)
    if (index !== -1) {
      channels.value.splice(index, 1)
      console.log('[AudioStore] 移除通道:', channelId)
    }
  }
  
  /**
   * 更新可用麦克风设备列表
   * @param {Array} devices - 设备列表
   */
  const updateAvailableMicrophones = (devices) => {
    availableMicrophones.value = devices
    console.log('[AudioStore] 更新麦克风设备列表:', devices.length)
  }
  
  /**
   * 更新可用扬声器设备列表
   * @param {Array} devices - 设备列表
   */
  const updateAvailableSpeakers = (devices) => {
    availableSpeakers.value = devices
    console.log('[AudioStore] 更新扬声器设备列表:', devices.length)
  }
  
  /**
   * 设置选中的扬声器设备
   * @param {string} deviceId - 设备 ID
   */
  const setSelectedSpeaker = (deviceId) => {
    selectedSpeaker.value = deviceId
    console.log('[AudioStore] 选中扬声器:', deviceId)
  }
  
  /**
   * 设置扬声器音量
   * @param {number} volume - 音量值 (0-100)
   */
  const setSpeakerVolume = (volume) => {
    speakerVolume.value = Math.max(0, Math.min(100, volume))
    console.log('[AudioStore] 扬声器音量:', speakerVolume.value)
  }
  
  /**
   * 设置系统音频音量
   * @param {number} volume - 音量值 (0-100)
   */
  const setSystemAudioVolume = (volume) => {
    systemAudioVolume.value = Math.max(0, Math.min(100, volume))
    console.log('[AudioStore] 系统音频音量:', systemAudioVolume.value)
  }
  
  /**
   * 切换系统音频启用状态
   * @returns {boolean} 新的状态
   */
  const toggleSystemAudio = () => {
    systemAudioEnabled.value = !systemAudioEnabled.value
    console.log('[AudioStore] 系统音频状态:', systemAudioEnabled.value ? '已启用' : '已禁用')
    return systemAudioEnabled.value
  }
  
  /**
   * 切换本地视频音频启用状态
   * @returns {boolean} 新的状态
   */
  const toggleLocalVideoAudio = () => {
    localVideoAudioEnabled.value = !localVideoAudioEnabled.value
    console.log('[AudioStore] 本地视频音频状态:', localVideoAudioEnabled.value ? '已启用' : '已禁用')
    return localVideoAudioEnabled.value
  }
  
  /**
   * 设置本地视频音频音量
   * @param {number} volume - 音量值 (0-100)
   */
  const setLocalVideoAudioVolume = (volume) => {
    localVideoAudioVolume.value = Math.max(0, Math.min(100, volume))
    console.log('[AudioStore] 本地视频音频音量:', localVideoAudioVolume.value)
  }
  
  /**
   * 更新音频效果设置
   * @param {Object} effects - 效果配置
   */
  const updateAudioEffects = (effects) => {
    audioEffects.value = { ...audioEffects.value, ...effects }
    console.log('[AudioStore] 更新音频效果:', audioEffects.value)
  }
  
  /**
   * 应用音频预设
   * @param {string} presetName - 预设名称
   */
  const applyPreset = (presetName) => {
    const preset = audioPresets.value[presetName]
    if (preset) {
      updateAudioEffects({
        noiseReduction: preset.noiseReduction,
        echoCancellation: preset.echoCancellation,
        autoGain: preset.autoGain,
        noiseGate: preset.noiseGate,
        noiseSuppressionLevel: preset.noiseSuppressionLevel
      })
      currentPreset.value = presetName
      console.log('[AudioStore] 应用音频预设:', presetName)
    }
  }
  
  /**
   * 重置所有音频设置
   */
  const resetAudioSettings = () => {
    selectedMicrophone.value = ''
    microphoneMuted.value = false
    microphoneVolume.value = 80
    microphoneLevel.value = 0
    channels.value = [
      {
        id: 'channel_1',
        name: '通道 1',
        volume: 80,
        muted: false,
        type: 'microphone'
      }
    ]
    systemAudioVolume.value = 80
    systemAudioEnabled.value = true
    localVideoAudioEnabled.value = true
    localVideoAudioVolume.value = 100
    applyPreset('default')
    console.log('[AudioStore] 重置音频设置')
  }

  // ============================================
  // Getters
  // ============================================
  
  /** 获取当前选中的麦克风设备信息 */
  const currentMicrophone = computed(() => {
    return availableMicrophones.value.find(m => m.deviceId === selectedMicrophone.value || m.id === selectedMicrophone.value)
  })
  
  /** 获取当前选中的扬声器设备信息 */
  const currentSpeaker = computed(() => {
    return availableSpeakers.value.find(s => s.deviceId === selectedSpeaker.value || s.id === selectedSpeaker.value)
  })
  
  /** 获取未静音的通道数量 */
  const activeChannelsCount = computed(() => {
    return channels.value.filter(c => !c.muted).length
  })
  
  /** 获取总音量（考虑所有通道） */
  const totalVolume = computed(() => {
    const activeChannels = channels.value.filter(c => !c.muted)
    if (activeChannels.length === 0) return 0
    const sum = activeChannels.reduce((acc, c) => acc + c.volume, 0)
    return Math.round(sum / activeChannels.length)
  })
  
  /** 获取当前预设信息 */
  const currentPresetInfo = computed(() => {
    const preset = audioPresets.value[currentPreset.value]
    return preset ? { name: preset.name, key: currentPreset.value } : { name: '默认', key: 'default' }
  })

  return {
    // State - 麦克风
    selectedMicrophone,
    microphoneMuted,
    microphoneVolume,
    microphoneLevel,
    availableMicrophones,
    
    // State - 扬声器
    selectedSpeaker,
    speakerVolume,
    availableSpeakers,
    
    // State - 系统音频
    systemAudioVolume,
    systemAudioEnabled,
    
    // State - 本地视频音频
    localVideoAudioEnabled,
    localVideoAudioVolume,
    
    // State - 通道
    channels,
    
    // State - 音频效果
    audioEffects,
    audioPresets,
    currentPreset,
    
    // Actions - 麦克风
    setSelectedMicrophone,
    toggleMicrophoneMute,
    setMicrophoneVolume,
    setMicrophoneLevel,
    
    // Actions - 扬声器
    setSelectedSpeaker,
    setSpeakerVolume,
    
    // Actions - 系统音频
    setSystemAudioVolume,
    toggleSystemAudio,
    
    // Actions - 本地视频音频
    toggleLocalVideoAudio,
    setLocalVideoAudioVolume,
    
    // Actions - 通道
    setChannelVolume,
    toggleChannelMute,
    addChannel,
    removeChannel,
    
    // Actions - 设备列表
    updateAvailableMicrophones,
    updateAvailableSpeakers,
    
    // Actions - 效果
    updateAudioEffects,
    applyPreset,
    
    // Actions - 重置
    resetAudioSettings,
    
    // Getters
    currentMicrophone,
    currentSpeaker,
    activeChannelsCount,
    totalVolume,
    currentPresetInfo
  }
})
