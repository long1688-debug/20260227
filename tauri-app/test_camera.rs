
use reqwest::Client;
use std::time::Duration;
use roxmltree::Document;

// XML 转义函数
fn xml_escape(s: &amp;str) -&gt; String {
    s.replace('&amp;', "&amp;amp;")
     .replace('&lt;', "&amp;lt;")
     .replace('&gt;', "&amp;gt;")
     .replace('"', "&amp;quot;")
     .replace('\'', "&amp;apos;")
}

// 从 XML 中提取媒体服务地址
fn parse_media_service_url(xml: &amp;str) -&gt; Option&lt;String&gt; {
    match Document::parse(xml) {
        Ok(doc) =&gt; {
            // 查找任意命名空间的 Media 元素
            let media = doc.descendants().find(|n| n.has_tag_name("Media"));
            if let Some(media_elem) = media {
                let xaddr = media_elem.descendants().find(|n| n.has_tag_name("XAddr"));
                if let Some(xaddr_elem) = xaddr {
                    if let Some(url) = xaddr_elem.text() {
                        let url_trimmed = url.trim();
                        if !url_trimmed.is_empty() &amp;&amp; url_trimmed.starts_with("http") {
                            return Some(url_trimmed.to_string());
                        }
                    }
                }
            }
            // 备选：直接查找所有 XAddr 元素
            for node in doc.descendants() {
                if node.has_tag_name("XAddr") {
                    if let Some(url) = node.text() {
                        let url_trimmed = url.trim();
                        if !url_trimmed.is_empty() &amp;&amp; url_trimmed.starts_with("http") {
                            return Some(url_trimmed.to_string());
                        }
                    }
                }
            }
            None
        }
        Err(_) =&gt; None,
    }
}

// 解析 Profile Token
fn parse_profile_tokens(xml: &amp;str) -&gt; Vec&lt;String&gt; {
    let mut tokens = Vec::new();
    let mut search_start = 0;
    while let Some(start) = xml[search_start..].find("&lt;tt:ProfileToken&gt;") {
        let abs_start = search_start + start;
        if let Some(end) = xml[abs_start..].find("&lt;/tt:ProfileToken&gt;") {
            let token = xml[abs_start + 17..abs_start + end].trim().to_string();
            if !token.is_empty() {
                tokens.push(token);
            }
            search_start = abs_start + end;
        } else {
            break;
        }
    }
    tokens
}

// 解析流 URI
fn parse_stream_uri(xml: &amp;str) -&gt; Option&lt;String&gt; {
    // 查找 rtsp:// 开头的 URL
    if let Some(rtsp_start) = xml.find("rtsp://") {
        let uri_end = xml[rtsp_start..].find(|c| c == '"' || c == '&lt;' || c == ' ' || c == '\n')
            .unwrap_or(xml.len() - rtsp_start);
        let uri = xml[rtsp_start..rtsp_start + uri_end].trim().to_string();
        if !uri.is_empty() {
            return Some(uri);
        }
    }
    None
}

