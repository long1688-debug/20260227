/// 视频采集设备管理模块
/// 支持采集卡、高拍仪等硬件设备的枚举和控制

use serde::{Deserialize, Serialize};
use std::sync::Mutex;

/// 采集设备信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureDeviceInfo {
    pub id: String,
    pub name: String,
    pub device_type: CaptureDeviceType,
    pub interface_type: Option<String>, // HDMI, SDI, USB, etc.
    pub resolution: Option<String>,     // "1920x1080", "3840x2160", etc.
    pub fps: Option<u32>,
    pub is_available: bool,
}

/// 采集设备类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CaptureDeviceType {
    CaptureCard,    // 采集卡
    DocumentScanner, // 高拍仪/文档扫描仪
}

/// 高拍仪配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScannerConfig {
    pub device_id: String,
    pub mode: ScannerMode, // single, continuous, auto_focus
    pub resolution: String,
    pub enable_enhancement: bool,
    pub enable_auto_crop: bool,
}

/// 高拍仪扫描模式
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ScannerMode {
    Single,      // 单页扫描
    Continuous,  // 连续扫描
    AutoFocus,   // 自动对焦
}

/// 采集设备状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureDeviceState {
    pub devices: Vec<CaptureDeviceInfo>,
    pub active_device_id: Option<String>,
}

impl Default for CaptureDeviceState {
    fn default() -> Self {
        Self {
            devices: Vec::new(),
            active_device_id: None,
        }
    }
}

/// Tauri 状态管理
pub struct CaptureDeviceManager {
    pub state: Mutex<CaptureDeviceState>,
}

impl CaptureDeviceManager {
    pub fn new() -> Self {
        Self {
            state: Mutex::new(CaptureDeviceState::default()),
        }
    }

    /// 刷新设备列表
    pub fn refresh_devices(&self) -> Result<Vec<CaptureDeviceInfo>, String> {
        let mut state = self.state.lock().map_err(|e| format!("锁定状态失败: {}", e))?;
        
        // TODO: 实际实现需要调用系统 API 枚举设备
        // Windows: DirectShow / Media Foundation
        // Linux: V4L2 (Video for Linux 2)
        // macOS: AVFoundation
        
        #[cfg(target_os = "windows")]
        {
            // Windows 平台实现
            state.devices = self.enumerate_windows_devices()?;
        }
        
        #[cfg(target_os = "linux")]
        {
            // Linux 平台实现
            state.devices = self.enumerate_linux_devices()?;
        }
        
        #[cfg(target_os = "macos")]
        {
            // macOS 平台实现
            state.devices = self.enumerate_macos_devices()?;
        }
        
        Ok(state.devices.clone())
    }

    /// 启动采集设备
    pub fn start_capture(&self, device_id: &str) -> Result<String, String> {
        let mut state = self.state.lock().map_err(|e| format!("锁定状态失败: {}", e))?;
        
        // 检查设备是否存在
        let device = state.devices.iter()
            .find(|d| d.id == device_id)
            .ok_or_else(|| format!("设备不存在: {}", device_id))?;
        
        if !device.is_available {
            return Err(format!("设备不可用: {}", device.name));
        }
        
        // TODO: 实际启动采集逻辑
        // 返回流 ID 或句柄
        state.active_device_id = Some(device_id.to_string());
        
        Ok(format!("stream_{}", device_id))
    }

    /// 停止采集设备
    pub fn stop_capture(&self, device_id: &str) -> Result<(), String> {
        let mut state = self.state.lock().map_err(|e| format!("锁定状态失败: {}", e))?;
        
        if state.active_device_id.as_deref() == Some(device_id) {
            state.active_device_id = None;
            // TODO: 实际停止采集逻辑
        }
        
        Ok(())
    }

    /// 高拍仪拍照
    pub fn scanner_capture(&self, _config: &ScannerConfig) -> Result<String, String> {
        // TODO: 调用高拍仪 SDK 进行拍照
        // 返回图片文件路径
        
        let image_path = format!("/tmp/scanner_capture_{}.jpg", chrono::Utc::now().timestamp());
        
        // 模拟保存图片
        println!("[高拍仪] 拍照完成: {}", image_path);
        
        Ok(image_path)
    }

