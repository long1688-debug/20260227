/**
 * 教师端功能集成 - 完善学生、班级、任务、评估和视觉分析功能
 */

import { ElMessage, ElMessageBox } from 'element-plus';

/**
 * 学生管理功能集成
 */
export function integrateStudentManagement(componentContext) {
  const { studentStore, addLog } = componentContext;

  // 加载学生
  const loadStudents = async (classId = null) => {
    const success = await studentStore.loadStudents(classId);
    if (success) {
      addLog('success', '学生列表加载成功');
    } else {
      addLog('error', '学生列表加载失败');
      ElMessage.error('加载学生列表失败');
    }
    return success;
  };

  // 添加学生
  const addStudent = async (studentData) => {
    const result = await studentStore.addStudent(studentData);
    if (result.success) {
      addLog('success', `学生 ${result.data.name} 添加成功`);
      ElMessage.success('添加学生成功');
    } else {
      addLog('error', `添加学生失败：${result.message}`);
      ElMessage.error(result.message);
    }
    return result;
  };

  // 更新学生
  const updateStudent = async (id, studentData) => {
    const result = await studentStore.updateStudent(id, studentData);
    if (result.success) {
      addLog('success', `学生信息更新成功`);
      ElMessage.success('更新成功');
    } else {
      addLog('error', `更新学生失败：${result.message}`);
      ElMessage.error(result.message);
    }
    return result;
  };

  // 删除学生
  const deleteStudent = async (id) => {
    try {
      await ElMessageBox.confirm('确定要删除该学生吗？', '提示', {
        type: 'warning'
      });
    } catch {
      return false;
    }

    const success = await studentStore.deleteStudent(id);
    if (success) {
      addLog('success', '学生删除成功');
      ElMessage.success('删除成功');
    } else {
      addLog('error', '删除学生失败');
      ElMessage.error('删除失败');
    }
    return success;
  };

  // 踢出学生
  const kickStudent = async (student) => {
    try {
      await ElMessageBox.confirm(`确定要移出 ${student.name} 吗？`, '提示', {
        type: 'warning'
      });
    } catch {
      return;
    }

    try {
      const result = await studentStore.deleteStudent(student.id);
      if (result) {
        addLog('success', `学生 ${student.name} 已被移出`);
        ElMessage.success('已移出');
      }
    } catch (error) {
      addLog('error', `移出学生失败：${error.message}`);
      ElMessage.error('移出失败');
    }
  };

  // 回应举手
  const answerHand = async (student) => {
    const result = await studentStore.lowerHand(student.id);
    if (result) {
      addLog('success', `已回应 ${student.name} 的举手`);
      ElMessage.success('已回应');
    }
    return result;
  };

  // 查看学生详情
  const viewStudentDetail = async (student) => {
    addLog('info', `查看学生详情：${student.name}`);
    // 显示详情对话框
    return student;
  };

  return {
    loadStudents,
    addStudent,
    updateStudent,
    deleteStudent,
    kickStudent,
    answerHand,
    viewStudentDetail
  };
}

/**
 * 班级管理功能集成
 */
export function integrateClassManagement(componentContext) {
  const { classStore, addLog } = componentContext;

  // 加载班级
  const loadClasses = async () => {
    const success = await classStore.loadClasses();
    if (success) {
      addLog('success', '班级列表加载成功');
    } else {
      addLog('error', '班级列表加载失败');
      ElMessage.error('加载班级列表失败');
    }
    return success;
  };

  // 创建班级
  const createClass = async (classData) => {
    const result = await classStore.createClass(classData);
    if (result.success) {
      addLog('success', `班级 ${result.data.name} 创建成功`);
      ElMessage.success('创建成功');
    } else {
      addLog('error', `创建班级失败：${result.message}`);
      ElMessage.error(result.message);
    }
    return result;
  };

  // 更新班级
  const updateClass = async (id, classData) => {
    const result = await classStore.updateClass(id, classData);
    if (result.success) {
      addLog('success', '班级信息更新成功');
      ElMessage.success('更新成功');
    } else {
      addLog('error', `更新班级失败：${result.message}`);
      ElMessage.error(result.message);
    }
    return result;
  };

  // 删除班级
  const deleteClass = async (id) => {
    try {
      await ElMessageBox.confirm('确定要删除该班级吗？', '提示', {
        type: 'warning'
      });
    } catch {
      return false;
    }

    const success = await classStore.deleteClass(id);
    if (success) {
      addLog('success', '班级删除成功');
      ElMessage.success('删除成功');
    } else {
      addLog('error', '删除班级失败');
      ElMessage.error('删除失败');
    }
    return success;
  };

  // 查看班级详情
  const viewClassDetail = async (cls) => {
    addLog('info', `查看班级详情：${cls.name}`);
    return cls;
  };

  return {
    loadClasses,
    createClass,
    updateClass,
    deleteClass,
    viewClassDetail
  };
}

/**
 * 任务管理功能集成
 */
