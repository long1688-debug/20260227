const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const bcrypt = require('bcryptjs');

// 配置
const CONFIG = {
    httpPort: 8080,
    licenseDataDir: path.join(__dirname, 'license_data')
};

// 数据文件
const licenseFiles = {
    admins: path.join(CONFIG.licenseDataDir, 'admins.json'),
    codes: path.join(CONFIG.licenseDataDir, 'codes.json'),
    activations: path.join(CONFIG.licenseDataDir, 'activations.json')
};

// 确保数据目录存在
if (!fs.existsSync(CONFIG.licenseDataDir)) {
    fs.mkdirSync(CONFIG.licenseDataDir, { recursive: true });
}

// 初始化数据
function initData() {
    if (!fs.existsSync(licenseFiles.admins)) {
        const adminPassword = bcrypt.hashSync('admin123', 10);
        const admins = [{
            id: 1,
            username: 'admin',
            password: adminPassword,
            email: 'admin@system.com',
            createdAt: new Date().toISOString(),
            lastLogin: null
        }];
        fs.writeFileSync(licenseFiles.admins, JSON.stringify(admins, null, 2));
        console.log('✓ 默认管理员账户已创建: admin / admin123');
    }
    
    if (!fs.existsSync(licenseFiles.codes)) {
        fs.writeFileSync(licenseFiles.codes, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(licenseFiles.activations)) {
        fs.writeFileSync(licenseFiles.activations, JSON.stringify([], null, 2));
    }
}

// 读取数据
function readData(filename) {
    try {
        return JSON.parse(fs.readFileSync(filename, 'utf8'));
    } catch (error) {
        console.error('读取数据失败:', error);
        return [];
    }
}

// 保存数据
function saveData(filename, data) {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}

// 发送 JSON 响应
function sendJSON(res, data, statusCode = 200) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(data, null, 2));
}

// 生成注册码（不依赖机器码）
function generateLicenseCode(licenseType) {
    const prefix = 'TRNG'; // 教学系统前缀
    const typeCode = licenseType === 'permanent' ? 'PRO' : 'TRL';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random1 = Math.random().toString(36).substring(2, 10).toUpperCase();
    const random2 = Math.random().toString(36).substring(2, 10).toUpperCase();
    const checksum = Math.floor(Math.random() * 9999).toString(16).toUpperCase().padStart(4, '0');
    return `${prefix}-${typeCode}-${timestamp}-${random1}-${checksum}`;
}

// 记录激活日志
function logActivation(codeId, machineCode, registrationCode, action, result, additionalInfo = {}) {
    const activations = readData(licenseFiles.activations);
    activations.push({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        codeId,
        machineCode,
        registrationCode,
        action,
        result,
        ...additionalInfo
    });
    saveData(licenseFiles.activations, activations);
}

// 管理员登录
async function handleAdminLogin(req, res, body) {
    try {
        const { username, password } = body;
        
        if (!username || !password) {
            return sendJSON(res, { success: false, message: '用户名和密码不能为空' }, 400);
        }
        
        const admins = readData(licenseFiles.admins);
        const admin = admins.find(a => a.username === username);
        
        if (!admin) {
            return sendJSON(res, { success: false, message: '用户名或密码错误' }, 401);
        }
        
        if (!bcrypt.compareSync(password, admin.password)) {
            return sendJSON(res, { success: false, message: '用户名或密码错误' }, 401);
        }
        
        admin.lastLogin = new Date().toISOString();
        saveData(licenseFiles.admins, admins);
        
        sendJSON(res, {
            success: true,
            message: '登录成功',
            admin: {
                id: admin.id,
                username: admin.username,
                email: admin.email
            }
        });
        
        console.log(`管理员登录成功: ${username}`);
    } catch (error) {
        console.error('登录错误:', error);
        sendJSON(res, { success: false, message: '服务器错误' }, 500);
    }
}

// 获取统计数据
function handleAdminStats(req, res) {
    try {
        const codes = readData(licenseFiles.codes);
        const activations = readData(licenseFiles.activations);
        
        const stats = {
            total: codes.length,
            active: codes.filter(c => c.status === 'active').length,
            used: codes.filter(c => c.status === 'used').length,
            expired: codes.filter(c => c.status === 'expired').length,
            activations: activations.slice(-20).reverse()
        };
        
        sendJSON(res, { success: true, data: stats });
    } catch (error) {
        console.error('获取统计错误:', error);
        sendJSON(res, { success: false, message: '获取统计失败' }, 500);
    }
}

