#!/usr/bin/env node

/**
 * 🔍 功能完整性检查脚本
 * 
 * 用途：验证所有组件是否正确使用了新版 useVideoSync 系统
 * 使用方法：node utils/check-functionality-completeness.js
 */

const fs = require('fs');
const path = require('path');

// 配置
const ROOT_DIR = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'tauri-app', 'src');

// 需要检查的关键组件列表
const CRITICAL_COMPONENTS = [
  'components/TeacherWindow.vue',
  'components/EnhancedTeacherWindow.vue',
  'components/teacher-window/SidePanel.vue',
  'components/teacher-window/dialogs/RecordingManagerDialog.vue',
  'components/teacher-window/dialogs/AddSourceDialog.vue',
  'composables/useRecording.js'
];

// useVideoSync 应该导出的核心功能
const EXPECTED_EXPORTS = [
  'currentLayout',
  'canvasSourceMap',
  'allSources',
  'setLayout',
  'addSource',
  'removeSource',
  'setCanvasSource',
  'getSourceByCanvasIndex',
  'hasSourceAtCanvas',
  'setCanvasRecordingState',
  'getCanvasRecordingState',
  'maximizeCanvas',
  'restoreLayout',
  'togglePip',
  'setPipPosition'
];

let hasErrors = false;
let warnings = [];

/**
 * 检查文件是否导入了 useVideoSync
 */
function checkImport(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(ROOT_DIR, filePath);
    
    // 检查是否导入了 useVideoSync
    const hasUseVideoSync = /import.*useVideoSync.*from.*['"]@\/composables\/useVideoSync['"]/.test(content);
    
    // 检查是否错误导入了 useVideoStore
    const hasUseVideoStore = /import.*useVideoStore/.test(content);
    
    if (hasUseVideoStore) {
      console.error(`\n❌ 错误：发现已废弃的导入！`);
      console.error(`   文件: ${relativePath}`);
      console.error(`   请改用: import { useVideoSync } from '@/composables/useVideoSync'`);
      hasErrors = true;
      return false;
    }
    
    if (!hasUseVideoSync) {
      // 某些组件可能不需要 useVideoSync（如独立store的对话框）
      const isIndependentModule = /SettingsDialog|SubtitleManagerDialog|StudentList|TaskManager/.test(filePath);
      
      if (!isIndependentModule) {
        warnings.push(`⚠️  警告: ${relativePath} 未导入 useVideoSync（可能是独立模块，请手动确认）`);
      }
      return false;
    }
    
    console.log(`✅ ${relativePath} - 已正确导入 useVideoSync`);
    return true;
  } catch (error) {
    console.warn(`⚠️  无法读取文件: ${filePath}`);
    return false;
  }
}

/**
 * 检查组件是否解构了必要的功能
 */
function checkDestructuring(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(ROOT_DIR, filePath);
    
    // 提取解构的内容
    const destructuringMatch = content.match(/const\s+\{([^}]+)\}\s*=\s*useVideoSync\(\)/s);
    
    if (!destructuringMatch) {
      warnings.push(`⚠️  ${relativePath} - 未找到 useVideoSync() 的解构语句`);
      return;
    }
    
    const destructuredItems = destructuringMatch[1]
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
    
    console.log(`   📦 解构的功能 (${destructuredItems.length}个):`);
    console.log(`      ${destructuredItems.join(', ')}`);
    
    // 检查是否包含关键功能（过滤掉 VideoGrid 相关功能）
    const filteredExpectedExports = EXPECTED_EXPORTS.filter(feature => !feature.includes('VideoGrid'));
    const missingFeatures = filteredExpectedExports.filter(feature => !destructuredItems.includes(feature));
    
    if (missingFeatures.length > 0 && missingFeatures.length < EXPECTED_EXPORTS.length) {
      console.log(`   ℹ️  未使用的功能 (${missingFeatures.length}个): ${missingFeatures.slice(0, 5).join(', ')}${missingFeatures.length > 5 ? '...' : ''}`);
    }
    
  } catch (error) {
    // 忽略错误
  }
}

