use crate::proc_util::NoWindow;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use serde::{Deserialize, Serialize};
use std::thread;
use std::time::Duration;
#[cfg(windows)]
use std::os::windows::io::AsRawHandle;

/// 录制会话状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingSession {
    pub session_id: String,
    pub recording_type: String, // "canvas" 或 "preview"
    pub source_index: Option<u32>,
    pub source_name: String,
    pub output_path: String,
    pub format: String, // "mp4" 或 "mkv"
    pub is_recording: bool,
    pub is_paused: bool,
    pub start_time: Option<u64>,
    pub duration: u64, // 秒
    pub multi_camera_config: Option<MultiCameraConfig>, // 多机位配置（可选）
}

/// RTMP推流配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RtmpStreamConfig {
    pub enabled: bool,
    pub rtmp_url: String, // RTMP服务器地址，如 "rtmp://live.twitch.tv/app/stream_key"
    pub stream_key: String, // 推流密钥
    pub bitrate: u32, // 推流码率 (kbps)
    pub resolution: String, // 推流分辨率
    pub frame_rate: u32, // 推流帧率
}

/// VR/360°视频配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VrConfig {
    pub enabled: bool,
    pub projection: String, // "equirectangular" (等距柱状投影) 或 "cubemap"
    pub fov: u32, // 视野角度 (通常360)
    pub stereo_mode: String, // "mono" (单目) 或 "stereo" (立体)
    pub input_type: String, // "dual_fisheye", "single_fisheye", "panoramic"
}

/// 录制配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingConfig {
    pub output_format: String,
    pub resolution: String,
    pub frame_rate: u32,
    pub video_bitrate: u32,
    pub audio_enabled: bool,
    pub audio_channels: Vec<AudioChannelConfig>,
    pub encoder: String, // "h264", "h264_nvenc", "h264_qsv", "h264_amf"
    pub preset: String,  // "ultrafast", "fast", "medium", "slow"
    pub crf: u32,        // 0-51, 质量因子
    pub watermark: Option<WatermarkConfig>, // 可选的水印配置
    pub chromakey: Option<ChromaKeyConfig>, // 可选的绿幕配置
    pub rtmp_stream: Option<RtmpStreamConfig>, // 可选的RTMP推流配置
    pub vr_config: Option<VrConfig>, // 可选的VR/360°配置
}

/// 音频通道配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioChannelConfig {
    pub channel_id: String,
    pub device_name: String,
    pub volume: f32,
    pub muted: bool,
    pub enabled: bool,
}

/// 水印配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatermarkConfig {
    pub text: String,
    pub position: String,
    pub font_size: u32,
    pub color: String,
}

/// 绿幕配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChromaKeyConfig {
    pub enabled: bool,
    pub color: String, // 绿幕颜色，如 "0x00FF00" (绿色)
    pub similarity: f32, // 相似度阈值 (0.0-1.0)，默认0.4
    pub blend: f32, // 混合度 (0.0-1.0)，默认0.1
    pub background_image: Option<String>, // 背景图片路径（可选）
}

/// 录制模板
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub config: RecordingConfig,
    pub created_at: u64,
    pub updated_at: u64,
}

/// 录制管理器 - 管理所有录制会话
pub struct RecordingManager {
    sessions: Arc<Mutex<Vec<RecordingSession>>>,
    ffmpeg_processes: Arc<Mutex<Vec<(String, Child)>>>, // (session_id, process)
    app_handle: Arc<Mutex<Option<AppHandle>>>,
    preview_frames: Arc<Mutex<Vec<PreviewFrame>>>, // 最新的预览帧
}

/// 预览帧数据
#[derive(Debug, Clone, Serialize)]
pub struct PreviewFrame {
    pub session_id: String,
    pub frame_data: String, // base64编码的JPEG
    pub timestamp: u64,
    pub width: u32,
    pub height: u32,
}

/// 多机位配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiCameraConfig {
    pub cameras: Vec<CameraSource>,
    pub active_camera_index: usize, // 当前激活的摄像头索引
    pub switch_mode: String, // "manual" 或 "auto"
    pub auto_switch_interval: u64, // 自动切换间隔（秒）
}

/// 摄像头源
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CameraSource {
    pub id: String,
    pub name: String,
    pub device_path: String,
    pub resolution: String,
    pub frame_rate: u32,
    pub is_active: bool,
}

