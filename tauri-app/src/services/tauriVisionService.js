/**
 * Tauri 视觉分析服务
 * 提供 COCO 数据集管理、智能视觉分析和 AI 评估系统的前端 API
 */

import { invoke } from '@tauri-apps/api/tauri';

/**
 * COCO 数据集管理
 */
export const cocoDatasetService = {
  /**
   * 设置 COCO 数据集路径
   */
  async setDatasetPath(path) {
    return await invoke('set_coco_dataset_path', { path });
  },

  /**
   * 获取当前 COCO 数据集路径
   */
  async getDatasetPath() {
    return await invoke('get_coco_dataset_path');
  },

  /**
   * 验证数据集是否完整
   */
  async validateDataset() {
    return await invoke('validate_coco_dataset');
  },

  /**
   * 获取数据集统计信息
   */
  async getStatistics() {
    return await invoke('get_coco_dataset_stats');
  },

  /**
   * 搜索包含指定类别的图片
   */
  async searchImagesByCategory(categoryName, maxResults = 10) {
    return await invoke('search_coco_images_by_category', {
      categoryName,
      maxResults
    });
  }
};

/**
 * 智能视觉分析服务
 */
export const visionAnalysisService = {
  /**
   * 分析图像
   */
  async analyzeImage(imagePath) {
    return await invoke('analyze_image', { imagePath });
  },

  /**
   * 获取分析历史记录
   */
  async getAnalysisHistory() {
    return await invoke('get_analysis_history');
  },

  /**
   * 清除分析历史
   */
  async clearAnalysisHistory() {
    return await invoke('clear_analysis_history');
  },

  /**
   * 获取服务状态
   */
  async getServiceStatus() {
    return await invoke('get_vision_service_status');
  }
};

/**
 * AI 评估系统服务
 */
export const aiEvaluationService = {
  /**
   * 设置考试配置
   */
  async setExamConfig(config) {
    return await invoke('set_exam_config', { config });
  },

  /**
   * 获取当前考试配置
   */
  async getExamConfig() {
    return await invoke('get_exam_config');
  },

  /**
   * 开始批量测试
   */
  async startBatchTest(maxImages = 100) {
    return await invoke('start_batch_test', { maxImages });
  },

  /**
   * 分析考试结果并评分
   */
  async analyzeExamResults(examResults) {
    return await invoke('analyze_exam_results', { examResults });
  }
};

/**
 * COCO 80 类标签
 */
export const COCO_LABELS = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
  'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
  'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
  'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
  'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
  'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
  'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair',
  'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote',
  'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book',
  'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
];

// 导出统一服务接口
export const tauriVisionService = {
  coco: cocoDatasetService,
  analysis: visionAnalysisService,
  evaluation: aiEvaluationService,
  labels: COCO_LABELS
};

// 默认导出
export default tauriVisionService;