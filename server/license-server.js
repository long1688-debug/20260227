const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const bcrypt = require('bcryptjs');

// 配置
const CONFIG = {
    httpPort: 8080,
    licenseDataDir: path.join(__dirname, 'license_data'),
    rateLimitWindow: 15 * 60 * 1000, // 15分钟
    rateLimitMax: 10 // 每15分钟最多10次请求
};

// 速率限制存储
const rateLimitStore = new Map();

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
    // 初始化管理员账户
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

    // 初始化其他数据文件
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

// 记录激活日志
function logActivation(codeId, machineCode, source, action, result, details = {}) {
    try {
        const activations = readData(licenseFiles.activations);
        const logEntry = {
            id: Date.now(),
            codeId,
            machineCode,
            source, // 'local', 'remote', etc.
            action, // 'generate', 'verify', 'activate'
            result, // 'success', 'failed', 'expired'
            timestamp: new Date().toISOString(),
            details
        };
        activations.push(logEntry);
        saveData(licenseFiles.activations, activations);
    } catch (error) {
        console.error('记录激活日志失败:', error);
    }
}

// 速率限制检查
function checkRateLimit(machineCode) {
    const now = Date.now();
    const key = `verify_${machineCode}`;

    if (!rateLimitStore.has(key)) {
        rateLimitStore.set(key, { count: 1, resetTime: now + CONFIG.rateLimitWindow });
        return true;
    }

    const record = rateLimitStore.get(key);

    if (now > record.resetTime) {
        rateLimitStore.set(key, { count: 1, resetTime: now + CONFIG.rateLimitWindow });
        return true;
    }

    if (record.count >= CONFIG.rateLimitMax) {
        return false;
    }

    record.count++;
    return true;
}

// 验证输入参数
function validateInput(registrationCode, machineCode) {
    const errors = [];

    if (!registrationCode || typeof registrationCode !== 'string') {
        errors.push('注册码不能为空且必须是字符串');
    }

    if (!machineCode || typeof machineCode !== 'string') {
        errors.push('机器码不能为空且必须是字符串');
    } else if (machineCode.length < 4) {
        errors.push('机器码长度不能少于4个字符');
    }

    return errors;
}

// 发送 JSON 响应
function sendJSON(res, data, statusCode = 200) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(data, null, 2));
}

