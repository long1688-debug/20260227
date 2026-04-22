const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
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
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules' && file !== 'DELETED_BACKUP') {
      getAllVueFiles(filePath, fileList);
    } else if (stat.isFile() && file.endsWith('.vue')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// 提取组件文件名（不含路径和扩展名）
function getComponentName(filePath) {
  return path.basename(filePath, '.vue');
}

// 检查组件是否被使用
function isComponentUsed(componentName, vueFiles, excludeFile) {
  // 构建可能的导入模式
  const patterns = [
    // 标准导入: import ComponentName from './xxx.vue'
    new RegExp(`import\\s+${componentName}\\s+from`, 'i'),
    // 动态导入: () => import('./xxx.vue')
    new RegExp(`import\\(['"]\\.\\/.*${componentName}`, 'i'),
    // 模板中使用: <ComponentName
    new RegExp(`<${componentName}[\\s>]`, 'i'),
    // 异步组件注册
    new RegExp(`components:\\s*{[^}]*${componentName}`, 'i')
  ];
  
  for (const file of vueFiles) {
    // 跳过自身
    if (excludeFile && path.resolve(file) === path.resolve(excludeFile)) {
      continue;
    }
    
    try {
      const content = fs.readFileSync(file, 'utf-8');
      
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          return { used: true, file: path.relative(process.cwd(), file) };
        }
      }
    } catch (err) {
      // 忽略读取错误的文件
    }
  }
  
  return { used: false };
}

// 检查是否在路由中使用
function isUsedInRouter(componentName, routerFiles) {
  for (const file of routerFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      // 检查是否在路由配置中引用
      if (content.includes(componentName)) {
        return true;
      }
    } catch (err) {
      // 忽略
    }
  }
  return false;
}

// 主函数
function main() {
  const workspaceRoot = path.join(__dirname, '..');
  const srcDir = path.join(workspaceRoot, 'tauri-app', 'src');
  const componentsDir = path.join(srcDir, 'components');
  const routerFile = path.join(srcDir, 'router', 'index.js');
  
  log(colors.blue, '🔍 开始检查未使用的 Vue 组件...\n');
  
  const vueFiles = getAllVueFiles(srcDir);
  log(colors.blue, `找到 ${vueFiles.length} 个 Vue 文件\n`);
  
  // 只检查 components 根目录下的文件（排除子目录）
  const rootComponents = fs.readdirSync(componentsDir)
    .filter(file => file.endsWith('.vue') && !file.includes('_fixed'))
    .map(file => path.join(componentsDir, file));
  
  log(colors.cyan, `检查 components 根目录下的 ${rootComponents.length} 个组件:\n`);
  
  const unusedComponents = [];
  const usedComponents = [];
  const routerComponents = []; // 通过路由使用的组件
  
  rootComponents.forEach(compPath => {
    const compName = getComponentName(compPath);
    
    // 首先检查是否在路由中使用
    if (isUsedInRouter(compName, [routerFile])) {
      routerComponents.push({ 
        name: compName, 
        path: path.relative(workspaceRoot, compPath),
        size: (fs.statSync(compPath).size / 1024).toFixed(2) + 'KB'
      });
      return;
    }
    
    // 然后检查是否在其他 Vue 文件中使用
    const result = isComponentUsed(compName, vueFiles, compPath);
    
    if (result.used) {
      usedComponents.push({ name: compName, usedIn: result.file });
    } else {
      unusedComponents.push({ 
        name: compName, 
        path: path.relative(workspaceRoot, compPath),
        size: (fs.statSync(compPath).size / 1024).toFixed(2) + 'KB'
      });
    }
  });
  
  // 显示结果
  if (routerComponents.length > 0) {
    log(colors.magenta, `\n📍 通过路由使用的组件 (${routerComponents.length}):`);
    routerComponents.forEach(comp => {
      log(colors.magenta, `   • ${comp.name} (${comp.size}) - 在 router/index.js 中引用`);
    });
  }
  
  log(colors.green, `\n✅ 直接引用的组件 (${usedComponents.length}):`);
  usedComponents.forEach(comp => {
    log(colors.green, `   • ${comp.name} - 被 ${comp.usedIn} 使用`);
  });
  
  if (unusedComponents.length > 0) {
    log(colors.red, `\n⚠️  未使用的组件 (${unusedComponents.length}):`);
    unusedComponents.forEach(comp => {
      log(colors.yellow, `   • ${comp.name}`);
      log(colors.yellow, `     路径: ${comp.path}`);
      log(colors.yellow, `     大小: ${comp.size}`);
      log(colors.reset, '');
    });
    
    log(colors.red, '='.repeat(60));
    log(colors.red, `发现 ${unusedComponents.length} 个可能未使用的组件文件`);
    log(colors.yellow, '\n建议操作:');
    log(colors.yellow, '1. 仔细检查这些组件是否通过动态导入或其他方式使用');
    log(colors.yellow, '2. 确认无误后，移动到 DELETED_BACKUP 目录备份');
    log(colors.yellow, '3. 验证项目编译正常后删除备份');
    log(colors.red, '='.repeat(60));
  } else {
    log(colors.green, '\n✅ 恭喜！components 根目录下没有未使用的组件。');
  }
  
  // 统计信息
  log(colors.blue, '\n' + '='.repeat(60));
  log(colors.blue, `总计: ${rootComponents.length} 个组件`);
  log(colors.magenta, `路由使用: ${routerComponents.length}`);
  log(colors.green, `直接引用: ${usedComponents.length}`);
  log(colors.red, `未使用: ${unusedComponents.length}`);
  log(colors.blue, '='.repeat(60));
}

main();
