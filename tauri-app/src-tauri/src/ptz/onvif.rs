use reqwest::Client;
use thiserror::Error;
use std::time::SystemTime;

#[derive(Debug, Error)]
pub enum OnvifError {
    #[error("HTTP请求失败: {0}")]
    Request(#[from] reqwest::Error),
    #[error("设备返回错误: HTTP {status} - {body}")]
    DeviceResponse { status: u16, body: String },
    #[error("设备未注册")]
    DeviceNotFound,
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
