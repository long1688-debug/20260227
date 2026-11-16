// Whisper 语音识别模块 - 基于 Python subprocess 调用
// 优势：无需编译依赖，立即可用
// 要求：系统已安装 Python 和 whisper 库

use crate::proc_util::NoWindow;
use serde::{Deserialize, Serialize};
use std::process::Command;
use std::sync::Arc;
use tokio::sync::Mutex;
use tempfile::NamedTempFile;
use hound::{WavSpec, WavWriter};
use std::io::Write;
use std::path::PathBuf;
use tauri::Emitter;

/// Whisper 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhisperConfig {
    /// 模型类型: tiny, base, small, medium, large
    #[serde(default = "default_model_type")]
    pub model_type: String,

    /// 语言代码: zh, en, ja, ko 等
    #[serde(default = "default_language")]
    pub language: String,

    /// 是否翻译为英文
    #[serde(default)]
    pub translate: bool,

    /// 采样率（固定为 16000）
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
            model_type: "base".to_string(),
            language: "zh".to_string(),
            translate: false,
            sample_rate: 16000,
        }
    }
}

/// Whisper 识别结果片段
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhisperSegment {
    /// 文本内容
    pub text: String,
    /// 开始时间（秒）
    pub start: f32,
    /// 结束时间（秒）
    pub end: f32,
    /// 置信度（0-1）
    pub confidence: f32,
}

/// 完整识别结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhisperResult {
    /// 所有片段
    pub segments: Vec<WhisperSegment>,
    /// 完整文本
    pub full_text: String,
    /// 处理耗时（毫秒）
    pub processing_time_ms: u64,
}

/// Whisper 识别器
pub struct WhisperRecognizer {
    config: WhisperConfig,
    initialized: bool,
    python_available: bool,
}

impl WhisperRecognizer {
    /// 创建新的识别器
    pub fn new(config: WhisperConfig) -> Result<Self, String> {
        // 检查 Python 是否可用
        let python_available = Self::check_python_availability()?;

        log::info!("🎤 [Whisper] 识别器初始化 - 模型: {}, 语言: {}",
                   config.model_type, config.language);

        Ok(WhisperRecognizer {
            config,
            initialized: true,
            python_available,
        })
    }

    /// 检查 Python 和 whisper 库是否可用
    fn check_python_availability() -> Result<bool, String> {
        // 尝试运行 python --version
        let output = Command::new("python").no_window()
            .arg("--version")
            .output();

        match output {
            Ok(out) if out.status.success() => {
                log::info!("✅ [Whisper] Python 可用");

                // 检查 whisper 库
                let check_whisper = Command::new("python").no_window()
                    .args(&["-c", "import whisper; print('OK')"])
                    .output();

                match check_whisper {
                    Ok(wout) if wout.status.success() => {
                        log::info!("✅ [Whisper] whisper 库已安装");
                        Ok(true)
                    }
                    _ => {
                        log::warn!("⚠️ [Whisper] whisper 库未安装，请运行: pip install openai-whisper");
                        Err("whisper 库未安装".to_string())
                    }
                }
            }
            _ => {
                // 尝试 python3
                let output3 = Command::new("python3").no_window()
                    .arg("--version")
                    .output();

                match output3 {
                    Ok(out3) if out3.status.success() => {
                        log::info!("✅ [Whisper] Python3 可用");
                        Ok(true)
                    }
                    _ => {
                        log::error!("❌ [Whisper] Python 未找到");
                        Err("Python 未安装或未添加到 PATH".to_string())
                    }
                }
            }
        }
    }

    /// 处理音频数据（PCM f32 格式）
    pub fn process_audio(&self, audio_data: &[f32]) -> Result<WhisperResult, String> {
        if !self.initialized {
            return Err("Whisper 识别器未初始化".to_string());
        }

        if audio_data.is_empty() {
            return Ok(WhisperResult {
                segments: vec![],
                full_text: String::new(),
                processing_time_ms: 0,
            });
        }

        let start_time = std::time::Instant::now();

        // 步骤 1: 将 PCM 数据保存为 WAV 文件
        let wav_path = self.save_pcm_to_wav(audio_data)?;

        // 步骤 2: 调用 Python whisper 脚本
        let result = self.run_whisper_inference(&wav_path)?;

        let processing_time = start_time.elapsed().as_millis() as u64;

        log::info!("✅ [Whisper] 识别完成 - 耗时: {}ms, 文本长度: {}",
                   processing_time, result.full_text.len());

        Ok(WhisperResult {
            segments: result.segments,
            full_text: result.full_text,
            processing_time_ms: processing_time,
        })
    }

