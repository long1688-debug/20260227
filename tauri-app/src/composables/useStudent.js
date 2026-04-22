import { computed } from 'vue'
import { useStudentStore } from '@/stores/studentStore'
import apiService from '@/services/apiService'

export function useStudent() {
  const studentStore = useStudentStore()

  const students = computed(() => studentStore.students)
  const onlineStudents = computed(() => studentStore.students.filter(s => s.status === 'online'))
  const onlineCount = computed(() => studentStore.onlineCount)
  const totalCount = computed(() => studentStore.totalCount)
  const studentsWithRemoteDesktop = computed(() => studentStore.studentsWithRemoteDesktop)
  const studentsWithCamera = computed(() => studentStore.studentsWithCamera)

  const fetchStudents = async () => {
    await studentStore.fetchStudents()
  }

  const addStudent = async (studentData) => {
    await studentStore.addStudent(studentData)
  }

  const updateStudent = async (id, updates) => {
    await studentStore.updateStudent(id, updates)
  }

  const removeStudent = async (id) => {
    await studentStore.removeStudent(id)
  }

  const kickStudent = async (id) => {
    await studentStore.kickStudent(id)
  }

  const getStudentById = (id) => {
    return studentStore.students.find(s => s.id === id)
  }

  const getOnlineStudents = () => {
    return studentStore.students.filter(s => s.status === 'online')
  }

  // ============ 远程桌面相关方法 ============

  /**
   * 设置学生远程桌面状态
   * @param {string} studentId - 学生 ID
   * @param {boolean} enabled - 是否启用
   * @param {string} url - 远程桌面 URL（可选）
   */
  const setRemoteDesktopEnabled = (studentId, enabled, url = '') => {
    studentStore.setRemoteDesktopEnabled(studentId, enabled, url)
  }

  /**
   * 设置学生摄像头状态
   * @param {string} studentId - 学生 ID
   * @param {boolean} enabled - 是否启用
   * @param {string} url - 摄像头 URL（可选）
   */
  const setCameraEnabled = (studentId, enabled, url = '') => {
    studentStore.setCameraEnabled(studentId, enabled, url)
  }

  /**
   * 设置学生音频状态
   * @param {string} studentId - 学生 ID
   * @param {boolean} enabled - 是否启用
   */
  const setAudioEnabled = (studentId, enabled) => {
    studentStore.setAudioEnabled(studentId, enabled)
  }

  /**
   * 从服务器获取学生远程桌面状态
   * @param {string} studentId - 学生 ID
   */
  const fetchRemoteDesktopStatus = async (studentId) => {
    try {
      const result = await apiService.getRemoteDesktopStatus(studentId)
      if (result.data) {
        studentStore.updateStudent(studentId, {
          remoteDesktopEnabled: result.data.desktopEnabled,
          cameraEnabled: result.data.cameraEnabled,
          audioEnabled: result.data.audioEnabled,
          remoteDesktopUrl: result.data.desktopUrl,
          cameraUrl: result.data.cameraUrl
        })
      }
      return result
    } catch (error) {
      console.error('获取远程桌面状态失败:', error)
      throw error
    }
  }

  /**
   * 获取学生远程桌面流 URL
   * @param {string} studentId - 学生 ID
   */
  const getRemoteDesktopUrl = async (studentId) => {
    try {
      const result = await apiService.getRemoteDesktopUrl(studentId)
      if (result.url) {
        studentStore.setRemoteDesktopEnabled(studentId, true, result.url)
      }
      return result.url
    } catch (error) {
      console.error('获取远程桌面 URL 失败:', error)
      throw error
    }
  }

  /**
   * 获取学生摄像头流 URL
   * @param {string} studentId - 学生 ID
   */
  const getCameraUrl = async (studentId) => {
    try {
      const result = await apiService.getCameraUrl(studentId)
      if (result.url) {
        studentStore.setCameraEnabled(studentId, true, result.url)
      }
      return result.url
    } catch (error) {
      console.error('获取摄像头 URL 失败:', error)
      throw error
    }
  }

  /**
   * 切换学生远程桌面状态（通过 API）
   * @param {string} studentId - 学生 ID
   * @param {boolean} enabled - 是否启用
   */
  const toggleRemoteDesktop = async (studentId, enabled) => {
    try {
      await apiService.toggleRemoteDesktop(studentId, enabled)
      studentStore.setRemoteDesktopEnabled(studentId, enabled)
    } catch (error) {
      console.error('切换远程桌面状态失败:', error)
      throw error
    }
  }

  /**
   * 切换学生摄像头状态（通过 API）
   * @param {string} studentId - 学生 ID
   * @param {boolean} enabled - 是否启用
   */
  const toggleCamera = async (studentId, enabled) => {
    try {
      await apiService.toggleCamera(studentId, enabled)
      studentStore.setCameraEnabled(studentId, enabled)
    } catch (error) {
      console.error('切换摄像头状态失败:', error)
      throw error
    }
  }

  /**
   * 切换学生音频状态（通过 API）
   * @param {string} studentId - 学生 ID
   * @param {boolean} enabled - 是否启用
   */
  const toggleAudio = async (studentId, enabled) => {
    try {
      await apiService.toggleAudio(studentId, enabled)
      studentStore.setAudioEnabled(studentId, enabled)
    } catch (error) {
      console.error('切换音频状态失败:', error)
      throw error
    }
  }

  /**
   * 获取所有学生远程桌面状态
   */
  const fetchAllRemoteDesktopStatus = async () => {
    try {
      const result = await apiService.getAllRemoteDesktopStatus()
      if (result.data && Array.isArray(result.data)) {
        result.data.forEach(studentStatus => {
          studentStore.updateStudent(studentStatus.studentId, {
            remoteDesktopEnabled: studentStatus.desktopEnabled,
            cameraEnabled: studentStatus.cameraEnabled,
            audioEnabled: studentStatus.audioEnabled,
            remoteDesktopUrl: studentStatus.desktopUrl,
            cameraUrl: studentStatus.cameraUrl
          })
        })
      }
      return result
    } catch (error) {
      console.error('获取所有远程桌面状态失败:', error)
      throw error
    }
  }

  /**
   * 强制开启学生远程桌面（教师权限）
   * @param {string} studentId - 学生 ID
   */
  const forceRemoteDesktop = async (studentId) => {
    try {
      const result = await apiService.forceRemoteDesktop(studentId)
      if (result.success) {
        studentStore.setRemoteDesktopEnabled(studentId, true, result.url)
      }
      return result
    } catch (error) {
      console.error('强制开启远程桌面失败:', error)
      throw error
    }
  }

  return {
    // 基础状态和方法
    students,
    onlineStudents,
    onlineCount,
    totalCount,
    studentsWithRemoteDesktop,
    studentsWithCamera,
    fetchStudents,
    addStudent,
    updateStudent,
    removeStudent,
    kickStudent,
    getStudentById,
    getOnlineStudents,

    // 远程桌面相关方法
    setRemoteDesktopEnabled,
    setCameraEnabled,
    setAudioEnabled,
    fetchRemoteDesktopStatus,
    getRemoteDesktopUrl,
    getCameraUrl,
    toggleRemoteDesktop,
    toggleCamera,
    toggleAudio,
    fetchAllRemoteDesktopStatus,
    forceRemoteDesktop
  }
}
