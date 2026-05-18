/**
 * 分布式会话管理服务
 * 基于 Redis 的会话存储和实时消息处理
 */

const Redis = require('ioredis');

class SessionService {
  constructor(options = {}) {
    this.options = {
      host: options.host || process.env.REDIS_HOST || 'localhost',
      port: options.port || process.env.REDIS_PORT || 6379,
      password: options.password || process.env.REDIS_PASSWORD,
      db: options.db || 0,
      keyPrefix: options.keyPrefix || 'training:',
      sessionTTL: options.sessionTTL || 86400,
      ...options
    };

    this.primary = this.createClient();
    this.replica = this.createClient({ readOnly: true });
    this.subscriber = this.createClient();

    this.setupPubSub();
    this.setupEventHandlers();
  }

  createClient(options = {}) {
    const client = new Redis({
      host: options.host || this.options.host,
      port: options.port || this.options.port,
      password: this.options.password,
      db: this.db || 0,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      readOnly: options.readOnly || false
    });

    client.on('error', (err) => {
      console.error('[Session] Redis 错误:', err.message);
    });

    client.on('connect', () => {
      console.log(`[Session] Redis 连接: ${options.readOnly ? '只读' : '主'}`);
    });

    return client;
  }

  setupPubSub() {
    this.subscriber.subscribe(
      'session:invalidate',
      'user:offline',
      'room:event',
      'media:event',
      'cache:invalidate'
    );

    this.subscriber.on('message', (channel, message) => {
      try {
        const data = JSON.parse(message);
        this.handlePubSubMessage(channel, data);
      } catch (error) {
        console.error('[Session] PubSub 消息处理失败:', error);
      }
    });
  }

  setupEventHandlers() {
    this.primary.on('ready', () => {
      console.log('[Session] Redis 主节点就绪');
    });

    this.replica.on('ready', () => {
      console.log('[Session] Redis 只读节点就绪');
    });
  }

  handlePubSubMessage(channel, data) {
    console.log(`[Session] PubSub [${channel}]:`, data);

    switch (channel) {
      case 'session:invalidate':
        this.emit('session:invalidate', data);
        break;
      case 'user:offline':
        this.emit('user:offline', data);
        break;
      case 'room:event':
        this.emit('room:event', data);
        break;
      case 'media:event':
        this.emit('media:event', data);
        break;
    }
  }

