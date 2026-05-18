/**
 * 教师端 - 智能视觉分析窗口
 *
 * 功能整合：
 * 1. 🔬 检测模式：YOLO物体检测、人脸检测、专注度分析
 * 2. 🔥 火焰检测：火焰/烟雾实时检测报警
 * 3. 🎯 考试管理：考试任务、学生管理、视频上传、智能评判
 * 4. 📋 任务管理：创建和管理考试任务
 * 5. 🔧 实训管理：管理实训项目
 */

<template>
  <div class="vision-analysis-window">
    <!-- 🔥 火焰/烟雾报警弹窗 -->
    <el-dialog
      v-model="showFireAlarmDialog"
      title="⚠️ 危险警报"
      width="500px"
      :close-on-click-modal="false"
      :show-close="false"
      class="alarm-dialog"
    >
      <div class="alarm-content">
        <div class="alarm-icon">
          <span v-if="fireAlarmType === 'fire'">🔥</span>
          <span v-else>💨</span>
        </div>
        <div class="alarm-info">
          <h2>{{ fireAlarmType === 'fire' ? '检测到火焰！' : '检测到烟雾！' }}</h2>
          <p>{{ fireAlarmType === 'fire' ? '请立即检查现场，确认是否有火灾风险' : '请检查是否有烟雾产生，确认安全' }}</p>
          <p class="alarm-time">检测时间: {{ fireAlarmTime }}</p>
        </div>
        <el-alert
          :title="fireAlarmType === 'fire' ? '火灾风险警告' : '烟雾警告'"
          :type="fireAlarmType === 'fire' ? 'error' : 'warning'"
          :closable="false"
          show-icon
        />
      </div>
      <template #footer>
        <el-button type="danger" @click="showFireAlarmDialog = false">
          我已知悉，继续监控
        </el-button>
      </template>
    </el-dialog>

    <!-- 顶部栏 -->
    <div class="top-bar">
      <div class="title-section">
        <h1 class="main-title">🤖 智能视觉分析</h1>
        <span class="subtitle">YOLO检测 + 考试评判 + 实训管理</span>
      </div>

      <div class="mode-tabs">
        <button
          v-for="mode in modes"
          :key="mode.key"
          :class="['mode-tab', { active: currentMode === mode.key }]"
          @click="currentMode = mode.key"
        >
          <span class="mode-icon">{{ mode.icon }}</span>
          <span class="mode-label">{{ mode.label }}</span>
        </button>
      </div>

      <div class="top-actions">
        <button class="action-btn" @click="handleMinimize" title="最小化">
          <span>─</span>
        </button>
        <button class="action-btn close-btn" @click="handleClose" title="关闭">
          <span>✕</span>
        </button>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="main-content">
      <!-- 左侧：视频预览 -->
      <div class="video-section">
        <div class="video-container" ref="videoContainer" @dragover.prevent @drop.prevent="handleCameraDrop">
          <!-- 视频/图片显示 -->
          <img
            v-if="sourceType === 'image' && sourceUrl"
            :src="sourceUrl"
            class="source-image"
            ref="sourceImage"
          />
           <video
             v-else-if="(sourceType === 'camera' && cameraStream) || (sourceType === 'video' && sourceUrl)"
             ref="sourceVideo"
             class="source-video"
             autoplay
             playsinline
             :muted="sourceType === 'camera'"
             :src="sourceType === 'video' ? sourceUrl : null"
             :src-object="sourceType === 'camera' ? cameraStream : null"
             @loadedmetadata="onVideoLoaded"
             @canplay="onVideoCanPlay"
             @play="onVideoPlay"
             @pause="onVideoPause"
             @error="onVideoError"
           ></video>

          <!-- 摄像头占位 -->
          <div v-else class="video-placeholder">
            <div class="placeholder-content">
              <span class="placeholder-icon">📹</span>
              <p>{{ placeholderText }}</p>
            </div>
          </div>

          <!-- 检测结果画布 -->
          <canvas ref="canvasOverlay" class="detection-overlay"></canvas>

          <!-- 专注度指示器 -->
          <div v-if="showFocusIndicator && focusScore !== null" class="focus-indicator">
            <div class="focus-label">专注度</div>
            <div class="focus-bar">
              <div class="focus-fill" :style="{ width: focusScore + '%', background: getFocusColor(focusScore) }"></div>
            </div>
            <div class="focus-value" :style="{ color: getFocusColor(focusScore) }">{{ focusScore }}%</div>
          </div>

          <!-- 考试评判标注 -->
          <div v-if="currentMode === 'exam'" class="exam-overlay">
            <div class="exam-timer" v-if="isExamRunning">
              <span class="timer-icon">⏱️</span>
              <span>{{ formatTime(examTime) }}</span>
            </div>

            <div class="exam-step-info" v-if="currentExamStep">
              <div class="step-name">{{ currentExamStep.name }}</div>
              <div class="step-score">+{{ currentExamStep.score }}分</div>
            </div>
          </div>
        </div>

        <!-- 视频控制栏 -->
        <div class="video-controls">
          <div class="source-selector">
            <button
              :class="['source-btn', { active: sourceType === 'camera' }]"
              @click="selectSource('camera')"
            >
              📷 摄像头
            </button>
            <button
              :class="['source-btn', { active: sourceType === 'video' }]"
              @click="selectSource('video')"
            >
              🎬 视频
            </button>
            <button
              :class="['source-btn', { active: sourceType === 'image' }]"
              @click="selectSource('image')"
            >
              🖼️ 图片
            </button>
          </div>

          <div class="control-actions">
            <button
              v-if="(currentMode === 'detection' || currentMode === 'fireDetection') && isDetecting"
              class="control-btn danger"
              @click="stopDetection"
            >
              ⏹️ 停止检测
            </button>
            <button
              v-else-if="sourceUrl && (currentMode === 'detection' || currentMode === 'fireDetection')"
              class="control-btn primary"
              @click="startDetection"
            >
              🔍 开始{{ currentMode === 'fireDetection' ? '火焰' : '' }}检测
            </button>

            <button
              v-if="currentMode === 'exam' && sourceUrl"
              :class="['control-btn', examStartBtnClass]"
              @click="toggleExam"
            >
              {{ examStartBtnText }}
            </button>
          </div>
        </div>
      </div>

      <!-- 右侧：控制面板 -->
      <div class="control-panel">
        <!-- 🔬 检测模式 -->
        <div v-if="currentMode === 'detection'" class="panel-section">
          <div class="section-header">
            <h3>🔬 YOLO检测配置</h3>
          </div>

          <!-- 检测类型 -->
          <div class="config-group">
            <label class="config-label">检测类型</label>
            <div class="checkbox-group">
              <label class="checkbox-item">
                <input type="checkbox" v-model="detectionConfig.detectObjects" />
                <span>物体检测</span>
              </label>
              <label class="checkbox-item">
                <input type="checkbox" v-model="detectionConfig.detectFaces" />
                <span>人脸检测</span>
              </label>
              <label class="checkbox-item">
                <input type="checkbox" v-model="detectionConfig.analyzeFocus" />
                <span>专注度分析</span>
              </label>
            </div>
          </div>

          <!-- 置信度阈值 -->
          <div class="config-group">
            <label class="config-label">置信度阈值: {{ detectionConfig.confidenceThreshold }}</label>
            <input
              type="range"
              v-model.number="detectionConfig.confidenceThreshold"
              min="0.1"
              max="1"
              step="0.05"
              class="slider"
            />
          </div>

          <!-- 实时检测结果 -->
          <div class="section-header">
            <h3>📊 实时检测结果</h3>
          </div>

          <div class="detection-results" v-if="detections.length > 0">
            <div v-for="(det, index) in detections.slice(0, 10)" :key="index" class="detection-item">
              <span class="det-class">{{ det.class }}</span>
              <span class="det-confidence">{{ (det.confidence * 100).toFixed(1) }}%</span>
            </div>
          </div>
          <div v-else class="empty-results">
            <p>暂无检测结果</p>
          </div>

          <!-- 专注度分析 -->
          <div v-if="detectionConfig.analyzeFocus && focusHistory.length > 0" class="focus-analysis">
            <div class="section-header">
              <h3>📈 专注度趋势</h3>
            </div>
            <div class="focus-chart">
              <div
                v-for="(score, index) in focusHistory.slice(-20)"
                :key="index"
                :class="['focus-bar-item', { low: score < 50 }]"
                :style="{ height: score + '%' }"
              ></div>
            </div>
            <div class="focus-summary">
              <span>平均: {{ averageFocus.toFixed(1) }}%</span>
              <span>最低: {{ Math.min(...focusHistory).toFixed(1) }}%</span>
            </div>
          </div>
        </div>

        <!-- 🔥 火焰/烟雾检测模式 -->
        <div v-if="currentMode === 'fireDetection'" class="panel-section">
          <div class="section-header">
            <h3>🔥 火焰/烟雾检测配置</h3>
          </div>

          <!-- 检测开关 -->
          <div class="config-group">
            <label class="config-label">检测选项</label>
            <div class="checkbox-group">
              <label class="checkbox-item">
                <input type="checkbox" v-model="fireDetectionConfig.enableFire" />
                <span>🔥 火焰检测</span>
              </label>
              <label class="checkbox-item">
                <input type="checkbox" v-model="fireDetectionConfig.enableSmoke" />
                <span>💨 烟雾检测</span>
              </label>
              <label class="checkbox-item">
                <input type="checkbox" v-model="fireDetectionConfig.enableAlarmSound" />
                <span>🔔 报警声音</span>
              </label>
              <label class="checkbox-item">
                <input type="checkbox" v-model="fireDetectionConfig.aiEnhance" />
                <span>🤖 AI增强</span>
              </label>
            </div>
          </div>

          <!-- 检测间隔 -->
          <div class="config-group">
            <label class="config-label">检测间隔: {{ fireDetectionConfig.detectionInterval }}ms</label>
            <input
              type="range"
              v-model.number="fireDetectionConfig.detectionInterval"
              min="200"
              max="2000"
              step="100"
              class="slider"
            />
          </div>

          <!-- 检测结果 -->
          <div class="section-header">
            <h3>📊 实时检测结果</h3>
          </div>

          <div class="detection-results" v-if="fireDetections.length > 0">
            <div v-for="(det, index) in fireDetections.slice(0, 10)" :key="index" class="detection-item">
              <span class="det-class">{{ det.category }}</span>
              <span class="det-confidence">{{ (det.confidence * 100).toFixed(0) }}%</span>
              <el-tag :type="det.source === 'ai' ? 'warning' : 'info'" size="small">
                {{ det.source === 'ai' ? 'AI' : '颜色' }}
              </el-tag>
            </div>
          </div>
          <div v-else class="empty-results">
            <p>暂无火焰/烟雾检测结果</p>
          </div>

          <!-- 报警历史 -->
          <div class="section-header" style="margin-top: 10px">
            <h3>⚠️ 报警历史</h3>
          </div>
          <div class="alarm-history">
            <div v-if="alarmHistory.length === 0" class="empty-results">
              暂无报警记录
            </div>
            <div v-for="(alarm, index) in alarmHistory" :key="index" class="alarm-item">
              <span class="alarm-icon">{{ alarm.type === 'fire' ? '🔥' : '💨' }}</span>
              <span class="alarm-type">{{ alarm.type === 'fire' ? '火焰' : '烟雾' }}</span>
              <span class="alarm-time">{{ alarm.time }}</span>
            </div>
          </div>
        </div>

        <!-- 🎯 考试管理模式 -->
        <div v-if="currentMode === 'exam'" class="panel-section">
          <!-- 考试标签页 -->
          <el-tabs v-model="examTab" class="exam-tabs">
            <!-- 考试列表 -->
            <el-tab-pane label="📝 考试列表" name="list">
              <div class="exam-list">
                <div class="exam-item" v-for="exam in examList" :key="exam.id">
                  <div class="exam-info">
                    <h4>{{ exam.title }}</h4>
                    <p>{{ exam.subject }} | {{ exam.duration }}分钟 | {{ exam.totalScore }}分</p>
                    <p class="exam-deadline">截止: {{ exam.deadline }}</p>
                  </div>
                  <div class="exam-actions">
                    <el-tag :type="getExamStatusType(exam.status)">{{ exam.status }}</el-tag>
                    <button class="exam-btn" @click="viewExamDetails(exam)">详情</button>
                    <button class="exam-btn primary" @click="startExamEvaluation(exam)">开始评判</button>
                  </div>
                </div>

                <button class="add-exam-btn" @click="showCreateExamDialog = true">
                  ➕ 创建新考试
                </button>
              </div>
            </el-tab-pane>

            <!-- 学生管理 -->
            <el-tab-pane label="👥 学生管理" name="students">
              <div class="students-panel">
                <div class="panel-toolbar">
                  <el-input v-model="studentSearch" placeholder="搜索学生" prefix-icon="Search" clearable />
                  <el-button type="primary" @click="showAddStudentDialog = true">添加学生</el-button>
                </div>

                <el-table :data="filteredStudents" size="small">
                  <el-table-column prop="name" label="姓名" width="100" />
                  <el-table-column prop="id" label="学号" width="100" />
                  <el-table-column prop="status" label="状态" width="80">
                    <template #default="{ row }">
                      <el-tag size="small" :type="row.status === 'online' ? 'success' : 'info'">
                        {{ row.status === 'online' ? '在线' : '离线' }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="examStatus" label="考试状态" width="100">
                    <template #default="{ row }">
                      <el-tag size="small" :type="getExamStatusTagType(row.examStatus)">
                        {{ row.examStatus }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="100">
                    <template #default="{ row }">
                      <button class="small-btn" @click="viewStudentExam(row)">查看</button>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </el-tab-pane>

            <!-- 视频上传 -->
            <el-tab-pane label="📤 视频管理" name="uploads">
              <div class="uploads-panel">
                <div class="upload-dropzone" @dragover.prevent @drop.prevent="handleFileDrop">
                  <span class="upload-icon">📁</span>
                  <p>拖拽视频文件到此处上传</p>
                  <p class="upload-hint">或点击选择文件</p>
                  <input type="file" accept="video/*" @change="handleFileSelect" hidden ref="fileInput" />
                  <el-button type="primary" @click="$refs.fileInput.click()">选择视频</el-button>
                </div>

                <div class="upload-list" v-if="uploadedVideos.length > 0">
                  <div v-for="video in uploadedVideos" :key="video.id" class="upload-item">
                    <div class="upload-info">
                      <span class="upload-name">{{ video.name }}</span>
                      <span class="upload-meta">{{ video.student }} | {{ video.uploadTime }}</span>
                    </div>
                    <div class="upload-status">
                      <el-tag size="small" :type="getUploadStatusType(video.status)">
                        {{ video.status }}
                      </el-tag>
                      <button class="small-btn" @click="evaluateVideo(video)">评判</button>
                      <button class="small-btn" @click="handlePreviewVideo(video)">预览</button>
                    </div>
                  </div>
                </div>
              </div>
            </el-tab-pane>

            <!-- 评分结果 -->
            <el-tab-pane label="📊 评分结果" name="results">
              <div class="results-panel">
                <div class="results-stats">
                  <div class="stat-card">
                    <span class="stat-value">{{ gradedCount }}</span>
                    <span class="stat-label">已评分</span>
                  </div>
                  <div class="stat-card">
                    <span class="stat-value">{{ pendingCount }}</span>
                    <span class="stat-label">待评分</span>
                  </div>
                  <div class="stat-card">
                    <span class="stat-value">{{ averageScore }}分</span>
                    <span class="stat-label">平均分</span>
                  </div>
                </div>

                <el-table :data="examResults" size="small">
                  <el-table-column prop="student" label="学生" width="100" />
                  <el-table-column prop="exam" label="考试" width="150" />
                  <el-table-column prop="submitTime" label="提交时间" width="150" />
                  <el-table-column prop="score" label="得分" width="80">
                    <template #default="{ row }">
                      <span :class="['score-value', { high: row.score >= 90, mid: row.score >= 60 && row.score < 90, low: row.score < 60 }]">
                        {{ row.score }}分
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="150">
                    <template #default="{ row }">
                      <button class="small-btn" @click="viewResultDetail(row)">详情</button>
                      <button class="small-btn" @click="exportResult(row)">导出</button>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>

        <!-- 👥 学生模式 -->
        <div v-if="currentMode === 'students'" class="panel-section">
          <div class="section-header">
            <h3>👥 学生管理</h3>
            <el-button type="primary" size="small" @click="showAddStudentDialog = true">添加学生</el-button>
          </div>

          <div class="student-search">
            <el-input v-model="studentSearch" placeholder="搜索学生..." prefix-icon="Search" clearable />
          </div>

          <div class="student-list">
            <div v-for="student in filteredStudents" :key="student.id" class="student-card">
              <div class="student-avatar">{{ student.name.charAt(0) }}</div>
              <div class="student-info">
                <h4>{{ student.name }}</h4>
                <p>学号: {{ student.id }}</p>
                <p>状态:
                  <el-tag size="small" :type="student.status === 'online' ? 'success' : 'info'">
                    {{ student.status === 'online' ? '在线' : '离线' }}
                  </el-tag>
                </p>
              </div>
              <div class="student-actions">
                <button class="small-btn" @click="viewStudentExam(student)">考试</button>
                <button class="small-btn" @click="viewStudentDetail(student)">详情</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 📋 任务模式 -->
        <div v-if="currentMode === 'tasks'" class="panel-section">
          <div class="section-header">
            <h3>📋 任务管理</h3>
            <el-button type="primary" size="small" @click="showCreateTaskDialog = true">新建任务</el-button>
          </div>

          <div class="task-list">
            <div v-for="task in taskList" :key="task.id" class="task-card">
              <div class="task-header">
                <h4>{{ task.name }}</h4>
                <el-tag size="small" :type="getTaskStatusType(task.status)">{{ task.status }}</el-tag>
              </div>
              <p class="task-desc">{{ task.description }}</p>
              <div class="task-meta">
                <span>类型: {{ task.type }}</span>
                <span>截止: {{ task.deadline }}</span>
              </div>
              <div class="task-actions">
                <button class="small-btn" @click="editTask(task)">编辑</button>
                <button class="small-btn primary" @click="publishTask(task)">发布</button>
                <button class="small-btn danger" @click="deleteTask(task)">删除</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 🔧 实训模式 -->
        <div v-if="currentMode === 'training'" class="panel-section">
          <div class="section-header">
            <h3>🔧 实训管理</h3>
            <el-button type="primary" size="small" @click="showCreateTrainingDialog = true">新建实训</el-button>
          </div>

          <div class="training-list">
            <div v-for="training in trainingList" :key="training.id" class="training-card">
              <div class="training-header">
                <h4>{{ training.name }}</h4>
                <el-tag size="small" :type="getTrainingStatusType(training.status)">{{ training.status }}</el-tag>
              </div>
              <div class="training-stats">
                <span>参与学生: {{ training.studentCount }}</span>
                <span>进度: {{ training.progress }}%</span>
              </div>
              <el-progress :percentage="training.progress" :status="getProgressStatus(training.progress)" />
              <div class="training-actions">
                <button class="small-btn" @click="viewTraining(training)">查看</button>
                <button class="small-btn primary" @click="startTraining(training)">开始</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建考试对话框 -->
    <el-dialog v-model="showCreateExamDialog" title="创建考试" width="600px">
      <el-form :model="newExam" label-width="100px">
        <el-form-item label="考试名称">
          <el-input v-model="newExam.title" placeholder="请输入考试名称" />
        </el-form-item>
        <el-form-item label="考试科目">
          <el-input v-model="newExam.subject" placeholder="请输入考试科目" />
        </el-form-item>
        <el-form-item label="时长(分钟)">
          <el-input-number v-model="newExam.duration" :min="5" :max="120" />
        </el-form-item>
        <el-form-item label="总分">
          <el-input-number v-model="newExam.totalScore" :min="10" :max="200" :step="10" />
        </el-form-item>
        <el-form-item label="截止时间">
          <el-date-picker v-model="newExam.deadline" type="datetime" placeholder="选择截止时间" />
        </el-form-item>
        <el-form-item label="考试步骤">
          <div class="steps-editor">
            <div v-for="(step, index) in newExam.steps" :key="index" class="step-row">
              <el-input-number v-model="step.score" :min="0" :max="100" size="small" />
              <el-input v-model="step.name" placeholder="步骤名称" size="small" />
              <el-input v-model="step.tool" placeholder="工具(可选)" size="small" />
              <el-button size="small" type="danger" @click="removeStep(index)">删除</el-button>
            </div>
            <el-button size="small" type="primary" @click="addStep">添加步骤</el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateExamDialog = false">取消</el-button>
        <el-button type="primary" @click="createExam">创建</el-button>
      </template>
    </el-dialog>

    <!-- 视频预览对话框 -->
    <el-dialog v-model="showVideoPreviewDialog" title="视频预览" width="800px">
      <video ref="previewVideo" class="preview-video" controls playsinline></video>
    </el-dialog>

    <!-- 评分详情对话框 -->
    <el-dialog v-model="showResultDetailDialog" title="评分详情" width="700px">
      <div v-if="selectedResult" class="result-detail">
        <div class="result-header">
          <h3>{{ selectedResult.student }} - {{ selectedResult.exam }}</h3>
          <div class="result-score">
            <span class="score-num">{{ selectedResult.score }}</span>
            <span class="score-total">/ {{ selectedResult.totalScore }}分</span>
          </div>
        </div>
        <el-divider />
        <div class="step-results">
          <h4>步骤评分</h4>
          <div v-for="(step, index) in selectedResult.stepResults" :key="index" class="step-result">
            <span class="step-num">{{ index + 1 }}</span>
            <span class="step-name">{{ step.name }}</span>
            <span class="step-score">{{ step.score }}分</span>
            <el-icon v-if="step.passed" color="#67C23A"><SuccessFilled /></el-icon>
            <el-icon v-else color="#F56C6C"><CircleCloseFilled /></el-icon>
          </div>
        </div>
        <div class="result-feedback">
          <h4>评语</h4>
          <p>{{ selectedResult.feedback || '暂无评语' }}</p>
        </div>
      </div>
    </el-dialog>

    <!-- 添加学生对话框 -->
    <el-dialog v-model="showAddStudentDialog" title="添加学生" width="400px">
      <el-form :model="newStudent" label-width="80px">
        <el-form-item label="姓名">
          <el-input v-model="newStudent.name" placeholder="请输入学生姓名" />
        </el-form-item>
        <el-form-item label="学号">
          <el-input v-model="newStudent.id" placeholder="请输入学号" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddStudentDialog = false">取消</el-button>
        <el-button type="primary" @click="addStudent">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { SuccessFilled, CircleCloseFilled } from '@element-plus/icons-vue'

const props = defineProps({
  // 外部传入的摄像头流（来自主界面信号源）
  externalCameraStream: {
    type: Object,
    default: null
  },
  // 外部传入的摄像头源信息
  externalCameraSource: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close'])

// 模式切换
const modes = [
  { key: 'detection', icon: '🔬', label: 'YOLO检测' },
  { key: 'fireDetection', icon: '🔥', label: '火焰检测' },
  { key: 'exam', icon: '🎯', label: '考试管理' },
  { key: 'students', icon: '👥', label: '学生' },
  { key: 'tasks', icon: '📋', label: '任务' },
  { key: 'training', icon: '🔧', label: '实训' }
]
const currentMode = ref('detection')

// 视频源
const sourceType = ref('camera')
const sourceUrl = ref('')
const videoContainer = ref(null)
const sourceVideo = ref(null)
const sourceImage = ref(null)
const cameraStream = ref(null)
const canvasOverlay = ref(null)
let ctx = null
let animationId = null
// 标记是否使用了外部摄像头流
const usingExternalCamera = ref(false)

// 窗口大小变化处理函数
const handleResize = () => {
  nextTick(() => {
    initCanvas()
  })
};

// 检测配置
const hasYoloModel = ref(true) // 假设模型已加载
const isDetecting = ref(false)
const detections = ref([])
const detectionConfig = reactive({
  detectObjects: true,
  detectFaces: true,
  analyzeFocus: true,
  confidenceThreshold: 0.5
})

// 🔥 火焰/烟雾检测配置
const fireDetectionConfig = reactive({
  enableFire: true,        // 火焰检测开关
  enableSmoke: true,        // 烟雾检测开关
  enableAlarmSound: true,   // 报警声音
  aiEnhance: true,          // AI增强
  detectionInterval: 500    // 检测间隔(ms)
})
const fireDetections = ref([])  // 火焰/烟雾检测结果
const showFireAlarmDialog = ref(false)
const fireAlarmType = ref('fire')  // 'fire' or 'smoke'
const fireAlarmTime = ref('')
const alarmHistory = ref([])  // 报警历史
let lastFireAlarmTime = 0
const FIRE_ALARM_COOLDOWN = 30000 // 30秒冷却
let tauriBackendAvailable = false  // Tauri后端是否可用
let fireDetectionTimer = null
let fireAiModelLoaded = ref(false)

// 专注度
const showFocusIndicator = ref(true)
const focusScore = ref(null)
const focusHistory = ref([])
const averageFocus = computed(() => {
  if (focusHistory.value.length === 0) return 0
  return focusHistory.value.reduce((a, b) => a + b, 0) / focusHistory.value.length
})

// 考试相关
const examTab = ref('list')
const examList = ref([])
const currentExam = ref(null)
const isExamRunning = ref(false)
const examTime = ref(0)
const currentExamStep = ref(null)
let examTimer = null

const examStartBtnText = computed(() => {
  if (!sourceUrl.value) return '选择视频源'
  if (isExamRunning.value) return '⏹️ 停止评判'
  return '▶️ 开始评判'
})

const examStartBtnClass = computed(() => {
  if (isExamRunning.value) return 'danger'
  return 'primary'
})

// 学生管理
const studentSearch = ref('')
const students = ref([])
const filteredStudents = computed(() => {
  if (!studentSearch.value) return students.value
  return students.value.filter(s =>
    s.name.includes(studentSearch.value) || s.id.includes(studentSearch.value)
  )
})

// 任务管理
const taskList = ref([])

// 实训管理
const trainingList = ref([])

// 视频上传
const uploadedVideos = ref([])
const fileInput = ref(null)

// 评分结果
const examResults = ref([])
const gradedCount = computed(() => examResults.value.filter(r => r.status === 'graded').length)
const pendingCount = computed(() => examResults.value.filter(r => r.status === 'pending').length)
const averageScore = computed(() => {
  const graded = examResults.value.filter(r => r.score !== null)
  if (graded.length === 0) return 0
  return (graded.reduce((a, b) => a + b.score, 0) / graded.length).toFixed(1)
})

// 对话框
const showCreateExamDialog = ref(false)
const showVideoPreviewDialog = ref(false)
const showResultDetailDialog = ref(false)
const showAddStudentDialog = ref(false)
const showCreateTaskDialog = ref(false)
const showCreateTrainingDialog = ref(false)
const previewVideo = ref(null)
const selectedResult = ref(null)

// 新建表单
const newExam = reactive({
  title: '',
  subject: '',
  duration: 15,
  totalScore: 100,
  deadline: '',
  steps: [
    { name: '', tool: '', score: 10 }
  ]
})

const newStudent = reactive({
  name: '',
  id: ''
})

// 占位文本
const placeholderText = computed(() => {
  if (sourceType.value === 'camera') return '请选择摄像头'
  if (sourceType.value === 'video') return '请选择视频文件'
  if (sourceType.value === 'image') return '请选择图片'
  return '请选择输入源'
})

// 获取专注度颜色
const getFocusColor = (score) => {
  if (score >= 80) return '#67C23A'
  if (score >= 60) return '#E6A23C'
  return '#F56C6C'
}

// 格式化时间
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// 选择视频源
const selectSource = async (type) => {
  sourceType.value = type

  if (type === 'camera') {
    // 如果有外部传入的摄像头流，优先使用
    if (props.externalCameraStream) {
      cameraStream.value = props.externalCameraStream
      usingExternalCamera.value = true
      console.log('[VisionAnalysis] 使用外部摄像头流')
      ElMessage.success('已连接到主界面摄像头')
    } else {
      // 没有外部流时，打开新摄像头
      try {
        usingExternalCamera.value = false
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        cameraStream.value = stream
        ElMessage.success('摄像头已连接')
      } catch (err) {
        console.error('摄像头访问失败:', err)
        ElMessage.error('无法访问摄像头，请检查设备和权限设置')
        // 重置为图片模式，避免界面空白
        sourceType.value = 'image'
        cameraStream.value = null
      }
    }
    // 清除视频/图片 URL
    sourceUrl.value = ''
  } else {
    // 切换到其他来源时，清除摄像头流
    cameraStream.value = null
    if (type === 'video') {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'video/*'
      input.onchange = (e) => {
        const file = e.target.files[0]
        if (file) {
          sourceUrl.value = URL.createObjectURL(file)
          ElMessage.success('视频文件已加载: ' + file.name)
        }
      }
      input.click()
    } else if (type === 'image') {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = (e) => {
        const file = e.target.files[0]
        if (file) {
          sourceUrl.value = URL.createObjectURL(file)
          nextTick(() => {
            drawImageOverlay()
          })
          ElMessage.success('图片已加载: ' + file.name)
        }
      }
      input.click()
    }
  }
}

// 处理摄像头拖拽
const handleCameraDrop = (e) => {
  const files = e.dataTransfer.files
  if (files.length > 0) {
    const file = files[0]
    if (file.type.startsWith('video/')) {
      sourceType.value = 'video'
      sourceUrl.value = URL.createObjectURL(file)
      ElMessage.success('视频文件已拖拽到画布')
    } else if (file.type.startsWith('image/')) {
      sourceType.value = 'image'
      sourceUrl.value = URL.createObjectURL(file)
      nextTick(() => {
        drawImageOverlay()
      })
      ElMessage.success('图片文件已拖拽到画布')
    } else {
      ElMessage.warning('不支持的文件类型')
    }
  } else {
    // 检查是否有摄像头流数据
    const data = e.dataTransfer.getData('application/json')
    if (data) {
      try {
        const dragData = JSON.parse(data)
        if (dragData.type === 'camera' && dragData.stream) {
          sourceType.value = 'camera'
          sourceUrl.value = dragData.stream
          usingExternalCamera.value = true
          ElMessage.success('摄像头已拖拽到画布')
        }
      } catch (err) {
        console.error('[VisionAnalysis] 拖拽数据解析失败:', err)
      }
    }
  }
}

// 视频加载完成
const onVideoLoaded = () => {
  if (sourceVideo.value) {
    console.log('[VisionAnalysis] 视频已加载，元数据:', {
      videoWidth: sourceVideo.value.videoWidth,
      videoHeight: sourceVideo.value.videoHeight
    })
    // 确保视频播放
    if (sourceVideo.value.paused) {
      sourceVideo.value.play().catch(err => {
        console.warn('[VisionAnalysis] 自动播放失败:', err)
      })
    }

    // 视频加载完成后重新初始化画布，确保尺寸正确
    nextTick(() => {
      initCanvas()
    })
  }
}

// 视频可以播放
const onVideoCanPlay = () => {
  console.log('[VisionAnalysis] 视频可以播放')
  if (sourceVideo.value) {
    // 确保视频处于播放状态
    if (sourceVideo.value.paused) {
      sourceVideo.value.play().catch(err => {
        console.warn('[VisionAnalysis] 播放失败:', err)
      })
    }

    // 重新初始化画布
    nextTick(() => {
      initCanvas()
    })
  }
}

// 视频开始播放
const onVideoPlay = () => {
  console.log('[VisionAnalysis] 视频开始播放')
}

// 视频暂停
const onVideoPause = () => {
  console.log('[VisionAnalysis] 视频暂停')
}

// 视频错误
const onVideoError = () => {
  console.error('[VisionAnalysis] 视频播放错误')
  if (sourceVideo.value) {
    console.error('[VisionAnalysis] 视频错误详细:', sourceVideo.value.error)
  }
}

// 初始化画布
const initCanvas = () => {
  if (!videoContainer.value || !canvasOverlay.value) return

  const container = videoContainer.value
  canvasOverlay.value.width = container.clientWidth
  canvasOverlay.value.height = container.clientHeight
  ctx = canvasOverlay.value.getContext('2d')
}

// 绘制检测结果
const drawDetections = () => {
  if (!ctx) return

  ctx.clearRect(0, 0, canvasOverlay.value.width, canvasOverlay.value.height)

  detections.value.forEach(det => {
    const [x1, y1, x2, y2] = det.bbox
    const w = canvasOverlay.value.width
    const h = canvasOverlay.value.height

    // 缩放坐标（如果是视频）
    const scaleX = sourceType.value === 'image' ? 1 : w / 640
    const scaleY = sourceType.value === 'image' ? 1 : h / 480

    ctx.strokeStyle = '#06B6D4'
    ctx.lineWidth = 2
    ctx.strokeRect(x1 * scaleX, y1 * scaleY, (x2 - x1) * scaleX, (y2 - y1) * scaleY)

    ctx.fillStyle = 'rgba(6, 182, 212, 0.8)'
    ctx.fillRect(x1 * scaleX, y1 * scaleY - 25, 100, 25)

    ctx.fillStyle = '#FFFFFF'
    ctx.font = '12px sans-serif'
    ctx.fillText(`${det.class} ${(det.confidence * 100).toFixed(0)}%`, x1 * scaleX + 5, y1 * scaleY - 8)
  })
}

// 绘制图片标注
const drawImageOverlay = () => {
  if (!ctx || sourceType.value !== 'image') return

  initCanvas()
  drawDetections()
}

// 开始检测
const startDetection = async () => {
  if (!sourceUrl.value) {
    ElMessage.warning('请先选择视频源')
    return
  }

  isDetecting.value = true
  initCanvas()

  // 火焰检测模式
  if (currentMode.value === 'fireDetection') {
    await startFireDetection()
    return
  }

  // YOLO检测模式
  const detectFrame = () => {
    if (!isDetecting.value) return

    // 模拟检测结果
    if (Math.random() > 0.7) {
      const classNames = ['person', 'computer', 'book', 'cup', 'phone']
      const newDetections = []
      const count = Math.floor(Math.random() * 3) + 1

      for (let i = 0; i < count; i++) {
        newDetections.push({
          class: classNames[Math.floor(Math.random() * classNames.length)],
          confidence: Math.random() * 0.3 + 0.7,
          bbox: [
            Math.random() * 400 + 50,
            Math.random() * 300 + 50,
            Math.random() * 200 + 100,
            Math.random() * 150 + 100
          ]
        })
      }
      detections.value = newDetections
    }

    drawDetections()
    animationId = requestAnimationFrame(detectFrame)
  }

  // 模拟专注度分析
  if (detectionConfig.analyzeFocus) {
    const updateFocus = () => {
      if (!isDetecting.value) return
      focusScore.value = Math.floor(Math.random() * 30 + 70)
      focusHistory.value.push(focusScore.value)
      if (focusHistory.value.length > 100) focusHistory.value.shift()
      setTimeout(updateFocus, 1000)
    }
    updateFocus()
  }

  detectFrame()
  ElMessage.success('开始检测')
}

// 🔥 火焰/烟雾检测核心逻辑
const startFireDetection = async () => {
  if (!sourceVideo.value) {
    ElMessage.warning('请先选择摄像头')
    return
  }

  fireDetections.value = []

  // 尝试初始化Tauri后端
  const isTauri = !!window.__TAURI__
  if (isTauri && fireDetectionConfig.aiEnhance) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('quick_color_check', { base64Image: '' })
      tauriBackendAvailable = true
      ElMessage.success('Tauri 火焰检测后端已就绪')
    } catch (e) {
      tauriBackendAvailable = false
    }
  }

  // 开始定时检测
  fireDetectionTimer = setInterval(() => {
    fireDetectFrame()
  }, fireDetectionConfig.detectionInterval)

  ElMessage.success('火焰/烟雾检测已启动')
}

// 火焰检测帧
const fireDetectFrame = () => {
  if (!sourceVideo.value || !canvasOverlay.value) return
  if (sourceVideo.value.readyState < 2) return

  const video = sourceVideo.value
  const canvas = canvasOverlay.value

  // 设置画布尺寸
  canvas.width = video.videoWidth || 640
  canvas.height = video.videoHeight || 480
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  fireDetections.value = []

  // 火焰颜色检测
  if (fireDetectionConfig.enableFire) {
    const fireResults = detectFireByColor(video, ctx)
    fireDetections.value.push(...fireResults)
  }

  // 烟雾灰度检测
  if (fireDetectionConfig.enableSmoke) {
    const smokeResults = detectSmokeByColor(video, ctx)
    fireDetections.value.push(...smokeResults)
  }

  // 绘制检测框
  fireDetections.value.forEach(obj => {
    const color = obj.source === 'ai' ? '#FFD700' : (obj.category.includes('火焰') ? '#FF4500' : '#808080')
    drawFireDetectionBox(ctx, obj, color)
  })
}

// 火焰颜色检测
const detectFireByColor = (video, ctx) => {
  const detections = []
  const tempCanvas = document.createElement('canvas')
  const tempCtx = tempCanvas.getContext('2d')

  tempCanvas.width = 64
  tempCanvas.height = 48

  tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height)
  const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)
  const data = imageData.data

  let firePixels = 0
  let minX = tempCanvas.width, maxX = 0, minY = tempCanvas.height, maxY = 0

  for (let y = 0; y < tempCanvas.height; y++) {
    for (let x = 0; x < tempCanvas.width; x++) {
      const i = (y * tempCanvas.width + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]

      // 火焰颜色特征：红色/橙色高亮度
      if (r > 150 && r > g * 1.5 && r > b * 2 && r > 200) {
        firePixels++
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
    }
  }

  const threshold = (tempCanvas.width * tempCanvas.height) * 0.02
  if (firePixels > threshold) {
    const scaleX = (video.videoWidth || 640) / tempCanvas.width
    const scaleY = (video.videoHeight || 480) / tempCanvas.height

    detections.push({
      category: '🔥 火焰',
      confidence: Math.min(firePixels / (tempCanvas.width * tempCanvas.height * 0.1), 1),
      x: minX * scaleX,
      y: minY * scaleY,
      width: (maxX - minX) * scaleX,
      height: (maxY - minY) * scaleY,
      source: 'color'
    })

    triggerFireAlarm('fire')
  }

  return detections
}

// 烟雾灰度检测
const detectSmokeByColor = (video, ctx) => {
  const detections = []
  const tempCanvas = document.createElement('canvas')
  const tempCtx = tempCanvas.getContext('2d')

  tempCanvas.width = 64
  tempCanvas.height = 48

  tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height)
  const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)
  const data = imageData.data

  let smokePixels = 0
  let minX = tempCanvas.width, maxX = 0, minY = tempCanvas.height, maxY = 0

  for (let y = 0; y < tempCanvas.height; y++) {
    for (let x = 0; x < tempCanvas.width; x++) {
      const i = (y * tempCanvas.width + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]

      const brightness = (r + g + b) / 3
      const saturation = Math.max(r, g, b) - Math.min(r, g, b)

      if (brightness > 150 && brightness < 240 && saturation < 50) {
        smokePixels++
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
    }
  }

  const threshold = (tempCanvas.width * tempCanvas.height) * 0.03
  if (smokePixels > threshold) {
    const scaleX = (video.videoWidth || 640) / tempCanvas.width
    const scaleY = (video.videoHeight || 480) / tempCanvas.height

    detections.push({
      category: '💨 烟雾',
      confidence: Math.min(smokePixels / (tempCanvas.width * tempCanvas.height * 0.1), 1),
      x: minX * scaleX,
      y: minY * scaleY,
      width: (maxX - minX) * scaleX,
      height: (maxY - minY) * scaleY,
      source: 'color'
    })

    triggerFireAlarm('smoke')
  }

  return detections
}

