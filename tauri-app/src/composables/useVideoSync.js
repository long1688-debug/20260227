import { ref, reactive, watch } from 'vue';
import { useLayoutStorage } from './useLayoutStorage';
import { useLayoutStates } from './useLayoutStates';

// ==================== 核心状态管理 ====================
// 布局相关状态
const currentLayout = ref(1); // 当前布局模式：1=1分屏, 2=2分屏, 3=3分屏, 4=4分屏
const pipVisible = ref(false); // 是否显示画中画
const pipPosition = ref(''); // 画中画位置

// 视频源管理
const videoPreviews = ref([]); // 视频预览列表
const videoPreviewRefs = ref({}); // 视频预览元素引用映射 { sourceId: ref }
const canvasSourceMap = ref({}); // 画布-源映射 { canvasIndex: sourceId }

// 🎯 新增：信号源完整列表（从 useVideoStore 迁移）
const allSources = ref([]);

// 🎯 新增：当前选中的信号源
const currentSelectedSource = ref(null);
const currentSelectedSourceIndex = ref(-1);

// 🎯 新增：最大化状态
const isMaximized = ref(false);
const maximizedIndex = ref(null);

// 🎯 布局状态管理 - 每个布局独立保存信号源配置
const { layoutStates, switchLayout: layoutSwitch, assignSource: layoutAssignSource, saveToStorage } = useLayoutStates();

// 🎯 新增：录制状态 (使用 Map)
const canvasRecordingStates = ref(new Map());

/**
 * 视频同步管理 Composable - 主从架构重构版
 *
 * 架构设计:
 * 1. 主从同步模式: 预览区域作为 Master (主控),画布作为 Slave (从属)
 * 2. 状态复制: 画布完全复制预览区域的状态 (进度、播放/暂停)
 * 3. 音频路由: 画布默认静音,只有预览区域有声音;用户可选择哪个画布输出音频
 * 4. 🎯 支持多个 Master：每个视频源有自己的 Master-Slave 关系
 */

/**
 * 🎯 状态复制器 - 支持多个 Master + Slave 横向同步
 *
 * 核心原则:
 * 1. 每个视频源有自己的 Master（预览区域）和 Slaves（画布）
 * 2. Master 唯一且权威 - 只有 Master 能发起状态变更
 * 3. Slave 仅消费 - 绝对不反向影响 Master
 * 4. 严格单向广播 - 从 Master 到 Slave 的单向数据流
 * 5. 🎯 Slave 横向同步 - 当同一 sourceId 有多个 Slave 时，任意一个 Slave 的操作会同步到其他 Slave
 */
