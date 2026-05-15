use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;
use std::time::Duration;
use tokio::time::timeout;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use futures::future::join_all;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiscoveredCamera {
    pub address: String,
    pub port: Option<u16>,
    pub name: Option<String>,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub serial_number: Option<String>, // 🎯 新增: 设备序列号
    pub protocol: String,
    pub services: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScanResult {
    pub cameras: Vec<DiscoveredCamera>,
    pub scan_duration_ms: u64,
}

const ONVIF_MULTICAST_ADDR: &str = "239.255.255.250";
const ONVIF_MULTICAST_PORT: u16 = 3702;

// 常见摄像机端口（ONVIF端口2000优先，确保ONVIF设备能被正确识别）
const COMMON_CAMERA_PORTS: &[u16] = &[2000, 80, 554, 8000, 8080, 8899, 37777, 37778];

pub struct CameraDiscovery;

impl CameraDiscovery {
    pub fn new() -> Self {
        CameraDiscovery
    }

    pub async fn discover_all(&self, timeout_secs: u64) -> ScanResult {
        let start = std::time::Instant::now();

        // 🎯 只使用ONVIF协议和子网扫描，删除厂商私有协议
        // 所有支持ONVIF标准的摄像机都能被发现，无需区分厂商
        let onvif_future = self.discover_onvif(timeout_secs);
        let subnet_scan_future = self.scan_local_subnet(timeout_secs);

        // 🎯 新增：跨网段扫描（需要用户配置目标网段）
        let cross_subnet_scan_future = self.scan_configured_subnets(timeout_secs);

        let (onvif_result, subnet_result, cross_subnet_result) = tokio::join!(
            onvif_future,
            subnet_scan_future,
            cross_subnet_scan_future
        );

        //  合并结果并去重 - ONVIF协议优先
        let mut cameras = Vec::new();
        let mut seen: HashMap<String, bool> = HashMap::new();

        // 优先添加ONVIF发现的设备
        for camera in onvif_result.into_iter() {
            let ip_only = if let Some(pos) = camera.address.rfind(':') {
                camera.address[..pos].to_string()
            } else {
                camera.address.clone()
            };

            if !seen.contains_key(&ip_only) {
                seen.insert(ip_only, true);
                cameras.push(camera);
            }
        }

        // 然后添加子网扫描发现的设备（去重）
        for camera in subnet_result {
            let ip_only = if let Some(pos) = camera.address.rfind(':') {
                camera.address[..pos].to_string()
            } else {
                camera.address.clone()
            };

            if !seen.contains_key(&ip_only) {
                seen.insert(ip_only, true);
                cameras.push(camera);
            }
        }

        // 🎯 添加跨网段扫描发现的设备（去重）
        for camera in cross_subnet_result {
            let ip_only = if let Some(pos) = camera.address.rfind(':') {
                camera.address[..pos].to_string()
            } else {
                camera.address.clone()
            };

            if !seen.contains_key(&ip_only) {
                seen.insert(ip_only, true);
                cameras.push(camera);
            }
        }

        let duration = start.elapsed().as_millis();

        ScanResult {
            cameras,
            scan_duration_ms: duration as u64,
        }
    }

    pub async fn discover_onvif(&self, timeout_secs: u64) -> Vec<DiscoveredCamera> {
        let mut cameras = Vec::new();

        log::info!("开始 ONVIF WS-Discovery...");

        // ONVIF WS-Discovery Probe 消息
        let probe_message = r#"<?xml version="1.0" encoding="UTF-8"?>
<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope"
            xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing"
            xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery"
            xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
    <e:Header>
        <w:MessageID>uuid:{}</w:MessageID>
        <w:To e:mustUnderstand="true">urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>
        <w:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action>
    </e:Header>
    <e:Body>
        <d:Probe>
            <d:Types>dn:NetworkVideoTransmitter</d:Types>
        </d:Probe>
    </e:Body>
</e:Envelope>"#;

        use std::net::UdpSocket;
        use std::time::Duration;
        use uuid::Uuid;

        // 生成唯一的 MessageID
        let message_id = Uuid::new_v4().to_string();
        let probe_xml = probe_message.replace("{}", &message_id);
        let probe_bytes = probe_xml.as_bytes();

        // 创建 UDP socket 并设置多播
        let socket = match UdpSocket::bind("0.0.0.0:0") {
            Ok(s) => s,
            Err(e) => {
                log::error!("创建 UDP socket 失败: {}", e);
                return cameras;
            }
        };

        socket.set_broadcast(true).ok();
        socket.set_read_timeout(Some(Duration::from_secs(timeout_secs))).ok();

        // 发送 Probe 消息到 ONVIF 多播地址
        let multicast_addr = format!("{}:{}", ONVIF_MULTICAST_ADDR, ONVIF_MULTICAST_PORT);

        if let Err(e) = socket.send_to(probe_bytes, &multicast_addr) {
            log::error!("发送 ONVIF Probe 失败: {}", e);
            return cameras;
        }

        log::info!("ONVIF Probe 已发送到 {}", multicast_addr);

        // 接收响应
        let mut buffer = [0u8; 8192];
        let start_time = std::time::Instant::now();
        let timeout_duration = Duration::from_secs(timeout_secs);

        while start_time.elapsed() < timeout_duration {
            match socket.recv_from(&mut buffer) {
                Ok((size, addr)) => {
                    let response = String::from_utf8_lossy(&buffer[..size]);

                    // 解析响应中的设备信息
                    if let Some(device_info) = parse_onvif_response(&response, &addr.to_string()) {
                        // 去重检查
                        if !cameras.iter().any(|c| c.address == device_info.address) {
                            log::info!("发现 ONVIF 设备: {} ({})", device_info.address, device_info.name.as_deref().unwrap_or("Unknown"));
                            cameras.push(device_info);
                        }
                    }
                }
                Err(_) => {
                    // 超时或错误，继续等待
                    break;
                }
            }
        }

        log::info!("ONVIF 发现完成，共发现 {} 个设备", cameras.len());
        cameras
    }

    // 🎯 删除SSDP发现 - 不再使用
    pub async fn discover_ssdp(&self, _timeout_secs: u64) -> Vec<DiscoveredCamera> {
        Vec::new()
    }

    /// 扫描配置的目标网段（跨网段扫描）
    pub async fn scan_configured_subnets(&self, timeout_secs: u64) -> Vec<DiscoveredCamera> {
        let mut cameras = Vec::new();

        // 🎯 从配置文件或环境变量读取目标网段列表
        // 示例配置：["192.168.2.0/24", "192.168.3.0/24", "10.0.1.0/24"]
        let target_subnets = self.get_target_subnets();

        if target_subnets.is_empty() {
            log::info!("未配置跨网段扫描目标，跳过跨网段扫描");
            return cameras;
        }

        log::info!("开始跨网段扫描，目标网段数: {}", target_subnets.len());

        for subnet_cidr in &target_subnets {
            log::info!("扫描目标网段: {}", subnet_cidr);

            // 生成该网段的主机列表
            let subnet_hosts = match generate_subnet_hosts_from_cidr(subnet_cidr) {
                Ok(hosts) => hosts,
                Err(e) => {
                    log::error!("生成网段 {} 主机列表失败: {}", subnet_cidr, e);
                    continue;
                }
            };

            log::info!("网段 {} 共有 {} 个主机需要扫描", subnet_cidr, subnet_hosts.len());

            // 并发扫描该网段
            let scan_tasks: Vec<_> = subnet_hosts
                .into_iter()
                .map(|host_ip| {
                    let ports = COMMON_CAMERA_PORTS.to_vec();
                    let timeout_duration = Duration::from_secs(timeout_secs);

                    async move {
                        scan_single_host(host_ip, ports, timeout_duration).await
                    }
                })
                .collect();

            // 并发执行所有扫描任务
            let results = join_all(scan_tasks).await;

            // 收集结果
            for result in results {
                cameras.extend(result);
            }
        }

        log::info!("跨网段扫描完成，共发现 {} 个设备", cameras.len());
        cameras
    }

    /// 获取配置的目标网段列表
    fn get_target_subnets(&self) -> Vec<String> {
        // 🎯 方案1：从环境变量读取
        if let Ok(subnets_env) = std::env::var("CAMERA_SCAN_SUBNETS") {
            if !subnets_env.is_empty() {
                return subnets_env.split(',').map(|s| s.trim().to_string()).collect();
            }
        }

        // 🎯 方案2：从配置文件读取（如果存在）
        // TODO: 可以从Tauri的配置文件中读取

        // 🎯 方案3：返回空列表，需要用户手动配置
        Vec::new()
    }

    /// 扫描指定网段列表（API方式，供前端调用）- 🚀 优化版：添加并发限制
    pub async fn scan_specific_subnets(&self, subnets: Vec<String>, timeout_secs: u64) -> Vec<DiscoveredCamera> {
        let mut cameras = Vec::new();

        log::info!("开始扫描指定网段，数量: {}", subnets.len());

        // 🎯 并发限制：同时扫描的主机数量
        const MAX_CONCURRENT_SCANS: usize = 20; // 最多同时扫描20个主机

        for subnet_cidr in &subnets {
            log::info!("扫描网段: {}", subnet_cidr);

            let subnet_hosts = match generate_subnet_hosts_from_cidr(subnet_cidr) {
                Ok(hosts) => hosts,
                Err(e) => {
                    log::error!("生成网段 {} 主机列表失败: {}", subnet_cidr, e);
                    continue;
                }
            };

            log::info!("网段 {} 共有 {} 个主机需要扫描", subnet_cidr, subnet_hosts.len());

            // 🎯 使用信号量限制并发数
            let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(MAX_CONCURRENT_SCANS));
            let timeout_duration = Duration::from_secs(timeout_secs);
            let ports = COMMON_CAMERA_PORTS.to_vec();

            let mut scan_tasks = Vec::new();

            for host_ip in subnet_hosts {
                let sem = semaphore.clone();
                let ports_clone = ports.clone();
                let timeout_clone = timeout_duration;

                let task = tokio::spawn(async move {
                    // 🎯 获取信号量许可，限制并发数
                    let _permit = sem.acquire().await.unwrap();

                    // 扫描单个主机
                    scan_single_host(host_ip, ports_clone, timeout_clone).await
                });

                scan_tasks.push(task);
            }

            // 等待所有任务完成
            for task in scan_tasks {
                if let Ok(result) = task.await {
                    cameras.extend(result);
                }
            }

            log::info!("网段 {} 扫描完成", subnet_cidr);
        }

        log::info!("指定网段扫描完成，共发现 {} 个设备", cameras.len());
        cameras
    }

    /// 扫描本地子网中的所有主机
    pub async fn scan_local_subnet(&self, timeout_secs: u64) -> Vec<DiscoveredCamera> {
        let mut cameras = Vec::new();

        // 🎯 获取所有网络接口，支持多网卡和跨网段
        let interfaces = match get_network_interfaces() {
            Ok(ifaces) => ifaces,
            Err(e) => {
                log::warn!("无法获取网络接口: {}", e);
                return cameras;
            }
        };

        log::info!("检测到 {} 个网络接口，开始扫描...", interfaces.len());

        // 🎯 扫描所有接口的子网
        for iface in &interfaces {
            log::info!("扫描接口 {} ({}), 子网: {}/{}",
                iface.name, iface.ip, iface.ip, iface.cidr);

            // 🎯 使用实际的CIDR，而不是固定的/24
            let subnet_hosts = match generate_subnet_hosts(&iface.ip, iface.cidr) {
                Ok(hosts) => hosts,
                Err(e) => {
                    log::error!("生成子网主机列表失败: {}", e);
                    continue;
                }
            };

            log::info!("子网 {} 中共有 {} 个主机需要扫描", iface.ip, subnet_hosts.len());

            // 并发扫描该子网
            let scan_tasks: Vec<_> = subnet_hosts
                .into_iter()
                .map(|host_ip| {
                    let ports = COMMON_CAMERA_PORTS.to_vec();
                    let timeout_duration = Duration::from_secs(timeout_secs);

                    async move {
                        scan_single_host(host_ip, ports, timeout_duration).await
                    }
                })
                .collect();

            // 并发执行所有扫描任务
            let results = join_all(scan_tasks).await;

            // 收集结果
            for result in results {
                cameras.extend(result);
            }
        }

        log::info!("子网扫描完成，共发现 {} 个设备", cameras.len());
        cameras
    }

    /// 扫描本地子网中的所有主机（带进度回调）
    pub async fn scan_local_subnet_with_progress(&self, timeout_secs: u64, app_handle: &tauri::AppHandle) -> Vec<DiscoveredCamera> {
        let mut cameras = Vec::new();

        // 🎯 获取所有网络接口，支持多网卡和跨网段
        let interfaces = match get_network_interfaces() {
            Ok(ifaces) => ifaces,
            Err(e) => {
                log::warn!("无法获取网络接口: {}", e);
                return cameras;
            }
        };

        log::info!("检测到 {} 个网络接口，开始扫描...", interfaces.len());

        use tauri::Emitter;

        // 🎯 扫描所有接口的子网
        for iface in &interfaces {
            log::info!("扫描接口 {} ({}), 子网: {}/{}",
                iface.name, iface.ip, iface.ip, iface.cidr);

            // 🎯 使用实际的CIDR，而不是固定的/24
            let subnet_hosts = match generate_subnet_hosts(&iface.ip, iface.cidr) {
                Ok(hosts) => hosts,
                Err(e) => {
                    log::error!("生成子网主机列表失败: {}", e);
                    continue;
                }
            };

            let total_hosts = subnet_hosts.len();
            log::info!("子网 {} 中共有 {} 个主机需要扫描", iface.ip, total_hosts);

            // 发送初始进度
            let _ = app_handle.emit("scan-progress", serde_json::json!({
                "progress": 0,
                "current": 0,
                "total": total_hosts,
                "message": format!("正在扫描 {} ({})...", iface.name, iface.ip),
                "found_count": cameras.len()
            }));

            // 并发扫描该子网
            let scan_tasks: Vec<_> = subnet_hosts
                .into_iter()
                .map(|host_ip| {
                    let ports = COMMON_CAMERA_PORTS.to_vec();
                    let timeout_duration = Duration::from_secs(timeout_secs);

                    async move {
                        scan_single_host(host_ip, ports, timeout_duration).await
                    }
                })
                .collect();

            // 并发执行所有扫描任务
            let results = join_all(scan_tasks).await;

            // 收集结果
            for result in results {
                cameras.extend(result);
            }

            // 更新进度
            let _ = app_handle.emit("scan-progress", serde_json::json!({
                "progress": 100,
                "current": total_hosts,
                "total": total_hosts,
                "message": format!("接口 {} 扫描完成，发现 {} 个设备", iface.name, cameras.len()),
                "found_count": cameras.len()
            }));
        }

        log::info!("子网扫描完成，共发现 {} 个设备", cameras.len());
        cameras
    }

    pub async fn scan_ports(&self, ips: Vec<String>, ports: Vec<u16>, _timeout_secs: u64) -> Vec<DiscoveredCamera> {
        let mut cameras = Vec::new();

        // 使用 futures 并发扫描
        let scan_tasks: Vec<_> = ips
            .into_iter()
            .map(|ip_str| {
                let ports = ports.clone();

                async move {
                    let ip: IpAddr = match ip_str.parse() {
                        Ok(ip) => ip,
                        Err(_) => {
                            log::warn!("无效的 IP 地址: {}", ip_str);
                            return Vec::new();
                        }
                    };

                    scan_single_host(ip.to_string(), ports, Duration::from_secs(2)).await
                }
            })
            .collect();

        // 并发执行所有扫描任务
        let results = join_all(scan_tasks).await;

        // 收集结果
        for result in results {
            cameras.extend(result);
        }

        cameras
    }

    /// 扫描所有网络接口的子网（多网卡支持）
    pub async fn scan_all_interfaces(&self, timeout_secs: u64) -> Vec<DiscoveredCamera> {
        let all_cameras: Arc<std::sync::Mutex<Vec<DiscoveredCamera>>> = Arc::new(std::sync::Mutex::new(Vec::new()));

        // 获取所有网络接口
        let network_interfaces = get_all_network_interfaces();

        if network_interfaces.is_empty() {
            log::warn!("未找到有效的网络接口");
            return Vec::new();
        }

        log::info!("开始扫描 {} 个网络接口...", network_interfaces.len());

        // 为每个网络接口创建扫描任务
        let scan_tasks: Vec<_> = network_interfaces
            .into_iter()
            .map(|iface| {
                let all_cameras_clone = Arc::clone(&all_cameras);

                async move {
                    log::info!("正在扫描网卡: {} ({})", iface.name, iface.ip);

                    // 生成该子网的主机列表
                    let subnet_hosts = match generate_subnet_hosts_from_cidr(&iface.subnet) {
                        Ok(hosts) => hosts,
                        Err(e) => {
                            log::error!("生成子网 {} 主机列表失败: {}", iface.subnet, e);
                            return;
                        }
                    };

                    log::info!("网卡 {} 的子网 {} 共有 {} 个主机", iface.name, iface.subnet, subnet_hosts.len());

                    // 并发扫描该子网的所有主机
                    let host_scan_tasks: Vec<_> = subnet_hosts
                        .into_iter()
                        .map(|host_ip| {
                            let ports = COMMON_CAMERA_PORTS.to_vec();
                            let timeout_duration = Duration::from_secs(timeout_secs);

                            async move {
                                scan_single_host(host_ip, ports, timeout_duration).await
                            }
                        })
                        .collect();

                    // 执行扫描
                    let results = join_all(host_scan_tasks).await;

                    // 收集结果
                    {
                        let mut cameras_vec = all_cameras_clone.lock().unwrap();
                        for result in results {
                            for camera in result {
                                // 去重检查
                                if !cameras_vec.iter().any(|c| c.address == camera.address) {
                                    cameras_vec.push(camera);
                                }
                            }
                        }

                        log::info!(
                            "网卡 {} 扫描完成，发现 {} 个设备",
                            iface.name,
                            cameras_vec.len()
                        );
                    }
                }
            })
            .collect();

        // 并发执行所有网卡的扫描任务
        join_all(scan_tasks).await;

        // 返回所有发现的设备
        let cameras = {
            let guard = all_cameras.lock().unwrap();
            guard.clone()
        };

        log::info!("所有网卡扫描完成，共发现 {} 个设备", cameras.len());
        cameras
    }


}

