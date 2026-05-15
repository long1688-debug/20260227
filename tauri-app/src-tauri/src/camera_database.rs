use rusqlite::{Connection, OptionalExtension, Result, params};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tokio::time::{interval, Duration};
use tauri::AppHandle;
use tauri::Manager;

/// 网络摄像机配置
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NetworkCameraConfig {
    pub id: String,
    pub name: String,
    pub protocol: String, // "rtsp" or "onvif"
    pub stream_url: String,
    pub onvif_url: Option<String>,
    pub need_auth: bool,
    pub username: Option<String>,
    pub password: Option<String>,
    pub resolution: Option<String>,
    pub status: String, // "online", "offline", "unknown"
    pub created_at: String,
    pub updated_at: String,
}

/// 数据库管理器
pub struct CameraDatabase {
    conn: Mutex<Connection>,
}

impl CameraDatabase {
    /// 创建或打开数据库
    pub fn new(db_path: Option<PathBuf>) -> Result<Self> {
        let path = db_path.unwrap_or_else(|| {
            // 默认路径：应用数据目录/cameras.db
            let app_dir = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
            app_dir.join("training-teaching-system").join("cameras.db")
        });

        // 确保目录存在
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).ok();
        }

        println!("[CameraDatabase] 数据库路径: {:?}", path);

        let conn = Connection::open(&path)?;

        // 创建表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS network_cameras (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                protocol TEXT NOT NULL,
                stream_url TEXT NOT NULL,
                onvif_url TEXT,
                need_auth BOOLEAN NOT NULL DEFAULT 0,
                username TEXT,
                password TEXT,
                resolution TEXT,
                status TEXT NOT NULL DEFAULT 'unknown',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )?;

        // 创建索引
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_camera_status ON network_cameras(status)",
            [],
        )?;

        Ok(CameraDatabase {
            conn: Mutex::new(conn),
        })
    }

    /// 保存摄像机配置
    pub fn save_camera(&self, camera: &NetworkCameraConfig) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "INSERT OR REPLACE INTO network_cameras
             (id, name, protocol, stream_url, onvif_url, need_auth, username, password, resolution, status, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                &camera.id,
                &camera.name,
                &camera.protocol,
                &camera.stream_url,
                &camera.onvif_url.as_ref().unwrap_or(&String::new()),
                &(if camera.need_auth { 1 } else { 0 }),
                &camera.username.as_ref().unwrap_or(&String::new()),
                &camera.password.as_ref().unwrap_or(&String::new()),
                &camera.resolution.as_ref().unwrap_or(&String::new()),
                &camera.status,
                &camera.created_at,
                &camera.updated_at,
            ],
        )?;

        Ok(())
    }

    /// 获取所有摄像机配置
    pub fn get_all_cameras(&self) -> Result<Vec<NetworkCameraConfig>> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, name, protocol, stream_url, onvif_url, need_auth, username, password, resolution, status, created_at, updated_at
             FROM network_cameras ORDER BY created_at DESC"
        )?;

        let cameras = stmt.query_map([], |row| {
            Ok(NetworkCameraConfig {
                id: row.get(0)?,
                name: row.get(1)?,
                protocol: row.get(2)?,
                stream_url: row.get(3)?,
                onvif_url: row.get(4)?,
                need_auth: row.get::<_, i32>(5)? != 0,
                username: row.get(6)?,
                password: row.get(7)?,
                resolution: row.get(8)?,
                status: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })?;

        let mut result = Vec::new();
        for camera in cameras {
            result.push(camera?);
        }

        Ok(result)
    }

    /// 根据ID获取摄像机配置
    pub fn get_camera_by_id(&self, id: &str) -> Result<Option<NetworkCameraConfig>> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, name, protocol, stream_url, onvif_url, need_auth, username, password, resolution, status, created_at, updated_at
             FROM network_cameras WHERE id = ?1"
        )?;

        let camera = stmt
            .query_row([id], |row| {
                Ok(NetworkCameraConfig {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    protocol: row.get(2)?,
                    stream_url: row.get(3)?,
                    onvif_url: row.get(4)?,
                    need_auth: row.get::<_, i32>(5)? != 0,
                    username: row.get(6)?,
                    password: row.get(7)?,
                    resolution: row.get(8)?,
                    status: row.get(9)?,
                    created_at: row.get(10)?,
                    updated_at: row.get(11)?,
                })
            })
            .optional()?;

        Ok(camera)
    }

    /// 删除摄像机配置
    pub fn delete_camera(&self, id: &str) -> Result<usize> {
        let conn = self.conn.lock().unwrap();

        let rows_affected = conn.execute("DELETE FROM network_cameras WHERE id = ?1", params![id])?;

        Ok(rows_affected)
    }

    /// 更新摄像机状态
    pub fn update_camera_status(&self, id: &str, status: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "UPDATE network_cameras SET status = ?1, updated_at = ?2 WHERE id = ?3",
            params![status, &now, id],
        )?;

        Ok(())
    }

    /// 获取在线摄像机数量
    pub fn get_online_count(&self) -> Result<usize> {
        let conn = self.conn.lock().unwrap();

        let count: usize = conn.query_row(
            "SELECT COUNT(*) FROM network_cameras WHERE status = 'online'",
            [],
            |row| row.get(0),
        )?;

        Ok(count)
    }

    /// 获取离线摄像机数量
    pub fn get_offline_count(&self) -> Result<usize> {
        let conn = self.conn.lock().unwrap();

        let count: usize = conn.query_row(
            "SELECT COUNT(*) FROM network_cameras WHERE status = 'offline'",
            [],
            |row| row.get(0),
        )?;

        Ok(count)
    }
}

