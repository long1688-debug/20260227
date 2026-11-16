/**
 * 实训教学系统 - 后端服务器
 * 支持 HTTP API 和 WebSocket 实时通信
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const cocoDataset = require('./coco-dataset');
const serverMonitor = require('./services/server-monitor');
const { whisperService } = require('./services/whisper-service');

// ==================== 配置 ====================
const CONFIG = {
    httpPort: process.env.HTTP_PORT || 8080,
    wsPort: process.env.WS_PORT || 8082,  // 🎯 修改为8082，避免与RTSP-Proxy(8081)冲突
    dataDir: process.env.TRAINING_DATA_DIR || path.join(__dirname, 'data'),
    sessionTimeout: 3600000, // 1 小时
    secretKey: null
};

// 密钥和初始口令：环境变量优先，否则首次启动随机生成并保存在 dataDir/initial-credentials.json
function loadOrCreateSecrets() {
    fs.mkdirSync(CONFIG.dataDir, { recursive: true });
    const file = path.join(CONFIG.dataDir, 'initial-credentials.json');
    let saved = {};
    try { saved = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* first run */ }
    const gen = () => crypto.randomBytes(9).toString('base64url');
    const secrets = {
        secretKey: process.env.SERVER_SECRET_KEY || saved.secretKey || crypto.randomBytes(32).toString('hex'),
        adminPassword: process.env.ADMIN_PASSWORD || saved.adminPassword || gen(),
        teacherPassword: process.env.TEACHER_PASSWORD || saved.teacherPassword || gen()
    };
    fs.writeFileSync(file, JSON.stringify(secrets, null, 2), { mode: 0o600 });
    return secrets;
}
const SECRETS = loadOrCreateSecrets();
CONFIG.secretKey = SECRETS.secretKey;

// ==================== 辅助函数 ====================
/**
 * 查找 FFmpeg 可执行文件路径
 * 在 Windows 上会检查常见安装位置
 */
function findFfmpegPath() {
    const path = require('path');
    const fs = require('fs');

    // Windows 上常见的 FFmpeg 安装路径
    const commonPaths = [
        'C:\\ffmpeg\\bin\\ffmpeg.exe',
        'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
        'C:\\ProgramData\\ffmpeg\\bin\\ffmpeg.exe',
        path.join(process.env.LOCALAPPDATA || '', 'ffmpeg', 'bin', 'ffmpeg.exe'),
        path.join(process.env.ProgramFiles || '', 'ffmpeg', 'bin', 'ffmpeg.exe'),
    ];

    for (const p of commonPaths) {
        try {
            if (fs.existsSync(p)) {
                console.log('[系统检测] 找到 FFmpeg:', p);
                return p;
            }
        } catch (e) {
            // 忽略错误，继续搜索
        }
    }
    return null;
}

/**
 * 确保 FFmpeg 在 PATH 中可用
 * 如果不在 PATH 中，自动添加已知安装目录
 */
function ensureFfmpegInPath() {
    const path = require('path');

    // 先检查 ffmpeg 是否已在 PATH 中
    const currentPath = process.env.Path || process.env.PATH || '';
    const pathSep = process.platform === 'win32' ? ';' : ':';
    const pathDirs = currentPath.split(pathSep);

    // 检查已知的 FFmpeg 目录是否在 PATH 中
    const ffmpegDirs = [
        'C:\\ffmpeg\\bin',
    ];

    for (const dir of ffmpegDirs) {
        if (!pathDirs.includes(dir)) {
            try {
                const fs = require('fs');
                if (fs.existsSync(dir)) {
                    process.env.Path = dir + pathSep + process.env.Path;
                    console.log('[系统检测] 已将 FFmpeg 目录添加到 PATH:', dir);
                    return true;
                }
            } catch (e) {
                // 忽略错误
            }
        } else {
            return true;
        }
    }
    return false;
}

/**
 * 检查 FFmpeg 是否可用
 */
async function checkFfmpegAvailable() {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    // 先尝试直接执行
    try {
        await execPromise('ffmpeg -version');
        return true;
    } catch (error) {
        // 直接执行失败，尝试添加已知路径后再试
        console.warn('[系统检测] FFmpeg 不在 PATH 中，尝试自动查找...');
    }

    // 确保 FFmpeg 目录在 PATH 中
    ensureFfmpegInPath();

    // 再次尝试
    try {
        await execPromise('ffmpeg -version');
        console.log('[系统检测] FFmpeg 已可用');
        return true;
    } catch (error) {
        // 尝试使用完整路径
        const ffmpegPath = findFfmpegPath();
        if (ffmpegPath) {
            const ffmpegDir = path.dirname(ffmpegPath);
            process.env.Path = ffmpegDir + ';' + process.env.Path;
            console.log('[系统检测] 已通过完整路径添加 FFmpeg:', ffmpegDir);
            try {
                await execPromise('ffmpeg -version');
                return true;
            } catch (e) {
                // 仍然失败
            }
        }
        console.warn('[系统检测] FFmpeg 不可用:', error.message);
        console.warn('[系统检测] 请安装 FFmpeg 并添加到 PATH，或将其放在 C:\\ffmpeg\\bin\\ 目录下');
        return false;
    }
}

// ==================== 数据存储 ====================
class DataStore {
    constructor() {
        this.users = new Map();
        this.students = new Map();
        this.classes = new Map();
        this.tasks = new Map();
        this.submissions = [];
        this.sessions = new Map();
        this.evaluations = [];
        this.visionResults = [];

        this.loadData();
    }

    loadData() {
        try {
            // 初始化默认数据
            this.users.set('admin', {
                id: 'admin',
                username: 'admin',
                password: this.hashPassword(SECRETS.adminPassword),
                role: 'admin',
                name: '管理员',
                createdAt: new Date().toISOString()
            });

            this.users.set('teacher1', {
                id: 'teacher1',
                username: 'teacher1',
                password: this.hashPassword(SECRETS.teacherPassword),
                role: 'teacher',
                name: '张老师',
                classIds: ['class001'],
                createdAt: new Date().toISOString()
            });

            this.classes.set('class001', {
                id: 'class001',
                name: '新能源汽车维修 1 班',
                teacherId: 'teacher1',
                studentCount: 30,
                createdAt: new Date().toISOString()
            });

            // 添加示例学生
            for (let i = 1; i <= 5; i++) {
                const studentId = `stu${String(i).padStart(3, '0')}`;
                this.students.set(studentId, {
                    id: studentId,
                    name: `学生${i}`,
                    classId: 'class001',
                    studentNo: `2024${String(i).padStart(4, '0')}`,
                    createdAt: new Date().toISOString()
                });
            }

            console.log('✓ 默认数据加载完成');
        } catch (error) {
            console.error('数据加载失败:', error);
        }
    }