/// 扫描单个主机的指定端口，并验证是否为真正的摄像机设备
async fn scan_single_host(
    host_ip: String,
    ports: Vec<u16>,
    timeout_duration: Duration,
) -> Vec<DiscoveredCamera> {
    let mut cameras = Vec::new();

    for &port in &ports {
        let socket_addr = match host_ip.parse::<IpAddr>() {
            Ok(ip) => SocketAddr::new(ip, port),
            Err(_) => continue,
        };

        // 使用 timeout 包装连接尝试
        match timeout(timeout_duration, tokio::net::TcpStream::connect(socket_addr)).await {
            Ok(Ok(_)) => {
                log::debug!("端口 {}:{} 开放，尝试验证是否为摄像机...", host_ip, port);

                // 🎯 关键改进: 验证是否真的是摄像机设备
                if verify_camera_device(&host_ip, port, timeout_duration).await {
                    // 🎯 保持实际验证通过的端口，不要强制改为2000
                    // 设备的ONVIF服务可能运行在80、8000等端口上
                    let display_port = port;

                    let camera = DiscoveredCamera {
                        address: host_ip.clone(),
                        port: Some(display_port),
                        name: Some(format!("摄像机_{}", host_ip.split('.').last().unwrap_or("0"))),
                        manufacturer: None,
                        model: None,
                        serial_number: None,
                        protocol: "Verified".to_string(),
                        services: vec![format!("port:{}", display_port)],
                    };
                    cameras.push(camera);
                    log::info!("✅ 验证通过: {}:{} 是摄像机设备", host_ip, display_port);
                    break; // 找到摄像机即可
                } else {
                    log::debug!("❌ 验证失败: {}:{} 不是摄像机设备，跳过", host_ip, port);
                }
            }
            Ok(Err(_)) => {
                // 连接失败，继续下一个端口
            }
            Err(_) => {
                // 超时，继续下一个端口
            }
        }
    }

    cameras
}