class SyncStateReplicator {
  constructor() {
    // 🎯 支持多个 Master：sourceId -> { video, syncIntervalId, lastPlayTime }
    this.masters = new Map();

    // 🎯 Slave 按 sourceId 分组：sourceId -> Map<canvasId, { video, syncEnabled, lastSyncedTime, registeredAt }>
    this.slaveGroups = new Map();

    this.syncThreshold = 0.05; // 🎯 提高精度：时间偏差阈值 (秒),超过此值才同步
    this.isReplicating = false; // 防止循环同步标记
    this.enableStrictMode = true; // 启用严格模式：Slave 禁止自主播放/暂停

    // 🎯 新增：Slave 横向同步 - 当同一 sourceId 有多个 Slave 时，任意一个 Slave 的操作会同步到其他 Slave
    this.enableSlaveCrossSync = true;

    // 🎯 新增：同步间隔配置
    this.syncInterval = 100; // 定时同步间隔(ms)
    this.maxSyncAttempts = 5; // 最大同步尝试次数

    // 🎯 新增：错误统计
    this.errorCount = new Map(); // sourceId -> errorCount
    this.maxErrorsBeforeDisable = 10; // 连续错误超过此值时禁用同步

    // 🎯 新增：同步状态追踪
    this.syncStatus = new Map(); // sourceId -> { isSyncing, lastSyncTime, avgLatency }

    // 🎯 新增：定时清理过期的同步状态
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleSyncStates();
    }, 30000); // 每30秒清理一次
  }

  /**
   * 清理过期的同步状态
   */
  cleanupStaleSyncStates() {
    // 清理不存在的视频元素的Master
    for (const [sourceId, master] of this.masters.entries()) {
      if (!master.video || !document.contains(master.video)) {
        console.log(`[状态复制器] 清理过期Master: ${sourceId}`);
        this.clearMaster(sourceId);
      }
    }

    // 清理不存在的视频元素的Slaves
    for (const [sourceId, slaves] of this.slaveGroups.entries()) {
      for (const [canvasId, slave] of slaves.entries()) {
        if (!slave.video || !document.contains(slave.video)) {
          console.log(`[状态复制器] 清理过期Slave: ${canvasId} -> ${sourceId}`);
          slaves.delete(canvasId);
        }
      }
      if (slaves.size === 0) {
        this.slaveGroups.delete(sourceId);
      }
    }
  }

  /**
   * 注册主控视频 (预览区域) - 支持多个 Master
   * @param {HTMLVideoElement} videoElement - 视频元素
   * @param {string} sourceId - 信号源ID
   */
  registerMaster(videoElement, sourceId) {
    console.log(`[严格同步器] 准备注册主控: ${sourceId}`);

    // 🎯 参数验证
    if (!videoElement || !(videoElement instanceof HTMLVideoElement)) {
      console.error(`[严格同步器] ❌ 无效的视频元素: ${sourceId}`);
      return;
    }

    // 🎯 如果该 sourceId 已有 Master，先清除
    if (this.masters.has(sourceId)) {
      console.log(`[严格同步器] 清除旧主控: ${sourceId}`);
      this.clearMaster(sourceId);
    }

    // 🎯 创建新的 Master
    const master = {
      video: videoElement,
      lastPlayTime: videoElement.currentTime,
      syncIntervalId: null,
      registeredAt: Date.now(),
      isActive: true
    };

    this.masters.set(sourceId, master);

    // 🎯 设置 Master 事件监听器
    this.setupMasterEventListeners(sourceId);

    console.log(`[严格同步器] ✅ 主控注册成功: ${sourceId}, muted: ${videoElement.muted}, readyState: ${videoElement.readyState}`);

    // 🎯 立即开始同步循环
    this.startSyncLoop(sourceId);
  }

  /**
   * 设置 Master 事件监听器
   * @param {string} sourceId - 信号源ID
   */
  setupMasterEventListeners(sourceId) {
    const master = this.masters.get(sourceId);
    if (!master) return;

    // 🎯 监听播放事件
    master.video.addEventListener('play', () => {
      if (master.isActive) {
        console.log(`[严格同步器] 📢 Master 播放: ${sourceId}`);
        this.syncToSlaves(sourceId, 'play');
      }
    });

    // 🎯 监听暂停事件
    master.video.addEventListener('pause', () => {
      if (master.isActive) {
        console.log(`[严格同步器] ⏸️ Master 暂停: ${sourceId}`);
        this.syncToSlaves(sourceId, 'pause');
      }
    });

    // 🎯 监听时间更新事件
    master.video.addEventListener('timeupdate', () => {
      if (master.isActive) {
        master.lastPlayTime = master.video.currentTime;
      }
    });
  }

  /**
   * 开始同步循环
   * @param {string} sourceId - 信号源ID
   */
  startSyncLoop(sourceId) {
    const master = this.masters.get(sourceId);
    if (!master) return;

    // 🎯 如果已有同步循环，先清除
    if (master.syncIntervalId) {
      clearInterval(master.syncIntervalId);
    }

    // 🎯 创建新的同步循环
    master.syncIntervalId = setInterval(() => {
      if (master.isActive) {
        this.syncToSlaves(sourceId);
      }
    }, this.syncInterval);
  }

  /**
   * 注册从属视频 (画布区域) - 按 sourceId 分组
   * @param {HTMLVideoElement} videoElement - 视频元素
   * @param {number} canvasId - 画布ID
   * @param {string} sourceId - 信号源ID
   */
  registerSlave(videoElement, canvasId, sourceId) {
    console.log(`[严格同步器] 准备注册从属: ${canvasId} -> ${sourceId}`);

    // 🎯 参数验证
    if (!videoElement || !(videoElement instanceof HTMLVideoElement)) {
      console.error(`[严格同步器] ❌ 无效的视频元素: ${canvasId} -> ${sourceId}`);
      return;
    }

    // 🎯 检查 Master 是否存在
    const master = this.masters.get(sourceId);
    if (!master) {
      console.warn(`[严格同步器] ⚠️ Master不存在，延迟同步 (尝试 1/5): ${sourceId}`);

      // 🎯 尝试延迟注册
      let attempts = 1;
      const maxAttempts = 5;
      const retryInterval = setInterval(() => {
        attempts++;
        const currentMaster = this.masters.get(sourceId);
        if (currentMaster) {
          console.log(`[严格同步器] ✅ Master已存在，完成从属注册: ${canvasId} -> ${sourceId}`);
          clearInterval(retryInterval);

          // 执行注册
          this.performSlaveRegistration(videoElement, canvasId, sourceId);

          // 立即同步状态
          this.syncSlaveToMaster(canvasId, sourceId);
        } else if (attempts >= maxAttempts) {
          console.error(`[严格同步器] ❌ Master不存在，放弃同步: ${sourceId}`);
          clearInterval(retryInterval);

          // 尝试检查是否为实时流（摄像头等），如果是则直接播放
          if (videoElement.srcObject && videoElement.srcObject instanceof MediaStream) {
            console.log(`[严格同步器] 🎯 检测到实时流 (摄像头)，从属直接播放: ${canvasId}`);
            videoElement.play().catch(e => console.error(`播放失败: ${e.message}`));
            console.log(`[严格同步器] ✅ 实时流从属播放成功: ${canvasId}`);
          }
        } else {
          console.warn(`[严格同步器] ⚠️ Master不存在，延迟同步 (尝试 ${attempts}/${maxAttempts}): ${sourceId}`);
        }
      }, 500);
      return;
    }

    // 🎯 执行从属注册
    this.performSlaveRegistration(videoElement, canvasId, sourceId);

    // 🎯 立即同步状态
    this.syncSlaveToMaster(canvasId, sourceId);
  }

  /**
   * 执行从属注册
   * @param {HTMLVideoElement} videoElement - 视频元素
   * @param {number} canvasId - 画布ID
   * @param {string} sourceId - 信号源ID
   */
  performSlaveRegistration(videoElement, canvasId, sourceId) {
    // 🎯 确保该 sourceId 的 slaves 组存在
    if (!this.slaveGroups.has(sourceId)) {
      this.slaveGroups.set(sourceId, new Map());
    }

    const slaves = this.slaveGroups.get(sourceId);

    // 🎯 如果该 canvasId 已存在，先移除
    if (slaves.has(canvasId)) {
      console.log(`[严格同步器] 清除旧从属: ${canvasId} -> ${sourceId}`);
      this.removeSlave(canvasId, sourceId);
    }

    // 🎯 创建新的从属
    const slave = {
      video: videoElement,
      syncEnabled: true,
      lastSyncedTime: Date.now(),
      registeredAt: Date.now(),
      errorCount: 0
    };

    slaves.set(canvasId, slave);

    // 🎯 设置从属静音（音频由 Master 输出）
    videoElement.muted = true;

    // 🎯 设置从属事件监听器
    this.setupSlaveEventListeners(canvasId, sourceId);

    console.log(`[严格同步器] ✅ 从属注册成功: ${canvasId} -> ${sourceId}`);
  }

  /**
   * 设置从属事件监听器
   * @param {number} canvasId - 画布ID
   * @param {string} sourceId - 信号源ID
   */
  setupSlaveEventListeners(canvasId, sourceId) {
    const slave = this.getSlave(canvasId, sourceId);
    if (!slave) return;

    // 🎯 监听从属播放事件（用于横向同步）
    slave.video.addEventListener('play', () => {
      if (this.enableSlaveCrossSync) {
        // 同步到同组的其他从属
        this.syncSlaveToOtherSlaves(canvasId, sourceId, 'play');
      }
    });

    // 🎯 监听从属暂停事件
    slave.video.addEventListener('pause', () => {
      if (this.enableSlaveCrossSync) {
        // 同步到同组的其他从属
        this.syncSlaveToOtherSlaves(canvasId, sourceId, 'pause');
      }
    });
  }

  /**
   * 同步从属到其他同组从属
   * @param {number} sourceCanvasId - 源画布ID
   * @param {string} sourceId - 信号源ID
   * @param {string} eventType - 事件类型 ('play' | 'pause')
   */
  syncSlaveToOtherSlaves(sourceCanvasId, sourceId, eventType) {
    const slaves = this.slaveGroups.get(sourceId);
    if (!slaves) return;

    for (const [canvasId, slave] of slaves.entries()) {
      if (canvasId !== sourceCanvasId && slave.syncEnabled) {
        if (eventType === 'play') {
          slave.video.play().catch(e => console.error(`从属播放失败: ${e.message}`));
        } else if (eventType === 'pause') {
          slave.video.pause();
        }
      }
    }
  }

  /**
   * 同步从属到主控
   * @param {number} canvasId - 画布ID
   * @param {string} sourceId - 信号源ID
   */
  syncSlaveToMaster(canvasId, sourceId) {
    const master = this.masters.get(sourceId);
    const slave = this.getSlave(canvasId, sourceId);

    if (!master || !slave) return;

    // 🎯 同步播放/暂停状态
    if (master.video.paused !== slave.video.paused) {
      if (master.video.paused) {
        slave.video.pause();
      } else {
        slave.video.play().catch(e => {
          console.error(`从属播放失败: ${e.message}`);
          // 🎯 增加错误计数
          slave.errorCount++;
          if (slave.errorCount >= this.maxErrorsBeforeDisable) {
            console.warn(`[严格同步器] 从属错误过多，禁用同步: ${canvasId} -> ${sourceId}`);
            slave.syncEnabled = false;
          }
        });
      }
    }

    // 🎯 同步播放时间
    const timeDiff = Math.abs(master.video.currentTime - slave.video.currentTime);
    if (timeDiff > this.syncThreshold) {
      slave.video.currentTime = master.video.currentTime;
    }
  }

  /**
   * 同步到从属
   * @param {string} sourceId - 信号源ID
   * @param {string} eventType - 事件类型 ('play' | 'pause' | undefined)
   */
  syncToSlaves(sourceId, eventType) {
    const master = this.masters.get(sourceId);
    const slaves = this.slaveGroups.get(sourceId);

    if (!master || !slaves) return;

    for (const [canvasId, slave] of slaves.entries()) {
      if (!slave.syncEnabled) continue;

      // 🎯 如果指定了事件类型，则执行相应操作
      if (eventType === 'play') {
        slave.video.play().catch(e => console.error(`从属播放失败: ${e.message}`));
      } else if (eventType === 'pause') {
        slave.video.pause();
      } else {
        // 🎯 同步播放/暂停状态
        if (master.video.paused !== slave.video.paused) {
          if (master.video.paused) {
            slave.video.pause();
          } else {
            slave.video.play().catch(e => {
              console.error(`从属播放失败: ${e.message}`);
              // 🎯 增加错误计数
              slave.errorCount++;
              if (slave.errorCount >= this.maxErrorsBeforeDisable) {
                console.warn(`[严格同步器] 从属错误过多，禁用同步: ${canvasId} -> ${sourceId}`);
                slave.syncEnabled = false;
              }
            });
          }
        }

        // 🎯 同步播放时间
        const timeDiff = Math.abs(master.video.currentTime - slave.video.currentTime);
        if (timeDiff > this.syncThreshold) {
          slave.video.currentTime = master.video.currentTime;
        }
      }
    }
  }

  /**
   * 获取从属
   * @param {number} canvasId - 画布ID
   * @param {string} sourceId - 信号源ID
   * @returns {Object|undefined} 从属对象
   */
  getSlave(canvasId, sourceId) {
    const slaves = this.slaveGroups.get(sourceId);
    if (!slaves) return undefined;

    return slaves.get(canvasId);
  }

  /**
   * 移除从属
   * @param {number} canvasId - 画布ID
   * @param {string} sourceId - 信号源ID
   */
  removeSlave(canvasId, sourceId) {
    console.log(`[状态复制器] 准备移除从属: ${canvasId} -> ${sourceId}`);

    const slaves = this.slaveGroups.get(sourceId);
    if (!slaves) {
      console.warn(`[状态复制器] ⚠️ 未找到要移除的从属: ${canvasId}`);
      return;
    }

    if (slaves.has(canvasId)) {
      slaves.delete(canvasId);
      console.log(`[状态复制器] ✅ 已从 ${sourceId} 组移除: ${canvasId}`);
    } else {
      console.warn(`[状态复制器] ⚠️ 未找到要移除的从属: ${canvasId}`);
    }

    // 🎯 如果该组没有从属了，删除整个组
    if (slaves.size === 0) {
      this.slaveGroups.delete(sourceId);
    }

    console.log(`[状态复制器] 移除从属完成: ${canvasId}`);
  }

  /**
   * 清除主控
   * @param {string} sourceId - 信号源ID
   */
  clearMaster(sourceId) {
    const master = this.masters.get(sourceId);
    if (!master) return;

    // 🎯 清除同步循环
    if (master.syncIntervalId) {
      clearInterval(master.syncIntervalId);
    }

    // 🎯 从 Map 中删除
    this.masters.delete(sourceId);

    console.log(`[严格同步器] 主控已清除: ${sourceId}`);
  }

  /**
   * 销毁所有同步状态
   */
  destroy() {
    // 清除所有同步循环
    for (const [sourceId, master] of this.masters.entries()) {
      if (master.syncIntervalId) {
        clearInterval(master.syncIntervalId);
      }
    }

    // 清空所有状态
    this.masters.clear();
    this.slaveGroups.clear();
    this.errorCount.clear();
    this.syncStatus.clear();

    // 清除清理定时器
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * 停止定时同步器
   */
  stopPeriodicSync(sourceId) {
    const master = this.masters.get(sourceId);
    if (master && master.syncIntervalId) {
      clearInterval(master.syncIntervalId);
      master.syncIntervalId = null;
      console.log(`[严格同步器] 定时同步器已停止: ${sourceId}`);
    }
  }

  // ========== 事件处理器 ==========

  onMasterTimeUpdate = (sourceId) => {
    if (this.isReplicating) return;
    const slaves = this.slaveGroups.get(sourceId);
    if (!slaves) return;

    slaves.forEach((_, canvasId) => {
      this.checkAndReplicate(canvasId, sourceId);
    });
  };

  onMasterPlay = (sourceId) => {
    console.log(`[严格同步器] 📢 Master 播放: ${sourceId}`);
    const slaves = this.slaveGroups.get(sourceId);
    if (!slaves) return;

    slaves.forEach((_, canvasId) => {
      this.replicateTo(canvasId, sourceId);
    });
  };

  onMasterPause = (sourceId) => {
    console.log(`[严格同步器] ⏸️ Master 暂停: ${sourceId}`);
    const slaves = this.slaveGroups.get(sourceId);
    if (!slaves) return;

    slaves.forEach((_, canvasId) => {
      this.replicateTo(canvasId, sourceId);
    });
  };

  onMasterSeeked = (sourceId) => {
    console.log(`[严格同步器] ⏩ Master 跳转: ${sourceId}`);
    const slaves = this.slaveGroups.get(sourceId);
    if (!slaves) return;

    slaves.forEach((_, canvasId) => {
      this.forceReplicateTo(canvasId, sourceId);
    });
  };

  onMasterRateChange = (sourceId) => {
    const master = this.masters.get(sourceId);
    if (!master) return;

    console.log(`[严格同步器] 🔄 Master 速率变化 (${master.video.playbackRate}x): ${sourceId}`);
    const slaves = this.slaveGroups.get(sourceId);
    if (!slaves) return;

    slaves.forEach((_, canvasId) => {
      this.replicateTo(canvasId, sourceId);
    });
  };

  // ========== 🎯 Slave 横向同步事件处理器 ==========

  onSlavePlay = (canvasId, sourceId) => {
    if (!this.enableSlaveCrossSync) return;
    if (this.isReplicating) return;

    console.log(`[严格同步器] 📢 Slave 播放: canvasId=${canvasId}, sourceId=${sourceId}`);
    // 同步到其他 Slave（排除当前触发者）
    this.syncSlavesExcept(canvasId, sourceId, 'play');
  };

  onSlavePause = (canvasId, sourceId) => {
    if (!this.enableSlaveCrossSync) return;
    if (this.isReplicating) return;

    console.log(`[严格同步器] ⏸️ Slave 暂停: canvasId=${canvasId}, sourceId=${sourceId}`);
    this.syncSlavesExcept(canvasId, sourceId, 'pause');
  };

  onSlaveSeeked = (canvasId, sourceId) => {
    if (!this.enableSlaveCrossSync) return;
    if (this.isReplicating) return;

    console.log(`[严格同步器] ⏩ Slave 跳转: canvasId=${canvasId}, sourceId=${sourceId}`);
    this.syncSlavesExcept(canvasId, sourceId, 'seeked');
  };

  /**
   * 🎯 Slave 横向同步核心方法
   * 同步给同一 sourceId 的其他 Slave（排除触发者）
   */
  syncSlavesExcept(excludeCanvasId, sourceId, action) {
    const slaves = this.slaveGroups.get(sourceId);
    if (!slaves || slaves.size <= 1) return;

    const master = this.masters.get(sourceId);
    if (!master || !master.video) return;

    // 🛑 关键修复：获取触发同步的 Slave 的源 ID
    const triggerSlave = slaves.get(excludeCanvasId);
    if (!triggerSlave || !triggerSlave.video) return;
    const triggerSourceId = this.getSlaveSourceId(excludeCanvasId);

    // 🛑 关键修复：确保触发者和目标属于同一个源
    // 只有同一个源的视频才允许同步
    if (triggerSourceId !== sourceId) {
      console.log(`[严格同步器] 🚫 源不匹配，拒绝横向同步: 触发者(${triggerSourceId}) != 目标组(${sourceId})`);
      return;
    }

    this.isReplicating = true;
    const masterVideo = master.video;

    try {
      slaves.forEach((slave, targetCanvasId) => {
        // 跳过触发同步的 Slave
        if (targetCanvasId === excludeCanvasId) return;

        const slaveVideo = slave.video;
        if (!slaveVideo) return;

        // 🛑 再次检查：确保目标 Slave 也属于同一个源
        const targetSourceId = this.getSlaveSourceId(targetCanvasId);
        if (targetSourceId !== sourceId) {
          console.log(`[严格同步器] 🚫 目标源不匹配，跳过同步: 目标(${targetSourceId}) != 触发者(${sourceId})`);
          return;
        }

        console.log(`[严格同步器] 🔄 Slave 横向同步: ${excludeCanvasId} -> ${targetCanvasId} (${action})`);

        // 根据动作类型执行同步
        if (action === 'seeked') {
          // 跳转：同步时间点
          slaveVideo.currentTime = masterVideo.currentTime;
          slave.lastSyncedTime = masterVideo.currentTime;
        } else if (action === 'play') {
          // 播放：检查是否有有效源
          const hasValidSource = (slaveVideo.src || slaveVideo.srcObject) &&
            slaveVideo.readyState >= 2 &&
            slaveVideo.networkState !== 3 &&
            slaveVideo.error === null;

          if (hasValidSource && slaveVideo.paused) {
            slaveVideo.play().catch(err => {
              console.warn(`[严格同步器] ⚠️ Slave 横向播放失败: ${targetCanvasId}`, err);
            });
          }
        } else if (action === 'pause') {
          // 暂停
          if (!slaveVideo.paused) {
            slaveVideo.pause();
          }
        }

        // 同步播放速率
        if (slaveVideo.playbackRate !== masterVideo.playbackRate) {
          slaveVideo.playbackRate = masterVideo.playbackRate;
        }

        // 保持静音
        if (!slaveVideo.muted && this.enableStrictMode) {
          slaveVideo.muted = true;
        }
      });
    } finally {
      this.isReplicating = false;
    }
  }

  // ========== 同步方法 ==========

  checkAndReplicate(canvasId, sourceId) {
    const slaves = this.slaveGroups.get(sourceId);
    const master = this.masters.get(sourceId);
    if (!slaves || !master) return;

    const slave = slaves.get(canvasId);
    if (!slave || !slave.video || !master.video) return;

    const timeDiff = Math.abs(slave.video.currentTime - master.video.currentTime);
    if (timeDiff > this.syncThreshold) {
      console.log(`[严格同步器] ⚠️ Slave ${canvasId} 偏差 ${timeDiff.toFixed(2)}s，触发同步`);
      this.replicateTo(canvasId, sourceId);
    }
  }

  replicateTo(canvasId, sourceId) {
    const slaves = this.slaveGroups.get(sourceId);
    const master = this.masters.get(sourceId);
    if (!slaves || !master) return;

    const slave = slaves.get(canvasId);
    if (!slave || !slave.video || !master.video) return;

    this.isReplicating = true;

    const slaveVideo = slave.video;
    const masterVideo = master.video;

    try {
      // 1. 同步时间点
      const timeDiff = Math.abs(slaveVideo.currentTime - masterVideo.currentTime);
      if (timeDiff > this.syncThreshold) {
        slaveVideo.currentTime = masterVideo.currentTime;
        slave.lastSyncedTime = masterVideo.currentTime;
        console.log(`[严格同步器] ⏱️ 同步时间: ${canvasId} -> ${sourceId}, 偏差=${timeDiff.toFixed(2)}s`);
      }

      // 2. 同步播放状态
      if (masterVideo.paused && !slaveVideo.paused) {
        slaveVideo.pause();
        console.log(`[严格同步器] ⏸️ 同步暂停: ${canvasId} -> ${sourceId}`);
      } else if (!masterVideo.paused && slaveVideo.paused) {
        // 🎯 关键修复：严格检查视频元素是否已挂载且有有效源
        // 必须同时满足：有 src/srcObject 且 readyState >= 2 (HAVE_CURRENT_DATA) 且没有网络错误
        const hasValidSource = (slaveVideo.src || slaveVideo.srcObject) &&
          slaveVideo.readyState >= 2 &&
          slaveVideo.networkState !== 3 && // NETWORK_NO_SOURCE
          slaveVideo.error === null;

        if (hasValidSource) {
          slaveVideo.play().catch(err => {
            console.warn(`[严格同步器] ⚠️ Slave 播放失败: ${canvasId}`, err);
            // 🎯 如果播放失败是因为没有有效源，解除注册避免持续尝试
            if (err.name === 'NotSupportedError' || err.name === 'NotAllowedError') {
              console.log(`[严格同步器] 🗑️ 移除无效从属: ${canvasId} -> ${sourceId}`);
              this.removeSlave(canvasId, sourceId);
            }
          });
          console.log(`[严格同步器] ▶️ 同步播放: ${canvasId} -> ${sourceId}`);
        } else {
          console.log(`[严格同步器] ⚠️ Slave ${canvasId} 无有效源，跳过播放: ${sourceId}`, {
            hasSrc: !!slaveVideo.src,
            hasSrcObject: !!slaveVideo.srcObject,
            readyState: slaveVideo.readyState,
            networkState: slaveVideo.networkState,
            hasError: !!slaveVideo.error
          });
        }
      }

      // 3. 同步播放速率
      if (slaveVideo.playbackRate !== masterVideo.playbackRate) {
        slaveVideo.playbackRate = masterVideo.playbackRate;
      }

      // 4. 严格模式：Slave 永远静音
      if (!slaveVideo.muted && this.enableStrictMode) {
        slaveVideo.muted = true;
      }
    } catch (error) {
      console.error(`[严格同步器] ❌ 同步失败: ${canvasId} -> ${sourceId}`, error);
    } finally {
      this.isReplicating = false;
    }
  }

  forceReplicateTo(canvasId, sourceId) {
    const slaves = this.slaveGroups.get(sourceId);
    const master = this.masters.get(sourceId);

    // 🎯 增强诊断：提供更详细的失败原因
    if (!slaves || !master) {
      console.warn(`[严格同步器] ⚠️ 强制同步失败:`, {
        canvasId,
        sourceId,
        hasSlaves: !!slaves,
        hasMaster: !!master,
        slaveGroupKeys: Array.from(this.slaveGroups.keys()),
        masterKeys: Array.from(this.masters.keys())
      });
      return;
    }

    const slave = slaves.get(canvasId);
    if (!slave || !slave.video || !master.video) {
      console.warn(`[严格同步器] ⚠️ 强制同步失败 - 视频元素缺失:`, {
        canvasId,
        sourceId,
        hasSlaveObject: !!slave,
        hasSlaveVideo: !!slave?.video,
        hasMasterVideo: !!master?.video
      });
      return;
    }

    // 🎯 关键修复：检查Master是否已就绪
    if (master.video.readyState < 2) {
      console.log(`[严格同步器] ⚠️ Master未就绪，延迟同步: ${sourceId}`);
      setTimeout(() => this.forceReplicateTo(canvasId, sourceId), 200);
      return;
    }

    this.isReplicating = true;
    const slaveVideo = slave.video;
    const masterVideo = master.video;

    try {
      // 🎯 关键修复：检查视频元素是否已就绪
      if (slaveVideo.readyState < 1) {
        console.log(`[严格同步器] ⚠️ Slave ${canvasId} 未就绪，延迟同步`);
        setTimeout(() => this.forceReplicateTo(canvasId, sourceId), 100);
        return;
      }

      // 强制跳转
      slaveVideo.currentTime = masterVideo.currentTime;
      slave.lastSyncedTime = masterVideo.currentTime;

      // 同步播放状态
      if (masterVideo.paused && !slaveVideo.paused) {
        slaveVideo.pause();
      } else if (!masterVideo.paused && slaveVideo.paused) {
        // 🎯 关键修复：严格检查视频元素是否已挂载且有有效源
        const hasValidSource = (slaveVideo.src || slaveVideo.srcObject) &&
          slaveVideo.readyState >= 2 &&
          slaveVideo.networkState !== 3 &&
          slaveVideo.error === null;
        if (hasValidSource) {
          slaveVideo.play().catch(err => {
            console.warn(`[严格同步器] ⚠️ Slave 播放失败 (强制同步): ${canvasId}`, err);
            // 🎯 如果播放失败是因为没有有效源，解除注册避免持续尝试
            if (err.name === 'NotSupportedError' || err.name === 'NotAllowedError') {
              console.log(`[严格同步器] 🗑️ 移除无效从属 (强制同步): ${canvasId} -> ${sourceId}`);
              this.removeSlave(canvasId, sourceId);
            }
          });
        } else {
          console.log(`[严格同步器] ⚠️ Slave ${canvasId} 无有效源，跳过播放 (强制同步): ${sourceId}`, {
            hasSrc: !!slaveVideo.src,
            hasSrcObject: !!slaveVideo.srcObject,
            readyState: slaveVideo.readyState,
            networkState: slaveVideo.networkState,
            hasError: !!slaveVideo.error
          });
          // 🎯 关键修复：延迟重试同步
          setTimeout(() => this.forceReplicateTo(canvasId, sourceId), 100);
        }
      }

      // 同步播放速率
      slaveVideo.playbackRate = masterVideo.playbackRate;

      // 强制静音
      if (!slaveVideo.muted && this.enableStrictMode) {
        slaveVideo.muted = true;
      }

      console.log(`[严格同步器] ✅ 强制同步: ${canvasId} -> ${sourceId}, time=${masterVideo.currentTime.toFixed(2)}s`);
    } catch (error) {
      console.error(`[严格同步器] ❌ 强制同步失败: ${canvasId} -> ${sourceId}`, error);
    } finally {
      this.isReplicating = false;
    }
  }

  getSyncStatus() {
    const status = {};
    this.masters.forEach((master, sourceId) => {
      const slaves = this.slaveGroups.get(sourceId) || new Map();
      status[sourceId] = {
        master: {
          currentTime: master.video?.currentTime || 0,
          isPlaying: !master.video?.paused
        },
        slaves: Array.from(slaves.entries()).map(([canvasId, slave]) => ({
          canvasId,
          currentTime: slave.video?.currentTime || 0,
          isPlaying: !slave.video?.paused
        }))
      };
    });
    return status;
  }

  destroy() {
    this.masters.forEach((_, sourceId) => {
      this.clearMaster(sourceId);
    });
    this.masters.clear();
    this.slaveGroups.clear();
    console.log(`[严格同步器] 🧹 已清理所有同步资源`);
  }
}