    /// 将 PCM f32 数据保存为 WAV 文件
    fn save_pcm_to_wav(&self, audio_data: &[f32]) -> Result<String, String> {
        // 创建临时文件
        let temp_file = NamedTempFile::new()
            .map_err(|e| format!("创建临时文件失败: {}", e))?;

        let wav_path = temp_file.path().to_str()
            .ok_or("临时文件路径无效")?
            .to_string() + ".wav";

        // WAV 规格
        let spec = WavSpec {
            channels: 1,
            sample_rate: self.config.sample_rate,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };

        let mut writer = WavWriter::create(&wav_path, spec)
            .map_err(|e| format!("创建 WAV 文件失败: {}", e))?;

        // 转换 f32 (-1.0 ~ 1.0) 到 i16 (-32768 ~ 32767)
        for &sample in audio_data {
            let i16_sample = (sample * 32767.0).clamp(-32768.0, 32767.0) as i16;
            writer.write_sample(i16_sample)
                .map_err(|e| format!("写入音频样本失败: {}", e))?;
        }

        writer.finalize()
            .map_err(|e| format!("完成 WAV 文件失败: {}", e))?;

        log::debug!("📁 [Whisper] WAV 文件已保存: {}", wav_path);

        Ok(wav_path)
    }

    /// 运行 Python whisper 推理
    fn run_whisper_inference(&self, wav_path: &str) -> Result<WhisperResult, String> {
        // 构建 Python 脚本
        let python_script = self.build_whisper_script(wav_path);

        // 执行 Python 命令
        let output = Command::new("python").no_window()
            .args(&["-c", &python_script])
            .output()
            .or_else(|_| {
                // 尝试 python3
                Command::new("python3").no_window()
                    .args(&["-c", &python_script])
                    .output()
            })
            .map_err(|e| format!("执行 Python 命令失败: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Whisper 推理失败: {}", stderr));
        }

        // 解析 JSON 输出
        let stdout = String::from_utf8_lossy(&output.stdout);
        let result: WhisperResult = serde_json::from_str(&stdout)
            .map_err(|e| format!("解析 Whisper 结果失败: {}", e))?;

        Ok(result)
    }

    /// 构建 Python whisper 脚本
    fn build_whisper_script(&self, wav_path: &str) -> String {
        let model_type = &self.config.model_type;
        let language = &self.config.language;
        let translate = if self.config.translate { "True" } else { "False" };

        format!(r#"
import whisper
import json
import sys

try:
    # 加载模型
    model = whisper.load_model("{model_type}")

    # 执行推理
    result = model.transcribe(
        "{wav_path}",
        language="{language}",
        translate={translate},
        verbose=False
    )

    # 构建输出
    segments = []
    for seg in result.get('segments', []):
        segments.append({{
            'text': seg['text'].strip(),
            'start': seg['start'],
            'end': seg['end'],
            'confidence': seg.get('avg_logprob', 0.0)
        }})

    output = {{
        'segments': segments,
        'full_text': result.get('text', '').strip(),
        'processing_time_ms': 0
    }}

    print(json.dumps(output, ensure_ascii=False))

except Exception as e:
    print(json.dumps({{'error': str(e)}}), file=sys.stderr)
    sys.exit(1)
"#,
            model_type = model_type,
            wav_path = wav_path.replace('\\', "\\\\"),
            language = language,
            translate = translate
        )
    }

    /// 获取采样率
    pub fn get_sample_rate(&self) -> u32 {
        self.config.sample_rate
    }
}

/// Whisper 状态管理
#[derive(Clone)]
pub struct WhisperState {
    pub recognizer: Arc<Mutex<Option<WhisperRecognizer>>>,
}

impl WhisperState {
    pub fn new() -> Self {
        WhisperState {
            recognizer: Arc::new(Mutex::new(None)),
        }
    }
}

// ==================== Tauri Commands ====================