/// 🎯 验证设备是否为真正的摄像机
/// 核心思想：不要只问"谁有IP地址？"，而要问"谁在主动告诉我它是一个摄像机？"
/// 通过主动协议探测（RTSP、ONVIF、厂商API）来验证设备身份
async fn verify_camera_device(
    host_ip: &str,
    port: u16,
    timeout_duration: Duration,
) -> bool {
    // 🎯 新增：IP地址预检查 - 快速排除常见路由器/网关IP
    if is_common_router_ip(host_ip) {
        log::debug!("❌ IP {} 是常见路由器/网关地址，直接拒绝", host_ip);
        return false;
    }

    // 1. 最可靠的 ONVIF 检测
    // ONVIF是网络摄像机的行业标准，只有真正的摄像机才会响应ONVIF Probe
    if verify_onvif_probe(host_ip, port, timeout_duration).await {
        log::debug!("✅ ONVIF验证通过 {}:{}", host_ip, port);
        return true;
    }

    // 2. RTSP 服务检测（即使端口不是554，也可以尝试连接）
    // 真正的摄像机会响应 RTSP DESCRIBE 请求并返回 SDP 描述
    if verify_rtsp_describe(host_ip, 554, timeout_duration).await {
        log::debug!("✅ RTSP验证通过 {}:{}", host_ip, port);
        return true;
    }

    // 3. 尝试访问厂商特有的API（海康/大华/宇视）
    // 这些厂商私有协议是摄像机的重要标识
    if verify_vendor_api(host_ip, port, timeout_duration).await {
        log::debug!("✅ 厂商API验证通过 {}:{}", host_ip, port);
        return true;
    }

    // 4. HTTP 特征验证仅作为最后补充，且需要非常严格的条件
    // 必须同时满足：包含摄像机特征 AND 不包含明显的非摄像机特征
    if verify_http_camera_signature(host_ip, port, timeout_duration).await {
        log::debug!("✅ HTTP特征验证通过 {}:{}", host_ip, port);
        return true;
    }

    log::debug!("❌ 端口 {}:{} 验证失败，不是摄像机", host_ip, port);
    false
}

