#!/usr/bin/env node

/**
 * 🔍 迁移完整性全面检查脚本
 * 
 * 用途：系统性检查 useVideoSync 迁移的完整性，防止遗漏
 * 使用方法：node utils/comprehensive-migration-check.js
 */

const fs = require('fs');
const path = require('path');

// 需要检查的已删除组件路径
const removedComponents = [
  // 已被 RenderEngineWrapper 替代的组件
  'tauri-app/src/components/teacher-window/video/VideoGrid.vue',
  'tauri-app/src/components/teacher-window/video/VideoItem.vue',
  'tauri-app/src/components/VideoPreview.vue',
  
  // 已被新组件替代的组件
  'tauri-app/src/components/OldLayoutManagement.vue',
];

// 需要检查的新组件路径
const newComponents = [
  // 新的渲染引擎组件
  'tauri-app/src/components/render/RenderEngineWrapper.vue',
  'tauri-app/src/components/render/CameraPreview.vue',
  
  // 新的布局组件
  'tauri-app/src/components/teacher-window/layout/VideoSection.vue',
  'tauri-app/src/components/teacher-window/panels/LayoutManagementPanel.vue',
  
  // 新的视频组件
  'tauri-app/src/components/teacher-window/video/GlobalSubtitle.vue',
  'tauri-app/src/components/teacher-window/video/AnnotationCanvas.vue',
];

module.exports = { removedComponents, newComponents };

// 配置
const ROOT_DIR = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'tauri-app', 'src');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

let errors = [];
let warnings = [];
let passed = [];

/**
 * 检查1：扫描所有 Vue/JS 文件，查找 useVideoStore 引用
 */
function checkNoOldStoreReferences() {
  log(colors.cyan, '\n📋 检查1: 扫描废弃的 useVideoStore 引用...\n');
  
  const filesToCheck = [];
  
  function scanDir(dirPath) {
    const files = fs.readdirSync(dirPath);
    
    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        if (file === 'node_modules' || file === 'ARCHIVE') return;
        scanDir(filePath);
      } else if (file.endsWith('.vue') || file.endsWith('.js') || file.endsWith('.ts')) {
        filesToCheck.push(filePath);
      }
    });
  }
  
  scanDir(SRC_DIR);
  
  let foundIssues = false;
  
  filesToCheck.forEach(filePath => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const relativePath = path.relative(ROOT_DIR, filePath);
      
      // 检查是否导入了 useVideoStore
      if (/import.*useVideoStore/.test(content)) {
        errors.push(`❌ ${relativePath}: 发现 useVideoStore 导入`);
        foundIssues = true;
      }
      
      // 检查是否从 stores/video 导入
      if (/from\s+['"].*stores\/video['"]/.test(content)) {
        errors.push(`❌ ${relativePath}: 发现 stores/video 导入`);
        foundIssues = true;
      }
      
      // 检查是否有 videoStore. 调用（排除注释）
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith('//') && !trimmed.startsWith('*') && /videoStore\./.test(trimmed)) {
          errors.push(`❌ ${relativePath}:${index + 1}: 发现 videoStore 调用`);
          foundIssues = true;
        }
      });
      
    } catch (error) {
      // 忽略读取错误
    }
  });
  
  if (!foundIssues) {
    log(colors.green, '✅ 未发现任何 useVideoStore 引用');
    passed.push('无废弃 Store 引用');
  }
}

/**
 * 检查2：验证主要组件是否正确导入 useVideoSync
 */
function checkMainComponentsImport() {
  log(colors.cyan, '\n📋 检查2: 验证主要组件的 useVideoSync 导入...\n');
  
  const criticalComponents = [
    'components/TeacherWindow.vue',
    'components/EnhancedTeacherWindow.vue',
    'components/VideoGrid.vue',
    'components/EnhancedVideoGrid.vue',
    'composables/useRecording.js'
  ];
  
  criticalComponents.forEach(compPath => {
    const fullPath = path.join(SRC_DIR, compPath);
    
    if (!fs.existsSync(fullPath)) {
      warnings.push(`⚠️  文件不存在: ${compPath}`);
      return;
    }
    
    const content = fs.readFileSync(fullPath, 'utf-8');
    
    if (/import.*useVideoSync.*from.*['"]@\/composables\/useVideoSync['"]/.test(content)) {
      log(colors.green, `✅ ${compPath}`);
      passed.push(`${compPath} - 正确导入`);
    } else {
      errors.push(`❌ ${compPath}: 未导入 useVideoSync`);
    }
  });
}

/**
 * 检查3：检测重复声明问题
 */
function checkDuplicateDeclarations() {
  log(colors.cyan, '\n📋 检查3: 检测变量重复声明...\n');
  
  const teacherWindowPath = path.join(SRC_DIR, 'components/TeacherWindow.vue');
  
  if (!fs.existsSync(teacherWindowPath)) {
    warnings.push('⚠️  TeacherWindow.vue 不存在');
    return;
  }
  
  const content = fs.readFileSync(teacherWindowPath, 'utf-8');
  
  // 需要从 useVideoSync 解构的变量列表
  const expectedFromSync = [
    'currentLayout',
    'videoPreviews',
    'canvasSourceMap',
    'allSources',
    'pipVisible',
    'pipPosition',
    'isMaximized',
    'maximizedIndex'
  ];
  
  let foundDuplicates = false;
  
  expectedFromSync.forEach(varName => {
    // 查找是否在解构中出现
    const destructuringMatch = content.match(/const\s+\{[^}]*\b${varName}\b[^}]*\}\s*=\s*useVideoSync\(\)/s);
    
    if (destructuringMatch) {
      // 检查是否有本地声明
      const localDeclPattern = new RegExp(`const\\s+${varName}\\s*=\\s*(ref|computed|reactive)\\(`, 'g');
      const matches = content.match(localDeclPattern);
      
      if (matches && matches.length > 0) {
        errors.push(`❌ TeacherWindow.vue: ${varName} 被重复声明（已从 useVideoSync 解构）`);
        foundDuplicates = true;
      }
    }
  });
  
  if (!foundDuplicates) {
    log(colors.green, '✅ 未发现变量重复声明');
    passed.push('无重复声明');
  }
}

