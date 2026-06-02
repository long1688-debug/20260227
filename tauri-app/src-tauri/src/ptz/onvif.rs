use reqwest::Client;
use thiserror::Error;
use std::time::{SystemTime, Duration};
use roxmltree::Document;
use sha1::Digest;
use base64::Engine;

/// XML 转义函数 - 防止用户名/密码中的特殊字符破坏 SOAP 请求
fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

/// 🎯 生成 ONVIF WS-Security PasswordDigest
/// ONVIF规范: digest = Base64(SHA1(nonce_raw_bytes + created + password))
/// 注意: nonce 参与SHA1计算时必须使用原始字节，而非Base64编码后的字符串
struct OnvifAuthTokens {
    nonce_base64: String,  // Base64编码的nonce（用于SOAP请求）
    created: String,       // ISO 8601时间戳
    digest: String,        // Base64编码的SHA1摘要
}

fn generate_onvif_auth_tokens(password: &str) -> OnvifAuthTokens {
        let engine = base64::engine::general_purpose::STANDARD;

    // 1. 生成16字节随机nonce
    let nonce_raw: [u8; 16] = rand::random();
    let nonce_base64 = engine.encode(nonce_raw);

    // 2. 生成UTC时间戳
    let created = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S.000Z").to_string();

    // 3. 计算digest = Base64(SHA1(nonce_raw + created + password))
    // 🎯 关键: nonce必须使用原始字节，不是Base64字符串
    let mut hasher = sha1::Sha1::new();
    sha1::Digest::update(&mut hasher, &nonce_raw);  // 原始字节!
    sha1::Digest::update(&mut hasher, created.as_bytes());
    sha1::Digest::update(&mut hasher, password.as_bytes());
    let result = sha1::Digest::finalize(hasher);
    let digest = engine.encode(result);

    OnvifAuthTokens {
        nonce_base64,
        created,
        digest,
    }
}

/// ONVIF 认证模式
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AuthMode {
    /// 无认证 + WS-Security Digest（覆盖99%设备）
    PreferDigest,
}

