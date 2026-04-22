    }

    if (currentSubtitle.startTime === '') {
      const timeMatch = line.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/)
      if (timeMatch) {
        currentSubtitle.startTime = timeMatch[1]
        currentSubtitle.endTime = timeMatch[2]
      }
      lineIndex++
      continue
    }

    if (!currentSubtitle.text) {
      currentSubtitle.text = line
    } else {
      currentSubtitle.text += '\n' + line
    }

    lineIndex++
  }

  if (currentSubtitle && currentSubtitle.text) {
    subtitles.push(currentSubtitle)
  }

  return subtitles
}