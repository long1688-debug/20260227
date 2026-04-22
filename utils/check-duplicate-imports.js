const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

// 获取所有 Vue 文件
function getAllVueFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      getAllVueFiles(filePath, fileList);
    } else if (stat.isFile() && file.endsWith('.vue')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// 检查单个文件的重复导入
function checkDuplicateImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const imports = new Map();
  const duplicates = [];
  
  lines.forEach((line, index) => {
    // 匹配 import 语句
    const match = line.match(/^\s*import\s+(\w+)\s+from\s+['"](.+)['"]/);
    if (match) {
      const [, name, source] = match;
      
      if (imports.has(name)) {
        duplicates.push({
          name,
          firstLine: imports.get(name),
          secondLine: index + 1,
          firstSource: lines[imports.get(name) - 1].trim(),
          secondSource: line.trim()
        });
      } else {
        imports.set(name, index + 1);
      }
    }
  });
  
  return duplicates;
}

// 主函数
function main() {
  const workspaceRoot = path.join(__dirname, '..');
  const srcDir = path.join(workspaceRoot, 'tauri-app', 'src');
  
  log(colors.blue, '🔍 开始检查 Vue 文件中的重复导入...\n');
  
  const vueFiles = getAllVueFiles(srcDir);
  log(colors.blue, `找到 ${vueFiles.length} 个 Vue 文件\n`);
  
  let totalDuplicates = 0;
  const filesWithDuplicates = [];
  
  vueFiles.forEach(file => {
    const duplicates = checkDuplicateImports(file);
    
    if (duplicates.length > 0) {
      totalDuplicates += duplicates.length;
      filesWithDuplicates.push({ file, duplicates });
      
      const relativePath = path.relative(workspaceRoot, file);
      log(colors.red, `\n❌ ${relativePath}`);
      
      duplicates.forEach(dup => {
        log(colors.yellow, `   组件名: ${dup.name}`);
        log(colors.yellow, `   第 ${dup.firstLine} 行: ${dup.firstSource}`);
        log(colors.yellow, `   第 ${dup.secondLine} 行: ${dup.secondSource}`);
        log(colors.reset, '');
      });
    }
  });
  
  // 总结
  log(colors.blue, '\n' + '='.repeat(60));
  if (totalDuplicates === 0) {
    log(colors.green, '✅ 恭喜！没有发现重复导入。');
  } else {
    log(colors.red, `⚠️  发现 ${totalDuplicates} 个重复导入`);
    log(colors.red, `   涉及 ${filesWithDuplicates.length} 个文件`);
    log(colors.yellow, '\n建议修复步骤：');
    log(colors.yellow, '1. 打开上述文件');
    log(colors.yellow, '2. 删除重复的 import 语句');
    log(colors.yellow, '3. 只保留一次正确的导入');
    log(colors.yellow, '4. 运行 get_problems 验证语法');
  }
  log(colors.blue, '='.repeat(60));
}

main();
