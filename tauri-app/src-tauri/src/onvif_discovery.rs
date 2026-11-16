//! ONVIF 设备发现和流地址探索模块
//! 提供类似 ONVIF Device Manager 的功能，包括：
//! - 设备信息获取
//! - 流配置文件查询
//! - RTSP 流地址自动发现
//! - 网络扫描功能

use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::time::timeout;

/// ONVIF 设备信息
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OnvifDeviceInfo {
    pub manufacturer: String,
    pub model: String,
    pub firmware_version: String,
    pub serial_number: String,
    pub hardware_id: String,
    pub name: String,
}

/// ONVIF 流配置文件
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OnvifProfile {
    pub name: String,
    pub token: String,
    pub uri: Option<String>,
    pub encoding: Option<String>,
    pub resolution: Option<String>,
    pub frame_rate: Option<f32>,
    pub bit_rate: Option<u32>,
}

/// RTSP 测试结果
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RtspTestResult {
    pub success: bool,
    pub latency: Option<u64>,
    pub error: Option<String>,
}

/// 获取 ONVIF 设备信息
#[tauri::command]
pub async fn get_onvif_device_info(
    ip: String,
    port: u16,
    username: String,
    password: String,
) -> Result<OnvifDeviceInfo, String> {
    log::info!("[ONVIF] 获取设备信息: {}:{}", ip, port);

    let url = format!("http://{}:{}/onvif/device_service", ip, port);

    let result = fetch_onvif_device_info(&url, &username, &password).await;

    match result {
        Ok(info) => {
            log::info!("[ONVIF] ✅ 获取设备信息成功: {} - {}", info.manufacturer, info.model);
            Ok(info)
        }
        Err(e) => {
            log::error!("[ONVIF] ❌ 获取设备信息失败: {}", e);
            Err(e)
        }
    }
}

/// 获取 ONVIF 流配置文件列表
#[tauri::command]
pub async fn get_onvif_profiles(
    ip: String,
    port: u16,
    username: String,
    password: String,
) -> Result<Vec<OnvifProfile>, String> {
    log::info!("[ONVIF] 获取流配置文件: {}:{}", ip, port);

    let url = format!("http://{}:{}/onvif/device_service", ip, port);

    let profiles = fetch_onvif_profiles(&url, &username, &password).await;

    match profiles {
        Ok(list) => {
            log::info!("[ONVIF] ✅ 获取流配置文件成功，共 {} 个", list.len());
            Ok(list)
        }
        Err(e) => {
            log::error!("[ONVIF] ❌ 获取流配置文件失败: {}", e);
            Err(e)
        }
    }
}

/// 测试 RTSP 连接
#[tauri::command]
pub async fn test_rtsp_connection(rtsp_url: String, timeout_ms: Option<u64>) -> RtspTestResult {
    let timeout_dur = Duration::from_millis(timeout_ms.unwrap_or(5000));

    log::info!("[RTSP] 测试连接: {}", rtsp_url);

    let start = std::time::Instant::now();

    let result = probe_rtsp(&rtsp_url, timeout_dur).await;

    let latency = start.elapsed().as_millis() as u64;

    match result {
        Ok(true) => {
            log::info!("[RTSP] ✅ 连接成功，延迟: {}ms", latency);
            RtspTestResult {
                success: true,
                latency: Some(latency),
                error: None,
            }
        }
        Ok(false) => {
            log::warn!("[RTSP] ❌ 连接失败");
            RtspTestResult {
                success: false,
                latency: Some(latency),
                error: Some("RTSP连接失败".into()),
            }
        }
        Err(e) => {
            log::error!("[RTSP] ❌ 测试异常: {}", e);
            RtspTestResult {
                success: false,
                latency: Some(latency),
                error: Some(e),
            }
        }
    }
}

/// 异步获取 ONVIF 设备信息
async fn fetch_onvif_device_info(url: &str, username: &str, password: &str) -> Result<OnvifDeviceInfo, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| e.to_string())?;

    let body = r#"<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
    <soap:Body>
        <tds:GetDeviceInformation />
    </soap:Body>
</soap:Envelope>"#;

    let response = client
        .post(url)
        .header("Content-Type", "application/soap+xml; charset=utf-8")
        .header("SOAPAction", "http://www.onvif.org/ver10/device/wsdl/GetDeviceInformation")
        .basic_auth(username, Some(password))
        .body(body)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP错误: {}", response.status()));
    }

    let text = response.text().await.map_err(|e| format!("读取响应失败: {}", e))?;

    parse_onvif_device_info(&text)
}

/// 解析 ONVIF 设备信息响应
fn parse_onvif_device_info(xml: &str) -> Result<OnvifDeviceInfo, String> {
    // 使用简单的字符串匹配解析（避免引入复杂的 XML 解析库）
    let get_tag_content = |tag: &str| -> String {
        let start_tag = format!("<{}", tag);
        let end_tag = format!("</{}>", tag);

        if let Some(start) = xml.find(&start_tag) {
            if let Some(content_start) = xml[start..].find('>') {
                let content_start = start + content_start + 1;
                if let Some(end) = xml[content_start..].find(&end_tag) {
                    return xml[content_start..content_start + end].trim().to_string();
                }
            }
        }
        "".to_string()
    };

    let manufacturer = get_tag_content("tds:Manufacturer");
    let model = get_tag_content("tds:Model");
    let firmware_version = get_tag_content("tds:FirmwareVersion");
    let serial_number = get_tag_content("tds:SerialNumber");
    let hardware_id = get_tag_content("tds:HardwareId");
    let name = get_tag_content("tds:Name");

    if manufacturer.is_empty() && model.is_empty() {
        return Err("无法解析设备信息".into());
    }

    Ok(OnvifDeviceInfo {
        manufacturer: if manufacturer.is_empty() { "Unknown".into() } else { manufacturer },
        model: if model.is_empty() { "Unknown".into() } else { model },
        firmware_version,
        serial_number,
        hardware_id,
        name: if name.is_empty() { "Camera".into() } else { name },
    })
}