// 绘制火焰检测框
const drawFireDetectionBox = (ctx, obj, color) => {
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.strokeRect(obj.x, obj.y, obj.width, obj.height)

  ctx.fillStyle = color
  ctx.fillRect(obj.x, obj.y - 25, 100, 25)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 12px sans-serif'
  ctx.fillText(`${obj.category} ${(obj.confidence * 100).toFixed(0)}%`, obj.x + 5, obj.y - 8)
}

// 触发火焰报警
const triggerFireAlarm = (type) => {
  const now = Date.now()
  if (now - lastFireAlarmTime < FIRE_ALARM_COOLDOWN) return

  lastFireAlarmTime = now
  fireAlarmType.value = type
  fireAlarmTime.value = new Date().toLocaleString('zh-CN')

  // 添加到报警历史
  alarmHistory.value.unshift({
    type,
    time: fireAlarmTime.value
  })
  if (alarmHistory.value.length > 10) alarmHistory.value.pop()

  showFireAlarmDialog.value = true

  // 播放报警声音
  if (fireDetectionConfig.enableAlarmSound) {
    playFireAlarmSound()
  }
}

// 播放报警声音
const playFireAlarmSound = () => {
  // @ts-ignore - Web Audio API 类型兼容
  const win = window
  const AudioContextClass = win.AudioContext || win.webkitAudioContext
  if (!AudioContextClass) return

  const audioContext = new AudioContextClass()
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)

  oscillator.frequency.value = 800
  oscillator.type = 'sine'
  gainNode.gain.value = 0.3

  oscillator.start()

  let beepCount = 0
  const beepInterval = setInterval(() => {
    beepCount++
    if (beepCount % 2 === 0) {
      oscillator.frequency.value = 800
      gainNode.gain.value = 0.3
    } else {
      oscillator.frequency.value = 600
      gainNode.gain.value = 0.2
    }

    if (beepCount >= 6) {
      clearInterval(beepInterval)
      oscillator.stop()
      audioContext.close()
    }
  }, 200)
}

