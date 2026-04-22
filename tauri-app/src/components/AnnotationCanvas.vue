<template>
  <canvas
    v-if="enabled"
    ref="canvasRef"
    class="annotation-canvas"
    @mousedown="startDrawing"
    @mousemove="draw"
    @mouseup="stopDrawing"
    @mouseleave="stopDrawing"
    @touchstart.prevent="handleTouchStart"
    @touchmove.prevent="handleTouchMove"
    @touchend="stopDrawing"
  ></canvas>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';

const props = defineProps({
  enabled: {
    type: Boolean,
    default: false
  },
  color: {
    type: String,
    default: '#FF0000'
  },
  brushSize: {
    type: Number,
    default: 5
  },
  brushType: {
    type: String,
    default: 'pen'
  }
});

const emit = defineEmits(['annotation-start', 'annotation-end']);

const canvasRef = ref(null);
const isDrawing = ref(false);
const lastX = ref(0);
const lastY = ref(0);
let ctx = null;

const initCanvas = () => {
  if (!canvasRef.value) return;
  
  const canvas = canvasRef.value;
  const parent = canvas.parentElement;
  
  if (parent) {
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
  }
  
  ctx = canvas.getContext('2d');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
};

const getPosition = (event) => {
  const canvas = canvasRef.value;
  const rect = canvas.getBoundingClientRect();
  
  if (event.touches) {
    return {
      x: event.touches[0].clientX - rect.left,
      y: event.touches[0].clientY - rect.top
    };
  }
  
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
};

const startDrawing = (event) => {
  if (!props.enabled) return;
  
  isDrawing.value = true;
  const pos = getPosition(event);
  lastX.value = pos.x;
  lastY.value = pos.y;
  
  ctx.beginPath();
  ctx.moveTo(lastX.value, lastY.value);
  
  emit('annotation-start');
};

const draw = (event) => {
  if (!isDrawing.value || !props.enabled) return;
  
  const pos = getPosition(event);
  
  ctx.strokeStyle = props.color;
  ctx.lineWidth = props.brushSize;
  
  if (props.brushType === 'eraser') {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = props.brushSize * 3;
  }
  
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
  
  lastX.value = pos.x;
  lastY.value = pos.y;
};

const stopDrawing = () => {
  if (isDrawing.value) {
    isDrawing.value = false;
    emit('annotation-end');
  }
};

const handleTouchStart = (event) => {
  startDrawing(event);
};

const handleTouchMove = (event) => {
  draw(event);
};

const clearCanvas = () => {
  if (!ctx || !canvasRef.value) return;
  ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
};

const redrawCanvas = () => {
  initCanvas();
};

onMounted(() => {
  nextTick(() => {
    initCanvas();
  });
  
  window.addEventListener('resize', initCanvas);
});

onUnmounted(() => {
  window.removeEventListener('resize', initCanvas);
});

watch(() => props.enabled, (newVal) => {
  if (newVal) {
    nextTick(() => {
      initCanvas();
    });
  }
});

defineExpose({
  clearCanvas,
  redrawCanvas
});
</script>

<style scoped lang="scss">
.annotation-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  cursor: crosshair;
  z-index: 100;
  touch-action: none;
}
</style>
