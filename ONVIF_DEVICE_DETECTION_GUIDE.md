# ONVIF 设备发现和配置界面

## 概述

本文档描述了新增的ONVIF设备自动检测和配置功能，该功能可以自动检测正确的媒体服务地址，彻底解决404问题。

## 功能特性

### 1. 自动获取RTSP流地址（原有功能增强）

- **位置**: AddSourceDialog.vue - "自动获取RTSP地址"按钮
- **功能**: 通过标准ONVIF协议流程自动获取RTSP流地址
- **降级策略**:
  1. 尝试标准ONVIF GetProfiles + GetStreamUri
  2. 如果失败，尝试通用RTSP模板
  3. 根据品牌生成特定的URL格式

### 2. 高级检测功能（新增）

- **位置**: AddSourceDialog.vue - "高级检测"按钮
- **功能**: 全面检测所有可能的ONVIF服务路径，并显示详细结果
- **检测内容**:
  - ✅ 设备服务路径 (Device Service)
  - ✅ 媒体服务路径 (Media Service)
  - ✅ Profile Tokens
  - ✅ RTSP流地址
  - ✅ 响应时间和状态码

## 技术实现

### 🎯 标准ONVIF流程实现

本项目严格遵循ONVIF标准协议流程：

```
用户输入 ONVIF 地址
    ↓
┌──────────────────────────────────┐
│ 1. GetDeviceInfo                 │
│    验证设备可达性和认证信息        │
└──────────────┬───────────────────┘
               ↓
┌──────────────────────────────────┐
│ 2. GetCapabilities               │
│    获取设备支持的服务列表          │
│    (Media, PTZ, Events等)        │
└──────────────┬───────────────────┘
               ↓
┌──────────────────────────────────┐
│ 3. 提取 Media Service URL        │
│    例如: http://192.168.1.10/    │
│           onvif/media_service    │
└──────────────┬───────────────────┘
               ↓
┌──────────────────────────────────┐
│ 4. GetProfiles                   │
│    获取所有媒体配置文件            │
│    (主码流、子码流、第三码流)      │
└──────────────┬───────────────────┘
               ↓
┌──────────────────────────────────┐
│ 5. GetStreamUri                  │
│    获取对应的RTSP地址             │
└──────────────┬───────────────────┘
               ↓
返回 StreamUri 对象
(rtsp://...)
```

**关键特性**:

- ✅ **步骤1**: GetDeviceInfo - 验证设备是否可达，认证是否正确
- ✅ **容错处理**: 如果GetDeviceInfo失败，继续尝试后续步骤（有些设备不支持）
- ✅ **智能降级**: 每个步骤都有多层fallback机制
- ✅ **详细日志**: 每个步骤都有清晰的日志输出

### 后端 (Rust)

#### 新增Tauri命令: `detect_onvif_services`

**文件**: `src-tauri/src/ptz_commands.rs`

```rust
pub async fn detect_onvif_services(
    ip: String,
    port: u16,
    username: String,
    password: String,
) -> Result<OnvifDeviceConfig, String>
```

**返回数据结构**:

```rust
pub struct OnvifDeviceConfig {
    pub ip: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub device_service_url: Option<String>,      // 设备服务URL
    pub media_service_url: Option<String>,        // 媒体服务URL
    pub profiles: Vec<String>,                    // Profile列表
    pub rtsp_stream_url: Option<String>,          // RTSP流地址
    pub service_tests: Vec<OnvifServiceTestResult>, // 所有测试结果
    pub recommended_config: OnvifRecommendedConfig, // 推荐配置
}
```

**检测流程**:

1. **步骤1: GetDeviceInfo - 设备验证**
   - 测试5个常见的设备服务路径
   - 发送GetDeviceInformation请求
   - 解析制造商、型号、固件版本等信息
   - 验证设备可达性和认证正确性

2. **步骤2-3: 设备服务路径检测**
   - 测试7个常见的设备服务路径
   - 支持HTTP和HTTPS协议
   - 发送GetCapabilities请求
   - 解析响应提取Media服务地址

3. **步骤4: 媒体服务路径检测**
   - 测试18个常见的媒体服务路径
   - 发送GetProfiles请求
   - 解析Profile Tokens

4. **步骤5: RTSP流地址获取**
   - 使用找到的Media服务URL和Profile Token
   - 调用GetStreamUri获取RTSP地址

5. **推荐配置生成**
   - 根据检测结果计算置信度 (high/medium/low)
   - 提供最佳的服务路径组合

### 前端 (Vue)

#### 新增组件和方法

**文件**: `src/components/teacher-window/dialogs/AddSourceDialog.vue`

**响应式变量**:

```javascript
const detectingOnvifServices = ref(false);        // 检测状态
const showOnvifDetectionResult = ref(false);      // 显示结果对话框
const onvifDetectionResult = ref(null);           // 检测结果
```

**方法**:

- `detectOnvifServices()` - 执行完整检测
- `applyRecommendedConfig()` - 应用推荐配置

#### UI组件

1. **高级检测按钮**
   - 绿色按钮，带Search图标
   - 显示检测进度
   - 需要填写IP、用户名、密码后才可点击