/**
 * 音频路由器 - 管理音频输出（增强版）
 *
 * 核心功能：
 * 1. 🎯 确保同一视频源只有一个实例播放音频（音频去重）
 * 2. 🎯 支持预览区域和画布区域的音频管理
 * 3. 🎯 自动处理布局切换时的音频状态
 * 4. 🎯 支持单个视频源的音频开关控制
 * 5. 🎯 新增：支持预览区域优先发声策略
 * 6. 🎯 新增：更智能的音频切换逻辑
 * 7. 🎯 新增：全局单音频输出模式（确保同一时刻只有一个视频发声）
 */
class AudioRouter {
  constructor() {
    this.masterAudioId = null;                    // 当前主控音频的视频ID
    this.audioOutputs = new Map();                // 所有注册的音频输出 { id: { video, isMaster, sourceId, isPreview } }
    this.audioRoutingIndex = null;                // 当前路由索引
    this.sourceAudioStates = new Map();           // 每个源的音频状态 { sourceId: { enabled, volume } }
    this.activeAudioBySource = new Map();         // 每个源当前激活的音频实例 { sourceId: canvasIndex }

    // 🎯 新增：配置选项
    this.previewPriority = true;                  // 预览区域是否优先发声
    this.autoSwitchOnLayoutChange = true;         // 布局切换时是否自动切换音频
    this.defaultVolume = 100;                     // 默认音量
    this.globalAudioMode = true;                  // 🎯 新增：全局单音频模式（同一时刻只有一个视频发声）

    // 🎯 新增：状态追踪
    this.lastAudioChangeTime = 0;                 // 上次音频切换时间
    this.audioChangeDebounce = 200;               // 音频切换防抖时间(ms)
  }

  /**
   * 更新源的音频状态
   * @param {string} sourceId - 信号源ID
   * @param {Object} state - 音频状态 { enabled, volume }
   */
  updateSourceAudioState(sourceId, state) {
    console.log(`[音频路由] 更新源音频状态: ${sourceId}`, state);
    this.sourceAudioStates.set(sourceId, state);

    // 更新该源所有实例的音频状态
    this.audioOutputs.forEach((entry, id) => {
      if (entry.sourceId === sourceId && entry.video) {
        entry.video.volume = (state.volume || 100) / 100;
        // 只有主控实例才考虑是否静音
        if (entry.isMaster) {
          entry.video.muted = !state.enabled;
        }
      }
    });

    // 触发全局音频同步检查
    this.enforceAudioDeduplication();
  }

  /**
   * 获取源的音频状态
   * @param {string} sourceId - 信号源ID
   * @returns {Object} 音频状态
   */
  getSourceAudioState(sourceId) {
    return this.sourceAudioStates.get(sourceId) || { enabled: true, volume: 100 };
  }

  /**
   * 设置主控音频（预览区域）
   * @param {string} previewId - 预览ID
   * @param {string} sourceId - 信号源ID
   * @param {boolean} audioEnabled - 是否启用音频
   */
  setMaster(previewId, sourceId, audioEnabled = true) {
    console.log(`[音频路由] 准备设置主音频源: previewId=${previewId}, sourceId=${sourceId}, audioEnabled=${audioEnabled}`);

    // 如果有旧主控，先取消
    if (this.masterAudioId && this.masterAudioId !== previewId) {
      const prevEntry = this.audioOutputs.get(this.masterAudioId);
      if (prevEntry && prevEntry.video) {
        prevEntry.video.muted = true;
        prevEntry.isMaster = false;
        console.log(`[音频路由] 🔇 取消旧主控: ${this.masterAudioId}`);
      }
    }

    this.masterAudioId = previewId;

    let entry = this.audioOutputs.get(previewId);
    if (!entry) {
      entry = { video: null, isMaster: true, sourceId: sourceId };
      this.audioOutputs.set(previewId, entry);
    } else {
      entry.isMaster = true;
      entry.sourceId = sourceId;
    }
    this.audioRoutingIndex = previewId;

    // 更新源的音频状态
    if (!this.sourceAudioStates.has(sourceId)) {
      this.sourceAudioStates.set(sourceId, { enabled: audioEnabled, volume: 100 });
    }

    if (entry.video) {
      const sourceState = this.getSourceAudioState(sourceId);
      entry.video.muted = !sourceState.enabled;
      entry.video.volume = (sourceState.volume || 100) / 100;
      if (sourceState.enabled) {
        console.log(`[音频路由] 🔊 设置新主控: ${previewId} -> ${sourceId} (取消静音)`);
      } else {
        console.log(`[音频路由] 🔇 设置新主控: ${previewId} -> ${sourceId} (保持静音)`);
      }
    }

    return this.getAudioStatus();
  }

