// 音频设备管理模块
// 提供音频设备枚举和选择功能

use std::sync::{Arc, Mutex};
use cpal::traits::{DeviceTrait, HostTrait};
use cpal::{Device, Host};
use serde::{Deserialize, Serialize};

// 音频设备信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioDeviceInfo {
    pub name: String,
    pub device_id: String,
    pub is_default: bool,
    pub sample_rate: u32,
    pub channels: u16,
    pub is_input: bool,
}

// 音频设备管理器
pub struct AudioDeviceManager {
    host: Host,
    current_input_device: Option<Device>,
    current_output_device: Option<Device>,
}

impl AudioDeviceManager {
    pub fn new() -> Self {
        AudioDeviceManager {
            host: cpal::default_host(),
            current_input_device: None,
            current_output_device: None,
        }
    }

    /// 获取所有输入设备
    pub fn get_input_devices(&self) -> Result<Vec<AudioDeviceInfo>, String> {
        let mut devices = Vec::new();

        // 获取默认设备名称
        let default_device_name = self.host.default_input_device()
            .and_then(|d| d.name().ok())
            .unwrap_or_else(|| String::from(""));

        // 枚举所有设备
        for device in self.host.input_devices()
            .map_err(|e| format!("获取输入设备失败: {}", e))? 
        {
            let name = device.name().unwrap_or_else(|_| String::from("未知设备"));
            let is_default = name == default_device_name;

            // 获取默认配置
            let config = device.default_input_config()
                .map_err(|e| format!("获取设备配置失败: {}", e))?;

            devices.push(AudioDeviceInfo {
                device_id: format!("input_{}", name.replace(" ", "_")),
                name,
                is_default,
                sample_rate: config.sample_rate().0,
                channels: config.channels(),
                is_input: true,
            });
        }

        Ok(devices)
    }

    /// 获取所有输出设备
    pub fn get_output_devices(&self) -> Result<Vec<AudioDeviceInfo>, String> {
        let mut devices = Vec::new();

        // 获取默认设备名称
        let default_device_name = self.host.default_output_device()
            .and_then(|d| d.name().ok())
            .unwrap_or_else(|| String::from(""));

        // 枚举所有设备
        for device in self.host.output_devices()
            .map_err(|e| format!("获取输出设备失败: {}", e))? 
        {
            let name = device.name().unwrap_or_else(|_| String::from("未知设备"));
            let is_default = name == default_device_name;

            // 获取默认配置
            let config = device.default_output_config()
                .map_err(|e| format!("获取设备配置失败: {}", e))?;

            devices.push(AudioDeviceInfo {
                device_id: format!("output_{}", name.replace(" ", "_")),
                name,
                is_default,
                sample_rate: config.sample_rate().0,
                channels: config.channels(),
                is_input: false,
            });
        }

        Ok(devices)
    }

    /// 获取所有设备（输入+输出）
    pub fn get_all_devices(&self) -> Result<Vec<AudioDeviceInfo>, String> {
        let mut devices = Vec::new();
        devices.extend(self.get_input_devices()?);
        devices.extend(self.get_output_devices()?);
        Ok(devices)
    }

    /// 设置当前输入设备
    pub fn set_input_device(&mut self, device_name: &str) -> Result<(), String> {
        for device in self.host.input_devices()
            .map_err(|e| format!("获取输入设备失败: {}", e))? 
        {
            if let Ok(name) = device.name() {
                if name == device_name {
                    self.current_input_device = Some(device);
                    println!("[AudioDevice] 已设置输入设备: {}", device_name);
                    return Ok(());
                }
            }
        }
        Err(format!("找不到输入设备: {}", device_name))
    }

    /// 设置当前输出设备
    pub fn set_output_device(&mut self, device_name: &str) -> Result<(), String> {
        for device in self.host.output_devices()
            .map_err(|e| format!("获取输出设备失败: {}", e))? 
        {
            if let Ok(name) = device.name() {
                if name == device_name {
                    self.current_output_device = Some(device);
                    println!("[AudioDevice] 已设置输出设备: {}", device_name);
                    return Ok(());
                }
            }
        }
        Err(format!("找不到输出设备: {}", device_name))
    }

    /// 获取当前输入设备
    pub fn get_current_input_device(&self) -> Option<&Device> {
        self.current_input_device.as_ref()
    }

    /// 获取当前输出设备
    pub fn get_current_output_device(&self) -> Option<&Device> {
        self.current_output_device.as_ref()
    }

    /// 获取默认输入设备
    pub fn get_default_input_device(&self) -> Result<Device, String> {
        self.host.default_input_device()
            .ok_or("找不到默认音频输入设备".to_string())
    }

    /// 获取默认输出设备
    pub fn get_default_output_device(&self) -> Result<Device, String> {
        self.host.default_output_device()
            .ok_or("找不到默认音频输出设备".to_string())
    }
}

impl Default for AudioDeviceManager {
    fn default() -> Self {
        Self::new()
    }
}

// 全局设备管理器状态
pub struct AudioDeviceState {
    pub manager: Arc<Mutex<AudioDeviceManager>>,
}

impl AudioDeviceState {
    pub fn new() -> Self {
        AudioDeviceState {
            manager: Arc::new(Mutex::new(AudioDeviceManager::new())),
        }
    }
}

impl Default for AudioDeviceState {
    fn default() -> Self {
        Self::new()
    }
}

// 获取所有音频设备（输入+输出）
#[tauri::command(async)]
pub fn get_audio_devices() -> Result<Vec<AudioDeviceInfo>, String> {
    let manager = AudioDeviceManager::new();
    manager.get_all_devices()
}

// 获取输入设备列表
#[tauri::command(async)]
pub fn get_input_devices() -> Result<Vec<AudioDeviceInfo>, String> {
    let manager = AudioDeviceManager::new();
    manager.get_input_devices()
}

// 获取输出设备列表
#[tauri::command(async)]
pub fn get_output_devices() -> Result<Vec<AudioDeviceInfo>, String> {
    let manager = AudioDeviceManager::new();
    manager.get_output_devices()
}

// 设置音频设备
#[tauri::command(async)]
pub fn set_audio_device(
    device_name: String, 
    is_input: bool,
    state: tauri::State<'_, AudioDeviceState>
) -> Result<(), String> {
    let mut manager = state.manager.lock().map_err(|e| format!("锁定设备管理器失败: {}", e))?;
    
    if is_input {
        manager.set_input_device(&device_name)
    } else {
        manager.set_output_device(&device_name)
    }
}

// 获取设备信息
#[tauri::command(async)]
pub fn get_device_info(device_name: String) -> Result<AudioDeviceInfo, String> {
    let manager = AudioDeviceManager::new();
    
    // 先尝试在输入设备中查找
    if let Ok(devices) = manager.get_input_devices() {
        if let Some(device) = devices.iter().find(|d| d.name == device_name) {
            return Ok(device.clone());
        }
    }
    
    // 再尝试在输出设备中查找
    if let Ok(devices) = manager.get_output_devices() {
        if let Some(device) = devices.iter().find(|d| d.name == device_name) {
            return Ok(device.clone());
        }
    }
    
    Err(format!("找不到设备: {}", device_name))
}
