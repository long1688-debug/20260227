/**
 * 学生管理 Store
 * 管理学生列表、在线状态、举手、远程桌面等状态
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

// 动态确定远程桌面WebSocket地址
// Vite 会在构建时将 import.meta.env 替换为静态值
const REMOTE_DESKTOP_BASE_URL = import.meta.env.VITE_APP_WS_BASE_URL ||
                                (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ?
                                  `ws://${window.location.hostname}:8080` :
                                  `ws${window.location.protocol === 'https:' ? 's' : ''}://${window.location.hostname}:${window.location.port || 8080}`);

export const useStudentStore = defineStore('student', () => {
  // ==================== State ====================

  /**
   * 学生列表
   */
  const students = ref([
    {
      id: 'S001',
      name: '张三',
      online: true,
      handRaised: true,
      remoteDesktopEnabled: false,
      cameraEnabled: false,
      audioEnabled: false,
      remoteDesktopUrl: '',
      cameraUrl: '',
      joinTime: '2024-02-28 10:00:00',
      networkQuality: 'excellent'
    },
    {
      id: 'S002',
      name: '李四',
      online: true,
      handRaised: false,
      remoteDesktopEnabled: true,
      cameraEnabled: true,
      audioEnabled: false,
      remoteDesktopUrl: `${REMOTE_DESKTOP_BASE_URL}/remote/S002`,
      cameraUrl: 'rtsp://127.0.0.1:554/camera/S002',
      joinTime: '2024-02-28 10:05:00',
      networkQuality: 'good'
    },
    {
      id: 'S003',
      name: '王五',
      online: false,
      handRaised: false,
      remoteDesktopEnabled: false,
      cameraEnabled: false,
      audioEnabled: false,
      remoteDesktopUrl: '',
      cameraUrl: '',
      joinTime: '',
      networkQuality: 'offline'
    },
    {
      id: 'S004',
      name: '赵六',
      online: true,
      handRaised: false,
      remoteDesktopEnabled: true,
      cameraEnabled: false,
      audioEnabled: true,
      remoteDesktopUrl: `${REMOTE_DESKTOP_BASE_URL}/remote/S004`,
      cameraUrl: '',
      joinTime: '2024-02-28 10:10:00',
      networkQuality: 'good'
    }
  ]);

  // ==================== Getters ====================

  /**
   * 在线学生数量
   */
  const onlineCount = computed(() => {
    return students.value.filter(s => s.online).length;
  });

  /**
   * 举手学生列表
   */
  const handRaiseList = computed(() => {
    return students.value.filter(s => s.handRaised);
  });

  /**
   * 是否有学生举手
   */
  const hasHandRaises = computed(() => {
    return handRaiseList.value.length > 0;
  });

  /**
   * 根据 ID 查找学生
   */
  function getStudentById(id) {
    return students.value.find(s => s.id === id);
  }

  /**
   * 学生总数
   */
  const totalCount = computed(() => {
    return students.value.length;
  });

  /**
   * 获取启用远程桌面的学生列表
   */
  const studentsWithRemoteDesktop = computed(() => {
    return students.value.filter(s => s.remoteDesktopEnabled);
  });

  /**
   * 获取启用摄像头的学生列表
   */
  const studentsWithCamera = computed(() => {
    return students.value.filter(s => s.cameraEnabled);
  });

  // ==================== Actions ====================

  /**
   * 添加学生
   * @param {Object} student - 学生对象 { id, name, online?, handRaised?, remoteDesktopEnabled?, cameraEnabled?, audioEnabled? }
   */
  function addStudent(student) {
    if (!student || !student.id) {
      console.error('[StudentStore] 添加学生失败：缺少必要字段');
      return false;
    }

    // 检查是否已存在
    if (students.value.some(s => s.id === student.id)) {
      console.warn(`[StudentStore] 学生 ${student.id} 已存在`);
      return false;
    }

    students.value.push({
      id: student.id,
      name: student.name,
      online: student.online ?? true,
      handRaised: student.handRaised ?? false,
      remoteDesktopEnabled: student.remoteDesktopEnabled ?? false,
      cameraEnabled: student.cameraEnabled ?? false,
      audioEnabled: student.audioEnabled ?? false,
      remoteDesktopUrl: student.remoteDesktopEnabled && !student.remoteDesktopUrl ? 
                        `${REMOTE_DESKTOP_BASE_URL}/remote/${student.id}` : 
                        (student.remoteDesktopUrl ?? ''),
      cameraUrl: student.cameraUrl ?? '',
      joinTime: student.joinTime ?? new Date().toISOString(),
      networkQuality: student.networkQuality ?? 'good'
    });

    console.log(`[StudentStore] 添加学生: ${student.name}`);
    return true;
  }

  /**
   * 移除学生
   * @param {string} studentId - 学生 ID
   */
  function removeStudent(studentId) {
    const index = students.value.findIndex(s => s.id === studentId);
    if (index === -1) {
      console.warn(`[StudentStore] 学生 ${studentId} 不存在`);
      return false;
    }

    const removed = students.value.splice(index, 1)[0];
    console.log(`[StudentStore] 移除学生: ${removed.name}`);
    return true;
  }

  /**
   * 更新学生在线状态
   * @param {string} studentId - 学生 ID
   * @param {boolean} online - 是否在线
   */
  function setStudentOnline(studentId, online) {
    const student = getStudentById(studentId);
    if (student) {
      student.online = online;
      console.log(`[StudentStore] 学生 ${student.name} 在线状态: ${online ? '在线' : '离线'}`);
    }
  }

  /**
   * 学生举手
   * @param {string} studentId - 学生 ID
   */
  function raiseHand(studentId) {
    const student = getStudentById(studentId);
    if (student) {
      student.handRaised = true;
      console.log(`[StudentStore] 学生 ${student.name} 举手`);
    }
  }

  /**
   * 取消举手
   * @param {string} studentId - 学生 ID
   */
  function lowerHand(studentId) {
    const student = getStudentById(studentId);
    if (student) {
      student.handRaised = false;
      console.log(`[StudentStore] 学生 ${student.name} 放下手`);
    }
  }

  /**
   * 清除所有举手
   */
  function clearAllHands() {
    students.value.forEach(s => {
      s.handRaised = false;
    });
    console.log('[StudentStore] 清除所有举手');
  }

  /**
   * 更新学生远程桌面状态
   * @param {string} studentId - 学生 ID
   * @param {boolean} enabled - 是否启用
   * @param {string} url - 远程桌面 URL
   */
  function setRemoteDesktopEnabled(studentId, enabled, url = '') {
    const student = getStudentById(studentId);
    if (student) {
      student.remoteDesktopEnabled = enabled;
      student.remoteDesktopUrl = enabled ? 
        (url || `${REMOTE_DESKTOP_BASE_URL}/remote/${studentId}`) : 
        (url || '');
      console.log(`[StudentStore] 学生 ${student.name} 远程桌面: ${enabled ? '已启用' : '已禁用'}`);
    }
  }

  /**
   * 更新学生摄像头状态
   * @param {string} studentId - 学生 ID
   * @param {boolean} enabled - 是否启用
   * @param {string} url - 摄像头 URL
   */
  function setCameraEnabled(studentId, enabled, url = '') {
    const student = getStudentById(studentId);
    if (student) {
      student.cameraEnabled = enabled;
      if (url) {
        student.cameraUrl = url;
      }
      console.log(`[StudentStore] 学生 ${student.name} 摄像头: ${enabled ? '已启用' : '已禁用'}`);
    }
  }

  /**
   * 更新学生音频状态
   * @param {string} studentId - 学生 ID
   * @param {boolean} enabled - 是否启用
   */
  function setAudioEnabled(studentId, enabled) {
    const student = getStudentById(studentId);
    if (student) {
      student.audioEnabled = enabled;
      console.log(`[StudentStore] 学生 ${student.name} 音频: ${enabled ? '已启用' : '已禁用'}`);
    }
  }

  /**
   * 更新学生网络质量
   * @param {string} studentId - 学生 ID
   * @param {string} quality - 网络质量 (excellent, good, poor, offline)
   */
  function updateNetworkQuality(studentId, quality) {
    const student = getStudentById(studentId);
    if (student) {
      student.networkQuality = quality;
      console.log(`[StudentStore] 学生 ${student.name} 网络质量: ${quality}`);
    }
  }

  /**
   * 更新学生信息
   * @param {string} studentId - 学生 ID
   * @param {Object} updates - 更新的字段
   */
  function updateStudent(studentId, updates) {
    const student = getStudentById(studentId);
    if (student) {
      Object.assign(student, updates);
      console.log(`[StudentStore] 更新学生 ${student.name} 信息`);
    }
  }

  /**
   * 踢出学生
   * @param {string} studentId - 学生 ID
   */
  function kickStudent(studentId) {
    const student = getStudentById(studentId);
    if (student) {
      student.online = false;
      student.joinTime = '';
      console.log(`[StudentStore] 踢出学生: ${student.name}`);
    }
  }

  /**
   * 批量更新学生列表
   * @param {Array} newStudents - 新的学生列表
   */
  function updateStudents(newStudents) {
    if (Array.isArray(newStudents)) {
      students.value = newStudents;
      console.log(`[StudentStore] 更新学生列表，共 ${newStudents.length} 人`);
    }
  }

  /**
   * 模拟获取学生列表（从服务器）
   */
  async function fetchStudents() {
    console.log('[StudentStore] 正在获取学生列表...');
    // 模拟从服务器获取数据
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('[StudentStore] 学生列表获取完成');
  }

  /**
   * 清空所有学生
   */
  function clearAll() {
    students.value = [];
    console.log('[StudentStore] 清空所有学生');
  }

  // ==================== Return ====================

  return {
    // State
    students,

    // Getters
    onlineCount,
    totalCount,
    handRaiseList,
    hasHandRaises,
    studentsWithRemoteDesktop,
    studentsWithCamera,
    getStudentById,

    // Actions
    addStudent,
    removeStudent,
    setStudentOnline,
    raiseHand,
    lowerHand,
    clearAllHands,
    setRemoteDesktopEnabled,
    setCameraEnabled,
    setAudioEnabled,
    updateNetworkQuality,
    updateStudent,
    kickStudent,
    updateStudents,
    fetchStudents,
    clearAll
  };
});