// 停止检测
const stopDetection = () => {
  isDetecting.value = false

  // 停止火焰检测定时器
  if (fireDetectionTimer) {
    clearInterval(fireDetectionTimer)
    fireDetectionTimer = null
  }

  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  detections.value = []
  fireDetections.value = []
  if (ctx) {
    ctx.clearRect(0, 0, canvasOverlay.value.width, canvasOverlay.value.height)
  }
}

// 考试评判
const toggleExam = () => {
  if (isExamRunning.value) {
    stopExam()
  } else {
    startExam()
  }
}

const startExam = () => {
  if (!currentExam.value) {
    ElMessage.warning('请先选择考试任务')
    return
  }

  isExamRunning.value = true
  examTime.value = 0
  currentExamStep.value = currentExam.value.steps[0]

  examTimer = setInterval(() => {
    examTime.value++

    // 模拟步骤检测
    if (examTime.value % 30 === 0) {
      const stepIndex = Math.floor(examTime.value / 30) % currentExam.value.steps.length
      currentExamStep.value = currentExam.value.steps[stepIndex]
    }
  }, 1000)

  startDetection()
  ElMessage.success('开始考试评判')
}

const stopExam = () => {
  isExamRunning.value = false
  if (examTimer) {
    clearInterval(examTimer)
  }
  stopDetection()
  ElMessage.success('考试评判结束')
}

