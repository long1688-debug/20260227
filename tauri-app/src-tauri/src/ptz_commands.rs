use tauri::{State, command};
use crate::ptz::PtzDeviceManager;
use crate::ptz::discovery::DiscoveredOnvifDevice;
use crate::ptz::onvif::{OnvifCamera, StreamUri};
use std::time::Duration;

/// 绝对位置移动（点击画面控制）
#[command]
pub async fn ptz_move_absolute(
    device_id: String,
    click_x: f64,
    click_y: f64,
    zoom: f64,
    hfov: Option<f64>,
    vfov: Option<f64>,
    manager: State<'_, PtzDeviceManager>,
) -> Result<String, String> {
    // hfov/vfov 为镜头水平/垂直视场角，默认广角 120°/90°，可配置
    let h = hfov.unwrap_or(120.0);
    let v = vfov.unwrap_or(90.0);

    manager
        .control_click(&device_id, click_x, click_y, zoom, h, v)
        .await
        .map(|_| "云台已响应".into())
        .map_err(|e| format!("PTZ控制失败: {}", e))
}

/// 相对移动
#[command]
pub async fn ptz_relative_move(
    device_id: String,
    pan: f64,
    tilt: f64,
    zoom: f64,
    manager: State<'_, PtzDeviceManager>,
) -> Result<String, String> {
    let cam = manager
        .get(&device_id)
        .await
        .ok_or_else(|| "设备未注册".to_string())?;

    cam.relative_move(pan, tilt, zoom)
        .await
        .map(|_| "相对移动指令已发送".into())
        .map_err(|e| format!("相对移动失败: {}", e))
}

/// 连续移动
#[command]
pub async fn ptz_continuous_move(
    device_id: String,
    pan: f64,
    tilt: f64,
    zoom: f64,
    manager: State<'_, PtzDeviceManager>,
) -> Result<String, String> {
    let cam = manager
        .get(&device_id)
        .await
        .ok_or_else(|| "设备未注册".to_string())?;

    cam.continuous_move(pan, tilt, zoom)
        .await
        .map(|_| "连续移动指令已发送".into())
        .map_err(|e| format!("连续移动失败: {}", e))
}

/// 停止移动
#[command]
pub async fn ptz_stop(device_id: String, manager: State<'_, PtzDeviceManager>) -> Result<String, String> {
    let cam = manager
        .get(&device_id)
        .await
        .ok_or_else(|| "设备未注册".to_string())?;

    cam.stop()
        .await
        .map(|_| "云台已停止".into())
        .map_err(|e| format!("停止失败: {}", e))
}

/// 预置位调用
#[command]
pub async fn ptz_goto_preset(
    device_id: String,
    preset_token: String,
    manager: State<'_, PtzDeviceManager>,
) -> Result<String, String> {
    let cam = manager
        .get(&device_id)
        .await
        .ok_or_else(|| "设备未注册".to_string())?;

    cam.goto_preset(&preset_token)
        .await
        .map(|_| format!("已切换到预置位: {}", preset_token))
        .map_err(|e| format!("预置位调用失败: {}", e))
}

/// 局域网 ONVIF 设备发现
#[command]
pub async fn onvif_discover_devices(
    timeout_secs: u64,
    manager: State<'_, PtzDeviceManager>,
) -> Result<Vec<DiscoveredOnvifDevice>, String> {
    let devs = manager.discover(timeout_secs).await;
    Ok(devs)
}

/// 注册发现的设备
#[command]
pub async fn ptz_register_device(
    ip: String,
    username: String,
    password: String,
    name: Option<String>,
    manager: State<'_, PtzDeviceManager>,
) -> Result<String, String> {
    let dev = DiscoveredOnvifDevice {
        ip: ip.clone(),
        xaddr: format!("http://{}/onvif/device_service", ip),
        name: name.unwrap_or_else(|| format!("ONVIF_{}", ip)),
        hardware_id: "Generic".to_string(),
    };

    manager
        .register_discovered(&dev, &username, &password)
        .await
}

/// 列出所有已注册设备
#[command]
pub async fn ptz_list_devices(manager: State<'_, PtzDeviceManager>) -> Result<Vec<String>, String> {
    Ok(manager.list_devices().await)
}

