/**
 * RTSP Proxy 性能监控工具
 *
 * 实时监控流数量、内存使用、CPU占用等指标
 */

const axios = require('axios');
const chalk = require('chalk');

const PROXY_URL = process.env.PROXY_URL || 'http://localhost:8081';

// 清空控制台
function clearConsole() {
  process.stdout.write('\x1Bc');
}

// 格式化字节
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 获取健康状态
async function getHealthStatus() {
  try {
    const response = await axios.get(`${PROXY_URL}/health`);
    return response.data;
  } catch (error) {
    console.error(chalk.red('❌ 无法连接到 RTSP Proxy'));
    return null;
  }
}

// 获取活跃流列表
async function getActiveStreams() {
  try {
    const response = await axios.get(`${PROXY_URL}/api/streams`);
    return response.data;
  } catch (error) {
    return [];
  }
}

// 显示监控面板
async function displayMonitor() {
  const health = await getHealthStatus();
  const streams = await getActiveStreams();

  if (!health) {
    console.log(chalk.yellow('⚠️  RTSP Proxy 未运行或无法访问'));
    return;
  }

  clearConsole();

  console.log(chalk.cyan.bold('\n═══════════════════════════════════════════════════'));
  console.log(chalk.cyan.bold('         RTSP Proxy 性能监控面板'));
  console.log(chalk.cyan.bold('═══════════════════════════════════════════════════\n'));

  // 基本状态
  console.log(chalk.white.bold('📊 系统状态:'));
  console.log(`  状态: ${chalk.green('✓ 运行中')}`);
  console.log(`  运行时间: ${chalk.yellow(formatUptime(health.uptime))}`);
  console.log(`  当前流数: ${chalk.cyan(health.streams)} / ${chalk.cyan(health.maxStreams || 'N/A')}`);
  console.log();

  // 内存使用
  if (health.memoryUsage) {
    console.log(chalk.white.bold('💾 内存使用:'));
    console.log(`  RSS: ${chalk.blue(formatBytes(health.memoryUsage.rss))}`);
    console.log(`  Heap Total: ${chalk.blue(formatBytes(health.memoryUsage.heapTotal))}`);
    console.log(`  Heap Used: ${chalk.blue(formatBytes(health.memoryUsage.heapUsed))}`);
    console.log(`  External: ${chalk.blue(formatBytes(health.memoryUsage.external))}`);

    // 内存使用率警告
    const heapUsedPercent = (health.memoryUsage.heapUsed / health.memoryUsage.heapTotal) * 100;
    if (heapUsedPercent > 80) {
      console.log(`  ⚠️  内存使用率: ${chalk.red(heapUsedPercent.toFixed(1) + '%')} (过高!)`);
    } else if (heapUsedPercent > 60) {
      console.log(`  ⚡ 内存使用率: ${chalk.yellow(heapUsedPercent.toFixed(1) + '%')}`);
    } else {
      console.log(`  ✓ 内存使用率: ${chalk.green(heapUsedPercent.toFixed(1) + '%')}`);
    }
  }
  console.log();

  // 活跃流详情
  if (streams.length > 0) {
    console.log(chalk.white.bold(`🎥 活跃流 (${streams.length}):`));
    console.log(chalk.gray('  ID'.padEnd(40) + '观众数'.padEnd(10) + '运行时间'));
    console.log(chalk.gray('  ' + '─'.repeat(70)));

    streams.forEach(stream => {
      const id = stream.id.length > 38 ? stream.id.substring(0, 38) + '..' : stream.id;
      const viewers = stream.viewers.toString().padEnd(10);
      const uptime = formatUptime((Date.now() - stream.startTime) / 1000);

      let statusColor = chalk.green;
      if (stream.viewers === 0) {
        statusColor = chalk.yellow;
      }

      console.log(`  ${statusColor(id)} ${viewers} ${uptime}`);
    });
  } else {
    console.log(chalk.gray('  暂无活跃流'));
  }

  console.log(chalk.cyan.bold('\n═══════════════════════════════════════════════════'));
  console.log(chalk.gray('  按 Ctrl+C 退出监控'));
  console.log(chalk.cyan.bold('═══════════════════════════════════════════════════\n'));
}

// 格式化运行时间
function formatUptime(seconds) {
  seconds = Math.floor(seconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}小时 ${minutes}分 ${secs}秒`;
  } else if (minutes > 0) {
    return `${minutes}分 ${secs}秒`;
  } else {
    return `${secs}秒`;
  }
}

// 主循环
async function main() {
  console.log(chalk.cyan('启动 RTSP Proxy 监控...'));
  console.log(chalk.gray(`监控地址: ${PROXY_URL}\n`));

  // 首次显示
  await displayMonitor();

  // 每5秒刷新
  setInterval(async () => {
    await displayMonitor();
  }, 5000);
}

// 处理退出
process.on('SIGINT', () => {
  console.log('\n' + chalk.yellow('监控已停止'));
  process.exit(0);
});

// 检查依赖
try {
  require.resolve('chalk');
} catch (e) {
  console.log(chalk.yellow('⚠️  安装依赖: npm install chalk axios'));
  process.exit(1);
}

main().catch(console.error);