impl RecordingManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(Vec::new())),
            ffmpeg_processes: Arc::new(Mutex::new(Vec::new())),
            app_handle: Arc::new(Mutex::new(None)),
            preview_frames: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// 设置应用句柄（用于发送事件）
    pub fn set_app_handle(&self, handle: AppHandle) {
        *self.app_handle.lock().unwrap() = Some(handle);
    }

    /// 获取指定会话的最新预览帧
    pub fn get_latest_preview_frame(&self, session_id: &str) -> Option<PreviewFrame> {
        let frames = self.preview_frames.lock().unwrap();
        frames.iter()
            .filter(|f| f.session_id == session_id)
            .last()
            .cloned()
    }

    /// 清除已停止会话的预览帧
    pub fn cleanup_preview_frames(&self, session_id: &str) {
        let mut frames = self.preview_frames.lock().unwrap();
        frames.retain(|f| f.session_id != session_id);
    }

    /// 切换活动摄像头（多机位录制）
    pub fn switch_active_camera(
        &self,
        session_id: &str,
        camera_index: usize,
    ) -> Result<(), String> {
        println!("[录制] 切换摄像头: session={}, camera_index={}", session_id, camera_index);
        
        // 查找对应的录制会话
        let mut sessions = self.sessions.lock().unwrap();
        let session = sessions.iter_mut()
            .find(|s| s.session_id == session_id)
            .ok_or_else(|| format!("未找到录制会话: {}", session_id))?;
        
        // 更新活动摄像头索引
        if let Some(ref mut config) = session.multi_camera_config {
            if camera_index >= config.cameras.len() {
                return Err(format!("摄像头索引超出范围: {}", camera_index));
            }
            
            // 更新所有摄像头的激活状态
            for (i, cam) in config.cameras.iter_mut().enumerate() {
                cam.is_active = i == camera_index;
            }
            config.active_camera_index = camera_index;
            
            // TODO: 在实际录制中，这里需要重新配置FFmpeg输入源
            // 由于FFmpeg进程已经在运行，需要通过信号或其他方式通知其切换输入
            
            println!("[录制] 已切换到摄像头 {}: {}", camera_index, config.cameras[camera_index].name);
            Ok(())
        } else {
            Err("该会话未配置多机位".to_string())
        }
    }

    /// 开始多机位录制
    pub fn start_multicam_recording(
        &self,
        _app_handle: &AppHandle,
        session_id: String,
        config: MultiCameraConfig,
        recording_config: RecordingConfig,
    ) -> Result<String, String> {
        println!("[录制] 开始多机位录制: {:?}", session_id);
        
        let output_path = self.generate_output_path(&recording_config.output_format, "multicam");
        
        // 构建FFmpeg命令，使用多个输入源
        let mut cmd = Command::new(crate::bin_resolver::ffmpeg()); cmd.no_window();
        
        // 为每个摄像头添加输入
        for (_i, camera) in config.cameras.iter().enumerate() {
            cmd.arg("-f").arg("dshow")
               .arg("-video_size").arg(&camera.resolution)
               .arg("-framerate").arg(camera.frame_rate.to_string())
               .arg("-i").arg(&format!("video={}", camera.device_path));
        }
        
        // 使用concat滤镜合并多个视频流
        let filter_inputs: Vec<String> = (0..config.cameras.len())
            .map(|i| format!("[{}:v]", i))
            .collect();
        
        let filter_complex = format!(
            "{}concat=n={}:v=1:a=0[out]",
            filter_inputs.join(""),
            config.cameras.len()
        );
        
        cmd.arg("-filter_complex").arg(filter_complex)
           .arg("-map").arg("[out]");
        
        // 编码器配置
        match recording_config.encoder.as_str() {
            "h264_nvenc" => {
                cmd.arg("-c:v").arg("h264_nvenc")
                   .arg("-preset").arg(self.map_preset_to_nvenc(&recording_config.preset));
            },
            _ => {
                cmd.arg("-c:v").arg("libx264")
                   .arg("-preset").arg(&recording_config.preset)
                   .arg("-crf").arg(recording_config.crf.to_string());
            }
        }
        
        cmd.arg("-pix_fmt").arg("yuv420p")
           .arg("-y")
           .arg(&output_path);
        
        println!("[录制] 多机位FFmpeg命令: {:?}", cmd);
        
        // 启动FFmpeg进程
        let child = cmd.stdout(Stdio::null())
                     .stderr(Stdio::piped())
                     .spawn()
                     .map_err(|e| format!("启动FFmpeg失败: {}", e))?;
        
        // 保存会话信息
        let session = RecordingSession {
            session_id: session_id.clone(),
            recording_type: "multicam".to_string(),
            source_index: None,
            source_name: format!("Multi-Camera ({})", config.cameras.len()),
            output_path: output_path.clone(),
            format: recording_config.output_format.clone(),
            is_recording: true,
            is_paused: false,
            start_time: Some(std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs()),
            duration: 0,
            multi_camera_config: Some(config),
        };
        
        self.sessions.lock().unwrap().push(session);
        self.ffmpeg_processes.lock().unwrap().push((session_id.clone(), child));
        
        // 启动进度监控线程
        self.start_progress_monitor(session_id);
        
        Ok(output_path)
    }

    /// 启动进度监控线程
    fn start_progress_monitor(&self, session_id: String) {
        let sessions = Arc::clone(&self.sessions);
        let app_handle = Arc::clone(&self.app_handle);
        
        thread::spawn(move || {
            loop {
                // 检查会话是否仍在录制
                let is_recording = {
                    let sessions_guard = sessions.lock().unwrap();
                    if let Some(session) = sessions_guard.iter().find(|s| s.session_id == session_id) {
                        session.is_recording && !session.is_paused
                    } else {
                        false
                    }
                };

                if !is_recording {
                    break;
                }

                // 计算当前时长和文件大小
                if let Some(app) = app_handle.lock().unwrap().as_ref() {
                    let sessions_guard = sessions.lock().unwrap();
                    if let Some(session) = sessions_guard.iter().find(|s| s.session_id == session_id) {
                        if let Some(start_time) = session.start_time {
                            let now = std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap()
                                .as_secs();
                            let duration = now - start_time;
                            
                            // 获取文件大小
                            let file_size = std::fs::metadata(&session.output_path)
                                .map(|m| m.len())
                                .unwrap_or(0);

                            // 发送进度事件到前端
                            let _ = app.emit("recording-progress", serde_json::json!({
                                "session_id": session_id,
                                "duration": duration,
                                "file_size": file_size,
                                "is_paused": session.is_paused
                            }));
                        }
                    }
                }

                // 每秒更新一次
                thread::sleep(Duration::from_secs(1));
            }
        });
    }

    /// 开始画布录制（捕获屏幕区域）
    pub fn start_canvas_recording(
        &self,
        _app_handle: &AppHandle,
        session_id: String,
        x: i32,
        y: i32,
        width: u32,
        height: u32,
        config: RecordingConfig,
    ) -> Result<String, String> {
        println!("[录制] 开始画布录制: {:?}", session_id);
        println!("[录制] 编码器: {}, 预设: {}, CRF: {}", config.encoder, config.preset, config.crf);

        let output_path = self.generate_output_path(&config.output_format, "canvas");
        
        // 构建FFmpeg命令 - 使用gdigrab捕获屏幕
        let mut cmd = Command::new(crate::bin_resolver::ffmpeg()); cmd.no_window();
        
        // Windows屏幕捕获
        cmd.arg("-f")
           .arg("gdigrab")
           .arg("-framerate")
           .arg(config.frame_rate.to_string())
           .arg("-offset_x")
           .arg(x.to_string())
           .arg("-offset_y")
           .arg(y.to_string())
           .arg("-video_size")
           .arg(format!("{}x{}", width, height))
           .arg("-i")
           .arg("desktop");

        // 音频输入（如果启用）
        if config.audio_enabled && !config.audio_channels.is_empty() {
            // TODO: 添加音频输入参数
            cmd.arg("-f").arg("dshow").arg("-i").arg("audio=虚拟音频设备");
        }

        // 输出配置 - 根据编码器选择
        match config.encoder.as_str() {
            "h264_nvenc" => {
                // NVIDIA GPU 硬件加速
                cmd.arg("-c:v").arg("h264_nvenc")
                   .arg("-preset")
                   .arg(self.map_preset_to_nvenc(&config.preset));
            },
            "h264_qsv" => {
                // Intel QuickSync 硬件加速
                cmd.arg("-c:v").arg("h264_qsv")
                   .arg("-preset")
                   .arg(&config.preset);
            },
            "h264_amf" => {
                // AMD AMF 硬件加速
                cmd.arg("-c:v").arg("h264_amf")
                   .arg("-quality")
                   .arg(self.map_preset_to_amf(&config.preset));
            },
            _ => {
                // CPU 软件编码 (默认)
                cmd.arg("-c:v")
                   .arg("libx264")
                   .arg("-preset")
                   .arg(&config.preset)
                   .arg("-crf")
                   .arg(config.crf.to_string());
            }
        }

        cmd.arg("-pix_fmt").arg("yuv420p");

        // 添加绿幕抠像（如果配置了）
        if let Some(chromakey) = &config.chromakey {
            if chromakey.enabled {
                self.add_chromakey_filter(&mut cmd, chromakey);
            }
        }

        // 添加水印（如果配置了）
        if let Some(watermark) = &config.watermark {
            self.add_watermark_to_cmd(
                &mut cmd,
                &watermark.text,
                &watermark.position,
                watermark.font_size,
                &watermark.color
            );
        }

        if config.audio_enabled {
            cmd.arg("-c:a").arg("aac").arg("-b:a").arg("128k");
        }

        cmd.arg("-y") // 覆盖已存在文件
           .arg(&output_path);

        println!("[录制] FFmpeg命令: {:?}", cmd);

        // 启动FFmpeg进程
        let child = cmd.stdout(Stdio::null())
                     .stderr(Stdio::piped())
                     .spawn()
                     .map_err(|e| format!("启动FFmpeg失败: {}", e))?;

        // 保存会话信息
        let session = RecordingSession {
            session_id: session_id.clone(),
            recording_type: "canvas".to_string(),
            source_index: None,
            source_name: "Canvas".to_string(),
            output_path: output_path.clone(),
            format: config.output_format.clone(),
            is_recording: true,
            is_paused: false,
            start_time: Some(std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs()),
            duration: 0,
            multi_camera_config: None,
        };

        self.sessions.lock().unwrap().push(session);
        self.ffmpeg_processes.lock().unwrap().push((session_id.clone(), child));

        // 启动进度监控线程
        self.start_progress_monitor(session_id);

        Ok(output_path)
    }

    /// 开始预览录制（捕获视频元素流）
    pub fn start_preview_recording(
        &self,
        _app_handle: &AppHandle,
        session_id: String,
        video_stream_url: String, // RTSP/RTMP流地址
        config: RecordingConfig,
    ) -> Result<String, String> {
        println!("[录制] 开始预览录制: {:?}", session_id);

        let output_path = self.generate_output_path(&config.output_format, "preview");
        
        // 构建FFmpeg命令 - 从网络流录制
        let mut cmd = Command::new(crate::bin_resolver::ffmpeg()); cmd.no_window();
        
        cmd.arg("-i")
           .arg(&video_stream_url)
           .arg("-c:v")
           .arg("libx264")
           .arg("-preset")
           .arg("fast")
           .arg("-crf")
           .arg("23")
           .arg("-pix_fmt")
           .arg("yuv420p");

        if config.audio_enabled {
            cmd.arg("-c:a").arg("aac").arg("-b:a").arg("128k");
        }

        cmd.arg("-y")
           .arg(&output_path);

        // 启动FFmpeg进程
        let child = cmd.stdout(Stdio::null())
                     .stderr(Stdio::piped())
                     .spawn()
                     .map_err(|e| format!("启动FFmpeg失败: {}", e))?;

        // 保存会话信息
        let session = RecordingSession {
            session_id: session_id.clone(),
            recording_type: "preview".to_string(),
            source_index: None,
            source_name: "Preview".to_string(),
            output_path: output_path.clone(),
            format: config.output_format.clone(),
            is_recording: true,
            is_paused: false,
            start_time: Some(std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs()),
            duration: 0,
            multi_camera_config: None,
        };

        self.sessions.lock().unwrap().push(session);
        self.ffmpeg_processes.lock().unwrap().push((session_id.clone(), child));

        // 启动进度监控线程
        self.start_progress_monitor(session_id);

        Ok(output_path)
    }

    /// 开始画中画录制（主画面+小窗口）
    pub fn start_pip_recording(
        &self,
        _app_handle: &AppHandle,
        session_id: String,
        main_x: i32,
        main_y: i32,
        main_width: u32,
        main_height: u32,
        pip_x: i32,
        pip_y: i32,
        pip_width: u32,
        pip_height: u32,
        config: RecordingConfig,
    ) -> Result<String, String> {
        println!("[录制] 开始画中画录制: {:?}", session_id);

        let output_path = self.generate_output_path(&config.output_format, "pip");
        
        // 使用FFmpeg的overlay滤镜实现画中画
        let mut cmd = Command::new(crate::bin_resolver::ffmpeg()); cmd.no_window();
        
        // 主画面输入
        cmd.arg("-f").arg("gdigrab")
           .arg("-framerate").arg(config.frame_rate.to_string())
           .arg("-offset_x").arg(main_x.to_string())
           .arg("-offset_y").arg(main_y.to_string())
           .arg("-video_size").arg(format!("{}x{}", main_width, main_height))
           .arg("-i").arg("desktop");
        
        // PiP画面输入（第二个桌面捕获，通过裁剪实现）
        cmd.arg("-f").arg("gdigrab")
           .arg("-framerate").arg(config.frame_rate.to_string())
           .arg("-offset_x").arg(pip_x.to_string())
           .arg("-offset_y").arg(pip_y.to_string())
           .arg("-video_size").arg(format!("{}x{}", pip_width, pip_height))
           .arg("-i").arg("desktop");

        // 音频输入
        if config.audio_enabled && !config.audio_channels.is_empty() {
            cmd.arg("-f").arg("dshow").arg("-i").arg("audio=虚拟音频设备");
        }

        // 使用complex filtergraph实现画中画
        let filter_complex = format!(
            "[0:v]setpts=PTS-STARTPTS[main]; \
             [1:v]scale={}x{}[pip]; \
             [main][pip]overlay={}:{}[out]",
            pip_width, pip_height,
            main_width as i32 - pip_width as i32 - 10, // 右上角
            10
        );

        cmd.arg("-filter_complex").arg(filter_complex)
           .arg("-map").arg("[out]");

        // 编码器配置
        match config.encoder.as_str() {
            "h264_nvenc" => {
                cmd.arg("-c:v").arg("h264_nvenc")
                   .arg("-preset").arg(self.map_preset_to_nvenc(&config.preset));
            },
            "h264_qsv" => {
                cmd.arg("-c:v").arg("h264_qsv")
                   .arg("-preset").arg(&config.preset);
            },
            "h264_amf" => {
                cmd.arg("-c:v").arg("h264_amf")
                   .arg("-quality").arg(self.map_preset_to_amf(&config.preset));
            },
            _ => {
                cmd.arg("-c:v").arg("libx264")
                   .arg("-preset").arg(&config.preset)
                   .arg("-crf").arg(config.crf.to_string());
            }
        }

        cmd.arg("-pix_fmt").arg("yuv420p");

        if config.audio_enabled {
            cmd.arg("-c:a").arg("aac").arg("-b:a").arg("128k");
        }

        cmd.arg("-y").arg(&output_path);

        println!("[录制] PiP FFmpeg命令: {:?}", cmd);

        // 启动FFmpeg进程
        let child = cmd.stdout(Stdio::null())
                     .stderr(Stdio::piped())
                     .spawn()
                     .map_err(|e| format!("启动FFmpeg失败: {}", e))?;

        // 保存会话信息
        let session = RecordingSession {
            session_id: session_id.clone(),
            recording_type: "pip".to_string(),
            source_index: None,
            source_name: "Picture-in-Picture".to_string(),
            output_path: output_path.clone(),
            format: config.output_format.clone(),
            is_recording: true,
            is_paused: false,
            start_time: Some(std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs()),
            duration: 0,
            multi_camera_config: None,
        };

        self.sessions.lock().unwrap().push(session);
        self.ffmpeg_processes.lock().unwrap().push((session_id.clone(), child));

        // 启动进度监控线程
        self.start_progress_monitor(session_id);

        Ok(output_path)
    }

    /// 开始RTMP推流
    pub fn start_rtmp_streaming(
        &self,
        _app_handle: &AppHandle,
        session_id: String,
        source_x: i32,
        source_y: i32,
        source_width: u32,
        source_height: u32,
        config: RecordingConfig,
    ) -> Result<String, String> {
        println!("[录制] 开始RTMP推流: {:?}", session_id);
        
        if let Some(ref rtmp_config) = config.rtmp_stream {
            if !rtmp_config.enabled {
                return Err("RTMP推流未启用".to_string());
            }
            
            let mut cmd = Command::new(crate::bin_resolver::ffmpeg()); cmd.no_window();
            
            // 屏幕捕获输入
            cmd.arg("-f").arg("gdigrab")
               .arg("-framerate").arg(rtmp_config.frame_rate.to_string())
               .arg("-offset_x").arg(source_x.to_string())
               .arg("-offset_y").arg(source_y.to_string())
               .arg("-video_size").arg(format!("{}x{}", source_width, source_height))
               .arg("-i").arg("desktop");
            
            // 音频输入（如果启用）
            if config.audio_enabled {
                cmd.arg("-f").arg("dshow").arg("-i").arg("audio=虚拟音频设备");
            }
            
            // 编码器配置 - 推流需要使用恒定码率
            match config.encoder.as_str() {
                "h264_nvenc" => {
                    cmd.arg("-c:v").arg("h264_nvenc")
                       .arg("-b:v").arg(format!("{}k", rtmp_config.bitrate))
                       .arg("-maxrate").arg(format!("{}k", rtmp_config.bitrate))
                       .arg("-bufsize").arg(format!("{}k", rtmp_config.bitrate * 2));
                },
                _ => {
                    cmd.arg("-c:v").arg("libx264")
                       .arg("-preset").arg("veryfast")
                       .arg("-b:v").arg(format!("{}k", rtmp_config.bitrate))
                       .arg("-maxrate").arg(format!("{}k", rtmp_config.bitrate))
                       .arg("-bufsize").arg(format!("{}k", rtmp_config.bitrate * 2));
                }
            }
            
            // 音频编码
            if config.audio_enabled {
                cmd.arg("-c:a").arg("aac")
                   .arg("-b:a").arg("128k")
                   .arg("-ar").arg("44100");
            }
            
            // 输出到RTMP服务器
            let rtmp_url = format!("{}/{}", rtmp_config.rtmp_url, rtmp_config.stream_key);
            cmd.arg("-f").arg("flv")
               .arg(&rtmp_url);
            
            println!("[录制] RTMP推流命令: {:?}", cmd);
            
            // 启动FFmpeg进程
            let child = cmd.stdout(Stdio::null())
                         .stderr(Stdio::piped())
                         .spawn()
                         .map_err(|e| format!("启动FFmpeg推流失败: {}", e))?;
            
            // 保存会话信息
            let session = RecordingSession {
                session_id: session_id.clone(),
                recording_type: "rtmp_stream".to_string(),
                source_index: None,
                source_name: format!("RTMP Stream to {}", rtmp_config.rtmp_url),
                output_path: rtmp_url.clone(),
                format: "flv".to_string(),
                is_recording: true,
                is_paused: false,
                start_time: Some(std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs()),
                duration: 0,
                multi_camera_config: None,
            };
            
            self.sessions.lock().unwrap().push(session);
            self.ffmpeg_processes.lock().unwrap().push((session_id.clone(), child));
            
            println!("[录制] RTMP推流已启动: {}", rtmp_url);
            Ok(rtmp_url)
        } else {
            Err("未配置RTMP推流参数".to_string())
        }
    }

    /// 开始VR/360°视频录制
    pub fn start_vr_recording(
        &self,
        _app_handle: &AppHandle,
        session_id: String,
        camera_device: String,
        config: RecordingConfig,
    ) -> Result<String, String> {
        println!("[录制] 开始VR/360°视频录制: {:?}", session_id);
        
        if let Some(ref vr_config) = config.vr_config {
            if !vr_config.enabled {
                return Err("VR录制未启用".to_string());
            }
            
            let output_path = self.generate_output_path(&config.output_format, "vr360");
            let mut cmd = Command::new(crate::bin_resolver::ffmpeg()); cmd.no_window();
            
            // 根据输入类型配置不同的输入
            match vr_config.input_type.as_str() {
                "dual_fisheye" => {
                    // 双 fisheye 镜头输入（如Insta360）
                    cmd.arg("-f").arg("dshow")
                       .arg("-video_size").arg(&config.resolution)
                       .arg("-framerate").arg(config.frame_rate.to_string())
                       .arg("-i").arg(&format!("video={}", camera_device));
                    
                    // 使用v360滤镜转换为等距柱状投影
                    let filter = format!(
                        "v360=input=dfisheye:output={}:ih_fov={}:iv_fov={}",
                        vr_config.projection,
                        vr_config.fov,
                        vr_config.fov
                    );
                    cmd.arg("-vf").arg(filter);
                },
                "single_fisheye" => {
                    // 单 fisheye 镜头
                    cmd.arg("-f").arg("dshow")
                       .arg("-video_size").arg(&config.resolution)
                       .arg("-framerate").arg(config.frame_rate.to_string())
                       .arg("-i").arg(&format!("video={}", camera_device));
                    
                    let filter = format!(
                        "v360=input=fisheye:output={}:h_fov={}:v_fov={}",
                        vr_config.projection,
                        vr_config.fov,
                        vr_config.fov
                    );
                    cmd.arg("-vf").arg(filter);
                },
                "panoramic" => {
                    // 已经是全景视频，直接录制
                    cmd.arg("-f").arg("dshow")
                       .arg("-video_size").arg(&config.resolution)
                       .arg("-framerate").arg(config.frame_rate.to_string())
                       .arg("-i").arg(&format!("video={}", camera_device));
                },
                _ => {
                    return Err(format!("不支持的VR输入类型: {}", vr_config.input_type));
                }
            }
            
            // 如果是立体模式，添加立体处理
            if vr_config.stereo_mode == "stereo" {
                // TODO: 添加立体视频处理滤镜
                println!("[录制] 立体模式暂未完全实现");
            }
            
            // 编码器配置
            match config.encoder.as_str() {
                "h264_nvenc" => {
                    cmd.arg("-c:v").arg("h264_nvenc")
                       .arg("-preset").arg(self.map_preset_to_nvenc(&config.preset));
                },
                _ => {
                    cmd.arg("-c:v").arg("libx264")
                       .arg("-preset").arg(&config.preset)
                       .arg("-crf").arg(config.crf.to_string());
                }
            }
            
            cmd.arg("-pix_fmt").arg("yuv420p");
            
            // 音频编码
            if config.audio_enabled {
                cmd.arg("-c:a").arg("aac").arg("-b:a").arg("128k");
            }
            
            // 添加VR元数据（用于播放器识别360°视频）
            cmd.arg("-metadata").arg("projection=equirectangular")
               .arg("-metadata:s:v:0").arg("stereo_mode=mono")
               .arg("-y")
               .arg(&output_path);
            
            println!("[录制] VR录制FFmpeg命令: {:?}", cmd);
            
            // 启动FFmpeg进程
            let child = cmd.stdout(Stdio::null())
                         .stderr(Stdio::piped())
                         .spawn()
                         .map_err(|e| format!("启动FFmpeg失败: {}", e))?;
            
            // 保存会话信息
            let session = RecordingSession {
                session_id: session_id.clone(),
                recording_type: "vr360".to_string(),
                source_index: None,
                source_name: format!("VR 360° ({})", vr_config.input_type),
                output_path: output_path.clone(),
                format: config.output_format.clone(),
                is_recording: true,
                is_paused: false,
                start_time: Some(std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs()),
                duration: 0,
                multi_camera_config: None,
            };
            
            self.sessions.lock().unwrap().push(session);
            self.ffmpeg_processes.lock().unwrap().push((session_id.clone(), child));
            
            // 启动进度监控线程
            self.start_progress_monitor(session_id);
            
            Ok(output_path)
        } else {
            Err("未配置VR参数".to_string())
        }
    }

    /// 暂停录制
    pub fn pause_recording(&self, session_id: &str) -> Result<(), String> {
        println!("[录制] 暂停录制: {}", session_id);
        
        let mut sessions = self.sessions.lock().unwrap();
        if let Some(session) = sessions.iter_mut().find(|s| s.session_id == session_id) {
            if session.is_recording && !session.is_paused {
                session.is_paused = true;
                // TODO: 发送SIGSTOP信号暂停FFmpeg进程
                Ok(())
            } else {
                Err("录制未运行或已暂停".to_string())
            }
        } else {
            Err("会话不存在".to_string())
        }
    }

    /// 恢复录制
    pub fn resume_recording(&self, session_id: &str) -> Result<(), String> {
        println!("[录制] 恢复录制: {}", session_id);
        
        let mut sessions = self.sessions.lock().unwrap();
        if let Some(session) = sessions.iter_mut().find(|s| s.session_id == session_id) {
            if session.is_recording && session.is_paused {
                session.is_paused = false;
                // TODO: 发送SIGCONT信号恢复FFmpeg进程
                Ok(())
            } else {
                Err("录制未暂停".to_string())
            }
        } else {
            Err("会话不存在".to_string())
        }
    }

    /// 停止录制
    pub fn stop_recording(&self, session_id: &str) -> Result<String, String> {
        println!("[录制] 停止录制: {}", session_id);
        
        // 查找并终止FFmpeg进程
        let mut processes = self.ffmpeg_processes.lock().unwrap();
        if let Some(pos) = processes.iter().position(|(id, _)| id == session_id) {
            let (_, child) = processes.remove(pos);
            
            // 优雅地终止FFmpeg进程
            #[cfg(windows)]
            {
                use winapi::um::processthreadsapi::TerminateProcess;
                use winapi::um::handleapi::CloseHandle;
                
                unsafe {
                    let handle = child.as_raw_handle() as *mut winapi::ctypes::c_void;
                    TerminateProcess(handle as *mut winapi::ctypes::c_void, 0);
                    CloseHandle(handle);
                }
            }
            
            #[cfg(unix)]
            {
                use nix::sys::signal::{kill, Signal};
                use nix::unistd::Pid;
                kill(Pid::from_raw(child.id() as i32), Signal::SIGTERM).ok();
            }
            
            // 等待进程结束
            let _ = child.wait_with_output();
        }

        // 更新会话状态
        let mut sessions = self.sessions.lock().unwrap();
        if let Some(session) = sessions.iter_mut().find(|s| s.session_id == session_id) {
            session.is_recording = false;
            session.is_paused = false;
            
            // 计算时长
            if let Some(start_time) = session.start_time {
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs();
                session.duration = now - start_time;
            }
            
            Ok(session.output_path.clone())
        } else {
            Err("会话不存在".to_string())
        }
    }

    /// 停止RTMP推流
    pub fn stop_rtmp_streaming(&self, session_id: &str) -> Result<(), String> {
        println!("[录制] 停止RTMP推流: {}", session_id);
        self.stop_recording(session_id)?;
        Ok(())
    }

    /// 获取所有活跃会话
    pub fn get_active_sessions(&self) -> Vec<RecordingSession> {
        self.sessions.lock().unwrap()
            .iter()
            .filter(|s| s.is_recording)
            .cloned()
            .collect()
    }

    /// 生成输出文件路径
    fn generate_output_path(&self, format: &str, prefix: &str) -> String {
        let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
        let app_data_dir = std::env::var("APPDATA")
            .unwrap_or_else(|_| dirs::data_dir().unwrap_or_else(std::env::temp_dir).to_string_lossy().into_owned());
        
        let recordings_dir = format!("{}\\training-teaching-system\\recordings", app_data_dir);
        
        // 确保目录存在
        std::fs::create_dir_all(&recordings_dir).ok();
        
        format!("{}\\{}_{}.{}", recordings_dir, prefix, timestamp, format)
    }

    /// 构建带水印的FFmpeg命令
    fn add_watermark_to_cmd(
        &self,
        cmd: &mut Command,
        watermark_text: &str,
        position: &str, // "top-left", "top-right", "bottom-left", "bottom-right"
        font_size: u32,
        color: &str,
    ) {
        // 计算位置
        let (x, y) = match position {
            "top-left" => ("10", "10"),
            "top-right" => ("W-text_w-10", "10"),
            "bottom-left" => ("10", "H-text_h-10"),
            "bottom-right" => ("W-text_w-10", "H-text_h-10"),
            _ => ("10", "10"),
        };

        // 添加drawtext滤镜
        let filter = format!(
            "drawtext=text='{}':x={}:y={}:fontsize={}:fontcolor={}",
            watermark_text.replace("'", "\\'"),
            x, y, font_size, color
        );

        cmd.arg("-vf").arg(filter);
    }

    /// 添加绿幕抠像滤镜
    fn add_chromakey_filter(&self, cmd: &mut Command, config: &ChromaKeyConfig) {
        let chromakey_filter = format!(
            "chromakey=color={}:similarity={}:blend={}",
            config.color,
            config.similarity,
            config.blend
        );
        
        if let Some(ref bg_image) = config.background_image {
            // 如果有背景图片，使用overlay合并
            let filter_complex = format!(
                "[0:v]{}[ckout];[1:v][ckout]overlay=0:0[out]",
                chromakey_filter
            );
            
            // 添加背景图片输入
            cmd.arg("-i").arg(bg_image);
            cmd.arg("-filter_complex").arg(filter_complex);
            cmd.arg("-map").arg("[out]");
        } else {
            // 无背景，直接输出透明通道
            cmd.arg("-vf").arg(chromakey_filter);
        }
        
        println!("[录制] 应用绿幕滤镜: {:?}", config);
    }

    /// 构建带字幕的FFmpeg命令
    fn add_subtitle_to_cmd(
        &self,
        cmd: &mut Command,
        subtitle_file: &str,
    ) {
        // 添加字幕滤镜
        cmd.arg("-vf").arg(format!("subtitles='{}'", subtitle_file));
    }

    /// 映射预设到NVENC格式
    fn map_preset_to_nvenc(&self, preset: &str) -> &str {
        match preset {
            "ultrafast" => "llhp",  // Low Latency High Performance
            "fast" => "llhq",       // Low Latency High Quality
            "medium" => "mq",       // Medium Quality
            "slow" => "hq",         // High Quality
            _ => "mq"
        }
    }

    /// 映射预设到AMF格式
    fn map_preset_to_amf(&self, preset: &str) -> &str {
        match preset {
            "ultrafast" => "speed",
            "fast" => "balanced",
            "medium" => "quality",
            "slow" => "quality",
            _ => "quality"
        }
    }

    /// 保存录制模板
    pub fn save_template(&self, template: RecordingTemplate) -> Result<(), String> {
        let app_data_dir = std::env::var("APPDATA")
            .unwrap_or_else(|_| dirs::data_dir().unwrap_or_else(std::env::temp_dir).to_string_lossy().into_owned());
        
        let templates_dir = format!("{}\\training-teaching-system\\recording-templates", app_data_dir);
        std::fs::create_dir_all(&templates_dir).map_err(|e| format!("创建目录失败: {}", e))?;
        
        let template_path = format!("{}\\{}.json", templates_dir, template.id);
        let json = serde_json::to_string_pretty(&template)
            .map_err(|e| format!("序列化失败: {}", e))?;
        
        std::fs::write(&template_path, json)
            .map_err(|e| format!("写入文件失败: {}", e))?;
        
        println!("[录制] 模板已保存: {}", template.name);
        Ok(())
    }

    /// 加载所有录制模板
    pub fn load_templates(&self) -> Result<Vec<RecordingTemplate>, String> {
        let app_data_dir = std::env::var("APPDATA")
            .unwrap_or_else(|_| dirs::data_dir().unwrap_or_else(std::env::temp_dir).to_string_lossy().into_owned());
        
        let templates_dir = format!("{}\\training-teaching-system\\recording-templates", app_data_dir);
        
        if !std::path::Path::new(&templates_dir).exists() {
            return Ok(Vec::new());
        }
        
        let mut templates = Vec::new();
        
        for entry in std::fs::read_dir(&templates_dir)
            .map_err(|e| format!("读取目录失败: {}", e))? 
        {
            let entry = entry.map_err(|e| format!("读取条目失败: {}", e))?;
            let path = entry.path();
            
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                let content = std::fs::read_to_string(&path)
                    .map_err(|e| format!("读取文件失败: {}", e))?;
                
                let template: RecordingTemplate = serde_json::from_str(&content)
                    .map_err(|e| format!("解析JSON失败: {}", e))?;
                
                templates.push(template);
            }
        }
        
        // 按创建时间排序（最新的在前）
        templates.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        
        Ok(templates)
    }

    /// 删除录制模板
    pub fn delete_template(&self, template_id: &str) -> Result<(), String> {
        let app_data_dir = std::env::var("APPDATA")
            .unwrap_or_else(|_| dirs::data_dir().unwrap_or_else(std::env::temp_dir).to_string_lossy().into_owned());
        
        let templates_dir = format!("{}\\training-teaching-system\\recording-templates", app_data_dir);
        let template_path = format!("{}\\{}.json", templates_dir, template_id);
        
        std::fs::remove_file(&template_path)
            .map_err(|e| format!("删除文件失败: {}", e))?;
        
        println!("[录制] 模板已删除: {}", template_id);
        Ok(())
    }
}