/// 🎯 更新摄像机配置参数（支持注册新设备或更新已注册设备）
#[command]
pub async fn update_camera_config(
    device_id: String,
    name: Option<String>,
    username: Option<String>,
    password: Option<String>,
    ip: Option<String>,
    port: Option<u16>,
    manager: State<'_, PtzDeviceManager>,
) -> Result<String, String> {
    log::info!("🔧 更新/注册设备配置: {}", device_id);

    // 尝试获取现有设备
    let existing_camera = manager.get(&device_id).await;

    if let Some(camera) = existing_camera {
        // 情况 1：设备已存在，执行更新逻辑
        let new_ip = ip.unwrap_or_else(|| camera.ip().to_string());
        let new_port = port.unwrap_or(camera.port());
        let new_username = username.unwrap_or_else(|| camera.username().to_string());
        let new_password = password.unwrap_or_else(|| camera.password().to_string());
        let new_name = name.unwrap_or_else(|| camera.id.clone());

        // 注销旧设备
        manager.unregister(&device_id).await;

        // 注册新设备
        let new_camera = OnvifCamera::new(
            &new_name,
            &new_ip,
            new_port,
            &new_username,
            &new_password,
            camera.profile_token(),
        );

        let new_id = new_camera.id.clone();
        manager.register(new_camera).await;

        log::info!("✅ 设备配置已更新: {} -> {}", device_id, new_id);
        Ok(format!("设备配置已更新，新ID: {}", new_id))
    } else {
        // 情况 2：设备不存在，尝试作为新设备注册
        let new_ip = ip.ok_or("注册新设备时必须提供 IP 地址")?;
        let new_username = username.ok_or("注册新设备时必须提供用户名")?;
        let new_password = password.ok_or("注册新设备时必须提供密码")?;
        let new_port = port.unwrap_or(80);
        let new_name = name.unwrap_or_else(|| device_id.clone());

        let new_camera = OnvifCamera::new(
            &new_name,
            &new_ip,
            new_port,
            &new_username,
            &new_password,
            "",
        );

        let new_id = new_camera.id.clone();
        manager.register(new_camera).await;

        log::info!("✅ 新设备已注册: {}", new_id);
        Ok(format!("新设备已成功注册，ID: {}", new_id))
    }
}

/// 🎯 删除已注册的摄像机
#[command]
pub async fn remove_camera_device(
    device_id: String,
    manager: State<'_, PtzDeviceManager>,
) -> Result<String, String> {
    log::info!("🗑️ 删除设备: {}", device_id);

    manager.unregister(&device_id).await;
    Ok(format!("设备已删除: {}", device_id))
}

/// 🎯 获取设备详细信息
#[command]
pub async fn get_camera_details(
    device_id: String,
    manager: State<'_, PtzDeviceManager>,
) -> Result<serde_json::Value, String> {
    let camera = manager.get(&device_id).await
        .ok_or_else(|| format!("设备未找到: {}", device_id))?;

    Ok(serde_json::json!({
        "id": camera.id,
        "ip": camera.ip(),
        "port": camera.port(),
        "username": camera.username(),
        "profile_token": camera.profile_token(),
        "xaddr": format!("http://{}:{}/onvif/device_service", camera.ip(), camera.port())
    }))
}

/// 扫描网络摄像机（端口扫描）
#[command]
pub async fn scan_network_cameras(ips: Vec<String>, ports: Vec<u16>, timeout_secs: u64) -> Result<Vec<crate::camera_discovery::DiscoveredCamera>, String> {
    let discovery = crate::camera_discovery::CameraDiscovery::new();
    let result = discovery.scan_ports(ips, ports, timeout_secs).await;
    Ok(result)
}

/// 自动扫描本地子网（使用优化后的并发扫描）
#[command]
pub async fn scan_local_subnet(timeout_secs: u64) -> Result<Vec<crate::camera_discovery::DiscoveredCamera>, String> {
    log::info!("开始自动子网扫描，超时时间: {}秒", timeout_secs);

    let discovery = crate::camera_discovery::CameraDiscovery::new();
    let result = discovery.scan_local_subnet(timeout_secs).await;

    log::info!("子网扫描完成，发现 {} 个设备", result.len());
    Ok(result)
}

/// 综合发现（ONVIF + SSDP + 子网扫描）
#[command]
pub async fn discover_all_cameras(timeout_secs: u64) -> Result<crate::camera_discovery::ScanResult, String> {
    log::info!("开始综合设备发现，超时时间: {}秒", timeout_secs);

    let discovery = crate::camera_discovery::CameraDiscovery::new();
    let result = discovery.discover_all(timeout_secs).await;

    log::info!("综合发现完成，共发现 {} 个设备", result.cameras.len());
    Ok(result)
}

/// 获取本地 IP 地址
#[command]
pub fn get_local_ip() -> Result<String, String> {
    crate::camera_discovery::get_local_ip()
        .ok_or_else(|| "Failed to get local IP".to_string())
}

/// 扫描本地子网（带实时进度）
#[command]
pub async fn scan_local_subnet_with_progress(
    timeout_secs: u64,
    app_handle: tauri::AppHandle
) -> Result<Vec<crate::camera_discovery::DiscoveredCamera>, String> {
    log::info!("开始带进度的子网扫描，超时时间: {}秒", timeout_secs);

    let discovery = crate::camera_discovery::CameraDiscovery::new();
    let result = discovery.scan_local_subnet_with_progress(timeout_secs, &app_handle).await;

    log::info!("子网扫描完成，发现 {} 个设备", result.len());
    Ok(result)
}

