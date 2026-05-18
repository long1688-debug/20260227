/**
 * 增强型 WebRTC 实时传输服务
 * 支持 P2P 连接、SFU 中继、NAT穿透、屏幕共享、录制等功能
 */

import { invoke } from '@tauri-apps/api/core';

export interface RTCConfig {
  iceServers: RTCIceServer[];
  stunServer?: string;
  turnServer?: string;
  turnUsername?: string;
  turnCredential?: string;
}

export interface PeerConnection {
  id: string;
  pc: RTCPeerConnection;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  dataChannel: RTCDataChannel | null;
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  bandwidth?: number;
  latency?: number;
}

export interface MediaConstraints {
  video?: MediaTrackConstraints | boolean;
  audio?: MediaTrackConstraints | boolean;
  screen?: boolean;
}

export interface BroadcastingOptions {
  streamId: string;
  enableAudio: boolean;
  enableVideo: boolean;
  bitrate?: number;
}

export interface QualityStats {
  timestamp: number;
  bandwidth: number;
  packetsLost: number;
  jitter: number;
  roundTripTime: number;
  frameRate: number;
  resolution: { width: number; height: number };
}

type EventCallback = (data: any) => void;

class EnhancedWebRTCService {
  private peers: Map<string, PeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private recordingStream: MediaStream | null = null;
  private socket: WebSocket | null = null;
  private config: RTCConfig | null = null;
  private participantId: string | null = null;
  private currentRoomId: string | null = null;
  private isConnected: boolean = false;
  private isRecording: boolean = false;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  private eventListeners: Map<string, Set<EventCallback>> = new Map();

