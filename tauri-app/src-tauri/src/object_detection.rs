//! 物体检测：在 Rust 端用 ONNX Runtime（`ort`）运行 YOLOX（Apache-2.0）模型，推理不占 WebView 主线程。
//!
//! 模型：`runtime/models/detection/yolox_nano.onnx`（随安装包附带，由 scripts/prepare-runtime.ps1 准备）。
//! 前端通过 `services/detection.js` 的 `detect()` 调用，不感知具体模型。

use ort::session::Session;
use ort::value::Tensor;
use serde::Serialize;
use std::sync::{Arc, Mutex};

const MODEL_FILE: &str = "detection/yolox_nano.onnx";
const NMS_IOU: f32 = 0.45;
const MAX_DETECTIONS: usize = 100;
const PAD_VALUE: f32 = 114.0;
const STRIDES: [usize; 3] = [8, 16, 32];

const COCO_LABELS: [&str; 80] = [
    "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat",
    "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat", "dog",
    "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella",
    "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball", "kite",
    "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket", "bottle",
    "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
    "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch", "potted plant",
    "bed", "dining table", "toilet", "tv", "laptop", "mouse", "remote", "keyboard", "cell phone",
    "microwave", "oven", "toaster", "sink", "refrigerator", "book", "clock", "vase", "scissors",
    "teddy bear", "hair drier", "toothbrush",
];

#[derive(Debug, Clone, Serialize)]
pub struct BoundingBox {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

#[derive(Debug, Clone, Serialize)]
pub struct Detection {
    pub label: String,
    pub class_id: usize,
    pub score: f32,
    /// 原图像素坐标
    #[serde(rename = "box")]
    pub bbox: BoundingBox,
}

struct Detector {
    session: Session,
    input_size: usize,
    _env: ort::environment::Environment,
}

impl Detector {
    fn load() -> Result<Self, String> {
        let path = crate::bin_resolver::model_file(MODEL_FILE).ok_or_else(|| {
            format!("未找到检测模型，请确认安装目录 runtime\\models\\{} 存在", MODEL_FILE.replace('/', "\\"))
        })?;
        let env = ort::init()
            .with_name("detection")
            .build()
            .map_err(|e| format!("初始化 ONNX Runtime 失败: {}", e))?;
        let threads = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4);
        let session = Session::builder(&env)
            .and_then(|b| b.with_intra_threads((threads / 2).clamp(1, 4)).map_err(Into::into))
            .and_then(|mut b| b.commit_from_file(&path))
            .map_err(|e| format!("加载检测模型失败 ({}): {}", path.display(), e))?;

        let input_size = session
            .inputs()
            .first()
            .and_then(|i| i.dtype().tensor_shape())
            .and_then(|s| s.get(2).copied())
            .filter(|&d| d > 0)
            .map(|d| d as usize)
            .unwrap_or(416);

        log::info!("[Detection] 模型已加载: {}，输入 {}x{}", path.display(), input_size, input_size);
        Ok(Self { session, input_size, _env: env })
    }

    fn detect(&mut self, image: &image::RgbaImage, threshold: f32) -> Result<Vec<Detection>, String> {
        let size = self.input_size;
        let (w, h) = image.dimensions();
        if w == 0 || h == 0 {
            return Ok(vec![]);
        }

        // YOLOX 预处理：等比缩放后贴到左上角，其余填 114；BGR 顺序，0-255 不归一化
        let ratio = (size as f32 / w as f32).min(size as f32 / h as f32);
        let nw = ((w as f32 * ratio).round() as u32).clamp(1, size as u32);
        let nh = ((h as f32 * ratio).round() as u32).clamp(1, size as u32);
        let resized = image::imageops::resize(image, nw, nh, image::imageops::FilterType::Triangle);
        let plane = size * size;
        let mut input = vec![PAD_VALUE; 3 * plane];
        for (x, y, px) in resized.enumerate_pixels() {
            let i = y as usize * size + x as usize;
            input[i] = px[2] as f32;
            input[plane + i] = px[1] as f32;
            input[2 * plane + i] = px[0] as f32;
        }

        let tensor = Tensor::from_array(([1usize, 3, size, size], input)).map_err(|e| e.to_string())?;
        let outputs = self
            .session
            .run(ort::inputs![tensor])
            .map_err(|e| format!("检测推理失败: {}", e))?;
        let (_, data) = outputs[0].try_extract_tensor::<f32>().map_err(|e| e.to_string())?;

        let mut dets = decode(data, size, threshold, ratio, w as f32, h as f32);
        nms(&mut dets);
        Ok(dets)
    }
}

