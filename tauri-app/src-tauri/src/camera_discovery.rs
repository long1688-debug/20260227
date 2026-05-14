use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;
use std::time::Duration;
use tokio::time::timeout;
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

// 常见摄像机端口
const COMMON_CAMERA_PORTS: &[u16] = &[80, 554, 8000, 8080, 8899, 37777, 37778];

// 🎯 海康威视 SADP 协议常量
const HIKVISION_SADP_MULTICAST: &str = "239.255.255.250";
const HIKVISION_SADP_PORT: u16 = 37020;

// 🎯 大华 P2P 协议常量
const DAHUA_P2P_PORT: u16 = 37777;

// 🎯 GB/T 28181 协议常量
const GB28181_SIP_PORT: u16 = 5060;

pub struct CameraDiscovery;

impl CameraDiscovery {
    pub fn new() -> Self {
        CameraDiscovery
    }

    pub async fn discover_all(&self, timeout_secs: u64) -> ScanResult {
        let start = std::time::Instant::now();

        // 并行执行多种发现方式
        let onvif_future = self.discover_onvif(timeout_secs);
        let ssdp_future = self.discover_ssdp(timeout_secs);
        let subnet_scan_future = self.scan_local_subnet(timeout_secs);

        let (onvif_result, ssdp_result, subnet_result) = tokio::join!(
            onvif_future,
            ssdp_future,
            subnet_scan_future
        );

        // 合并结果并去重
        let mut cameras = Vec::new();
        let mut seen = HashMap::new();

        for camera in onvif_result.into_iter().chain(ssdp_result).chain(subnet_result) {
            if !seen.contains_key(&camera.address) {
                seen.insert(camera.address.clone(), true);
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

    pub async fn discover_ssdp(&self, _timeout_secs: u64) -> Vec<DiscoveredCamera> {
        let cameras = Vec::new();

        // SSDP 发现同样可能受网络限制，返回空数组
        cameras
    }

    /// 扫描本地子网中的所有主机
    pub async fn scan_local_subnet(&self, timeout_secs: u64) -> Vec<DiscoveredCamera> {
        let mut cameras = Vec::new();

        // 获取本地 IP 地址
        let local_ip = match get_local_ip() {
            Some(ip) => ip,
            None => {
                log::warn!("无法获取本地 IP，跳过子网扫描");
                return cameras;
            }
        };

        log::info!("开始扫描本地子网，本地 IP: {}", local_ip);

        // 解析本地 IP 并生成 /24 子网
        let subnet_hosts = match generate_subnet_hosts(&local_ip, 24) {
            Ok(hosts) => hosts,
            Err(e) => {
                log::error!("生成子网主机列表失败: {}", e);
                return cameras;
            }
        };

        log::info!("子网中共有 {} 个主机需要扫描", subnet_hosts.len());

        // 使用 futures 并发扫描所有主机
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

        log::info!("子网扫描完成，发现 {} 个设备", cameras.len());
        cameras
    }

    /// 扫描本地子网中的所有主机（带进度回调）
    pub async fn scan_local_subnet_with_progress(&self, timeout_secs: u64, app_handle: &tauri::AppHandle) -> Vec<DiscoveredCamera> {
        let mut cameras = Vec::new();

        // 获取本地 IP 地址
        let local_ip = match get_local_ip() {
            Some(ip) => ip,
            None => {
                log::warn!("无法获取本地 IP，跳过子网扫描");
                return cameras;
            }
        };

        log::info!("开始扫描本地子网，本地 IP: {}", local_ip);

        // 解析本地 IP 并生成 /24 子网
        let subnet_hosts = match generate_subnet_hosts(&local_ip, 24) {
            Ok(hosts) => hosts,
            Err(e) => {
                log::error!("生成子网主机列表失败: {}", e);
                return cameras;
            }
        };

        let total_hosts = subnet_hosts.len();
        log::info!("子网中共有 {} 个主机需要扫描", total_hosts);

        // 发送初始进度（Tauri v2 使用 emit_to）
        use tauri::Emitter;
        let _ = app_handle.emit("scan-progress", serde_json::json!({
            "progress": 0,
            "current": 0,
            "total": total_hosts,
            "message": format!("准备扫描 {} 个主机...", total_hosts),
            "found_count": 0
        }));

        // 使用 futures 并发扫描所有主机
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

        log::info!("子网扫描完成，发现 {} 个设备", cameras.len());
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

    // 🎯 GB/T 28181 国标协议发现
    pub async fn discover_gb28181(&self, timeout_secs: u64) -> Vec<DiscoveredCamera> {
        let mut cameras = Vec::new();
        
        log::info!("🇨🇳 开始 GB/T 28181 国标协议发现...");
        
        // GB/T 28181 基于 SIP 协议,通过发送 REGISTER 或 MESSAGE 消息发现设备
        // 这里简化实现:扫描常见的 GB28181 端口
        
        let local_ip = match get_local_ip() {
            Some(ip) => ip,
            None => {
                log::warn!("无法获取本地 IP，跳过 GB28181 发现");
                return cameras;
            }
        };
        
        let subnet_hosts = match generate_subnet_hosts(&local_ip, 24) {
            Ok(hosts) => hosts,
            Err(e) => {
                log::error!("生成子网主机列表失败: {}", e);
                return cameras;
            }
        };
        
        log::info!("在 {} 个子网主机中搜索 GB28181 设备...", subnet_hosts.len());
        
        // 并发扫描 GB28181 SIP 端口 (5060)
        let scan_tasks: Vec<_> = subnet_hosts
            .into_iter()
            .map(|host_ip| {
                let timeout_duration = Duration::from_secs(timeout_secs);
                
                async move {
                    scan_gb28181_device(host_ip, timeout_duration).await
                }
            })
            .collect();
        
        let results = join_all(scan_tasks).await;
        
        for result in results {
            cameras.extend(result);
        }
        
        log::info!("GB28181 发现完成，共发现 {} 个设备", cameras.len());
        cameras
    }

    // 🎯 厂商私有协议发现 (海康SADP + 大华P2P)
    pub async fn discover_vendor_protocols(&self, timeout_secs: u64) -> Vec<DiscoveredCamera> {
        let mut cameras = Vec::new();
        
        log::info!("🏭 开始厂商私有协议发现 (海康SADP + 大华P2P)...");
        
        // 并行执行海康和大华发现
        let hik_future = self.discover_hikvision_sadp(timeout_secs);
        let dahua_future = self.discover_dahua_p2p(timeout_secs);
        
        let (hik_result, dahua_result) = tokio::join!(hik_future, dahua_future);
        
        cameras.extend(hik_result);
        cameras.extend(dahua_result);
        
        log::info!("厂商协议发现完成，共发现 {} 个设备", cameras.len());
        cameras
    }

    // 🎯 海康威视 SADP 协议发现
    async fn discover_hikvision_sadp(&self, timeout_secs: u64) -> Vec<DiscoveredCamera> {
        let mut cameras = Vec::new();
        
        log::info!("🔴 海康SADP: 发送探测包到 {}:{}", HIKVISION_SADP_MULTICAST, HIKVISION_SADP_PORT);
        
        use std::net::UdpSocket;
        use std::time::Duration;
        
        // 创建 UDP socket
        let socket = match UdpSocket::bind("0.0.0.0:0") {
            Ok(s) => s,
            Err(e) => {
                log::error!("海康SADP: 创建 UDP socket 失败: {}", e);
                return cameras;
            }
        };
        
        socket.set_broadcast(true).ok();
        socket.set_read_timeout(Some(Duration::from_secs(timeout_secs))).ok();
        
        // 海康SADP探测消息 (简化版本)
        let sadp_probe = vec![
            0x00, 0x00, 0x00, 0x00, // Magic number
            0x01, 0x00,             // Command: Search
            0x00, 0x00,             // Sequence
        ];
        
        let multicast_addr = format!("{}:{}", HIKVISION_SADP_MULTICAST, HIKVISION_SADP_PORT);
        
        if let Err(e) = socket.send_to(&sadp_probe, &multicast_addr) {
            log::error!("海康SADP: 发送探测包失败: {}", e);
            return cameras;
        }
        
        log::info!("海康SADP: 探测包已发送，等待响应...");
        
        // 接收响应
        let mut buffer = [0u8; 4096];
        let start_time = std::time::Instant::now();
        let timeout_duration = Duration::from_secs(timeout_secs);
        
        while start_time.elapsed() < timeout_duration {
            match socket.recv_from(&mut buffer) {
                Ok((size, addr)) => {
                    if let Some(camera) = parse_hikvision_sadp_response(&buffer[..size], &addr.to_string()) {
                        if !cameras.iter().any(|c| c.address == camera.address) {
                            log::info!("海康SADP: 发现设备 {} ({})", camera.address, camera.name.as_deref().unwrap_or("Unknown"));
                            cameras.push(camera);
                        }
                    }
                }
                Err(_) => break,
            }
        }
        
        log::info!("海康SADP: 发现 {} 个设备", cameras.len());
        cameras
    }

    // 🎯 大华 P2P 协议发现
    async fn discover_dahua_p2p(&self, timeout_secs: u64) -> Vec<DiscoveredCamera> {
        let mut cameras = Vec::new();
        
        log::info!("🟡 大华P2P: 扫描常见端口 {}", DAHUA_P2P_PORT);
        
        let local_ip = match get_local_ip() {
            Some(ip) => ip,
            None => return cameras,
        };
        
        let subnet_hosts = match generate_subnet_hosts(&local_ip, 24) {
            Ok(hosts) => hosts,
            Err(_) => return cameras,
        };
        
        // 扫描大华常用端口
        let dahua_ports = vec![DAHUA_P2P_PORT, 37778, 80, 8080];
        
        let scan_tasks: Vec<_> = subnet_hosts
            .into_iter()
            .map(|host_ip| {
                let ports = dahua_ports.clone();
                let timeout_duration = Duration::from_secs(timeout_secs);
                
                async move {
                    scan_dahua_device(host_ip, ports, timeout_duration).await
                }
            })
            .collect();
        
        let results = join_all(scan_tasks).await;
        
        for result in results {
            cameras.extend(result);
        }
        
        log::info!("大华P2P: 发现 {} 个设备", cameras.len());
        cameras
    }
}

// 🎯 GB/T 28181 设备扫描辅助函数
async fn scan_gb28181_device(
    host_ip: String,
    timeout_duration: Duration,
) -> Vec<DiscoveredCamera> {
    let mut cameras = Vec::new();
    
    // 尝试连接 GB28181 SIP 端口
    let socket_addr = match host_ip.parse::<IpAddr>() {
        Ok(ip) => SocketAddr::new(ip, GB28181_SIP_PORT),
        Err(_) => return cameras,
    };
    
    match timeout(timeout_duration, tokio::net::TcpStream::connect(socket_addr)).await {
        Ok(Ok(_stream)) => {
            let camera = DiscoveredCamera {
                address: host_ip.clone(),
                port: Some(GB28181_SIP_PORT),
                name: Some(format!("GB28181_{}", host_ip.split('.').last().unwrap_or("0"))),
                manufacturer: Some("GB28181".to_string()),
                model: None,
                serial_number: None,
                protocol: "GB28181".to_string(),
                services: vec![format!("sip:{}", GB28181_SIP_PORT)],
            };
            cameras.push(camera);
            log::debug!("发现 GB28181 设备: {}:{}", host_ip, GB28181_SIP_PORT);
        }
        _ => {}
    }
    
    cameras
}

// 🎯 解析海康SADP响应
fn parse_hikvision_sadp_response(data: &[u8], addr: &str) -> Option<DiscoveredCamera> {
    // 简化的SADP响应解析
    // 实际应该根据海康SADP协议规范解析二进制数据
    
    let ip = if let Some(pos) = addr.rfind(':') {
        &addr[..pos]
    } else {
        addr
    };
    
    // 检查是否为有效的SADP响应 (简化判断)
    if data.len() < 10 {
        return None;
    }
    
    Some(DiscoveredCamera {
        address: ip.to_string(),
        port: Some(80), // 默认HTTP端口
        name: Some(format!("Hikvision_{}", ip)),
        manufacturer: Some("Hikvision".to_string()),
        model: None,
        serial_number: None,
        protocol: "Hikvision-SADP".to_string(),
        services: vec!["sadp".to_string()],
    })
}

// 🎯 大华设备扫描
async fn scan_dahua_device(
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
        
        match timeout(timeout_duration, tokio::net::TcpStream::connect(socket_addr)).await {
            Ok(Ok(_stream)) => {
                let camera = DiscoveredCamera {
                    address: host_ip.clone(),
                    port: Some(port),
                    name: Some(format!("Dahua_{}", host_ip.split('.').last().unwrap_or("0"))),
                    manufacturer: Some("Dahua".to_string()),
                    model: None,
                    serial_number: None,
                    protocol: "Dahua-P2P".to_string(),
                    services: vec![format!("port:{}", port)],
                };
                cameras.push(camera);
                log::debug!("发现大华设备: {}:{}", host_ip, port);
                break; // 找到一个开放端口即可
            }
            _ => {}
        }
    }
    
    cameras
}

/// 扫描单个主机的指定端口
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
            Ok(Ok(_stream)) => {
                let camera = DiscoveredCamera {
                    address: host_ip.clone(),
                    port: Some(port),
                    name: Some(format!("摄像机_{}", host_ip.split('.').last().unwrap_or("0"))),
                    manufacturer: None,
                    model: None,
                    serial_number: None, // 🎯 新增字段
                    protocol: "PortScan".to_string(),
                    services: vec![format!("port:{}", port)],
                };
                cameras.push(camera);
                log::debug!("发现设备: {}:{})", host_ip, port);
                // 找到一个开放端口即可认为是摄像机设备
                break;
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

/// 解析 ONVIF Probe 响应
fn parse_onvif_response(response: &str, addr: &str) -> Option<DiscoveredCamera> {
    // 提取 IP 地址（从 addr 字符串中）
    let ip = if let Some(pos) = addr.rfind(':') {
        &addr[..pos]
    } else {
        addr
    };

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
                // 计算 /24 子网
                let octets = ip.octets();
                let subnet = format!("{}.{}.{}.0/24", octets[0], octets[1], octets[2]);
                
                let network_iface = NetworkInterface {
                    name: iface.name.clone(),
                    ip: ip.to_string(),
                    subnet,
                    is_primary: idx == 0, // 第一个有效接口作为主网卡
                };

                log::info!(
                    "发现网络接口: {} - IP: {}, 子网: {}",
                    network_iface.name,
                    network_iface.ip,
                    network_iface.subnet
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
    
    // 172.16.0.0 - 172.31.255.255
    if octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31 {
        return true;
    }
    
    false
}