/// 扫描所有网络接口（多网卡支持）
#[command]
pub async fn scan_all_network_interfaces(
    timeout_secs: u64,
    app_handle: tauri::AppHandle
) -> Result<Vec<crate::camera_discovery::DiscoveredCamera>, String> {
    log::info!("🔍 开始扫描所有网络接口，超时时间: {}秒", timeout_secs);

    use tauri::Emitter;

    // 获取所有网络接口信息
    let interfaces = crate::camera_discovery::get_all_network_interfaces();

    log::info!("📡 检测到 {} 个有效网络接口:", interfaces.len());
    for iface in &interfaces {
        log::info!("   - {}: {} ({}) [主网卡: {}]",
            iface.name, iface.ip, iface.subnet, iface.is_primary);
    }

    if interfaces.is_empty() {
        log::warn!("⚠️ 未找到有效的网络接口！请检查网络连接");
        return Err("未找到有效的网络接口".to_string());
    }

    // 发送接口列表到前端
    let _ = app_handle.emit("network-interfaces", serde_json::json!({
        "interfaces": interfaces.iter().map(|iface| {
            serde_json::json!({
                "name": iface.name,
                "ip": iface.ip,
                "subnet": iface.subnet,
                "is_primary": iface.is_primary
            })
        }).collect::<Vec<_>>(),
        "count": interfaces.len()
    }));

    log::info!("🚀 开始并发扫描所有网卡...");
    let discovery = crate::camera_discovery::CameraDiscovery::new();
    let result = discovery.scan_all_interfaces(timeout_secs).await;

    log::info!("✅ 所有网络接口扫描完成，共发现 {} 个设备", result.len());
    Ok(result)
}

/// 🎯 扫描指定的网段列表（跨网段扫描）
#[command]
pub async fn scan_specific_subnets(
    subnets: Vec<String>,
    timeout_secs: u64,
) -> Result<Vec<crate::camera_discovery::DiscoveredCamera>, String> {
    log::info!("🚀 开始扫描指定网段，数量: {}, 超时时间: {}秒", subnets.len(), timeout_secs);

    if subnets.is_empty() {
        return Err("请提供至少一个目标网段".to_string());
    }

    for subnet in &subnets {
        log::info!("   - 目标网段: {}", subnet);
    }

    let discovery = crate::camera_discovery::CameraDiscovery::new();
    let result = discovery.scan_specific_subnets(subnets, timeout_secs).await;

    log::info!("✅ 跨网段扫描完成，共发现 {} 个设备", result.len());
    Ok(result)
}

// 🎯 删除：GB/T 28181和厂商私有协议发现命令
// 现在只使用ONVIF标准协议

// 🎯 RTSP 流管理命令

/// 获取所有网络接口信息（仅用于调试）
#[command]
pub fn get_network_interfaces_info() -> Result<serde_json::Value, String> {
    let interfaces = crate::camera_discovery::get_all_network_interfaces();

    log::info!("📡 网络接口信息:");
    for iface in &interfaces {
        log::info!("   - {}: {} ({}) [主网卡: {}]",
            iface.name, iface.ip, iface.subnet, iface.is_primary);
    }

    Ok(serde_json::json!({
        "interfaces": interfaces.iter().map(|iface| {
            serde_json::json!({
                "name": iface.name,
                "ip": iface.ip,
                "subnet": iface.subnet,
                "is_primary": iface.is_primary
            })
        }).collect::<Vec<_>>(),
        "count": interfaces.len()
    }))
}

/// 启动 RTSP 流转换（RTSP → HTTP-MJPEG）
#[command]
pub async fn start_rtsp_stream(
    rtsp_url: String,
    username: Option<String>,
    password: Option<String>,
) -> Result<serde_json::Value, String> {
    use crate::rtsp_stream::RtspStreamManager;

    let manager = RtspStreamManager::new();
    let (session_id, stream_url) = manager.start_rtsp_stream(rtsp_url, username, password).await?;

    Ok(serde_json::json!({
        "sessionId": session_id,
        "streamUrl": stream_url,
        "status": "running"
    }))
}

/// 停止 RTSP 流
#[command]
pub async fn stop_rtsp_stream(session_id: String) -> Result<String, String> {
    use crate::rtsp_stream::RtspStreamManager;

    let manager = RtspStreamManager::new();
    manager.stop_rtsp_stream(&session_id).await?;

    Ok("流已停止".to_string())
}

/// 获取所有活跃的 RTSP 流会话
#[command]
pub fn get_active_rtsp_sessions() -> Vec<serde_json::Value> {
    use crate::rtsp_stream::RtspStreamManager;

    let manager = RtspStreamManager::new();
    manager.get_active_sessions()
        .iter()
        .map(|s| serde_json::json!({
            "id": s.id,
            "rtspUrl": s.rtsp_url,
            "streamUrl": s.output_path,
            "port": s.http_port,
            "status": format!("{:?}", s.status),
            "startTime": s.start_time.to_rfc3339()
        }))
        .collect()
}