fn decode(data: &[f32], size: usize, threshold: f32, ratio: f32, img_w: f32, img_h: f32) -> Vec<Detection> {
    let row_len = 5 + COCO_LABELS.len();
    let mut rows = data.chunks_exact(row_len);
    let mut dets = Vec::new();
    for stride in STRIDES {
        let grid = size / stride;
        for gy in 0..grid {
            for gx in 0..grid {
                let Some(row) = rows.next() else { return dets };
                let objectness = row[4];
                if objectness < threshold {
                    continue;
                }
                let (class_id, class_score) = row[5..]
                    .iter()
                    .copied()
                    .enumerate()
                    .fold((0, f32::MIN), |best, (i, s)| if s > best.1 { (i, s) } else { best });
                let score = objectness * class_score;
                if score < threshold {
                    continue;
                }
                let s = stride as f32;
                let cx = (row[0] + gx as f32) * s / ratio;
                let cy = (row[1] + gy as f32) * s / ratio;
                let bw = row[2].exp() * s / ratio;
                let bh = row[3].exp() * s / ratio;
                let x0 = (cx - bw / 2.0).clamp(0.0, img_w);
                let y0 = (cy - bh / 2.0).clamp(0.0, img_h);
                let x1 = (cx + bw / 2.0).clamp(0.0, img_w);
                let y1 = (cy + bh / 2.0).clamp(0.0, img_h);
                dets.push(Detection {
                    label: COCO_LABELS[class_id].to_string(),
                    class_id,
                    score,
                    bbox: BoundingBox { x: x0, y: y0, width: x1 - x0, height: y1 - y0 },
                });
            }
        }
    }
    dets
}

fn iou(a: &BoundingBox, b: &BoundingBox) -> f32 {
    let x0 = a.x.max(b.x);
    let y0 = a.y.max(b.y);
    let x1 = (a.x + a.width).min(b.x + b.width);
    let y1 = (a.y + a.height).min(b.y + b.height);
    let inter = (x1 - x0).max(0.0) * (y1 - y0).max(0.0);
    let union = a.width * a.height + b.width * b.height - inter;
    if union <= 0.0 { 0.0 } else { inter / union }
}

fn nms(dets: &mut Vec<Detection>) {
    dets.sort_by(|a, b| b.score.total_cmp(&a.score));
    let mut kept: Vec<Detection> = Vec::new();
    for d in dets.drain(..) {
        if kept.len() >= MAX_DETECTIONS {
            break;
        }
        if kept.iter().all(|k| k.class_id != d.class_id || iou(&k.bbox, &d.bbox) < NMS_IOU) {
            kept.push(d);
        }
    }
    *dets = kept;
}

#[derive(Default, Clone)]
pub struct DetectorState {
    detector: Arc<Mutex<Option<Detector>>>,
}

impl DetectorState {
    fn run(&self, image: image::RgbaImage, threshold: f32) -> Result<Vec<Detection>, String> {
        let mut guard = self.detector.lock().map_err(|_| "检测器状态异常".to_string())?;
        if guard.is_none() {
            *guard = Some(Detector::load()?);
        }
        guard.as_mut().unwrap().detect(&image, threshold)
    }
}

fn header<'a>(request: &'a tauri::ipc::Request<'_>, name: &str) -> Option<&'a str> {
    request.headers().get(name).and_then(|v| v.to_str().ok())
}

/// 请求体为原始字节：
/// - 带 `x-width`/`x-height` 头时为 RGBA 像素（来自 canvas `ImageData`）
/// - 否则为编码后的图片文件（PNG/JPEG 等）
///
/// `x-threshold` 可选，默认 0.5。
#[tauri::command]
pub async fn detect_objects(
    request: tauri::ipc::Request<'_>,
    state: tauri::State<'_, DetectorState>,
) -> Result<Vec<Detection>, String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("detect_objects 需要以二进制方式传入图像".into());
    };
    let threshold = header(&request, "x-threshold")
        .and_then(|v| v.parse::<f32>().ok())
        .unwrap_or(0.5)
        .clamp(0.01, 0.99);
    let dims = header(&request, "x-width")
        .zip(header(&request, "x-height"))
        .and_then(|(w, h)| Some((w.parse::<u32>().ok()?, h.parse::<u32>().ok()?)));
    let bytes = bytes.clone();
    let state = state.inner().clone();

    tokio::task::spawn_blocking(move || {
        let image = match dims {
            Some((w, h)) => image::RgbaImage::from_raw(w, h, bytes)
                .ok_or_else(|| "像素数据长度与宽高不符".to_string())?,
            None => image::load_from_memory(&bytes)
                .map_err(|e| format!("无法解码图片: {}", e))?
                .to_rgba8(),
        };
        state.run(image, threshold)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_detector_status(state: tauri::State<'_, DetectorState>) -> Result<serde_json::Value, String> {
    let loaded = state.detector.lock().map(|g| g.is_some()).unwrap_or(false);
    let model = crate::bin_resolver::model_file(MODEL_FILE);
    Ok(serde_json::json!({
        "available": model.is_some(),
        "loaded": loaded,
        "engine": "onnxruntime",
        "model": "yolox_nano",
        "model_path": model.map(|p| p.to_string_lossy().to_string()),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 需要 resources/runtime/models/detection/yolox_nano.onnx 和 DETECT_TEST_IMAGE 环境变量
    #[test]
    #[ignore]
    fn detects_objects_in_sample_image() {
        let path = std::env::var("DETECT_TEST_IMAGE").expect("DETECT_TEST_IMAGE");
        let img = image::open(path).unwrap().to_rgba8();
        let dets = DetectorState::default().run(img, 0.3).unwrap();
        for d in &dets {
            println!("{} {:.2} {:?}", d.label, d.score, d.bbox);
        }
        assert!(!dets.is_empty());
    }
}
