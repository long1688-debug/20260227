
// 文档转换模块 - 使用 LibreOffice 将文档转换为 PDF
use crate::proc_util::NoWindow;
use std::path::PathBuf;
use std::process::Command;
use std::fs;
use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use lazy_static::lazy_static;

// 全局临时目录
lazy_static! {
    static ref TEMP_DIR: PathBuf = {
        let mut temp = std::env::temp_dir();
        temp.push("tauri-doc-converter");
        if !temp.exists() {
            fs::create_dir_all(&temp).unwrap_or_else(|e| {
                panic!("无法创建临时目录: {} (路径: {:?})", e, temp);
            });
        }
        temp
    };
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConversionResult {
    pub success: bool,
    pub pdf_path: Option<String>,
    pub blob_url: Option<String>,
    pub cached: bool,
    pub error_message: Option<String>,
}

/// 查找 LibreOffice 可执行文件路径
fn find_libreoffice() -> Result<PathBuf> {
    // 优先尝试常见安装路径
    let common_paths = vec![
        // Windows
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        r"C:\Program Files\LibreOffice\program\soffice.com",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.com",
        // Linux
        "/usr/bin/libreoffice",
        "/usr/bin/soffice",
        "/opt/libreoffice/program/soffice",
        // macOS
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    ];

    for path in common_paths {
        let path_buf = PathBuf::from(path);
        if path_buf.exists() {
            return Ok(path_buf);
        }
    }

    // 如果常见路径都不存在，尝试使用 which 命令查找
    #[cfg(unix)]
    {
        if let Ok(output) = Command::new("which").no_window().arg("libreoffice").output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                return Ok(PathBuf::from(path));
            }
        }
    }

    #[cfg(windows)]
    {
        if let Ok(output) = Command::new("where").no_window().arg("soffice").output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).lines().next().unwrap_or("").to_string();
                return Ok(PathBuf::from(path));
            }
        }
    }

    Err(anyhow::anyhow!("未找到 LibreOffice 安装"))
}

/// 将文档转换为 PDF
pub fn convert_to_pdf(input_path: PathBuf, app_handle: Option<tauri::AppHandle>) -> Result<ConversionResult> {
    // 检查输入文件是否存在
    if !input_path.exists() {
        return Ok(ConversionResult {
            success: false,
            pdf_path: None,
            blob_url: None,
            cached: false,
            error_message: Some(format!("输入文件不存在: {:?}", input_path)),
        });
    }

    // 计算输入文件的哈希值作为缓存键
    let file_hash = calculate_file_hash(&input_path)?;
    let pdf_filename = format!("{}_{}.pdf",
        input_path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("document"),
        file_hash
    );
    let pdf_path = TEMP_DIR.join(&pdf_filename);

    // 检查缓存
    if pdf_path.exists() {
        let blob_url = if let Some(handle) = app_handle {
            Some(format!("http://localhost:{}/{}",
                get_port(&handle),
                pdf_path.file_name().and_then(|s| s.to_str()).unwrap_or("document.pdf")
            ))
        } else {
            None
        };

        return Ok(ConversionResult {
            success: true,
            pdf_path: Some(pdf_path.to_string_lossy().to_string()),
            blob_url,
            cached: true,
            error_message: None,
        });
    }

    // 查找 LibreOffice
    let libreoffice_path = find_libreoffice()
        .context("查找 LibreOffice 失败")?;

    // 使用临时目录作为输出目录
    let output_dir = TEMP_DIR.as_path();

    // 调用 LibreOffice 进行转换
    let output = Command::new(&libreoffice_path).no_window()
        .arg("--headless")
        .arg("--convert-to")
        .arg("pdf")
        .arg("--outdir")
        .arg(output_dir)
        .arg(&input_path)
        .output()
        .context("执行 LibreOffice 转换命令失败")?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr).to_string();
        return Ok(ConversionResult {
            success: false,
            pdf_path: None,
            blob_url: None,
            cached: false,
            error_message: Some(format!("LibreOffice 转换失败: {}", error_msg)),
        });
    }

    // 构造输出 PDF 文件路径
    let pdf_path = output_dir.join(
        input_path.file_stem()
            .ok_or_else(|| anyhow::anyhow!("无法获取文件名"))?
    )
    .with_extension("pdf");

    // 检查 PDF 文件是否生成成功
    if pdf_path.exists() {
        let blob_url = if let Some(handle) = app_handle {
            Some(format!("http://localhost:{}/{}",
                get_port(&handle),
                pdf_path.file_name().and_then(|s| s.to_str()).unwrap_or("document.pdf")
            ))
        } else {
            None
        };

        Ok(ConversionResult {
            success: true,
            pdf_path: Some(pdf_path.to_string_lossy().to_string()),
            blob_url,
            cached: false,
            error_message: None,
        })
    } else {
        Ok(ConversionResult {
            success: false,
            pdf_path: None,
            blob_url: None,
            cached: false,
            error_message: Some("PDF 文件生成失败".to_string()),
        })
    }
}

/// 计算文件的哈希值（用于缓存键）
fn calculate_file_hash(path: &PathBuf) -> Result<String> {
    use std::io::Read;
    use std::collections::hash_map::DefaultHasher;
    use std::hash::Hasher;

    let mut file = fs::File::open(path)?;
    let mut hasher = DefaultHasher::new();
    let mut buffer = [0u8; 8192];

    loop {
        let n = file.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        hasher.write(&buffer[..n]);
    }

    Ok(format!("{:x}", hasher.finish()))
}

/// 获取 Tauri 应用端口
fn get_port(_handle: &tauri::AppHandle) -> u16 {
    // 默认返回 5174 端口
    // 注意：在 Tauri 2.0 中，配置访问方式已改变
    // 如需获取实际配置，应使用 handle.config() 的正确 API
    5174
}

#[tauri::command]
pub async fn convert_document_to_pdf(file_path: String, app_handle: tauri::AppHandle) -> Result<ConversionResult, String> {
    let path = PathBuf::from(&file_path);
    convert_to_pdf(path, Some(app_handle)).map_err(|e| e.to_string())
}
