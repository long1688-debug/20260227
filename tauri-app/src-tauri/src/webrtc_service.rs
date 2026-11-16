// WebRTC 服务 - 提供信令服务器和媒体流管理功能
use std::collections::HashMap;
use tokio::sync::RwLock;
use tauri::{AppHandle, Emitter, Manager};
use serde::{Deserialize, Serialize};

/// WebRTC 信令消息类型
#[derive(Debug, Serialize, Deserialize)]
pub enum SignalingMessage {
    JoinRoom { room_id: String, peer_id: String },
    LeaveRoom { room_id: String, peer_id: String },
    Offer { room_id: String, from: String, to: String, sdp: String },
    Answer { room_id: String, from: String, to: String, sdp: String },
    IceCandidate { room_id: String, from: String, to: String, candidate: serde_json::Value },
    PeerJoined { room_id: String, peer_id: String, name: String },
    PeerLeft { room_id: String, peer_id: String },
}

/// 房间状态
pub struct RoomState {
    pub peers: HashMap<String, PeerInfo>,
    pub created_at: u64,
}

impl RoomState {
    fn new() -> Self {
        Self {
            peers: HashMap::new(),
            created_at: std::time::UNIX_EPOCH.elapsed().unwrap_or_default().as_secs(),
        }
    }
}

/// 对等方信息
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PeerInfo {
    pub id: String,
    pub name: String,
    pub joined_at: u64,
    pub window_label: Option<String>,
}

/// WebRTC 服务状态
pub struct WebRTCServiceState {
    pub rooms: RwLock<HashMap<String, RoomState>>,
    pub peer_rooms: RwLock<HashMap<String, String>>, // peer_id -> room_id
    pub peer_windows: RwLock<HashMap<String, String>>, // peer_id -> window_label
}

impl WebRTCServiceState {
    pub fn new() -> Self {
        Self {
            rooms: RwLock::new(HashMap::new()),
            peer_rooms: RwLock::new(HashMap::new()),
            peer_windows: RwLock::new(HashMap::new()),
        }
    }
}

/// 加入房间
#[tauri::command]
pub async fn webrtc_join_room(
    app_handle: AppHandle,
    room_id: String,
    peer_id: String,
    peer_name: String,
    window_label: String,
) -> Result<serde_json::Value, String> {
    let state = app_handle.state::<WebRTCServiceState>();

    // 获取或创建房间
    let mut rooms = state.rooms.write().await;
    let room = rooms.entry(room_id.clone()).or_insert_with(RoomState::new);

    // 添加对等方
    room.peers.insert(peer_id.clone(), PeerInfo {
        id: peer_id.clone(),
        name: peer_name.clone(),
        joined_at: std::time::UNIX_EPOCH.elapsed().unwrap_or_default().as_secs(),
        window_label: Some(window_label.clone()),
    });

    // 记录对等方所在房间
    state.peer_rooms.write().await.insert(peer_id.clone(), room_id.clone());
    state.peer_windows.write().await.insert(peer_id.clone(), window_label);

    // 获取所有房间成员
    let peers: Vec<PeerInfo> = room.peers.values().cloned().collect();

    // 通知其他成员有新成员加入
    broadcast_peer_joined(&app_handle, &room_id, &peer_id, &peer_name).await;

    println!("[WebRTC] 对等方 {} 加入房间 {}", peer_id, room_id);

    Ok(serde_json::json!({
        "success": true,
        "room_id": room_id,
        "peer_id": peer_id,
        "peers": peers,
        "message": format!("成功加入房间 {}", room_id)
    }))
}

/// 离开房间
#[tauri::command]
pub async fn webrtc_leave_room(
    app_handle: AppHandle,
    room_id: String,
    peer_id: String,
) -> Result<serde_json::Value, String> {
    let state = app_handle.state::<WebRTCServiceState>();

    let mut rooms = state.rooms.write().await;
    if let Some(room) = rooms.get_mut(&room_id) {
        // 获取离开的对等方信息
        let peer_info = room.peers.remove(&peer_id);

        // 清理映射
        state.peer_rooms.write().await.remove(&peer_id);
        state.peer_windows.write().await.remove(&peer_id);

        // 如果房间为空，删除房间
        if room.peers.is_empty() {
            rooms.remove(&room_id);
        }

        // 通知其他成员
        if let Some(_info) = peer_info {
            broadcast_peer_left(&app_handle, &room_id, &peer_id).await;
            println!("[WebRTC] 对等方 {} 离开房间 {}", peer_id, room_id);
        }
    }

    Ok(serde_json::json!({
        "success": true,
        "room_id": room_id,
        "peer_id": peer_id,
        "message": format!("已离开房间 {}", room_id)
    }))
}

/// 发送 Offer
#[tauri::command]
pub async fn webrtc_send_offer(
    app_handle: AppHandle,
    room_id: String,
    from: String,
    to: String,
    sdp: String,
) -> Result<serde_json::Value, String> {
    let state = app_handle.state::<WebRTCServiceState>();

    // 验证目标对等方是否在房间内
    let rooms = state.rooms.read().await;
    if let Some(room) = rooms.get(&room_id) {
        if room.peers.contains_key(&to) {
            // 转发消息到目标窗口
            if let Some(target_window) = get_peer_window(&state, &to).await {
                send_to_window(&app_handle, &target_window, SignalingMessage::Offer {
                    room_id: room_id.clone(),
                    from: from.clone(),
                    to: to.clone(),
                    sdp: sdp.clone(),
                }).await;
            }

            println!("[WebRTC] 转发 Offer: {} -> {}", from, to);
            return Ok(serde_json::json!({ "success": true }));
        }
    }

    Err(format!("目标对等方 {} 不在房间 {}", to, room_id))
}