// 🎯 Tauri 命令

/// 初始化摄像机数据库
#[tauri::command]
pub fn init_camera_database(app_handle: AppHandle) -> Result<(), String> {
    let db = CameraDatabase::new(None).map_err(|e| format!("初始化数据库失败: {}", e))?;

    // 将数据库实例存储到 Tauri state 中
    app_handle.manage(db);

    println!("[CameraDatabase] ✅ 数据库初始化成功");
    Ok(())
}

/// 保存摄像机配置
#[tauri::command]
pub fn save_camera_config(
    app_handle: AppHandle,
    camera: NetworkCameraConfig,
) -> Result<(), String> {
    let db = app_handle.state::<CameraDatabase>();
    db.save_camera(&camera)
        .map_err(|e| format!("保存失败: {}", e))
}

/// 获取所有摄像机配置
#[tauri::command]
pub fn get_all_cameras(app_handle: AppHandle) -> Result<Vec<NetworkCameraConfig>, String> {
    let db = app_handle.state::<CameraDatabase>();
    db.get_all_cameras()
        .map_err(|e| format!("获取列表失败: {}", e))
}

/// 根据ID获取摄像机配置
#[tauri::command]
pub fn get_camera_by_id(
    app_handle: AppHandle,
    id: String,
) -> Result<Option<NetworkCameraConfig>, String> {
    let db = app_handle.state::<CameraDatabase>();
    db.get_camera_by_id(&id)
        .map_err(|e| format!("获取详情失败: {}", e))
}

/// 删除摄像机配置
#[tauri::command]
pub fn delete_camera_config(app_handle: AppHandle, id: String) -> Result<usize, String> {
    let db = app_handle.state::<CameraDatabase>();
    db.delete_camera(&id)
        .map_err(|e| format!("删除失败: {}", e))
}

/// 更新摄像机状态
#[tauri::command]
pub fn update_camera_status(
    app_handle: AppHandle,
    id: String,
    status: String,
) -> Result<(), String> {
    let db = app_handle.state::<CameraDatabase>();
    db.update_camera_status(&id, &status)
        .map_err(|e| format!("更新状态失败: {}", e))
}

/// 获取在线摄像机数量
#[tauri::command]
pub fn get_online_camera_count(app_handle: AppHandle) -> Result<usize, String> {
    let db = app_handle.state::<CameraDatabase>();
    db.get_online_count()
        .map_err(|e| format!("获取数量失败: {}", e))
}

/// 获取离线摄像机数量
#[tauri::command]
pub fn get_offline_camera_count(app_handle: AppHandle) -> Result<usize, String> {
    let db = app_handle.state::<CameraDatabase>();
    db.get_offline_count()
        .map_err(|e| format!("获取数量失败: {}", e))
}

