/**
 * Tauri WebRTC 客户端服务
 * 在 Tauri 原生桌面应用中使用 WebRTC 实时传输功能
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface RTCSignalingMessage {
  type: string;
  room_id?: string;
  from?: string;
  to?: string;
  sdp?: string;
  candidate?: any;
  peer_id?: string;
  name?: string;
}

export interface PeerInfo {
  id: string;
  name: string;
  joined_at: number;
  window_label?: string;
}

class TauriWebRTCService {
  private peerId: string = '';
  private roomId: string = '';
  private isConnected: boolean = false;
  private localStream: MediaStream | null = null;
  private remoteStreams: Map<string, MediaStream> = new Map();
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private eventListeners: Map<string, Set<(data: any) => void>> = new Map();

  private defaultIceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stunserver.org:3478' }
  ];

  constructor() {
    this.setupEventListeners();
    this.registerSignalingListener();
  }

  private setupEventListeners() {
    this.eventListeners.set('peer-joined', new Set());
    this.eventListeners.set('peer-left', new Set());
    this.eventListeners.set('remote-stream', new Set());
    this.eventListeners.set('data-message', new Set());
    this.eventListeners.set('connection-state-change', new Set());
    this.eventListeners.set('signaling-error', new Set());
  }

  private async registerSignalingListener() {
    try {
      await listen('webrtc-signaling', (event) => {
        const message: RTCSignalingMessage = event.payload;
        this.handleSignalingMessage(message);
      });
    } catch (error) {
      console.error('[TauriWebRTC] 注册信令监听器失败:', error);
    }
  }

  public on(event: string, callback: (data: any) => void) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.add(callback);
    }
  }

  public off(event: string, callback: (data: any) => void) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emit(event: string, data: any) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[TauriWebRTC] Event listener error for ${event}:`, error);
        }
      });
    }
  }

  /**
   * 生成唯一的对等方 ID
   */
  public async generatePeerId(): Promise<string> {
    try {
      const result = await invoke < string > ('webrtc_generate_peer_id');
      this.peerId = result;
      return result;
    } catch (error) {
      console.error('[TauriWebRTC] 生成 Peer ID 失败:', error);
      throw error;
    }
  }

  /**
   * 加入房间
   */
  public async joinRoom(roomId: string, peerName: string, windowLabel: string): Promise<{ peers: PeerInfo[] }> {
    try {
      if (!this.peerId) {
        await this.generatePeerId();
      }

      const result = await invoke < { peers: PeerInfo[] } > ('webrtc_join_room', {
        room_id: roomId,
        peer_id: this.peerId,
        peer_name: peerName,
        window_label: windowLabel
      });

      this.roomId = roomId;
      this.isConnected = true;

      console.log('[TauriWebRTC] 成功加入房间:', roomId);
      return result;
    } catch (error) {
      console.error('[TauriWebRTC] 加入房间失败:', error);
      this.emit('signaling-error', { error });
      throw error;
    }
  }

  /**
   * 离开房间
   */
  public async leaveRoom(): Promise<void> {
    try {
      if (!this.roomId || !this.peerId) {
        return;
      }

      await invoke('webrtc_leave_room', {
        room_id: this.roomId,
        peer_id: this.peerId
      });

      this.closeAllPeerConnections();
      this.roomId = '';
      this.isConnected = false;

      console.log('[TauriWebRTC] 已离开房间');
    } catch (error) {
      console.error('[TauriWebRTC] 离开房间失败:', error);
      throw error;
    }
  }

  /**
   * 获取房间成员列表
   */
  public async getRoomPeers(): Promise<PeerInfo[]> {
    try {
      const result = await invoke < { peers: PeerInfo[] } > ('webrtc_get_room_peers', {
        room_id: this.roomId
      });
      return result.peers;
    } catch (error) {
      console.error('[TauriWebRTC] 获取房间成员失败:', error);
      throw error;
    }
  }

  /**
   * 获取服务状态
   */
  public async getServiceStatus(): Promise<any> {
    try {
      const result = await invoke('webrtc_get_service_status');
      return result;
    } catch (error) {
      console.error('[TauriWebRTC] 获取服务状态失败:', error);
      throw error;
    }
  }

  /**
   * 获取本地媒体流
   */
  public async getLocalStream(constraints: MediaStreamConstraints = {}): Promise<MediaStream> {
    try {
      const defaultConstraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      this.localStream = await navigator.mediaDevices.getUserMedia({
        ...defaultConstraints,
        ...constraints
      });

      console.log('[TauriWebRTC] 本地媒体流获取成功');
      return this.localStream;
    } catch (error) {
      console.error('[TauriWebRTC] 获取本地媒体流失败:', error);
      throw error;
    }
  }

  /**
   * 创建 P2P 连接
   */
  public async createPeerConnection(peerId: string): Promise<RTCPeerConnection> {
    if (this.peerConnections.has(peerId)) {
      return this.peerConnections.get(peerId)!;
    }

    const pc = new RTCPeerConnection({
      iceServers: this.defaultIceServers,
      iceCandidatePoolSize: 10
    });

    // 添加本地流
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // 处理远程流
    pc.ontrack = (event) => {
      console.log('[TauriWebRTC] 收到远程流:', peerId);
      const remoteStream = event.streams[0];
      this.remoteStreams.set(peerId, remoteStream);
      this.emit('remote-stream', { id: peerId, stream: remoteStream });
    };

    // 处理 ICE 候选
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await this.sendIceCandidate(peerId, event.candidate);
      }
    };

    // 处理连接状态
    pc.onconnectionstatechange = () => {
      console.log('[TauriWebRTC] 连接状态:', peerId, pc.connectionState);
      this.emit('connection-state-change', { id: peerId, state: pc.connectionState });

      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.handleConnectionFailure(peerId);
      }
    };

    this.peerConnections.set(peerId, pc);
    return pc;
  }

  /**
   * 发送 Offer
   */
  public async sendOffer(peerId: string): Promise<void> {
    const pc = await this.createPeerConnection(peerId);

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await pc.setLocalDescription(offer);

      await invoke('webrtc_send_offer', {
        room_id: this.roomId,
        from: this.peerId,
        to: peerId,
        sdp: pc.localDescription!.sdp!
      });

      console.log('[TauriWebRTC] 发送 Offer:', this.peerId, '->', peerId);
    } catch (error) {
      console.error('[TauriWebRTC] 发送 Offer 失败:', error);
      throw error;
    }
  }

  /**
   * 发送 Answer
   */
  public async sendAnswer(peerId: string, sdp: string): Promise<void> {
    const pc = await this.createPeerConnection(peerId);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await invoke('webrtc_send_answer', {
        room_id: this.roomId,
        from: this.peerId,
        to: peerId,
        sdp: pc.localDescription!.sdp!
      });

      console.log('[TauriWebRTC] 发送 Answer:', this.peerId, '->', peerId);
    } catch (error) {
      console.error('[TauriWebRTC] 发送 Answer 失败:', error);
      throw error;
    }
  }

  /**
   * 发送 ICE 候选
   */
  public async sendIceCandidate(peerId: string, candidate: RTCIceCandidate): Promise<void> {
    try {
      await invoke('webrtc_send_ice_candidate', {
        room_id: this.roomId,
        from: this.peerId,
        to: peerId,
        candidate: {
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex
        }
      });

      console.log('[TauriWebRTC] 发送 ICE Candidate:', this.peerId, '->', peerId);
    } catch (error) {
      console.error('[TauriWebRTC] 发送 ICE Candidate 失败:', error);
    }
  }

  /**
   * 处理信令消息
   */
  private async handleSignalingMessage(message: RTCSignalingMessage) {
    console.log('[TauriWebRTC] 收到信令消息:', message.type);

    switch (message.type) {
      case 'PeerJoined':
        if (message.peer_id && message.peer_id !== this.peerId) {
          this.emit('peer-joined', { id: message.peer_id, name: message.name });
          // 为新成员创建连接并发送 Offer
          await this.sendOffer(message.peer_id);
        }
        break;

      case 'PeerLeft':
        if (message.peer_id) {
          this.closePeerConnection(message.peer_id);
          this.emit('peer-left', { id: message.peer_id });
        }
        break;

      case 'Offer':
        if (message.from && message.sdp) {
          await this.sendAnswer(message.from, message.sdp);
        }
        break;

      case 'Answer':
        if (message.from && message.sdp) {
          const pc = this.peerConnections.get(message.from);
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: message.sdp }));
          }
        }
        break;

      case 'IceCandidate':
        if (message.from && message.candidate) {
          const pc = this.peerConnections.get(message.from);
          if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
          }
        }
        break;

      default:
        console.log('[TauriWebRTC] 未知消息类型:', message.type);
    }
  }

  /**
   * 处理连接失败
   */
  private async handleConnectionFailure(peerId: string) {
    console.log('[TauriWebRTC] 连接失败，尝试重连:', peerId);
    this.closePeerConnection(peerId);

    setTimeout(async () => {
      try {
        await this.createPeerConnection(peerId);
        await this.sendOffer(peerId);
      } catch (error) {
        console.error('[TauriWebRTC] 重连失败:', error);
      }
    }, 3000);
  }

  /**
   * 关闭指定的 P2P 连接
   */
  public closePeerConnection(peerId: string): void {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
      this.remoteStreams.delete(peerId);
      console.log('[TauriWebRTC] 关闭 P2P 连接:', peerId);
    }
  }

  /**
   * 关闭所有 P2P 连接
   */
  public closeAllPeerConnections(): void {
    this.peerConnections.forEach((pc, peerId) => {
      pc.close();
    });
    this.peerConnections.clear();
    this.remoteStreams.clear();
  }

  /**
   * 静音/取消静音音频
   */
  public muteAudio(muted: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
  }

  /**
   * 静音/取消静音视频
   */
  public muteVideo(muted: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
  }

  /**
   * 获取远程流
   */
  public getRemoteStream(peerId: string): MediaStream | undefined {
    return this.remoteStreams.get(peerId);
  }

  /**
   * 获取本地流
   */
  public getLocalStreamInstance(): MediaStream | null {
    return this.localStream;
  }

  /**
   * 检查是否已连接到房间
   */
  public isRoomConnected(): boolean {
    return this.isConnected;
  }

  /**
   * 获取当前房间 ID
   */
  public getRoomId(): string {
    return this.roomId;
  }

  /**
   * 获取当前 Peer ID
   */
  public getPeerId(): string {
    return this.peerId;
  }

  /**
   * 断开连接
   */
  public disconnect(): void {
    this.leaveRoom().catch(console.error);
    this.closeAllPeerConnections();

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    this.isConnected = false;
    console.log('[TauriWebRTC] 已断开所有连接');
  }
}

export const tauriWebRTC = new TauriWebRTCService();
export default tauriWebRTC;
