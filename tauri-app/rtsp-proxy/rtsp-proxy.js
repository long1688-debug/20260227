/**
 * RTSP to HTTP-FLV Proxy Server
 *
 * 使用 fluent-ffmpeg 将 RTSP 流转换为 HTTP-FLV 流
 * 支持多路并发流
 */

const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const WebSocket = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 配置
const PORT = process.env.PORT || 8081;
const STREAMS = new Map(); // 存储活跃的流
const MAX_CONCURRENT_STREAMS = parseInt(process.env.MAX_STREAMS) || 20; // 🎯 最大并发流数限制

// CORS 中间件
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    streams: STREAMS.size,
    maxStreams: MAX_CONCURRENT_STREAMS,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage()
  });
});

// 获取所有活跃流
app.get('/api/streams', (req, res) => {
  const streams = Array.from(STREAMS.entries()).map(([id, stream]) => ({
    id,
    url: stream.url,
    startTime: stream.startTime,
    viewers: stream.viewers
  }));
  res.json(streams);
});

// 启动 RTSP 转 FLV 流
app.post('/api/start', express.json(), async (req, res) => {
  const { url, streamId } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }

  const id = streamId || uuidv4();

  // 检查是否已存在
  if (STREAMS.has(id)) {
    return res.json({
      success: true,
      streamId: id,
      flvUrl: `http://localhost:${PORT}/live/${id}.flv`,
      wsUrl: `ws://localhost:${PORT}/live/${id}`
    });
  }

  // 🎯 检查并发限制
  if (STREAMS.size >= MAX_CONCURRENT_STREAMS) {
    return res.status(429).json({
      error: `达到最大并发流数限制 (${MAX_CONCURRENT_STREAMS})`,
      currentStreams: STREAMS.size,
      maxStreams: MAX_CONCURRENT_STREAMS
    });
  }

  try {
    console.log(`[RTSP Proxy] 启动流: ${id} -> ${url}`);

    const stream = {
      id,
      url,
      startTime: Date.now(),
      viewers: 0,
      process: null,
      clients: [],
      flvHeader: null,  // 🎯 存储FLV头部信息
      metadata: null    // 🎯 存储onMetaData信息
    };

    STREAMS.set(id, stream);

    // 🎯 关键修复：立即启动FFmpeg进程，预先生成FLV流
    // 这样当flv.js访问时，FFmpeg已经在运行并且可以立即推送数据
    startFFmpeg(stream, (data) => {
      // 🎯 解析FLV头部和元数据
      if (!stream.flvHeader) {
        // FLV头部是前9字节
        if (data.length >= 9 && data[0] === 0x46 && data[1] === 0x4c && data[2] === 0x56) {
          stream.flvHeader = data.slice(0, 9);
          console.log(`[RTSP Proxy] ✅ FLV头部已解析: ${id}`);
        }
      }

      // 存储数据用于后续客户端连接
      stream.lastChunk = data;

      // 推送给已有的HTTP客户端
      stream.httpClients?.forEach(client => {
        if (!client.res.writableEnded) {
          client.res.write(data);
        }
      });

      // 推送给已有的WebSocket客户端
      stream.clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });
    }, (error) => {
      console.error(`[FFmpeg] 错误: ${id}`, error);
      // 通知所有客户端
      stream.httpClients?.forEach(client => {
        if (!client.res.writableEnded) {
          client.res.end();
        }
      });
      cleanupStream(id);
    });

    res.json({
      success: true,
      streamId: id,
      flvUrl: `http://localhost:${PORT}/live/${id}.flv`,
      wsUrl: `ws://localhost:${PORT}/live/${id}`
    });

  } catch (error) {
    console.error(`[RTSP Proxy] 启动失败:`, error);
    res.status(500).json({ error: error.message });
  }
});

// 停止流
app.post('/api/stop', express.json(), (req, res) => {
  const { streamId } = req.body;

  if (!streamId || !STREAMS.has(streamId)) {
    return res.status(404).json({ error: 'Stream not found' });
  }

  stopStream(streamId);
  res.json({ success: true });
});

