// 模型自动下载服务
// 自动下载 Whisper 模型到本地缓存

export class ModelDownloader {
  constructor() {
    this.models = {
      whisper: {
        tiny: {
          name: 'Whisper Tiny',
          filename: 'ggml-tiny.bin',
          url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
          size: 39 * 1024 * 1024, // 39MB
          description: 'Tiny 模型 - 最快，适合实时字幕'
        },
        base: {
          name: 'Whisper Base',
          filename: 'ggml-base.bin',
          url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
          size: 74 * 1024 * 1024, // 74MB
          description: 'Base 模型 - 平衡，日常使用'
        },
        small: {
          name: 'Whisper Small',
          filename: 'ggml-small.bin',
          url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
          size: 244 * 1024 * 1024, // 244MB
          description: 'Small 模型 - 准确，重要场景'
        }
      },
      vosk: {
        'small-cn': {
          name: 'Vosk Small Chinese',
          filename: 'vosk-model-small-cn-0.22.zip',
          url: 'https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip',
          size: 40 * 1024 * 1024, // 40MB
          description: 'Vosk 小型中文模型'
        }
      }
    };

    this.cachePath = '/models/';
    this.downloading = false;
    this.downloadProgress = 0;
    this.downloadStatus = '';
  }

  // 检查模型是否存在
  async checkModel(modelType, modelName) {
    const model = this.models[modelType]?.[modelName];
    if (!model) {
      throw new Error(`模型 ${modelName} 不存在`);
    }

    try {
      const response = await fetch(`${this.cachePath}${model.filename}`, {
        method: 'HEAD'
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // 下载模型
  async downloadModel(modelType, modelName, onProgress, onComplete, onError) {
    if (this.downloading) {
      throw new Error('正在下载中');
    }

    const model = this.models[modelType]?.[modelName];
    if (!model) {
      throw new Error(`模型 ${modelName} 不存在`);
    }

    // 检查是否已存在
    const exists = await this.checkModel(modelType, modelName);
    if (exists) {
      onComplete?.(model);
      return model;
    }

    this.downloading = true;
    this.downloadProgress = 0;
    this.downloadStatus = '准备下载...';

    try {
      // 开始下载
      this.downloadStatus = '正在下载...';
      
      const response = await fetch(model.url);
      if (!response.ok) {
        throw new Error(`下载失败: ${response.status}`);
      }

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : model.size;
      let loaded = 0;

      const reader = response.body.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        chunks.push(value);
        loaded += value.length;

        this.downloadProgress = Math.round((loaded / total) * 100);
        this.downloadStatus = `下载中... ${this.downloadProgress}%`;
        
        onProgress?.({
          progress: this.downloadProgress,
          loaded: loaded,
          total: total
        });
      }

      // 合并数据
      const blob = new Blob(chunks);
      
      // 保存到本地
      await this.saveModel(blob, model.filename);

      this.downloading = false;
      this.downloadStatus = '下载完成';
      
      onComplete?.(model);
      
      return model;
      
    } catch (error) {
      this.downloading = false;
      this.downloadStatus = '下载失败';
      
      onError?.(error);
      
      throw error;
    }
  }

  // 保存模型到本地
  async saveModel(blob, filename) {
    // 在实际项目中，这里需要通过 Tauri API 保存文件
    // 这里使用 localStorage 作为演示（实际不能存储大文件）
    
    const modelInfo = {
      filename: filename,
      size: blob.size,
      type: blob.type,
      timestamp: Date.now(),
      data: await this.blobToBase64(blob)
    };

    // 注意：localStorage 只能存储约5MB，大文件需要使用文件系统 API
    // 实际项目中应该使用 Tauri 的 fs API
    try {
      localStorage.setItem(`model_${filename}`, JSON.stringify(modelInfo));
      console.log(`模型 ${filename} 已保存`);
    } catch (error) {
      console.warn('保存到 localStorage 失败，需要使用文件系统');
      // 在实际项目中，这里应该调用 Tauri API
      const tauriApi = await import("../utils/tauri-api.js"); const modelData = await this.blobToBase64(blob); await tauriApi.writeFile("models/" + filename, modelData);
    }
  }

  // Blob 转 Base64
  async blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // 获取已下载的模型列表
  async getDownloadedModels() {
    const models = [];
    
    for (const type in this.models) {
      for (const name in this.models[type]) {
        const model = this.models[type][name];
        const exists = await this.checkModel(type, name);
        
        if (exists) {
          models.push({
            type: type,
            name: name,
            ...model,
            downloaded: true
          });
        }
      }
    }
    
    return models;
  }

  // 删除模型
  async deleteModel(modelType, modelName) {
    const model = this.models[modelType]?.[modelName];
    if (!model) {
      throw new Error(`模型 ${modelName} 不存在`);
    }

    try {
      localStorage.removeItem(`model_${model.filename}`);
      
      // 在实际项目中，需要通过 Tauri API 删除文件
      const tauriDel = await import("../utils/tauri-api.js"); await tauriDel.deleteModel(model.filename);
      
      console.log(`模型 ${modelName} 已删除`);
    } catch (error) {
      console.error('删除模型失败:', error);
      throw error;
    }
  }

  // 清空所有模型缓存
  async clearCache() {
    for (const type in this.models) {
      for (const name in this.models[type]) {
        const model = this.models[type][name];
        try {
          localStorage.removeItem(`model_${model.filename}`);
        } catch (error) {
          console.warn(`清理模型 ${name} 失败:`, error);
        }
      }
    }
    
    // 在实际项目中，需要通过 Tauri API 清空缓存目录
    const tauriClear = await import("../utils/tauri-api.js"); await tauriClear.clearModelCache();
  }

  // 获取模型信息
  getModelInfo(modelType, modelName) {
    return this.models[modelType]?.[modelName];
  }

  // 获取所有模型信息
  getAllModels() {
    return this.models;
  }
}

// 导出单例
export const modelDownloader = new ModelDownloader();
