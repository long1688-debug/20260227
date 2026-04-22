/**
 * Class Store - 班级/课堂管理
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useClassStore = defineStore('class', () => {
  // 状态
  const classes = ref([]);
  const currentClassId = ref(null);
  const loading = ref(false);
  const error = ref(null);

  // Actions
  const fetchClasses = async () => {
    loading.value = true;
    error.value = null;
    try {
      // TODO: 从 API 获取班级列表
      const response = await fetch('/api/classes');
      const data = await response.json();
      classes.value = data;
    } catch (err) {
      error.value = err.message;
      console.error('[ClassStore] 获取班级列表失败:', err);
    } finally {
      loading.value = false;
    }
  };

  const selectClass = (classId) => {
    currentClassId.value = classId;
    console.log('[ClassStore] 选择班级:', classId);
  };

  const addClass = (classData) => {
    classes.value.push(classData);
    console.log('[ClassStore] 添加班级:', classData);
  };

  const updateClass = (classId, updates) => {
    const index = classes.value.findIndex(c => c.id === classId);
    if (index !== -1) {
      classes.value[index] = { ...classes.value[index], ...updates };
      console.log('[ClassStore] 更新班级:', classId, updates);
    }
  };

  const deleteClass = (classId) => {
    const index = classes.value.findIndex(c => c.id === classId);
    if (index !== -1) {
      classes.value.splice(index, 1);
      console.log('[ClassStore] 删除班级:', classId);
    }
  };

  return {
    // State
    classes,
    currentClassId,
    loading,
    error,

    // Actions
    fetchClasses,
    selectClass,
    addClass,
    updateClass,
    deleteClass
  };
});
