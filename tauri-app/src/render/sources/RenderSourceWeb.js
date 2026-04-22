/**
 * RenderSourceWeb - 网页数据源
 * 用于渲染网页内容
 */
import { RenderSource } from './RenderSource.js';

export class RenderSourceWeb extends RenderSource {
  constructor(options = {}) {
    super({ ...options, type: 'web' });
    
    this._webView = null;
    this._iframe = null;
    this._allowFullscreen = options.allowFullscreen || false;
    this._allowPopups = options.allowPopups || false;
    
    // 加载状态
    this._isLoading = false;
  }
  
  /**
   * 初始化网页视图
   */
  async _initialize() {
    return new Promise((resolve, reject) => {
      // 创建 iframe
      this._iframe = document.createElement('iframe');
      this._iframe.src = this._url;
      this._iframe.style.cssText = `
        width: 100%;
        height: 100%;
        border: none;
        background: white;
      `;
      
      // 设置 iframe 属性
      this._iframe.allowFullscreen = this._allowFullscreen;
      
      // 处理 sandbox 属性
      const sandboxAttributes = ['allow-scripts', 'allow-same-origin'];
      if (this._allowPopups) {
        sandboxAttributes.push('allow-popups');
      }
      if (this._allowFullscreen) {
        sandboxAttributes.push('allow-fullscreen');
      }
      this._iframe.sandbox = sandboxAttributes.join(' ');
      
      // 监听加载事件
      this._iframe.addEventListener('load', () => {
        this._isLoading = false;
        this._isReady = true;
        this._emit('ready');
        resolve();
      });
      
      this._iframe.addEventListener('error', () => {
        this._isLoading = false;
        reject(new Error(`加载网页失败: ${this._url}`));
      });
      
      this._isLoading = true;
    });
  }
  
  /**
   * 播放（对于网页来说就是显示）
   */
  async play() {
    if (!this._isReady) {
      await this.init();
    }
    
    this._isPlaying = true;
    this._emit('play');
  }
  
  /**
   * 暂停（隐藏网页）
   */
  pause() {
    if (this._iframe) {
      this._iframe.style.display = 'none';
    }
    super.pause();
  }
  
  /**
   * 停止（显示网页）
   */
  stop() {
    if (this._iframe) {
      this._iframe.style.display = 'block';
    }
    super.stop();
  }
  
  /**
   * 刷新网页
   */
  refresh() {
    if (this._iframe) {
      this._iframe.contentWindow?.location.reload();
    }
  }
  
  /**
   * 导航到指定 URL
   */
  navigate(url) {
    this._url = url;
    if (this._iframe) {
      this._iframe.src = url;
    }
  }
  
  /**
   * 返回上一页
   */
  goBack() {
    if (this._iframe?.contentWindow?.history?.length > 0) {
      this._iframe.contentWindow.history.back();
    }
  }
  
  /**
   * 前进到下一页
   */
  goForward() {
    if (this._iframe?.contentWindow?.history?.length > 0) {
      this._iframe.contentWindow.history.forward();
    }
  }
  
  /**
   * 执行 JavaScript
   */
  async executeScript(script) {
    if (!this._iframe || !this._isReady) {
      throw new Error('网页尚未加载完成');
    }
    
    try {
      const result = await this._iframe.contentWindow?.eval(script);
      return result;
    } catch (error) {
      console.error('[RenderSourceWeb] 执行脚本失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取 iframe 元素
   */
  get iframe() {
    return this._iframe;
  }
  
  /**
   * 是否正在加载
   */
  get isLoading() {
    return this._isLoading;
  }
  
  /**
   * 释放资源
   */
  dispose() {
    if (this._iframe) {
      this._iframe.src = '';
      this._iframe = null;
    }
    super.dispose();
  }
}
