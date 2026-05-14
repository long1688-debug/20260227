# 网络摄像机配置管理功能使用指南

**版本**: 1.0  
**最后更新**: 2026-05-13  
**模块**: `CameraDiscoveryPanel.vue` + `ptz_commands.rs`

---

## 📋 功能概述

本系统提供完整的网络摄像机设备管理功能：

1. **自动发现** - 通过多种协议自动扫描局域网内的在线摄像机
2. **一键注册** - 将发现的设备快速注册到PTZ控制系统
3. **配置编辑** - 在设备列表中直接修改IP、端口、认证信息等参数
4. **设备删除** - 移除不再需要的设备配置
5. **详情查看** - 获取设备的完整配置信息

---

## 🚀 快速开始

### 1. 打开摄像机发现面板

在教师窗口中：
1. 点击"添加信号源"按钮
2. 选择"网络摄像机"类别
3. 点击"🔍 摄像机发现与管理"按钮（或直接在侧边栏找到"摄像机管理"）

### 2. 自动扫描在线设备

#### 方式一：多网卡扫描（推荐）⭐

```javascript
// 前端调用
const result = await invoke('scan_all_network_interfaces', { 
  timeoutSecs: 5 
});

console.log(`发现 ${result.length} 个设备`);
result.forEach(device => {
  console.log(`  - ${device.address}:${device.port}`);
});
```

**特点**:
- ✅ 自动检测所有网络接口
- ✅ 并发扫描多个网段
- ✅ 支持跨网段发现设备
- ⏱️ 典型耗时：5-15秒

#### 方式二：综合发现

同时执行ONVIF、SSDP和子网扫描，确保不遗漏任何设备。

```javascript
const result = await invoke('discover_all_cameras', { timeoutSecs: 5 });

console.log(`扫描耗时: ${result.scan_duration_ms}ms`);
console.log(`共发现 ${result.cameras.length} 个设备`);
```

#### 方式三：手动指定IP范围

适用于已知部分设备IP的场景。

```javascript
const cameras = await invoke('scan_network_cameras', {
  ips: ['192.168.1.100', '192.168.1.101', '192.168.1.102'],
  ports: [80, 554, 8000],
  timeoutSecs: 3
});
```

---

## 🎯 设备注册与配置

### 1. 注册发现的设备

**步骤**:
1. 在设备列表中找到目标摄像机
2. 点击"注册"按钮
3. 填写认证信息（用户名/密码）
4. 点击"确认注册"

**代码示例**:
```javascript
import { registerOnvifDevice } from '@/services/captureDeviceService'

await registerOnvifDevice({
  ip: '192.168.1.100',
  username: 'admin',
  password: 'admin',
  name: '会议室摄像机' // 可选
})
```

### 2. 编辑设备配置

**步骤**:
1. 在设备列表中点击"配置"按钮
2. 修改需要更新的参数：
   - 设备名称
   - IP地址
   - 端口号
   - 用户名
   - 密码
3. 点击"保存配置"

**注意事项**:
- ⚠️ 修改IP或端口后，设备ID将会改变
- 🔒 密码字段留空表示不修改密码
- 🔄 保存时会先注销旧设备，再用新配置重新注册

**代码示例**:
```javascript
import { updateCameraConfig } from '@/services/captureDeviceService'

await updateCameraConfig({
  deviceId: 'minrray_01',
  name: '主会场摄像机',
  ip: '192.168.1.200',
  port: 8080,
  username: 'admin',
  password: 'newpassword' // 留空则不修改
})
```

### 3. 删除设备

**步骤**:
1. 在设备列表中点击"删除"按钮
2. 确认删除操作（二次确认对话框）
3. 设备从列表中移除

**代码示例**:
```javascript
import { removeCameraDevice } from '@/services/captureDeviceService'

await removeCameraDevice('chingan_01')
```

### 4. 查看设备详情

