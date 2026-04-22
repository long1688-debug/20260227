#!/usr/bin/env node

/**
 * 🚨 防误用检查脚本
 * 
 * 用途：在开发或构建前检查是否有代码错误导入了已废弃的 useVideoStore
 * 使用方法：node utils/check-deprecated-imports.js
 */

const fs = require('fs');
const path = require('path');

// 配置
const ROOT_DIR = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'tauri-app', 'src');
const DEPRECATED_PATTERNS = [
  /import\s+.*useVideoStore\s+from/,
  /from\s+['"].*stores\/video['"]/,
  /const\s+videoStore\s*=\s*useVideoStore\(\)/,
];

let hasErrors = false;

/**
 * 递归扫描目录
 */
function scanDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // 跳过 node_modules 和 ARCHIVE 目录
      if (file === 'node_modules' || file === 'ARCHIVE') {
        return;
      }
      scanDirectory(filePath);
    } else if (file.endsWith('.vue') || file.endsWith('.js') || file.endsWith('.ts')) {
      checkFile(filePath);
    }
  });
}

/**
 * 检查单个文件
 */
function checkFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(ROOT_DIR, filePath);

    DEPRECATED_PATTERNS.forEach((pattern, index) => {
      if (pattern.test(content)) {
        console.error(`\n❌ 发现已废弃的导入！`);
        console.error(`   文件: ${relativePath}`);
        console.error(`   模式: ${pattern}`);
        console.error(`   请改用: import { useVideoSync } from '@/composables/useVideoSync'`);
        hasErrors = true;
      }
    });
  } catch (error) {
    // 忽略读取错误的文件
  }
}

// 主执行流程
console.log('🔍 检查是否有代码使用了已废弃的 useVideoStore...\n');

scanDirectory(SRC_DIR);

if (hasErrors) {
  console.error('\n╔═══════════════════════════════════════════════════════════╗');
  console.error('║  🚨 检查失败：发现已废弃的导入！                          ║');
  console.error('║                                                           ║');
  console.error('║  请立即修复上述文件，否则可能导致严重的状态不一致问题！    ║');
  console.error('╚═══════════════════════════════════════════════════════════╝\n');
  process.exit(1);
} else {
  console.log('✅ 检查通过：未发现已废弃的导入。\n');
  process.exit(0);
}
