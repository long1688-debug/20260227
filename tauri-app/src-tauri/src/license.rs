// 授权管理模块 - 迁移自 license-integration-v2.js
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;
use chrono::{DateTime, Utc};
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RegistrationInfo {
    pub activated: bool,
    pub machine_code: String,
    pub registration_code: Option<String>,
    pub user_name: String,
    pub license_type: String, // "permanent" or "temporary"
    pub trial_months: Option<u32>,
    pub register_date: Option<String>,
    pub expiry_date: Option<String>,
    pub device_count: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RegistrationStatus {
    pub activated: bool,
    pub info: Option<RegistrationInfo>,
    pub machine_code: String,
    pub trial: Option<TrialInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TrialInfo {
    pub start_time: u64,
    pub remaining: u64,
}

const TRIAL_DAYS: u64 = 30;

// 生成机器码
pub fn generate_machine_code() -> String {
    use sysinfo::System;

    let sys = System::new_all();

    // 优先使用 MAC 地址
    let mac = get_mac_address();
    if !mac.is_empty() {
        let machine_data = format!("{}|{}|{}", mac, std::env::consts::OS, std::env::consts::ARCH);
        return hash_to_machine_code(&machine_data);
    }

    // 备用方案：使用 CPU + 主机名
    let cpu_info = sys.cpus().first()
        .map(|cpu| cpu.brand())
        .unwrap_or("unknown");
    let hostname = System::host_name().unwrap_or_default();
    let fallback_data = format!("{}|{}|{}", cpu_info, hostname, std::env::consts::ARCH);
    hash_to_machine_code(&fallback_data)
}

fn get_mac_address() -> String {
    // 简单实现：使用网络接口获取 MAC
    // 在生产环境中可能需要更完善的实现
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        use crate::proc_util::NoWindow;
        let output = Command::new("getmac").no_window()
            .arg("/NH")
            .arg("/FO")
            .arg("CSV")
            .output()
            .ok();

        if let Some(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                let parts: Vec<&str> = line.split(',').collect();
                if parts.len() > 0 {
                    let mac = parts[0].trim().replace("-", ":");
                    if mac.len() == 17 {
                        return mac.to_uppercase();
                    }
                }
            }
        }
    }

    String::new()
}

fn hash_to_machine_code(data: &str) -> String {
    use sha2::{Sha256, Digest};

    let mut hasher = Sha256::new();
    hasher.update(data.as_bytes());
    let hash = hasher.finalize();
    let hash_hex = format!("{:x}", hash);

    // 格式化为 XXXX-XXXX-XXXX-XXXX
    let chars: Vec<char> = hash_hex.to_uppercase().chars().collect();
    format!(
        "{}-{}-{}-{}",
        chars[0..4].iter().collect::<String>(),
        chars[4..8].iter().collect::<String>(),
        chars[8..12].iter().collect::<String>(),
        chars[12..16].iter().collect::<String>()
    )
}

// 获取注册数据文件路径
fn get_registration_data_dir(app_data_dir: PathBuf) -> PathBuf {
    app_data_dir.join("registration")
}

fn get_db_file(app_data_dir: PathBuf) -> PathBuf {
    get_registration_data_dir(app_data_dir).join("codes.json")
}

fn get_registration_file(app_data_dir: PathBuf) -> PathBuf {
    get_registration_data_dir(app_data_dir).join("registration.json")
}

// 初始化注册码数据库（如果不存在）
fn init_codes_db(app_data_dir: &PathBuf) -> Result<(), String> {
    let codes_file = get_db_file(app_data_dir.clone());

    if codes_file.exists() {
        return Ok(());
    }

    // 创建注册数据目录
    let data_dir = get_registration_data_dir(app_data_dir.clone());
    fs::create_dir_all(&data_dir)
        .map_err(|e| format!("创建目录失败: {}", e))?;

    // 创建初始注册码数据库
    let default_codes = serde_json::json!([
        {
            "code": "DEMO-PRO-2024-0001",
            "status": "active",
            "licenseType": "permanent",
            "trialMonths": null
        },
        {
            "code": "DEMO-TRL-2024-0001",
            "status": "active",
            "licenseType": "temporary",
            "trialMonths": 3
        }
    ]);

    write_json_file(&codes_file, &default_codes)
        .map_err(|e| format!("初始化注册码数据库失败: {}", e))
}

// 读取 JSON 数据
fn read_json_file<T: serde::de::DeserializeOwned>(path: &PathBuf) -> Option<T> {
    if path.exists() {
        let content = fs::read_to_string(path).ok()?;
        serde_json::from_str(&content).ok()
    } else {
        None
    }
}

// 写入 JSON 数据
fn write_json_file<T: Serialize>(path: &PathBuf, data: &T) -> Result<(), String> {
    let content = serde_json::to_string_pretty(data)
        .map_err(|e| e.to_string())?;
    fs::write(path, content)
        .map_err(|e| e.to_string())
}

