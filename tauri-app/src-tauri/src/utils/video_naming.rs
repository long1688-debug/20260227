use chrono::Local;

/// 安全过滤文件名（保留中英文、数字、_、-，其余替换为 _）
pub fn sanitize_filename_part(input: &str) -> String {
    input
        .chars()
        .map(|c| {
            if c.is_alphanumeric() 
                || c == '_' || c == '-' 
                || ('\u{4e00}'..='\u{9fff}').contains(&c) 
            {
                c
            } else {
                '_'
            }
        })
        .collect::<String>()
        .replace("__", "_")
        .trim_matches('_')
        .to_string()
}

/// 生成标准化录制文件名
/// context: "preview" (预览区域) 或 "main" (主界面/展示区域)
/// source_name: 信号源名称（如 "HDMI_01", "Camera_A", "主界面"）
/// extension: "mp4", "webm" 等
pub fn generate_video_filename(context: &str, source_name: &str, extension: &str) -> String {
    let safe_ctx = sanitize_filename_part(context);
    let safe_src = sanitize_filename_part(source_name);
    // 毫秒级时间戳防冲突，格式：20260422_143022_589
    let ts = Local::now().format("%Y%m%d_%H%M%S_%3N");
    format!("{}_{}_{}.{}", safe_ctx, safe_src, ts, extension)
}

// Tauri Command 供前端直接调用
#[tauri::command]
pub fn generate_video_filename_cmd(context: String, source_name: String, extension: String) -> String {
    generate_video_filename(&context, &source_name, &extension)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_filename() {
        assert_eq!(sanitize_filename_part("HDMI_01"), "HDMI_01");
        assert_eq!(sanitize_filename_part("Camera A!@#"), "Camera_A");
        assert_eq!(sanitize_filename_part("主界面"), "主界面");
        assert_eq!(sanitize_filename_part("测试/文件"), "测试_文件");
        assert_eq!(sanitize_filename_part("__test__"), "test");
    }

    #[test]
    fn test_generate_filename() {
        let filename = generate_video_filename("preview", "HDMI_01", "mp4");
        assert!(filename.starts_with("preview_HDMI_01_"));
        assert!(filename.ends_with(".mp4"));
    }
}
