/**
 * 跨平台设备检测命令
 *
 * 提供平台信息、触摸能力、硬件加速等检测功能，
 * 支持 Windows/Android/Linux 多平台。
 */

use serde::{Deserialize, Serialize};
use std::env;

/// 平台信息结构
#[derive(Serialize, Deserialize, Debug)]
pub struct PlatformInfo {
    pub platform: String,
    pub os_version: String,
    pub arch: String,
    pub device_model: String,
}

/// 获取当前运行平台信息
#[tauri::command]
pub fn get_platform_info() -> Result<PlatformInfo, String> {
    let platform = env::consts::OS.to_string();
    let arch = env::consts::ARCH.to_string();

    // 获取操作系统版本
    let os_version = match platform.as_str() {
        "windows" => {
            // Windows 版本检测
            if let Ok(version) = windows_version() {
                version
            } else {
                "Unknown".to_string()
            }
        }
        "linux" => {
            // Linux 发行版检测
            if let Ok(distro) = get_linux_distro() {
                distro
            } else {
                "Linux".to_string()
            }
        }
        "macos" => "macOS".to_string(),
        "android" => "Android".to_string(),
        _ => "Unknown".to_string(),
    };

    // 获取设备型号（简化实现）
    let device_model = format!("{} {}", platform, arch);

    Ok(PlatformInfo {
        platform,
        os_version,
        arch,
        device_model,
    })
}

/// 检测设备是否支持触摸
#[tauri::command]
pub fn is_touch_device() -> bool {
    #[cfg(target_os = "windows")]
    {
        // Windows: 检查系统是否有触摸设备
        return has_windows_touch_capability();
    }

    #[cfg(target_os = "android")]
    {
        // Android: 总是支持触摸
        return true;
    }

    #[cfg(target_os = "linux")]
    {
        // Linux: 检查输入设备
        return has_linux_touchscreen();
    }

    #[cfg(not(any(target_os = "windows", target_os = "android", target_os = "linux")))]
    {
        false
    }
}

/// 获取 Linux 发行版信息
#[tauri::command]
pub fn get_linux_distro() -> Result<String, String> {
    #[cfg(target_os = "linux")]
    {
        linux_distro()
    }

    #[cfg(not(target_os = "linux"))]
    {
        Err("Not running on Linux".to_string())
    }
}

/// 获取设备型号
#[tauri::command]
pub fn get_device_model() -> Result<String, String> {
    #[cfg(target_os = "android")]
    {
        // Android: 从系统属性读取
        return Ok(android_device_model());
    }

    #[cfg(target_os = "windows")]
    {
        // Windows: 从注册表或 WMI 读取
        return Ok(windows_device_model());
    }

    #[cfg(target_os = "linux")]
    {
        // Linux: 从 DMI 信息读取
        return Ok(linux_device_model());
    }

    #[cfg(not(any(target_os = "android", target_os = "windows", target_os = "linux")))]
    {
        Ok("Unknown".to_string())
    }
}

/// 检查 GPU 硬件加速能力
#[tauri::command]
pub fn check_gpu_acceleration() -> bool {
    // 检测可用的硬件编码器
    has_hardware_encoder()
}

// ========== 辅助函数 ==========

/// 获取 Windows 版本
#[cfg(target_os = "windows")]
fn windows_version() -> Result<String, String> {
    use std::process::Command;

    let output = Command::new("powershell")
        .args(&["-Command", "(Get-WmiObject Win32_OperatingSystem).Caption"])
        .output()
        .map_err(|e| format!("Failed to get Windows version: {}", e))?;

    let version = String::from_utf8_lossy(&output.stdout)
        .trim()
        .to_string();

    Ok(if version.is_empty() {
        "Windows".to_string()
    } else {
        version
    })
}

#[cfg(not(target_os = "windows"))]
fn windows_version() -> Result<String, String> {
    Err("not windows".to_string())
}