// 考试列表方法
const getExamStatusType = (status) => {
  const map = { pending: 'info', active: 'success', ended: 'warning' }
  return map[status] || 'info'
}

const getExamStatusTagType = (status) => {
  const map = { '未开始': 'info', '进行中': 'success', '已完成': 'warning', '待评分': 'warning' }
  return map[status] || 'info'
}

const viewExamDetails = (exam) => {
  ElMessage.info('查看考试详情: ' + exam.title)
}

const startExamEvaluation = (exam) => {
  currentExam.value = exam
  currentMode.value = 'exam'
  examTab.value = 'uploads'
  ElMessage.success('已选择考试: ' + exam.title)
}

const createExam = () => {
  if (!newExam.title) {
    ElMessage.warning('请输入考试名称')
    return
  }

  examList.value.push({
    id: Date.now(),
    ...JSON.parse(JSON.stringify(newExam)),
    status: 'pending'
  })

  showCreateExamDialog.value = false
  ElMessage.success('考试创建成功')
}

const addStep = () => {
  newExam.steps.push({ name: '', tool: '', score: 10 })
}

const removeStep = (index) => {
  newExam.steps.splice(index, 1)
}

// 学生管理方法
const addStudent = () => {
  if (!newStudent.name || !newStudent.id) {
    ElMessage.warning('请输入学生信息')
    return
  }

  students.value.push({
    ...JSON.parse(JSON.stringify(newStudent)),
    status: 'offline',
    examStatus: '未开始'
  })

  showAddStudentDialog.value = false
  newStudent.name = ''
  newStudent.id = ''
  ElMessage.success('学生添加成功')
}