/// 初始化 Whisper 识别器
#[tauri::command]
pub async fn init_whisper(
    config: WhisperConfig,
    state: tauri::State<'_, WhisperState>
) -> Result<(), String> {
    log::info!("🚀 [Whisper] 正在初始化...");

    let recognizer = WhisperRecognizer::new(config)?;
    let mut guard = state.recognizer.lock().await;
    *guard = Some(recognizer);

    log::info!("✅ [Whisper] 初始化成功");
    Ok(())
}

/// 识别音频数据
#[tauri::command]
pub async fn recognize_audio(
    audio_data: Vec<f32>,
    state: tauri::State<'_, WhisperState>
) -> Result<WhisperResult, String> {
    let mut guard = state.recognizer.lock().await;
    let recognizer = guard.as_mut().ok_or("Whisper 识别器未初始化")?;

    recognizer.process_audio(&audio_data)
}

/// 释放 Whisper 识别器
#[tauri::command]
pub async fn cleanup_whisper(
    state: tauri::State<'_, WhisperState>
) -> Result<(), String> {
    let mut guard = state.recognizer.lock().await;
    *guard = None;
    log::info!("🗑️ [Whisper] 已清理");
    Ok(())
}

/// 检查 Whisper 状态
#[tauri::command]
pub async fn get_whisper_status(
    state: tauri::State<'_, WhisperState>
) -> Result<serde_json::Value, String> {
    let guard = state.recognizer.lock().await;
    let is_initialized = guard.is_some();

    Ok(serde_json::json!({
        "initialized": is_initialized,
        "python_available": if is_initialized {
            guard.as_ref().unwrap().python_available
        } else {
            false
        }
    }))
}

// ==================== 📥 模型下载功能 ====================

/// 模型下载进度
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub model_id: String,
    pub progress: u32,  // 0-100
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub speed_kbps: f64,
    pub eta_seconds: u32,
    pub status: String,  // "downloading", "completed", "error"
    pub error: Option<String>,
}

/// 下载 Whisper 模型
#[tauri::command]
pub async fn download_whisper_model(
    model_id: String,
    app_handle: tauri::AppHandle
) -> Result<DownloadProgress, String> {
    use std::fs;

    log::info!("📥 [Whisper] 开始下载模型: {}", model_id);

    // 验证模型 ID
    let valid_models = ["tiny", "base", "small", "medium", "large"];
    if !valid_models.contains(&model_id.as_str()) {
        return Err(format!("不支持的模型: {}", model_id));
    }

    // 获取缓存目录
    let cache_dir = get_whisper_cache_dir()?;
    let model_filename = format!("ggml-{}.bin", model_id);
    let model_path = cache_dir.join(&model_filename);

    // 检查是否已下载
    if model_path.exists() {
        log::info!("✅ [Whisper] 模型已存在: {:?}", model_path);
        let file_size = fs::metadata(&model_path).map_err(|e| format!("获取文件元数据失败: {}", e))?.len();
        return Ok(DownloadProgress {
            model_id,
            progress: 100,
            downloaded_bytes: file_size,
            total_bytes: file_size,
            speed_kbps: 0.0,
            eta_seconds: 0,
            status: "completed".to_string(),
            error: None,
        });
    }

    // 构建下载 URL
    let download_url = format!(
        "https://openaipublic.blob.core.windows.net/whisper/{}",
        model_filename
    );

    log::info!("🌐 [Whisper] 下载 URL: {}", download_url);

    // 创建 HTTP 客户端
    let client = reqwest::Client::new();

    // 发送请求
    let response = client.get(&download_url)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP 错误: {}", response.status()));
    }

    // 获取总大小
    let total_size = response.content_length().unwrap_or(0);
    log::info!("📊 [Whisper] 模型大小: {} bytes", total_size);

    // 创建临时文件
    let temp_path = model_path.with_extension("tmp");
    let mut file = fs::File::create(&temp_path)
        .map_err(|e| format!("创建文件失败: {}", e))?;

    // 下载并写入文件
    let mut downloaded: u64 = 0;
    let start_time = std::time::Instant::now();

    use futures_util::StreamExt;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("下载错误: {}", e))?;

        file.write_all(&chunk)
            .map_err(|e| format!("写入文件失败: {}", e))?;

        downloaded += chunk.len() as u64;

        // 计算进度
        let progress = if total_size > 0 {
            ((downloaded as f64 / total_size as f64) * 100.0) as u32
        } else {
            0
        };

        // 计算速度和预计时间
        let elapsed = start_time.elapsed().as_secs_f64();
        let speed_kbps = if elapsed > 0.0 {
            downloaded as f64 / elapsed / 1024.0
        } else {
            0.0
        };

        let remaining_bytes = total_size.saturating_sub(downloaded);
        let eta_seconds = if speed_kbps > 0.0 {
            (remaining_bytes as f64 / (speed_kbps * 1024.0)) as u32
        } else {
            0
        };

        // 发送进度事件到前端
        let progress_data = DownloadProgress {
            model_id: model_id.clone(),
            progress,
            downloaded_bytes: downloaded,
            total_bytes: total_size,
            speed_kbps,
            eta_seconds,
            status: "downloading".to_string(),
            error: None,
        };

        // 通过 emit 发送进度更新
        let _ = app_handle.emit("whisper-download-progress", &progress_data);

        log::debug!(
            "📥 [Whisper] 进度: {}% ({}/{} bytes), 速度: {:.1} KB/s, 剩余: {}s",
            progress, downloaded, total_size, speed_kbps, eta_seconds
        );
    }

    // 重命名临时文件为正式文件
    fs::rename(&temp_path, &model_path)
        .map_err(|e| format!("重命名文件失败: {}", e))?;

    log::info!("✅ [Whisper] 模型下载完成: {:?}", model_path);

    Ok(DownloadProgress {
        model_id,
        progress: 100,
        downloaded_bytes: downloaded,
        total_bytes: downloaded,
        speed_kbps: 0.0,
        eta_seconds: 0,
        status: "completed".to_string(),
        error: None,
    })
}

