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

// 🎯 关键修复：正确编码RTSP URL中的特殊字符
// RTSP URL格式: rtsp://username:password@host:port/path
function encodeRtspUrl(url) {
  try {
    const rtspRegex = /^rtsp:\/\/([^:]+):([^@]+)@([^:/]+)(?::(\d+))?(.*)$/;
    const match = url.match(rtspRegex);

    if (match) {
      const [, username, password, host, port, path] = match;
      // 对用户名和密码进行URL编码
      const encodedUsername = encodeURIComponent(username);
      const encodedPassword = encodeURIComponent(password);
      const portPart = port ? `:${port}` : '';
      const pathPart = path || '/';
      return `rtsp://${encodedUsername}:${encodedPassword}@${host}${portPart}${pathPart}`;
    }

    // 如果不匹配RTSP URL格式，直接返回原URL
    return url;
  } catch (e) {
    console.error(`[RTSP Proxy] URL编码失败:`, e.message);
    return url;
  }
}

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
  // 统计各状态的流数量
  let startingCount = 0;
  let readyCount = 0;
  let errorCount = 0;

  STREAMS.forEach((stream) => {
    switch (stream.status) {
      case 'starting': startingCount++; break;
      case 'ready': readyCount++; break;
      case 'error': errorCount++; break;
    }
  });

  res.json({
    status: 'ok',
    streams: STREAMS.size,
    streamsByStatus: {
      starting: startingCount,
      ready: readyCount,
      error: errorCount
    },
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
    viewers: stream.viewers,
    status: stream.status,
    hasReceivedData: !!stream.hasReceivedData,
    lastError: stream.lastError
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
    const existingStream = STREAMS.get(id);

    // 如果流处于错误状态，重新启动
    if (existingStream.status === 'error') {
      console.log(`[RTSP Proxy] 流 ${id} 处于错误状态，重新启动...`);
      cleanupStream(id);
    } else {
      // 流已存在且正常运行
      return res.json({
        success: true,
        streamId: id,
        flvUrl: `http://127.0.0.1:${PORT}/live/${id}.flv`,
        wsUrl: `ws://127.0.0.1:${PORT}/live/${id}`,
        status: existingStream.status
      });
    }
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

    // 🎯 关键修复：正确处理RTSP URL中的特殊字符
    // 如果用户名或密码包含特殊字符（如@、:、/等），需要进行URL编码
    const encodedUrl = encodeRtspUrl(url);
    console.log(`[RTSP Proxy] 编码后的RTSP URL: ${encodedUrl}`);

    const stream = {
      id,
      url: encodedUrl,  // 使用编码后的URL
      originalUrl: url, // 保存原始URL用于调试
      startTime: Date.now(),
      viewers: 0,
      process: null,
      clients: [],
      httpClients: [],   // 🎯 显式初始化HTTP客户端列表
      flvHeader: null,   // 🎯 存储FLV头部信息
      metadata: null,    // 🎯 存储onMetaData信息
      status: 'starting',// 🎯 流状态: starting, ready, error
      lastError: null    // 🎯 记录最后错误信息
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
          try {
            client.res.write(data);
            // 🎯 每推送10次数据强制刷新一次，确保数据及时发送
            client.pushCount = (client.pushCount || 0) + 1;
            if (client.pushCount % 10 === 0) {
              client.res.flush?.();
            }
          } catch (e) {
            console.error(`[HTTP-FLV] 推送数据失败: ${streamId}`, e.message);
          }
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
      flvUrl: `http://127.0.0.1:${PORT}/live/${id}.flv`,
      wsUrl: `ws://127.0.0.1:${PORT}/live/${id}`,
      status: 'starting'
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
    console.error(`[HTTP-FLV] ❌ 流不存在: ${streamId}`);
    return res.status(404).json({ error: 'Stream not found', streamId });
  }

  // 🎯 关键修复：检查流状态
  if (stream.status === 'error') {
    console.error(`[HTTP-FLV] ❌ 流状态错误: ${streamId}, 错误: ${stream.lastError}`);
    return res.status(503).json({
      error: 'Stream error',
      streamId,
      message: stream.lastError || 'Unknown error'
    });
  }

  console.log(`[HTTP-FLV] 新客户端连接: ${streamId}, 状态: ${stream.status}`);
  stream.viewers++;

  const clientInfo = { res, connectedAt: Date.now() };
  stream.httpClients.push(clientInfo);

  // 🎯 关键修复：禁用TCP延迟，强制立即发送数据（降低直播延迟）
  res.socket.setNoDelay(true);

  // 设置响应头
  res.writeHead(200, {
    'Content-Type': 'video/x-flv',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    // 🎯 禁用缓存，确保实时流传输
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no'  // 禁用nginx等代理的缓冲
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
    console.error(`[WebSocket] ❌ 流不存在: ${streamId}`);
    ws.close(1008, 'Stream not found');
    return;
  }

  // 🎯 关键修复：检查流状态
  if (stream.status === 'error') {
    console.error(`[WebSocket] ❌ 流状态错误: ${streamId}, 错误: ${stream.lastError}`);
    ws.close(1011, `Stream error: ${stream.lastError || 'Unknown error'}`);
    return;
  }

  console.log(`[WebSocket] 新客户端连接: ${streamId}, 状态: ${stream.status}`);
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

  // 🎯 关键修复：移除强制 TCP 限制，让 FFmpeg 自动协商传输协议
  // 某些摄像机不支持 TCP 模式，会导致连接失败
  const command = ffmpeg(stream.url)
    .inputOptions([
      // 🎯 移除 -rtsp_transport tcp，让 FFmpeg 自动选择 TCP/UDP
      '-timeout', '10000000',         // 超时 10 秒（微秒），给摄像机更多响应时间

      // 🎯 低延迟优化参数（输入端）
      '-fflags', '+nobuffer+flush_packets',  // 禁用缓冲，立即刷新数据包
      '-flags', '+low_delay',                // 启用低延迟模式
      '-analyzeduration', '500000',          // 500ms探测时间，足够检测流格式（过小会导致转码失败）
      '-probesize', '32768',                 // 32KB探测大小，足够获取编解码信息（过小会导致格式识别失败）
      // ⚠️ 注意：-tune zerolatency 只能用于输出端，不能放在输入选项中
    ])
    .outputOptions([
      // 🎯 关键修复：强制转码为 H.264 + AAC，确保浏览器兼容
      '-c:v', 'libx264',              // 视频编码：H.264
      '-preset', 'ultrafast',         // 最快编码速度（降低延迟）
      '-tune', 'zerolatency',         // 零延迟调优
      '-c:a', 'aac',                  // 音频编码：AAC
      '-b:a', '128k',                 // 音频比特率
      '-f', 'flv',                    // 输出 FLV 格式
      '-flvflags', 'no_duration_filesize',  // 不写入duration和filesize，适合直播
      '-fflags', '+flush_packets',    // 立即刷新输出包
      '-flush_packets', '1'           // 每个包都刷新
    ])
    .on('start', (cmdline) => {
      console.log(`[FFmpeg] 命令: ${cmdline}`);
      console.log(`[FFmpeg] ✅ FFmpeg进程已启动: ${stream.id}`);
      stream.status = 'starting';
    })
    .on('error', (err) => {
      console.error(`[FFmpeg] ❌ 错误: ${stream.id}`, err.message);
      console.error(`[FFmpeg] ❌ 错误详情:`, err);
      stream.status = 'error';
      stream.lastError = err.message;
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
    // 🎯 第一次接收到数据时记录日志并设置状态为就绪
    if (!stream.hasReceivedData) {
      stream.hasReceivedData = true;
      stream.status = 'ready';
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
          // 🎯 移除强制 TCP，让 FFmpeg 自动协商
          '-timeout', '5000000',
          '-analyzeduration', '0',
          '-probesize', '32'
        ])
        .outputOptions([
          '-vframes', '1',           // 只截取1帧
          '-vf', 'scale=320:180',    // 缩略图尺寸
          '-q:v', '2',               // JPEG质量（2=高质量）
          '-update', '1'             // 覆盖已有文件
        ])
        .output(thumbnailPath)
        .on('start', (cmdline) => {
          console.log(`[Thumbnail] FFmpeg命令: ${cmdline}`);
        })
        .on('end', () => {
          console.log(`[Thumbnail] ✅ 缩略图生成成功: ${streamId}`);
          resolve();
        })
        .on('error', (err) => {
          console.error(`[Thumbnail] ❌ FFmpeg错误: ${streamId}`, err.message);
          reject(err);
        });
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
