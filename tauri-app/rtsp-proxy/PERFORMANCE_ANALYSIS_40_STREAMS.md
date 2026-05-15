# RTSP Proxy 40路并发性能分析与优化方案

## 📊 当前架构评估

### ❌ 现有问题（不支持40路并发）

1. **资源消耗过大**
   - 每路流 = 1个独立 FFmpeg 进程
   - 40路 = 40个 FFmpeg 进程 + 40个 Node.js 流处理
   - 预估内存占用：40 × 50-100MB = 2-4GB
   - CPU 占用：取决于视频编码，通常 60-80%

2. **Windows 平台限制**
   - Windows 对大量并发进程管理效率较低
   - 文件句柄限制可能导致崩溃
   - 网络套接字资源竞争

3. **稳定性风险**
   - 单个 FFmpeg 进程崩溃可能影响整体服务
   - 无自动重启机制
   - 无负载均衡

### ✅ 已实施的改进

1. **并发限制保护**
   - 默认最大20路并发（可配置）
   - 超出限制返回 429 错误
   - 健康检查包含内存使用监控

---

## 🚀 推荐方案对比

### 方案一：ZLMediaKit（强烈推荐）⭐⭐⭐⭐⭐

**优势：**

- C++ 编写，性能极高
- 单进程支持数百路并发
- 内置 RTSP/RTMP/HTTP-FLV/WebRTC 协议转换
- 零拷贝转发，CPU 占用极低
- 自动流复用（多客户端共享同一流）

**性能指标：**

- 40路并发：CPU < 20%，内存 < 500MB
- 延迟：< 500ms
- 稳定性：生产级验证

**已有集成：**
项目中已有 `stream_proxy.rs` 实现 ZLMediaKit 集成！

```rust
// src-tauri/src/stream_proxy.rs
pub async fn proxy_network_stream(...) {
    // 调用 ZLMediaKit addStreamProxy API
    let meta = add_stream_proxy(...).await?;
}
```

**迁移步骤：**

1. 部署 ZLMediaKit 服务（Docker 或本地）
2. 修改前端调用从 rtsp-proxy 切换到 Tauri Rust API
3. 逐步淘汰 Node.js rtsp-proxy

---

### 方案二：SRS (Simple Realtime Server) ⭐⭐⭐⭐

**优势：**

- 国产开源，中文文档完善
- 高性能，支持集群
- 支持 HTTP-FLV、HLS、WebRTC
- 社区活跃

**性能指标：**

- 40路并发：CPU < 25%，内存 < 600MB

**部署方式：**

```bash
docker run -d -p 1935:1935 -p 8080:8080 ossrs/srs:5
```

---

### 方案三：优化现有 rtsp-proxy（临时方案）⭐⭐

如果必须继续使用当前架构：

#### 优化点 1：FFmpeg 参数调优

```javascript
const command = ffmpeg(stream.url)
  .inputOptions([
    '-rtsp_transport tcp',
    '-timeout', '3000000',          // 降低超时到3秒
    '-fflags', '+nobuffer',
    '-flags', '+low_delay',
    '-analyzeduration', '50000',    // 进一步降低探测时间
    '-probesize', '32768',          // 减少探测包大小
  ])
  .outputOptions([
    '-c', 'copy',                   // 不转码，仅封装
    '-f', 'flv',
    '-flush_packets', '1',
    '-max_muxing_queue_size', '1024' // 增加队列大小
  ]);
```

#### 优化点 2：资源监控与自动清理

```javascript
// 添加资源监控
setInterval(() => {
  const memUsage = process.memoryUsage();
  const streamCount = STREAMS.size;

  console.log(`[Monitor] 流数: ${streamCount}, 内存: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);

  // 内存超过阈值时清理空闲流
  if (memUsage.heapUsed > 1.5 * 1024 * 1024 * 1024) { // 1.5GB
    cleanupIdleStreams();
  }
}, 30000);