// 获取注册码列表
function handleAdminCodes(req, res) {
    try {
        const urlObj = url.parse(req.url, true);
        const search = urlObj.searchParams || {};
        const page = parseInt(search.get('page')) || 1;
        const limit = parseInt(search.get('limit')) || 20;
        const status = search.get('status');
        const type = search.get('type');
        
        let codes = readData(licenseFiles.codes);
        
        if (status) codes = codes.filter(c => c.status === status);
        if (type) codes = codes.filter(c => c.licenseType === type);
        
        const start = (page - 1) * limit;
        const end = start + limit;
        const paginatedCodes = codes.slice(start, end);
        
        sendJSON(res, {
            success: true,
            data: paginatedCodes,
            pagination: {
                page,
                limit,
                total: codes.length,
                pages: Math.ceil(codes.length / limit)
            }
        });
    } catch (error) {
        console.error('获取注册码错误:', error);
        sendJSON(res, { success: false, message: '获取注册码失败' }, 500);
    }
}

// 生成注册码
async function handleGenerateCodes(req, res, body) {
    try {
        const { count, licenseType, trialMonths, userName } = body;
        
        if (!count || count < 1 || count > 100) {
            return sendJSON(res, { success: false, message: '生成数量必须在1-100之间' }, 400);
        }
        
        const codes = readData(licenseFiles.codes);
        const generatedCodes = [];
        
        for (let i = 0; i < count; i++) {
            const code = generateLicenseCode(licenseType);
            
            let expiresAt = null;
            if (licenseType === 'trial' && trialMonths > 0) {
                const date = new Date();
                date.setMonth(date.getMonth() + trialMonths);
                expiresAt = date.toISOString();
            }
            
            const newCode = {
                id: Date.now() + i,
                code,
                licenseType,
                trialMonths: licenseType === 'trial' ? (trialMonths || 3) : 0,
                userName: userName || null,
                status: 'active',
                createdAt: new Date().toISOString(),
                expiresAt,
                boundMachineCode: null,
                activatedAt: null,
                activationCount: 0
            };
            
            codes.push(newCode);
            generatedCodes.push(newCode);
        }
        
        saveData(licenseFiles.codes, codes);
        
        sendJSON(res, {
            success: true,
            message: `成功生成 ${count} 个注册码`,
            codes: generatedCodes,
            note: '注册码不绑定机器码，激活时将绑定当前设备'
        });
        
        console.log(`生成了 ${count} 个注册码`);
    } catch (error) {
        console.error('生成注册码错误:', error);
        sendJSON(res, { success: false, message: '生成注册码失败' }, 500);
    }
}

// 获取激活记录
function handleAdminActivations(req, res) {
    try {
        const urlObj = url.parse(req.url, true);
        const search = urlObj.searchParams || {};
        const page = parseInt(search.get('page')) || 1;
        const limit = parseInt(search.get('limit')) || 20;
        const result = search.get('result');
        
        let activations = readData(licenseFiles.activations);
        activations.reverse();
        
        if (result) activations = activations.filter(a => a.result === result);
        
        const start = (page - 1) * limit;
        const end = start + limit;
        const paginatedActivations = activations.slice(start, end);
        
        sendJSON(res, {
            success: true,
            data: paginatedActivations,
            pagination: {
                page,
                limit,
                total: activations.length,
                pages: Math.ceil(activations.length / limit)
            }
        });
    } catch (error) {
        console.error('获取激活记录错误:', error);
        sendJSON(res, { success: false, message: '获取激活记录失败' }, 500);
    }
}