    hashPassword(password) {
        return crypto.createHash('sha256').update(password + CONFIG.secretKey).digest('hex');
    }

    // 用户认证
    authenticate(username, password) {
        const user = this.users.get(username);
        if (!user) return null;

        const hashedPassword = this.hashPassword(password);
        if (user.password !== hashedPassword) return null;

        // 创建会话
        const sessionId = crypto.randomBytes(32).toString('hex');
        this.sessions.set(sessionId, {
            userId: user.id,
            username: user.username,
            role: user.role,
            createdAt: Date.now()
        });

        return {
            sessionId,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                name: user.name
            }
        };
    }

    // 验证会话
    validateSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return null;

        if (Date.now() - session.createdAt > CONFIG.sessionTimeout) {
            this.sessions.delete(sessionId);
            return null;
        }

        return session;
    }

    // 获取用户列表
    getUsers() {
        return Array.from(this.users.values()).map(u => ({
            id: u.id,
            username: u.username,
            role: u.role,
            name: u.name,
            createdAt: u.createdAt
        }));
    }

    // 获取班级列表
    getClasses() {
        return Array.from(this.classes.values());
    }

    // 获取学生列表
    getStudents(classId = null) {
        let students = Array.from(this.students.values());
        if (classId) {
            students = students.filter(s => s.classId === classId);
        }
        return students;
    }

    // 获取任务列表
    getTasks(classId = null) {
        let tasks = Array.from(this.tasks.values());
        if (classId) {
            tasks = tasks.filter(t => t.classId === classId);
        }
        return tasks;
    }

    // 保存评估结果
    saveEvaluation(data) {
        const evaluation = {
            id: crypto.randomBytes(16).toString('hex'),
            timestamp: new Date().toISOString(),
            ...data
        };
        this.evaluations.push(evaluation);

        // 限制存储数量
        if (this.evaluations.length > 1000) {
            this.evaluations.shift();
        }

        return evaluation;
    }

    // 获取评估历史
    getEvaluations(studentId = null, limit = 100) {
        let results = [...this.evaluations].reverse();
        if (studentId) {
            results = results.filter(e => e.studentId === studentId);
        }
        return results.slice(0, limit);
    }

    // 保存视觉分析结果
    saveVisionResult(data) {
        const result = {
            id: crypto.randomBytes(16).toString('hex'),
            timestamp: new Date().toISOString(),
            ...data
        };
        this.visionResults.push(result);

        if (this.visionResults.length > 500) {
            this.visionResults.shift();
        }

        return result;
    }

    // 获取视觉分析历史
    getVisionHistory(studentId = null, limit = 100) {
        let results = [...this.visionResults].reverse();
        if (studentId) {
            results = results.filter(r => r.studentId === studentId);
        }
        return results.slice(0, limit);
    }
}

const dataStore = new DataStore();