/// 发送 Answer
#[tauri::command]
pub async fn webrtc_send_answer(
    app_handle: AppHandle,
    room_id: String,
    from: String,
    to: String,
    sdp: String,
) -> Result<serde_json::Value, String> {
    let state = app_handle.state::<WebRTCServiceState>();

    let rooms = state.rooms.read().await;
    if let Some(room) = rooms.get(&room_id) {
        if room.peers.contains_key(&to) {
            if let Some(target_window) = get_peer_window(&state, &to).await {
                send_to_window(&app_handle, &target_window, SignalingMessage::Answer {
                    room_id: room_id.clone(),
                    from: from.clone(),
                    to: to.clone(),
                    sdp: sdp.clone(),
                }).await;
            }

            println!("[WebRTC] 转发 Answer: {} -> {}", from, to);
            return Ok(serde_json::json!({ "success": true }));
        }
    }

    Err(format!("目标对等方 {} 不在房间 {}", to, room_id))
}

/// 发送 ICE 候选
#[tauri::command]
pub async fn webrtc_send_ice_candidate(
    app_handle: AppHandle,
    room_id: String,
    from: String,
    to: String,
    candidate: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let state = app_handle.state::<WebRTCServiceState>();

    let rooms = state.rooms.read().await;
    if let Some(room) = rooms.get(&room_id) {
        if room.peers.contains_key(&to) {
            if let Some(target_window) = get_peer_window(&state, &to).await {
                send_to_window(&app_handle, &target_window, SignalingMessage::IceCandidate {
                    room_id: room_id.clone(),
                    from: from.clone(),
                    to: to.clone(),
                    candidate,
                }).await;
            }

            println!("[WebRTC] 转发 ICE Candidate: {} -> {}", from, to);
            return Ok(serde_json::json!({ "success": true }));
        }
    }

    Err(format!("目标对等方 {} 不在房间 {}", to, room_id))
}

/// 获取房间成员列表
#[tauri::command]
pub async fn webrtc_get_room_peers(
    app_handle: AppHandle,
    room_id: String,
) -> Result<serde_json::Value, String> {
    let state = app_handle.state::<WebRTCServiceState>();

    let rooms = state.rooms.read().await;
    if let Some(room) = rooms.get(&room_id) {
        let peers: Vec<PeerInfo> = room.peers.values().cloned().collect();
        Ok(serde_json::json!({
            "success": true,
            "room_id": room_id,
            "peers": peers
        }))
    } else {
        Err(format!("房间 {} 不存在", room_id))
    }
}

/// 检查房间状态
#[tauri::command]
pub async fn webrtc_check_room(
    app_handle: AppHandle,
    room_id: String,
) -> Result<serde_json::Value, String> {
    let state = app_handle.state::<WebRTCServiceState>();

    let rooms = state.rooms.read().await;
    if let Some(room) = rooms.get(&room_id) {
        Ok(serde_json::json!({
            "exists": true,
            "peer_count": room.peers.len()
        }))
    } else {
        Ok(serde_json::json!({
            "exists": false,
            "peer_count": 0
        }))
    }
}

/// 获取服务状态
#[tauri::command]
pub async fn webrtc_get_service_status(
    app_handle: AppHandle,
) -> Result<serde_json::Value, String> {
    let state = app_handle.state::<WebRTCServiceState>();

    let rooms = state.rooms.read().await;
    let peer_rooms = state.peer_rooms.read().await;

    let room_info: Vec<_> = rooms.iter()
        .map(|(id, room)| {
            serde_json::json!({
                "room_id": id,
                "peer_count": room.peers.len(),
                "created_at": room.created_at
            })
        })
        .collect();

    Ok(serde_json::json!({
        "running": true,
        "room_count": rooms.len(),
        "peer_count": peer_rooms.len(),
        "rooms": room_info
    }))
}

/// 生成唯一对等方 ID
#[tauri::command(async)]
pub fn webrtc_generate_peer_id() -> Result<String, String> {
    let peer_id = uuid::Uuid::new_v4().to_string();
    Ok(peer_id)
}

// ==================== 内部辅助函数 ====================

async fn get_peer_window(state: &WebRTCServiceState, peer_id: &str) -> Option<String> {
    state.peer_windows.read().await.get(peer_id).cloned()
}

async fn broadcast_peer_joined(app_handle: &AppHandle, room_id: &str, peer_id: &str, name: &str) {
    let state = app_handle.state::<WebRTCServiceState>();

    let rooms = state.rooms.read().await;
    if let Some(room) = rooms.get(room_id) {
        for (id, info) in room.peers.iter() {
            if id != peer_id {
                if let Some(window_label) = &info.window_label {
                    send_to_window(app_handle, window_label, SignalingMessage::PeerJoined {
                        room_id: room_id.to_string(),
                        peer_id: peer_id.to_string(),
                        name: name.to_string(),
                    }).await;
                }
            }
        }
    }
}

async fn broadcast_peer_left(app_handle: &AppHandle, room_id: &str, peer_id: &str) {
    let state = app_handle.state::<WebRTCServiceState>();

    let rooms = state.rooms.read().await;
    if let Some(room) = rooms.get(room_id) {
        for (id, info) in room.peers.iter() {
            if id != peer_id {
                if let Some(window_label) = &info.window_label {
                    send_to_window(app_handle, window_label, SignalingMessage::PeerLeft {
                        room_id: room_id.to_string(),
                        peer_id: peer_id.to_string(),
                    }).await;
                }
            }
        }
    }
}

async fn send_to_window(app_handle: &AppHandle, window_label: &str, message: SignalingMessage) {
    if let Some(window) = app_handle.get_webview_window(window_label) {
        let _ = window.emit("webrtc-signaling", serde_json::to_value(message).unwrap());
    }
}
