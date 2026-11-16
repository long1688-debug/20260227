//! 语音识别：通过 whisper-rs 在进程内运行 whisper.cpp，加载本地 ggml 模型，不依赖 python 或网络。
//!
//! 模型查找顺序：
//! 1. 安装目录 `runtime/models/whisper/ggml-<model>.bin`（随安装包附带）
//! 2. 用户目录 `~/.cache/whisper/ggml-<model>.bin`（用户自行放入的模型）

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

const VALID_MODELS: [&str; 5] = ["tiny", "base", "small", "medium", "large"];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhisperConfig {
    #[serde(default = "default_model_type")]
    pub model_type: String,

    #[serde(default = "default_language")]
    pub language: String,

    #[serde(default)]
    pub translate: bool,

    #[serde(default = "default_sample_rate")]
    pub sample_rate: u32,
}

fn default_model_type() -> String {
    "base".to_string()
}

fn default_language() -> String {
    "zh".to_string()
}

fn default_sample_rate() -> u32 {
    16000
}

impl Default for WhisperConfig {
    fn default() -> Self {
        Self {
            model_type: default_model_type(),
            language: default_language(),
            translate: false,
            sample_rate: default_sample_rate(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhisperSegment {
    pub text: String,
    pub start: f32,
    pub end: f32,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhisperResult {
    pub segments: Vec<WhisperSegment>,
    pub full_text: String,
    pub processing_time_ms: u64,
}

pub struct WhisperRecognizer {
    config: WhisperConfig,
    ctx: WhisperContext,
    model_path: PathBuf,
}

impl WhisperRecognizer {
    pub fn new(config: WhisperConfig) -> Result<Self, String> {
        let model_path = find_model(&config.model_type).ok_or_else(|| {
            format!(
                "未找到 Whisper 模型 ggml-{}.bin，请确认安装目录 runtime\\models\\whisper\\ 下有该文件",
                config.model_type
            )
        })?;

        let ctx = WhisperContext::new_with_params(&model_path, WhisperContextParameters::default())
            .map_err(|e| format!("加载 Whisper 模型失败 ({}): {}", model_path.display(), e))?;

        log::info!(
            "[Whisper] 模型已加载: {}，语言: {}",
            model_path.display(),
            config.language
        );

        Ok(Self { config, ctx, model_path })
    }

    /// `audio_data` 为 16kHz 单声道 f32 PCM。推理是 CPU 密集操作，调用方应在阻塞线程中执行。
    pub fn process_audio(&self, audio_data: &[f32]) -> Result<WhisperResult, String> {
        if audio_data.is_empty() {
            return Ok(WhisperResult {
                segments: vec![],
                full_text: String::new(),
                processing_time_ms: 0,
            });
        }

        let start_time = std::time::Instant::now();

        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_language(Some(&self.config.language));
        params.set_translate(self.config.translate);
        params.set_n_threads(recommended_threads());
        params.set_no_context(true);
        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);

        let mut state = self
            .ctx
            .create_state()
            .map_err(|e| format!("创建 Whisper 推理状态失败: {}", e))?;
        state
            .full(params, audio_data)
            .map_err(|e| format!("Whisper 推理失败: {}", e))?;

        let segments: Vec<WhisperSegment> = state
            .as_iter()
            .filter_map(|seg| {
                let text = seg.to_str_lossy().ok()?.trim().to_string();
                if text.is_empty() {
                    return None;
                }
                Some(WhisperSegment {
                    text,
                    // whisper.cpp 时间戳单位为 10ms
                    start: seg.start_timestamp() as f32 / 100.0,
                    end: seg.end_timestamp() as f32 / 100.0,
                    confidence: 1.0 - seg.no_speech_probability(),
                })
            })
            .collect();

        let full_text = segments
            .iter()
            .map(|s| s.text.as_str())
            .collect::<Vec<_>>()
            .join(" ");

        Ok(WhisperResult {
            segments,
            full_text,
            processing_time_ms: start_time.elapsed().as_millis() as u64,
        })
    }
}

fn recommended_threads() -> i32 {
    // 留出核心给 UI 和视频解码
    let n = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4);
    (n / 2).clamp(1, 8) as i32
}

fn model_filename(model_id: &str) -> String {
    format!("ggml-{}.bin", model_id)
}

fn user_model_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|p| p.join(".cache").join("whisper"))
}

fn find_model(model_id: &str) -> Option<PathBuf> {
    if !VALID_MODELS.contains(&model_id) {
        return None;
    }
    let file = model_filename(model_id);
    crate::bin_resolver::model_file(&format!("whisper/{}", file))
        .or_else(|| user_model_dir().map(|d| d.join(&file)).filter(|p| p.is_file()))
}

/// Whisper 状态管理
#[derive(Clone)]
pub struct WhisperState {
    pub recognizer: Arc<Mutex<Option<Arc<WhisperRecognizer>>>>,
}

impl WhisperState {
    pub fn new() -> Self {
        WhisperState {
            recognizer: Arc::new(Mutex::new(None)),
        }
    }

