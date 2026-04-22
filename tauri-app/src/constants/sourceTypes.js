// 信号源类型常量定义
// 用于添加信号源对话框中的类型选择

export const SOURCE_TYPE_OPTIONS = [
  {
    value: 'localDevice',
    label: '本地设备',
    icon: '📹',
    description: 'USB摄像头、采集卡、高拍仪等本地视频设备'
  },
  {
    value: 'networkCamera',
    label: '网络摄像机',
    icon: '🌐',
    description: '通过 RTSP/RTMP 等协议接入的网络摄像头'
  },
  {
    value: 'mrCamera',
    label: 'MR摄像机',
    icon: '🥽',
    description: '混合现实(MR)摄像机设备'
  },
  {
    value: 'remoteDesktop',
    label: '远程桌面',
    icon: '🖥️',
    description: '远程桌面或屏幕共享信号源'
  },
  {
    value: 'remoteCamera',
    label: '远程桌面摄像头',
    icon: '📡',
    description: '远程桌面的摄像头画面'
  },
  {
    value: 'mobileCamera',
    label: '手机/平板摄像头',
    icon: '📱',
    description: '移动设备的摄像头画面'
  },
  {
    value: 'mobileScreen',
    label: '手机/平板桌面',
    icon: '📲',
    description: '移动设备的屏幕画面'
  },
  {
    value: 'localVideo',
    label: '媒体文件',
    icon: '🎬',
    description: '本地存储的视频、音频文件'
  },
  {
    value: 'networkStream',
    label: '网络串流',
    icon: '📺',
    description: '网络直播流或点播流'
  },
  {
    value: 'webpage',
    label: '网页',
    icon: '🌍',
    description: '嵌入网页内容'
  },
  {
    value: 'ppt',
    label: 'PPT',
    icon: '📊',
    description: 'PowerPoint演示文稿'
  },
  {
    value: 'word',
    label: 'Word',
    icon: '📝',
    description: 'Word文档'
  },
  {
    value: 'pdf',
    label: 'PDF文档',
    icon: '📄',
    description: 'PDF文档（支持Word/Excel/PPT等格式转换）'
  },
  {
    value: 'mindmap',
    label: '思维导图',
    icon: '🧠',
    description: '思维导图或脑图'
  }
];

/**
 * 信号源类型常量定义
 */
export const SOURCE_TYPES = {
  LOCAL_DEVICE: 'localDevice',
  CAMERA: 'camera',
  LOCAL_VIDEO: 'localVideo',
  SCREEN: 'screen',
  REMOTE_DESKTOP: 'remoteDesktop',
  NETWORK_CAMERA: 'networkCamera',
  REMOTE_CAMERA: 'remoteCamera',
  MOBILE_CAMERA: 'mobileCamera',
  MOBILE_SCREEN: 'mobileScreen',
  NETWORK_STREAM: 'networkStream',
  WEBPAGE: 'webpage',
  PPT: 'ppt',
  WORD: 'word',
  PDF: 'pdf',
  MINDMAP: 'mindmap',
  MR_CAMERA: 'mrCamera'
};

/**
 * 可录制的信号源类型白名单
 */
export const RECORDABLE_SOURCE_TYPES = [
  SOURCE_TYPES.LOCAL_DEVICE,
  SOURCE_TYPES.CAMERA,
  SOURCE_TYPES.NETWORK_CAMERA,
  SOURCE_TYPES.REMOTE_DESKTOP,
  SOURCE_TYPES.REMOTE_CAMERA,
  SOURCE_TYPES.MOBILE_CAMERA,
  SOURCE_TYPES.MOBILE_SCREEN,
  SOURCE_TYPES.NETWORK_STREAM,
];

/**
 * 检查信号源是否可录制
 */
export function isSourceRecordable(sourceType) {
  return RECORDABLE_SOURCE_TYPES.includes(sourceType);
}

// 信号源类型标签映射
export const SOURCE_TYPE_LABELS = SOURCE_TYPE_OPTIONS.reduce((acc, curr) => {
  acc[curr.value] = curr.label;
  return acc;
}, {});

// 信号源类型图标映射
export const SOURCE_TYPE_ICONS = SOURCE_TYPE_OPTIONS.reduce((acc, curr) => {
  acc[curr.value] = curr.icon;
  return acc;
}, {});

