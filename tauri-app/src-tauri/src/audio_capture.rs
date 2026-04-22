// 系统音频捕获模块
// 使用 cpal 捕获音频输入

use std::sync::{Arc, Mutex};
use std::collections::VecDeque;
use tauri::{AppHandle, Emitter};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::SampleFormat;
use crate::audio_processor::AudioProcessor;

// 音频数据缓冲区
#[derive(Clone)]
pub struct AudioBuffer {
    buffer: Arc<Mutex<VecDeque<f32>>>,
    sample_rate: u32,
}

impl AudioBuffer {
    pub fn new(sample_rate: u32) -> Self {
        AudioBuffer {
            buffer: Arc::new(Mutex::new(VecDeque::with_capacity((sample_rate * 2) as usize))), // 2秒缓冲
            sample_rate,
        }
    }

    pub fn push(&self, data: &[f32]) {
        let mut buffer = self.buffer.lock().unwrap();
        for &sample in data {
            buffer.push_back(sample);
            // 保持缓冲区大小
            if buffer.len() > (self.sample_rate * 2) as usize {
                buffer.pop_front();
            }
        }
    }

    pub fn take(&self, count: usize) -> Vec<f32> {
        let mut buffer = self.buffer.lock().unwrap();
        let mut result = Vec::with_capacity(count.min(buffer.len()));
        for _ in 0..count.min(buffer.len()) {
            if let Some(sample) = buffer.pop_front() {
                result.push(sample);
            }
        }
        result
    }

    pub fn len(&self) -> usize {
        let buffer = self.buffer.lock().unwrap();
        buffer.len()
    }
}

// 音频捕获状态
#[derive(Clone)]
pub struct AudioCaptureState {
    pub is_capturing: Arc<Mutex<bool>>,
    pub buffer: AudioBuffer,
    pub processor: Arc<Mutex<AudioProcessor>>,
}

impl AudioCaptureState {
    pub fn new() -> Self {
        AudioCaptureState {
            is_capturing: Arc::new(Mutex::new(false)),
            buffer: AudioBuffer::new(48000), // 默认 48kHz
            processor: Arc::new(Mutex::new(AudioProcessor::default())),
        }
    }
}

// 启动音频捕获
#[tauri::command]
pub async fn start_audio_capture(
    app_handle: AppHandle,
    state: tauri::State<'_, AudioCaptureState>,
) -> Result<(), String> {
    let mut is_capturing = state.is_capturing.lock().unwrap();

    if *is_capturing {
        return Err("音频捕获已在运行".to_string());
    }

    *is_capturing = true;
    drop(is_capturing);

    // 使用 cpal 捕获音频
    let host = cpal::default_host();

    // 获取默认输入设备
    let device = host.default_input_device()
        .ok_or("找不到默认音频输入设备")?;

    println!("使用音频设备: {:?}", device.name());

    // 获取支持的配置
    let config = device.default_input_config()
        .map_err(|e| format!("获取音频配置失败: {}", e))?;

    println!("音频配置: {:?}", config);

    let buffer = state.buffer.clone();
    let is_capturing_clone = state.is_capturing.clone();
    let processor = state.processor.clone();

    // 根据采样格式创建音频流
    match config.sample_format() {
        SampleFormat::F32 => {
            let stream = device.build_input_stream(
                &config.into(),
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    // 检查是否仍在捕获
                    let capturing = is_capturing_clone.lock().unwrap();
                    if !*capturing {
                        return;
                    }
                    drop(capturing);

                    // 处理音频数据
                    let mut processed_data = data.to_vec();
                    {
                        let mut proc = processor.lock().unwrap();
                        proc.process(&mut processed_data);
                    }

                    // 将音频数据存入缓冲区
                    buffer.push(&processed_data);

                    // 发送音频数据事件
                    let _ = app_handle.emit("audio_data", &processed_data);
                },
                move |err| {
                    eprintln!("音频流错误: {}", err);
                },
                None,
            ).map_err(|e| format!("创建音频流失败: {}", e))?;

            stream.play().map_err(|e| format!("播放音频流失败: {}", e))?;
        }
        SampleFormat::I16 => {
            let stream = device.build_input_stream(
                &config.into(),
                move |data: &[i16], _: &cpal::InputCallbackInfo| {
                    // 检查是否仍在捕获
                    let capturing = is_capturing_clone.lock().unwrap();
                    if !*capturing {
                        return;
                    }
                    drop(capturing);

                    // 转换为 f32
                    let mut f32_data: Vec<f32> = data.iter()
                        .map(|&s| s as f32 / 32768.0)
                        .collect();

                    // 处理音频数据
                    {
                        let mut proc = processor.lock().unwrap();
                        proc.process(&mut f32_data);
                    }

                    // 将音频数据存入缓冲区
                    buffer.push(&f32_data);

                    // 发送音频数据事件
                    let _ = app_handle.emit("audio_data", f32_data);
                },
                move |err| {
                    eprintln!("音频流错误: {}", err);
                },
                None,
            ).map_err(|e| format!("创建音频流失败: {}", e))?;

            stream.play().map_err(|e| format!("播放音频流失败: {}", e))?;
        }
        SampleFormat::U16 => {
            let stream = device.build_input_stream(
                &config.into(),
                move |data: &[u16], _: &cpal::InputCallbackInfo| {
                    // 检查是否仍在捕获
                    let capturing = is_capturing_clone.lock().unwrap();
                    if !*capturing {
                        return;
                    }
                    drop(capturing);

                    // 转换为 f32
                    let mut f32_data: Vec<f32> = data.iter()
                        .map(|&s| (s as f32 - 32768.0) / 32768.0)
                        .collect();

                    // 处理音频数据
                    {
                        let mut proc = processor.lock().unwrap();
                        proc.process(&mut f32_data);
                    }

                    // 将音频数据存入缓冲区
                    buffer.push(&f32_data);

                    // 发送音频数据事件
                    let _ = app_handle.emit("audio_data", f32_data);
                },
                move |err| {
                    eprintln!("音频流错误: {}", err);
                },
                None,
            ).map_err(|e| format!("创建音频流失败: {}", e))?;

            stream.play().map_err(|e| format!("播放音频流失败: {}", e))?;
        }
        _ => {
            return Err(format!("不支持的采样格式: {:?}", config.sample_format()));
        }
    }

    Ok(())
}

// 停止音频捕获
#[tauri::command]
pub fn stop_audio_capture(state: tauri::State<'_, AudioCaptureState>) -> Result<(), String> {
    let mut is_capturing = state.is_capturing.lock().unwrap();
    *is_capturing = false;
    Ok(())
}

// 获取音频捕获状态
#[tauri::command]
pub fn get_audio_capture_status(state: tauri::State<'_, AudioCaptureState>) -> Result<bool, String> {
    let is_capturing = state.is_capturing.lock().unwrap();
    Ok(*is_capturing)
}
