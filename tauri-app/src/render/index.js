/**
 * Render Engine - 渲染引擎模块
 * 提供完整的渲染系统功能
 */

// 核心引擎
export { RenderEngine, renderEngine } from './RenderEngine.js';
export { RenderWindow } from './RenderWindow.js';
export { RenderCanvas } from './RenderCanvas.js';
export { RenderLayout, LAYOUT_TYPES, LayoutFactory } from './RenderLayout.js';
export { RenderElement } from './RenderElement.js';

// 渲染元素
export { RenderBox } from './elements/RenderBox.js';
export { RenderWidget } from './elements/RenderWidget.js';
export { RenderShape } from './elements/RenderShape.js';

// 数据源
export { RenderSource } from './sources/RenderSource.js';
export { RenderSourceImage } from './sources/RenderSourceImage.js';
export { RenderSourceVideo } from './sources/RenderSourceVideo.js';
export { RenderSourceCamera } from './sources/RenderSourceCamera.js';
export { RenderSourceNetcam } from './sources/RenderSourceNetcam.js';
export { RenderSourceDesktop } from './sources/RenderSourceDesktop.js';
export { RenderSourceWincap } from './sources/RenderSourceWincap.js';
export { RenderSourceAirplay } from './sources/RenderSourceAirplay.js';
export { RenderSourceMindMap } from './sources/RenderSourceMindMap.js';
export { RenderSourceWeb } from './sources/RenderSourceWeb.js';
export { SourceFactory, SOURCE_TYPES } from './sources/SourceFactory.js';

/**
 * 初始化渲染引擎
 * @param {Object} options - 配置选项
 * @returns {RenderEngine} - 渲染引擎实例
 */
export function initRenderEngine(options = {}) {
  const engine = new RenderEngine(options);
  return engine;
}

/**
 * 创建渲染画布
 * @param {HTMLCanvasElement} canvas - 画布元素
 * @param {Object} options - 配置选项
 * @returns {RenderCanvas} - 渲染画布实例
 */
export function createRenderCanvas(canvas, options = {}) {
  const renderCanvas = new RenderCanvas(options);
  renderCanvas.init(canvas);
  return renderCanvas;
}

/**
 * 创建渲染窗口
 * @param {HTMLElement} parent - 父容器
 * @param {Object} options - 配置选项
 * @returns {RenderWindow} - 渲染窗口实例
 */
export function createRenderWindow(parent, options = {}) {
  const window = new RenderWindow(options);
  window.create(parent);
  return window;
}

/**
 * 创建布局
 * @param {string} layoutType - 布局类型
 * @param {Object} options - 配置选项
 * @returns {RenderLayout} - 布局实例
 */
export function createLayout(layoutType, options = {}) {
  return LayoutFactory.create(layoutType, options);
}

/**
 * 创建数据源
 * @param {string} type - 数据源类型
 * @param {Object} options - 配置选项
 * @returns {RenderSource} - 数据源实例
 */
export function createSource(type, options = {}) {
  return SourceFactory.create(type, options);
}

/**
 * 异步创建并初始化数据源
 * @param {string} type - 数据源类型
 * @param {Object} options - 配置选项
 * @returns {Promise<RenderSource>} - 数据源实例
 */
export async function createSourceAsync(type, options = {}) {
  return SourceFactory.createAndInit(type, options);
}