/// 🎯 HTTP特征验证 - 检查HTTP响应是否包含摄像机特征
async fn verify_http_camera_signature(
    host_ip: &str,
    port: u16,
    timeout_dur: Duration,
) -> bool {
    let url = format!("http://{}:{}", host_ip, port);

    let result = tokio::time::timeout(timeout_dur, async {
        let client = reqwest::Client::builder()
            .timeout(timeout_dur)
            .danger_accept_invalid_certs(true)
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        // 发送GET请求获取响应
        let response = match client
            .get(&url)
            .send()
            .await
        {
            Ok(r) => r,
            Err(_) => return false,
        };

        // 检查HTTP响应头中的Server字段
        let headers = response.headers();

        // 🎯 增强：扩展摄像机厂商Server头关键词
        let server_keywords = [
            "hikvision", "dahua", "dss", "dsm",
            "axis", "bosch", "vivotek", "hanwha",
            "web server for ipc", "goahead-webs",
            "thttpd", "lighttpd",
            "ambarella", "ti davinci", "rockchip",  // 摄像机常用芯片厂商
            "hi3516", "hi3518", "hi3520",          // 海思芯片系列
            "gxchip", "goke",                        // 国科微芯片
            "sunplus", "novatek",                    // 凌阳、联咏芯片
            "onvif", "gb28181",                      // 协议标识
            "ipc", "nvr", "dvr", "xvr",              // 设备类型
            "camera", "video", "surveillance"        // 通用摄像机关键词
        ];

        if let Some(server) = headers.get("server").and_then(|v| v.to_str().ok()) {
            let server_lower = server.to_lowercase();

            // 如果Server头明确包含摄像机厂商名称或特征，直接确认
            for keyword in &server_keywords {
                if server_lower.contains(keyword) {
                    log::debug!("✅ HTTP Server头匹配 [{}]: {}", keyword, host_ip);
                    return true;
                }
            }
        }

        // 检查WWW-Authenticate头（摄像机常用digest认证）
        if let Some(auth) = headers.get("www-authenticate").and_then(|v| v.to_str().ok()) {
            let auth_lower = auth.to_lowercase();
            if auth_lower.contains("digest") &&
               (auth_lower.contains("ipc") || auth_lower.contains("camera") ||
                auth_lower.contains("device")) {
                log::debug!("✅ WWW-Authenticate头匹配摄像机特征: {}", host_ip);
                return true;
            }
        }

        // 检查响应内容类型
        let content_type = headers
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");

        // 如果是HTML页面，检查页面内容
        if content_type.contains("text/html") || content_type.is_empty() {
            let text = match response.text().await {
                Ok(t) => t,
                Err(_) => return false,
            };
            let text_lower = text.to_lowercase();

            //  优先检测明确的非摄像机特征 - 一旦检测到就直接拒绝（严格模式）
            let obviously_non_camera = [
                // 网络设备
                "router", "gateway", "modem", "firewall", "switch",
                // 路由器固件特征
                "powered by openwrt", "dd-wrt", "tomato", "asuswrt", "merlin",
                // NAS特征
                "synology", "qnap", "nas", "diskstation", "plex", "emby",
                // 打印设备
                "printer", "print server",
                // Web服务器
                "windows iis", "apache http server", "apache/2", "nginx/1",
                // 路由器/网关页面特征（严格匹配）
                "无线", "wifi", "宽带", "上网", "网络设置", "管理后台", "管理界面",
                // 常见网关IP（作为页面内容检测）
                "192.168.1.1", "192.168.0.1", "192.168.31.1", "192.168.2.1",
                // 🎯 新增：路由器品牌管理页面特征
                "tp-link", "tplink", "asus", "d-link", "netgear",
                "huawei", "zte", "miwifi", "xiaomi",
                // 🎯 新增：路由器功能特征
                "dhcp", "pppoe", "wan", "lan", "nat",
            ];

            for keyword in &obviously_non_camera {
                if text_lower.contains(keyword) {
                    log::debug!("❌ 检测到明显的非摄像机特征 [{}]: {}", keyword, host_ip);
                    return false;
                }
            }

            // 🎯 增强：扩展摄像机页面特征关键词（严格模式）
            let page_keywords = [
                "hikvision", "dahua", "ip camera", "network camera",
                "video surveillance", "cctv", "nvr", "dvr", "xvr",
                "camera web server", "live view", "video preview",
                "surveillance system",
                // 🎯 删除：onvif - 单独检查时需要更严格的条件
                // 🎯 删除：rtsp - 单独出现可能是路由器
                // 🎯 删除：video encoder/decoder - 太通用
                // 🎯 删除：ptz - 可能出现在其他设备中
                // 🎯 删除：audio/microphone/speaker - 太通用
                // 🎯 删除：device info/system info - 太通用
                // 🎯 只保留明确的摄像机核心特征
            ];

            for keyword in &page_keywords {
                if text_lower.contains(keyword) {
                    log::debug!("✅ HTTP页面内容匹配 [{}]: {}", keyword, host_ip);
                    return true;
                }
            }

            // 🎯 严格验证：必须有非常明确的摄像机特征
            // 方案1：品牌名称 + 摄像机相关词汇
            let has_brand = text_lower.contains("hikvision") ||
                           text_lower.contains("dahua") ||
                           text_lower.contains("uniview") ||
                           text_lower.contains("axis") ||
                           text_lower.contains("hanwha") ||
                           text_lower.contains("bosch");

            let has_camera_term = text_lower.contains("camera") ||
                                 text_lower.contains("ipc") ||
                                 text_lower.contains("nvr") ||
                                 text_lower.contains("dvr") ||
                                 text_lower.contains("xvr");

            // 方案2：明确的视频监控术语
            let has_surveillance = text_lower.contains("surveillance") ||
                                  text_lower.contains("cctv") ||
                                  text_lower.contains("monitoring");

            // 方案3：视频流协议 + 摄像机上下文
            let has_stream_protocol = (text_lower.contains("rtsp") ||
                                      text_lower.contains("h.264") ||
                                      text_lower.contains("h.265")) &&
                                     (text_lower.contains("stream") ||
                                      text_lower.contains("live") ||
                                      text_lower.contains("mainstream") ||
                                      text_lower.contains("substream"));

            // 方案4：ONVIF服务 + 摄像机上下文（需要同时存在）
            let has_onvif_service = text_lower.contains("onvif") &&
                                   (text_lower.contains("device service") ||
                                    text_lower.contains("media service") ||
                                    text_lower.contains("ptz service"));

            // 🎯 严格规则：必须满足以下任一组合条件
            if (has_brand && has_camera_term) ||
               has_surveillance ||
               has_stream_protocol ||
               has_onvif_service {
                log::debug!("✅ 检测到明确的摄像机特征: {}", host_ip);
                return true;
            }

            // 🎯 拒绝所有其他情况，包括只有通用词汇的情况
            log::debug!("❌ 未检测到足够的摄像机特征: {}", host_ip);
            return false;
        }

        false
    }).await;

    match result {
        Ok(val) => val,
        Err(_) => false,
    }
}

