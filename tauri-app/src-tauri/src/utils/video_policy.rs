use std::fs;
use tauri::{AppHandle, Emitter, Manager};
use serde::{Deserialize, Serialize};
use chrono::Local;

/// 视频元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoMetadata {
    pub filename: String,
    pub source: String, // "ffmpeg", "mediarecorder", "canvas" 等
    pub duration_sec: f32,
    pub file_size_bytes: u64,
    pub created_at: String,
    pub context: String, // "preview" 或 "main"
}

/// 视频清理策略配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoCleanupPolicy {
    pub max_videos: usize,           // 最大保留视频数量
    pub max_age_days: u32,           // 最大保留天数
    pub max_total_size_mb: u64,      // 最大总大小(MB)
    pub auto_cleanup: bool,          // 是否自动清理
}

impl Default for VideoCleanupPolicy {
    fn default() -> Self {
        Self {
            max_videos: 100,
            max_age_days: 30,
            max_total_size_mb: 10240, // 10GB
            auto_cleanup: true,
        }
    }
}

/// 获取录制目录路径
#[tauri::command]
pub fn get_video_dir(app: AppHandle) -> Result<String, String> {
    let dir = app.path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("recordings");
    
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    
    dir.to_str()
        .ok_or_else(|| "Invalid path".to_string())
        .map(|s| s.to_string())
}

/// 完成视频录制并注册到策略引擎
#[tauri::command]
pub async fn finalize_video(
    app: AppHandle,
    filename: String,
    source: String,
    duration_sec: f32,
) -> Result<VideoMetadata, String> {
    let dir = app.path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("recordings");
    
    let file_path = dir.join(&filename);
    
    // 获取文件大小
    let file_size = fs::metadata(&file_path)
        .map_err(|e| format!("Failed to get file metadata: {}", e))?
        .len();
    
    // 创建元数据
    let metadata = VideoMetadata {
        filename: filename.clone(),
        source: source.clone(),
        duration_sec,
        file_size_bytes: file_size,
        created_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        context: if filename.starts_with("preview_") { 
            "preview".to_string() 
        } else { 
            "main".to_string() 
        },
    };
    
    // 保存元数据到索引文件
    save_video_index(&app, &metadata).await?;
    
    // 触发自动清理
    let state = app.state::<VideoPolicyState>();
    let policy = state.policy.lock().map_err(|e| e.to_string())?.clone();
    
    if policy.auto_cleanup {
        cleanup_old_videos(&app, &policy).await?;
    }
    
    // 发送事件通知前端
    let _ = app.emit("video_finalized", &metadata);
    
    Ok(metadata)
}

/// 保存视频索引
async fn save_video_index(app: &AppHandle, metadata: &VideoMetadata) -> Result<(), String> {
    let dir = app.path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("recordings");
    
    let index_path = dir.join("video_index.json");
    
    // 读取现有索引
    let mut videos: Vec<VideoMetadata> = if index_path.exists() {
        let content = fs::read_to_string(&index_path)
            .map_err(|e| format!("Failed to read index: {}", e))?;
        serde_json::from_str(&content)
            .unwrap_or_default()
    } else {
        Vec::new()
    };
    
    // 添加新视频
    videos.push(metadata.clone());
    
    // 保存索引
    let json = serde_json::to_string_pretty(&videos)
        .map_err(|e| format!("Failed to serialize index: {}", e))?;
    
    fs::write(&index_path, json)
        .map_err(|e| format!("Failed to write index: {}", e))?;
    
    Ok(())
}