/**
 * 检查4：验证 useVideoSync 导出完整性
 */
function checkUseVideoSyncExports() {
  log(colors.cyan, '\n📋 检查4: 验证 useVideoSync 导出完整性...\n');
  
  const useVideoSyncPath = path.join(SRC_DIR, 'composables/useVideoSync.js');
  
  if (!fs.existsSync(useVideoSyncPath)) {
    errors.push('❌ useVideoSync.js 不存在');
    return;
  }
  
  const content = fs.readFileSync(useVideoSyncPath, 'utf-8');
  
  // 必须导出的关键功能
  const requiredExports = [
    'currentLayout',
    'setLayout',
    'videoPreviews',
    'canvasSourceMap',
    'allSources',
    'addSource',
    'removeSource',
    'setCanvasSource',
    'togglePip',
    'maximizeCanvas',
    'restoreLayout',
    'setCanvasRecordingState',
    'getCanvasRecordingState'
  ];
  
  let missingExports = [];
  
  requiredExports.forEach(exp => {
    // 检查是否在 return 语句中
    const returnPattern = new RegExp(`return\\s*\\{[\\s\\S]*?\\b${exp}\\b[\\s\\S]*?\\}`, 'm');
    
    if (!returnPattern.test(content)) {
      missingExports.push(exp);
    }
  });
  
  if (missingExports.length === 0) {
    log(colors.green, `✅ 所有关键功能均已导出 (${requiredExports.length}个)`);
    passed.push('useVideoSync 导出完整');
  } else {
    errors.push(`❌ useVideoSync 缺失导出: ${missingExports.join(', ')}`);
  }
}

/**
 * 检查5：验证 stores/index.js 已移除 useVideoStore
 */
function checkStoresIndexCleanup() {
  log(colors.cyan, '\n📋 检查5: 验证 stores/index.js 清理...\n');
  
  const storesIndexPath = path.join(SRC_DIR, 'stores/index.js');
  
  if (!fs.existsSync(storesIndexPath)) {
    warnings.push('⚠️  stores/index.js 不存在');
    return;
  }
  
  const content = fs.readFileSync(storesIndexPath, 'utf-8');
  
  if (/export.*useVideoStore.*from.*['"].*video['"]/.test(content)) {
    errors.push('❌ stores/index.js 仍在导出 useVideoStore');
  } else {
    log(colors.green, '✅ stores/index.js 已移除 useVideoStore 导出');
    passed.push('stores/index.js 清理完成');
  }
}

/**
 * 检查6：验证旧文件已归档
 */
function checkArchiveStatus() {
  log(colors.cyan, '\n📋 检查6: 验证旧文件归档状态...\n');
  
  const deprecatedFile = path.join(ROOT_DIR, 'ARCHIVE/deprecated_stores/video.js.deprecated');
  
  if (fs.existsSync(deprecatedFile)) {
    log(colors.green, '✅ 旧版 video.js 已归档');
    passed.push('旧文件已归档');
  } else {
    warnings.push('⚠️  未找到归档的 video.js.deprecated 文件');
  }
  
  // 检查原位置是否还有文件
  const originalFile = path.join(SRC_DIR, 'stores/video.js');
  if (fs.existsSync(originalFile)) {
    errors.push('❌ stores/video.js 仍存在（应已移动到 ARCHIVE）');
  } else {
    log(colors.green, '✅ stores/video.js 已从原位置移除');
    passed.push('原文件已移除');
  }
}

// 主执行流程
log(colors.blue, '\n═══════════════════════════════════════════════');
log(colors.blue, '🔍 迁移完整性全面检查');
log(colors.blue, '═══════════════════════════════════════════════\n');

checkNoOldStoreReferences();
checkMainComponentsImport();
checkDuplicateDeclarations();
checkUseVideoSyncExports();
checkStoresIndexCleanup();
checkArchiveStatus();

// 显示结果摘要
log(colors.blue, '\n═══════════════════════════════════════════════');
log(colors.blue, '📊 检查结果摘要');
log(colors.blue, '═══════════════════════════════════════════════\n');

if (errors.length > 0) {
  log(colors.red, `\n❌ 发现 ${errors.length} 个错误:\n`);
  errors.forEach(err => log(colors.red, err));
}

if (warnings.length > 0) {
  log(colors.yellow, `\n⚠️  发现 ${warnings.length} 个警告:\n`);
  warnings.forEach(warn => log(colors.yellow, warn));
}

if (passed.length > 0) {
  log(colors.green, `\n✅ 通过 ${passed.length} 项检查:\n`);
  passed.forEach(item => log(colors.green, `   • ${item}`));
}

log(colors.blue, '\n═══════════════════════════════════════════════');

if (errors.length === 0) {
  log(colors.green, '🎉 所有检查通过！迁移完整且正确。\n');
  process.exit(0);
} else {
  log(colors.red, `❌ 检查失败：发现 ${errors.length} 个错误需要修复。\n`);
  process.exit(1);
}
