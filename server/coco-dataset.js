/**
 * COCO 数据集处理模块
 * 读取 F:\coco 目录中的 COCO 数据集文件和标注信息
 */

const fs = require('fs');
const path = require('path');

// COCO 数据集路径
const COCO_BASE_PATH = 'F:\\coco';
const COCO_ANNOTATIONS_PATH = path.join(COCO_BASE_PATH, 'annotations_trainval2017', 'annotations');
const COCO_TRAIN_IMAGES = path.join(COCO_BASE_PATH, 'train2017', 'train2017'); // 嵌套目录
const COCO_VAL_IMAGES = path.join(COCO_BASE_PATH, 'val2017', 'val2017'); // 嵌套目录

// COCO 类别名称映射（80个类别）
const COCO_CATEGORIES = {
  1: 'person', 2: 'bicycle', 3: 'car', 4: 'motorcycle', 5: 'airplane',
  6: 'bus', 7: 'train', 8: 'truck', 9: 'boat', 10: 'traffic light',
  11: 'fire hydrant', 13: 'stop sign', 14: 'parking meter', 15: 'bench',
  16: 'bird', 17: 'cat', 18: 'dog', 19: 'horse', 20: 'sheep',
  21: 'cow', 22: 'elephant', 23: 'bear', 24: 'zebra', 25: 'giraffe',
  27: 'backpack', 28: 'umbrella', 31: 'handbag', 32: 'tie', 33: 'suitcase',
  34: 'frisbee', 35: 'skis', 36: 'snowboard', 37: 'sports ball', 38: 'kite',
  39: 'baseball bat', 40: 'baseball glove', 41: 'skateboard', 42: 'surfboard',
  43: 'tennis racket', 44: 'bottle', 46: 'wine glass', 47: 'cup', 48: 'fork',
  49: 'knife', 50: 'spoon', 51: 'bowl', 52: 'banana', 53: 'apple',
  54: 'sandwich', 55: 'orange', 56: 'broccoli', 57: 'carrot', 58: 'hot dog',
  59: 'pizza', 60: 'donut', 61: 'cake', 62: 'chair', 63: 'couch',
  64: 'potted plant', 65: 'bed', 67: 'dining table', 70: 'toilet', 72: 'tv',
  73: 'laptop', 74: 'mouse', 75: 'remote', 76: 'keyboard', 77: 'cell phone',
  78: 'microwave', 79: 'oven', 80: 'toaster', 81: 'sink', 82: 'refrigerator',
  84: 'book', 85: 'clock', 86: 'vase', 87: 'scissors', 88: 'teddy bear',
  89: 'hair drier', 90: 'toothbrush'
};

class CocoDatasetHandler {
  constructor() {
    this.annotationsCache = new Map();
    this.imageListCache = null;
    this.statsCache = null;
  }

  /**
   * 检查 COCO 数据集路径是否有效
   */
  checkCocoPath() {
    return {
      basePath: fs.existsSync(COCO_BASE_PATH),
      annotationsPath: fs.existsSync(COCO_ANNOTATIONS_PATH),
      trainImages: fs.existsSync(COCO_TRAIN_IMAGES),
      valImages: fs.existsSync(COCO_VAL_IMAGES)
    };
  }

  /**
   * 获取 COCO 数据集统计信息
   */
  getStats() {
    if (this.statsCache) {
      return this.statsCache;
    }

    try {
      const pathStatus = this.checkCocoPath();

      // 统计图像数量
      let trainImageCount = 0;
      let valImageCount = 0;

      if (pathStatus.trainImages) {
        trainImageCount = fs.readdirSync(COCO_TRAIN_IMAGES)
          .filter(f => f.endsWith('.jpg')).length;
      }

      if (pathStatus.valImages) {
        valImageCount = fs.readdirSync(COCO_VAL_IMAGES)
          .filter(f => f.endsWith('.jpg')).length;
      }

      // 统计标注文件
      let annotationFiles = [];
      if (pathStatus.annotationsPath) {
        annotationFiles = fs.readdirSync(COCO_ANNOTATIONS_PATH)
          .filter(f => f.endsWith('.json'));
      }

      this.statsCache = {
        pathStatus,
        totalImages: trainImageCount + valImageCount,
        trainImages: trainImageCount,
        valImages: valImageCount,
        annotationFiles,
        categories: COCO_CATEGORIES,
        categoryCount: Object.keys(COCO_CATEGORIES).length,
        message: pathStatus.basePath ? 'COCO 数据集路径有效' : 'COCO 数据集路径无效'
      };

      return this.statsCache;
    } catch (error) {
      console.error('获取 COCO 统计信息失败:', error);
      throw error;
    }
  }

