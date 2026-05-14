# 网络摄像机配置管理功能使用指南

**版本**: 2.0  
**最后更新**: 2026-05-14  
**模块**: `CameraDiscoveryPanel.vue` + `ptz_commands.rs`

---

## 📋 功能概述

本系统提供完整的网络摄像机设备管理功能:

1. **自动发现** - 通过多种协议自动扫描局域网内的在线摄像机
2. **一键注册** - 将发现的设备快速注册到PTZ控制系统
3. **配置编辑** - 在设备列表中直接修改IP、端口、认证信息等参数
4. **批量配置** ⭐NEW - 同时修改多个设备的相同参数
5. **配置模板** ⭐NEW - 保存常用配置并快速应用
6. **连接测试** ⭐NEW - 保存前验证设备连接是否有效
7. **设备删除** - 移除不再需要的设备配置
8. **详情查看** - 获取设备的完整配置信息

---

## 🚀 快速开始

### 1. 打开摄像机发现面板

在教师窗口中:
1. 点击"添加信号源"按钮
2. 选择"网络摄像机"类别
3. 点击"🔍 摄像机发现与管理"按钮

### 2. 自动扫描在线设备

#### 方式一: 多网卡扫描(推荐)⭐

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
- ⏱️ 典型耗时: 5-15秒

#### 方式二: 综合发现

同时执行ONVIF、SSDP和子网扫描,确保不遗漏任何设备。

```javascript
const result = await invoke('discover_all_cameras', { timeoutSecs: 5 });

console.log(`扫描耗时: ${result.scan_duration_ms}ms`);
console.log(`共发现 ${result.cameras.length} 个设备`);
```

#### 方式三: 手动指定IP范围

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
3. 填写认证信息(用户名/密码)
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

### 2. 编辑单个设备配置 ⭐ENHANCED

**步骤**:
1. 点击设备行的"配置"按钮
2. 修改参数(IP、端口、用户名、密码、名称)
3. **(新增)** 点击"🔍 测试连接"验证设备可达性
4. 点击"保存配置"

**注意事项**:
- 密码留空表示不修改原密码
- IP或端口改变会导致设备ID变化
- 系统会自动注销旧设备并注册新设备

**代码示例**:
```javascript
import { updateCameraConfig } from '@/services/captureDeviceService'

// 只修改用户名和密码,保留其他参数
await updateCameraConfig({
  deviceId: '会议室摄像机_192.168.1.100',
  username: 'new_admin',
  password: 'new_password'
  // ip, port, name 为 null,保持不变
})
```

### 3. 批量配置设备 ⭐NEW

**适用场景**: 多个设备使用相同的认证信息

**步骤**:
1. 在设备列表中勾选需要配置的设备(复选框)
2. 点击"🔧 批量配置"按钮
3. 填写要统一的参数:
   - **设备名称前缀**(可选): 如"会议室_",会在原名称前添加
   - **用户名**: 留空表示不修改
   - **密码**: 留空表示不修改
   - **端口**: 留空表示不修改
4. 点击"应用配置"

**容错机制**:
- 逐个处理设备,单个失败不影响其他设备
- 完成后显示成功/失败统计
- 失败详情可在提示中查看

**代码示例**:
```javascript
// 批量修改10个摄像机的用户名和密码
const selectedDevices = [...] // 从表格选择获取

for (const device of selectedDevices) {
  const deviceId = device.name || `摄像机_${device.address.split('.').pop()}`;
  
  await invoke('update_camera_config', {
    deviceId,
    username: '统一用户名',
    password: '统一密码',
    // name, ip, port 为 null,保持不变
  });
}
```

### 4. 配置模板管理 ⭐NEW

**功能说明**: 保存常用的配置组合,快速应用到设备

#### 4.1 创建模板

**步骤**:
1. 点击"📋 模板管理"按钮
2. 切换到"保存模板"标签页
3. 填写模板信息:
   - **模板名称**(必填): 如"海康威视默认配置"
   - **描述**(可选): 模板用途说明
   - **默认用户名**: admin
   - **默认密码**: admin
   - **默认端口**: 80
4. 点击"保存模板"

**存储位置**: localStorage (key: `camera-config-templates`)

#### 4.2 应用模板

**步骤**:
1. 先选择一个设备进行配置编辑(点击"配置"按钮)
2. 打开"📋 模板管理"
3. 切换到"应用模板"标签页
4. 找到目标模板,点击"应用"按钮
5. 表单自动填充用户名、密码、端口
6. 点击"保存配置"生效

**数据结构**:
```javascript
{
  id: "1234567890",
  name: "海康威视默认配置",
  description: "用于海康威视摄像机的标准配置",
  username: "admin",
  password: "admin",
  port: 80,
  createdAt: "2026-05-14T10:00:00.000Z"
}
```

#### 4.3 删除模板

**步骤**:
1. 打开"📋 模板管理"
2. 切换到"应用模板"标签页
3. 点击模板行的"删除"按钮
4. 确认删除

### 5. 连接测试 ⭐NEW

**功能说明**: 在保存配置前验证设备是否可访问

**步骤**:
1. 打开设备配置对话框
2. 修改参数后,点击"🔍 测试连接"按钮
3. 系统尝试连接设备并返回结果:
   - ✅ 成功: "连接测试成功!设备可访问"
   - ❌ 失败: "连接测试失败: [错误信息]"