const viewStudentExam = (student) => {
  currentExam.value = examList.value[0]
  currentMode.value = 'exam'
  examTab.value = 'uploads'
  ElMessage.info('查看学生: ' + student.name + ' 的考试')
}

// 任务管理方法
const getTaskStatusType = (status) => {
  const map = { draft: 'info', published: 'success', closed: 'danger' }
  return map[status] || 'info'
}

const editTask = (task) => ElMessage.info('编辑任务: ' + task.name)
const publishTask = (task) => ElMessage.success('任务已发布')
const deleteTask = (task) => ElMessage.success('任务已删除')

// 实训管理方法
const getTrainingStatusType = (status) => {
  const map = { pending: 'info', ongoing: 'success', completed: 'danger' }
  return map[status] || 'info'
}

const getProgressStatus = (progress) => {
  if (progress >= 100) return 'success'
  if (progress > 50) return 'warning'
  return undefined
}

const viewTraining = (training) => ElMessage.info('查看实训: ' + training.name)
const startTraining = (training) => ElMessage.success('实训已开始')

// 视频上传方法
const handleFileDrop = (e) => {
  const file = e.dataTransfer.files[0]
  if (file && file.type.startsWith('video/')) {
    uploadVideo(file)
  }
}

const handleFileSelect = (e) => {
  const file = e.target.files[0]
  if (file) {
    uploadVideo(file)
  }
}