// HTTP-FLV 流端点
app.get('/live/:streamId.flv', (req, res) => {
  const { streamId } = req.params;
  const stream = STREAMS.get(streamId);

  if (!stream) {
    return res.status(404).send('Stream not found');
  }

  console.log(`[HTTP-FLV] 新客户端连接: ${streamId}`);
  stream.viewers++;

  // 🎯 跟踪HTTP客户端
  if (!stream.httpClients) {
    stream.httpClients = [];
  }
  const clientInfo = { res, connectedAt: Date.now() };
  stream.httpClients.push(clientInfo);

  // 设置响应头
  res.writeHead(200, {
    'Content-Type': 'video/x-flv',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // 🎯 关键修复：如果FFmpeg已经在运行，立即发送FLV头部
  if (stream.flvHeader && stream.lastChunk) {
    console.log(`[HTTP-FLV] 发送预缓存的FLV头部: ${streamId}`);
    res.write(stream.flvHeader);
    // 发送最近的数据块
    if (stream.lastChunk.length > 9) {
      res.write(stream.lastChunk.slice(9));
    }
  }

  // 客户端断开时清理
  req.on('close', () => {
    console.log(`[HTTP-FLV] 客户端断开: ${streamId}`);
    stream.viewers--;
    // 从httpClients中移除
    stream.httpClients = stream.httpClients.filter(c => c.res !== res);

    if (stream.viewers <= 0) {
      setTimeout(() => {
        if (stream.viewers <= 0 && stream.httpClients.length === 0) {
          console.log(`[RTSP Proxy] 无观众，停止流: ${streamId}`);
          cleanupStream(streamId);
        }
      }, 30000); // 🎯 延长到30秒，给拖拽到画布留出时间
    }
  });
});

// WebSocket FLV 流端点
wss.on('connection', (ws, req) => {
  const streamId = req.url.replace('/live/', '').replace('.flv', '');
  const stream = STREAMS.get(streamId);

  if (!stream) {
    ws.close(1008, 'Stream not found');
    return;
  }

  console.log(`[WebSocket] 新客户端连接: ${streamId}`);
  stream.viewers++;
  stream.clients.push(ws);

  // 🎯 如果FFmpeg已经在运行，发送预缓存的数据
  if (stream.flvHeader && stream.lastChunk) {
    console.log(`[WebSocket] 发送预缓存的FLV头部: ${streamId}`);
    ws.send(stream.flvHeader);
    if (stream.lastChunk.length > 9) {
      ws.send(stream.lastChunk.slice(9));
    }
  }

  ws.on('close', () => {
    console.log(`[WebSocket] 客户端断开: ${streamId}`);
    stream.viewers--;
    stream.clients = stream.clients.filter(c => c !== ws);

    if (stream.viewers <= 0) {
      setTimeout(() => {
        if (stream.viewers <= 0 && stream.httpClients?.length === 0) {
          console.log(`[RTSP Proxy] 无观众，停止流: ${streamId}`);
          cleanupStream(streamId);
        }
      }, 30000); // 🎯 延长到30秒，给拖拽到画布留出时间
    }
  });
});

// 启动 FFmpeg 进程
function startFFmpeg(stream, onData, onError) {
  console.log(`[FFmpeg] 启动: ${stream.id}`);
  console.log(`[FFmpeg] RTSP地址: ${stream.url}`);

  // 🎯 修复：移除探测命令，直接使用主流程（避免并发问题）
  // 在Windows上，并发运行多个ffmpeg进程可能导致问题

  const command = ffmpeg(stream.url)
    .inputOptions([
      '-rtsp_transport tcp',          // 使用 TCP 传输（更稳定）
      '-timeout', '5000000',          // 超时 5 秒（微秒）
      '-fflags', '+nobuffer',         // 禁用缓冲，降低延迟
      '-flags', '+low_delay',         // 低延迟模式
      '-fflags', '+genpts',           // ← 新增：为每个包生成连续 PTS/DTS，防止首帧（时间戳=0）粘附导致的 MSE seek
      '-analyzeduration', '100000',   // 分析时长 0.1 秒（进一步降低探测等待）
      '-probesize', '50000',          // 探测包大小 50KB（减少首帧等待）
      '-gop', '3',                    // ← 每 3 帧一个 I 帧（~90ms GOP 延迟，极低延迟）
      '-max_delay', '500000',         // 最大延迟 0.5 秒
    ])
    .outputOptions([
      '-c', 'copy',                   // 复制编码（不转码）
      '-f', 'flv',                    // 输出 FLV 格式
      '-flvflags', 'no_duration_filesize',
      '-fflags', '+flush_packets',    // 立即刷新数据包
      '-flush_packets', '1'           // 每个包都刷新
    ])
    .on('start', (cmdline) => {
      console.log(`[FFmpeg] 命令: ${cmdline}`);
      console.log(`[FFmpeg] ✅ FFmpeg进程已启动: ${stream.id}`);
    })
    .on('error', (err) => {
      console.error(`[FFmpeg] ❌ 错误: ${stream.id}`, err.message);
      console.error(`[FFmpeg] ❌ 错误详情:`, err);
      onError(err);
    })
    .on('stderr', (stderrLine) => {
      // 🎯 输出FFmpeg的stderr日志，便于调试
      console.log(`[FFmpeg stderr] ${stream.id}: ${stderrLine}`);
    })
    .on('end', () => {
      console.log(`[FFmpeg] 结束: ${stream.id}`);
    });

  const stream_output = command.pipe();
  stream_output.on('data', (chunk) => {
    // 🎯 第一次接收到数据时记录日志
    if (!stream.hasReceivedData) {
      stream.hasReceivedData = true;
      console.log(`[FFmpeg] ✅ 首次接收到视频数据: ${stream.id}, 大小: ${chunk.length} bytes`);
    }
    onData(chunk);
  });
  stream_output.on('error', (err) => {
    console.error(`[FFmpeg Output] ❌ 输出错误: ${stream.id}`, err.message);
    onError(err);
  });

  stream.process = command;
}

// 停止流
function stopStream(streamId) {
  const stream = STREAMS.get(streamId);
  if (!stream) return;

  console.log(`[RTSP Proxy] 停止流: ${streamId}`);

  if (stream.process) {
    try {
      stream.process.kill('SIGTERM');
    } catch (e) {
      console.error(`停止 FFmpeg 失败:`, e);
    }
  }

  // 关闭所有 WebSocket 客户端
  stream.clients.forEach(ws => {
    try {
      ws.close();
    } catch (e) { }
  });

  STREAMS.delete(streamId);
}

// 清理流
function cleanupStream(streamId) {
  stopStream(streamId);
}

// 启动服务器
// 🎯 关键修复：明确监听 127.0.0.1 而非 localhost，避免 IPv6/IPv4 解析冲突
server.listen(PORT, '127.0.0.1', () => {
  console.log('========================================');
  console.log('  RTSP to HTTP-FLV Proxy Server');
  console.log('========================================');
  console.log(`HTTP 端口: ${PORT}`);
  console.log(`监听地址: 127.0.0.1:${PORT}`);
  console.log(`HTTP-FLV URL: http://127.0.0.1:${PORT}/live/{streamId}.flv`);
  console.log(`WebSocket URL: ws://127.0.0.1:${PORT}/live/{streamId}`);
  console.log(`API: http://127.0.0.1:${PORT}/api/streams`);
  console.log('========================================');
});

// 🎯 生成视频缩略图
const fs = require('fs');
const path = require('path');

// 缩略图缓存目录
const THUMBNAIL_DIR = path.join(__dirname, 'thumbnails');
if (!fs.existsSync(THUMBNAIL_DIR)) {
  fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });
}

