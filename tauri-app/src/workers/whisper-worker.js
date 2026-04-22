// Whisper Web Worker
// 完全本地运行，无需联网

self.importScripts('/lib/whisper.wasm.js');

let whisper = null;
let model = null;

// 初始化 Whisper 模型
async function initWhisper(modelName = 'tiny', language = 'zh') {
  try {
    // 模型文件路径
    const modelPath = `/models/${modelName}.bin`;
    
    // 初始化 Whisper
    whisper = new Whisper({
      model: modelPath,
      language: language,
      task: 'transcribe',
      qmode: 0
    });

    // 加载模型
    await whisper.loadModel();
    
    self.postMessage({
      type: 'ready',
      data: { model: modelName, language }
    });

  } catch (error) {
    console.error('初始化 Whisper 失败:', error);
    self.postMessage({
      type: 'error',
      data: {
        error: 'init_failed',
        message: '初始化失败: ' + error.message
      }
    });
  }
}

// 识别音频
async function transcribe(audioData, language = 'zh') {
  try {
    if (!whisper) {
      throw new Error('Whisper 未初始化');
    }

    // 执行识别
    const result = await whisper.transcribe(audioData, {
      language: language,
      word_timestamps: true,
      segment_timestamps: true
    });

    // 转换为字幕格式
    const segments = result.segments.map(seg => ({
      startTime: formatTime(seg.start),
      endTime: formatTime(seg.end),
      text: seg.text.trim()
    }));

    self.postMessage({
      type: 'result',
      data: {
        text: result.text,
        segments: segments
      }
    });

  } catch (error) {
    console.error('识别失败:', error);
    self.postMessage({
      type: 'error',
      data: {
        error: 'transcribe_failed',
        message: '识别失败: ' + error.message
      }
    });
  }
}

// 格式化时间戳
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

// 监听主线程消息
self.onmessage = async (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'init':
      await initWhisper(data.model, data.language);
      break;

    case 'transcribe':
      await transcribe(data.audio, data.language);
      break;

    case 'stop':
      // 停止识别
      if (whisper && whisper.abort) {
        whisper.abort();
      }
      self.postMessage({ type: 'end' });
      break;

    case 'set_language':
      // 设置语言
      if (whisper) {
        whisper.setLanguage(data.language);
      }
      break;

    default:
      console.warn('未知消息类型:', type);
  }
};

// 错误处理
self.onerror = (error) => {
  console.error('Worker 错误:', error);
  self.postMessage({
    type: 'error',
    data: {
      error: 'worker_error',
      message: error.message
    }
  });
};
