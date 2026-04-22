// 格式化时间戳为 HH:MM:SS
export function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

// 格式化时间戳为 HH:MM:SS.mmm（带毫秒）
export function formatTimeWithMs(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

// 格式化时长（如 1小时23分45秒）
export function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  const parts = []
  if (hours > 0) parts.push(`${hours}小时`)
  if (minutes > 0) parts.push(`${minutes}分`)
  if (secs > 0 || parts.length === 0) parts.push(`${secs}秒`)

  return parts.join('')
}

// 格式化日期时间
export function formatDateTime(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

// 格式化相对时间（如 3分钟前）
export function formatRelativeTime(date) {
  const now = new Date()
  const diff = Math.floor((now - date) / 1000)

  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  if (diff < 2592000) return `${Math.floor(diff / 86400)}天前`
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}个月前`
  return `${Math.floor(diff / 31536000)}年前`
}

// 格式化文件大小
export function formatFileSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`
}

// 格式化比特率
export function formatBitrate(bps) {
  const units = ['bps', 'Kbps', 'Mbps', 'Gbps']
  let rate = bps
  let unitIndex = 0

  while (rate >= 1000 && unitIndex < units.length - 1) {
    rate /= 1000
    unitIndex++
  }

  return `${rate.toFixed(2)} ${units[unitIndex]}`
}

// 解析时间字符串为秒
export function parseTime(timeStr) {
  if (typeof timeStr === 'number') return timeStr

  const parts = timeStr.split(':').map(Number)
  let seconds = 0

  if (parts.length === 3) {
    seconds = parts[0] * 3600 + parts[1] * 60 + parts[2]
  } else if (parts.length === 2) {
    seconds = parts[0] * 60 + parts[1]
  } else if (parts.length === 1) {
    seconds = parts[0]
  }

  return seconds
}

// 解析 SRT 时间戳格式 (HH:MM:SS,mmm) 为秒
export function parseSRTTime(timeStr) {
  const [time, ms] = timeStr.replace(',', '.').split('.')
  const [hours, minutes, seconds] = time.split(':').map(Number)
  return hours * 3600 + minutes * 60 + seconds + parseFloat(ms || 0) / 1000
}
