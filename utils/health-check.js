#!/usr/bin/env node
/**
 * 实训教学系统 - 服务健康检查工具
 * 用法：node utils/health-check.js [--watch] [--json]
 */

const http = require('http');
const https = require('https');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
    services: {
        license: { name: '许可证服务器', url: 'http://localhost:8082/health', port: 8082, required: true },
        api: { name: 'API 服务器', url: 'http://localhost:8080/health', port: 8080, required: true },
        websocket: { name: 'WebSocket', url: null, port: 8081, required: true, checkPort: true },
        vite: { name: 'Vite 开发服务器', url: 'http://localhost:5173', port: 5173, required: false }
    },
    processes: ['node.exe'],
    timeout: 3000,
    logFile: path.join(__dirname, '..', 'logs', 'health-check.log')
};

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

function colorize(text, color) {
    return `${colors[color]}${text}${colors.reset}`;
}

// 日志函数
function log(level, message) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level}] ${message}\n`;

    // 写入文件
    try {
        const logDir = path.dirname(CONFIG.logFile);
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        fs.appendFileSync(CONFIG.logFile, logLine);
    } catch (e) { /* ignore */ }

    // 控制台输出
    const colored = {
        '✓': colorize('✓', 'green'),
        '✗': colorize('✗', 'red'),
        '⚠': colorize('⚠', 'yellow'),
        'ℹ': colorize('ℹ', 'cyan')
    }[level] || level;

    console.log(`${colored} ${message}`);
}

// HTTP 健康检查
function checkHttpHealth(url, timeout) {
    return new Promise((resolve) => {
        const start = Date.now();
        const protocol = url.startsWith('https') ? https : http;

        const req = protocol.get(url, { timeout }, (res) => {
            const duration = Date.now() - start;
            resolve({
                ok: res.statusCode >= 200 && res.statusCode < 300,
                status: res.statusCode,
                duration,
                message: `HTTP ${res.statusCode} (${duration}ms)`
            });
        });

        req.on('error', (err) => {
            resolve({
                ok: false,
                error: err.code || err.message,
                duration: Date.now() - start,
                message: err.code || err.message
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({
                ok: false,
                error: 'TIMEOUT',
                duration: timeout,
                message: `请求超时 (${timeout}ms)`
            });
        });
    });
}

// 端口检查
function checkPort(port) {
    return new Promise((resolve) => {
        try {
            if (process.platform === 'win32') {
                const result = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
                    stdio: ['pipe', 'pipe', 'ignore'],
                    timeout: 2000
                }).toString();
                resolve({
                    ok: result.trim().length > 0,
                    message: result.trim() ? `端口 ${port} 正在监听` : `端口 ${port} 未监听`
                });
            } else {
                const result = execSync(`lsof -i :${port} 2>/dev/null`, {
                    stdio: ['pipe', 'pipe', 'ignore'],
                    timeout: 2000
                }).toString();
                resolve({
                    ok: result.trim().length > 0,
                    message: result.trim() ? `端口 ${port} 正在监听` : `端口 ${port} 未监听`
                });
            }
        } catch (e) {
            resolve({ ok: false, message: `端口 ${port} 检查失败：${e.message}` });
        }
    });
}

// 进程检查
function checkProcesses() {
    const results = [];
    for (const proc of CONFIG.processes) {
        try {
            if (process.platform === 'win32') {
                const output = execSync(`tasklist /FI "IMAGENAME eq ${proc}" /FO CSV /NH`, {
                    stdio: ['pipe', 'pipe', 'ignore']
                }).toString();
                const running = output.trim().length > 0 && !output.includes('INFO:');
                results.push({
                    name: proc,
                    ok: running,
                    message: running ? `进程 ${proc} 正在运行` : `进程 ${proc} 未运行`
                });
            } else {
                const output = execSync(`pgrep -x ${proc.split('.')[0]} 2>/dev/null`, {
                    stdio: ['pipe', 'pipe', 'ignore']
                }).toString();
                const running = output.trim().length > 0;
                results.push({
                    name: proc,
                    ok: running,
                    message: running ? `进程 ${proc} 正在运行` : `进程 ${proc} 未运行`
                });
            }
        } catch (e) {
            results.push({ name: proc, ok: false, message: `检查失败：${e.message}` });
        }
    }
    return results;
}

// 主检查函数
async function runHealthCheck(jsonOutput = false) {
    console.log(colorize('\n🔍 实训教学系统 - 健康检查', 'cyan'));
    console.log(colorize('='.repeat(50), 'cyan'));
    console.log(`时间：${new Date().toLocaleString('zh-CN')}\n`);

    const results = {
        timestamp: new Date().toISOString(),
        services: {},
        processes: [],
        summary: { total: 0, passed: 0, failed: 0, warnings: 0 }
    };

    // 检查 HTTP 服务
    for (const [key, service] of Object.entries(CONFIG.services)) {
        results.summary.total++;
        let result;

        if (service.url) {
            result = await checkHttpHealth(service.url, CONFIG.timeout);
        } else if (service.checkPort) {
            result = await checkPort(service.port);
        } else {
            result = { ok: true, message: '跳过检查' };
        }

        const status = result.ok ? '✓' : (service.required ? '✗' : '⚠');
        const color = result.ok ? 'green' : (service.required ? 'red' : 'yellow');

        if (!result.ok && service.required) {
            results.summary.failed++;
            log('✗', `${service.name}: ${result.message}`);
        } else if (!result.ok) {
            results.summary.warnings++;
            log('⚠', `${service.name}: ${result.message} (可选)`);
        } else {
            results.summary.passed++;
            log('✓', `${service.name}: ${result.message}`);
        }

        results.services[key] = { ...result, name: service.name, required: service.required };
    }

    console.log();

    // 检查进程
    const procResults = checkProcesses();
    for (const proc of procResults) {
        const status = proc.ok ? '✓' : '⚠';
        const color = proc.ok ? 'green' : 'yellow';
        log(proc.ok ? '✓' : '⚠', proc.message);
        results.processes.push(proc);
    }

    // 总结
    console.log();
    console.log(colorize('='.repeat(50), 'cyan'));

    const { total, passed, failed, warnings } = results.summary;
    const allPassed = failed === 0;

    console.log(`\n📊 结果汇总：${passed}/${total} 通过`);
    if (warnings > 0) console.log(`   ⚠️  ${warnings} 个可选服务未启动`);
    if (failed > 0) console.log(`   ✗  ${failed} 个必需服务异常`);

    console.log(`\n${allPassed ? colorize('✅ 系统健康', 'green') : colorize('❌ 系统异常', 'red')}\n`);

    // JSON 输出
    if (jsonOutput) {
        results.summary.healthy = allPassed;
        console.log(JSON.stringify(results, null, 2));
    }

    return allPassed ? 0 : 1;
}

// CLI 入口
async function main() {
    const args = process.argv.slice(2);
    const jsonOutput = args.includes('--json') || args.includes('-j');
    const watchMode = args.includes('--watch') || args.includes('-w');

    if (watchMode) {
        console.log(colorize('🔄 监控模式：每 10 秒检查一次 (Ctrl+C 退出)', 'yellow'));
        setInterval(async () => {
            console.clear();
            await runHealthCheck(jsonOutput);
        }, 10000);
        await runHealthCheck(jsonOutput);
    } else {
        const exitCode = await runHealthCheck(jsonOutput);
        process.exit(exitCode);
    }
}

main().catch(err => {
    console.error(colorize('💥 健康检查执行失败:', 'red'), err.message);
    process.exit(2);
});
