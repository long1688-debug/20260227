// ZLMediaKit Stream Proxy Manager - 通过 ZLMediaKit 管理流媒体代理
// 替代原 Node.js rtsp-proxy，直接使用 ZLMediaKit 作为流媒体服务器
use crate::proc_util::NoWindow;
use std::process::{Child, Command};
use tokio::sync::Mutex;
use tauri::{AppHandle, Manager};

/// ZLMediaKit 流代理状态
pub struct RtspProxyState {
    pub process: Mutex<Option<Child>>,
    pub host: String,
    pub port: u16,
}

impl RtspProxyState {
    pub fn new() -> Self {
        Self {
            process: Mutex::new(None),
            // 使用 ZLMediaKit HTTP API 端口
            host: "127.0.0.1".to_string(),
            port: 801, // ZLMediaKit HTTP API 端口
        }
    }
}

/// 启动流媒体代理服务（通过 ZLMediaKit）
#[tauri::command]
pub async fn start_rtsp_proxy(app_handle: AppHandle) -> Result<String, String> {
    let state = app_handle.state::<RtspProxyState>();

    // 🎯 先检查 ZLMediaKit 是否已在运行
    let client = reqwest::Client::new();
    // 使用 getApiList 代替 getServerInfo 进行健康检查（新版ZLMediaKit API）
    let health_url = format!("http://{}:{}/index/api/getApiList", state.host, state.port);

    match client.get(&health_url).timeout(std::time::Duration::from_secs(3)).send().await {
        Ok(resp) if resp.status().is_success() => {
            println!("[ZLMediaKit] 服务已在运行");
            return Ok(format!("ZLMediaKit 流媒体服务已运行: http://{}:{}", state.host, state.port));
        }
        _ => {}
    }

    // 🎯 ZLMediaKit 未运行，尝试启动
    println!("[ZLMediaKit] 服务未运行，尝试启动...");

    // 尝试通过 Tauri 的 zlmediakit_manager 启动
    let zlm_state = app_handle.state::<crate::zlmediakit_manager::ZLMediaKitState>();
    {
        let mut process = zlm_state.process.lock().await;
        if let Some(ref mut child) = *process {
            match child.try_wait() {
                Ok(Some(_)) => { *process = None; }
                Ok(None) => {
                    println!("[ZLMediaKit] 服务已在运行中");
                    return Ok(format!("ZLMediaKit 流媒体服务已运行: http://{}:{}", state.host, state.port));
                }
                Err(_) => {}
            }
        }
    }

    // 查找并启动 ZLMediaKit
    let zlmediakit_path = find_zlmediakit_binary()?;

    let mut child = Command::new(&zlmediakit_path).no_window()
        .current_dir(
            std::path::Path::new(&zlmediakit_path)
                .parent()
                .unwrap_or(std::path::Path::new("."))
        )
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("启动 ZLMediaKit 失败: {}", e))?;

    // 等待服务启动
    tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;

    // 验证服务是否可用（带重试机制）
    let mut health_check_passed = false;
    let max_retries = 5;

    for attempt in 1..=max_retries {
        println!("[ZLMediaKit] 健康检查尝试 {}/{}", attempt, max_retries);

        match client.get(&health_url).timeout(std::time::Duration::from_secs(2)).send().await {
            Ok(resp) => {
                if resp.status().is_success() {
                    println!("[ZLMediaKit] 服务健康检查通过");
                    health_check_passed = true;
                    break;
                } else {
                    println!("[ZLMediaKit] 健康检查响应状态: {}", resp.status());
                }
            }
            Err(e) => {
                println!("[ZLMediaKit] 健康检查失败 (尝试 {}/{}): {}", attempt, max_retries, e);
            }
        }

        if attempt < max_retries {
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        }
    }

    if !health_check_passed {
        println!("[ZLMediaKit] 健康检查失败，终止进程");
        #[cfg(target_os = "windows")]
        {
            let _ = Command::new("taskkill").no_window()
                .args(&["/F", "/T", "/PID", &child.id().to_string()])
                .status();
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = child.kill();
        }
        return Err(format!("ZLMediaKit 启动失败：健康检查未通过（尝试了{}次）", max_retries));
    }

    // 保存进程到 ZLMediaKit 状态
    {
        let mut process = zlm_state.process.lock().await;
        *process = Some(child);
    }

    Ok(format!("ZLMediaKit 流媒体服务已启动: http://{}:{}", state.host, state.port))
}

