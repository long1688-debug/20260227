/**
 * 系统状态监控模块
 * 用于监控服务端各项服务的运行状态
 */

const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class ServerMonitor {
    constructor() {
        this.services = {
            cppServer: { name: 'C++ 服务端', status: 'offline', port: null, lastCheck: null },
            nodeServer: { name: 'Node.js 后端', status: 'offline', port: null, lastCheck: null },
            websocket: { name: 'WebSocket 服务', status: 'offline', port: null, lastCheck: null },
            videoService: { name: '视频服务', status: 'offline', port: null, lastCheck: null },
            audioService: { name: '音频服务', status: 'offline', port: null, lastCheck: null },
            subtitleService: { name: '字幕服务', status: 'offline', port: null, lastCheck: null },
            recordingService: { name: '录制服务', status: 'offline', port: null, lastCheck: null }
        };

        this.systemMetrics = {
            cpu: 0,
            memory: 0,
            disk: 0,
            network: { in: 0, out: 0 },
            uptime: 0,
            timestamp: null
        };

        this.logs = [];
        this.maxLogs = 1000;
        this.logLevels = ['info', 'success', 'warning', 'error'];
    }

    /**
     * 获取系统资源使用情况
     */
    async getSystemMetrics() {
        try {
            const cpus = os.cpus();
            const cpuInfo = cpus[0];
            const totalCpu = Object.values(cpuInfo.times).reduce((a, b) => a + b, 0);
            const idleCpu = cpuInfo.times.idle;
            const cpuUsage = ((1 - idleCpu / totalCpu) * 100).toFixed(2);

            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const memUsage = ((totalMem - freeMem) / totalMem * 100).toFixed(2);

            const diskUsage = await this.getDiskUsage();

            this.systemMetrics = {
                cpu: parseFloat(cpuUsage),
                memory: parseFloat(memUsage),
                disk: diskUsage,
                network: await this.getNetworkStats(),
                uptime: os.uptime(),
                timestamp: new Date().toISOString()
            };

            return this.systemMetrics;
        } catch (error) {
            this.log('error', '获取系统指标失败', error.message);
            return this.systemMetrics;
        }
    }

    /**
     * 获取磁盘使用情况
     */
    async getDiskUsage() {
        try {
            if (process.platform === 'win32') {
                const { stdout } = await execPromise('wmic logicaldisk get size,freespace,caption');
                const lines = stdout.split('\n').filter(line => line.trim());
                if (lines.length > 1) {
                    const values = lines[1].trim().split(/\s+/);
                    const freeSpace = parseFloat(values[1]);
                    const totalSpace = parseFloat(values[2]);
                    return ((totalSpace - freeSpace) / totalSpace * 100).toFixed(2);
                }
            } else {
                const { stdout } = await execPromise('df -h /');
                const lines = stdout.split('\n');
                if (lines.length > 1) {
                    const values = lines[1].split(/\s+/);
                    const used = values[2].replace('%', '');
                    return parseFloat(used);
                }
            }
            return 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * 获取网络统计信息
     */
    async getNetworkStats() {
        const networkInterfaces = os.networkInterfaces();
        let inBytes = 0;
        let outBytes = 0;

        Object.keys(networkInterfaces).forEach(iface => {
            networkInterfaces[iface].forEach(net => {
                if (net.family === 'IPv4' && !net.internal) {
                    inBytes += (net.rx_bytes || 0);
                    outBytes += (net.tx_bytes || 0);
                }
            });
        });

        return {
            in: inBytes,
            out: outBytes
        };
    }

    /**
     * 更新服务状态
     */
    updateService(serviceName, status, port = null) {
        if (this.services[serviceName]) {
            this.services[serviceName].status = status;
            this.services[serviceName].port = port;
            this.services[serviceName].lastCheck = new Date().toISOString();

            this.log(
                status === 'online' ? 'success' : 'error',
                `服务状态更新`,
                `${this.services[serviceName].name} 状态: ${status}${port ? ` (端口: ${port})` : ''}`
            );
        }
    }

    /**
     * 检查端口是否被占用
     */
    async checkPort(port) {
        try {
            const { stdout } = await execPromise(`netstat -ano | findstr :${port}`);
            return stdout.trim().length > 0;
        } catch (error) {
            return false;
        }
    }

    /**
     * 获取所有服务状态
     */
    getAllServices() {
        return Object.keys(this.services).map(key => ({
            id: key,
            ...this.services[key]
        }));
    }

    /**
     * 获取在线服务数量
     */
    getOnlineServicesCount() {
        return Object.values(this.services).filter(s => s.status === 'online').length;
    }

    /**
     * 获取总服务数量
     */
    getTotalServicesCount() {
        return Object.keys(this.services).length;
    }

    /**
     * 添加日志
     */
    log(level, category, message) {
        const logEntry = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
            timestamp: new Date().toISOString(),
            level: level,
            category: category || '系统',
            message: message
        };

        this.logs.unshift(logEntry);

        // 限制日志数量
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(0, this.maxLogs);
        }

        // 同时输出到控制台
        const logMethod = level === 'error' ? console.error :
                         level === 'warning' ? console.warn :
                         level === 'success' ? console.log :
                         console.log;

        logMethod(`[${logEntry.time}] [${level.toUpperCase()}] [${category}] ${message}`);
    }

    /**
     * 获取日志列表
     */
    getLogs(options = {}) {
        let filteredLogs = [...this.logs];

        // 按级别过滤
        if (options.level && options.level !== 'all') {
            filteredLogs = filteredLogs.filter(log => log.level === options.level);
        }

        // 按类别过滤
        if (options.category) {
            filteredLogs = filteredLogs.filter(log => log.category.includes(options.category));
        }

        // 按关键词搜索
        if (options.keyword) {
            filteredLogs = filteredLogs.filter(log =>
                log.message.toLowerCase().includes(options.keyword.toLowerCase()) ||
                log.category.toLowerCase().includes(options.keyword.toLowerCase())
            );
        }

        // 分页
        const page = options.page || 1;
        const pageSize = options.pageSize || 50;
        const startIndex = (page - 1) * pageSize;

        return {
            total: filteredLogs.length,
            page: page,
            pageSize: pageSize,
            data: filteredLogs.slice(startIndex, startIndex + pageSize)
        };
    }

    /**
     * 清空日志
     */
    clearLogs() {
        this.logs = [];
        this.log('info', '日志管理', '日志已清空');
    }

    /**
     * 导出日志
     */
    exportLogs() {
        const content = this.logs.map(log =>
            `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.category}] ${log.message}`
        ).join('\n');

        return {
            content: content,
            filename: `server_logs_${new Date().getTime()}.txt`,
            size: Buffer.byteLength(content, 'utf8')
        };
    }

    /**
     * 获取统计信息
     */
    getStatistics() {
        const now = new Date();
        const oneHourAgo = new Date(now - 60 * 60 * 1000);

        const recentLogs = this.logs.filter(log => new Date(log.timestamp) > oneHourAgo);

        return {
            uptime: os.uptime(),
            totalLogs: this.logs.length,
            recentLogs: recentLogs.length,
            onlineServices: this.getOnlineServicesCount(),
            totalServices: this.getTotalServicesCount(),
            systemMetrics: this.systemMetrics,
            logStats: {
                info: recentLogs.filter(l => l.level === 'info').length,
                success: recentLogs.filter(l => l.level === 'success').length,
                warning: recentLogs.filter(l => l.level === 'warning').length,
                error: recentLogs.filter(l => l.level === 'error').length
            }
        };
    }
}

// 创建单例实例
const serverMonitor = new ServerMonitor();

module.exports = serverMonitor;