function cleanupIdleStreams() {
  STREAMS.forEach((stream, id) => {
    if (stream.viewers === 0 && Date.now() - stream.startTime > 60000) {
      console.log(`[Cleanup] 清理空闲流: ${id}`);
      cleanupStream(id);
    }
  });
}
```

#### 优化点 3：进程池管理

```javascript
// 限制同时启动的 FFmpeg 数量
const STARTUP_QUEUE = [];
const MAX_STARTING = 5; // 最多同时启动5个流

async function startFFmpegWithQueue(stream, onData, onError) {
  return new Promise((resolve, reject) => {
    STARTUP_QUEUE.push({ stream, onData, onError, resolve, reject });
    processStartupQueue();
  });
}

function processStartupQueue() {
  const starting = Array.from(STREAMS.values()).filter(s => s.process && !s.hasReceivedData).length;

  while (STARTUP_QUEUE.length > 0 && starting < MAX_STARTING) {
    const { stream, onData, onError, resolve, reject } = STARTUP_QUEUE.shift();

    try {
      startFFmpeg(stream, onData, (err) => {
        onError(err);
        reject(err);
      });
      resolve();
    } catch (err) {
      reject(err);
    }
  }
}
```

#### 优化点 4：环境变量配置

创建 `.env` 文件：

```env
PORT=8081
MAX_STREAMS=20
NODE_OPTIONS=--max-old-space-size=4096
```

启动时加载：

```bash
node --max-old-space-size=4096 rtsp-proxy.js
```

---

## 📈 性能测试建议

### 测试脚本

```javascript
// test-concurrent-streams.js
const axios = require('axios');

const RTSP_URLS = [
  'rtsp://camera1/stream',
  'rtsp://camera2/stream',
  // ... 添加40个测试地址
];

async function testConcurrentStreams(count) {
  console.log(`开始测试 ${count} 路并发...`);
  const startTime = Date.now();

  const promises = RTSP_URLS.slice(0, count).map(async (url, index) => {
    try {
      const response = await axios.post('http://localhost:8081/api/start', {
        url,
        streamId: `test_${index}`
      });
      console.log(`✅ 流 ${index} 启动成功`);
      return response.data;
    } catch (error) {
      console.error(`❌ 流 ${index} 启动失败:`, error.message);
      return null;
    }
  });

  const results = await Promise.allSettled(promises);
  const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;

  console.log(`\n测试结果:`);
  console.log(`成功: ${successCount}/${count}`);
  console.log(`耗时: ${Date.now() - startTime}ms`);

  // 检查健康状态
  const health = await axios.get('http://localhost:8081/health');
  console.log(`内存使用:`, health.data.memoryUsage);
}

testConcurrentStreams(40);
```

---

## 🎯 最终建议

### 短期（1-2周）

1. **启用并发限制**（已完成）
2. **实施资源监控**
3. **优化 FFmpeg 参数**
4. **压力测试验证瓶颈**

### 中期（1个月）

1. **迁移到 ZLMediaKit**（项目已有基础）
2. **保留 rtsp-proxy 作为降级方案**
3. **实现双协议自动切换**

### 长期

1. **考虑分布式部署**
2. **引入 CDN 加速**
3. **实现智能负载均衡**

---

## 🔧 快速切换指南

### 从 rtsp-proxy 切换到 ZLMediaKit

1. **启动 ZLMediaKit**

```bash
docker run -d \
  -p 1935:1935 \
  -p 8080:8080 \
  -p 554:554 \
  -p 8000:8000/udp \
  zlmediakit/zlmediakit:master
```

1. **修改前端调用**

```javascript
// 之前：调用 Node.js rtsp-proxy
await fetch('http://localhost:8081/api/start', {
  method: 'POST',
  body: JSON.stringify({ url: rtspUrl })
});

// 之后：调用 Tauri Rust API
import { proxyNetworkStream } from '@/services/streamProxyService';
const result = await proxyNetworkStream(rtspUrl, streamId, 'network_camera');
```

1. **验证功能**

- 预览区域播放
- 拖拽到画布
- 云台控制
- 缩略图生成

---

## 📞 技术支持

如遇到性能问题，请收集以下信息：

1. `GET http://localhost:8081/health` 响应
2. 系统资源监控（任务管理器截图）
3. FFmpeg 进程数量
4. 错误日志
