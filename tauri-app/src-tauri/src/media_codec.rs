use crate::proc_util::NoWindow;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use tauri::{AppHandle, Emitter};
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use std::thread;
use std::time::Duration;

// Windows API for process handle management
#[cfg(windows)]
use std::os::windows::io::AsRawHandle;

/// 硬件加速类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HardwareAcceleration {
    None,
    NVENC,      // NVIDIA GPU
    QSV,        // Intel QuickSync
    AMF,        // AMD AMF
    VAAPI,      // Linux VAAPI
    VideoToolbox, // macOS VideoToolbox
}

impl HardwareAcceleration {
    pub fn to_video_encoder(&self) -> &'static str {
        match self {
            HardwareAcceleration::None => "libx264",
            HardwareAcceleration::NVENC => "h264_nvenc",
            HardwareAcceleration::QSV => "h264_qsv",
            HardwareAcceleration::AMF => "h264_amf",
            HardwareAcceleration::VAAPI => "h264_vaapi",
            HardwareAcceleration::VideoToolbox => "h264_videotoolbox",
        }
    }
}

/// 视频流配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoStreamConfig {
    pub stream_id: String,
    pub source_type: String, // "camera", "screen", "file", "rtsp", "webrtc"
    pub source_path: String, // 设备名/文件路径/URL
    pub width: u32,
    pub height: u32,
    pub framerate: u32,
    pub bitrate: u32, // kbps
    pub codec: String, // "h264", "h265", "vp9"
    pub preset: String, // "ultrafast", "fast", "medium", "slow"
    pub crf: u32, // 质量因子 0-51
    pub hardware_accel: HardwareAcceleration,
}

/// 音频流配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioStreamConfig {
    pub stream_id: String,
    pub source_type: String, // "microphone", "system", "file"
    pub source_path: String,
    pub sample_rate: u32, // 44100, 48000
    pub channels: u32, // 1=mono, 2=stereo
    pub bitrate: u32, // kbps
    pub codec: String, // "aac", "opus", "mp3"
}

/// 混流布局配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MixLayoutConfig {
    pub layout_type: String, // "pip", "grid", "custom"
    pub main_stream_id: String,
    pub overlay_streams: Vec<OverlayStreamConfig>,
    pub output_width: u32,
    pub output_height: u32,
}

/// 叠加流配置（用于画中画等）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OverlayStreamConfig {
    pub stream_id: String,
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
    pub opacity: f32, // 0.0-1.0
}

/// 多路录制会话
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiCodecSession {
    pub session_id: String,
    pub session_type: String, // "multi_record", "mix_stream", "transcode"
    pub video_streams: Vec<VideoStreamConfig>,
    pub audio_streams: Vec<AudioStreamConfig>,
    pub mix_layout: Option<MixLayoutConfig>,
    pub output_path: String,
    pub output_format: String, // "mp4", "mkv", "flv"
    pub is_active: bool,
    pub start_time: Option<u64>,
    pub duration: u64,
    pub status: String, // "recording", "paused", "stopped", "error"
    pub error_message: Option<String>,
}

/// 硬件加速能力检测
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareCapabilities {
    pub has_nvidia: bool,
    pub has_intel_qsv: bool,
    pub has_amd_amf: bool,
    pub has_vaapi: bool,
    pub has_videotoolbox: bool,
    pub recommended_encoder: String,
    pub gpu_memory_mb: Option<u64>,
}

/// 编解码性能统计
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodecPerformanceStats {
    pub session_id: String,
    pub fps_current: f32,
    pub fps_average: f32,
    pub cpu_usage_percent: f32,
    pub gpu_usage_percent: Option<f32>,
    pub dropped_frames: u64,
    pub bitrate_actual: u32, // kbps
    pub buffer_health: f32, // 0.0-1.0
}

/// 多路编解码管理器
pub struct MultiCodecManager {
    sessions: Arc<RwLock<HashMap<String, MultiCodecSession>>>,
    processes: Arc<RwLock<HashMap<String, Child>>>,
    performance_stats: Arc<RwLock<HashMap<String, CodecPerformanceStats>>>,
    hardware_caps: Arc<Mutex<Option<HardwareCapabilities>>>,
}

