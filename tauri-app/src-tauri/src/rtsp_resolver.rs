use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::time::timeout;
use url::Url;

use crate::ptz::onvif::OnvifCamera;

/// RTSP 解析请求
#[derive(Debug, Clone, Deserialize)]
pub struct RtspResolveRequest {
    pub manufacturer: String,
    pub host: String,
    #[serde(default = "default_rtsp_port")]
    pub port: u16,
    pub username: String,
    pub password: String,
    pub onvif_uri: Option<String>,
    pub onvif_port: Option<u16>,
    #[serde(default)]
    pub scan_mode: bool,
}

fn default_rtsp_port() -> u16 {
    554
}

/// RTSP 解析结果
#[derive(Debug, Clone, Serialize)]
pub struct RtspResolveResult {
    /// 主码流 RTSP 地址
    pub uri: String,
    /// 来源
    pub source: String,
    /// 是否有效
    pub valid: bool,
    /// 所有码流地址（主码流+子码流，逗号分隔）
    pub media_urls: String,
}

#[tauri::command]
pub async fn resolve_rtsp(req: RtspResolveRequest) -> Result<RtspResolveResult, String> {
    log::info!(
        "[RTSP解析] 开始解析 - 品牌: {}, 主机: {}, RTSP端口: {}, ONVIF端口: {:?}",
        req.manufacturer, req.host, req.port, req.onvif_port
    );

    // ONVIF 是 HTTP 协议，端口通常是 80/8080，不是 RTSP 的 554
    let mut onvif_ports: Vec<u16> = Vec::new();

    // 🎯 优先级1：用户指定的端口（最高优先级）
    if let Some(p) = req.onvif_port {
        onvif_ports.push(p);
        log::info!("[RTSP解析] 使用用户指定端口: {}", p);
    }

    // 🎯 优先级2：根据品牌智能选择端口
    let brand_ports = match req.manufacturer.to_lowercase().as_str() {
        "hikvision" | "海康威视" => vec![80, 8000, 8080],
        "dahua" | "大华" => vec![80, 37777, 8080],
        "axis" | "安讯士" => vec![80, 8080],
        "uniview" | "宇视" => vec![80, 8080],
        "samsung" | "三星" => vec![80, 8080],
        "sony" | "索尼" => vec![80, 8080],
        "panasonic" | "松下" => vec![80, 8080],
        _ => vec![], // 未知品牌，使用默认
    };

    for &port in &brand_ports {
        if !onvif_ports.contains(&port) {
            onvif_ports.push(port);
        }
    }

    // 🎯 优先级3：通用ONVIF端口（按使用频率排序）
    let common_ports = if req.scan_mode {
        // 搜索模式：扫描更多端口
        vec![80, 8080, 8000, 37777, 34567]
    } else {
        // 手动模式：只扫描最常用的3个端口
        vec![80, 8080, 8000]
    };

    for &port in &common_ports {
        if !onvif_ports.contains(&port) {
            onvif_ports.push(port);
        }
    }

    log::info!("[RTSP解析] 端口模式: {}, 将尝试端口: {:?}",
        if req.scan_mode { "搜索模式" } else { "手动模式" },
        onvif_ports
    );

    log::info!("[RTSP解析] 将依次尝试 ONVIF 端口: {:?}", onvif_ports);

    // Step 1: 并发TCP探测
    log::info!("[RTSP解析] Step 1: TCP端口探测...");
    let mut tcp_tasks = Vec::new();

    // 🎯 根据扫描模式调整超时时间
    let tcp_timeout_ms = if req.scan_mode { 1000 } else { 2000 };

    for &port in &onvif_ports {
        let addr = format!("{}:{}", req.host, port);
        tcp_tasks.push(async move {
            match timeout(Duration::from_millis(tcp_timeout_ms), tokio::net::TcpStream::connect(&addr)).await {
                Ok(Ok(_)) => Some(port),
                _ => None,
            }
        });
    }
    let tcp_results = join_all(tcp_tasks).await;
    let mut open_ports: Vec<u16> = tcp_results.into_iter().flatten().collect();

    if open_ports.is_empty() {
        log::warn!("[RTSP解析] 所有端口不可达，仍尝试指定端口");
        if let Some(p) = req.onvif_port { open_ports.push(p); } else { open_ports.push(80); }
    }

    log::info!("[RTSP解析] Step 2: 开放端口 {:?}, 开始ONVIF探测", open_ports);

    // Step 2: 对开放端口尝试 ONVIF 协议获取 RTSP 地址
    let mut last_error = String::new();
    let mut tried_count = 0u32;

    // 🎯 根据扫描模式调整ONVIF超时时间
    let onvif_timeout_secs = if req.scan_mode { 5 } else { 10 };

    for port in &open_ports {
        tried_count += 1;
        log::info!("[RTSP解析] 尝试端口 {} ({}/{})", port, tried_count, open_ports.len());

        let cam_id = format!("rtsp_resolver_{}_{}", req.host, port);
        let camera = OnvifCamera::new(&cam_id, &req.host, *port, &req.username, &req.password, "");

        match timeout(Duration::from_secs(onvif_timeout_secs), camera.get_stream_uri()).await {
            Ok(Ok(stream_uri)) if !stream_uri.uri.is_empty() => {
                log::info!("[RTSP解析] ONVIF 获取成功 (端口:{}): uri={}, media_urls={}",
                    port, stream_uri.uri, stream_uri.media_urls);

                if let Some(cleaned) = clean_onvif_uri(&stream_uri.uri, &req.host) {
                    let cleaned_urls: Vec<String> = stream_uri.media_urls.split(",")
                        .filter_map(|u| clean_onvif_uri(u.trim(), &req.host))
                        .collect();
                    let media_urls = cleaned_urls.join(",");
                    log::info!("[RTSP解析] 成功! 端口: {}, 码流数: {}",
                        port, media_urls.split(",").count());
                    return Ok(RtspResolveResult {
                        uri: cleaned,
                        source: "onvif_protocol".into(),
                        valid: true,
                        media_urls,
                    });
                } else {
                    log::warn!("[RTSP解析] 地址清理失败，原始URI: {}", stream_uri.uri);
                    last_error = format!("端口{}返回了无效的URI: {}", port, stream_uri.uri);
                }
            }
            Ok(Ok(_stream_uri)) => {
                log::warn!("[RTSP解析] 端口{}返回空URI，继续尝试", port);
                last_error = format!("端口{}返回空URI", port);
            }
            Ok(Err(e)) => {
                log::warn!("[RTSP解析] 端口{} ONVIF调用失败: {:?}", port, e);
                last_error = format!("端口{}: {}", port, e);
            }
            Err(_) => {
                log::warn!("[RTSP解析] 端口{} ONVIF调用超时(10s)", port);
                last_error = format!("端口{}超时", port);
            }
        }
    }

    log::error!("[RTSP解析] 所有ONVIF端口探测均失败 (尝试了{}个端口)", tried_count);
    log::error!("   最后错误: {}", last_error);

    // 回退策略：构建常见 RTSP 路径候选并进行探针验证（TCP + RTSP DESCRIBE）
    log::info!("[RTSP解析] 开始回退候选探测（构建并验证常见 RTSP 路径）");

    // 构建凭据前缀（用于 URI）
    let creds_prefix = if !req.username.is_empty() && !req.password.is_empty() {
        format!("{}:{}@", req.username, req.password)
    } else {
        "".to_string()
    };

    let host_port = format!("{}:{}", req.host, req.port);
    let candidates = vec![
        format!("rtsp://{}{}/live/av0", creds_prefix, host_port),
        format!("rtsp://{}{}/live.sdp", creds_prefix, host_port),
        format!("rtsp://{}{}/Streaming/Channels/101", creds_prefix, host_port),
        format!("rtsp://{}{}/Streaming/Channels/101/preview", creds_prefix, host_port),
        format!("rtsp://{}{}/h264", creds_prefix, host_port),
        format!("rtsp://{}{}/ch0_0.264", creds_prefix, host_port),
    ];

    // 简单的 RTSP 探针：TCP 连接 + 发送 DESCRIBE，若返回 200 则认为可用；若返回 401 则尝试 Basic Auth
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use base64::{engine::general_purpose, Engine as _};

    async fn probe_rtsp(uri: &str, username: &str, password: &str) -> bool {
        if let Ok(parsed) = Url::parse(uri) {
            if let Some(host) = parsed.host_str() {
                let port = parsed.port_or_known_default().unwrap_or(554);
                let addr = format!("{}:{}", host, port);
                // TCP 连接
                if let Ok(Ok(mut stream)) = timeout(Duration::from_secs(3), tokio::net::TcpStream::connect(&addr)).await {
                    let req = format!("DESCRIBE {} RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: rtsp_probe\r\n\r\n", uri);
                    if let Ok(_) = stream.write_all(req.as_bytes()).await {
                        let mut buf = vec![0u8; 1024];
                        if let Ok(Ok(n)) = timeout(Duration::from_secs(3), stream.read(&mut buf)).await {
                            let resp = String::from_utf8_lossy(&buf[..n]).to_string();
                            if resp.contains("RTSP/1.0 200") {
                                return true;
                            }
                            if resp.contains("RTSP/1.0 401") && !username.is_empty() {
                                // 尝试带 Basic Auth 重新请求（新连接）
                                if let Ok(Ok(mut s2)) = timeout(Duration::from_secs(3), tokio::net::TcpStream::connect(&addr)).await {
                                    let creds = format!("{}:{}", username, password);
                                    let token = general_purpose::STANDARD.encode(creds);
                                    let req2 = format!("DESCRIBE {} RTSP/1.0\r\nCSeq: 2\r\nUser-Agent: rtsp_probe\r\nAuthorization: Basic {}\r\n\r\n", uri, token);
                                    if let Ok(_) = s2.write_all(req2.as_bytes()).await {
                                        let mut buf2 = vec![0u8; 1024];
                                        if let Ok(Ok(m)) = timeout(Duration::from_secs(3), s2.read(&mut buf2)).await {
                                            let r2 = String::from_utf8_lossy(&buf2[..m]).to_string();
                                            if r2.contains("RTSP/1.0 200") {
                                                return true;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        false
    }

    // 并行验证候选：使用并发探针并验证 SDP 内容（确保是视频/ H264），带并发速率限制与重试策略
    log::info!("[RTSP解析] 并行探测回退候选并验证 SDP（并发限制 + 重试）");

    use futures_util::future::join_all;
    use std::sync::Arc;
    use tokio::sync::Semaphore;

    // 并发/重试参数
    let concurrency_limit: usize = 4; // 同时探测的最大候选数
    let retries: usize = 2; // 每个候选的重试次数
    let base_backoff_ms: u64 = 300; // 指数退避基数（毫秒）

    // 单次探针实现（不含重试）
    async fn probe_once(uri: &str, username: &str, password: &str) -> Option<String> {
        if let Ok(parsed) = Url::parse(uri) {
            if let Some(host) = parsed.host_str() {
                let port = parsed.port_or_known_default().unwrap_or(554);
                let addr = format!("{}:{}", host, port);
                if let Ok(Ok(mut stream)) = timeout(Duration::from_secs(3), tokio::net::TcpStream::connect(&addr)).await {
                    let req = format!("DESCRIBE {} RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: rtsp_probe\r\n\r\n", uri);
                    if stream.write_all(req.as_bytes()).await.is_ok() {
                        let mut buf = vec![0u8; 4096];
                        if let Ok(Ok(n)) = timeout(Duration::from_secs(3), stream.read(&mut buf)).await {
                            let resp = String::from_utf8_lossy(&buf[..n]).to_string();
                            if resp.contains("RTSP/1.0 200") {
                                // 提取 SDP 并做简单校验
                                let sdp = if let Some(idx) = resp.find("\r\n\r\n") { resp[idx+4..].to_string() } else { String::new() };
                                let sdp_lower = sdp.to_lowercase();
                                if sdp_lower.contains("m=video") && (sdp_lower.contains("h264") || sdp_lower.contains("rtpmap")) {
                                    return Some(sdp);
                                }
                            }
                            if resp.contains("RTSP/1.0 401") && !username.is_empty() {
                                // Basic Auth 尝试
                                drop(stream);
                                if let Ok(Ok(mut s2)) = timeout(Duration::from_secs(3), tokio::net::TcpStream::connect(&addr)).await {
                                    let creds = format!("{}:{}", username, password);
                                    let token = general_purpose::STANDARD.encode(creds);
                                    let req2 = format!("DESCRIBE {} RTSP/1.0\r\nCSeq: 2\r\nUser-Agent: rtsp_probe\r\nAuthorization: Basic {}\r\n\r\n", uri, token);
                                    if s2.write_all(req2.as_bytes()).await.is_ok() {
                                        let mut buf2 = vec![0u8; 4096];
                                        if let Ok(Ok(m)) = timeout(Duration::from_secs(3), s2.read(&mut buf2)).await {
                                            let r2 = String::from_utf8_lossy(&buf2[..m]).to_string();
                                            if r2.contains("RTSP/1.0 200") {
                                                let sdp = if let Some(idx) = r2.find("\r\n\r\n") { r2[idx+4..].to_string() } else { String::new() };
                                                let sdp_lower = sdp.to_lowercase();
                                                if sdp_lower.contains("m=video") && (sdp_lower.contains("h264") || sdp_lower.contains("rtpmap")) {
                                                    return Some(sdp);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        None
    }

    // 使用信号量限制并发，并为每个候选实现重试
    let sem = Arc::new(Semaphore::new(concurrency_limit));
    let mut futures = Vec::new();
    for candidate in &candidates {
        let uri = candidate.clone();
        let user = req.username.clone();
        let pass = req.password.clone();
        let sem_clone = sem.clone();
        futures.push(async move {
            // 获取许可证
            let _permit = sem_clone.acquire().await.unwrap();
            // 重试机制
            for attempt in 0..=retries {
                if let Some(sdp) = probe_once(&uri, &user, &pass).await {
                    return Some((uri, sdp));
                }
                if attempt < retries {
                    let backoff = base_backoff_ms * (2u64.pow(attempt as u32));
                    tokio::time::sleep(Duration::from_millis(backoff)).await;
                }
            }
            None
        });
    }

    // 并发执行并在结果中选第一个成功项
    let results = join_all(futures).await;
    for res in results.into_iter() {
        if let Some((uri, _sdp)) = res {
            log::info!("[RTSP解析] 并行探测找到可用候选: {}", uri);
            return Ok(RtspResolveResult {
                uri: uri.clone(),
                source: "fallback_probe_parallel".into(),
                valid: true,
                media_urls: uri.clone(),
            });
        }
    }

    // 提供更详细的故障排除指南
    let troubleshooting_guide = "\n请检查：\n1. 摄像机ONVIF功能是否已启用\n2. 用户名和密码是否正确\n3. 网络连接是否正常\n4. ONVIF端口是否正确（通常为80、8080等）\n5. 摄像机型号是否支持ONVIF协议\n6. 摄像机是否在线且工作正常";

    Err(format!("ONVIF 协议获取 RTSP 地址失败，尝试了{}个端口。最后错误: {}。{}\n建议：您可以尝试手动输入RTSP地址或检查摄像机设置。", tried_count, last_error, troubleshooting_guide))
}

/// 清理 ONVIF 返回的相对路径/localhost 地址
fn clean_onvif_uri(uri: &str, fallback_host: &str) -> Option<String> {
    if !uri.starts_with("rtsp://") {
        log::warn!("[RTSP解析] ONVIF URI 不是 rtsp:// 协议: {}", uri);
        return None;
    }

    let mut cleaned = uri.to_string();
    cleaned = cleaned.replace("rtsp://localhost", &format!("rtsp://{}", fallback_host));
    cleaned = cleaned.replace("rtsp://127.0.0.1", &format!("rtsp://{}", fallback_host));
    cleaned = cleaned.replace("rtsp://[::1]", &format!("rtsp://[{}]", fallback_host));

    if let Ok(parsed) = Url::parse(&cleaned) {
        if parsed.path().len() > 1 && parsed.host_str().is_some() {
            return Some(cleaned);
        } else {
            log::warn!("[RTSP解析] 清理后的 URI 缺少有效路径: {}", cleaned);
        }
    } else {
        log::warn!("[RTSP解析] 清理后的 URI 格式无效: {}", cleaned);
    }

    None
}
