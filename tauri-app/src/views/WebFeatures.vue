<template>
  <div class="web-functions-view">
    <!-- 标题栏 -->
    <div class="title-bar">
      <div class="title">实训教学系统 - 视觉分析</div>
      <div class="window-controls">
        <button class="control-btn" @click="goBack">← 返回</button>
        <button class="control-btn" @click="minimize"><span>－</span></button>
        <button class="control-btn" @click="maximize"><span>□</span></button>
        <button class="control-btn close" @click="close"><span>×</span></button>
      </div>
    </div>

    <!-- Web功能中心视图 -->
    <div class="main-content" v-show="!showAnalysisPanel">
      <div class="header">
        <h1>Web 功能中心</h1>
        <p class="subtitle">Training Teaching System - Web Features</p>
      </div>

      <div class="features-grid">
        <div class="feature-card student-training">
          <div class="card-icon">👨‍🎓</div>
          <div class="card-content">
            <h2>学生实训</h2>
            <p>在线实训课程、提交实验报告、查看学习进度</p>
            <div class="card-actions">
              <el-button type="primary" @click="openStudentTraining">进入实训</el-button>
              <el-button @click="viewTrainingInfo">详情</el-button>
            </div>
          </div>
        </div>

        <div class="feature-card teacher-management">
          <div class="card-icon">👨‍🏫</div>
          <div class="card-content">
            <h2>教师管理</h2>
            <p>管理班级、分配任务、查看学生进度、批改作业</p>
            <div class="card-actions">
              <el-button type="primary" @click="openTeacherManagement">进入管理</el-button>
              <el-button @click="viewManagementInfo">详情</el-button>
            </div>
          </div>
        </div>

        <div class="feature-card vision-analysis active">
          <div class="card-icon">👁️</div>
          <div class="card-content">
            <h2>视觉分析</h2>
            <p>AI 视觉分析、学生专注度监测、行为分析报告</p>
            <div class="card-actions">
              <el-button type="primary" @click="openVisionAnalysis">开始分析</el-button>
              <el-button @click="viewVisionInfo">详情</el-button>
            </div>
          </div>
        </div>

        <div class="feature-card api-test">
          <div class="card-icon">🔧</div>
          <div class="card-content">
            <h2>API 测试</h2>
            <p>接口测试、性能监控、日志查看、调试工具</p>
            <div class="card-actions">
              <el-button type="primary" @click="openApiTest">打开测试</el-button>
              <el-button @click="viewApiInfo">详情</el-button>
            </div>
          </div>
        </div>

        <div class="feature-card system-home">
          <div class="card-icon">🏠</div>
          <div class="card-content">
            <h2>系统首页</h2>
            <p>系统概览、快速导航、状态监控、通知中心</p>
            <div class="card-actions">
              <el-button type="primary" @click="openSystemHome">进入首页</el-button>
              <el-button @click="viewSystemInfo">详情</el-button>
            </div>
          </div>
        </div>

        <div class="feature-card service-status">
          <div class="card-icon">🔍</div>
          <div class="card-content">
            <h2>服务状态</h2>
            <p>服务运行状态、资源使用情况、连接数统计、性能指标</p>
            <div class="card-actions">
              <el-button type="primary" @click="openServiceStatus">查看状态</el-button>
              <el-button @click="viewStatusInfo">详情</el-button>
            </div>
          </div>
        </div>
      </div>

      <div class="info-section">
        <h2>功能说明</h2>
        <div class="info-cards">
          <div class="info-card">
            <h3>🎓 学生实训</h3>
            <ul>
              <li>在线课程学习</li>
              <li>实验报告提交</li>
              <li>学习进度跟踪</li>
              <li>在线测试</li>
            </ul>
          </div>
          <div class="info-card">
            <h3>👨‍🏫 教师管理</h3>
            <ul>
              <li>班级学生管理</li>
              <li>任务分配发布</li>
              <li>作业批改</li>
              <li>成绩管理</li>
            </ul>
          </div>
          <div class="info-card">
            <h3>👁️ 视觉分析</h3>
            <ul>
              <li>人脸检测 (LBP)</li>
              <li>物体检测 (YOLOv8)</li>
              <li>专注度监测</li>
              <li>情绪识别</li>
            </ul>
          </div>
          <div class="info-card">
            <h3>🔧 API 测试</h3>
            <ul>
              <li>接口调用测试</li>
              <li>性能监控</li>
              <li>日志查看</li>
              <li>调试工具</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- 视觉分析控制台视图 -->
    <div class="analysis-panel-container" v-show="showAnalysisPanel">
      <div class="analysis-header">
        <button class="back-btn" @click="exitAnalysisPanel">
          ← 返回 Web 功能中心
        </button>
        <h2 class="analysis-title">AI 视觉分析控制台</h2>
        <!-- YOLO 双模式状态显示 -->
        <div class="yolo-mode-status">
          <span class="status-item">
            <span class="status-icon">{{ visionStore.isOnline ? '📶' : '📵' }}</span>
            <span>{{ visionStore.isOnline ? '在线' : '离线' }}</span>
          </span>
          <span class="status-divider">|</span>
          <span class="status-item mode">
            <span class="status-icon">{{ getModeIcon(visionStore.detectionMode) }}</span>
            <span>{{ visionStore.detectionModeText }}</span>
          </span>
          <el-button size="small" type="primary" @click="reloadYoloModel" class="reload-btn">
            🔄 重载模型
          </el-button>
        </div>
        <div class="mode-toggle">
          <button
            class="mode-btn"
            :class="{ active: analysisMode === 'basic' }"
            @click="analysisMode = 'basic'"
          >
            基础分析
          </button>
          <button
            class="mode-btn" 
            :class="{ active: analysisMode === 'experiment' }"
            @click="analysisMode = 'experiment'"
          >
            实验评分
          </button>
        </div>
        <div class="camera-controls">
          <button class="camera-btn" @click="toggleCamera" :class="{ active: cameraActive }">
            {{ cameraActive ? '📷 已连接' : '📷 连接摄像头' }}
          </button>
        </div>
      </div>

      <div class="analysis-content-wrapper">
        <!-- 左侧控制面板 -->
        <div class="control-panel">
          <!-- 基础分析模式 -->
          <template v-if="analysisMode === 'basic'">
            <div class="control-section">
              <div class="section-title">检测配置</div>
              <div class="config-item">
                <input type="checkbox" id="face-detect" v-model="visionConfig.faceDetect">
                <label for="face-detect">人脸检测</label>
              </div>
              <div class="config-item">
                <input type="checkbox" id="object-detect" v-model="visionConfig.objectDetect">
                <label for="object-detect">物体检测</label>
              </div>
              <div class="config-item">
                <input type="checkbox" id="attention-monitor" v-model="visionConfig.attentionMonitor">
                <label for="attention-monitor">专注度监测</label>
              </div>
              <div class="config-item">
                <input type="checkbox" id="emotion-analysis" v-model="visionConfig.emotionAnalysis">
                <label for="emotion-analysis">情绪分析</label>
              </div>
            </div>

            <div class="control-section">
              <div class="section-title">视频源</div>
              <button class="source-btn" @click="loadLocalImage">📷 加载本地图片</button>
              <button class="source-btn" @click="loadLocalVideo">🎬 加载本地视频</button>
              <button class="source-btn" @click="loadNetworkVideo">🔗 加载网络视频</button>
              <div class="url-input-wrapper">
                <input type="text" v-model="videoUrl" placeholder="rtsp:// 或 http:// 视频地址" class="url-input">
                <button class="source-btn small" @click="connectCamera">连接摄像头</button>
              </div>
            </div>

            <div class="control-section">
              <div class="section-title">
                <span>分析控制</span>
                <span class="status-badge" :class="detectionStatus">{{ detectionStatus }}</span>
              </div>
              <div class="detection-commands">
                <button class="cmd-btn" @click="startDetection" :disabled="isAnalyzing">▶️ 开始检测</button>
                <button class="cmd-btn" @click="stopDetection" :disabled="!isAnalyzing">⏹️ 停止检测</button>
                <button class="cmd-btn" @click="clearResults">🗑️ 清除结果</button>
              </div>
            </div>

            <div class="control-section">
              <div class="section-title">分析间隔</div>
              <div class="interval-slider">
                <input type="range" v-model="analysisInterval" min="100" max="2000" step="100">
                <span class="interval-value">{{ analysisInterval }}ms</span>
              </div>
            </div>

            <div class="control-section">
              <div class="section-title">快捷操作</div>
              <button class="action-btn stop-btn" @click="stopDetection">
                <span class="btn-icon">⏹️</span>
                <span>停止分析</span>
              </button>
              <button class="action-btn export-btn" @click="exportData">
                <span class="btn-icon">📊</span>
                <span>导出数据</span>
              </button>
              <button class="action-btn annotation-btn" @click="toggleAnnotation" :class="{ active: annotationEnabled }">
                <span class="btn-icon">✏️</span>
                <span>{{ annotationEnabled ? '关闭批注' : '开启批注' }}</span>
              </button>
            </div>

            <div class="control-section status-section">
              <div class="section-title">当前状态</div>
              <div class="status-grid">
                <div class="status-item">
                  <span class="status-label">检测到人脸</span>
                  <span class="status-value">{{ faces.length }}</span>
                </div>
                <div class="status-item">
                  <span class="status-label">检测到物体</span>
                  <span class="status-value">{{ objects.length }}</span>
                </div>
                <div class="status-item">
                  <span class="status-label">专注度</span>
                  <span class="status-value attention" :class="attentionClass">{{ attentionScore }}%</span>
                </div>
                <div class="status-item">
                  <span class="status-label">情绪</span>
                  <span class="status-value">{{ dominantEmotion }}</span>
                </div>
              </div>
            </div>
          </template>

          <!-- 实验评分模式 -->
          <template v-if="analysisMode === 'experiment'">
            <div class="control-section">
              <div class="section-title">检测配置</div>
              <div class="config-item">
                <input type="checkbox" id="face-detect-exp" v-model="visionConfig.faceDetect">
                <label for="face-detect-exp">人脸检测 (LBP)</label>
              </div>
              <div class="config-item">
                <input type="checkbox" id="object-detect-exp" v-model="visionConfig.objectDetect">
                <label for="object-detect-exp">实验操作分析 (YOLOv8)</label>
              </div>
            </div>

            <div class="control-section">
              <div class="section-title">视频源</div>
              <button class="source-btn" @click="loadLocalVideo">🎬 加载本地视频</button>
              <button class="source-btn" @click="loadNetworkVideo">🔗 加载网络视频</button>
              <div class="url-input-wrapper">
                <input type="text" v-model="videoUrl" placeholder="rtsp:// 或 http:// 视频地址" class="url-input">
              </div>
            </div>

            <div class="control-section">
              <div class="section-title">
                <span>实验命令</span>
                <span class="status-badge" :class="yoloStatusClass">{{ yoloStatus }}</span>
              </div>
              <div class="experiment-commands">
                <button class="exp-cmd-btn" @click="sendExperimentCommand('检查完毕')" :disabled="isAnalyzing">
                  📋 检查完毕
                </button>
                <button class="exp-cmd-btn" @click="sendExperimentCommand('染色完成')" :disabled="isAnalyzing">
                  🧪 染色完成
                </button>
                <button class="exp-cmd-btn" @click="sendExperimentCommand('显微镜对准')" :disabled="isAnalyzing">
                  🔬 显微镜对准
                </button>
                <button class="exp-cmd-btn" @click="sendExperimentCommand('清洁完毕')" :disabled="isAnalyzing">
                  ✨ 清洁完毕
                </button>
              </div>
            </div>

            <div class="control-section">
              <div class="section-title">
                <span>分析控制</span>
                <span class="status-badge" :class="detectionStatus">{{ detectionStatus }}</span>
              </div>
              <div class="detection-commands">
                <button class="cmd-btn success" @click="startExperimentDetection" :disabled="isAnalyzing">
                  ▶️ 开始检测
                </button>
                <button class="cmd-btn danger" @click="stopExperimentDetection" :disabled="!isAnalyzing">
                  ⏹️ 停止实验
                </button>
              </div>
            </div>

            <div class="control-section">
              <div class="section-title">快捷操作</div>
              <button class="action-btn confirm-btn" @click="confirmExperimentResults">
                <span class="btn-icon">✅</span>
                <span>确认结果</span>
              </button>
              <button class="action-btn export-btn" @click="exportExperimentData">
                <span class="btn-icon">📊</span>
                <span>导出数据</span>
              </button>
              <button class="action-btn reset-btn" @click="resetExperimentScores">
                <span class="btn-icon">🔄</span>
                <span>重置评分</span>
              </button>
            </div>

            <!-- 实验评分状态 -->
            <div class="control-section experiment-status-section">
              <div class="section-title">评分状态</div>
              <div class="experiment-status-grid">
                <div class="exp-status-item" :class="{ completed: experimentSteps.checkCompleted }">
                  <span class="exp-status-icon">📋</span>
                  <span class="exp-status-text">步骤验证</span>
                  <span class="exp-status-badge" v-if="experimentSteps.checkCompleted">✓</span>
                </div>
                <div class="exp-status-item" :class="{ error: experimentSteps.deduction > 0 }">
                  <span class="exp-status-icon">❌</span>
                  <span class="exp-status-text">扣分项</span>
                  <span class="exp-status-value" v-if="experimentSteps.deduction > 0">-{{ experimentSteps.deduction }}</span>
                </div>
              </div>
              <div class="experiment-progress">
                <div class="progress-label">完成进度</div>
                <div class="progress-bar-wrapper">
                  <div class="progress-bar-fill" :style="{ width: experimentProgress + '%' }"></div>
                </div>
                <div class="progress-text">{{ experimentProgress }}%</div>
              </div>
            </div>

            <div class="control-section log-section">
              <div class="section-title">
                <span>输出日志</span>
                <button class="clear-log-btn" @click="clearLogs">清除</button>
              </div>
              <div class="log-content" ref="logContent">
                <div v-for="(log, index) in logs" :key="index" class="log-item" :class="getLogClass(log)">
                  <span class="log-time">{{ log.time }}</span>
                  <span class="log-message">{{ log.message }}</span>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- 中心主显示区 -->
        <div class="main-display" ref="mainDisplayRef">
          <!-- 基础分析模式 -->
          <template v-if="analysisMode === 'basic'">
            <!-- 视频显示层 -->
            <div class="video-layer" ref="videoLayerRef">
              <!-- 网络视频 -->
              <video
                v-if="currentVideoSource === 'network' && networkVideoUrl"
                ref="networkVideoRef"
                :src="networkVideoUrl"
                class="main-video"
                autoplay
                loop
                muted
                playsinline
              ></video>

              <!-- 本地视频 -->
              <video
                v-if="currentVideoSource === 'localVideo' && localVideoUrl"
                ref="localVideoRef"
                :src="localVideoUrl"
                class="main-video"
                autoplay
                loop
                muted
                playsinline
                controls
              ></video>

              <!-- 本地图片 -->
              <img
                v-if="currentVideoSource === 'image' && imageUrl"
                :src="imageUrl"
                class="main-image"
                alt="分析图片"
              >

              <!-- 摄像头实时流 -->
              <video
                v-if="currentVideoSource === 'camera' && cameraActive"
                ref="cameraVideoRef"
                class="main-video"
                autoplay
                playsinline
                muted
              ></video>

              <!-- 默认占位 -->
              <div v-if="!currentVideoSource || currentVideoSource === 'none'" class="video-placeholder">
                <div class="placeholder-content">
                  <span class="placeholder-icon">🎥</span>
                  <span class="placeholder-text">请选择视频源</span>
                  <span class="placeholder-hint">加载本地视频/图片或连接摄像头</span>
                </div>
              </div>

              <!-- 检测结果覆盖层 -->
              <canvas ref="overlayCanvasRef" class="overlay-canvas"></canvas>

              <!-- 批注层 -->
              <div class="annotation-layer" v-if="annotationEnabled">
                <AnnotationToolbar
                  v-if="annotationEnabled"
                  :enabled="annotationEnabled"
                  :color="annotationColor"
                  :brush-size="annotationBrushSize"
                  :brush-type="annotationBrushType"
                  @update:enabled="annotationEnabled = $event"
                  @update:color="annotationColor = $event"
                  @update:brush-size="annotationBrushSize = $event"
                  @update:brush-type="annotationBrushType = $event"
                  @clear="handleAnnotationClear"
                  @erase="handleAnnotationErase"
                  @save="handleAnnotationSave"
                />
                <AnnotationCanvas
                  ref="annotationCanvasRef"
                  :enabled="annotationEnabled"
                  :color="annotationColor"
                  :brush-size="annotationBrushSize"
                  :brush-type="annotationBrushType"
                  class="annotation-canvas-layer"
                  @annotation-start="handleAnnotationStart"
                  @annotation-end="handleAnnotationEnd"
                />
              </div>
            </div>

            <!-- 顶部状态栏 -->
            <div class="status-bar">
              <div class="status-left">
                <span class="waiting-text">{{ experimentStatus }}</span>
              </div>
              <div class="status-right">
                <div class="attention-indicator" :class="attentionClass">
                  <span class="indicator-icon">🧠</span>
                  <span class="indicator-value">专注度: {{ attentionScore }}%</span>
                  <div class="attention-bar">
                    <div class="attention-fill" :style="{ width: attentionScore + '%' }"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 底部播放控制栏 -->
            <div class="playback-bar" v-if="currentVideoSource !== 'camera'">
              <div class="timestamp">{{ currentTime }}</div>
              <div class="progress-bar" @click="seekVideo" ref="progressBarRef">
                <div class="progress-fill" :style="{ width: progress + '%' }"></div>
                <div class="progress-thumb" :style="{ left: progress + '%' }"></div>
              </div>
              <div class="timestamp">{{ duration }}</div>

              <div class="playback-controls">
                <button class="control-btn" @click="skipBackward">⏮️</button>
                <button class="control-btn" @click="rewind">⏪</button>
                <button class="control-btn play-btn" @click="togglePlay">
                  {{ isPlaying ? '⏸️' : '▶️' }}
                </button>
                <button class="control-btn" @click="fastForward">⏩</button>
                <button class="control-btn" @click="skipForward">⏭️</button>
                <button class="control-btn" @click="toggleMute">{{ isMuted ? '🔇' : '🔊' }}</button>
                <input type="range" class="volume-slider" v-model="volume" min="0" max="100" @input="setVolume">
              </div>

              <div class="video-info" v-if="videoFileHash">
                <span class="file-hash">{{ videoFileHash }}</span>
              </div>
            </div>
          </template>

          <!-- 实验评分模式 -->
          <template v-if="analysisMode === 'experiment'">
            <!-- 实验标题 -->
            <div class="experiment-title-bar">
              <span class="experiment-title">{{ experimentTitle }}</span>
              <div class="final-score-display">
                <span class="score-label">最终得分</span>
                <span class="score-value" :class="scoreClass">{{ experimentScore }}</span>
              </div>
            </div>

            <!-- 双画面显示 -->
            <div class="experiment-video-section">
              <!-- 左侧：原始画面 -->
              <div class="experiment-video-container left-video">
                <div class="video-label">原始画面</div>
                <div class="video-wrapper">
                  <video
                    v-if="experimentVideoUrl"
                    ref="experimentVideoRef"
                    :src="experimentVideoUrl"
                    class="experiment-video"
                    autoplay
                    loop
                    muted
                    playsinline
                  ></video>
                  <div v-else class="video-placeholder">
                    <span class="placeholder-text">等待输入...</span>
                  </div>
                </div>
              </div>

              <!-- 右侧：AI识别画面 -->
              <div class="experiment-video-container right-video">
                <div class="video-label">AI 识别画面</div>
                <div class="video-wrapper">
                  <canvas ref="experimentOverlayRef" class="experiment-overlay-canvas"></canvas>
                  <div v-if="!isAnalyzing" class="video-placeholder">
                    <span class="placeholder-text">等待检测...</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 扣分原因显示 -->
            <div class="deduction-panel" v-if="deductionReasons.length > 0">
              <div class="deduction-title">扣分原因：</div>
              <div class="deduction-list">
                <div v-for="(reason, index) in deductionReasons" :key="index" class="deduction-item">
                  <span class="deduction-icon">❌</span>
                  <span class="deduction-text">{{ reason }}</span>
                  <span class="deduction-score">-{{ getDeductionScore(reason) }}分</span>
                </div>
              </div>
            </div>

            <!-- 底部播放控制栏 -->
            <div class="playback-bar experiment-playback">
              <div class="timestamp">{{ currentTime }}</div>
              <div class="progress-bar" @click="seekVideo" ref="progressBarRef">
                <div class="progress-fill" :style="{ width: progress + '%' }"></div>
                <div class="progress-thumb" :style="{ left: progress + '%' }"></div>
              </div>
              <div class="timestamp">{{ duration }}</div>

              <div class="playback-controls">
                <button class="control-btn" @click="skipBackward">⏮️</button>
                <button class="control-btn" @click="rewind">⏪</button>
                <button class="control-btn play-btn" @click="togglePlay">
                  {{ isPlaying ? '⏸️' : '▶️' }}
                </button>
                <button class="control-btn" @click="fastForward">⏩</button>
                <button class="control-btn" @click="skipForward">⏭️</button>
                <button class="control-btn" @click="toggleMute">{{ isMuted ? '🔇' : '🔊' }}</button>
                <input type="range" class="volume-slider" v-model="volume" min="0" max="100" @input="setVolume">
              </div>

              <div class="video-info" v-if="videoFileHash">
                <span class="file-hash">{{ videoFileHash }}</span>
              </div>
            </div>
          </template>
        </div>

        <!-- 右侧结果面板 -->
        <div class="result-panel">
          <!-- 基础分析模式结果 -->
          <template v-if="analysisMode === 'basic'">
            <div class="panel-title">📊 AI 识别/分析结果</div>

            <!-- 专注度总览 -->
            <div class="attention-overview">
              <div class="attention-score">
                <div class="score-label">专注度评分</div>
                <div class="score-value" :class="attentionClass">{{ attentionScore }}</div>
                <div class="score-level">{{ attentionLevel }}</div>
              </div>
              <div class="attention-chart">
                <div class="chart-bar">
                  <div class="chart-fill high" :style="{ width: highPercentage + '%' }"></div>
                  <div class="chart-fill medium" :style="{ width: mediumPercentage + '%' }"></div>
                  <div class="chart-fill low" :style="{ width: lowPercentage + '%' }"></div>
                </div>
                <div class="chart-legend">
                  <span class="legend-item high">高 {{ highPercentage }}%</span>
                  <span class="legend-item medium">中 {{ mediumPercentage }}%</span>
                  <span class="legend-item low">低 {{ lowPercentage }}%</span>
                </div>
              </div>
            </div>

            <!-- 检测结果列表 -->
            <div class="result-content">
              <div v-if="detectionResults.length === 0" class="empty-result">
                <span class="empty-icon">🔍</span>
                <p>暂无检测结果</p>
                <p class="empty-hint">开始分析后将显示检测结果</p>
              </div>

              <div v-for="(result, index) in detectionResults" :key="index" class="result-item">
                <div class="result-header">
                  <span class="result-time">{{ result.time }}</span>
                  <span class="result-badge" v-if="result.faces && result.faces.length > 0">
                    👤 {{ result.faces.length }}
                  </span>
                  <span class="result-badge" v-if="result.attention">
                    🧠 {{ result.attention }}%
                  </span>
                </div>

                <!-- 人脸检测结果 -->
                <div class="result-section" v-if="result.faces && result.faces.length > 0">
                  <div class="result-section-title">人脸检测</div>
                  <div v-for="(face, fi) in result.faces" :key="fi" class="face-item">
                    <span class="face-label">人脸 {{ fi + 1 }}</span>
                    <span class="face-confidence">{{ (face.confidence * 100).toFixed(1) }}%</span>
                    <div class="face-bbox" v-if="face.boundingBox">
                      位置: {{ face.boundingBox.x?.toFixed(0) }}, {{ face.boundingBox.y?.toFixed(0) }}
                      ({{ face.boundingBox.width?.toFixed(0) }}×{{ face.boundingBox.height?.toFixed(0) }})
                    </div>
                  </div>
                </div>

                <!-- 物体检测结果 -->
                <div class="result-section" v-if="result.objects && result.objects.length > 0">
                  <div class="result-section-title">物体检测</div>
                  <div v-for="(obj, oi) in result.objects" :key="oi" class="object-item">
                    <span class="object-label">{{ obj.label }}</span>
                    <span class="object-confidence">{{ (obj.confidence * 100).toFixed(1) }}%</span>
                  </div>
                </div>

                <!-- 专注度结果 -->
                <div class="result-section" v-if="result.attention">
                  <div class="result-section-title">专注度</div>
                  <div class="attention-item">
                    <div class="attention-bar-mini">
                      <div class="attention-fill-mini" :style="{ width: result.attention + '%' }"></div>
                    </div>
                    <span class="attention-value">{{ result.attention }}%</span>
                  </div>
                </div>

                <!-- 情绪结果 -->
                <div class="result-section" v-if="result.emotions && result.emotions.length > 0">
                  <div class="result-section-title">情绪分析</div>
                  <div v-for="(emotion, ei) in result.emotions" :key="ei" class="emotion-item">
                    <span class="emotion-face">👤</span>
                    <div class="emotion-bars">
                      <div v-for="(e, index) in emotion.emotions" :key="index" class="emotion-bar-row">
                        <span class="emotion-name">{{ e.emotion }}</span>
                        <div class="emotion-bar-bg">
                          <div class="emotion-bar-fill" :style="{ width: (e.confidence * 100) + '%' }"></div>
                        </div>
                        <span class="emotion-value">{{ (e.confidence * 100).toFixed(0) }}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- 实验评分模式结果 -->
          <template v-if="analysisMode === 'experiment'">
            <div class="panel-title">🧪 AI 实验评分</div>

            <!-- 实验评分总览 -->
            <div class="experiment-score-overview">
              <div class="exp-score-circle">
                <svg viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#2D4A6F" stroke-width="8"/>
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="45" 
                    fill="none" 
                    :stroke="scoreColor" 
                    stroke-width="8"
                    stroke-linecap="round"
                    :stroke-dasharray="`${(experimentScore / 20) * 283} 283`"
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div class="exp-score-value">{{ experimentScore }}</div>
              </div>
              <div class="exp-score-label">最终得分</div>
            </div>

            <!-- 实验步骤列表 -->
            <div class="experiment-steps-list">
              <div class="steps-title">实验步骤</div>
              <div 
                v-for="(step, index) in experimentStepList" 
                :key="index" 
                class="step-item"
                :class="{ completed: step.completed, failed: step.failed }"
              >
                <span class="step-icon">{{ step.completed ? '✅' : (step.failed ? '❌' : '⏳') }}</span>
                <span class="step-name">{{ step.name }}</span>
                <span class="step-score">{{ step.score }}分</span>
              </div>
            </div>

            <!-- 实验检测结果 -->
            <div class="experiment-result-content">
              <div v-if="experimentResults.length === 0" class="empty-result">
                <span class="empty-icon">🔬</span>
                <p>暂无检测结果</p>
                <p class="empty-hint">开始实验后将显示AI检测结果</p>
              </div>

              <div v-for="(result, index) in experimentResults" :key="index" class="result-item">
                <div class="result-header">
                  <span class="result-time">{{ result.time }}</span>
                  <span class="result-badge" v-if="result.detectedObjects && result.detectedObjects.length > 0">
                    🔬 {{ result.detectedObjects.length }}
                  </span>
                </div>

                <!-- 检测到的物体 -->
                <div class="result-section" v-if="result.detectedObjects && result.detectedObjects.length > 0">
                  <div class="result-section-title">检测到的操作</div>
                  <div v-for="(obj, oi) in result.detectedObjects" :key="oi" class="object-item">
                    <span class="object-label">{{ obj.label }}</span>
                    <span class="object-confidence">{{ (obj.confidence * 100).toFixed(1) }}%</span>
                  </div>
                </div>

                <!-- 操作分析 -->
                <div class="result-section" v-if="result.action">
                  <div class="result-section-title">操作分析</div>
                  <div class="action-item">
                    <span class="action-icon">🔍</span>
                    <span class="action-text">{{ result.action }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { minimizeWindow, maximizeWindow, closeApp } from '@/utils/tauri-api.js'
import AnnotationCanvas from '@/components/AnnotationCanvas.vue'
import AnnotationToolbar from '@/components/AnnotationToolbar.vue'
import { useVisionStore } from '@/stores/visionStore'
import { useRouter } from 'vue-router'

const router = useRouter()
const visionStore = useVisionStore()

// 路由控制
const goBack = () => {
  router.push('/')
}

const minimize = () => {
  minimizeWindow()
}

const maximize = () => {
  maximizeWindow()
}

const close = () => {
  closeApp()
}

// 功能跳转
const openStudentTraining = () => {
  router.push('/students')
}

const openTeacherManagement = () => {
  router.push('/teacher')
}

const openVisionAnalysis = () => {
  showAnalysisPanel.value = true
  nextTick(() => {
    initOverlayCanvas()
  })
}

const openApiTest = () => {
  router.push('/logs')
}

const openSystemHome = () => {
  router.push('/')
}

const openServiceStatus = () => {
  router.push('/status')
}

const showMessage = (name, desc) => {
  ElMessage.success(`功能：${name}\n说明：${desc}`)
}

const viewTrainingInfo = () => showMessage('学生实训', '学生在线实训、提交实验报告、查看学习进度')
const viewManagementInfo = () => showMessage('教师管理', '管理班级、分配任务、批改作业、成绩管理')
const viewVisionInfo = () => showMessage('视觉分析', 'AI 视觉分析、专注度监测、行为分析报告')
const viewApiInfo = () => showMessage('API 测试', '接口测试、性能监控、日志查看')
const viewSystemInfo = () => showMessage('系统首页', '系统概览、快速导航、状态监控')
const viewStatusInfo = () => showMessage('服务状态', '服务运行状态、资源使用情况、性能指标')

// 分析面板控制
const showAnalysisPanel = ref(false)

// 分析模式选择
const analysisMode = ref('basic') // 'basic' 或 'experiment'

const exitAnalysisPanel = () => {
  stopDetection()
  stopExperimentDetection()
  stopCamera()
  showAnalysisPanel.value = false
}

// Vision Store 状态
const visionConfig = reactive({
  faceDetect: true,
  objectDetect: true,
  attentionMonitor: true,
  emotionAnalysis: true,
  yoloThreshold: 0.5
})

// 监听配置变化
watch(visionConfig, (newConfig) => {
  visionStore.setConfig(newConfig)
}, { deep: true })

// ============================================
// YOLO 双模式检测功能
// ============================================

// 获取当前检测模式
const getCurrentDetectionMode = () => {
  console.log('检测模式:', visionStore.detectionMode)
  console.log('网络状态:', visionStore.isOnline ? '在线' : '离线')
  console.log('模式文本:', visionStore.detectionModeText)
  return {
    mode: visionStore.detectionMode,
    online: visionStore.isOnline,
    modeText: visionStore.detectionModeText
  }
}

// 获取模式图标
const getModeIcon = (mode) => {
  const icons = {
    online: '🌐',
    local: '💾',
    fallback: '⚠️'
  }
  return icons[mode] || '❓'
}

// 重置 YOLO 模型（网络切换后重新加载）
const reloadYoloModel = async () => {
  try {
    ElMessage.info('正在重新加载 YOLO 模型...')
    const success = await visionStore.resetYoloModel()
    if (success) {
      ElMessage.success('模型重载成功，当前模式: ' + visionStore.detectionModeText)
    } else {
      ElMessage.error('模型重载失败')
    }
    return success
  } catch (error) {
    console.error('[WebFeatures] 模型重载失败:', error)
    ElMessage.error('模型重载失败: ' + error.message)
    return false
  }
}

// 监听网络状态变化
const handleNetworkChange = () => {
  const status = visionStore.getNetworkStatus()
  console.log('网络状态变化:', status ? '在线' : '离线')
  if (!status) {
    ElMessage.warning('网络已断开，将使用本地模型')
  } else {
    ElMessage.success('网络已连接，将使用在线模型')
  }
}

onMounted(() => {
  // 监听网络状态变化
  window.addEventListener('online', handleNetworkChange)
  window.addEventListener('offline', handleNetworkChange)
})

onUnmounted(() => {
  // 清理网络状态监听
  window.removeEventListener('online', handleNetworkChange)
  window.removeEventListener('offline', handleNetworkChange)
})

// 分析控制
const isAnalyzing = ref(false)
const analysisInterval = ref(500)
const detectionStatus = computed(() => {
  if (isAnalyzing.value) return '运行中'
  return '未开启'
})

let analysisTimer = null

const startDetection = async () => {
  if (isAnalyzing.value) return

  // 检查是否有视频源
  if (!currentVideoSource.value || currentVideoSource.value === 'none') {
    ElMessage.warning('请先加载视频源')
    return
  }

  isAnalyzing.value = true
  visionStore.startAnalysis()
  experimentStatus.value = '分析进行中...'
  addLog('开始视觉分析')

  // 开始定时分析
  analysisTimer = setInterval(async () => {
    await performAnalysis()
  }, analysisInterval.value)

  // 启动渲染循环
  requestAnimationFrame(analysisLoop)
}

const stopDetection = () => {
  isAnalyzing.value = false
  visionStore.stopAnalysis()
  experimentStatus.value = '分析已停止'
  addLog('停止视觉分析')

  if (analysisTimer) {
    clearInterval(analysisTimer)
    analysisTimer = null
  }
}

const clearResults = () => {
  visionStore.clearResults()
  detectionResults.value = []
  addLog('已清除所有检测结果')
  ElMessage.info('已清除检测结果')
}

// ============================================
// 实验评分相关
// ============================================

// 实验标题
const experimentTitle = ref('实验员移动显微镜')

// 实验评分相关状态
const experimentVideoUrl = ref('')
const experimentVideoRef = ref(null)
const experimentOverlayRef = ref(null)
const experimentScore = ref(20)
const experimentResults = ref([])
const experimentSteps = reactive({
  checkCompleted: false,
  dyeingCompleted: false,
  microscopeAligned: false,
  cleaningCompleted: false,
  deduction: 0
})

// 实验步骤列表
const experimentStepList = computed(() => [
  { name: '检查完毕', completed: experimentSteps.checkCompleted, failed: false, score: 5 },
  { name: '染色完成', completed: experimentSteps.dyeingCompleted, failed: false, score: 5 },
  { name: '显微镜对准', completed: experimentSteps.microscopeAligned, failed: false, score: 5 },
  { name: '清洁完毕', completed: experimentSteps.cleaningCompleted, failed: false, score: 5 }
])

// 实验进度
const experimentProgress = computed(() => {
  let completed = 0
  if (experimentSteps.checkCompleted) completed++
  if (experimentSteps.dyeingCompleted) completed++
  if (experimentSteps.microscopeAligned) completed++
  if (experimentSteps.cleaningCompleted) completed++
  return (completed / 4) * 100
})

// YOLO 状态
const yoloStatus = ref('未启动')
const yoloStatusClass = computed(() => {
  if (yoloStatus.value === 'YOLO 已就绪') return 'success'
  if (yoloStatus.value === '运行中') return 'running'
  return ''
})

// 扣分原因列表
const deductionReasons = ref([])

// 实验步骤扣分映射
const stepDeductionMap = {
  '检查完毕': 5,
  '染色完成': 5,
  '显微镜对准': 5,
  '清洁完毕': 5,
  '操作超时': 2,
  '动作不规范': 3,
  '未注视操作区域': 2,
  '操作顺序错误': 3
}

// 获取扣分分数
const getDeductionScore = (reason) => {
  return stepDeductionMap[reason] || 1
}

// 得分颜色
const scoreColor = computed(() => {
  if (experimentScore.value >= 15) return '#10B981'
  if (experimentScore.value >= 10) return '#F59E0B'
  return '#EF4444'
})

// 得分样式类
const scoreClass = computed(() => {
  if (experimentScore.value >= 15) return 'high'
  if (experimentScore.value >= 10) return 'medium'
  return 'low'
})

// 发送实验命令
const sendExperimentCommand = (command) => {
  addLog(`命令: ${command}`)
  yoloStatus.value = 'YOLO 已就绪'
  addLog('YOLO 已就绪', 'success')

  // 根据命令更新步骤状态
  if (command === '检查完毕') {
    experimentSteps.checkCompleted = true
    addLog('步骤「检查完毕」验证通过', 'success')
  } else if (command === '染色完成') {
    experimentSteps.dyeingCompleted = true
    addLog('步骤「染色完成」验证通过', 'success')
  } else if (command === '显微镜对准') {
    experimentSteps.microscopeAligned = true
    addLog('步骤「显微镜对准」验证通过', 'success')
  } else if (command === '清洁完毕') {
    experimentSteps.cleaningCompleted = true
    addLog('步骤「清洁完毕」验证通过', 'success')
  }

  // 重新计算得分
  calculateExperimentScore()
}

// 计算实验得分
const calculateExperimentScore = () => {
  let score = 20
  let deduction = 0

  if (experimentSteps.checkCompleted) score -= 0
  else deduction += 5

  if (experimentSteps.dyeingCompleted) score -= 0
  else deduction += 5

  if (experimentSteps.microscopeAligned) score -= 0
  else deduction += 5

  if (experimentSteps.cleaningCompleted) score -= 0
  else deduction += 5

  experimentScore.value = Math.max(0, score)
  experimentSteps.deduction = deduction
}

// 开始实验检测
const startExperimentDetection = async () => {
  if (isAnalyzing.value) return

  if (!experimentVideoUrl.value) {
    ElMessage.warning('请先加载实验视频')
    return
  }

  isAnalyzing.value = true
  yoloStatus.value = '运行中'
  experimentStatus.value = '实验检测进行中...'
  addLog('开始实验检测')
  ElMessage.success('开始实验检测')

  // 开始定时分析
  analysisTimer = setInterval(async () => {
    await performExperimentAnalysis()
  }, analysisInterval.value)

  requestAnimationFrame(experimentAnalysisLoop)
}

// 停止实验检测
const stopExperimentDetection = () => {
  isAnalyzing.value = false
  yoloStatus.value = '已停止'
  experimentStatus.value = '实验检测已停止'
  addLog('实验检测已停止')

  if (analysisTimer) {
    clearInterval(analysisTimer)
    analysisTimer = null
  }
}

// 执行实验分析
const performExperimentAnalysis = async () => {
  try {
    let input = null

    if (experimentVideoRef.value) {
      input = experimentVideoRef.value
    } else if (experimentVideoUrl.value) {
      input = await loadVideoElement(experimentVideoUrl.value)
    }

    if (!input) {
      addLog('警告: 无法获取视频帧', 'warn')
      return
    }

    // 执行分析
    const result = await visionStore.performAnalysis(input)

    if (result) {
      // 模拟检测到的操作
      const detectedActions = [
        '移动显微镜',
        '调节焦距',
        '观察样本',
        '记录数据',
        '清洁镜头'
      ]
      const randomAction = detectedActions[Math.floor(Math.random() * detectedActions.length)]

      experimentResults.value.unshift({
        time: new Date().toLocaleTimeString(),
        detectedObjects: result.objects || [],
        action: randomAction,
        confidence: Math.random() * 0.3 + 0.7
      })

      // 限制结果数量
      if (experimentResults.value.length > 30) {
        experimentResults.value.pop()
      }

      // 模拟随机扣分
      simulateDeduction()

      // 绘制实验覆盖层
      drawExperimentOverlay(result)
    }
  } catch (error) {
    console.error('[Experiment] 分析失败:', error)
    addLog(`实验分析错误: ${error.message}`, 'error')
  }
}

// 模拟扣分
const simulateDeduction = () => {
  const deductionItems = [
    '操作超时',
    '动作不规范',
    '未注视操作区域',
    '操作顺序错误'
  ]

  // 随机概率触发扣分
  if (Math.random() > 0.9 && deductionReasons.value.length < 5) {
    const reason = deductionItems[Math.floor(Math.random() * deductionItems.length)]
    if (!deductionReasons.value.includes(reason)) {
      deductionReasons.value.push(reason)
      experimentScore.value = Math.max(0, experimentScore.value - getDeductionScore(reason))
      experimentSteps.deduction = deductionReasons.value.reduce((sum, r) => sum + getDeductionScore(r), 0)
      addLog(`扣分: ${reason} (-${getDeductionScore(reason)}分)`, 'warn')
    }
  }
}

// 加载视频元素
const loadVideoElement = (url) => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.src = url
    video.onloadeddata = () => resolve(video)
    video.onerror = reject
  })
}

