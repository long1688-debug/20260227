use reqwest::Client;
use thiserror::Error;
use std::time::SystemTime;

/// XML 转义函数 - 防止用户名/密码中的特殊字符破坏 SOAP 请求
fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

#[derive(Debug, Error)]
pub enum OnvifError {
    #[error("HTTP请求失败: {0}")]
    Request(#[from] reqwest::Error),
    #[error("设备返回错误: HTTP {status} - {body}")]
    DeviceResponse { status: u16, body: String },
    #[error("设备未注册")]
    DeviceNotFound,
}

/// ONVIF 流 URI 信息
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct StreamUri {
    pub uri: String,
    pub protocol: String,
    pub timeout: String,
}

/// 🎯 ONVIF 设备信息
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DeviceInfo {
    pub manufacturer: String,
    pub model: String,
    pub firmware_version: String,
    pub serial_number: String,
    pub hardware_id: String,
}

/// ONVIF 云台摄像机
pub struct OnvifCamera {
    pub id: String,
    ip: String,
    port: u16,
    username: String,
    password: String,
    profile_token: String,
    client: Client,
}

impl OnvifCamera {
    /// 创建新的 ONVIF 摄像机实例
    pub fn new(
        id: &str,
        ip: &str,
        port: u16,
        username: &str,
        password: &str,
        profile_token: &str,
    ) -> Self {
        Self {
            id: id.into(),
            ip: ip.into(),
            port,
            username: username.into(),
            password: password.into(),
            profile_token: profile_token.into(),
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(4))
                .build()
                .expect("Failed to create HTTP client"),
        }
    }

    /// 获取 IP 地址
    pub fn ip(&self) -> &str {
        &self.ip
    }

    /// 获取端口
    pub fn port(&self) -> u16 {
        self.port
    }

    /// 获取用户名
    pub fn username(&self) -> &str {
        &self.username
    }

    /// 获取密码
    pub fn password(&self) -> &str {
        &self.password
    }

    /// 获取 Profile Token
    pub fn profile_token(&self) -> &str {
        &self.profile_token
    }

    /// 绝对位置控制（ONVIF标准）
    /// pan/tilt: [-1.0, 1.0], zoom: [1.0, 10.0]
    pub async fn absolute_move(
        &self,
        pan: f64,
        tilt: f64,
        zoom: f64,
    ) -> Result<(), OnvifError> {
        let p = pan.clamp(-1.0, 1.0);
        let t = tilt.clamp(-1.0, 1.0);
        let z = zoom.clamp(1.0, 10.0);

        let soap = self.build_absolute_move_soap(p, t, z);
        let url = format!("http://{}:{}/onvif/ptz_service", self.ip, self.port);

        let res = self
            .client
            .post(&url)
            .header(
                "Content-Type",
                "application/soap+xml; charset=utf-8",
            )
            .header(
                "SOAPAction",
                "\"http://www.onvif.org/ver20/ptz/wsdl/AbsoluteMove\"",
            )
            .basic_auth(&self.username, Some(&self.password))
            .body(soap)
            .send()
            .await?;

        let status = res.status();
        if status.is_success() {
            log::info!("✅ [{}] PTZ AbsoluteMove OK", self.id);
            Ok(())
        } else {
            let body = res.text().await.unwrap_or_default();
            log::error!(
                "❌ [{}] PTZ 失败: HTTP {} {}",
                self.id,
                status,
                body
            );
            Err(OnvifError::DeviceResponse {
                status: status.as_u16(),
                body,
            })
        }
    }

    /// 相对移动 (RelativeMove)
    /// pan/tilt/zoom: [-1.0, 1.0] 表示相对位移比例
    pub async fn relative_move(
        &self,
        pan: f64,
        tilt: f64,
        zoom: f64,
    ) -> Result<(), OnvifError> {
        let p = pan.clamp(-1.0, 1.0);
        let t = tilt.clamp(-1.0, 1.0);
        let z = zoom.clamp(-1.0, 1.0);

        let soap = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:ptz="http://www.onvif.org/ver20/ptz/wsdl">
  <s:Body>
    <ptz:RelativeMove>
      <ptz:ProfileToken>{}</ptz:ProfileToken>
      <ptz:Translation>
        <ptz:PanTilt x="{}" y="{}" xmlns="http://www.onvif.org/ver10/schema"/>
        <ptz:Zoom x="{}" xmlns="http://www.onvif.org/ver10/schema"/>
      </ptz:Translation>
      <ptz:Speed>
        <ptz:PanTilt x="0.5" y="0.5" xmlns="http://www.onvif.org/ver10/schema"/>
        <ptz:Zoom x="0.5" xmlns="http://www.onvif.org/ver10/schema"/>
      </ptz:Speed>
    </ptz:RelativeMove>
  </s:Body>
</s:Envelope>"#,
            self.profile_token, p, t, z
        );

