/**
 * 说话人分离器（基础版）
 *
 * 功能：
 * - 基于音频能量检测说话人切换
 * - 简单的时间窗口分析
 * - 标记不同说话人的片段
 *
 * 注意：这是基础版本，使用启发式方法
 * 生产环境建议使用专门的说话人分离模型（如 pyannote.audio）
 */

// ==================== 类型定义 ====================

export interface SpeakerSegment {
  id: string
  speakerId: string
  speakerLabel: string // "说话人 1", "说话人 2" 等
  text: string
  startTime: number
  endTime: number
  duration: number
  confidence: number
  audioEnergy?: number
}

export interface SpeakerDetectionResult {
  segments: SpeakerSegment[]
  speakerCount: number
  totalDuration: number
}

export interface AudioFrame {
  timestamp: number
  energy: number
  isSilence: boolean
}

// ==================== 核心算法 ====================

/**
 * 计算音频帧的能量
 */
function calculateEnergy(audioData: Float32Array, start: number, length: number): number {
  let sum = 0
  for (let i = start; i < start + length && i < audioData.length; i++) {
    sum += audioData[i] * audioData[i]
  }
  return Math.sqrt(sum / length)
}

/**
 * 将音频分割成帧
 */
function splitIntoFrames(
  audioData: Float32Array,
  sampleRate: number,
  frameDuration: number = 0.1 // 100ms
): AudioFrame[] {
  const frameSize = Math.floor(sampleRate * frameDuration)
  const frames: AudioFrame[] = []

  for (let i = 0; i < audioData.length; i += frameSize) {
    const energy = calculateEnergy(audioData, i, frameSize)
    const isSilence = energy < 0.01 // 静音阈值

    frames.push({
      timestamp: i / sampleRate,
      energy,
      isSilence
    })
  }

  return frames
}

/**
 * 检测说话人切换点
 *
 * 基于以下启发式规则：
 * 1. 静音后能量突然增加 → 可能是新说话人
 * 2. 能量模式显著变化 → 可能是不同说话人
 * 3. 时间间隔超过阈值 → 可能是不同说话人
 */
function detectSpeakerChanges(
  frames: AudioFrame[],
  options: {
    silenceThreshold?: number
    energyChangeThreshold?: number
    minSegmentDuration?: number
    maxPauseDuration?: number
  } = {}
): number[] {
  const {
    silenceThreshold = 0.01,
    energyChangeThreshold = 0.3,
    minSegmentDuration = 0.5, // 最小片段时长 500ms
    maxPauseDuration = 1.0 // 最大停顿时长 1s
  } = options

  const changePoints: number[] = []
  let currentSpeakerStart = 0
  let lastEnergy = 0
  let pauseStartTime: number | null = null

  for (let i = 1; i < frames.length; i++) {
    const frame = frames[i]
    const prevFrame = frames[i - 1]

    // 检测静音
    if (frame.isSilence) {
      if (pauseStartTime === null) {
        pauseStartTime = frame.timestamp
      }
      continue
    }

    // 检查停顿是否过长
    if (pauseStartTime !== null) {
      const pauseDuration = frame.timestamp - pauseStartTime

      if (pauseDuration > maxPauseDuration) {
        // 长时间停顿后，认为是新说话人
        changePoints.push(frame.timestamp)
        currentSpeakerStart = frame.timestamp
      }

      pauseStartTime = null
    }

    // 检测能量显著变化
    const energyChange = Math.abs(frame.energy - lastEnergy)
    if (energyChange > energyChangeThreshold && frame.energy > silenceThreshold) {
      const segmentDuration = frame.timestamp - currentSpeakerStart

      if (segmentDuration >= minSegmentDuration) {
        // 能量显著变化且片段足够长，可能是新说话人
        changePoints.push(frame.timestamp)
        currentSpeakerStart = frame.timestamp
      }
    }

    lastEnergy = frame.energy
  }

  return changePoints
}

/**
 * 根据说话人切换点分割文本片段
 */
