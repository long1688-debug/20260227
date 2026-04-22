// 补充的处理函数
async function handleAdminLogin(req, res, body) {
    try {
        const bcrypt = require('bcryptjs');
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
            pagination: { page, limit, total: codes.length, pages: Math.ceil(codes.length / limit) }
        });
    } catch (error) {
        console.error('获取注册码错误:', error);
        sendJSON(res, { success: false, message: '获取注册码失败' }, 500);
    }
}

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
            note: '注册码未绑定机器码，激活时将绑定当前设备'
        });
        
        console.log(`生成了 ${count} 个注册码`);
    } catch (error) {
        console.error('生成注册码错误:', error);
        sendJSON(res, { success: false, message: '生成注册码失败' }, 500);
    }
}

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
            pagination: { page, limit, total: activations.length, pages: Math.ceil(activations.length / limit) }
        });
    } catch (error) {
        console.error('获取激活记录错误:', error);
        sendJSON(res, { success: false, message: '获取激活记录失败' }, 500);
    }
}