    /// 设置高拍仪参数
    pub fn set_scanner_config(&self, config: &ScannerConfig) -> Result<(), String> {
        // TODO: 应用高拍仪配置
        println!("[高拍仪] 配置更新: {:?}", config);
        Ok(())
    }

    // ============================================
    // 平台特定实现
    // ============================================

    #[cfg(target_os = "windows")]
    fn enumerate_windows_devices(&self) -> Result<Vec<CaptureDeviceInfo>, String> {
        // TODO: 使用 DirectShow 或 Media Foundation 枚举设备
        // 这里返回模拟数据用于测试
        Ok(vec![
            CaptureDeviceInfo {
                id: "capture_card_001".to_string(),
                name: "HDMI 采集卡 #1".to_string(),
                device_type: CaptureDeviceType::CaptureCard,
                interface_type: Some("HDMI".to_string()),
                resolution: Some("1920x1080".to_string()),
                fps: Some(60),
                is_available: true,
            },
            CaptureDeviceInfo {
                id: "scanner_001".to_string(),
                name: "良田高拍仪 S500L".to_string(),
                device_type: CaptureDeviceType::DocumentScanner,
                interface_type: Some("USB".to_string()),
                resolution: Some("2592x1944".to_string()),
                fps: Some(30),
                is_available: true,
            },
        ])
    }

    #[cfg(target_os = "linux")]
    fn enumerate_linux_devices(&self) -> Result<Vec<CaptureDeviceInfo>, String> {
        // TODO: 使用 V4L2 枚举设备
        use std::fs;
        
        let mut devices = Vec::new();
        
        // 扫描 /dev/video* 设备
        if let Ok(entries) = fs::read_dir("/dev") {
            for entry in entries {
                if let Ok(entry) = entry {
                    if let Some(name) = entry.file_name().to_str() {
                        if name.starts_with("video") {
                            devices.push(CaptureDeviceInfo {
                                id: name.to_string(),
                                name: format!("V4L2 设备 ({})", name),
                                device_type: CaptureDeviceType::CaptureCard,
                                interface_type: Some("V4L2".to_string()),
                                resolution: None,
                                fps: None,
                                is_available: true,
                            });
                        }
                    }
                }
            }
        }
        
        Ok(devices)
    }

    #[cfg(target_os = "macos")]
    fn enumerate_macos_devices(&self) -> Result<Vec<CaptureDeviceInfo>, String> {
        // TODO: 使用 AVFoundation 枚举设备
        Ok(vec![])
    }
}

// ============================================
// Tauri Commands
// ============================================

/// 获取采集设备列表
#[tauri::command(async)]
pub fn list_capture_devices(manager: tauri::State<CaptureDeviceManager>) -> Result<Vec<CaptureDeviceInfo>, String> {
    manager.refresh_devices()
}

/// 启动采集设备
#[tauri::command(async)]
pub fn start_capture_device(
    manager: tauri::State<CaptureDeviceManager>,
    device_id: String,
) -> Result<String, String> {
    manager.start_capture(&device_id)
}

/// 停止采集设备
#[tauri::command(async)]
pub fn stop_capture_device(
    manager: tauri::State<CaptureDeviceManager>,
    device_id: String,
) -> Result<(), String> {
    manager.stop_capture(&device_id)
}

/// 高拍仪拍照
#[tauri::command(async)]
pub fn scanner_take_photo(
    manager: tauri::State<CaptureDeviceManager>,
    config: ScannerConfig,
) -> Result<String, String> {
    manager.scanner_capture(&config)
}

/// 设置高拍仪配置
#[tauri::command(async)]
pub fn set_scanner_configuration(
    manager: tauri::State<CaptureDeviceManager>,
    config: ScannerConfig,
) -> Result<(), String> {
    manager.set_scanner_config(&config)
}
