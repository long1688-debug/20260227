//! mpv 媒体播放器服务
//!
//! 提供基于 libmpv 的高性能视频播放能力
//! 支持 RTSP、RTMP、HTTP-FLV、HLS、HTTP 流等多种协议
//! 相比 FLV.js，mpv 提供更好的兼容性和更低的延迟（0.5~2秒）

#[cfg(feature = "mpv")]
mod imp {
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex};
    use std::time::Duration;

    use radiance_libmpv::{
        events::{Event, EventContext, PropertyData},
        Mpv,
    };
    use tauri::State;

    /// mpv播放器实例状态
    #[derive(Clone)]
    pub struct MpvPlayerState {
        players: Arc<Mutex<HashMap<String, Arc<Mutex<MpvInstance>>>>>,
    }

    impl Default for MpvPlayerState {
        fn default() -> Self {
            Self {
                players: Arc::new(Mutex::new(HashMap::new())),
            }
        }
    }

    /// 播放器统计信息
    #[derive(serde::Serialize)]
    pub struct PlayerStats {
        volume: f64,
        position: f64,
        duration: f64,
        fps: f64,
        buffer_duration: f64,
        stream_bitrate: f64,
        video_decoder: String,
        audio_decoder: String,
        codec: String,
        cache_used: f64,
    }

    /// mpv播放器实例封装
    struct MpvInstance {
        mpv: Mpv,
        stream_url: String,
        is_playing: bool,
        volume: f64,
        is_muted: bool,
        last_error: Option<String>,
    }

    impl MpvInstance {
        /// 创建新的 mpv 实例（低延迟模式）
        fn new(low_latency: bool) -> Result<Self, String> {
            let mpv = Mpv::new().map_err(|e| format!("创建mpv实例失败: {}", e))?;

            // 基础配置
            mpv.set_property("terminal", false).map_err(|e| format!("设置终端模式失败: {}", e))?;
            mpv.set_property("msg-level", "all=error").map_err(|e| format!("设置日志级别失败: {}", e))?;

            // 硬件加速
            mpv.set_property("hwdec", "auto").map_err(|e| format!("设置硬件加速失败: {}", e))?;

            if low_latency {
                // ========== 超低延迟配置 ==========
                // 禁用缓存
                mpv.set_property("cache", 0).map_err(|e| format!("设置缓存失败: {}", e))?;
                mpv.set_property("cache-file", false).map_err(|e| format!("设置缓存文件失败: {}", e))?;

                // 最小化网络缓存 (100ms)
                mpv.set_property("network-caching", 100)
                    .map_err(|e| format!("设置网络缓存失败: {}", e))?;

                // 最小化解码缓存
                mpv.set_property("demuxer-readahead-secs", 0.1)
                    .map_err(|e| format!("设置预读时间失败: {}", e))?;

                // 禁用音频缓冲
                mpv.set_property("audio-buffer", 0).map_err(|e| format!("设置音频缓冲失败: {}", e))?;

                // 实时模式
                mpv.set_property("realtime", true).map_err(|e| format!("设置实时模式失败: {}", e))?;

                // 禁用帧缓冲
                mpv.set_property("video-sync", "display-resample")
                    .map_err(|e| format!("设置视频同步失败: {}", e))?;

                // 快速启动
                mpv.set_property("start-fast", true).map_err(|e| format!("设置快速启动失败: {}", e))?;
            } else {
                // 标准延迟配置 (适合文件播放)
                mpv.set_property("network-caching", 500)
                    .map_err(|e| format!("设置网络缓存失败: {}", e))?;
            }

            // RTSP 传输协议设置（TCP更稳定）
            mpv.set_property("rtsp-transport", "tcp")
                .map_err(|e| format!("设置RTSP传输协议失败: {}", e))?;

            // 用户代理
            mpv.set_property("user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)")
                .map_err(|e| format!("设置用户代理失败: {}", e))?;

            // TLS 配置
            mpv.set_property("tls-verify", false).map_err(|e| format!("设置TLS验证失败: {}", e))?;

            Ok(Self {
                mpv,
                stream_url: String::new(),
                is_playing: false,
                volume: 100.0,
                is_muted: false,
                last_error: None,
            })
        }

        /// 播放任意流（自动识别协议）
        fn play_stream(&mut self, url: &str) -> Result<(), String> {
            // 停止当前播放
            if self.is_playing {
                self.stop();
            }

            self.stream_url = url.to_string();
            self.last_error = None;

            // 根据URL自动选择最佳配置
            self.optimize_for_stream(url);

            // 使用 loadfile 命令播放
            let result = self.mpv.command("loadfile", &[url, "play"]);

            match result {
                Ok(_) => {
                    self.is_playing = true;
                    Ok(())
                }
                Err(e) => {
                    let error_msg = format!("播放失败: {}", e);
                    self.last_error = Some(error_msg.clone());
                    Err(error_msg)
                }
            }
        }

        /// 根据流类型优化配置
        fn optimize_for_stream(&mut self, url: &str) {
            let url_lower = url.to_lowercase();

            if url_lower.starts_with("rtsp://") {
                // RTSP 流优化
                let _ = self.mpv.set_property("rtsp-transport", "tcp");
                let _ = self.mpv.set_property("network-caching", 150);
            } else if url_lower.starts_with("rtmp://") || url_lower.starts_with("rtmps://") {
                // RTMP 流优化
                let _ = self.mpv.set_property("network-caching", 200);
            } else if url_lower.ends_with(".flv") || url_lower.contains("/flv/") {
                // FLV 流优化
                let _ = self.mpv.set_property("network-caching", 150);
                let _ = self.mpv.set_property("demuxer", "flv");
            } else if url_lower.ends_with(".m3u8") || url_lower.contains("/hls/") {
                // HLS 流优化
                let _ = self.mpv.set_property("hls-segment-threads", 4);
                let _ = self.mpv.set_property("hls-use-mpegts", true);
                let _ = self.mpv.set_property("network-caching", 500);
            } else if url_lower.starts_with("http://") || url_lower.starts_with("https://") {
                // HTTP 流优化
                let _ = self.mpv.set_property("network-caching", 200);
            }
        }

        fn stop(&mut self) {
            let _ = self.mpv.command("stop", &[]);
            self.is_playing = false;
        }

        fn pause(&mut self) {
            let _ = self.mpv.set_property("pause", true);
            self.is_playing = false;
        }

        fn resume(&mut self) {
            let _ = self.mpv.set_property("pause", false);
            self.is_playing = true;
        }

        fn set_volume(&mut self, volume: f64) {
            self.volume = volume.clamp(0.0, 100.0);
            let _ = self.mpv.set_property("volume", self.volume);
        }

        fn get_volume(&self) -> f64 {
            self.volume
        }

        fn set_mute(&mut self, mute: bool) {
            self.is_muted = mute;
            let _ = self.mpv.set_property("mute", mute);
        }

        fn is_muted(&self) -> bool {
            self.is_muted
        }

        fn get_position(&self) -> Result<f64, String> {
            self.mpv
                .get_property("time-pos")
                .map_err(|e| format!("获取播放位置失败: {}", e))
        }

        fn get_duration(&self) -> Result<f64, String> {
            self.mpv
                .get_property("duration")
                .map_err(|e| format!("获取时长失败: {}", e))
        }

        fn seek(&mut self, position: f64) -> Result<(), String> {
            self.mpv
                .command("seek", &[&format!("{}", position), "absolute"])
                .map_err(|e| format!("seek失败: {}", e))
        }

        fn get_state(&self) -> Result<String, String> {
            self.mpv
                .get_property("playback-state")
                .map(|state: String| state)
                .map_err(|e| format!("获取播放状态失败: {}", e))
        }

        fn get_average_fps(&self) -> Result<f64, String> {
            self.mpv
                .get_property("fps")
                .map_err(|e| format!("获取帧率失败: {}", e))
        }

        fn get_buffer_usage(&self) -> Result<f64, String> {
            self.mpv
                .get_property("demuxer-cache-duration")
                .map_err(|e| format!("获取缓存时长失败: {}", e))
        }

        fn get_stream_bitrate(&self) -> Result<f64, String> {
            self.mpv
                .get_property("bitrate")
                .map_err(|e| format!("获取比特率失败: {}", e))
        }

        fn get_video_decoder(&self) -> Result<String, String> {
            self.mpv
                .get_property("video-decoder")
                .map(|decoder: String| decoder)
                .map_err(|e| format!("获取视频解码器失败: {}", e))
        }

        fn get_audio_decoder(&self) -> Result<String, String> {
            self.mpv
                .get_property("audio-decoder")
                .map(|decoder: String| decoder)
                .map_err(|e| format!("获取音频解码器失败: {}", e))
        }

        fn get_codec(&self) -> Result<String, String> {
            self.mpv
                .get_property("codec")
                .map(|codec: String| codec)
                .map_err(|e| format!("获取编解码器失败: {}", e))
        }

        fn get_cache_used(&self) -> Result<f64, String> {
            self.mpv
                .get_property("cache-used")
                .map_err(|e| format!("获取缓存使用量失败: {}", e))
        }

        fn get_stats(&self) -> PlayerStats {
            PlayerStats {
                volume: self.get_volume(),
                position: self.get_position().unwrap_or(0.0),
                duration: self.get_duration().unwrap_or(0.0),
                fps: self.get_average_fps().unwrap_or(0.0),
                buffer_duration: self.get_buffer_usage().unwrap_or(0.0),
                stream_bitrate: self.get_stream_bitrate().unwrap_or(0.0),
                video_decoder: self.get_video_decoder().unwrap_or_else(|_| "unknown".to_string()),
                audio_decoder: self.get_audio_decoder().unwrap_or_else(|_| "unknown".to_string()),
                codec: self.get_codec().unwrap_or_else(|_| "unknown".to_string()),
                cache_used: self.get_cache_used().unwrap_or(0.0),
            }
        }

        /// 截图
        fn screenshot(&self, path: &str) -> Result<(), String> {
            self.mpv
                .command("screenshot", &[path])
                .map_err(|e| format!("截图失败: {}", e))
        }

        /// 开始录制
        fn start_recording(&mut self, path: &str) -> Result<(), String> {
            self.mpv
                .command("recording-start", &[path])
                .map_err(|e| format!("开始录制失败: {}", e))
        }

        /// 停止录制
        fn stop_recording(&mut self) -> Result<(), String> {
            self.mpv
                .command("recording-stop", &[])
                .map_err(|e| format!("停止录制失败: {}", e))
        }
    }

    /// 创建mpv播放器实例
    #[tauri::command]
    pub async fn mpv_create_player(player_id: String, low_latency: Option<bool>, state: State<'_, MpvPlayerState>) -> Result<String, String> {
        let mut players = state.players.lock().map_err(|e| format!("获取播放器锁失败: {}", e))?;

        if players.contains_key(&player_id) {
            return Ok(format!("播放器 {} 已存在", player_id));
        }

        let instance = MpvInstance::new(low_latency.unwrap_or(true))?;
        players.insert(player_id.clone(), Arc::new(Mutex::new(instance)));

        Ok(format!("播放器 {} 创建成功 (低延迟模式: {})", player_id, low_latency.unwrap_or(true)))
    }

    /// 销毁mpv播放器实例
    #[tauri::command]
    pub async fn mpv_destroy_player(player_id: String, state: State<'_, MpvPlayerState>) -> Result<String, String> {
        let mut players = state.players.lock().map_err(|e| format!("获取播放器锁失败: {}", e))?;

        match players.remove(&player_id) {
            Some(_) => Ok(format!("播放器 {} 已销毁", player_id)),
            None => Err(format!("播放器 {} 不存在", player_id)),
        }
    }

    /// 播放任意流媒体（支持 RTSP、RTMP、FLV、HLS、HTTP 等）
    #[tauri::command]
    pub async fn mpv_play_stream(player_id: String, stream_url: String, state: State<'_, MpvPlayerState>) -> Result<String, String> {
        let players = state.players.lock().map_err(|e| format!("获取播放器锁失败: {}", e))?;

        let instance = players.get(&player_id).ok_or_else(|| format!("播放器 {} 不存在", player_id))?;

        let mut player = instance.lock().map_err(|e| format!("获取播放器实例锁失败: {}", e))?;

        player.play_stream(&stream_url)?;

        // 等待流开始播放
        std::thread::sleep(Duration::from_millis(300));

        // 检查播放状态
        let playback_state = player.get_state()?;
        if playback_state == "playing" || playback_state == "paused" {
            Ok(format!("流 {} 开始播放", stream_url))
        } else {
            Err(format!("流播放失败，当前状态: {}", playback_state))
        }
    }

    /// 播放RTSP流（保持向后兼容）
    #[tauri::command]
    pub async fn mpv_play_rtsp(player_id: String, rtsp_url: String, state: State<'_, MpvPlayerState>) -> Result<String, String> {
        mpv_play_stream(player_id, rtsp_url, state).await
    }

    /// 播放FLV流
    #[tauri::command]
    pub async fn mpv_play_flv(player_id: String, flv_url: String, state: State<'_, MpvPlayerState>) -> Result<String, String> {
        mpv_play_stream(player_id, flv_url, state).await
    }

    /// 播放HLS流
    #[tauri::command]
    pub async fn mpv_play_hls(player_id: String, hls_url: String, state: State<'_, MpvPlayerState>) -> Result<String, String> {
        mpv_play_stream(player_id, hls_url, state).await
    }

    /// 播放RTMP流
    #[tauri::command]
    pub async fn mpv_play_rtmp(player_id: String, rtmp_url: String, state: State<'_, MpvPlayerState>) -> Result<String, String> {
        mpv_play_stream(player_id, rtmp_url, state).await
    }

    /// 播放本地文件
    #[tauri::command]
    pub async fn mpv_play_file(player_id: String, file_path: String, state: State<'_, MpvPlayerState>) -> Result<String, String> {
        mpv_play_stream(player_id, file_path, state).await
    }

    /// 停止播放
    #[tauri::command]
    pub async fn mpv_stop(player_id: String, state: State<'_, MpvPlayerState>) -> Result<String, String> {
        let players = state.players.lock().map_err(|e| format!("获取播放器锁失败: {}", e))?;

        let instance = players.get(&player_id).ok_or_else(|| format!("播放器 {} 不存在", player_id))?;

        let mut player = instance.lock().map_err(|e| format!("获取播放器实例锁失败: {}", e))?;

        player.stop();

        Ok(format!("播放器 {} 已停止", player_id))
    }

    /// 暂停播放
    #[tauri::command]
    pub async fn mpv_pause(player_id: String, state: State<'_, MpvPlayerState>) -> Result<String, String> {
        let players = state.players.lock().map_err(|e| format!("获取播放器锁失败: {}", e))?;

        let instance = players.get(&player_id).ok_or_else(|| format!("播放器 {} 不存在", player_id))?;

        let mut player = instance.lock().map_err(|e| format!("获取播放器实例锁失败: {}", e))?;

        player.pause();

        Ok(format!("播放器 {} 已暂停", player_id))
    }

    /// 恢复播放
    #[tauri::command]
    pub async fn mpv_resume(player_id: String, state: State<'_, MpvPlayerState>) -> Result<String, String> {
        let players = state.players.lock().map_err(|e| format!("获取播放器锁失败: {}", e))?;

        let instance = players.get(&player_id).ok_or_else(|| format!("播放器 {} 不存在", player_id))?;

        let mut player = instance.lock().map_err(|e| format!("获取播放器实例锁失败: {}", e))?;

        player.resume();

        Ok(format!("播放器 {} 已恢复", player_id))
    }

    /// 设置音量
    #[tauri::command]
    pub async fn mpv_set_volume(player_id: String, volume: f64, state: State<'_, MpvPlayerState>) -> Result<String, String> {
        let players = state.players.lock().map_err(|e| format!("获取播放器锁失败: {}", e))?;

        let instance = players.get(&player_id).ok_or_else(|| format!("播放器 {} 不存在", player_id))?;

        let mut player = instance.lock().map_err(|e| format!("获取播放器实例锁失败: {}", e))?;

        player.set_volume(volume);

        Ok(format!("播放器 {} 音量已设置为 {}%", player_id, player.get_volume()))
    }

    /// 设置静音
    #[tauri::command]
    pub async fn mpv_set_mute(player_id: String, mute: bool, state: State<'_, MpvPlayerState>) -> Result<String, String> {
        let players = state.players.lock().map_err(|e| format!("获取播放器锁失败: {}", e))?;

        let instance = players.get(&player_id).ok_or_else(|| format!("播放器 {} 不存在", player_id))?;

        let mut player = instance.lock().map_err(|e| format!("获取播放器实例锁失败: {}", e))?;

        player.set_mute(mute);

        Ok(format!("播放器 {} 静音状态已设置为 {}", player_id, player.is_muted()))
    }

    /// 获取播放位置
    #[tauri::command]
    pub async fn mpv_get_position(player_id: String, state: State<'_, MpvPlayerState>) -> Result<f64, String> {
        let players = state.players.lock().map_err(|e| format!("获取播放器锁失败: {}", e))?;

        let instance = players.get(&player_id).ok_or_else(|| format!("播放器 {} 不存在", player_id))?;

        let player = instance.lock().map_err(|e| format!("获取播放器实例锁失败: {}", e))?;

        player.get_position()
    }

    /// 获取播放时长
    #[tauri::command]
    pub async fn mpv_get_duration(player_id: String, state: State<'_, MpvPlayerState>) -> Result<f64, String> {
        let players = state.players.lock().map_err(|e| format!("获取播放器锁失败: {}", e))?;

        let instance = players.get(&player_id).ok_or_else(|| format!("播放器 {} 不存在", player_id))?;

        let player = instance.lock().map_err(|e| format!("获取播放器实例锁失败: {}", e))?;

        player.get_duration()
    }

    /// 跳转到指定位置
    #[tauri::command]
    pub async fn mpv_seek(player_id: String, position: f64, state: State<'_, MpvPlayerState>) -> Result<String, String> {
        let players = state.players.lock().map_err(|e| format!("获取播放器锁失败: {}", e))?;

        let instance = players.get(&player_id).ok_or_else(|| format!("播放器 {} 不存在", player_id))?;

        let mut player = instance.lock().map_err(|e| format!("获取播放器实例锁失败: {}", e))?;

        player.seek(position)?;

        Ok(format!("播放器 {} 已跳转到 {} 秒", player_id, position))
    }

    /// 获取播放状态
    #[tauri::command]
    pub async fn mpv_get_state(player_id: String, state: State<'_, MpvPlayerState>) -> Result<String, String> {
        let players = state.players.lock().map_err(|e| format!("获取播放器锁失败: {}", e))?;

        let instance = players.get(&player_id).ok_or_else(|| format!("播放器 {} 不存在", player_id))?;

        let player = instance.lock().map_err(|e| format!("获取播放器实例锁失败: {}", e))?;

        player.get_state()
    }

    /// 获取详细播放统计信息
    #[tauri::command]
    pub async fn mpv_get_stats(player_id: String, state: State<'_, MpvPlayerState>) -> Result<serde_json::Value, String> {
        let players = state.players.lock().map_err(|e| format!("获取播放器锁失败: {}", e))?;

        let instance = players.get(&player_id).ok_or_else(|| format!("播放器 {} 不存在", player_id))?;

        let player = instance.lock().map_err(|e| format!("获取播放器实例锁失败: {}", e))?;

        let stats = player.get_stats();
        serde_json::to_value(&stats).map_err(|e| format!("序列化统计信息失败: {}", e))
    }

    /// 截图
    #[tauri::command]
    pub async fn mpv_screenshot(player_id: String, path: String, state: State<'_, MpvPlayerState>) -> Result<String, String> {
        let players = state.players.lock().map_err(|e| format!("获取播放器锁失败: {}", e))?;

        let instance = players.get(&player_id).ok_or_else(|| format!("播放器 {} 不存在", player_id))?;

        let player = instance.lock().map_err(|e| format!("获取播放器实例锁失败: {}", e))?;

        player.screenshot(&path)?;

        Ok(format!("截图已保存到 {}", path))
    }

    /// 开始录制
    #[tauri::command]
    pub async fn mpv_start_recording(player_id: String, path: String, state: State<'_, MpvPlayerState>) -> Result<String, String> {
        let players = state.players.lock().map_err(|e| format!("获取播放器锁失败: {}", e))?;

        let instance = players.get(&player_id).ok_or_else(|| format!("播放器 {} 不存在", player_id))?;

        let mut player = instance.lock().map_err(|e| format!("获取播放器实例锁失败: {}", e))?;

        player.start_recording(&path)?;

        Ok(format!("开始录制到 {}", path))
    }

    /// 停止录制
    #[tauri::command]
    pub async fn mpv_stop_recording(player_id: String, state: State<'_, MpvPlayerState>) -> Result<String, String> {
        let players = state.players.lock().map_err(|e| format!("获取播放器锁失败: {}", e))?;

        let instance = players.get(&player_id).ok_or_else(|| format!("播放器 {} 不存在", player_id))?;

        let mut player = instance.lock().map_err(|e| format!("获取播放器实例锁失败: {}", e))?;

        player.stop_recording()?;

        Ok(format!("录制已停止"))
    }

    /// 列出所有播放器实例
    #[tauri::command]
    pub async fn mpv_list_players(state: State<'_, MpvPlayerState>) -> Result<Vec<String>, String> {
        let players = state.players.lock().map_err(|e| format!("获取播放器锁失败: {}", e))?;

        let player_ids: Vec<String> = players.keys().cloned().collect();

        Ok(player_ids)
    }

    /// 检查mpv是否可用
    #[tauri::command]
    pub async fn mpv_is_available() -> Result<bool, String> {
        match Mpv::new() {
            Ok(_) => Ok(true),
            Err(e) => {
                eprintln!("mpv不可用: {}", e);
                Ok(false)
            }
        }
    }

    /// 获取支持的协议列表
    #[tauri::command]
    pub async fn mpv_get_supported_protocols() -> Result<Vec<String>, String> {
        Ok(vec![
            "RTSP".to_string(),
            "RTMP".to_string(),
            "RTMPS".to_string(),
            "HTTP-FLV".to_string(),
            "HLS (m3u8)".to_string(),
            "HTTP/HTTPS 流".to_string(),
            "本地文件".to_string(),
            "UDP 流".to_string(),
            "TCP 流".to_string(),
        ])
    }
}

