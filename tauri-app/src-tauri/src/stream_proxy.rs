// 流媒体代理模块 - 基于 ZLMediaKit 的统一流管理
// 支持：本地视频文件、RTSP/RTMP 网络流、WebRTC 推流
use tauri::{command, AppHandle, Manager};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::Mutex;
use reqwest::Client;

/// 流类型枚举
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum StreamType {
    LocalVideo,    // 本地视频文件
    NetworkCamera, // RTSP/RTMP 网络摄像头
    WebRTC,        // WebRTC 推流
    LocalCamera,   // 本地摄像头捕获
}

/// 流元信息
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct StreamMeta {
    pub id: String,
    pub stream_type: StreamType,
    pub source_url: String,        // 原始输入地址（文件路径/RTSP URL等）
    pub flv_url: String,           // FLV 播放地址
    pub webrtc_url: String,        // WebRTC 播放地址
    pub ws_flv_url: String,        // WebSocket-FLV 播放地址（低延迟）
    pub status: String,
    pub has_audio: bool,
    pub has_video: bool,
    pub created_at: u64,
}

/// 流媒体应用状态
pub struct StreamState {
    pub active_streams: Mutex<HashMap<String, StreamMeta>>,
    pub ffmpeg_processes: Mutex<HashMap<String, tokio::process::Child>>, // 存储 FFmpeg 进程
    pub http_client: Client,
    pub zlmediakit_host: String,
    pub zlmediakit_port: u16,
    pub zlmediakit_secret: String,
}

impl StreamState {
    pub fn new() -> Self {
        Self {
            active_streams: Mutex::new(HashMap::new()),
            ffmpeg_processes: Mutex::new(HashMap::new()),
            http_client: Client::new(),
            zlmediakit_host: "127.0.0.1".to_string(),
            zlmediakit_port: 801, // ZLMediaKit HTTP 端口
            zlmediakit_secret: "035c73f7-bb6b-4889-a715-d9eb2d1925cc".to_string(), // 默认密钥
        }
    }

    /// 生成唯一的流 ID
    pub fn generate_stream_id(prefix: &str) -> String {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis();
        format!("{}_{}", prefix, timestamp)
    }
}

// ==================== 本地视频文件代理 ====================

/// 代理本地视频文件到 ZLMediaKit
#[command]
pub async fn proxy_local_video(
    app: AppHandle,
    file_path: String,
    stream_id: Option<String>,
) -> Result<StreamMeta, String> {
    let state = app.state::<StreamState>();

    // 生成流 ID
    let id = stream_id.unwrap_or_else(|| StreamState::generate_stream_id("local"));

    // 将本地文件路径转为 file:// 协议
    let file_url = if file_path.starts_with("file://") {
        file_path.clone()
    } else {
        // Windows 路径转换：D:\video\test.mp4 -> file:///D:/video/test.mp4
        let normalized = file_path.replace("\\", "/");
        format!("file:///{}", normalized)
    };

    // 调用 ZLMediaKit addStreamProxy API
    let meta = add_stream_proxy(
        &state,
        &id,
        &file_url,
        StreamType::LocalVideo,
        true, // 循环播放
    ).await?;

    println!("[本地视频代理] 启动成功: {} -> {}", file_url, meta.flv_url);
    Ok(meta)
}

// ==================== 网络摄像头/RTSP 流代理 ====================

/// 代理网络流（RTSP/RTMP）到 ZLMediaKit
#[command]
pub async fn proxy_network_stream(
    app: AppHandle,
    stream_url: String,
    stream_id: Option<String>,
    stream_type: StreamType,
    options: Option<ProxyOptions>,
) -> Result<StreamMeta, String> {
    let state = app.state::<StreamState>();

    let id = stream_id.unwrap_or_else(|| StreamState::generate_stream_id("net"));
    let opts = options.unwrap_or_default();

    // 调用 ZLMediaKit addStreamProxy API
    let meta = add_stream_proxy(
        &state,
        &id,
        &stream_url,
        stream_type,
        opts.enable_retry.unwrap_or(true),
    ).await?;

    // 应用额外选项
    if let Some(username) = opts.username {
        if !username.is_empty() {
            // 可以在这里处理认证信息
            println!("[网络流代理] 使用认证: {}", username);
        }
    }

    println!("[网络流代理] 启动成功: {} -> {}", stream_url, meta.flv_url);
    Ok(meta)
}

