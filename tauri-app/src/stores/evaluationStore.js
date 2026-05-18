/**
 * Evaluation Store - 人工智能评估系统
 * 提供完整的评估管理、评分计算和结果分析功能
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useVisionStore } from '@/stores/visionStore';

export const useEvaluationStore = defineStore('evaluation', () => {
  // 状态
  const evaluations = ref([]);
  const currentEvaluationId = ref(null);
  const loading = ref(false);
  const error = ref(null);
  
  // 评估配置
  const config = ref({
    // 专注度权重
    attentionWeight: 0.3,
    // 情绪权重
    emotionWeight: 0.2,
    // 参与度权重
    participationWeight: 0.3,
    // 行为分析权重
    behaviorWeight: 0.2,
    // 评估周期（秒）
    evaluationInterval: 30,
    // 历史记录保留数量
    maxHistory: 100
  });

  // 当前评估会话
  const currentSession = ref(null);
  const sessionResults = ref([]);
  const sessionScore = ref(0);

  // 计算属性
  const currentEvaluation = computed(() => {
    return evaluations.value.find(e => e.id === currentEvaluationId.value) || null;
  });

  const recentEvaluations = computed(() => {
    return [...evaluations.value].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    ).slice(0, 10);
  });

  const averageScore = computed(() => {
    if (evaluations.value.length === 0) return 0;
    const total = evaluations.value.reduce((sum, e) => sum + (e.score || 0), 0);
    return Math.round(total / evaluations.value.length);
  });

  /**
   * 获取或创建评估会话
   */
  const getOrCreateSession = (sessionId) => {
    if (!currentSession.value || currentSession.value.id !== sessionId) {
      currentSession.value = {
        id: sessionId || `session_${Date.now()}`,
        startTime: Date.now(),
        lastUpdate: Date.now(),
        status: 'active'
      };
      sessionResults.value = [];
      sessionScore.value = 0;
    }
    return currentSession.value;
  };

  /**
   * 添加评估帧结果
   */
  const addFrameResult = (frameData) => {
    if (!currentSession.value) {
      getOrCreateSession();
    }

    const result = {
      id: Date.now(),
      timestamp: Date.now(),
      ...frameData
    };

    sessionResults.value.push(result);
    
    // 保持历史记录在限制范围内
    if (sessionResults.value.length > config.value.maxHistory) {
      sessionResults.value.shift();
    }

    // 更新会话时间
    currentSession.value.lastUpdate = Date.now();

    // 重新计算分数
    recalculateSessionScore();

    return result;
  };

  /**
   * 重新计算会话分数
   */
  const recalculateSessionScore = () => {
    if (sessionResults.value.length === 0) {
      sessionScore.value = 0;
      return;
    }

    let totalScore = 0;
    let count = 0;

    for (const result of sessionResults.value) {
      const score = calculateFrameScore(result);
      totalScore += score;
      count++;
    }

    sessionScore.value = Math.round(totalScore / count);
  };

  /**
   * 计算单帧分数
   */
  const calculateFrameScore = (frameData) => {
    const { attention, emotions, objects, faces } = frameData;
    
    let score = 0;

    // 专注度分数 (0-100)
    const attentionScore = attention || 50;
    score += attentionScore * config.value.attentionWeight;

    // 情绪分数 - 积极情绪加分
    if (emotions && emotions.length > 0) {
      let emotionScore = 50;
      for (const face of emotions) {
        const dominantEmotion = face.dominantEmotion;
        if (dominantEmotion === '专注' || dominantEmotion === '开心') {
          emotionScore += 25;
        } else if (dominantEmotion === '困惑' || dominantEmotion === '疲劳') {
          emotionScore -= 15;
        }
      }
      emotionScore = Math.max(0, Math.min(100, emotionScore));
      score += emotionScore * config.value.emotionWeight;
    }

    // 参与度分数 - 基于人脸数量和姿态
    if (faces && faces.length > 0) {
      const participationScore = faces.length === 1 ? 80 : 
                                faces.length > 1 ? 60 : 40;
      score += participationScore * config.value.participationWeight;
    }

    // 行为分析分数 - 检测到的物体是否符合预期
    if (objects && objects.length > 0) {
      // 如果检测到手机等可能分散注意力的物体，扣分
      const distractionObjects = ['cell phone', 'laptop', 'tv'];
      let behaviorScore = 80;
      for (const obj of objects) {
        if (distractionObjects.includes(obj.label.toLowerCase())) {
          behaviorScore -= 20;
        }
      }
      behaviorScore = Math.max(0, Math.min(100, behaviorScore));
      score += behaviorScore * config.value.behaviorWeight;
    }

    return Math.round(score);
  };

  /**
   * 完成评估会话
   */
  const completeSession = (metadata = {}) => {
    if (!currentSession.value) return null;

    const evaluation = {
      id: currentSession.value.id,
      createdAt: new Date().toISOString(),
      startTime: new Date(currentSession.value.startTime).toISOString(),
      duration: Date.now() - currentSession.value.startTime,
      score: sessionScore.value,
      totalFrames: sessionResults.value.length,
      status: 'completed',
      metadata: {
        ...metadata,
        config: { ...config.value }
      },
      summary: generateSummary()
    };

    evaluations.value.push(evaluation);
    currentEvaluationId.value = evaluation.id;

    // 保存到本地存储
    saveToLocalStorage();

    const result = { ...evaluation };
    resetSession();
    return result;
  };

  /**
   * 生成评估摘要
   */
  const generateSummary = () => {
    if (sessionResults.value.length === 0) {
      return {
        averageAttention: 0,
        dominantEmotion: '未知',
        objectCount: 0,
        faceCount: 0,
        issues: []
      };
    }

    let totalAttention = 0;
    const emotionCounts = {};
    const objectCounts = {};
    let totalFaces = 0;
    const issues = [];

    for (const result of sessionResults.value) {
      totalAttention += result.attention || 0;
      totalFaces += result.faces?.length || 0;

      // 统计情绪
      if (result.emotions && result.emotions.length > 0) {
        for (const face of result.emotions) {
          const emotion = face.dominantEmotion;
          emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
        }
      }

      // 统计物体
      if (result.objects && result.objects.length > 0) {
        for (const obj of result.objects) {
          objectCounts[obj.label] = (objectCounts[obj.label] || 0) + 1;
        }
      }
    }

    // 找出主导情绪
    let dominantEmotion = '未知';
    let maxCount = 0;
    for (const [emotion, count] of Object.entries(emotionCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantEmotion = emotion;
      }
    }

    // 检测问题
    const avgAttention = totalAttention / sessionResults.value.length;
    if (avgAttention < 50) {
      issues.push('整体专注度较低');
    }
    if (emotionCounts['疲劳'] && emotionCounts['疲劳'] > sessionResults.value.length * 0.3) {
      issues.push('检测到明显疲劳迹象');
    }
    if (objectCounts['cell phone'] && objectCounts['cell phone'] > sessionResults.value.length * 0.2) {
      issues.push('频繁检测到手机使用');
    }

    return {
      averageAttention: Math.round(avgAttention),
      dominantEmotion,
      objectCount: Object.keys(objectCounts).length,
      faceCount: Math.round(totalFaces / sessionResults.value.length),
      issues
    };
  };

  /**
   * 重置会话
   */
  const resetSession = () => {
    currentSession.value = null;
    sessionResults.value = [];
    sessionScore.value = 0;
  };

  /**
   * 从视觉分析更新评估
   */
  const updateFromVisionAnalysis = (analysisResult) => {
    const frameData = {
      attention: analysisResult.attention || analysisResult.attentionScore || 0,
      emotions: analysisResult.emotions || [],
      objects: analysisResult.objects || [],
      faces: analysisResult.faces || [],
      timestamp: analysisResult.timestamp || Date.now()
    };
    return addFrameResult(frameData);
  };

  /**
   * 批量评估 COCO 数据集
   */
  const evaluateCocoDataset = async (maxImages = 50) => {
    const visionStore = useVisionStore();
    
    // 确保模型已加载
    if (visionStore.yoloStatus !== 'ready') {
      await visionStore.preloadYoloModel();
    }

    // 加载 COCO 数据集
    const images = await visionStore.loadCocoDatasetImages(true);
    if (images.length === 0) {
      console.warn('[EvaluationStore] 未找到 COCO 数据集图片');
      return null;
    }

    const results = [];
    let totalScore = 0;
    let correctDetections = 0;

    const testImages = images.slice(0, Math.min(maxImages, images.length));

    for (let i = 0; i < testImages.length; i++) {
      const img = testImages[i];
      try {
        const analysis = await visionStore.analyzeCocoImage(img.fullPath || img.path);
        
        const detectedObjects = analysis.objects || [];
        const hasObjects = detectedObjects.length > 0;
        
        // 简化的评估：只要检测到物体就算成功
        const score = hasObjects ? 100 : 0;
        
        results.push({
          imageName: img.name,
          detectedObjects: detectedObjects,
          score,
          confidence: detectedObjects[0]?.confidence || 0
        });

        if (hasObjects) correctDetections++;
        totalScore += score;

        console.log(`[EvaluationStore] COCO 评估进度: ${i + 1}/${testImages.length}`);
      } catch (error) {
        results.push({
          imageName: img.name,
          error: error.message,
          score: 0
        });
      }
    }

    const accuracy = Math.round((correctDetections / testImages.length) * 100);
    
    const evaluation = {
      id: `coco_eval_${Date.now()}`,
      type: 'coco_dataset',
      createdAt: new Date().toISOString(),
      totalImages: testImages.length,
      correctDetections,
      accuracy,
      averageScore: Math.round(totalScore / testImages.length),
      results
    };

    evaluations.value.push(evaluation);
    saveToLocalStorage();

    return evaluation;
  };

  /**
   * 获取评估详情
   */
  const getEvaluationById = (evaluationId) => {
    return evaluations.value.find(e => e.id === evaluationId) || null;
  };

  /**
   * 获取评估统计
   */
  const getStatistics = () => {
    const completed = evaluations.value.filter(e => e.status === 'completed');
    const inProgress = evaluations.value.filter(e => e.status === 'active');
    
    return {
      total: evaluations.value.length,
      completed: completed.length,
      inProgress: inProgress.length,
      averageScore: completed.length > 0
        ? Math.round(completed.reduce((sum, e) => sum + (e.score || 0), 0) / completed.length)
        : 0,
      recentActivity: completed.slice(-7)
    };
  };

  /**
   * 设置评估配置
   */
  const setConfig = (newConfig) => {
    config.value = { ...config.value, ...newConfig };
    saveConfigToLocalStorage();
  };

  /**
   * 获取评估配置
   */
  const getConfig = () => {
    return { ...config.value };
  };

  /**
   * 保存到本地存储
   */
  const saveToLocalStorage = () => {
    try {
      localStorage.setItem('evaluations', JSON.stringify(evaluations.value));
    } catch (error) {
      console.warn('[EvaluationStore] 保存到本地存储失败:', error);
    }
  };

  /**
   * 从本地存储加载
   */
  const loadFromLocalStorage = () => {
    try {
      const saved = localStorage.getItem('evaluations');
      if (saved) {
        evaluations.value = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('[EvaluationStore] 从本地存储加载失败:', error);
    }
  };

  /**
   * 保存配置到本地存储
   */
  const saveConfigToLocalStorage = () => {
    try {
      localStorage.setItem('evaluationConfig', JSON.stringify(config.value));
    } catch (error) {
      console.warn('[EvaluationStore] 保存配置失败:', error);
    }
  };

  /**
   * 从本地存储加载配置
   */
  const loadConfigFromLocalStorage = () => {
    try {
      const saved = localStorage.getItem('evaluationConfig');
      if (saved) {
        config.value = { ...config.value, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn('[EvaluationStore] 加载配置失败:', error);
    }
  };

  /**
   * 初始化
   */
  const init = () => {
    loadFromLocalStorage();
    loadConfigFromLocalStorage();
  };

  return {
    // State
    evaluations,
    currentEvaluationId,
    currentEvaluation,
    loading,
    error,
    config,
    currentSession,
    sessionResults,
    sessionScore,
    recentEvaluations,
    averageScore,

    // Actions
    init,
    getOrCreateSession,
    addFrameResult,
    completeSession,
    resetSession,
    updateFromVisionAnalysis,
    evaluateCocoDataset,
    getEvaluationById,
    getStatistics,
    setConfig,
    getConfig,
    saveToLocalStorage,
    loadFromLocalStorage
  };
});