// 信号源类型描述映射
export const SOURCE_TYPE_DESCRIPTIONS = SOURCE_TYPE_OPTIONS.reduce((acc, curr) => {
  acc[curr.value] = curr.description;
  return acc;
}, {});

// 信号源类型颜色映射 (Element Plus Tag 类型)
export const SOURCE_TYPE_COLORS = {
  localDevice: 'success',
  networkCamera: 'warning',
  mrCamera: 'primary',
  remoteDesktop: 'info',
  remoteCamera: 'info',
  mobileCamera: 'warning',
  mobileScreen: 'warning',
  localVideo: 'primary',
  networkStream: 'danger',
  webpage: 'success',
  ppt: 'warning',
  word: 'info',
  mindmap: 'primary',
  screen: 'warning',
  pdf: 'danger'
};

// 根据信号源类型分组（带图标）
// 注意：屏幕共享、媒体文件、文档课件已移至右侧面板，此处只保留摄像设备
export const SOURCE_TYPE_GROUPS = [
  {
    name: '本地设备',
    icon: '📹',
    iconComponent: 'VideoCamera',
    types: ['localDevice']
  },
  {
    name: '网络设备',
    icon: '🌐',
    iconComponent: 'Globe',
    types: ['networkCamera', 'remoteCamera', 'mobileCamera', 'mrCamera']
  }
];

// 默认信号源配置
export const DEFAULT_SOURCE_CONFIG = {
  [SOURCE_TYPES.LOCAL_DEVICE]: {
    resolution: '1920x1080',
    frameRate: 30,
    codec: 'h264',
    inputInterface: 'usb',
    autoFocus: true
  },
  [SOURCE_TYPES.NETWORK_CAMERA]: {
    protocol: 'rtsp',
    timeout: 10000,
    retryCount: 3
  },
  [SOURCE_TYPES.MR_CAMERA]: {
    resolution: '1920x1080',
    frameRate: 60
  },
  [SOURCE_TYPES.REMOTE_DESKTOP]: {
    frameRate: 30,
    cursor: true,
    audio: true
  },
  [SOURCE_TYPES.REMOTE_CAMERA]: {
    resolution: '1920x1080',
    frameRate: 30
  },
  [SOURCE_TYPES.MOBILE_CAMERA]: {
    resolution: '1920x1080',
    frameRate: 30,
    facingMode: 'environment'
  },
  [SOURCE_TYPES.MOBILE_SCREEN]: {
    frameRate: 30,
    audio: true
  },
  [SOURCE_TYPES.LOCAL_VIDEO]: {
    autoplay: true,
    loop: false,
    muted: false
  },
  [SOURCE_TYPES.NETWORK_STREAM]: {
    bufferSize: 8192,
    timeout: 10000,
    retryCount: 3
  },
  [SOURCE_TYPES.WEBPAGE]: {
    sandbox: true,
    javascriptEnabled: true
  },
  [SOURCE_TYPES.PPT]: {
    autoplay: true,
    loop: false
  },
  [SOURCE_TYPES.WORD]: {
    readonly: true
  },
  [SOURCE_TYPES.PDF]: {
    readonly: true
  },
  [SOURCE_TYPES.MINDMAP]: {
    editable: false
  }
}

// 获取信号源类型列表
export function getSourceTypeList() {
  return SOURCE_TYPE_OPTIONS;
}

// 获取信号源配置
export function getSourceConfig(type) {
  return DEFAULT_SOURCE_CONFIG[type] || {}
}

// 获取信号源类型图标
export function getSourceTypeIcon(type) {
  const option = SOURCE_TYPE_OPTIONS.find(opt => opt.value === type);
  return option?.icon || '❓';
}

// 获取信号源类型标签
export function getSourceTypeLabel(type) {
  const option = SOURCE_TYPE_OPTIONS.find(opt => opt.value === type);
  return option?.label || type;
}

// 获取信号源类型描述
export function getSourceTypeDescription(type) {
  const option = SOURCE_TYPE_OPTIONS.find(opt => opt.value === type);
  return option?.description || '';
}

// 获取信号源类型标签 (Color/Tag)
export function getSourceTypeTag(type) {
  return SOURCE_TYPE_COLORS[type] || undefined;
}