/// 检查 Windows 触摸能力
#[cfg(target_os = "windows")]
fn has_windows_touch_capability() -> bool {
    use std::process::Command;

    // 通过 PowerShell 检查触摸设备
    let output = Command::new("powershell")
        .args(&[
            "-Command",
            "Get-PnpDevice -Class 'HIDClass' | Where-Object {$_.FriendlyName -like '*Touch*'} | Measure-Object | Select-Object -ExpandProperty Count"
        ])
        .output();

    match output {
        Ok(output) => {
            let count = String::from_utf8_lossy(&output.stdout)
                .trim()
                .parse::<u32>()
                .unwrap_or(0);
            count > 0
        }
        Err(_) => false,
    }
}

/// 获取 Windows 设备型号
#[cfg(target_os = "windows")]
fn windows_device_model() -> String {
    use std::process::Command;

    let output = Command::new("powershell")
        .args(&[
            "-Command",
            "(Get-WmiObject Win32_ComputerSystem).Model"
        ])
        .output();

    match output {
        Ok(output) => {
            let model = String::from_utf8_lossy(&output.stdout)
                .trim()
                .to_string();
            if model.is_empty() {
                "Windows PC".to_string()
            } else {
                model
            }
        }
        Err(_) => "Windows PC".to_string(),
    }
}

/// 获取 Linux 发行版信息
#[cfg(target_os = "linux")]
fn linux_distro() -> Result<String, String> {
    use std::fs;

    // 读取 /etc/os-release
    let content = fs::read_to_string("/etc/os-release")
        .map_err(|e| format!("Failed to read os-release: {}", e))?;

    // 解析 ID 字段
    for line in content.lines() {
        if line.starts_with("ID=") {
            let id = line.trim_start_matches("ID=").trim_matches('"');
            return Ok(id.to_string());
        }
    }

    Ok("linux".to_string())
}

/// 检查 Linux 是否有触摸屏
#[cfg(target_os = "linux")]
fn has_linux_touchscreen() -> bool {
    use std::fs;

    // 检查 /proc/bus/input/devices
    if let Ok(content) = fs::read_to_string("/proc/bus/input/devices") {
        return content.contains("EV=100013") || content.contains("Touchscreen");
    }

    false
}

/// 获取 Linux 设备型号
#[cfg(target_os = "linux")]
fn linux_device_model() -> String {
    use std::fs;

    // 尝试从 DMI 信息读取
    if let Ok(model) = fs::read_to_string("/sys/class/dmi/id/product_name") {
        return model.trim().to_string();
    }

    "Linux Device".to_string()
}

/// 获取 Android 设备型号
#[cfg(target_os = "android")]
fn android_device_model() -> String {
    // Android 需要通过 JNI 调用 Java API
    // 这里返回简化版本
    "Android Device".to_string()
}

/// 检测是否有硬件编码器
fn has_hardware_encoder() -> bool {
    // 简化实现：检查常见硬件编码器
    #[cfg(target_os = "windows")]
    {
        return check_windows_gpu_encoders();
    }

    #[cfg(target_os = "linux")]
    {
        return check_linux_gpu_encoders();
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        false
    }
}

#[cfg(target_os = "windows")]
fn check_windows_gpu_encoders() -> bool {
    use std::process::Command;

    // 检查 NVIDIA NVENC
    let nvidia = Command::new("nvidia-smi")
        .output()
        .is_ok();

    if nvidia {
        return true;
    }

    // 检查 Intel QuickSync
    let intel = Command::new("powershell")
        .args(&["-Command", "Get-CimInstance Win32_VideoController | Where-Object {$_.Name -like '*Intel*'}"])
        .output()
        .is_ok();

    intel
}

#[cfg(target_os = "linux")]
fn check_linux_gpu_encoders() -> bool {
    use std::process::Command;

    // 检查 VAAPI
    let vaapi = Command::new("vainfo")
        .output()
        .is_ok();

    if vaapi {
        return true;
    }

    // 检查 NVIDIA
    let nvidia = Command::new("nvidia-smi")
        .output()
        .is_ok();

    nvidia
}
