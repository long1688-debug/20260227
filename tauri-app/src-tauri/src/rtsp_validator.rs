use reqwest::Client;
use std::time::Duration;
use tokio::net::TcpStream;
use tauri::{AppHandle, Manager};
use serde::{Serialize, Deserialize};
use crate::stream_proxy;

// RTSP 地址验证模块

/// RTSP 地址验证结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RtspValidationResult {
    pub url: String,
    pub is_valid: bool,
    pub error_message: Option<String>,
    pub response_time_ms: u64,
}

/// 品牌 RTSP 模板库
pub const BRAND_RTSP_TEMPLATES: &[(&str, &[&str])] = &[
    // 海康威视
    ("hikvision", &[
        "rtsp://{ip}:554/h264/ch1/main/av_stream",
        "rtsp://{ip}:554/h264/ch1/sub/av_stream",
        "rtsp://{ip}/h264/ch1/main/av_stream",
    ]),
    // 大华
    ("dahua", &[
        "rtsp://{ip}:554/cam/realmonitor?channel=1&subtype=0",
        "rtsp://{ip}:554/cam/realmonitor?channel=1&subtype=1",
        "rtsp://{ip}/cam/realmonitor?channel=1&subtype=0",
    ]),
    // 宇视
    ("uniview", &[
        "rtsp://{ip}:554/stream",
        "rtsp://{ip}:554/unicast/c1/s1/live",
    ]),
    // 安讯士
    ("axis", &[
        "rtsp://{ip}:554/axis-media/media.amp",
        "rtsp://{ip}:554/axis-media/media.3gp",
    ]),
    // 雄迈
    ("xiongmai", &[
        "rtsp://{ip}:554/live/av0",
        "rtsp://{ip}:554/user=admin&password=&channel=1&stream=0.sdp",
    ]),
    // TP-Link
    ("tplink", &[
        "rtsp://{ip}:554/stream1",
        "rtsp://{ip}:554/stream2",
    ]),
    // 通用模板（最后尝试）
    ("generic", &[
        "rtsp://{ip}:554/live/ch1",
        "rtsp://{ip}:554/Streaming/Channels/101",
        "rtsp://{ip}:554/Streaming/Channels/102",
        "rtsp://{ip}:8554/live",
    ]),
];

/// 替换模板中的 IP 占位符
fn replace_ip_template(template: &str, ip: &str) -> String {
    template.replace("{ip}", ip)
}

/// 检查端口是否开放
async fn check_port_open(ip: &str, port: u16) -> bool {
    let addr = format!("{}:{}", ip, port);

    match tokio::time::timeout(
        Duration::from_millis(1000),
        TcpStream::connect(&addr)
    ).await {
        Ok(Ok(_)) => true,
        _ => false,
    }
}

/// 验证单个 RTSP 地址（通过端口检测 + ZLMediaKit 测试）
pub async fn validate_rtsp_url(
    client: &Client,
    zlmediakit_host: &str,
    zlmediakit_port: u16,
    zlmediakit_secret: &str,
    rtsp_url: &str,
) -> RtspValidationResult {
    let start_time = std::time::Instant::now();

    // 步骤 1: 解析 IP 和端口
    let (ip, port) = match parse_rtsp_url(rtsp_url) {
        Some((ip, port)) => (ip, port),
        None => {
            return RtspValidationResult {
                url: rtsp_url.to_string(),
                is_valid: false,
                error_message: Some("RTSP URL 格式错误".to_string()),
                response_time_ms: start_time.elapsed().as_millis() as u64,
            };
        }
    };

    // 步骤 2: 检查 RTSP 端口是否开放
    if !check_port_open(&ip, port).await {
        return RtspValidationResult {
            url: rtsp_url.to_string(),
            is_valid: false,
            error_message: Some(format!("端口 {}:{} 不可达", ip, port)),
            response_time_ms: start_time.elapsed().as_millis() as u64,
        };
    }

    // 步骤 3: 通过 ZLMediaKit 测试拉流
    match test_zlmediakit_pull(
        client,
        zlmediakit_host,
        zlmediakit_port,
        zlmediakit_secret,
        rtsp_url,
    ).await {
        Ok(_) => RtspValidationResult {
            url: rtsp_url.to_string(),
            is_valid: true,
            error_message: None,
            response_time_ms: start_time.elapsed().as_millis() as u64,
        },
        Err(e) => RtspValidationResult {
            url: rtsp_url.to_string(),
            is_valid: false,
            error_message: Some(e),
            response_time_ms: start_time.elapsed().as_millis() as u64,
        },
    }
}