#[tauri::command(async)]
pub fn get_machine_code() -> String {
    generate_machine_code()
}

#[tauri::command(async)]
pub fn get_registration_status(app_handle: tauri::AppHandle) -> Result<RegistrationStatus, String> {
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .to_path_buf();

    let machine_code = generate_machine_code();
    let registration_file = get_registration_file(app_data_dir.clone());

    // 尝试加载注册信息
    if let Some(registration) = read_json_file::<RegistrationInfo>(&registration_file) {
        if registration.activated {
            // 检查是否过期
            if registration.license_type == "temporary" {
                if let Some(expiry_str) = &registration.expiry_date {
                    if let Ok(expiry_date) = expiry_str.parse::<DateTime<Utc>>() {
                        if expiry_date < Utc::now() {
                            // 已过期，删除注册信息
                            let _ = fs::remove_file(&registration_file);
                            return start_trial(&registration_file);
                        }
                    }
                }
            }

            return Ok(RegistrationStatus {
                activated: true,
                info: Some(registration),
                machine_code,
                trial: None,
            });
        }
    }

    // 未注册，开始试用
    start_trial(&registration_file)
}

fn start_trial(registration_file: &PathBuf) -> Result<RegistrationStatus, String> {
    let now = Utc::now();
    let trial_end = now + chrono::Duration::days(TRIAL_DAYS as i64);

    let trial_info = TrialInfo {
        start_time: now.timestamp_millis() as u64,
        remaining: (trial_end - now).num_milliseconds() as u64,
    };

    // 使用统一的 RegistrationInfo 结构保存试用信息
    let trial_registration = RegistrationInfo {
        activated: false,
        machine_code: generate_machine_code(),
        registration_code: None,
        user_name: "试用用户".to_string(),
        license_type: "trial".to_string(),
        trial_months: Some(1),
        register_date: Some(now.to_rfc3339()),
        expiry_date: Some(trial_end.to_rfc3339()),
        device_count: 1,
    };

    let _ = write_json_file(registration_file, &trial_registration);

    Ok(RegistrationStatus {
        activated: false,
        info: None,
        machine_code: generate_machine_code(),
        trial: Some(trial_info),
    })
}

#[derive(Debug, Deserialize)]
pub struct ActivateRequest {
    pub registration_code: String,
    pub user_name: String,
    pub server_url: Option<String>,
}

