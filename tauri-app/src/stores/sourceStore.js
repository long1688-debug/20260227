import { defineStore } from 'pinia'
import apiService from '@/services/apiService'

export const useSourceStore = defineStore('source', {
  state: () => ({
    sources: [],
    selectedSource: null,
    // 存储每个信号源是否已添加到预览的状态
    sourcePreviewStatus: {},
    // 存储信号源的配置信息
    sourceConfigs: {},
    // 存储信号源的流连接状态
    sourceStreamStatus: {}
  }),

  getters: {
    // 按类型获取信号源
    cameraSources: (state) => state.sources.filter(s =>
      ['localCamera', 'networkCamera', 'captureCard', 'documentScanner', 'mrCamera', 'remoteCamera', 'mobileCamera'].includes(s.type)
    ),
    videoSources: (state) => state.sources.filter(s =>
      ['localVideo', 'networkStream'].includes(s.type)
    ),
    screenSources: (state) => state.sources.filter(s =>
      ['remoteDesktop', 'mobileScreen'].includes(s.type)
    ),
    documentSources: (state) => state.sources.filter(s =>
      ['ppt', 'word', 'pdf', 'excel', 'image', 'mindmap'].includes(s.type)
    ),

    // 获取所有已添加到预览的信号源
    previewSources: (state) => {
      // 🎯 修复：直接使用信号源对象的 addedToPreview 字段，确保与 SourceListManager 等组件一致
      return state.sources.filter(s => s.addedToPreview === true);
    },

    // 获取所有未添加到预览的信号源
    availableSources: (state) => {
      // 🎯 修复：直接使用信号源对象的 addedToPreview 字段，确保一致性
      return state.sources.filter(s => s.addedToPreview !== true);
    },

    // 获取特定类型的信号源
    sourcesByType: (state) => (type) => {
      return state.sources.filter(s => s.type === type);
    },

    // 获取信号源总数
    sourceCount: (state) => state.sources.length,

    // 获取在线信号源数量
    onlineSourceCount: (state) => {
      return state.sources.filter(s => s.status === 'online').length;
    }
  },

  actions: {
    // 初始化信号源
    async fetchSources() {
      try {
        console.log('[SourceStore] 开始从API获取信号源列表...');

        // 尝试从API获取信号源列表
        const apiSources = await apiService.get('/api/sources');

        if (apiSources && apiSources.length > 0) {
          this.sources = apiSources;
          console.log(`[SourceStore] 从API加载了 ${apiSources.length} 个信号源`);
        } else {
          // API无数据时使用本地模拟数据
          console.log('[SourceStore] API返回空数据，使用本地模拟数据');
          this.sources = [
            {
              id: 'camera-1',
              name: '教室摄像头',
              type: 'localCamera',
              resolution: '1920x1080',
              fps: 30,
              status: 'online',
              addedToPreview: false
            },
            {
              id: 'camera-2',
              name: '实验区摄像头',
              type: 'localCamera',
              resolution: '1280x720',
              fps: 30,
              status: 'online',
              addedToPreview: false
            },
            {
              id: 'video-1',
              name: '教学视频.mp4',
              type: 'localVideo',
              duration: '14:51',
              size: '256 MB',
              status: 'online',
              addedToPreview: false
            },
            {
              id: 'screen-1',
              name: '教师屏幕',
              type: 'remoteDesktop',
              resolution: '1920x1080',
              status: 'online',
              addedToPreview: false
            },
            {
              id: 'doc-1',
              name: '课件.pptx',
              type: 'ppt',
              status: 'online',
              addedToPreview: false
            }
          ];
        }

        // 初始化信号源预览状态
        this.sources.forEach(source => {
          this.sourcePreviewStatus[source.id] = false;
          this.sourceStreamStatus[source.id] = 'disconnected';
        });

        console.log('[SourceStore] 已初始化信号源列表');
      } catch (error) {
        console.warn('[SourceStore] API请求失败，使用本地模拟数据:', error);

        // API失败时使用本地模拟数据
        this.sources = [
          {
            id: 'camera-1',
            name: '教室摄像头',
            type: 'localCamera',
            resolution: '1920x1080',
            fps: 30,
            status: 'online',
            addedToPreview: false
          },
          {
            id: 'camera-2',
            name: '实验区摄像头',
            type: 'localCamera',
            resolution: '1280x720',
            fps: 30,
            status: 'online',
            addedToPreview: false
          },
          {
            id: 'video-1',
            name: '教学视频.mp4',
            type: 'localVideo',
            duration: '14:51',
            size: '256 MB',
            status: 'online',
            addedToPreview: false
          },
          {
            id: 'screen-1',
            name: '教师屏幕',
            type: 'remoteDesktop',
            resolution: '1920x1080',
            status: 'online',
            addedToPreview: false
          },
          {
            id: 'doc-1',
            name: '课件.pptx',
            type: 'ppt',
            status: 'online',
            addedToPreview: false
          }
        ];

        this.sources.forEach(source => {
          this.sourcePreviewStatus[source.id] = false;
          this.sourceStreamStatus[source.id] = 'disconnected';
        });
      }
    },

    // 添加信号源
    addSource(source) {
      // 🎯 去重检查：根据 deviceId 检查是否已存在（针对摄像头类设备）
      const hasDeviceId = source.deviceId || source.device?.deviceId;
      if (hasDeviceId) {
        const existingDevice = this.sources.find(s => s.deviceId === hasDeviceId);
        if (existingDevice) {
          console.warn(`[SourceStore] 设备已存在，跳过重复添加: ${source.name} (deviceId: ${hasDeviceId})`);
          return existingDevice;
        }
      }

      // 确保信号源有唯一ID
      const newSource = {
        ...source,
        id: source.id || `source-${Date.now()}`,
        status: source.status || 'offline',
        addedToPreview: source.addedToPreview ?? false,
        createdAt: new Date().toISOString()
      };

      // 添加到信号源列表
      this.sources.push(newSource);

      // 初始化信号源状态
      // 🎯 修复：使用 newSource.addedToPreview 初始化 sourcePreviewStatus，保持一致性
      this.sourcePreviewStatus[newSource.id] = newSource.addedToPreview ?? false;
      this.sourceStreamStatus[newSource.id] = 'disconnected';

      // 如果有配置信息，保存到配置对象
      if (source.config) {
        this.sourceConfigs[newSource.id] = source.config;
      }

      console.log(`[SourceStore] 已添加信号源: ${newSource.name} (${newSource.type})`);
      return newSource;
    },

    // 删除信号源
    removeSource(id) {
      const source = this.sources.find(s => s.id === id);
      if (!source) {
        console.warn(`[SourceStore] 尝试删除不存在的信号源: ${id}`);
        return false;
      }

      // 从预览状态中移除
      delete this.sourcePreviewStatus[id];

      // 从配置中移除
      delete this.sourceConfigs[id];

      // 从流状态中移除
      delete this.sourceStreamStatus[id];

      // 从列表中移除
      this.sources = this.sources.filter(s => s.id !== id);

      // 如果删除的是当前选中的信号源，清除选择
      if (this.selectedSource?.id === id) {
        this.selectedSource = null;
      }

      console.log(`[SourceStore] 已删除信号源: ${source.name}`);
      return true;
    },

    // 更新信号源信息
    updateSource(id, updates) {
      console.log(`[SourceStore] updateSource 被调用:`, { id, updates });

      const index = this.sources.findIndex(s => s.id === id);
      if (index === -1) {
        console.warn(`[SourceStore] 尝试更新不存在的信号源: ${id}`);
        console.log('[SourceStore] 当前 sources:', this.sources.map(s => ({ id: s.id, name: s.name })));
        return false;
      }

      // 🎯 修复：使用 splice 确保响应式更新
      // 创建新的对象
      const updatedSource = { ...this.sources[index], ...updates };
      // 使用 splice 替换数组元素，确保响应式更新
      this.sources.splice(index, 1, updatedSource);

      // 如果更新了配置，保存到配置对象
      if (updates.config) {
        this.sourceConfigs[id] = updates.config;
      }

      // 🎯 同步更新 sourcePreviewStatus（如果更新了 addedToPreview）
      if (updates.addedToPreview !== undefined) {
        this.sourcePreviewStatus[id] = updates.addedToPreview;
        console.log(`[SourceStore] ✅ 同步更新 sourcePreviewStatus: ${id} -> ${updates.addedToPreview}`);
        console.log(`[SourceStore] previewSources 数量:`, this.previewSources.length);
      }

      console.log(`[SourceStore] 已更新信号源: ${this.sources[index].name}`);
      return true;
    },

    // 选择信号源
    selectSource(source) {
      this.selectedSource = source;
      console.log(`[SourceStore] 已选择信号源: ${source.name}`);
    },

    // 清除选择
    clearSelection() {
      this.selectedSource = null;
      console.log('[SourceStore] 已清除信号源选择');
    },

    // 设置信号源预览状态
    setSourcePreviewStatus(id, status) {
      // 🎯 修复：确保 sourcePreviewStatus 已初始化（即使信号源已存在但状态未初始化）
      if (this.sourcePreviewStatus[id] === undefined) {
        this.sourcePreviewStatus[id] = false;
      }

      this.sourcePreviewStatus[id] = status;

      // 🎯 同步更新信号源的 addedToPreview 属性，保持一致性
      const sourceIndex = this.sources.findIndex(s => s.id === id);
      if (sourceIndex !== -1) {
        this.sources[sourceIndex] = { ...this.sources[sourceIndex], addedToPreview: status };
      }

      console.log(`[SourceStore] 已更新信号源预览状态: ${id} -> ${status ? '已添加' : '未添加'}`);
      return true;
    },

    // 添加信号源到预览（如果不存在则先添加信号源）
    addSourceToPreview(source) {
      // 检查信号源是否已存在
      const existingSource = this.sources.find(s => s.id === source.id);
      if (!existingSource) {
        // 如果不存在，先添加信号源
        this.addSource(source);
      }
      // 设置为已添加到预览
      this.setSourcePreviewStatus(source.id, true);
      console.log(`[SourceStore] 已将信号源添加到预览: ${source.name}`);
    },

    // 从预览中移除信号源
    removeSourceFromPreview(id) {
      this.setSourcePreviewStatus(id, false);
      console.log(`[SourceStore] 已从预览中移除信号源: ${id}`);
    },

    // 设置信号源流状态
    setSourceStreamStatus(id, status) {
      if (this.sourceStreamStatus[id] !== undefined) {
        this.sourceStreamStatus[id] = status;
        console.log(`[SourceStore] 已更新信号源流状态: ${id} -> ${status}`);
        return true;
      }
      return false;
    },

    // 获取信号源配置
    getSourceConfig(id) {
      return this.sourceConfigs[id] || null;
    },

    // 设置信号源配置
    setSourceConfig(id, config) {
      this.sourceConfigs[id] = config;
      console.log(`[SourceStore] 已设置信号源配置: ${id}`);
      return true;
    },

    // 连接信号源
    async connectSource(id) {
      const source = this.sources.find(s => s.id === id);
      if (!source) {
        console.warn(`[SourceStore] 尝试连接不存在的信号源: ${id}`);
        return false;
      }

      try {
        // 模拟连接过程
        this.setSourceStreamStatus(id, 'connecting');

        // 模拟连接延迟
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 设置为已连接
        this.setSourceStreamStatus(id, 'connected');
        this.updateSource(id, { status: 'online' });

        console.log(`[SourceStore] 已连接信号源: ${source.name}`);
        return true;
      } catch (error) {
        console.error(`[SourceStore] 连接信号源失败: ${source.name}`, error);
        this.setSourceStreamStatus(id, 'disconnected');
        return false;
      }
    },

    // 断开信号源
    disconnectSource(id) {
      const source = this.sources.find(s => s.id === id);
      if (!source) {
        console.warn(`[SourceStore] 尝试断开不存在的信号源: ${id}`);
        return false;
      }

      this.setSourceStreamStatus(id, 'disconnected');
      this.updateSource(id, { status: 'offline' });

      console.log(`[SourceStore] 已断开信号源: ${source.name}`);
      return true;
    },

    // 重置store
    reset() {
      this.sources = [];
      this.selectedSource = null;
      this.sourcePreviewStatus = {};
      this.sourceConfigs = {};
      this.sourceStreamStatus = {};
      console.log('[SourceStore] 已重置所有状态');
    }
  }
})