// 生成注册码
function generateLicenseCode(machineCode, licenseType) {
    const prefix = machineCode.substring(0, 4).toUpperCase();
    const typeCode = licenseType === 'permanent' ? 'PRO' : 'TRL';
    const part1 = Math.random().toString(36).substring(2, 10).toUpperCase();
    const part2 = Math.random().toString(36).substring(2, 10).toUpperCase();
    const part3 = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${typeCode}-${part1}-${part2}-${part3}`;
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

        // 更新最后登录时间
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
            activations: activations.slice(-20).reverse() // 最近20条
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

        // 过滤
        if (status) {
            codes = codes.filter(c => c.status === status);
        }
        if (type) {
            codes = codes.filter(c => c.licenseType === type);
        }

        // 分页
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
        const { count, licenseType, trialMonths, userName, machineCodes } = body;

        if (!count || count < 1 || count > 100) {
            return sendJSON(res, { success: false, message: '生成数量必须在1-100之间' }, 400);
        }

        const codes = readData(licenseFiles.codes);
        const generatedCodes = [];

        for (let i = 0; i < count; i++) {
            const mc = machineCodes && machineCodes[i] ? machineCodes[i] : '0000-0000-0000-0000';
            const code = generateLicenseCode(mc, licenseType);

            // 计算过期时间
            let expiresAt = null;
            if (licenseType === 'trial' && trialMonths > 0) {
                const date = new Date();
                date.setMonth(date.getMonth() + trialMonths);
                expiresAt = date.toISOString();
            }

            const newCode = {
                id: Date.now() + i,
                code,
                machineCode: mc,
                licenseType,
                trialMonths: licenseType === 'trial' ? (trialMonths || 3) : 0,
                userName: userName || null,
                status: 'active',
                createdAt: new Date().toISOString(),
                expiresAt
            };

            codes.push(newCode);
            generatedCodes.push(newCode);
        }

        saveData(licenseFiles.codes, codes);

        sendJSON(res, {
            success: true,
            message: `成功生成 ${count} 个注册码`,
            codes: generatedCodes
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

        let activations = readData(licenseFiles.activations);
        // 按时间倒序排列
        activations.reverse();

        // 分页
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

// 解析请求体
function parseBody(req) {
    return new Promise((resolve, reject) => {
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

// 服务器主函数
function createServer() {
    const server = http.createServer(async (req, res) => {
        // CORS 头
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        const urlObj = url.parse(req.url, true);
        const pathname = urlObj.pathname;

        // 路由处理
        if (pathname === '/license-manager') {
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
            await handleVerifyCode(req, res);
        } else if (pathname === '/api/activate-code' && req.method === 'POST') {
            await handleActivateCode(req, res);
        } else if (pathname === '/api' && req.method === 'GET') {
            sendJSON(res, {
                status: 'ok',
                version: '1.0.0',
                timestamp: new Date().toISOString(),
                message: '授权管理服务器运行正常'
            });
        } else {
            sendJSON(res, { error: 'Not Found' }, 404);
        }
    });

    return server;
}

// 验证注册码
async function handleVerifyCode(req, res) {
    try {
        const body = await parseBody(req);
        const { registrationCode, machineCode } = body;

        if (!registrationCode || !machineCode) {
            return sendJSON(res, { success: false, message: '缺少必要参数' }, 400);
        }

        // 输入验证
        const validationErrors = validateInput(registrationCode, machineCode);
        if (validationErrors.length > 0) {
            return sendJSON(res, { success: false, message: validationErrors.join('; ') }, 400);
        }

        // 速率限制检查
        if (!checkRateLimit(machineCode)) {
            return sendJSON(res, { success: false, message: '请求过于频繁，请稍后再试' }, 429);
        }

        // 验证格式
        if (!/^[A-Z0-9]{4}-(PRO|TRL)-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{4}$/.test(registrationCode)) {
            return sendJSON(res, { success: false, message: '注册码格式不正确' }, 400);
        }

        // 验证机器码匹配
        const parts = registrationCode.split('-');
        if (machineCode.substring(0, 4).toUpperCase() !== parts[0]) {
            return sendJSON(res, { success: false, message: '注册码与机器码不匹配' }, 400);
        }

        // 查找注册码
        const codes = readData(licenseFiles.codes);
        const record = codes.find(c =>
            c.code === registrationCode &&
            c.machineCode === machineCode &&
            c.status === 'active'
        );

        if (!record) {
            // 记录失败的验证尝试
            logActivation(null, machineCode, 'local', 'verify', 'failed', { registrationCode });
            return sendJSON(res, { success: false, message: '注册码无效或已被使用' }, 400);
        }

        // 检查过期时间
        if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
            record.status = 'expired';
            saveData(licenseFiles.codes, codes);
            logActivation(record.id, machineCode, 'local', 'verify', 'expired', { registrationCode });
            return sendJSON(res, { success: false, message: '注册码已过期' }, 400);
        }

        // 记录成功的验证
        logActivation(record.id, machineCode, 'local', 'verify', 'success', { registrationCode });

        sendJSON(res, {
            success: true,
            licenseType: record.licenseType,
            trialMonths: record.trialMonths,
            userName: record.userName,
            expiresAt: record.expiresAt
        });
    } catch (error) {
        console.error('验证注册码错误:', error);
        sendJSON(res, { success: false, message: '验证失败' }, 500);
    }
}

// 激活注册码
async function handleActivateCode(req, res) {
    try {
        const body = await parseBody(req);
        const { registrationCode, machineCode, userName, deviceInfo } = body;

        if (!registrationCode || !machineCode) {
            return sendJSON(res, { success: false, message: '缺少必要参数' }, 400);
        }

        // 输入验证
        const validationErrors = validateInput(registrationCode, machineCode);
        if (validationErrors.length > 0) {
            return sendJSON(res, { success: false, message: validationErrors.join('; ') }, 400);
        }

        // 速率限制检查
        if (!checkRateLimit(machineCode)) {
            return sendJSON(res, { success: false, message: '请求过于频繁，请稍后再试' }, 429);
        }

        // 验证格式
        if (!/^[A-Z0-9]{4}-(PRO|TRL)-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{4}$/.test(registrationCode)) {
            return sendJSON(res, { success: false, message: '注册码格式不正确' }, 400);
        }

        // 验证机器码匹配
        const parts = registrationCode.split('-');
        if (machineCode.substring(0, 4).toUpperCase() !== parts[0]) {
            return sendJSON(res, { success: false, message: '注册码与机器码不匹配' }, 400);
        }

        // 查找注册码
        const codes = readData(licenseFiles.codes);
        const codeIndex = codes.findIndex(c =>
            c.code === registrationCode &&
            c.machineCode === machineCode &&
            c.status === 'active'
        );

        if (codeIndex === -1) {
            logActivation(null, machineCode, 'local', 'activate', 'failed', { registrationCode });
            return sendJSON(res, { success: false, message: '注册码无效或已被使用' }, 400);
        }

        const record = codes[codeIndex];

        // 检查过期时间
        if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
            record.status = 'expired';
            saveData(licenseFiles.codes, codes);
            logActivation(record.id, machineCode, 'local', 'activate', 'expired', { registrationCode });
            return sendJSON(res, { success: false, message: '注册码已过期' }, 400);
        }

        // 检查是否已经激活过相同的机器码（防止重复激活）
        const existingActivation = codes.find(c =>
            c.machineCode === machineCode &&
            c.status === 'used' &&
            c.id !== record.id
        );
        if (existingActivation) {
            logActivation(record.id, machineCode, 'local', 'activate', 'duplicate', { registrationCode });
            return sendJSON(res, { success: false, message: '该机器码已被其他注册码激活' }, 400);
        }

        // 计算激活后的过期时间
        let expiresAt = null;
        if (record.licenseType !== 'permanent') {
            const date = new Date();
            date.setMonth(date.getMonth() + (record.trialMonths || 3));
            expiresAt = date.toISOString();
        }

        // 更新注册码状态
        codes[codeIndex] = {
            ...record,
            status: 'used',
            activatedAt: new Date().toISOString(),
            activatedDevice: deviceInfo || machineCode,
            expiresAt,
            userName: userName || record.userName
        };

        saveData(licenseFiles.codes, codes);

        // 记录激活日志
        logActivation(record.id, machineCode, 'local', 'activate', 'success', {
            registrationCode,
            userName,
            deviceInfo
        });

        sendJSON(res, {
            success: true,
            licenseType: record.licenseType,
            trialMonths: record.trialMonths,
            userName: userName || record.userName,
            expiresAt,
            message: '激活成功！'
        });
    } catch (error) {
        console.error('激活注册码错误:', error);
        console.error('错误详情:', error.stack);
        sendJSON(res, { success: false, message: '激活失败' }, 500);
    }
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
    console.log('  🔐 软件授权管理系统');
    console.log('==========================================');
    console.log();

    // 初始化数据
    initData();

    // 创建并启动服务器
    const server = createServer();
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

// 启动
startServer();