impl MultiCodecManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            processes: Arc::new(RwLock::new(HashMap::new())),
            performance_stats: Arc::new(RwLock::new(HashMap::new())),
            hardware_caps: Arc::new(Mutex::new(None)),
        }
    }

    /// 检测硬件加速能力
    pub fn detect_hardware_acceleration(&self) -> HardwareCapabilities {
        let mut caps = HardwareCapabilities {
            has_nvidia: false,
            has_intel_qsv: false,
            has_amd_amf: false,
            has_vaapi: false,
            has_videotoolbox: false,
            recommended_encoder: "libx264".to_string(),
            gpu_memory_mb: None,
        };

        // 检测 FFmpeg 支持的编码器
        if let Ok(output) = Command::new("ffmpeg").no_window()
            .arg("-encoders")
            .output()
        {
            let output_str = String::from_utf8_lossy(&output.stdout);
            
            caps.has_nvidia = output_str.contains("h264_nvenc");
            caps.has_intel_qsv = output_str.contains("h264_qsv");
            caps.has_amd_amf = output_str.contains("h264_amf");
            caps.has_vaapi = output_str.contains("h264_vaapi");
            
            #[cfg(target_os = "macos")]
            {
                caps.has_videotoolbox = output_str.contains("h264_videotoolbox");
            }
        }

        // 推荐最佳编码器
        caps.recommended_encoder = if caps.has_nvidia {
            "h264_nvenc".to_string()
        } else if caps.has_intel_qsv {
            "h264_qsv".to_string()
        } else if caps.has_amd_amf {
            "h264_amf".to_string()
        } else if caps.has_videotoolbox {
            "h264_videotoolbox".to_string()
        } else {
            "libx264".to_string()
        };

        // 获取 GPU 内存信息（可选）
        if caps.has_nvidia {
            if let Ok(output) = Command::new("nvidia-smi").no_window()
                .arg("--query-gpu=memory.total")
                .arg("--format=csv,noheader,nounits")
                .output()
            {
                if let Ok(mem_str) = String::from_utf8(output.stdout) {
                    if let Ok(mem) = mem_str.trim().parse::<u64>() {
                        caps.gpu_memory_mb = Some(mem);
                    }
                }
            }
        }

        *self.hardware_caps.lock().unwrap() = Some(caps.clone());
        caps
    }

    /// 开始多路独立录制
    pub async fn start_multi_record(
        &self,
        app_handle: &AppHandle,
        session_id: String,
        video_streams: Vec<VideoStreamConfig>,
        audio_streams: Vec<AudioStreamConfig>,
        output_dir: String,
    ) -> Result<String, String> {
        println!("[多路编解码] 开始多路录制: {}", session_id);

        // 为每路创建独立的 FFmpeg 进程
        let mut process_ids = Vec::new();
        
        for (idx, video_config) in video_streams.iter().enumerate() {
            let stream_session_id = format!("{}_stream_{}", session_id, idx);
            let output_path = format!(
                "{}/stream_{}_{}.{}",
                output_dir,
                idx,
                chrono::Local::now().format("%Y%m%d_%H%M%S"),
                "mp4"
            );

            // 构建 FFmpeg 命令
            let mut cmd = Command::new("ffmpeg"); cmd.no_window();
            
            // 视频输入
            match video_config.source_type.as_str() {
                "camera" => {
                    cmd.arg("-f").arg("dshow")
                       .arg("-video_size").arg(format!("{}x{}", video_config.width, video_config.height))
                       .arg("-framerate").arg(video_config.framerate.to_string())
                       .arg("-i").arg(&format!("video={}", video_config.source_path));
                },
                "screen" => {
                    cmd.arg("-f").arg("gdigrab")
                       .arg("-framerate").arg(video_config.framerate.to_string())
                       .arg("-video_size").arg(format!("{}x{}", video_config.width, video_config.height))
                       .arg("-i").arg("desktop");
                },
                "rtsp" => {
                    cmd.arg("-rtsp_transport").arg("tcp")
                       .arg("-i").arg(&video_config.source_path);
                },
                "file" => {
                    cmd.arg("-i").arg(&video_config.source_path);
                },
                _ => return Err(format!("不支持的视频源类型: {}", video_config.source_type)),
            }

            // 音频输入（如果有）
            if let Some(audio_config) = audio_streams.get(idx) {
                match audio_config.source_type.as_str() {
                    "microphone" => {
                        cmd.arg("-f").arg("dshow")
                           .arg("-i").arg(&format!("audio={}", audio_config.source_path));
                    },
                    _ => {}
                }
            }

            // 编码器配置
            let encoder = video_config.hardware_accel.to_video_encoder();
            cmd.arg("-c:v").arg(encoder);

            // 根据编码器类型设置参数
            match video_config.hardware_accel {
                HardwareAcceleration::NVENC => {
                    cmd.arg("-preset").arg(self.map_preset_to_nvenc(&video_config.preset))
                       .arg("-b:v").arg(format!("{}k", video_config.bitrate));
                },
                HardwareAcceleration::QSV => {
                    cmd.arg("-preset").arg(&video_config.preset)
                       .arg("-b:v").arg(format!("{}k", video_config.bitrate));
                },
                HardwareAcceleration::AMF => {
                    cmd.arg("-quality").arg(self.map_preset_to_amf(&video_config.preset))
                       .arg("-b:v").arg(format!("{}k", video_config.bitrate));
                },
                _ => {
                    // CPU 编码使用 CRF
                    cmd.arg("-preset").arg(&video_config.preset)
                       .arg("-crf").arg(video_config.crf.to_string());
                }
            }

            cmd.arg("-pix_fmt").arg("yuv420p");

            // 音频编码
            if audio_streams.get(idx).is_some() {
                cmd.arg("-c:a").arg("aac").arg("-b:a").arg("128k");
            }

            cmd.arg("-y").arg(&output_path);

            println!("[多路编解码] 启动流 {} FFmpeg: {:?}", idx, cmd);

            // 启动进程
            let child = cmd.stdout(Stdio::null())
                          .stderr(Stdio::piped())
                          .spawn()
                          .map_err(|e| format!("启动 FFmpeg 失败: {}", e))?;

            process_ids.push(stream_session_id.clone());

            // 保存会话信息
            let session = MultiCodecSession {
                session_id: stream_session_id.clone(),
                session_type: "single_stream".to_string(),
                video_streams: vec![video_config.clone()],
                audio_streams: audio_streams.get(idx).cloned().into_iter().collect(),
                mix_layout: None,
                output_path: output_path.clone(),
                output_format: "mp4".to_string(),
                is_active: true,
                start_time: Some(std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs()),
                duration: 0,
                status: "recording".to_string(),
                error_message: None,
            };

            self.sessions.write().await.insert(stream_session_id.clone(), session);
            self.processes.write().await.insert(stream_session_id, child);
        }

        // 创建主会话记录
        let main_session = MultiCodecSession {
            session_id: session_id.clone(),
            session_type: "multi_record".to_string(),
            video_streams: video_streams.clone(),
            audio_streams: audio_streams.clone(),
            mix_layout: None,
            output_path: output_dir,
            output_format: "mp4".to_string(),
            is_active: true,
            start_time: Some(std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs()),
            duration: 0,
            status: "recording".to_string(),
            error_message: None,
        };

        self.sessions.write().await.insert(session_id.clone(), main_session);

        // 启动性能监控
        self.start_performance_monitor(session_id.clone(), app_handle.clone());

        Ok(session_id)
    }

    /// 开始混流录制（画中画/网格布局）
    pub async fn start_mix_recording(
        &self,
        app_handle: &AppHandle,
        session_id: String,
        video_streams: Vec<VideoStreamConfig>,
        audio_streams: Vec<AudioStreamConfig>,
        mix_layout: MixLayoutConfig,
        output_path: String,
    ) -> Result<String, String> {
        println!("[多路编解码] 开始混流录制: {}", session_id);

        let mut cmd = Command::new("ffmpeg"); cmd.no_window();

        // 添加所有视频输入
        for (_idx, video_config) in video_streams.iter().enumerate() {
            match video_config.source_type.as_str() {
                "camera" => {
                    cmd.arg("-f").arg("dshow")
                       .arg("-video_size").arg(format!("{}x{}", video_config.width, video_config.height))
                       .arg("-framerate").arg(video_config.framerate.to_string())
                       .arg("-i").arg(&format!("video={}", video_config.source_path));
                },
                "screen" => {
                    cmd.arg("-f").arg("gdigrab")
                       .arg("-framerate").arg(video_config.framerate.to_string())
                       .arg("-video_size").arg(format!("{}x{}", video_config.width, video_config.height))
                       .arg("-i").arg("desktop");
                },
                "rtsp" => {
                    cmd.arg("-rtsp_transport").arg("tcp")
                       .arg("-i").arg(&video_config.source_path);
                },
                _ => return Err(format!("不支持的视频源类型")),
            }
        }

        // 构建 filter_complex
        let filter_complex = self.build_mix_filter(&mix_layout, video_streams.len());
        cmd.arg("-filter_complex").arg(filter_complex);

        // 映射输出
        cmd.arg("-map").arg("[out]");

        // 编码器配置（使用主流的硬件加速设置）
        let main_stream = &video_streams[0];
        let encoder = main_stream.hardware_accel.to_video_encoder();
        cmd.arg("-c:v").arg(encoder);

        match main_stream.hardware_accel {
            HardwareAcceleration::NVENC => {
                cmd.arg("-preset").arg(self.map_preset_to_nvenc(&main_stream.preset))
                   .arg("-b:v").arg(format!("{}k", main_stream.bitrate));
            },
            _ => {
                cmd.arg("-preset").arg(&main_stream.preset)
                   .arg("-crf").arg(main_stream.crf.to_string());
            }
        }

        cmd.arg("-pix_fmt").arg("yuv420p");

        // 音频混合（如果有多个音频源）
        if !audio_streams.is_empty() {
            cmd.arg("-c:a").arg("aac").arg("-b:a").arg("128k");
        }

        cmd.arg("-y").arg(&output_path);

        println!("[多路编解码] 混流 FFmpeg 命令: {:?}", cmd);

        // 启动进程
        let child = cmd.stdout(Stdio::null())
                      .stderr(Stdio::piped())
                      .spawn()
                      .map_err(|e| format!("启动 FFmpeg 失败: {}", e))?;

        // 保存会话
        let session = MultiCodecSession {
            session_id: session_id.clone(),
            session_type: "mix_stream".to_string(),
            video_streams: video_streams.clone(),
            audio_streams: audio_streams.clone(),
            mix_layout: Some(mix_layout),
            output_path: output_path.clone(),
            output_format: "mp4".to_string(),
            is_active: true,
            start_time: Some(std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs()),
            duration: 0,
            status: "recording".to_string(),
            error_message: None,
        };

        self.sessions.write().await.insert(session_id.clone(), session);
        self.processes.write().await.insert(session_id.clone(), child);

        // 启动性能监控
        self.start_performance_monitor(session_id.clone(), app_handle.clone());

        Ok(session_id)
    }

    /// 构建混流滤镜图
    fn build_mix_filter(&self, layout: &MixLayoutConfig, stream_count: usize) -> String {
        match layout.layout_type.as_str() {
            "pip" => {
                // 画中画布局
                let main_idx = 0;
                let pip_idx = 1;
                
                if let Some(overlay) = layout.overlay_streams.get(0) {
                    format!(
                        "[{}:v]setpts=PTS-STARTPTS[main]; \
                         [{}:v]scale={}x{},setpts=PTS-STARTPTS[pip]; \
                         [main][pip]overlay={}:{}:enable='between(t,0,99999)'[out]",
                        main_idx,
                        pip_idx,
                        overlay.width,
                        overlay.height,
                        overlay.x,
                        overlay.y
                    )
                } else {
                    format!("[0:v]setpts=PTS-STARTPTS[out]")
                }
            },
            "grid" => {
                // 网格布局（例如 2×2）
                let rows = (stream_count as f32).sqrt().ceil() as u32;
                let cols = rows;
                
                let cell_width = layout.output_width / cols;
                let cell_height = layout.output_height / rows;
                
                let mut inputs = Vec::new();
                let mut scales = Vec::new();
                let mut overlays = Vec::new();
                
                for i in 0..stream_count {
                    let row = i as u32 / cols;
                    let col = i as u32 % cols;
                    
                    inputs.push(format!("[{}:v]", i));
                    scales.push(format!(
                        "[{}:v]scale={}:{}[s{}]",
                        i, cell_width, cell_height, i
                    ));
                    
                    if i == 0 {
                        overlays.push(format!("[s{}]copy[out]", i));
                    } else {
                        let x = col * cell_width;
                        let y = row * cell_height;
                        overlays.push(format!(
                            "[out][s{}]overlay={}:{}[out]",
                            i, x, y
                        ));
                    }
                }
                
                format!("{};{}", scales.join(";"), overlays.join(";"))
            },
            _ => {
                // 默认单路
                format!("[0:v]setpts=PTS-STARTPTS[out]")
            }
        }
    }

    /// 停止录制会话
    pub async fn stop_session(&self, session_id: &str) -> Result<(), String> {
        println!("[多路编解码] 停止会话: {}", session_id);

        // 如果是主会话，停止所有子流
        if let Some(session) = self.sessions.read().await.get(session_id) {
            if session.session_type == "multi_record" {
                // 查找并停止所有相关的子流
                let session_ids: Vec<String> = self.sessions.read().await.keys()
                    .filter(|id| id.starts_with(&format!("{}_", session_id)))
                    .cloned()
                    .collect();
                
                for sub_id in session_ids {
                    self.stop_single_session(&sub_id).await?;
                }
            }
        }

        self.stop_single_session(session_id).await
    }

    /// 停止单个会话
    async fn stop_single_session(&self, session_id: &str) -> Result<(), String> {
        // 终止 FFmpeg 进程
        if let Some(mut child) = self.processes.write().await.remove(session_id) {
            // Windows 下需要特殊处理
            #[cfg(windows)]
            {
                use winapi::um::processthreadsapi::TerminateProcess;
                use winapi::um::handleapi::CloseHandle;
                
                unsafe {
                    TerminateProcess(child.as_raw_handle() as *mut _, 0);
                    CloseHandle(child.as_raw_handle() as *mut _);
                }
            }
            
            #[cfg(not(windows))]
            {
                let _ = child.kill();
            }
            
            let _ = child.wait();
        }

        // 更新会话状态
        if let Some(session) = self.sessions.write().await.get_mut(session_id) {
            session.is_active = false;
            session.status = "stopped".to_string();
            
            if let Some(start_time) = session.start_time {
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs();
                session.duration = now - start_time;
            }
        }

        Ok(())
    }

    /// 暂停会话
    pub async fn pause_session(&self, session_id: &str) -> Result<(), String> {
        if let Some(session) = self.sessions.write().await.get_mut(session_id) {
            session.status = "paused".to_string();
            
            // 发送 SIGSTOP 信号（Unix）或使用其他方法暂停
            #[cfg(unix)]
            {
                if let Some(child) = self.processes.read().await.get(session_id) {
                    let pid = child.id() as i32;
                    unsafe {
                        libc::kill(pid, libc::SIGSTOP);
                    }
                }
            }
        }
        Ok(())
    }

    /// 恢复会话
    pub async fn resume_session(&self, session_id: &str) -> Result<(), String> {
        if let Some(session) = self.sessions.write().await.get_mut(session_id) {
            session.status = "recording".to_string();
            
            #[cfg(unix)]
            {
                if let Some(child) = self.processes.read().await.get(session_id) {
                    let pid = child.id() as i32;
                    unsafe {
                        libc::kill(pid, libc::SIGCONT);
                    }
                }
            }
        }
        Ok(())
    }

    /// 获取活动会话列表
    pub async fn get_active_sessions(&self) -> Vec<MultiCodecSession> {
        self.sessions.read().await.values()
            .filter(|s| s.is_active)
            .cloned()
            .collect()
    }

    /// 获取会话详情
    pub async fn get_session_info(&self, session_id: &str) -> Option<MultiCodecSession> {
        self.sessions.read().await.get(session_id).cloned()
    }

    /// 获取性能统计
    pub async fn get_performance_stats(&self, session_id: &str) -> Option<CodecPerformanceStats> {
        self.performance_stats.read().await.get(session_id).cloned()
    }

    /// 启动性能监控线程
    fn start_performance_monitor(&self, session_id: String, app_handle: AppHandle) {
        let sessions = self.sessions.clone();
        let stats_map = self.performance_stats.clone();
        
        thread::spawn(move || {
            loop {
                // 检查会话是否仍然活跃
                let is_active = {
                    if let Some(session) = sessions.blocking_read().get(&session_id) {
                        session.is_active && session.status == "recording"
                    } else {
                        false
                    }
                };

                if !is_active {
                    break;
                }

                // 收集性能数据（这里简化实现，实际应解析 FFmpeg stderr）
                let stats = CodecPerformanceStats {
                    session_id: session_id.clone(),
                    fps_current: 30.0, // 示例值
                    fps_average: 29.5,
                    cpu_usage_percent: 45.2,
                    gpu_usage_percent: Some(30.5),
                    dropped_frames: 0,
                    bitrate_actual: 2500,
                    buffer_health: 0.95,
                };

                stats_map.blocking_write().insert(session_id.clone(), stats.clone());

                // 发送事件到前端
                let _ = app_handle.emit("codec-performance-update", &stats);

                thread::sleep(Duration::from_secs(2));
            }
        });
    }

    /// 预设映射到 NVENC
    fn map_preset_to_nvenc(&self, preset: &str) -> &'static str {
        match preset {
            "ultrafast" => "p1",
            "fast" => "p2",
            "medium" => "p4",
            "slow" => "p6",
            _ => "p4",
        }
    }

    /// 预设映射到 AMF
    fn map_preset_to_amf(&self, preset: &str) -> &'static str {
        match preset {
            "ultrafast" => "speed",
            "fast" => "balanced",
            "medium" => "quality",
            "slow" => "quality",
            _ => "balanced",
        }
    }
}