/// 🎯 ONVIF Probe验证 - 检查设备是否主动声明为ONVIF摄像机
/// 核心思想：不要只问"谁有IP地址？"，而要问"谁在主动告诉我它是一个摄像机？"
async fn verify_onvif_probe(
    host_ip: &str,
    port: u16,
    timeout_dur: Duration,
) -> bool {
    // 🎯 新增：IP地址预检查 - 快速排除常见路由器/网关IP
    if is_common_router_ip(host_ip) {
        log::debug!(" IP {} 是常见路由器/网关地址，跳过ONVIF验证", host_ip);
        return false;
    }

    let onvif_url = format!("http://{}:{}/onvif/device_service", host_ip, port);

    let result = tokio::time::timeout(timeout_dur, async {
        let client = reqwest::Client::builder()
            .timeout(timeout_dur)
            .danger_accept_invalid_certs(true)
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        // 尝试发送简单的GET请求到ONVIF端点
        let response = match client.get(&onvif_url).send().await {
            Ok(r) => r,
            Err(_) => return false,
        };

        // 405 Method Not Allowed 表示ONVIF服务存在（但需要POST请求）
        // 200 OK 表示直接可访问
        let status = response.status().as_u16();

        if status == 405 || status == 200 {
            // 🎯 关键验证：检查响应内容是否为XML文档
            // 如果返回XML，则100%是ONVIF摄像机
            let content_type = response.headers()
                .get("content-type")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("");

            // 检查Content-Type是否包含XML
            let is_xml_content = content_type.contains("xml") || content_type.contains("soap");

            if is_xml_content {
                log::debug!("✅ ONVIF服务检测成功 [{}]: {}",
                           if status == 405 { "405" } else { "200" },
                           host_ip);
                return true;
            }

            // 即使Content-Type不是XML，也尝试读取响应内容检查
            if let Ok(text) = response.text().await {
                if text.starts_with("<?xml") ||
                   text.contains("<s:Envelope") ||
                   text.contains("<soap:Envelope") ||
                   text.contains("onvif") ||
                   text.contains("DeviceManagement") {
                    log::debug!("✅ ONVIF服务检测成功（响应包含XML）: {}", host_ip);
                    return true;
                }
            }
        }

        false
    }).await;

    match result {
        Ok(val) => val,
        Err(_) => false,
    }
}

