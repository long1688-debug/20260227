# 摄像机扫描功能改进 - 支持多网卡和跨网段

## 📋 问题描述

之前的摄像机扫描功能存在以下限制：

1. ❌ **固定使用 /24 子网** - 无法适应不同子网掩码的网络环境
2. ❌ **只扫描主网卡** - 多网卡环境下无法发现其他网段的设备
3. ❌ **不支持跨网段扫描** - 当摄像机在不同网段时无法自动发现

## ✅ 改进方案

### 1. 智能CIDR检测

**改进前：**

```rust
// 固定使用 /24
let subnet_hosts = generate_subnet_hosts(&local_ip, 24)?;
```

**改进后：**

```rust
// 🎯 从网络接口的netmask自动计算实际CIDR
let cidr = if let IpAddr::V4(mask) = netmask {
    let mask_octets = mask.octets();
    let mask_bits = u32::from_be_bytes(mask_octets);
    mask_bits.count_ones() as u8
} else {
    24 // 默认/24
};

// 使用实际CIDR生成主机列表
let subnet_hosts = generate_subnet_hosts(&iface.ip, iface.cidr)?;
```

**优势：**

- ✅ 支持 `/16`、`/20`、`/24`、`/28` 等各种子网
- ✅ 自动适配企业级网络配置
- ✅ 减少不必要的扫描（如 `/8` 网段不会扫描全部1600万个IP）

### 2. 多网卡支持

**改进前：**

```rust
// 只获取主网卡IP
let local_ip = get_local_ip()?;
scan_subnet(local_ip, 24);
```

**改进后：**

```rust
// 🎯 获取所有网络接口
let interfaces = get_all_network_interfaces();

// 扫描每个接口的子网
for iface in &interfaces {
    log::info!("扫描接口 {} ({}), 子网: {}/{}",
        iface.name, iface.ip, iface.ip, iface.cidr);

    let subnet_hosts = generate_subnet_hosts(&iface.ip, iface.cidr)?;
    scan_subnet(subnet_hosts);
}
```

**优势：**

- ✅ 同时扫描WiFi、有线网卡、虚拟网卡等
- ✅ 自动发现所有可达网段
- ✅ 适用于复杂网络拓扑

### 3. 跨网段扫描

**场景示例：**

```
电脑网卡1: 192.168.31.100/24  (WiFi)
电脑网卡2: 192.168.5.50/24    (有线)
摄像机:    192.168.5.165      (与有线网卡同网段)

改进前: 只能扫描 192.168.31.x，找不到摄像机 ❌
改进后: 同时扫描两个网段，成功找到摄像机 ✅
```

## 🔧 技术实现

### NetworkInterface 结构增强

```rust
#[derive(Debug, Clone)]
pub struct NetworkInterface {
    pub name: String,      // 网卡名称
    pub ip: String,        // IP地址
    pub subnet: String,    // 子网（如 192.168.1.0/24）
    pub cidr: u8,          // 🎯 新增：实际CIDR值
    pub is_primary: bool,  // 是否主网卡
}
```

### CIDR计算逻辑

```rust
// 从子网掩码计算CIDR
let netmask = iface.netmask;  // 如 255.255.255.0
let cidr = if let IpAddr::V4(mask) = netmask {
    let mask_octets = mask.octets();           // [255, 255, 255, 0]
    let mask_bits = u32::from_be_bytes(mask_octets);  // 0xFFFFFF00
    mask_bits.count_ones() as u8               // 24
} else {
    24  // 默认值
};
```

### 网络地址计算

```rust
// 计算网络地址（主机位清零）
let network_addr = if let IpAddr::V4(mask) = netmask {
    let ip_u32 = u32::from_be_bytes(octets);       // IP转u32
    let mask_u32 = u32::from_be_bytes(mask.octets()); // 掩码转u32
    let network_u32 = ip_u32 & mask_u32;           // 按位与
    let network_bytes = network_u32.to_be_bytes();  // u32转字节
    format!("{}.{}.{}.{}", ...)                     // 格式化
};
```

## 📊 性能对比

| 场景 | 改进前 | 改进后 |
|------|--------|--------|
| 单网卡 /24 | 扫描254个IP | 扫描254个IP（相同） |
| 单网卡 /16 | ❌ 只扫254个 | ✅ 扫65534个（完整） |
| 双网卡 /24 | ❌ 只扫一个网段 | ✅ 扫两个网段（508个） |
| 三网卡混合 | ❌ 遗漏2个网段 | ✅ 全部扫描 |

## 🎯 使用场景

### 场景1：家庭网络（/24）

```
路由器: 192.168.1.1/24
摄像机: 192.168.1.100

扫描范围: 192.168.1.1 - 192.168.1.254 (254个IP)
结果: ✅ 快速发现
```

### 场景2：企业网络（/16）

```
核心交换机: 10.10.0.1/16
摄像机: 10.10.50.100

扫描范围: 10.10.0.1 - 10.10.255.254 (65534个IP)
结果: ✅ 完整覆盖（但耗时较长）
```

### 场景3：多网卡环境

```
WiFi网卡: 192.168.31.100/24
有线网卡: 192.168.5.50/24
虚拟机网卡: 192.168.122.1/24

扫描范围:
  - 192.168.31.0/24 (254个)
  - 192.168.5.0/24 (254个)
  - 192.168.122.0/24 (254个)

结果: ✅ 三个网段全覆盖
```

## 🚀 后续优化建议

### 1. 并发控制

对于大网段（如 /16），可以：

- 分批扫描（每批100个IP）
- 限制并发数（避免资源耗尽）
- 添加进度回调

### 2. 智能过滤

- 跳过常见网关IP（.1, .254）
- 优先扫描常见摄像机IP段
- 缓存已扫描结果

### 3. 增量扫描

- 记录上次扫描时间
- 只扫描变化的IP范围
- 维护设备数据库

## 📝 测试建议

### 测试用例1：单网卡 /24

```bash
# 配置
IP: 192.168.1.100
Mask: 255.255.255.0 (/24)

# 预期
扫描 192.168.1.1-254
```

### 测试用例2：单网卡 /16

```bash
# 配置
IP: 10.10.50.100
Mask: 255.255.0.0 (/16)

# 预期
扫描 10.10.0.1-10.10.255.254
```

### 测试用例3：双网卡

```bash
# 配置
网卡1: 192.168.1.100/24
网卡2: 192.168.2.100/24

# 预期
扫描两个网段共508个IP
```

## ✅ 改进总结

| 改进项 | 状态 | 说明 |
|--------|------|------|
| 智能CIDR检测 | ✅ 完成 | 从netmask自动计算 |
| 多网卡支持 | ✅ 完成 | 扫描所有有效接口 |
| 跨网段扫描 | ✅ 完成 | 支持任意网段组合 |
| 进度反馈 | ✅ 完成 | 实时显示扫描进度 |
| 日志完善 | ✅ 完成 | 详细记录扫描过程 |

---

**修改文件：**

- `tauri-app/src-tauri/src/camera_discovery.rs`

**关键改动：**

1. `NetworkInterface` 结构添加 `cidr` 字段
2. `get_all_network_interfaces()` 计算实际CIDR
3. `scan_local_subnet()` 支持多网卡遍历
4. `scan_local_subnet_with_progress()` 支持多网卡+进度反馈
5. 新增 `get_network_interfaces()` 辅助函数
