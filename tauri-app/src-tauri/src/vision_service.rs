use tauri::{command, State};
use std::collections::HashMap;
use std::sync::Mutex;
use serde::{Serialize, Deserialize};

// 视觉分析服务状态
#[derive(Default)]
pub struct VisionServiceState {
    analysis_history: Mutex<Vec<AnalysisResult>>,
    coco_dataset_path: Mutex<String>,
    exam_config: Mutex<ExamConfig>,
}

impl VisionServiceState {
    pub fn new() -> Self {
        VisionServiceState {
            analysis_history: Mutex::new(Vec::new()),
            coco_dataset_path: Mutex::new("F:\\coco".to_string()),
            exam_config: Mutex::new(ExamConfig::default()),
        }
    }
}

// 检测到的物体
#[derive(Serialize, Deserialize, Clone)]
pub struct DetectedObject {
    pub label: String,
    pub confidence: f64,
    pub bbox: BoundingBox,
}

// 边界框
#[derive(Serialize, Deserialize, Clone)]
pub struct BoundingBox {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

// 检测到的人脸
#[derive(Serialize, Deserialize, Clone)]
pub struct DetectedFace {
    pub bounding_box: BoundingBox,
    pub confidence: f64,
}

// 情绪分析结果
#[derive(Serialize, Deserialize, Clone)]
pub struct EmotionResult {
    pub emotion: String,
    pub confidence: f64,
}

// 人脸情绪分析
#[derive(Serialize, Deserialize, Clone)]
pub struct FaceEmotion {
    pub face_index: usize,
    pub emotions: Vec<EmotionResult>,
    pub dominant_emotion: String,
}

// 分析结果
#[derive(Serialize, Deserialize, Clone)]
pub struct AnalysisResult {
    pub id: u64,
    pub timestamp: String,
    pub faces: Vec<DetectedFace>,
    pub objects: Vec<DetectedObject>,
    pub attention_score: f64,
    pub emotions: Vec<FaceEmotion>,
    pub source: Option<String>,
}

// COCO 图片信息
#[derive(Serialize, Deserialize, Clone)]
pub struct CocoImage {
    pub name: String,
    pub path: String,
    pub full_path: String,
    pub directory: String,
}

// COCO 数据集统计
#[derive(Serialize, Deserialize)]
pub struct CocoDatasetStats {
    pub total_images: usize,
    pub total_annotations: usize,
    pub total_categories: usize,
    pub has_annotations: bool,
    pub loaded: bool,
    pub path: String,
}

// 数据集验证结果
#[derive(Serialize, Deserialize)]
pub struct DatasetValidation {
    pub is_valid: bool,
    pub path: String,
    pub checks: Vec<ValidationCheck>,
}

#[derive(Serialize, Deserialize)]
pub struct ValidationCheck {
    pub name: String,
    pub path: String,
    pub exists: bool,
    pub required: bool,
}

// 批量测试结果
#[derive(Serialize, Deserialize)]
pub struct BatchTestResult {
    pub total: usize,
    pub correct: usize,
    pub accuracy: String,
    pub total_detections: usize,
    pub results: Vec<BatchTestItem>,
}

#[derive(Serialize, Deserialize)]
pub struct BatchTestItem {
    pub image_name: String,
    pub detected_count: usize,
    pub is_correct: bool,
    pub confidence: f64,
    pub error: Option<String>,
}

// 考试配置
#[derive(Serialize, Deserialize, Clone, Default, Debug)]
pub struct ExamConfig {
    pub duration: u64,
    pub required_objects: Vec<String>,
    pub min_confidence: f64,
}

// 考试评分结果
#[derive(Serialize, Deserialize)]
pub struct ExamScoreResult {
    pub total_frames: usize,
    pub score: usize,
    pub object_scores: Vec<ObjectScore>,
    pub detected_objects: Vec<String>,
    pub detection_details: HashMap<String, usize>,
}

#[derive(Serialize, Deserialize)]
pub struct ObjectScore {
    pub object: String,
    pub detected: usize,
    pub total_frames: usize,
    pub detection_rate: String,
    pub score: usize,
}

// 考试帧结果
#[derive(Serialize, Deserialize, Clone)]
pub struct ExamFrameResult {
    pub objects: Vec<DetectedObject>,
    pub timestamp: u64,
}

// 服务状态
#[derive(Serialize, Deserialize)]
pub struct VisionServiceStatus {
    pub is_initialized: bool,
    pub coco_dataset_path: String,
    pub analysis_count: usize,
}

// ============ COCO 数据集管理命令 ============

/// 设置 COCO 数据集路径
#[command]
pub fn set_coco_dataset_path(state: State<'_, VisionServiceState>, path: String) -> Result<(), String> {
    println!("[VisionService] COCO 数据集路径已设置为: {}", path);
    *state.coco_dataset_path.lock().map_err(|e| e.to_string())? = path;
    Ok(())
}

/// 获取当前 COCO 数据集路径
#[command]
pub fn get_coco_dataset_path(state: State<'_, VisionServiceState>) -> Result<String, String> {
    Ok(state.coco_dataset_path.lock().map_err(|e| e.to_string())?.clone())
}

/// 验证 COCO 数据集是否完整
#[command]
pub async fn validate_coco_dataset(state: State<'_, VisionServiceState>) -> Result<DatasetValidation, String> {
    let _path = state.coco_dataset_path.lock().map_err(|e| e.to_string())?.clone();

    let checks = vec![
        ValidationCheck {
            name: "验证集目录".to_string(),
            path: format!("{}\\val2017", path),
            exists: check_path_exists(&format!("{}\\val2017", path)).await,
            required: true,
        },
        ValidationCheck {
            name: "训练集目录".to_string(),
            path: format!("{}\\train2017", path),
            exists: check_path_exists(&format!("{}\\train2017", path)).await,
            required: false,
        },
        ValidationCheck {
            name: "标注目录".to_string(),
            path: format!("{}\\annotations", path),
            exists: check_path_exists(&format!("{}\\annotations", path)).await,
            required: true,
        },
    ];

    let is_valid = checks.iter().all(|c| !c.required || c.exists);

    Ok(DatasetValidation {
        is_valid,
        path,
        checks,
    })
}

/// 获取 COCO 数据集统计信息
#[command]
pub async fn get_coco_dataset_stats(state: State<'_, VisionServiceState>) -> Result<CocoDatasetStats, String> {
    let _path = state.coco_dataset_path.lock().map_err(|e| e.to_string())?.clone();

    // 模拟统计信息（实际应读取文件系统）
    let val_dir = format!("{}\\val2017", path);
    let train_dir = format!("{}\\train2017", path);
    let annotations_dir = format!("{}\\annotations", path);

    let val_exists = check_path_exists(&val_dir).await;
    let _train_exists = check_path_exists(&train_dir).await;
    let annotations_exists = check_path_exists(&annotations_dir).await;

    Ok(CocoDatasetStats {
        total_images: if val_exists { 5000 } else { 0 },
        total_annotations: if annotations_exists { 36781 } else { 0 },
        total_categories: 80,
        has_annotations: annotations_exists,
        loaded: val_exists,
        path,
    })
}

/// 搜索包含指定类别的 COCO 图片
#[command]
pub async fn search_coco_images_by_category(
    state: State<'_, VisionServiceState>,
    category_name: String,
    max_results: usize,
) -> Result<Vec<CocoImage>, String> {
    let path = state.coco_dataset_path.lock().map_err(|e| e.to_string())?.clone();

    // 模拟搜索结果
    let mut results = Vec::new();
    let categories = ["person", "car", "dog", "cat", "bird", "bicycle", "chair", "table"];

    if categories.contains(&category_name.as_str()) {
        for i in 0..max_results.min(5) {
            results.push(CocoImage {
                name: format!("{}_{:06}.jpg", category_name, i),
                path: format!("{}\\val2017\\{}_{:06}.jpg", &path, category_name, i),
                full_path: format!("{}\\val2017\\{}_{:06}.jpg", &path, category_name, i),
                directory: "val2017".to_string(),
            });
        }
    }

    Ok(results)
}

// ============ 智能视觉分析命令 ============

/// 分析图像（模拟）
#[command]
pub fn analyze_image(
    state: State<'_, VisionServiceState>,
    image_path: String,
) -> Result<AnalysisResult, String> {
    let now = chrono::Local::now();
    let timestamp = now.to_rfc3339();
    let id = now.timestamp_millis() as u64;

    // 模拟分析结果
    let objects = generate_simulated_objects();
    let faces = generate_simulated_faces();
    let emotions = generate_simulated_emotions(faces.len());

    let result = AnalysisResult {
        id,
        timestamp,
        faces: faces.clone(),
        objects: objects.clone(),
        attention_score: 70.0 + rand::random::<f64>() * 25.0,
        emotions,
        source: Some(image_path),
    };

    // 保存到历史记录
    let mut history = state.analysis_history.lock().map_err(|e| e.to_string())?;
    history.push(result.clone());
    if history.len() > 100 {
        history.remove(0);
    }

    Ok(result)
}

/// 获取分析历史记录
#[command]
pub fn get_analysis_history(state: State<'_, VisionServiceState>) -> Result<Vec<AnalysisResult>, String> {
    let history = state.analysis_history.lock().map_err(|e| e.to_string())?.clone();
    Ok(history)
}

/// 清除分析历史
#[command]
pub fn clear_analysis_history(state: State<'_, VisionServiceState>) -> Result<(), String> {
    let mut history = state.analysis_history.lock().map_err(|e| e.to_string())?;
    history.clear();
    Ok(())
}

// ============ 人工智能评估系统命令 ============

/// 设置考试配置
#[command]
pub fn set_exam_config(
    state: State<'_, VisionServiceState>,
    config: ExamConfig,
) -> Result<(), String> {
    println!("[VisionService] 考试配置已更新: {:?}", config);
    *state.exam_config.lock().map_err(|e| e.to_string())? = config;
    Ok(())
}

/// 获取当前考试配置
#[command]
pub fn get_exam_config(state: State<'_, VisionServiceState>) -> Result<ExamConfig, String> {
    Ok(state.exam_config.lock().map_err(|e| e.to_string())?.clone())
}

/// 开始批量测试
#[command]
pub async fn start_batch_test(
    state: State<'_, VisionServiceState>,
    max_images: usize,
) -> Result<BatchTestResult, String> {
    let path = state.coco_dataset_path.lock().map_err(|e| e.to_string())?.clone();

    let test_count = max_images.min(50);
    let mut results = Vec::new();
    let mut correct_count = 0;
    let mut total_detections = 0;

    for i in 0..test_count {
        let objects = generate_simulated_objects();
        let is_correct = !objects.is_empty();

        if is_correct {
            correct_count += 1;
        }
        total_detections += objects.len();

        results.push(BatchTestItem {
            image_name: format!("test_image_{:04}.jpg", i),
            detected_count: objects.len(),
            is_correct,
            confidence: objects.first().map(|o| o.confidence).unwrap_or(0.0),
            error: None,
        });
    }

    let accuracy = ((correct_count as f64 / test_count as f64) * 100.0).to_string();

    Ok(BatchTestResult {
        total: test_count,
        correct: correct_count,
        accuracy,
        total_detections,
        results,
    })
}

/// 分析考试结果并评分
#[command]
pub fn analyze_exam_results(
    state: State<'_, VisionServiceState>,
    exam_results: Vec<ExamFrameResult>,
) -> Result<ExamScoreResult, String> {
    let config = state.exam_config.lock().map_err(|e| e.to_string())?.clone();
    let total_frames = exam_results.len();

    let mut object_detection_count: HashMap<String, usize> = HashMap::new();

    for frame in exam_results {
        for obj in frame.objects {
            if obj.confidence >= config.min_confidence {
                *object_detection_count.entry(obj.label).or_insert(0) += 1;
            }
        }
    }

    let mut object_scores = Vec::new();
    let mut total_score = 0;

    for required in &config.required_objects {
        let detected = *object_detection_count.get(required).unwrap_or(&0);
        let detection_rate = if total_frames > 0 {
            detected as f64 / total_frames as f64
        } else {
            0.0
        };

        let threshold = 0.3;
        let score = if detection_rate >= threshold {
            100
        } else {
            ((detection_rate / threshold) * 100.0).round() as usize
        };

        object_scores.push(ObjectScore {
            object: required.clone(),
            detected,
            total_frames,
            detection_rate: (detection_rate * 100.0).to_string(),
            score,
        });

        total_score += score;
    }

    let final_score = if config.required_objects.is_empty() {
        0
    } else {
        total_score / config.required_objects.len()
    };

    Ok(ExamScoreResult {
        total_frames,
        score: final_score,
        object_scores,
        detected_objects: object_detection_count.keys().cloned().collect(),
        detection_details: object_detection_count,
    })
}

/// 获取服务状态
#[command]
pub fn get_vision_service_status(state: State<'_, VisionServiceState>) -> Result<VisionServiceStatus, String> {
    let path = state.coco_dataset_path.lock().map_err(|e| e.to_string())?.clone();
    let count = state.analysis_history.lock().map_err(|e| e.to_string())?.len();

    Ok(VisionServiceStatus {
        is_initialized: true,
        coco_dataset_path: path,
        analysis_count: count,
    })
}

// ============ 辅助函数 ============

async fn check_path_exists(path: &str) -> bool {
    use std::fs;
    match fs::metadata(path) {
        Ok(m) => m.is_dir(),
        Err(_) => false,
    }
}

fn generate_simulated_objects() -> Vec<DetectedObject> {
    let labels = [
        "person", "car", "bicycle", "dog", "cat", "chair", "table",
        "cup", "bottle", "phone", "laptop", "book", "plant", "tv"
    ];

    let count = rand::random::<usize>() % 5;
    let mut objects = Vec::new();

    for _ in 0..count {
        let label = labels[rand::random::<usize>() % labels.len()].to_string();
        objects.push(DetectedObject {
            label,
            confidence: 0.5 + rand::random::<f64>() * 0.45,
            bbox: BoundingBox {
                x: rand::random::<f64>() * 200.0,
                y: rand::random::<f64>() * 200.0,
                width: 50.0 + rand::random::<f64>() * 100.0,
                height: 50.0 + rand::random::<f64>() * 100.0,
            },
        });
    }

    objects
}

fn generate_simulated_faces() -> Vec<DetectedFace> {
    let count = if rand::random::<f64>() > 0.3 { 1 } else { 0 };
    let mut faces = Vec::new();

    for _ in 0..count {
        faces.push(DetectedFace {
            bounding_box: BoundingBox {
                x: 100.0 + rand::random::<f64>() * 100.0,
                y: 80.0 + rand::random::<f64>() * 80.0,
                width: 100.0 + rand::random::<f64>() * 50.0,
                height: 120.0 + rand::random::<f64>() * 60.0,
            },
            confidence: 0.85 + rand::random::<f64>() * 0.14,
        });
    }

    faces
}

fn generate_simulated_emotions(face_count: usize) -> Vec<FaceEmotion> {
    let emotions = ["专注", "开心", "困惑", "疲劳", "中性"];
    let mut results = Vec::new();

    for i in 0..face_count {
        let mut face_emotions = Vec::new();
        let mut remaining = 1.0;

        for j in 0..3 {
            let prob = if j == 2 {
                remaining
            } else {
                let p = rand::random::<f64>() * remaining * 0.6;
                remaining -= p;
                p
            };

            face_emotions.push(EmotionResult {
                emotion: emotions[rand::random::<usize>() % emotions.len()].to_string(),
                confidence: prob,
            });
        }

        face_emotions.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap());

        let dominant_emotion = face_emotions.first().map(|e| e.emotion.clone()).unwrap_or("未知".to_string());

        results.push(FaceEmotion {
            face_index: i,
            emotions: face_emotions,
            dominant_emotion,
        });
    }

    results
}