/// 解析 RTSP URL，提取 IP 和端口
fn parse_rtsp_url(url: &str) -> Option<(String, u16)> {
    // 移除 rtsp:// 前缀
    let url_without_prefix = url.strip_prefix("rtsp://")?;

    // 处理认证信息（如果有）
    let url_without_auth = if let Some(at_pos) = url_without_prefix.find('@') {
        &url_without_prefix[at_pos + 1..]
    } else {
        url_without_prefix
    };

    // 分离路径
    let (host_part, _) = url_without_auth.split_once('/').unwrap_or((url_without_auth, ""));

    // 分离 IP 和端口
    if let Some((ip, port_str)) = host_part.split_once(':') {
        if let Ok(port) = port_str.parse::<u16>() {
            Some((ip.to_string(), port))
        } else {
            None
        }
    } else {
        // 默认端口 554
        Some((host_part.to_string(), 554))
    }
}

/// 通过 ZLMediaKit 测试拉流
async fn test_zlmediakit_pull(
    client: &Client,
    host: &str,
    port: u16,
    secret: &str,
    rtsp_url: &str,
) -> Result<(), String> {
    // 生成临时流 ID
    let stream_id = format!("test_{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis());

    // 调用 addStreamProxy API
    let api_url = format!("http://{}:{}/index/api/addStreamProxy?secret={}", host, port, secret);

    let resp = client
        .post(&api_url)
        .json(&serde_json::json!({
            "vhost": "__defaultVhost__",
            "app": "live",
            "stream": &stream_id,
            "url": rtsp_url,
            "enable_hls": 0,
            "enable_mp4": 0,
            "enable_flv": 1,
            "enable_rtsp": 1,
            "enable_rtmp": 1,
            "enable_ts": 0,
            "h265_enabled": 1,
            "h264_enabled": 1,
            "audio_enabled": 1,
            "retry_count": 0,  // 不重试，快速失败
            "rtp_type": 0,
            "timeout_sec": 3,  // 短超时y
            "enable_audio": 1,
            "auto_close": 1,   // 自动关闭
        }))
        .send()
        .await
        .map_err(|e| format!("ZLMediaKit 请求失败: {}", e))?;

    let body: serde_json::Value = resp
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    if body["code"].as_i64().unwrap_or(1) != 0 {
        return Err(format!("ZLM 拉流失败: {}", body["msg"].as_str().unwrap_or("未知错误")));
    }

    // 等待 2 秒让流建立
    tokio::time::sleep(Duration::from_secs(2)).await;

    // 检查流是否成功注册
    let check_url = format!("http://{}:{}/index/api/getMediaList?secret={}", host, port, secret);

    let check_resp = client
        .get(&check_url)
        .query(&[
            ("vhost", "__defaultVhost__"),
            ("app", "live"),
            ("stream", &stream_id),
        ])
        .send()
        .await
        .map_err(|e| format!("检查流状态失败: {}", e))?;

    let check_body: serde_json::Value = check_resp
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("解析检查响应失败: {}", e))?;

    // 关闭测试流
    let close_url = format!("http://{}:{}/index/api/close_streams?secret={}", host, port, secret);
    client
        .post(&close_url)
        .json(&serde_json::json!({
            "vhost": "__defaultVhost__",
            "app": "live",
            "stream": &stream_id,
        }))
        .send()
        .await
        .ok();

    // 判断是否成功
    if let Some(data) = check_body["data"].as_array() {
        if !data.is_empty() {
            return Ok(());
        }
    }

    Err("流未成功注册".to_string())
}

