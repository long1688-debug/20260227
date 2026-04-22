/**
 * TeacherWindow.vue Composables 自动集成脚本
 * 
 * 使用方法:
 * node utils/integrate-composables.js
 */

const fs = require('fs')
const path = require('path')

const teacherWindowPath = path.join(__dirname, '../tauri-app/src/components/TeacherWindow.vue')

console.log('🚀 开始集成 Composables 到 TeacherWindow.vue...')

// 读取文件内容
let content = fs.readFileSync(teacherWindowPath, 'utf-8')

// ============================================
// 步骤 1: 添加 Composables 初始化代码
// ============================================
console.log('\n📝 步骤 1: 添加 Composables 初始化代码...')

const composablesInitCode = `
// ============================================
// 🆕 业务逻辑 Composables 初始化
// ============================================

// 字幕管理 Composable
const {
  showSubtitleEditDialog,
  editingSubtitle,
  editSubtitle,
  saveEditedSubtitle,
  deleteSubtitle,
  handleImportSubtitles
} = useSubtitleManager({
  subtitleStore,
  showSubtitleEditDialog: ref(false),
  editingSubtitle: ref(null)
})

// 布局管理 Composable
const {
  currentLayout,
  pipPosition,
  customGridCount,
  handleLayoutChange,
  setPipPosition,
  handleCustomCountChange
} = useLayoutManager({
  currentLayout: ref(1),
  pipPosition: ref('top-right'),
  customGridCount: ref(4)
})

// 信号源管理 Composable
const {
  showAddSourceDialog: showAddSourceDialogFromComposable,
  captureDevices: captureDevicesList,
  scannerDevices: scannerDevicesList,
  openAddSourceDialog,
  closeAddSourceDialog,
  addSource,
  deleteSource,
  renameSource,
  refreshDevices
} = useSourceManager({
  sourceStore,
  showAddSourceDialog: ref(false),
  captureDevices: ref([]),
  scannerDevices: ref([])
})

// 音频管理 Composable（暂时不依赖 store）
const {
  microphoneDevices,
  selectedMicrophoneId,
  audioChannels,
  refreshMicrophones,
  selectMicrophone,
  toggleMicrophoneMute,
  adjustChannelVolume,
  toggleChannelMute
} = useAudioManager({
  microphoneDevices: ref([]),
  selectedMicrophoneId: ref(''),
  audioChannels: ref([])
})

// 直播管理 Composable（暂时不依赖 store）
const {
  showRtmpDialog: showRtmpDialogFromComposable,
  rtmpConfig,
  liveStreamState,
  openRtmpDialog,
  closeRtmpDialog,
  startLiveStream,
  stopLiveStream,
  updateRtmpConfig,
  saveRtmpConfig
} = useLiveStream({
  showRtmpDialog: ref(false),
  rtmpConfig: ref({
    url: '',
    streamKey: '',
    bitrate: 2500,
    resolution: '1920x1080',
    fps: 30
  }),
  liveStreamState: ref({
    isStreaming: false,
    startTime: undefined,
    duration: 0,
    viewers: 0,
    bitrate: 0
  })
})
`

// 在 videoSourceManager 后插入
content = content.replace(
  /const videoSourceManager = useVideoSourceManager\(\)\n/,
  `const videoSourceManager = useVideoSourceManager()\n${composablesInitCode}`
)

console.log('✅ Composables 初始化代码已添加')

// ============================================
// 步骤 2: 删除重复的状态定义
// ============================================
console.log('\n📝 步骤 2: 删除重复的状态定义...')

// 删除 showSubtitleEditDialog 定义
content = content.replace(
  /const showSubtitleEditDialog = ref\(false\)\n/g,
  ''
)
console.log('  - 删除 showSubtitleEditDialog 定义')

// 删除 customGridCount 定义
content = content.replace(
  /const customGridCount = ref\(4\) \/\/ 默认4个格子\n/g,
  ''
)
console.log('  - 删除 customGridCount 定义')

// 删除 handleCustomCountChange 函数
content = content.replace(
  /const handleCustomCountChange = \(value\) => \{[\s\S]*?ElMessage\.success\(`自定义格子数量已设置为 \$\{value\}`\)\n\}\n/g,
  ''
)
console.log('  - 删除 handleCustomCountChange 函数')

// ============================================
// 步骤 3: 删除重复的函数定义
// ============================================
console.log('\n📝 步骤 3: 删除重复的函数定义...')

// 删除 editSubtitle 函数
content = content.replace(
  /const editSubtitle = \(videoIndex, subtitleIndex\) => \{[\s\S]*?\n\}\n/g,
  '// editSubtitle 已由 useSubtitleManager 提供\n'
)
console.log('  - 删除 editSubtitle 函数')

// 删除 saveEditedSubtitle 函数
content = content.replace(
  /const saveEditedSubtitle = \(\) => \{[\s\S]*?\n\}\n/g,
  '// saveEditedSubtitle 已由 useSubtitleManager 提供\n'
)
console.log('  - 删除 saveEditedSubtitle 函数')

// 删除 deleteSubtitle 函数
content = content.replace(
  /const deleteSubtitle = \(videoIndex, subtitleIndex\) => \{[\s\S]*?\n\}\n/g,
  '// deleteSubtitle 已由 useSubtitleManager 提供\n'
)
console.log('  - 删除 deleteSubtitle 函数')

// 删除 handlePipToggle 函数
content = content.replace(
  /const handlePipToggle = \(position\) => \{[\s\S]*?\n\}\n/g,
  '// handlePipToggle 已废弃（画中画改为固定模式）\n'
)
console.log('  - 删除 handlePipToggle 函数')

// 删除 handleLayoutChange 函数
content = content.replace(
  /const handleLayoutChange = async \(newLayout, pipPosition = ''\) => \{[\s\S]*?\n\}\n/g,
  '// handleLayoutChange 已由 useLayoutManager 提供\n'
)
console.log('  - 删除 handleLayoutChange 函数')

// ============================================
// 步骤 4: 处理命名冲突
// ============================================
console.log('\n📝 步骤 4: 处理命名冲突...')

// 删除 showAddSourceDialog 定义
content = content.replace(
  /const showAddSourceDialog = ref\(false\)\n/g,
  '// showAddSourceDialog 已由 useSourceManager 提供（使用 showAddSourceDialogFromComposable）\n'
)
console.log('  - 删除 showAddSourceDialog 定义')

// 删除 showRtmpDialog 定义
content = content.replace(
  /const showRtmpDialog = ref\(false\)\n/g,
  '// showRtmpDialog 已由 useLiveStream 提供（使用 showRtmpDialogFromComposable）\n'
)
console.log('  - 删除 showRtmpDialog 定义')

// ============================================
// 保存文件
// ============================================
console.log('\n💾 保存修改后的文件...')
fs.writeFileSync(teacherWindowPath, content, 'utf-8')

console.log('\n✅ Composables 集成完成！')
console.log('\n📊 统计信息:')
console.log('  - 添加了 5 个 Composables 初始化代码')
console.log('  - 删除了 3 个重复状态定义')
console.log('  - 删除了 5 个重复函数定义')
console.log('  - 处理了 2 处命名冲突')
console.log('\n⚠️  下一步:')
console.log('  1. 运行 npm run dev 验证编译')
console.log('  2. 更新模板中的绑定（LayoutManagementPanel、SourceManagementShortcut）')
console.log('  3. 测试字幕编辑、布局切换、画中画功能')
