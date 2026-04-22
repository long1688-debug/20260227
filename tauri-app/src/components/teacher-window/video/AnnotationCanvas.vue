<template>
  <div v-show="annotationEnabled" class="annotation-wrapper" @dblclick="handleWrapperDblClick">
    <!-- 工具栏 -->
    <div class="annotation-toolbar">
      <!-- 工具按钮区域 -->
      <div class="tools-section">
        <!-- 绘图工具 -->
        <el-button-group class="btn-group">
          <el-button
            :class="['tool-btn', { active: currentTool === 'pen' }]"
            size="small"
            @click="setTool('pen')"
            title="自由画笔"
          >
            <span class="pen-icon">✏️</span>
          </el-button>
          <el-button
            :class="['tool-btn', { active: currentTool === 'highlighter' }]"
            size="small"
            @click="setTool('highlighter')"
            title="荧光笔"
          >
            <span class="highlighter-icon">🖍️</span>
          </el-button>
        </el-button-group>

        <!-- 形状工具 -->
        <el-button-group class="btn-group">
          <el-button
            :class="['tool-btn', { active: currentTool === 'arrow' }]"
            size="small"
            @click="setTool('arrow')"
            title="箭头"
          >
            <span class="arrow-icon">→</span>
          </el-button>
          <el-button
            :class="['tool-btn', { active: currentTool === 'rectangle' }]"
            size="small"
            @click="setTool('rectangle')"
            title="矩形"
          >
            <span class="rectangle-icon">⬜</span>
          </el-button>
          <el-button
            :class="['tool-btn', { active: currentTool === 'ellipse' }]"
            size="small"
            @click="setTool('ellipse')"
            title="椭圆"
          >
            <span class="circle-icon">○</span>
          </el-button>
          <el-button
            :class="['tool-btn', { active: currentTool === 'line' }]"
            size="small"
            @click="setTool('line')"
            title="直线"
          >
            <span class="line-icon">—</span>
          </el-button>
        </el-button-group>

        <!-- 橡皮擦 -->
        <el-button-group class="btn-group">
          <el-button
            :class="['tool-btn eraser-btn', { active: currentTool === 'eraser' }]"
            size="small"
            @click="setTool('eraser')"
            title="橡皮擦"
          >
            <span class="eraser-icon">🧹</span>
          </el-button>
        </el-button-group>
      </div>

      <!-- 分隔线 -->
      <div class="toolbar-divider"></div>

      <!-- 样式控制区域 -->
      <div class="style-section">
        <!-- 颜色选择 -->
        <div class="color-wrapper">
          <el-color-picker
            v-model="currentColor"
            size="small"
            :show-alpha="false"
            :disabled="currentTool === 'eraser'"
            title="选择颜色"
            class="color-picker"
          />
        </div>

        <!-- 笔刷大小 -->
        <div class="size-wrapper">
          <el-slider
            v-model="currentSize"
            :min="1"
            :max="15"
            :disabled="currentTool === 'eraser'"
            :show-input="false"
            class="size-slider"
          />
        </div>
      </div>

      <!-- 分隔线 -->
      <div class="toolbar-divider"></div>

      <!-- 操作按钮区域 -->
      <div class="actions-section">
        <el-button-group class="btn-group">
          <el-button
            :class="['action-btn', { disabled: !canUndo }]"
            size="small"
            :disabled="!canUndo"
            @click="undo"
            title="撤销 (Ctrl+Z)"
          >
            <span class="undo-icon">↩️</span>
          </el-button>
          <el-button
            class="action-btn danger-btn"
            size="small"
            @click="clearCanvas"
            title="清空画布"
          >
            <span class="trash-icon">🗑️</span>
          </el-button>
          <el-button
            class="action-btn save-btn"
            size="small"
            @click="saveAsImage"
            title="保存为图片"
          >
            <span class="download-icon">💾</span>
          </el-button>
        </el-button-group>

        <!-- 关闭按钮 -->
        <el-button
          class="close-btn"
          size="small"
          @click="toggleAnnotation"
          title="关闭批注"
        >
          <span class="close-icon">✕</span>
        </el-button>
      </div>
    </div>

    <!-- 画布 -->
    <canvas
      ref="canvasRef"
      class="annotation-canvas"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
      @dblclick.stop="handleDoubleClick"
      :style="{ pointerEvents: annotationEnabled ? 'auto' : 'none' }"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { useAnnotationStore } from '@/stores/annotationStore'