const uploadVideo = (file) => {
  const video = {
    id: Date.now(),
    name: file.name,
    url: URL.createObjectURL(file),
    student: '待分配',
    uploadTime: new Date().toLocaleString(),
    status: '待评判'
  }
  uploadedVideos.value.unshift(video)
  ElMessage.success('视频上传成功')
}

const getUploadStatusType = (status) => {
  const map = { '待评判': 'warning', '已评分': 'success' }
  return map[status] || 'info'
}

const evaluateVideo = (video) => {
  ElMessage.info('开始评判视频: ' + video.name)
  // 模拟评分
  setTimeout(() => {
    video.status = '已评分'
    examResults.value.unshift({
      student: video.student,
      exam: currentExam.value?.title || '考试',
      submitTime: video.uploadTime,
      score: Math.floor(Math.random() * 30 + 70),
      totalScore: 100,
      status: 'graded',
      feedback: '操作规范，动作标准'
    })
  }, 2000)
}

const handlePreviewVideo = (video) => {
  showVideoPreviewDialog.value = true
  nextTick(() => {
    if (previewVideo.value) {
      previewVideo.value.src = video.url
    }
  })
}

// 评分结果方法
const viewResultDetail = (result) => {
  selectedResult.value = {
    ...result,
    stepResults: currentExam.value?.steps.map(s => ({
      name: s.name,
      score: Math.floor(Math.random() * s.score * 0.5 + s.score * 0.5),
      passed: Math.random() > 0.3
    })) || []
  }
  showResultDetailDialog.value = true
}

const exportResult = (result) => {
  ElMessage.success('评分报告已导出')
}

// 窗口控制
const handleMinimize = () => {
  emit('close')
}

const handleClose = () => {
  if (isDetecting.value || isExamRunning.value) {
    ElMessageBox.confirm('检测正在进行中，确定要关闭吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      stopDetection()
      emit('close')
    })
  } else {
    emit('close')
  }
}

// 监听视频源变化
watch(sourceUrl, async () => {
  await nextTick()
  // 再次 nextTick 确保带 v-else-if 的视频元素已完全渲染
  await nextTick()

  initCanvas()

  if (!sourceVideo.value) {
    console.warn('[VisionAnalysis] 视频元素尚未渲染')
    return
  }

  if (sourceUrl.value instanceof MediaStream) {
    // MediaStream: 通过 srcObject 绑定（模板中已绑定，此处做兜底确保）
    if (sourceVideo.value.srcObject !== sourceUrl.value) {
      sourceVideo.value.srcObject = sourceUrl.value
      sourceVideo.value.removeAttribute('src')
    }
    console.log('[VisionAnalysis] 已设置 srcObject 为 MediaStream')
    // MediaStream 不需要调用 load()，autoplay 会自动播放
    // 尝试播放
    try {
      if (sourceVideo.value.paused) {
        await sourceVideo.value.play()
      }
      console.log('[VisionAnalysis] 摄像头视频播放成功')
    } catch (err) {
      console.warn('[VisionAnalysis] 摄像头视频播放失败:', err)
    }
  } else if (typeof sourceUrl.value === 'string' && sourceUrl.value) {
    // 字符串 URL: 通过 src 绑定（模板中已绑定，此处做兜底确保）
    if (sourceVideo.value.src !== sourceUrl.value) {
      sourceVideo.value.srcObject = null
      sourceVideo.value.src = sourceUrl.value
    }
    console.log('[VisionAnalysis] 已设置 src 为字符串')
    // 本地视频需要 load() 来加载新源
    sourceVideo.value.load()

    // 等待视频元数据加载完成
    await new Promise((resolve) => {
      if (sourceVideo.value && sourceVideo.value.readyState >= 1) {
        resolve()
      } else if (sourceVideo.value) {
        sourceVideo.value.addEventListener('loadedmetadata', resolve, { once: true })
      }
    })

    // 尝试播放视频
    try {
      if (sourceVideo.value.paused) {
        await sourceVideo.value.play()
      }
      console.log('[VisionAnalysis] 本地视频播放成功')
    } catch (err) {
      console.warn('[VisionAnalysis] 本地视频播放失败:', err)
    }
  } else {
    sourceVideo.value.srcObject = null
    sourceVideo.value.removeAttribute('src')
  }
})