// 缩略图缓存 { streamId: { thumbnail: base64, timestamp: Date } }
const THUMBNAIL_CACHE = new Map();

app.get('/api/thumbnail/:streamId', async (req, res) => {
  const { streamId } = req.params;
  const stream = STREAMS.get(streamId);

  if (!stream) {
    return res.status(404).json({ error: 'Stream not found' });
  }

  try {
    // 检查缓存（5秒内不重复生成）
    const cached = THUMBNAIL_CACHE.get(streamId);
    if (cached && (Date.now() - cached.timestamp) < 5000) {
      console.log(`[Thumbnail] 使用缓存: ${streamId}`);
      return res.json({
        success: true,
        thumbnail: cached.thumbnail,
        cached: true
      });
    }

    console.log(`[Thumbnail] 生成缩略图: ${streamId}`);

    // 🎯 防御性检查：ONVIF 服务地址（/onvif/ 路径）不是真实视频流地址
    // ffmpeg 无法从中截取帧，直接返回提示而非崩溃
    if (/https?:\/\/[^/]+\/onvif\//i.test(stream.url)) {
      console.warn(`[Thumbnail] 流地址是 ONVIF 服务端点而非视频流地址，跳过: ${stream.url}`);
      return res.status(400).json({
        success: false,
        error: 'ONVIF服务端点非视频流地址，请先通过GetStreamUri获取RTSP地址后再绑定缩略图'
      });
    }

    // 使用 FFmpeg 截取一帧
    const thumbnailPath = path.join(THUMBNAIL_DIR, `${streamId}.jpg`);

    await new Promise((resolve, reject) => {
      ffmpeg(stream.url)
        .inputOptions([
          '-rtsp_transport tcp',
          '-timeout 5000000'
        ])
        .screenshots({
          timestamps: [0],  // 截取第一帧
          filename: `${streamId}.jpg`,
          folder: THUMBNAIL_DIR,
          size: '320x180'  // 缩略图尺寸
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // 读取图片并转换为 base64
    const imageBuffer = fs.readFileSync(thumbnailPath);
    const base64Image = imageBuffer.toString('base64');
    const dataUri = `data:image/jpeg;base64,${base64Image}`;

    // 更新缓存
    THUMBNAIL_CACHE.set(streamId, {
      thumbnail: dataUri,
      timestamp: Date.now()
    });

    console.log(`[Thumbnail] ✅ 缩略图生成成功: ${streamId}`);

    res.json({
      success: true,
      thumbnail: dataUri,
      cached: false
    });

  } catch (error) {
    console.error(`[Thumbnail] ❌ 生成失败: ${streamId}`, error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取所有缩略图
app.get('/api/thumbnails', (req, res) => {
  const thumbnails = {};
  THUMBNAIL_CACHE.forEach((value, key) => {
    thumbnails[key] = value.thumbnail;
  });

  res.json({
    success: true,
    thumbnails
  });
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('\n正在关闭服务器...');
  STREAMS.forEach((_, id) => stopStream(id));
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  STREAMS.forEach((_, id) => stopStream(id));
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});