/// 代理选项
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct ProxyOptions {
    pub username: Option<String>,
    pub password: Option<String>,
    pub enable_retry: Option<bool>,
    pub timeout_sec: Option<u32>,
}

// ==================== 核心 API：添加流代理 ====================

/// 通用流代理添加函数（内部使用）
async fn add_stream_proxy(
    state: &tauri::State<'_, StreamState>,
    stream_id: &str,
    source_url: &str,
    stream_type: StreamType,
    enable_retry: bool,
) -> Result<StreamMeta, String> {
    let client = &state.http_client;
    let host = &state.zlmediakit_host;
    let port = state.zlmediakit_port;
    let secret = &state.zlmediakit_secret;

    // 检查是否已存在
    {
        let streams = state.active_streams.lock().await;
        if streams.contains_key(stream_id) {
            return Ok(streams.get(stream_id).unwrap().clone());
        }
    }

    // 调用 ZLMediaKit addStreamProxy API
    let api_url = format!("http://{}:{}/index/api/addStreamProxy?secret={}", host, port, secret);

    let resp = client
        .post(&api_url)
        .json(&serde_json::json!({
            "vhost": "__defaultVhost__",
            "app": "live",
            "stream": stream_id,
            "url": source_url,
            "enable_hls": 0,
            "enable_mp4": 0,
            "enable_flv": 1,
            "enable_rtsp": 1,
            "enable_rtmp": 1,
            "enable_ts": 0,
            "h265_enabled": 1,
            "h264_enabled": 1,
            "audio_enabled": 1,
            "mp4_save_path": "",
            "retry_count": if enable_retry { -1 } else { 0 }, // -1 表示无限重试
            "rtp_type": 0,
            "timeout_sec": 10,
            "enable_audio": 1,
            "auto_close": 0, // 0 表示不自动关闭
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

    // 生成播放 URL
    let flv_url = format!("http://{}:{}/live/{}/live.flv", host, port, stream_id);
    let ws_flv_url = format!("ws://{}:{}/live/{}.flv", host, port, stream_id);
    let webrtc_url = format!("http://{}:{}/index/api/webrtc?app=live&stream={}&type=play", host, port, stream_id);

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let meta = StreamMeta {
        id: stream_id.to_string(),
        stream_type,
        source_url: source_url.to_string(),
        flv_url,
        webrtc_url,
        ws_flv_url,
        status: "active".into(),
        has_audio: true,
        has_video: true,
        created_at: now,
    };

    // 保存到状态
    {
        let mut streams = state.active_streams.lock().await;
        streams.insert(stream_id.to_string(), meta.clone());
    }

    Ok(meta)
}

// ==================== 流控制 API ====================

/// 停止流代理
#[command]
pub async fn stop_stream_proxy(
    app: AppHandle,
    stream_id: String,
) -> Result<bool, String> {
    let state = app.state::<StreamState>();
    let client = &state.http_client;
    let host = &state.zlmediakit_host;
    let port = state.zlmediakit_port;
    let secret = &state.zlmediakit_secret;

    // 检查是否是本地摄像头流（需要停止 FFmpeg 进程）
    let is_local_camera = {
        let streams = state.active_streams.lock().await;
        if let Some(meta) = streams.get(&stream_id) {
            meta.stream_type == StreamType::LocalCamera
        } else {
            false
        }
    };

    // 如果是本地摄像头，停止 FFmpeg 进程
    if is_local_camera {
        let child = {
            let mut processes = state.ffmpeg_processes.lock().await;
            processes.remove(&stream_id)
        };

        if let Some(mut child) = child {
            println!("[本地摄像头] 正在停止 FFmpeg 进程: {}", stream_id);

            // Windows 直接 kill
            child.kill().await.ok();
            child.wait().await.ok();
            println!("[本地摄像头] FFmpeg 进程已停止");
        }
    }

    // 调用 ZLMediaKit close_streams API
    let api_url = format!("http://{}:{}/index/api/close_streams?secret={}", host, port, secret);

    let resp = client
        .post(&api_url)
        .json(&serde_json::json!({
            "vhost": "__defaultVhost__",
            "app": "live",
            "stream": &stream_id
        }))
        .send()
        .await
        .map_err(|e| format!("ZLMediaKit 请求失败: {}", e))?;

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    if body["code"].as_i64().unwrap_or(1) != 0 {
        return Err(format!("ZLM 关闭流失败: {}", body["msg"].as_str().unwrap_or("未知错误")));
    }

    // 从状态中移除
    {
        let mut streams = state.active_streams.lock().await;
        streams.remove(&stream_id);
    }

    println!("[流代理] 已停止: {}", stream_id);
    Ok(true)
}

/// 获取所有活跃流
#[command]
pub async fn get_active_streams(
    app: AppHandle,
) -> Result<Vec<StreamMeta>, String> {
    let state = app.state::<StreamState>();
    let streams = state.active_streams.lock().await;

    Ok(streams.values().cloned().collect())
}

/// 检查流状态
#[command]
pub async fn check_stream_status(
    app: AppHandle,
    stream_id: String,
) -> Result<StreamMeta, String> {
    let state = app.state::<StreamState>();
    let streams = state.active_streams.lock().await;

    streams
        .get(&stream_id)
        .cloned()
        .ok_or_else(|| format!("流 {} 不存在", stream_id))
}

// ==================== 音频控制 API ====================

/// 控制流的音频轨道（静音/恢复）
#[command]
pub async fn control_stream_audio(
    app: AppHandle,
    stream_id: String,
    mute: bool,
) -> Result<bool, String> {
    let state = app.state::<StreamState>();
    let client = &state.http_client;
    let host = &state.zlmediakit_host;
    let port = state.zlmediakit_port;
    let secret = &state.zlmediakit_secret;

    // 使用 setMute 接口控制音频
    let api_url = format!("http://{}:{}/index/api/setMute?secret={}", host, port, secret);

    let resp = client
        .post(&api_url)
        .json(&serde_json::json!({
            "vhost": "__defaultVhost__",
            "app": "live",
            "stream": &stream_id,
            "track_type": 1, // 1 表示音频轨道
            "mute": mute
        }))
        .send()
        .await
        .map_err(|e| format!("ZLMediaKit 请求失败: {}", e))?;

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    if body["code"].as_i64().unwrap_or(1) != 0 {
        return Err(format!("ZLM 音频控制失败: {}", body["msg"].as_str().unwrap_or("未知错误")));
    }

    // 更新本地状态
    {
        let mut streams = state.active_streams.lock().await;
        if let Some(meta) = streams.get_mut(&stream_id) {
            meta.has_audio = !mute;
        }
    }

    println!("[音频控制] 流 {} 静音: {}", stream_id, mute);
    Ok(true)
}

// ==================== WebRTC 推流 ====================

/// WebRTC 推流选项
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct WebRTCPushOptions {
    pub app: Option<String>,        // 应用名称，默认 "live"
    pub enable_audio: Option<bool>, // 是否启用音频，默认 true
    pub enable_video: Option<bool>, // 是否启用视频，默认 true
    pub timeout_sec: Option<u32>,   // 超时时间（秒）
}

/// 代理 WebRTC 推流到 ZLMediaKit
///
/// 前端通过 WebRTC API 推送音视频流到 ZLMediaKit，
/// ZLMediaKit 将流转换为 FLV/RTSP/RTMP 等多种格式供其他客户端播放。
#[command]
pub async fn proxy_webrtc_push(
    app: AppHandle,
    stream_id: String,
    options: Option<WebRTCPushOptions>,
) -> Result<StreamMeta, String> {
    let state = app.state::<StreamState>();
    let opts = options.unwrap_or_default();

    // 检查流 ID 是否已存在
    {
        let streams = state.active_streams.lock().await;
        if streams.contains_key(&stream_id) {
            return Ok(streams.get(&stream_id).unwrap().clone());
        }
    }

    let _client = &state.http_client;
    let host = &state.zlmediakit_host;
    let port = state.zlmediakit_port;
    let _secret = &state.zlmediakit_secret;

    // 注意：WebRTC 推流不需要调用 addStreamProxy API
    // 前端直接通过 WebRTC 协议推送到 ZLMediaKit
    // 这里只创建流元信息，等待前端推送

    let webrtc_push_url = format!(
        "http://{}:{}/index/api/webrtc?app={}&stream={}&type=push",
        host, port,
        opts.app.as_deref().unwrap_or("live"),
        stream_id
    );

    let flv_url = format!(
        "http://{}:{}/{}/{}/live.flv",
        host, port,
        opts.app.as_deref().unwrap_or("live"),
        stream_id
    );

    let ws_flv_url = format!(
        "ws://{}:{}/{}/{}.flv",
        host, port,
        opts.app.as_deref().unwrap_or("live"),
        stream_id
    );

    let webrtc_play_url = format!(
        "http://{}:{}/index/api/webrtc?app={}&stream={}&type=play",
        host, port,
        opts.app.as_deref().unwrap_or("live"),
        stream_id
    );

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let meta = StreamMeta {
        id: stream_id.clone(),
        stream_type: StreamType::WebRTC,
        source_url: webrtc_push_url.clone(),
        flv_url,
        webrtc_url: webrtc_play_url,
        ws_flv_url,
        status: "waiting_push".into(), // 等待推送
        has_audio: opts.enable_audio.unwrap_or(true),
        has_video: opts.enable_video.unwrap_or(true),
        created_at: now,
    };

    // 保存到状态
    {
        let mut streams = state.active_streams.lock().await;
        streams.insert(stream_id.clone(), meta.clone());
    }

    println!("[WebRTC推流] 创建推流会话: {} -> {}", stream_id, webrtc_push_url);
    Ok(meta)
}

// ==================== 本地摄像头代理 ====================

/// 本地摄像头捕获选项
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct LocalCameraOptions {
    pub device_id: Option<String>,    // 设备 ID（Windows 为设备名称）
    pub resolution: Option<String>,   // 分辨率，如 "1920x1080"
    pub framerate: Option<u32>,       // 帧率
    pub enable_audio: Option<bool>,   // 是否启用音频
    pub app: Option<String>,          // 应用名称
}

/// 代理本地摄像头到 ZLMediaKit
///
/// 使用 FFmpeg 捕获本地摄像头并推送到 ZLMediaKit，
/// 实现低延迟 FLV/WebRTC 播放。
#[command]
pub async fn proxy_local_camera(
    app: AppHandle,
    stream_id: String,
    options: Option<LocalCameraOptions>,
) -> Result<StreamMeta, String> {
    let state = app.state::<StreamState>();
    let opts = options.unwrap_or_default();

    // 检查流 ID 是否已存在
    {
        let streams = state.active_streams.lock().await;
        if streams.contains_key(&stream_id) {
            return Ok(streams.get(&stream_id).unwrap().clone());
        }
    }

    let client = &state.http_client;
    let host = &state.zlmediakit_host;
    let port = state.zlmediakit_port;
    let secret = &state.zlmediakit_secret;

    // 构建 FFmpeg 命令
    let device_id = opts.device_id.unwrap_or_else(|| {
        // Windows 默认使用第一个摄像头设备
        "video=Integrated Camera".to_string()
    });

    let resolution = opts.resolution.unwrap_or_else(|| "1280x720".to_string());
    let framerate = opts.framerate.unwrap_or(30);

    // RTMP 推流地址（ZLMediaKit 默认 RTMP 端口 1935）
    let rtmp_url = format!(
        "rtmp://{}/live/{}",
        host, stream_id
    );

    // 构建 FFmpeg 命令参数
    let mut ffmpeg_args = vec![
        "-f".to_string(), "dshow".to_string(),  // Windows DirectShow
        "-i".to_string(), format!("video={}", device_id),
        "-vf".to_string(), format!("scale={}", resolution.replace("x", ":")),
        "-r".to_string(), framerate.to_string(),
        "-c:v".to_string(), "libx264".to_string(),
        "-preset".to_string(), "ultrafast".to_string(),  // 低延迟编码
        "-tune".to_string(), "zerolatency".to_string(),  // 零延迟调优
        "-b:v".to_string(), "2500k".to_string(),  // 视频码率
        "-f".to_string(), "flv".to_string(),  // 输出格式
        rtmp_url.clone(),
    ];

    // 如果启用音频
    if opts.enable_audio.unwrap_or(true) {
        // 在视频输入前插入音频参数
        let audio_input = "audio=麦克风".to_string(); // Windows 默认麦克风
        ffmpeg_args.splice(4..4, vec![
            "-f".to_string(), "dshow".to_string(),
            "-i".to_string(), audio_input,
            "-c:a".to_string(), "aac".to_string(),
            "-b:a".to_string(), "128k".to_string(),
        ]);
    }

    println!("[本地摄像头] 启动 FFmpeg: ffmpeg {}", ffmpeg_args.join(" "));

    // 启动 FFmpeg 进程
    let mut child = tokio::process::Command::new("ffmpeg")
        .args(&ffmpeg_args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| {
            format!(
                "启动 FFmpeg 失败: {}，请确认 FFmpeg 已安装并添加到 PATH",
                e
            )
        })?;

    // 等待推流建立
    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

    // 检查 FFmpeg 是否仍在运行
    let is_running = match child.try_wait() {
        Ok(None) => true,   // 仍在运行
        Ok(Some(status)) => {
            return Err(format!(
                "FFmpeg 进程异常退出: {}，请检查设备名称是否正确",
                status
            ));
        }
        Err(_) => false,
    };

    if !is_running {
        return Err("FFmpeg 未能成功启动推流".to_string());
    }

    // 保存 FFmpeg 进程句柄
    {
        let mut processes = state.ffmpeg_processes.lock().await;
        processes.insert(stream_id.clone(), child);
    }

    // 调用 ZLMediaKit API 确认流已注册
    let api_url = format!(
        "http://{}:{}/index/api/getMediaList?secret={}",
        host, port, secret
    );

    let resp = client
        .get(&api_url)
        .query(&[
            ("vhost", "__defaultVhost__"),
            ("app", opts.app.as_deref().unwrap_or("live")),
            ("stream", &stream_id),
        ])
        .send()
        .await
        .map_err(|e| format!("ZLMediaKit 请求失败: {}", e))?;

    let _body: serde_json::Value = resp
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    // 生成播放 URL（注：未来可以在这里验证流是否已注册）
    let app_name = opts.app.as_deref().unwrap_or("live");
    let flv_url = format!(
        "http://{}:{}/{}/{}/live.flv",
        host, port, app_name, stream_id
    );

    let ws_flv_url = format!(
        "ws://{}:{}/{}/{}.flv",
        host, port, app_name, stream_id
    );

    let webrtc_url = format!(
        "http://{}:{}/index/api/webrtc?app={}&stream={}&type=play",
        host, port, app_name, stream_id
    );

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let meta = StreamMeta {
        id: stream_id.clone(),
        stream_type: StreamType::LocalCamera,
        source_url: device_id.clone(),
        flv_url: flv_url.clone(),
        webrtc_url,
        ws_flv_url: ws_flv_url.clone(),
        status: "active".into(),
        has_audio: opts.enable_audio.unwrap_or(true),
        has_video: true,
        created_at: now,
    };

    // 保存到状态（包含 FFmpeg 进程句柄）
    {
        let mut streams = state.active_streams.lock().await;
        streams.insert(stream_id.clone(), meta.clone());
    }

    println!(
        "[本地摄像头] 推流成功: {} -> {}",
        device_id, flv_url
    );
    Ok(meta)
}

// ==================== 旧版 RTSP 代理兼容接口 ====================

/// 启动 RTSP 流代理（旧版兼容接口）
#[command]
pub async fn add_rtsp_proxy(
    app: AppHandle,
    stream_id: String,
    rtsp_url: String,
) -> Result<StreamMeta, String> {
    proxy_network_stream(
        app,
        rtsp_url,
        Some(stream_id),
        StreamType::NetworkCamera,
        None,
    ).await
}

/// 停止 RTSP 流代理（旧版兼容接口）
#[command]
pub async fn remove_rtsp_proxy(
    app: AppHandle,
    stream_id: String,
) -> Result<bool, String> {
    stop_stream_proxy(app, stream_id).await
}