  /**
   * 注册音频输出
   * @param {HTMLVideoElement} videoElement - 视频元素
   * @param {string} id - 输出ID（预览ID或画布ID）
   * @param {string} sourceId - 信号源ID
   * @param {boolean} isPreview - 是否为预览区域
   */
  register(videoElement, id, sourceId, isPreview = false) {
    console.log(`[音频路由] 注册音频输出: id=${id}, sourceId=${sourceId}, isPreview=${isPreview}`);

    // 🎯 参数验证
    if (!videoElement || !(videoElement instanceof HTMLVideoElement)) {
      console.error(`[音频路由] ❌ 无效的视频元素: id=${id}, sourceId=${sourceId}`);
      return;
    }

    const sourceState = this.getSourceAudioState(sourceId);

    let entry = this.audioOutputs.get(id);
    if (entry) {
      // 更新现有条目
      entry.video = videoElement;
      entry.sourceId = sourceId;
      entry.isPreview = isPreview;
    } else {
      // 创建新条目
      entry = {
        video: videoElement,
        isMaster: false,
        sourceId: sourceId,
        isPreview: isPreview,
        registeredAt: Date.now()
      };
      this.audioOutputs.set(id, entry);
    }

    // 设置初始静音状态
    // 🎯 修复：参考备份版本的音频处理逻辑
    // 预览区域：默认不静音（除非源禁用了音频）
    // 画布区域：默认静音（除非是主控）
    if (isPreview) {
      // 🎯 关键修复：预览区域应该根据源的音频状态决定是否静音
      // 这是备份版本中的核心逻辑
      videoElement.muted = !sourceState.enabled;
      videoElement.volume = (sourceState.volume || this.defaultVolume) / 100;
      console.log(`[音频路由] 📹 预览区域 ${id}: muted=${videoElement.muted}, volume=${videoElement.volume}`);

      // 如果预览区域优先且源启用音频，设置为主控
      if (this.previewPriority && sourceState.enabled) {
        this.setMaster(id, sourceId, sourceState.enabled);
      }
    } else {
      // 画布区域默认静音，等待音频去重逻辑处理
      videoElement.muted = true;
      videoElement.volume = (sourceState.volume || this.defaultVolume) / 100;
      console.log(`[音频路由] 🎬 画布区域 ${id}: muted=${videoElement.muted}, volume=${videoElement.volume}`);
    }

    // 触发音频去重检查
    setTimeout(() => this.enforceAudioDeduplication(), 50);
  }

  /**
   * 设置画布音频
   * @param {string} canvasId - 画布ID
   * @param {boolean} isMaster - 是否为主控
   */
  setCanvasAudio(canvasId, isMaster) {
    console.log(`[音频路由] 切换画布 ${canvasId} 音频: ${isMaster ? '发声' : '静音'}`);

    const entry = this.audioOutputs.get(canvasId);
    if (!entry) {
      console.warn(`[音频路由] ⚠️ 画布未注册: ${canvasId}`);
      return this.getAudioStatus();
    }

    if (isMaster) {
      // 取消旧主控
      if (this.masterAudioId && this.masterAudioId !== canvasId) {
        const prevEntry = this.audioOutputs.get(this.masterAudioId);
        if (prevEntry && prevEntry.video) {
          prevEntry.video.muted = true;
          prevEntry.isMaster = false;
        }
      }

      // 设置新主控
      this.masterAudioId = canvasId;
      this.audioRoutingIndex = canvasId;
      entry.isMaster = true;

      // 更新源的活跃实例记录
      if (entry.sourceId) {
        this.activeAudioBySource.set(entry.sourceId, canvasId);
      }

      // 设置静音状态
      if (entry.video) {
        const sourceState = this.getSourceAudioState(entry.sourceId);
        entry.video.muted = !sourceState.enabled;
      }
    } else {
      // 取消主控
      if (this.masterAudioId === canvasId) {
        this.masterAudioId = null;
        this.audioRoutingIndex = null;
      }
      entry.isMaster = false;

      // 清除源的活跃实例记录
      if (entry.sourceId && this.activeAudioBySource.get(entry.sourceId) === canvasId) {
        this.activeAudioBySource.delete(entry.sourceId);
      }

      // 静音
      if (entry.video) {
        entry.video.muted = true;
      }
    }

    return this.getAudioStatus();
  }

  /**
   * 🔊 音频去重核心逻辑
   * 确保同一视频源只有一个实例播放音频
   *
   * 🎯 智能选择策略：
   * 1. 优先选择预览区域（如果启用预览优先）
   * 2. 其次选择之前激活的实例
   * 3. 最后选择最早注册的实例
   */
  enforceAudioDeduplication() {
    console.log('[音频路由] 🔍 执行音频去重检查');

    // 防抖检查
    const now = Date.now();
    if (now - this.lastAudioChangeTime < this.audioChangeDebounce) {
      console.log('[音频路由] ⚠️ 音频切换过于频繁，跳过本次检查');
      return;
    }

    // 🎯 全局单音频模式：确保同一时刻只有一个视频发声
    if (this.globalAudioMode) {
      this.enforceGlobalSingleAudio();
      return;
    }

    // 统计每个源在画布中的出现次数
    const sourceOccurrences = new Map();
    this.audioOutputs.forEach((entry, id) => {
      if (entry.sourceId) {
        sourceOccurrences.set(entry.sourceId,
          (sourceOccurrences.get(entry.sourceId) || 0) + 1
        );
      }
    });

    // 对每个源执行音频去重
    sourceOccurrences.forEach((count, sourceId) => {
      if (count <= 1) {
        // 只有一个实例，不需要去重，但仍需检查音频状态
        this.checkSingleInstanceAudio(sourceId);
        return;
      }

      console.log(`[音频路由] ⚠️ 发现重复源: ${sourceId}，实例数=${count}`);

      // 找到该源的所有实例
      const instances = [];
      this.audioOutputs.forEach((entry, id) => {
        if (entry.sourceId === sourceId && entry.video) {
          instances.push({ id, entry });
        }
      });

      // 获取源的音频状态
      const sourceState = this.getSourceAudioState(sourceId);
      if (!sourceState.enabled) {
        // 源已禁用音频，所有实例都静音
        instances.forEach(({ id, entry }) => {
          if (!entry.video.muted) {
            entry.video.muted = true;
            entry.isMaster = false;
            console.log(`[音频路由] 🔇 源已禁用音频，静音实例: ${id}`);
          }
        });
        return;
      }

      // 🎯 智能选择应该播放音频的实例
      const shouldPlayAudioId = this.selectAudioInstance(sourceId, instances);

      // 更新活跃实例记录
      this.activeAudioBySource.set(sourceId, shouldPlayAudioId);

      // 设置所有实例的静音状态
      let audioChanged = false;
      instances.forEach(({ id, entry }) => {
        const shouldMute = id !== shouldPlayAudioId;
        if (entry.video.muted !== shouldMute || entry.isMaster === shouldMute) {
          entry.video.muted = shouldMute;
          entry.isMaster = !shouldMute;
          audioChanged = true;

          if (shouldMute) {
            console.log(`[音频路由] 🔇 静音实例: ${id} (源: ${sourceId})`);
          } else {
            console.log(`[音频路由] 🔊 启用音频: ${id} (源: ${sourceId})`);
          }
        }
      });

      if (audioChanged) {
        this.lastAudioChangeTime = Date.now();
      }
    });

    console.log('[音频路由] ✅ 音频去重检查完成');
  }

  /**
   * 🎯 全局单音频模式 - 确保同一时刻只有一个视频发声
   * 即使是不同的视频源，也只有一个可以发声
   */
  enforceGlobalSingleAudio() {
    console.log('[音频路由] 🌍 执行全局单音频检查');

    // 收集所有启用音频的源和其实例
    const activeInstances = [];
    this.audioOutputs.forEach((entry, id) => {
      if (entry.sourceId && entry.video) {
        const sourceState = this.getSourceAudioState(entry.sourceId);
        if (sourceState.enabled) {
          activeInstances.push({ id, entry, sourceState });
        }
      }
    });

    if (activeInstances.length <= 1) {
      // 只有0或1个启用音频的实例，不需要处理
      console.log(`[音频路由] 🌍 活跃实例数=${activeInstances.length}，无需全局音频处理`);
      return;
    }

    // 🎯 智能选择应该播放音频的实例
    const shouldPlayAudioId = this.selectGlobalAudioInstance(activeInstances);

    console.log(`[音频路由] 🌍 全局选择发声实例: ${shouldPlayAudioId}`);

    // 设置所有实例的静音状态
    let audioChanged = false;
    activeInstances.forEach(({ id, entry }) => {
      const shouldMute = id !== shouldPlayAudioId;
      if (entry.video.muted !== shouldMute || entry.isMaster === shouldMute) {
        entry.video.muted = shouldMute;
        entry.isMaster = !shouldMute;
        audioChanged = true;

        if (shouldMute) {
          console.log(`[音频路由] 🔇 全局静音实例: ${id} (源: ${entry.sourceId})`);
        } else {
          console.log(`[音频路由] 🔊 全局启用音频: ${id} (源: ${entry.sourceId})`);
        }
      }
    });

    if (audioChanged) {
      this.lastAudioChangeTime = Date.now();
    }

    console.log('[音频路由] ✅ 全局单音频检查完成');
  }

  /**
   * 🎯 智能选择全局发声实例
   * @param {Array} instances - 所有启用音频的实例
   * @returns {string} 应该播放音频的实例ID
   */
  selectGlobalAudioInstance(instances) {
    // 1. 优先选择预览区域（如果启用预览优先）
    if (this.previewPriority) {
      const previewInstance = instances.find(i => i.entry.isPreview);
      if (previewInstance) {
        console.log(`[音频路由] 🌍 优先选择预览区域: ${previewInstance.id}`);
        return previewInstance.id;
      }
    }

    // 2. 其次选择当前主控（如果存在且在实例列表中）
    if (this.masterAudioId && instances.some(i => i.id === this.masterAudioId)) {
      console.log(`[音频路由] 🌍 选择当前主控: ${this.masterAudioId}`);
      return this.masterAudioId;
    }

    // 3. 选择之前激活的实例
    for (const instance of instances) {
      if (this.activeAudioBySource.get(instance.entry.sourceId) === instance.id) {
        console.log(`[音频路由] 🌍 选择之前激活的实例: ${instance.id}`);
        return instance.id;
      }
    }

    // 4. 最后选择最早注册的实例
    const earliestInstance = instances.reduce((earliest, current) => {
      if (!earliest || current.entry.registeredAt < earliest.entry.registeredAt) {
        return current;
      }
      return earliest;
    }, null);

    const selectedId = earliestInstance?.id || instances[0]?.id;
    console.log(`[音频路由] 🌍 选择最早注册的实例: ${selectedId}`);
    return selectedId;
  }

  /**
   * 🎯 智能选择音频实例
   * @param {string} sourceId - 信号源ID
   * @param {Array} instances - 该源的所有实例
   * @returns {string} 应该播放音频的实例ID
   */
  selectAudioInstance(sourceId, instances) {
    // 1. 优先选择预览区域（如果启用预览优先）
    if (this.previewPriority) {
      const previewInstance = instances.find(i => i.entry.isPreview);
      if (previewInstance) {
        console.log(`[音频路由] 🎯 优先选择预览区域: ${previewInstance.id} (源: ${sourceId})`);
        return previewInstance.id;
      }
    }

    // 2. 其次选择之前激活的实例
    const previouslyActive = this.activeAudioBySource.get(sourceId);
    if (previouslyActive && instances.some(i => i.id === previouslyActive)) {
      console.log(`[音频路由] 🎯 选择之前激活的实例: ${previouslyActive} (源: ${sourceId})`);
      return previouslyActive;
    }

    // 3. 最后选择最早注册的实例
    const earliestInstance = instances.reduce((earliest, current) => {
      if (!earliest || current.entry.registeredAt < earliest.entry.registeredAt) {
        return current;
      }
      return earliest;
    }, null);

    const selectedId = earliestInstance?.id || instances[0]?.id;
    console.log(`[音频路由] 🎯 选择最早注册的实例: ${selectedId} (源: ${sourceId})`);
    return selectedId;
  }

