// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod proc_util;
mod license;
mod models;
mod server_manager;
mod stream_proxy;
mod onvif_ptz;
mod zlmediakit_manager;
mod audio_capture;
mod speech_recognition;
mod whisper_wrapper;
mod audio_device;
mod audio_processor;
mod video_subtitle;
mod recording_manager;
mod capture_device;
mod media_codec;
mod ptz;
mod ptz_commands;
mod platform_detector;
mod utils;
mod document_converter;
mod video_layout;
mod fire_detection;
mod camera_discovery;
mod rtsp_stream;
mod rtsp_validator;
mod rtsp_proxy_manager;
mod rtsp_resolver;  // 🎯 RTSP 地址解析器（ONVIF + 模板匹配 + 探针）
mod camera_database;  // 🎯 网络摄像机数据库管理
mod onvif_discovery;  // 🎯 ONVIF 设备发现和流地址探索
mod webrtc_service;  // 🎯 WebRTC 实时传输服务
mod vision_service;   // 🎯 视觉分析服务（COCO数据集 + 智能视觉分析 + AI评估）
mod mpv_player;       // 🎯 mpv 媒体播放器服务（替代 FLV.js）

use tauri::Manager;
use commands::*;
use license::*;
use models::*;
use server_manager::*;
use stream_proxy::*;
use onvif_ptz::*;
use zlmediakit_manager::*;
use audio_capture::*;
use speech_recognition::*;
use whisper_wrapper::{WhisperState, init_whisper, recognize_audio, cleanup_whisper, get_whisper_status, download_whisper_model, delete_whisper_model, check_whisper_model_exists};
use audio_device::*;
use video_subtitle::*;
use recording_manager::*;
use capture_device::*;
use media_codec::*;
use ptz::PtzDeviceManager;
use ptz_commands::*;
use platform_detector::*;
use utils::video_naming::generate_video_filename_cmd;
use utils::video_policy::{
    VideoPolicyState,
    get_video_dir,
    finalize_video,
    list_recorded_videos,
    delete_recorded_video,
    get_cleanup_policy,
    set_cleanup_policy,
};
use document_converter::*;
use video_layout::*;
use fire_detection::*;
use rtsp_validator::*;
use rtsp_proxy_manager::*;
use rtsp_resolver::*;  // 🎯 RTSP 地址解析器
use camera_database::*;  // 🎯 网络摄像机数据库管理
use onvif_discovery::{get_onvif_device_info, get_onvif_profiles, test_rtsp_connection};  // 🎯 ONVIF 设备发现和流地址探索
use webrtc_service::*;  // 🎯 WebRTC 实时传输服务
use vision_service::*;  // 🎯 视觉分析服务
use mpv_player::{
    MpvPlayerState,
    mpv_create_player,
    mpv_destroy_player,
    mpv_play_stream,
    mpv_play_rtsp,
    mpv_play_flv,
    mpv_play_hls,
    mpv_play_rtmp,
    mpv_play_file,
    mpv_stop,
    mpv_pause,
    mpv_resume,
    mpv_set_volume,
    mpv_set_mute,
    mpv_get_position,
    mpv_get_duration,
    mpv_seek,
    mpv_get_state,
    mpv_get_stats,
    mpv_screenshot,
    mpv_start_recording,
    mpv_stop_recording,
    mpv_list_players,
    mpv_is_available,
    mpv_get_supported_protocols,
};  // 🎯 mpv 媒体播放器服务

