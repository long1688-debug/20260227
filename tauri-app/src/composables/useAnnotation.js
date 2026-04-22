import { computed } from 'vue'
import { useAnnotationStore } from '@/stores/annotationStore'

export function useAnnotation() {
  const annotationStore = useAnnotationStore()

  const isEnabled = computed(() => annotationStore.enabled)
  const currentTool = computed(() => annotationStore.tool)
  const brushColor = computed(() => annotationStore.color)
  const brushSize = computed(() => annotationStore.size)
  const strokeCount = computed(() => annotationStore.strokeCount)

  const enable = () => {
    annotationStore.setEnabled(true)
  }

  const disable = () => {
    annotationStore.setEnabled(false)
    annotationStore.clear()
  }

  const toggle = () => {
    if (isEnabled.value) {
      disable()
    } else {
      enable()
    }
  }

  const setTool = (tool) => {
    annotationStore.setTool(tool)
  }

  const setColor = (color) => {
    annotationStore.setColor(color)
  }

  const setSize = (size) => {
    annotationStore.setSize(size)
  }

  const startStroke = (point) => {
    annotationStore.startStroke(point, brushColor.value, brushSize.value)
  }

  const continueStroke = (point) => {
    annotationStore.continueStroke(point)
  }

  const eraseAt = (point, size) => {
    annotationStore.eraseAt(point, size)
  }

  const clear = () => {
    annotationStore.clear()
  }

  const save = () => {
    annotationStore.saveToDisk()
  }

  const load = () => {
    annotationStore.loadFromDisk()
  }

  return {
    isEnabled,
    currentTool,
    brushColor,
    brushSize,
    strokeCount,
    enable,
    disable,
    toggle,
    setTool,
    setColor,
    setSize,
    startStroke,
    continueStroke,
    eraseAt,
    clear,
    save,
    load
  }
}