// 🎯 状态监控服务

/// 启动摄像机状态监控服务
#[tauri::command]
pub async fn start_camera_status_monitor(
    app_handle: AppHandle,
    check_interval_secs: Option<u64>,
) -> Result<(), String> {
    let interval_secs = check_interval_secs.unwrap_or(30); // 默认30秒检查一次

    println!("[CameraMonitor] 🚀 启动状态监控服务，间隔: {}秒", interval_secs);

    let app_handle_clone = app_handle.clone();

    tokio::spawn(async move {
        let mut interval = interval(Duration::from_secs(interval_secs));

        loop {
            interval.tick().await;

            println!("[CameraMonitor] 🔍 开始检查摄像机状态...");

            match check_all_cameras_status(&app_handle_clone).await {
                Ok(results) => {
                    println!("[CameraMonitor] ✅ 状态检查完成，共检查 {} 个摄像机", results.len());
                    for (id, status) in &results {
                        println!("[CameraMonitor]   - {}: {}", id, status);
                    }
                }
                Err(e) => {
                    eprintln!("[CameraMonitor] ❌ 状态检查失败: {}", e);
                }
            }
        }
    });

    Ok(())
}

/// 检查所有摄像机的状态
async fn check_all_cameras_status(app_handle: &AppHandle) -> Result<Vec<(String, String)>, String> {
    let db = app_handle.state::<CameraDatabase>();
    let cameras = db.get_all_cameras().map_err(|e| format!("获取摄像机列表失败: {}", e))?;

    let mut results = Vec::new();

    for camera in cameras {
        let status = check_single_camera_status(&camera).await;

        // 更新数据库中的状态
        if status != camera.status {
            db.update_camera_status(&camera.id, &status)
                .map_err(|e| format!("更新状态失败: {}", e))?;

            println!("[CameraMonitor] 🔄 {} 状态变更: {} -> {}", camera.name, camera.status, status);
        }

        results.push((camera.id, status));
    }

    Ok(results)
}

/// 检查单个摄像机的状态
async fn check_single_camera_status(camera: &NetworkCameraConfig) -> String {
    // 使用 TCP 连接测试来检查 RTSP/ONVIF 服务器是否可达
    let url = if camera.protocol == "onvif" && camera.onvif_url.is_some() {
        camera.onvif_url.as_ref().unwrap()
    } else {
        &camera.stream_url
    };

    // 提取主机和端口
    let (host, port) = match extract_host_port(url) {
        Some(hp) => hp,
        None => return "offline".to_string(),
    };

    // 尝试 TCP 连接
    match tokio::time::timeout(
        Duration::from_secs(3),
        tokio::net::TcpStream::connect(format!("{}:{}", host, port))
    ).await {
        Ok(Ok(_stream)) => {
            // 连接成功，标记为在线
            "online".to_string()
        }
        Ok(Err(_)) => {
            // 连接失败，标记为离线
            "offline".to_string()
        }
        Err(_) => {
            // 超时，标记为离线
            "offline".to_string()
        }
    }
}

/// 从 URL 中提取主机和端口
fn extract_host_port(url: &str) -> Option<(String, u16)> {
    // 支持 rtsp://, http://, https:// 等协议
    let url_without_protocol = if let Some(pos) = url.find("://") {
        &url[pos + 3..]
    } else {
        url
    };

    // 移除路径部分
    let host_port = if let Some(pos) = url_without_protocol.find('/') {
        &url_without_protocol[..pos]
    } else {
        url_without_protocol
    };

    // 解析主机和端口
    if let Some(colon_pos) = host_port.rfind(':') {
        let host = &host_port[..colon_pos];
        let port_str = &host_port[colon_pos + 1..];
        if let Ok(port) = port_str.parse::<u16>() {
            Some((host.to_string(), port))
        } else {
            None
        }
    } else {
        // 没有指定端口，使用默认端口
        let default_port = if url.starts_with("rtsp://") {
            554
        } else if url.starts_with("http://") {
            80
        } else if url.starts_with("https://") {
            443
        } else {
            554  // 默认 RTSP 端口
        };
        Some((host_port.to_string(), default_port))
    }
}