// Tauri命令

#[tauri::command(async)]
pub fn start_canvas_recording(
    app_handle: AppHandle,
    session_id: String,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    config: RecordingConfig,
) -> Result<String, String> {
    let state = app_handle.state::<RecordingManager>();
    state.start_canvas_recording(&app_handle, session_id, x, y, width, height, config)
}

#[tauri::command(async)]
pub fn start_preview_recording(
    app_handle: AppHandle,
    session_id: String,
    video_stream_url: String,
    config: RecordingConfig,
) -> Result<String, String> {
    let state = app_handle.state::<RecordingManager>();
    state.start_preview_recording(&app_handle, session_id, video_stream_url, config)
}

#[tauri::command(async)]
pub fn start_pip_recording(
    app_handle: AppHandle,
    session_id: String,
    main_x: i32,
    main_y: i32,
    main_width: u32,
    main_height: u32,
    pip_x: i32,
    pip_y: i32,
    pip_width: u32,
    pip_height: u32,
    config: RecordingConfig,
) -> Result<String, String> {
    let state = app_handle.state::<RecordingManager>();
    state.start_pip_recording(
        &app_handle,
        session_id,
        main_x, main_y, main_width, main_height,
        pip_x, pip_y, pip_width, pip_height,
        config
    )
}

#[tauri::command(async)]
pub fn pause_recording(app_handle: AppHandle, session_id: String) -> Result<(), String> {
    let state = app_handle.state::<RecordingManager>();
    state.pause_recording(&session_id)
}

