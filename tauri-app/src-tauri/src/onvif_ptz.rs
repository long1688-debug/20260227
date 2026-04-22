// ONVIF 云台控制模块
use tauri::command;
use serde::{Deserialize, Serialize};
use reqwest::Client;
use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE};

/// PTZ 动作
#[derive(Serialize, Deserialize, Debug)]
pub enum PtzAction {
    Up,
    Down,
    Left,
    Right,
    UpLeft,
    UpRight,
    DownLeft,
    DownRight,
    ZoomIn,
    ZoomOut,
    Stop,
}

impl PtzAction {
    pub fn from_str(s: &str) -> Result<Self, String> {
        match s {
            "up" => Ok(PtzAction::Up),
            "down" => Ok(PtzAction::Down),
            "left" => Ok(PtzAction::Left),
            "right" => Ok(PtzAction::Right),
            "up_left" => Ok(PtzAction::UpLeft),
            "up_right" => Ok(PtzAction::UpRight),
            "down_left" => Ok(PtzAction::DownLeft),
            "down_right" => Ok(PtzAction::DownRight),
            "zoom_in" => Ok(PtzAction::ZoomIn),
            "zoom_out" => Ok(PtzAction::ZoomOut),
            "stop" => Ok(PtzAction::Stop),
            _ => Err(format!("未知 PTZ 动作: {}", s)),
        }
    }

    /// 转换为 ONVIF SOAP 请求体
    pub fn to_soap_body(&self, speed: f32) -> String {
        let (pan, tilt, zoom) = match self {
            PtzAction::Up => (0.0, speed, 0.0),
            PtzAction::Down => (0.0, -speed, 0.0),
            PtzAction::Left => (-speed, 0.0, 0.0),
            PtzAction::Right => (speed, 0.0, 0.0),
            PtzAction::UpLeft => (-speed, speed, 0.0),
            PtzAction::UpRight => (speed, speed, 0.0),
            PtzAction::DownLeft => (-speed, -speed, 0.0),
            PtzAction::DownRight => (speed, -speed, 0.0),
            PtzAction::ZoomIn => (0.0, 0.0, speed),
            PtzAction::ZoomOut => (0.0, 0.0, -speed),
            PtzAction::Stop => (0.0, 0.0, 0.0),
        };

        format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
               xmlns:ptz="http://www.onvif.org/ver20/ptz/wsdl">
    <soap:Body>
        <ptz:ContinuousMove>
            <ptz:ProfileToken>Profile_1</ptz:ProfileToken>
            <ptz:Velocity>
                <tt:PanTilt x="{}" y="{}" xmlns:tt="http://www.onvif.org/ver10/schema"/>
                <tt:Zoom x="{}" xmlns:tt="http://www.onvif.org/ver10/schema"/>
            </ptz:Velocity>
        </ptz:ContinuousMove>
    </soap:Body>
</soap:Envelope>"#,
            pan, tilt, zoom
        )
    }
}

/// PTZ 控制命令
#[command]
pub async fn onvif_ptz(
    device_url: String,
    username: String,
    password: String,
    action: String,
    speed: f32,
) -> Result<String, String> {
    let action = PtzAction::from_str(&action)?;
    let client = Client::new();

    // 构建 Basic Auth
    let credentials = format!("{}:{}", username, password);
    let encoded = base64_encode(&credentials);

    let soap_body = action.to_soap_body(speed);

    // 设置请求头
    let mut headers = HeaderMap::new();
    headers.insert(
        CONTENT_TYPE,
        HeaderValue::from_static("application/soap+xml; charset=utf-8"),
    );
    headers.insert(
        "Authorization",
        HeaderValue::from_str(&format!("Basic {}", encoded))
            .map_err(|e| format!("Auth header 错误: {}", e))?,
    );

    // 发送 SOAP 请求
    let resp = client
        .post(&device_url)
        .headers(headers)
        .body(soap_body.clone())
        .send()
        .await
        .map_err(|e| format!("PTZ 请求失败: {}", e))?;

    if resp.status().is_success() {
        println!("[PTZ控制] 指令已下发: {:?}", action);
        Ok("PTZ 指令已下发".into())
    } else {
        Err(format!("PTZ 响应错误: {}", resp.status()))
    }
}

