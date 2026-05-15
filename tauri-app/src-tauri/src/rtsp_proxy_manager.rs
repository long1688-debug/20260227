// RTSP Proxy Manager - 管理 Node.js RTSP 代理服务
use std::process::{Child, Command};
use tokio::sync::Mutex;
use tauri::{AppHandle, Manager};

/// RTSP 代理服务状态
pub struct RtspProxyState {
    pub process: Mutex<Option<Child>>,
    pub host: String,
    pub port: u16,
}

impl RtspProxyState {
    pub fn new() -> Self {
        Self {
            process: Mutex::new(None),
            //  使用 localhost 而不是 127.0.0.1，避免 IPv6/IPv4 解析问题
            host: "localhost".to_string(),
            port: 8081, // RTSP Proxy HTTP 端口
        }
    }
}

/// 启动 RTSP 代理服务
#[tauri::command]
pub async fn start_rtsp_proxy(app_handle: AppHandle) -> Result<String, String> {
    let state = app_handle.state::<RtspProxyState>();

    // 检查是否已有运行中的进程
    {
        let mut process = state.process.lock().await;
        if let Some(ref mut child) = *process {
            match child.try_wait() {
                Ok(Some(_)) => { /* 进程已退出，需要重新启动 */ }
                Ok(None) => return Ok("RTSP 代理服务已在运行中".to_string()),
                Err(_) => {}
            }
            *process = None;
        }
    }

    // 查找 rtsp-proxy.js 文件
    let proxy_script = find_rtsp_proxy_script()?;
    println!("[RTSP Proxy] 找到脚本: {}", proxy_script);

    // 获取脚本所在目录
    let script_dir = std::path::Path::new(&proxy_script)
        .parent()
        .ok_or("无法获取脚本目录")?
        .to_str()
        .ok_or("无效的路径编码")?
        .to_string();

    // 启动 Node.js 进程
    let child = Command::new("node")
        .arg(&proxy_script)
        .current_dir(&script_dir)
        .spawn()
        .map_err(|e| format!("启动 RTSP 代理服务失败: {}", e))?;

    println!("[RTSP Proxy] 服务已启动 (PID: {})", child.id());

    // 等待服务就绪（增加等待时间）
    tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;

    // 验证服务是否可用（带重试机制）
    let client = reqwest::Client::new();
    let health_url = format!("http://{}:{}/health", state.host, state.port);

    let mut health_check_passed = false;
    let max_retries = 5;

    for attempt in 1..=max_retries {
        println!("[RTSP Proxy] 健康检查尝试 {}/{}", attempt, max_retries);

        match client.get(&health_url).send().await {
            Ok(resp) => {
                if resp.status().is_success() {
                    println!("[RTSP Proxy] 服务健康检查通过");
                    health_check_passed = true;
                    break;
                } else {
                    println!("[RTSP Proxy] 健康检查响应状态: {}", resp.status());
                }
            }
            Err(e) => {
                println!("[RTSP Proxy] 健康检查失败 (尝试 {}/{}): {}", attempt, max_retries, e);
            }
        }

        if attempt < max_retries {
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        }
    }

    if !health_check_passed {
        // 健康检查失败，终止进程
        println!("[RTSP Proxy] 健康检查失败，终止进程");
        #[cfg(target_os = "windows")]
        {
            let _ = Command::new("taskkill")
                .args(&["/F", "/T", "/PID", &child.id().to_string()])
                .status();
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = child.kill();
        }
        return Err(format!("RTSP 代理服务启动失败：健康检查未通过（尝试了{}次）", max_retries));
    }

    // 保存进程
    {
        let mut process = state.process.lock().await;
        *process = Some(child);
    }

    Ok(format!("RTSP 代理服务已启动: http://{}:{}", state.host, state.port))
}