  private defaultIceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stunserver.org:3478' }
  ];

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.eventListeners.set('peer-joined', new Set());
    this.eventListeners.set('peer-left', new Set());
    this.eventListeners.set('remote-stream', new Set());
    this.eventListeners.set('data-message', new Set());
    this.eventListeners.set('connection-state-change', new Set());
    this.eventListeners.set('quality-update', new Set());
    this.eventListeners.set('recording-started', new Set());
    this.eventListeners.set('recording-stopped', new Set());
    this.eventListeners.set('error', new Set());
  }

  public on(event: string, callback: EventCallback): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.add(callback);
    }
  }

  public off(event: string, callback: EventCallback): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[WebRTC] Event listener error for ${event}:`, error);
        }
      });
    }
  }

  public setConfig(config: RTCConfig): void {
    this.config = {
      iceServers: config.iceServers || this.defaultIceServers,
      stunServer: config.stunServer,
      turnServer: config.turnServer,
      turnUsername: config.turnUsername,
      turnCredential: config.turnCredential
    };

    if (config.turnServer && config.turnUsername && config.turnCredential) {
      this.config.iceServers.push({
        urls: config.turnServer,
        username: config.turnUsername,
        credential: config.turnCredential
      });
    }
  }

  public async connect(signalingUrl: string, roomId: string): Promise<void> {
    try {
      console.log('[WebRTC] 连接到信令服务器:', signalingUrl);

      this.socket = new WebSocket(signalingUrl);
      this.currentRoomId = roomId;

      return new Promise((resolve, reject) => {
        if (!this.socket) {
          reject(new Error('WebSocket 未初始化'));
          return;
        }

        this.socket.onopen = () => {
          console.log('[WebRTC] WebSocket 连接已建立');
          this.isConnected = true;
          this.joinRoom(roomId);
          resolve();
        };

        this.socket.onmessage = async (event) => {
          try {
            const message = JSON.parse(event.data);
            await this.handleSignalingMessage(message);
          } catch (error) {
            console.error('[WebRTC] 处理消息失败:', error);
          }
        };

        this.socket.onerror = (error) => {
          console.error('[WebRTC] WebSocket 错误:', error);
          this.emit('error', { type: 'connection', error });
          reject(error);
        };

        this.socket.onclose = () => {
          console.log('[WebRTC] WebSocket 连接已关闭');
          this.isConnected = false;
          this.cleanup();
        };
      });
    } catch (error) {
      console.error('[WebRTC] 连接失败:', error);
      throw error;
    }
  }

  private joinRoom(roomId: string): void {
    this.send({
      type: 'join-room',
      roomId,
      timestamp: Date.now()
    });
  }

  private send(message: object): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  private async handleSignalingMessage(message: any): Promise<void> {
    const { type, from, to } = message;

    console.log('[WebRTC] 收到消息:', type, from);

    switch (type) {
      case 'room-joined':
        this.participantId = message.participantId;
        console.log('[WebRTC] 已加入房间，参与者ID:', this.participantId);
        break;

      case 'peer-joined':
        console.log('[WebRTC] 新参与者加入:', from);
        this.emit('peer-joined', { id: from, name: message.name });
        await this.createPeerConnection(from, true);
        break;

      case 'peer-left':
        console.log('[WebRTC] 参与者离开:', from);
        this.closePeerConnection(from);
        this.emit('peer-left', { id: from });
        break;

      case 'offer':
        await this.handleOffer(from, message);
        break;

      case 'answer':
        await this.handleAnswer(from, message);
        break;

      case 'ice-candidate':
        await this.handleIceCandidate(from, message);
        break;

      case 'peer-screenshare-started':
        this.emit('peer-screenshare-started', { id: from });
        break;

      case 'peer-screenshare-stopped':
        this.emit('peer-screenshare-stopped', { id: from });
        break;

      default:
        console.log('[WebRTC] 未知消息类型:', type);
    }
  }

  private async createPeerConnection(
    peerId: string,
    createDataChannel: boolean = false
  ): Promise<RTCPeerConnection> {
    console.log('[WebRTC] 创建 P2P 连接:', peerId);

    const pc = new RTCPeerConnection({
      iceServers: this.config?.iceServers || this.defaultIceServers,
      iceCandidatePoolSize: 10
    });

    const peer: PeerConnection = {
      id: peerId,
      pc,
      localStream: this.localStream,
      remoteStream: null,
      dataChannel: null,
      connectionState: 'new',
      iceConnectionState: 'new'
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.send({
          type: 'ice-candidate',
          to: peerId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('[WebRTC] 收到远程轨道:', event.track.kind);
      peer.remoteStream = event.streams[0];
      this.emit('remote-stream', { id: peerId, stream: event.streams[0] });
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] 连接状态:', pc.connectionState);
      peer.connectionState = pc.connectionState;
      this.emit('connection-state-change', {
        id: peerId,
        state: pc.connectionState
      });

      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.handleConnectionFailure(peerId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE 状态:', pc.iceConnectionState);
      peer.iceConnectionState = pc.iceConnectionState;
    };

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    if (createDataChannel) {
      const dataChannel = pc.createDataChannel('data', {
        ordered: true,
        maxRetransmits: 3
      });
      this.setupDataChannel(dataChannel, peerId);
      peer.dataChannel = dataChannel;
    }

    pc.ondatachannel = (event) => {
      console.log('[WebRTC] 收到数据通道');
      this.setupDataChannel(event.channel, peerId);
      peer.dataChannel = event.channel;
    };

    this.peers.set(peerId, peer);
    return pc;
  }

  private setupDataChannel(channel: RTCDataChannel, peerId: string): void {
    channel.onopen = () => {
      console.log('[WebRTC] 数据通道已打开:', peerId);
    };

    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit('data-message', { id: peerId, data });
      } catch {
        this.emit('data-message', { id: peerId, data: event.data });
      }
    };

    channel.onerror = (error) => {
      console.error('[WebRTC] 数据通道错误:', error);
      this.emit('error', { type: 'data-channel', error, peerId });
    };
  }

  private async sendOffer(peerId: string): Promise<void> {
    const pc = this.peers.get(peerId)?.pc;
    if (!pc) {
      console.error('[WebRTC] P2P 连接不存在:', peerId);
      return;
    }

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await pc.setLocalDescription(offer);

      this.send({
        type: 'offer',
        to: peerId,
        sdp: pc.localDescription
      });
    } catch (error) {
      console.error('[WebRTC] 发送 Offer 失败:', error);
    }
  }

  private async handleOffer(peerId: string, message: any): Promise<void> {
    let peer = this.peers.get(peerId);

    if (!peer) {
      await this.createPeerConnection(peerId, false);
      peer = this.peers.get(peerId);
    }

    const pc = peer?.pc;
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.send({
        type: 'answer',
        to: peerId,
        sdp: pc.localDescription
      });
    } catch (error) {
      console.error('[WebRTC] 处理 Offer 失败:', error);
    }
  }

  private async handleAnswer(peerId: string, message: any): Promise<void> {
    const pc = this.peers.get(peerId)?.pc;
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
    } catch (error) {
      console.error('[WebRTC] 处理 Answer 失败:', error);
    }
  }

  private async handleIceCandidate(peerId: string, message: any): Promise<void> {
    const pc = this.peers.get(peerId)?.pc;
    if (!pc) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
    } catch (error) {
      console.error('[WebRTC] 添加 ICE 候选失败:', error);
    }
  }

  private handleConnectionFailure(peerId: string): void {
    console.log('[WebRTC] 连接失败，尝试重连:', peerId);
    this.closePeerConnection(peerId);
    setTimeout(() => {
      this.createPeerConnection(peerId, true).then(() => {
        this.sendOffer(peerId);
      });
    }, 3000);
  }

  public closePeerConnection(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      if (peer.dataChannel) {
        peer.dataChannel.close();
      }
      peer.pc.close();
      this.peers.delete(peerId);
      console.log('[WebRTC] P2P 连接已关闭:', peerId);
    }
  }

  public async getLocalStream(constraints: MediaConstraints = {}): Promise<MediaStream> {
    try {
      const mediaConstraints: MediaStreamConstraints = {
        video: constraints.video === false ? false : constraints.video || {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: constraints.audio === false ? false : constraints.audio || {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      console.log('[WebRTC] 本地媒体流获取成功');

      return this.localStream;
    } catch (error) {
      console.error('[WebRTC] 获取本地媒体流失败:', error);
      this.emit('error', { type: 'media', error });
      throw error;
    }
  }

  public async getScreenShare(): Promise<MediaStream> {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: true
      });

      console.log('[WebRTC] 屏幕共享获取成功');

      this.screenStream.getVideoTracks()[0].onended = () => {
        console.log('[WebRTC] 用户停止屏幕共享');
        this.stopScreenShare();
        this.emit('peer-screenshare-stopped', { id: this.participantId });
      };

      return this.screenStream;
    } catch (error) {
      console.error('[WebRTC] 获取屏幕共享失败:', error);
      throw error;
    }
  }

  public async replaceTrack(oldTrack: MediaStreamTrack, newTrack: MediaStreamTrack): Promise<void> {
    const sender = this.findSenderForTrack(oldTrack);
    if (sender) {
      await sender.replaceTrack(newTrack);
    }

    if (oldTrack.kind === 'video' && this.localStream) {
      this.localStream.removeTrack(oldTrack);
      this.localStream.addTrack(newTrack);
    }
  }

  private findSenderForTrack(track: MediaStreamTrack): RTCRtpSender | undefined {
    for (const peer of this.peers.values()) {
      const sender = peer.pc.getSenders().find(s => s.track === track);
      if (sender) return sender;
    }
    return undefined;
  }

  public async startScreenShare(): Promise<void> {
    if (!this.screenStream) {
      await this.getScreenShare();
    }

    const videoTrack = this.screenStream?.getVideoTracks()[0];
    const oldVideoTrack = this.localStream?.getVideoTracks()[0];

    if (videoTrack && oldVideoTrack) {
      await this.replaceTrack(oldVideoTrack, videoTrack);
    }

    this.peers.forEach((peer) => {
      this.send({
        type: 'screenshare-started',
        from: this.participantId
      });
    });

    this.emit('peer-screenshare-started', { id: this.participantId });
  }

  public async stopScreenShare(): Promise<void> {
    const videoTrack = this.screenStream?.getVideoTracks()[0];
    const oldVideoTrack = this.localStream?.getVideoTracks()[0];

    if (videoTrack && oldVideoTrack) {
      await this.replaceTrack(videoTrack, oldVideoTrack);
    }

    this.screenStream?.getTracks().forEach(track => track.stop());
    this.screenStream = null;
  }

  public async startRecording(): Promise<void> {
    if (this.isRecording || !this.localStream) {
      console.warn('[WebRTC] 已经在录制或没有本地流');
      return;
    }

    this.recordedChunks = [];
    this.recordingStream = new MediaStream();

    this.localStream.getTracks().forEach(track => {
      this.recordingStream!.addTrack(track.clone());
    });

    this.peers.forEach((peer) => {
      if (peer.remoteStream) {
        peer.remoteStream.getTracks().forEach(track => {
          this.recordingStream!.addTrack(track.clone());
        });
      }
    });

    const options = {
      mimeType: 'video/webm;codecs=vp9,opus',
      videoBitsPerSecond: 2500000
    };

    try {
      this.mediaRecorder = new MediaRecorder(this.recordingStream, options);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        this.downloadRecording(blob);
        this.emit('recording-stopped', { blob });
      };

      this.mediaRecorder.start(1000);
      this.isRecording = true;
      this.emit('recording-started', {});
      console.log('[WebRTC] 录制已开始');
    } catch (error) {
      console.error('[WebRTC] 开始录制失败:', error);
    }
  }

  public stopRecording(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      console.log('[WebRTC] 录制已停止');
    }
  }

  private downloadRecording(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  }

  public sendData(peerId: string, data: object): void {
    const peer = this.peers.get(peerId);
    if (peer?.dataChannel?.readyState === 'open') {
      peer.dataChannel.send(JSON.stringify(data));
    }
  }

  public broadcastData(data: object): void {
    this.peers.forEach((peer) => {
      if (peer.dataChannel?.readyState === 'open') {
        peer.dataChannel.send(JSON.stringify(data));
      }
    });
  }

  public getQualityStats(peerId: string): QualityStats | null {
    const peer = this.peers.get(peerId);
    if (!peer?.pc) return null;

    const stats = peer.pc.getStats();
    let bandwidth = 0;
    let packetsLost = 0;
    let jitter = 0;
    let roundTripTime = 0;
    let frameRate = 0;
    let width = 0;
    let height = 0;

    stats.forEach((report) => {
      if (report.type === 'inbound-rtp' && report.kind === 'video') {
        packetsLost = report.packetsLost || 0;
        jitter = report.jitter || 0;
        if (report.framesPerSecond) frameRate = report.framesPerSecond;
      }
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        roundTripTime = report.currentRoundTripTime ? report.currentRoundTripTime * 1000 : 0;
        bandwidth = report.availableOutgoingBitrate ? report.availableOutgoingBitrate / 1000 : 0;
      }
      if (report.type === 'track' && report.kind === 'video') {
        width = report.frameWidth || 0;
        height = report.frameHeight || 0;
      }
    });

    return {
      timestamp: Date.now(),
      bandwidth,
      packetsLost,
      jitter,
      roundTripTime,
      frameRate,
      resolution: { width, height }
    };
  }

  public async broadcastStream(options: BroadcastingOptions): Promise<string> {
    try {
      const result = await invoke < { streamId: string; webrtcUrl: string } > ('proxy_webrtc_push', {
        streamId: options.streamId,
        options: {
          app: 'live',
          enable_audio: options.enableAudio,
          enable_video: options.enableVideo,
          timeout_sec: null
        }
      });

      const pc = new RTCPeerConnection({
        iceServers: this.config?.iceServers || this.defaultIceServers
      });

      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          pc.addTrack(track, this.localStream!);
        });
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const response = await fetch(result.webrtcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: offer.sdp
      });

      const answerSdp = await response.text();
      await pc.setRemoteDescription(new RTCSessionDescription({
        type: 'answer',
        sdp: answerSdp
      }));

      console.log('[WebRTC] 广播流已启动:', result.streamId);
      return result.streamId;
    } catch (error) {
      console.error('[WebRTC] 启动广播失败:', error);
      throw error;
    }
  }

  public async subscribeStream(webrtcUrl: string): Promise<MediaStream> {
    const pc = new RTCPeerConnection({
      iceServers: this.config?.iceServers || this.defaultIceServers
    });

    const stream = new MediaStream();

    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach(track => {
        stream.addTrack(track);
      });
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const response = await fetch(webrtcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: offer.sdp
    });

    const answerSdp = await response.text();
    await pc.setRemoteDescription(new RTCSessionDescription({
      type: 'answer',
      sdp: answerSdp
    }));

    return stream;
  }

  public muteAudio(muted: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
  }

  public muteVideo(muted: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
  }

  public isAudioMuted(): boolean {
    const audioTrack = this.localStream?.getAudioTracks()[0];
    return audioTrack ? !audioTrack.enabled : true;
  }

  public isVideoMuted(): boolean {
    const videoTrack = this.localStream?.getVideoTracks()[0];
    return videoTrack ? !videoTrack.enabled : true;
  }

  public disconnect(): void {
    this.cleanup();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  private cleanup(): void {
    this.peers.forEach((peer) => {
      if (peer.dataChannel) peer.dataChannel.close();
      peer.pc.close();
    });
    this.peers.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }

    if (this.recordingStream) {
      this.recordingStream.getTracks().forEach(track => track.stop());
      this.recordingStream = null;
    }

    if (this.isRecording) {
      this.stopRecording();
    }

    this.currentRoomId = null;
    this.participantId = null;
  }

  public getPeers(): string[] {
    return Array.from(this.peers.keys());
  }

  public getPeerCount(): number {
    return this.peers.size;
  }

  public isRoomConnected(): boolean {
    return this.isConnected;
  }

  public getLocalStreamInstance(): MediaStream | null {
    return this.localStream;
  }
}

export const enhancedWebRTC = new EnhancedWebRTCService();
export default enhancedWebRTC;
