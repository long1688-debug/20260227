// 实时语音识别模块
// 使用 Whisper.cpp 进行实时语音识别

use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::{AppHandle, Emitter};
use serde::{Deserialize, Serialize};
use crate::audio_capture::AudioCaptureState;
use crate::whisper_wrapper::WhisperState;

// 语音识别结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecognitionResult {
    pub text: String,
    pub is_final: bool,
    pub confidence: f32,
}

// 语音识别状态
#[derive(Clone)]
pub struct SpeechRecognitionState {
    pub is_recognizing: Arc<Mutex<bool>>,
}

impl SpeechRecognitionState {
    pub fn new() -> Self {
        SpeechRecognitionState {
            is_recognizing: Arc::new(Mutex::new(false)),
        }
    }
}

// 启动语音识别
#[tauri::command]
pub async fn start_speech_recognition(
    _app_handle: AppHandle,
    speech_state: tauri::State<'_, SpeechRecognitionState>,
    audio_state: tauri::State<'_, AudioCaptureState>,
    whisper_state: tauri::State<'_, WhisperState>,
) -> Result<(), String> {
    let mut is_recognizing = speech_state.is_recognizing.lock().await;

    if *is_recognizing {
        return Err("语音识别已在运行".to_string());
    }

    *is_recognizing = true;
    drop(is_recognizing);

    // 启动音频捕获
    let is_capturing = audio_state.is_capturing.clone();
    let buffer = audio_state.buffer.clone();

    // 检查 Whisper 是否已初始化
    let whisper_initialized = {
        let recognizer = whisper_state.recognizer.lock().await;
        recognizer.is_some()
    };

    if !whisper_initialized {
        return Err("Whisper 未初始化，请先调用 init_whisper".to_string());
    }

    let is_recognizing_clone = speech_state.is_recognizing.clone();
    let whisper_recognizer = {
        let recognizer = whisper_state.recognizer.lock().await;
        recognizer.is_some()
    };

    if !whisper_recognizer {
        return Err("Whisper 未初始化，请先调用 init_whisper".to_string());
    }

    tokio::spawn(async move {
        let mut last_recognition_time = std::time::Instant::now();
        let recognition_interval = std::time::Duration::from_secs(3); // 每3秒识别一次

        loop {
            {
                let recognizing = is_recognizing_clone.lock().await;
                if !*recognizing {
                    break;
                }
            }

            // 检查音频捕获是否在运行
            let is_capturing_active = {
                let capturing = is_capturing.lock().unwrap();
                *capturing
            };
            
            if !is_capturing_active {
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                continue;
            }

            // 检查是否到达识别间隔
            let now = std::time::Instant::now();
            if now.duration_since(last_recognition_time) < recognition_interval {
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                continue;
            }

            // 从缓冲区获取音频数据
            let audio_data = buffer.take(16000 * 3); // 获取3秒的音频数据

            if audio_data.len() >= 16000 { // 至少1秒的音频数据
                // 注意：Whisper 识别功能需要安装 libclang 和 whisper-rs
                // 当前使用存根实现，不会返回实际的识别结果
                // 存根实现：不发送识别结果
                // 实际实现需要使用 whisper-rs 库
                last_recognition_time = now;
            }

            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        }
    });

    Ok(())
}

// 处理音频数据（用于视频转字幕）
#[tauri::command]
pub async fn process_audio_data(
    app_handle: AppHandle,
    audio_data: Vec<i16>,
    whisper_state: tauri::State<'_, WhisperState>,
) -> Result<String, String> {
    // 将 Int16 音频数据转换为 Float32
    let float_data: Vec<f32> = audio_data.iter()
        .map(|&sample| sample as f32 / 32768.0)
        .collect();

    // 尝试调用 Whisper 识别器
    let mut guard = whisper_state.recognizer.lock().await;
    
    // 如果 Whisper 未初始化，返回空字符串（不报错）
    let recognizer = match guard.as_mut() {
        Some(rec) => rec,
        None => {
            // Whisper 未初始化，静默返回空字符串
            return Ok(String::new());
        }
    };
    
    // 尝试处理音频数据
    let results = match recognizer.process_audio(&float_data) {
        Ok(results) => results,
        Err(e) => {
            // 处理失败，记录日志并返回空字符串
            eprintln!("[Whisper] 音频处理失败: {}", e);
            return Ok(String::new());
        }
    };
    
    // 合并识别结果
    let text = results.iter()
        .map(|r| r.text.clone())
        .collect::<Vec<String>>()
        .join(" ");

    // 如果有识别结果，发送到前端
    if !text.is_empty() {
        // 发送事件到前端
        let _ = app_handle.emit("subtitle_result", &text);
    }

    Ok(text)
}

// 停止语音识别
#[tauri::command]
pub async fn stop_speech_recognition(state: tauri::State<'_, SpeechRecognitionState>) -> Result<(), String> {
    let mut is_recognizing = state.is_recognizing.lock().await;
    *is_recognizing = false;
    Ok(())
}

// 获取语音识别状态
#[tauri::command]
pub async fn get_speech_recognition_status(state: tauri::State<'_, SpeechRecognitionState>) -> Result<bool, String> {
    let is_recognizing = state.is_recognizing.lock().await;
    Ok(*is_recognizing)
}

// 获取 Whisper 识别器状态
#[tauri::command]
pub async fn get_whisper_status(whisper_state: tauri::State<'_, WhisperState>) -> Result<bool, String> {
    let recognizer = whisper_state.recognizer.lock().await;
    Ok(recognizer.is_some())
}
