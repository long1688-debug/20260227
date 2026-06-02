/**
 * Whisper 语音识别服务
 * 基于 Python openai-whisper 库实现
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');

const execPromise = util.promisify(exec);

/**
 * 获取 ffmpeg 可执行文件路径
 * 如果在 PATH 中找不到，尝试常见安装位置
 */
function getFfmpegCommand() {
  // 先检查 PATH 中是否有 ffmpeg
  const pathEnv = process.env.Path || process.env.PATH || '';
  const pathSep = process.platform === 'win32' ? ';' : ':';
  const ffmpegDirs = [
    'C:\\ffmpeg\\bin',
  ];

  // 确保 ffmpeg 目录在 PATH 中
  for (const dir of ffmpegDirs) {
    if (fs.existsSync(dir) && !pathEnv.split(pathSep).includes(dir)) {
      process.env.Path = dir + pathSep + process.env.Path;
    }
  }

  return 'ffmpeg';
}

/**
 * Whisper 配置
 */
const WHISPER_CONFIG = {
  defaultModel: 'base',
  defaultLanguage: 'zh',
  supportedModels: ['tiny', 'base', 'small', 'medium', 'large'],
  sampleRate: 16000,
  tempDir: path.join(__dirname, '../temp')
};

/**
 * 检查 Python 和 Whisper 是否可用
 */
async function checkWhisperAvailable() {
  try {
    // 检查 Python
    const pythonCheck = await execPromise('python --version');
    if (!pythonCheck.stdout && !pythonCheck.stderr.includes('Python')) {
      // 尝试 python3
      await execPromise('python3 --version');
    }

    // 检查 whisper 库
    const whisperCheck = await execPromise('python -c "import whisper; print(\'OK\')"');
    if (!whisperCheck.stdout.includes('OK')) {
      return { available: false, message: 'whisper 库未安装' };
    }

    return { available: true, message: 'Whisper 可用' };
  } catch (error) {
    return { available: false, message: error.message };
  }
}

/**
 * 运行 Whisper 推理
 * @param {string} audioPath - 音频文件路径
 * @param {object} options - 配置选项
 * @returns {object} 识别结果
 */