/// 🎯 RTSP DESCRIBE 验证 - 真正的摄像机响应 DESCRIBE 会返回 SDP 描述
/// RTSP 是网络摄像机的标准流媒体协议，只有真正的摄像机才会响应
async fn verify_rtsp_describe(
    host_ip: &str,
    port: u16,
    timeout_dur: Duration,
) -> bool {
    let addr = format!("{}:{}", host_ip, port);

    let result = tokio::time::timeout(timeout_dur, async {
        let mut stream = match tokio::net::TcpStream::connect(&addr).await {
            Ok(s) => s,
            Err(_) => return false,
        };

        let request = format!(
            "DESCRIBE rtsp://{}/ RTSP/1.0\r\n\
             CSeq: 1\r\n\
             User-Agent: CameraDiscovery\r\n\
             Accept: application/sdp\r\n\
             \r\n",
            host_ip
        );

        if stream.write_all(request.as_bytes()).await.is_err() {
            return false;
        }

        let mut buf = [0u8; 2048];
        let n = match stream.read(&mut buf).await {
            Ok(n) => n,
            Err(_) => return false,
        };

        if n == 0 {
            return false;
        }

        let response = String::from_utf8_lossy(&buf[..n]);
        let response_lower = response.to_lowercase();

        // 检查是否包含 RTSP 200 OK 响应
        if !response.contains("RTSP/1.0 200") && !response.contains("RTSP/1.0 401") {
            log::debug!("❌ RTSP响应不是200或401: {}", host_ip);
            return false;
        }

        // 检查是否包含 SDP 媒体描述（包含 m=video 或 m=audio）
        let has_video_media = response_lower.contains("m=video");
        let has_audio_media = response_lower.contains("m=audio");

        if has_video_media || has_audio_media {
            log::debug!("✅ RTSP SDP验证通过（包含媒体流）: {}", host_ip);
            return true;
        }

        // 即使没有 SDP，只要返回 RTSP 200/401 且有基本 RTSP 头，也可能
        if response_lower.contains("session:") || response.contains("CSeq:") {
            log::debug!("✅ RTSP基本协议验证通过: {}", host_ip);
            return true;
        }

        false
    }).await;

    match result {
        Ok(val) => val,
        Err(_) => false,
    }
}