#[cfg(not(feature = "mpv"))]
mod imp {
    use tauri::State;

    /// mpv播放器实例状态（无mpv支持时的空实现）
    #[derive(Clone, Default)]
    pub struct MpvPlayerState;

    #[tauri::command]
    pub async fn mpv_create_player(_player_id: String, _low_latency: Option<bool>, _state: State<'_, MpvPlayerState>) -> Result<String, String> {
        Err("mpv功能未启用".to_string())
    }

    #[tauri::command]
    pub async fn mpv_destroy_player(_player_id: String, _state: State<'_, MpvPlayerState>) -> Result<String, String> {
        Err("mpv功能未启用".to_string())
    }

    #[tauri::command]
    pub async fn mpv_play_stream(_player_id: String, _stream_url: String, _state: State<'_, MpvPlayerState>) -> Result<String, String> {
        Err("mpv功能未启用".to_string())
    }

    #[tauri::command]
    pub async fn mpv_play_rtsp(_player_id: String, _rtsp_url: String, _state: State<'_, MpvPlayerState>) -> Result<String, String> {
        Err("mpv功能未启用".to_string())
    }

    #[tauri::command]
    pub async fn mpv_play_flv(_player_id: String, _flv_url: String, _state: State<'_, MpvPlayerState>) -> Result<String, String> {
        Err("mpv功能未启用".to_string())
    }

