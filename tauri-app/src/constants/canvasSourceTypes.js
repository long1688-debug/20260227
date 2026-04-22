/**
 * 自由布局画布信号源类型定义
 */

/**
 * 信号源类型枚举
 */
export const SOURCE_TYPES = {
  VIDEO: 'video',                    // 视频文件/流
  TEXT: 'text',                      // 文本内容
  IMAGE: 'image',                    // 图片文件
  WEBPAGE: 'webpage',                // 网页嵌入
  PPT: 'ppt',                        // PowerPoint演示文稿
  WORD: 'word',                      // Word文档
  PDF: 'pdf',                        // PDF文档
  MINDMAP: 'mindmap',                // 思维导图
  REMOTE_DESKTOP: 'remote_desktop',  // 远程桌面共享
  CAMERA: 'camera'                   // 摄像机画面
};

/**
 * 信号源类型标签映射
 */
export const SOURCE_TYPE_LABELS = {
  [SOURCE_TYPES.VIDEO]: '视频',
  [SOURCE_TYPES.TEXT]: '文字',
  [SOURCE_TYPES.IMAGE]: '图片',
  [SOURCE_TYPES.WEBPAGE]: '网页',
  [SOURCE_TYPES.PPT]: 'PPT',
  [SOURCE_TYPES.WORD]: 'Word',
  [SOURCE_TYPES.PDF]: 'PDF',
  [SOURCE_TYPES.MINDMAP]: '思维导图',
  [SOURCE_TYPES.REMOTE_DESKTOP]: '远程桌面',
  [SOURCE_TYPES.CAMERA]: '摄像机'
};

/**
 * 信号源类型图标映射
 */
export const SOURCE_TYPE_ICONS = {
  [SOURCE_TYPES.VIDEO]: 'VideoPlay',
  [SOURCE_TYPES.TEXT]: 'Document',
  [SOURCE_TYPES.IMAGE]: 'Picture',
  [SOURCE_TYPES.WEBPAGE]: 'Link',
  [SOURCE_TYPES.PPT]: 'Files',
  [SOURCE_TYPES.WORD]: 'Document',
  [SOURCE_TYPES.PDF]: 'Document',
  [SOURCE_TYPES.MINDMAP]: 'Connection',
  [SOURCE_TYPES.REMOTE_DESKTOP]: 'Monitor',
  [SOURCE_TYPES.CAMERA]: 'Camera'
};

/**
 * 默认信号源配置
 */
export const DEFAULT_SOURCE_CONFIG = {
  x: 10,              // X坐标(百分比)
  y: 10,              // Y坐标(百分比)
  width: 30,          // 宽度(百分比)
  height: 25,         // 高度(百分比)
  zIndex: 1,          // 层级
  rotation: 0,        // 旋转角度
  opacity: 1,         // 透明度
  visible: true,      // 可见性
  locked: false,      // 锁定状态
  showTitle: true,    // 显示标题
  filters: {
    brightness: 100,   // 亮度(%)
    contrast: 100,     // 对比度(%)
    saturate: 100,     // 饱和度(%)
    blur: 0,           // 模糊(px)
    grayscale: 0,      // 灰度(%)
    sepia: 0,          // 复古(%)
    hueRotate: 0       // 色相旋转(deg)
  }
};

/**
 * 支持的滤镜列表
 */
export const FILTER_OPTIONS = [
  { key: 'brightness', label: '亮度', min: 0, max: 200, unit: '%' },
  { key: 'contrast', label: '对比度', min: 0, max: 200, unit: '%' },
  { key: 'saturate', label: '饱和度', min: 0, max: 200, unit: '%' },
  { key: 'blur', label: '模糊', min: 0, max: 20, unit: 'px' },
  { key: 'grayscale', label: '灰度', min: 0, max: 100, unit: '%' },
  { key: 'sepia', label: '复古', min: 0, max: 100, unit: '%' },
  { key: 'hueRotate', label: '色相', min: 0, max: 360, unit: 'deg' }
];

/**
 * 生成唯一ID
 */
export function generateSourceId() {
  return `source_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
