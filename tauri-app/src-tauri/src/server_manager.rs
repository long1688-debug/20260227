// Server Manager - Node.js 后端服务管理
// 负责启动/停止 Node.js HTTP API 服务器和 WebSocket 服务器

use crate::proc_util::NoWindow;
use std::process::{Child, Command};
use tokio::sync::Mutex;
use tauri::{AppHandle, Manager};

/// 全局存储子进程句柄
pub struct ServerState {
    pub server_process: Mutex<Option<Child>>,
}

impl Default for ServerState {
    fn default() -> Self {
        ServerState {
            server_process: Mutex::new(None),
        }
    }
}

/// 启动 Node.js 后端服务器
#[tauri::command]
pub async fn start_backend_server(app_handle: AppHandle) -> Result<String, String> {
    let state = app_handle.state::<ServerState>();

    // 检查是否已有运行中的进程
    {
        let mut process = state.server_process.lock().await;
        if let Some(ref mut child) = *process {
            match child.try_wait() {
                Ok(Some(_)) => { /* 进程已退出 */ }
                Ok(None) => return Err("后端服务器已在运行中".to_string()),
                Err(_) => {}
            }
            *process = None;
        }
    }

    // 获取 server 目录路径（从 bundle resources 中）
    let resource_path = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("获取资源目录失败: {}", e))?;

    // 尝试多种方式找到 node 和 server 入口
    // 开发模式: 使用全局 node + server/server.js
    // 发布模式: 使用打包的 server 目录

    #[cfg(debug_assertions)]
    let server_entry = {
        // 开发模式：直接使用项目根目录下的 server/server.js
        let root_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")); // src-tauri 目录
        let dev_server_path = root_dir
            .parent() // tauri-app
            .and_then(|p| p.parent()) // 项目根目录
            .map(|p| p.join("server").join("server.js"))
            .ok_or_else(|| "无法定位 server.js".to_string())?;

        if !dev_server_path.exists() {
            // fallback: 直接在 resource 中找
            resource_path.join("server").join("server.js")
        } else {
            dev_server_path
        }
    };

    #[cfg(not(debug_assertions))]
    let server_entry = resource_path.join("server").join("server.js");

    if !server_entry.exists() {
        return Err(format!("找不到服务器入口文件: {}", server_entry.display()));
    }

    // 启动 Node.js 进程
    let child = Command::new("node").no_window()
        .arg(&server_entry)
        .current_dir(server_entry.parent().unwrap_or(&resource_path))
        .spawn()
        .map_err(|e| format!("启动 Node.js 服务器失败: {}", e))?;

    let pid = child.id();

    {
        let mut process = state.server_process.lock().await;
        *process = Some(child);
    }

    println!("[ServerManager] 后端服务器已启动, PID={}", pid);
    Ok(format!("{}", pid))
}

/// 停止 Node.js 后端服务器
#[tauri::command]
pub async fn stop_backend_server(app_handle: AppHandle) -> Result<(), String> {
    let state = app_handle.state::<ServerState>();
    let mut process = state.server_process.lock().await;

    if let Some(ref mut child) = *process {
        // Windows 上需要先杀掉子树进程
        #[cfg(target_os = "windows")]
        {
            let pid = child.id();
            let _ = Command::new("taskkill").no_window()
                .args(["/PID", &pid.to_string(), "/T", "/F"])
                .spawn();
        }

        child.kill().map_err(|e| format!("停止服务器失败: {}", e))?;
        *process = None;
        println!("[ServerManager] 后端服务器已停止");
    }

    Ok(())
}

/// 检查后端服务器状态
#[tauri::command]
pub async fn check_backend_status(app_handle: AppHandle) -> Result<serde_json::Value, String> {
    let state = app_handle.state::<ServerState>();
    let mut process = state.server_process.lock().await;

    match process.as_mut() {
        Some(child) => {
            match child.try_wait() {
                Ok(Some(status)) => Ok(serde_json::json!({
                    "running": false,
                    "pid": child.id(),
                    "exit_code": status.code(),
                    "message": "进程已退出"
                })),
                Ok(None) => Ok(serde_json::json!({
                    "running": true,
                    "pid": child.id(),
                    "message": "运行中"
                })),
                Err(e) => Err(format!("检查进程状态失败: {}", e)),
            }
        }
        None => Ok(serde_json::json!({
            "running": false,
            "pid": null,
            "message": "未启动"
        })),
    }
}

