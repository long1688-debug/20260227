use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::time::timeout;
use url::Url;
use futures_util::future::join_all;

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
    Err(format!("ONVIF 协议获取 RTSP 地址失败，尝试了{}个端口。最后错误: {}。请检查摄像机配置或手动输入RTSP地址", tried_count, last_error))
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