fn main() {
    // 初始化日志系统
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or(if cfg!(debug_assertions) { "info" } else { "warn" })).init();

    tauri::Builder::default()
        // 管理状态
        .manage(ServerState::default())
        .manage(StreamState::new())
        .manage(ZLMediaKitState::new())
        .manage(RtspProxyState::new())
        .manage(AudioCaptureState::new())
        .manage(SpeechRecognitionState::new())
        .manage(WhisperState::new())
        .manage(VideoAudioCaptureState::new())
        .manage(RecordingManager::new())
        .manage(CaptureDeviceManager::new())
        .manage(MultiCodecManager::new())
        .manage(PtzDeviceManager::new())
        .manage(VideoPolicyState::new())
        .manage(AudioDeviceState::new())
        .manage(WebRTCServiceState::new())  // 🎯 WebRTC 服务状态
        .manage(VisionServiceState::new())  // 🎯 视觉分析服务状态
        .manage(MpvPlayerState::default())  // 🎯 mpv 播放器状态管理
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // 初始化 PTZ 设备管理器
            let _manager = app.state::<PtzDeviceManager>();
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let manager = app_handle.state::<PtzDeviceManager>();
                manager.register_vendor_defaults().await;
            });

            // 🎯 关键修复：窗口启动时自动最大化到工作区域
            // 这确保窗口完全适应屏幕工作区域，排除任务栏
            let main_window = app.get_webview_window("main").unwrap();
            let _ = main_window.maximize();

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 窗口控制
            minimize_window,
            maximize_window,
            close_window,

            // 设置相关
            get_settings,
            save_settings,
            get_default_recording_path,
            select_directory,

            // 注册相关
            get_machine_code,
            get_registration_status,
            activate_registration,
            deactivate_registration,

            // 系统相关
            get_system_info,
            check_port_available,

            // 文件操作
            read_file,
            write_file,
            file_exists,
            create_dir,

            // 模型管理
            list_models,
            download_model,
            delete_model,
            clear_model_cache,

            // 后端服务器管理
            start_backend_server,
            stop_backend_server,
            check_backend_status,

            // ZLMediaKit 服务管理
            start_zlmediakit,
            stop_zlmediakit,
            check_zlmediakit_status,

            // 🆕 RTSP Proxy 服务管理（Node.js）
            start_rtsp_proxy,
            stop_rtsp_proxy,
            check_rtsp_proxy_status,
            start_rtsp_stream_proxy,
            stop_rtsp_stream_proxy,
            get_rtsp_streams,

            // 🎯 网络摄像机数据库管理
            init_camera_database,
            save_camera_config,
            get_all_cameras,
            get_camera_by_id,
            delete_camera_config,
            update_camera_status,
            get_online_camera_count,
            get_offline_camera_count,
            start_camera_status_monitor,  // 🎯 启动状态监控服务

            // 流媒体代理（ZLMediaKit）
            add_rtsp_proxy,
            remove_rtsp_proxy,
            proxy_local_video,
            proxy_network_stream,
            stop_stream_proxy,
            control_stream_audio,
            get_active_streams,
            check_stream_status,

            // WebRTC 推流
            proxy_webrtc_push,

            // 本地摄像头代理
            proxy_local_camera,

            // 手机/平板屏幕投屏
            proxy_mobile_screen,

            // ONVIF 云台控制（旧版兼容）
            onvif_ptz,
            onvif_ptz_stop,
            onvif_get_presets,
            onvif_goto_preset,

            // 新版 PTZ 控制命令
            ptz_move_absolute,
            ptz_relative_move,
            ptz_goto_preset,
            ptz_continuous_move,
            ptz_stop,
            onvif_discover_devices,
            ptz_register_device,
            ptz_list_devices,
            set_device_rtsp_url,
            get_device_rtsp_url,
            register_onvif_device_with_rtsp,
            get_camera_details,
            update_camera_config,
            remove_camera_device,
            get_onvif_stream_uri,
            try_common_rtsp_templates,  // 🎯 新增：通用RTSP模板备选方案
            probe_rtsp_connection,      // 🎯 新增：轻量级RTSP探测（使用OPTIONS请求）
            detect_onvif_services,  // 🎯 新增：ONVIF服务路径检测
            test_onvif_connection,
            diagnose_onvif_flow,  // 🎯 ONVIF完整流程诊断
            test_tcp_connection,  // 🎯 新增：TCP连接测试

            // 音频捕获
            start_audio_capture,
            stop_audio_capture,
            get_audio_capture_status,

            // 音频设备
            get_audio_devices,
            get_input_devices,
            get_output_devices,
            set_audio_device,
            get_device_info,

            // 语音识别
            start_speech_recognition,
            stop_speech_recognition,
            get_speech_recognition_status,
            update_recognition_settings,

            // 视频转字幕
            start_video_audio_capture,
            stop_video_audio_capture,
            process_audio_data,

            // 🎤 Whisper 语音识别
            init_whisper,
            recognize_audio,
            cleanup_whisper,
            get_whisper_status,
            // 📥 模型下载管理
            download_whisper_model,
            delete_whisper_model,
            check_whisper_model_exists,

            // 录制管理
            start_canvas_recording,
            start_preview_recording,
            start_pip_recording,
            pause_recording,
            resume_recording,
            stop_recording,
            get_active_recordings,
            get_latest_preview_frame,
            cleanup_preview_frames,
            save_recording_template,
            load_recording_templates,
            delete_recording_template,
            switch_active_camera,
            start_multicam_recording,
            start_rtmp_streaming,
            stop_rtmp_streaming,
            start_vr_recording,

            // 采集卡和高拍仪管理
            list_capture_devices,
            start_capture_device,
            stop_capture_device,
            scanner_take_photo,
            set_scanner_configuration,

            // 多路音视频编解码
            detect_hardware_acceleration,
            start_multi_record,
            start_mix_recording,
            stop_codec_session,
            pause_codec_session,
            resume_codec_session,
            get_active_codec_sessions,
            get_codec_session_info,
            get_codec_performance,

            // 视频文件命名管理
            generate_video_filename_cmd,

            // 视频策略管理
            get_video_dir,
            finalize_video,
            list_recorded_videos,
            delete_recorded_video,
            get_cleanup_policy,
            set_cleanup_policy,

            // 跨平台设备检测
            get_platform_info,
            is_touch_device,
            get_linux_distro,
            get_device_model,
            check_gpu_acceleration,

            // 文档转换
            convert_document_to_pdf,

            // 视频布局管理
            save_layout,
            load_layout,
            list_saved_layouts,
            delete_layout,
            export_layout,
            import_layout,

            // 火焰/烟雾检测
            detect_fire_smoke,
            quick_color_check,

            // 网络摄像机发现
            onvif_discover_devices,
            scan_network_cameras,
            scan_local_subnet,
            scan_local_subnet_with_progress,
            scan_all_network_interfaces,
            scan_specific_subnets,
            discover_all_cameras,
            get_local_ip,
            get_network_interfaces_info,

            // 🎯 RTSP 流管理
            start_rtsp_stream,
            stop_rtsp_stream,
            get_active_rtsp_sessions,

            // 📱 移动端连接管理
            register_mobile_connection,
            mobile_heartbeat,
            disconnect_mobile,
            get_mobile_connections,

            // 🔍 RTSP 地址验证
            validate_rtsp_address,
            try_multiple_rtsp_templates_cmd,

            // 🎯 RTSP 地址解析（ONVIF + 模板匹配 + 探针）
            resolve_rtsp,

            // 🎯 ONVIF 设备发现和流地址探索（类似 ONVIF Device Manager）
            get_onvif_device_info,
            get_onvif_profiles,
            test_rtsp_connection,

            // 🎯 WebRTC 实时传输服务
            webrtc_join_room,
            webrtc_leave_room,
            webrtc_send_offer,
            webrtc_send_answer,
            webrtc_send_ice_candidate,
            webrtc_get_room_peers,
            webrtc_check_room,
            webrtc_get_service_status,
            webrtc_generate_peer_id,

            // 🎯 视觉分析服务（COCO数据集 + 智能视觉分析 + AI评估）
            // COCO 数据集管理
            set_coco_dataset_path,
            get_coco_dataset_path,
            validate_coco_dataset,
            get_coco_dataset_stats,
            search_coco_images_by_category,

            // 智能视觉分析
            analyze_image,
            get_analysis_history,
            clear_analysis_history,

            // 人工智能评估系统
            set_exam_config,
            get_exam_config,
            start_batch_test,
            analyze_exam_results,
            get_vision_service_status,

            // 🎯 mpv 媒体播放器服务（替代 FLV.js）
            mpv_create_player,
            mpv_destroy_player,
            mpv_play_stream,
            mpv_play_rtsp,
            mpv_play_flv,
            mpv_play_hls,
            mpv_play_rtmp,
            mpv_play_file,
            mpv_stop,
            mpv_pause,
            mpv_resume,
            mpv_set_volume,
            mpv_set_mute,
            mpv_get_position,
            mpv_get_duration,
            mpv_seek,
            mpv_get_state,
            mpv_get_stats,
            mpv_screenshot,
            mpv_start_recording,
            mpv_stop_recording,
            mpv_list_players,
            mpv_is_available,
            mpv_get_supported_protocols,
        ])
        .setup(|app| {
            // 🎯 初始化摄像机数据库
            println!("[Main] 初始化网络摄像机数据库...");
            let db = CameraDatabase::new(None).map_err(|e| {
                eprintln!("[Main] ❌ 数据库初始化失败: {}", e);
                e.to_string()
            })?;
            app.manage(db);
            println!("[Main] ✅ 网络摄像机数据库初始化成功");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
