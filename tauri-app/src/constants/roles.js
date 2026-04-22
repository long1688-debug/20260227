// 角色权限配置
export const ROLES = {
  ADMIN: 'admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
  ASSISTANT: 'assistant',
  GUEST: 'guest'
}

// 角色标签映射
export const ROLE_LABELS = {
  [ROLES.ADMIN]: '管理员',
  [ROLES.TEACHER]: '教师',
  [ROLES.STUDENT]: '学生',
  [ROLES.ASSISTANT]: '助教',
  [ROLES.GUEST]: '访客'
}

// 角色权限
export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: ['all'],
  [ROLES.TEACHER]: [
    'view_all_videos',
    'manage_students',
    'start_recording',
    'stop_recording',
    'manage_tasks',
    'manage_trainings',
    'use_annotation',
    'generate_subtitle',
    'start_livestream'
  ],
  [ROLES.STUDENT]: [
    'view_assigned_videos',
    'submit_tasks',
    'participate_training',
    'raise_hand',
    'chat'
  ],
  [ROLES.ASSISTANT]: [
    'view_all_videos',
    'manage_students',
    'start_recording',
    'stop_recording',
    'use_annotation'
  ],
  [ROLES.GUEST]: [
    'view_public_videos'
  ]
}

// 检查是否有权限
export function hasPermission(role, permission) {
  const permissions = ROLE_PERMISSIONS[role]
  return permissions.includes('all') || permissions.includes(permission)
}

// 获取角色列表
export function getRoleList() {
  return Object.keys(ROLES).map(key => ({
    value: ROLES[key],
    label: ROLE_LABELS[ROLES[key]]
  }))
}
