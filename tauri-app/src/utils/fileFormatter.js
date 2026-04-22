/**
 * 文件大小格式化工具函数
 */

/**
 * 将字节数转换为人类可读的文件大小
 * @param {number} bytes - 字节数
 * @param {number} decimals - 小数位数（默认 2）
 * @returns {string} 格式化后的文件大小字符串 (如 "1.5 MB")
 */
export function formatFileSize(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * 将文件大小字符串转换为字节数
 * @param {string} sizeStr - 文件大小字符串 (如 "1.5 MB")
 * @returns {number} 字节数
 */
export function parseFileSize(sizeStr) {
  if (!sizeStr) return 0;
  
  const units = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'TB': 1024 * 1024 * 1024 * 1024
  };
  
  const match = sizeStr.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/i);
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  
  return value * (units[unit] || 1);
}

/**
 * 计算录制文件的预估大小
 * @param {number} durationSeconds - 录制时长（秒）
 * @param {number} bitrateMbps - 码率（Mbps，默认 5）
 * @returns {string} 预估文件大小
 */
export function estimateRecordingSize(durationSeconds, bitrateMbps = 5) {
  // 文件大小 ≈ 码率 × 时长 ÷ 8
  const bytes = (bitrateMbps * 1000000 * durationSeconds) / 8;
  return formatFileSize(bytes);
}
