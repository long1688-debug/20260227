// 应用生命周期管理
// 处理应用启动、退出时的资源清理和子进程管理

use tauri::{AppHandle, Manager, Emitter};

/// 应用退出时清理所有子进程（Node.js 后端服务器 + ZLMediaKit）
pub fn on_app_exit(app_handle: &AppHandle) {
    let handle = app_handle.clone();

    // 异步执行清理，避免阻塞主线程
    tauri::async_runtime::spawn(async move {
        // 停止后端服务器
        if let Some(state) = handle.try_state::<crate::server_manager::ServerState>() {
            let pid_and_result = {
                let mut process = state.server_process.lock().await;

                if let Some(ref mut child) = *process {
                    let pid = child.id();

                    #[cfg(target_os = "windows")]
                    {
                        // Windows 上先杀子树进程
                        use std::process::Command;
                        let _ = Command::new("taskkill")
                            .args(["/PID", &pid.to_string(), "/T", "/F"])
                            .spawn();
                    }

                    let kill_result = child.kill();
                    *process = None;
                    Some((pid, kill_result))
                } else {
                    None
                }
            }; // MutexGuard 在这里被释放

            if let Some((pid, kill_result)) = pid_and_result {
                match kill_result {
                    Ok(_) => {
                        println!("[Lifecycle] 后端服务器已停止 (PID={})", pid);
                    }
                    Err(e) => eprintln!("[Lifecycle] 停止进程失败: {}", e),
                }

                #[cfg(target_os = "windows")]
                {
                    // 等待一下确保进程被杀掉
                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                }
            }
        }

        // 🎯 停止 ZLMediaKit 服务
        if let Some(state) = handle.try_state::<crate::zlmediakit_manager::ZLMediaKitState>() {
            let zl_pid_and_result = {
                let mut process = state.process.lock().await;

                if let Some(ref mut child) = *process {
                    let pid = child.id();
                    let kill_result = child.kill();
                    *process = None;
                    Some((pid, kill_result))
                } else {
                    None
                }
            };

            if let Some((pid, kill_result)) = zl_pid_and_result {
                match kill_result {
                    Ok(_) => {
                        println!("[Lifecycle] ZLMediaKit 服务已停止 (PID={})", pid);
                    }
                    Err(e) => eprintln!("[Lifecycle] 停止 ZLMediaKit 失败: {}", e),
                }
            }
        }

        println!("[Lifecycle] 应用退出清理完成");
    });
}

/// 应用启动后的初始化工作
pub fn on_app_ready(app_handle: &AppHandle) {
    println!("[Lifecycle] 应用已就绪");

    // 发送事件通知前端应用已就绪
    let handle = app_handle.clone();
    tauri::async_runtime::spawn(async move {
        // 短暂延迟确保前端已加载完成
        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;

        if let Err(e) = handle.emit("app:ready", ()) {
            eprintln!("[Lifecycle] 发送 ready 事件失败: {}", e);
        } else {
            println!("[Lifecycle] 已发送 app:ready 事件到前端");
        }
    });
}

/// 窗口关闭前的处理（可拦截关闭操作）
pub fn on_window_close_requested(_app_handle: &tauri::Window) -> bool {
    // 返回 false 可以阻止窗口关闭（用于确认对话框等场景）
    // 这里直接允许关闭，清理在 on_exit 中处理
    println!("[Lifecycle] 收到窗口关闭请求");
    true // 允许关闭
}