  /**
   * 🎯 检查单个实例的音频状态
   */
  checkSingleInstanceAudio(sourceId) {
    let instance = null;
    this.audioOutputs.forEach((entry, id) => {
      if (entry.sourceId === sourceId && entry.video) {
        instance = { id, entry };
      }
    });

    if (instance) {
      const sourceState = this.getSourceAudioState(sourceId);
      const shouldMute = !sourceState.enabled;

      if (instance.entry.video.muted !== shouldMute) {
        instance.entry.video.muted = shouldMute;
        instance.entry.isMaster = !shouldMute;
        console.log(`[音频路由] 🔊 单实例音频状态更新: ${instance.id} -> muted=${shouldMute}`);
      }
    }
  }

  /**
   * 更新画布-源映射并执行音频去重
   * @param {Object} canvasSourceMap - 画布源映射 { canvasIndex: sourceId }
   */
  updateCanvasSourceMap(canvasSourceMap) {
    console.log('[音频路由] 🗺️ 更新画布源映射');

    // 更新每个已注册画布的源ID
    Object.keys(canvasSourceMap).forEach(canvasIndex => {
      const sourceId = canvasSourceMap[canvasIndex];
      const entry = this.audioOutputs.get(canvasIndex);
      if (entry) {
        entry.sourceId = sourceId;
      }
    });

    // 执行音频去重
    this.enforceAudioDeduplication();
  }

  /**
   * 移除指定画布的音频注册
   * @param {string} canvasId - 画布ID
   */
  unregister(canvasId) {
    const entry = this.audioOutputs.get(canvasId);
    if (entry) {
      // 如果是主控，需要寻找新主控
      if (entry.isMaster && entry.sourceId) {
        this.findNewMasterForSource(entry.sourceId, canvasId);
      }

      // 如果有活跃实例记录，清除
      if (entry.sourceId && this.activeAudioBySource.get(entry.sourceId) === canvasId) {
        this.activeAudioBySource.delete(entry.sourceId);
      }

      this.audioOutputs.delete(canvasId);
      console.log(`[音频路由] 🗑️ 已移除画布音频注册: ${canvasId}`);
    }
  }

  /**
   * 为源寻找新的主控
   * @param {string} sourceId - 信号源ID
   * @param {string} excludeId - 排除的ID
   */
  findNewMasterForSource(sourceId, excludeId) {
    let newMaster = null;

    this.audioOutputs.forEach((entry, id) => {
      if (id !== excludeId && entry.sourceId === sourceId && entry.video) {
        newMaster = id;
      }
    });

    if (newMaster) {
      console.log(`[音频路由] 🔄 切换主控: ${excludeId} -> ${newMaster} (源: ${sourceId})`);
      this.setCanvasAudio(newMaster, true);
    }
  }

  /**
   * 获取音频状态
   */
  getAudioStatus() {
    return {
      master: this.masterAudioId,
      audioRoutingIndex: this.audioRoutingIndex,
      activeAudioBySource: Object.fromEntries(this.activeAudioBySource),
      sourceAudioStates: Object.fromEntries(this.sourceAudioStates),
      outputs: Array.from(this.audioOutputs.entries()).map(([id, entry]) => ({
        id,
        sourceId: entry.sourceId,
        isMaster: entry.isMaster,
        muted: entry.video?.muted ?? true,
        volume: entry.video?.volume ?? 1,
        isPreview: entry.isPreview
      }))
    };
  }

  /**
   * 🎯 用户手动选择发声视频
   * @param {string} targetId - 要发声的视频ID（预览ID或画布ID）
   */
  selectAudioOutput(targetId) {
    console.log(`[音频路由] 👤 用户选择发声视频: ${targetId}`);

    // 检查目标是否已注册
    const targetEntry = this.audioOutputs.get(targetId);
    if (!targetEntry || !targetEntry.video) {
      console.warn(`[音频路由] ❌ 目标视频未注册或不存在: ${targetId}`);
      return;
    }

    // 静音所有其他视频
    this.audioOutputs.forEach((entry, id) => {
      if (id !== targetId && entry.video) {
        entry.video.muted = true;
        entry.isMaster = false;
        console.log(`[音频路由] 🔇 用户选择后静音: ${id}`);
      }
    });

    // 取消静音目标视频
    targetEntry.video.muted = false;
    targetEntry.isMaster = true;
    this.masterAudioId = targetId;
    this.audioRoutingIndex = targetId;
    this.lastAudioChangeTime = Date.now();

    // 更新活跃实例记录
    if (targetEntry.sourceId) {
      this.activeAudioBySource.set(targetEntry.sourceId, targetId);
    }

    console.log(`[音频路由] 🔊 用户选择的视频开始发声: ${targetId} (源: ${targetEntry.sourceId})`);

    return this.getAudioStatus();
  }

  /**
   * 🎯 切换指定画布的音频状态
   * @param {string} canvasId - 画布ID
   */
  toggleCanvasAudio(canvasId) {
    console.log(`[音频路由] 🔄 切换画布音频: ${canvasId}`);

    const entry = this.audioOutputs.get(canvasId);
    if (!entry || !entry.video) {
      console.warn(`[音频路由] ❌ 画布未注册或不存在: ${canvasId}`);
      return;
    }

    // 如果当前是静音状态，取消静音并静音其他所有视频
    if (entry.video.muted) {
      this.selectAudioOutput(canvasId);
    } else {
      // 如果当前正在发声，静音它
      entry.video.muted = true;
      entry.isMaster = false;

      // 如果静音的是主控，需要重新选择一个主控
      if (this.masterAudioId === canvasId) {
        this.masterAudioId = null;
        this.audioRoutingIndex = null;

        // 查找下一个可用的发声视频
        this.enforceAudioDeduplication();
      }

      console.log(`[音频路由] 🔇 静音画布: ${canvasId}`);
    }

    return this.getAudioStatus();
  }

  /**
   * 销毁路由
   */
  destroy() {
    this.masterAudioId = null;
    this.audioRoutingIndex = null;
    this.audioOutputs.clear();
    this.sourceAudioStates.clear();
    this.activeAudioBySource.clear();
    console.log('[音频路由] 🧹 已清理所有音频路由资源');
  }
}

// 创建模块级单例
const _stateReplicator = new SyncStateReplicator();
const _audioRouter = new AudioRouter();

/**
 * 视频同步 Composable 主函数
 */
