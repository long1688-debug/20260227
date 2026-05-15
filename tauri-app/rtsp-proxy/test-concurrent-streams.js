/**
 * RTSP Proxy 并发压力测试工具
 *
 * 测试多路视频流并发性能
 */

const axios = require('axios');
const chalk = require('chalk');

const PROXY_URL = process.env.PROXY_URL || 'http://localhost:8081';

// 测试配置
const TEST_CONFIG = {
  concurrentStreams: parseInt(process.env.TEST_STREAMS) || 40, // 测试并发数
  testDuration: parseInt(process.env.TEST_DURATION) || 60, // 测试持续时间（秒）
  rtspUrls: [
    // 🎯 替换为实际的 RTSP 地址
    'rtsp://admin:password@192.168.1.100:554/stream1',
    'rtsp://admin:password@192.168.1.101:554/stream1',
    'rtsp://admin:password@192.168.1.102:554/stream1',
    // ... 添加更多测试地址
  ]
};

// 测试结果统计
const stats = {
  started: 0,
  success: 0,
  failed: 0,
  stopped: 0,
  errors: []
};

// 生成测试 RTSP 地址（如果没有提供真实地址）
function generateTestUrls(count) {
  const urls = [];
  for (let i = 0; i < count; i++) {
    // 使用测试流地址（可以替换为实际地址）
    urls.push(`rtsp://test-stream-${i}.example.com/live`);
  }
  return urls;
}

// 启动单个流
async function startStream(url, streamId) {
  try {
    const response = await axios.post(`${PROXY_URL}/api/start`, {
      url,
      streamId
    });

    stats.started++;
    stats.success++;

    console.log(chalk.green(`✅ [${streamId}] 启动成功`));
    return response.data;
  } catch (error) {
    stats.failed++;
    stats.errors.push({
      streamId,
      error: error.message,
      status: error.response?.status
    });

    console.log(chalk.red(`❌ [${streamId}] 启动失败: ${error.message}`));
    return null;
  }
}

// 停止单个流
async function stopStream(streamId) {
  try {
    await axios.post(`${PROXY_URL}/api/stop`, {
      streamId
    });

    stats.stopped++;
    console.log(chalk.yellow(`⏹️  [${streamId}] 已停止`));
  } catch (error) {
    console.log(chalk.red(`❌ [${streamId}] 停止失败: ${error.message}`));
  }
}

// 获取健康状态
async function getHealthStatus() {
  try {
    const response = await axios.get(`${PROXY_URL}/health`);
    return response.data;
  } catch (error) {
    return null;
  }
}

// 显示测试结果
function displayResults(startTime) {
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(chalk.cyan.bold('\n═══════════════════════════════════════════════════'));
  console.log(chalk.cyan.bold('         并发测试结果'));
  console.log(chalk.cyan.bold('═══════════════════════════════════════════════════\n'));

  console.log(chalk.white.bold('📊 测试统计:'));
  console.log(`  测试时长: ${chalk.yellow(duration + '秒')}`);
  console.log(`  目标并发: ${chalk.cyan(TEST_CONFIG.concurrentStreams)}`);
  console.log(`  成功启动: ${chalk.green(stats.success)}`);
  console.log(`  启动失败: ${chalk.red(stats.failed)}`);
  console.log(`  已停止: ${chalk.yellow(stats.stopped)}`);
  console.log();

  // 成功率
  const successRate = stats.started > 0 ? (stats.success / stats.started * 100).toFixed(1) : 0;
  console.log(chalk.white.bold('📈 性能指标:'));
  console.log(`  成功率: ${successRate >= 90 ? chalk.green(successRate + '%') : chalk.red(successRate + '%')}`);
  console.log(`  平均启动时间: ${chalk.blue((parseFloat(duration) / stats.started).toFixed(2) + '秒/流')}`);
  console.log();

  // 错误详情
  if (stats.errors.length > 0) {
    console.log(chalk.white.bold('⚠️  错误详情:'));
    stats.errors.slice(0, 10).forEach(err => {
      console.log(`  [${err.streamId}] ${err.error} (${err.status || 'N/A'})`);
    });
    if (stats.errors.length > 10) {
      console.log(`  ... 还有 ${stats.errors.length - 10} 个错误`);
    }
    console.log();
  }

  console.log(chalk.cyan.bold('═══════════════════════════════════════════════════\n'));
}