**代码示例**:
```javascript
import { getCameraDetails } from '@/services/captureDeviceService'

const details = await getCameraDetails('vhd_01')
console.log('设备详情:', details)
// {
//   id: "vhd_01",
//   ip: "192.168.1.102",
//   port: 80,
//   username: "admin",
//   profile_token: "Profile_1",
//   xaddr: "http://192.168.1.102:80/onvif/device_service"
// }
```

---

## 📊 UI界面说明

### 设备发现面板布局

```
┌─────────────────────────────────────────────┐
│  🎥 网络摄像机发现                           │
│  本地 IP: 192.168.1.100  [刷新]              │
├─────────────────────────────────────────────┤
│  [🌐 多网卡扫描] [自动子网] [综合] [手动]    │
│  超时时间: [5] 秒  [开始扫描] [🔍 诊断]     │
├─────────────────────────────────────────────┤
│  📡 检测到的网络接口 (3)                     │
│  ┌───────────────────────────────────────┐  │
│  │ Ethernet  192.168.1.100  255.255.255.0│  │
│  │ WiFi      192.168.2.50   255.255.255.0│  │
│  └───────────────────────────────────────┘  │
├─────────────────────────────────────────────┤
│  发现的设备 (5)                  [导出]      │
│  ┌───────────────────────────────────────┐  │
│  │ IP地址      │端口│名称        │操作    │  │
│  ├───────────────────────────────────────┤  │
│  │192.168.1.100│80  │minrray_01  │[注册]  │  │
│  │             │    │            │[预览]  │  │
│  │             │    │            │[配置]  │  │
│  │             │    │            │[删除]  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 配置编辑对话框

```
┌──────────────────────────────────┐
│  编辑摄像机配置                   │
├──────────────────────────────────┤
│  ⚠️ 提示：修改IP或端口后，设备ID  │
│     将会改变                      │
├──────────────────────────────────┤
│  当前设备ID: minrray_01           │
│  设备名称:   [_______________]    │
│  IP 地址:    [192.168.1.100__]    │
│  端口:       [80__________]       │
│  用户名:     [admin_________]     │
│  密码:       [••••••••______]     │
├──────────────────────────────────┤
│          [取消]  [保存配置]       │
└──────────────────────────────────┘
```

---

## 🔧 常见场景

### 场景1：批量部署新摄像机

1. 连接所有摄像机到网络
2. 使用"多网卡扫描"一次性发现所有设备
3. 逐个注册设备，设置统一的密码
4. 导出设备列表作为备份

### 场景2：更换摄像机IP地址

1. 在网络设备上修改摄像机IP
2. 在系统中点击"配置"按钮
3. 更新IP地址字段
4. 保存配置（系统会自动重新注册）
5. 测试PTZ控制是否正常

### 场景3：忘记摄像机密码

1. 在摄像机Web界面重置密码
2. 在系统中点击"配置"按钮
3. 输入新密码
4. 保存配置
5. 验证连接是否成功

### 场景4：清理无效设备

1. 定期检查设备列表
2. 对离线或废弃的设备点击"删除"
3. 确认删除操作
4. 重新扫描确认真实在线设备

---

## ⚙️ 高级配置

### 1. 自定义扫描端口

默认扫描的端口：`[80, 554, 8000, 8080, 8899, 37777, 37778]`

如需添加自定义端口，修改 `camera_discovery.rs`:

```rust
const COMMON_CAMERA_PORTS: &[u16] = &[
    80, 554, 8000, 8080, 8899, 37777, 37778,
    9000,  // 添加自定义端口
];
```

### 2. 调整扫描超时时间

- **快速扫描**: 1-3秒（适合小网络）
- **标准扫描**: 5秒（推荐）
- **深度扫描**: 10-15秒（适合大网络或高延迟环境）

### 3. 厂商默认配置预设

系统内置了5家主流厂商的默认配置：

| 厂商 | 默认IP | 默认端口 | 默认用户名 | 默认密码 | Profile Token |
|------|--------|----------|------------|----------|---------------|
| 明日 (Minrray) | 192.168.1.100 | 80 | admin | admin | profile_1 |
| 晨安 (Chingan) | 192.168.1.101 | 80 | admin | admin | 000 |
| 维海德 (VHD) | 192.168.1.102 | 80 | admin | admin | Profile_1 |
| 普奥视 (PUAS) | 192.168.1.103 | 80 | admin | admin | MainStream |
| 金九天视 (Jinjiu) | 192.168.1.104 | 80 | admin | admin | profile_1 |

修改默认配置请编辑 `ptz/manager.rs` 中的 `register_vendor_defaults()` 方法。

---

## ❓ 常见问题

### Q1: 扫描未发现任何设备？

**可能原因**:
1. 摄像机未通电或未连接网络
2. 防火墙阻止了扫描请求
3. IP地址段配置错误
4. 摄像机未启用ONVIF/RTSP服务

**解决方案**:
- 检查摄像机指示灯状态
- 临时关闭防火墙测试
- 点击"🔍 诊断网络接口"查看当前网络环境
- 在摄像机Web界面确认ONVIF服务已启用

### Q2: 注册设备时提示"Token失败"？

**原因**: 不同厂商使用的Profile Token不同

**解决方案**:
- 系统会自动尝试常见Token（profile_1, Profile_1, 000, MainStream）
- 如果都失败，请在摄像机Web界面查看正确的Token名称
- 手动注册时指定正确的Token

### Q3: 修改配置后设备无法连接？

**可能原因**:
1. IP地址或端口输入错误
2. 新配置的认证信息不正确
3. 网络连接问题

**解决方案**:
- 使用ping命令测试新IP是否可达
- 在浏览器中访问 `http://IP:端口` 确认Web界面可访问
- 检查用户名和密码是否正确
- 回滚到之前的配置

