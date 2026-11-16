/**
 * 统一语音识别接口。前端只通过这里调用识别，具体引擎（目前是 Rust 端 whisper.cpp）对前端透明。
 *
 * - transcribe(Float32Array 16kHz 单声道) -> { full_text, segments, processing_time_ms }
 * - SpeechRecognizer：与浏览器 SpeechRecognition 接口兼容的麦克风识别器，可直接替换 webkitSpeechRecognition
 */
import { invoke } from '@tauri-apps/api/core'

export const ASR_SAMPLE_RATE = 16000

export function isAsrSupported() {
  return typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__
}

export async function getAsrStatus() {
  return invoke('get_whisper_status')
}

export async function initAsr({ model = 'base', language = 'zh' } = {}) {
  await invoke('init_whisper', {
    config: { model_type: model, language, translate: false, sample_rate: ASR_SAMPLE_RATE }
  })
}

export async function ensureAsr(options = {}) {
  const status = await getAsrStatus()
  if (!status.initialized) {
    await initAsr(options)
  }
}

export async function releaseAsr() {
  await invoke('cleanup_whisper')
}

export async function transcribe(samples) {
  return invoke('recognize_audio', { audioData: Array.from(samples) })
}

function toWhisperLanguage(lang) {
  return (lang || 'zh-CN').split('-')[0].toLowerCase()
}

const CHUNK_SECONDS = 3
const MAX_PENDING_SECONDS = 15
const SILENCE_RMS = 0.01

function rms(samples) {
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
  return Math.sqrt(sum / (samples.length || 1))
}

function concat(chunks) {
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const out = new Float32Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}

export class SpeechRecognizer {
  constructor() {
    this.lang = 'zh-CN'
    this.continuous = true
    this.interimResults = false
    this.maxAlternatives = 1
    this.onstart = null
    this.onresult = null
    this.onerror = null
    this.onend = null
    this._running = false
    this._chunks = []
    this._busy = false
  }

  start() {
    if (this._running) {
      throw new Error('InvalidStateError: recognition has already started')
    }
    this._running = true
    this._start().catch((e) => this._fail(e))
  }

  stop() {
    this._finish(true)
  }

  abort() {
    this._finish(false)
  }

  async _start() {
    if (!isAsrSupported()) {
      throw Object.assign(new Error('语音识别仅在桌面客户端中可用'), { code: 'service-not-allowed' })
    }
    await ensureAsr({ language: toWhisperLanguage(this.lang) })

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
      })
    } catch (e) {
      throw Object.assign(e, { code: e.name === 'NotAllowedError' ? 'not-allowed' : 'audio-capture' })
    }
    if (!this._running) {
      stream.getTracks().forEach((t) => t.stop())
      return
    }

    this._stream = stream
    this._ctx = new AudioContext({ sampleRate: ASR_SAMPLE_RATE })
    this._source = this._ctx.createMediaStreamSource(stream)
    this._processor = this._ctx.createScriptProcessor(4096, 1, 1)
    this._processor.onaudioprocess = (e) => {
      this._chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))
      this._maybeFlush(false)
    }
    this._source.connect(this._processor)
    this._processor.connect(this._ctx.destination)
    this.onstart?.({ type: 'start' })
  }

  _pendingSamples() {
    return this._chunks.reduce((n, c) => n + c.length, 0)
  }

  _maybeFlush(force) {
    const pending = this._pendingSamples()
    if (!force && pending < CHUNK_SECONDS * ASR_SAMPLE_RATE) return
    if (this._busy) {
      // 识别跟不上时丢弃最旧的音频，避免积压
      while (this._pendingSamples() > MAX_PENDING_SECONDS * ASR_SAMPLE_RATE) this._chunks.shift()
      return
    }
    const audio = concat(this._chunks)
    this._chunks = []
    if (!audio.length || rms(audio) < SILENCE_RMS) return
    this._busy = true
    transcribe(audio)
      .then((result) => {
        const text = (result?.full_text || '').trim()
        if (text) this._emit(text)
      })
      .catch((e) => this._fail(e))
      .finally(() => {
        this._busy = false
      })
  }

  _emit(transcript) {
    const alternative = { transcript, confidence: 1 }
    const result = Object.assign([alternative], { isFinal: true })
    this.onresult?.({ type: 'result', resultIndex: 0, results: [result] })
    if (!this.continuous) this._finish(false)
  }

  _fail(e) {
    if (!this._running) return
    this.onerror?.({ type: 'error', error: e?.code || 'audio-capture', message: e?.message || String(e) })
    this._finish(false)
  }

  _teardown() {
    this._processor?.disconnect()
    this._source?.disconnect()
    this._stream?.getTracks().forEach((t) => t.stop())
    this._ctx?.close().catch(() => {})
    this._processor = this._source = this._stream = this._ctx = null
  }

  _finish(flush) {
    if (!this._running) return
    if (flush) this._maybeFlush(true)
    this._running = false
    this._teardown()
    this._chunks = []
    this.onend?.({ type: 'end' })
  }
}