// 监听外部摄像头流变化
watch(() => props.externalCameraStream, (newStream) => {
  if (newStream && sourceType.value === 'camera') {
    sourceUrl.value = newStream
    usingExternalCamera.value = true
    console.log('[VisionAnalysis] 外部摄像头流已更新')
  }
})

// 组件挂载时，如果有外部流，自动使用
onMounted(() => {
  // 初始化画布
  nextTick(() => {
    initCanvas()
  })

  // 监听窗口大小变化，调整画布大小
  const handleResize = () => {
    nextTick(() => {
      initCanvas()
    })
  };

  window.addEventListener('resize', handleResize);

  // 如果有外部传入的摄像头，自动使用它
  if (props.externalCameraStream) {
    nextTick(() => {
      selectSource('camera')
    })
  } else {
    // 如果没有外部摄像头流且当前类型是摄像头，尝试初始化摄像头
    if (sourceType.value === 'camera') {
      nextTick(() => {
        selectSource('camera')
      })
    }
  }

  // 加载模拟数据
  examList.value = [
    {
      id: 1,
      title: '显微镜使用实操考试',
      subject: '生物实验',
      duration: 15,
      totalScore: 100,
      deadline: '2025-03-20 18:00',
      status: 'active',
      steps: [
        { name: '取出玻片', tool: '镊子', score: 10 },
        { name: '滴加清水', tool: '滴管', score: 15 },
        { name: '放置玻片', tool: null, score: 15 },
        { name: '调焦观察', tool: null, score: 30 },
        { name: '规范操作', tool: null, score: 30 }
      ]
    },
    {
      id: 2,
      title: '电路焊接实操考试',
      subject: '电子技术',
      duration: 20,
      totalScore: 100,
      deadline: '2025-03-25 18:00',
      status: 'pending',
      steps: [
        { name: '准备工具', tool: '电烙铁', score: 10 },
        { name: '清洁元件', tool: null, score: 15 },
        { name: '焊接操作', tool: '焊锡', score: 40 },
        { name: '检查验收', tool: null, score: 35 }
      ]
    }
  ]

  students.value = [
    { id: 'S001', name: '张三', status: 'online', examStatus: '进行中' },
    { id: 'S002', name: '李四', status: 'online', examStatus: '已完成' },
    { id: 'S003', name: '王五', status: 'offline', examStatus: '未开始' },
    { id: 'S004', name: '赵六', status: 'online', examStatus: '待评分' }
  ]

  taskList.value = [
    { id: 1, name: '周测一', description: '本周学习内容测试', type: '测验', deadline: '2025-03-15', status: 'published' },
    { id: 2, name: '月考', description: '月度综合测试', type: '考试', deadline: '2025-03-30', status: 'draft' }
  ]

  trainingList.value = [
    { id: 1, name: '基础焊接实训', studentCount: 25, progress: 65, status: 'ongoing' },
    { id: 2, name: '电路设计实训', studentCount: 20, progress: 30, status: 'ongoing' },
    { id: 3, name: '电子产品组装', studentCount: 15, progress: 100, status: 'completed' }
  ]

  examResults.value = [
    { student: '李四', exam: '显微镜使用实操考试', submitTime: '2025-03-10 14:30', score: 85, totalScore: 100, status: 'graded', feedback: '操作规范' },
    { student: '王五', exam: '电路焊接实操考试', submitTime: '2025-03-11 10:20', score: 72, totalScore: 100, status: 'graded', feedback: '第三步稍慢' }
  ]
})

onUnmounted(() => {
  stopDetection()
  if (examTimer) {
    clearInterval(examTimer)
  }

  // 移除窗口大小变化监听器
  window.removeEventListener('resize', handleResize);
})
</script>

<style lang="scss" scoped>
.vision-analysis-window {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #0D1B2A;
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

// 顶部栏
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px 20px;
  background: #1A2A3A;
  border-bottom: 1px solid #2d3a4f;

  .title-section {
    .main-title {
      font-size: 20px;
      font-weight: 600;
      color: #FFFFFF;
      margin: 0;
    }

    .subtitle {
      font-size: 12px;
      color: #778DA9;
    }
  }

  .mode-tabs {
    display: flex;
    gap: 5px;

    .mode-tab {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 20px;
      color: #778DA9;
      cursor: pointer;
      transition: all 0.3s;

      &:hover {
        background: rgba(6, 182, 212, 0.1);
        color: #06B6D4;
      }

      &.active {
        background: rgba(6, 182, 212, 0.2);
        border-color: #06B6D4;
        color: #06B6D4;
      }

      .mode-icon {
        font-size: 16px;
      }

      .mode-label {
        font-size: 14px;
      }
    }
  }

  .top-actions {
    display: flex;
    gap: 10px;

    .action-btn {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: 1px solid #2d3a4f;
      border-radius: 6px;
      color: #778DA9;
      cursor: pointer;
      transition: all 0.3s;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #FFFFFF;
      }

      &.close-btn:hover {
        background: #F56C6C;
        border-color: #F56C6C;
        color: #FFFFFF;
      }
    }
  }
}

// 主内容
.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

// 视频区
.video-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;

  .video-container {
    flex: 1;
    position: relative;
    background: #000;
    border-radius: 12px;
    overflow: hidden;
    min-height: 400px;
    display: flex;
    align-items: center;
    justify-content: center;

    .source-image,
    .source-video {
      width: 100%;
      height: 100%;
      object-fit: contain;
      z-index: 1;
      position: relative;
    }

    .detection-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2;
    }

    .video-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;

      .placeholder-content {
        text-align: center;
        color: #778DA9;

        .placeholder-icon {
          font-size: 64px;
          display: block;
          margin-bottom: 20px;
        }

        p {
          font-size: 16px;
        }
      }
    }

    .detection-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    .focus-indicator {
      position: absolute;
      top: 20px;
      left: 20px;
      background: rgba(0, 0, 0, 0.7);
      padding: 10px 15px;
      border-radius: 8px;

      .focus-label {
        font-size: 12px;
        color: #778DA9;
        margin-bottom: 5px;
      }

      .focus-bar {
        width: 100px;
        height: 6px;
        background: #2d3a4f;
        border-radius: 3px;
        overflow: hidden;

        .focus-fill {
          height: 100%;
          transition: width 0.3s, background 0.3s;
        }
      }

      .focus-value {
        font-size: 14px;
        font-weight: 600;
        margin-top: 5px;
      }
    }

    .exam-overlay {
      position: absolute;
      top: 20px;
      right: 20px;

      .exam-timer {
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(0, 0, 0, 0.7);
        padding: 10px 15px;
        border-radius: 8px;
        color: #FFFFFF;
        font-weight: 600;
        font-size: 18px;
      }

      .exam-step-info {
        margin-top: 10px;
        background: rgba(6, 182, 212, 0.9);
        padding: 10px 15px;
        border-radius: 8px;
        text-align: center;

        .step-name {
          font-size: 14px;
          color: #FFFFFF;
        }

        .step-score {
          font-size: 20px;
          font-weight: 700;
          color: #FFFFFF;
        }
      }
    }
  }

  .video-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 15px;
    padding: 15px;
    background: #1A2A3A;
    border-radius: 12px;

    .source-selector {
      display: flex;
      gap: 10px;

      .source-btn {
        padding: 8px 16px;
        background: transparent;
        border: 1px solid #2d3a4f;
        border-radius: 20px;
        color: #778DA9;
        cursor: pointer;
        transition: all 0.3s;

        &:hover {
          border-color: #06B6D4;
          color: #06B6D4;
        }

        &.active {
          background: rgba(6, 182, 212, 0.2);
          border-color: #06B6D4;
          color: #06B6D4;
        }
      }
    }

    .control-actions {
      display: flex;
      gap: 10px;

      .control-btn {
        padding: 8px 20px;
        border-radius: 20px;
        border: none;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.3s;

        &.primary {
          background: #06B6D4;
          color: #FFFFFF;

          &:hover {
            background: #0891B2;
          }
        }

        &.danger {
          background: #F56C6C;
          color: #FFFFFF;

          &:hover {
            background: #E64545;
          }
        }
      }
    }
  }
}

