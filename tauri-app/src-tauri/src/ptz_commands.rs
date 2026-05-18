use tauri::{State, command};
use crate::ptz::PtzDeviceManager;
use crate::ptz::discovery::DiscoveredOnvifDevice;
use crate::ptz::onvif::{OnvifCamera, StreamUri};
use std::time::Duration;
use tokio::io::{AsyncWriteExt, AsyncReadExt};
use roxmltree::Document;

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

        let preserved_rtsp_url = manager.get_rtsp_url(&device_id).await;

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

        if let Some(rtsp_url) = preserved_rtsp_url {
            let _ = manager.set_rtsp_url(&new_id, rtsp_url).await;
        }

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

    let rtsp_url = manager.get_rtsp_url(&device_id).await;

    Ok(serde_json::json!({
        "id": camera.id,
        "ip": camera.ip(),
        "port": camera.port(),
        "username": camera.username(),
        "profile_token": camera.profile_token(),
        "xaddr": format!("http://{}:{}/onvif/device_service", camera.ip(), camera.port()),
        "rtsp_url": rtsp_url
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

/// 🎯 通过 ONVIF 协议获取摄像机的 RTSP 流地址（基于已注册设备）
/// 支持多种 RTSP 路径格式，自动适配不同品牌摄像机
#[command]
pub async fn get_onvif_stream_uri(
    device_id: String,
    manager: State<'_, PtzDeviceManager>,
) -> Result<StreamUri, String> {
    log::info!("🚀 [设备模式] 尝试获取设备 {} 的 RTSP 地址", device_id);

    // 从设备管理器获取已注册的设备
    let camera = manager
        .get(&device_id)
        .await
        .ok_or_else(|| format!("设备未注册: {}", device_id))?;

    // 使用设备内部的IP、端口、用户名和密码信息
    log::info!("🔍 [设备模式] 使用设备信息 - IP: {}, 端口: {}, 用户名: {}",
               camera.ip(), camera.port(), camera.username());

    // 直接调用设备的get_stream_uri方法
    match camera.get_stream_uri().await {
        Ok(mut uri) => {
            // 标准化URI，确保IP和端口正确
            uri.uri = camera.normalize_rtsp_uri(&uri.uri);

            log::info!("✅ [设备模式] 成功获取RTSP地址: {}", uri.uri);
            Ok(uri)
        }
        Err(e) => {
            log::error!("❌ [设备模式] 获取RTSP地址失败: {}", e);
            Err(format!("获取RTSP地址失败: {}", e))
        }
    }
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
fn generate_rtsp_templates(ip: &str, port: u16, _brand: &Option<String>, username: &str, password: &str) -> Vec<String> {
    let mut templates = Vec::new();

    // 🎯 优先尝试已验证的成功格式 (参考 192.168.5.165)
    templates.push(format!("rtsp://{}:{}/live/av0", ip, port));
    templates.push(format!("rtsp://{}:554/live/av0", ip));

    // 尝试多个常见 RTSP 端口
    let ports_to_try = if port != 554 && port != 2000 && port != 8554 {
        vec![port, 554, 2000, 8554]
    } else if port == 2000 {
        vec![2000, 554, 8554, port]
    } else {
        vec![port, 2000, 554, 8554]
    };

    for &try_port in &ports_to_try {
        // 🎯 基础通用模板
        templates.push(format!("rtsp://{}:{}/stream1", ip, try_port));
        templates.push(format!("rtsp://{}:{}/stream2", ip, try_port));
        templates.push(format!("rtsp://{}:{}/h264", ip, try_port));
        templates.push(format!("rtsp://{}:{}/video.mp4", ip, try_port));

        //  海康威视 (Hikvision)
        templates.push(format!("rtsp://{}:{}/h264/ch1/main/av_stream", ip, try_port));
        templates.push(format!("rtsp://{}:{}/Streaming/Channels/101", ip, try_port));
        templates.push(format!("rtsp://{}:{}/Streaming/Channels/102", ip, try_port)); // 子码流

        // 🎯 大华 (Dahua)
        templates.push(format!("rtsp://{}:{}/cam/realmonitor?channel=1&subtype=0", ip, try_port));
        templates.push(format!("rtsp://{}:{}/cam/realmonitor?channel=1&subtype=1", ip, try_port)); // 子码流
        templates.push(format!("rtsp://{}:{}/cgi-bin/mjpeg?channel=1&subtype=0", ip, try_port));

        // 🎯 宇视 (Uniview)
        templates.push(format!("rtsp://{}:{}/media/video1", ip, try_port));
        templates.push(format!("rtsp://{}:{}/live/main", ip, try_port));

        // 🎯 Axis
        templates.push(format!("rtsp://{}:{}/axis-media/media.amp", ip, try_port));
        templates.push(format!("rtsp://{}:{}/axis-media/media.amp?videocodec=h264", ip, try_port));

        // 🎯 其他常见格式
        templates.push(format!("rtsp://{}:{}/mpeg4", ip, try_port));
        templates.push(format!("rtsp://{}:{}/h264", ip, try_port));
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

    // 去重
    templates.sort();
    templates.dedup();

    templates
}

/// 简单的RTSP连接测试 - 尝试建立TCP连接验证地址是否有效
async fn test_rtsp_connection_simple(url: &str) -> bool {
    // 简单的字符串解析，避免对 url crate 的依赖
    let url_lower = url.to_lowercase();

    // 提取主机和端口
    let (host, port) = if let Some(rest) = url_lower.strip_prefix("rtsp://") {
        let parts: Vec<&str> = rest.split('/').next().unwrap_or("").split(':').collect();
        let host = parts.first().unwrap_or(&"").to_string();
        let port = parts.get(1).and_then(|p| p.parse::<u16>().ok()).unwrap_or(554);
        (host, port)
    } else {
        // 不合法的URL，返回 false
        log::warn!("⚠️ RTSP URL格式不正确: {}", url);
        return false;
    };

    if host.is_empty() {
        log::warn!("⚠️ 无法从RTSP URL中提取主机: {}", url);
        return false;
    }

    //  关键修复：先验证RTSP端口是否开放（只检查554、8554等标准RTSP端口）
    // 如果端口是2000（ONVIF HTTP端口），直接跳过，因为HTTP端口不会响应RTSP协议
    if port == 2000 || port == 80 || port == 443 || port == 8080 {
        log::info!("ℹ️ 跳过非RTSP端口: {}:{} (HTTP端口不响应RTSP协议)", host, port);
        return false;
    }

    // 尝试TCP连接
    match tokio::net::TcpStream::connect((&host[..], port)).await {
        Ok(_) => {
            log::info!("✅ RTSP连接测试成功: {}:{}", host, port);
            true
        }
        Err(e) => {
            log::warn!("⚠️ RTSP连接测试失败: {}:{} - {}", host, port, e);
            false
        }
    }
}

/// 🎯 轻量级 RTSP 探测 - 使用 OPTIONS 请求验证连接
/// 这是一个轻量级的验证方式，不会真正拉流，只是验证地址是否有效
#[command]
pub async fn probe_rtsp_connection(
    uri: String,
    timeout: Option<f64>,
) -> Result<bool, String> {
    let timeout_duration = Duration::from_secs_f64(timeout.unwrap_or(3.0));

    log::info!("🔍 开始 RTSP 探测: {}, 超时: {}s", uri, timeout_duration.as_secs_f64());

    // 解析 URL
    let url_lower = uri.to_lowercase();
    let (host, port) = if let Some(rest) = url_lower.strip_prefix("rtsp://") {
        let parts: Vec<&str> = rest.split('/').next().unwrap_or("").split(':').collect();
        let host = parts.first().unwrap_or(&"").to_string();
        let port = parts.get(1).and_then(|p| p.parse::<u16>().ok()).unwrap_or(554);
        (host, port)
    } else {
        return Err("无效的 RTSP URL，必须以 rtsp:// 开头".to_string());
    };

    if host.is_empty() {
        return Err("无法从 URL 中提取主机地址".to_string());
    }

    let result = tokio::time::timeout(timeout_duration, async {
        // 建立 TCP 连接
        let mut stream = match tokio::net::TcpStream::connect((&host[..], port)).await {
            Ok(s) => s,
            Err(e) => {
                log::warn!("❌ TCP 连接失败: {}", e);
                return false;
            }
        };

        // 发送 OPTIONS 请求
        let request = format!(
            "OPTIONS rtsp://{}/ RTSP/1.0\r\n\
             CSeq: 1\r\n\
             User-Agent: VideoCapture\r\n\
             \r\n",
            host
        );

        if let Err(e) = stream.write_all(request.as_bytes()).await {
            log::warn!("❌ 发送 OPTIONS 请求失败: {}", e);
            return false;
        }

        // 读取响应
        let mut buf = [0u8; 512];
        let n = match stream.read(&mut buf).await {
            Ok(n) => n,
            Err(e) => {
                log::warn!("❌ 读取响应失败: {}", e);
                return false;
            }
        };

        if n == 0 {
            log::warn!("❌ 响应为空");
            return false;
        }

        let response = String::from_utf8_lossy(&buf[..n]);
        log::debug!("📨 RTSP 响应: {}", response.trim());

        // 检查是否包含 RTSP 200 OK 响应
        if response.contains("RTSP/1.0 200") {
            log::info!("✅ RTSP OPTIONS 验证成功");
            true
        } else if response.contains("RTSP/1.0 401") {
            // 401 表示需要认证，但至少说明设备存在
            log::info!("✅ RTSP OPTIONS 验证成功（需要认证）");
            true
        } else {
            log::warn!("❌ RTSP 响应不是 200 或 401");
            false
        }
    }).await;

    match result {
        Ok(success) => Ok(success),
        Err(_) => {
            log::warn!("❌ RTSP 探测超时");
            Ok(false)
        }
    }
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

            // 当用户名为空时不添加认证头
            let soap = if username.is_empty() {
                r#"<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
  <s:Body>
    <tds:GetCapabilities/>
  </s:Body>
</s:Envelope>"#.to_string()
            } else {
                format!(
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
                )
            };

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

                // 当用户名为空时不添加认证头
                let soap = if username.is_empty() {
                    r#"<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:trt="http://www.onvif.org/ver10/media/wsdl">
  <s:Body>
    <trt:GetProfiles />
  </s:Body>
</s:Envelope>"#.to_string()
                } else {
                    format!(
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
                    )
                };

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

    // 如果 ONVIF 没有获取到 RTSP 地址，直接尝试常见 RTSP 模板
    if rtsp_stream_url.is_none() {
        log::info!("🔍 [ONVIF检测] ONVIF未获取到RTSP地址，直接尝试常见模板...");

        // 先尝试不指定品牌，遍历所有模板
        let templates = generate_rtsp_templates(&ip, port, &None, &username, &password);

        for template in templates {
            if test_rtsp_connection_simple(&template).await {
                log::info!("✅ [ONVIF检测] 找到可用RTSP地址: {}", template);
                rtsp_stream_url = Some(template);
                break;
            }
        }
    }

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
/// 🎯 使用 roxmltree 解析 Media Service URL，正确处理命名空间
fn parse_media_service_url_from_xml(xml: &str) -> Option<String> {
    log::debug!("🔍 解析 Media Service URL，响应长度: {}", xml.len());

    match Document::parse(xml) {
        Ok(doc) => {
            // 查找任意命名空间的 Media 元素
            if let Some(media) = doc.descendants().find(|n| n.has_tag_name("Media")) {
                // 在 Media 元素下查找任意命名空间的 XAddr 元素
                if let Some(xaddr) = media.descendants().find(|n| n.has_tag_name("XAddr")) {
                    if let Some(url) = xaddr.text() {
                        let url_trimmed = url.trim();
                        if !url_trimmed.is_empty() && url_trimmed.starts_with("http") {
                            log::info!("✅ 成功解析 Media 服务地址: {}", url_trimmed);
                            return Some(url_trimmed.to_string());
                        }
                    }
                }
            }

            // 备选：直接查找所有 XAddr 元素
            for node in doc.descendants() {
                if node.has_tag_name("XAddr") {
                    if let Some(url) = node.text() {
                        let url_trimmed = url.trim();
                        if !url_trimmed.is_empty() && url_trimmed.starts_with("http") {
                            log::info!("✅ 通过全局查找解析到 Media 服务地址: {}", url_trimmed);
                            return Some(url_trimmed.to_string());
                        }
                    }
                }
            }

            None
        }
        Err(e) => {
            log::warn!("⚠️ roxmltree 解析失败: {}，使用备用方法", e);
            parse_media_service_url_from_xml_fallback(xml)
        }
    }
}

/// 备用解析方法（当 roxmltree 失败时使用）
fn parse_media_service_url_from_xml_fallback(xml: &str) -> Option<String> {
    let namespace_prefixes = ["tt", "trt", "wsnt", "ns1", "ns2", "tan", "tas", ""];

    for prefix in &namespace_prefixes {
        let media_start_tag = if prefix.is_empty() { "<Media>".to_string() } else { format!("<{}:Media>", prefix) };
        let media_end_tag = if prefix.is_empty() { "</Media>".to_string() } else { format!("</{}:Media>", prefix) };
        let xaddr_start_tag = if prefix.is_empty() { "<XAddr>".to_string() } else { format!("<{}:XAddr>", prefix) };
        let xaddr_end_tag = if prefix.is_empty() { "</XAddr>".to_string() } else { format!("</{}:XAddr>", prefix) };

        if let Some(media_start) = xml.find(&media_start_tag) {
            if let Some(media_end) = xml[media_start..].find(&media_end_tag) {
                let media_block = &xml[media_start..media_start + media_end + media_end_tag.len()];

                if let Some(xaddr_start) = media_block.find(&xaddr_start_tag) {
                    if let Some(xaddr_end) = media_block[xaddr_start..].find(&xaddr_end_tag) {
                        let url = media_block[xaddr_start + xaddr_start_tag.len()..xaddr_start + xaddr_end].trim();
                        if !url.is_empty() && url.starts_with("http") {
                            return Some(url.to_string());
                        }
                    }
                }
            }
        }
    }

    None
}

/// 🎯 从XML响应中解析Profile Tokens（使用 roxmltree）
fn parse_profile_tokens_from_xml(xml: &str) -> Vec<String> {
    log::debug!("🔍 解析 Profile Tokens，响应长度: {}", xml.len());

    match Document::parse(xml) {
        Ok(doc) => {
            let mut tokens = Vec::new();

            // 查找所有 Profile 元素，获取 token 属性
            for node in doc.descendants() {
                if node.has_tag_name("Profile") {
                    if let Some(token) = node.attribute("token") {
                        let token_str = token.trim().to_string();
                        if !token_str.is_empty() && !tokens.contains(&token_str) {
                            tokens.push(token_str);
                        }
                    }
                }
            }

            // 备选：查找 ProfileToken 标签
            if tokens.is_empty() {
                for node in doc.descendants() {
                    if node.has_tag_name("ProfileToken") {
                        if let Some(token) = node.text() {
                            let token_str = token.trim().to_string();
                            if !token_str.is_empty() && !tokens.contains(&token_str) {
                                tokens.push(token_str);
                            }
                        }
                    }
                }
            }

            log::info!("✅ 解析到 {} 个 Profile Tokens: {:?}", tokens.len(), tokens);
            tokens
        }
        Err(e) => {
            log::warn!("⚠️ roxmltree 解析失败: {}，使用备用方法", e);
            parse_profile_tokens_from_xml_fallback(xml)
        }
    }
}

/// 备用解析方法（当 roxmltree 失败时使用）
fn parse_profile_tokens_from_xml_fallback(xml: &str) -> Vec<String> {
    let mut tokens = Vec::new();

    // 尝试匹配 token 属性
    let pattern = regex::Regex::new(r#"(?i)token\s*=\s*["']([^"']+)["']"#).unwrap();
    for cap in pattern.captures_iter(xml) {
        if let Some(token) = cap.get(1) {
            let t = token.as_str().to_string();
            if !t.is_empty() && !tokens.contains(&t) {
                tokens.push(t);
            }
        }
    }

    // 备选：匹配 ProfileToken 标签
    if tokens.is_empty() {
        let tag_pattern = regex::Regex::new(r"<[^>]*:ProfileToken[^>]*>([^<]+)</[^>]*:ProfileToken>").unwrap();
        for cap in tag_pattern.captures_iter(xml) {
            if let Some(t) = cap.get(1) {
                let token = t.as_str().to_string();
                if !token.is_empty() && !tokens.contains(&token) {
                    tokens.push(token);
                }
            }
        }
    }

    tokens
}

/// 确定推荐的ONVIF配置
fn determine_recommended_config(
    device_service_url: &Option<String>,
    media_service_url: &Option<String>,
    profiles: &[String],
    _service_tests: &[OnvifServiceTestResult],
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

/// 🎯 ONVIF 完整流程诊断命令
/// 按标准 ONVIF 流程逐步执行：GetCapabilities -> GetProfiles -> GetStreamUri
/// 输出每一步的详细日志，帮助定位问题
#[tauri::command]
pub async fn diagnose_onvif_flow(
    ip: String,
    port: u16,
    username: String,
    password: String,
) -> Result<serde_json::Value, String> {
    log::info!("{}", "=".repeat(60));
    log::info!("🔍 [ONVIF诊断] 开始诊断 {}:{}", ip, port);
    log::info!("{}", "=".repeat(60));

    let mut diagnostics = serde_json::json!({
        "ip": ip,
        "port": port,
        "username": if username.is_empty() { "空(无认证)" } else { &username },
        "steps": []
    });

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("创建HTTP客户端失败: {}", e))?;

    // ========== 步骤 1: GetCapabilities ==========
    log::info!("\n📋 [步骤1/4] GetCapabilities - 获取设备服务地址");
    let _step1 = serde_json::json!({
        "step": 1,
        "name": "GetCapabilities",
        "description": "获取设备服务地址",
        "request_url": format!("http://{}:{}/onvif/device_service", ip, port),
        "success": false,
        "response": null,
        "error": null
    });

    let device_url = format!("http://{}:{}/onvif/device_service", ip, port);

    // 构建带认证的 SOAP 请求
    let soap_with_auth = format!(
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
        .post(&device_url)
        .header("Content-Type", "application/soap+xml; charset=utf-8")
        .header("SOAPAction", "\"http://www.onvif.org/ver10/device/wsdl/GetCapabilities\"")
        .body(soap_with_auth)
        .send()
        .await
    {
        Ok(res) => {
            let status = res.status();
            let body = res.text().await.unwrap_or_default();

            log::info!("📥 [步骤1] 响应状态: {}", status.as_u16());
            log::info!("📄 [步骤1] 响应内容 (前1000字符):\n{}", &body[..body.len().min(1000)]);

            if status.is_success() {
                // 尝试解析 Media URL
                let media_url = parse_media_service_url_from_xml(&body);
                if let Some(url) = media_url {
                    log::info!("✅ [步骤1] 成功解析 Media URL: {}", url);
                    diagnostics["steps"].as_array_mut().unwrap().push(serde_json::json!({
                        "step": 1,
                        "name": "GetCapabilities",
                        "success": true,
                        "media_service_url": url
                    }));
                    diagnostics["media_service_url"] = serde_json::json!(url);

                    // 继续步骤 2
                    // ========== 步骤 2: GetProfiles ==========
                    log::info!("\n📋 [步骤2/4] GetProfiles - 获取媒体配置");
                    match client
                        .post(&url)
                        .header("Content-Type", "application/soap+xml; charset=utf-8")
                        .header("SOAPAction", "\"http://www.onvif.org/ver10/media/wsdl/GetProfiles\"")
                        .body(format!(
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
    <trt:GetProfiles/>
  </s:Body>
</s:Envelope>"#,
                            username, password
                        ))
                        .send()
                        .await
                    {
                        Ok(profiles_res) => {
                            let profiles_status = profiles_res.status();
                            let profiles_body = profiles_res.text().await.unwrap_or_default();

                            log::info!("📥 [步骤2] 响应状态: {}", profiles_status.as_u16());

                            if profiles_status.is_success() {
                                // 解析 Profile Tokens
                                let tokens = parse_profile_tokens_from_xml(&profiles_body);
                                log::info!("📋 [步骤2] 找到 Profile Tokens: {:?}", tokens);

                                if !tokens.is_empty() {
                                    diagnostics["steps"].as_array_mut().unwrap().push(serde_json::json!({
                                        "step": 2,
                                        "name": "GetProfiles",
                                        "success": true,
                                        "profile_tokens": tokens
                                    }));

                                    // 继续步骤 3
                                    // ========== 步骤 3: GetStreamUri ==========
                                    for token in &tokens {
                                        log::info!("\n📋 [步骤3/4] GetStreamUri - 获取RTSP地址 (Profile: {})", token);

                                        match client
                                            .post(&url)
                                            .header("Content-Type", "application/soap+xml; charset=utf-8")
                                            .header("SOAPAction", "\"http://www.onvif.org/ver10/media/wsdl/GetStreamUri\"")
                                            .body(format!(
                                                r#"<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:trt="http://www.onvif.org/ver10/media/wsdl"
            xmlns:tt="http://www.onvif.org/ver10/schema"
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
    <trt:GetStreamUri>
      <trt:StreamSetup>
        <tt:Stream>RTP-Unicast</tt:Stream>
        <tt:Transport>
          <tt:Protocol>RTSP</tt:Protocol>
        </tt:Transport>
      </trt:StreamSetup>
      <trt:ProfileToken>{}</trt:ProfileToken>
    </trt:GetStreamUri>
  </s:Body>
</s:Envelope>"#,
                                                username, password, token
                                            ))
                                            .send()
                                            .await
                                        {
                                            Ok(uri_res) => {
                                                let uri_status = uri_res.status();
                                                let uri_body = uri_res.text().await.unwrap_or_default();

                                                log::info!("📥 [步骤3] 响应状态: {}", uri_status.as_u16());

                                                if uri_status.is_success() {
                                                    // 解析 RTSP URI
                                                    if let Some(rtsp_uri) = parse_stream_uri_from_xml(&uri_body) {
                                                        log::info!("✅ [步骤3] 成功获取 RTSP 地址: {}", rtsp_uri);
                                                        diagnostics["steps"].as_array_mut().unwrap().push(serde_json::json!({
                                                            "step": 3,
                                                            "name": "GetStreamUri",
                                                            "success": true,
                                                            "profile_token": token,
                                                            "rtsp_uri": rtsp_uri
                                                        }));
                                                        diagnostics["rtsp_uri"] = serde_json::json!(rtsp_uri);
                                                        diagnostics["success"] = serde_json::json!(true);

                                                        log::info!("{}", "=".repeat(60));
                                                        log::info!("🎉 [ONVIF诊断] 完整流程成功！");
                                                        log::info!("📹 RTSP 地址: {}", rtsp_uri);
                                                        log::info!("{}", "=".repeat(60));

                                                        return Ok(diagnostics);
                                                    } else {
                                                        log::warn!("⚠️ [步骤3] 无法解析 RTSP URI");
                                                    }
                                                } else {
                                                    log::warn!("⚠️ [步骤3] GetStreamUri 返回错误: {}", uri_status.as_u16());
                                                }
                                            }
                                            Err(e) => {
                                                log::warn!("⚠️ [步骤3] 请求失败: {}", e);
                                            }
                                        }
                                    }
                                } else {
                                    log::warn!("⚠️ [步骤2] 无法解析 Profile Tokens");
                                    diagnostics["steps"].as_array_mut().unwrap().push(serde_json::json!({
                                        "step": 2,
                                        "name": "GetProfiles",
                                        "success": false,
                                        "error": "无法解析 Profile Tokens"
                                    }));
                                }
                            } else {
                                log::warn!("⚠️ [步骤2] GetProfiles 返回错误: {}", profiles_status.as_u16());
                                diagnostics["steps"].as_array_mut().unwrap().push(serde_json::json!({
                                    "step": 2,
                                    "name": "GetProfiles",
                                    "success": false,
                                    "error": format!("HTTP {}", profiles_status.as_u16())
                                }));
                            }
                        }
                        Err(e) => {
                            log::warn!("⚠️ [步骤2] 请求失败: {}", e);
                            diagnostics["steps"].as_array_mut().unwrap().push(serde_json::json!({
                                "step": 2,
                                "name": "GetProfiles",
                                "success": false,
                                "error": e.to_string()
                            }));
                        }
                    }
                } else {
                    log::warn!("⚠️ [步骤1] 无法解析 Media URL");
                    diagnostics["steps"].as_array_mut().unwrap().push(serde_json::json!({
                        "step": 1,
                        "name": "GetCapabilities",
                        "success": false,
                        "error": "无法从响应中解析 Media URL"
                    }));
                }
            } else {
                log::warn!("⚠️ [步骤1] GetCapabilities 返回错误: {}", status.as_u16());
                diagnostics["steps"].as_array_mut().unwrap().push(serde_json::json!({
                    "step": 1,
                    "name": "GetCapabilities",
                    "success": false,
                    "error": format!("HTTP {}", status.as_u16())
                }));
            }
        }
        Err(e) => {
            log::error!("❌ [步骤1] 请求失败: {}", e);
            diagnostics["steps"].as_array_mut().unwrap().push(serde_json::json!({
                "step": 1,
                "name": "GetCapabilities",
                "success": false,
                "error": e.to_string()
            }));
        }
    }

    diagnostics["success"] = serde_json::json!(false);
    log::info!("{}", "=".repeat(60));
    log::info!("❌ [ONVIF诊断] 流程失败");
    log::info!("{}", "=".repeat(60));

    Err(format!("ONVIF 流程失败，请检查日志"))
}

/// 🎯 解析 RTSP URI（使用 roxmltree）
fn parse_stream_uri_from_xml(xml: &str) -> Option<String> {
    log::debug!("🔍 解析 Stream URI，响应长度: {}", xml.len());

    match Document::parse(xml) {
        Ok(doc) => {
            // 查找任意命名空间的 Uri 元素
            for node in doc.descendants() {
                if node.has_tag_name("Uri") {
                    if let Some(uri_str) = node.text() {
                        let uri = uri_str.trim().to_string();
                        if !uri.is_empty() && (uri.starts_with("rtsp://") || uri.starts_with("rtsps://")) {
                            log::info!("✅ 成功解析 Stream URI: {}", uri);
                            return Some(uri);
                        }
                    }
                }
            }

            None
        }
        Err(e) => {
            log::warn!("⚠️ roxmltree 解析失败: {}，使用备用方法", e);
            parse_stream_uri_from_xml_fallback(xml)
        }
    }
}

/// 备用解析方法（当 roxmltree 失败时使用）
fn parse_stream_uri_from_xml_fallback(xml: &str) -> Option<String> {
    let patterns = [
        r"<tt:Uri>([^<]+)</tt:Uri>",
        r"<trt:Uri>([^<]+)</trt:Uri>",
        r"<Uri>([^<]+)</Uri>",
    ];

    for pattern in &patterns {
        if let Ok(re) = regex::Regex::new(pattern) {
            if let Some(cap) = re.captures(xml).and_then(|c| c.get(1)) {
                let uri = cap.as_str().trim().to_string();
                if uri.starts_with("rtsp://") || uri.starts_with("rtsps://") {
                    return Some(uri);
                }
            }
        }
    }

    if let Some(start) = xml.find("rtsp://") {
        let end = xml[start..].find(|c| c == '"' || c == '<' || c == ' ' || c == '\n')
            .unwrap_or(xml.len() - start);
        let uri = xml[start..start + end].trim().to_string();
        if uri.starts_with("rtsp://") {
            return Some(uri);
        }
    }

    None
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

/// 🎯 设备RTSP流地址管理命令
/// 允许为已注册的ONVIF设备手动设置RTSP流地址
#[command]
pub async fn set_device_rtsp_url(
    device_id: String,
    rtsp_url: String,
    manager: State<'_, PtzDeviceManager>,
) -> Result<String, String> {
    // 验证设备是否存在
    if manager.get(&device_id).await.is_none() {
        return Err(format!("设备未注册: {}", device_id));
    }

    // 验证RTSP URL格式
    if !rtsp_url.starts_with("rtsp://") {
        return Err("RTSP地址必须以 rtsp:// 开头".to_string());
    }

    log::info!("🎯 设置设备 {} 的RTSP地址: {}", device_id, rtsp_url);

    manager
        .set_rtsp_url(&device_id, rtsp_url.clone())
        .await
        .map_err(|e| format!("设置RTSP地址失败: {}", e))?;

    Ok(rtsp_url)
}

/// 🎯 获取设备的RTSP流地址（如果已设置）
#[command]
pub async fn get_device_rtsp_url(
    device_id: String,
    manager: State<'_, PtzDeviceManager>,
) -> Result<String, String> {
    // 验证设备是否存在
    if manager.get(&device_id).await.is_none() {
        return Err(format!("设备未注册: {}", device_id));
    }

    if let Some(rtsp_url) = manager.get_rtsp_url(&device_id).await {
        Ok(rtsp_url)
    } else {
        Err("未找到预设的RTSP地址，请使用 get_onvif_stream_uri 获取或手动配置".to_string())
    }
}