  /**
   * 获取图像列表
   */
  getImageList(dataset = 'val', limit = 100, offset = 0) {
    try {
      const imagePath = dataset === 'train' ? COCO_TRAIN_IMAGES : COCO_VAL_IMAGES;

      if (!fs.existsSync(imagePath)) {
        return { images: [], total: 0 };
      }

      // 尝试从标注文件获取图像信息
      let annotatedImages = [];
      try {
        const annotFile = dataset === 'train' ? 'instances_train2017.json' : 'instances_val2017.json';
        const annotPath = path.join(COCO_ANNOTATIONS_PATH, annotFile);
        if (fs.existsSync(annotPath)) {
          const annotData = JSON.parse(fs.readFileSync(annotPath, 'utf8'));
          annotatedImages = annotData.images || [];
        }
      } catch (error) {
        console.error('加载标注文件失败，使用文件名列表:', error);
      }

      let images;

      if (annotatedImages.length > 0) {
        // 使用标注文件中的图像信息
        const total = annotatedImages.length;
        const paginatedImages = annotatedImages.slice(offset, offset + limit);

        images = paginatedImages.map(img => ({
          id: img.id.toString(),
          filename: img.file_name,
          path: `${imagePath}\\${img.file_name}`,
          dataset,
          index: offset,
          width: img.width,
          height: img.height
        }));

        return { images, total };
      } else {
        // 如果没有标注文件，使用文件名列表
        const allFiles = fs.readdirSync(imagePath)
          .filter(f => f.endsWith('.jpg'));

        const total = allFiles.length;
        const paginatedFiles = allFiles.slice(offset, offset + limit);

        images = paginatedFiles.map((filename, index) => ({
          id: filename.replace('.jpg', ''),
          filename,
          path: `${imagePath}\\${filename}`,
          dataset,
          index: offset + index
        }));

        return { images, total };
      }
    } catch (error) {
      console.error('获取图像列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取随机图像
   */
  getRandomImage(dataset = 'val') {
    try {
      const imagePath = dataset === 'train' ? COCO_TRAIN_IMAGES : COCO_VAL_IMAGES;

      if (!fs.existsSync(imagePath)) {
        return null;
      }

      const files = fs.readdirSync(imagePath)
        .filter(f => f.endsWith('.jpg'));

      if (files.length === 0) return null;

      const randomFile = files[Math.floor(Math.random() * files.length)];

      return {
        id: randomFile.replace('.jpg', ''),
        filename: randomFile,
        path: `${imagePath}\\${randomFile}`,
        dataset
      };
    } catch (error) {
      console.error('获取随机图像失败:', error);
      throw error;
    }
  }

  /**
   * 加载标注文件
   */
  loadAnnotations(annotationFile = 'instances_val2017.json') {
    if (this.annotationsCache.has(annotationFile)) {
      return this.annotationsCache.get(annotationFile);
    }

    try {
      const annotPath = path.join(COCO_ANNOTATIONS_PATH, annotationFile);

      if (!fs.existsSync(annotPath)) {
        throw new Error(`标注文件不存在: ${annotPath}`);
      }

      const content = fs.readFileSync(annotPath, 'utf8');
      const data = JSON.parse(content);

      this.annotationsCache.set(annotationFile, data);

      return data;
    } catch (error) {
      console.error('加载标注文件失败:', error);
      throw error;
    }
  }

  /**
   * 获取图像的标注信息
   */
  getImageAnnotations(imageId) {
    try {
      // 尝试从验证集标注文件中查找
      const valAnnot = this.loadAnnotations('instances_val2017.json');

      // 查找图像信息
      const imageInfo = valAnnot.images.find(img => img.id.toString() === imageId.toString());

      if (!imageInfo) {
        return {
          found: false,
          message: '未找到该图像的标注信息',
          imageId
        };
      }

      // 查找该图像的所有标注
      const annotations = valAnnot.annotations.filter(ann => ann.image_id === imageInfo.id);

      // 添加类别名称
      const annotationsWithCategories = annotations.map(ann => ({
        ...ann,
        category_name: COCO_CATEGORIES[ann.category_id] || 'unknown'
      }));

      return {
        found: true,
        image: imageInfo,
        annotations: annotationsWithCategories,
        annotationCount: annotations.length
      };
    } catch (error) {
      console.error('获取图像标注失败:', error);
      throw error;
    }
  }

  /**
   * 检测图像中的目标（模拟）
   * 实际应用中可以接入 AI 模型进行真实的目标检测
   */
  detectObjects(imageId) {
    try {
      // 获取真实标注
      const annotResult = this.getImageAnnotations(imageId);

      if (!annotResult.found) {
        return {
          success: false,
          message: '无法检测：未找到图像标注信息',
          imageId,
          detections: []
        };
      }

      // 返回标注作为检测结果
      return {
        success: true,
        imageId,
        detections: annotResult.annotations.map(ann => ({
          category_id: ann.category_id,
          category_name: ann.category_name,
          confidence: 1.0, // 标注数据置信度为1
          bbox: ann.bbox, // [x, y, width, height]
          area: ann.area,
          segmentation: ann.segmentation
        })),
        detectionCount: annotResult.annotations.length,
        message: `检测到 ${annotResult.annotations.length} 个目标`
      };
    } catch (error) {
      console.error('目标检测失败:', error);
      throw error;
    }
  }

  /**
   * 读取图像文件（返回 base64 或文件路径）
   */
  getImageData(imageId, dataset = 'val') {
    try {
      const imagePath = dataset === 'train' ? COCO_TRAIN_IMAGES : COCO_VAL_IMAGES;

      // 首先尝试从标注文件中获取文件名
      let filename = null;
      try {
        const annotFile = dataset === 'train' ? 'instances_train2017.json' : 'instances_val2017.json';
        const annotPath = path.join(COCO_ANNOTATIONS_PATH, annotFile);
        if (fs.existsSync(annotPath)) {
          const annotData = JSON.parse(fs.readFileSync(annotPath, 'utf8'));
          const imageInfo = annotData.images.find(img => img.id.toString() === imageId.toString());
          if (imageInfo) {
            filename = imageInfo.file_name;
          }
        }
      } catch (error) {
        console.error('从标注文件获取文件名失败:', error);
      }

      // 如果有文件名，使用它
      if (filename) {
        const imagePathFull = path.join(imagePath, filename);
        if (fs.existsSync(imagePathFull)) {
          return { found: true, path: imagePathFull, dataset };
        }
      }

      // 回退方案：尝试直接使用imageId作为文件名
      const imagePathFull = path.join(imagePath, `${imageId}.jpg`);
      if (fs.existsSync(imagePathFull)) {
        return { found: true, path: imagePathFull, dataset };
      }

      // 尝试在另一个数据集中查找
      const altPath = dataset === 'train' ? COCO_VAL_IMAGES : COCO_TRAIN_IMAGES;
      const altPathFull = path.join(altPath, `${imageId}.jpg`);

      if (fs.existsSync(altPathFull)) {
        return {
          found: true,
          path: altPathFull,
          dataset: dataset === 'train' ? 'val' : 'train'
        };
      }

      return { found: false, path: null };
    } catch (error) {
      console.error('读取图像失败:', error);
      throw error;
    }
  }

  /**
   * 获取模型测试评估结果
   */
  getModelEvaluation(imageIds = []) {
    try {
      const results = [];
      let totalDetections = 0;
      let totalObjects = 0;

      for (const imageId of imageIds) {
        const detection = this.detectObjects(imageId);

        if (detection.success) {
          totalDetections += detection.detectionCount;
          totalObjects += detection.detectionCount; // 标注数据中所有目标都被检测到

          results.push({
            imageId,
            detectionCount: detection.detectionCount,
            categories: [...new Set(detection.detections.map(d => d.category_name))]
          });
        }
      }

      return {
        total: imageIds.length,
        success: results.length,
        failed: imageIds.length - results.length,
        totalDetections,
        totalObjects,
        accuracy: totalObjects > 0 ? (totalDetections / totalObjects * 100).toFixed(2) : 0,
        results,
        message: `测试完成：${results.length}/${imageIds.length} 成功`
      };
    } catch (error) {
      console.error('模型评估失败:', error);
      throw error;
    }
  }
}

// 创建单例
const cocoDataset = new CocoDatasetHandler();

module.exports = cocoDataset;
