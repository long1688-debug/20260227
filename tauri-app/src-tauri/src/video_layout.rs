// 视频布局管理模块 - Tauri 2.x 后端命令

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

/// 单元格数据传输对象
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CellDto {
    pub id: String,
    #[serde(rename = "x")]
    pub x: f64,
    #[serde(rename = "y")]
    pub y: f64,
    #[serde(rename = "width")]
    pub width: f64,
    #[serde(rename = "height")]
    pub height: f64,
    #[serde(rename = "stream_url")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream_url: Option<String>,
}

/// 布局数据载荷
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutPayload {
    pub index: u8,
    pub name: String,
    pub cells: Vec<CellDto>,
}

/// 布局配置文件
#[derive(Debug, Serialize, Deserialize)]
pub struct LayoutConfig {
    pub index: u8,
    pub name: String,
    pub cells: Vec<CellDto>,
    #[serde(rename = "timestamp")]
    pub timestamp: i64,
}

/// 获取布局配置目录
fn get_layout_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取应用数据目录失败: {}", e))?;

    let layout_dir = app_dir.join("layouts");

    if !layout_dir.exists() {
        fs::create_dir_all(&layout_dir)
            .map_err(|e| format!("创建布局目录失败: {}", e))?;
    }

    Ok(layout_dir)
}

/// 保存布局配置
#[tauri::command]
pub async fn save_layout(
    app_handle: AppHandle,
    payload: LayoutPayload,
) -> Result<String, String> {
    println!(
        "[Rust] 保存布局: {} (索引: {})",
        payload.name,
        payload.index
    );

    let layout_dir = get_layout_dir(&app_handle)?;

    let config = LayoutConfig {
        index: payload.index,
        name: payload.name,
        cells: payload.cells,
        timestamp: chrono::Utc::now().timestamp_millis(),
    };

    let file_path = layout_dir.join(format!("layout_{}.json", payload.index));

    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("序列化布局配置失败: {}", e))?;

    fs::write(&file_path, json)
        .map_err(|e| format!("写入布局文件失败: {}", e))?;

    println!("[Rust] 布局已保存到: {:?}", file_path);

    Ok("saved".to_string())
}

/// 加载布局配置
#[tauri::command]
pub async fn load_layout(
    app_handle: AppHandle,
    index: u8,
) -> Result<Vec<CellDto>, String> {
    println!("[Rust] 加载布局: 索引 {}", index);

    let layout_dir = get_layout_dir(&app_handle)?;
    let file_path = layout_dir.join(format!("layout_{}.json", index));

    if !file_path.exists() {
        println!("[Rust] 布局文件不存在: {:?}", file_path);
        return Ok(vec![]);
    }

    let json = fs::read_to_string(&file_path)
        .map_err(|e| format!("读取布局文件失败: {}", e))?;

    let config: LayoutConfig = serde_json::from_str(&json)
        .map_err(|e| format!("解析布局配置失败: {}", e))?;

    println!(
        "[Rust] 布局已加载: {} ({} 个单元格)",
        config.name,
        config.cells.len()
    );

    Ok(config.cells)
}

/// 获取所有已保存的布局列表
#[tauri::command]
pub async fn list_saved_layouts(
    app_handle: AppHandle,
) -> Result<Vec<LayoutConfig>, String> {
    let layout_dir = get_layout_dir(&app_handle)?;

    let mut layouts = Vec::new();

    if let Ok(entries) = fs::read_dir(&layout_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "json") {
                if let Ok(json) = fs::read_to_string(&path) {
                    if let Ok(config) = serde_json::from_str::<LayoutConfig>(&json) {
                        layouts.push(config);
                    }
                }
            }
        }
    }

    // 按索引排序
    layouts.sort_by(|a, b| a.index.cmp(&b.index));

    Ok(layouts)
}

/// 删除指定的布局配置
#[tauri::command]
pub async fn delete_layout(
    app_handle: AppHandle,
    index: u8,
) -> Result<String, String> {
    let layout_dir = get_layout_dir(&app_handle)?;
    let file_path = layout_dir.join(format!("layout_{}.json", index));

    if file_path.exists() {
        fs::remove_file(&file_path)
            .map_err(|e| format!("删除布局文件失败: {}", e))?;
        println!("[Rust] 布局已删除: {:?}", file_path);
    }

    Ok("deleted".to_string())
}

/// 导出布局到指定路径
#[tauri::command]
pub async fn export_layout(
    app_handle: AppHandle,
    payload: LayoutPayload,
    export_path: String,
) -> Result<String, String> {
    let config = LayoutConfig {
        index: payload.index,
        name: payload.name,
        cells: payload.cells,
        timestamp: chrono::Utc::now().timestamp_millis(),
    };

    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("序列化布局配置失败: {}", e))?;

    fs::write(&export_path, json)
        .map_err(|e| format!("导出布局文件失败: {}", e))?;

    println!("[Rust] 布局已导出到: {}", export_path);

    Ok(export_path)
}

/// 从指定路径导入布局
#[tauri::command]
pub async fn import_layout(
    app_handle: AppHandle,
    import_path: String,
) -> Result<LayoutPayload, String> {
    let json = fs::read_to_string(&import_path)
        .map_err(|e| format!("读取布局文件失败: {}", e))?;

    let config: LayoutConfig = serde_json::from_str(&json)
        .map_err(|e| format!("解析布局配置失败: {}", e))?;

    let payload = LayoutPayload {
        index: config.index,
        name: config.name,
        cells: config.cells,
    };

    // 保存到应用数据目录
    save_layout(app_handle, payload.clone()).await?;

    Ok(payload)
}
