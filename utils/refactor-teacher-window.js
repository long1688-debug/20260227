/**
 * TeacherWindow.vue 自动化重构脚本
 * 
 * 功能: 安全地将内联代码替换为独立组件
 * 使用: node utils/refactor-teacher-window.js
 */

const fs = require('fs');
const path = require('path');

const TEACHER_WINDOW_PATH = path.join(__dirname, '../tauri-app/src/components/TeacherWindow.vue');

console.log('🔧 开始重构 TeacherWindow.vue...\n');

// 读取文件
let content = fs.readFileSync(TEACHER_WINDOW_PATH, 'utf-8');
const originalLines = content.split('\n');
console.log(`📄 原始文件大小: ${originalLines.length} 行\n`);

// ==========================================
// 步骤 1: 添加组件导入
// ==========================================
console.log('📝 步骤 1: 添加新组件导入...');

const importInsertionPoint = "import TitleBar from './TitleBar.vue'";
const newImports = `
// 🆕 重构新增组件
import VideoOperationToolbar from './teacher-window/toolbar/VideoOperationToolbar.vue'
import LayoutManagementPanel from './teacher-window/panels/LayoutManagementPanel.vue'
import SubtitleEditDialog from './teacher-window/dialogs/SubtitleEditDialog.vue'
import SubtitleImportDialog from './teacher-window/dialogs/SubtitleImportDialog.vue'`;

if (content.includes('VideoOperationToolbar')) {
  console.log('✅ 组件导入已存在，跳过\n');
} else {
  content = content.replace(importInsertionPoint, importInsertionPoint + newImports);
  console.log('✅ 组件导入添加成功\n');
}

// ==========================================
// 步骤 2: 替换视频操作工具栏
// ==========================================
console.log('📝 步骤 2: 替换视频操作工具栏...');

const videoToolbarPattern = /(<TitleBar>\s*<template #toolbar>)\s*<div class="video-actions">[\s\S]*?<\/div>(\s*<\/template>\s*<\/TitleBar>)/;

const videoToolbarReplacement = `$1
        <!-- 🆕 使用独立的视频操作工具栏组件 -->
        <VideoOperationToolbar
          :is-recording="isRecording"
          :is-recording-paused="isRecordingPaused"
          :is-annotation-enabled="isAnnotationEnabled"
          :is-rtmp-streaming="rtmpStreamingState?.isStreaming || false"
          @enable-annotation="enableAnnotationForAll"
          @recording-command="handleRecordingCommand"
          @pause-recording="handlePauseAllCanvasRecording"
          @stop-recording="handleStopAllCanvasRecording"
          @show-rtmp-dialog="showRtmpDialog = true"
          @show-recording-dialog="showRecordingDialog = true"
          @show-settings-dialog="showSettingsDialog = true"
        />$2`;

if (videoToolbarPattern.test(content)) {
  content = content.replace(videoToolbarPattern, videoToolbarReplacement);
  console.log('✅ 视频操作工具栏替换成功\n');
} else {
  console.log('⚠️  未找到视频操作工具栏模式，可能已被替换\n');
}

// ==========================================
// 步骤 3: 替换布局管理面板
// ==========================================
console.log('📝 步骤 3: 替换布局管理面板...');

const layoutPanelPattern = /(<template #layout>\s*<div class="panel-header">[\s\S]*?<\/div>)\s*<div class="layout-panel">[\s\S]*?<\/div>(\s*<\/template>)/;

const layoutPanelReplacement = `$1
          <!-- 🆕 使用独立的布局管理面板组件 -->
          <LayoutManagementPanel
            :current-layout="currentLayout"
            :pip-visible="pipVisible"
            :pip-position="pipPosition"
            :custom-grid-count="customGridCount"
            @layout-change="handleLayoutChange"
            @pip-toggle="handlePipToggle"
            @custom-count-change="handleCustomCountChange"
          />$2`;

if (layoutPanelPattern.test(content)) {
  content = content.replace(layoutPanelPattern, layoutPanelReplacement);
  console.log('✅ 布局管理面板替换成功\n');
  
  // 检查是否需要添加 handlePipToggle 函数
  if (!content.includes('const handlePipToggle')) {
    console.log('📝 添加 handlePipToggle 函数...');
    const functionInsertionPoint = 'const handleLayoutChange =';
    const newFunction = `
/**
 * 处理画中画切换
 */
const handlePipToggle = (position) => {
  if (position) {
    pipPosition.value = position
    pipVisible.value = true
  } else {
    pipVisible.value = false
  }
}

${functionInsertionPoint}`;
    content = content.replace(functionInsertionPoint, newFunction);
    console.log('✅ handlePipToggle 函数添加成功\n');
  }
} else {
  console.log('⚠️  未找到布局管理面板模式，可能已被替换\n');
}

// ==========================================
// 步骤 4: 替换字幕编辑对话框
// ==========================================
console.log('📝 步骤 4: 替换字幕编辑对话框...');

const subtitleEditPattern = /<!-- 字幕编辑对话框 -->\s*<el-dialog\s*v-model="showSubtitleEditDialog"[\s\S]*?<\/el-dialog>/;

const subtitleEditReplacement = `<!-- 🆕 使用独立的字幕编辑对话框组件 -->
    <SubtitleEditDialog
      v-model="showSubtitleEditDialog"
      :subtitle="editingSubtitle"
      @save="saveEditedSubtitle"
    />`;

if (subtitleEditPattern.test(content)) {
  content = content.replace(subtitleEditPattern, subtitleEditReplacement);
  console.log('✅ 字幕编辑对话框替换成功\n');
} else {
  console.log('⚠️  未找到字幕编辑对话框模式，可能已被替换\n');
}

// ==========================================
// 步骤 5: 替换字幕导入对话框
// ==========================================
console.log('📝 步骤 5: 替换字幕导入对话框...');

const subtitleImportPattern = /<!-- 字幕导入对话框 -->\s*<el-dialog\s*v-model="showSubtitleImportDialog"[\s\S]*?<\/el-dialog>/;

const subtitleImportReplacement = `<!-- 🆕 使用独立的字幕导入对话框组件 -->
    <SubtitleImportDialog
      v-model="showSubtitleImportDialog"
      @import-subtitles="handleImportSubtitles"
    />`;

if (subtitleImportPattern.test(content)) {
  content = content.replace(subtitleImportPattern, subtitleImportReplacement);
  console.log('✅ 字幕导入对话框替换成功\n');
} else {
  console.log('⚠️  未找到字幕导入对话框模式，可能已被替换\n');
}

// ==========================================
// 保存文件
// ==========================================
console.log('💾 保存重构后的文件...');

fs.writeFileSync(TEACHER_WINDOW_PATH, content, 'utf-8');

const newLines = content.split('\n');
const linesReduced = originalLines.length - newLines.length;

console.log(`\n✅ 重构完成！`);
console.log(`📊 统计信息:`);
console.log(`   - 原始行数: ${originalLines.length}`);
console.log(`   - 新行数: ${newLines.length}`);
console.log(`   - 减少行数: ${linesReduced} (${((linesReduced / originalLines.length) * 100).toFixed(1)}%)`);
console.log(`\n🎯 下一步:`);
console.log(`   1. 运行 npm run dev 验证编译`);
console.log(`   2. 测试所有功能是否正常`);
console.log(`   3. 删除未使用的旧代码`);
