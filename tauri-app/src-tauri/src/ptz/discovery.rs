use tokio::net::UdpSocket;
use tokio::time::{timeout, Duration};
use regex::Regex;
use serde::{Deserialize, Serialize};

/// 发现的 ONVIF 设备信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredOnvifDevice {
    pub ip: String,
    pub xaddr: String,
    pub name: String,
    pub hardware_id: String,
}

/// 发送 WS-Discovery Probe 并收集局域网 ONVIF 设备
pub async fn discover_onvif_lan(timeout_secs: u64) -> Vec<DiscoveredOnvifDevice> {
    // 🎯 优化：增加 Scopes 匹配，提高发现准确率
    let probe_msg = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope"
            xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing"
            xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery"
            xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
  <e:Header>
    <w:MessageID>uuid:discover-tauri-{}</w:MessageID>
    <w:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>
    <w:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action>
  </e:Header>
  <e:Body>
    <d:Probe>
      <d:Types>dn:NetworkVideoTransmitter</d:Types>
      <d:Scopes>onvif://www.onvif.org/type/video_transmitter</d:Scopes>
    </d:Probe>
  </e:Body>
</e:Envelope>"#,
        fastrand::u64(0..u64::MAX)
    );

    let socket = match UdpSocket::bind("0.0.0.0:0").await {
        Ok(s) => s,
        Err(e) => {
            log::error!("UDP绑定失败: {}", e);
            return vec![];
        }
    };

    // 🎯 优化：设置广播权限并确保多播发送
    if let Err(e) = socket.set_broadcast(true) {
        log::warn!("设置广播权限失败: {}", e);
    }

    let multicast_addr = "239.255.255.250:3702";
    if let Err(e) = socket.send_to(probe_msg.as_bytes(), multicast_addr).await {
        log::error!("发送Probe到 {} 失败: {}", multicast_addr, e);
        return vec![];
    }
    log::info!("🚀 已发送 ONVIF 探测包至 {}", multicast_addr);

    let mut devices = Vec::new();
    // 🎯 优化：使用更精确的正则表达式提取 XAddr
    let xaddr_re = Regex::new(r"<wsa:Address>(.*?)</wsa:Address>").unwrap();
    let name_re = Regex::new(
        r"<tt:Name>(.*?)</tt:Name>|<dns:Name>(.*?)</dns:Name>",
    )
    .unwrap();

    let timeout_dur = Duration::from_secs(timeout_secs);
    let mut buf = [0u8; 8192];

    // 循环接收 ProbeMatch 响应
    loop {
        match timeout(timeout_dur, socket.recv_from(&mut buf)).await {
            Ok(Ok((len, _addr))) => {
                let xml = String::from_utf8_lossy(&buf[..len]);

                // 提取 XAddr (ONVIF服务地址)
                if let Some(caps) = xaddr_re.captures(&xml) {
                    let xaddr = caps[1].to_string();
                    if let Some(ip) = xaddr
                        .split("//")
                        .nth(1)
                        .and_then(|s| s.split(':').next())
                    {
                        // 过滤非摄像机设备（如路由器、网关）
                        if is_non_camera_device(&xml) {
                            log::debug!("⏭️ 跳过非摄像机设备: {}", ip);
                            continue;
                        }

                        // 提取设备名称
                        let name = name_re
                            .captures(&xml)
                            .map(|c| c.get(1).or_else(|| c.get(2)).unwrap().as_str().to_string())
                            .unwrap_or_else(|| "Unknown ONVIF Device".into());

                        let hw_id = xml
                            .split("<dn:HardwareId>")
                            .nth(1)
                            .and_then(|s| s.split("</dn:HardwareId>").next())
                            .unwrap_or("Generic")
                            .to_string();

                        let dev = DiscoveredOnvifDevice {
                            ip: ip.to_string(),
                            xaddr,
                            name,
                            hardware_id: hw_id,
                        };

                        // 去重
                        if !devices.iter().any(|d: &DiscoveredOnvifDevice| d.ip == dev.ip) {
                            log::info!("🔍 发现设备: {} @ {}", dev.name, dev.ip);
                            devices.push(dev);
                        }
                    }
                }
            }
            _ => break, // 超时或socket关闭
        }
    }

    devices
}

/// 🎯 辅助函数：判断是否为非摄像机设备
fn is_non_camera_device(xml: &str) -> bool {
    let lower_xml = xml.to_lowercase();
    let non_camera_keywords = [
        "router", "gateway", "switch", "hub", "printer",
        "tp-link", "huawei", "xiaomi", "netgear", "asus"
    ];

    for keyword in &non_camera_keywords {
        if lower_xml.contains(keyword) {
            return true;
        }
    }
    false
}
