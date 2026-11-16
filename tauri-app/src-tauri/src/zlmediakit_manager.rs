// ZLMediaKit 管理器 - 自动启动/停止 ZLMediaKit 服务
use crate::proc_util::NoWindow;
use std::process::{Child, Command};
use tokio::sync::Mutex;
use tauri::{AppHandle, Manager};

/// ZLMediaKit 进程状态
pub struct ZLMediaKitState {
    pub process: Mutex<Option<Child>>,
    pub host: String,
    pub port: u16,
    #[allow(dead_code)] // 预留字段，用于未来扩展
    pub secret: String,
}

impl ZLMediaKitState {
    pub fn new() -> Self {
        Self {
            process: Mutex::new(None),
            host: "127.0.0.1".to_string(),
            port: 801, // ZLMediaKit HTTP 端口
            secret: "8qNdNv8bykcWrRo9BAsFQiUZABZ9kWd3".to_string(), // ZLMediaKit 配置的密钥
        }
    }
}

/// 启动 ZLMediaKit 服务
#[tauri::command]
pub async fn start_zlmediakit(app_handle: AppHandle) -> Result<String, String> {
    let state = app_handle.state::<ZLMediaKitState>();

    // 检查是否已有运行中的进程
    {
        let mut process = state.process.lock().await;
        if let Some(ref mut child) = *process {
            match child.try_wait() {
                Ok(Some(_)) => { /* 进程已退出，需要重新启动 */ }
                Ok(None) => return Ok("ZLMediaKit 已在运行中".to_string()),
                Err(_) => {}
            }
            *process = None;
        }
    }

    // 尝试多种路径查找 ZLMediaKit 可执行文件
    let zlmediakit_path = find_zlmediakit_binary()?;

    println!("[ZLMediaKit] 启动服务: {}", zlmediakit_path);

    // 🎯 关键修复：确保必要的目录存在
    // ZLMediaKit 需要 log 和 data 目录来存储日志和运行时数据
    let zlmediakit_dir = std::path::Path::new(&zlmediakit_path)
        .parent()
        .unwrap_or(std::path::Path::new("."));

    // 创建日志目录
    let log_dir = zlmediakit_dir.join("log");
    if !log_dir.exists() {
        std::fs::create_dir_all(&log_dir)
            .map_err(|e| format!("创建日志目录失败: {}", e))?;
        println!("[ZLMediaKit] 创建日志目录: {}", log_dir.display());
    }

    // 创建数据目录（ZLMediaKit 可能需要）
    let data_dir = zlmediakit_dir.join("data");
    if !data_dir.exists() {
        std::fs::create_dir_all(&data_dir)
            .map_err(|e| format!("创建数据目录失败: {}", e))?;
        println!("[ZLMediaKit] 创建数据目录: {}", data_dir.display());
    }

    // 启动 ZLMediaKit 进程
    let mut child = Command::new(&zlmediakit_path).no_window()
        .current_dir(zlmediakit_dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("启动 ZLMediaKit 失败: {}", e))?;

    // 等待服务启动完成（检查端口是否被监听）
    tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;

    // 验证服务是否启动成功
    if !is_port_listening(state.port) {
        // 端口未被监听，说明服务未成功启动
        child.kill().ok();
        return Err("ZLMediaKit 启动失败：端口未被监听".to_string());
    }

    *state.process.lock().await = Some(child);

    println!("[ZLMediaKit] 服务启动成功: http://{}:{}", state.host, state.port);
    Ok(format!("ZLMediaKit 已启动: http://{}:{}", state.host, state.port))
}

/// 停止 ZLMediaKit 服务
#[tauri::command]
pub async fn stop_zlmediakit(app_handle: AppHandle) -> Result<String, String> {
    let state = app_handle.state::<ZLMediaKitState>();

    let mut process = state.process.lock().await;
    if let Some(mut child) = process.take() {
        // 优雅关闭
        child.kill().map_err(|e| format!("停止 ZLMediaKit 失败: {}", e))?;
        child.wait().ok();
        println!("[ZLMediaKit] 服务已停止");
        Ok("ZLMediaKit 已停止".to_string())
    } else {
        Ok("ZLMediaKit 未运行".to_string())
    }
}