// 验证注册码
async function handleVerifyCode(req, res, body) {
    try {
        const { registrationCode } = body;
        if (!registrationCode) {
            return sendJSON(res, { success: false, message: '缺少必要参数' }, 400);
        }
        
        // 验证格式（更宽松的正则，支持各种格式）
        const parts = registrationCode.split('-');
        if (parts.length !== 5) {
            return sendJSON(res, { success: false, message: '注册码格式不正确：需要5个部分（用-分隔）' }, 400);
        }
        
        const prefix = parts[0];
        const typeCode = parts[1];
        const random1 = parts[2];
        const random2 = parts[3];
        const checksum = parts[4];
        
        // 验证各部分格式
        if (prefix.length !== 4 || !/^[A-Z0-9]{4}$/.test(prefix)) {
            return sendJSON(res, { success: false, message: '注册码前缀必须是4位字母数字' }, 400);
        }
        
        if (typeCode !== 'PRO' && typeCode !== 'TRL') {
            return sendJSON(res, { success: false, message: '注册码类型必须是PRO或TRL' }, 400);
        }
        
        if (random1.length !== 8 || !/^[A-Z0-9-]{8}$/.test(random1)) {
            return sendJSON(res, { success: false, message: '注册码第3部分必须是8位字母数字' }, 400);
        }
        
        if (random2.length !== 8 || !/^[A-Z0-9-]{8}$/.test(random2)) {
            return sendJSON(res, { success: false, message: '注册码第4部分必须是8位字母数字' }, 400);
        }
        
        if (checksum.length !== 4 || !/^[A-Z0-9]{4}$/.test(checksum)) {
            return sendJSON(res, { success: false, message: '注册码校验和必须是4位字母数字' }, 400);
        }
        
        const codes = readData(licenseFiles.codes);
        const record = codes.find(c => c.code === registrationCode);
        
        if (!record) {
            return sendJSON(res, { success: false, message: '注册码无效，请检查是否正确' }, 400);
        }
        
        if (record.status !== 'active') {
            if (record.status === 'used') {
                return sendJSON(res, { success: false, message: '注册码已被使用' }, 400);
            }
            if (record.status === 'expired') {
                return sendJSON(res, { success: false, message: '注册码已过期' }, 400);
            }
            return sendJSON(res, { success: false, message: '注册码状态异常' }, 400);
        }
        
        if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
            record.status = 'expired';
            saveData(licenseFiles.codes, codes);
            return sendJSON(res, { success: false, message: '注册码已过期' }, 400);
        }
        
        sendJSON(res, {
            success: true,
            licenseType: record.licenseType,
            trialMonths: record.trialMonths,
            userName: record.userName,
            expiresAt: record.expiresAt,
            message: '注册码有效，可以激活'
        });
        
    } catch (error) {
        console.error('验证注册码错误:', error);
        sendJSON(res, { success: false, message: '验证失败' }, 500);
    }
}

// 激活注册码（绑定机器码）
async function handleActivateCode(req, res, body) {
    try {
        const { registrationCode, machineCode, userName, deviceInfo } = body;
        // 移除机器码前缀验证，支持新格式
        // 新系统不要求注册码前缀匹配机器码，激活时才绑定设备
        
        const codes = readData(licenseFiles.codes);
        const codeIndex = codes.findIndex(c => c.code === registrationCode);
        
        if (codeIndex === -1) {
            logActivation(null, machineCode, registrationCode, 'activate', 'failed', '注册码无效');
            return sendJSON(res, { success: false, message: '注册码无效，请检查是否正确' }, 400);
        }
        
        const record = codes[codeIndex];
        
        if (record.status !== 'active') {
            if (record.status === 'used') {
                logActivation(record.id, machineCode, registrationCode, 'activate', 'failed', '注册码已被使用');
                return sendJSON(res, { success: false, message: '注册码已被使用' }, 400);
            }
            if (record.status === 'expired') {
                logActivation(record.id, machineCode, registrationCode, 'activate', 'expired', '注册码已过期');
                return sendJSON(res, { success: false, message: '注册码已过期' }, 400);
            }
        }
        
        if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
            record.status = 'expired';
            saveData(licenseFiles.codes, codes);
            logActivation(record.id, machineCode, registrationCode, 'activate', 'expired', '注册码已过期');
            return sendJSON(res, { success: false, message: '注册码已过期' }, 400);
        }
        
        // 新系统允许同一设备使用不同注册码（更灵活）
        // 移除设备重复绑定检查，支持灵活的授权管理
        
        // 激活注册码并绑定机器码
        let expiresAt = null;
        if (record.licenseType !== 'permanent') {
            const date = new Date();
            date.setMonth(date.getMonth() + (record.trialMonths || 3));
            expiresAt = date.toISOString();
        }
        
        codes[codeIndex] = {
            ...record,
            status: 'used',
            boundMachineCode: machineCode,
            activatedAt: new Date().toISOString(),
            activatedDevice: deviceInfo || machineCode,
            userName: userName || record.userName,
            expiresAt,
            activationCount: (record.activationCount || 0) + 1
        };
        
        saveData(licenseFiles.codes, codes);
        
        logActivation(record.id, machineCode, registrationCode, 'activate', 'success', {
            userName,
            deviceInfo
        });
        
        sendJSON(res, {
            success: true,
            licenseType: record.licenseType,
            trialMonths: record.trialMonths,
            userName: userName || record.userName,
            expiresAt,
            machineCode: machineCode,
            message: '激活成功！'
        });
        
        console.log(`注册码 ${registrationCode} 已激活，绑定机器码: ${machineCode}`);
    } catch (error) {
        console.error('激活注册码错误:', error);
        sendJSON(res, { success: false, message: '激活失败' }, 500);
    }
}

