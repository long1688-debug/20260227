use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::process::Command;
use tokio::sync::Mutex as AsyncMutex;
use uuid::Uuid;

/// RTSP 流会话状态
#[derive(Debug, Clone)]
pub struct RtspSession {
    pub id: String,
    pub rtsp_url: String,
    pub output_path: String,
    pub http_port: u16,
    pub status: SessionStatus,
    pub start_time: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum SessionStatus {
    Starting,
    Running,
    Stopped,
}

/// RTSP 流管理器（线程安全）
pub struct RtspStreamManager {
    sessions: Arc<Mutex<HashMap<String, RtspSession>>>,
    processes: Arc<AsyncMutex<HashMap<String, tokio::process::Child>>>,
}

impl RtspStreamManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            processes: Arc::new(AsyncMutex::new(HashMap::new())),
        }
    }

    /// 启动 RTSP 转码服务
    pub async fn start_rtsp_stream(
        &self,
        rtsp_url: String,
        username: Option<String>,
        password: Option<String>,
    ) -> Result<(String, String), String> {
        let session_id = Uuid::new_v4().to_string();
        
        // 构建带认证的 RTSP URL
        let auth_url = if let (Some(user), Some(pass)) = (username, password) {
            rtsp_url.replace("rtsp://", &format!("rtsp://{}:{}@", user, pass))
        } else {
            rtsp_url.clone()
        };

        // 创建临时输出目录
        let temp_dir = std::env::temp_dir();
        let output_dir = temp_dir.join("tauri-rtsp-streams");
        std::fs::create_dir_all(&output_dir).map_err(|e| format!("创建目录失败: {}", e))?;

        // 方案 A: FFmpeg 转码为 MJPEG over HTTP（低延迟，浏览器原生支持）
        let http_port = self.find_available_port(8080).await?;
        let output_path = format!("http://127.0.0.1:{}/stream.mjpg", http_port);

        // 更新会话状态
        {
            let mut sessions = self.sessions.lock().unwrap();
            sessions.insert(session_id.clone(), RtspSession {
                id: session_id.clone(),
                rtsp_url: rtsp_url.clone(),
                output_path: output_path.clone(),
                http_port,
                status: SessionStatus::Starting,
                start_time: chrono::Utc::now(),
            });
        }

        // 启动 FFmpeg 进程
        let process = self.spawn_ffmpeg_mjpeg(&auth_url, http_port, &session_id).await?;

        // 保存进程句柄
        {
            let mut processes = self.processes.lock().await;
            processes.insert(session_id.clone(), process);
        }

        // 更新状态为运行中
        {
            let mut sessions = self.sessions.lock().unwrap();
            if let Some(session) = sessions.get_mut(&session_id) {
                session.status = SessionStatus::Running;
            }
        }

        println!("[RTSP] 流已启动: session={}, url={}", session_id, output_path);
        Ok((session_id, output_path))
    }

    /// 停止 RTSP 流
    pub async fn stop_rtsp_stream(&self, session_id: &str) -> Result<(), String> {
        {
            let mut processes = self.processes.lock().await;
            if let Some(mut child) = processes.remove(session_id) {
                // 跨平台终止进程
                #[cfg(windows)]
                {
                    // Windows: 使用 taskkill
                    let _ = std::process::Command::new("taskkill")
                        .args(&["/F", "/PID", &child.id().unwrap_or(0).to_string()])
                        .output();
                }
                
                #[cfg(not(windows))]
                {
                    child.kill().await.map_err(|e| format!("终止进程失败: {}", e))?;
                }
                
                let _ = child.wait().await;
            }
        }

        {
            let mut sessions = self.sessions.lock().unwrap();
            if let Some(session) = sessions.get_mut(session_id) {
                session.status = SessionStatus::Stopped;
            }
        }

        println!("[RTSP] 流已停止: session={}", session_id);
        Ok(())
    }

    /// 获取所有活跃会话
    pub fn get_active_sessions(&self) -> Vec<RtspSession> {
        let sessions = self.sessions.lock().unwrap();
        sessions.values()
            .filter(|s| s.status == SessionStatus::Running)
            .cloned()
            .collect()
    }

    /// 查找可用端口
    async fn find_available_port(&self, start_port: u16) -> Result<u16, String> {
        for port in start_port..start_port + 100 {
            if self.is_port_available(port).await {
                return Ok(port);
            }
        }
        Err("找不到可用端口".to_string())
    }

    async fn is_port_available(&self, port: u16) -> bool {
        tokio::net::TcpListener::bind(format!("127.0.0.1:{}", port))
            .await
            .is_ok()
    }

    /// 启动 FFmpeg MJPEG 流服务
    async fn spawn_ffmpeg_mjpeg(
        &self,
        rtsp_url: &str,
        http_port: u16,
        _session_id: &str,
    ) -> Result<tokio::process::Child, String> {
        let ffmpeg_path = which::which("ffmpeg").map_err(|_| {
            "FFmpeg 未安装，请先下载并添加到 PATH: https://ffmpeg.org/download.html".to_string()
        })?;

        println!("[RTSP] 使用 FFmpeg: {:?}", ffmpeg_path);

        let mut cmd = Command::new(ffmpeg_path);
        cmd.args(&[
            "-rtsp_transport", "tcp",
            "-i", rtsp_url,
            "-c:v", "mjpeg",
            "-q:v", "5",
            "-r", "15",
            "-f", "mpjpeg",
            "-content_type", "multipart/x-mixed-replace;boundary=--ffmpeg",
            &format!("http://127.0.0.1:{}/stream.mjpg", http_port),
        ]);

        let child = cmd
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("启动 FFmpeg 失败: {}", e))?;

        println!("[RTSP] FFmpeg 进程已启动: PID={:?}", child.id());
        Ok(child)
    }
}

impl Clone for RtspStreamManager {
    fn clone(&self) -> Self {
        Self {
            sessions: self.sessions.clone(),
            processes: self.processes.clone(),
        }
    }
}
