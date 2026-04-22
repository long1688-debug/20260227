import { createRouter, createWebHashHistory } from 'vue-router';
import Home from '../views/Home.vue';
import Student from '../views/Student.vue';
import TeacherWindow from '../components/TeacherWindow.vue';
import ServerManagement from '../views/ServerManagement.vue';
import License from '../views/License.vue';
import Students from '../views/Students.vue';
import Logs from '../views/Logs.vue';
import Status from '../views/Status.vue';
import WebFeatures from '../views/WebFeatures.vue';
import AdvancedRecordingTest from '../views/AdvancedRecordingTest.vue';
import MediaMixerPage from '../views/MediaMixerPage.vue';
import MediaCodecTest from '../views/MediaCodecTest.vue';
import MindMap from '../views/MindMap.vue';

const routes = [
  { path: '/', redirect: '/teacher' },
  { path: '/student', name: 'Student', component: Student, meta: { title: '学生端' } },
  { path: '/teacher', name: 'Teacher', component: TeacherWindow, meta: { title: '教师端' } },
  { path: '/server', name: 'ServerManagement', component: ServerManagement, meta: { title: '服务端管理' } },
  { path: '/license', name: 'License', component: License, meta: { title: '注册服务器管理' } },
  { path: '/web', name: 'WebFeatures', component: WebFeatures, meta: { title: 'Web功能' } },
  { path: '/students', name: 'Students', component: Students, meta: { title: '学生管理' } },
  { path: '/logs', name: 'Logs', component: Logs, meta: { title: '系统日志' } },
  { path: '/status', name: 'Status', component: Status, meta: { title: '系统状态' } },
  { path: '/test-recording', name: 'AdvancedRecordingTest', component: AdvancedRecordingTest, meta: { title: '高级录制测试' } },
  { path: '/media-mixer', name: 'MediaMixer', component: MediaMixerPage, meta: { title: '音视频混流演示' } },
  { path: '/media-codec', name: 'MediaCodecTest', component: MediaCodecTest, meta: { title: '多路音视频编解码测试' } },
  { path: '/mindmap', name: 'MindMap', component: MindMap, meta: { title: '思维导图' } }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

// 页面标题映射
const TITLE_MAP = {
  Home: '实训教学实践系统',
  Student: '实训教学 - 学生端',
  Teacher: '实训教学 - 教师端',
  ServerManagement: '实训教学 - 服务端管理',
  License: '实训教学 - 注册服务器管理',
  Students: '实训教学 - 学生管理',
  Logs: '实训教学 - 系统日志',
  Status: '实训教学 - 系统状态',
  WebFeatures: '实训教学 - Web功能',
  AdvancedRecordingTest: '实训教学 - 高级录制测试',
  MediaMixer: '实训教学 - 音视频混流演示',
  MediaCodecTest: '实训教学 - 多路音视频编解码测试',
  MindMap: '实训教学 - 思维导图'
};

router.beforeEach((to, from, next) => {
  // 设置页面标题
  const title = to.meta.title || TITLE_MAP[to.name] || '实训教学实践系统';
  document.title = title;

  // Tauri 环境下动态设置窗口标题
  if (window.__TAURI__) {
    import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      getCurrentWindow().setTitle(title).catch(() => { });
    }).catch(() => { });
  }

  // 检查是否为学生端启动模式
  if (to.path === '/' && window.location.hash.includes('student-app')) {
    next('/student');
    return;
  }

  next();
});

export default router;