    #[tauri::command]
    pub async fn mpv_play_hls(_player_id: String, _hls_url: String, _state: State<'_, MpvPlayerState>) -> Result<String, String> {
        Err("mpv功能未启用".to_string())
    }

    #[tauri::command]
    pub async fn mpv_play_rtmp(_player_id: String, _rtmp_url: String, _state: State<'_, MpvPlayerState>) -> Result<String, String> {
        Err("mpv功能未启用".to_string())
    }

    #[tauri::command]
    pub async fn mpv_play_file(_player_id: String, _file_path: String, _state: State<'_, MpvPlayerState>) -> Result<String, String> {
        Err("mpv功能未启用".to_string())
    }

    #[tauri::command]
    pub async fn mpv_stop(_player_id: String, _state: State<'_, MpvPlayerState>) -> Result<String, String> {
        Err("mpv功能未启用".to_string())
    }

    #[tauri::command]
    pub async fn mpv_pause(_player_id: String, _state: State<'_, MpvPlayerState>) -> Result<String, String> {
        Err("mpv功能未启用".to_string())
    }

    #[tauri::command]
    pub async fn mpv_resume(_player_id: String, _state: State<'_, MpvPlayerState>) -> Result<String, String> {
        Err("mpv功能未启用".to_string())
    }