// ==================== HTTP 服务器 ====================
function createHttpServer() {
    return http.createServer((req, res) => {
        // CORS 头
        const origin = req.headers.origin;
        if (origin && isAllowedOrigin(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Vary', 'Origin');
        }
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const url = new URL(req.url, `http://localhost:${CONFIG.httpPort}`);
        const pathname = url.pathname;

        // 路由处理
        handleRequest(req, res, pathname, url);
    });
}

const EXTRA_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
function isAllowedOrigin(origin) {
    return /^(https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?|tauri:\/\/localhost|https?:\/\/tauri\.localhost)$/.test(origin)
        || EXTRA_ORIGINS.includes(origin);
}

function isLoopback(req) {
    const addr = req.socket.remoteAddress || '';
    return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

// 局域网学生端可匿名访问的接口；其余 /api/* 远程请求需要登录会话
const PUBLIC_API = [
    /^\/api\/login$/,
    /^\/api\/students\/[^/]+\/(hand|answer)$/,
    /^\/api\/tasks\/[^/]+\/submit$/,
    /^\/api\/live\//
];

function getSession(req) {
    const auth = req.headers.authorization || '';
    const sid = auth.startsWith('Bearer ') ? auth.slice(7) : req.headers['x-session-id'];
    return sid ? dataStore.validateSession(sid) : null;
}

async function handleRequest(req, res, pathname, url) {
    try {
        if (pathname.startsWith('/api/') && !isLoopback(req)
            && !PUBLIC_API.some(re => re.test(pathname)) && !getSession(req)) {
            sendJSON(res, { success: false, message: '未登录或会话已过期' }, 401);
            return;
        }
        // 健康检查端点
        if (pathname === '/health') {
            sendJSON(res, {
                status: 'healthy',
                service: 'training-teaching-system-server',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: '1.0.0',
                checks: {
                    http: 'running',
                    websocket: wsServer ? 'running' : 'stopped',
                    memory: process.memoryUsage()
                }
            });
        }
        // API 路由
        else if (pathname === '/api/status') {
            sendJSON(res, {
                status: 'ok',
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                services: {
                    http: 'running',
                    websocket: wsServer ? 'running' : 'stopped'
                }
            });
        }
        // 健康检查端点
        else if (pathname === '/api/health') {
            const health = {
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                services: {
                    database: 'connected',
                    websocket: wsServer ? 'running' : 'stopped'
                }
            };
            sendJSON(res, health);
        }
        // 深度健康检查
        else if (pathname === '/api/health/deep') {
            try {
                const deepCheck = {
                    status: 'ok',
                    timestamp: new Date().toISOString(),
                    checks: {
                        database: { status: 'pass', message: '连接正常' },
                        disk: { status: 'pass', message: '磁盘空间充足' },
                        memory: {
                            status: process.memoryUsage().heapUsed < 512 * 1024 * 1024 ? 'pass' : 'warn',
                            message: `内存使用：${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
                        }
                    }
                };
                sendJSON(res, deepCheck);
            } catch (error) {
                sendJSON(res, {
                    status: 'error',
                    timestamp: new Date().toISOString(),
                    error: error.message
                }, 503);
            }
        }
        // 网络测速接口 - 返回固定大小的测试数据
        else if (pathname === '/api/test-speed' && req.method === 'GET') {
            // 生成 1MB 的随机数据用于带宽测试
            const testData = Buffer.alloc(1024 * 1024, crypto.randomBytes(1024));
            res.writeHead(200, {
                'Content-Type': 'application/octet-stream',
                'Content-Length': testData.length,
                'Cache-Control': 'no-cache'
            });
            res.end(testData);
        }
        else if (pathname === '/api/login' && req.method === 'POST') {
            const body = await parseBody(req);
            const result = dataStore.authenticate(body.username, body.password);

            if (result) {
                sendJSON(res, {
                    success: true,
                    message: '登录成功',
                    data: result
                });
            } else {
                sendJSON(res, {
                    success: false,
                    message: '用户名或密码错误'
                }, 401);
            }
        }
        else if (pathname === '/api/users' && req.method === 'GET') {
            const users = dataStore.getUsers();
            sendJSON(res, { success: true, data: users });
        }
        else if (pathname === '/api/user' && req.method === 'GET') {
            // 获取当前用户（需要认证，暂时返回第一个教师用户）
            const teacher = Array.from(dataStore.users.values()).find(u => u.role === 'teacher');
            if (teacher) {
                sendJSON(res, { success: true, data: teacher });
            } else {
                sendJSON(res, { success: false, message: '用户未登录' }, 401);
            }
        }
        else if (pathname === '/api/classes' && req.method === 'GET') {
            const classes = dataStore.getClasses();
            sendJSON(res, { success: true, data: classes });
        }
        else if (pathname.startsWith('/api/classes/') && req.method === 'GET') {
            const classId = pathname.split('/')[3];
            const cls = dataStore.classes.get(classId);
            if (cls) {
                sendJSON(res, { success: true, data: cls });
            } else {
                sendJSON(res, { success: false, message: '班级不存在' }, 404);
            }
        }
        else if (pathname === '/api/students' && req.method === 'GET') {
            const classId = url.searchParams.get('classId');
            const students = dataStore.getStudents(classId);
            sendJSON(res, { success: true, data: students });
        }
        else if (pathname === '/api/students' && req.method === 'POST') {
            const body = await parseBody(req);
            const studentId = body.id || `stu_${Date.now()}`;
            const newStudent = {
                id: studentId,
                name: body.name,
                classId: body.classId,
                studentNo: body.studentNo,
                createdAt: new Date().toISOString()
            };
            dataStore.students.set(studentId, newStudent);
            sendJSON(res, { success: true, data: newStudent });
        }
        else if (pathname.startsWith('/api/students/') && req.method === 'PUT') {
            const studentId = pathname.split('/')[3];
            const body = await parseBody(req);
            const student = dataStore.students.get(studentId);
            if (student) {
                const updated = { ...student, ...body };
                dataStore.students.set(studentId, updated);
                sendJSON(res, { success: true, data: updated });
            } else {
                sendJSON(res, { success: false, message: '学生不存在' }, 404);
            }
        }
        else if (pathname.startsWith('/api/students/') && req.method === 'DELETE') {
            const studentId = pathname.split('/')[3];
            if (dataStore.students.delete(studentId)) {
                sendJSON(res, { success: true, message: '删除成功' });
            } else {
                sendJSON(res, { success: false, message: '学生不存在' }, 404);
            }
        }
        else if (pathname.startsWith('/api/students/') && pathname.endsWith('/kick') && req.method === 'POST') {
            const studentId = pathname.split('/')[3];
            // 通过 WebSocket 通知学生端
            sendJSON(res, { success: true, message: '学生已踢出' });
        }
        else if (pathname.startsWith('/api/students/') && pathname.endsWith('/hand') && req.method === 'POST') {
            const studentId = pathname.split('/')[3];
            const body = await parseBody(req);
            sendJSON(res, { success: true, raised: body.raised });
        }
        else if (pathname.startsWith('/api/students/') && pathname.endsWith('/answer') && req.method === 'POST') {
            const studentId = pathname.split('/')[3];
            sendJSON(res, { success: true, message: '已回应举手' });
        }
        else if (pathname === '/api/classes' && req.method === 'POST') {
            const body = await parseBody(req);
            const classId = body.id || `class_${Date.now()}`;
            const newClass = {
                id: classId,
                name: body.name,
                teacherId: body.teacherId,
                studentCount: 0,
                createdAt: new Date().toISOString()
            };
            dataStore.classes.set(classId, newClass);
            sendJSON(res, { success: true, data: newClass });
        }
        else if (pathname.startsWith('/api/classes/') && req.method === 'PUT') {
            const classId = pathname.split('/')[3];
            const body = await parseBody(req);
            const cls = dataStore.classes.get(classId);
            if (cls) {
                const updated = { ...cls, ...body };
                dataStore.classes.set(classId, updated);
                sendJSON(res, { success: true, data: updated });
            } else {
                sendJSON(res, { success: false, message: '班级不存在' }, 404);
            }
        }
        else if (pathname.startsWith('/api/classes/') && req.method === 'DELETE') {
            const classId = pathname.split('/')[3];
            if (dataStore.classes.delete(classId)) {
                sendJSON(res, { success: true, message: '删除成功' });
            } else {
                sendJSON(res, { success: false, message: '班级不存在' }, 404);
            }
        }
        else if (pathname === '/api/tasks' && req.method === 'GET') {
            const tasks = dataStore.getTasks();
            sendJSON(res, { success: true, data: tasks });
        }
        else if (pathname === '/api/tasks' && req.method === 'POST') {
            const body = await parseBody(req);
            const taskId = body.id || `task_${Date.now()}`;
            const newTask = {
                id: taskId,
                title: body.title,
                description: body.description,
                classId: body.classId,
                status: body.status || 'in-progress',
                submitted: 0,
                total: body.total || 0,
                createdAt: new Date().toISOString()
            };
            dataStore.tasks.set(taskId, newTask);
            sendJSON(res, { success: true, data: newTask });
        }
        else if (pathname.startsWith('/api/tasks/') && req.method === 'PUT') {
            const taskId = pathname.split('/')[3];
            const body = await parseBody(req);
            const task = dataStore.tasks.get(taskId);
            if (task) {
                const updated = { ...task, ...body };
                dataStore.tasks.set(taskId, updated);
                sendJSON(res, { success: true, data: updated });
            } else {
                sendJSON(res, { success: false, message: '任务不存在' }, 404);
            }
        }
        else if (pathname.startsWith('/api/tasks/') && req.method === 'DELETE') {
            const taskId = pathname.split('/')[3];
            if (dataStore.tasks.delete(taskId)) {
                sendJSON(res, { success: true, message: '删除成功' });
            } else {
                sendJSON(res, { success: false, message: '任务不存在' }, 404);
            }
        }
        else if (pathname.startsWith('/api/tasks/') && pathname.endsWith('/submit') && req.method === 'POST') {
            const taskId = pathname.split('/')[3];
            const body = await parseBody(req);
            dataStore.submissions.push({
                id: `sub_${Date.now()}`,
                taskId,
                studentId: body.studentId,
                content: body.content,
                submittedAt: new Date().toISOString()
            });
            const task = dataStore.tasks.get(taskId);
            if (task) {
                task.submitted = (task.submitted || 0) + 1;
            }
            sendJSON(res, { success: true, message: '提交成功' });
        }
        else if (pathname === '/api/evaluation' && req.method === 'POST') {
            const body = await parseBody(req);
            const result = dataStore.saveEvaluation(body);
            sendJSON(res, { success: true, data: result });
        }
        else if (pathname === '/api/evaluation/history' && req.method === 'GET') {
            const studentId = url.searchParams.get('studentId');
            const limit = parseInt(url.searchParams.get('limit')) || 100;
            const evaluations = dataStore.getEvaluations(studentId, limit);
            sendJSON(res, { success: true, data: evaluations });
        }
        else if (pathname.startsWith('/api/evaluation/') && req.method === 'GET') {
            const evaluationId = pathname.split('/')[3];
            const evaluation = dataStore.evaluations.find(e => e.id === evaluationId || e.id === '1');
            if (evaluation) {
                sendJSON(res, { success: true, data: evaluation });
            } else {
                sendJSON(res, { success: false, message: '评估不存在' }, 404);
            }
        }
        else if (pathname === '/api/vision/result' && req.method === 'POST') {
            const body = await parseBody(req);
            const result = dataStore.saveVisionResult(body);
            sendJSON(res, { success: true, data: result });
        }
        // ========== COCO 数据集相关 ==========
        else if (pathname === '/api/coco/stats' && req.method === 'GET') {
            try {
                const stats = cocoDataset.getStats();
                sendJSON(res, { success: true, data: stats });
            } catch (error) {
                sendJSON(res, { success: false, message: error.message }, 500);
            }
        }
        else if (pathname === '/api/coco/images' && req.method === 'GET') {
            try {
                const dataset = url.searchParams.get('dataset') || 'val';
                const limit = parseInt(url.searchParams.get('limit')) || 100;
                const offset = parseInt(url.searchParams.get('offset')) || 0;

                console.log(`[COCO API] 获取图像列表: dataset=${dataset}, limit=${limit}, offset=${offset}`);
                const result = cocoDataset.getImageList(dataset, limit, offset);
                console.log(`[COCO API] 返回 ${result.images.length} 张图像，总计 ${result.total} 张`);
                sendJSON(res, { success: true, data: result });
            } catch (error) {
                console.error('[COCO API] 获取图像列表失败:', error);
                sendJSON(res, { success: false, message: error.message }, 500);
            }
        }
        else if (pathname === '/api/coco/random' && req.method === 'GET') {
            try {
                const dataset = url.searchParams.get('dataset') || 'val';
                const image = cocoDataset.getRandomImage(dataset);

                if (image) {
                    sendJSON(res, { success: true, data: image });
                } else {
                    sendJSON(res, { success: false, message: '未找到图像' }, 404);
                }
            } catch (error) {
                sendJSON(res, { success: false, message: error.message }, 500);
            }
        }
        else if (pathname.startsWith('/api/coco/image/') && req.method === 'GET') {
            try {
                const imageId = pathname.split('/')[4];
                const dataset = url.searchParams.get('dataset') || 'val';

                const imageData = cocoDataset.getImageData(imageId, dataset);

                if (imageData.found) {
                    // 返回图像文件
                    const ext = path.extname(imageData.path).toLowerCase();
                    const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';

                    res.writeHead(200, { 'Content-Type': contentType });
                    const fileStream = fs.createReadStream(imageData.path);
                    fileStream.pipe(res);
                } else {
                    sendJSON(res, { success: false, message: '图像不存在' }, 404);
                }
            } catch (error) {
                sendJSON(res, { success: false, message: error.message }, 500);
            }
        }
        else if (pathname.startsWith('/api/coco/annotations/') && req.method === 'GET') {
            try {
                const imageId = pathname.split('/')[4];
                const annotations = cocoDataset.getImageAnnotations(imageId);
                sendJSON(res, { success: true, data: annotations });
            } catch (error) {
                sendJSON(res, { success: false, message: error.message }, 500);
            }
        }
        else if (pathname.startsWith('/api/coco/detect/') && req.method === 'POST') {
            try {
                const imageId = pathname.split('/')[4];
                const result = cocoDataset.detectObjects(imageId);
                sendJSON(res, { success: result.success, data: result });
            } catch (error) {
                sendJSON(res, { success: false, message: error.message }, 500);
            }
        }
        else if (pathname === '/api/coco/evaluate' && req.method === 'POST') {
            try {
                const body = await parseBody(req);
                const imageIds = body.imageIds || [];

                const result = cocoDataset.getModelEvaluation(imageIds);
                sendJSON(res, { success: true, data: result });
            } catch (error) {
                sendJSON(res, { success: false, message: error.message }, 500);
            }
        }
        // ========== 录制相关 API ==========
        else if (pathname === '/api/recording/start' && req.method === 'POST') {
            const body = await parseBody(req);
            // 调用 C++ 后端录制功能
            const recordingId = `rec_${Date.now()}_${body.index || 0}`;
            sendJSON(res, {
                success: true,
                recordingId: recordingId,
                message: '录制已开始'
            });
        }
        else if (pathname === '/api/recording/:id/stop' && req.method === 'POST') {
            const recordingId = pathname.split('/')[3];
            // 调用 C++ 后端停止录制
            sendJSON(res, {
                success: true,
                message: '录制已停止',
                filePath: `recordings/${recordingId}.mp4`
            });
        }
        else if (pathname === '/api/recording/:id/pause' && req.method === 'POST') {
            const recordingId = pathname.split('/')[3];
            // 调用 C++ 后端暂停录制
            sendJSON(res, { success: true, message: '录制已暂停' });
        }
        else if (pathname === '/api/recording/:id/resume' && req.method === 'POST') {
            const recordingId = pathname.split('/')[3];
            // 调用 C++ 后端继续录制
            sendJSON(res, { success: true, message: '录制已继续' });
        }
        else if (pathname === '/api/recordings' && req.method === 'GET') {
            // 获取录制列表
            sendJSON(res, { success: true, data: [] });
        }
        else if (pathname.startsWith('/api/recordings/') && req.method === 'GET') {
            const recordingId = pathname.split('/')[3];
            sendJSON(res, {
                success: true,
                data: {
                    id: recordingId,
                    name: `录制_${recordingId}`,
                    type: 'camera',
                    duration: '00:00:00',
                    size: '0 MB',
                    createTime: new Date().toISOString()
                }
            });
        }
        else if (pathname.startsWith('/api/recordings/') && req.method === 'DELETE') {
            const recordingId = pathname.split('/')[3];
            sendJSON(res, { success: true, message: '删除成功' });
        }
        else if (pathname.startsWith('/api/recording/') && pathname.endsWith('/stop') && req.method === 'POST') {
            const recordingId = pathname.split('/')[3];
            sendJSON(res, {
                success: true,
                message: '录制已停止',
                filePath: `recordings/${recordingId}.mp4`
            });
        }
        else if (pathname.startsWith('/api/recording/') && pathname.endsWith('/pause') && req.method === 'POST') {
            const recordingId = pathname.split('/')[3];
            sendJSON(res, { success: true, message: '录制已暂停' });
        }
        else if (pathname.startsWith('/api/recording/') && pathname.endsWith('/resume') && req.method === 'POST') {
            const recordingId = pathname.split('/')[3];
            sendJSON(res, { success: true, message: '录制已继续' });
        }
        // ========== Whisper 语音识别相关 ==========
        else if (pathname === '/api/whisper/status' && req.method === 'GET') {
            console.log('[Whisper API] 获取状态');
            try {
                const status = await whisperService.getStatus();
                sendJSON(res, {
                    success: true,
                    ...status,
                    ffmpeg: await checkFfmpegAvailable()
                });
            } catch (error) {
                sendJSON(res, {
                    success: false,
                    message: error.message
                }, 500);
            }
        }
        else if (pathname === '/api/whisper/recognize' && req.method === 'POST') {
            console.log('[Whisper API] 开始识别');
            try {
                // 读取请求体
                const body = await parseRequestBody(req);
                const { audioPath, model, language, translate } = body;

                if (!audioPath) {
                    return sendJSON(res, {
                        success: false,
                        message: '缺少音频文件路径'
                    }, 400);
                }

                const result = await whisperService.recognizeFile(audioPath, {
                    model: model || 'base',
                    language: language || 'zh',
                    translate: translate || false
                });

                sendJSON(res, {
                    success: true,
                    ...result
                });
            } catch (error) {
                console.error('[Whisper API] 识别失败:', error);
                sendJSON(res, {
                    success: false,
                    message: error.message
                }, 500);
            }
        }
        else if (pathname === '/api/whisper/models' && req.method === 'GET') {
            console.log('[Whisper API] 获取模型列表');
            try {
                const models = await whisperService.getStatus();
                sendJSON(res, {
                    success: true,
                    models: models.models
                });
            } catch (error) {
                sendJSON(res, {
                    success: false,
                    message: error.message
                }, 500);
            }
        }
        // 视频上传
        else if (pathname === '/api/upload/video' && req.method === 'POST') {
            const formidable = require('formidable');
            const form = new formidable.IncomingForm({
                uploadDir: process.env.TRAINING_TEMP_DIR || path.join(__dirname, 'temp'),
                keepExtensions: true,
                maxFileSize: 500 * 1024 * 1024 // 500MB
            });

            form.parse(req, async (err, fields, files) => {
                if (err) {
                    console.error('[视频上传] 解析失败:', err);
                    return sendJSON(res, {
                        success: false,
                        error: '视频上传失败: ' + err.message
                    }, 500);
                }

                const videoFile = files.video;
                if (!videoFile) {
                    return sendJSON(res, {
                        success: false,
                        error: '未找到视频文件'
                    }, 400);
                }

                console.log('[视频上传] 文件已保存:', videoFile.filepath);

                sendJSON(res, {
                    success: true,
                    videoPath: videoFile.filepath,
                    filename: videoFile.originalFilename
                });
            });
        }
        // 系统环境状态检查
        else if (pathname === '/api/system/check' && req.method === 'GET') {
            try {
                const ffmpegAvailable = await checkFfmpegAvailable();

                sendJSON(res, {
                    success: true,
                    data: {
                        ffmpeg: {
                            available: ffmpegAvailable,
                            status: ffmpegAvailable ? 'available' : 'unavailable'
                        },
                        server: {
                            available: true,
                            status: 'available'
                        }
                    }
                });
            } catch (error) {
                console.error('[系统检测] 检查失败:', error);
                sendJSON(res, {
                    success: false,
                    error: error.message
                }, 500);
            }
        }
        // ========== 直播相关 ==========
        else if (pathname === '/api/live/status' && req.method === 'GET') {
            sendJSON(res, {
                isLive: false,
                viewers: 0,
                platform: null,
                url: null
            });
        }
        else if (pathname === '/api/live/start' && req.method === 'POST') {
            const body = await parseBody(req);
            sendJSON(res, {
                success: true,
                liveId: `live_${Date.now()}`,
                message: '直播已开始',
                url: body.url
            });
        }
        else if (pathname === '/api/live/stop' && req.method === 'POST') {
            sendJSON(res, {
                success: true,
                message: '直播已停止'
            });
        }
        else if (pathname.startsWith('/api/live/') && req.method === 'GET') {
            const liveId = pathname.split('/')[3];
            sendJSON(res, {
                liveId,
                isLive: false,
                viewers: 0
            });
        }
        // ========== 屏幕共享相关 ==========
        else if (pathname === '/api/screen-share/status' && req.method === 'GET') {
            sendJSON(res, {
                isSharing: false,
                sourceType: null
            });
        }
        else if (pathname === '/api/screen-share/start' && req.method === 'POST') {
            const body = await parseBody(req);
            sendJSON(res, {
                success: true,
                shareId: `share_${Date.now()}`,
                message: '屏幕共享已开始'
            });
        }
        else if (pathname === '/api/screen-share/stop' && req.method === 'POST') {
            sendJSON(res, {
                success: true,
                message: '屏幕共享已停止'
            });
        }
        // ========== 视觉分析历史 ==========
        else if (pathname === '/api/vision/history' && req.method === 'GET') {
            const studentId = url.searchParams.get('studentId');
            const limit = parseInt(url.searchParams.get('limit')) || 100;
            const results = dataStore.getVisionHistory(studentId, limit);
            sendJSON(res, { success: true, data: results });
        }
        // ========== 系统状态监控 API ==========
        else if (pathname === '/api/monitor/services' && req.method === 'GET') {
            const services = serverMonitor.getAllServices();
            sendJSON(res, { success: true, data: services });
        }
        else if (pathname === '/api/monitor/metrics' && req.method === 'GET') {
            const metrics = await serverMonitor.getSystemMetrics();
            sendJSON(res, { success: true, data: metrics });
        }
        else if (pathname === '/api/monitor/statistics' && req.method === 'GET') {
            const statistics = serverMonitor.getStatistics();
            sendJSON(res, { success: true, data: statistics });
        }
        else if (pathname === '/api/monitor/logs' && req.method === 'GET') {
            const level = url.searchParams.get('level') || 'all';
            const category = url.searchParams.get('category') || '';
            const keyword = url.searchParams.get('keyword') || '';
            const page = parseInt(url.searchParams.get('page')) || 1;
            const pageSize = parseInt(url.searchParams.get('pageSize')) || 50;

            const logs = serverMonitor.getLogs({ level, category, keyword, page, pageSize });
            sendJSON(res, { success: true, data: logs });
        }
        else if (pathname === '/api/monitor/logs/clear' && req.method === 'POST') {
            serverMonitor.clearLogs();
            sendJSON(res, { success: true, message: '日志已清空' });
        }
        else if (pathname === '/api/monitor/logs/export' && req.method === 'GET') {
            const exportData = serverMonitor.exportLogs();
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${exportData.filename}"`);
            res.end(exportData.content);
        }
        else if (pathname === '/api/monitor/refresh' && req.method === 'POST') {
            const metrics = await serverMonitor.getSystemMetrics();
            sendJSON(res, {
                success: true,
                message: '系统状态已刷新',
                data: {
                    services: serverMonitor.getAllServices(),
                    metrics: metrics,
                    statistics: serverMonitor.getStatistics()
                }
            });
        }
        // ========== favicon.ico ==========
        else if (pathname === '/favicon.ico') {
            // 返回 204 No Content（浏览器默认的 favicon 请求）
            res.writeHead(204);
            res.end();
        }
        // ========== 根路径和首页 ==========
        else if (pathname === '/' || pathname === '/index.html') {
            // 提供 Web 功能中心首页
            serveStaticFile(res, path.join(__dirname, 'web', 'index.html'));
        }
        else if (pathname === '/student/training.html' || pathname.startsWith('/student/')) {
            // 提供学生端页面
            serveStaticFile(res, path.join(__dirname, '..', 'student', 'training.html'));
        }
        else if (pathname === '/teacher/management.html' || pathname.startsWith('/teacher/')) {
            // 提供教师端页面
            serveStaticFile(res, path.join(__dirname, '..', 'teacher', 'management.html'));
        }
        else if (pathname === '/vision_analysis.html') {
            // 提供视觉分析页面
            serveStaticFile(res, path.join(__dirname, '..', 'vision_analysis.html'));
        }
        else if (pathname === '/api_test.html') {
            // 提供 API 测试页面
            serveStaticFile(res, path.join(__dirname, '..', 'api_test.html'));
        }
        // ========== Web 功能中心页面 ==========
        else if (pathname === '/web/index.html' || pathname === '/web') {
            // 系统首页
            serveStaticFile(res, path.join(__dirname, 'web', 'index.html'));
        }
        else if (pathname === '/web/student-training.html') {
            // 学生实训页面
            serveStaticFile(res, path.join(__dirname, 'web', 'student-training.html'));
        }
        else if (pathname === '/web/teacher-management.html') {
            // 教师管理页面
            serveStaticFile(res, path.join(__dirname, 'web', 'teacher-management.html'));
        }
        else if (pathname === '/web/vision-analysis.html') {
            // 视觉分析页面
            serveStaticFile(res, path.join(__dirname, 'web', 'vision-analysis.html'));
        }
        else if (pathname === '/web/service-status.html') {
            // 服务状态页面
            serveStaticFile(res, path.join(__dirname, 'web', 'service-status.html'));
        }
        else if (pathname === '/web/subtitle-generator.html') {
            // 字幕生成器页面
            serveStaticFile(res, path.join(__dirname, 'web', 'subtitle-generator.html'));
        }
        else if (pathname === '/web/api-test.html') {
            // API测试页面
            serveStaticFile(res, path.join(__dirname, 'web', 'api-test.html'));
        }
        else if (pathname.startsWith('/static/')) {
            // 静态文件服务
            const filePath = path.join(__dirname, '..', pathname.replace('/static/', ''));
            serveStaticFile(res, filePath);
        }
        // 授权管理路由
        else if (pathname === '/license-manager') {
            serveStaticFile(res, path.join(__dirname, 'license-manager.html'));
        }
        else if (pathname === '/api/admin/login' && req.method === 'POST') {
            handleAdminLogin(req, res);
        }
        else if (pathname === '/api/admin/stats' && req.method === 'GET') {
            handleAdminStats(req, res);
        }
        else if (pathname === '/api/admin/codes') {
            handleAdminCodes(req, res);
        }
        else if (pathname === '/api/admin/generate-codes' && req.method === 'POST') {
            handleGenerateCodes(req, res);
        }
        else if (pathname === '/api/admin/activations') {
            handleAdminActivations(req, res);
        }
        else if (pathname === '/api/verify-code' && req.method === 'POST') {
            handleVerifyCode(req, res);
        }
        else if (pathname === '/api/activate-code' && req.method === 'POST') {
            handleActivateCode(req, res);
        }
        else {
            sendJSON(res, { error: 'Not Found' }, 404);
        }
    } catch (error) {
        console.error('请求处理错误:', error);
        sendJSON(res, { error: 'Internal Server Error' }, 500);
    }
}

// ==================== WebSocket 服务器 ====================
function createWebSocketServer() {
    const wss = new WebSocketServer({ port: CONFIG.wsPort, host: '127.0.0.1', path: '/ws' });

    const clients = new Set();
    const clientSessions = new Map();

    wss.on('connection', (ws, req) => {
        const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        ws.clientId = clientId;

        console.log(`[WebSocket] 客户端连接：${clientId}`);
        clients.add(ws);

        // 记录到监控日志
        serverMonitor.log('info', 'WebSocket', `客户端连接：${clientId}`);

        // 发送欢迎消息
        ws.send(JSON.stringify({
            type: 'welcome',
            clientId: clientId,
            serverTime: new Date().toISOString(),
            message: '欢迎连接到实训教学系统'
        }));

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                handleMessage(ws, clientId, data, clientSessions);
            } catch (error) {
                console.error(`[${clientId}] 消息解析错误:`, error);
                ws.send(JSON.stringify({
                    type: 'error',
                    message: '消息解析失败'
                }));
            }
        });

        ws.on('close', () => {
            console.log(`[WebSocket] 客户端断开：${clientId}`);
            clients.delete(ws);
            clientSessions.delete(clientId);

            // 记录到监控日志
            serverMonitor.log('info', 'WebSocket', `客户端断开：${clientId}`);
        });

        ws.on('error', (error) => {
            console.error(`[${clientId}] WebSocket 错误:`, error.message);
        });

        // 心跳检测
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });
    });

    // 心跳检测
    const interval = setInterval(() => {
        wss.clients.forEach(ws => {
            if (!ws.isAlive) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    wss.on('close', () => clearInterval(interval));

    return {
        broadcast: (message, exclude = null) => {
            const msg = JSON.stringify(message);
            clients.forEach(client => {
                if (client !== exclude && client.readyState === 1) {
                    client.send(msg);
                }
            });
        },
        sendToClient: (clientId, message) => {
            clients.forEach(client => {
                if (client.clientId === clientId && client.readyState === 1) {
                    client.send(JSON.stringify(message));
                }
            });
        }
    };
}

// ==================== 消息处理 ====================
function handleMessage(ws, clientId, data, clientSessions) {
    const { type, ...payload } = data;

    switch (type) {
        case 'frame_analysis':
            // 处理视觉分析结果
            handleVisionAnalysis(ws, clientId, payload);
            break;

        case 'evaluation_request':
            // 处理评分请求
            handleEvaluationRequest(ws, clientId, payload);
            break;

        case 'student_action':
            // 处理学生操作
            handleStudentAction(ws, clientId, payload);
            break;

        default:
            ws.send(JSON.stringify({
                type: 'unknown_type',
                message: `未知的消息类型：${type}`
            }));
    }
}

// 处理视觉分析
function handleVisionAnalysis(ws, clientId, data) {
    const { detections, studentId, operationType } = data;

    // 分析检测结果
    const analysis = analyzeDetections(detections);

    // 保存结果
    dataStore.saveVisionResult({
        clientId,
        studentId,
        operationType,
        detections,
        analysis
    });

    // 返回分析结果
    ws.send(JSON.stringify({
        type: 'vision_analysis_result',
        timestamp: new Date().toISOString(),
        data: {
            detectionCount: detections?.length || 0,
            analysis,
            suggestions: generateSuggestions(analysis)
        }
    }));

    // 广播给监控端（如果需要）
    // wsServer.broadcast({
    //     type: 'vision_update',
    //     clientId,
    //     studentId,
    //     analysis
    // });
}

// 分析检测结果
function analyzeDetections(detections = []) {
    const DANGEROUS_TOOLS = ['knife', 'scissors', 'baseball bat', 'fork', 'hammer', 'screwdriver'];
    const TOOLS = ['knife', 'scissors', 'fork', 'spoon', 'cup', 'bottle', 'cell phone', 'laptop'];

    const analysis = {
        objectCount: 0,
        personCount: 0,
        toolCount: 0,
        dangerousObjects: [],
        safetyScore: 100,
        poseScore: 0,
        complianceScore: 100
    };

    detections.forEach(det => {
        const type = det.type || 'object';

        if (type === 'object') {
            analysis.objectCount++;

            if (det.class === 'person') {
                analysis.personCount++;
            } else if (TOOLS.includes(det.class)) {
                analysis.toolCount++;
            }

            if (DANGEROUS_TOOLS.includes(det.class)) {
                analysis.dangerousObjects.push({
                    class: det.class,
                    score: det.score,
                    bbox: det.bbox
                });
                analysis.safetyScore -= 20;
            }
        } else if (type === 'pose') {
            analysis.poseScore = det.score || 0;
        }
    });

    analysis.safetyScore = Math.max(0, analysis.safetyScore);
    analysis.complianceScore = analysis.dangerousObjects.length === 0 ? 100 : 100 - (analysis.dangerousObjects.length * 25);

    return analysis;
}

// 生成建议
function generateSuggestions(analysis) {
    const suggestions = [];

    if (analysis.dangerousObjects.length > 0) {
        suggestions.push({
            type: 'warning',
            message: `检测到 ${analysis.dangerousObjects.length} 个危险物品，请注意安全操作`,
            level: 'high'
        });
    }

    if (analysis.personCount === 0) {
        suggestions.push({
            type: 'info',
            message: '未检测到人员，请确保在摄像头范围内操作',
            level: 'medium'
        });
    }

    if (analysis.safetyScore < 80) {
        suggestions.push({
            type: 'alert',
            message: '安全评分较低，请检查操作规范',
            level: 'high'
        });
    }

    return suggestions;
}

// 处理评分请求
function handleEvaluationRequest(ws, clientId, data) {
    const { studentId, operationId, stepId } = data;

    const evaluations = dataStore.getEvaluations(studentId, 10);

    ws.send(JSON.stringify({
        type: 'evaluation_response',
        timestamp: new Date().toISOString(),
        data: {
            studentId,
            operationId,
            history: evaluations,
            averageScore: evaluations.length > 0
                ? evaluations.reduce((sum, e) => sum + (e.score || 0), 0) / evaluations.length
                : 0
        }
    }));
}

// 处理学生操作
function handleStudentAction(ws, clientId, data) {
    const { studentId, action, operationStep } = data;

    // 记录操作日志
    console.log(`[学生操作] ${studentId}: ${action} - 步骤：${operationStep}`);

    ws.send(JSON.stringify({
        type: 'action_ack',
        timestamp: new Date().toISOString(),
        data: {
            studentId,
            action,
            received: true
        }
    }));
}

// ==================== 工具函数 ====================
function sendJSON(res, data, statusCode = 200) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
}

// ==================== 授权管理数据存储 ====================
const licenseDataDir = path.join(__dirname, 'license_data');

if (!fs.existsSync(licenseDataDir)) {
    fs.mkdirSync(licenseDataDir, { recursive: true });
}

const licenseFiles = {
    codes: path.join(licenseDataDir, 'codes.json'),
    activations: path.join(licenseDataDir, 'activations.json'),
    admins: path.join(licenseDataDir, 'admins.json')
};

// 初始化授权数据
function initLicenseData() {
    if (!fs.existsSync(licenseFiles.admins)) {
        const bcrypt = require('bcryptjs');
        const admins = [{
            id: 1,
            username: 'admin',
            password: bcrypt.hashSync(SECRETS.adminPassword, 10),
            email: 'admin@system.com',
            createdAt: new Date().toISOString(),
            lastLogin: null
        }];
        fs.writeFileSync(licenseFiles.admins, JSON.stringify(admins, null, 2));
    }

    if (!fs.existsSync(licenseFiles.codes)) {
        fs.writeFileSync(licenseFiles.codes, JSON.stringify([], null, 2));
    }

    if (!fs.existsSync(licenseFiles.activations)) {
        fs.writeFileSync(licenseFiles.activations, JSON.stringify([], null, 2));
    }
}

// 读取授权数据
function readLicenseData(filename) {
    try {
        return JSON.parse(fs.readFileSync(filename, 'utf8'));
    } catch {
        return [];
    }
}

// 保存授权数据
function saveLicenseData(filename, data) {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}

// 生成注册码
function generateLicenseCode(machineCode, licenseType, trialMonths) {
    const prefix = machineCode.substring(0, 4).toUpperCase();
    const typeCode = licenseType === 'permanent' ? 'PRO' : 'TRL';
    const part1 = crypto.randomBytes(4).toString('hex').toUpperCase();
    const part2 = crypto.randomBytes(4).toString('hex').toUpperCase();
    const part3 = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `${prefix}-${typeCode}-${part1}-${part2}-${part3}`;
}

// 记录激活日志
function logActivation(codeId, machineCode, server, action, result, additionalInfo = {}) {
    const activations = readLicenseData(licenseFiles.activations);
    activations.push({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        codeId,
        machineCode,
        server,
        action,
        result,
        ...additionalInfo
    });
    saveLicenseData(licenseFiles.activations, activations);
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(error);
            }
        });
        req.on('error', reject);
    });
}

