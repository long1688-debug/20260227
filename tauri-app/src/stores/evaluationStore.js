/**
 * Evaluation Store - 评价/评估管理
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useEvaluationStore = defineStore('evaluation', () => {
  // 状态
  const evaluations = ref([]);
  const currentEvaluationId = ref(null);
  const loading = ref(false);
  const error = ref(null);

  // Actions
  const fetchEvaluations = async () => {
    loading.value = true;
    error.value = null;
    try {
      // TODO: 从 API 获取评价列表
      const response = await fetch('/api/evaluations');
      const data = await response.json();
      evaluations.value = data;
    } catch (err) {
      error.value = err.message;
      console.error('[EvaluationStore] 获取评价列表失败:', err);
    } finally {
      loading.value = false;
    }
  };

  const selectEvaluation = (evaluationId) => {
    currentEvaluationId.value = evaluationId;
    console.log('[EvaluationStore] 选择评价:', evaluationId);
  };

  const addEvaluation = (evaluationData) => {
    evaluations.value.push(evaluationData);
    console.log('[EvaluationStore] 添加评价:', evaluationData);
  };

  const updateEvaluation = (evaluationId, updates) => {
    const index = evaluations.value.findIndex(e => e.id === evaluationId);
    if (index !== -1) {
      evaluations.value[index] = { ...evaluations.value[index], ...updates };
      console.log('[EvaluationStore] 更新评价:', evaluationId, updates);
    }
  };

  const deleteEvaluation = (evaluationId) => {
    const index = evaluations.value.findIndex(e => e.id === evaluationId);
    if (index !== -1) {
      evaluations.value.splice(index, 1);
      console.log('[EvaluationStore] 删除评价:', evaluationId);
    }
  };

  return {
    // State
    evaluations,
    currentEvaluationId,
    loading,
    error,

    // Actions
    fetchEvaluations,
    selectEvaluation,
    addEvaluation,
    updateEvaluation,
    deleteEvaluation
  };
});