#[tauri::command]
pub async fn activate_registration(
    app_handle: tauri::AppHandle,
    request: ActivateRequest,
) -> Result<ActivationResult, String> {
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .to_path_buf();

    // 初始化注册码数据库（如果不存在）
    let _ = init_codes_db(&app_data_dir);

    let machine_code = generate_machine_code();

    // 验证注册码格式
    if !is_valid_registration_code(&request.registration_code) {
        return Ok(ActivationResult {
            success: false,
            message: "注册码格式不正确".to_string(),
            info: None,
        });
    }

    // 尝试本地验证（离线模式）
    let codes_file = get_db_file(app_data_dir.clone());
    if let Ok(codes) = fs::read_to_string(&codes_file) {
        if let Ok(codes_array) = serde_json::from_str::<serde_json::Value>(&codes) {
            if let Some(codes) = codes_array.as_array() {
                for code in codes {
                    if let Some(code_str) = code.get("code").and_then(|v| v.as_str()) {
                        if code_str == request.registration_code {
                            if let Some(status) = code.get("status").and_then(|v| v.as_str()) {
                                if status == "active" {
                                    // 找到有效注册码
                                    return activate_locally(
                                        &app_data_dir,
                                        code,
                                        &request.registration_code,
                                        &request.user_name,
                                        &machine_code,
                                    ).await;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 尝试在线验证
    let server_url = request.server_url.clone().unwrap_or_else(|| "http://localhost:3000/api".to_string());
    activate_online(&request.registration_code, &request.user_name, &machine_code, &server_url).await
}

fn is_valid_registration_code(code: &str) -> bool {
    // 格式：XXXX-XXXX-XXXX-XXXX
    let parts: Vec<&str> = code.split('-').collect();
    if parts.len() != 4 {
        return false;
    }

    // 检查第二部分是否为 PRO 或 TRL
    if parts[1] != "PRO" && parts[1] != "TRL" {
        return false;
    }

    // 检查其他部分是否为字母数字
    for (i, part) in parts.iter().enumerate() {
        if i == 1 {
            continue;
        }
        if !part.chars().all(|c| c.is_alphanumeric()) {
            return false;
        }
    }

    true
}

async fn activate_locally(
    app_data_dir: &PathBuf,
    code: &serde_json::Value,
    registration_code: &str,
    user_name: &str,
    machine_code: &str,
) -> Result<ActivationResult, String> {
    let license_type = code.get("licenseType")
        .and_then(|v| v.as_str())
        .unwrap_or("temporary")
        .to_string();

    let trial_months = code.get("trialMonths")
        .and_then(|v| v.as_u64())
        .map(|m| m as u32);

    let expiry_date = if license_type == "permanent" {
        None
    } else {
        let months = trial_months.unwrap_or(1);
        let expiry = Utc::now() + chrono::Duration::days((months * 30) as i64);
        Some(expiry.to_rfc3339())
    };

    let registration_info = RegistrationInfo {
        activated: true,
        machine_code: machine_code.to_string(),
        registration_code: Some(registration_code.to_string()),
        user_name: user_name.to_string(),
        license_type,
        trial_months,
        register_date: Some(Utc::now().to_rfc3339()),
        expiry_date,
        device_count: 1,
    };

    // 保存注册信息
    let registration_file = get_registration_file(app_data_dir.clone());
    write_json_file(&registration_file, &registration_info)?;

    Ok(ActivationResult {
        success: true,
        message: "激活成功".to_string(),
        info: Some(registration_info),
    })
}

async fn activate_online(
    registration_code: &str,
    user_name: &str,
    machine_code: &str,
    server_url: &str,
) -> Result<ActivationResult, String> {
    // 在线验证逻辑
    // 使用传入的服务器地址或默认地址
    
    // 构建请求体
    let request_body = serde_json::json!({
        "registrationCode": registration_code,
        "machineCode": machine_code,
        "userName": user_name,
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "timestamp": chrono::Utc::now().timestamp()
    });
    
    // 发送在线验证请求
    match send_online_request(server_url, "/activate", &request_body).await {
        Ok(response) => {
            // 解析服务器响应
            if let Some(success) = response.get("success").and_then(|v| v.as_bool()) {
                if success {
                    // 激活成功，提取许可证信息
                    let license_type = response.get("licenseType")
                        .and_then(|v| v.as_str())
                        .unwrap_or("temporary")
                        .to_string();
                    
                    let trial_months = response.get("trialMonths")
                        .and_then(|v| v.as_u64())
                        .map(|m| m as u32);
                    
                    let expiry_date = if license_type == "permanent" {
                        None
                    } else {
                        response.get("expiresAt")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string())
                            .or_else(|| {
                                // 如果服务器没有返回到期日期，根据试用月数计算
                                trial_months.map(|months| {
                                    let expiry = chrono::Utc::now() + chrono::Duration::days((months as i64) * 30);
                                    expiry.to_rfc3339()
                                })
                            })
                    };
                    
                    // 构建立即信息
                    let registration_info = RegistrationInfo {
                        activated: true,
                        machine_code: machine_code.to_string(),
                        registration_code: Some(registration_code.to_string()),
                        user_name: user_name.to_string(),
                        license_type,
                        trial_months,
                        register_date: Some(chrono::Utc::now().to_rfc3339()),
                        expiry_date,
                        device_count: 1,
                    };
                    
                    return Ok(ActivationResult {
                        success: true,
                        message: response.get("message")
                            .and_then(|v| v.as_str())
                            .unwrap_or("激活成功")
                            .to_string(),
                        info: Some(registration_info),
                    });
                } else {
                    // 激活失败
                    return Ok(ActivationResult {
                        success: false,
                        message: response.get("message")
                            .and_then(|v| v.as_str())
                            .unwrap_or("激活失败")
                            .to_string(),
                        info: None,
                    });
                }
            }
            
            // 响应格式不正确
            Ok(ActivationResult {
                success: false,
                message: "服务器响应格式错误".to_string(),
                info: None,
            })
        }
        Err(e) => {
            // 网络请求失败
            Ok(ActivationResult {
                success: false,
                message: format!("网络连接失败: {} - 请检查网络或使用离线注册码", e),
                info: None,
            })
        }
    }
}

/// 发送HTTP请求到注册服务器
async fn send_online_request(
    base_url: &str,
    endpoint: &str,
    body: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    use std::time::Duration;
    
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;
    
    let url = format!("{}{}", base_url.trim_end_matches('/'), endpoint);
    
    let response = client
        .post(&url)
        .json(body)
        .send()
        .await
        .map_err(|e| {
            if e.is_connect() {
                "无法连接到注册服务器".to_string()
            } else if e.is_timeout() {
                "连接超时".to_string()
            } else {
                e.to_string()
            }
        })?;
    
    let status = response.status();
    if !status.is_success() {
        return Err(format!("服务器返回错误: {}", status));
    }
    
    response
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))
}

#[derive(Debug, Serialize)]
pub struct ActivationResult {
    pub success: bool,
    pub message: String,
    pub info: Option<RegistrationInfo>,
}

#[tauri::command(async)]
pub fn deactivate_registration(app_handle: tauri::AppHandle) -> Result<bool, String> {
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .to_path_buf();

    let registration_file = get_registration_file(app_data_dir);

    if registration_file.exists() {
        fs::remove_file(&registration_file)
            .map_err(|e| e.to_string())?;
    }

    Ok(true)
}