/// 🎯 通过 ONVIF 协议获取摄像机的 RTSP 流地址
#[command]
pub async fn get_onvif_stream_uri(
    ip: String,
    port: u16,
    username: String,
    password: String,
    device_id: Option<String>,
) -> Result<StreamUri, String> {
    log::info!("🎬 通过 ONVIF 获取流地址: {}:{}", ip, port);
    log::info!("🔐 认证信息: username='{}', password='{}'",
        if username.is_empty() { "空" } else { "***" },
        if password.is_empty() { "空" } else { "***" }
    );

    let cam_id = device_id.unwrap_or_else(|| format!("onvif_{}_{}", ip, port));
    let camera = OnvifCamera::new(&cam_id, &ip, port, &username, &password, "");

    camera
        .get_stream_uri()
        .await
        .map_err(|e| format!("获取流地址失败: {}", e))
}

/// 🎯 尝试使用通用RTSP模板获取流地址（当ONVIF失败时的备选方案）
#[command]
pub async fn try_common_rtsp_templates(
    ip: String,
    port: u16,
    username: String,
    password: String,
    brand: Option<String>,
) -> Result<Option<String>, String> {
    log::info!("🎬 尝试通用RTSP模板: {}:{}, 品牌: {:?}", ip, port, brand);

    // 根据品牌和端口生成常见的RTSP URL模板
    let templates = generate_rtsp_templates(&ip, port, &brand, &username, &password);

    for template in templates {
        log::info!("🔄 尝试RTSP模板: {}", template);

        // 简单测试RTSP连接（这里只是返回第一个有效的模板）
        // 在实际实现中，可以添加TCP连接测试
        if test_rtsp_connection_simple(&template).await {
            log::info!("✅ RTSP模板验证成功: {}", template);
            return Ok(Some(template));
        }
    }

    log::warn!("⚠️ 所有RTSP模板均失败");
    Ok(None)
}

/// 生成常见的RTSP URL模板
fn generate_rtsp_templates(ip: &str, port: u16, brand: &Option<String>, username: &str, password: &str) -> Vec<String> {
    let mut templates = Vec::new();

    // 基础模板
    templates.push(format!("rtsp://{}:{}/stream", ip, port));
    templates.push(format!("rtsp://{}:{}/live", ip, port));
    templates.push(format!("rtsp://{}:{}/video", ip, port));

    // 根据品牌添加特定模板
    match brand.as_deref() {
        Some("hikvision") | Some("hik") => {
            templates.push(format!("rtsp://{}:{}/h264/ch1/main/av_stream", ip, port));
            templates.push(format!("rtsp://{}:{}/h264/ch1/sub/av_stream", ip, port));
            templates.push(format!("rtsp://{}:{}/mpeg4/ch1/main/av_stream", ip, port));
        }
        Some("dahua") => {
            templates.push(format!("rtsp://{}:{}/cam/realmonitor?channel=1&subtype=0", ip, port));
            templates.push(format!("rtsp://{}:{}/cam/realmonitor?channel=1&subtype=1", ip, port));
        }
        Some("axis") => {
            templates.push(format!("rtsp://{}:{}/axis-media/media.amp", ip, port));
            templates.push(format!("rtsp://{}:{}/axis-media/media.3gp", ip, port));
        }
        _ => {
            // 默认模板
            templates.push(format!("rtsp://{}:{}/h264/ch1/main/av_stream", ip, port));
            templates.push(format!("rtsp://{}:{}/cam/realmonitor?channel=1&subtype=0", ip, port));
        }
    }

    // 添加带认证的URL（如果需要）
    if !username.is_empty() && !password.is_empty() {
        let mut auth_templates = Vec::new();
        for template in &templates {
            if !template.contains('@') {
                auth_templates.push(template.replace("rtsp://", &format!("rtsp://{}:{}@", username, password)));
            }
        }
        templates.extend(auth_templates);
    }

    templates
}

/// 简单的RTSP连接测试
async fn test_rtsp_connection_simple(_url: &str) -> bool {
    // 在实际实现中，这里应该进行TCP连接测试
    // 目前只是模拟成功，实际项目中需要实现真正的连接测试
    true
}

/// 🎯 ONVIF 设备完整配置信息
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OnvifDeviceConfig {
    pub ip: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub device_info: Option<OnvifDeviceInfo>,  // 🎯 新增：设备信息
    pub device_service_url: Option<String>,
    pub media_service_url: Option<String>,
    pub profiles: Vec<String>,
    pub rtsp_stream_url: Option<String>,
    pub service_tests: Vec<OnvifServiceTestResult>,
    pub recommended_config: OnvifRecommendedConfig,
}

/// 🎯 ONVIF 设备信息
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OnvifDeviceInfo {
    pub manufacturer: String,
    pub model: String,
    pub firmware_version: String,
    pub serial_number: String,
    pub hardware_id: String,
}

/// 🎯 ONVIF 服务路径检测结果
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OnvifServiceTestResult {
    pub path: String,
    pub protocol: String, // "http" or "https"
    pub status: String,   // "success", "failed", "timeout"
    pub status_code: Option<u16>,
    pub response_time_ms: u64,
    pub is_device_service: bool,
    pub is_media_service: bool,
    pub error_message: Option<String>,
}

/// 🎯 推荐的ONVIF配置
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OnvifRecommendedConfig {
    pub device_service_path: String,
    pub media_service_path: String,
    pub profile_token: String,
    pub confidence: String, // "high", "medium", "low"
}