### Q4: 如何备份设备配置？

**方法一**: 导出JSON文件
1. 在设备列表右上角点击"导出"按钮
2. 保存JSON文件到安全位置

**方法二**: 记录关键信息
```json
{
  "address": "192.168.1.100",
  "port": 80,
  "name": "minrray_01",
  "username": "admin",
  "password": "your_password"
}
```

---

## 📝 API参考

### Rust后端命令

| 命令 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `scan_all_network_interfaces` | `timeoutSecs: u64` | `Vec<DiscoveredCamera>` | 扫描所有网络接口 |
| `discover_all_cameras` | `timeoutSecs: u64` | `ScanResult` | 综合发现（ONVIF+SSDP+端口扫描） |
| `scan_local_subnet` | `timeoutSecs: u64` | `Vec<DiscoveredCamera>` | 扫描本地子网 |
| `ptz_register_device` | `ip, username, password, name?` | `String` (deviceId) | 注册设备 |
| `update_camera_config` | `deviceId, name?, username?, password?, ip?, port?` | `String` | 更新配置 |
| `remove_camera_device` | `deviceId` | `String` | 删除设备 |
| `get_camera_details` | `deviceId` | `JSON` | 获取设备详情 |
| `ptz_list_devices` | - | `Vec<String>` | 列出所有设备ID |

### JavaScript服务层API

```javascript
// 导入
import { 
  updateCameraConfig,
  removeCameraDevice,
  getCameraDetails,
  listPtzDevices,
  registerOnvifDevice
} from '@/services/captureDeviceService'

// 使用示例见上文
```

---

## 🔗 相关文档

- [摄像机发现实现指南](./CAMERA_DISCOVERY_IMPLEMENTATION.md)
- [摄像机发现使用指南](./CAMERA_DISCOVERY_GUIDE.md)
- [网络摄像机测试指南](./NETWORK_CAMERA_TEST_GUIDE.md)
- [PTZ控制指南](./PTZ_CONTROL_GUIDE.md)

---

## 📞 技术支持

如遇到问题，请检查：
1. 控制台日志（F12开发者工具）
2. Rust后端日志（终端输出）
3. 网络连接状态
4. 摄像机Web界面是否正常访问

联系开发团队获取更多帮助。