/// 智能尝试多个 RTSP 地址模板
pub async fn try_multiple_rtsp_templates(
    client: &Client,
    zlmediakit_host: &str,
    zlmediakit_port: u16,
    zlmediakit_secret: &str,
    ip: &str,
    brand: Option<&str>,
) -> Option<String> {
    println!("[RTSP验证] 开始尝试多个 RTSP 地址模板，IP: {}, 品牌: {:?}", ip, brand);

    // 确定要尝试的模板列表
    let templates_to_try = if let Some(brand_name) = brand {
        // 如果指定了品牌，先尝试该品牌的模板
        BRAND_RTSP_TEMPLATES
            .iter()
            .find(|(name, _)| *name == brand_name)
            .map(|(_, urls)| urls.to_vec())
            .unwrap_or_else(|| BRAND_RTSP_TEMPLATES.iter().flat_map(|(_, urls)| urls.to_vec()).collect())
    } else {
        // 否则尝试所有模板
        BRAND_RTSP_TEMPLATES.iter().flat_map(|(_, urls)| urls.to_vec()).collect()
    };

    // 逐个尝试
    for template in templates_to_try {
        let rtsp_url = replace_ip_template(template, ip);
        println!("[RTSP验证] 尝试地址: {}", rtsp_url);

        let result = validate_rtsp_url(
            client,
            zlmediakit_host,
            zlmediakit_port,
            zlmediakit_secret,
            &rtsp_url,
        ).await;

        if result.is_valid {
            println!("[RTSP验证] ✅ 找到有效地址: {} (耗时: {}ms)", rtsp_url, result.response_time_ms);
            return Some(rtsp_url);
        } else {
            println!("[RTSP验证] ❌ 地址无效: {} - {}", rtsp_url, result.error_message.unwrap_or_default());
        }
    }

    println!("[RTSP验证] ⚠️ 所有模板均失败");
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_rtsp_url() {
        // 标准格式
        assert_eq!(
            parse_rtsp_url("rtsp://192.168.5.165:554/live/av0"),
            Some(("192.168.5.165".to_string(), 554))
        );

        // 带认证
        assert_eq!(
            parse_rtsp_url("rtsp://admin:pass@192.168.1.100:554/stream"),
            Some(("192.168.1.100".to_string(), 554))
        );

        // 默认端口
        assert_eq!(
            parse_rtsp_url("rtsp://192.168.1.100/stream"),
            Some(("192.168.1.100".to_string(), 554))
        );
    }

    #[test]
    fn test_replace_ip_template() {
        let template = "rtsp://{ip}:554/h264/ch1/main/av_stream";
        let result = replace_ip_template(template, "192.168.1.100");
        assert_eq!(result, "rtsp://192.168.1.100:554/h264/ch1/main/av_stream");
    }
}

// ==================== Tauri Commands ====================

/// 验证单个 RTSP 地址
#[tauri::command]
pub async fn validate_rtsp_address(
    app: AppHandle,
    rtsp_url: String,
) -> Result<RtspValidationResult, String> {
    let state = app.state::<stream_proxy::StreamState>();
    let client = &state.http_client;
    let host = &state.zlmediakit_host;
    let port = state.zlmediakit_port;
    let secret = &state.zlmediakit_secret;

    println!("[RTSP验证] 开始验证地址: {}", rtsp_url);

    let result = validate_rtsp_url(client, host, port, secret, &rtsp_url).await;

    if result.is_valid {
        println!("[RTSP验证] ✅ 地址有效: {} (耗时: {}ms)", result.url, result.response_time_ms);
    } else {
        println!("[RTSP验证] ❌ 地址无效: {} - {:?}", result.url, result.error_message);
    }

    Ok(result)
}

/// 智能尝试多个 RTSP 地址模板
#[tauri::command]
pub async fn try_multiple_rtsp_templates_cmd(
    app: AppHandle,
    ip: String,
    brand: Option<String>,
) -> Result<Option<String>, String> {
    let state = app.state::<stream_proxy::StreamState>();
    let client = &state.http_client;
    let host = &state.zlmediakit_host;
    let port = state.zlmediakit_port;
    let secret = &state.zlmediakit_secret;

    println!("[RTSP验证] 开始智能尝试 RTSP 模板，IP: {}, 品牌: {:?}", ip, brand);

    let result = try_multiple_rtsp_templates(
        client,
        host,
        port,
        secret,
        &ip,
        brand.as_deref(),
    ).await;

    match &result {
        Some(url) => println!("[RTSP验证] ✅ 找到有效地址: {}", url),
        None => println!("[RTSP验证] ⚠️ 所有模板均失败"),
    }

    Ok(result)
}