// 控制面板
.control-panel {
  width: 450px;
  background: #141f2e;
  border-left: 1px solid #2d3a4f;
  overflow-y: auto;

  .panel-section {
    padding: 20px;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;

    h3 {
      font-size: 14px;
      font-weight: 600;
      color: #E0E1DD;
      margin: 0;
    }
  }
}

// 配置组
.config-group {
  margin-bottom: 20px;

  .config-label {
    display: block;
    font-size: 12px;
    color: #778DA9;
    margin-bottom: 8px;
  }

  .checkbox-group {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;

    .checkbox-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #E0E1DD;
      cursor: pointer;

      input {
        accent-color: #06B6D4;
      }
    }
  }

  .slider {
    width: 100%;
    accent-color: #06B6D4;
  }
}

// 检测结果
.detection-results {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  .detection-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: rgba(6, 182, 212, 0.1);
    border-radius: 15px;
    font-size: 12px;

    .det-class {
      color: #06B6D4;
    }

    .det-confidence {
      color: #778DA9;
    }
  }
}

.empty-results {
  padding: 30px;
  text-align: center;
  color: #778DA9;
}

// 专注度分析
.focus-analysis {
  margin-top: 20px;

  .focus-chart {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 60px;
    margin-bottom: 10px;

    .focus-bar-item {
      flex: 1;
      background: #67C23A;
      border-radius: 2px;
      transition: height 0.3s;

      &.low {
        background: #F56C6C;
      }
    }
  }

  .focus-summary {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #778DA9;
  }
}

// 考试标签页
.exam-tabs {
  height: 100%;

  :deep(.el-tabs__content) {
    overflow: auto;
    max-height: calc(100vh - 250px);
  }
}

// 考试列表
.exam-list {
  .exam-item {
    padding: 15px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    margin-bottom: 10px;

    .exam-info {
      h4 {
        margin: 0 0 8px;
        color: #FFFFFF;
      }

      p {
        margin: 4px 0;
        font-size: 11px;
        line-height: 1.35;
        color: #778DA9;
      }

      .exam-deadline {
        color: #E6A23C;
      }
    }

    .exam-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 10px;

      .exam-btn {
        padding: 5px 12px;
        background: transparent;
        border: 1px solid #2d3a4f;
        border-radius: 4px;
        color: #778DA9;
        font-size: 12px;
        cursor: pointer;

        &:hover {
          border-color: #06B6D4;
          color: #06B6D4;
        }

        &.primary {
          background: #06B6D4;
          border-color: #06B6D4;
          color: #FFFFFF;

          &:hover {
            background: #0891B2;
          }
        }
      }
    }
  }

  .add-exam-btn {
    width: 100%;
    padding: 12px;
    background: transparent;
    border: 1px dashed #2d3a4f;
    border-radius: 8px;
    color: #778DA9;
    cursor: pointer;

    &:hover {
      border-color: #06B6D4;
      color: #06B6D4;
    }
  }
}

// 学生面板
.students-panel,
.uploads-panel,
.results-panel {
  .panel-toolbar {
    display: flex;
    gap: 10px;
    margin-bottom: 15px;
  }
}

.student-list,
.task-list,
.training-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.student-card,
.task-card,
.training-card {
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;

  .student-avatar {
    width: 40px;
    height: 40px;
    background: #06B6D4;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #FFFFFF;
    font-weight: 600;
  }

  .student-info,
  .task-header,
  .training-header {
    h4 {
      margin: 0 0 5px;
      color: #FFFFFF;
    }

    p {
      margin: 4px 0;
      font-size: 12px;
      color: #778DA9;
    }
  }

  .student-actions,
  .task-actions,
  .training-actions {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }
}

.task-desc {
  font-size: 12px;
  color: #778DA9;
  margin: 8px 0;
}

.task-meta,
.training-stats {
  display: flex;
  gap: 15px;
  font-size: 12px;
  color: #778DA9;
  margin-bottom: 10px;
}

// 视频上传
.upload-dropzone {
  padding: 30px;
  border: 2px dashed #2d3a4f;
  border-radius: 12px;
  text-align: center;
  margin-bottom: 20px;

  .upload-icon {
    font-size: 48px;
    display: block;
    margin-bottom: 10px;
  }

  p {
    margin: 5px 0;
    color: #778DA9;
  }

  .upload-hint {
    font-size: 12px;
  }
}

.upload-list {
  .upload-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    margin-bottom: 8px;

    .upload-name {
      color: #FFFFFF;
      font-size: 12px;
      line-height: 1.3;
    }

    .upload-meta {
      display: block;
      font-size: 10px;
      line-height: 1.3;
    }
  }
}

// 评分结果
.results-stats {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;

  .stat-card {
    flex: 1;
    padding: 15px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    text-align: center;

    .stat-value {
      display: block;
      font-size: 24px;
      font-weight: 600;
      color: #06B6D4;
    }

    .stat-label {
      font-size: 12px;
      color: #778DA9;
    }
  }
}

.score-value {
  font-weight: 600;

  &.high { color: #67C23A; }
  &.mid { color: #E6A23C; }
  &.low { color: #F56C6C; }
}

// 通用按钮
.small-btn {
  padding: 4px 10px;
  background: transparent;
  border: 1px solid #2d3a4f;
  border-radius: 4px;
  color: #778DA9;
  font-size: 11px;
  cursor: pointer;

  &:hover {
    border-color: #06B6D4;
    color: #06B6D4;
  }
}

::v-deep(.el-table th),
::v-deep(.el-table td) {
  font-size: 12px;
  line-height: 1.3;
}

::v-deep(.el-table .cell) {
  font-size: 12px;
  line-height: 1.3;
}

::v-deep(.el-tabs__item) {
  font-size: 12px;
}

// 评分详情
.result-detail {
  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    h3 {
      margin: 0;
      color: #FFFFFF;
    }

    .result-score {
      .score-num {
        font-size: 32px;
        font-weight: 700;
        color: #67C23A;
      }

      .score-total {
        font-size: 16px;
        color: #778DA9;
      }
    }
  }

  .step-results {
    margin-top: 20px;

    h4 {
      margin-bottom: 10px;
      color: #E0E1DD;
    }

    .step-result {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 6px;
      margin-bottom: 8px;

      .step-num {
        width: 24px;
        height: 24px;
        background: rgba(6, 182, 212, 0.2);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        color: #06B6D4;
      }

      .step-name {
        flex: 1;
        color: #E0E1DD;
      }

      .step-score {
        color: #06B6D4;
        font-weight: 600;
      }
    }
  }

  .result-feedback {
    margin-top: 20px;

    h4 {
      margin-bottom: 10px;
      color: #E0E1DD;
    }

    p {
      padding: 12px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 6px;
      color: #778DA9;
    }
  }
}

// 步骤编辑
.steps-editor {
  .step-row {
    display: flex;
    gap: 10px;
    margin-bottom: 10px;
    align-items: center;
  }
}

// Element Plus 覆盖
::v-deep(.el-tabs__header) {
  margin: 0;
}

::v-deep(.el-tabs__nav-wrap::after) {
  background: #2d3a4f;
}

::v-deep(.el-tabs__item) {
  color: #778DA9;
  font-size: 13px;

  &.is-active {
    color: #06B6D4;
  }
}

::v-deep(.el-tabs__active-bar) {
  background: #06B6D4;
}

::v-deep(.el-table) {
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: #1A2A3A;
  --el-table-border-color: #2d3a4f;
  --el-table-text-color: #E0E1DD;
}

::v-deep(.el-dialog) {
  --el-dialog-bg-color: #1A2A3A;
}

::v-deep(.el-input__wrapper) {
  background: #0D1B2A;
}

.preview-video {
  width: 100%;
  border-radius: 8px;
}

// 🔥 火焰检测报警样式
.alarm-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 20px;

  .alarm-icon {
    font-size: 64px;
    margin-bottom: 16px;
  }

  .alarm-info {
    margin-bottom: 16px;

    h2 {
      margin: 0 0 8px;
      color: #F56C6C;
    }

    p {
      margin: 4px 0;
      color: #778DA9;
    }

    .alarm-time {
      font-size: 12px;
      color: #A0AEC0;
    }
  }
}

.alarm-history {
  max-height: 150px;
  overflow-y: auto;

  .alarm-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: #0F2035;
    border-radius: 4px;
    margin-bottom: 4px;

    .alarm-icon {
      font-size: 16px;
    }

    .alarm-type {
      flex: 1;
      font-size: 12px;
      color: #E0E1DD;
    }

    .alarm-time {
      font-size: 11px;
      color: #778DA9;
    }
  }
}
</style>
