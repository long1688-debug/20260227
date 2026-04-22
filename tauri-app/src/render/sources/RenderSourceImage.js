/**
 * RenderSourceImage - 图片数据源
 */
import { RenderSource } from './RenderSource.js';

export class RenderSourceImage extends RenderSource {
  constructor(options = {}) {
    super({ ...options, type: 'image' });
    
    this._image = null;
    this._width = 0;
    this._height = 0;
  }
  
  /**
   * 初始化图片
   */
  async _initialize() {
    return new Promise((resolve, reject) => {
      this._image = new Image();
      this._image.crossOrigin = 'anonymous';
      
      this._image.onload = () => {
        this._width = this._image.width;
        this._height = this._image.height;
        this._duration = 0; // 图片没有时长
        resolve();
      };
      
      this._image.onerror = (error) => {
        reject(new Error(`加载图片失败: ${this._url}`));
      };
      
      this._image.src = this._url;
    });
  }
  
  /**
   * 获取图片对象
   */
  get image() {
    return this._image;
  }
  
  /**
   * 获取尺寸
   */
  get width() { return this._width; }
  get height() { return this._height; }
}