2. **检测结果对话框**
   - 宽度900px
   - 包含4个卡片区域：
     - 📷 设备信息
     - ✨ 推荐配置
     - 🔍 服务路径测试结果表格
     - 📋 Profiles列表

3. **测试结果表格**
   - 路径
   - 协议 (HTTP/HTTPS)
   - 状态 (成功/失败/超时)
   - 状态码
   - 响应时间
   - 类型 (设备服务/媒体服务)
   - 错误信息

## 使用方法

### 快速开始

1. 打开"添加信号源"对话框
2. 选择协议为"ONVIF"
3. 填写摄像机信息：
   - IP地址
   - 端口 (默认80)
   - 用户名
   - 密码
4. 点击"高级检测"按钮
5. 等待检测完成（通常需要5-15秒）
6. 查看检测结果
7. 点击"应用推荐配置"自动填充RTSP地址

### 解读检测结果

#### 置信度说明

- **High (高)**: 找到了设备服务、媒体服务和至少一个Profile，可以可靠工作
- **Medium (中)**: 只找到部分服务，可能需要手动调整
- **Low (低)**: 未找到可靠配置，建议检查网络连接或认证信息

#### 服务路径测试

表格中会显示所有测试的路径：

- ✅ **成功**: 绿色标签，表示该路径可用
- ⚠️ **超时**: 黄色标签，表示请求超时
- ❌ **失败**: 红色标签，表示路径不可用

#### 响应时间

- < 100ms: 非常快
- 100-500ms: 正常
- 500-3000ms: 较慢
- > 3000ms: 可能超时

## 解决的问题

### 1. 404错误

**问题**: ONVIF设备返回"HTTP 404 - 所有 GetProfiles 路径均失败"

**解决方案**:

- 扩展路径搜索范围（从9个增加到25个）
- 同时测试HTTP和HTTPS协议
- 自动从GetCapabilities响应中提取正确的Media服务URL
- 提供详细的失败原因和备选方案

### 2. 端口不匹配

**问题**: 强制使用2000端口导致连接失败

**解决方案**:

- 保持实际验证通过的端口
- 在多个端口上尝试连接
- 用户可以看到实际工作的端口

### 3. 认证问题

**问题**: WS-Security认证失败

**解决方案**:

- 先尝试带认证的请求
- 如果失败，自动降级到无认证请求
- 记录详细的认证错误信息

## 示例输出

### 成功的检测结果

```json
{
  "ip": "192.168.1.100",
  "port": 80,
  "device_service_url": "http://192.168.1.100:80/onvif/device_service",
  "media_service_url": "http://192.168.1.100:80/onvif/Media",
  "profiles": ["Profile_1", "Profile_2"],
  "rtsp_stream_url": "rtsp://192.168.1.100:554/h264/ch1/main/av_stream",
  "recommended_config": {
    "device_service_path": "/onvif/device_service",
    "media_service_path": "/onvif/Media",
    "profile_token": "Profile_1",
    "confidence": "high"
  },
  "service_tests": [
    {
      "path": "/onvif/device_service",
      "protocol": "http",
      "status": "success",
      "status_code": 200,
      "response_time_ms": 45,
      "is_device_service": true,
      "error_message": null
    }
    // ... 更多测试结果
  ]
}
```

## 性能优化

### 并行检测

- 设备服务和媒体服务路径按顺序测试（避免并发过多请求）
- 每个请求超时时间设置为3秒
- 总检测时间通常在5-15秒之间

### 缓存策略

- 检测结果不会自动缓存（每次都是最新状态）
- 用户可以多次检测以确认稳定性

## 故障排除

### 检测失败的可能原因

1. **网络连接问题**
   - 检查IP地址是否正确
   - 确认端口是否开放
   - 验证防火墙设置

2. **认证失败**
   - 确认用户名和密码正确
   - 检查ONVIF用户是否启用
   - 尝试admin/admin等默认凭据

3. **设备不支持ONVIF**
   - 确认设备确实支持ONVIF协议
   - 检查ONVIF服务是否启用
   - 查看设备固件版本

4. **路径不匹配**
   - 查看检测结果中的成功路径
   - 手动尝试其他常见路径
   - 联系设备厂商获取正确的ONVIF路径

## 未来改进

1. **保存检测结果**
   - 将成功的配置保存到数据库
   - 下次添加相同设备时自动应用

2. **批量检测**
   - 支持同时检测多个摄像机
   - 显示整体进度

3. **路径学习**
   - 记录不同品牌设备的常用路径
   - 智能排序路径测试顺序

4. **WebSocket实时反馈**
   - 实时显示检测进度
   - 取消正在进行的检测

## 相关文件

- 后端实现: `tauri-app/src-tauri/src/ptz_commands.rs`
- 后端ONVIF核心: `tauri-app/src-tauri/src/ptz/onvif.rs`
- 前端对话框: `tauri-app/src/components/teacher-window/dialogs/AddSourceDialog.vue`
- Tauri命令注册: `tauri-app/src-tauri/src/main.rs`

## 相关记忆

- ONVIF设备扫描端口优先级配置
- ONVIF协议标准调用流程（含认证）
- ONVIF设备发现过滤非摄像机设备
- ONVIF设备端口应保持实际验证通过的端口而非强制2000
