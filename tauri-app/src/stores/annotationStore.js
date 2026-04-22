import { defineStore } from 'pinia'

export const useAnnotationStore = defineStore('annotation', {
  state: () => ({
    enabled: false,
    tool: 'pen', // pen, highlighter, arrow, rectangle, ellipse, line, dashedLine, eraser
    color: '#FF0000',
    size: 3,
    strokes: [], // 存储所有绘制的图形
    currentStroke: null, // 当前正在绘制的图形
    startPoint: null // 绘制形状的起始点（用于矩形、椭圆、直线等）
  }),

  getters: {
    strokeCount: (state) => state.strokes.length
  },

  actions: {
    setEnabled(value) {
      this.enabled = value
    },

    setTool(tool) {
      this.tool = tool
      this.startPoint = null
      this.currentStroke = null
    },

    setColor(color) {
      this.color = color
    },

    setSize(size) {
      this.size = size
    },

    // 开始绘制
    startStroke(point, color, size, tool) {
      const currentTool = tool || this.tool
      
      // 对于形状工具，保存起始点
      if (['rectangle', 'ellipse', 'line', 'dashedLine', 'arrow'].includes(currentTool)) {
        this.startPoint = { x: point.x, y: point.y }
        this.currentStroke = {
          id: Date.now(),
          type: currentTool,
          color: color || this.color,
          size: size || this.size,
          startPoint: { x: point.x, y: point.y },
          endPoint: { x: point.x, y: point.y },
          points: [point]
        }
      } else {
        // 对于画笔和荧光笔，直接添加到strokes
        const stroke = {
          id: Date.now(),
          type: currentTool,
          color: color || this.color,
          size: size || this.size,
          points: [point]
        }
        this.strokes.push(stroke)
        this.currentStroke = stroke
      }
    },

    // 继续绘制（移动鼠标）
    continueStroke(point) {
      if (!this.currentStroke) return

      const currentTool = this.currentStroke.type

      // 对于形状工具，只更新终点
      if (['rectangle', 'ellipse', 'line', 'dashedLine', 'arrow'].includes(currentTool)) {
        this.currentStroke.endPoint = { x: point.x, y: point.y }
      } else {
        // 对于画笔和荧光笔，添加点到路径
        this.currentStroke.points.push(point)
      }
    },

    // 完成绘制（释放鼠标）
    finishStroke() {
      if (this.currentStroke) {
        // 如果currentStroke不在strokes中，则添加
        if (!this.strokes.find(s => s.id === this.currentStroke.id)) {
          this.strokes.push(this.currentStroke)
        }
        this.currentStroke = null
        this.startPoint = null
      }
    },

    // 橡皮擦
    eraseAt(point, size) {
      const eraseRadius = size * 2
      this.strokes = this.strokes.map(stroke => {
        if (stroke.type === 'pen' || stroke.type === 'highlighter') {
          // 对于自由绘制，过滤掉距离内的点
          stroke.points = stroke.points.filter(p => {
            const distance = Math.sqrt(
              Math.pow(p.x - point.x, 2) + Math.pow(p.y - point.y, 2)
            )
            return distance > eraseRadius
          })
          return stroke.points.length > 0 ? stroke : null
        } else {
          // 对于形状，检查起点或终点是否在擦除范围内
          const startDist = stroke.startPoint ? Math.sqrt(
            Math.pow(stroke.startPoint.x - point.x, 2) + Math.pow(stroke.startPoint.y - point.y, 2)
          ) : Infinity
          
          const endDist = stroke.endPoint ? Math.sqrt(
            Math.pow(stroke.endPoint.x - point.x, 2) + Math.pow(stroke.endPoint.y - point.y, 2)
          ) : Infinity
          
          // 如果起点或终点在擦除范围内，删除整个形状
          if (startDist < eraseRadius || endDist < eraseRadius) {
            return null
          }
          return stroke
        }
      }).filter(stroke => stroke !== null && (stroke.points?.length > 0 || stroke.type !== 'pen' && stroke.type !== 'highlighter'))
    },

    // 清空所有批注
    clear() {
      this.strokes = []
      this.currentStroke = null
      this.startPoint = null
    },

    // 撤销最后一个操作
    undo() {
      if (this.strokes.length > 0) {
        this.strokes.pop()
      }
    },

    // 保存到本地存储
    saveToDisk() {
      const data = JSON.stringify(this.strokes, null, 2)
      localStorage.setItem('annotations', data)
    },

    // 从本地存储加载
    loadFromDisk() {
      const data = localStorage.getItem('annotations')
      if (data) {
        this.strokes = JSON.parse(data)
      }
    },

    // 获取所有批注（用于布局切换时保存）
    getAnnotations() {
      return JSON.parse(JSON.stringify(this.strokes))
    },

    // 设置批注（用于布局切换时恢复）
    setAnnotations(strokes) {
      this.strokes = strokes ? JSON.parse(JSON.stringify(strokes)) : []
      this.currentStroke = null
      this.startPoint = null
    }
  }
})
