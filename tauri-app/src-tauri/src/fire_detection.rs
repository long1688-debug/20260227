// 火焰/烟雾检测模块
use base64::{engine::general_purpose::STANDARD, Engine};
use image::{RgbImage};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct DetectionResult {
    pub category: String,
    pub confidence: f32,
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FireSmokeDetectionResult {
    pub detections: Vec<DetectionResult>,
    pub has_fire: bool,
    pub has_smoke: bool,
}

/// 检测图像中的火焰
fn detect_fire_in_region(img: &RgbImage, x: u32, y: u32, width: u32, height: u32) -> (u32, f32) {
    let mut fire_pixels = 0u32;
    let total_pixels = width * height;

    for py in y..(y + height).min(img.height()) {
        for px in x..(x + width).min(img.width()) {
            let pixel = img.get_pixel(px, py);
            let r = pixel[0] as f32;
            let g = pixel[1] as f32;
            let b = pixel[2] as f32;

            // 火焰特征：高红色，中等绿色，低蓝色
            if r > 150.0 && r > g * 1.5 && r > b * 2.0 && r > 200.0 {
                fire_pixels += 1;
            }
        }
    }

    let ratio = if total_pixels > 0 {
        fire_pixels as f32 / total_pixels as f32
    } else {
        0.0
    };

    (fire_pixels, ratio)
}

/// 检测图像中的烟雾
fn detect_smoke_in_region(img: &RgbImage, x: u32, y: u32, width: u32, height: u32) -> (u32, f32) {
    let mut smoke_pixels = 0u32;
    let total_pixels = width * height;

    for py in y..(y + height).min(img.height()) {
        for px in x..(x + width).min(img.width()) {
            let pixel = img.get_pixel(px, py);
            let r = pixel[0] as f32;
            let g = pixel[1] as f32;
            let b = pixel[2] as f32;

            let brightness = (r + g + b) / 3.0;
            let max_c = r.max(g).max(b);
            let min_c = r.min(g).min(b);
            let saturation = max_c - min_c;

            // 烟雾特征：中高亮度，低饱和度
            if brightness > 150.0 && brightness < 240.0 && saturation < 50.0 {
                smoke_pixels += 1;
            }
        }
    }

    let ratio = if total_pixels > 0 {
        smoke_pixels as f32 / total_pixels as f32
    } else {
        0.0
    };

    (smoke_pixels, ratio)
}

/// 从 Base64 解码图像
fn decode_image(base64_data: &str) -> Result<RgbImage, String> {
    // 移除可能的 data URL 前缀
    let data = if base64_data.contains(',') {
        base64_data.split(',').last().unwrap_or(base64_data)
    } else {
        base64_data
    };

    let bytes = STANDARD
        .decode(data)
        .map_err(|e| format!("Base64 解码失败: {}", e))?;

    let img = image::load_from_memory(&bytes)
        .map_err(|e| format!("图像加载失败: {}", e))?;

    Ok(img.to_rgb8())
}

/// 检测火焰和烟雾
#[tauri::command]
pub async fn detect_fire_smoke(base64_image: String) -> Result<FireSmokeDetectionResult, String> {
    // 在后台线程中执行CPU密集型操作
    let result = tokio::task::spawn_blocking(move || {
        let img = decode_image(&base64_image)?;

        let (width, height) = img.dimensions();
        let mut detections = Vec::new();
        let mut has_fire = false;
        let mut has_smoke = false;

        // 将图像分割成网格进行检测
        let grid_size = 8;
        let cell_width = width / grid_size;
        let cell_height = height / grid_size;

        for gy in 0..grid_size {
            for gx in 0..grid_size {
                let x = gx * cell_width;
                let y = gy * cell_height;

                // 检测火焰
                let (fire_pixels, fire_ratio) = detect_fire_in_region(&img, x, y, cell_width, cell_height);
                if fire_ratio > 0.1 && fire_pixels > 50 {
                    has_fire = true;
                    detections.push(DetectionResult {
                        category: "fire".to_string(),
                        confidence: (fire_ratio * 3.0).min(1.0),
                        x,
                        y,
                        width: cell_width,
                        height: cell_height,
                    });
                }

                // 检测烟雾
                let (smoke_pixels, smoke_ratio) = detect_smoke_in_region(&img, x, y, cell_width, cell_height);
                if smoke_ratio > 0.15 && smoke_pixels > 100 {
                    has_smoke = true;
                    detections.push(DetectionResult {
                        category: "smoke".to_string(),
                        confidence: (smoke_ratio * 2.0).min(1.0),
                        x,
                        y,
                        width: cell_width,
                        height: cell_height,
                    });
                }
            }
        }

        Ok::<_, String>(FireSmokeDetectionResult {
            detections,
            has_fire,
            has_smoke,
        })
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))?;

    result
}

/// 简单的颜色统计检测（用于前端快速预检测）
#[tauri::command]
pub fn quick_color_check(base64_image: String) -> Result<(bool, bool), String> {
    let img = decode_image(&base64_image)?;

    let mut fire_score = 0u32;
    let mut smoke_score = 0u32;
    let total_pixels = img.width() * img.height();

    // 采样检测（每隔几个像素检测一次，提高性能）
    let step = 4;
    for y in (0..img.height()).step_by(step) {
        for x in (0..img.width()).step_by(step) {
            let pixel = img.get_pixel(x, y);
            let r = pixel[0] as f32;
            let g = pixel[1] as f32;
            let b = pixel[2] as f32;

            // 火焰颜色检测
            if r > 150.0 && r > g * 1.5 && r > b * 2.0 && r > 200.0 {
                fire_score += 1;
            }

            // 烟雾颜色检测
            let brightness = (r + g + b) / 3.0;
            let max_c = r.max(g).max(b);
            let min_c = r.min(g).min(b);
            let saturation = max_c - min_c;
            if brightness > 150.0 && brightness < 240.0 && saturation < 50.0 {
                smoke_score += 1;
            }
        }
    }

    let sample_count = (total_pixels / ((step as u32) * (step as u32))) as f32;
    let fire_ratio = fire_score as f32 / sample_count;
    let smoke_ratio = smoke_score as f32 / sample_count;

    Ok((fire_ratio > 0.02, smoke_ratio > 0.05))
}