// 测试摄像机
async fn test_camera(ip: &amp;str, port: u16, username: &amp;str, password: &amp;str) {
    println!("🔍 开始测试摄像机: {}:{}", ip, port);
    println!("   用户名: {}", if username.is_empty() { "(无)" } else { username });
    println!("   密码: {}", if password.is_empty() { "(无)" } else { "***" });
    println!("");

    let client = Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .expect("Failed to create HTTP client");

    // ==================== 步骤1: 测试设备服务路径 ====================
    println!("📋 步骤1: 测试设备服务路径...");
    let device_paths = vec![
        "/onvif/device_service",
        "/onvif/device",
        "/cgi-bin/onvif/device_service",
        "/device_service",
        "/onvif/services",
    ];

    let mut found_device_url = None;
    let mut found_media_url = None;

    for path in &amp;device_paths {
        let url = format!("http://{}:{}{}", ip, port, path);
        println!("   测试: {}", url);

        let soap = format!(
            r#"&lt;?xml version="1.0" encoding="UTF-8"?&gt;
&lt;s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:tds="http://www.onvif.org/ver10/device/wsdl"
            xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.x"&gt;
  &lt;s:Header&gt;
    &lt;wsse:Security s:mustUnderstand="1"&gt;
      &lt;wsse:UsernameToken&gt;
        &lt;wsse:Username&gt;{}&lt;/wsse:Username&gt;
        &lt;wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.x#PasswordText"&gt;{}&lt;/wsse:Password&gt;
      &lt;/wsse:UsernameToken&gt;
    &lt;/wsse:Security&gt;
  &lt;/s:Header&gt;
  &lt;s:Body&gt;
    &lt;tds:GetCapabilities/&gt;
  &lt;/s:Body&gt;
&lt;/s:Envelope&gt;"#,
            xml_escape(username), xml_escape(password)
        );

        match client
            .post(&amp;url)
            .header("Content-Type", "application/soap+xml; charset=utf-8")
            .header("SOAPAction", "\"http://www.onvif.org/ver10/device/wsdl/GetCapabilities\"")
            .body(soap)
            .send()
            .await
        {
            Ok(res) =&gt; {
                if res.status().is_success() {
                    let body = res.text().await.unwrap_or_default();
                    println!("   ✅ 成功!");
                    
                    if found_device_url.is_none() {
                        found_device_url = Some(url.clone());
                    }
                    
                    if let Some(media_url) = parse_media_service_url(&amp;body) {
                        println!("   📍 解析到 Media 服务地址: {}", media_url);
                        if found_media_url.is_none() {
                            found_media_url = Some(media_url);
                        }
                    }
                    break;
                } else {
                    println!("   ❌ HTTP 错误: {}", res.status());
                }
            }
            Err(e) =&gt; {
                println!("   ❌ 请求失败: {}", e);
            }
        }
    }
    println!("");

    // ==================== 步骤2: 获取设备信息 ====================
    println!("📋 步骤2: 获取设备信息...");
    if let Some(ref device_url) = found_device_url {
        let soap = format!(
            r#"&lt;?xml version="1.0" encoding="UTF-8"?&gt;
&lt;s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:tds="http://www.onvif.org/ver10/device/wsdl"
            xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.x"&gt;
  &lt;s:Header&gt;
    &lt;wsse:Security s:mustUnderstand="1"&gt;
      &lt;wsse:UsernameToken&gt;
        &lt;wsse:Username&gt;{}&lt;/wsse:Username&gt;
        &lt;wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.x#PasswordText"&gt;{}&lt;/wsse:Password&gt;
      &lt;/wsse:UsernameToken&gt;
    &lt;/wsse:Security&gt;
  &lt;/s:Header&gt;
  &lt;s:Body&gt;
    &lt;tds:GetDeviceInformation/&gt;
  &lt;/s:Body&gt;
&lt;/s:Envelope&gt;"#,
            xml_escape(username), xml_escape(password)
        );

        match client
            .post(device_url)
            .header("Content-Type", "application/soap+xml; charset=utf-8")
            .header("SOAPAction", "\"http://www.onvif.org/ver10/device/wsdl/GetDeviceInformation\"")
            .body(soap)
            .send()
            .await
        {
            Ok(res) =&gt; {
                if res.status().is_success() {
                    let body = res.text().await.unwrap_or_default();
                    println!("   ✅ 成功获取设备信息!");
                    println!("   📋 响应内容:");
                    println!("{}", body);
                } else {
                    println!("   ❌ HTTP 错误: {}", res.status());
                }
            }
            Err(e) =&gt; {
                println!("   ❌ 请求失败: {}", e);
            }
        }
    } else {
        println!("   ⚠️  跳过: 未找到设备服务地址");
    }
    println!("");

    // ==================== 步骤3: 获取 Profiles ====================
    println!("📋 步骤3: 获取流配置文件...");
    let media_url_to_use = if let Some(ref url) = found_media_url {
        url.clone()
    } else {
        format!("http://{}:{}/onvif/media_service", ip, port)
    };
    println!("   使用 Media 服务地址: {}", media_url_to_use);

    let soap = format!(
        r#"&lt;?xml version="1.0" encoding="UTF-8"?&gt;
&lt;s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:trt="http://www.onvif.org/ver10/media/wsdl"
            xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.x"&gt;
  &lt;s:Header&gt;
    &lt;wsse:Security s:mustUnderstand="1"&gt;
      &lt;wsse:UsernameToken&gt;
        &lt;wsse:Username&gt;{}&lt;/wsse:Username&gt;
        &lt;wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.x#PasswordText"&gt;{}&lt;/wsse:Password&gt;
      &lt;/wsse:UsernameToken&gt;
    &lt;/wsse:Security&gt;
  &lt;/s:Header&gt;
  &lt;s:Body&gt;
    &lt;trt:GetProfiles /&gt;
  &lt;/s:Body&gt;
&lt;/s:Envelope&gt;"#,
        xml_escape(username), xml_escape(password)
    );

    let mut profiles = Vec::new();
    match client
        .post(&amp;media_url_to_use)
        .header("Content-Type", "application/soap+xml; charset=utf-8")
        .header("SOAPAction", "\"http://www.onvif.org/ver10/media/wsdl/GetProfiles\"")
        .body(soap)
        .send()
        .await
    {
        Ok(res) =&gt; {
            if res.status().is_success() {
                let body = res.text().await.unwrap_or_default();
                println!("   ✅ 成功获取 Profiles!");
                profiles = parse_profile_tokens(&amp;body);
                println!("   📋 发现 {} 个 Profile:", profiles.len());
                for (i, token) in profiles.iter().enumerate() {
                    println!("      [{:2}] {}", i + 1, token);
                }
            } else {
                println!("   ❌ HTTP 错误: {}", res.status());
            }
        }
        Err(e) =&gt; {
            println!("   ❌ 请求失败: {}", e);
        }
    }
    println!("");

    // ==================== 步骤4: 获取 RTSP 流地址 ====================
    println!("📋 步骤4: 获取 RTSP 流地址...");
    if profiles.is_empty() {
        println!("   ⚠️  未发现 Profile，尝试默认值: Profile_1");
        profiles.push("Profile_1".to_string());
    }

    for token in &amp;profiles {
        println!("   尝试 Profile: {}", token);
        
        let soap = format!(
            r#"&lt;?xml version="1.0" encoding="UTF-8"?&gt;
&lt;s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:trt="http://www.onvif.org/ver10/media/wsdl"
            xmlns:tt="http://www.onvif.org/ver10/schema"
            xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.x"&gt;
  &lt;s:Header&gt;
    &lt;wsse:Security s:mustUnderstand="1"&gt;
      &lt;wsse:UsernameToken&gt;
        &lt;wsse:Username&gt;{}&lt;/wsse:Username&gt;
        &lt;wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.x#PasswordText"&gt;{}&lt;/wsse:Password&gt;
      &lt;/wsse:UsernameToken&gt;
    &lt;/wsse:Security&gt;
  &lt;/s:Header&gt;
  &lt;s:Body&gt;
    &lt;trt:GetStreamUri&gt;
      &lt;trt:StreamSetup&gt;
        &lt;tt:Stream&gt;RTP-Unicast&lt;/tt:Stream&gt;
        &lt;tt:Transport&gt;
          &lt;tt:Protocol&gt;RTSP&lt;/tt:Protocol&gt;
        &lt;/tt:Transport&gt;
      &lt;/trt:StreamSetup&gt;
      &lt;trt:ProfileToken&gt;{}&lt;/trt:ProfileToken&gt;
    &lt;/trt:GetStreamUri&gt;
  &lt;/s:Body&gt;
&lt;/s:Envelope&gt;"#,
            xml_escape(username), xml_escape(password), token
        );

        match client
            .post(&amp;media_url_to_use)
            .header("Content-Type", "application/soap+xml; charset=utf-8")
            .header("SOAPAction", "\"http://www.onvif.org/ver10/media/wsdl/GetStreamUri\"")
            .body(soap)
            .send()
            .await
        {
            Ok(res) =&gt; {
                if res.status().is_success() {
                    let body = res.text().await.unwrap_or_default();
                    if let Some(uri) = parse_stream_uri(&amp;body) {
                        println!("   ✅ 成功获取流地址!");
                        println!("   📺 RTSP 地址: {}", uri);
                    } else {
                        println!("   ⚠️  成功响应，但无法解析 URI，响应内容:");
                        println!("{}", body);
                    }
                    break;
                } else {
                    println!("   ❌ HTTP 错误: {}", res.status());
                }
            }
            Err(e) =&gt; {
                println!("   ❌ 请求失败: {}", e);
            }
        }
    }
    println!("");

    println!("✅ 测试完成!");
}

#[tokio::main]
async fn main() {
    // 测试的摄像机配置
    let ip = "192.168.5.163";
    let port = 80;
    let username = "admin";
    let password = ""; // 根据截图，密码可能为空或默认值

    test_camera(ip, port, username, password).await;
}