async function runWhisper(audioPath, options = {}) {
  return new Promise((resolve, reject) => {
    const model = options.model || WHISPER_CONFIG.defaultModel;
    const language = options.language || WHISPER_CONFIG.defaultLanguage;
    const translate = options.translate || false;

    // 验证模型
    if (!WHISPER_CONFIG.supportedModels.includes(model)) {
      return reject(new Error(`不支持的模型: ${model}`));
    }

    // 构建 Python 脚本
    const pythonScript = `
import whisper
import json
import sys

try:
    model = whisper.load_model("${model}")
    result = model.transcribe(
        "${audioPath.replace(/\\/g, '\\\\')}",
        language="${language}",
        translate=${translate},
        verbose=False
    )

    segments = []
    for seg in result.get('segments', []):
        segments.append({
            'text': seg['text'].strip(),
            'start': seg['start'],
            'end': seg['end'],
            'confidence': seg.get('avg_logprob', 0.0)
        })

    output = {
        'success': True,
        'segments': segments,
        'full_text': result.get('text', '').strip(),
        'model': "${model}",
        'language': "${language}"
    }

    print(json.dumps(output, ensure_ascii=False))

except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}), file=sys.stderr)
    sys.exit(1)
`;

    // 创建临时脚本文件
    const scriptPath = path.join(WHISPER_CONFIG.tempDir, `whisper_script_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, pythonScript);

    // 执行命令
    const process = spawn('python', [scriptPath]);

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      // 清理临时文件
      try {
        fs.unlinkSync(scriptPath);
      } catch (e) {
        console.warn('[Whisper] 清理临时脚本失败:', e.message);
      }

      if (code !== 0) {
        return reject(new Error(`Whisper 执行失败: ${stderr || '未知错误'}`));
      }

      try {
        const result = JSON.parse(stdout);
        if (result.success) {
          resolve(result);
        } else {
          reject(new Error(result.error || '识别失败'));
        }
      } catch (e) {
        reject(new Error(`解析结果失败: ${e.message}`));
      }
    });

    process.on('error', (error) => {
      try {
        fs.unlinkSync(scriptPath);
      } catch (e) { }
      reject(new Error(`启动进程失败: ${error.message}`));
    });
  });
}

/**
 * 转换音频格式为 WAV (16kHz, 单声道)
 * @param {string} inputPath - 输入音频路径
 * @returns {string} 转换后的 WAV 文件路径
 */
async function convertToWav(inputPath) {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(WHISPER_CONFIG.tempDir, `audio_${Date.now()}.wav`);

    // 使用 ffmpeg 转换
    const ffmpegCmd = getFfmpegCommand();
    const process = spawn(ffmpegCmd, [
      '-i', inputPath,
      '-ar', '16000',
      '-ac', '1',
      '-f', 'wav',
      '-y',
      outputPath
    ]);

    let stderr = '';

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`音频转换失败: ${stderr}`));
      }
      resolve(outputPath);
    });

    process.on('error', (error) => {
      reject(new Error(`启动 ffmpeg 失败: ${error.message}`));
    });
  });
}

/**
 * 检查模型是否已下载
 * @param {string} modelName - 模型名称
 */
async function checkModelExists(modelName) {
  if (!WHISPER_CONFIG.supportedModels.includes(modelName)) {
    return { exists: false, valid: false };
  }

  try {
    // 调用 whisper 检查模型缓存
    const result = await execPromise(`python -c "import whisper; model = whisper.load_model('${modelName}'); print('OK')"`);
    return {
      exists: result.stdout.includes('OK'),
      valid: true,
      model: modelName
    };
  } catch (error) {
    return { exists: false, valid: true, error: error.message };
  }
}

/**
 * 获取可用模型列表
 */
async function getAvailableModels() {
  const models = [];

  for (const modelName of WHISPER_CONFIG.supportedModels) {
    const status = await checkModelExists(modelName);
    models.push({
      name: modelName,
      exists: status.exists,
      valid: status.valid,
      approximateSize: getModelSizeInfo(modelName)
    });
  }

  return models;
}

/**
 * 获取模型大小信息（预估）
 */
function getModelSizeInfo(modelName) {
  const sizes = {
    tiny: '~75 MB',
    base: '~142 MB',
    small: '~466 MB',
    medium: '~1.5 GB',
    large: '~6.1 GB'
  };
  return sizes[modelName] || '未知';
}

/**
 * 主服务类
 */
class WhisperService {
  constructor() {
    this.available = false;
    this.initialized = false;
  }

  /**
   * 初始化服务
   */
  async initialize() {
    const status = await checkWhisperAvailable();
    this.available = status.available;

    if (this.available) {
      console.log('[Whisper] ✅ Whisper 服务已就绪');
    } else {
      console.log('[Whisper] ⚠️ Whisper 不可用:', status.message);
    }

    this.initialized = true;
    return status;
  }

  /**
   * 获取服务状态
   */
  async getStatus() {
    if (!this.initialized) {
      await this.initialize();
    }

    const models = await getAvailableModels();

    return {
      available: this.available,
      initialized: this.initialized,
      defaultModel: WHISPER_CONFIG.defaultModel,
      defaultLanguage: WHISPER_CONFIG.defaultLanguage,
      models: models
    };
  }

  /**
   * 识别音频文件
   * @param {string} audioPath - 音频文件路径
   * @param {object} options - 识别选项
   */
  async recognizeFile(audioPath, options = {}) {
    if (!this.available) {
      throw new Error('Whisper 服务不可用');
    }

    const startTime = Date.now();

    try {
      // 检查文件是否存在
      if (!fs.existsSync(audioPath)) {
        throw new Error('音频文件不存在');
      }

      // 获取文件扩展名
      const ext = path.extname(audioPath).toLowerCase();

      let wavPath = audioPath;

      // 如果不是 WAV 格式，转换为 WAV
      if (ext !== '.wav') {
        wavPath = await convertToWav(audioPath);
      }

      // 运行 Whisper 识别
      const result = await runWhisper(wavPath, options);

      // 清理临时文件（如果转换过）
      if (wavPath !== audioPath) {
        try {
          fs.unlinkSync(wavPath);
        } catch (e) { }
      }

      const processingTime = Date.now() - startTime;

      return {
        ...result,
        processingTimeMs: processingTime,
        success: true
      };

    } catch (error) {
      throw new Error(`识别失败: ${error.message}`);
    }
  }

  /**
   * 识别音频缓冲区
   * @param {Buffer} audioBuffer - 音频数据缓冲区
   * @param {string} format - 音频格式
   * @param {object} options - 识别选项
   */
  async recognizeBuffer(audioBuffer, format = 'wav', options = {}) {
    if (!this.available) {
      throw new Error('Whisper 服务不可用');
    }

    // 创建临时文件
    const tempPath = path.join(WHISPER_CONFIG.tempDir, `audio_${Date.now()}.${format}`);

    try {
      // 写入临时文件
      fs.writeFileSync(tempPath, audioBuffer);

      // 调用文件识别
      const result = await this.recognizeFile(tempPath, options);

      return result;

    } finally {
      // 清理临时文件
      try {
        fs.unlinkSync(tempPath);
      } catch (e) { }
    }
  }
}

// 创建单例实例
const whisperService = new WhisperService();

// 模块导出
module.exports = {
  WhisperService,
  whisperService,
  checkWhisperAvailable,
  runWhisper,
  checkModelExists,
  getAvailableModels
};