/// 异步获取 ONVIF 流配置文件
async fn fetch_onvif_profiles(url: &str, username: &str, password: &str) -> Result<Vec<OnvifProfile>, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| e.to_string())?;

    let body = r#"<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:tds="http://www.onvif.org/ver10/media/wsdl">
    <soap:Body>
        <tds:GetProfiles />
    </soap:Body>
</soap:Envelope>"#;

    // 尝试媒体服务端点
    let media_url = url.replace("/device_service", "/media_service");

    let response = client
        .post(&media_url)
        .header("Content-Type", "application/soap+xml; charset=utf-8")
        .header("SOAPAction", "http://www.onvif.org/ver10/media/wsdl/GetProfiles")
        .basic_auth(username, Some(password))
        .body(body)
        .send()
        .await;

    let response = match response {
        Ok(r) => r,
        Err(_) => {
            // 回退到设备服务端点
            client
                .post(url)
                .header("Content-Type", "application/soap+xml; charset=utf-8")
                .header("SOAPAction", "http://www.onvif.org/ver10/media/wsdl/GetProfiles")
                .basic_auth(username, Some(password))
                .body(body)
                .send()
                .await
                .map_err(|e| format!("请求失败: {}", e))?
        }
    };

    if !response.status().is_success() {
        return Err(format!("HTTP错误: {}", response.status()));
    }

    let text = response.text().await.map_err(|e| format!("读取响应失败: {}", e))?;

    parse_onvif_profiles(&text)
}

/// 解析 ONVIF 流配置文件响应
fn parse_onvif_profiles(xml: &str) -> Result<Vec<OnvifProfile>, String> {
    let mut profiles = Vec::new();

    // 查找所有 Profile 块
    let profile_start = "<tds:Profile";
    let profile_end = "</tds:Profile>";

    let mut xml_copy = xml;

    while let Some(start) = xml_copy.find(profile_start) {
        xml_copy = &xml_copy[start..];

        if let Some(end) = xml_copy.find(profile_end) {
            let profile_xml = &xml_copy[..end + profile_end.len()];

            let get_tag_content = |tag: &str| -> String {
                let start_tag = format!("<{}", tag);
                let end_tag = format!("</{}>", tag);

                if let Some(s) = profile_xml.find(&start_tag) {
                    if let Some(content_start) = profile_xml[s..].find('>') {
                        let content_start = s + content_start + 1;
                        if let Some(e) = profile_xml[content_start..].find(&end_tag) {
                            return profile_xml[content_start..content_start + e].trim().to_string();
                        }
                    }
                }
                "".to_string()
            };

            let name = get_tag_content("tds:Name");
            let token = get_tag_content("tt:token");

            // 尝试获取流 URI
            let mut uri = None;
            if let Some(stream_start) = profile_xml.find("<tt:Uri>") {
                if let Some(content_start) = profile_xml[stream_start..].find('>') {
                    let content_start = stream_start + content_start + 1;
                    if let Some(end) = profile_xml[content_start..].find("</tt:Uri>") {
                        uri = Some(profile_xml[content_start..content_start + end].trim().to_string());
                    }
                }
            }

            if !name.is_empty() || !token.is_empty() {
                profiles.push(OnvifProfile {
                    name: if name.is_empty() { format!("Profile {}", profiles.len() + 1) } else { name },
                    token,
                    uri,
                    encoding: None,
                    resolution: None,
                    frame_rate: None,
                    bit_rate: None,
                });
            }

            xml_copy = &xml_copy[end + profile_end.len()..];
        } else {
            break;
        }
    }

    Ok(profiles)
}

/// 轻量级 RTSP 探针
async fn probe_rtsp(uri: &str, timeout_dur: Duration) -> Result<bool, String> {
    use url::Url;
    use tokio::net::TcpStream;

    let parsed = Url::parse(uri).map_err(|e| format!("无效的URI: {}", e))?;

    let host = parsed.host_str().ok_or_else(|| "缺少主机地址".to_string())?;
    let port = parsed.port().unwrap_or(554);

    log::debug!("[RTSP探针] 连接到 {}:{}", host, port);

    let connect_res = timeout(timeout_dur, TcpStream::connect((host, port))).await;

    let mut stream = match connect_res {
        Ok(Ok(s)) => s,
        Ok(Err(_e)) => {
            return Ok(false);
        }
        Err(_) => {
            return Ok(false);
        }
    };

    // 发送 RTSP OPTIONS 请求
    let request = format!(
        "OPTIONS {} RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: TauriONVIF/1.0\r\n\r\n",
        uri
    );

    if stream.write_all(request.as_bytes()).await.is_err() {
        return Ok(false);
    }

    // 读取响应
    let mut buf = [0u8; 512];
    let read_res = timeout(timeout_dur, stream.read(&mut buf)).await;

    let n = match read_res {
        Ok(Ok(n)) => n,
        Ok(Err(_)) => return Ok(false),
        Err(_) => return Ok(false),
    };

    let resp = String::from_utf8_lossy(&buf[..n]);

    // 接受 200 OK 或 401 Unauthorized（需要认证）
    let is_valid = resp.starts_with("RTSP/1.0 200") || resp.starts_with("RTSP/1.0 401");

    Ok(is_valid)
}
