// SRT 字幕解析器
export class SRTParser {
  static parse(content) {
    const blocks = content.trim().split(/\n\s*\n/)
    const subtitles = []

    blocks.forEach(block => {
      const lines = block.split('\n')
      if (lines.length >= 3) {
        const index = parseInt(lines[0].trim())
        const timeLine = lines[1].trim()
        const text = lines.slice(2).join('\n')

        const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/)
        if (timeMatch) {
          subtitles.push({
            index,
            startTime: timeMatch[1],
            endTime: timeMatch[2],
            text
          })
        }
      }
    })

    return subtitles
  }

  static format(subtitles) {
    return subtitles.map((sub, index) => {
      return `${index + 1}\n${sub.startTime} --> ${sub.endTime}\n${sub.text}\n`
    }).join('\n')
  }

  static timeToSeconds(timeStr) {
    const [time, ms] = timeStr.replace(',', '.').split('.')
    const [hours, minutes, seconds] = time.split(':').map(Number)
    return hours * 3600 + minutes * 60 + seconds + parseFloat(ms || 0) / 1000
  }

  static secondsToTime(seconds) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`
  }
}

// VTT 字幕解析器
export class VTTParser {
  static parse(content) {
    const lines = content.split('\n')
    const subtitles = []
    let currentSubtitle = null
    let inCueBlock = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      if (line.startsWith('WEBVTT')) {
        continue
      }

      if (line === '') {
        if (currentSubtitle) {
          subtitles.push(currentSubtitle)
          currentSubtitle = null
        }
        inCueBlock = false
        continue
      }

      const timeMatch = line.match(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/)
      if (timeMatch) {
        inCueBlock = true
        currentSubtitle = {
          startTime: timeMatch[1].replace('.', ','),
          endTime: timeMatch[2].replace('.', ','),
          text: ''
        }
      } else if (inCueBlock && currentSubtitle) {
        currentSubtitle.text += (currentSubtitle.text ? '\n' : '') + line
      }
    }

    if (currentSubtitle) {
      subtitles.push(currentSubtitle)
    }

    return subtitles
  }

  static format(subtitles) {
    let output = 'WEBVTT\n\n'
    subtitles.forEach(sub => {
      output += `${sub.startTime.replace(',', '.')} --> ${sub.endTime.replace(',', '.')}\n${sub.text}\n\n`
    })
    return output
  }
}

// 自动检测格式并解析
export function parseSubtitle(content) {
  if (content.trim().startsWith('WEBVTT')) {
    return VTTParser.parse(content)
  }
  return SRTParser.parse(content)
}

// 导出为指定格式
export function exportSubtitle(subtitles, format = 'srt') {
  if (format === 'vtt') {
    return VTTParser.format(subtitles)
  }
  return SRTParser.format(subtitles)
}
