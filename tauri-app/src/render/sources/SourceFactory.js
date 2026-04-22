/**
 * SourceFactory - 数据源工厂
 * 用于创建各种类型的数据源
 */
import { RenderSourceImage } from './RenderSourceImage.js';
import { RenderSourceVideo } from './RenderSourceVideo.js';
import { RenderSourceCamera } from './RenderSourceCamera.js';
import { RenderSourceNetcam } from './RenderSourceNetcam.js';
import { RenderSourceDesktop } from './RenderSourceDesktop.js';
import { RenderSourceWincap } from './RenderSourceWincap.js';
import { RenderSourceAirplay } from './RenderSourceAirplay.js';
import { RenderSourceMindMap } from './RenderSourceMindMap.js';
import { RenderSourceWeb } from './RenderSourceWeb.js';

export class SourceFactory {
  /**
   * 创建数据源
   * @param {string} type - 数据源类型
   * @param {Object} options - 配置选项
   * @returns {RenderSource} - 数据源实例
   */
  static create(type, options = {}) {
    switch (type.toLowerCase()) {
      case 'image':
        return new RenderSourceImage(options);
      case 'video':
        return new RenderSourceVideo(options);
      case 'camera':
        return new RenderSourceCamera(options);
      case 'netcam':
        return new RenderSourceNetcam(options);
      case 'desktop':
        return new RenderSourceDesktop(options);
      case 'wincap':
      case 'window':
        return new RenderSourceWincap(options);
      case 'airplay':
        return new RenderSourceAirplay(options);
      case 'mindmap':
        return new RenderSourceMindMap(options);
      case 'web':
        return new RenderSourceWeb(options);
      default:
        throw new Error(`未知的数据源类型: ${type}`);
    }
  }
  
  /**
   * 获取支持的数据源类型列表
   */
  static getSupportedTypes() {
    return [
      { type: 'image', name: '图片', description: '本地或远程图片' },
      { type: 'video', name: '视频文件', description: '本地视频文件' },
      { type: 'camera', name: '本地摄像头', description: 'USB摄像头' },
      { type: 'netcam', name: '网络摄像头', description: 'RTSP/RTMP流' },
      { type: 'desktop', name: '桌面捕获', description: '屏幕共享' },
      { type: 'wincap', name: '窗口捕获', description: '应用窗口' },
      { type: 'airplay', name: 'AirPlay', description: 'AirPlay投屏' },
      { type: 'mindmap', name: '思维导图', description: '思维导图内容' },
      { type: 'web', name: '网页', description: '网页内容' }
    ];
  }
  
  /**
   * 异步创建并初始化数据源
   * @param {string} type - 数据源类型
   * @param {Object} options - 配置选项
   * @returns {Promise<RenderSource>} - 数据源实例
   */
  static async createAndInit(type, options = {}) {
    const source = SourceFactory.create(type, options);
    await source.init();
    return source;
  }
}

// 数据源类型常量
export const SOURCE_TYPES = {
  IMAGE: 'image',
  VIDEO: 'video',
  CAMERA: 'camera',
  NETCAM: 'netcam',
  DESKTOP: 'desktop',
  WINCAP: 'wincap',
  AIRPLAY: 'airplay',
  MINDMAP: 'mindmap',
  WEB: 'web'
};
