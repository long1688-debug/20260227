<template>
  <el-dialog
    v-model="visible"
    title="字幕管理"
    width="90%"
    top="3vh"
    :close-on-click-modal="false"
    class="subtitle-dialog-wrapper"
    :z-index="2000"
    append-to-body
  >
    <div class="subtitle-manager-dialog">
      <!-- 字幕列表 -->
      <div v-if="subtitles.length > 0" class="subtitle-manager-content">
        <el-tabs v-model="activeTab">
          <el-tab-pane label="字幕列表" name="list">
            <div class="subtitle-list-container">
              <div v-for="(videoSub, index) in subtitles" :key="index" class="video-subtitle-group">
                <h4>{{ videoSub.videoName }} ({{ videoSub.subtitles?.length || 0 }} 条字幕)</h4>
                <el-table :data="videoSub.subtitles" style="width: 100%" max-height="400">
                  <el-table-column prop="index" label="序号" width="70" />
                  <el-table-column label="时间" width="240">
                    <template #default="scope">
                      {{ scope.row.startTime }} → {{ scope.row.endTime }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="text" label="字幕内容" />
                  <el-table-column label="操作" width="120">
                    <template #default="scope">
                      <el-button size="small" @click="handleEditSubtitle(index, scope.$index)">编辑</el-button>
                      <el-button size="small" type="danger" @click="handleDeleteSubtitle(index, scope.$index)">删除</el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="导出字幕" name="export">
            <div class="subtitle-export-container">
              <h4>导出格式选择</h4>
              <el-radio-group v-model="exportFormat" style="margin-bottom: 20px;">
                <el-radio value="srt">SRT 格式 (标准字幕格式)</el-radio>
                <el-radio value="json">JSON 格式 (数据结构)</el-radio>
                <el-radio value="txt">TXT 格式 (纯文本)</el-radio>
              </el-radio-group>

              <el-button type="primary" @click="handleExportSubtitles" :loading="isExporting">
                导出字幕
              </el-button>

              <div class="export-preview" v-if="exportPreview">
                <h5>预览:</h5>
                <pre>{{ exportPreview }}</pre>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="字幕统计" name="stats">
            <div class="subtitle-stats-container">
              <el-descriptions title="字幕统计信息" :column="2" border>
                <el-descriptions-item label="视频数量">{{ subtitles.length }}</el-descriptions-item>
                <el-descriptions-item label="总字幕数量">{{ totalSubtitleCount }}</el-descriptions-item>
                <el-descriptions-item label="平均每个视频字幕数">{{ avgSubtitleCount }}</el-descriptions-item>
                <el-descriptions-item label="总时长">{{ totalDuration }}</el-descriptions-item>
              </el-descriptions>
            </div>
          </el-tab-pane>

          <el-tab-pane label="导入字幕" name="import">
            <div class="subtitle-import-container">
              <h4>导入字幕文件</h4>
              <el-upload
                ref="uploadRef"
                :auto-upload="false"
                :show-file-list="true"
                :on-change="handleFileChange"
                :limit="1"
                accept=".srt,.json,.txt"
                drag
              >
                <el-icon class="el-icon--upload"><upload-filled /></el-icon>
                <div class="el-upload__text">
                  将字幕文件拖到此处，或<em>点击上传</em>
                </div>
                <template #tip>
                  <div class="el-upload__tip">
                    支持 SRT、JSON、TXT 格式的字幕文件
                  </div>
                </template>
              </el-upload>

              <div class="import-actions" v-if="importedSubtitles.length > 0">
                <h5>预览导入的字幕 ({{ importedSubtitles.length }} 条)</h5>
                <el-table :data="importedSubtitles" max-height="200" style="width: 100%">
                  <el-table-column prop="index" label="序号" width="70" />
                  <el-table-column label="时间" width="200">
                    <template #default="{ row }">
                      {{ row.startTime }} → {{ row.endTime }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="text" label="字幕内容" />
                </el-table>

                <div class="import-buttons">
                  <el-button @click="importedSubtitles = []">取消</el-button>
                  <el-button type="primary" @click="handleConfirmImport">
                    确认导入 {{ importedSubtitles.length }} 条字幕
                  </el-button>
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>

      <div v-else class="no-subtitles-message">
        <el-empty description="还没有字幕数据，请先生成或导入字幕" />
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed } from 'vue';
import { UploadFilled } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

// ==================== Props & Emits ====================

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  subtitles: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits([
  'update:modelValue',
  'edit-subtitle',
  'delete-subtitle',
  'export-subtitles',
  'import-subtitles' // 添加导入事件
]);

// ==================== State ====================

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const activeTab = ref('list');
const exportFormat = ref('srt');
const isExporting = ref(false);
const exportPreview = ref('');

// 导入相关状态
const uploadRef = ref(null);
const importedSubtitles = ref([]);

// ==================== Computed ====================

const totalSubtitleCount = computed(() => {
  return props.subtitles.reduce((sum, videoSub) => {
    return sum + (videoSub.subtitles?.length || 0);
  }, 0);
});

const avgSubtitleCount = computed(() => {
  if (props.subtitles.length === 0) return 0;
  return Math.round(totalSubtitleCount.value / props.subtitles.length);
});

const totalDuration = computed(() => {
  // 简化计算：假设每条字幕平均 3 秒
  const totalSeconds = totalSubtitleCount.value * 3;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}分${seconds}秒`;
});

// ==================== Methods ====================

function handleEditSubtitle(videoIndex, subtitleIndex) {
  emit('edit-subtitle', { videoIndex, subtitleIndex });
}

function handleDeleteSubtitle(videoIndex, subtitleIndex) {
  emit('delete-subtitle', { videoIndex, subtitleIndex });
}

async function handleExportSubtitles() {
  isExporting.value = true;
  try {
    emit('export-subtitles', { format: exportFormat.value });

    // 生成预览（模拟）
    if (exportFormat.value === 'srt') {
      exportPreview.value = generateSRTPreview();
    } else if (exportFormat.value === 'json') {
      exportPreview.value = JSON.stringify(props.subtitles, null, 2);
    } else {
      exportPreview.value = generateTXTPreview();
    }
  } catch (error) {
    console.error('[SubtitleManager] 导出失败:', error);
  } finally {
    isExporting.value = false;
  }
}

function generateSRTPreview() {
  if (props.subtitles.length === 0) return '';

  let srt = '';
  let counter = 1;

  props.subtitles.forEach(videoSub => {
    videoSub.subtitles?.forEach(sub => {
      srt += `${counter}\n`;
      srt += `${sub.startTime} --> ${sub.endTime}\n`;
      srt += `${sub.text}\n\n`;
      counter++;
    });
  });

  return srt.substring(0, 500) + '...'; // 只显示前500字符
}

function generateTXTPreview() {
  if (props.subtitles.length === 0) return '';

  let txt = '';
  props.subtitles.forEach(videoSub => {
    txt += `【${videoSub.videoName}】\n`;
    videoSub.subtitles?.forEach(sub => {
      txt += `[${sub.startTime}] ${sub.text}\n`;
    });
    txt += '\n';
  });

  return txt.substring(0, 500) + '...';
}

// ==================== 导入字幕相关方法 ====================

function handleFileChange(file) {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.srt')) {
    parseSRTFile(file.raw);
  } else if (fileName.endsWith('.json')) {
    parseJSONFile(file.raw);
  } else if (fileName.endsWith('.txt')) {
    parseTXTFile(file.raw);
  } else {
    ElMessage.error('不支持的字幕格式');
  }
}

async function parseSRTFile(file) {
  try {
    const text = await readFile(file);
    const subtitles = [];

    // 简化的 SRT 解析
    const blocks = text.split(/\n\n+/);
    blocks.forEach(block => {
      const lines = block.split('\n');
      if (lines.length >= 3) {
        const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
        if (timeMatch) {
          subtitles.push({
            index: parseInt(lines[0]),
            startTime: timeMatch[1],
            endTime: timeMatch[2],
            text: lines.slice(2).join('\n')
          });
        }
      }
    });

    importedSubtitles.value = subtitles;
    ElMessage.success(`成功解析 ${subtitles.length} 条字幕`);
  } catch (error) {
    console.error('[SubtitleManager] 解析 SRT 失败:', error);
    ElMessage.error('解析 SRT 文件失败');
  }
}

async function parseJSONFile(file) {
  try {
    const text = await readFile(file);
    const subtitles = JSON.parse(text);

    if (Array.isArray(subtitles)) {
      importedSubtitles.value = subtitles.map((sub, idx) => ({
        ...sub,
        index: idx + 1
      }));
      ElMessage.success(`成功导入 ${subtitles.length} 条字幕`);
    } else {
      ElMessage.error('JSON 格式不正确');
    }
  } catch (error) {
    console.error('[SubtitleManager] 解析 JSON 失败:', error);
    ElMessage.error('解析 JSON 文件失败');
  }
}

async function parseTXTFile(file) {
  try {
    const text = await readFile(file);
    const subtitles = [];

    // 简化的 TXT 解析（每行一条字幕）
    const lines = text.split('\n').filter(line => line.trim());
    lines.forEach((line, idx) => {
      if (line) {
        subtitles.push({
          index: idx + 1,
          startTime: `00:00:${String(idx * 3).padStart(2, '0')},000`,
          endTime: `00:00:${String((idx + 1) * 3).padStart(2, '0')},000`,
          text: line
        });
      }
    });

    importedSubtitles.value = subtitles;
    ElMessage.success(`成功解析 ${subtitles.length} 条字幕`);
  } catch (error) {
    console.error('[SubtitleManager] 解析 TXT 失败:', error);
    ElMessage.error('解析 TXT 文件失败');
  }
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file, 'UTF-8');
  });
}

function handleConfirmImport() {
  if (importedSubtitles.value.length === 0) return;

  emit('import-subtitles', {
    videoName: '导入的字幕',
    subtitles: importedSubtitles.value
  });

  ElMessage.success(`已导入 ${importedSubtitles.value.length} 条字幕`);
  importedSubtitles.value = [];
  activeTab.value = 'list';
}
</script>

<style scoped lang="scss">
@import '@/styles/variables.scss';

// 🎯 滚动条样式 mixin
@mixin custom-scrollbar {
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 3px;

    &:hover {
      background: #555;
    }
  }
}

// 🎯 弹窗包装类样式
.subtitle-dialog-wrapper {
  :deep(.el-dialog__body) {
    max-height: calc(100vh - 150px);
    overflow-y: auto;
    padding: 0;
    @include custom-scrollbar;
  }
}

.subtitle-manager-dialog {
  padding: 20px;
}

.subtitle-manager-content {
  min-height: 400px;
}

.subtitle-list-container {
  .video-subtitle-group {
    margin-bottom: 24px;

    h4 {
      margin: 0 0 12px 0;
      font-size: $font-size-lg;
      color: $text-primary;
      padding-bottom: 8px;
      border-bottom: 2px solid $border-color-light;
    }
  }
}

.subtitle-export-container {
  h4 {
    margin: 0 0 16px 0;
    font-size: $font-size-base;
  }

  .export-preview {
    margin-top: 20px;
    padding: 16px;
    background: $bg-color-page;
    border-radius: $border-radius-base;

    h5 {
      margin: 0 0 8px 0;
      font-size: $font-size-sm;
      color: $text-secondary;
    }

    pre {
      margin: 0;
      padding: 12px;
      background: white;
      border: 1px solid $border-color-base;
      border-radius: $border-radius-sm;
      font-size: $font-size-xs;
      max-height: 300px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
  }
}

.subtitle-stats-container {
  padding: 20px;
}

.no-subtitles-message {
  padding: 60px 0;
  text-align: center;
}

.subtitle-import-container {
  padding: 20px;

  h4 {
    margin: 0 0 16px 0;
    font-size: $font-size-base;
  }

  .import-actions {
    margin-top: 20px;

    h5 {
      margin: 0 0 12px 0;
      font-size: $font-size-sm;
    }

    .import-buttons {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 16px;
    }
  }
}
</style>
