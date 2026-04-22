/**
 * 视频源管理工具函数
 * 
 * 功能：
 * 1. Blob URL 统一管理（创建、复用、释放）
 * 2. 视频源生命周期管理
 * 3. 内存泄漏防护
 * 4. 跨组件共享视频源
 */

/**
 * 🎯 视频源管理器 - 单例模式
 * 
 * 核心设计：
 * - 使用 fileId (filename + size + lastModified) 作为唯一标识
 * - 支持跨组件共享同一个 Blob URL
 * - 自动跟踪引用计数，无引用时自动释放
 * - 防止内存泄漏
 */
class VideoSourceManager {
  constructor() {
    // fileId -> { blobUrl, file, refCount, createdAt }
    this.sourceMap = new Map();
    
    // 引用计数：fileId -> count
    this.refCountMap = new Map();
    
    // 清理间隔（毫秒）
    this.cleanupInterval = 5 * 60 * 1000; // 5 分钟
    
    // 定时清理器
    this.cleanupTimer = null;
    
    // 启动定时清理
    this.startAutoCleanup();
  }

  /**
   * 生成文件唯一标识符
   * @param {File} file - 文件对象
   * @returns {string} 文件唯一标识
   */
  generateFileId(file) {
    if (!file) return '';
    return `${file.name}_${file.size}_${file.lastModified}`;
  }

  /**
   * 创建或获取 Blob URL（支持复用）
   * @param {File} file - 文件对象
   * @param {boolean} forceNew - 是否强制创建新 URL（默认 false）
   * @returns {Object} { blobUrl, fileId }
   */
  createBlobUrl(file, forceNew = false) {
    if (!file) {
      console.warn('[VideoSourceManager] 文件为空，无法创建 Blob URL');
      return { blobUrl: null, fileId: null };
    }

    const fileId = this.generateFileId(file);
    console.log(`[VideoSourceManager] createBlobUrl - fileId: ${fileId}, forceNew: ${forceNew}`);

    // 如果不强制创建新 URL，且已存在，则复用
    if (!forceNew && this.sourceMap.has(fileId)) {
      const existing = this.sourceMap.get(fileId);
      
      // 检查 Blob URL 是否仍然有效
      try {
        const testUrl = new URL(existing.blobUrl);
        if (testUrl.protocol === 'blob:') {
          // 增加引用计数
          this.incrementRefCount(fileId);
          console.log(`[VideoSourceManager] ✅ 复用已有 Blob URL: ${fileId}`);
          return { blobUrl: existing.blobUrl, fileId };
        }
      } catch (e) {
        console.warn(`[VideoSourceManager] ⚠️ 已有 Blob URL 无效，重新创建: ${fileId}`, e);
        this.removeSource(fileId);
      }
    }

    // 创建新的 Blob URL
    try {
      const blobUrl = URL.createObjectURL(file);
      
      // 存储源信息
      this.sourceMap.set(fileId, {
        blobUrl,
        file,
        createdAt: Date.now()
      });
      
      // 初始化引用计数
      this.refCountMap.set(fileId, 1);
      
      console.log(`[VideoSourceManager] ✅ 创建新 Blob URL: ${fileId}, URL: ${blobUrl}`);
      return { blobUrl, fileId };
    } catch (error) {
      console.error('[VideoSourceManager] ❌ 创建 Blob URL 失败:', error);
      return { blobUrl: null, fileId };
    }
  }

  /**
   * 释放 Blob URL（带引用计数）
   * @param {string} fileId - 文件唯一标识
   * @param {boolean} forceRevoke - 是否强制释放（默认 false）
   */
  revokeBlobUrl(fileId, forceRevoke = false) {
    if (!fileId) {
      console.warn('[VideoSourceManager] fileId 为空，无法释放 Blob URL');
      return;
    }

    console.log(`[VideoSourceManager] revokeBlobUrl - fileId: ${fileId}, forceRevoke: ${forceRevoke}`);

    const currentCount = this.refCountMap.get(fileId) || 0;
    
    // 如果强制释放或引用计数为 0
    if (forceRevoke || currentCount <= 1) {
      this.removeSource(fileId);
    } else {
      // 减少引用计数
      this.refCountMap.set(fileId, currentCount - 1);
      console.log(`[VideoSourceManager] 🔽 引用计数递减: ${fileId}, ${currentCount} -> ${currentCount - 1}`);
    }
  }