    /// 在阻塞线程中识别，未初始化时返回 None。
    pub async fn transcribe(&self, audio: Vec<f32>) -> Option<Result<WhisperResult, String>> {
        let recognizer = self.recognizer.lock().await.clone()?;
        Some(
            tokio::task::spawn_blocking(move || recognizer.process_audio(&audio))
                .await
                .unwrap_or_else(|e| Err(format!("识别线程异常: {}", e))),
        )
    }
}

// ==================== Tauri Commands ====================

#[tauri::command]
pub async fn init_whisper(
    config: WhisperConfig,
    state: tauri::State<'_, WhisperState>,
) -> Result<(), String> {
    let recognizer = tokio::task::spawn_blocking(move || WhisperRecognizer::new(config))
        .await
        .map_err(|e| e.to_string())??;
    *state.recognizer.lock().await = Some(Arc::new(recognizer));
    Ok(())
}

#[tauri::command]
pub async fn recognize_audio(
    audio_data: Vec<f32>,
    state: tauri::State<'_, WhisperState>,
) -> Result<WhisperResult, String> {
    state
        .transcribe(audio_data)
        .await
        .ok_or_else(|| "Whisper 识别器未初始化".to_string())?
}

#[tauri::command]
pub async fn cleanup_whisper(state: tauri::State<'_, WhisperState>) -> Result<(), String> {
    *state.recognizer.lock().await = None;
    Ok(())
}

#[tauri::command]
pub async fn get_whisper_status(
    state: tauri::State<'_, WhisperState>,
) -> Result<serde_json::Value, String> {
    let guard = state.recognizer.lock().await;
    Ok(serde_json::json!({
        "initialized": guard.is_some(),
        "engine": "whisper.cpp",
        "model_path": guard.as_ref().map(|r| r.model_path.to_string_lossy().to_string()),
    }))
}

/// 模型随安装包提供，不再在线下载。保留该命令以返回明确的错误提示。
#[tauri::command]
pub async fn download_whisper_model(model_id: String) -> Result<serde_json::Value, String> {
    Err(format!(
        "已禁用在线下载。请将 {} 放到安装目录 runtime\\models\\whisper\\ 或 {} 下",
        model_filename(&model_id),
        user_model_dir().map(|d| d.display().to_string()).unwrap_or_default()
    ))
}

/// 只允许删除用户目录中的模型，安装目录中的模型由安装包管理。
#[tauri::command]
pub async fn delete_whisper_model(model_id: String) -> Result<String, String> {
    if !VALID_MODELS.contains(&model_id.as_str()) {
        return Err(format!("不支持的模型: {}", model_id));
    }
    let path = user_model_dir()
        .ok_or("无法确定用户目录")?
        .join(model_filename(&model_id));
    if !path.is_file() {
        return Err(format!("模型文件不存在或属于安装包: {:?}", path));
    }
    std::fs::remove_file(&path).map_err(|e| format!("删除文件失败: {}", e))?;
    Ok(format!("模型 {} 已删除", model_id))
}

#[tauri::command]
pub async fn check_whisper_model_exists(model_id: String) -> Result<serde_json::Value, String> {
    let path = find_model(&model_id);
    let size = path
        .as_ref()
        .and_then(|p| std::fs::metadata(p).ok())
        .map(|m| m.len())
        .unwrap_or(0);
    Ok(serde_json::json!({
        "model_id": model_id,
        "exists": path.is_some(),
        "size_bytes": size,
        "size_mb": size as f64 / 1024.0 / 1024.0,
        "path": path.map(|p| p.to_string_lossy().to_string()),
    }))
}