#[tauri::command(async)]
pub fn resume_recording(app_handle: AppHandle, session_id: String) -> Result<(), String> {
    let state = app_handle.state::<RecordingManager>();
    state.resume_recording(&session_id)
}

#[tauri::command(async)]
pub fn stop_recording(app_handle: AppHandle, session_id: String) -> Result<String, String> {
    let state = app_handle.state::<RecordingManager>();
    state.stop_recording(&session_id)
}

#[tauri::command(async)]
pub fn get_latest_preview_frame(
    app_handle: AppHandle,
    session_id: String,
) -> Option<PreviewFrame> {
    let state = app_handle.state::<RecordingManager>();
    state.get_latest_preview_frame(&session_id)
}

#[tauri::command(async)]
pub fn cleanup_preview_frames(
    app_handle: AppHandle,
    session_id: String,
) {
    let state = app_handle.state::<RecordingManager>();
    state.cleanup_preview_frames(&session_id);
}

#[tauri::command(async)]
pub fn switch_active_camera(
    app_handle: AppHandle,
    session_id: String,
    camera_index: usize,
) -> Result<(), String> {
    let state = app_handle.state::<RecordingManager>();
    state.switch_active_camera(&session_id, camera_index)
}

#[tauri::command(async)]
pub fn start_multicam_recording(
    app_handle: AppHandle,
    session_id: String,
    config: MultiCameraConfig,
    recording_config: RecordingConfig,
) -> Result<String, String> {
    let state = app_handle.state::<RecordingManager>();
    state.start_multicam_recording(&app_handle, session_id, config, recording_config)
}