/// 🎯 厂商API验证 - 尝试访问厂商特有的API
/// 海康、大华、宇视等厂商都有私有的设备信息接口
async fn verify_vendor_api(
    host_ip: &str,
    port: u16,
    timeout_dur: Duration,
) -> bool {
    let result = tokio::time::timeout(timeout_dur, async {
        let client = reqwest::Client::builder()
            .timeout(timeout_dur)
            .danger_accept_invalid_certs(true)
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        // 海康ISAPI - 最可靠的设备信息接口
        let hikvision_urls = [
            format!("http://{}:{}/ISAPI/System/deviceInfo", host_ip, port),
            format!("http://{}:{}/onvif/device_service", host_ip, port),
            format!("http://{}:{}/SDK/device_general_info", host_ip, port),
        ];

        for url in &hikvision_urls {
            let response = match client.get(url).send().await {
                Ok(r) => r,
                Err(_) => continue,
            };

            if response.status().as_u16() == 200 {
                let text = match response.text().await {
                    Ok(t) => t,
                    Err(_) => continue,
                };

                let text_lower = text.to_lowercase();

                // 海康ISAPI设备信息特征
                if text_lower.contains("<deviceinformation>") ||
                   text_lower.contains("<devicename>") ||
                   text_lower.contains("<manufacturer>") ||
                   text_lower.contains("<model>") ||
                   text_lower.contains("<serialnumber>") ||
                   text.contains("<?xml") {
                    log::debug!("✅ 海康ISAPI验证通过: {}", host_ip);
                    return true;
                }
            }
        }

        // 大华API
        let dahua_urls = [
            format!("http://{}:{}/cgi-bin/magicBox.cgi?action=getDeviceInfo", host_ip, port),
            format!("http://{}:{}/cgi-bin/configManager.cgi?action=getSystemInfo", host_ip, port),
        ];

        for url in &dahua_urls {
            let response = match client.get(url).send().await {
                Ok(r) => r,
                Err(_) => continue,
            };

            if response.status().as_u16() == 200 {
                let text = match response.text().await {
                    Ok(t) => t,
                    Err(_) => continue,
                };

                let text_lower = text.to_lowercase();

                // 大华设备信息特征
                if text_lower.contains("deviceinfo") ||
                   text_lower.contains("devicename") ||
                   text_lower.contains("serialno") ||
                   text_lower.contains("model") ||
                   text_lower.contains(" Dahua") ||
                   text.contains("=") {
                    log::debug!("✅ 大华API验证通过: {}", host_ip);
                    return true;
                }
            }
        }

        // 宇视API
        let uniview_urls = [
            format!("http://{}:{}/cgi-bin/device.cgi?action=info", host_ip, port),
            format!("http://{}:{}/cgi-bin/net.cgi?action=default", host_ip, port),
        ];

        for url in &uniview_urls {
            let response = match client.get(url).send().await {
                Ok(r) => r,
                Err(_) => continue,
            };

            if response.status().as_u16() == 200 {
                let text = match response.text().await {
                    Ok(t) => t,
                    Err(_) => continue,
                };

                let text_lower = text.to_lowercase();

                // 宇视设备信息特征
                if text_lower.contains("uniview") ||
                   text_lower.contains("deviceinfo") ||
                   text_lower.contains("model") ||
                   text.contains("=") {
                    log::debug!("✅ 宇视API验证通过: {}", host_ip);
                    return true;
                }
            }
        }

        // 通用ONVIF设备服务
        let onvif_urls = [
            format!("http://{}:{}/onvif/device_service", host_ip, port),
            format!("http://{}:{}/onvif/media_service", host_ip, port),
        ];

        for url in &onvif_urls {
            let response = match client.get(url).send().await {
                Ok(r) => r,
                Err(_) => continue,
            };

            let status = response.status().as_u16();
            if status == 200 || status == 405 {
                // 405 Method Not Allowed 表示ONVIF服务存在
                log::debug!("✅ ONVIF设备服务验证通过: {}", host_ip);
                return true;
            }
        }

        false
    }).await;

    match result {
        Ok(val) => val,
        Err(_) => false,
    }
}

/// 解析 ONVIF Probe 响应
fn parse_onvif_response(response: &str, addr: &str) -> Option<DiscoveredCamera> {
    // 提取 IP 地址（从 addr 字符串中）
    let ip = if let Some(pos) = addr.rfind(':') {
        &addr[..pos]
    } else {
        addr
    };

    // 检查基本的 ONVIF 响应格式
    let response_lower = response.to_lowercase();

    // 🎯 验证：响应必须是有效的SOAP消息
    if !response_lower.contains("<e:envelope") || !response_lower.contains("<e:body") {
        log::debug!("❌ ONVIF响应格式不是有效的SOAP消息: {}", ip);
        return None;
    }

    // 🎯 验证：必须包含ProbeMatch或设备类型信息
    // 放宽条件：允许包含types、probes、matches等多种格式
    let has_device_info = response_lower.contains("networkvideotransmitter") ||
                          response_lower.contains(":types>") ||
                          response_lower.contains("probematch") ||
                          response_lower.contains("xaddr") ||
                          response_lower.contains("onvif");

    if !has_device_info {
        log::debug!("❌ ONVIF响应不包含设备信息: {}", ip);
        return None;
    }

    // 简单的 XML 解析，提取关键信息
    // 在实际生产中应该使用 xml-rs 或 quick-xml 库

    let mut name = None;
    let mut xaddr = None;

    // 尝试提取设备名称
    if let Some(start) = response.find("<dn:XAddrs>") {
        if let Some(end) = response[start..].find("</dn:XAddrs>") {
            xaddr = Some(response[start + 11..start + end].trim().to_string());
        }
    }

    // 如果没有 XAddrs，尝试其他格式
    if xaddr.is_none() {
        if let Some(start) = response.find("<d:XAddrs>") {
            if let Some(end) = response[start..].find("</d:XAddrs>") {
                xaddr = Some(response[start + 10..start + end].trim().to_string());
            }
        }
    }

    // 尝试提取设备友好名称
    for tag in &["<dn:FriendlyName>", "<d:FriendlyName>"] {
        if let Some(start) = response.find(tag) {
            let tag_len = tag.len();
            if let Some(end) = response[start..].find(&format!("</{}", &tag[1..])) {
                name = Some(response[start + tag_len..start + end].trim().to_string());
                break;
            }
        }
    }

    // 从 XAddr 中提取端口
    let port = xaddr.as_ref().and_then(|url| {
        if let Some(pos) = url.rfind(':') {
            if pos > 7 { // http:// 之后
                url[pos + 1..].split('/').next().and_then(|p| p.parse::<u16>().ok())
            } else {
                None
            }
        } else {
            None
        }
    });

    Some(DiscoveredCamera {
        address: ip.to_string(),
        port,
        name: name.or_else(|| Some(format!("ONVIF_{}", ip))),
        manufacturer: None, // 可以从其他字段提取
        model: None,
        serial_number: None, // 🎯 新增字段
        protocol: "ONVIF".to_string(),
        services: xaddr.into_iter().collect(),
    })
}

/// 根据本地 IP 和子网掩码生成子网内的所有主机 IP
fn generate_subnet_hosts(local_ip: &str, cidr: u8) -> Result<Vec<String>, String> {
    use ipnet::Ipv4Net;
    use std::net::Ipv4Addr;

    let ip: Ipv4Addr = local_ip
        .parse()
        .map_err(|e| format!("IP 地址解析失败: {}", e))?;

    let network = Ipv4Net::new(ip, cidr)
        .map_err(|e| format!("子网创建失败: {}", e))?;

    // 生成子网内所有主机（排除网络地址和广播地址）
    let hosts: Vec<String> = network
        .hosts()
        .map(|addr| addr.to_string())
        .collect();

    Ok(hosts)
}