import { useVideoSync } from '@/composables/useVideoSync'
// 使用 emoji/unicode 字符替代 Element Plus 图标，避免版本兼容性问题

const props = defineProps({
  width: {
    type: Number,
    default: 1920
  },
  height: {
    type: Number,
    default: 1080
  }
})

const emit = defineEmits(['double-click'])

const { currentLayout } = useVideoSync()
const annotationStore = useAnnotationStore()
const layoutAnnotations = ref({})
const canvasRef = ref(null)
const ctx = ref(null)
const isDrawing = ref(false)

// 工具栏状态
const currentColor = ref('#FF0000')
const currentSize = ref(5)

const annotationEnabled = computed(() => annotationStore.enabled)
const currentTool = computed(() => annotationStore.tool)
const canUndo = computed(() => annotationStore.strokeCount > 0)

// 画布坐标转换相关
const dpr = ref(window.devicePixelRatio || 1)
const scaleX = ref(1)
const scaleY = ref(1)
const offsetX = ref(0)
const offsetY = ref(0)

const setTool = (tool) => {
  annotationStore.setTool(tool)
  const toolNames = {
    pen: '自由画笔',
    highlighter: '荧光笔',
    arrow: '箭头',
    rectangle: '矩形',
    ellipse: '椭圆',
    line: '直线',
    dashedLine: '虚线',
    eraser: '橡皮擦'
  }
  ElMessage.success(`已切换到${toolNames[tool] || tool}模式`)
}

const toggleAnnotation = () => {
  annotationStore.setEnabled(false)
  ElMessage.info('已关闭全局批注')
}

const initCanvas = () => {
  const canvas = canvasRef.value
  if (!canvas) return

  // 获取父容器的实际尺寸
  const container = canvas.parentElement
  const rect = container.getBoundingClientRect()

  // 获取设备像素比，确保 canvas 清晰度
  dpr.value = window.devicePixelRatio || 1

  // 设置 canvas 内部像素尺寸（考虑 DPR）
  canvas.width = rect.width * dpr.value
  canvas.height = rect.height * dpr.value

  // 设置 canvas 显示尺寸
  canvas.style.width = `${rect.width}px`
  canvas.style.height = `${rect.height}px`

  ctx.value = canvas.getContext('2d')
  ctx.value.lineCap = 'round'
  ctx.value.lineJoin = 'round'
  ctx.value.scale(dpr.value, dpr.value)

  redrawAnnotations()
}

const redrawAnnotations = () => {
  if (!ctx.value) return

  ctx.value.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)

  annotationStore.strokes.forEach(stroke => {
    drawStroke(ctx.value, stroke)
  })

  // 绘制当前正在绘制的图形（形状工具使用）
  if (annotationStore.currentStroke) {
    drawStroke(ctx.value, annotationStore.currentStroke)
  }
}

const drawStroke = (context, stroke) => {
  context.strokeStyle = stroke.color
  context.fillStyle = stroke.color
  context.lineWidth = stroke.size

  switch (stroke.type) {
    case 'pen':
      drawPen(context, stroke)
      break
    case 'highlighter':
      drawHighlighter(context, stroke)
      break
    case 'arrow':
      drawArrow(context, stroke)
      break
    case 'rectangle':
      drawRectangle(context, stroke)
      break
    case 'ellipse':
      drawEllipse(context, stroke)
      break
    case 'line':
      drawLine(context, stroke)
      break
    case 'dashedLine':
      drawDashedLine(context, stroke)
      break
  }
}

