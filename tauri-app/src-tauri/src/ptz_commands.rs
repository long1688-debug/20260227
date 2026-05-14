use tauri::{State, command};
use crate::ptz::PtzDeviceManager;
use crate::ptz::discovery::DiscoveredOnvifDevice;
use crate::ptz::onvif::OnvifCamera;

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

/// 🎯 更新摄像机配置参数
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
    log::info!("🔧 更新设备配置: {}", device_id);
    
    // 获取现有设备
    let camera = manager.get(&device_id).await
        .ok_or_else(|| format!("设备未找到: {}", device_id))?;
    
    // 创建新的摄像机实例（使用更新后的配置）
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

// 🎯 GB/T 28181 国标协议发现
#[command]
pub async fn discover_gb28181_devices(
    timeout_secs: u64,
) -> Result<Vec<crate::camera_discovery::DiscoveredCamera>, String> {
    log::info!("🇨🇳 开始 GB/T 28181 国标协议发现，超时时间: {}秒", timeout_secs);
    
    let discovery = crate::camera_discovery::CameraDiscovery::new();
    let result = discovery.discover_gb28181(timeout_secs).await;
    
    log::info!("✅ GB28181 发现完成，共发现 {} 个设备", result.len());
    Ok(result)
}

// 🎯 厂商私有协议发现 (海康SADP + 大华P2P)
#[command]
pub async fn discover_vendor_cameras(
    timeout_secs: u64,
) -> Result<Vec<crate::camera_discovery::DiscoveredCamera>, String> {
    log::info!("🏭 开始厂商私有协议发现 (海康SADP + 大华P2P)，超时时间: {}秒", timeout_secs);
    
    let discovery = crate::camera_discovery::CameraDiscovery::new();
    let result = discovery.discover_vendor_protocols(timeout_secs).await;
    
    log::info!("✅ 厂商协议发现完成，共发现 {} 个设备", result.len());
    Ok(result)
}

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


