/**
 * 文档文件类型检测工具
 * 
 * 职责:
 * 1. 根据文件扩展名准确识别文档类型
 * 2. 检查格式兼容性
 * 3. 生成用户友好的提示信息
 * 
 * @module utils/documentTypeDetector
 */

/**
 * 文档类型映射表
 * 定义所有支持的文件格式及其对应的类型标识
 */
const DOCUMENT_TYPE_MAP = {
  // PDF 系列
  pdf: 'pdf',
  
  // Word 系列 (文字处理)
  doc: 'word',
  docx: 'word',
  dot: 'word',
  dotx: 'word',
  wps: 'word',      // WPS Writer
  wpt: 'word',      // WPS Writer Template
  odt: 'word',      // OpenDocument Text
  
  // Excel 系列 (电子表格)
  xls: 'excel',
  xlsx: 'excel',
  xlt: 'excel',
  xltx: 'excel',
  et: 'excel',      // WPS Spreadsheets
  ett: 'excel',     // WPS Spreadsheets Template
  ods: 'excel',     // OpenDocument Spreadsheet
  
  // PowerPoint 系列 (演示文稿)
  ppt: 'ppt',
  pptx: 'ppt',
  pot: 'ppt',
  potx: 'ppt',
  dps: 'ppt',       // WPS Presentation
  dpt: 'ppt',       // WPS Presentation Template
  odp: 'ppt',       // OpenDocument Presentation
  
  // 文本系列
  txt: 'txt',
  rtf: 'txt',
  
  // 图片系列
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  gif: 'image',
  bmp: 'image',
  webp: 'image',
  svg: 'image'
}

/**
 * 格式兼容性信息
 * 定义每种格式的解析能力和限制
 */
const COMPATIBILITY_INFO = {
  // 完全支持的格式
  pdf: { level: 'full', parser: '浏览器原生 iframe', warning: null },
  docx: { level: 'full', parser: 'mammoth.js', warning: null },
  pptx: { level: 'full', parser: 'pptx-parser', warning: null },
  txt: { level: 'full', parser: 'FileReader', warning: null },
  jpg: { level: 'full', parser: '原生 <img>', warning: null },
  jpeg: { level: 'full', parser: '原生 <img>', warning: null },
  png: { level: 'full', parser: '原生 <img>', warning: null },
  gif: { level: 'full', parser: '原生 <img>', warning: null },
  bmp: { level: 'full', parser: '原生 <img>', warning: null },
  webp: { level: 'full', parser: '原生 <img>', warning: null },
  svg: { level: 'full', parser: '原生 <img>', warning: null },
  
  // 部分支持的格式 (兼容模式)
  wps: { 
    level: 'partial', 
    parser: 'mammoth.js (兼容模式)', 
    warning: 'WPS 文字格式可能需要转换为 .docx 以获得最佳效果' 
  },
  wpt: { 
    level: 'partial', 
    parser: 'mammoth.js (兼容模式)', 
    warning: 'WPS 文字模板格式可能需要转换为 .dotx' 
  },
  dps: { 
    level: 'partial', 
    parser: 'pptx-parser (兼容模式)', 
    warning: 'WPS 演示格式可能需要转换为 .pptx 以获得最佳效果' 
  },
  dpt: { 
    level: 'partial', 
    parser: 'pptx-parser (兼容模式)', 
    warning: 'WPS 演示模板格式可能需要转换为 .potx' 
  },
  odt: { 
    level: 'partial', 
    parser: 'mammoth.js (尝试解析)', 
    warning: 'OpenDocument 格式可能需要转换为 .docx' 
  },
  odp: { 
    level: 'partial', 
    parser: 'pptx-parser (尝试解析)', 
    warning: 'OpenDocument 演示格式可能需要转换为 .pptx' 
  },
  
  // 占位符模式 (待实现真实解析)
  xlsx: { 
    level: 'placeholder', 
    parser: 'SheetJS (待集成)', 
    warning: 'Excel 预览功能开发中,建议转换为 PDF 获得最佳效果' 
  },
  et: { 
    level: 'placeholder', 
    parser: 'SheetJS (待集成)', 
    warning: 'WPS 表格预览功能开发中,建议转换为 PDF' 
  },
  ett: { 
    level: 'placeholder', 
    parser: 'SheetJS (待集成)', 
    warning: 'WPS 表格模板预览功能开发中,建议转换为 PDF' 
  },
  ods: { 
    level: 'placeholder', 
    parser: 'SheetJS (待集成)', 
    warning: 'OpenDocument 表格预览功能开发中,建议转换为 PDF' 
  },
  
  // 需要后端转换的旧版格式
  doc: { 
    level: 'convert', 
    parser: '需要后端转换服务', 
    suggestion: '请使用 Microsoft Office 或 WPS 另存为 .docx 格式' 
  },
  dot: { 
    level: 'convert', 
    parser: '需要后端转换服务', 
    suggestion: '请使用 Microsoft Office 或 WPS 另存为 .dotx 格式' 
  },
  xls: { 
    level: 'convert', 
    parser: '需要后端转换服务', 
    suggestion: '请使用 Microsoft Office 或 WPS 另存为 .xlsx 格式' 
  },
  xlt: { 
    level: 'convert', 
    parser: '需要后端转换服务', 
    suggestion: '请使用 Microsoft Office 或 WPS 另存为 .xltx 格式' 
  },
  ppt: { 
    level: 'convert', 
    parser: '需要后端转换服务', 
    suggestion: '请使用 Microsoft Office 或 WPS 另存为 .pptx 格式' 
  },
  pot: { 
    level: 'convert', 
    parser: '需要后端转换服务', 
    suggestion: '请使用 Microsoft Office 或 WPS 另存为 .potx 格式' 
  },
  
  // RTF (基础支持)
  rtf: { 
    level: 'basic', 
    parser: '简单文本提取', 
    warning: 'RTF 格式仅支持基础文本内容,复杂格式可能丢失' 
  }
}