// 绘制自由画笔
const drawPen = (context, stroke) => {
  if (stroke.points.length < 2) return

  context.globalCompositeOperation = 'source-over'
  context.beginPath()
  context.moveTo(stroke.points[0].x, stroke.points[0].y)

  for (let i = 1; i < stroke.points.length; i++) {
    context.lineTo(stroke.points[i].x, stroke.points[i].y)
  }
  context.stroke()
}

// 绘制荧光笔（半透明）
const drawHighlighter = (context, stroke) => {
  if (stroke.points.length < 2) return

  context.globalCompositeOperation = 'source-over'
  context.strokeStyle = stroke.color + '40' // 添加25%透明度
  context.lineWidth = stroke.size * 2
  context.beginPath()
  context.moveTo(stroke.points[0].x, stroke.points[0].y)

  for (let i = 1; i < stroke.points.length; i++) {
    context.lineTo(stroke.points[i].x, stroke.points[i].y)
  }
  context.stroke()
}

// 绘制箭头
const drawArrow = (context, stroke) => {
  if (!stroke.startPoint || !stroke.endPoint) return

  context.globalCompositeOperation = 'source-over'
  const { startPoint, endPoint } = stroke

  // 绘制主线
  context.beginPath()
  context.moveTo(startPoint.x, startPoint.y)
  context.lineTo(endPoint.x, endPoint.y)
  context.stroke()

  // 绘制箭头头部
  const angle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x)
  const arrowLength = 15
  const arrowAngle = Math.PI / 6

  context.beginPath()
  context.moveTo(endPoint.x, endPoint.y)
  context.lineTo(
    endPoint.x - arrowLength * Math.cos(angle - arrowAngle),
    endPoint.y - arrowLength * Math.sin(angle - arrowAngle)
  )
  context.moveTo(endPoint.x, endPoint.y)
  context.lineTo(
    endPoint.x - arrowLength * Math.cos(angle + arrowAngle),
    endPoint.y - arrowLength * Math.sin(angle + arrowAngle)
  )
  context.stroke()
}

// 绘制矩形
const drawRectangle = (context, stroke) => {
  if (!stroke.startPoint || !stroke.endPoint) return

  context.globalCompositeOperation = 'source-over'
  const { startPoint, endPoint } = stroke

  const width = endPoint.x - startPoint.x
  const height = endPoint.y - startPoint.y

  context.beginPath()
  context.rect(startPoint.x, startPoint.y, width, height)
  context.stroke()
}

// 绘制椭圆
const drawEllipse = (context, stroke) => {
  if (!stroke.startPoint || !stroke.endPoint) return

  context.globalCompositeOperation = 'source-over'
  const { startPoint, endPoint } = stroke

  const centerX = (startPoint.x + endPoint.x) / 2
  const centerY = (startPoint.y + endPoint.y) / 2
  const radiusX = Math.abs(endPoint.x - startPoint.x) / 2
  const radiusY = Math.abs(endPoint.y - startPoint.y) / 2

  context.beginPath()
  context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI)
  context.stroke()
}

// 绘制直线
const drawLine = (context, stroke) => {
  if (!stroke.startPoint || !stroke.endPoint) return

  context.globalCompositeOperation = 'source-over'
  const { startPoint, endPoint } = stroke

  context.beginPath()
  context.moveTo(startPoint.x, startPoint.y)
  context.lineTo(endPoint.x, endPoint.y)
  context.stroke()
}

// 绘制虚线
const drawDashedLine = (context, stroke) => {
  if (!stroke.startPoint || !stroke.endPoint) return

  context.globalCompositeOperation = 'source-over'
  const { startPoint, endPoint } = stroke

  context.setLineDash([10, 5]) // 虚线模式：10像素实线，5像素空白
  context.beginPath()
  context.moveTo(startPoint.x, startPoint.y)
  context.lineTo(endPoint.x, endPoint.y)
  context.stroke()
  context.setLineDash([]) // 恢复实线
}