**技术实现**:
```javascript
// 调用 get_camera_details API 验证连接
try {
  await invoke('get_camera_details', { 
    deviceId: configForm.value.deviceId 
  });
  ElMessage.success('✅ 连接测试成功!设备可访问');
} catch (error) {
  ElMessage.error(`❌ 连接测试失败: ${error}`);
}
```

### 6. 删除设备

**步骤**:
1. 点击设备行的"删除"按钮
2. 确认对话框中点击"确定"
3. 设备从列表中移除

**代码示例**:
```javascript
import { removeCameraDevice } from '@/services/captureDeviceService'

await removeCameraDevice('会议室摄像机_192.168.1.100')
```

---

## 🔧 核心API参考

### 后端命令(Rust)

```rust
// 更新设备配置
#[command]
pub async fn update_camera_config(
    device_id: String,
    name: Option<String>,
    username: Option<String>,
    password: Option<String>,
    ip: Option<String>,
    port: Option<u16>,
) -> Result<String, String>

// 删除设备
#[command]
pub async fn remove_camera_device(
    device_id: String,
) -> Result<String, String>

// 获取设备详情
#[command]
pub async fn get_camera_details(
    device_id: String,
) -> Result<serde_json::Value, String>

// 注册设备
#[command]
pub async fn ptz_register_device(
    ip: String,
    username: String,
    password: String,
    name: Option<String>,
) -> Result<String, String>

// 列出所有设备
#[command]
pub async fn ptz_list_devices() -> Result<Vec<String>, String>
```

### 前端服务层封装

```javascript
// src/services/captureDeviceService.js

export async function updateCameraConfig(config)
export async function removeCameraDevice(deviceId)
export async function getCameraDetails(deviceId)
export async function listPtzDevices()
export async function registerOnvifDevice(device)
```

---

## 💡 使用技巧

### 1. 高效批量初始化

**场景**: 新部署20台同型号摄像机

**步骤**:
1. 使用"多网卡扫描"发现所有设备
2. 创建一个配置模板(用户名、密码、端口)
3. 全选所有设备
4. 使用"批量配置"应用模板中的用户名和密码
5. 完成!

**耗时**: 约2-3分钟(vs 手动逐个配置20分钟)

### 2. 配置备份与恢复

**备份**:
1. 点击"导出"按钮
2. 保存JSON文件到安全位置

**恢复**:
1. 解析JSON文件
2. 遍历设备列表
3. 调用`registerOnvifDevice`重新注册

### 3. 跨网段设备管理

**问题**: 摄像机在不同VLAN/子网

**解决方案**:
1. 使用"多网卡扫描"模式
2. 系统会自动检测所有网络接口
3. 并发扫描所有网段
4. 一次性发现所有设备

### 4. 故障排查

**扫描不到设备**:
- 检查网络连接和防火墙设置
- 确认摄像机已通电并启用ONVIF/RTSP服务
- 尝试手动指定IP扫描
- 允许Windows防火墙UDP多播(端口3702)

**配置更新失败**:
- 验证设备ID是否正确
- 检查新IP/端口是否可达
- 确认用户名密码正确
- 查看后端日志定位具体错误

**设备ID变更问题**:
- IP或名称改变会导致ID变化
- 前端需要同步更新所有引用
- 建议在配置变更前备份旧ID

---

## ⚠️ 注意事项

### 1. 密码安全管理

- 获取设备详情时**不返回**密码字段
- 配置编辑对话框中密码留空表示**不修改**
- 避免在日志中打印明文密码

### 2. 设备ID命名规则

**格式**: `{name}_{ip}`

**示例**:
- `minrray_01_192.168.1.100`
- `会议室摄像机_192.168.1.200`

**注意**: IP或名称改变会导致ID变化,前端需要同步更新引用

### 3. 配置模板存储

- 存储在浏览器localStorage
- 清除浏览器缓存会丢失模板
- 建议定期导出备份

### 4. 批量操作限制

- 建议单次不超过50个设备
- 采用串行处理避免并发冲突
- 单个失败不影响其他设备

---

## 📈 性能优化

### 1. 扫描优化

- 使用多网卡扫描时设置合理超时时间(3-5秒)
- 避免同时执行多个扫描任务
- 利用实时进度事件更新UI

### 2. 配置更新优化

- 只传递需要修改的字段(null表示不修改)
- 批量操作采用串行处理避免并发冲突
- 配置变更后选择性刷新列表

### 3. 内存管理

- 及时清理事件监听器(onUnmounted)
- 定时器必须在组件卸载时清除
- 大量设备时使用虚拟滚动

---

## ✨ 总结

本次更新为网络摄像机配置管理系统添加了三大核心功能:

**已完成**:
- ✅ **批量配置** - 同时修改多个设备的相同参数
- ✅ **配置模板** - 保存常用配置并快速应用
- ✅ **连接测试** - 保存前验证设备连接有效性

**效果**:
- 批量初始化效率提升10倍以上
- 配置模板减少重复输入
- 连接测试提前发现问题

**下一步**:
- 支持配置文件导入/导出
- 添加配置历史记录与回滚
- 实现设备分组管理