<template>
  <div class="mindmap-container">
    <div class="toolbar">
      <button @click="newMap" class="btn">新建</button>
      <button @click="saveMap" class="btn">保存</button>
      <button @click="loadMap" class="btn">加载</button>
      <button @click="exportMap" class="btn">导出</button>
      <input
        ref="fileInput"
        type="file"
        accept=".json"
        @change="handleFileSelect"
        style="display: none"
      />
    </div>
    <div ref="mindmap" class="mindmap-canvas"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import MindElixir from 'mind-elixir'
import 'mind-elixir/style'


const mindmap = ref(null)
const fileInput = ref(null)
let mindElixirInstance = null

const defaultData = {
  nodeData: {
    id: 'root',
    topic: '中心主题',
    root: true,
    children: [
      {
        id: 'sub1',
        topic: '分支1',
        direction: 0,
        children: []
      },
      {
        id: 'sub2',
        topic: '分支2',
        direction: 1,
        children: []
      }
    ]
  }
}

onMounted(() => {
  if (mindmap.value) {
    mindElixirInstance = new MindElixir({
      el: mindmap.value,
      data: defaultData,
      direction: MindElixir.LEFT,
      draggable: true,
      contextMenu: true,
      toolBar: true,
      nodeMenu: true,
      keypress: true,
      locale: 'zh_CN',
      overflowHidden: false,
      primaryLinkStyle: 2,
      primaryNodeHorizontalGap: 15,
      primaryNodeVerticalGap: 15
    })
    mindElixirInstance.init()
  }
})

onUnmounted(() => {
  if (mindElixirInstance) {
    mindElixirInstance = null
  }
})

const newMap = () => {
  if (mindElixirInstance) {
    mindElixirInstance.refresh(defaultData)
  }
}

const saveMap = async () => {
  try {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')

    const filePath = await save({
      filters: [{
        name: 'JSON',
        extensions: ['json']
      }]
    })

    if (filePath) {
      const data = mindElixirInstance.getAllData()
      await writeTextFile(filePath, JSON.stringify(data, null, 2))
      alert('思维导图已保存！')
    }
  } catch (error) {
    console.error('保存失败:', error)
    alert('保存失败: ' + error.message)
  }
}

const loadMap = () => {
  fileInput.value.click()
}

const handleFileSelect = async (event) => {
  const file = event.target.files[0]
  if (file) {
    try {
      const { readTextFile } = await import('@tauri-apps/plugin-fs')
      const content = await readTextFile(file.path)
      const data = JSON.parse(content)
      if (mindElixirInstance) {
        mindElixirInstance.refresh(data)
      }
    } catch (error) {
      console.error('加载失败:', error)
      alert('加载失败: ' + error.message)
    }
  }
  // 重置input
  event.target.value = ''
}

const exportMap = async () => {
  try {
    const data = mindElixirInstance.getAllData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mindmap.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('导出失败:', error)
    alert('导出失败: ' + error.message)
  }
}
</script>

<style scoped>
.mindmap-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.toolbar {
  padding: 10px;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
  display: flex;
  gap: 10px;
}

.btn {
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn:hover {
  background: #0056b3;
}

.mindmap-canvas {
  flex: 1;
  overflow: hidden;
}
</style>