// Tauri 命令
#[tauri::command]
pub async fn detect_hardware_acceleration(
    state: tauri::State<'_, MultiCodecManager>
) -> Result<HardwareCapabilities, String> {
    Ok(state.detect_hardware_acceleration())
}

#[tauri::command]
pub async fn start_multi_record(
    state: tauri::State<'_, MultiCodecManager>,
    app_handle: AppHandle,
    session_id: String,
    video_streams: Vec<VideoStreamConfig>,
    audio_streams: Vec<AudioStreamConfig>,
    output_dir: String,
) -> Result<String, String> {
    state.start_multi_record(&app_handle, session_id, video_streams, audio_streams, output_dir).await
}

#[tauri::command]
pub async fn start_mix_recording(
    state: tauri::State<'_, MultiCodecManager>,
    app_handle: AppHandle,
    session_id: String,
    video_streams: Vec<VideoStreamConfig>,
    audio_streams: Vec<AudioStreamConfig>,
    mix_layout: MixLayoutConfig,
    output_path: String,
) -> Result<String, String> {
    state.start_mix_recording(&app_handle, session_id, video_streams, audio_streams, mix_layout, output_path).await
}

#[tauri::command]
pub async fn stop_codec_session(
    state: tauri::State<'_, MultiCodecManager>,
    session_id: String,
) -> Result<(), String> {
    state.stop_session(&session_id).await
}

#[tauri::command]
pub async fn pause_codec_session(
    state: tauri::State<'_, MultiCodecManager>,
    session_id: String,
) -> Result<(), String> {
    state.pause_session(&session_id).await
}

#[tauri::command]
pub async fn resume_codec_session(
    state: tauri::State<'_, MultiCodecManager>,
    session_id: String,
) -> Result<(), String> {
    state.resume_session(&session_id).await
}

#[tauri::command]
pub async fn get_active_codec_sessions(
    state: tauri::State<'_, MultiCodecManager>,
) -> Result<Vec<MultiCodecSession>, String> {
    Ok(state.get_active_sessions().await)
}

#[tauri::command]
pub async fn get_codec_session_info(
    state: tauri::State<'_, MultiCodecManager>,
    session_id: String,
) -> Result<Option<MultiCodecSession>, String> {
    Ok(state.get_session_info(&session_id).await)
}

#[tauri::command]
pub async fn get_codec_performance(
    state: tauri::State<'_, MultiCodecManager>,
    session_id: String,
) -> Result<Option<CodecPerformanceStats>, String> {
    Ok(state.get_performance_stats(&session_id).await)
}
