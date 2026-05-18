use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use super::OnvifCamera;
use super::onvif::OnvifError;
use super::discovery::{discover_onvif_lan, DiscoveredOnvifDevice};

/// PTZ 设备管理器 - 统一管理多厂商摄像机
pub struct PtzDeviceManager {
    cameras: RwLock<HashMap<String, Arc<OnvifCamera>>>,
    rtsp_urls: RwLock<HashMap<String, String>>,
}

impl PtzDeviceManager {
    pub fn new() -> Self {
        Self {
            cameras: RwLock::new(HashMap::new()),
            rtsp_urls: RwLock::new(HashMap::new()),
        }
    }

    /// 注册摄像机
    pub async fn register(&self, camera: OnvifCamera) {
        let id = camera.id.clone();
        self.cameras.write().await.insert(id.clone(), Arc::new(camera));
        log::info!("📹 设备已注册: {}", id);
    }

    /// 获取摄像机
    pub async fn get(&self, id: &str) -> Option<Arc<OnvifCamera>> {
        self.cameras.read().await.get(id).cloned()
    }

    /// 注销摄像机
    pub async fn unregister(&self, id: &str) {
        self.cameras.write().await.remove(id);
        self.rtsp_urls.write().await.remove(id);
        log::info!("📹 设备已注销: {}", id);
    }

    /// 设置设备的手动RTSP地址
    pub async fn set_rtsp_url(&self, id: &str, rtsp_url: String) -> Result<(), String> {
        if self.get(id).await.is_none() {
            return Err(format!("设备未注册: {}", id));
        }
        self.rtsp_urls.write().await.insert(id.to_string(), rtsp_url);
        Ok(())
    }

    /// 获取设备的手动RTSP地址
    pub async fn get_rtsp_url(&self, id: &str) -> Option<String> {
        self.rtsp_urls.read().await.get(id).cloned()
    }

    /// 删除设备的手动RTSP地址
    pub async fn remove_rtsp_url(&self, id: &str) {
        self.rtsp_urls.write().await.remove(id);
    }

    /// 获取所有已注册设备ID列表
    pub async fn list_devices(&self) -> Vec<String> {
        self.cameras.read().await.keys().cloned().collect()
    }

    /// 统一控制入口（带防抖与坐标映射）
    /// click_x/click_y: [0, 1] 屏幕归一化坐标
    /// zoom: [1.0, 10.0] 变焦倍数
    /// hfov/vfov: 镜头水平/垂直视场角（度）
    pub async fn control_click(
        &self,
        id: &str,
        click_x: f64,
        click_y: f64,
        zoom: f64,
        hfov: f64,
        vfov: f64,
    ) -> Result<(), OnvifError> {
        let cam = self.get(id).await.ok_or_else(|| {
            log::error!("⚠️ 设备未找到: {}", id);
            OnvifError::DeviceNotFound
        })?;

        // 屏幕坐标 [0,1] → ONVIF [-1,1]
        let pan = (click_x - 0.5) * 2.0 * (180.0 / hfov).clamp(0.5, 2.0);
        let tilt = (0.5 - click_y) * 2.0 * (90.0 / vfov).clamp(0.5, 2.0);

        cam.absolute_move(pan, tilt, zoom).await
    }

    /// 局域网自动发现
    pub async fn discover(&self, timeout_secs: u64) -> Vec<DiscoveredOnvifDevice> {
        discover_onvif_lan(timeout_secs).await
    }

    /// 快速注册发现设备
    pub async fn register_discovered(
        &self,
        dev: &DiscoveredOnvifDevice,
        user: &str,
        pass: &str,
    ) -> Result<String, String> {
        // 默认 profile_token 尝试常见值
        for token in &["profile_1", "Profile_1", "000", "MainStream"] {
            let cam = OnvifCamera::new(
                &format!("{}_{}", dev.name.replace(" ", "_"), dev.ip),
                &dev.ip,
                80,
                user,
                pass,
                token,
            );

            // 测试连接
            match cam.stop().await {
                Ok(_) => {
                    let id = cam.id.clone();
                    self.register(cam).await;
                    log::info!("✅ 成功注册设备: {} (token: {})", id, token);
                    return Ok(id);
                }
                Err(e) => {
                    log::warn!("⚠️ Token '{}' 失败: {}", token, e);
                    continue;
                }
            }
        }

        Err(format!("无法注册设备 {}: 所有 token 均失败", dev.ip))
    }

    /// 批量注册五家厂商预设设备（示例配置）
    pub async fn register_vendor_defaults(&self) {
        // 明日 (Minrray)
        self.register(OnvifCamera::new(
            "minrray_01",
            "192.168.1.100",
            80,
            "admin",
            "admin",
            "profile_1",
        ))
        .await;

        // 晨安 (Chingan)
        self.register(OnvifCamera::new(
            "chingan_01",
            "192.168.1.101",
            80,
            "admin",
            "admin",
            "000",
        ))
        .await;

        // 维海德 (VHD)
        self.register(OnvifCamera::new(
            "vhd_01",
            "192.168.1.102",
            80,
            "admin",
            "admin",
            "Profile_1",
        ))
        .await;

        // 普奥视 (PUAS)
        self.register(OnvifCamera::new(
            "puas_01",
            "192.168.1.103",
            80,
            "admin",
            "admin",
            "MainStream",
        ))
        .await;

        // 金九天视 (Jinjiu)
        self.register(OnvifCamera::new(
            "jinjiu_01",
            "192.168.1.104",
            80,
            "admin",
            "admin",
            "profile_1",
        ))
        .await;

        log::info!("✅ 已注册5家厂商默认设备配置");
    }
}
