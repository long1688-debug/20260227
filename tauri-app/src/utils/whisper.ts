/**
 * Whisper 语音识别工具
 *
 * 基于 Python openai-whisper 库实现实时语音转文字
 */

import { invoke } from '@tauri-apps/api/core'

/**
 * Whisper 配置
 */
export interface WhisperConfig {
  /** 模型类型: tiny, base, small, medium, large */
  modelType?: 'tiny' | 'base' | 'small' | 'medium' | 'large'
  /** 语言代码: zh, en, ja, ko 等 */
  language?: string
  /** 是否翻译为英文 */
  translate?: boolean
  /** 采样率（固定为 16000） */
  sampleRate?: number
}

/**
 * Whisper 识别结果片段
 */
export interface WhisperSegment {
  /** 文本内容 */
  text: string
  /** 开始时间（秒） */
  start: number
  /** 结束时间（秒） */
  end: number
  /** 置信度（0-1） */
  confidence: number
}

/**
 * 完整识别结果
 */
export interface WhisperResult {
  /** 所有片段 */
  segments: WhisperSegment[]
  /** 完整文本 */
  fullText: string
  /** 处理耗时（毫秒） */
  processingTimeMs: number
}

/**
 * Whisper 状态
 */
export interface WhisperStatus {
  /** 是否已初始化 */
  initialized: boolean
  /** Python 是否可用 */
  pythonAvailable: boolean
}

/**
 * 🎤 初始化 Whisper 识别器
 *
 * @param config - 配置参数
 * @returns 初始化结果
 *
 * @example
 * ```typescript
 * await initWhisper({
 *   modelType: 'base',
 *   language: 'zh'
 * })
 * ```
 */
export async function initWhisper(config: WhisperConfig = {}): Promise<void> {
  try {
    console.log('[Whisper] 正在初始化...', config)

    await invoke('init_whisper', {
      config: {
        model_type: config.modelType || 'base',
        language: config.language || 'zh',
        translate: config.translate || false,
        sample_rate: config.sampleRate || 16000
      }
    })

    console.log('[Whisper] ✅ 初始化成功')
  } catch (error) {
    console.error('[Whisper] ❌ 初始化失败:', error)
    throw error
  }
}

/**
 * 🎤 识别音频数据
 *
 * @param audioData - PCM f32 格式音频数据（16kHz 单声道）
 * @returns 识别结果
 *
 * @example
 * ```typescript
 * const result = await recognizeAudio(audioBuffer)
 * console.log('识别文本:', result.fullText)
 * console.log('片段数:', result.segments.length)
 * ```
 */
export async function recognizeAudio(audioData: Float32Array): Promise<WhisperResult> {
  try {
    // 转换为普通数组（Tauri IPC 不支持 TypedArray）
    const audioArray = Array.from(audioData)

    console.log(`[Whisper] 开始识别 - 音频长度: ${audioArray.length} 样本`)

    const result = await invoke<WhisperResult>('recognize_audio', {
      audioData: audioArray
    })

    console.log('[Whisper] ✅ 识别完成', {
      text: result.fullText,
      segments: result.segments.length,
      time: result.processingTimeMs + 'ms'
    })

    return result
  } catch (error) {
    console.error('[Whisper] ❌ 识别失败:', error)
    throw error
  }
}

/**
 * 🎤 清理 Whisper 识别器
 */
export async function cleanupWhisper(): Promise<void> {
  try {
    await invoke('cleanup_whisper')
    console.log('[Whisper] 🗑️ 已清理')
  } catch (error) {
    console.error('[Whisper] ❌ 清理失败:', error)
    throw error
  }
}

/**
 * 🎤 检查 Whisper 状态
 *
 * @returns 状态信息
 */
export async function getWhisperStatus(): Promise<WhisperStatus> {
  try {
    const status = await invoke<WhisperStatus>('get_whisper_status')
    console.log('[Whisper] 状态:', status)
    return status
  } catch (error) {
    console.error('[Whisper] ❌ 获取状态失败:', error)
    throw error
  }
}

/**
 * 🎤 便捷函数：从 MediaRecorder 获取音频并识别
 *
 * @param mediaStream - 媒体流（麦克风）
 * @param duration - 录制时长（秒）
 * @param config - Whisper 配置
 * @returns 识别结果
 *
 * @example
 * ```typescript
 * const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
 * const result = await recordAndRecognize(stream, 5)
 * console.log('识别结果:', result.fullText)
 * ```
 */
export async function recordAndRecognize(
  mediaStream: MediaStream,
  duration: number = 5,
  config: WhisperConfig = {}
): Promise<WhisperResult> {
  return new Promise((resolve, reject) => {
    const mediaRecorder = new MediaRecorder(mediaStream, {
      mimeType: 'audio/webm;codecs=opus'
    })

    const chunks: BlobPart[] = []

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data)
      }
    }

    mediaRecorder.onstop = async () => {
      try {
        // 将 WebM 转换为 PCM
        const blob = new Blob(chunks, { type: 'audio/webm' })
        const arrayBuffer = await blob.arrayBuffer()

        // 解码音频
        const audioContext = new AudioContext({ sampleRate: 16000 })
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

        // 提取单声道数据
        const channelData = audioBuffer.getChannelData(0)

        // 调用 Whisper 识别
        const result = await recognizeAudio(channelData)
        resolve(result)
      } catch (error) {
        reject(error)
      }
    }

    // 开始录制
    mediaRecorder.start()

    // 指定时长后停止
    setTimeout(() => {
      mediaRecorder.stop()
    }, duration * 1000)
  })
}

/**
 * 🎤 测试函数：验证 Whisper 功能
 */
export async function testWhisper() {
  console.log('=== Whisper 功能测试 ===\n')

  // 测试 1: 检查状态
  console.log('📝 测试 1: 检查 Whisper 状态')
  try {
    const status = await getWhisperStatus()
    console.log('✅ 状态:', status)
  } catch (error) {
    console.log('❌ 失败:', error)
  }

  console.log('\n---\n')

  // 测试 2: 初始化
  console.log('📝 测试 2: 初始化 Whisper')
  try {
    await initWhisper({
      modelType: 'base',
      language: 'zh'
    })
    console.log('✅ 初始化成功')
  } catch (error) {
    console.log('❌ 失败:', error)
    console.log('💡 提示: 请确保已安装 Python 和 whisper 库')
    console.log('   运行: pip install openai-whisper')
    return
  }

  console.log('\n---\n')

  // 测试 3: 模拟识别（需要真实音频数据）
  console.log('📝 测试 3: 模拟识别（空音频）')
  try {
    const emptyAudio = new Float32Array(16000) // 1 秒静音
    const result = await recognizeAudio(emptyAudio)
    console.log('✅ 识别结果:', result)
  } catch (error) {
    console.log('❌ 失败:', error)
  }

  console.log('\n---\n')

  // 测试 4: 清理
  console.log('📝 测试 4: 清理 Whisper')
  try {
    await cleanupWhisper()
    console.log('✅ 清理成功')
  } catch (error) {
    console.log('❌ 失败:', error)
  }

  console.log('\n=== 测试完成 ===')
}

// 如果在浏览器环境中运行
if (typeof window !== 'undefined') {
  ; (window as any).testWhisper = testWhisper
  console.log('💡 在浏览器控制台运行: testWhisper()')
}