/// 🎯 检测并测试所有ONVIF服务路径
/// 返回完整的ONVIF设备配置信息，包括所有可用的服务路径和推荐配置
#[command]
pub async fn detect_onvif_services(
    ip: String,
    port: u16,
    username: String,
    password: String,
) -> Result<OnvifDeviceConfig, String> {
    use std::time::Instant;

    log::info!("🔍 [ONVIF检测] 开始检测设备 {}:{}", ip, port);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .map_err(|e| format!("创建HTTP客户端失败: {}", e))?;

    // 🎯 步骤1: GetDeviceInfo - 验证设备可达性和认证
    log::info!("🔍 [ONVIF检测] 步骤1: 获取设备信息...");
    let device_info = get_device_info(&client, &ip, port, &username, &password).await;

    if let Some(ref info) = device_info {
        log::info!("✅ [ONVIF检测] 设备验证成功: {} {}", info.manufacturer, info.model);
    } else {
        log::warn!("⚠️ [ONVIF检测] 设备验证失败，继续尝试后续步骤");
    }

    let mut service_tests = Vec::new();
    let mut device_service_url: Option<String> = None;
    let mut media_service_url: Option<String> = None;
    let mut profiles: Vec<String> = Vec::new();
    let mut rtsp_stream_url: Option<String> = None;

    // 定义要测试的路径列表
    let protocols = vec!["http", "https"];
    let device_paths = vec![
        "/onvif/device_service",
        "/onvif/device",
        "/cgi-bin/onvif/device_service",
        "/device_service",
        "/onvif/services",
        "/onvif/soap/service",
        "/soap/device_service",
        "/onvif",
        "/",
    ];

    let media_paths = vec![
        "/onvif/Media",
        "/onvif/media",
        "/onvif/media_service",
        "/cgi-bin/onvif/media_service",
        "/media_service",
        "/onvif/media2_service",
        "/onvif/device_service",
        "/onvif/PTZ",
        "/wsdl",
        "/",
        "/onvif",
        "/onvif/services",
        "/onvif/service",
        "/onvif/api",
        "/api/onvif",
        "/onvif/v1",
        "/onvif/v2",
        "/onvif/wsdl",
        "/onvif/soap",
    ];

    // 测试所有设备服务路径
    log::info!("🔍 [ONVIF检测] 测试设备服务路径...");
    for protocol in &protocols {
        for path in &device_paths {
            let url = format!("{}://{}:{}{}", protocol, ip, port, path);
            let start = Instant::now();

            let soap = format!(
                r#"<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:tds="http://www.onvif.org/ver10/device/wsdl"
            xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  <s:Header>
    <wsse:Security s:mustUnderstand="1">
      <wsse:UsernameToken>
        <wsse:Username>{}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">{}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </s:Header>
  <s:Body>
    <tds:GetCapabilities/>
  </s:Body>
</s:Envelope>"#,
                username, password
            );

            match client
                .post(&url)
                .header("Content-Type", "application/soap+xml; charset=utf-8")
                .header("SOAPAction", "\"http://www.onvif.org/ver10/device/wsdl/GetCapabilities\"")
                .body(soap.clone())
                .send()
                .await
            {
                Ok(res) => {
                    let elapsed = start.elapsed().as_millis() as u64;
                    let status = res.status().as_u16();

                    if status == 200 {
                        let body = res.text().await.unwrap_or_default();
                        log::info!("✅ [ONVIF检测] 设备服务路径成功: {} ({}ms)", path, elapsed);

                        // 尝试解析Media服务地址
                        if let Some(media_url) = parse_media_service_url_from_xml(&body) {
                            log::info!("📍 [ONVIF检测] 从响应中解析到Media服务地址: {}", media_url);
                            if media_service_url.is_none() {
                                media_service_url = Some(media_url.clone());
                            }
                        }

                        if device_service_url.is_none() {
                            device_service_url = Some(url.clone());
                        }

                        service_tests.push(OnvifServiceTestResult {
                            path: path.to_string(),
                            protocol: protocol.to_string(),
                            status: "success".to_string(),
                            status_code: Some(status),
                            response_time_ms: elapsed,
                            is_device_service: true,
                            is_media_service: false,
                            error_message: None,
                        });
                    } else {
                        let elapsed = start.elapsed().as_millis() as u64;
                        log::debug!("⚠️ [ONVIF检测] 路径 {} 返回状态 {}", path, status);

                        service_tests.push(OnvifServiceTestResult {
                            path: path.to_string(),
                            protocol: protocol.to_string(),
                            status: "failed".to_string(),
                            status_code: Some(status),
                            response_time_ms: elapsed,
                            is_device_service: true,
                            is_media_service: false,
                            error_message: Some(format!("HTTP {}", status)),
                        });
                    }
                }
                Err(e) => {
                    let elapsed = start.elapsed().as_millis() as u64;
                    log::debug!("⚠️ [ONVIF检测] 路径 {} 请求失败: {}", path, e);

                    service_tests.push(OnvifServiceTestResult {
                        path: path.to_string(),
                        protocol: protocol.to_string(),
                        status: if e.is_timeout() { "timeout".to_string() } else { "failed".to_string() },
                        status_code: None,
                        response_time_ms: elapsed,
                        is_device_service: true,
                        is_media_service: false,
                        error_message: Some(e.to_string()),
                    });
                }
            }
        }
    }

    // 测试所有媒体服务路径（如果还没有找到）
    if media_service_url.is_none() {
        log::info!("🔍 [ONVIF检测] 测试媒体服务路径...");
        for protocol in &protocols {
            for path in &media_paths {
                let url = format!("{}://{}:{}{}", protocol, ip, port, path);
                let start = Instant::now();

                let soap = format!(
                    r#"<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:trt="http://www.onvif.org/ver10/media/wsdl"
            xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  <s:Header>
    <wsse:Security s:mustUnderstand="1">
      <wsse:UsernameToken>
        <wsse:Username>{}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">{}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </s:Header>
  <s:Body>
    <trt:GetProfiles />
  </s:Body>
</s:Envelope>"#,
                    username, password
                );

                match client
                    .post(&url)
                    .header("Content-Type", "application/soap+xml; charset=utf-8")
                    .header("SOAPAction", "\"http://www.onvif.org/ver10/media/wsdl/GetProfiles\"")
                    .body(soap.clone())
                    .send()
                    .await
                {
                    Ok(res) => {
                        let elapsed = start.elapsed().as_millis() as u64;
                        let status = res.status().as_u16();

                        if status == 200 {
                            let body = res.text().await.unwrap_or_default();
                            log::info!("✅ [ONVIF检测] 媒体服务路径成功: {} ({}ms)", path, elapsed);

                            // 解析Profile tokens
                            let parsed_profiles = parse_profile_tokens_from_xml(&body);
                            if !parsed_profiles.is_empty() {
                                profiles = parsed_profiles;
                                log::info!("📋 [ONVIF检测] 解析到 {} 个Profile: {:?}", profiles.len(), profiles);
                            }

                            if media_service_url.is_none() {
                                media_service_url = Some(url.clone());
                            }

                            service_tests.push(OnvifServiceTestResult {
                                path: path.to_string(),
                                protocol: protocol.to_string(),
                                status: "success".to_string(),
                                status_code: Some(status),
                                response_time_ms: elapsed,
                                is_device_service: false,
                                is_media_service: true,
                                error_message: None,
                            });
                        } else {
                            let elapsed = start.elapsed().as_millis() as u64;
                            service_tests.push(OnvifServiceTestResult {
                                path: path.to_string(),
                                protocol: protocol.to_string(),
                                status: "failed".to_string(),
                                status_code: Some(status),
                                response_time_ms: elapsed,
                                is_device_service: false,
                                is_media_service: true,
                                error_message: Some(format!("HTTP {}", status)),
                            });
                        }
                    }
                    Err(e) => {
                        let elapsed = start.elapsed().as_millis() as u64;
                        service_tests.push(OnvifServiceTestResult {
                            path: path.to_string(),
                            protocol: protocol.to_string(),
                            status: if e.is_timeout() { "timeout".to_string() } else { "failed".to_string() },
                            status_code: None,
                            response_time_ms: elapsed,
                            is_device_service: false,
                            is_media_service: true,
                            error_message: Some(e.to_string()),
                        });
                    }
                }
            }
        }
    }

    // 尝试获取RTSP流地址
    if let Some(media_url) = &media_service_url {
        if !profiles.is_empty() {
            log::info!("🔍 [ONVIF检测] 尝试获取RTSP流地址...");

            let camera = OnvifCamera::new(
                "temp_detection",
                &ip,
                port,
                &username,
                &password,
                &profiles[0]
            );

            match camera.get_stream_uri_with_url(media_url, &profiles[0]).await {
                Ok(stream_uri) => {
                    log::info!("✅ [ONVIF检测] 成功获取RTSP流地址: {}", stream_uri.uri);
                    rtsp_stream_url = Some(stream_uri.uri);
                }
                Err(e) => {
                    log::warn!("⚠️ [ONVIF检测] 获取RTSP流地址失败: {}", e);
                }
            }
        }
    }

    // 确定推荐配置
    let recommended_config = determine_recommended_config(
        &device_service_url,
        &media_service_url,
        &profiles,
        &service_tests
    );

    let config = OnvifDeviceConfig {
        ip,
        port,
        username,
        password,
        device_info,  // 🎯 新增：包含设备信息
        device_service_url,
        media_service_url,
        profiles,
        rtsp_stream_url,
        service_tests,
        recommended_config,
    };

    log::info!("✅ [ONVIF检测] 检测完成");
    Ok(config)
}