/// 停止 PTZ 移动
#[command]
pub async fn onvif_ptz_stop(
    device_url: String,
    username: String,
    password: String,
) -> Result<String, String> {
    onvif_ptz(device_url, username, password, "stop".into(), 0.0).await
}

/// 获取 PTZ 预设位
#[command]
pub async fn onvif_get_presets(
    device_url: String,
    username: String,
    password: String,
) -> Result<Vec<String>, String> {
    let client = Client::new();
    let credentials = format!("{}:{}", username, password);
    let encoded = base64_encode(&credentials);

    let soap_body = r#"<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
               xmlns:ptz="http://www.onvif.org/ver20/ptz/wsdl">
    <soap:Body>
        <ptz:GetPresets>
            <ptz:ProfileToken>Profile_1</ptz:ProfileToken>
        </ptz:GetPresets>
    </soap:Body>
</soap:Envelope>"#;

    let mut headers = HeaderMap::new();
    headers.insert(
        CONTENT_TYPE,
        HeaderValue::from_static("application/soap+xml; charset=utf-8"),
    );
    headers.insert(
        "Authorization",
        HeaderValue::from_str(&format!("Basic {}", encoded))
            .map_err(|e| format!("Auth header 错误: {}", e))?,
    );

    let resp = client
        .post(&device_url)
        .headers(headers)
        .body(soap_body)
        .send()
        .await
        .map_err(|e| format!("获取预设位失败: {}", e))?;

    // 简化处理：实际应该解析 XML 响应
    let body = resp
        .text()
        .await
        .map_err(|e| format!("读取响应失败: {}", e))?;

    // 这里简化返回，实际需要 XML 解析
    println!("[PTZ预设] 响应: {}", body);
    Ok(vec!["预设位1".into(), "预设位2".into()])
}

/// 跳转到 PTZ 预设位
#[command]
pub async fn onvif_goto_preset(
    device_url: String,
    username: String,
    password: String,
    preset_token: String,
) -> Result<String, String> {
    let client = Client::new();
    let credentials = format!("{}:{}", username, password);
    let encoded = base64_encode(&credentials);

    let soap_body = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
               xmlns:ptz="http://www.onvif.org/ver20/ptz/wsdl">
    <soap:Body>
        <ptz:GotoPreset>
            <ptz:ProfileToken>Profile_1</ptz:ProfileToken>
            <ptz:PresetToken>{}</ptz:PresetToken>
        </ptz:GotoPreset>
    </soap:Body>
</soap:Envelope>"#,
        preset_token
    );

    let mut headers = HeaderMap::new();
    headers.insert(
        CONTENT_TYPE,
        HeaderValue::from_static("application/soap+xml; charset=utf-8"),
    );
    headers.insert(
        "Authorization",
        HeaderValue::from_str(&format!("Basic {}", encoded))
            .map_err(|e| format!("Auth header 错误: {}", e))?,
    );

    let resp = client
        .post(&device_url)
        .headers(headers)
        .body(soap_body)
        .send()
        .await
        .map_err(|e| format!("跳转预设位失败: {}", e))?;

    if resp.status().is_success() {
        println!("[PTZ预设] 跳转到预设位: {}", preset_token);
        Ok("已跳转到预设位".into())
    } else {
        Err(format!("跳转预设位失败: {}", resp.status()))
    }
}

/// Base64 编码（使用 base64 crate）
fn base64_encode(input: &str) -> String {
    use base64::{engine::general_purpose, Engine as _};
    general_purpose::STANDARD.encode(input)
}
