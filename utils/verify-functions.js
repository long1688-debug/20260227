/**
 * 功能验证脚本
 *
 * 用于自动验证当前版本是否包含备份版本的所有功能
 *
 * 使用方法:
 * node utils/verify-functions.js
 */

const fs = require('fs')
const path = require('path')

// ============================================
// 配置
// ============================================

const CURRENT_DIR = 'f:/20260227'
const BACKUP_DIR = 'f:/20260227_backup_20260420_230133'

// ============================================
// 验证项定义
// ============================================

const verificationItems = {
  // 1. 核心组件
  coreComponents: {
    name: '核心组件',
    required: [
      'tauri-app/src/components/App.vue',
      'tauri-app/src/components/TeacherWindow.vue'
    ]
  },
  
  // 2. 渲染引擎组件
  renderComponents: {
    name: '渲染引擎组件',
    required: [
      'tauri-app/src/components/render/RenderEngineWrapper.vue',
      'tauri-app/src/components/render/CameraPreview.vue'
    ]
  },
  
  // 3. 布局组件
  layoutComponents: {
    name: '布局组件',
    required: [
      'tauri-app/src/components/teacher-window/layout/VideoSection.vue',
      'tauri-app/src/components/teacher-window/layout/SourcePreviewBar.vue'
    ]
  },
  
  // 4. 对话框组件
  dialogComponents: {
    name: '对话框组件',
    required: [
      'tauri-app/src/components/teacher-window/dialogs/AddSourceDialog.vue'
    ]
  },
  
  // 5. Composables
  composables: {
    name: 'Composables',
    required: [
      'tauri-app/src/composables/useVideoSync.js',
      'tauri-app/src/composables/useSourceDrag.js'
    ]
  },
  
  // 6. 状态管理
  stores: {
    name: '状态管理',
    required: [
      'tauri-app/src/stores/subtitleStore.js',
      'tauri-app/src/stores/sourceStore.js'
    ]
  }
}

// ============================================
// 验证函数
// ============================================

/**
 * 检查文件是否存在
 */
function fileExists(dir, filePath) {
  const fullPath = path.join(dir, filePath)
  return fs.existsSync(fullPath)
}

/**
 * 验证单个项目
 */
function verifyItem(dir, category, item) {
  const exists = fileExists(dir, item)
  const fileSize = exists ? fs.statSync(path.join(dir, item)).size : 0

  return {
    path: item,
    exists,
    size: exists ? `${(fileSize / 1024).toFixed(2)} KB` : 'N/A'
  }
}

/**
 * 验证一个类别
 */
function verifyCategory(dir, category) {
  const { name, required } = category

  console.log(`\n📋 ${name}`)
  console.log('='.repeat(60))

  const results = required.map(item => verifyItem(dir, category, item))

  // 统计
  const existsCount = results.filter(r => r.exists).length
  const totalCount = results.length
  const missing = results.filter(r => !r.exists)

  // 输出结果
  results.forEach(result => {
    const icon = result.exists ? '✅' : '❌'
    console.log(`  ${icon} ${result.path} (${result.size})`)
  })

  // 统计信息
  console.log(`\n  总计: ${existsCount}/${totalCount} 文件存在`)

  if (missing.length > 0) {
    console.log(`  ⚠️  缺失文件:`)
    missing.forEach(m => {
      console.log(`     - ${m.path}`)
    })
  }

  return { name, existsCount, totalCount, missing, results }
}

/**
 * 对比两个版本
 */
function compareVersions(currentResults, backupResults) {
  console.log('\n\n🔍 版本对比')
  console.log('='.repeat(60))

  const comparisons = Object.keys(currentResults).map(categoryName => {
    const current = currentResults[categoryName]
    const backup = backupResults[categoryName]

    const comparison = {
      category: categoryName,
      currentExists: current.existsCount,
      backupExists: backup.existsCount,
      total: current.totalCount,
      status: current.existsCount === backup.existsCount ? '✅ 一致' : '⚠️  不一致'
    }

    console.log(`\n  ${comparison.category}`)
    console.log(`    当前版本: ${comparison.currentExists}/${comparison.total}`)
    console.log(`    备份版本: ${comparison.backupExists}/${comparison.total}`)
    console.log(`    状态: ${comparison.status}`)

    if (current.missing.length > 0) {
      console.log(`    ⚠️  当前版本缺失:`)
      current.missing.forEach(m => {
        console.log(`       - ${m.path}`)
      })
    }

    return comparison
  })

  return comparisons
}

/**
 * 生成报告
 */
function generateReport(currentResults, backupResults, comparisons) {
  console.log('\n\n📊 验证报告')
  console.log('='.repeat(60))

  // 总体统计
  const currentTotalExists = Object.values(currentResults).reduce((sum, r) => sum + r.existsCount, 0)
  const backupTotalExists = Object.values(backupResults).reduce((sum, r) => sum + r.existsCount, 0)
  const totalItems = Object.values(currentResults).reduce((sum, r) => sum + r.totalCount, 0)

  console.log(`\n  当前版本: ${currentTotalExists}/${totalItems} 文件存在`)
  console.log(`  备份版本: ${backupTotalExists}/${totalItems} 文件存在`)
  console.log(`  覆盖率: ${((currentTotalExists / totalItems) * 100).toFixed(2)}%`)

  // 问题总结
  const allMissing = Object.values(currentResults).flatMap(r => r.missing)
  if (allMissing.length > 0) {
    console.log(`\n  ⚠️  总共缺失 ${allMissing.length} 个文件:`)
    allMissing.forEach(m => {
      console.log(`     - ${m.path}`)
    })
  } else {
    console.log(`\n  ✅ 所有文件都存在！`)
  }

  // 建议
  console.log(`\n  💡 建议:`)

  if (allMissing.length > 0) {
    console.log(`     1. 从备份目录复制缺失的文件`)
    console.log(`     2. 检查功能是否正常`)
    console.log(`     3. 运行功能测试`)
  } else {
    console.log(`     1. 运行功能测试，验证所有功能是否正常`)
    console.log(`     2. 检查代码逻辑是否一致`)
    console.log(`     3. 测试用户交互流程`)
  }
}

// ============================================
// 主函数
// ============================================

function main() {
  console.log('🚀 开始功能验证...')
  console.log('='.repeat(60))
  console.log(`  当前版本: ${CURRENT_DIR}`)
  console.log(`  备份版本: ${BACKUP_DIR}`)

  // 验证当前版本
  console.log('\n\n📁 当前版本验证')
  console.log('='.repeat(60))
  const currentResults = {}
  Object.keys(verificationItems).forEach(categoryName => {
    currentResults[categoryName] = verifyCategory(CURRENT_DIR, verificationItems[categoryName])
  })

  // 验证备份版本
  console.log('\n\n📁 备份版本验证')
  console.log('='.repeat(60))
  const backupResults = {}
  Object.keys(verificationItems).forEach(categoryName => {
    backupResults[categoryName] = verifyCategory(BACKUP_DIR, verificationItems[categoryName])
  })

  // 对比版本
  const comparisons = compareVersions(currentResults, backupResults)

  // 生成报告
  generateReport(currentResults, backupResults, comparisons)

  console.log('\n\n✨ 验证完成！\n')
}

// 运行主函数
main()