/// 检查 ZLMediaKit 状态
#[tauri::command]
pub async fn check_zlmediakit_status(app_handle: AppHandle) -> Result<serde_json::Value, String> {
    let state = app_handle.state::<ZLMediaKitState>();

    let mut process = state.process.lock().await;
    let is_running = if let Some(ref mut child) = *process {
        matches!(child.try_wait(), Ok(None))
    } else {
        false
    };

    Ok(serde_json::json!({
        "running": is_running,
        "listening": is_port_listening(state.port),
        "host": state.host,
        "port": state.port,
        "url": format!("http://{}:{}", state.host, state.port)
    }))
}

/// 查找 ZLMediaKit 可执行文件
fn find_zlmediakit_binary() -> Result<String, String> {
    if let Some(path) = crate::bin_resolver::zlmediakit() {
        return Ok(path.to_string_lossy().into_owned());
    }

    // 以下为开发机路径，仅 debug 构建使用；发布版请把 ZLMediaKit 放到 <安装目录>/runtime/zlmediakit/
    #[cfg(not(debug_assertions))]
    let candidates: Vec<String> = Vec::new();
    #[cfg(debug_assertions)]
    let candidates = vec![
        // Windows 根目录（直接安装）
        "C:\\ZLMediaKit\\MediaServer.exe".to_string(),
        "D:\\ZLMediaKit\\MediaServer.exe".to_string(),
        "F:\\ZLMediaKit\\MediaServer.exe".to_string(),
        // Windows 常见路径
        "C:\\ZLMediaKit\\release\\windows\\Debug\\MediaServer.exe".to_string(),
        "C:\\ZLMediaKit\\release\\windows\\Release\\MediaServer.exe".to_string(),
        "D:\\ZLMediaKit\\release\\windows\\Debug\\MediaServer.exe".to_string(),
        "D:\\ZLMediaKit\\release\\windows\\Release\\MediaServer.exe".to_string(),
        "F:\\ZLMediaKit\\release\\windows\\Debug\\MediaServer.exe".to_string(),
        "F:\\ZLMediaKit\\release\\windows\\Release\\MediaServer.exe".to_string(),
        // 相对路径（开发环境）
        "../ZLMediaKit/release/windows/Debug/MediaServer.exe".to_string(),
        "../ZLMediaKit/release/windows/Release/MediaServer.exe".to_string(),
        "../../ZLMediaKit/MediaServer.exe".to_string(),
        // Linux/macOS 路径
        "/usr/local/bin/MediaServer".to_string(),
        "/opt/ZLMediaKit/MediaServer".to_string(),
    ];

    for path in &candidates {
        if std::path::Path::new(path).exists() {
            return Ok(path.clone());
        }
    }

    // 尝试从 PATH 中查找
    if which::which("MediaServer").is_ok() {
        return Ok("MediaServer".to_string());
    }

    Err("未找到 ZLMediaKit 可执行文件，请检查安装路径".to_string())
}

/// 检查端口是否正在被监听（服务已启动）
fn is_port_listening(port: u16) -> bool {
    use std::net::TcpStream;
    use std::time::Duration;

    // 尝试连接端口，如果能连接说明服务正在监听
    TcpStream::connect_timeout(
        &format!("127.0.0.1:{}", port).parse().unwrap(),
        Duration::from_millis(500)
    ).is_ok()
}

/// 检查端口是否可用（未被占用）- 保留用于其他场景
#[allow(dead_code)]
fn is_port_available(port: u16) -> bool {
    use std::net::TcpListener;
    TcpListener::bind(("127.0.0.1", port)).is_ok()
}