/// 从XML响应中解析Media服务地址
fn parse_media_service_url_from_xml(xml: &str) -> Option<String> {
    // 查找 <tt:Media> 或 <trt:Media> 块中的 <tt:XAddr>
    if let Some(media_start) = xml.find("<tt:Media>") {
        if let Some(media_end) = xml[media_start..].find("</tt:Media>") {
            let media_block = &xml[media_start..media_start + media_end + 11];

            if let Some(xaddr_start) = media_block.find("<tt:XAddr>") {
                if let Some(xaddr_end) = media_block[xaddr_start..].find("</tt:XAddr>") {
                    let url = media_block[xaddr_start + 10..xaddr_start + xaddr_end].trim();
                    if !url.is_empty() {
                        return Some(url.to_string());
                    }
                }
            }
        }
    }

    // 尝试其他命名空间格式
    if let Some(media_start) = xml.find("<trt:Media>") {
        if let Some(media_end) = xml[media_start..].find("</trt:Media>") {
            let media_block = &xml[media_start..media_start + media_end + 12];

            if let Some(xaddr_start) = media_block.find("<tt:XAddr>") {
                if let Some(xaddr_end) = media_block[xaddr_start..].find("</tt:XAddr>") {
                    let url = media_block[xaddr_start + 10..xaddr_start + xaddr_end].trim();
                    if !url.is_empty() {
                        return Some(url.to_string());
                    }
                }
            }
        }
    }

    None
}