// 主测试流程
async function runTest() {
  console.log(chalk.cyan.bold('\n🚀 RTSP Proxy 并发压力测试\n'));
  console.log(chalk.white(`测试配置:`));
  console.log(`  并发流数: ${TEST_CONFIG.concurrentStreams}`);
  console.log(`  测试时长: ${TEST_CONFIG.testDuration}秒`);
  console.log(`  代理地址: ${PROXY_URL}\n`);

  // 检查代理服务是否运行
  try {
    const health = await getHealthStatus();
    if (!health) {
      console.log(chalk.red('❌ RTSP Proxy 未运行，请先启动服务'));
      process.exit(1);
    }
    console.log(chalk.green('✓ RTSP Proxy 运行中\n'));
  } catch (error) {
    console.log(chalk.red('❌ 无法连接到 RTSP Proxy'));
    process.exit(1);
  }

  const startTime = Date.now();

  // 准备测试 URL
  const testUrls = TEST_CONFIG.rtspUrls.length > 0
    ? TEST_CONFIG.rtspUrls
    : generateTestUrls(TEST_CONFIG.concurrentStreams);

  // 如果 URL 数量不足，循环使用
  while (testUrls.length < TEST_CONFIG.concurrentStreams) {
    testUrls.push(...testUrls);
  }

  console.log(chalk.yellow(`开始启动 ${TEST_CONFIG.concurrentStreams} 路并发流...\n`));

  // 分批启动（避免瞬间压力过大）
  const batchSize = 5; // 每批启动5个
  const startedStreams = [];

  for (let i = 0; i < TEST_CONFIG.concurrentStreams; i += batchSize) {
    const batch = testUrls.slice(i, i + batchSize);
    const promises = batch.map(async (url, index) => {
      const streamId = `test_stream_${i + index}`;
      const result = await startStream(url, streamId);
      if (result) {
        startedStreams.push(streamId);
      }
    });

    await Promise.all(promises);

    // 批次间延迟
    if (i + batchSize < TEST_CONFIG.concurrentStreams) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(chalk.green(`\n✓ 所有流启动完成，保持运行 ${TEST_CONFIG.testDuration} 秒...\n`));

  // 监控期间定期检查健康状态
  const monitorInterval = setInterval(async () => {
    const health = await getHealthStatus();
    if (health) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const remaining = Math.max(0, TEST_CONFIG.testDuration - elapsed);

      process.stdout.write(chalk.cyan(`\r⏱️  运行中... ${elapsed}/${TEST_CONFIG.testDuration}秒 | 活跃流: ${health.streams} | 内存: ${(health.memoryUsage?.heapUsed / 1024 / 1024).toFixed(0)}MB`));

      if (remaining <= 0) {
        clearInterval(monitorInterval);
      }
    }
  }, 1000);

  // 等待测试结束
  await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.testDuration * 1000));

  console.log(chalk.yellow('\n\n⏹️  测试结束，正在清理...\n'));

  // 停止所有测试流
  const stopPromises = startedStreams.map(streamId => stopStream(streamId));
  await Promise.all(stopPromises);

  // 显示最终结果
  displayResults(startTime);

  // 最终健康检查
  const finalHealth = await getHealthStatus();
  if (finalHealth) {
    console.log(chalk.white('最终状态:'));
    console.log(`  剩余流数: ${finalHealth.streams}`);
    console.log(`  内存使用: ${(finalHealth.memoryUsage?.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  }
}

// 处理退出
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n\n⚠️  测试中断，正在清理...'));

  // 清理所有测试流
  const streams = await axios.get(`${PROXY_URL}/api/streams`).catch(() => ({ data: [] }));
  const testStreams = streams.data.filter(s => s.id.startsWith('test_stream_'));

  const stopPromises = testStreams.map(s => stopStream(s.id));
  await Promise.all(stopPromises);

  console.log(chalk.yellow('清理完成'));
  process.exit(0);
});

// 检查依赖
try {
  require.resolve('chalk');
  require.resolve('axios');
} catch (e) {
  console.log(chalk.yellow('⚠️  安装依赖: npm install chalk axios'));
  process.exit(1);
}

// 运行测试
runTest().catch(error => {
  console.error(chalk.red('测试失败:'), error);
  process.exit(1);
});