  /**
   * 增加引用计数
   * @param {string} fileId - 文件唯一标识
   */
  incrementRefCount(fileId) {
    const currentCount = this.refCountMap.get(fileId) || 0;
    this.refCountMap.set(fileId, currentCount + 1);
    console.log(`[VideoSourceManager] 🔼 引用计数递增: ${fileId}, ${currentCount} -> ${currentCount + 1}`);
  }

  /**
   * 移除视频源
   * @param {string} fileId - 文件唯一标识
   */
  removeSource(fileId) {
    const source = this.sourceMap.get(fileId);
    if (!source) {
      console.warn(`[VideoSourceManager] ⚠️ 视频源不存在: ${fileId}`);
      return;
    }

    try {
      URL.revokeObjectURL(source.blobUrl);
      console.log(`[VideoSourceManager] ✅ 已释放 Blob URL: ${fileId}`);
    } catch (error) {
      console.error(`[VideoSourceManager] ❌ 释放 Blob URL 失败: ${fileId}`, error);
    }

    this.sourceMap.delete(fileId);
    this.refCountMap.delete(fileId);
  }

  /**
   * 获取 Blob URL
   * @param {string} fileId - 文件唯一标识
   * @returns {string|null} Blob URL
   */
  getBlobUrl(fileId) {
    const source = this.sourceMap.get(fileId);
    return source ? source.blobUrl : null;
  }

  /**
   * 检查 Blob URL 是否存在
   * @param {string} fileId - 文件唯一标识
   * @returns {boolean}
   */
  hasSource(fileId) {
    return this.sourceMap.has(fileId);
  }

  /**
   * 获取源信息
   * @param {string} fileId - 文件唯一标识
   * @returns {Object|null} 源信息
   */
  getSourceInfo(fileId) {
    const source = this.sourceMap.get(fileId);
    const refCount = this.refCountMap.get(fileId);
    
    if (!source) return null;
    
    return {
      fileId,
      blobUrl: source.blobUrl,
      fileName: source.file?.name,
      fileSize: source.file?.size,
      createdAt: source.createdAt,
      refCount
    };
  }

  /**
   * 获取所有源信息
   * @returns {Array} 源信息数组
   */
  getAllSources() {
    const sources = [];
    this.sourceMap.forEach((source, fileId) => {
      const refCount = this.refCountMap.get(fileId) || 0;
      sources.push({
        fileId,
        blobUrl: source.blobUrl,
        fileName: source.file?.name,
        fileSize: source.file?.size,
        createdAt: source.createdAt,
        refCount,
        ageMs: Date.now() - source.createdAt
      });
    });
    return sources;
  }

  /**
   * 清理长时间未使用的源
   * @param {number} maxAgeMs - 最大存活时间（毫秒），默认 10 分钟
   */
  cleanupOldSources(maxAgeMs = 10 * 60 * 1000) {
    console.log('[VideoSourceManager] 开始清理长时间未使用的源...');
    
    const now = Date.now();
    const toRemove = [];

    this.sourceMap.forEach((source, fileId) => {
      const age = now - source.createdAt;
      const refCount = this.refCountMap.get(fileId) || 0;

      // 清理条件：超过最大存活时间 且 引用计数为 0
      if (age > maxAgeMs && refCount === 0) {
        toRemove.push(fileId);
      }
    });

    toRemove.forEach(fileId => {
      console.log(`[VideoSourceManager] 🧹 清理旧源: ${fileId}`);
      this.removeSource(fileId);
    });

    console.log(`[VideoSourceManager] 清理完成，共清理 ${toRemove.length} 个源`);
    return toRemove.length;
  }

  /**
   * 清理所有源
   */
  cleanupAll() {
    console.log('[VideoSourceManager] 清理所有源...');
    
    this.sourceMap.forEach((_, fileId) => {
      this.removeSource(fileId);
    });

    console.log(`[VideoSourceManager] ✅ 已清理所有源，共 ${this.sourceMap.size} 个`);
  }