/// 从XML响应中解析Profile Tokens
fn parse_profile_tokens_from_xml(xml: &str) -> Vec<String> {
    let mut tokens = Vec::new();

    // 查找所有 <tt:Profile token="...">
    let mut search_start = 0;
    while let Some(profile_start) = xml[search_start..].find("<tt:Profile") {
        let profile_block_start = search_start + profile_start;

        // 查找token属性
        if let Some(token_start) = xml[profile_block_start..].find("token=\"") {
            let token_value_start = profile_block_start + token_start + 7;
            if let Some(token_end) = xml[token_value_start..].find('"') {
                let token = xml[token_value_start..token_value_start + token_end].to_string();
                if !token.is_empty() && !tokens.contains(&token) {
                    tokens.push(token);
                }
            }
        }

        search_start = profile_block_start + 1;
        if search_start >= xml.len() {
            break;
        }
    }

    tokens
}

/// 确定推荐的ONVIF配置
fn determine_recommended_config(
    device_service_url: &Option<String>,
    media_service_url: &Option<String>,
    profiles: &[String],
    service_tests: &[OnvifServiceTestResult],
) -> OnvifRecommendedConfig {
    // 提取路径
    let device_path = device_service_url.as_ref()
        .map(|url| {
            url.split(&format!("{}:{}",
                url.split("://").nth(1).unwrap_or("").split(':').next().unwrap_or(""),
                url.split("://").nth(1).unwrap_or("").split(':').nth(1).unwrap_or("80")
            ))
            .nth(1)
            .unwrap_or("/onvif/device_service")
            .to_string()
        })
        .unwrap_or_else(|| "/onvif/device_service".to_string());

    let media_path = media_service_url.as_ref()
        .map(|url| {
            url.split(&format!("{}:{}",
                url.split("://").nth(1).unwrap_or("").split(':').next().unwrap_or(""),
                url.split("://").nth(1).unwrap_or("").split(':').nth(1).unwrap_or("80")
            ))
            .nth(1)
            .unwrap_or("/onvif/Media")
            .to_string()
        })
        .unwrap_or_else(|| "/onvif/Media".to_string());

    let profile_token = profiles.first()
        .cloned()
        .unwrap_or_else(|| "Profile_1".to_string());

    // 确定置信度
    let confidence = if device_service_url.is_some() && media_service_url.is_some() && !profiles.is_empty() {
        "high".to_string()
    } else if device_service_url.is_some() || media_service_url.is_some() {
        "medium".to_string()
    } else {
        "low".to_string()
    };

    OnvifRecommendedConfig {
        device_service_path: device_path,
        media_service_path: media_path,
        profile_token,
        confidence,
    }
}

#[tauri::command]
pub async fn test_onvif_connection(
    ip: String,
    port: u16,
    username: String,
    password: String,
) -> Result<String, String> {
    log::info!("🔍 测试 ONVIF 连接: {}:{}", ip, port);
    log::info!("🔐 认证信息: username='{}', password='{}'",
        if username.is_empty() { "空" } else { "***" },
        if password.is_empty() { "空" } else { "***" }
    );

    // 尝试直接发送HTTP请求测试连接
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| format!("创建HTTP客户端失败: {}", e))?;

    let url = format!("http://{}:{}/onvif/device_service", ip, port);
    log::info!("📡 发送请求到: {}", url);

    let soap = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
  <s:Body>
    <tds:GetCapabilities/>
  </s:Body>
</s:Envelope>"#
    );

    match client
        .post(&url)
        .header("Content-Type", "application/soap+xml; charset=utf-8")
        .header("SOAPAction", "\"http://www.onvif.org/ver10/device/wsdl/GetCapabilities\"")
        .body(soap)
        .send()
        .await
    {
        Ok(res) => {
            let status = res.status();
            let body = res.text().await.unwrap_or_default();
            log::info!("📥 收到响应: 状态码={}, 长度={}", status.as_u16(), body.len());
            log::info!("📄 响应内容: {}", &body[..body.len().min(500)]);

            Ok(format!("状态码: {}\n响应: {}", status.as_u16(), &body[..body.len().min(1000)]))
        }
        Err(e) => {
            log::error!("❌ 连接失败: {}", e);
            Err(format!("连接失败: {}", e))
        }
    }
}