/// 停止流媒体代理服务（通过 ZLMediaKit）
#[tauri::command]
pub async fn stop_rtsp_proxy(app_handle: AppHandle) -> Result<String, String> {
    let zlm_state = app_handle.state::<crate::zlmediakit_manager::ZLMediaKitState>();

    let mut process = zlm_state.process.lock().await;
    if let Some(mut child) = process.take() {
        // 优雅关闭
        #[cfg(target_os = "windows")]
        {
            let status = Command::new("taskkill").no_window()
                .args(&["/F", "/T", "/PID", &child.id().to_string()])
                .status();

            if let Err(e) = status {
                eprintln!("[ZLMediaKit] 停止服务失败: {}", e);
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            child.kill().map_err(|e| format!("停止 ZLMediaKit 失败: {}", e))?;
        }

        child.wait().ok();
        println!("[ZLMediaKit] 服务已停止");
        Ok("ZLMediaKit 流媒体服务已停止".to_string())
    } else {
        Ok("ZLMediaKit 流媒体服务未运行".to_string())
    }
}

/// 检查流媒体代理服务状态（通过 ZLMediaKit）
#[tauri::command]
pub async fn check_rtsp_proxy_status(app_handle: AppHandle) -> Result<serde_json::Value, String> {
    let state = app_handle.state::<RtspProxyState>();

    // 通过 ZLMediaKit HTTP API 健康检查判断服务是否运行
    let client = reqwest::Client::new();
    // 使用 getApiList 代替 getServerInfo 进行健康检查（新版ZLMediaKit API）
    let health_url = format!("http://{}:{}/index/api/getApiList", state.host, state.port);

    let is_running = match client.get(&health_url).timeout(std::time::Duration::from_secs(3)).send().await {
        Ok(resp) => resp.status().is_success(),
        Err(_) => false,
    };

    Ok(serde_json::json!({
        "running": is_running,
        "host": state.host,
        "port": state.port,
        "url": format!("http://{}:{}", state.host, state.port),
        "backend": "ZLMediaKit"
    }))
}

/// 启动 RTSP 流代理（通过 ZLMediaKit addStreamProxy 接口）
#[tauri::command]
pub async fn start_rtsp_stream_proxy(
    app_handle: AppHandle,
    rtsp_url: String,
    stream_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let state = app_handle.state::<RtspProxyState>();

    // 🎯 先确保 ZLMediaKit 服务在运行
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("创建HTTP客户端失败: {}", e))?;

    // 使用 getApiList 代替 getServerInfo 进行健康检查（新版ZLMediaKit API）
    let health_url = format!("http://{}:{}/index/api/getApiList", state.host, state.port);

    // 检查 ZLMediaKit 是否运行
    let is_running = match client.get(&health_url).send().await {
        Ok(resp) => resp.status().is_success(),
        Err(_) => false,
    };

    if !is_running {
        // 尝试启动 ZLMediaKit
        println!("[ZLMediaKit] 服务未运行，尝试启动...");
        let _ = start_rtsp_proxy(app_handle.clone()).await;

        // 再次检查
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        let is_running_now = match client.get(&health_url).send().await {
            Ok(resp) => resp.status().is_success(),
            Err(_) => false,
        };

        if !is_running_now {
            return Err("ZLMediaKit 流媒体服务未运行，请先启动服务".to_string());
        }
    }

    let id = stream_id.unwrap_or_else(|| format!("stream_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() % 100000));

    // 🎯 调用 ZLMediaKit addStreamProxy 接口拉取 RTSP 流
    let add_url = format!("http://{}:{}/index/api/addStreamProxy", state.host, state.port);

    let params = serde_json::json!({
        "secret": crate::bin_resolver::zlmediakit_secret(),
        "vhost": "__defaultVhost__",
        "app": "live",
        "stream": id,
        "url": rtsp_url,
        "enable_hls": true,
        "enable_mp4": false,
        "enable_rtsp": true,
        "enable_rtmp": true,
        "enable_rtp": true,   // 🎯 启用 RTP（WebRTC 底层需要）
        "enable_webrtc": true, // 🎯 启用 WebRTC（低延迟 <200ms）
        "rtp_type": 0  // 0=TCP, 1=UDP
    });

    let resp = client
        .post(&add_url)
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("请求 ZLMediaKit addStreamProxy 失败: {}", e))?;

    let result: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    println!("[ZLMediaKit] addStreamProxy 响应: {:?}", result);

    if result["code"].as_i64().unwrap_or(-1) == 0 {
        let flv_url = format!("http://{}:{}/live/{}.live.flv", state.host, state.port, id);
        Ok(serde_json::json!({
            "success": true,
            "streamId": id,
            "streamUrl": flv_url.clone(),
            "flvUrl": flv_url,
            "wsUrl": format!("ws://{}:{}/live/{}.live.flv", state.host, state.port, id),
            "wsFlvUrl": format!("ws://{}:{}/live/{}.live.flv", state.host, state.port, id),
            "rtspUrl": format!("rtsp://{}:554/live/{}", state.host, id),
            "hlsUrl": format!("http://{}:{}/live/{}/hls.m3u8", state.host, state.port, id),
            "webrtcUrl": format!("http://{}:{}/index/api/webrtc?app=live&stream={}&type=play", state.host, state.port, id),
            "status": "ready",
            "backend": "ZLMediaKit",
            "playMode": "webrtc"  // 🎯 优先使用 WebRTC（最低延迟）
        }))
    } else {
        let error_msg = result["msg"].as_str().unwrap_or("未知错误");
        Err(format!("ZLMediaKit 添加流代理失败: {}", error_msg))
    }
}

/// 停止 RTSP 流代理（通过 ZLMediaKit delStreamProxy 接口）
#[tauri::command]
pub async fn stop_rtsp_stream_proxy(
    app_handle: AppHandle,
    stream_id: String,
) -> Result<String, String> {
    let state = app_handle.state::<RtspProxyState>();

    let client = reqwest::Client::new();
    let del_url = format!("http://{}:{}/index/api/delStreamProxy", state.host, state.port);

    let params = serde_json::json!({
        "secret": crate::bin_resolver::zlmediakit_secret(),
        "key": format!("__defaultVhost__/live/{}", stream_id)
    });

    let resp = client
        .post(&del_url)
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let result: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    if result["code"].as_i64().unwrap_or(-1) == 0 {
        Ok("流已停止".to_string())
    } else {
        Err(format!("停止流失败: {}", result["msg"].as_str().unwrap_or("未知错误")))
    }
}

/// 获取所有活跃流（通过 ZLMediaKit getMediaList 接口）
#[tauri::command]
pub async fn get_rtsp_streams(app_handle: AppHandle) -> Result<serde_json::Value, String> {
    let state = app_handle.state::<RtspProxyState>();

    let client = reqwest::Client::new();
    let api_url = format!("http://{}:{}/index/api/getMediaList", state.host, state.port);

    let params = serde_json::json!({
        "secret": crate::bin_resolver::zlmediakit_secret(),
        "app": "live"
    });

    let resp = client
        .post(&api_url)
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let streams: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    Ok(streams)
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
        // 相对路径（开发环境）
        "../ZLMediaKit/release/windows/Debug/MediaServer.exe".to_string(),
        "../ZLMediaKit/release/windows/Release/MediaServer.exe".to_string(),
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
