<template>
  <div class="teacher-window">
    <!-- 许可证验证 -->
    <LicenseGuard
      v-if="!licenseVerified"
      @license-verified="onLicenseVerified"
      @license-failed="onLicenseFailed"
    />

    <!-- 主教师界面 -->
    <div v-else>
      <!-- 标题栏 -->
      <TitleBar>
        <template #toolbar>
          <!-- 🆕 使用独立的视频操作工具栏组件 -->
          <div class="top-toolbar">
            <button class="toolbar-btn" :class="{ active: isAnnotationEnabled }" @click="enableAnnotationForAll">
              <span>✏️</span>
              <span>批注</span>
            </button>
            <button class="toolbar-btn" @click="handleRecordingCommand('start')">
              <span>️</span>
              <span>一键录制</span>
            </button>
            <button class="toolbar-btn" :disabled="!isRecording" @click="handlePauseAllCanvasRecording">
              <span>⏸️</span>
              <span>暂停录制</span>
            </button>
            <button class="toolbar-btn" :disabled="!isRecording" @click="handleStopAllCanvasRecording">
              <span>⏹️</span>
              <span>停止录制</span>
            </button>
            <button class="toolbar-btn" @click="handleStartRTMPPush">
              <span>📡</span>
              <span>RTMP推流</span>
            </button>
            <button class="toolbar-btn" @click="showRecordingDialog = true">
              <span>📁</span>
              <span>录制管理</span>
            </button>
            <button class="toolbar-btn" @click="showSettingsDialog = true">
              <span>⚙️</span>
              <span>设置</span>
            </button>
          </div>
        </template>
      </TitleBar>

      <!-- 主内容区 -->
      <div class="main-content-wrapper">
        <!-- 左侧内容区（视频 + 预览栏） -->
        <div class="content-area">
          <div class="main-content">
            <!-- 视频区域 -->
            <div class="video-area">
              <!-- 🆕 渲染引擎主画布（覆盖模式） -->
              <div class="render