/**
 * 根据文件对象检测文档类型
 * 
 * @param {File} file - 文件对象
 * @returns {string} 文档类型标识 ('pdf' | 'word' | 'excel' | 'ppt' | 'txt' | 'image')
 * @throws {Error} 当文件格式不支持时抛出错误
 * 
 * @example
 * const file = input.files[0]
 * const type = detectDocumentType(file)
 * console.log(type) // 'word'
 */
export function detectDocumentType(file) {
  if (!file || !file.name) {
    throw new Error('无效的文件对象')
  }
  
  const ext = file.name.split('.').pop().toLowerCase()
  
  if (!DOCUMENT_TYPE_MAP[ext]) {
    throw new Error(`不支持的文件格式: .${ext}`)
  }
  
  return DOCUMENT_TYPE_MAP[ext]
}

/**
 * 检查文件格式的兼容性
 * 
 * @param {string} ext - 文件扩展名(不含点)
 * @returns {Object} 兼容性信息对象
 * @returns {string} return.level - 兼容性级别 ('full' | 'partial' | 'placeholder' | 'convert' | 'basic')
 * @returns {string} return.parser - 使用的解析器
 * @returns {string|null} return.warning - 警告信息(如果有)
 * @returns {string|null} return.suggestion - 转换建议(如果需要转换)
 * 
 * @example
 * const compat = checkFormatCompatibility('docx')
 * console.log(compat.level) // 'full'
 */
export function checkFormatCompatibility(ext) {
  const normalizedExt = ext.toLowerCase().replace(/^\./, '')
  return COMPATIBILITY_INFO[normalizedExt] || { 
    level: 'unsupported', 
    parser: '无', 
    warning: null,
    suggestion: '不支持此文件格式' 
  }
}

/**
 * 根据兼容性信息生成用户友好的提示消息
 * 
 * @param {string} ext - 文件扩展名
 * @param {Object} [compat] - 兼容性信息(可选,会自动获取)
 * @returns {string|null} 提示信息,如果无需提示则返回 null
 * 
 * @example
 * const warning = generateUserWarning('wps')
 * console.log(warning) // '⚠️ WPS 文字格式可能需要转换为 .docx 以获得最佳效果'
 */
export function generateUserWarning(ext, compat = null) {
  const normalizedExt = ext.toLowerCase().replace(/^\./, '')
  const compatibility = compat || checkFormatCompatibility(normalizedExt)
  
  // 完全支持的格式,无需提示
  if (compatibility.level === 'full') {
    return null
  }
  
  // 部分支持的格式,显示警告
  if (compatibility.level === 'partial') {
    return `⚠️ ${compatibility.warning}`
  }
  
  // 占位符模式,显示功能提示
  if (compatibility.level === 'placeholder') {
    return `💡 ${compatibility.warning}`
  }
  
  // 基础支持,显示限制提示
  if (compatibility.level === 'basic') {
    return `⚠️ ${compatibility.warning}`
  }
  
  // 需要转换的格式,显示错误和建议
  if (compatibility.level === 'convert') {
    return `❌ .${normalizedExt} 格式不支持直接解析。${compatibility.suggestion}`
  }
  
  // 不支持的格式
  return `❌ 不支持的文件格式: .${normalizedExt}`
}

/**
 * 获取文件类型的显示名称
 * 
 * @param {string} type - 类型标识
 * @returns {string} 友好的显示名称
 * 
 * @example
 * getTypeDisplayName('word') // 'Word 文档'
 */