/// 🎯 测试 TCP 连接（用于验证 RTSP 地址是否可达）
#[command]
pub async fn test_tcp_connection(
    host: String,
    port: u16,
    timeout: Option<u64>,
) -> Result<serde_json::Value, String> {
    let timeout_secs = timeout.unwrap_or(2);  // 默认2秒超时

    log::info!("🔍 测试 TCP 连接: {}:{}", host, port);

    match tokio::time::timeout(
        Duration::from_secs(timeout_secs),
        tokio::net::TcpStream::connect(format!("{}:{}", host, port))
    ).await {
        Ok(Ok(_stream)) => {
            log::info!("✅ TCP 连接成功: {}:{}", host, port);
            Ok(serde_json::json!({
                "success": true,
                "message": format!("连接到 {}:{} 成功", host, port)
            }))
        }
        Ok(Err(e)) => {
            log::warn!("❌ TCP 连接失败: {}:{}, 错误: {}", host, port, e);
            Ok(serde_json::json!({
                "success": false,
                "message": format!("连接到 {}:{} 失败: {}", host, port, e)
            }))
        }
        Err(_) => {
            log::warn!("⏱️ TCP 连接超时: {}:{}", host, port);
            Ok(serde_json::json!({
                "success": false,
                "message": format!("连接到 {}:{} 超时 ({}秒)", host, port, timeout_secs)
            }))
        }
    }
}

/// 🎯 获取ONVIF设备信息 (GetDeviceInfo)
async fn get_device_info(
    client: &reqwest::Client,
    ip: &str,
    port: u16,
    username: &str,
    password: &str,
) -> Option<OnvifDeviceInfo> {
    let device_paths = [
        "/onvif/device_service",
        "/onvif/device",
        "/cgi-bin/onvif/device_service",
        "/device_service",
        "/onvif/services",
    ];

    for path in &device_paths {
        let url = format!("http://{}:{}{}", ip, port, path);

        let soap = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:tds="http://www.onvif.org/ver10/device/wsdl"
            xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  <s:Header>
    <wsse:Security s:mustUnderstand="1">
      <wsse:UsernameToken>
        <wsse:Username>{}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">{}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </s:Header>
  <s:Body>
    <tds:GetDeviceInformation/>
  </s:Body>
</s:Envelope>"#,
            username, password
        );

        match client
            .post(&url)
            .header("Content-Type", "application/soap+xml; charset=utf-8")
            .header("SOAPAction", "\"http://www.onvif.org/ver10/device/wsdl/GetDeviceInformation\"")
            .body(soap)
            .send()
            .await
        {
            Ok(res) => {
                if res.status().is_success() {
                    if let Ok(body) = res.text().await {
                        if let Some(device_info) = parse_device_info_from_xml(&body) {
                            return Some(device_info);
                        }
                    }
                }
            }
            Err(_) => {
                // 继续尝试下一个路径
            }
        }
    }

    None
}

/// 从 XML 响应中解析设备信息
fn parse_device_info_from_xml(xml: &str) -> Option<OnvifDeviceInfo> {
    let manufacturer = extract_xml_tag(xml, "tds:Manufacturer")
        .or_else(|| extract_xml_tag(xml, "tt:Manufacturer"))
        .unwrap_or_else(|| "Unknown".to_string());

    let model = extract_xml_tag(xml, "tds:Model")
        .or_else(|| extract_xml_tag(xml, "tt:Model"))
        .unwrap_or_else(|| "Unknown".to_string());

    let firmware_version = extract_xml_tag(xml, "tds:FirmwareVersion")
        .or_else(|| extract_xml_tag(xml, "tt:FirmwareVersion"))
        .unwrap_or_else(|| "Unknown".to_string());

    let serial_number = extract_xml_tag(xml, "tds:SerialNumber")
        .or_else(|| extract_xml_tag(xml, "tt:SerialNumber"))
        .unwrap_or_else(|| "Unknown".to_string());

    let hardware_id = extract_xml_tag(xml, "tds:HardwareId")
        .or_else(|| extract_xml_tag(xml, "tt:HardwareId"))
        .unwrap_or_else(|| "Unknown".to_string());

    Some(OnvifDeviceInfo {
        manufacturer,
        model,
        firmware_version,
        serial_number,
        hardware_id,
    })
}

/// 辅助方法：从 XML 中提取标签内容
fn extract_xml_tag(xml: &str, tag: &str) -> Option<String> {
    let open_tag = format!("<{}>", tag);
    let close_tag = format!("</{}>", tag);

    if let Some(start) = xml.find(&open_tag) {
        if let Some(end) = xml[start..].find(&close_tag) {
            let value = xml[start + open_tag.len()..start + end].trim();
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }
    None
}