  /**
   * 启动自动清理
   */
  startAutoCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanupOldSources();
    }, this.cleanupInterval);

    console.log(`[VideoSourceManager] ✅ 自动清理已启动（间隔: ${this.cleanupInterval / 1000}秒）`);
  }

  /**
   * 停止自动清理
   */
  stopAutoCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      console.log('[VideoSourceManager] ⏹️ 自动清理已停止');
    }
  }

  /**
   * 销毁管理器
   */
  destroy() {
    this.stopAutoCleanup();
    this.cleanupAll();
    console.log('[VideoSourceManager] 🗑️ 管理器已销毁');
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const sources = this.getAllSources();
    const totalSize = sources.reduce((sum, s) => sum + (s.fileSize || 0), 0);
    
    return {
      totalSources: sources.length,
      totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      totalRefs: sources.reduce((sum, s) => sum + s.refCount, 0),
      oldestAge: sources.length > 0 ? Math.max(...sources.map(s => s.ageMs)) : 0
    };
  }
}

// 创建单例实例
const videoSourceManager = new VideoSourceManager();

/**
 * 🎯 导出 Composable 接口
 * 
 * 使用示例：
 * ```js
 * const { createBlobUrl, revokeBlobUrl, getBlobUrl, cleanup, getStats } = useVideoSourceManager();
 * 
 * // 创建 Blob URL
 * const { blobUrl, fileId } = createBlobUrl(file);
 * 
 * // 获取 Blob URL
 * const url = getBlobUrl(fileId);
 * 
 * // 释放 Blob URL
 * revokeBlobUrl(fileId);
 * 
 * // 获取统计信息
 * const stats = getStats();
 * console.log(stats);
 * ```
 */
export function useVideoSourceManager() {
  return {
    /**
     * 创建或获取 Blob URL（支持复用）
     * @param {File} file - 文件对象
     * @param {boolean} forceNew - 是否强制创建新 URL
     * @returns {Object} { blobUrl, fileId }
     */
    createBlobUrl: (file, forceNew = false) => {
      return videoSourceManager.createBlobUrl(file, forceNew);
    },

    /**
     * 释放 Blob URL（带引用计数）
     * @param {string} fileId - 文件唯一标识
     * @param {boolean} forceRevoke - 是否强制释放
     */
    revokeBlobUrl: (fileId, forceRevoke = false) => {
      videoSourceManager.revokeBlobUrl(fileId, forceRevoke);
    },

    /**
     * 增加 Blob URL 的引用计数
     * @param {string} fileId - 文件唯一标识
     */
    addRef: (fileId) => {
      videoSourceManager.incrementRefCount(fileId);
    },

    /**
     * 获取 Blob URL
     * @param {string} fileId - 文件唯一标识
     * @returns {string|null}
     */
    getBlobUrl: (fileId) => {
      return videoSourceManager.getBlobUrl(fileId);
    },

    /**
     * 检查 Blob URL 是否存在
     * @param {string} fileId - 文件唯一标识
     * @returns {boolean}
     */
    hasSource: (fileId) => {
      return videoSourceManager.hasSource(fileId);
    },

    /**
     * 获取源信息
     * @param {string} fileId - 文件唯一标识
     * @returns {Object|null}
     */
    getSourceInfo: (fileId) => {
      return videoSourceManager.getSourceInfo(fileId);
    },

    /**
     * 获取所有源信息
     * @returns {Array}
     */
    getAllSources: () => {
      return videoSourceManager.getAllSources();
    },

    /**
     * 清理长时间未使用的源
     * @param {number} maxAgeMs - 最大存活时间（毫秒）
     * @returns {number} 清理的数量
     */
    cleanup: (maxAgeMs) => {
      return videoSourceManager.cleanupOldSources(maxAgeMs);
    },

    /**
     * 清理所有源
     */
    cleanupAll: () => {
      videoSourceManager.cleanupAll();
    },

    /**
     * 获取统计信息
     * @returns {Object}
     */
    getStats: () => {
      return videoSourceManager.getStats();
    },

    /**
     * 导出单例实例（用于高级用法）
     */
    instance: videoSourceManager
  };
}

/**
 * 🎯 导出单例实例（用于跨模块共享）
 */
export { videoSourceManager };

/**
 * 🎯 导出工具函数（向后兼容）
 */
export const createBlobUrl = (file, forceNew = false) => {
  return videoSourceManager.createBlobUrl(file, forceNew);
};

export const revokeBlobUrl = (fileId, forceRevoke = false) => {
  return videoSourceManager.revokeBlobUrl(fileId, forceRevoke);
};

export const getBlobUrl = (fileId) => {
  return videoSourceManager.getBlobUrl(fileId);
};

export const cleanupVideoSources = (maxAgeMs) => {
  return videoSourceManager.cleanupOldSources(maxAgeMs);
};