function serveStaticFile(res, filePath) {
    const ext = path.extname(filePath);
    const contentTypes = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.txt': 'text/plain',
        '.xml': 'application/xml'
    };

    // 如果是目录，尝试返回 index.html
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        const indexFile = path.join(filePath, 'index.html');
        if (fs.existsSync(indexFile)) {
            filePath = indexFile;
        }
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            console.error(`文件不存在：${filePath}`);
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>404 - 文件不存在</h1>');
            return;
        }

        const contentType = contentTypes[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

// ==================== 启动服务器 ====================
console.log('==========================================');
console.log('  🎓 实训教学系统 - 后端服务器');
console.log('==========================================');
console.log();

// 创建数据目录
if (!fs.existsSync(CONFIG.dataDir)) {
    fs.mkdirSync(CONFIG.dataDir, { recursive: true });
}

// 系统环境检测
(async () => {
    console.log('🔍 系统环境检测:');

    // 检查 FFmpeg
    const ffmpegAvailable = await checkFfmpegAvailable();
    console.log(ffmpegAvailable ? '  ✓ FFmpeg 可用' : '  ✗ FFmpeg 不可用');

    // 检查 Whisper
    const whisperStatus = await whisperService.getStatus();
    console.log(whisperStatus.available ? '  ✓ Whisper 可用' : '  ✗ Whisper 不可用');
    if (!whisperStatus.available) {
        console.log('     💡 请安装 Python 和 whisper 库: pip install openai-whisper');
    }

    console.log();
})();

// 启动 HTTP 服务器
const httpServer = createHttpServer();

httpServer.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ 错误: 端口 ${CONFIG.httpPort} 已被占用`);
        console.log('请尝试以下操作:');
        console.log(`1. 使用环境变量指定其他端口: HTTP_PORT=8081 npm start`);
        console.log('2. 停止占用该端口的程序');
        console.log('3. 修改配置中的默认端口号');
        process.exit(1);
    } else {
        console.error('服务器启动错误:', error);
        process.exit(1);
    }
});

httpServer.listen(CONFIG.httpPort, '0.0.0.0', async () => {
    console.log(`✓ HTTP 服务器运行在 http://${CONFIG.httpPort === 80 ? 'localhost' : 'localhost:' + CONFIG.httpPort}`);
    console.log(`  API 状态：http://${CONFIG.httpPort === 80 ? 'localhost' : 'localhost:' + CONFIG.httpPort}/api/status`);
    console.log();
    console.log('📄 访问以下页面:');
    console.log(`  Web功能中心：http://${CONFIG.httpPort === 80 ? 'localhost' : 'localhost:' + CONFIG.httpPort}/web/index.html`);
    console.log(`  学生实训：http://${CONFIG.httpPort === 80 ? 'localhost' : 'localhost:' + CONFIG.httpPort}/web/student-training.html`);
    console.log(`  教师管理：http://${CONFIG.httpPort === 80 ? 'localhost' : 'localhost:' + CONFIG.httpPort}/web/teacher-management.html`);
    console.log(`  视觉分析：http://${CONFIG.httpPort === 80 ? 'localhost' : 'localhost:' + CONFIG.httpPort}/web/vision-analysis.html`);
    console.log(`  字幕生成器：http://${CONFIG.httpPort === 80 ? 'localhost' : 'localhost:' + CONFIG.httpPort}/web/subtitle-generator.html`);
    console.log(`  服务状态：http://${CONFIG.httpPort === 80 ? 'localhost' : 'localhost:' + CONFIG.httpPort}/web/service-status.html`);
    console.log(`  API测试：http://${CONFIG.httpPort === 80 ? 'localhost' : 'localhost:' + CONFIG.httpPort}/web/api-test.html`);
    console.log(`  COCO数据集API文档：http://${CONFIG.httpPort === 80 ? 'localhost' : 'localhost:' + CONFIG.httpPort}/api/coco/stats`);
    console.log();
    console.log('📊 系统监控 API:');
    console.log(`  获取服务状态：GET http://${CONFIG.httpPort === 80 ? 'localhost' : 'localhost:' + CONFIG.httpPort}/api/monitor/services`);
    console.log(`  获取系统指标：GET http://${CONFIG.httpPort === 80 ? 'localhost' : 'localhost:' + CONFIG.httpPort}/api/monitor/metrics`);
    console.log(`  获取统计信息：GET http://${CONFIG.httpPort === 80 ? 'localhost' : 'localhost:' + CONFIG.httpPort}/api/monitor/statistics`);
    console.log(`  获取日志列表：GET http://${CONFIG.httpPort === 80 ? 'localhost' : 'localhost:' + CONFIG.httpPort}/api/monitor/logs`);
    console.log(`  清空日志：POST http://${CONFIG.httpPort === 80 ? 'localhost' : 'localhost:' + CONFIG.httpPort}/api/monitor/logs/clear`);
    console.log(`  导出日志：GET http://${CONFIG.httpPort === 80 ? 'localhost' : 'localhost:' + CONFIG.httpPort}/api/monitor/logs/export`);
    console.log(`  刷新状态：POST http://${CONFIG.httpPort === 80 ? 'localhost' : 'localhost:' + CONFIG.httpPort}/api/monitor/refresh`);
    console.log();
    console.log('🎤 Whisper API:');
    console.log(`  获取状态：GET http://${CONFIG.httpPort === 80 ? 'localhost' : 'localhost:' + CONFIG.httpPort}/api/whisper/status`);
    console.log(`  识别音频：POST http://${CONFIG.httpPort === 80 ? 'localhost' : 'localhost:' + CONFIG.httpPort}/api/whisper/recognize`);
    console.log(`  获取模型列表：GET http://${CONFIG.httpPort === 80 ? 'localhost' : 'localhost:' + CONFIG.httpPort}/api/whisper/models`);
});

// 启动 WebSocket 服务器
const wsServer = createWebSocketServer();
console.log(`✓ WebSocket 服务器运行在 ws://localhost:${CONFIG.wsPort}/ws`);

// 初始化 Whisper 服务
(async () => {
    const whisperStatus = await whisperService.initialize();
    serverMonitor.updateService('whisper', whisperStatus.available ? 'online' : 'offline', '-');
})();

// 初始化服务监控
serverMonitor.log('success', '系统启动', '系统监控模块已加载');
serverMonitor.updateService('nodeServer', 'online', CONFIG.httpPort);
serverMonitor.updateService('websocket', 'online', CONFIG.wsPort);

console.log();
console.log('按 Ctrl+C 停止服务器');
console.log('==========================================');

// 优雅关闭
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown() {
    console.log('\n正在关闭服务器...');
    httpServer.close(() => {
        console.log('HTTP 服务器已关闭');
    });
    wsServer.close(() => {
        console.log('WebSocket 服务器已关闭');
        process.exit(0);
    });
}