const handleMouseDown = (e) => {
  if (!annotationEnabled.value) return

  isDrawing.value = true
  const canvas = canvasRef.value
  const rect = canvas.getBoundingClientRect()

  // 计算相对于 canvas 左上角的坐标（不考虑 DPR，因为 ctx.scale 已处理）
  const point = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  }

  if (currentTool.value === 'eraser') {
    annotationStore.eraseAt(point, currentSize.value)
    redrawAnnotations()
  } else {
    annotationStore.startStroke(point, currentColor.value, currentSize.value, currentTool.value)
  }
}

const handleMouseMove = (e) => {
  if (!isDrawing.value || !annotationEnabled.value) return

  const canvas = canvasRef.value
  const rect = canvas.getBoundingClientRect()

  // 计算相对于 canvas 左上角的坐标
  const point = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  }

  if (currentTool.value === 'eraser') {
    annotationStore.eraseAt(point, currentSize.value)
    redrawAnnotations()
  } else {
    annotationStore.continueStroke(point)
    redrawAnnotations()
  }
}

const handleMouseUp = () => {
  if (!isDrawing.value) return

  isDrawing.value = false
  annotationStore.finishStroke()
}

// 处理双击事件
const handleDoubleClick = (e) => {
  e.stopPropagation()
  emit('double-click', e)
}

// 处理包装器双击事件
const handleWrapperDblClick = (e) => {
  e.stopPropagation()
  emit('double-click', e)
}

// 撤销功能
const undo = () => {
  annotationStore.undo()
  redrawAnnotations()
  ElMessage.success('已撤销')
}

// 清空画布
const clearCanvas = () => {
  annotationStore.clear()
  redrawAnnotations()
  ElMessage.success('画布已清空')
}