/// 停止 RTSP 代理服务
#[tauri::command]
pub async fn stop_rtsp_proxy(app_handle: AppHandle) -> Result<String, String> {
    let state = app_handle.state::<RtspProxyState>();

    let mut process = state.process.lock().await;
    if let Some(mut child) = process.take() {
        // 优雅关闭
        #[cfg(target_os = "windows")]
        {
            // Windows: 使用 taskkill
            let status = Command::new("taskkill")
                .args(&["/F", "/T", "/PID", &child.id().to_string()])
                .status();

            if let Err(e) = status {
                eprintln!("[RTSP Proxy] 停止服务失败: {}", e);
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            child.kill().map_err(|e| format!("停止 RTSP 代理服务失败: {}", e))?;
        }

        child.wait().ok();
        println!("[RTSP Proxy] 服务已停止");
        Ok("RTSP 代理服务已停止".to_string())
    } else {
        Ok("RTSP 代理服务未运行".to_string())
    }
}

/// 检查 RTSP 代理服务状态
#[tauri::command]
pub async fn check_rtsp_proxy_status(app_handle: AppHandle) -> Result<serde_json::Value, String> {
    let state = app_handle.state::<RtspProxyState>();

    // 🎯 关键修复：通过HTTP健康检查判断服务是否真正运行
    // 而不是只检查进程状态（因为手动启动的进程不在Tauri管理范围内）
    let client = reqwest::Client::new();
    let health_url = format!("http://{}:{}/health", state.host, state.port);

    let is_running = match client.get(&health_url).send().await {
        Ok(resp) => resp.status().is_success(),
        Err(_) => false,
    };

    Ok(serde_json::json!({
        "running": is_running,
        "host": state.host,
        "port": state.port,
        "url": format!("http://{}:{}", state.host, state.port)
    }))
}

/// 启动 RTSP 流代理（Node.js）
#[tauri::command]
pub async fn start_rtsp_stream_proxy(
    app_handle: AppHandle,
    rtsp_url: String,
    stream_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let state = app_handle.state::<RtspProxyState>();

    // 🎯 关键修复：通过HTTP健康检查判断服务是否真正运行
    // 而不是只检查进程状态（因为手动启动的进程不在Tauri管理范围内）
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| format!("创建HTTP客户端失败: {}", e))?;

    //  尝试多个地址（localhost 和 127.0.0.1）
    let health_urls = vec![
        format!("http://localhost:{}/health", state.port),
        format!("http://127.0.0.1:{}/health", state.port),
    ];

    log::info!("🔍 开始健康检查，尝试地址: {:?}", health_urls);

    // 🎯 添加重试机制，最多尝试3次
    let max_retries = 3;
    let mut is_running = false;
    let mut last_error = String::new();

    for health_url in &health_urls {
        for attempt in 1..=max_retries {
            log::info!("🔄 健康检查: {} (尝试 {}/{})", health_url, attempt, max_retries);

            match client.get(health_url).send().await {
                Ok(resp) => {
                    let status = resp.status();
                    log::info!("✅ 健康检查响应状态: {}", status);
                    if status.is_success() {
                        is_running = true;
                        log::info!("✅ 健康检查通过: {}", health_url);
                        break;
                    } else {
                        log::warn!("️ 健康检查返回非成功状态: {}", status);
                    }
                }
                Err(e) => {
                    log::warn!("❌ 健康检查失败 (尝试 {}/{}): {}", attempt, max_retries, e);
                    last_error = format!("{} - {}", health_url, e);
                    // 添加更多调试信息
                    log::warn!("错误类型: {:?}", e);
                    if e.is_timeout() {
                        log::warn!("超时：RTSP Proxy服务可能未启动或网络不通");
                    } else if e.is_connect() {
                        log::warn!("连接失败：请检查RTSP Proxy服务是否在 {}:{} 运行", state.host, state.port);
                    } else if e.is_request() {
                        log::warn!("请求错误：可能是URL格式问题");
                    }
                }
            }

            if is_running {
                break;
            }

            // 如果不是最后一次尝试，等待1秒后重试
            if attempt < max_retries {
                tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            }
        }

        if is_running {
            break;
        }
    }

    if !is_running {
        let error_msg = if last_error.is_empty() {
            "RTSP 代理服务未运行，请先启动服务 (所有健康检查尝试均失败)".to_string()
        } else {
            format!("RTSP 代理服务未运行，请先启动服务 (最后错误: {})", last_error)
        };
        return Err(error_msg);
    }

    let api_url = format!("http://{}:{}/api/start", state.host, state.port);

    let body = serde_json::json!({
        "url": rtsp_url,
        "streamId": stream_id
    });

    let resp = client
        .post(&api_url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let result: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    if result["success"].as_bool().unwrap_or(false) {
        Ok(result)
    } else {
        Err(format!("启动流失败: {}", result["error"].as_str().unwrap_or("未知错误")))
    }
}

/// 停止 RTSP 流代理（Node.js）
#[tauri::command]
pub async fn stop_rtsp_stream_proxy(
    app_handle: AppHandle,
    stream_id: String,
) -> Result<String, String> {
    let state = app_handle.state::<RtspProxyState>();

    let client = reqwest::Client::new();
    let api_url = format!("http://{}:{}/api/stop", state.host, state.port);

    let body = serde_json::json!({
        "streamId": stream_id
    });

    let resp = client
        .post(&api_url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let result: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    if result["success"].as_bool().unwrap_or(false) {
        Ok("流已停止".to_string())
    } else {
        Err(format!("停止流失败: {}", result["error"].as_str().unwrap_or("未知错误")))
    }
}

/// 获取所有活跃流
#[tauri::command]
pub async fn get_rtsp_streams(app_handle: AppHandle) -> Result<serde_json::Value, String> {
    let state = app_handle.state::<RtspProxyState>();

    let client = reqwest::Client::new();
    let api_url = format!("http://{}:{}/api/streams", state.host, state.port);

    let resp = client
        .get(&api_url)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let streams: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    Ok(streams)
}

/// 查找 rtsp-proxy.js 脚本
fn find_rtsp_proxy_script() -> Result<String, String> {
    // 尝试多个可能的路径
    let possible_paths = vec![
        // 开发环境：相对于可执行文件
        "./rtsp-proxy/rtsp-proxy.js",
        "../rtsp-proxy/rtsp-proxy.js",
        "../../rtsp-proxy/rtsp-proxy.js",
        // 绝对路径
        "f:/20260227/tauri-app/rtsp-proxy/rtsp-proxy.js",
        // Tauri资源目录
        "resources/rtsp-proxy/rtsp-proxy.js",
    ];

    for path in &possible_paths {
        if std::path::Path::new(path).exists() {
            let canonical = std::path::Path::new(path)
                .canonicalize()
                .map_err(|e| format!("路径规范化失败: {}", e))?;

            // 转换为字符串，处理Windows UNC路径
            let path_str = canonical
                .to_str()
                .ok_or("无效的路径编码")?
                .to_string();

            // 如果是Windows UNC路径 (\\?\)，转换为普通路径
            #[cfg(target_os = "windows")]
            let path_str = if path_str.starts_with("\\\\?\\") {
                path_str[4..].to_string()
            } else {
                path_str
            };

            println!("[RTSP Proxy] 找到脚本: {}", path_str);
            return Ok(path_str);
        }
    }

    // 如果都没找到，返回一个明确的错误信息
    Err(format!("未找到 rtsp-proxy.js 脚本。尝试的路径: {:?}", possible_paths))
}
