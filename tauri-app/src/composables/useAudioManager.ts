/**
 * 音频管理 Composable
 * 
 * 职责：
 * - 管理麦克风设备选择和状态
 * - 管理音频混音器控制
 * - 管理音频监控和可视化
 */

import { ref, type Ref } from 'vue'
import { ElMessage } from 'element-plus'

/**
 * 音频设备接口
 */
export interface AudioDevice {
  id: string
  name: string
  kind: 'audioinput' | 'audiooutput'
  deviceId?: string
}

/**
 * 音频通道接口
 */
export interface AudioChannel {
  id: string
  name: string
  volume: number
  muted: boolean
}

/**
 * 音频存储接口（简化版）
 */
export interface AudioStoreLike {
  setSelectedMicrophone: (deviceId: string) => void
  toggleMicrophoneMute: () => boolean
  setChannelVolume: (channelId: string, volume: number) => void
  toggleChannelMute: (channelId: string) => boolean
}

/**
 * 音频管理选项
 */
export interface UseAudioManagerOptions {
  /** 音频存储对象 */
  audioStore?: AudioStoreLike
  /** 麦克风设备列表 */
  microphoneDevices?: Ref<AudioDevice[]>
  /** 当前选中的麦克风设备 ID */
  selectedMicrophoneId?: Ref<string>
  /** 音频通道列表 */
  audioChannels?: Ref<AudioChannel[]>
}

/**
 * 音频管理器返回值
 */
export interface UseAudioManagerReturn {
  /** 麦克风设备列表 */
  microphoneDevices: Ref<AudioDevice[]>
  /** 当前选中的麦克风设备 ID */
  selectedMicrophoneId: Ref<string>
  /** 音频通道列表 */
  audioChannels: Ref<AudioChannel[]>
  /** 刷新麦克风设备列表 */
  refreshMicrophones: () => Promise<void>
  /** 选择麦克风设备 */
  selectMicrophone: (deviceId: string) => void
  /** 切换麦克风静音 */
  toggleMicrophoneMute: () => void
  /** 调整音频通道音量 */
  adjustChannelVolume: (channelId: string, volume: number) => void
  /** 切换音频通道静音 */
  toggleChannelMute: (channelId: string) => void
}

/**
 * 使用音频管理器
 */
export function useAudioManager(options: UseAudioManagerOptions = {}): UseAudioManagerReturn {
  const audioStore = options.audioStore

  // 使用外部传入的引用，或创建内部引用
  const microphoneDevices = options.microphoneDevices || ref<AudioDevice[]>([])
  const selectedMicrophoneId = options.selectedMicrophoneId || ref('')
  const audioChannels = options.audioChannels || ref<AudioChannel[]>([])

  /**
   * 刷新麦克风设备列表
   */
  const refreshMicrophones = async () => {
    try {
      // 获取媒体设备
      const devices = await navigator.mediaDevices.enumerateDevices()

      // 过滤出音频输入设备
      const microphones = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          id: device.deviceId,
          name: device.label || `麦克风 ${microphoneDevices.value.length + 1}`,
          kind: 'audioinput' as const,
          deviceId: device.deviceId
        }))

      microphoneDevices.value = microphones

      console.log('[音频管理] 刷新麦克风设备列表:', microphones.length)
    } catch (error) {
      console.error('[音频管理] 刷新麦克风设备列表失败:', error)
      ElMessage.error('获取麦克风设备失败')
    }
  }

  /**
   * 选择麦克风设备
   * @param deviceId 设备 ID
   */
  const selectMicrophone = (deviceId: string) => {
    try {
      if (!audioStore) {
        console.warn('[音频管理] audioStore 未提供')
        return
      }

      selectedMicrophoneId.value = deviceId

      // 更新 store
      audioStore.setSelectedMicrophone(deviceId)

      const device = microphoneDevices.value.find(d => d.id === deviceId)
      ElMessage.success(`已选择麦克风: ${device?.name || '未知设备'}`)
      console.log('[音频管理] 选择麦克风:', deviceId)
    } catch (error) {
      console.error('[音频管理] 选择麦克风失败:', error)
      ElMessage.error('选择麦克风失败')
    }
  }

  /**
   * 切换麦克风静音
   */
  const toggleMicrophoneMute = () => {
    try {
      if (!audioStore) {
        console.warn('[音频管理] audioStore 未提供')
        return
      }

      const isMuted = audioStore.toggleMicrophoneMute()
      ElMessage.info(isMuted ? '麦克风已静音' : '麦克风已取消静音')
      console.log('[音频管理] 切换麦克风静音:', isMuted)
    } catch (error) {
      console.error('[音频管理] 切换麦克风静音失败:', error)
      ElMessage.error('操作失败')
    }
  }

  /**
   * 调整音频通道音量
   * @param channelId 通道 ID
   * @param volume 音量值 (0-100)
   */
  const adjustChannelVolume = (channelId: string, volume: number) => {
    try {
      if (!audioStore) {
        console.warn('[音频管理] audioStore 未提供')
        return
      }

      // 限制音量范围
      const clampedVolume = Math.max(0, Math.min(100, volume))

      // 更新 store
      audioStore.setChannelVolume(channelId, clampedVolume)

      // 更新本地引用
      const channel = audioChannels.value.find(c => c.id === channelId)
      if (channel) {
        channel.volume = clampedVolume
      }

      console.log('[音频管理] 调整通道音量:', channelId, clampedVolume)
    } catch (error) {
      console.error('[音频管理] 调整通道音量失败:', error)
      ElMessage.error('调整音量失败')
    }
  }

  /**
   * 切换音频通道静音
   * @param channelId 通道 ID
   */
  const toggleChannelMute = (channelId: string) => {
    try {
      if (!audioStore) {
        console.warn('[音频管理] audioStore 未提供')
        return
      }

      const isMuted = audioStore.toggleChannelMute(channelId)

      // 更新本地引用
      const channel = audioChannels.value.find(c => c.id === channelId)
      if (channel) {
        channel.muted = isMuted
      }

      ElMessage.info(isMuted ? '通道已静音' : '通道已取消静音')
      console.log('[音频管理] 切换通道静音:', channelId, isMuted)
    } catch (error) {
      console.error('[音频管理] 切换通道静音失败:', error)
      ElMessage.error('操作失败')
    }
  }

  return {
    microphoneDevices,
    selectedMicrophoneId,
    audioChannels,
    refreshMicrophones,
    selectMicrophone,
    toggleMicrophoneMute,
    adjustChannelVolume,
    toggleChannelMute
  }
}
