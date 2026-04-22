use tauri::{State, command};
use crate::ptz::PtzDeviceManager;
use crate::ptz::discovery::DiscoveredOnvifDevice;

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