impl Default for AuthMode {
    fn default() -> Self {
        AuthMode::PreferDigest
    }
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
    /// 主码流 RTSP 地址
    pub uri: String,
    /// 协议类型
    pub protocol: String,
    /// 超时
    pub timeout: String,
    /// 所有码流地址（主码流+子码流，逗号分隔）
    pub media_urls: String,
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
    auth_mode: AuthMode,
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
            auth_mode: AuthMode::default(),
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(3))
                .connect_timeout(std::time::Duration::from_secs(2))
                .user_agent("onvif-client/1.0")
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

    /// 🎯 规范化 RTSP URI
    /// - 补全缺失的端口（默认 554）
    /// - 替换 0.0.0.0 或 localhost 为设备实际 IP
    /// - 注意：不自动添加认证信息，保持原始URI格式
    pub fn normalize_rtsp_uri(&self, uri: &str) -> String {
        let mut result = uri.to_string();

        // 补全缺失的端口
        if result.starts_with("rtsp://") {
            let parts: Vec<&str> = result.split('/').collect();
            if parts.len() >= 3 {
                let host_part = parts[2];
                // 检查是否包含认证信息和端口
                let host_without_auth = if host_part.contains('@') {
                    host_part.split('@').nth(1).unwrap_or(host_part)
                } else {
                    host_part
                };
                if !host_without_auth.contains(':') && !host_without_auth.is_empty() {
                    result = result.replace(&format!("rtsp://{}/", host_part), &format!("rtsp://{}:554/", host_part));
                }
            }
        }

        // 替换 0.0.0.0 / localhost / 127.0.0.1 / [::1] 为设备实际 IP
        result = result.replace("rtsp://0.0.0.0:", &format!("rtsp://{}:", self.ip));
        result = result.replace("rtsp://0.0.0.0/", &format!("rtsp://{}/", self.ip));
        result = result.replace("rtsp://localhost:", &format!("rtsp://{}:", self.ip));
        result = result.replace("rtsp://localhost/", &format!("rtsp://{}/", self.ip));
        result = result.replace("rtsp://127.0.0.1:", &format!("rtsp://{}:", self.ip));
        result = result.replace("rtsp://127.0.0.1/", &format!("rtsp://{}/", self.ip));
        result = result.replace("rtsp://[::1]:", &format!("rtsp://{}:", self.ip));
        result = result.replace("rtsp://[::1]/", &format!("rtsp://{}/", self.ip));

        // 不自动添加认证信息，保持原始URI格式
        // 认证信息应由调用方根据需要自行添加

        result
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
    /// 🎯 增强版：多策略探测 + 智能降级 + 详细日志
    pub async fn get_stream_uri(&self) -> Result<StreamUri, OnvifError> {
        log::info!("[{}] 开始 ONVIF RTSP 地址获取 - IP: {}, 端口: {}, 用户名: {}", self.id, self.ip, self.port, self.username);

        // 标准 ONVIF 流程: GetCapabilities -> GetProfiles -> GetStreamUri
        match self.try_standard_onvif_flow().await {
            Ok(uri) => {
                log::info!("[{}] RTSP地址获取成功: {}", self.id, uri.uri);
                return Ok(uri);
            }
            Err(e) => log::warn!("[{}] 标准流程失败: {}", self.id, e),
        }

        log::error!("[{}] ONVIF RTSP地址获取失败", self.id);
        Err(OnvifError::DeviceResponse {
            status: 500,
            body: "ONVIF获取RTSP地址失败，请检查：\n1. 摄像机ONVIF功能是否已启用\n2. 用户名和密码是否正确\n3. 网络连接是否正常\n4. ONVIF端口是否正确（通常为80、8080等）\n5. 摄像机型号是否支持ONVIF协议\n6. 摄像机是否在线且工作正常".to_string(),
        })
    }

    /// 🎯 策略1: 标准 ONVIF 流程
    async fn try_standard_onvif_flow(&self) -> Result<StreamUri, OnvifError> {
        // 步骤1: 获取 Media Service URL
        let media_url = tokio::time::timeout(Duration::from_secs(2), self.get_media_service_url()).await;

        let final_media_url = match media_url {
            Ok(Ok(url)) => {
                log::info!("✅ [{}] 成功获取 Media URL: {}", self.id, url);
                url
            }
            _ => {
                log::warn!("⚠️ [{}] 获取 Media URL 失败/超时", self.id);
                return Err(OnvifError::DeviceResponse {
                    status: 500,
                    body: "无法获取Media Service URL".to_string()
                });
            }
        };

        // 步骤2: 获取 Profile Token 列表
        let profiles = tokio::time::timeout(Duration::from_secs(2), self.get_profiles_with_url(&final_media_url)).await;

        let profile_tokens = match profiles {
            Ok(Ok(tokens)) if !tokens.is_empty() => {
                log::info!("✅ [{}] 获取到 {} 个Profile Token: {:?}", self.id, tokens.len(), tokens);
                tokens
            }
            _ => {
                log::warn!("⚠️ [{}] 获取 Profile Token 失败，使用默认Token", self.id);
                vec!["Profile_1".to_string()]
            }
        };

        // 步骤3: 收集所有 Profile Token 的 RTSP 地址
        let mut all_uris: Vec<String> = Vec::new();
        let mut first_uri: Option<StreamUri> = None;

        for token in &profile_tokens {
            log::info!("[{}] 尝试 Profile Token: {}", self.id, token);
            match tokio::time::timeout(Duration::from_secs(2), self.get_stream_uri_with_url(&final_media_url, token)).await {
                Ok(Ok(uri)) => {
                    all_uris.push(uri.uri.clone());
                    if first_uri.is_none() {
                        first_uri = Some(uri);
                    }
                }
                Ok(Err(e)) => log::warn!("[{}] Token {} 失败: {}", self.id, token, e),
                Err(_) => log::warn!("[{}] Token {} 超时", self.id, token),
            }
        }

        if let Some(mut uri) = first_uri {
            uri.media_urls = all_uris.join(",");
            log::info!("[{}] 获取到 {} 个码流: {}", self.id, all_uris.len(), uri.media_urls);
            return Ok(uri);
        }

        Err(OnvifError::DeviceResponse {
            status: 500,
            body: "标准ONVIF流程失败".to_string(),
        })
    }

    /// 🎯 使用指定的 Media Service URL 和 Profile Token 获取流地址
    pub async fn get_stream_uri_with_url(&self, media_url: &str, profile_token: &str) -> Result<StreamUri, OnvifError> {
        log::info!("[{}] GetStreamUri - URL: {}, Token: {}", self.id, media_url, profile_token);

        // 1. 无认证
        match self.try_get_stream_uri_no_auth(media_url, profile_token).await {
            Ok(uri) => return Ok(uri),
            Err(_) => {},
        }
        // 2. WS-Security PasswordDigest（ONVIF标准认证）
        self.try_get_stream_uri_with_ws_digest(media_url, profile_token).await
    }

    /// 无认证尝试 GetStreamUri
    async fn try_get_stream_uri_no_auth(&self, media_url: &str, profile_token: &str) -> Result<StreamUri, OnvifError> {
        let soap = self.build_get_stream_uri_soap_no_auth(profile_token);

        log::debug!("📄 [{}] GetStreamUri(无认证) 请求", self.id);

        match self.client
            .post(media_url)
            .header("Content-Type", "application/soap+xml; charset=utf-8")
            .header("SOAPAction", "\"http://www.onvif.org/ver10/media/wsdl/GetStreamUri\"")
            .body(soap)
            .send()
            .await
        {
            Ok(res) => {
                let status = res.status();
                log::info!("📥 [{}] GetStreamUri(无认证) 响应状态码: {}", self.id, status.as_u16());

                let body = res.text().await.unwrap_or_default();
                log::info!("📥 [{}] GetStreamUri(无认证) 状态码: {}", self.id, status.as_u16());

                // 🎯 即使HTTP非200，也尝试解析响应体
                if !body.is_empty() && !body.contains("Sender") {
                    if let Ok(uri) = self.parse_stream_uri(&body) {
                        log::info!("✅ [{}] 获取流地址成功（无认证）", self.id);
                        return Ok(StreamUri {
                            uri: uri.clone(),
                            protocol: "RTSP".to_string(),
                            timeout: "60".to_string(),
                            media_urls: uri,
                        });
                    }
                }
                log::warn!("⚠️ [{}] GetStreamUri(无认证) 无法解析, HTTP {}", self.id, status.as_u16());
            }
            Err(e) => {
                log::warn!("⚠️ [{}] GetStreamUri(无认证) 请求失败: {}", self.id, e);
            }
        }

        Err(OnvifError::DeviceResponse {
            status: 401,
            body: "无认证失败".to_string(),
        })
    }

    /// 使用 WS-Security PasswordDigest 认证尝试 GetStreamUri（ONVIF标准认证）
    async fn try_get_stream_uri_with_ws_digest(&self, media_url: &str, profile_token: &str) -> Result<StreamUri, OnvifError> {
        let soap = self.build_get_stream_uri_soap_ws_digest(profile_token);

        log::debug!("📄 [{}] GetStreamUri(Digest) 请求 SOAP（前500字符）: {}", self.id, &soap[..soap.len().min(500)]);

        match self.client
            .post(media_url)
            .header("Content-Type", "application/soap+xml; charset=utf-8")
            .header("SOAPAction", "\"http://www.onvif.org/ver10/media/wsdl/GetStreamUri\"")
            .body(soap)
            .send()
            .await
        {
            Ok(res) => {
                let status = res.status();
                log::info!("📥 [{}] GetStreamUri(Digest) 响应状态码: {}", self.id, status.as_u16());

                let body = res.text().await.unwrap_or_default();
                log::info!("📥 [{}] GetStreamUri(Digest) 状态码: {}", self.id, status.as_u16());

                // 🎯 即使HTTP非200，也尝试解析响应体
                if !body.is_empty() && !body.contains("Sender") {
                    if let Ok(uri) = self.parse_stream_uri(&body) {
                        log::info!("✅ [{}] 获取流地址成功（PasswordDigest）", self.id);
                        return Ok(StreamUri {
                            uri: uri.clone(),
                            protocol: "RTSP".to_string(),
                            timeout: "60".to_string(),
                            media_urls: uri,
                        });
                    }
                }
                log::warn!("⚠️ [{}] GetStreamUri(Digest) 无法解析, HTTP {}", self.id, status.as_u16());
            }
            Err(e) => {
                log::warn!("⚠️ [{}] GetStreamUri(Digest) 请求失败: {}", self.id, e);
            }
        }

        Err(OnvifError::DeviceResponse {
            status: 401,
            body: "WS-Security PasswordDigest 认证失败".to_string(),
        })
    }



    /// 降级方案：仅尝试标准ONVIF路径（不扫描端口）

    /// 获取设备的 Profile 列表（使用指定的 Media Service URL）
    pub async fn get_profiles_with_url(&self, media_url: &str) -> Result<Vec<String>, OnvifError> {
        log::info!("🔍 [{}] 调用 GetProfiles: {}", self.id, media_url);

        // 精简认证：无认证 + Digest

        // 1. 无认证
        match self.get_profiles_without_auth(media_url).await {
            Ok(tokens) if !tokens.is_empty() => return Ok(tokens),
            _ => {},
        }

        // 2. PasswordDigest
        match self.try_get_profiles_with_digest(media_url).await {
            Ok(tokens) if !tokens.is_empty() => return Ok(tokens),
            _ => {},
        }

        Err(OnvifError::DeviceResponse {
            status: 401,
            body: "认证失败".to_string(),
        })
    }

    /// 使用 WS-Security PasswordDigest 获取 Profile 列表
    async fn try_get_profiles_with_digest(&self, media_url: &str) -> Result<Vec<String>, OnvifError> {
        let soap = self.build_get_profiles_soap_ws_digest();

        log::info!("🔍 [{}] 调用 GetProfiles (PasswordDigest): {}", self.id, media_url);

        match self.client
            .post(media_url)
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
                    log::info!("✅ [{}] GetProfiles (PasswordDigest) 成功", self.id);
                    return Ok(self.parse_profile_tokens(&body));
                } else {
                    let body = res.text().await.unwrap_or_default();
                    log::warn!("⚠️ [{}] GetProfiles(Digest) 返回错误 {}: {}", self.id, status.as_u16(), &body[..body.len().min(200)]);
                }
            }
            Err(e) => {
                log::warn!("⚠️ [{}] GetProfiles(Digest) 请求失败: {}", self.id, e);
            }
        }

        Err(OnvifError::DeviceResponse {
            status: 401,
            body: "PasswordDigest 认证失败".to_string(),
        })
    }

    /// 使用 WS-Security PasswordText 获取 Profile 列表

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
    pub async fn get_device_info(&self) -> Result<DeviceInfo, OnvifError> {
        // 尝试多个可能的路径和协议
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

                // 构建 GetDeviceInfo SOAP 请求（使用 WS-Security 认证）
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
                    xml_escape(&self.username), xml_escape(&self.password)
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
                        } else {
                            log::debug!("⚠️ [{}] GetDeviceInfo URL {} 返回状态: {}", self.id, url, res.status());
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

    /// 构建 GetCapabilities SOAP 请求（WS-Security）

    /// 构建 GetCapabilities SOAP 请求（无认证）
    fn build_get_capabilities_soap_no_auth(&self) -> String {
        r#"<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
  <s:Body>
    <tds:GetCapabilities/>
  </s:Body>
</s:Envelope>"#.to_string()
    }

    /// 构建 GetStreamUri SOAP 请求（WS-Security）
    /// 构建 GetStreamUri SOAP 请求（WS-Security PasswordDigest - ONVIF标准认证）
    fn build_get_stream_uri_soap_ws_digest(&self, profile_token: &str) -> String {
        let tokens = generate_onvif_auth_tokens(&self.password);
        let nonce = tokens.nonce_base64;
        let created = tokens.created;
        let digest = tokens.digest;

        format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:trt="http://www.onvif.org/ver10/media/wsdl"
            xmlns:tt="http://www.onvif.org/ver10/schema"
            xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
            xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
  <s:Header>
    <wsse:Security s:mustUnderstand="1">
      <wsse:UsernameToken>
        <wsse:Username>{}</wsse:Username>
        <wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">{}</wsse:Nonce>
        <wsu:Created>{}</wsu:Created>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">{}</wsse:Password>
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
            xml_escape(&self.username), nonce, created, digest, profile_token
        )
    }

    /// 构建 GetProfiles SOAP 请求（WS-Security PasswordDigest）
    fn build_get_profiles_soap_ws_digest(&self) -> String {
        let tokens = generate_onvif_auth_tokens(&self.password);
        let nonce = tokens.nonce_base64;
        let created = tokens.created;
        let digest = tokens.digest;

        format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:trt="http://www.onvif.org/ver10/media/wsdl"
            xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
            xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
  <s:Header>
    <wsse:Security s:mustUnderstand="1">
      <wsse:UsernameToken>
        <wsse:Username>{}</wsse:Username>
        <wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">{}</wsse:Nonce>
        <wsu:Created>{}</wsu:Created>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">{}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </s:Header>
  <s:Body>
    <trt:GetProfiles/>
  </s:Body>
</s:Envelope>"#,
            xml_escape(&self.username), nonce, created, digest
        )
    }

    /// 构建 GetCapabilities SOAP 请求（WS-Security PasswordDigest）
    fn build_get_capabilities_soap_ws_digest(&self) -> String {
        let tokens = generate_onvif_auth_tokens(&self.password);
        let nonce = tokens.nonce_base64;
        let created = tokens.created;
        let digest = tokens.digest;

        format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:tds="http://www.onvif.org/ver10/device/wsdl"
            xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
            xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
  <s:Header>
    <wsse:Security s:mustUnderstand="1">
      <wsse:UsernameToken>
        <wsse:Username>{}</wsse:Username>
        <wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">{}</wsse:Nonce>
        <wsu:Created>{}</wsu:Created>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">{}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </s:Header>
  <s:Body>
    <tds:GetCapabilities>
      <tds:Category>All</tds:Category>
    </tds:GetCapabilities>
  </s:Body>
</s:Envelope>"#,
            xml_escape(&self.username), nonce, created, digest
        )
    }

    /// 构建 GetStreamUri SOAP 请求（无认证）
    fn build_get_stream_uri_soap_no_auth(&self, profile_token: &str) -> String {
        format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:trt="http://www.onvif.org/ver10/media/wsdl"
            xmlns:tt="http://www.onvif.org/ver10/schema">
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
            profile_token
        )
    }

    /// 构建 GetProfiles SOAP 请求（无认证）
    fn build_get_profiles_soap_no_auth(&self) -> String {
        r#"<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:trt="http://www.onvif.org/ver10/media/wsdl">
  <s:Body>
    <trt:GetProfiles/>
  </s:Body>
</s:Envelope>"#.to_string()
    }

    /// 获取 Media 服务地址（优化版：先GetServices再GetCapabilities，减少组合爆炸）
    pub async fn get_media_service_url(&self) -> Result<String, OnvifError> {
        let port = self.port;
        // 🎯 扩展ONVIF路径列表，覆盖更多设备
        let device_paths = [
            "/onvif/device_service",
            "/onvif/device",
            "/onvif",
            "/onvif/services",
            "/onvif/soap",
            "/device_service",
            "/soap/device_service",
            "/axis-cgi/onvif/services",
            "/ISAPI/onvif/deviceService",
            "/onvif10/device_service",
            "/onvif20/device_service",
        ];

        for path in &device_paths {
            let url = format!("http://{}:{}{}", self.ip, port, path);
            log::info!("[{}] 尝试路径: {}", self.id, url);

            // 1. 先尝试 GetServices (ONVIF 2.0+，更高效)
            match self.try_get_services(&url).await {
                Ok(media_url) => {
                    log::info!("[{}] GetServices成功: {}", self.id, media_url);
                    return Ok(media_url);
                }
                Err(e) => log::debug!("[{}] GetServices失败: {}", self.id, e),
            }

            // 2. 再尝试 GetCapabilities (ONVIF 1.x)
            // 先无认证
            match self.try_get_capabilities_no_auth(&url).await {
                Ok(media_url) => {
                    log::info!("[{}] GetCapabilities(无认证)成功: {}", self.id, media_url);
                    return Ok(media_url);
                }
                Err(e) => log::debug!("[{}] GetCapabilities(无认证)失败: {}", self.id, e),
            }
            // 再Digest认证
            match self.try_get_capabilities_with_ws_digest(&url).await {
                Ok(media_url) => {
                    log::info!("[{}] GetCapabilities(Digest)成功: {}", self.id, media_url);
                    return Ok(media_url);
                }
                Err(e) => log::debug!("[{}] GetCapabilities(Digest)失败: {}", self.id, e),
            }
        }

        // 🎯 尝试HTTPS连接（部分设备强制HTTPS）
        log::info!("[{}] HTTP路径全部失败，尝试HTTPS", self.id);
        for path in &device_paths[..5] { // 只尝试前5个常见路径
            let url = format!("https://{}:{}{}", self.ip, port, path);
            log::info!("[{}] 尝试HTTPS路径: {}", self.id, url);

            // 创建不验证证书的客户端（部分设备使用自签名证书）
            let https_client = reqwest::Client::builder()
                .danger_accept_invalid_certs(true)
                .build()
                .map_err(|e| OnvifError::DeviceResponse {
                    status: 500,
                    body: format!("创建HTTPS客户端失败: {}", e),
                })?;

            match self.try_get_capabilities_no_auth_with_client(&url, &https_client).await {
                Ok(media_url) => {
                    log::info!("[{}] HTTPS GetCapabilities(无认证)成功: {}", self.id, media_url);
                    return Ok(media_url);
                }
                Err(e) => log::debug!("[{}] HTTPS GetCapabilities(无认证)失败: {}", self.id, e),
            }
        }

        Err(OnvifError::DeviceResponse {
            status: 404,
            body: "无法获取 Media 服务地址".to_string(),
        })
    }

    /// 通过 GetServices 获取 Media 服务地址（ONVIF 2.0+，比GetCapabilities更高效）
    async fn try_get_services(&self, url: &str) -> Result<String, OnvifError> {
        let soap = r#"<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
  <s:Body>
    <tds:GetServices/>
  </s:Body>
</s:Envelope>"#;

        log::info!("[{}] GetServices 尝试: {}", self.id, url);

        match self.client
            .post(url)
            .header("Content-Type", "application/soap+xml; charset=utf-8")
            .header("SOAPAction", "\"http://www.onvif.org/ver10/device/wsdl/GetServices\"")
            .body(soap.to_string())
            .send()
            .await
        {
            Ok(res) => {
                let status = res.status();
                let body = res.text().await.unwrap_or_default();
                log::info!("[{}] GetServices 状态码: {}", self.id, status.as_u16());

                if !body.is_empty() {
                    // 尝试解析 Media Service XAddr
                    if let Some(media_url) = self.parse_media_service_url(&body) {
                        log::info!("[{}] GetServices 成功: {}", self.id, media_url);
                        return Ok(media_url);
                    }
                    if let Some(media_url) = self.parse_media_service_url_fallback(&body) {
                        log::info!("[{}] GetServices 备用解析成功: {}", self.id, media_url);
                        return Ok(media_url);
                    }
                }

                log::warn!("[{}] GetServices 无法解析, HTTP {}", self.id, status.as_u16());
            }
            Err(e) => {
                log::warn!("[{}] GetServices 请求失败: {}", self.id, e);
            }
        }

        Err(OnvifError::DeviceResponse {
            status: 500,
            body: "GetServices 失败".to_string(),
        })
    }

    /// 无认证尝试 GetCapabilities（很多摄像机不需要认证）
    async fn try_get_capabilities_no_auth(&self, url: &str) -> Result<String, OnvifError> {
        let soap = self.build_get_capabilities_soap_no_auth();

        log::info!("[{}] GetCapabilities(无认证) URL: {}", self.id, url);

        match self.client
            .post(url)
            .header("Content-Type", "application/soap+xml; charset=utf-8")
            .header("SOAPAction", "\"http://www.onvif.org/ver10/device/wsdl/GetCapabilities\"")
            .body(soap)
            .send()
            .await
        {
            Ok(res) => {
                let status = res.status();
                let body = res.text().await.unwrap_or_default();
                log::info!("[{}] GetCapabilities(无认证) 状态码: {}", self.id, status.as_u16());

                if !body.is_empty() {
                    if let Some(media_url) = self.parse_media_service_url(&body) {
                        log::info!("[{}] GetCapabilities(无认证) 成功: {}", self.id, media_url);
                        return Ok(media_url);
                    }
                    if let Some(media_url) = self.parse_media_service_url_fallback(&body) {
                        log::info!("[{}] GetCapabilities(无认证) 备用解析成功: {}", self.id, media_url);
                        return Ok(media_url);
                    }
                }

                log::warn!("[{}] GetCapabilities(无认证) 无法解析, HTTP {}", self.id, status.as_u16());
            }
            Err(e) => {
                log::warn!("[{}] GetCapabilities(无认证) 请求失败: {}", self.id, e);
            }
        }

        Err(OnvifError::DeviceResponse {
            status: 500,
            body: "GetCapabilities 无认证失败".to_string(),
        })
    }

    /// 无认证尝试 GetCapabilities（使用自定义客户端，用于HTTPS）
    async fn try_get_capabilities_no_auth_with_client(&self, url: &str, client: &reqwest::Client) -> Result<String, OnvifError> {
        let soap = self.build_get_capabilities_soap_no_auth();

        log::info!("[{}] GetCapabilities(无认证) URL: {}", self.id, url);

        match client
            .post(url)
            .header("Content-Type", "application/soap+xml; charset=utf-8")
            .header("SOAPAction", "\"http://www.onvif.org/ver10/device/wsdl/GetCapabilities\"")
            .body(soap)
            .send()
            .await
        {
            Ok(res) => {
                let status = res.status();
                let body = res.text().await.unwrap_or_default();
                log::info!("[{}] GetCapabilities(无认证) 状态码: {}", self.id, status.as_u16());

                if !body.is_empty() {
                    if let Some(media_url) = self.parse_media_service_url(&body) {
                        log::info!("[{}] GetCapabilities(无认证) 成功: {}", self.id, media_url);
                        return Ok(media_url);
                    }
                    if let Some(media_url) = self.parse_media_service_url_fallback(&body) {
                        log::info!("[{}] GetCapabilities(无认证) 备用解析成功: {}", self.id, media_url);
                        return Ok(media_url);
                    }
                }

                log::warn!("[{}] GetCapabilities(无认证) 无法解析, HTTP {}", self.id, status.as_u16());
            }
            Err(e) => {
                log::warn!("[{}] GetCapabilities(无认证) 请求失败: {}", self.id, e);
            }
        }

        Err(OnvifError::DeviceResponse {
            status: 500,
            body: "GetCapabilities 无认证失败".to_string(),
        })
    }

    /// 使用 WS-Security PasswordDigest 认证尝试 GetCapabilities
    async fn try_get_capabilities_with_ws_digest(&self, url: &str) -> Result<String, OnvifError> {
        let soap = self.build_get_capabilities_soap_ws_digest();

        match self.client
            .post(url)
            .header("Content-Type", "application/soap+xml; charset=utf-8")
            .header("SOAPAction", "\"http://www.onvif.org/ver10/device/wsdl/GetCapabilities\"")
            .body(soap)
            .send()
            .await
        {
            Ok(res) => {
                let status = res.status();
                let body = res.text().await.unwrap_or_default();
                log::info!("📥 [{}] GetCapabilities(Digest) URL {} 状态码: {}", self.id, url, status.as_u16());

                // 🎯 即使HTTP状态码非200，也尝试解析SOAP响应体
                if !body.is_empty() {
                    if body.contains("Fault") && body.contains("Sender") && !body.contains("XAddr") {
                        log::warn!("⚠️ [{}] GetCapabilities(Digest) 收到SOAP Fault", self.id);
                    } else {
                        if let Some(media_url) = self.parse_media_service_url(&body) {
                            log::info!("✅ [{}] GetCapabilities(Digest) 成功解析Media URL: {}", self.id, media_url);
                            return Ok(media_url);
                        }
                        if let Some(media_url) = self.parse_media_service_url_fallback(&body) {
                            log::info!("✅ [{}] GetCapabilities(Digest) 备用解析成功: {}", self.id, media_url);
                            return Ok(media_url);
                        }
                    }
                }

                log::warn!("⚠️ [{}] GetCapabilities(Digest) URL {} 无法解析Media URL", self.id, url);
            }
            Err(e) => {
                log::warn!("⚠️ [{}] GetCapabilities(Digest) URL {} 请求失败: {}", self.id, url, e);
            }
        }

        Err(OnvifError::DeviceResponse {
            status: 401,
            body: "WS-Security PasswordDigest 认证失败".to_string(),
        })
    }

    /// 使用 WS-Security PasswordText 认证尝试 GetCapabilities

    /// 从 GetCapabilities 响应中解析 Media 服务地址
    /// 🎯 使用 roxmltree 正确处理命名空间，避免手工解析的脆弱性
    fn parse_media_service_url(&self, xml: &str) -> Option<String> {
        log::debug!("🔍 [{}] 尝试解析 Media URL，响应长度: {}", self.id, xml.len());

        // 使用 roxmltree 解析 XML，正确处理命名空间
        match Document::parse(xml) {
            Ok(doc) => {
                // 查找任意命名空间的 Media 元素
                let media = doc.descendants().find(|n| n.has_tag_name("Media"));

                if let Some(media_elem) = media {
                    // 在 Media 元素下查找任意命名空间的 XAddr 元素
                    let xaddr = media_elem.descendants().find(|n| n.has_tag_name("XAddr"));

                    if let Some(xaddr_elem) = xaddr {
                        if let Some(url) = xaddr_elem.text() {
                            let url_trimmed = url.trim();
                            if !url_trimmed.is_empty() && url_trimmed.starts_with("http") {
                                log::info!("📍 [{}] ✅ 成功解析 Media 服务地址: {}", self.id, url_trimmed);
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
                            if !url_trimmed.is_empty() && url_trimmed.starts_with("http") {
                                log::info!("📍 [{}] ✅ 通过全局查找解析到 Media 服务地址: {}", self.id, url_trimmed);
                                return Some(url_trimmed.to_string());
                            }
                        }
                    }
                }

                log::warn!("⚠️ [{}] 未能找到 Media 服务地址，XML 结构可能不标准", self.id);
                None
            }
            Err(e) => {
                log::error!("❌ [{}] XML 解析失败: {}", self.id, e);
                // 降级到手工解析作为备选
                self.parse_media_service_url_fallback(xml)
            }
        }
    }

    /// 备用解析方法（当 roxmltree 失败时使用）
    fn parse_media_service_url_fallback(&self, xml: &str) -> Option<String> {
        log::debug!("🔍 [{}] 使用备用解析方法", self.id);

        let namespace_prefixes = ["tt", "trt", "wsnt", "ns1", "ns2", "tan", "tas", ""];

        for prefix in &namespace_prefixes {
            let media_start_tag = if prefix.is_empty() { "<Media>".to_string() } else { format!("<{}:Media>", prefix) };
            let media_end_tag = if prefix.is_empty() { "</Media>".to_string() } else { format!("</{}:Media>", prefix) };
            let xaddr_start_tag = if prefix.is_empty() { "<XAddr>".to_string() } else { format!("<{}:XAddr>", prefix) };
            let xaddr_end_tag = if prefix.is_empty() { "</XAddr>".to_string() } else { format!("</{}:XAddr>", prefix) };

            if let Some(media_start) = xml.find(&media_start_tag) {
                if let Some(media_end) = xml[media_start..].find(&media_end_tag) {
                    let media_block = &xml[media_start..media_start + media_end + media_end_tag.len()];

                    if let Some(xaddr_start) = media_block.find(&xaddr_start_tag) {
                        if let Some(xaddr_end) = media_block[xaddr_start..].find(&xaddr_end_tag) {
                            let url = media_block[xaddr_start + xaddr_start_tag.len()..xaddr_start + xaddr_end].trim();
                            if !url.is_empty() && url.starts_with("http") {
                                log::info!("📍 [{}] 通过备用方案解析到 Media 服务地址: {}", self.id, url);
                                return Some(url.to_string());
                            }
                        }
                    }
                }
            }
        }

        None
    }

    /// 解析 XML 响应提取流 URI
    /// 🎯 使用 roxmltree 正确处理命名空间，避免手工解析的脆弱性
    fn parse_stream_uri(&self, xml: &str) -> Result<String, OnvifError> {
        log::info!("🔍 [{}] 开始解析流地址响应，响应长度: {}", self.id, xml.len());

        // 🎯 使用 roxmltree 解析 XML，正确处理命名空间
        match Document::parse(xml) {
            Ok(doc) => {
                // 查找任意命名空间的 Uri 元素
                for node in doc.descendants() {
                    if node.has_tag_name("Uri") {
                        if let Some(uri_str) = node.text() {
                            let mut uri = uri_str.trim().to_string();
                            if !uri.is_empty() && (uri.starts_with("rtsp://") || uri.starts_with("rtsps://")) {
                                // 处理地址
                                uri = self.normalize_rtsp_uri(&uri);
                                log::info!("✅ [{}] ✅ 使用 roxmltree 解析到流地址: {}", self.id, uri);
                                return Ok(uri);
                            }
                        }
                    }
                }

                // 备选：查找 StreamUri 元素下的内容
                for node in doc.descendants() {
                    if node.has_tag_name("StreamUri") {
                        if let Some(uri_str) = node.text() {
                            let mut uri = uri_str.trim().to_string();
                            if !uri.is_empty() && (uri.starts_with("rtsp://") || uri.starts_with("rtsps://")) {
                                uri = self.normalize_rtsp_uri(&uri);
                                log::info!("✅ [{}] ✅ 通过 StreamUri 元素解析到流地址: {}", self.id, uri);
                                return Ok(uri);
                            }
                        }
                    }
                }

                log::warn!("⚠️ [{}] roxmltree 未找到 URI，尝试备用方法", self.id);
                self.parse_stream_uri_fallback(xml)
            }
            Err(e) => {
                log::error!("❌ [{}] roxmltree 解析失败: {}，使用备用方法", self.id, e);
                self.parse_stream_uri_fallback(xml)
            }
        }
    }

    /// 备用解析方法（当 roxmltree 失败时使用）
    fn parse_stream_uri_fallback(&self, xml: &str) -> Result<String, OnvifError> {
        log::debug!("🔍 [{}] 使用备用解析方法", self.id);

        // 尝试多种可能的标签格式
        let namespace_prefixes = ["tt", "trt", "ns1", "ns2", "tan", "tas", "wsnt", ""];
        let base_patterns = ["Uri>", "StreamUri>"];

        for prefix in &namespace_prefixes {
            for base in &base_patterns {
                let pattern = if prefix.is_empty() {
                    format!("<{}>", base)
                } else {
                    format!("<{}:{}>", prefix, base)
                };
                if let Some(start) = xml.find(&pattern) {
                    let end_tag = if prefix.is_empty() {
                        format!("</{}>", base)
                    } else {
                        format!("</{}:{}>", prefix, base)
                    };
                    if let Some(end) = xml[start..].find(&end_tag) {
                        let mut uri = xml[start + pattern.len()..start + end].trim().to_string();

                        if !uri.is_empty() && (uri.starts_with("rtsp://") || uri.starts_with("rtsps://")) {
                            uri = self.normalize_rtsp_uri(&uri);
                            log::info!("✅ [{}] 使用模式 '{}' 解析到流地址: {}", self.id, pattern, uri);
                            return Ok(uri);
                        }
                    }
                }
            }
        }

        // 如果常规解析失败，尝试查找 rtsp:// 开头的 URL
        if let Some(rtsp_start) = xml.find("rtsp://") {
            let uri_end = xml[rtsp_start..].find(|c| c == '"' || c == '<' || c == ' ' || c == '\n')
                .unwrap_or(xml.len() - rtsp_start);
            let mut uri = xml[rtsp_start..rtsp_start + uri_end].trim().to_string();
            uri = self.normalize_rtsp_uri(&uri);

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