/// 获取 Whisper 缓存目录
fn get_whisper_cache_dir() -> Result<PathBuf, String> {
    // 使用系统标准缓存目录
    #[cfg(target_os = "windows")]
    let base_dir = std::env::var("USERPROFILE")
        .map(|p| PathBuf::from(p).join(".cache"))
        .unwrap_or_else(|_| PathBuf::from("C:\\Users\\Default\\.cache"));

    #[cfg(target_os = "macos")]
    let base_dir = dirs::home_dir()
        .map(|p| p.join(".cache"))
        .unwrap_or_else(|| PathBuf::from("/Users/default/.cache"));

    #[cfg(target_os = "linux")]
    let base_dir = dirs::home_dir()
        .map(|p| p.join(".cache"))
        .unwrap_or_else(|| PathBuf::from("/home/default/.cache"));

    let whisper_dir = base_dir.join("whisper");

    // 创建目录
    std::fs::create_dir_all(&whisper_dir)
        .map_err(|e| format!("创建目录失败: {}", e))?;

    Ok(whisper_dir)
}

/// 删除已下载的模型
#[tauri::command]
pub async fn delete_whisper_model(
    model_id: String
) -> Result<String, String> {

    log::info!("🗑️ [Whisper] 删除模型: {}", model_id);

    let cache_dir = get_whisper_cache_dir()?;
    let model_filename = format!("ggml-{}.bin", model_id);
    let model_path = cache_dir.join(&model_filename);

    if !model_path.exists() {
        return Err(format!("模型文件不存在: {:?}", model_path));
    }

    std::fs::remove_file(&model_path)
        .map_err(|e| format!("删除文件失败: {}", e))?;

    log::info!("✅ [Whisper] 模型删除成功: {:?}", model_path);

    Ok(format!("模型 {} 已删除", model_id))
}

/// 检查模型是否存在
#[tauri::command]
pub async fn check_whisper_model_exists(
    model_id: String
) -> Result<serde_json::Value, String> {

    let cache_dir = get_whisper_cache_dir()?;
    let model_filename = format!("ggml-{}.bin", model_id);
    let model_path = cache_dir.join(&model_filename);

    let exists = model_path.exists();
    let size = if exists {
        std::fs::metadata(&model_path).ok().map(|m| m.len()).unwrap_or(0)
    } else {
        0
    };

    Ok(serde_json::json!({
        "model_id": model_id,
        "exists": exists,
        "size_bytes": size,
        "size_mb": size as f64 / 1024.0 / 1024.0,
        "path": model_path.to_string_lossy()
    }))
}
