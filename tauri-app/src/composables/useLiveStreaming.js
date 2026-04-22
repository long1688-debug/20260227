import { ref, computed } from 'vue'

export function useLiveStreaming() {
  const streamStatus = ref('idle')
  const streamUrl = ref('')
  const streamKey = ref('')
  const viewers = ref(0)
  const streamStartTime = ref(null)
  const error = ref(null)

  const isStreaming = computed(() => streamStatus.value === 'streaming')
  const isConnecting = computed(() => streamStatus.value === 'connecting')
  const isIdle = computed(() => streamStatus.value === 'idle')
  const hasError = computed(() => !!error.value)
  
  const streamDuration = computed(() => {
    if (!streamStartTime.value) return '00:00:00'
    const seconds = Math.floor((Date.now() - streamStartTime.value) / 1000)
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  })

  const startStream = async (url, key) => {
    streamStatus.value = 'connecting'
    error.value = null
    
    try {
      await connectStream(url, key)
      streamStatus.value = 'streaming'
      streamStartTime.value = Date.now()
      viewers.value = 0
      
      simulateViewers()
    } catch (err) {
      streamStatus.value = 'idle'
      error.value = err.message
      throw err
    }
  }

  const stopStream = async () => {
    if (streamStatus.value !== 'streaming') return
    
    try {
      await disconnectStream()
      streamStatus.value = 'idle'
      streamStartTime.value = null
      viewers.value = 0
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  const updateStreamKey = (key) => {
    streamKey.value = key
  }

  const updateStreamUrl = (url) => {
    streamUrl.value = url
  }

  const simulateViewers = () => {
    const interval = setInterval(() => {
      if (streamStatus.value !== 'streaming') {
        clearInterval(interval)
        return
      }
      
      const change = Math.floor(Math.random() * 11) - 5
      viewers.value = Math.max(0, viewers.value + change)
    }, 3000)
  }

  const connectStream = async (url, key) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        streamUrl.value = url
        streamKey.value = key
        resolve()
      }, 1000)
    })
  }

  const disconnectStream = async () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve()
      }, 500)
    })
  }

  return {
    streamStatus,
    streamUrl,
    streamKey,
    viewers,
    streamStartTime,
    error,
    isStreaming,
    isConnecting,
    isIdle,
    hasError,
    streamDuration,
    startStream,
    stopStream,
    updateStreamKey,
    updateStreamUrl
  }
}
