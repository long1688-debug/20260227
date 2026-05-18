/**
 * WebRTC 信令服务器
 * 支持多房间、多参与者、P2P 连接建立
 */

const WebSocket = require('ws');
const crypto = require('crypto');

class SignalingServer {
  constructor(config = {}) {
    this.port = config.port || 8081;
    this.rooms = new Map();
    this.clients = new Map();
    this.heartbeatInterval = config.heartbeatInterval || 30000;
    this.clientTimeout = config.clientTimeout || 60000;
  }

  start() {
    this.wss = new WebSocket.Server({ port: this.port });

    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      console.log(`[信令] 客户端连接: ${clientId}`);

      this.clients.set(clientId, {
        ws,
        roomId: null,
        participantId: clientId,
        name: `用户-${clientId.slice(-4)}`,
        joinedAt: Date.now(),
        lastHeartbeat: Date.now()
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          this.handleMessage(clientId, message);
        } catch (error) {
          console.error(`[信令] 消息解析失败:`, error);
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(clientId);
      });

      ws.on('error', (error) => {
        console.error(`[信令] WebSocket 错误: ${clientId}`, error);
      });

      ws.on('pong', () => {
        const client = this.clients.get(clientId);
        if (client) {
          client.lastHeartbeat = Date.now();
        }
      });

      this.send(ws, {
        type: 'connected',
        clientId,
        timestamp: Date.now()
      });
    });

    this.startHeartbeat();
    console.log(`[信令] 服务器已启动，端口: ${this.port}`);
  }

  generateClientId() {
    return crypto.randomBytes(8).toString('hex');
  }

  generateRoomId() {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  handleMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'ping':
        client.lastHeartbeat = Date.now();
        this.send(client.ws, { type: 'pong', timestamp: Date.now() });
        break;

      case 'join-room':
        this.handleJoinRoom(clientId, message);
        break;

      case 'leave-room':
        this.handleLeaveRoom(clientId);
        break;

      case 'offer':
      case 'answer':
      case 'ice-candidate':
        this.relayMessage(clientId, message);
        break;

      case 'chat':
        this.handleChatMessage(clientId, message);
        break;

      case 'screenshare-started':
      case 'screenshare-stopped':
        this.broadcastToRoom(clientId, {
          type: message.type,
          from: clientId,
          fromName: client.name,
          timestamp: Date.now()
        }, false);
        break;

      case 'set-name':
        client.name = message.name || client.name;
        this.broadcastToRoom(clientId, {
          type: 'participant-updated',
          from: clientId,
          name: client.name,
          timestamp: Date.now()
        }, false);
        break;

      case 'get-room-peers':
        this.sendRoomPeers(clientId);
        break;

      default:
        console.log(`[信令] 未知消息类型: ${message.type}`);
    }
  }

  handleJoinRoom(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    let roomId = message.roomId;

    if (!roomId) {
      roomId = this.generateRoomId();
    }

    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        participants: new Map(),
        createdAt: Date.now()
      });
      console.log(`[信令] 创建房间: ${roomId}`);
    }

    const room = this.rooms.get(roomId);

    if (room.participants.has(clientId)) {
      console.log(`[信令] 客户端已在房间: ${clientId}`);
      return;
    }

    if (client.roomId) {
      this.handleLeaveRoom(clientId);
    }

    room.participants.set(clientId, {
      id: clientId,
      name: message.name || client.name,
      joinedAt: Date.now()
    });

    client.roomId = roomId;
    client.name = message.name || client.name;

    this.send(client.ws, {
      type: 'room-joined',
      roomId,
      participantId: clientId,
      participants: Array.from(room.participants.values()),
      timestamp: Date.now()
    });

    this.broadcastToRoom(clientId, {
      type: 'peer-joined',
      peerId: clientId,
      name: client.name,
      timestamp: Date.now()
    }, false);

    console.log(`[信令] ${client.name} 加入房间 ${roomId}`);
  }

  handleLeaveRoom(clientId) {
    const client = this.clients.get(clientId);
    if (!client || !client.roomId) return;

    const roomId = client.roomId;
    const room = this.rooms.get(roomId);

    if (room) {
      room.participants.delete(clientId);

      this.broadcastToRoom(clientId, {
        type: 'peer-left',
        peerId: clientId,
        timestamp: Date.now()
      }, false);

      if (room.participants.size === 0) {
        this.rooms.delete(roomId);
        console.log(`[信令] 房间已删除: ${roomId}`);
      }
    }

    client.roomId = null;
    console.log(`[信令] ${client.name} 离开房间 ${roomId}`);
  }

  handleDisconnect(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (client.roomId) {
      this.handleLeaveRoom(clientId);
    }

    this.clients.delete(clientId);
    console.log(`[信令] 客户端断开: ${clientId}`);
  }

  relayMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || !client.roomId) return;

    const targetPeerId = message.to;
    if (!targetPeerId) return;

    const targetClient = this.clients.get(targetPeerId);
    if (!targetClient || targetClient.roomId !== client.roomId) return;

    const relayMessage = {
      type: message.type,
      from: clientId,
      fromName: client.name,
      sdp: message.sdp,
      candidate: message.candidate,
      timestamp: Date.now()
    };

    this.send(targetClient.ws, relayMessage);
  }

  handleChatMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || !client.roomId) return;

    this.broadcastToRoom(clientId, {
      type: 'chat',
      from: clientId,
      fromName: client.name,
      content: message.content,
      timestamp: Date.now()
    }, true);
  }

  broadcastToRoom(senderId, message, includeSender = true) {
    const sender = this.clients.get(senderId);
    if (!sender || !sender.roomId) return;

    const room = this.rooms.get(sender.roomId);
    if (!room) return;

    room.participants.forEach((participant, peerId) => {
      if (!includeSender && peerId === senderId) return;

      const peer = this.clients.get(peerId);
      if (peer && peer.ws.readyState === WebSocket.OPEN) {
        this.send(peer.ws, message);
      }
    });
  }

  sendRoomPeers(clientId) {
    const client = this.clients.get(clientId);
    if (!client || !client.roomId) return;

    const room = this.rooms.get(client.roomId);
    if (!room) return;

    this.send(client.ws, {
      type: 'room-peers',
      peers: Array.from(room.participants.values()),
      timestamp: Date.now()
    });
  }

  send(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();

      this.clients.forEach((client, clientId) => {
        if (now - client.lastHeartbeat > this.clientTimeout) {
          console.log(`[信令] 客户端超时: ${clientId}`);
          client.ws.terminate();
          this.handleDisconnect(clientId);
          return;
        }

        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      });
    }, this.heartbeatInterval);
  }

  stop() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.wss?.close();
    console.log('[信令] 服务器已停止');
  }

  getStats() {
    return {
      totalClients: this.clients.size,
      totalRooms: this.rooms.size,
      rooms: Array.from(this.rooms.entries()).map(([id, room]) => ({
        id,
        participantCount: room.participants.size
      }))
    };
  }
}

if (require.main === module) {
  const config = {
    port: parseInt(process.env.WS_PORT || '8081'),
    heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30000'),
    clientTimeout: parseInt(process.env.CLIENT_TIMEOUT || '60000')
  };

  const server = new SignalingServer(config);
  server.start();

  process.on('SIGINT', () => {
    console.log('\n[信令] 正在关闭...');
    server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n[信令] 正在关闭...');
    server.stop();
    process.exit(0);
  });
}

module.exports = SignalingServer;