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

    // 发送多播 Probe
    if let Err(e) = socket
        .send_to(probe_msg.as_bytes(), "239.255.255.250:3702")
        .await
    {
        log::error!("发送Probe失败: {}", e);
        return vec![];
    }

    let mut devices = Vec::new();
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