  emit(event, data) {
    if (this.eventHandlers && this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[Session] 事件处理错误 [${event}]:`, error);
        }
      });
    }
  }

  on(event, handler) {
    if (!this.eventHandlers) {
      this.eventHandlers = {};
    }
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = new Set();
    }
    this.eventHandlers[event].add(handler);
    return () => this.eventHandlers[event].delete(handler);
  }

  off(event, handler) {
    if (this.eventHandlers && this.eventHandlers[event]) {
      this.eventHandlers[event].delete(handler);
    }
  }

  getKey(type, ...parts) {
    return `${this.options.keyPrefix}${type}:${parts.join(':')}`;
  }

  async createSession(sessionId, userId, data = {}) {
    const session = {
      id: sessionId,
      userId,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      ...data
    };

    const key = this.getKey('session', sessionId);
    await this.primary.setex(key, this.options.sessionTTL, JSON.stringify(session));

    await this.primary.sadd(this.getKey('user:sessions', userId), sessionId);
    await this.primary.expire(this.getKey('user:sessions', userId), this.options.sessionTTL);

    await this.publish('session:created', { sessionId, userId });

    return session;
  }

  async getSession(sessionId) {
    const key = this.getKey('session', sessionId);
    const data = await this.replica.get(key);
    return data ? JSON.parse(data) : null;
  }

  async updateSession(sessionId, updates) {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    Object.assign(session, updates, { lastActiveAt: Date.now() });

    const key = this.getKey('session', sessionId);
    await this.primary.setex(key, this.options.sessionTTL, JSON.stringify(session));

    return session;
  }

  async deleteSession(sessionId) {
    const session = await this.getSession(sessionId);
    if (session) {
      await this.primary.srem(this.getKey('user:sessions', session.userId), sessionId);
    }
    await this.primary.del(this.getKey('session', sessionId));

    if (session) {
      await this.publish('session:deleted', { sessionId, userId: session.userId });
    }
  }

  async getUserSessions(userId) {
    const sessionIds = await this.replica.smembers(this.getKey('user:sessions', userId));
    const sessions = await Promise.all(
      sessionIds.map(id => this.getSession(id))
    );
    return sessions.filter(s => s !== null);
  }

  async publish(channel, data) {
    await this.primary.publish(channel, JSON.stringify(data));
  }

  async cacheSet(key, value, ttlSeconds = 300) {
    const fullKey = this.getKey('cache', key);
    await this.primary.setex(fullKey, ttlSeconds, JSON.stringify(value));
  }

  async cacheGet(key) {
    const fullKey = this.getKey('cache', key);
    const data = await this.replica.get(fullKey);
    return data ? JSON.parse(data) : null;
  }

  async cacheDelete(key) {
    const fullKey = this.getKey('cache', key);
    await this.primary.del(fullKey);
  }

  async cacheInvalidate(pattern) {
    const fullPattern = this.getKey('cache', pattern);
    const keys = await this.primary.keys(fullPattern);
    if (keys.length > 0) {
      await this.primary.del(...keys);
    }
    await this.publish('cache:invalidate', { pattern });
  }

  async setRoomState(roomId, state) {
    const key = this.getKey('room', roomId);
    await this.primary.hset(key, 'state', JSON.stringify(state));
    await this.primary.hset(key, 'updatedAt', Date.now().toString());
    await this.primary.expire(key, 86400);
  }

  async getRoomState(roomId) {
    const key = this.getKey('room', roomId);
    const state = await this.replica.hget(key, 'state');
    return state ? JSON.parse(state) : null;
  }

  async addPeerToRoom(roomId, peerId, peerInfo) {
    const peersKey = this.getKey('room', roomId, 'peers');
    await this.primary.hset(peersKey, peerId, JSON.stringify({
      ...peerInfo,
      joinedAt: Date.now()
    }));
    await this.primary.expire(peersKey, 86400);

    await this.publish('room:event', {
      type: 'peer-joined',
      roomId,
      peerId,
      peerInfo
    });
  }

  async removePeerFromRoom(roomId, peerId) {
    const peersKey = this.getKey('room', roomId, 'peers');
    await this.primary.hdel(peersKey, peerId);

    await this.publish('room:event', {
      type: 'peer-left',
      roomId,
      peerId
    });
  }

  async getRoomPeers(roomId) {
    const peersKey = this.getKey('room', roomId, 'peers');
    const peers = await this.replica.hgetall(peersKey);
    return Object.entries(peers).reduce((acc, [id, info]) => {
      acc[id] = JSON.parse(info);
      return acc;
    }, {});
  }

  async setStreamState(streamId, state) {
    const key = this.getKey('stream', streamId);
    await this.primary.setex(key, 3600, JSON.stringify({
      ...state,
      updatedAt: Date.now()
    }));
  }

  async getStreamState(streamId) {
    const key = this.getKey('stream', streamId);
    const data = await this.replica.get(key);
    return data ? JSON.parse(data) : null;
  }

  async checkRateLimit(key, limit, windowSeconds = 60) {
    const fullKey = this.getKey('ratelimit', key);
    const current = await this.primary.incr(fullKey);

    if (current === 1) {
      await this.primary.expire(fullKey, windowSeconds);
    }

    return {
      allowed: current <= limit,
      current,
      remaining: Math.max(0, limit - current),
      resetIn: await this.primary.ttl(fullKey)
    };
  }

  async acquireLock(lockName, ttlMs = 30000) {
    const lockKey = this.getKey('lock', lockName);
    const lockValue = `${process.pid}:${Date.now()}:${Math.random()}`;

    const acquired = await this.primary.set(lockKey, lockValue, 'PX', ttlMs, 'NX');

    if (acquired) {
      return lockValue;
    }
    return null;
  }

  async releaseLock(lockName, lockValue) {
    const lockKey = this.getKey('lock', lockName);
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.primary.eval(script, 1, lockKey, lockValue);
    return result === 1;
  }

  async withLock(lockName, callback, ttlMs = 30000) {
    const lockValue = await this.acquireLock(lockName, ttlMs);

    if (!lockValue) {
      throw new Error(`无法获取锁: ${lockName}`);
    }

    try {
      return await callback();
    } finally {
      await this.releaseLock(lockName, lockValue);
    }
  }

  async cacheSignaling(roomId, peerId, signalData) {
    const key = this.getKey('room', roomId, 'peer', peerId, 'signal');
    await this.primary.setex(key, 300, JSON.stringify(signalData));
  }

  async getSignaling(roomId, peerId) {
    const key = this.getKey('room', roomId, 'peer', peerId, 'signal');
    const data = await this.replica.get(key);
    return data ? JSON.parse(data) : null;
  }

  async setUserPresence(userId, status, metadata = {}) {
    const key = this.getKey('presence', userId);
    const data = {
      status,
      metadata,
      lastSeen: Date.now()
    };
    await this.primary.setex(key, 300, JSON.stringify(data));

    await this.publish('user:presence', { userId, status, metadata });
  }

  async getUserPresence(userId) {
    const key = this.getKey('presence', userId);
    const data = await this.replica.get(key);
    return data ? JSON.parse(data) : null;
  }

  async getOnlineUsers() {
    const pattern = this.getKey('presence', '*');
    const keys = await this.replica.keys(pattern);
    const users = await Promise.all(keys.map(key => this.replica.get(key)));
    return users.map(data => data ? JSON.parse(data) : null).filter(Boolean);
  }

  async healthCheck() {
    const start = Date.now();
    await this.primary.ping();
    const latency = Date.now() - start;

    const info = await this.primary.info('memory');
    const match = info.match(/used_memory_human:(\S+)/);
    const memoryUsed = match ? match[1] : 'unknown';

    return {
      status: 'healthy',
      latency,
      memoryUsed,
      connectedClients: await this.primary.info('clients').then(i => {
        const m = i.match(/connected_clients:(\d+)/);
        return m ? parseInt(m[1]) : 0;
      })
    };
  }

  async close() {
    await this.primary.quit();
    await this.replica.quit();
    await this.subscriber.quit();
    console.log('[Session] Redis 连接已关闭');
  }
}

module.exports = SessionService;