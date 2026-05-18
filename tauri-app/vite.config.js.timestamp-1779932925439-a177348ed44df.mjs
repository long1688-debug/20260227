// vite.config.js
import { defineConfig } from "file:///F:/20260227/tauri-app/node_modules/vite/dist/node/index.js";
import vue from "file:///F:/20260227/tauri-app/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import react from "file:///F:/20260227/tauri-app/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";
var __vite_injected_original_dirname = "F:\\20260227\\tauri-app";
var vite_config_default = defineConfig({
  plugins: [vue(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    },
    // 支持从父目录的 node_modules 解析模块
    modules: [
      path.resolve(__vite_injected_original_dirname, "../node_modules"),
      "node_modules"
    ]
  },
  optimizeDeps: {
    include: ["@xenova/transformers", "onnxruntime-web"]
  },
  server: {
    host: "0.0.0.0",
    // 允许外部访问
    port: 5181,
    // 修改为5181避免端口冲突（5180已被占用）
    strictPort: false,
    // 允许自动切换到下一个可用端口
    historyApiFallback: true,
    proxy: {
      "/api": {
        target: process.env.VUE_APP_API_BASE_URL || "http://localhost:8080",
        changeOrigin: true,
        secure: false,
        rewrite: (path2) => path2.replace(/^\/api/, "")
        // 移除 /api 前缀，因为后端不需要
      },
      "/webrtc": {
        target: process.env.VUE_APP_WS_BASE_URL || "ws://localhost:8080",
        ws: true,
        // 启用 WebSocket 代理
        changeOrigin: true,
        secure: false
      },
      "/remote": {
        target: process.env.VUE_APP_WS_BASE_URL || "ws://localhost:8080",
        ws: true,
        // 启用 WebSocket 代理
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    emptyOutDir: true,
    // 预构建依赖
    commonjsOptions: {
      include: [/node_modules/]
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJGOlxcXFwyMDI2MDIyN1xcXFx0YXVyaS1hcHBcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkY6XFxcXDIwMjYwMjI3XFxcXHRhdXJpLWFwcFxcXFx2aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRjovMjAyNjAyMjcvdGF1cmktYXBwL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHZ1ZSBmcm9tICdAdml0ZWpzL3BsdWdpbi12dWUnXHJcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcclxuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgcGx1Z2luczogW3Z1ZSgpLCByZWFjdCgpXSxcclxuICByZXNvbHZlOiB7XHJcbiAgICBhbGlhczoge1xyXG4gICAgICAnQCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYycpLFxyXG4gICAgfSxcclxuICAgIC8vIFx1NjUyRlx1NjMwMVx1NEVDRVx1NzIzNlx1NzZFRVx1NUY1NVx1NzY4NCBub2RlX21vZHVsZXMgXHU4OUUzXHU2NzkwXHU2QTIxXHU1NzU3XHJcbiAgICBtb2R1bGVzOiBbXHJcbiAgICAgIHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuLi9ub2RlX21vZHVsZXMnKSxcclxuICAgICAgJ25vZGVfbW9kdWxlcydcclxuICAgIF1cclxuICB9LFxyXG4gIG9wdGltaXplRGVwczoge1xyXG4gICAgaW5jbHVkZTogWydAeGVub3ZhL3RyYW5zZm9ybWVycycsICdvbm54cnVudGltZS13ZWInXVxyXG4gIH0sXHJcbiAgc2VydmVyOiB7XHJcbiAgICBob3N0OiAnMC4wLjAuMCcsICAvLyBcdTUxNDFcdThCQjhcdTU5MTZcdTkwRThcdThCQkZcdTk1RUVcclxuICAgIHBvcnQ6IDUxODEsICAvLyBcdTRGRUVcdTY1MzlcdTRFM0E1MTgxXHU5MDdGXHU1MTREXHU3QUVGXHU1M0UzXHU1MUIyXHU3QTgxXHVGRjA4NTE4MFx1NURGMlx1ODhBQlx1NTM2MFx1NzUyOFx1RkYwOVxyXG4gICAgc3RyaWN0UG9ydDogZmFsc2UsICAvLyBcdTUxNDFcdThCQjhcdTgxRUFcdTUyQThcdTUyMDdcdTYzNjJcdTUyMzBcdTRFMEJcdTRFMDBcdTRFMkFcdTUzRUZcdTc1MjhcdTdBRUZcdTUzRTNcclxuICAgIGhpc3RvcnlBcGlGYWxsYmFjazogdHJ1ZSxcclxuICAgIHByb3h5OiB7XHJcbiAgICAgICcvYXBpJzoge1xyXG4gICAgICAgIHRhcmdldDogcHJvY2Vzcy5lbnYuVlVFX0FQUF9BUElfQkFTRV9VUkwgfHwgJ2h0dHA6Ly9sb2NhbGhvc3Q6ODA4MCcsXHJcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxyXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXHJcbiAgICAgICAgcmV3cml0ZTogKHBhdGgpID0+IHBhdGgucmVwbGFjZSgvXlxcL2FwaS8sICcnKSAgLy8gXHU3OUZCXHU5NjY0IC9hcGkgXHU1MjREXHU3RjAwXHVGRjBDXHU1NkUwXHU0RTNBXHU1NDBFXHU3QUVGXHU0RTBEXHU5NzAwXHU4OTgxXHJcbiAgICAgIH0sXHJcbiAgICAgICcvd2VicnRjJzoge1xyXG4gICAgICAgIHRhcmdldDogcHJvY2Vzcy5lbnYuVlVFX0FQUF9XU19CQVNFX1VSTCB8fCAnd3M6Ly9sb2NhbGhvc3Q6ODA4MCcsXHJcbiAgICAgICAgd3M6IHRydWUsICAvLyBcdTU0MkZcdTc1MjggV2ViU29ja2V0IFx1NEVFM1x1NzQwNlxyXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICBzZWN1cmU6IGZhbHNlXHJcbiAgICAgIH0sXHJcbiAgICAgICcvcmVtb3RlJzoge1xyXG4gICAgICAgIHRhcmdldDogcHJvY2Vzcy5lbnYuVlVFX0FQUF9XU19CQVNFX1VSTCB8fCAnd3M6Ly9sb2NhbGhvc3Q6ODA4MCcsXHJcbiAgICAgICAgd3M6IHRydWUsICAvLyBcdTU0MkZcdTc1MjggV2ViU29ja2V0IFx1NEVFM1x1NzQwNlxyXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICBzZWN1cmU6IGZhbHNlXHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9LFxyXG4gIGJ1aWxkOiB7XHJcbiAgICBvdXREaXI6ICdkaXN0JyxcclxuICAgIGFzc2V0c0RpcjogJ2Fzc2V0cycsXHJcbiAgICBlbXB0eU91dERpcjogdHJ1ZSxcclxuICAgIC8vIFx1OTg4NFx1Njc4NFx1NUVGQVx1NEY5RFx1OEQ1NlxyXG4gICAgY29tbW9uanNPcHRpb25zOiB7XHJcbiAgICAgIGluY2x1ZGU6IFsvbm9kZV9tb2R1bGVzL11cclxuICAgIH1cclxuICB9LFxyXG59KVxyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXVQLFNBQVMsb0JBQW9CO0FBQ3BSLE9BQU8sU0FBUztBQUNoQixPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBSGpCLElBQU0sbUNBQW1DO0FBTXpDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDO0FBQUEsRUFDeEIsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLElBQ3RDO0FBQUE7QUFBQSxJQUVBLFNBQVM7QUFBQSxNQUNQLEtBQUssUUFBUSxrQ0FBVyxpQkFBaUI7QUFBQSxNQUN6QztBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsd0JBQXdCLGlCQUFpQjtBQUFBLEVBQ3JEO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUE7QUFBQSxJQUNOLE1BQU07QUFBQTtBQUFBLElBQ04sWUFBWTtBQUFBO0FBQUEsSUFDWixvQkFBb0I7QUFBQSxJQUNwQixPQUFPO0FBQUEsTUFDTCxRQUFRO0FBQUEsUUFDTixRQUFRLFFBQVEsSUFBSSx3QkFBd0I7QUFBQSxRQUM1QyxjQUFjO0FBQUEsUUFDZCxRQUFRO0FBQUEsUUFDUixTQUFTLENBQUNBLFVBQVNBLE1BQUssUUFBUSxVQUFVLEVBQUU7QUFBQTtBQUFBLE1BQzlDO0FBQUEsTUFDQSxXQUFXO0FBQUEsUUFDVCxRQUFRLFFBQVEsSUFBSSx1QkFBdUI7QUFBQSxRQUMzQyxJQUFJO0FBQUE7QUFBQSxRQUNKLGNBQWM7QUFBQSxRQUNkLFFBQVE7QUFBQSxNQUNWO0FBQUEsTUFDQSxXQUFXO0FBQUEsUUFDVCxRQUFRLFFBQVEsSUFBSSx1QkFBdUI7QUFBQSxRQUMzQyxJQUFJO0FBQUE7QUFBQSxRQUNKLGNBQWM7QUFBQSxRQUNkLFFBQVE7QUFBQSxNQUNWO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLFdBQVc7QUFBQSxJQUNYLGFBQWE7QUFBQTtBQUFBLElBRWIsaUJBQWlCO0FBQUEsTUFDZixTQUFTLENBQUMsY0FBYztBQUFBLElBQzFCO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbInBhdGgiXQp9Cg==