export function getTypeDisplayName(type) {
  const displayNameMap = {
    pdf: 'PDF 文档',
    word: 'Word 文档',
    excel: 'Excel 表格',
    ppt: 'PPT 演示文稿',
    txt: '文本文件',
    image: '图片'
  }
  
  return displayNameMap[type] || '未知类型'
}

/**
 * 获取文件类型的图标组件名称
 * 
 * @param {string} type - 类型标识
 * @returns {string} Element Plus 图标组件名称
 * 
 * @example
 * getTypeIcon('word') // 'Document'
 */
export function getTypeIcon(type) {
  const iconMap = {
    pdf: 'Reading',
    word: 'Document',
    excel: 'Files',
    ppt: 'Files',
    txt: 'Document',
    image: 'Picture'
  }
  
  return iconMap[type] || 'Document'
}

/**
 * 获取所有支持的文档格式列表
 * 
 * @returns {Array<Object>} 支持的格式数组
 * @returns {string} return[].ext - 文件扩展名
 * @returns {string} return[].type - 类型标识
 * @returns {string} return[].level - 兼容性级别
 * 
 * @example
 * const formats = getSupportedFormats()
 * console.log(formats.find(f => f.ext === 'docx'))
 * // { ext: 'docx', type: 'word', level: 'full' }
 */
export function getSupportedFormats() {
  return Object.entries(DOCUMENT_TYPE_MAP).map(([ext, type]) => {
    const compat = COMPATIBILITY_INFO[ext]
    return {
      ext,
      type,
      level: compat ? compat.level : 'unknown'
    }
  })
}

/**
 * 验证文件是否可以添加（增强安全检查版）
 * 
 * @param {File} file - 文件对象
 * @returns {Object} 验证结果
 * @returns {boolean} return.valid - 是否有效
 * @returns {string|null} return.error - 错误信息(如果无效)
 * @returns {string|null} return.warning - 警告信息(如果有)
 * @returns {string} return.type - 检测到的类型
 * @returns {Object} return.compatibility - 兼容性信息
 * 
 * @example
 * const result = validateFile(file)
 * if (!result.valid) {
 *   ElMessage.error(result.error)
 *   return
 * }
 * if (result.warning) {
 *   ElMessage.warning(result.warning)
 * }
 */
export function validateFile(file) {
  try {
    // 🎯 安全检查：确保文件对象存在
    if (!file) {
      return {
        valid: false,
        error: '文件对象为空',
        warning: null,
        type: null,
        compatibility: null
      }
    }
    
    // 🎯 安全检查：确保文件对象有 name 属性
    if (!file.name || typeof file.name !== 'string') {
      return {
        valid: false,
        error: '无效的文件名',
        warning: null,
        type: null,
        compatibility: null
      }
    }
    
    // 🎯 安全检查：文件大小限制（防止过大文件导致内存问题）
    const maxFileSize = 100 * 1024 * 1024; // 100MB
    if (file.size && file.size > maxFileSize) {
      return {
        valid: false,
        error: `文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），请选择小于 100MB 的文件`,
        warning: null,
        type: null,
        compatibility: null
      }
    }
    
    // 步骤1: 检测类型
    const type = detectDocumentType(file)
    
    // 步骤2: 获取扩展名
    const ext = file.name.split('.').pop().toLowerCase()
    
    // 步骤3: 检查兼容性
    const compatibility = checkFormatCompatibility(ext)
    
    // 步骤4: 生成警告
    const warning = generateUserWarning(ext, compatibility)
    
    // 步骤5: 判断是否有效
    // 🎯 注意：.ppt (旧版PowerPoint) 需要后端转换，不支持直接解析
    // .pptx 是支持的格式
    const valid = compatibility.level !== 'unsupported' && compatibility.level !== 'convert'
    
    // 步骤6: 生成错误信息
    let error = null
    if (!valid) {
      if (compatibility.level === 'convert') {
        error = `.${ext} 格式不支持直接解析。${compatibility.suggestion}`
      } else {
        error = `不支持的文件格式: .${ext}`
      }
    }
    
    // 🎯 额外检查：对于 PPT 类型，确保是 .pptx 格式
    if (type === 'ppt' && ext === 'ppt') {
      // 旧版 .ppt 格式，需要转换
      return {
        valid: false,
        error: `.ppt 格式需要使用 Microsoft Office 或 WPS 转换为 .pptx 格式后才能使用`,
        warning: null,
        type: 'ppt',
        compatibility: {
          level: 'convert',
          parser: '需要后端转换服务',
          suggestion: '请使用 Microsoft Office 或 WPS 另存为 .pptx 格式'
        }
      }
    }
    
    return {
      valid,
      error,
      warning,
      type,
      compatibility
    }
    
  } catch (err) {
    console.error('[documentTypeDetector] 文件验证失败:', err);
    return {
      valid: false,
      error: err.message || '文件验证失败',
      warning: null,
      type: null,
      compatibility: null
    }
  }
}