#[tauri::command(async)]
pub fn start_rtmp_streaming(
    app_handle: AppHandle,
    session_id: String,
    source_x: i32,
    source_y: i32,
    source_width: u32,
    source_height: u32,
    config: RecordingConfig,
) -> Result<String, String> {
    let state = app_handle.state::<RecordingManager>();
    state.start_rtmp_streaming(&app_handle, session_id, source_x, source_y, source_width, source_height, config)
}

#[tauri::command(async)]
pub fn stop_rtmp_streaming(
    app_handle: AppHandle,
    session_id: String,
) -> Result<(), String> {
    let state = app_handle.state::<RecordingManager>();
    state.stop_rtmp_streaming(&session_id)
}

#[tauri::command(async)]
pub fn start_vr_recording(
    app_handle: AppHandle,
    session_id: String,
    camera_device: String,
    config: RecordingConfig,
) -> Result<String, String> {
    let state = app_handle.state::<RecordingManager>();
    state.start_vr_recording(&app_handle, session_id, camera_device, config)
}

#[tauri::command(async)]
pub fn save_recording_template(
    app_handle: AppHandle,
    template: RecordingTemplate,
) -> Result<(), String> {
    let state = app_handle.state::<RecordingManager>();
    state.save_template(template)
}

#[tauri::command(async)]
pub fn load_recording_templates(
    app_handle: AppHandle,
) -> Result<Vec<RecordingTemplate>, String> {
    let state = app_handle.state::<RecordingManager>();
    state.load_templates()
}

#[tauri::command(async)]
pub fn delete_recording_template(
    app_handle: AppHandle,
    template_id: String,
) -> Result<(), String> {
    let state = app_handle.state::<RecordingManager>();
    state.delete_template(&template_id)
}

#[tauri::command(async)]
pub fn get_active_recordings(app_handle: AppHandle) -> Vec<RecordingSession> {
    let state = app_handle.state::<RecordingManager>();
    state.get_active_sessions()
}














































