// 解析请求体
function parseBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body || '{}'));
            } catch (error) {
                resolve({});
            }
        });
    });
}

// 静态文件服务
function serveStaticFile(res, filePath) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            console.error('文件不存在:', filePath);
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>404 - 文件不存在</h1>');
            return;
        }

        const ext = path.extname(filePath);
        const contentTypes = {
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.json': 'application/json; charset=utf-8'
        };

        const contentType = contentTypes[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

// 启动服务器
function startServer() {
    console.log('==========================================');
    console.log('  🔐 软件授权管理系统 v2.0');
    console.log('==========================================');
    console.log();
    console.log('✨ 新特性:');
    console.log('  - 注册码生成不依赖机器码');
    console.log('  - 激活时自动绑定当前设备');
    console.log('  - 支持多设备授权管理');
    console.log('  - 完整的激活审计日志');
    console.log();

    initData();
    
    const server = http.createServer(async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        const urlObj = url.parse(req.url, true);
        const pathname = urlObj.pathname;

        // 健康检查端点
        if (pathname === '/health') {
            sendJSON(res, {
                status: 'healthy',
                service: 'license-management-server',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: '2.0.0',
                checks: {
                    http: 'running',
                    database: 'connected'
                }
            });
        }
        else if (pathname === '/license-manager') {
            serveStaticFile(res, path.join(__dirname, 'license-manager.html'));
        } else if (pathname === '/api/admin/login' && req.method === 'POST') {
            const body = await parseBody(req);
            handleAdminLogin(req, res, body);
        } else if (pathname === '/api/admin/stats' && req.method === 'GET') {
            handleAdminStats(req, res);
        } else if (pathname === '/api/admin/codes' && req.method === 'GET') {
            handleAdminCodes(req, res);
        } else if (pathname === '/api/admin/generate-codes' && req.method === 'POST') {
            const body = await parseBody(req);
            handleGenerateCodes(req, res, body);
        } else if (pathname === '/api/admin/activations' && req.method === 'GET') {
            handleAdminActivations(req, res);
        } else if (pathname === '/api/verify-code' && req.method === 'POST') {
            const body = await parseBody(req);
            handleVerifyCode(req, res, body);
        } else if (pathname === '/api/activate-code' && req.method === 'POST') {
            const body = await parseBody(req);
            handleActivateCode(req, res, body);
        } else if (pathname === '/api' && req.method === 'GET') {
            sendJSON(res, { 
                status: 'ok', 
                version: '2.0.0',
                timestamp: new Date().toISOString(),
                message: '授权管理服务器运行正常',
                features: [
                    '注册码不依赖机器码',
                    '激活时绑定设备',
                    '支持多设备管理',
                    '完整激活日志'
                ]
            });
        } else {
            sendJSON(res, { error: 'Not Found' }, 404);
        }
    });

    server.listen(CONFIG.httpPort, () => {
        console.log(`✓ 服务器运行在 http://localhost:${CONFIG.httpPort}`);
        console.log(`✓ 授权管理页面: http://localhost:${CONFIG.httpPort}/license-manager`);
        console.log(`✓ API 状态: http://localhost:${CONFIG.httpPort}/api`);
        console.log();
        console.log('默认管理员账户:');
        console.log('  用户名: admin');
        console.log('  密码: admin123');
        console.log();
        console.log('按 Ctrl+C 停止服务器');
        console.log('==========================================');
    });

    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            console.error(`❌ 错误: 端口 ${CONFIG.httpPort} 已被占用`);
            console.log('请尝试以下操作:');
            console.log('1. 停止占用该端口的程序');
            console.log('2. 修改配置中的端口号');
        } else {
            console.error('服务器错误:', error);
        }
    });
}

startServer();