export function integrateTaskManagement(componentContext) {
  const { taskStore, addLog } = componentContext;

  // 加载任务
  const loadTasks = async (classId = null) => {
    const success = await taskStore.loadTasks(classId);
    if (success) {
      addLog('success', '任务列表加载成功');
    } else {
      addLog('error', '任务列表加载失败');
      ElMessage.error('加载任务列表失败');
    }
    return success;
  };

  // 创建任务
  const createTask = async (taskData) => {
    const result = await taskStore.createTask(taskData);
    if (result.success) {
      addLog('success', `任务 ${result.data.title} 创建成功`);
      ElMessage.success('任务发布成功');
    } else {
      addLog('error', `创建任务失败：${result.message}`);
      ElMessage.error(result.message);
    }
    return result;
  };

  // 更新任务
  const updateTask = async (id, taskData) => {
    const result = await taskStore.updateTask(id, taskData);
    if (result.success) {
      addLog('success', '任务更新成功');
      ElMessage.success('更新成功');
    } else {
      addLog('error', `更新任务失败：${result.message}`);
      ElMessage.error(result.message);
    }
    return result;
  };

  // 删除任务
  const deleteTask = async (id) => {
    try {
      await ElMessageBox.confirm('确定要删除该任务吗？', '提示', {
        type: 'warning'
      });
    } catch {
      return false;
    }

    const success = await taskStore.deleteTask(id);
    if (success) {
      addLog('success', '任务删除成功');
      ElMessage.success('删除成功');
    } else {
      addLog('error', '删除任务失败');
      ElMessage.error('删除失败');
    }
    return success;
  };

  // 查看任务详情
  const viewTaskDetail = async (task) => {
    addLog('info', `查看任务详情：${task.title}`);
    return task;
  };

  // 批改任务
  const gradeTask = async (taskId, studentId, gradeData) => {
    const result = await taskStore.gradeTask(taskId, studentId, gradeData);
    if (result.success) {
      addLog('success', '任务批改成功');
      ElMessage.success('批改成功');
    } else {
      addLog('error', `批改失败：${result.message}`);
      ElMessage.error(result.message);
    }
    return result;
  };

  return {
    loadTasks,
    createTask,
    updateTask,
    deleteTask,
    viewTaskDetail,
    gradeTask
  };
}

/**
 * 评估功能集成
 */
export function integrateEvaluationManagement(componentContext) {
  const { evaluationStore, addLog } = componentContext;

  // 加载评估
  const loadEvaluations = async (studentId = null) => {
    const success = await evaluationStore.loadEvaluations(studentId);
    if (success) {
      addLog('success', '评估列表加载成功');
    } else {
      addLog('error', '评估列表加载失败');
      ElMessage.error('加载评估列表失败');
    }
    return success;
  };

  // 创建评估
  const createEvaluation = async (evaluationData) => {
    const result = await evaluationStore.createEvaluation(evaluationData);
    if (result.success) {
      addLog('success', '评估创建成功');
      ElMessage.success('评估成功');
    } else {
      addLog('error', `创建评估失败：${result.message}`);
      ElMessage.error(result.message);
    }
    return result;
  };

  // 更新评估
  const updateEvaluation = async (id, evaluationData) => {
    const result = await evaluationStore.updateEvaluation(id, evaluationData);
    if (result.success) {
      addLog('success', '评估更新成功');
      ElMessage.success('更新成功');
    } else {
      addLog('error', `更新评估失败：${result.message}`);
      ElMessage.error(result.message);
    }
    return result;
  };

  // 删除评估
  const deleteEvaluation = async (id) => {
    try {
      await ElMessageBox.confirm('确定要删除该评估吗？', '提示', {
        type: 'warning'
      });
    } catch {
      return false;
    }

    const success = await evaluationStore.deleteEvaluation(id);
    if (success) {
      addLog('success', '评估删除成功');
      ElMessage.success('删除成功');
    } else {
      addLog('error', '删除评估失败');
      ElMessage.error('删除失败');
    }
    return success;
  };

  // 查看评估详情
  const viewEvaluationDetail = async (evaluation) => {
    addLog('info', `查看评估详情`);
    return evaluation;
  };

  return {
    loadEvaluations,
    createEvaluation,
    updateEvaluation,
    deleteEvaluation,
    viewEvaluationDetail
  };
}

/**
 * 视觉分析功能集成
 */
export function integrateVisionAnalysis(componentContext) {
  const { visionStore, addLog } = componentContext;

  // 开始分析
  const startAnalysis = async (studentId = null) => {
    try {
      await ElMessageBox.confirm(
        '将启动 AI 视觉分析系统，分析学生上课专注度和行为，是否继续？',
        '开始分析',
        {
          confirmButtonText: '开始',
          cancelButtonText: '取消',
          type: 'info'
        }
      );
    } catch {
      return null;
    }

    const result = await visionStore.startAnalysis(studentId);
    if (result.success) {
      addLog('success', '视觉分析已启动');
      ElMessage.success('分析已启动');
    } else {
      addLog('error', `视觉分析失败：${result.message}`);
      ElMessage.error(result.message);
    }
    return result;
  };

  // 加载分析历史
  const loadVisionHistory = async (startDate, endDate) => {
    const success = await visionStore.loadVisionHistory(startDate, endDate);
    if (success) {
      addLog('success', '分析历史加载成功');
    } else {
      addLog('error', '分析历史加载失败');
      ElMessage.error('加载失败');
    }
    return success;
  };

  // 清除分析结果
  const clearAnalysisResults = () => {
    visionStore.clearResults();
    addLog('info', '分析结果已清除');
  };

  return {
    startAnalysis,
    loadVisionHistory,
    clearAnalysisResults
  };
}

export default {
  integrateStudentManagement,
  integrateClassManagement,
  integrateTaskManagement,
  integrateEvaluationManagement,
  integrateVisionAnalysis
};