    #[tauri::command]
    pub async fn mpv_set_volume(_player_id: String, _volume: f64, _state: State<'_, MpvPlayerState>) -> Result<String, String> {
        Err("mpv功能未启用".to_string())
    }

    #[tauri::command]
    pub async fn mpv_set_mute(_player_id: String, _mute: bool, _state: State<'_, MpvPlayerState>) -> Result<String, String> {
        Err("mpv功能未启用".to_string())
    }

    #[tauri::command]
    pub async fn mpv_get_position(_player_id: String, _state: State<'_, MpvPlayerState>) -> Result<f64, String> {
        Err("mpv功能未启用".to_string())
    }

    #[tauri::command]
    pub async fn mpv_get_duration(_player_id: String, _state: State<'_, MpvPlayerState>) -> Result<f64, String> {
        Err("mpv功能未启用".to_string())
    }

    #[tauri::command]
    pub async fn mpv_seek(_player_id: String, _position: f64, _state: State<'_, MpvPlayerState>) -> Result<String, String> {
        Err("mpv功能未启用".to_string())
    }

    #[tauri::command]
    pub async fn mpv_get_state(_player_id: String, _state: State<'_, MpvPlayerState>) -> Result<String, String> {
        Err("mpv功能未启用".to_string())
    }

    #[tauri::command]
    pub async fn mpv_get_stats(_player_id: String, _state: State<'_, MpvPlayerState>) -> Result<serde_json::Value, String> {
        Err("mpv功能未启用".to_string())
    }

    #[tauri::command]
    pub async fn mpv_screenshot(_player_id: String, _path: String, _state: State<'_, MpvPlayerState>) -> Result<String, String> {
        Err("mpv功能未启用".to_string())
    }

    #[tauri::command]
    pub async fn mpv_start_recording(_player_id: String, _path: String, _state: State<'_, MpvPlayerState>) -> Result<String, String> {
        Err("mpv功能未启用".to_string())
    }

    #[tauri::command]
    pub async fn mpv_stop_recording(_player_id: String, _state: State<'_, MpvPlayerState>) -> Result<String, String> {
        Err("mpv功能未启用".to_string())
    }

    #[tauri::command]
    pub async fn mpv_list_players(_state: State<'_, MpvPlayerState>) -> Result<Vec<String>, String> {
        Err("mpv功能未启用".to_string())
    }

    #[tauri::command]
    pub async fn mpv_is_available() -> Result<bool, String> {
        Ok(false)
    }

    #[tauri::command]
    pub async fn mpv_get_supported_protocols() -> Result<Vec<String>, String> {
        Err("mpv功能未启用".to_string())
    }
}

pub use imp::*;