        self.send_ptz_soap(&soap).await
    }

    /// 预置位调用 (GotoPreset)
    pub async fn goto_preset(&self, preset_token: &str) -> Result<(), OnvifError> {
        let soap = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:ptz="http://www.onvif.org/ver20/ptz/wsdl">
  <s:Body>
    <ptz:GotoPreset>
      <ptz:ProfileToken>{}</ptz:ProfileToken>
      <ptz:PresetToken>{}</ptz:PresetToken>
    </ptz:GotoPreset>
  </s:Body>
</s:Envelope>"#,
            self.profile_token, preset_token
        );

        self.send_ptz_soap(&soap).await
    }

    /// 连续移动 (ContinuousMove)
    pub async fn continuous_move(
        &self,
        pan: f64,
        tilt: f64,
        zoom: f64,
    ) -> Result<(), OnvifError> {
        let p = pan.clamp(-1.0, 1.0);
        let t = tilt.clamp(-1.0, 1.0);
        let z = zoom.clamp(-1.0, 1.0);

        let soap = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:ptz="http://www.onvif.org/ver20/ptz/wsdl">
  <s:Body>
    <ptz:ContinuousMove>
      <ptz:ProfileToken>{}</ptz:ProfileToken>
      <ptz:Velocity>
        <ptz:PanTilt x="{}" y="{}" xmlns="http://www.onvif.org/ver10/schema"/>
        <ptz:Zoom x="{}" xmlns="http://www.onvif.org/ver10/schema"/>
      </ptz:Velocity>
    </ptz:ContinuousMove>
  </s:Body>
</s:Envelope>"#,
            self.profile_token, p, t, z
        );

        self.send_ptz_soap(&soap).await
    }

    /// 停止移动 (Stop)
    pub async fn stop(&self) -> Result<(), OnvifError> {
        let soap = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:ptz="http://www.onvif.org/ver20/ptz/wsdl">
  <s:Body>
    <ptz:Stop>
      <ptz:ProfileToken>{}</ptz:ProfileToken>
      <ptz:PanTilt>true</ptz:PanTilt>
      <ptz:Zoom>true</ptz:Zoom>
    </ptz:Stop>
  </s:Body>
</s:Envelope>"#,
            self.profile_token
        );

        self.send_ptz_soap(&soap).await
    }

    /// 统一 SOAP 发送与响应处理
    async fn send_ptz_soap(&self, soap: &str) -> Result<(), OnvifError> {
        let url = format!("http://{}:{}/onvif/ptz_service", self.ip, self.port);
        let res = self
            .client
            .post(&url)
            .header(
                "Content-Type",
                "application/soap+xml; charset=utf-8",
            )
            .header(
                "SOAPAction",
                "\"http://www.onvif.org/ver20/ptz/wsdl/*\"",
            )
            .basic_auth(&self.username, Some(&self.password))
            .body(soap.to_string())
            .send()
            .await?;

        let status = res.status();
        if status.is_success() {
            log::info!("✅ [{}] PTZ 指令执行成功", self.id);
            Ok(())
        } else {
            let body = res.text().await.unwrap_or_default();
            log::error!(
                "❌ [{}] PTZ 失败: HTTP {} {}",
                self.id,
                status,
                body
            );
            Err(OnvifError::DeviceResponse {
                status: status.as_u16(),
                body,
            })
        }
    }

    /// 获取 ONVIF 设备的 RTSP 流地址
    /// 🎯 标准ONVIF流程：
    /// 1. GetDeviceInfo - 验证设备可达性和认证
    /// 2. GetCapabilities - 获取服务列表
    /// 3. 提取 Media Service URL
    /// 4. GetProfiles - 获取媒体配置
    /// 5. GetStreamUri - 获取RTSP地址
    pub async fn get_stream_uri(&self) -> Result<StreamUri, OnvifError> {
        // 步骤1: GetDeviceInfo - 验证设备可达性和认证信息
        log::info!("🔍 [{}] 步骤1: 验证设备可达性...", self.id);
        match self.get_device_info().await {
            Ok(info) => {
                log::info!("✅ [{}] 设备验证成功: Manufacturer={}, Model={}",
                    self.id, info.manufacturer, info.model);
            }
            Err(e) => {
                log::warn!("⚠️ [{}] 设备验证失败: {}，继续尝试后续步骤", self.id, e);
                // 不中断流程，有些设备可能不支持GetDeviceInfo
            }
        }

        // 步骤2-3: 通过 GetCapabilities 获取 Media 服务地址
        log::info!("🔍 [{}] 步骤2-3: 获取Media服务地址...", self.id);
        let media_url = match self.get_media_service_url().await {
            Ok(url) => {
                log::info!("✅ [{}] 获取到 Media 服务地址: {}", self.id, url);
                url
            }
            Err(e) => {
                log::warn!("⚠️ [{}] 无法获取 Media 服务地址: {}，尝试使用默认路径", self.id, e);
                format!("http://{}:{}/onvif/media_service", self.ip, self.port)
            }
        };

        // 步骤4: 获取 Profiles（如果还没有profile_token）
        let profile_to_use = if self.profile_token.is_empty() {
            log::info!("🔍 [{}] 步骤4: 获取Profile列表...", self.id);
            match self.get_profiles_with_fallback(&media_url).await {
                Ok(profiles) => {
                    if profiles.is_empty() {
                        return Err(OnvifError::DeviceResponse {
                            status: 500,
                            body: "设备没有可用的 Profile".to_string(),
                        });
                    }
                    let first_profile = profiles[0].clone();
                    log::info!("✅ [{}] 获取到 {} 个Profile，使用第一个: {}",
                        self.id, profiles.len(), first_profile);
                    first_profile
                }
                Err(e) => {
                    log::warn!("⚠️ [{}] 获取Profile失败: {}，尝试使用默认Token", self.id, e);
                    "Profile_1".to_string()
                }
            }
        } else {
            self.profile_token.clone()
        };

        // 步骤5: 使用 Media Service URL 和 Profile Token 获取流地址
        log::info!("🔍 [{}] 步骤5: 获取RTSP流地址...", self.id);
        self.get_stream_uri_with_url(&media_url, &profile_to_use).await
    }

    /// 🎯 使用指定的 Media Service URL 和 Profile Token 获取流地址
    pub async fn get_stream_uri_with_url(&self, media_url: &str, profile_token: &str) -> Result<StreamUri, OnvifError> {
        log::info!("🎬 [{}] 使用指定的 Media URL: {} 和 Profile: {}", self.id, media_url, profile_token);
        log::info!("🔐 [{}] 认证信息 - Username: {}, Password: {}", self.id, self.username, "***");

        // 步骤3: 构建 GetStreamUri SOAP 请求
        // 🎯 使用 WS-Security 认证（ONVIF 标准）
        let soap_with_auth = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:trt="http://www.onvif.org/ver10/media/wsdl"
            xmlns:tt="http://www.onvif.org/ver10/schema"
            xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  <s:Header>
    <wsse:Security s:mustUnderstand="1">
      <wsse:UsernameToken>
        <wsse:Username>{}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">{}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </s:Header>
  <s:Body>
    <trt:GetStreamUri>
      <trt:StreamSetup>
        <tt:Stream>RTP-Unicast</tt:Stream>
        <tt:Transport>
          <tt:Protocol>RTSP</tt:Protocol>
        </tt:Transport>
      </trt:StreamSetup>
      <trt:ProfileToken>{}</trt:ProfileToken>
    </trt:GetStreamUri>
  </s:Body>
</s:Envelope>"#,
            self.username, self.password, profile_token
        );

        log::debug!(" [{}] GetStreamUri 请求 SOAP 内容（前500字符）: {}", self.id, &soap_with_auth[..soap_with_auth.len().min(500)]);

        match self.client
            .post(media_url)
            .header(
                "Content-Type",
                "application/soap+xml; charset=utf-8",
            )
            .header(
                "SOAPAction",
                "\"http://www.onvif.org/ver10/media/wsdl/GetStreamUri\"",
            )
            .body(soap_with_auth)
            .send()
            .await
        {
            Ok(res) => {
                let status = res.status();
                log::info!("📥 [{}] GetStreamUri 响应状态码: {}", self.id, status.as_u16());

                if status.is_success() {
                    let body = res.text().await?;
                    log::info!("✅ [{}] 获取流地址成功", self.id);
                    log::info!("📄 [{}] 流地址响应完整内容: {}", self.id, &body);

                    // 解析 XML 响应，提取 URI
                    let uri = self.parse_stream_uri(&body)?;

                    return Ok(StreamUri {
                        uri,
                        protocol: "RTSP".to_string(),
                        timeout: "60".to_string(),
                    });
                } else {
                    let body = res.text().await.unwrap_or_default();
                    log::error!("❌ [{}] GetStreamUri 返回错误 {}: {}", self.id, status.as_u16(), &body);

                    // 如果失败，尝试其他可能的路径作为降级方案
                    return self.try_fallback_paths(profile_token).await;
                }
            }
            Err(e) => {
                log::error!("❌ [{}] GetStreamUri 请求失败: {}", self.id, e);

                // 如果失败，尝试其他可能的路径作为降级方案
                return self.try_fallback_paths(profile_token).await;
            }
        }
    }

    /// 降级方案：尝试多个可能的路径
    async fn try_fallback_paths(&self, profile_token: &str) -> Result<StreamUri, OnvifError> {
        log::warn!("⚠️ [{}] 尝试降级方案：遍历多个路径", self.id);

        // 常见的 ONVIF 路径列表
        let media_paths = [
            "/onvif/media_service",
            "/onvif/Media",
            "/onvif/media",
            "/cgi-bin/onvif/media_service",
            "/media_service",
        ];

        // 尝试不同的路径
        for path in &media_paths {
            let url = format!("http://{}:{}{}", self.ip, self.port, path);
            log::info!("🔄 [{}] 尝试降级路径: {}", self.id, url);

            //  使用 WS-Security 认证（ONVIF 标准）
            let soap = format!(
                r#"<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:trt="http://www.onvif.org/ver10/media/wsdl"
            xmlns:tt="http://www.onvif.org/ver10/schema"
            xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  <s:Header>
    <wsse:Security s:mustUnderstand="1">
      <wsse:UsernameToken>
        <wsse:Username>{}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">{}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </s:Header>
  <s:Body>
    <trt:GetStreamUri>
      <trt:StreamSetup>
        <tt:Stream>RTP-Unicast</tt:Stream>
        <tt:Transport>
          <tt:Protocol>RTSP</tt:Protocol>
        </tt:Transport>
      </trt:StreamSetup>
      <trt:ProfileToken>{}</trt:ProfileToken>
    </trt:GetStreamUri>
  </s:Body>
</s:Envelope>"#,
                self.username, self.password, profile_token
            );

            match self.client
                .post(&url)
                .header(
                    "Content-Type",
                    "application/soap+xml; charset=utf-8",
                )
                .header(
                    "SOAPAction",
                    "\"http://www.onvif.org/ver10/media/wsdl/GetStreamUri\"",
                )
                .body(soap)
                .send()
                .await
            {
                Ok(res) => {
                    let status = res.status();
                    if status.is_success() {
                        let resp_body = res.text().await?;
                        log::info!("✅ [{}] 降级方案成功，路径: {}", self.id, path);

                        // 解析 XML 响应，提取 URI
                        let uri = self.parse_stream_uri(&resp_body)?;

                        return Ok(StreamUri {
                            uri,
                            protocol: "RTSP".to_string(),
                            timeout: "60".to_string(),
                        });
                    } else {
                        let _body = res.text().await.unwrap_or_default();
                        log::warn!("⚠️ [{}] 降级路径 {} 返回错误 {}", self.id, path, status.as_u16());
                    }
                }
                Err(e) => {
                    log::warn!("⚠️ [{}] 降级路径 {} 请求失败: {}", self.id, path, e);
                }
            }
        }

        Err(OnvifError::DeviceResponse {
            status: 404,
            body: "标准流程和降级方案均失败".to_string(),
        })
    }

    /// 尝试使用指定Token获取流地址（用于降级方案）
    async fn try_get_stream_with_token(&self, profile_token: &str) -> Result<StreamUri, OnvifError> {
        // 构建 GetStreamUri SOAP 请求
        let soap_with_auth = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:trt="http://www.onvif.org/ver10/media/wsdl"
            xmlns:tt="http://www.onvif.org/ver10/schema"
            xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  <s:Header>
    <wsse:Security s:mustUnderstand="1">
      <wsse:UsernameToken>
        <wsse:Username>{}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">{}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </s:Header>
  <s:Body>
    <trt:GetStreamUri>
      <trt:StreamSetup>
        <tt:Stream>RTP-Unicast</tt:Stream>
        <tt:Transport>
          <tt:Protocol>RTSP</tt:Protocol>
        </tt:Transport>
      </trt:StreamSetup>
      <trt:ProfileToken>{}</trt:ProfileToken>
    </trt:GetStreamUri>
  </s:Body>
</s:Envelope>"#,
            self.username, self.password, profile_token
        );

        // 尝试多个可能的路径
        let media_paths = [
            "/onvif/Media",
            "/onvif/media",
            "/onvif/device_service",
            "/onvif/media_service",
            "/cgi-bin/onvif/media_service",
            "/media_service",
            "/onvif",
            "/onvif/services",
            "/onvif/service",
            "/onvif/api",
            "/api/onvif",
            "/onvif/v1",
            "/onvif/v2",
            "/onvif/wsdl",
            "/onvif/soap",
            "/wsdl",
            "/",
        ];

        for path in &media_paths {
            let url = format!("http://{}:{}{}", self.ip, self.port, path);
            log::info!("🔄 [{}] 尝试直接获取流地址，路径: {}", self.id, url);

            match self.client
                .post(&url)
                .header(
                    "Content-Type",
                    "application/soap+xml; charset=utf-8",
                )
                .header(
                    "SOAPAction",
                    "\"http://www.onvif.org/ver10/media/wsdl/GetStreamUri\"",
                )
                .body(soap_with_auth.clone())
                .send()
                .await
            {
                Ok(res) => {
                    let status = res.status();
                    if status.is_success() {
                        let body = res.text().await?;
                        log::info!("✅ [{}] 直接获取流地址成功，路径: {}", self.id, path);

                        // 解析 XML 响应，提取 URI
                        let uri = self.parse_stream_uri(&body)?;

                        return Ok(StreamUri {
                            uri,
                            protocol: "RTSP".to_string(),
                            timeout: "60".to_string(),
                        });
                    } else {
                        let _body = res.text().await.unwrap_or_default();
                        log::warn!("⚠️ [{}] 路径 {} 返回错误 {}", self.id, path, status.as_u16());
                    }
                }
                Err(e) => {
                    log::warn!("⚠️ [{}] 路径 {} 请求失败: {}", self.id, path, e);
                }
            }
        }

        Err(OnvifError::DeviceResponse {
            status: 404,
            body: "无法使用指定Token获取流地址".to_string(),
        })
    }

    /// 获取设备的 Profile 列表（带多路径降级方案）
    async fn get_profiles_with_fallback(&self, initial_url: &str) -> Result<Vec<String>, OnvifError> {
        // 先尝试给定的 URL
        if let Ok(profiles) = self.get_profiles_with_url(initial_url).await {
            if !profiles.is_empty() {
                return Ok(profiles);
            }
        }

        // 如果失败，尝试多个可能的 Media 服务路径
        log::warn!("️ [{}] 初始路径 GetProfiles 失败，尝试降级路径", self.id);

        let media_paths = [
            "/onvif/Media",           // 标准路径
            "/onvif/media",           // 小写变体
            "/cgi-bin/onvif/media_service",  // CGI路径
            "/media_service",         // 简化路径
            "/onvif/media2_service",  // ONVIF Profile S (Media2)
            "/onvif/device_service",  // 有些设备在此提供Media服务
            "/onvif/PTZ",             // 某些设备在PTZ路径也支持Media
            "/wsdl",                  // WSDL根路径
            "/",                      // 根路径
            "/onvif",                 // ONVIF根路径
            "/onvif/services",        // ONVIF服务路径
            "/onvif/service",         // ONVIF单数服务路径
            "/onvif/api",             // API路径
            "/api/onvif",             // 反向API路径
            "/onvif/v1",              // 版本化路径
            "/onvif/v2",              // 版本化路径
            "/onvif/wsdl",            // WSDL路径
            "/onvif/soap",            // SOAP路径
        ];

        for path in &media_paths {
            let url = format!("http://{}:{}{}", self.ip, self.port, path);
            log::info!("🔄 [{}] 尝试 GetProfiles 降级路径: {}", self.id, url);

            match self.get_profiles_with_url(&url).await {
                Ok(profiles) => {
                    if !profiles.is_empty() {
                        log::info!("✅ [{}] GetProfiles 降级成功，路径: {}", self.id, path);
                        return Ok(profiles);
                    }
                }
                Err(e) => {
                    log::warn!("⚠️ [{}] 路径 {} 失败: {:?}", self.id, path, e);
                }
            }
        }

        // 🎯 最终降级：尝试使用通用Profile Token
        log::warn!("⚠️ [{}] 所有路径都失败，尝试使用通用Profile Token", self.id);
        let common_tokens = vec![
            "Profile_1".to_string(),
            "profile1".to_string(),
            "MainStream".to_string(),
            "main".to_string(),
            "stream1".to_string(),
            "channel1".to_string(),
        ];

        for token in common_tokens {
            log::info!("🔄 [{}] 尝试通用Profile Token: {}", self.id, token);
            // 直接尝试使用这个token获取流地址
            if let Ok(_stream_uri) = self.try_get_stream_with_token(&token).await {
                log::info!("✅ [{}] 使用通用Token成功获取流地址", self.id);
                return Ok(vec![token]);
            }
        }

        Err(OnvifError::DeviceResponse {
            status: 404,
            body: "所有 GetProfiles 路径均失败".to_string(),
        })
    }

    /// 获取设备的 Profile 列表（使用指定的 Media Service URL）
    async fn get_profiles_with_url(&self, media_url: &str) -> Result<Vec<String>, OnvifError> {
        // 首先尝试带 WS-Security 认证的请求
        let soap_with_auth = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:trt="http://www.onvif.org/ver10/media/wsdl"
            xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  <s:Header>
    <wsse:Security s:mustUnderstand="1">
      <wsse:UsernameToken>
        <wsse:Username>{}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">{}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </s:Header>
  <s:Body>
    <trt:GetProfiles />
  </s:Body>
</s:Envelope>"#,
            self.username, self.password
        );

        log::info!("🔍 [{}] 调用 GetProfiles (带认证): {}", self.id, media_url);

        match self.client
            .post(media_url)
            .header("Content-Type", "application/soap+xml; charset=utf-8")
            .header("SOAPAction", "\"http://www.onvif.org/ver10/media/wsdl/GetProfiles\"")
            .body(soap_with_auth)
            .send()
            .await
        {
            Ok(res) => {
                let status = res.status();
                if status.is_success() {
                    let body = res.text().await?;
                    log::info!("✅ [{}] GetProfiles (带认证) 成功", self.id);
                    log::info!("📄 [{}] Profile 响应: {}", self.id, &body[..body.len().min(500)]);
                    return Ok(self.parse_profile_tokens(&body));
                } else {
                    let body = res.text().await.unwrap_or_default();
                    log::warn!("⚠️ [{}] GetProfiles (带认证) 返回错误 {}: {}", self.id, status.as_u16(), &body[..body.len().min(200)]);

                    // 如果认证失败，尝试不带认证的请求
                    log::info!("🔄 [{}] 尝试不带认证的 GetProfiles", self.id);
                    return self.get_profiles_without_auth(media_url).await;
                }
            }
            Err(e) => {
                log::warn!("⚠️ [{}] GetProfiles (带认证) 请求失败: {}", self.id, e);

                // 如果请求失败，尝试不带认证的请求
                log::info!("🔄 [{}] 尝试不带认证的 GetProfiles", self.id);
                return self.get_profiles_without_auth(media_url).await;
            }
        }
    }

    /// 不带认证获取 Profile 列表（降级方案）
    async fn get_profiles_without_auth(&self, media_url: &str) -> Result<Vec<String>, OnvifError> {
        let soap_no_auth = r#"<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:trt="http://www.onvif.org/ver10/media/wsdl">
  <s:Body>
    <trt:GetProfiles />
  </s:Body>
</s:Envelope>"#;

        log::info!("🔍 [{}] 调用 GetProfiles (无认证): {}", self.id, media_url);

        match self.client
            .post(media_url)
            .header("Content-Type", "application/soap+xml; charset=utf-8")
            .header("SOAPAction", "\"http://www.onvif.org/ver10/media/wsdl/GetProfiles\"")
            .body(soap_no_auth)
            .send()
            .await
        {
            Ok(res) => {
                let status = res.status();
                if status.is_success() {
                    let body = res.text().await?;
                    log::info!("✅ [{}] GetProfiles (无认证) 成功", self.id);
                    log::info!("📄 [{}] Profile 响应: {}", self.id, &body[..body.len().min(500)]);
                    return Ok(self.parse_profile_tokens(&body));
                } else {
                    let body = res.text().await.unwrap_or_default();
                    log::warn!("⚠️ [{}] GetProfiles (无认证) 返回错误 {}: {}", self.id, status.as_u16(), &body[..body.len().min(200)]);
                }
            }
            Err(e) => {
                log::warn!("⚠️ [{}] GetProfiles (无认证) 请求失败: {}", self.id, e);
            }
        }

        Err(OnvifError::DeviceResponse {
            status: 404,
            body: "GetProfiles 失败".to_string(),
        })
    }

    /// 获取设备的 Profile 列表（旧方法，保留用于兼容性）
    /// 标准 ONVIF 流程：先通过 GetCapabilities 获取 Media 服务地址
    async fn get_profiles(&self) -> Result<Vec<String>, OnvifError> {
        // 步骤 1: 通过 GetCapabilities 获取 Media 服务地址
        let media_url = match self.get_media_service_url().await {
            Ok(url) => {
                log::info!("✅ [{}] 获取到 Media 服务地址: {}", self.id, url);
                url
            }
            Err(e) => {
                log::warn!("⚠️ [{}] 无法获取 Media 服务地址: {}，尝试使用默认路径", self.id, e);
                format!("http://{}:{}/onvif/media_service", self.ip, self.port)
            }
        };

        // 步骤 2: 使用获取到的地址调用 GetProfiles
        //  使用 WS-Security 认证（ONVIF 标准）
        let soap = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:trt="http://www.onvif.org/ver10/media/wsdl"
            xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  <s:Header>
    <wsse:Security s:mustUnderstand="1">
      <wsse:UsernameToken>
        <wsse:Username>{}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">{}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </s:Header>
  <s:Body>
    <trt:GetProfiles />
  </s:Body>
</s:Envelope>"#,
            self.username, self.password
        );

        log::info!("🔍 [{}] 尝试 GetProfiles: {}", self.id, media_url);

        match self.client
            .post(&media_url)
            .header("Content-Type", "application/soap+xml; charset=utf-8")
            .header("SOAPAction", "\"http://www.onvif.org/ver10/media/wsdl/GetProfiles\"")
            .body(soap)
            .send()
            .await
        {
            Ok(res) => {
                let status = res.status();
                if status.is_success() {
                    let body = res.text().await?;
                    log::info!("✅ [{}] GetProfiles 成功", self.id);
                    log::info!("📄 [{}] Profile 响应: {}", self.id, &body[..body.len().min(500)]);
                    return Ok(self.parse_profile_tokens(&body));
                } else {
                    let body = res.text().await.unwrap_or_default();
                    log::warn!("⚠️ [{}] GetProfiles 返回错误 {}: {}", self.id, status.as_u16(), &body[..body.len().min(200)]);
                }
            }
            Err(e) => {
                log::warn!("⚠️ [{}] GetProfiles 请求失败: {}", self.id, e);
            }
        }

        Err(OnvifError::DeviceResponse {
            status: 404,
            body: "GetProfiles 失败".to_string(),
        })
    }

    /// 🎯 步骤1: 获取设备信息 (GetDeviceInfo)
    /// 验证设备可达性和认证信息
    async fn get_device_info(&self) -> Result<DeviceInfo, OnvifError> {
        // 尝试多个可能的路径
        let protocols = ["http", "https"];
        let device_paths = [
            "/onvif/device_service",
            "/onvif/device",
            "/cgi-bin/onvif/device_service",
            "/device_service",
            "/onvif/services",
        ];

        for protocol in &protocols {
            for path in &device_paths {
                let url = format!("{}://{}:{}{}", protocol, self.ip, self.port, path);

                // 构建 GetDeviceInfo SOAP 请求
                let soap = format!(
                    r#"<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:tds="http://www.onvif.org/ver10/device/wsdl"
            xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  <s:Header>
    <wsse:Security s:mustUnderstand="1">
      <wsse:UsernameToken>
        <wsse:Username>{}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">{}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </s:Header>
  <s:Body>
    <tds:GetDeviceInformation/>
  </s:Body>
</s:Envelope>"#,
                    self.username, self.password
                );

                match self.client
                    .post(&url)
                    .header("Content-Type", "application/soap+xml; charset=utf-8")
                    .header("SOAPAction", "\"http://www.onvif.org/ver10/device/wsdl/GetDeviceInformation\"")
                    .body(soap)
                    .send()
                    .await
                {
                    Ok(res) => {
                        if res.status().is_success() {
                            let body = res.text().await?;
                            log::debug!("📄 [{}] GetDeviceInfo 响应: {}", self.id, &body[..body.len().min(500)]);

                            // 解析 XML 提取设备信息
                            if let Some(device_info) = self.parse_device_info(&body) {
                                return Ok(device_info);
                            }
                        }
                    }
                    Err(e) => {
                        log::debug!("⚠️ [{}] GetDeviceInfo URL {} 请求失败: {}", self.id, url, e);
                    }
                }
            }
        }

        Err(OnvifError::DeviceResponse {
            status: 404,
            body: "无法获取设备信息".to_string(),
        })
    }

    /// 从 GetDeviceInfo 响应中解析设备信息
    fn parse_device_info(&self, xml: &str) -> Option<DeviceInfo> {
        // 查找 <tds:Manufacturer>
        let manufacturer = self.extract_xml_tag(xml, "tds:Manufacturer")
            .or_else(|| self.extract_xml_tag(xml, "tt:Manufacturer"))
            .unwrap_or_else(|| "Unknown".to_string());

        // 查找 <tds:Model>
        let model = self.extract_xml_tag(xml, "tds:Model")
            .or_else(|| self.extract_xml_tag(xml, "tt:Model"))
            .unwrap_or_else(|| "Unknown".to_string());

        // 查找 <tds:FirmwareVersion>
        let firmware_version = self.extract_xml_tag(xml, "tds:FirmwareVersion")
            .or_else(|| self.extract_xml_tag(xml, "tt:FirmwareVersion"))
            .unwrap_or_else(|| "Unknown".to_string());

        // 查找 <tds:SerialNumber>
        let serial_number = self.extract_xml_tag(xml, "tds:SerialNumber")
            .or_else(|| self.extract_xml_tag(xml, "tt:SerialNumber"))
            .unwrap_or_else(|| "Unknown".to_string());

        // 查找 <tds:HardwareId>
        let hardware_id = self.extract_xml_tag(xml, "tds:HardwareId")
            .or_else(|| self.extract_xml_tag(xml, "tt:HardwareId"))
            .unwrap_or_else(|| "Unknown".to_string());

        Some(DeviceInfo {
            manufacturer,
            model,
            firmware_version,
            serial_number,
            hardware_id,
        })
    }

    /// 辅助方法：从 XML 中提取标签内容
    fn extract_xml_tag(&self, xml: &str, tag: &str) -> Option<String> {
        let open_tag = format!("<{}>", tag);
        let close_tag = format!("</{}>", tag);

        if let Some(start) = xml.find(&open_tag) {
            if let Some(end) = xml[start..].find(&close_tag) {
                let value = xml[start + open_tag.len()..start + end].trim();
                if !value.is_empty() {
                    return Some(value.to_string());
                }
            }
        }
        None
    }

    /// 通过 GetCapabilities 获取 Media 服务地址
    async fn get_media_service_url(&self) -> Result<String, OnvifError> {
        // 尝试 device_service 的多个可能路径（包括HTTP和HTTPS）
        let protocols = ["http", "https"];
        let device_paths = [
            "/onvif/device_service",
            "/onvif/device",
            "/cgi-bin/onvif/device_service",
            "/device_service",
            "/onvif/services",
            "/onvif/soap/service",
            "/soap/device_service",
        ];

        for protocol in &protocols {
            for path in &device_paths {
                let url = format!("{}://{}:{}{}", protocol, self.ip, self.port, path);
                log::info!("🔍 [{}] GetCapabilities 尝试: {}", self.id, url);

                // 🎯 使用 WS-Security 认证（ONVIF 标准）
                let soap = format!(
                    r#"<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:tds="http://www.onvif.org/ver10/device/wsdl"
            xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  <s:Header>
    <wsse:Security s:mustUnderstand="1">
      <wsse:UsernameToken>
        <wsse:Username>{}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">{}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </s:Header>
  <s:Body>
    <tds:GetCapabilities/>
  </s:Body>
</s:Envelope>"#,
                    self.username, self.password
                );

                match self.client
                    .post(&url)
                    .header("Content-Type", "application/soap+xml; charset=utf-8")
                    .header("SOAPAction", "\"http://www.onvif.org/ver10/device/wsdl/GetCapabilities\"")
                    .body(soap)
                    .send()
                    .await
                {
                    Ok(res) => {
                        let status = res.status();
                        if status.is_success() {
                            let body = res.text().await?;
                            log::info!("✅ [{}] GetCapabilities 成功，URL: {}", self.id, url);
                            log::info!("📄 [{}] GetCapabilities 完整响应: {}", self.id, &body[..body.len().min(2000)]);

                            // 解析 XML 提取 Media 服务地址
                            if let Some(media_url) = self.parse_media_service_url(&body) {
                                return Ok(media_url);
                            }

                            log::warn!("⚠️ [{}] 无法从响应中解析 Media 服务地址", self.id);
                        } else {
                            let body = res.text().await.unwrap_or_default();
                            log::warn!("️ [{}] GetCapabilities URL {} 返回错误 {}: {}", self.id, url, status.as_u16(), &body[..body.len().min(200)]);
                        }
                    }
                    Err(e) => {
                        log::warn!("⚠️ [{}] GetCapabilities URL {} 请求失败: {}", self.id, url, e);
                    }
                }
            }
        }

        Err(OnvifError::DeviceResponse {
            status: 404,
            body: "无法通过 GetCapabilities 获取 Media 服务地址".to_string(),
        })
    }

    /// 从 GetCapabilities 响应中解析 Media 服务地址
    fn parse_media_service_url(&self, xml: &str) -> Option<String> {
        // 查找 <tt:Media> 或 <trt:Media> 块中的 <tt:XAddr>
        if let Some(media_start) = xml.find("<tt:Media>") {
            if let Some(media_end) = xml[media_start..].find("</tt:Media>") {
                let media_block = &xml[media_start..media_start + media_end + 11];

                // 在 Media 块中查找 XAddr
                if let Some(xaddr_start) = media_block.find("<tt:XAddr>") {
                    if let Some(xaddr_end) = media_block[xaddr_start..].find("</tt:XAddr>") {
                        let url = media_block[xaddr_start + 10..xaddr_start + xaddr_end].trim();
                        if !url.is_empty() {
                            log::info!("📍 [{}] 解析到 Media 服务地址: {}", self.id, url);
                            return Some(url.to_string());
                        }
                    }
                }
            }
        }

        // 尝试其他命名空间格式
        if let Some(media_start) = xml.find("<trt:Media>") {
            if let Some(media_end) = xml[media_start..].find("</trt:Media>") {
                let media_block = &xml[media_start..media_start + media_end + 12];

                if let Some(xaddr_start) = media_block.find("<tt:XAddr>") {
                    if let Some(xaddr_end) = media_block[xaddr_start..].find("</tt:XAddr>") {
                        let url = media_block[xaddr_start + 10..xaddr_start + xaddr_end].trim();
                        if !url.is_empty() {
                            log::info!("📍 [{}] 解析到 Media 服务地址: {}", self.id, url);
                            return Some(url.to_string());
                        }
                    }
                }
            }
        }

        None
    }

    /// 解析 XML 响应提取流 URI
    fn parse_stream_uri(&self, xml: &str) -> Result<String, OnvifError> {
        log::info!("🔍 [{}] 开始解析流地址响应，响应长度: {}", self.id, xml.len());

        // 尝试多种可能的标签格式
        let patterns = [
            "<tt:Uri>",
            "<trt:Uri>",
            "<Uri>",
            "<tt:Uri xsi:type=\"tt:UriType\">",
            "<trt:Uri xsi:type=\"tt:UriType\">",
        ];

        for pattern in &patterns {
            if let Some(start) = xml.find(pattern) {
                let end_tag = pattern.replace('<', "</").replace(" xsi:type=\"tt:UriType\"", "");
                if let Some(end) = xml[start..].find(&end_tag) {
                    let uri = xml[start + pattern.len()..start + end].trim().to_string();
                    if !uri.is_empty() && (uri.starts_with("rtsp://") || uri.starts_with("rtsps://")) {
                        log::info!("✅ [{}] 使用模式 '{}' 解析到流地址: {}", self.id, pattern, uri);
                        return Ok(uri);
                    } else if !uri.is_empty() {
                        log::warn!("️ [{}] 解析到 URI 但不是 RTSP 格式: {}", self.id, uri);
                        // 继续尝试其他模式
                    }
                }
            }
        }

        // 如果常规解析失败，尝试使用正则表达式查找 rtsp:// 开头的 URL
        if let Some(rtsp_start) = xml.find("rtsp://") {
            // 查找 URL 结束位置（通常是引号、空格、或 XML 标签）
            let uri_end = xml[rtsp_start..].find(|c| c == '"' || c == '<' || c == ' ' || c == '\n')
                .unwrap_or(xml.len() - rtsp_start);
            let uri = xml[rtsp_start..rtsp_start + uri_end].trim().to_string();
            if !uri.is_empty() {
                log::info!("✅ [{}] 通过 RTSP 关键字匹配找到流地址: {}", self.id, uri);
                return Ok(uri);
            }
        }

        // 尝试查找 rtsps://
        if let Some(rtsp_start) = xml.find("rtsps://") {
            let uri_end = xml[rtsp_start..].find(|c| c == '"' || c == '<' || c == ' ' || c == '\n')
                .unwrap_or(xml.len() - rtsp_start);
            let uri = xml[rtsp_start..rtsp_start + uri_end].trim().to_string();
            if !uri.is_empty() {
                log::info!("✅ [{}] 通过 RTSPS 关键字匹配找到流地址: {}", self.id, uri);
                return Ok(uri);
            }
        }

        log::error!("❌ [{}] 无法从响应中解析流地址。响应内容（前500字符）: {}", self.id, &xml[..xml.len().min(500)]);

        Err(OnvifError::DeviceResponse {
            status: 500,
            body: "无法从响应中解析流地址".to_string(),
        })
    }

    /// 解析 XML 响应提取 Profile Token 列表
    fn parse_profile_tokens(&self, xml: &str) -> Vec<String> {
        let mut tokens = Vec::new();

        // 查找所有 <tt:ProfileToken> 标签
        let mut search_start = 0;
        while let Some(start) = xml[search_start..].find("<tt:ProfileToken>") {
            let abs_start = search_start + start;
            if let Some(end) = xml[abs_start..].find("</tt:ProfileToken>") {
                let token = xml[abs_start + 17..abs_start + end].trim().to_string();
                if !token.is_empty() {
                    tokens.push(token);
                }
                search_start = abs_start + end;
            } else {
                break;
            }
        }

        log::info!("📋 [{}] 找到 {} 个 Profile: {:?}", self.id, tokens.len(), tokens);
        tokens
    }

    /// 构建绝对移动 SOAP 请求
    fn build_absolute_move_soap(&self, pan: f64, tilt: f64, zoom: f64) -> String {
        // 动态生成 WS-Addressing MessageID 防重放
        let msg_id = format!(
            "urn:uuid:{:x}-{:x}-{:x}-{:x}-{:x}",
            SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            fastrand::u64(0..u64::MAX),
            fastrand::u64(0..u64::MAX),
            fastrand::u64(0..u64::MAX),
            fastrand::u64(0..u64::MAX)
        );

        format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:wsa="http://www.w3.org/2005/08/addressing"
            xmlns:ptz="http://www.onvif.org/ver20/ptz/wsdl">
  <s:Header>
    <wsa:Action>http://www.onvif.org/ver20/ptz/wsdl/AbsoluteMove</wsa:Action>
    <wsa:MessageID>{}</wsa:MessageID>
    <wsa:To>http://{}:{}/onvif/ptz_service</wsa:To>
  </s:Header>
  <s:Body>
    <ptz:AbsoluteMove>
      <ptz:ProfileToken>{}</ptz:ProfileToken>
      <ptz:Position>
        <ptz:PanTilt x="{}" y="{}" xmlns="http://www.onvif.org/ver10/schema"/>
        <ptz:Zoom x="{}" xmlns="http://www.onvif.org/ver10/schema"/>
      </ptz:Position>
      <ptz:Speed>
        <ptz:PanTilt x="0.8" y="0.8" xmlns="http://www.onvif.org/ver10/schema"/>
        <ptz:Zoom x="1" xmlns="http://www.onvif.org/ver10/schema"/>
      </ptz:Speed>
    </ptz:AbsoluteMove>
  </s:Body>
</s:Envelope>"#,
            msg_id, self.ip, self.port, self.profile_token, pan, tilt, zoom
        )
    }
}
