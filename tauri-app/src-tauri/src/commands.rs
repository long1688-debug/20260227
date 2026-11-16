// Tauri Commands - 主命令模块
use tauri::{AppHandle, Manager, Runtime, Window};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use anyhow::Result;

// ==================== 窗口控制 ====================

#[tauri::command(async)]
pub fn minimize_window<R: Runtime>(window: Window<R>) {
    let _ = window.minimize();
}

#[tauri::command(async)]
pub fn maximize_window<R: Runtime>(window: Window<R>) {
    if window.is_maximized().unwrap_or(false) {
        let _ = window.unmaximize();
    } else {
        let _ = window.maximize();
    }
}

#[tauri::command(async)]
pub fn close_window<R: Runtime>(window: Window<R>) {
    let _ = window.close();
}

// ==================== 设置相关 ====================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub recording_path: String,
    pub language: String,
    pub theme: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        AppSettings {
            recording_path: dirs::video_dir()
                .unwrap_or_else(|| PathBuf::from("Videos"))
                .join("Recordings")
                .to_string_lossy()
                .to_string(),
            language: "zh-CN".to_string(),
            theme: "dark".to_string(),
        }
    }
}

#[tauri::command(async)]
pub fn get_settings(app_handle: AppHandle) -> Result<AppSettings, String> {
    let settings_path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("settings.json");

    if settings_path.exists() {
        let content = std::fs::read_to_string(&settings_path)
            .map_err(|e| e.to_string())?;
        serde_json::from_str(&content)
            .map_err(|e| e.to_string())
    } else {
        let settings = AppSettings::default();
        // 保存默认设置
        let _ = save_settings(app_handle, settings.clone());
        Ok(settings)
    }
}

#[tauri::command(async)]
pub fn save_settings(app_handle: AppHandle, settings: AppSettings) -> Result<bool, String> {
    // 获取设置文件路径
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    // 如果目录不存在，创建它
    if !app_data_dir.exists() {
        std::fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("Failed to create app data directory: {}", e))?;
        println!("[设置] 已创建应用数据目录: {:?}", app_data_dir);
    }

    let settings_path = app_data_dir.join("settings.json");
    println!("[设置] 保存设置到: {:?}", settings_path);

    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| e.to_string())?;

    std::fs::write(&settings_path, content)
        .map_err(|e| {
            println!("[设置] 写入文件失败: {}", e);
            e.to_string()
        })?;

    println!("[设置] ✅ 设置保存成功");
    Ok(true)
}

#[tauri::command(async)]
pub fn get_default_recording_path() -> Result<String, String> {
    dirs::video_dir()
        .map(|p| p.join("Recordings").to_string_lossy().to_string())
        .ok_or_else(|| "Failed to get video directory".to_string())
}

#[tauri::command]
pub async fn select_directory<R: Runtime>(
    window: Window<R>,
) -> Result<tauri_plugin_dialog::FilePath, String> {
    use tauri_plugin_dialog::DialogExt;
    use std::sync::Arc;
    use tokio::sync::{oneshot, Mutex};

    let (tx, rx) = oneshot::channel::<Option<tauri_plugin_dialog::FilePath>>();
    let tx = Arc::new(Mutex::new(Some(tx)));

    window
        .dialog()
        .file()
        .pick_folder(move |path| {
            // 使用 spawn 来处理异步操作
            let tx_clone = tx.clone();
            tokio::spawn(async move {
                if let Some(tx) = tx_clone.lock().await.take() {
                    let _ = tx.send(path);
                }
            });
        });

    rx.await
        .map_err(|_| "Dialog cancelled".to_string())?
        .ok_or_else(|| "No directory selected".to_string())
}

// ==================== 系统相关 ====================

#[derive(Debug, Serialize)]
pub struct SystemInfo {
    pub hostname: String,
    pub os_version: String,
    pub cpu_model: String,
    pub total_memory: u64,
    pub available_memory: u64,
}

#[tauri::command(async)]
pub fn get_system_info() -> Result<SystemInfo, String> {
    use sysinfo::{CpuRefreshKind, MemoryRefreshKind, RefreshKind};
    let sys = sysinfo::System::new_with_specifics(
        RefreshKind::new()
            .with_cpu(CpuRefreshKind::new())
            .with_memory(MemoryRefreshKind::everything()),
    );

    Ok(SystemInfo {
        hostname: sysinfo::System::host_name().unwrap_or_default(),
        os_version: sysinfo::System::os_version().unwrap_or_default(),
        cpu_model: sys
            .cpus()
            .first()
            .map(|cpu| cpu.brand().to_string())
            .unwrap_or_default(),
        total_memory: sys.total_memory(),
        available_memory: sys.available_memory(),
    })
}

#[tauri::command(async)]
pub fn check_port_available(port: u16) -> Result<bool, String> {
    use std::net::TcpListener;

    match TcpListener::bind(("127.0.0.1", port)) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

// ==================== 文件操作 ====================

#[tauri::command(async)]
pub fn read_file(app: AppHandle, path: PathBuf) -> Result<String, String> {
    let path = ensure_allowed_path(&app, &path)?;
    std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command(async)]
pub fn write_file(app: AppHandle, path: PathBuf, content: String) -> Result<(), String> {
    let path = ensure_allowed_path(&app, &path)?;
    std::fs::write(&path, content)
        .map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command(async)]
pub fn file_exists(path: PathBuf) -> bool {
    path.exists()
}

#[tauri::command(async)]
pub fn create_dir(app: AppHandle, path: PathBuf) -> Result<(), String> {
    let path = ensure_allowed_path(&app, &path)?;
    std::fs::create_dir_all(&path)
        .map_err(|e| format!("Failed to create directory: {}", e))
}


/// 前端文件读写只允许访问应用数据目录、临时目录和用户文档/视频/下载/桌面目录
fn ensure_allowed_path(app: &AppHandle, path: &std::path::Path) -> Result<PathBuf, String> {
    use std::path::Component;
    if path.components().any(|c| matches!(c, Component::ParentDir)) {
        return Err("路径不允许包含 ..".to_string());
    }
    let resolver = app.path();
    let roots: Vec<PathBuf> = [
        resolver.app_data_dir().ok(),
        resolver.app_local_data_dir().ok(),
        resolver.app_cache_dir().ok(),
        resolver.document_dir().ok(),
        resolver.video_dir().ok(),
        resolver.download_dir().ok(),
        resolver.desktop_dir().ok(),
        Some(std::env::temp_dir()),
    ]
    .into_iter()
    .flatten()
    .filter_map(|p| p.canonicalize().ok())
    .collect();

    // 不存在的路径：取最近的已存在祖先目录做规范化
    let mut existing = path.to_path_buf();
    let mut rest = Vec::new();
    while !existing.exists() {
        match (existing.file_name().map(|n| n.to_owned()), existing.parent()) {
            (Some(name), Some(parent)) => {
                rest.push(name);
                existing = parent.to_path_buf();
            }
            _ => return Err("无效路径".to_string()),
        }
    }
    let mut resolved = existing.canonicalize().map_err(|e| e.to_string())?;
    for name in rest.into_iter().rev() {
        resolved.push(name);
    }

    if roots.iter().any(|root| resolved.starts_with(root)) {
        Ok(resolved)
    } else {
        Err(format!("不允许访问该路径: {}", path.display()))
    }
}
