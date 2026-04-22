/**
 * RenderSourceMindMap - 思维导图数据源
 */
import { RenderSource } from './RenderSource.js';

export class RenderSourceMindMap extends RenderSource {
  constructor(options = {}) {
    super({ ...options, type: 'mindmap' });
    
    this._mindmapData = options.mindmapData || {
      root: null,
      nodes: [],
      edges: []
    };
    
    // 渲染属性
    this._scale = options.scale || 1;
    this._offset = options.offset || { x: 0, y: 0 };
    this._selectedNodeId = null;
    
    // 布局类型
    this._layoutType = options.layoutType || 'tree'; // tree, radial, mindmap
  }
  
  /**
   * 初始化思维导图
   */
  async _initialize() {
    // 验证数据结构
    if (!this._mindmapData.root) {
      // 创建默认根节点
      this._mindmapData.root = {
        id: 'root',
        text: '中心主题',
        x: 0,
        y: 0,
        children: []
      };
    }
    
    // 计算布局
    await this._calculateLayout();
    
    this._isReady = true;
    this._emit('ready');
    
    console.log('[RenderSourceMindMap] 思维导图初始化成功');
  }
  
  /**
   * 计算布局
   */
  async _calculateLayout() {
    switch (this._layoutType) {
      case 'radial':
        this._calculateRadialLayout();
        break;
      case 'mindmap':
        this._calculateMindMapLayout();
        break;
      case 'tree':
      default:
        this._calculateTreeLayout();
        break;
    }
  }
  
  /**
   * 计算树形布局
   */
  _calculateTreeLayout() {
    if (!this._mindmapData.root) return;
    
    const nodeSpacing = 80;
    const levelSpacing = 120;
    
    const calculateNodePositions = (node, level, x, y) => {
      node.x = x;
      node.y = y;
      
      if (!node.children || node.children.length === 0) return;
      
      const childrenCount = node.children.length;
      const totalWidth = (childrenCount - 1) * nodeSpacing;
      const startX = x + levelSpacing - totalWidth / 2;
      
      node.children.forEach((child, index) => {
        calculateNodePositions(child, level + 1, startX + index * nodeSpacing, y + nodeSpacing);
      });
    };
    
    calculateNodePositions(this._mindmapData.root, 0, 0, 0);
  }
  
  /**
   * 计算径向布局
   */
  _calculateRadialLayout() {
    if (!this._mindmapData.root) return;
    
    const radius = 100;
    const levels = this._getMaxDepth(this._mindmapData.root);
    
    const calculateRadialPositions = (node, level, angle, parentAngle) => {
      const currentRadius = radius * level;
      node.x = Math.cos(angle) * currentRadius;
      node.y = Math.sin(angle) * currentRadius;
      
      if (!node.children || node.children.length === 0) return;
      
      const angleStep = (Math.PI * 2) / node.children.length;
      node.children.forEach((child, index) => {
        const childAngle = angle + angleStep * index - Math.PI;
        calculateRadialPositions(child, level + 1, childAngle, angle);
      });
    };
    
    this._mindmapData.root.x = 0;
    this._mindmapData.root.y = 0;
    
    if (this._mindmapData.root.children) {
      const angleStep = (Math.PI * 2) / this._mindmapData.root.children.length;
      this._mindmapData.root.children.forEach((child, index) => {
        calculateRadialPositions(child, 1, angleStep * index, 0);
      });
    }
  }
  
  /**
   * 计算思维导图布局
   */
  _calculateMindMapLayout() {
    if (!this._mindmapData.root) return;
    
    const nodeSpacing = 100;
    const levelSpacing = 140;
    
    const calculateMindMapPositions = (node, level, x, y, isLeft) => {
      node.x = x;
      node.y = y;
      
      if (!node.children || node.children.length === 0) return;
      
      const childrenCount = node.children.length;
      const halfCount = Math.ceil(childrenCount / 2);
      
      let currentY = y - (halfCount - 1) * nodeSpacing / 2;
      
      node.children.forEach((child, index) => {
        const childX = isLeft ? x - levelSpacing : x + levelSpacing;
        const direction = index < halfCount ? -1 : 1;
        
        calculateMindMapPositions(child, level + 1, childX, currentY, !isLeft);
        currentY += nodeSpacing;
      });
    };
    
    this._mindmapData.root.x = 0;
    this._mindmapData.root.y = 0;
    
    if (this._mindmapData.root.children) {
      const childrenCount = this._mindmapData.root.children.length;
      const halfCount = Math.ceil(childrenCount / 2);
      
      let currentY = -(halfCount - 1) * nodeSpacing / 2;
      
      this._mindmapData.root.children.forEach((child, index) => {
        const isLeft = index < halfCount;
        const childX = isLeft ? -levelSpacing : levelSpacing;
        
        calculateMindMapPositions(child, 1, childX, currentY, !isLeft);
        currentY += nodeSpacing;
      });
    }
  }
  
  /**
   * 获取最大深度
   */
  _getMaxDepth(node) {
    if (!node || !node.children || node.children.length === 0) {
      return 1;
    }
    
    return 1 + Math.max(...node.children.map(child => this._getMaxDepth(child)));
  }
  
  /**
   * 设置思维导图数据
   */
  setMindMapData(data) {
    this._mindmapData = data;
    this._isReady = false;
    this.init();
  }
  
  /**
   * 添加节点
   */
  addNode(parentId, text) {
    const parent = this._findNode(this._mindmapData.root, parentId);
    if (parent) {
      const newNode = {
        id: `node-${Date.now()}`,
        text,
        x: 0,
        y: 0,
        children: []
      };
      
      if (!parent.children) {
        parent.children = [];
      }
      parent.children.push(newNode);
      
      // 重新计算布局
      this._calculateLayout();
      
      return newNode;
    }
    return null;
  }
  
  /**
   * 删除节点
   */
  removeNode(nodeId) {
    this._removeNodeRecursive(this._mindmapData.root, nodeId);
    this._calculateLayout();
  }
  
  /**
   * 递归删除节点
   */
  _removeNodeRecursive(parent, nodeId) {
    if (!parent || !parent.children) return;
    
    const index = parent.children.findIndex(child => child.id === nodeId);
    if (index !== -1) {
      parent.children.splice(index, 1);
      return true;
    }
    
    return parent.children.some(child => this._removeNodeRecursive(child, nodeId));
  }
  
  /**
   * 查找节点
   */
  _findNode(node, nodeId) {
    if (!node) return null;
    if (node.id === nodeId) return node;
    
    if (node.children) {
      for (const child of node.children) {
        const found = this._findNode(child, nodeId);
        if (found) return found;
      }
    }
    
    return null;
  }
  
  /**
   * 选择节点
   */
  selectNode(nodeId) {
    this._selectedNodeId = nodeId;
  }
  
  /**
   * 获取思维导图数据
   */
  get mindmapData() {
    return { ...this._mindmapData };
  }
  
  /**
   * 获取布局类型
   */
  get layoutType() {
    return this._layoutType;
  }
  
  /**
   * 获取选中的节点ID
   */
  get selectedNodeId() {
    return this._selectedNodeId;
  }
  
  /**
   * 获取缩放和偏移
   */
  get viewTransform() {
    return { scale: this._scale, offset: { ...this._offset } };
  }
  
  /**
   * 设置视图变换
   */
  setViewTransform(transform) {
    this._scale = transform.scale;
    this._offset = transform.offset;
  }
}