// 实验分析循环
const experimentAnalysisLoop = () => {
  if (!isAnalyzing.value) return
  requestAnimationFrame(experimentAnalysisLoop)
}

// 绘制实验覆盖层
const drawExperimentOverlay = (result) => {
  if (!experimentOverlayRef.value) return

  const canvas = experimentOverlayRef.value
  const ctx = canvas.getContext('2d')

  // 清空画布
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // 绘制检测框
  if (result.objects && result.objects.length > 0) {
    result.objects.forEach((obj, index) => {
      if (obj.bbox) {
        const { x, y, width, height } = obj.bbox
        ctx.strokeStyle = '#00FFFF'
        ctx.lineWidth = 2
        ctx.strokeRect(x, y, width, height)

        ctx.fillStyle = 'rgba(0, 255, 255, 0.8)'
        ctx.fillRect(x, y - 25, 100, 25)
        ctx.fillStyle = '#000'
        ctx.font = '14px Arial'
        ctx.fillText(`${obj.label || '物体'}`, x + 5, y - 7)
      }
    })
  }

  // 如果检测到人脸，也绘制
  if (result.faces && result.faces.length > 0) {
    result.faces.forEach((face, index) => {
      if (face.boundingBox) {
        const { x, y, width, height } = face.boundingBox
        ctx.strokeStyle = '#FF0000'
        ctx.lineWidth = 2
        ctx.strokeRect(x, y, width, height)

        ctx.fillStyle = 'rgba(255, 0, 0, 0.8)'
        ctx.fillRect(x, y - 25, 80, 25)
        ctx.fillStyle = '#000'
        ctx.font = '14px Arial'
        ctx.fillText(`人脸 ${index + 1}`, x + 5, y - 7)
      }
    })
  }
}

