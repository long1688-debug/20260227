import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/dist/locale/zh-cn.mjs';
import App from './App.vue';
import router from './router';
// 🎯 注意：自定义样式必须在 Element Plus 样式之后引入，才能正确覆盖默认样式
import 'element-plus/dist/index.css';
// 🎯 深色主题覆盖样式 - 必须在 Element Plus 样式之后引入
import './styles/dark-theme-overrides.scss';
// 🎯 弹窗深色主题样式 - 必须在 Element Plus 样式之后引入
import './styles/dialog-dark-theme.scss';
import './styles/main.scss';

const app = createApp(App);
const pinia = createPinia();

// 🎯 添加全局错误捕获，防止未处理错误导致页面崩溃
window.addEventListener('unhandledrejection', (event) => {
  console.error('[全局错误] 未处理的Promise拒绝:', event.reason);
  // 阻止默认的浏览器行为（如控制台错误）
  event.preventDefault();
});

window.addEventListener('error', (event) => {
  console.error('[全局错误] 运行时错误:', event.error);
  // 阻止错误冒泡，防止页面崩溃
  event.preventDefault();
});

app.use(pinia);
app.use(router);
app.use(ElementPlus, { locale: zhCn });

// 🎯 Vue级别错误处理
app.config.errorHandler = (err, instance, info) => {
  console.error('[Vue错误] 组件错误:', err);
  console.error('[Vue错误] 错误信息:', info);
  // 不抛出错误，防止应用崩溃
};

app.mount('#app');

// 开发模式下自动打开 DevTools
if (import.meta.env.DEV) {
  // 过滤开发环境冗余日志
  const originalWarn = console.warn;
  console.warn = (...args) => {
    // 过滤 ElTag 的无效属性警告（高频重复）
    if (args[0]?.includes?.('Invalid prop') && args[0]?.includes?.('ElTag')) {
      if (!window._elTagWarned) {
        window._elTagWarned = true;
        originalWarn.apply(console, args);
      }
      return;
    }
    originalWarn.apply(console, args);
  };

  import('@tauri-apps/api/window').then(({ WebviewWindow }) => {
    const currentWindow = WebviewWindow.getCurrent();
    setTimeout(() => {
      currentWindow.isDevToolsOpen().then(isOpen => {
        if (!isOpen) {
          currentWindow.openDevTools();
        }
      });
    }, 1500);
  }).catch(() => {
    console.log('[DevTools] 非 Tauri 环境，跳过打开开发者工具');
  });
}
