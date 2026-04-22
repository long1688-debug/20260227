<template>
  <el-dialog
    v-model="visible"
    title="导入字幕"
    width="700px"
    @close="handleClose"
  >
    <div class="subtitle-import-dialog">
      <el-alert
        title="支持导入 SRT、JSON、TXT 格式的字幕文件"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 20px"
      />
      
      <el-upload
        class="subtitle-upload"
        drag
        :auto-upload="false"
        :on-change="handleFileChange"
        accept=".srt,.json,.txt"
        :limit="1"
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">
          将字幕文件拖到此处，或<em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            支持 .srt, .json, .txt 格式
          </div>
        </template>
      </el-upload>

      <!-- 导入预览 -->
      <div v-if="importedSubtitles.length > 0" class="import-options">
        <h4>导入预览 ({{ importedSubtitles.length }} 条字幕)</h4>
        <el-table 
          :data="previewData" 
          style="width: 100%" 
          max-height="300"
          border
        >
          <el-table-column prop="index" label="序号" width="70" />
          <el-table-column label="时间" width="240">
            <template #default="scope">
              {{ scope.row.startTime }} → {{ scope.row.endTime }}
            </template>
          </el-table-column>
          <el-table-column prop="text" label="字幕内容" show-overflow-tooltip />
        </el-table>
        
        <el-button 
          type="primary" 
          @click="handleConfirmImport" 
          style="margin-top: 20px;"
          :loading="isImporting"
        >
          确认导入 {{ importedSubtitles.length }} 条字幕
        </el-button>
      </div>
    </div>
    
    <template #footer>
      <el-button @click="handleCancel">取消</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { UploadFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface SubtitleItem {
  index?: number
  startTime: string
  endTime: string
  text: string
}

interface Props {
  modelValue: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false
})

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'import-subtitles', subtitles: SubtitleItem[]): void
}

const emit = defineEmits<Emits>()

// 导入的字幕列表
const importedSubtitles = ref<SubtitleItem[]>([])
const isImporting = ref(false)

/**
 * 计算属性：对话框可见性
 */
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

/**
 * 计算属性：预览数据（最多显示10条）
 */
const previewData = computed(() => {
  return importedSubtitles.value.slice(0, 10).map((item, index) => ({
    ...item,
    index: index + 1
  }))
})

/**
 * 处理文件选择
 */
const handleFileChange = async (file: any) => {
  const rawFile = file.raw
  if (!rawFile) return

  try {
    const content = await readFileContent(rawFile)
    const subtitles = parseSubtitleContent(content, rawFile.name)
    
    if (subtitles.length === 0) {
      ElMessage.warning('未解析到有效的字幕内容')
      return
    }

    importedSubtitles.value = subtitles
    ElMessage.success(`成功解析 ${subtitles.length} 条字幕`)
  } catch (error) {
    console.error('文件读取失败:', error)
    ElMessage.error('文件读取失败，请重试')
  }
}

/**
 * 读取文件内容
 */
const readFileContent = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = reject
    reader.readAsText(file, 'UTF-8')
  })
}

/**
 * 解析字幕内容
 */
const parseSubtitleContent = (content: string, filename: string): SubtitleItem[] => {
  const ext = filename.split('.').pop()?.toLowerCase()
  
  switch (ext) {
    case 'srt':
      return parseSRT(content)
    case 'json':
      return parseJSON(content)
    case 'txt':
      return parseTXT(content)
    default:
      ElMessage.warning('不支持的文件格式')
      return []
  }
}

/**
 * 解析 SRT 格式
 */
const parseSRT = (content: string): SubtitleItem[] => {
  const subtitles: SubtitleItem[] = []
  const blocks = content.trim().split(/\n\s*\n/)
  
  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 3) continue
    
    // 提取时间轴和文本
    const timeLine = lines.find(line => line.includes('-->'))
    if (!timeLine) continue
    
    const [startTime, endTime] = timeLine.split('-->').map(t => t.trim())
    const text = lines.slice(lines.indexOf(timeLine) + 1).join('\n').trim()
    
    if (startTime && endTime && text) {
      subtitles.push({ startTime, endTime, text })
    }
  }
  
  return subtitles
}

/**
 * 解析 JSON 格式
 */
const parseJSON = (content: string): SubtitleItem[] => {
  try {
    const data = JSON.parse(content)
    if (Array.isArray(data)) {
      return data.filter(item => item.startTime && item.endTime && item.text)
    }
    return []
  } catch (error) {
    console.error('JSON 解析失败:', error)
    ElMessage.error('JSON 格式错误')
    return []
  }
}

/**
 * 解析 TXT 格式（简单按行分割）
 */
const parseTXT = (content: string): SubtitleItem[] => {
  const lines = content.trim().split('\n').filter(line => line.trim())
  const subtitles: SubtitleItem[] = []
  
  // 假设每两行为一组：时间轴 + 文本
  for (let i = 0; i < lines.length - 1; i += 2) {
    const timeLine = lines[i]
    const text = lines[i + 1]
    
    if (timeLine.includes('-->')) {
      const [startTime, endTime] = timeLine.split('-->').map(t => t.trim())
      if (startTime && endTime && text) {
        subtitles.push({ startTime, endTime, text })
      }
    }
  }
  
  return subtitles
}

/**
 * 确认导入
 */
const handleConfirmImport = () => {
  if (importedSubtitles.value.length === 0) {
    ElMessage.warning('没有可导入的字幕')
    return
  }

  isImporting.value = true
  
  try {
    emit('import-subtitles', [...importedSubtitles.value])
    ElMessage.success(`成功导入 ${importedSubtitles.value.length} 条字幕`)
    handleClose()
  } catch (error) {
    console.error('导入失败:', error)
    ElMessage.error('导入失败，请重试')
  } finally {
    isImporting.value = false
  }
}

/**
 * 取消
 */
const handleCancel = () => {
  handleClose()
}

/**
 * 关闭对话框并重置
 */
const handleClose = () => {
  emit('update:modelValue', false)
  importedSubtitles.value = []
}
</script>

<style scoped lang="scss">
.subtitle-import-dialog {
  .subtitle-upload {
    margin-bottom: 20px;
  }

  .import-options {
    h4 {
      margin: 16px 0 12px;
      font-size: 14px;
      color: #303133;
    }
  }
}
</style>
