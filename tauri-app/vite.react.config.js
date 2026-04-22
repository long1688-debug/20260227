import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// React 版本专用 Vite 配置
export default defineConfig({
  plugins: [react()],
  root: '.',
  publicDir: 'public',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    modules: [
      path.resolve(__dirname, '../node_modules'),
      'node_modules'
    ]
  },
  build: {
    outDir: 'dist-react',
    assetsDir: 'assets',
    emptyOutDir: true,
    rollupOptions: {
      input: './index-react.html'
    }
  },
  server: {
    host: '0.0.0.0',  // 允许外部访问
    port: 5175,
    strictPort: true,
    open: true,
    proxy: {
      '/api': {
        target: process.env.VUE_APP_API_BASE_URL || 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '')  // 移除 /api 前缀，因为后端不需要
      },
      '/webrtc': {
        target: process.env.VUE_APP_WS_BASE_URL || 'ws://localhost:8080',
        ws: true,  // 启用 WebSocket 代理
        changeOrigin: true,
        secure: false
      },
      '/remote': {
        target: process.env.VUE_APP_WS_BASE_URL || 'ws://localhost:8080',
        ws: true,  // 启用 WebSocket 代理
        changeOrigin: true,
        secure: false
      }
    }
  },
  css: {
    postcss: './postcss.config.js'
  }
})