/**
 * 授权管理处理函数
 * 将这些函数添加到 server.js 文件的末尾
 */

// 管理员登录
async function handleAdminLogin(req, res) {
    try {
        const body = await parseBody(req);
        const { username, password } = body;
        
        const admins = readLicenseData(licenseFiles.admins);
        const admin = admins.find(a => a.username === username);
        
        if (!admin) {
            return sendJSON(res, { success: false, message: '用户名或密码错误' }, 401);
        }
        
        const bcrypt = require('bcryptjs');
        if (!bcrypt.compareSync(password, admin.password)) {
            return sendJSON(res, { success: false, message: '用户名或密码错误' }, 401);
        }
        
        // 更新最后登录时间
        admin.lastLogin = new Date().toISOString();
        saveLicenseData(licenseFiles.admins, admins);
        
        sendJSON(res, {
            success: true,
            message: '登录成功',
            admin: {
                id: admin.id,
                username: admin.username,
                email: admin.email
            }
        });
    } catch (error) {
        console.error('管理员登录错误:', error);
        sendJSON(res, { success: false, message: '服务器错误' }, 500);
    }
}

// 获取统计数据
function handleAdminStats(req, res) {
    try {
        const codes = readLicenseData(licenseFiles.codes);
        const activations = readLicenseData(licenseFiles.activations);
        
        const stats = {
            total: codes.length,
            active: codes.filter(c => c.status === 'active').length,
            used: codes.filter(c => c.status === 'used').length,
            expired: codes.filter(c => c.status === 'expired').length,
            activations: activations.slice(-20) // 最近20条激活记录
        };
        
        sendJSON(res, { success: true, data: stats });
    } catch (error) {
        console.error('获取统计错误:', error);
        sendJSON(res, { success: false, message: '获取统计失败' }, 500);
    }
}

// 管理注册码
async function handleAdminCodes(req, res) {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const search = url.searchParams;
        const page = parseInt(search.get('page')) || 1;
        const limit = parseInt(search.get('limit')) || 20;
        const status = search.get('status');
        const type = search.get('type');
        
        let codes = readLicenseData(licenseFiles.codes);
        
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
async function handleGenerateCodes(req, res) {
    try {
        const body = await parseBody(req);
        const { adminId, count, licenseType, trialMonths, machineCodes, userName } = body;
        
        if (!count || count < 1 || count > 100) {
            return sendJSON(res, { success: false, message: '生成数量必须在1-100之间' }, 400);
        }
        
        const codes = readLicenseData(licenseFiles.codes);
        const generatedCodes = [];
        
        for (let i = 0; i < count; i++) {
            const mc = machineCodes && machineCodes[i] ? machineCodes[i] : '0000-0000-0000-0000';
            const code = generateLicenseCode(mc, licenseType, trialMonths);
            
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
                trialMonths: trialMonths || 0,
                userName: userName || null,
                status: 'active',
                createdAt: new Date().toISOString(),
                expiresAt
            };
            
            codes.push(newCode);
            generatedCodes.push(newCode);
            
            // 记录生成日志
            logActivation(newCode.id, mc, 'local', 'generate', 'success', { adminId });
        }
        
        saveLicenseData(licenseFiles.codes, codes);
        
        sendJSON(res, {
            success: true,
            message: `成功生成 ${count} 个注册码`,
            codes: generatedCodes
        });
    } catch (error) {
        console.error('生成注册码错误:', error);
        sendJSON(res, { success: false, message: '生成注册码失败' }, 500);
    }
}

// 获取激活记录
async function handleAdminActivations(req, res) {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const search = url.searchParams;
        const page = parseInt(search.get('page')) || 1;
        const limit = parseInt(search.get('limit')) || 20;
        const result = search.get('result');
        
        let activations = readLicenseData(licenseFiles.activations);
        
        // 过滤
        if (result) {
            activations = activations.filter(a => a.result === result);
        }
        
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

// 验证注册码
async function handleVerifyCode(req, res) {
    try {
        const body = await parseBody(req);
        const { registrationCode, machineCode } = body;
        
        if (!registrationCode || !machineCode) {
            return sendJSON(res, { success: false, message: '缺少必要参数' }, 400);
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
        const codes = readLicenseData(licenseFiles.codes);
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
            saveLicenseData(licenseFiles.codes, codes);
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
        const codes = readLicenseData(licenseFiles.codes);
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
            saveLicenseData(licenseFiles.codes, codes);
            logActivation(record.id, machineCode, 'local', 'activate', 'expired', { registrationCode });
            return sendJSON(res, { success: false, message: '注册码已过期' }, 400);
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
        
        saveLicenseData(licenseFiles.codes, codes);
        
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
        sendJSON(res, { success: false, message: '激活失败' }, 500);
    }
}