///  检查是否为常见路由器/网关IP地址
/// 快速排除常见路由器IP，避免误识别为摄像机
fn is_common_router_ip(ip: &str) -> bool {
    // 常见路由器/网关IP模式：
    // - 以 .1 结尾（如 192.168.1.1, 192.168.31.1）
    // - 以 .254 结尾（某些路由器）
    // - 常见的网关IP段

    // 检查是否以 .1 或 .254 结尾（常见网关地址）
    if ip.ends_with(".1") || ip.ends_with(".254") {
        return true;
    }

    // 常见路由器IP白名单
    let common_router_ips = [
        "192.168.1.1", "192.168.0.1", "192.168.31.1", "192.168.2.1",
        "192.168.5.1", "192.168.10.1", "192.168.100.1", "192.168.168.1",
        "10.0.0.1", "10.1.1.1", "10.10.10.1",
    ];

    common_router_ips.contains(&ip)
}

/// 获取本地 IP 地址（使用 if_addrs 库）
pub fn get_local_ip() -> Option<String> {
    use if_addrs::get_if_addrs;

    // 获取所有网络接口
    let interfaces = match get_if_addrs() {
        Ok(ifaces) => ifaces,
        Err(e) => {
            log::error!("获取网络接口失败: {}", e);
            return None;
        }
    };

    // 优先选择非回环、IPv4 地址
    for iface in &interfaces {
        if !iface.is_loopback() {
            if let IpAddr::V4(ip) = iface.ip() {
                // 排除私有地址中的特殊范围
                if !ip.is_private() || is_common_private_range(ip) {
                    log::info!("找到本地 IP: {} ({})", ip, iface.name);
                    return Some(ip.to_string());
                }
            }
        }
    }

    // 如果没有找到合适的地址，返回第一个非回环地址
    for iface in &interfaces {
        if !iface.is_loopback() {
            if let IpAddr::V4(ip) = iface.ip() {
                return Some(ip.to_string());
            }
        }
    }

    None
}

/// 获取所有有效的网络接口信息（用于多网卡扫描）
#[derive(Debug, Clone)]
pub struct NetworkInterface {
    pub name: String,
    pub ip: String,
    pub subnet: String,
    pub cidr: u8,  // 🎯 新增：实际CIDR值
    pub is_primary: bool,
}

pub fn get_all_network_interfaces() -> Vec<NetworkInterface> {
    use if_addrs::get_if_addrs;

    let mut interfaces = Vec::new();

    // 获取所有网络接口
    let ifaces = match get_if_addrs() {
        Ok(ifaces) => ifaces,
        Err(e) => {
            log::error!("获取网络接口失败: {}", e);
            return interfaces;
        }
    };

    log::info!("检测到 {} 个网络接口", ifaces.len());

    // 筛选有效的 IPv4 接口
    for (idx, iface) in ifaces.iter().enumerate() {
        if iface.is_loopback() {
            continue; // 跳过回环接口
        }

        if let IpAddr::V4(ip) = iface.ip() {
            // 检查是否为常见的私有地址段
            if is_common_private_range(ip) {
                // 🎯 根据IP地址段推断常见CIDR（因为if_addrs不提供netmask）
                let octets = ip.octets();

                // 根据常见网络配置推断CIDR
                let cidr = if octets[0] == 10 {
                    // 10.x.x.x 通常是 /8 或 /16
                    16  // 保守估计使用/16
                } else if octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31 {
                    // 172.16-31.x.x 通常是 /12 或 /16
                    16
                } else if octets[0] == 192 && octets[1] == 168 {
                    // 192.168.x.x 通常是 /24
                    24
                } else {
                    24  // 默认/24
                };

                // 计算网络地址
                let network_addr = format!("{}.{}.{}.0", octets[0], octets[1], octets[2]);
                let subnet = format!("{}/{}", network_addr, cidr);

                let network_iface = NetworkInterface {
                    name: iface.name.clone(),
                    ip: ip.to_string(),
                    subnet,
                    cidr,  // 🎯 保存推断的CIDR
                    is_primary: idx == 0, // 第一个有效接口作为主网卡
                };

                log::info!(
                    "发现网络接口: {} - IP: {}, 子网: {} (CIDR: {})",
                    network_iface.name,
                    network_iface.ip,
                    network_iface.subnet,
                    network_iface.cidr
                );

                interfaces.push(network_iface);
            }
        }
    }

    log::info!("共找到 {} 个有效网络接口", interfaces.len());
    interfaces
}

/// 从 CIDR 格式生成子网主机列表
fn generate_subnet_hosts_from_cidr(cidr: &str) -> Result<Vec<String>, String> {
    use ipnet::Ipv4Net;

    // 解析 CIDR，例如 "192.168.1.0/24"
    let network: Ipv4Net = cidr.parse().map_err(|e| format!("解析 CIDR 失败: {}", e))?;

    // 生成该子网内的所有主机 IP（排除网络地址和广播地址）
    let mut hosts = Vec::new();
    for ip in network.hosts() {
        hosts.push(ip.to_string());
    }

    Ok(hosts)
}

/// 判断是否为常见的私有地址范围（192.168.x.x, 10.x.x.x, 172.16-31.x.x）
fn is_common_private_range(ip: std::net::Ipv4Addr) -> bool {
    let octets = ip.octets();

    // 192.168.x.x
    if octets[0] == 192 && octets[1] == 168 {
        return true;
    }

    // 10.x.x.x
    if octets[0] == 10 {
        return true;
    }

    // 172.16-31.x.x
    if octets[0] == 172 && (octets[1] >= 16 && octets[1] <= 31) {
        return true;
    }

    false
}

// 🎯 新增：获取所有网络接口的简化函数
fn get_network_interfaces() -> Result<Vec<NetworkInterface>, String> {
    Ok(get_all_network_interfaces())
}