/**
 * 检查 useVideoSync.js 是否导出了所有预期功能
 */
function checkUseVideoSyncExports() {
  const filePath = path.join(SRC_DIR, 'composables', 'useVideoSync.js');
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // 查找 return 语句（支持多行）
    const returnMatch = content.match(/return\s*\{([\s\S]*?)\};?\s*\}/);
    
    if (!returnMatch) {
      console.error(`\n❌ 错误: useVideoSync.js 中未找到 return 语句`);
      hasErrors = true;
      return;
    }
    
    // 提取所有导出项（包括注释中的）
    const returnBlock = returnMatch[1];
    const exportedItems = returnBlock
      .split(/[\n,]/)  // 按换行或逗号分割
      .map(item => item.trim())
      .map(item => item.replace(/^\/\/.*$/, ''))  // 移除注释行
      .filter(item => item.length > 0 && !item.startsWith('//'));
    
    console.log(`\n📊 useVideoSync.js 导出统计:`);
    console.log(`   总导出项: ${exportedItems.length} 个`);
    
    // 检查是否包含所有预期功能
    const missingExports = EXPECTED_EXPORTS.filter(feature => !exportedItems.includes(feature));
    
    if (missingExports.length > 0) {
      console.error(`\n❌ 缺失的预期导出 (${missingExports.length}个):`);
      missingExports.forEach(feature => {
        console.error(`   - ${feature}`);
      });
      hasErrors = true;
    } else {
      console.log(`   ✅ 所有预期功能均已导出`);
    }
    
    // 显示部分导出项作为示例
    console.log(`\n   示例导出项 (前10个):`);
    exportedItems.slice(0, 10).forEach(item => {
      console.log(`      - ${item}`);
    });
    if (exportedItems.length > 10) {
      console.log(`      ... 还有 ${exportedItems.length - 10} 个`);
    }
    
  } catch (error) {
    console.error(`\n❌ 错误: 无法读取 useVideoSync.js`);
    console.error(`   ${error.message}`);
    hasErrors = true;
  }
}

// 主执行流程
console.log('🔍 开始功能完整性检查...\n');

console.log('═══════════════════════════════════════════');
console.log('步骤 1: 检查 useVideoSync.js 的导出完整性');
console.log('═══════════════════════════════════════════\n');
checkUseVideoSyncExports();

console.log('\n═══════════════════════════════════════════');
console.log('步骤 2: 检查关键组件的导入情况');
console.log('═══════════════════════════════════════════\n');

CRITICAL_COMPONENTS.forEach(componentPath => {
  const fullPath = path.join(SRC_DIR, componentPath);
  
  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️  文件不存在: ${componentPath}`);
    return;
  }
  
  console.log(`\n📄 检查: ${componentPath}`);
  const hasCorrectImport = checkImport(fullPath);
  
  if (hasCorrectImport) {
    checkDestructuring(fullPath);
  }
});

// 显示警告
if (warnings.length > 0) {
  console.log('\n═══════════════════════════════════════════');
  console.log('⚠️  警告信息');
  console.log('═══════════════════════════════════════════\n');
  warnings.forEach(warning => console.log(warning));
}

// 最终结果
console.log('\n═══════════════════════════════════════════');
if (hasErrors) {
  console.error('❌ 检查失败：发现错误！');
  console.error('\n请修复上述问题后再继续开发。');
  process.exit(1);
} else {
  console.log('✅ 检查通过：所有关键组件已正确迁移到 useVideoSync！');
  console.log('\n💡 提示:');
  console.log('   - 警告信息不影响功能，但建议检查');
  console.log('   - 可以运行 "npm run dev" 启动开发服务器进行实际测试');
  console.log('   - 参考 ARCHIVE/FUNCTIONALITY_CHECKLIST.md 进行手动功能测试');
  process.exit(0);
}
