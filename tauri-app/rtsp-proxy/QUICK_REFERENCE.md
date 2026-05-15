# RTSP Proxy 40路并发 - 速查卡

## 🎯 核心答案

**问：rtsp-proxy能抗住40路并发吗？**

**答：技术上可以，但不推荐。建议迁移到ZLMediaKit。**

---

## ⚡ 快速命令

```bash
# 启动服务（默认20路）
start-rtsp-proxy.bat

# 启动服务（40路）
set MAX_STREAMS=40
start-rtsp-proxy.bat

# 性能监控
npm run monitor

# 压力测试（40路，60秒）
set TEST_STREAMS=40
npm run test-concurrent

# 健康检查
curl http://localhost:8081/health

# 查看活跃流
curl http://localhost:8081/api/streams
```

---

## 📊 性能基准

| 并发数 | CPU | 内存 | 稳定性 | 建议 |
|--------|-----|------|--------|------|
| 10路 | 20-30% | 500-800MB | ✅ | 可用 |
| 20路 | 40-50% | 1-1.5GB | ✅ | 推荐上限 |
| 30路 | 55-70% | 1.5-2.5GB | ⚠️ | 需监控 |
| 40路 | 70-85% | 2-4GB | ⚠️ | 不推荐 |
| 50+路 | 85%+ | 4GB+ | ❌ | 禁止 |

---

## 🔧 配置参数

### 环境变量

```batch
REM 最大并发流数（默认20）
set MAX_STREAMS=40

REM Node.js内存限制（默认4GB）
set NODE_OPTIONS=--max-old-space-size=4096

REM HTTP端口（默认8081）
set PORT=8081
```

### FFmpeg优化参数（已内置）

```javascript
'-rtsp_transport tcp'        // TCP传输更稳定
'-timeout 5000000'           // 5秒超时
'-fflags +nobuffer'          // 禁用缓冲
'-flags +low_delay'          // 低延迟
'-analyzeduration 100000'    // 快速探测
'-probesize 50000'           // 小探测包
'-c copy'                    // 不转码
```

---

## ⚠️ 告警阈值

| 指标 | 警告 | 危险 | 处理 |
|------|------|------|------|
| 内存使用率 | >60% | >80% | 清理空闲流 |
| CPU占用 | >70% | >85% | 降低并发 |
| 启动失败率 | >5% | >10% | 检查网络 |
| 响应时间 | >3s | >5s | 优化参数 |

---

## 🐛 常见问题

### Q1: 达到并发限制

```json
{
  "error": "达到最大并发流数限制 (20)"
}
```

**解决：** `set MAX_STREAMS=40` 后重启

### Q2: 内存过高

**解决：**

1. 重启服务
2. 增加内存：`set NODE_OPTIONS=--max-old-space-size=8192`
3. 迁移到ZLMediaKit

### Q3: FFmpeg崩溃

**解决：**

1. 检查RTSP地址
2. 查看stderr日志
3. 降低并发数

### Q4: 启动缓慢

**已优化：** 探测时间降至0.1秒

---

## 🚀 迁移到ZLMediaKit

### 步骤1: 启动ZLMediaKit

```bash
docker run -d \
  -p 1935:1935 \
  -p 8080:8080 \
  -p 554:554 \
  zlmediakit/zlmediakit:master
```

### 步骤2: 修改前端调用

```javascript
// 之前
import { startRtspStream } from '@/utils/rtsp-proxy-api';

// 之后
import { proxyNetworkStream } from '@/services/streamProxyService';
const result = await proxyNetworkStream(rtspUrl, streamId, 'network_camera');
```

### 性能对比（40路）

| 指标 | rtsp-proxy | ZLMediaKit | 提升 |
|------|------------|------------|------|
| CPU | 60-80% | 15-25% | ↓70% |
| 内存 | 2-4GB | 300-500MB | ↓80% |
| 稳定性 | ⚠️ | ✅ | 显著提升 |

---

## 📁 文档索引

| 文档 | 说明 |
|------|------|
| [README_40_STREAMS.md](./README_40_STREAMS.md) | 快速开始指南 |
| [PERFORMANCE_ANALYSIS_40_STREAMS.md](./PERFORMANCE_ANALYSIS_40_STREAMS.md) | 详细性能分析 |
| [ARCHITECTURE_COMPARISON.md](./ARCHITECTURE_COMPARISON.md) | 架构对比 |
| [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) | 实施总结 |

---

## 📞 技术支持

### 收集诊断信息

```bash
# 1. 健康状态
curl http://localhost:8081/health

# 2. 活跃流
curl http://localhost:8081/api/streams

# 3. 系统资源
taskmgr  # 截图任务管理器

# 4. 日志
# 复制控制台输出
```

### 联系时提供

- 操作系统版本
- CPU/内存配置
- 并发流数量
- 错误日志
- 测试结果

---

## ✅ 检查清单

### 部署前

- [ ] 安装Node.js和FFmpeg
- [ ] 安装依赖：`npm install`
- [ ] 配置MAX_STREAMS
- [ ] 配置NODE_OPTIONS

### 运行中

- [ ] 启动监控：`npm run monitor`
- [ ] 定期检查健康状态
- [ ] 关注内存使用率
- [ ] 及时清理空闲流

### 维护

- [ ] 每周压力测试
- [ ] 更新依赖包
- [ ] 备份配置文件
- [ ] 记录性能数据

---

## 🎓 学习路径

1. **初学者**
   - 阅读 README_40_STREAMS.md
   - 启动服务并测试
   - 使用监控工具

2. **进阶**
   - 阅读 PERFORMANCE_ANALYSIS
   - 进行压力测试
   - 优化配置参数

3. **专家**
   - 阅读 ARCHITECTURE_COMPARISON
   - 迁移到ZLMediaKit
   - 实现分布式部署

---

**最后更新：** 2026-02-27
**版本：** 1.0.0