// 保存为图片
const saveAsImage = () => {
  const canvas = canvasRef.value
  if (!canvas) return

  const link = document.createElement('a')
  link.download = `annotation_${Date.now()}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()

  ElMessage.success('批注已保存为图片')
}

// 🎯 保存当前布局的批注
const layoutAnnotationsMap = ref({})  // 存储每个布局的批注

const saveCurrentLayoutAnnotation = () => {
  const layout = currentLayout.value
  if (layout) {
    layoutAnnotationsMap.value[layout] = annotationStore.getAnnotations()
    console.log(`[AnnotationCanvas] 已保存布局 ${layout} 的批注`)
  }
}

// 🎯 恢复当前布局的批注
const restoreLayoutAnnotation = () => {
  const layout = currentLayout.value
  if (layout && layoutAnnotationsMap.value[layout]) {
    annotationStore.setAnnotations(layoutAnnotationsMap.value[layout])
    redrawAnnotations()
    console.log(`[AnnotationCanvas] 已恢复布局 ${layout} 的批注`)
  }
}

// 监听布局变化，保存和恢复批注
watch(currentLayout, async (newLayout, oldLayout) => {
  if (oldLayout) {
    saveCurrentLayoutAnnotation()
  }
  await nextTick()
  restoreLayoutAnnotation()
})

// 当前组件的 props 或内部状态变化时重新初始化
watch([() => props.width, () => props.height], () => {
  initCanvas()
})

// 监听窗口resize
const handleResize = () => {
  initCanvas()
}

onMounted(async () => {
  // 获取上下文
  await nextTick()
  if (canvasRef.value) {
    ctx.value = canvasRef.value.getContext('2d')
  }

  // 初始化画布
  initCanvas()

  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)

  // 监听布局变化
  restoreLayoutAnnotation()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style lang="scss" scoped>
.annotation-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10002;
}

.annotation-toolbar {
  position: absolute;
  bottom: 15px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.9);
  padding: 3px 8px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  pointer-events: auto;
  z-index: 10003;
  backdrop-filter: blur(12px);
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.06);
  min-height: 24px;

  // 按钮组样式
  .btn-group {
    :deep(.el-button) {
      border-radius: 4px;
      margin: 0;
      padding: 2px 4px;
      transition: all 0.15s ease;
      min-width: 20px;
      height: 20px;
      line-height: 1;

      &:hover {
        background-color: rgba(255, 255, 255, 0.06);
      }
    }
  }

  // 工具区域
  .tools-section {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  // 工具按钮
  .tool-btn {
    background-color: transparent;
    color: #94A3B8;
    border-color: rgba(255, 255, 255, 0.06);

    &.active {
      background-color: #4F46E5;
      color: #fff;
      border-color: #4F46E5;
    }

    &.eraser-btn.active {
      background-color: #F59E0B;
      border-color: #F59E0B;
    }

    .dashed-icon {
      font-size: 8px;
      color: inherit;
      letter-spacing: 0.5px;
    }

    .circle-icon {
      font-size: 10px;
      color: inherit;
    }

    .pen-icon,
    .highlighter-icon,
    .eraser-icon,
    .rectangle-icon,
    .arrow-icon,
    .line-icon,
    .undo-icon,
    .trash-icon,
    .download-icon,
    .close-icon {
      font-size: 10px;
      color: inherit;
    }
  }

  // 分隔线
  .toolbar-divider {
    width: 1px;
    height: 14px;
    background-color: rgba(255, 255, 255, 0.08);
    margin: 0 2px;
  }

  // 样式控制区域
  .style-section {
    display: flex;
    align-items: center;
    gap: 4px;

    .color-wrapper {
      :deep(.el-color-picker) {
        width: 20px;
        height: 18px;
        border-radius: 4px;
        padding: 1px;
      }

      :deep(.el-color-picker__trigger) {
        width: 100%;
        height: 100%;
        border-radius: 3px;
      }
    }

    .size-wrapper {
      width: 40px;

      .size-slider {
        :deep(.el-slider__bar) {
          height: 3px;
          background-color: rgba(79, 70, 229, 0.3);
        }

        :deep(.el-slider__bar.is-active) {
          background-color: #4F46E5;
        }

        :deep(.el-slider__button) {
          width: 10px;
          height: 10px;
          border-color: #4F46E5;
        }
      }
    }
  }

  // 操作区域
  .actions-section {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  // 操作按钮
  .action-btn {
    background-color: rgba(255, 255, 255, 0.03);
    color: #94A3B8;
    border-color: rgba(255, 255, 255, 0.06);

    &.danger-btn {
      color: #EF4444;
      border-color: rgba(239, 68, 68, 0.15);

      &:hover:not(:disabled) {
        background-color: rgba(239, 68, 68, 0.1);
      }
    }

    &.save-btn {
      background-color: rgba(16, 185, 129, 0.15);
      color: #10B981;
      border-color: rgba(16, 185, 129, 0.25);

      &:hover:not(:disabled) {
        background-color: rgba(16, 185, 129, 0.25);
      }
    }

    &.disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
  }

  // 关闭按钮
  .close-btn {
    background-color: rgba(239, 68, 68, 0.08);
    color: #EF4444;
    border-color: rgba(239, 68, 68, 0.15);
    border-radius: 4px;

    &:hover {
      background-color: rgba(239, 68, 68, 0.15);
    }
  }
}

.annotation-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  cursor: crosshair;
}

// 响应式设计
@media screen and (max-width: 900px) {
  .annotation-toolbar {
    bottom: 10px;
    padding: 4px 8px;
    gap: 4px;

    .style-section {
      display: none;
    }

    .toolbar-divider:nth-child(3) {
      display: none;
    }
  }
}

@media screen and (max-width: 600px) {
  .annotation-toolbar {
    .tools-section .btn-group:nth-child(2) {
      display: none;
    }
  }
}
</style>