export function useVideoSync() {
  const stateReplicator = _stateReplicator;
  const audioRouter = _audioRouter;

  const previewProgressMap = reactive(new Map());

  const initSourcePreviewProgress = (source) => {
    if (!source.previewProgress) {
      source.previewProgress = {
        currentTime: 0,
        duration: 0,
        percent: 0,
        isPlaying: false,
        isSyncing: false
      };
      previewProgressMap.set(source.id, source.previewProgress);
    }
  };

  const onPreviewVideoTimeUpdate = (event, source) => {
    try {
      const video = event.target;

      if (!source.previewProgress) {
        initSourcePreviewProgress(source);
      }

      const progress = source.previewProgress;

      if (progress.isSyncing) return;

      progress.currentTime = video.currentTime;
      progress.duration = video.duration || 0;
      progress.percent = progress.duration > 0
        ? (progress.currentTime / progress.duration) * 100
        : 0;
      progress.isPlaying = !video.paused;
    } catch (error) {
      console.warn('[视频同步] 预览时间更新失败:', error);
    }
  };

  const onPreviewVideoLoadedMetadata = (event, source) => {
    try {
      const video = event.target;

      if (!source.previewProgress) {
        initSourcePreviewProgress(source);
      }

      source.previewProgress.duration = video.duration || 0;
      source.previewProgress.percent = 0;
    } catch (error) {
      console.warn('[视频同步] 元数据加载失败:', error);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '00:00';

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * 注册主控视频 (预览区域)
   */
  const registerMasterVideo = (videoElement, source) => {
    // 🎯 兼容两种调用方式：传入 source 对象或 sourceId 字符串
    const sourceId = typeof source === 'string' ? source : (source?.id || source);
    // 🎯 如果传入的是对象且有 audioEnabled 属性，使用它；否则默认 true（主控默认发声）
    const audioEnabled = typeof source === 'object' && source !== null
      ? (source.audioEnabled !== undefined ? source.audioEnabled : true)
      : true;

    console.log(`[useVideoSync] 注册主控视频: ${sourceId}, audioEnabled: ${audioEnabled}`);

    stateReplicator.registerMaster(videoElement, sourceId);
    // 🎯 修复：audioRouter.register 参数顺序应为 (videoElement, id, sourceId, isPreview)
    audioRouter.register(videoElement, sourceId, sourceId, true);
    audioRouter.setMaster(sourceId, sourceId, audioEnabled);
  };

  /**
   * 注册从属视频 (画布) - 🎯 兼容 source 对象或 sourceId 字符串
   */
  const registerSlaveVideo = (videoElement, canvasId, source) => {
    // 🎯 兼容两种调用方式：传入 source 对象或 sourceId 字符串
    const sourceId = typeof source === 'string' ? source : (source?.id || source);
    // 🎯 从属视频默认静音（audioEnabled=false）
    const audioEnabled = typeof source === 'object' && source !== null
      ? (source.audioEnabled !== undefined ? source.audioEnabled : false)
      : false;

    console.log(`[useVideoSync] 注册从属视频: canvasId=${canvasId}, sourceId=${sourceId}, audioEnabled: ${audioEnabled}`);

    // 🎯 关键修复：先更新源的音频状态，确保音频路由知道该源默认不发声
    // 这是解决多个视频同时发声的关键步骤
    audioRouter.updateSourceAudioState(sourceId, { enabled: audioEnabled, volume: 100 });

    stateReplicator.registerSlave(videoElement, canvasId, sourceId);
    // 🎯 修复：audioRouter.register 参数顺序应为 (videoElement, id, sourceId, isPreview)
    audioRouter.register(videoElement, canvasId, sourceId, false);

    // 🎯 立即执行音频去重，确保同一源只有一个实例发声
    setTimeout(() => {
      audioRouter.enforceAudioDeduplication();
    }, 50);
  };

  /**
   * 移除从属视频 - 🎯 需要指定 sourceId
   */
  const unregisterSlaveVideo = (canvasId, sourceId) => {
    stateReplicator.removeSlave(canvasId, sourceId);
  };

  /**
   * 清除主控视频 - 🎯 需要指定 sourceId
   */
  const clearMasterVideo = (sourceId) => {
    stateReplicator.clearMaster(sourceId);
  };

  /**
   * 🎯 音频同步检查 - 确保同一视频源只有一个实例播放音频
   */
  const checkAudioSync = () => {
    try {
      console.log('[useVideoSync] 执行音频同步检查');

      // 统计每个源在画布中的出现次数
      const sourceOccurrences = {};
      Object.values(canvasSourceMap.value).forEach(sourceId => {
        sourceOccurrences[sourceId] = (sourceOccurrences[sourceId] || 0) + 1;
      });

      // 遍历所有画布，设置正确的静音状态
      Object.keys(canvasSourceMap.value).forEach(canvasIndex => {
        const sourceId = canvasSourceMap.value[canvasIndex];
        const occurrences = sourceOccurrences[sourceId] || 1;

        const previewIndex = parseInt(canvasIndex) - 1;
        const canvasPreview = videoPreviews.value[previewIndex];

        if (canvasPreview && canvasPreview.$el) {
          const canvasVideo = canvasPreview.$el.querySelector('video');
          if (canvasVideo) {
            // 如果同一个源在多个画布中，只有第一个画布播放音频
            const isFirstInstance = parseInt(canvasIndex) === Math.min(
              ...Object.keys(canvasSourceMap.value).filter(k => canvasSourceMap.value[k] === sourceId).map(Number)
            );

            const source = allSources.value.find(s => s.id === sourceId);
            const shouldMute = !isFirstInstance || !source?.audioEnabled;

            if (canvasVideo.muted !== shouldMute) {
              canvasVideo.muted = shouldMute;
              console.log(`[useVideoSync] 音频同步: 画布 ${canvasIndex} 视频 ${source?.name || sourceId} muted=${shouldMute}`);
            }
          }
        }
      });

      console.log('[useVideoSync] 音频同步检查完成');
    } catch (error) {
      console.error('[useVideoSync] 音频同步检查失败:', error);
    }
  };

  /**
   * 点击进度条跳转 (主控)
   */
  const seekPreviewVideo = (event, source) => {
    try {
      const progressBar = event.currentTarget;
      const rect = progressBar.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const percent = clickX / rect.width;

      const videoElement = progressBar.parentElement.querySelector('.preview-video');

      if (videoElement && videoElement.duration) {
        const newTime = percent * videoElement.duration;

        if (source.previewProgress) {
          source.previewProgress.isSyncing = true;
        }

        videoElement.currentTime = newTime;

        if (source.previewProgress) {
          source.previewProgress.currentTime = newTime;
          source.previewProgress.duration = videoElement.duration;
          source.previewProgress.percent = percent * 100;
        }

        setTimeout(() => {
          if (source.previewProgress) {
            source.previewProgress.isSyncing = false;
          }
        }, 100);
      }
    } catch (error) {
      console.error('[视频同步] 跳转失败:', error);
    }
  };

  const getPreviewProgress = (source) => {
    if (!source.previewProgress) return 0;
    return source.previewProgress.percent || 0;
  };

  const formatPreviewTime = (source) => {
    if (!source.previewProgress || !source.previewProgress.duration) return '00:00';

    const current = formatTime(source.previewProgress.currentTime);
    const duration = formatTime(source.previewProgress.duration);

    return `${current} / ${duration}`;
  };

  const setCanvasAudio = (canvasId, isMaster) => {
    return audioRouter.setCanvasAudio(canvasId, isMaster);
  };

  const getSyncStatus = () => {
    return {
      replicator: stateReplicator.getSyncStatus(),
      audio: audioRouter.getAudioStatus()
    };
  };

  const cleanup = () => {
    stateReplicator.destroy();
    audioRouter.destroy();
    previewProgressMap.clear();
  };


  // ==================== 布局管理方法 ====================

  /**
   * 🎯 根据信号源ID获取信号源类型
   * @param {string} sourceId - 信号源ID
   * @returns {string} 信号源类型
   */
  const getSourceTypeFromId = (sourceId) => {
    if (!sourceId) return 'unknown';

    // 🎯 首先从 window.__sourceStore 获取类型信息
    try {
      const sourceStoreSources = window.__sourceStore?.sources || [];
      const source = sourceStoreSources.find(s => s.id === sourceId);
      if (source && source.type) {
        return source.type;
      }
    } catch (e) {
      // 忽略错误
    }

    // 从 allSources 中查找
    const allSource = allSources.value?.find(s => s.id === sourceId);
    if (allSource && allSource.type) {
      return allSource.type;
    }

    // 🎯 从 canvasSourceMap 反向查找（通过 sourceId 找到对应的源）
    try {
      const canvasSource = Array.from(canvasSourceMap.value.entries()).find(([, id]) => id === sourceId);
      if (canvasSource) {
        const [canvasIndex] = canvasSource;
        // 尝试从 window.__sourceStore 获取该格子的源类型
        const storeSources = window.__sourceStore?.sources || [];
        const src = storeSources.find(s => canvasSourceMap.value[canvasIndex] === s.id);
        if (src && src.type) {
          return src.type;
        }
      }
    } catch (e) {
      // 忽略错误
    }

    // 根据 ID 特征判断类型（备用方案）
    // 🎯 摄像头源：source_xxx 或 camera-xxx 格式
    if (sourceId.startsWith('source_') || sourceId.startsWith('camera-') ||
      sourceId.includes('camera') || sourceId.includes('Camera')) {
      return 'camera';
    }
    // 视频文件：media_xxx 格式
    if (sourceId.startsWith('media_') || sourceId.includes('localVideo') || sourceId.includes('video')) {
      return 'localVideo';
    }
    // 文档类型
    if (sourceId.includes('word') || sourceId.includes('doc')) {
      return 'word';
    }
    if (sourceId.includes('ppt')) {
      return 'ppt';
    }
    if (sourceId.includes('pdf')) {
      return 'pdf';
    }

    return 'other';
  };

  // 🎯 获取指定布局的可见画布索引
  // 新布局索引: 1-1分屏, 2-2分屏, 3-3分屏, 4-4分屏, 5-6分屏, 7-9分屏, 10-16分屏, 11-25分屏, 12-36分屏, 13-49分屏
  // 14-特殊1, 15-特殊2, 16-特殊3, 17-特殊4, 18-自由布局
  const getVisibleCanvasIndices = (layoutId) => {
    // 布局索引到格子数量的映射
    const layoutCellCountMap = {
      1: 1,    // 1分屏
      2: 2,    // 2分屏
      3: 3,    // 3分屏
      4: 4,    // 4分屏
      5: 6,    // 6分屏
      7: 9,    // 9分屏
      10: 16,  // 16分屏
      11: 25,  // 25分屏
      12: 36,  // 36分屏
      13: 49,  // 49分屏
      14: 2,   // 特殊布局1
      15: 2,   // 特殊布局2
      16: 2,   // 特殊布局3
      17: 2    // 特殊布局4
    };

    // 自由布局
    if (layoutId === 18 || layoutId === 'free') {
      return []; // 自由布局使用动态索引
    }

    const count = layoutCellCountMap[layoutId];
    if (count) {
      // 返回 1-based 索引
      return Array.from({ length: count }, (_, i) => i + 1);
    }

    return [1];
  };

  // 🎯 获取布局的有效索引集合
  const getValidIndices = (layoutId) => {
    return new Set(getVisibleCanvasIndices(layoutId));
  };

  /**
   * 🎯 切换布局 - 每个布局独立保存信号源状态
   *
   * 核心架构：布局与信号源分离（参考 RenderCanvas 架构）
   * 关键设计原则：
   * 1. 每个布局的信号源状态完全独立存储
   * 2. 切换布局时，保存当前布局的信号源到其独立存储
   * 3. 切换布局时，只恢复新布局之前保存的信号源
   * 4. 每个 Box/格子记住自己绑定的信号源ID（refId 持久化）
   * 5. 切换只是改变指针，不销毁旧布局状态
   *
   * 示例（您的场景）：
   * - 1分屏: {1: 信号源1}  - 独立存储
   * - 2分屏: {1: 信号源3, 2: 信号源4}  - 独立存储
   * - 切换时，各自恢复自己的配置，互不干扰
   * - 切回时，信号源立即恢复显示
   */
  const changeLayout = (layout) => {
    const oldLayout = currentLayout.value;
    console.log(`[useVideoSync] 切换布局: ${oldLayout} -> ${layout}`);

    // 🎯 步骤1：获取新布局的有效索引
    const newValidIndices = getValidIndices(layout);

    // 🎯 步骤2：保存当前布局的信号源状态（如果存在）
    // 参考 RenderCanvas::setLayout - 保存旧布局状态
    if (oldLayout && oldLayout !== layout) {
      const slotsToSave = { ...canvasSourceMap.value };
      if (Object.keys(slotsToSave).length > 0) {
        // 保存到当前布局的独立存储
        Object.entries(slotsToSave).forEach(([slotIndex, sourceId]) => {
          layoutStates[oldLayout].slots[slotIndex] = sourceId;
        });
        console.log(`[useVideoSync] 已保存布局${oldLayout}的信号源状态:`, slotsToSave);
      }
    }

    // 🎯 步骤3：从新布局的独立存储恢复信号源
    // 参考 RenderLayout 构造函数 - 每个布局创建时初始化自己的 elements 数组
    const savedSlots = layoutStates[layout]?.slots || {};
    const newMap = {};

    // 🎯 关键修复：直接按原始索引恢复信号源（不再使用智能映射）
    // 每个 Box 记住自己绑定的信号源 ID（refId 持久化）
    Object.entries(savedSlots).forEach(([slotIndex, sourceId]) => {
      if (sourceId && newValidIndices.has(parseInt(slotIndex))) {
        // 只恢复在新布局有效范围内的信号源
        newMap[slotIndex] = sourceId;
        console.log(`[useVideoSync] 恢复信号源到槽位${slotIndex}: ${sourceId}`);
      }
    });

    console.log(`[useVideoSync] 从布局${layout}恢复的信号源:`, newMap);

    // 🎯 步骤4：更新 canvasSourceMap
    canvasSourceMap.value = newMap;

    // 🎯 步骤5：清理超出新布局范围的从属视频注册
    Object.keys(canvasSourceMap.value).forEach(key => {
      const index = parseInt(key);
      if (!newValidIndices.has(index)) {
        const sourceId = canvasSourceMap.value[key];
        if (sourceId) {
          unregisterSlaveVideo(index, sourceId);
          console.log(`[useVideoSync] 布局切换时注销超出范围的从属视频: canvas ${index} -> ${sourceId}`);
        }
      }
    });

    // 🎯 步骤6：初始化视频预览数组长度
    const cellCount = newValidIndices.size || 1;
    initVideoPreviewsLength(cellCount);

    // 🎯 步骤7：更新当前布局
    currentLayout.value = layout;

    // 🎯 步骤8：保存布局状态到 localStorage
    if (typeof saveToStorage === 'function') {
      saveToStorage();
      console.log(`[useVideoSync] 已保存布局状态到 localStorage`);
    }

    console.log(`[useVideoSync] 布局切换完成: ${layout}, 实际格子数: ${cellCount}`);
  };

  const togglePip = () => {
    pipVisible.value = !pipVisible.value;
    console.log(`[useVideoSync] 画中画: ${pipVisible.value}`);
  };

  const setPipPosition = (position) => {
    pipPosition.value = position;
    pipVisible.value = true;  // 🎯 启用画中画模式
    console.log(`[useVideoSync] 设置画中画位置: ${position}, pipVisible: true`);
  };

  // ==================== 视频源管理方法 ====================

  /**
   * 🎯 初始化 videoPreviews 数组长度（用于布局切换时预分配空间）
   * 🎯 修复：支持数组长度的增加和减少，确保与当前布局匹配
   */
  const initVideoPreviewsLength = (length) => {
    const currentLength = videoPreviews.value.length;

    if (currentLength < length) {
      // 需要扩展数组
      while (videoPreviews.value.length < length) {
        videoPreviews.value.push(null);
      }
      console.log(`[useVideoSync] 扩展 videoPreviews 数组长度: ${currentLength} -> ${length}`);
    } else if (currentLength > length) {
      // 需要收缩数组（关键修复）
      videoPreviews.value.length = length;
      console.log(`[useVideoSync] 收缩 videoPreviews 数组长度: ${currentLength} -> ${length}`);
    } else {
      console.log(`[useVideoSync] videoPreviews 数组长度已匹配: ${length}`);
    }
  };

  /**
   * 🎯 获取指定布局的可见画布数量
   * 新布局索引: 1-1分屏, 2-2分屏, 3-3分屏, 4-4分屏, 5-6分屏, 7-9分屏, 10-16分屏, 11-25分屏, 12-36分屏, 13-49分屏
   * 14-特殊1, 15-特殊2, 16-特殊3, 17-特殊4, 18-自由布局
   */
  const getVisibleCanvasCount = (layout) => {
    // 布局索引到格子数量的映射
    const layoutCellCountMap = {
      1: 1,    // 1分屏
      2: 2,    // 2分屏
      3: 3,    // 3分屏
      4: 4,    // 4分屏
      5: 6,    // 6分屏
      7: 9,    // 9分屏
      10: 16,  // 16分屏
      11: 25,  // 25分屏
      12: 36,  // 36分屏
      13: 49,  // 49分屏
      14: 2,   // 特殊布局1
      15: 2,   // 特殊布局2
      16: 2,   // 特殊布局3
      17: 2    // 特殊布局4
    };

    // 自由布局
    if (layout === 18 || layout === 'free') {
      // 自由布局：返回当前 canvasSourceMap 中的画布数量
      return Object.keys(canvasSourceMap.value).length || 1;
    }

    // 使用新布局索引映射
    if (layoutCellCountMap[layout] !== undefined) {
      return layoutCellCountMap[layout];
    }

    return 1;
  };

  const addVideoSource = (source) => {
    if (source && source.id) {
      // 🎯 去重检查：防止同一信号源重复添加到预览列表
      const exists = videoPreviews.value.find(s => s.id === source.id);
      if (exists) {
        console.warn(`[useVideoSync] 信号源已存在，跳过重复添加: ${source.id}`);
        return;
      }
      videoPreviews.value.push(source);
      console.log(`[useVideoSync] 添加视频源: ${source.id}`);
    }
  };

  const removeVideoSource = (sourceId) => {
    const index = videoPreviews.value.findIndex(s => s.id === sourceId);
    if (index !== -1) {
      // 🎯 先通知渲染引擎清空视频（关键修复）
      const previewRef = videoPreviewRefs.value[sourceId];
      if (previewRef && typeof previewRef.clearVideoSourceWithoutRevoke === 'function') {
        previewRef.clearVideoSourceWithoutRevoke();
        console.log(`[useVideoSync] 已通知渲染引擎清空视频: ${sourceId}`);
      } else if (previewRef && typeof previewRef.clearVideoSource === 'function') {
        previewRef.clearVideoSource();
        console.log(`[useVideoSync] 已通知渲染引擎清空视频: ${sourceId}`);
      }
      videoPreviews.value.splice(index, 1);
      console.log(`[useVideoSync] 移除视频源: ${sourceId}`);
    }
  };

  const setVideoPreviewRef = (sourceId, ref) => {
    if (ref && sourceId) {
      videoPreviewRefs.value[sourceId] = ref;
    }
  };

  // ==================== 🎯 新增：信号源管理方法（从 useVideoStore 迁移）====================

  /**
   * 添加信号源到完整列表
   */
  const addSource = (source) => {
    if (source && !allSources.value.find(s => s.id === source.id)) {
      allSources.value.push(source);
      console.log(`[useVideoSync] 添加信号源到列表: ${source.name} (${source.id})`);
    }
  };

  /**
   * 删除信号源（从完整列表和所有映射中移除）
   */
  const removeSource = (sourceId) => {
    // 🎯 关键修复：使用新对象替换触发响应式更新
    const newMap = {};
    Object.keys(canvasSourceMap.value).forEach(key => {
      if (canvasSourceMap.value[key] !== sourceId) {
        newMap[key] = canvasSourceMap.value[key];
      }
    });
    canvasSourceMap.value = newMap;

    // 从视频预览列表中移除
    const previewIndex = videoPreviews.value.findIndex(s => s.id === sourceId);
    if (previewIndex !== -1) {
      videoPreviews.value.splice(previewIndex, 1);
    }

    // 从完整列表中移除
    allSources.value = allSources.value.filter(s => s.id !== sourceId);

    console.log(`[useVideoSync] 已删除信号源: ${sourceId}`);
  };

  /**
   * 设置画布的信号源
   * 🎯 修复：同时保存到 layoutStates，确保布局切换时状态不丢失
   */
  const setCanvasSource = (canvasIndex, source) => {
    if (!source) {
      // 🎯 清空画布：使用新对象触发响应式
      const newMap = { ...canvasSourceMap.value };
      delete newMap[canvasIndex];
      canvasSourceMap.value = newMap;

      // 🎯 同时清空 layoutStates 中的记录
      const layout = currentLayout.value;
      if (layoutStates[layout]) {
        delete layoutStates[layout].slots[canvasIndex];
      }

      console.log(`[useVideoSync] 已清空画布 ${canvasIndex}`);
      return;
    }

    // 确保源在完整列表中
    if (!allSources.value.find(s => s.id === source.id)) {
      allSources.value.push(source);
    }

    // 确保源在视频预览列表中
    if (!videoPreviews.value.find(s => s.id === source.id)) {
      videoPreviews.value.push(source);
    }

    // 🎯 更新映射：使用对象展开运算符触发响应式
    canvasSourceMap.value = {
      ...canvasSourceMap.value,
      [canvasIndex]: source.id
    };
    currentSelectedSource.value = source;
    currentSelectedSourceIndex.value = canvasIndex - 1;

    // 🎯 关键修复：同步保存到 layoutStates
    const layout = currentLayout.value;
    if (layoutStates[layout]) {
      layoutStates[layout].slots[canvasIndex] = source.id;
    }

    console.log(`[useVideoSync] 已设置画布 ${canvasIndex} 的信号源: ${source.name} (布局${layout})`);

    // 🎯 触发音频状态检查
    setTimeout(() => {
      checkAudioSync();
    }, 150);
  };

  /**
   * 更新信号源信息
   */
  const updateSource = (sourceId, updates) => {
    // 更新完整列表中的源
    const sourceInAll = allSources.value.find(s => s.id === sourceId);
    if (sourceInAll) {
      Object.assign(sourceInAll, updates);
    }

    // 更新视频预览列表中的源
    const sourceInPreview = videoPreviews.value.find(s => s.id === sourceId);
    if (sourceInPreview) {
      Object.assign(sourceInPreview, updates);
    }

    console.log(`[useVideoSync] 已更新信号源: ${sourceId}`, updates);
  };

  /**
   * 获取指定画布的源
   */
  const getSourceByCanvasIndex = (canvasIndex) => {
    const sourceId = canvasSourceMap.value[canvasIndex];
    if (!sourceId) return null;
    return allSources.value.find(s => s.id === sourceId);
  };

  /**
   * 检查画布是否有信号源
   */
  const hasSourceAtCanvas = (canvasIndex) => {
    return !!canvasSourceMap.value[canvasIndex];
  };

  // ==================== 🎯 新增：录制状态管理 ====================

  /**
   * 设置画布录制状态
   */
  const setCanvasRecordingState = (canvasIndex, state) => {
    canvasRecordingStates.value.set(canvasIndex, state);
    console.log(`[useVideoSync] 设置画布 ${canvasIndex} 录制状态:`, state);
  };

  /**
   * 清除指定画布的录制状态
   */
  const clearCanvasRecordingState = (canvasIndex) => {
    canvasRecordingStates.value.delete(canvasIndex);
    console.log(`[useVideoSync] 清除画布 ${canvasIndex} 录制状态`);
  };

  /**
   * 获取指定画布的录制状态
   */
  const getCanvasRecordingState = (canvasIndex) => {
    return canvasRecordingStates.value.get(canvasIndex) || { recording: false, paused: false };
  };

  /**
   * 获取所有录制状态
   */
  const getAllRecordingStates = () => {
    return new Map(canvasRecordingStates.value);
  };

  // ==================== 🎯 新增：布局配置管理 ====================

  /**
   * 保存当前布局的信号源配置
   * 🎯 注意：不再直接操作 layoutMap，需配合外部 useLayoutStates 使用
   */
  const saveCurrentLayoutConfig = () => {
    const layoutId = currentLayout.value;
    // 🎯 这里仅返回配置数据，或由调用方通过 useLayoutStates 保存
    const config = { ...canvasSourceMap.value };
    console.log(`[useVideoSync] 准备保存布局 ${layoutId} 的配置:`, config);
    return config;
  };

  /**
   * 加载指定布局的信号源配置
   * 🎯 注意：需从外部 useLayoutStates 获取配置后传入，或在此处适配新的状态源
   */
  const loadLayoutConfig = (layoutId, savedConfig = null) => {
    const newCanvasSourceMap = {};

    // 🎯 获取当前布局的有效索引集合
    const validIndices = getValidIndices(layoutId);

    // 🎯 关键修复：尝试从 layoutStates 加载配置
    if (!savedConfig) {
      // 尝试从全局获取 layoutStates
      try {
        // 检查 window 对象上是否有 layoutStates
        if (window.__layoutStates && window.__layoutStates[layoutId]) {
          const layoutConfig = window.__layoutStates[layoutId].slots;
          console.log(`[useVideoSync] 从 window.__layoutStates 加载布局 ${layoutId} 的配置:`, layoutConfig);

          // 🎯 只保留有效索引范围内的信号源
          Object.keys(layoutConfig).forEach(key => {
            const index = parseInt(key);
            if (validIndices.has(index)) {
              newCanvasSourceMap[key] = layoutConfig[key];
            }
          });
        } else {
          console.log(`[useVideoSync] 布局 ${layoutId} 未提供配置数据，已清空画布映射`);
        }
      } catch (error) {
        console.warn(`[useVideoSync] 从 layoutStates 加载配置失败:`, error);
      }
    } else {
      // 🎯 使用传入的配置
      Object.keys(savedConfig).forEach(key => {
        const index = parseInt(key);
        if (validIndices.has(index)) {
          newCanvasSourceMap[key] = savedConfig[key];
        }
      });
      console.log(`[useVideoSync] 加载布局 ${layoutId} 的配置:`, newCanvasSourceMap);
    }

    // 🎯 使用新对象触发响应式更新，确保 Vue 组件重新渲染
    canvasSourceMap.value = { ...newCanvasSourceMap };
  };

  /**
   * 🎯 初始化布局配置
   * 🎯 已移除本地 localStorage 操作，统一由 useLayoutStates 管理
   */
  const initLayoutConfig = () => {
    console.log('[useVideoSync] 布局配置已初始化 (由 useLayoutStates 管理)');
  };

  /**
   * 🎯 核心方法：设置布局（参考 RenderCanvas.cpp setLayout）
   *
   * bool RenderCanvas::setLayout(const string& id) {
   *     acquireLock();
   *     bool changed = false;
   *     auto layout = getLayout(id);
   *     if (layout != nullptr && id != curLayout) {
   *         curLayout = id;  // ⭐ 只改变当前布局指针
   *         sig_layoutChanged("changed", curLayout);
   *         changed = true;
   *     }
   *     releaseLock();
   *     return changed;
   * }
   */
  const setLayout = (layout, position = '') => {
    const oldLayout = currentLayout.value;

    console.log(`[useVideoSync] 切换布局: ${oldLayout} -> ${layout}`);

    // 🎯 步骤1: 保存当前布局的信号源配置到 layoutStates
    if (oldLayout && typeof saveCurrentLayoutConfig === 'function') {
      saveCurrentLayoutConfig();
    }

    // 🎯 步骤2: 切换前清空旧布局的视频同步注册
    console.log(`[useVideoSync] 布局切换前清空视频同步注册: ${oldLayout} -> ${layout}`);
    clearMasterVideo();
    if (oldLayout) {
      const oldIndices = getVisibleCanvasIndices(oldLayout);
      oldIndices.forEach(i => unregisterSlaveVideo(i));
    }

    // 🎯 步骤3: 切换布局指针（⭐ 关键：不销毁旧布局）
    if (typeof switchLayout === 'function') {
      switchLayout(layout);
    } else {
      currentLayout.value = layout;
    }

    // 🎯 步骤4: 按新布局的格子数量切片/补 null
    const newIndices = getVisibleCanvasIndices(layout);
    const newLength = newIndices.length || 1;
    if (videoPreviews.value.length > newLength) {
      // 切片：截断多余的项
      videoPreviews.value = videoPreviews.value.slice(0, newLength);
    } else if (videoPreviews.value.length < newLength) {
      // 补 null：填充不足的项
      while (videoPreviews.value.length < newLength) {
        videoPreviews.value.push(null);
      }
    }

    // 🎯 步骤5: 切换时强制 maximizedIndex = null
    maximizedIndex.value = null;

    // 🎯 步骤6: 从 layoutStates 加载新布局的信号源配置
    if (typeof loadLayoutConfig === 'function') {
      try {
        loadLayoutConfig(layout);
      } catch (error) {
        console.warn(`[useVideoSync] 加载布局配置失败:`, error);
        canvasSourceMap.value = {};
      }
    } else {
      canvasSourceMap.value = {};
    }

    // 🎯 步骤7: 触发重绘（通过事件通知UI更新）
    emit('layout-changed', {
      oldLayout,
      newLayout: layout,
      preservedSources: canvasSourceMap.value
    });

    console.log(`[useVideoSync] 布局切换完成: ${layout}, pipPosition: ${position}`);
    return true;
  };

  // ==================== 🎯 新增：最大化/还原 ====================

  /**
   * 放大指定画布
   */
  const maximizeCanvas = (canvasIndex) => {
    isMaximized.value = true;
    maximizedIndex.value = canvasIndex;
    console.log(`[useVideoSync] 最大化画布: ${canvasIndex}`);
  };

  /**
   * 还原布局
   */
  const restoreLayout = () => {
    isMaximized.value = false;
    maximizedIndex.value = null;
    console.log(`[useVideoSync] 还原布局`);
  };

  // ==================== 🎯 新增：清空操作 ====================

  /**
   * 清空所有画布
   */
  const clearAllCanvases = () => {
    canvasSourceMap.value = {};
    console.log(`[useVideoSync] 已清空所有画布`);
  };

  /**
   * 重置所有状态
   */
  const reset = () => {
    allSources.value = [];
    videoPreviews.value = [];
    videoPreviewRefs.value = {};
    canvasSourceMap.value = {};
    canvasRecordingStates.value.clear();
    currentSelectedSource.value = null;
    currentSelectedSourceIndex.value = -1;
    currentLayout.value = 1;
    pipVisible.value = false;
    pipPosition.value = '';
    isMaximized.value = false;
    maximizedIndex.value = null;
    // 🎯 已移除 layoutMap 相关代码，统一使用 useLayoutStates
    console.log(`[useVideoSync] 已重置所有状态`);
  };

  // ==================== 🎯 新增：全局播放控制 API ====================

  /**
   * 🎯 全局播放控制 - 播放所有视频
   */
  const playAll = () => {
    console.log('[useVideoSync] 全局播放');

    // 播放主控视频
    stateReplicator.masters.forEach((master, sourceId) => {
      if (master.video && master.video.paused) {
        master.video.play().catch(err => {
          console.warn(`[useVideoSync] 主控播放失败: ${sourceId}`, err);
        });
      }
    });

    // 播放所有从属视频（会自动同步到主控状态）
    stateReplicator.slaveGroups.forEach((slaves, sourceId) => {
      slaves.forEach((slave, canvasId) => {
        if (slave.video && slave.video.paused) {
          slave.video.play().catch(err => {
            console.warn(`[useVideoSync] 从属播放失败: ${canvasId} -> ${sourceId}`, err);
          });
        }
      });
    });
  };

  /**
   * 🎯 全局播放控制 - 暂停所有视频
   */
  const pauseAll = () => {
    console.log('[useVideoSync] 全局暂停');

    // 暂停主控视频
    stateReplicator.masters.forEach((master, sourceId) => {
      if (master.video && !master.video.paused) {
        master.video.pause();
      }
    });

    // 暂停所有从属视频
    stateReplicator.slaveGroups.forEach((slaves, sourceId) => {
      slaves.forEach((slave, canvasId) => {
        if (slave.video && !slave.video.paused) {
          slave.video.pause();
        }
      });
    });
  };

  /**
   * 🎯 全局播放控制 - 切换播放/暂停状态
   */
  const togglePlayPauseAll = () => {
    console.log('[useVideoSync] 全局切换播放/暂停');

    // 检查是否有正在播放的视频
    let hasPlaying = false;

    stateReplicator.masters.forEach((master) => {
      if (master.video && !master.video.paused) {
        hasPlaying = true;
      }
    });

    if (!hasPlaying) {
      stateReplicator.slaveGroups.forEach((slaves) => {
        slaves.forEach((slave) => {
          if (slave.video && !slave.video.paused) {
            hasPlaying = true;
          }
        });
      });
    }

    if (hasPlaying) {
      pauseAll();
    } else {
      playAll();
    }
  };

  /**
   * 🎯 全局播放控制 - 停止所有视频（重置到开始位置）
   */
  const stopAll = () => {
    console.log('[useVideoSync] 全局停止');

    // 停止主控视频
    stateReplicator.masters.forEach((master, sourceId) => {
      if (master.video) {
        master.video.pause();
        master.video.currentTime = 0;
      }
    });

    // 停止所有从属视频
    stateReplicator.slaveGroups.forEach((slaves, sourceId) => {
      slaves.forEach((slave, canvasId) => {
        if (slave.video) {
          slave.video.pause();
          slave.video.currentTime = 0;
        }
      });
    });
  };

  /**
   * 🎯 全局播放控制 - 同步所有视频到指定时间点
   * @param {number} time - 目标时间（秒）
   * @param {string} [sourceId] - 可选，仅同步指定源的视频
   */
  const seekAll = (time, sourceId = null) => {
    console.log(`[useVideoSync] 全局跳转到 ${time}s`, sourceId ? `(源: ${sourceId})` : '');

    if (sourceId) {
      // 仅同步指定源
      const master = stateReplicator.masters.get(sourceId);
      if (master && master.video) {
        master.video.currentTime = time;
      }

      const slaves = stateReplicator.slaveGroups.get(sourceId);
      if (slaves) {
        slaves.forEach((slave, canvasId) => {
          if (slave.video) {
            slave.video.currentTime = time;
          }
        });
      }
    } else {
      // 同步所有源
      stateReplicator.masters.forEach((master, srcId) => {
        if (master.video) {
          master.video.currentTime = time;
        }
      });

      stateReplicator.slaveGroups.forEach((slaves, srcId) => {
        slaves.forEach((slave, canvasId) => {
          if (slave.video) {
            slave.video.currentTime = time;
          }
        });
      });
    }
  };

  /**
   * 🎯 全局播放控制 - 设置播放速度
   * @param {number} rate - 播放速度（0.5, 1, 1.5, 2 等）
   * @param {string} [sourceId] - 可选，仅设置指定源的视频
   */
  const setPlaybackRate = (rate, sourceId = null) => {
    console.log(`[useVideoSync] 设置播放速度: ${rate}x`, sourceId ? `(源: ${sourceId})` : '');

    if (sourceId) {
      // 仅设置指定源
      const master = stateReplicator.masters.get(sourceId);
      if (master && master.video) {
        master.video.playbackRate = rate;
        master.playbackRate = rate;
      }

      const slaves = stateReplicator.slaveGroups.get(sourceId);
      if (slaves) {
        slaves.forEach((slave, canvasId) => {
          if (slave.video) {
            slave.video.playbackRate = rate;
          }
        });
      }
    } else {
      // 设置所有源
      stateReplicator.masters.forEach((master, srcId) => {
        if (master.video) {
          master.video.playbackRate = rate;
          master.playbackRate = rate;
        }
      });

      stateReplicator.slaveGroups.forEach((slaves, srcId) => {
        slaves.forEach((slave, canvasId) => {
          if (slave.video) {
            slave.video.playbackRate = rate;
          }
        });
      });
    }
  };

  /**
   * 🎯 全局播放控制 - 设置音量
   * @param {number} volume - 音量（0-100）
   * @param {string} [sourceId] - 可选，仅设置指定源的视频
   */
  const setVolumeAll = (volume, sourceId = null) => {
    console.log(`[useVideoSync] 设置音量: ${volume}%`, sourceId ? `(源: ${sourceId})` : '');

    const normalizedVolume = Math.max(0, Math.min(100, volume)) / 100;

    if (sourceId) {
      // 更新源的音频状态
      audioRouter.updateSourceAudioState(sourceId, { enabled: true, volume });

      // 仅设置指定源
      const master = stateReplicator.masters.get(sourceId);
      if (master && master.video) {
        master.video.volume = normalizedVolume;
      }

      const slaves = stateReplicator.slaveGroups.get(sourceId);
      if (slaves) {
        slaves.forEach((slave, canvasId) => {
          if (slave.video) {
            slave.video.volume = normalizedVolume;
          }
        });
      }
    } else {
      // 设置所有源
      allSources.value.forEach(source => {
        audioRouter.updateSourceAudioState(source.id, { enabled: true, volume });
      });

      stateReplicator.masters.forEach((master, srcId) => {
        if (master.video) {
          master.video.volume = normalizedVolume;
        }
      });

      stateReplicator.slaveGroups.forEach((slaves, srcId) => {
        slaves.forEach((slave, canvasId) => {
          if (slave.video) {
            slave.video.volume = normalizedVolume;
          }
        });
      });
    }
  };

  /**
   * 🎯 全局播放控制 - 静音/取消静音所有视频
   * @param {boolean} muted - 是否静音
   * @param {string} [sourceId] - 可选，仅设置指定源的视频
   */
  const setMuteAll = (muted, sourceId = null) => {
    console.log(`[useVideoSync] ${muted ? '静音' : '取消静音'}所有视频`, sourceId ? `(源: ${sourceId})` : '');

    if (sourceId) {
      // 更新源的音频状态
      const state = audioRouter.getSourceAudioState(sourceId);
      audioRouter.updateSourceAudioState(sourceId, { ...state, enabled: !muted });

      // 仅设置指定源
      const master = stateReplicator.masters.get(sourceId);
      if (master && master.video) {
        master.video.muted = muted;
      }

      const slaves = stateReplicator.slaveGroups.get(sourceId);
      if (slaves) {
        slaves.forEach((slave, canvasId) => {
          if (slave.video) {
            slave.video.muted = muted;
          }
        });
      }
    } else {
      // 设置所有源
      allSources.value.forEach(source => {
        const state = audioRouter.getSourceAudioState(source.id);
        audioRouter.updateSourceAudioState(source.id, { ...state, enabled: !muted });
      });

      stateReplicator.masters.forEach((master, srcId) => {
        if (master.video) {
          master.video.muted = muted;
        }
      });

      stateReplicator.slaveGroups.forEach((slaves, srcId) => {
        slaves.forEach((slave, canvasId) => {
          if (slave.video) {
            slave.video.muted = muted;
          }
        });
      });
    }
  };

  /**
   * 🎯 获取所有视频的播放状态
   * @returns {Object} 包含所有视频状态的对象
   */
  const getAllVideoStates = () => {
    const states = {};

    // 获取主控视频状态
    stateReplicator.masters.forEach((master, sourceId) => {
      const video = master.video;
      states[sourceId] = {
        type: 'master',
        currentTime: video?.currentTime || 0,
        duration: video?.duration || 0,
        paused: video?.paused || true,
        playbackRate: video?.playbackRate || 1,
        volume: video?.volume || 1,
        muted: video?.muted || false,
        readyState: video?.readyState || 0,
        slaves: []
      };
    });

    // 获取从属视频状态
    stateReplicator.slaveGroups.forEach((slaves, sourceId) => {
      if (!states[sourceId]) {
        states[sourceId] = {
          type: 'slave-only',
          slaves: []
        };
      }

      slaves.forEach((slave, canvasId) => {
        const video = slave.video;
        states[sourceId].slaves.push({
          canvasId,
          currentTime: video?.currentTime || 0,
          duration: video?.duration || 0,
          paused: video?.paused || true,
          playbackRate: video?.playbackRate || 1,
          volume: video?.volume || 1,
          muted: video?.muted || false,
          readyState: video?.readyState || 0,
          syncEnabled: slave.syncEnabled,
          lastSyncedTime: slave.lastSyncedTime
        });
      });
    });

    return states;
  };

  /**
   * 🎯 强制同步所有视频到主控状态
   */
  const forceSyncAll = () => {
    console.log('[useVideoSync] 强制同步所有视频');

    stateReplicator.masters.forEach((master, sourceId) => {
      const slaves = stateReplicator.slaveGroups.get(sourceId);
      if (slaves) {
        slaves.forEach((slave, canvasId) => {
          stateReplicator.forceReplicateTo(canvasId, sourceId);
        });
      }
    });
  };

  return {
    // 核心状态
    currentLayout,
    pipVisible,
    pipPosition,
    videoPreviews,
    videoPreviewRefs,
    canvasSourceMap,
    // 🎯 新增：信号源管理状态
    allSources,
    currentSelectedSource,
    currentSelectedSourceIndex,
    isMaximized,
    maximizedIndex,
    // 🎯 已移除 layoutMap，统一使用 useLayoutStates
    canvasRecordingStates,
    // 布局管理
    changeLayout,
    togglePip,
    setPipPosition,
    // 🎯 新增：布局管理扩展
    setLayout,
    maximizeCanvas,
    restoreLayout,
    clearAllCanvases,
    saveCurrentLayoutConfig,
    loadLayoutConfig,
    initLayoutConfig, // 🎯 新增：初始化布局配置
    // 🎯 已移除 saveLayoutMap，统一使用 useLayoutStates.saveToStorage()
    // 视频源管理
    initVideoPreviewsLength,
    getVisibleCanvasCount, // 🎯 新增：导出获取可见画布数量的方法
    addVideoSource,
    removeVideoSource,
    setVideoPreviewRef,
    // 🎯 新增：信号源管理
    addSource,
    removeSource,
    setCanvasSource,
    updateSource,
    getSourceByCanvasIndex,
    hasSourceAtCanvas,
    // 🎯 新增：录制状态管理
    setCanvasRecordingState,
    clearCanvasRecordingState,
    getCanvasRecordingState,
    getAllRecordingStates,
    // 原有功能
    stateReplicator,
    audioRouter,
    previewProgressMap,
    initSourcePreviewProgress,
    onPreviewVideoTimeUpdate,
    onPreviewVideoLoadedMetadata,
    seekPreviewVideo,
    getPreviewProgress,
    formatPreviewTime,
    registerMasterVideo,
    registerSlaveVideo,
    unregisterSlaveVideo,
    clearMasterVideo,
    checkAudioSync,
    setCanvasAudio,
    getSyncStatus,
    cleanup,
    // 🎯 新增：重置功能
    reset,
    // 🎯 新增：全局播放控制 API
    playAll,
    pauseAll,
    togglePlayPauseAll,
    stopAll,
    seekAll,
    setPlaybackRate,
    setVolumeAll,
    setMuteAll,
    getAllVideoStates,
    forceSyncAll,
    // 🎯 新增：用户选择音频输出 API
    selectAudioOutput: (targetId) => audioRouter.selectAudioOutput(targetId),
    toggleCanvasAudio: (canvasId) => audioRouter.toggleCanvasAudio(canvasId)
  };
}