function splitSegmentsBySpeakers(
  text: string,
  changePoints: number[],
  totalDuration: number
): SpeakerSegment[] {
  if (!text || text.trim() === '') {
    return []
  }

  // 简单策略：将文本平均分配到各个时间段
  const sentences = text.split(/[。！？.!?\n]+/).filter(s => s.trim())

  if (sentences.length === 0) {
    return []
  }

  const segments: SpeakerSegment[] = []
  const timePoints = [0, ...changePoints, totalDuration]
  const speakerCount = timePoints.length - 1

  // 将句子分配到时间段
  const sentencesPerSpeaker = Math.ceil(sentences.length / speakerCount)

  let sentenceIndex = 0
  for (let i = 0; i < speakerCount && sentenceIndex < sentences.length; i++) {
    const speakerId = `speaker_${i + 1}`
    const speakerLabel = `说话人 ${i + 1}`
    const startTime = timePoints[i]
    const endTime = timePoints[i + 1]
    const duration = endTime - startTime

    // 分配句子给当前说话人
    const speakerSentences: string[] = []
    for (let j = 0; j < sentencesPerSpeaker && sentenceIndex < sentences.length; j++) {
      speakerSentences.push(sentences[sentenceIndex].trim())
      sentenceIndex++
    }

    if (speakerSentences.length > 0) {
      segments.push({
        id: `seg_${Date.now()}_${i}`,
        speakerId,
        speakerLabel,
        text: speakerSentences.join(''),
        startTime,
        endTime,
        duration,
        confidence: 0.7, // 基础版本的置信度较低
        audioEnergy: undefined
      })
    }
  }

  return segments
}

// ==================== 主函数 ====================

/**
 * 执行说话人分离
 *
 * @param audioData PCM 音频数据（Float32Array）
 * @param text 识别出的文本
 * @param sampleRate 采样率（默认 16000）
 * @returns 说话人分离结果
 */
export function separateSpeakers(
  audioData: Float32Array,
  text: string,
  sampleRate: number = 16000
): SpeakerDetectionResult {
  console.log('[SpeakerSeparator] 开始说话人分离...')

  const totalDuration = audioData.length / sampleRate

  // 步骤 1: 分割音频帧
  const frames = splitIntoFrames(audioData, sampleRate, 0.1)
  console.log('[SpeakerSeparator] 音频帧数量:', frames.length)

  // 步骤 2: 检测说话人切换点
  const changePoints = detectSpeakerChanges(frames, {
    silenceThreshold: 0.01,
    energyChangeThreshold: 0.3,
    minSegmentDuration: 0.5,
    maxPauseDuration: 1.0
  })
  console.log('[SpeakerSeparator] 检测到说话人切换点:', changePoints.length)

  // 步骤 3: 分割文本片段
  const segments = splitSegmentsBySpeakers(text, changePoints, totalDuration)

  const speakerCount = new Set(segments.map(s => s.speakerId)).size

  const result: SpeakerDetectionResult = {
    segments,
    speakerCount,
    totalDuration
  }

  console.log('[SpeakerSeparator] 说话人分离完成:', {
    speakerCount,
    segmentCount: segments.length,
    totalDuration: totalDuration.toFixed(2) + 's'
  })

  return result
}

/**
 * 格式化说话人分离结果为可读文本
 */
export function formatSpeakerResult(result: SpeakerDetectionResult): string {
  if (result.segments.length === 0) {
    return '未检测到说话人'
  }

  const lines: string[] = []
  lines.push(`=== 会议记录（${result.speakerCount} 位说话人，${result.totalDuration.toFixed(1)}秒）===\n`)

  let currentSpeaker = ''

  result.segments.forEach(segment => {
    if (segment.speakerLabel !== currentSpeaker) {
      currentSpeaker = segment.speakerLabel
      lines.push(`\n【${currentSpeaker}】`)
    }

    const timeStr = formatTime(segment.startTime)
    lines.push(`  [${timeStr}] ${segment.text}`)
  })

  return lines.join('\n')
}

/**
 * 导出为 SRT 字幕格式
 */
export function exportToSRT(result: SpeakerDetectionResult): string {
  const lines: string[] = []

  result.segments.forEach((segment, index) => {
    const seqNumber = index + 1
    const startTime = formatSRTTime(segment.startTime)
    const endTime = formatSRTTime(segment.endTime)

    lines.push(seqNumber.toString())
    lines.push(`${startTime} --> ${endTime}`)
    lines.push(`${segment.speakerLabel}: ${segment.text}`)
    lines.push('')
  })

  return lines.join('\n')
}

// ==================== 辅助函数 ====================

/**
 * 格式化时间为 mm:ss
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * 格式化时间为 SRT 格式（hh:mm:ss,mmm）
 */
function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)

  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`
}