/// 清理旧视频
async fn cleanup_old_videos(app: &AppHandle, policy: &VideoCleanupPolicy) -> Result<Vec<String>, String> {
    let dir = app.path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("recordings");
    
    let index_path = dir.join("video_index.json");
    
    if !index_path.exists() {
        return Ok(Vec::new());
    }
    
    // 读取索引
    let content = fs::read_to_string(&index_path)
        .map_err(|e| format!("Failed to read index: {}", e))?;
    let mut videos: Vec<VideoMetadata> = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse index: {}", e))?;
    
    let mut removed_files = Vec::new();
    let now = Local::now();
    
    // 按创建时间排序（旧的在前）
    videos.sort_by(|a, b| a.created_at.cmp(&b.created_at));
    
    // 1. 清理超过保留天数的视频
    videos.retain(|video| {
        let created = chrono::NaiveDateTime::parse_from_str(&video.created_at, "%Y-%m-%d %H:%M:%S")
            .unwrap_or(now.naive_local());
        let age_days = (now.naive_local() - created).num_days() as u32;
        
        if age_days > policy.max_age_days {
            let file_path = dir.join(&video.filename);
            if fs::remove_file(&file_path).is_ok() {
                removed_files.push(video.filename.clone());
            }
            false
        } else {
            true
        }
    });
    
    // 2. 如果数量超限，删除最旧的
    while videos.len() > policy.max_videos {
        if let Some(video) = videos.first() {
            let file_path = dir.join(&video.filename);
            if fs::remove_file(&file_path).is_ok() {
                removed_files.push(video.filename.clone());
            }
            videos.remove(0);
        } else {
            break;
        }
    }
    
    // 3. 如果总大小超限，删除最旧的
    let total_size: u64 = videos.iter().map(|v| v.file_size_bytes).sum();
    let max_size_bytes = policy.max_total_size_mb * 1024 * 1024;
    
    while total_size > max_size_bytes && !videos.is_empty() {
        if let Some(video) = videos.first() {
            let file_path = dir.join(&video.filename);
            if fs::remove_file(&file_path).is_ok() {
                removed_files.push(video.filename.clone());
            }
            videos.remove(0);
        } else {
            break;
        }
    }
    
    // 更新索引
    let json = serde_json::to_string_pretty(&videos)
        .map_err(|e| format!("Failed to serialize index: {}", e))?;
    fs::write(&index_path, json)
        .map_err(|e| format!("Failed to write index: {}", e))?;
    
    // 发送清理事件
    if !removed_files.is_empty() {
        let _ = app.emit("videos_cleaned", &removed_files);
    }
    
    Ok(removed_files)
}

/// 获取所有录制的视频列表
#[tauri::command]
pub async fn list_recorded_videos(app: AppHandle) -> Result<Vec<VideoMetadata>, String> {
    let dir = app.path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("recordings");
    
    let index_path = dir.join("video_index.json");
    
    if !index_path.exists() {
        return Ok(Vec::new());
    }
    
    let content = fs::read_to_string(&index_path)
        .map_err(|e| format!("Failed to read index: {}", e))?;
    
    let videos: Vec<VideoMetadata> = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse index: {}", e))?;
    
    Ok(videos)
}

/// 删除指定的录制视频
#[tauri::command]
pub async fn delete_recorded_video(app: AppHandle, filename: String) -> Result<(), String> {
    let dir = app.path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("recordings");
    
    let file_path = dir.join(&filename);
    
    // 删除文件
    fs::remove_file(&file_path)
        .map_err(|e| format!("Failed to delete file: {}", e))?;
    
    // 更新索引
    let index_path = dir.join("video_index.json");
    if index_path.exists() {
        let content = fs::read_to_string(&index_path)
            .map_err(|e| format!("Failed to read index: {}", e))?;
        let mut videos: Vec<VideoMetadata> = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse index: {}", e))?;
        
        videos.retain(|v| v.filename != filename);
        
        let json = serde_json::to_string_pretty(&videos)
            .map_err(|e| format!("Failed to serialize index: {}", e))?;
        fs::write(&index_path, json)
            .map_err(|e| format!("Failed to write index: {}", e))?;
    }
    
    Ok(())
}

/// 视频策略状态
pub struct VideoPolicyState {
    pub policy: std::sync::Mutex<VideoCleanupPolicy>,
}

impl VideoPolicyState {
    pub fn new() -> Self {
        Self {
            policy: std::sync::Mutex::new(VideoCleanupPolicy::default()),
        }
    }
}

/// 获取当前清理策略
#[tauri::command]
pub fn get_cleanup_policy(app: AppHandle) -> Result<VideoCleanupPolicy, String> {
    let state = app.state::<VideoPolicyState>();
    let policy = state.policy.lock().map_err(|e| e.to_string())?;
    Ok(policy.clone())
}

/// 更新清理策略
#[tauri::command]
pub fn set_cleanup_policy(
    app: AppHandle,
    max_videos: usize,
    max_age_days: u32,
    max_total_size_mb: u64,
    auto_cleanup: bool,
) -> Result<(), String> {
    let state = app.state::<VideoPolicyState>();
    let mut policy = state.policy.lock().map_err(|e| e.to_string())?;
    
    policy.max_videos = max_videos;
    policy.max_age_days = max_age_days;
    policy.max_total_size_mb = max_total_size_mb;
    policy.auto_cleanup = auto_cleanup;
    
    Ok(())
}