// 确认实验结果
const confirmExperimentResults = () => {
  addLog('实验结果已确认', 'success')
  ElMessage.success(`实验完成，最终得分: ${experimentScore.value}分`)

  // 停止检测
  stopExperimentDetection()
}

// 导出实验数据
const exportExperimentData = async () => {
  try {
    const exportData = {
      exportTime: new Date().toISOString(),
      experimentTitle: experimentTitle.value,
      finalScore: experimentScore.value,
      steps: {
        checkCompleted: experimentSteps.checkCompleted,
        dyeingCompleted: experimentSteps.dyeingCompleted,
        microscopeAligned: experimentSteps.microscopeAligned,
        cleaningCompleted: experimentSteps.cleaningCompleted
      },
      deductionReasons: deductionReasons.value,
      totalDeduction: experimentSteps.deduction,
      results: experimentResults.value
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `experiment-analysis-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)

    addLog('实验数据已导出', 'success')
    ElMessage.success('实验数据已导出')
  } catch (error) {
    console.error('[Experiment] 导出失败:', error)
    ElMessage.error('导出失败')
  }
}

// 重置实验评分
const resetExperimentScores = () => {
  experimentScore.value = 20
  experimentResults.value = []
  deductionReasons.value = []
  experimentSteps.checkCompleted = false
  experimentSteps.dyeingCompleted = false
  experimentSteps.microscopeAligned = false
  experimentSteps.cleaningCompleted = false
  experimentSteps.deduction = 0
  yoloStatus.value = '未启动'
  addLog('评分数据已重置')
  ElMessage.info('评分数据已重置')
}

const performAnalysis = async () => {
  try {
    let input = null

    // 根据视频源获取输入
    if (currentVideoSource.value === 'camera' && cameraVideoRef.value) {
      input = cameraVideoRef.value
    } else if (currentVideoSource.value === 'network' && networkVideoRef.value) {
      input = networkVideoRef.value
    } else if (currentVideoSource.value === 'localVideo' && localVideoRef.value) {
      input = localVideoRef.value
    } else if (currentVideoSource.value === 'image' && imageUrl.value) {
      // 图片需要加载到 Image 对象
      input = await loadImageElement(imageUrl.value)
    }

    if (!input) {
      addLog('警告: 无法获取视频帧', 'warn')
      return
    }

    // 执行分析
    const result = await visionStore.performAnalysis(input)

    // 更新检测结果
    if (result) {
      detectionResults.value.unshift({
        time: new Date().toLocaleTimeString(),
        faces: result.faces || [],
        objects: result.objects || [],
        attention: result.attention || 0,
        emotions: result.emotions || []
      })

      // 限制结果数量
      if (detectionResults.value.length > 50) {
        detectionResults.value.pop()
      }

      // 更新专注度显示
      attentionScore.value = result.attention || 0
      faces.value = result.faces || []
      objects.value = result.objects || []

      // 更新情绪
      if (result.emotions && result.emotions.length > 0) {
        dominantEmotion.value = result.emotions[0].dominantEmotion || '未知'
      }

      // 重绘覆盖层
      drawOverlay()

      addLog(`检测完成: ${faces.value.length}人脸, ${objects.value.length}物体, 专注度${attentionScore.value}%`)
    }
  } catch (error) {
    console.error('[VisionAnalysis] 分析失败:', error)
    addLog(`分析错误: ${error.message}`, 'error')
  }
}

// 持续分析循环
const analysisLoop = () => {
  if (!isAnalyzing.value) return
  requestAnimationFrame(analysisLoop)
}

// 加载图片元素
const loadImageElement = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

// 视频源加载
const videoUrl = ref('')
const currentVideoSource = ref('none')
const networkVideoUrl = ref('')
const localVideoUrl = ref('')
const imageUrl = ref('')

const loadLocalImage = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async (e) => {
    const file = e.target.files[0]
    if (file) {
      imageUrl.value = URL.createObjectURL(file)
      currentVideoSource.value = 'image'
      addLog(`加载图片: ${file.name}`)
      ElMessage.success(`已加载图片: ${file.name}`)
    }
  }
  input.click()
}

const loadLocalVideo = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'video/*'
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (file) {
      const videoUrl = URL.createObjectURL(file)
      localVideoUrl.value = videoUrl
      experimentVideoUrl.value = videoUrl
      currentVideoSource.value = 'localVideo'
      addLog(`加载视频: ${file.name}`)
      ElMessage.success(`已加载视频: ${file.name}`)
      videoFileHash.value = generateHash(file.name + file.size)

      // 初始化实验覆盖层画布
      nextTick(() => {
        if (experimentOverlayRef.value) {
          const wrapper = experimentOverlayRef.value.parentElement
          if (wrapper) {
            experimentOverlayRef.value.width = wrapper.clientWidth
            experimentOverlayRef.value.height = wrapper.clientHeight
          }
        }
      })
    }
  }
  input.click()
}

const loadNetworkVideo = () => {
  if (!videoUrl.value) {
    ElMessage.warning('请输入网络视频地址')
    return
  }
  networkVideoUrl.value = videoUrl.value
  experimentVideoUrl.value = videoUrl.value
  currentVideoSource.value = 'network'
  addLog(`加载网络视频: ${videoUrl.value}`)
  ElMessage.success('已加载网络视频')
}

// 摄像头
const cameraActive = ref(false)
const cameraStream = ref(null)

const toggleCamera = async () => {
  if (cameraActive.value) {
    stopCamera()
  } else {
    await startCamera()
  }
}

const startCamera = async () => {
  try {
    cameraStream.value = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, facingMode: 'user' },
      audio: false
    })

    cameraActive.value = true
    currentVideoSource.value = 'camera'

    nextTick(() => {
      if (cameraVideoRef.value) {
        cameraVideoRef.value.srcObject = cameraStream.value
      }
    })

    addLog('摄像头已连接')
    ElMessage.success('摄像头已连接')
  } catch (error) {
    console.error('[VisionAnalysis] 摄像头启动失败:', error)
    ElMessage.error(`摄像头启动失败: ${error.message}`)
    addLog(`摄像头错误: ${error.message}`, 'error')
  }
}

const stopCamera = () => {
  if (cameraStream.value) {
    cameraStream.value.getTracks().forEach(track => track.stop())
    cameraStream.value = null
  }
  cameraActive.value = false
  if (currentVideoSource.value === 'camera') {
    currentVideoSource.value = 'none'
  }
  addLog('摄像头已断开')
}

const connectCamera = async () => {
  await startCamera()
}

// 视频播放控制
const isPlaying = ref(false)
const currentTime = ref('0:00')
const duration = ref('0:00')
const progress = ref(0)
const volume = ref(80)
const isMuted = ref(false)
const videoFileHash = ref('')

const networkVideoRef = ref(null)
const localVideoRef = ref(null)
const cameraVideoRef = ref(null)

// 监听视频播放状态
onMounted(() => {
  // 设置音量
  volume.value = 80
})

const togglePlay = () => {
  const video = getCurrentVideo()
  if (video) {
    if (isPlaying.value) {
      video.pause()
    } else {
      video.play()
    }
    isPlaying.value = !isPlaying.value
  }
}

const getCurrentVideo = () => {
  if (currentVideoSource.value === 'network') return networkVideoRef.value
  if (currentVideoSource.value === 'localVideo') return localVideoRef.value
  if (currentVideoSource.value === 'camera') return cameraVideoRef.value
  return null
}

const seekVideo = (e) => {
  const video = getCurrentVideo()
  if (video && video.duration) {
    const rect = e.currentTarget.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    video.currentTime = percent * video.duration
  }
}

const skipBackward = () => {
  const video = getCurrentVideo()
  if (video) video.currentTime = 0
}

const skipForward = () => {
  const video = getCurrentVideo()
  if (video && video.duration) video.currentTime = video.duration
}

const rewind = () => {
  const video = getCurrentVideo()
  if (video) video.currentTime = Math.max(0, video.currentTime - 10)
}

const fastForward = () => {
  const video = getCurrentVideo()
  if (video && video.duration) video.currentTime = Math.min(video.duration, video.currentTime + 10)
}

const toggleMute = () => {
  isMuted.value = !isMuted.value
  const video = getCurrentVideo()
  if (video) video.muted = isMuted.value
}

const setVolume = () => {
  const video = getCurrentVideo()
  if (video) video.volume = volume.value / 100
}

// 视频时间格式化
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// 监听视频时间更新
watch(() => getCurrentVideo(), (video) => {
  if (video) {
    video.addEventListener('timeupdate', () => {
      if (video.duration) {
        currentTime.value = formatTime(video.currentTime)
        duration.value = formatTime(video.duration)
        progress.value = (video.currentTime / video.duration) * 100
      }
    })
    video.addEventListener('play', () => isPlaying.value = true)
    video.addEventListener('pause', () => isPlaying.value = false)
    video.addEventListener('ended', () => isPlaying.value = false)
  }
}, { immediate: true })

// 检测结果
const detectionResults = ref([])
const faces = ref([])
const objects = ref([])
const attentionScore = ref(0)
const dominantEmotion = ref('未知')

const attentionLevel = computed(() => {
  if (attentionScore.value >= 80) return '高度专注'
  if (attentionScore.value >= 50) return '一般专注'
  return '注意力分散'
})

const attentionClass = computed(() => {
  if (attentionScore.value >= 80) return 'high'
  if (attentionScore.value >= 50) return 'medium'
  return 'low'
})

// 专注度分布计算
const attentionHistory = computed(() => {
  return detectionResults.value
    .filter(r => r.attention)
    .slice(0, 30)
    .map(r => r.attention)
})

const highPercentage = computed(() => {
  if (attentionHistory.value.length === 0) return 0
  const high = attentionHistory.value.filter(s => s >= 80).length
  return Math.round((high / attentionHistory.value.length) * 100)
})

const mediumPercentage = computed(() => {
  if (attentionHistory.value.length === 0) return 0
  const medium = attentionHistory.value.filter(s => s >= 50 && s < 80).length
  return Math.round((medium / attentionHistory.value.length) * 100)
})

const lowPercentage = computed(() => {
  if (attentionHistory.value.length === 0) return 0
  const low = attentionHistory.value.filter(s => s < 50).length
  return Math.round((low / attentionHistory.value.length) * 100)
})

// 实验状态
const experimentStatus = ref('等待分析开始...')

// 批注功能
const annotationEnabled = ref(false)
const annotationColor = ref('#FF0000')
const annotationBrushSize = ref(5)
const annotationBrushType = ref('pen')
const annotationCanvasRef = ref(null)

const toggleAnnotation = () => {
  annotationEnabled.value = !annotationEnabled.value
  if (annotationEnabled.value) {
    nextTick(() => {
      if (annotationCanvasRef.value) {
        annotationCanvasRef.value.redrawCanvas()
      }
    })
  }
  addLog(`批注${annotationEnabled.value ? '已开启' : '已关闭'}`)
}

const handleAnnotationClear = () => {
  if (annotationCanvasRef.value) {
    annotationCanvasRef.value.clearCanvas()
  }
  addLog('批注已清除')
}

const handleAnnotationErase = () => {
  annotationBrushType.value = 'eraser'
  addLog('切换到橡皮擦')
}

const handleAnnotationSave = () => {
  if (annotationCanvasRef.value) {
    annotationCanvasRef.value.saveCanvas()
  }
  addLog('批注已保存')
  ElMessage.success('批注已保存')
}

const handleAnnotationStart = () => {
  addLog('开始批注...')
}

const handleAnnotationEnd = () => {
  addLog('批注完成')
}

// 日志
const logs = ref([
  { time: new Date().toLocaleTimeString(), message: '系统已初始化', type: 'info' },
  { time: new Date().toLocaleTimeString(), message: '等待检测开始...', type: 'info' }
])
const logContent = ref(null)

const addLog = (message, type = 'info') => {
  const time = new Date().toLocaleTimeString()
  logs.value.push({ time, message, type })
  if (logs.value.length > 100) {
    logs.value.shift()
  }
  nextTick(() => {
    if (logContent.value) {
      logContent.value.scrollTop = logContent.value.scrollHeight
    }
  })
}

const clearLogs = () => {
  logs.value = []
  addLog('日志已清除')
}

const getLogClass = (log) => {
  return {
    'log-error': log.type === 'error',
    'log-warn': log.type === 'warn',
    'log-success': log.type === 'success'
  }
}

// 导出数据
const exportData = async () => {
  try {
    const exportData = {
      exportTime: new Date().toISOString(),
      config: visionConfig,
      results: detectionResults.value,
      summary: {
        totalDetections: detectionResults.value.length,
        avgAttention: attentionScore.value,
        attentionDistribution: {
          high: highPercentage.value,
          medium: mediumPercentage.value,
          low: lowPercentage.value
        }
      }
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vision-analysis-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)

    addLog('数据已导出')
    ElMessage.success('分析数据已导出')
  } catch (error) {
    console.error('[VisionAnalysis] 导出失败:', error)
    ElMessage.error('导出失败')
  }
}

// 覆盖层画布
const mainDisplayRef = ref(null)
const videoLayerRef = ref(null)
const overlayCanvasRef = ref(null)

const initOverlayCanvas = () => {
  if (overlayCanvasRef.value && videoLayerRef.value) {
    const rect = videoLayerRef.value.getBoundingClientRect()
    overlayCanvasRef.value.width = rect.width
    overlayCanvasRef.value.height = rect.height
  }
}

const drawOverlay = () => {
  if (!overlayCanvasRef.value) return

  const canvas = overlayCanvasRef.value
  const ctx = canvas.getContext('2d')

  // 清空画布
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // 绘制人脸框
  faces.value.forEach((face, index) => {
    if (face.boundingBox) {
      const { x, y, width, height } = face.boundingBox
      ctx.strokeStyle = '#00FF00'
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, width, height)

      // 绘制标签
      ctx.fillStyle = 'rgba(0, 255, 0, 0.8)'
      ctx.fillRect(x, y - 25, 80, 25)
      ctx.fillStyle = '#000'
      ctx.font = '14px Arial'
      ctx.fillText(`人脸 ${index + 1} ${(face.confidence * 100).toFixed(0)}%`, x + 5, y - 7)
    }
  })

  // 绘制物体框
  objects.value.forEach((obj, index) => {
    if (obj.bbox) {
      const { x, y, width, height } = obj.bbox
      ctx.strokeStyle = '#FF00FF'
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, width, height)

      // 绘制标签
      ctx.fillStyle = 'rgba(255, 0, 255, 0.8)'
      ctx.fillRect(x, y - 25, 100, 25)
      ctx.fillStyle = '#000'
      ctx.font = '14px Arial'
      ctx.fillText(`${obj.label} ${(obj.confidence * 100).toFixed(0)}%`, x + 5, y - 7)
    }
  })
}

// 工具函数
const generateHash = (str) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16).padStart(16, '0').substring(0, 16)
}

// 窗口大小变化时重新调整画布
const handleResize = () => {
  nextTick(() => {
    initOverlayCanvas()
  })
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  stopDetection()
  stopCamera()
})
</script>

<style lang="scss" scoped>
.web-functions-view {
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.title-bar {
  height: 40px;
  min-height: 40px;
  background: #1B263B;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  -webkit-app-region: drag;
  flex-shrink: 0;

  .title {
    color: #E0E1DD;
    font-size: 14px;
    font-weight: 500;
  }

  .window-controls {
    display: flex;
    gap: 8px;
    -webkit-app-region: no-drag;
    flex-shrink: 0;

    .control-btn {
      width: 32px;
      height: 32px;
      min-width: 32px;
      min-height: 32px;
      border: none;
      background: #415A77;
      color: #E0E1DD;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;

      &:hover {
        background: #778DA9;
      }

      &.close:hover {
        background: #E63946;
      }
    }
  }
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 40px;

  .header {
    text-align: center;
    margin-bottom: 40px;

    h1 {
      color: #FFFFFF;
      font-size: 36px;
      margin: 0 0 16px;
      text-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
    }

    .subtitle {
      color: #A8A8A8;
      font-size: 18px;
      margin: 0;
    }
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 24px;
    margin-bottom: 40px;
  }

  .feature-card {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    border-radius: 16px;
    padding: 24px;
    border: 2px solid transparent;
    transition: all 0.3s;

    &:hover {
      border-color: #4A90E2;
      transform: translateY(-4px);
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3);
    }

    &.active {
      border-color: #E63946;
      background: rgba(230, 57, 70, 0.1);
    }

    .card-icon {
      font-size: 64px;
      margin-bottom: 16px;
      text-align: center;
    }

    .card-content {
      h2 {
        color: #FFFFFF;
        font-size: 20px;
        margin: 0 0 12px;
      }

      p {
        color: #A8A8A8;
        font-size: 14px;
        line-height: 1.6;
        margin-bottom: 20px;
        min-height: 60px;
      }

      .card-actions {
        display: flex;
        gap: 12px;
      }
    }

    &.student-training .card-icon { color: #4A90E2; }
    &.teacher-management .card-icon { color: #00BFFF; }
    &.vision-analysis .card-icon { color: #E63946; }
    &.api-test .card-icon { color: #FACC15; }
    &.system-home .card-icon { color: #4ADE80; }
    &.service-status .card-icon { color: #00D9FF; }
  }

  .info-section {
    margin-top: 40px;

    h2 {
      color: #FFFFFF;
      font-size: 28px;
      margin-bottom: 24px;
      text-align: center;
    }

    .info-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
    }

    .info-card {
      background: rgba(255, 255, 255, 0.03);
      border-radius: 12px;
      padding: 20px;

      h3 {
        color: #4A90E2;
        font-size: 18px;
        margin: 0 0 16px;
      }

      ul {
        list-style: none;
        padding: 0;
        margin: 0;

        li {
          color: #E0E1DD;
          font-size: 14px;
          padding: 8px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);

          &:before {
            content: "▸";
            color: #4A90E2;
            margin-right: 8px;
          }

          &:last-child {
            border-bottom: none;
          }
        }
      }
    }
  }
}

.analysis-panel-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #0D1B2A;
}

.analysis-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: #1B263B;
  border-bottom: 1px solid #2D4A6F;

  .mode-toggle {
    display: flex;
    gap: 8px;

    .mode-btn {
      padding: 8px 16px;
      background: #415A77;
      border: none;
      border-radius: 4px;
      color: #E0E1DD;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: #778DA9;
      }

      &.active {
        background: #4A90E2;
      }
    }
  }

  .camera-controls {
    .camera-btn {
      padding: 8px 16px;
      background: #415A77;
      border: none;
      border-radius: 4px;
      color: #E0E1DD;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: #778DA9;
      }

      &.active {
        background: #10B981;
      }
    }
  }
}

.back-btn {
  padding: 8px 16px;
  background: #415A77;
  border: none;
  border-radius: 4px;
  color: #E0E1DD;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #778DA9;
  }
}

.analysis-title {
  font-size: 16px;
  font-weight: 600;
  color: #E0E1DD;
  margin: 0;
}

// YOLO 双模式状态样式
.yolo-mode-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  font-size: 13px;
  color: #E0E1DD;

  .status-item {
    display: flex;
    align-items: center;
    gap: 4px;

    &.mode {
      color: #67C23A;
      font-weight: 500;
    }
  }

  .status-icon {
    font-size: 14px;
  }

  .status-divider {
    color: #778DA9;
  }

  .reload-btn {
    margin-left: 8px;
  }
}

.analysis-content-wrapper {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.control-panel {
  width: 260px;
  background: #1B263B;
  padding: 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.control-section {
  background: #0F2035;
  border-radius: 6px;
  padding: 10px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: #778DA9;
  margin-bottom: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;

  &.未开启 { background: #6B7280; color: #fff; }
  &.运行中 { background: #10B981; color: #fff; }
  &.已停止 { background: #EF4444; color: #fff; }
}

.config-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
  color: #E0E1DD;

  input[type="checkbox"] {
    width: 14px;
    height: 14px;
    cursor: pointer;
  }
}

.source-btn {
  width: 100%;
  padding: 8px 10px;
  margin-bottom: 6px;
  background: #1E3A5F;
  border: 1px solid #2D4A6F;
  border-radius: 4px;
  color: #E0E1DD;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #2D4A6F;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.small {
    padding: 5px 8px;
    font-size: 10px;
  }
}

.url-input-wrapper {
  margin-top: 6px;
}

.url-input {
  width: 100%;
  padding: 6px 8px;
  margin-bottom: 6px;
  background: #0F2035;
  border: 1px solid #2D4A6F;
  border-radius: 4px;
  color: #E0E1DD;
  font-size: 10px;
  box-sizing: border-box;
}

.detection-commands {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .cmd-btn {
    padding: 8px 10px;
    background: transparent;
    border: 1px solid #2D4A6F;
    border-radius: 4px;
    color: #A0AEC0;
    font-size: 11px;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 6px;

    &:hover {
      background: #1E3A5F;
      color: #E0E1DD;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

.interval-slider {
  display: flex;
  align-items: center;
  gap: 10px;

  input[type="range"] {
    flex: 1;
    height: 4px;
    background: #2D4A6F;
    border-radius: 2px;
    cursor: pointer;
  }

  .interval-value {
    font-size: 11px;
    color: #10B981;
    min-width: 50px;
    text-align: right;
  }
}

.action-btn {
  width: 100%;
  padding: 10px;
  margin-bottom: 8px;
  border: none;
  border-radius: 4px;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;

  &:hover {
    opacity: 0.9;
  }

  &.stop-btn { background: #EF4444; }
  &.export-btn { background: #3B82F6; }
  &.confirm-btn { background: #F59E0B; }
  &.data-btn { background: #3B82F6; }
  &.annotation-btn { background: #8B5CF6; }
  &.annotation-btn.active { background: #10B981; }
}

.btn-icon {
  font-size: 14px;
}

.status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;

  .status-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    background: #1B263B;
    border-radius: 4px;

    .status-label {
      font-size: 10px;
      color: #778DA9;
    }

    .status-value {
      font-size: 16px;
      font-weight: 600;
      color: #E0E1DD;

      &.attention {
        &.high { color: #10B981; }
        &.medium { color: #F59E0B; }
        &.low { color: #EF4444; }
      }
    }
  }
}

.log-section {
  flex: 1;
  min-height: 100px;
  display: flex;
  flex-direction: column;

  .clear-log-btn {
    font-size: 10px;
    padding: 2px 6px;
    background: transparent;
    border: 1px solid #2D4A6F;
    border-radius: 3px;
    color: #778DA9;
    cursor: pointer;

    &:hover {
      background: #1E3A5F;
    }
  }
}

.log-content {
  flex: 1;
  overflow-y: auto;
  font-size: 10px;
  max-height: 150px;
}

.log-item {
  margin-bottom: 4px;
  color: #778DA9;
  display: flex;
  gap: 8px;

  .log-time {
    color: #415A77;
    flex-shrink: 0;
  }

  &.log-error {
    color: #EF4444;
  }

  &.log-warn {
    color: #F59E0B;
  }

  &.log-success {
    color: #10B981;
  }
}

// 实验评分相关样式
.experiment-commands {
  display: flex;
  flex-direction: column;
  gap: 6px;

  .exp-cmd-btn {
    padding: 8px 10px;
    background: #1E3A5F;
    border: 1px solid #2D4A6F;
    border-radius: 4px;
    color: #E0E1DD;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;

    &:hover {
      background: #2D4A6F;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

.experiment-status-section {
  .experiment-status-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;

    .exp-status-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      background: #1B263B;
      border-radius: 4px;
      font-size: 11px;
      color: #778DA9;

      &.completed {
        background: rgba(16, 185, 129, 0.1);
        color: #10B981;
      }

      &.error {
        background: rgba(239, 68, 68, 0.1);
        color: #EF4444;
      }

      .exp-status-icon {
        font-size: 14px;
      }

      .exp-status-text {
        flex: 1;
      }

      .exp-status-badge {
        font-size: 14px;
      }

      .exp-status-value {
        font-weight: 600;
      }
    }
  }

  .experiment-progress {
    .progress-label {
      font-size: 10px;
      color: #778DA9;
      margin-bottom: 6px;
    }

    .progress-bar-wrapper {
      height: 6px;
      background: #2D4A6F;
      border-radius: 3px;
      overflow: hidden;

      .progress-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #4A90E2, #10B981);
        transition: width 0.3s;
      }
    }

    .progress-text {
      font-size: 12px;
      color: #E0E1DD;
      text-align: right;
      margin-top: 4px;
    }
  }
}

.cmd-btn {
  &.success {
    background: #10B981;
    border-color: #10B981;
  }

  &.danger {
    background: #EF4444;
    border-color: #EF4444;
  }
}

.action-btn {
  &.confirm-btn { background: #F59E0B; }
  &.reset-btn { background: #6366F1; }
}

.main-display {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 10px;
  gap: 10px;
  overflow: hidden;
  position: relative;
}

.video-layer {
  flex: 1;
  position: relative;
  background: #0a0a0f;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;

  .main-video {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .main-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .video-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: #415A77;

    .placeholder-icon {
      font-size: 64px;
    }

    .placeholder-text {
      font-size: 18px;
    }

    .placeholder-hint {
      font-size: 12px;
    }
  }

  .overlay-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .annotation-layer {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 100;

    .annotation-canvas-layer {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }
  }
}

.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background: #1B263B;
  border-radius: 6px;
  border: 2px solid #06B6D4;

  .status-left {
    .waiting-text {
      font-size: 16px;
      font-weight: 600;
      color: #06B6D4;
    }
  }

  .status-right {
    .attention-indicator {
      display: flex;
      align-items: center;
      gap: 10px;

      .indicator-icon {
        font-size: 18px;
      }

      .indicator-value {
        font-size: 14px;
        font-weight: 600;
        color: #E0E1DD;
      }

      .attention-bar {
        width: 100px;
        height: 8px;
        background: #2D4A6F;
        border-radius: 4px;
        overflow: hidden;

        .attention-fill {
          height: 100%;
          background: #10B981;
          transition: width 0.3s;
        }
      }

      &.high .attention-fill { background: #10B981; }
      &.medium .attention-fill { background: #F59E0B; }
      &.low .attention-fill { background: #EF4444; }
    }
  }
}

.playback-bar {
  background: #1B263B;
  border-radius: 6px;
  padding: 10px 15px;
  display: flex;
  align-items: center;
  gap: 15px;

  .timestamp {
    font-size: 11px;
    color: #778DA9;
    min-width: 50px;
  }

  .progress-bar {
    flex: 1;
    height: 6px;
    background: #2D4A6F;
    border-radius: 3px;
    position: relative;
    cursor: pointer;

    .progress-fill {
      height: 100%;
      background: #06B6D4;
      border-radius: 3px;
    }

    .progress-thumb {
      position: absolute;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 14px;
      height: 14px;
      background: #06B6D4;
      border-radius: 50%;
      border: 2px solid #fff;
    }
  }

  .playback-controls {
    display: flex;
    gap: 8px;

    .control-btn {
      width: 32px;
      height: 32px;
      background: #2D4A6F;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;

      &:hover {
        background: #3D5A8F;
      }

      &.play-btn {
        width: 40px;
        height: 40px;
        background: #06B6D4;
        font-size: 16px;
      }
    }

    .volume-slider {
      width: 80px;
      height: 4px;
      background: #2D4A6F;
      border-radius: 2px;
      cursor: pointer;
    }
  }

  .video-info {
    .file-hash {
      font-size: 10px;
      color: #4B5563;
      font-family: monospace;
    }
  }
}

.result-panel {
  width: 320px;
  background: #1B263B;
  padding: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #E0E1DD;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #2D4A6F;
}

.attention-overview {
  background: #0F2035;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;

  .attention-score {
    text-align: center;
    margin-bottom: 12px;

    .score-label {
      font-size: 12px;
      color: #778DA9;
      margin-bottom: 4px;
    }

    .score-value {
      font-size: 48px;
      font-weight: 700;
      line-height: 1;

      &.high { color: #10B981; }
      &.medium { color: #F59E0B; }
      &.low { color: #EF4444; }
    }

    .score-level {
      font-size: 12px;
      color: #778DA9;
      margin-top: 4px;
    }
  }

  .attention-chart {
    .chart-bar {
      display: flex;
      height: 8px;
      border-radius: 4px;
      overflow: hidden;
      background: #2D4A6F;

      .chart-fill {
        height: 100%;
        transition: width 0.3s;

        &.high { background: #10B981; }
        &.medium { background: #F59E0B; }
        &.low { background: #EF4444; }
      }
    }

    .chart-legend {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
      font-size: 10px;

      .legend-item {
        &.high { color: #10B981; }
        &.medium { color: #F59E0B; }
        &.low { color: #EF4444; }
      }
    }
  }
}

.result-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.empty-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #778DA9;

  .empty-icon {
    font-size: 32px;
    margin-bottom: 10px;
  }

  p {
    font-size: 12px;
    margin: 0;
  }

  .empty-hint {
    font-size: 10px;
    margin-top: 4px;
  }
}

.result-item {
  background: #0F2035;
  border-radius: 6px;
  padding: 10px;

  .result-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid #1B263B;

    .result-time {
      font-size: 10px;
      color: #415A77;
    }

    .result-badge {
      font-size: 10px;
      padding: 2px 6px;
      background: #1B263B;
      border-radius: 3px;
      color: #778DA9;
    }
  }

  .result-section {
    margin-bottom: 8px;

    &:last-child {
      margin-bottom: 0;
    }

    .result-section-title {
      font-size: 11px;
      font-weight: 600;
      color: #4A90E2;
      margin-bottom: 6px;
    }

    .face-item, .object-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      font-size: 10px;

      .face-label, .object-label {
        color: #E0E1DD;
      }

      .face-confidence, .object-confidence {
        color: #10B981;
      }

      .face-bbox {
        color: #778DA9;
        font-size: 9px;
      }
    }

    .attention-item {
      display: flex;
      align-items: center;
      gap: 8px;

      .attention-bar-mini {
        flex: 1;
        height: 6px;
        background: #2D4A6F;
        border-radius: 3px;
        overflow: hidden;

        .attention-fill-mini {
          height: 100%;
          background: #10B981;
        }
      }

      .attention-value {
        font-size: 12px;
        font-weight: 600;
        color: #10B981;
        min-width: 40px;
        text-align: right;
      }
    }

    .emotion-item {
      display: flex;
      gap: 8px;

      .emotion-face {
        font-size: 16px;
      }

      .emotion-bars {
        flex: 1;

        .emotion-bar-row {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-bottom: 4px;

          .emotion-name {
            font-size: 10px;
            color: #E0E1DD;
            width: 40px;
          }

          .emotion-bar-bg {
            flex: 1;
            height: 6px;
            background: #2D4A6F;
            border-radius: 3px;
            overflow: hidden;

            .emotion-bar-fill {
              height: 100%;
              background: #8B5CF6;
            }
          }

          .emotion-value {
            font-size: 10px;
            color: #778DA9;
            width: 30px;
            text-align: right;
          }
        }
      }
    }
  }
}

@media (max-width: 1400px) {
  .main-content .features-grid {
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
  }

  .main-content .info-cards {
    grid-template-columns: 1fr;
  }

  .control-panel {
    width: 220px;
  }

  .result-panel {
    width: 280px;
  }
}

@media (max-width: 768px) {
  .main-content {
    padding: 20px;
  }

  .main-content .header h1 {
    font-size: 28px;
  }

  .main-content .features-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .analysis-content-wrapper {
    flex-direction: column;
  }

  .control-panel {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
    overflow-x: auto;
  }

  .result-panel {
    width: 100%;
  }
}

// 实验评分主显示区
.experiment-title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: #1B263B;
  border-radius: 8px;
  border: 2px solid #06B6D4;

  .experiment-title {
    font-size: 18px;
    font-weight: 600;
    color: #06B6D4;
  }

  .final-score-display {
    display: flex;
    align-items: center;
    gap: 12px;

    .score-label {
      font-size: 14px;
      color: #778DA9;
    }

    .score-value {
      font-size: 36px;
      font-weight: 700;

      &.high { color: #10B981; }
      &.medium { color: #F59E0B; }
      &.low { color: #EF4444; }
    }
  }
}

.experiment-video-section {
  flex: 1;
  display: flex;
  gap: 10px;
  min-height: 0;

  .experiment-video-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #1B263B;
    border-radius: 8px;
    overflow: hidden;

    .video-label {
      padding: 8px 12px;
      background: #0F2035;
      font-size: 12px;
      color: #778DA9;
      text-align: center;
    }

    .video-wrapper {
      flex: 1;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;

      .experiment-video {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }

      .experiment-overlay-canvas {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }

      .video-placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        color: #415A77;
        font-size: 14px;
      }
    }
  }
}

.deduction-panel {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  padding: 12px;

  .deduction-title {
    font-size: 12px;
    color: #EF4444;
    margin-bottom: 8px;
  }

  .deduction-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    .deduction-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 4px;
      font-size: 11px;

      .deduction-icon {
        color: #EF4444;
      }

      .deduction-text {
        color: #E0E1DD;
      }

      .deduction-score {
        color: #EF4444;
        font-weight: 600;
      }
    }
  }
}

.experiment-playback {
  background: #1B263B;
}

// 实验评分结果面板
.experiment-score-overview {
  text-align: center;
  padding: 20px;
  background: #0F2035;
  border-radius: 8px;
  margin-bottom: 12px;

  .exp-score-circle {
    position: relative;
    width: 100px;
    height: 100px;
    margin: 0 auto 12px;

    svg {
      width: 100%;
      height: 100%;
    }

    .exp-score-value {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 32px;
      font-weight: 700;
      color: #E0E1DD;
    }
  }

  .exp-score-label {
    font-size: 14px;
    color: #778DA9;
  }
}

.experiment-steps-list {
  background: #0F2035;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;

  .steps-title {
    font-size: 12px;
    color: #778DA9;
    margin-bottom: 10px;
  }

  .step-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    margin-bottom: 6px;
    background: #1B263B;
    border-radius: 4px;
    font-size: 12px;

    &:last-child {
      margin-bottom: 0;
    }

    &.completed {
      background: rgba(16, 185, 129, 0.1);
    }

    &.failed {
      background: rgba(239, 68, 68, 0.1);
    }

    .step-icon {
      font-size: 14px;
    }

    .step-name {
      flex: 1;
      color: #E0E1DD;
    }

    .step-score {
      color: #778DA9;
    }
  }
}

.experiment-result-content {
  flex: 1;
  overflow-y: auto;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;

  .action-icon {
    font-size: 16px;
  }

  .action-text {
    font-size: 12px;
    color: #E0E1DD;
  }
}
</style>
