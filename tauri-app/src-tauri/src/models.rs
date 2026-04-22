// 模型管理模块
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelInfo {
    pub filename: String,
    pub path: String,
    pub size: u64,
    pub downloaded_at: String,
    pub model_type: String,
}

#[tauri::command]
pub fn list_models(app_handle: tauri::AppHandle) -> Result<Vec<ModelInfo>, String> {
    let models_dir = get_models_dir(&app_handle)?;

    if !models_dir.exists() {
        return Ok(Vec::new());
    }

    let mut models = Vec::new();

    let entries = fs::read_dir(&models_dir)
        .map_err(|e| format!("Failed to read models directory: {}", e))?;

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext == "onnx" || ext == "bin" || ext == "json" {
                        if let Ok(metadata) = fs::metadata(&path) {
                            let model_type = match ext.to_str() {
                                Some("onnx") => "model",
                                Some("bin") => "weights",
                                Some("json") => "config",
                                _ => "unknown",
                            }.to_string();

                            models.push(ModelInfo {
                                filename: path.file_name()
                                    .unwrap_or_default()
                                    .to_string_lossy()
                                    .to_string(),
                                path: path.to_string_lossy().to_string(),
                                size: metadata.len(),
                                downloaded_at: metadata.modified()
                                    .map(|t| {
                                        t.duration_since(std::time::UNIX_EPOCH)
                                            .unwrap_or_default()
                                            .as_millis()
                                            .to_string()
                                    })
                                    .unwrap_or_default(),
                                model_type,
                            });
                        }
                    }
                }
            }
        }
    }

    Ok(models)
}

#[tauri::command]
pub async fn download_model(
    app_handle: tauri::AppHandle,
    url: String,
    filename: String,
) -> Result<ModelInfo, String> {
    let models_dir = get_models_dir(&app_handle)?;

    if !models_dir.exists() {
        fs::create_dir_all(&models_dir)
            .map_err(|e| format!("Failed to create models directory: {}", e))?;
    }

    let model_path = models_dir.join(&filename);

    // 下载文件
    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to download model: {}", e))?;

    let bytes = response.bytes()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    fs::write(&model_path, &bytes)
        .map_err(|e| format!("Failed to save model: {}", e))?;

    let metadata = fs::metadata(&model_path)
        .map_err(|e| format!("Failed to get file metadata: {}", e))?;

    Ok(ModelInfo {
        filename: filename.clone(),
        path: model_path.to_string_lossy().to_string(),
        size: metadata.len(),
        downloaded_at: metadata.modified()
            .map(|t| {
                t.duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis()
                    .to_string()
            })
            .unwrap_or_default(),
        model_type: "model".to_string(),
    })
}

#[tauri::command]
pub fn delete_model(app_handle: tauri::AppHandle, filename: String) -> Result<bool, String> {
    let models_dir = get_models_dir(&app_handle)?;
    let model_path = models_dir.join(&filename);

    if model_path.exists() {
        fs::remove_file(&model_path)
            .map_err(|e| format!("Failed to delete model: {}", e))?;
    }

    Ok(true)
}

#[tauri::command]
pub fn clear_model_cache(app_handle: tauri::AppHandle) -> Result<bool, String> {
    let models_dir = get_models_dir(&app_handle)?;

    if models_dir.exists() {
        fs::remove_dir_all(&models_dir)
            .map_err(|e| format!("Failed to clear model cache: {}", e))?;
    }

    // 重新创建空目录
    fs::create_dir_all(&models_dir)
        .map_err(|e| format!("Failed to recreate models directory: {}", e))?;

    Ok(true)
}

fn get_models_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| e.to_string())?;

    Ok(app_data_dir.join("models"))
}
