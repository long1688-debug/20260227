import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // 支持从父目录的 node_modules 解析模块
    modules: [
      path.resolve(__dirname, '../node_modules'),
      'node_modules'
    ]
  },
  optimizeDeps: {
    include: ['@xenova/transformers', 'onnxruntime-web']
  },
  server: {
    host: '0.0.0.0',  // 允许外部访问
    port: 5174,
    strictPort: true,
    historyApiFallback: true,
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
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    // 预构建依赖
    commonjsOptions: {
      include: [/node_modules/]
    }
  },
})