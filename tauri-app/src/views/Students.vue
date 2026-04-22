<template>
  <div class="students-view">
    <!-- 标题栏 -->
    <div class="title-bar">
      <div class="title">
        <span class="title-icon">👨‍🎓</span>
        <span>实训教学系统 - 学生实训管理</span>
      </div>
      <div class="window-controls">
        <button class="control-btn" @click="goBack" title="返回"><span>←</span></button>
        <button class="control-btn" @click="minimize" title="最小化"><span>－</span></button>
        <button class="control-btn" @click="maximize" title="最大化"><span>□</span></button>
        <button class="control-btn close" @click="close" title="关闭"><span>×</span></button>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="main-content">
      <!-- 侧边栏 -->
      <div class="sidebar">
        <div class="sidebar-header">
          <div class="logo">📚</div>
          <div class="logo-text">实训管理</div>
        </div>

        <nav class="nav-menu">
          <button
            v-for="item in menuItems"
            :key="item.key"
            :class="['nav-item', { active: activeMenu === item.key }]"
            @click="activeMenu = item.key"
          >
            <span class="nav-icon">{{ item.icon }}</span>
            <span class="nav-text">{{ item.label }}</span>
          </button>
        </nav>

        <!-- 统计信息 -->
        <div class="stats-panel">
          <div class="stat-item">
            <div class="stat-value">{{ students.length }}</div>
            <div class="stat-label">总学生数</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ onlineCount }}</div>
            <div class="stat-label">在线人数</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ completedTasks }}</div>
            <div class="stat-label">已完成任务</div>
          </div>
        </div>
      </div>

      <!-- 内容区域 -->
      <div class="content-area">
        <!-- 学生列表 -->
        <div v-if="activeMenu === 'students'" class="content-panel">
          <div class="panel-header">
            <h2>学生列表</h2>
            <div class="panel-actions">
              <el-button type="primary" size="small" @click="showAddStudent = true">
                <el-icon><Plus /></el-icon> 添加学生
              </el-button>
              <el-input
                v-model="searchQuery"
                placeholder="搜索学生..."
                size="small"
                class="search-input"
              >
                <template #prefix>
                  <el-icon><Search /></el-icon>
                </template>
              </el-input>
            </div>
          </div>
          <div class="panel-body">
            <el-table :data="filteredStudents" style="width: 100%" border>
              <el-table-column prop="name" label="姓名" width="120" />
              <el-table-column prop="id" label="学号" width="140" />
              <el-table-column prop="class" label="班级" width="150" />
              <el-table-column prop="status" label="状态" width="120">
                <template #default="scope">
                  <el-tag :type="getStatusType(scope.row.status)">
                    {{ scope.row.status }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="progress" label="学习进度" width="140">
                <template #default="scope">
                  <div class="progress-wrapper">
                    <el-progress :percentage="scope.row.progress" :show-text="false" />
                    <span class="progress-text">{{ scope.row.progress }}%</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="score" label="综合评分" width="120">
                <template #default="scope">
                  <el-tag :type="getScoreType(scope.row.score)">
                    {{ scope.row.score }}分
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="200">
                <template #default="scope">
                  <el-button size="small" @click="viewStudentDetail(scope.row)">查看详情</el-button>
                  <el-button size="small" type="primary" @click="assignTask(scope.row)">分配任务</el-button>
                  <el-button size="small" type="danger" @click="removeStudent(scope.row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>

        <!-- 任务管理 -->
        <div v-if="activeMenu === 'tasks'" class="content-panel">
          <div class="panel-header">
            <h2>任务管理</h2>
            <div class="panel-actions">
              <el-button type="primary" size="small" @click="showAddTask = true">
                <el-icon><Plus /></el-icon> 创建任务
              </el-button>
              <el-select v-model="taskFilter" size="small" placeholder="筛选状态">
                <el-option label="全部" value="all" />
                <el-option label="进行中" value="in_progress" />
                <el-option label="已完成" value="completed" />
                <el-option label="待分配" value="pending" />
              </el-select>
            </div>
          </div>
          <div class="panel-body">
            <div class="task-grid">
              <div
                v-for="task in filteredTasks"
                :key="task.id"
                class="task-card"
                :class="{ completed: task.status === 'completed' }"
              >
                <div class="task-header">
                  <div class="task-icon">{{ task.completed ? '✅' : '📝' }}</div>
                  <div class="task-title">{{ task.title }}</div>
                  <el-tag :type="getTaskStatusType(task.status)">{{ getTaskStatusLabel(task.status) }}</el-tag>
                </div>
                <div class="task-info">
                  <p class="task-desc">{{ task.description }}</p>
                  <div class="task-meta">
                    <span class="meta-item">📅 {{ task.deadline }}</span>
                    <span class="meta-item">👥 {{ task.assignedCount }}/{{ task.totalStudents }} 人</span>
                  </div>
                </div>
                <div class="task-progress">
                  <div class="progress-info">
                    <span>完成进度</span>
                    <span>{{ task.completionRate }}%</span>
                  </div>
                  <el-progress :percentage="task.completionRate" :show-text="false" />
                </div>
                <div class="task-actions">
                  <el-button size="small" @click="editTask(task)">编辑</el-button>
                  <el-button size="small" type="primary" @click="viewTaskDetail(task)">查看详情</el-button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 学习进度 -->
        <div v-if="activeMenu === 'progress'" class="content-panel">
          <div class="panel-header">
            <h2>学习进度分析</h2>
            <el-select v-model="progressClassFilter" size="small" placeholder="选择班级">
              <el-option label="全部班级" value="all" />
              <el-option label="新能源汽车1班" value="新能源汽车1班" />
              <el-option label="新能源汽车2班" value="新能源汽车2班" />
              <el-option label="智能制造班" value="智能制造班" />
            </el-select>
          </div>
          <div class="panel-body">
            <div class="progress-charts">
              <!-- 班级进度统计 -->
              <div class="chart-card">
                <h3>📊 班级进度统计</h3>
                <div class="chart-content">
                  <div class="progress-bars">
                    <div v-for="item in classProgress" :key="item.className" class="progress-item">
                      <div class="progress-label">{{ item.className }}</div>
                      <el-progress :percentage="item.percentage" :show-text="true" />
                    </div>
                  </div>
                </div>
              </div>

              <!-- 任务完成情况 -->
              <div class="chart-card">
                <h3>📈 任务完成情况</h3>
                <div class="chart-content">
                  <div class="stats-grid">
                    <div class="stat-card">
                      <div class="stat-num">{{ totalTasks }}</div>
                      <div class="stat-name">总任务数</div>
                    </div>
                    <div class="stat-card success">
                      <div class="stat-num">{{ completedTasksCount }}</div>
                      <div class="stat-name">已完成</div>
                    </div>
                    <div class="stat-card warning">
                      <div class="stat-num">{{ inProgressTasks }}</div>
                      <div class="stat-name">进行中</div>
                    </div>
                    <div class="stat-card danger">
                      <div class="stat-num">{{ pendingTasks }}</div>
                      <div class="stat-name">待分配</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 学生排行榜 -->
              <div class="chart-card">
                <h3>🏆 学生排行榜</h3>
                <div class="chart-content">
                  <el-table :data="topStudents" style="width: 100%">
                    <el-table-column label="排名" width="60">
                      <template #default="scope">
                        <span :class="['rank', `rank-${scope.$index + 1}`]">{{ scope.$index + 1 }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="name" label="姓名" />
                    <el-table-column prop="class" label="班级" />
                    <el-table-column prop="score" label="评分" />
                    <el-table-column prop="completedTasks" label="完成任务数" />
                  </el-table>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 实验报告 -->
        <div v-if="activeMenu === 'reports'" class="content-panel">
          <div class="panel-header">
            <h2>实验报告管理</h2>
            <el-select v-model="reportStatusFilter" size="small" placeholder="筛选状态">
              <el-option label="全部" value="all" />
              <el-option label="待批改" value="pending" />
              <el-option label="已批改" value="graded" />
              <el-option label="优秀" value="excellent" />
            </el-select>
          </div>
          <div class="panel-body">
            <el-table :data="filteredReports" style="width: 100%" border>
              <el-table-column prop="studentName" label="学生姓名" width="120" />
              <el-table-column prop="studentId" label="学号" width="120" />
              <el-table-column prop="taskName" label="任务名称" />
              <el-table-column prop="submitTime" label="提交时间" width="160" />
              <el-table-column prop="status" label="状态" width="100">
                <template #default="scope">
                  <el-tag :type="getReportStatusType(scope.row.status)">
                    {{ getReportStatusLabel(scope.row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="score" label="评分" width="80">
                <template #default="scope">
                  <span v-if="scope.row.score">{{ scope.row.score }}分</span>
                  <span v-else class="text-gray">-</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="180">
                <template #default="scope">
                  <el-button size="small" @click="viewReport(scope.row)">查看报告</el-button>
                  <el-button v-if="scope.row.status === 'pending'" size="small" type="primary" @click="gradeReport(scope.row)">批改</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>

        <!-- 考试管理 -->
        <div v-if="activeMenu === 'exam'" class="content-panel exam-panel">
          <div class="panel-header">
            <h2>考试管理</h2>
            <div class="panel-actions">
              <el-button type="primary" size="small" @click="showCreateExam = true">
                <el-icon><Plus /></el-icon> 创建考试
              </el-button>
            </div>
          </div>
          
          <!-- 考试标签页 -->
          <el-tabs v-model="examTab" class="exam-tabs">
            <!-- 考试列表 -->
            <el-tab-pane label="📝 考试列表" name="list">
              <div class="exam-list">
                <div v-for="exam in examList" :key="exam.id" class="exam-card">
                  <div class="exam-header">
                    <h4>{{ exam.title }}</h4>
                    <el-tag :type="getExamStatusType(exam.status)">{{ getExamStatusLabel(exam.status) }}</el-tag>
                  </div>
                  <div class="exam-info">
                    <p><strong>科目:</strong> {{ exam.subject }}</p>
                    <p><strong>时长:</strong> {{ exam.duration }}分钟</p>
                    <p><strong>总分:</strong> {{ exam.totalScore }}分</p>
                    <p><strong>截止:</strong> {{ exam.deadline }}</p>
                  </div>
                  <div class="exam-stats">
                    <span>已提交: {{ exam.submittedCount }}人</span>
                    <span>待评分: {{ exam.pendingCount }}人</span>
                  </div>
                  <div class="exam-actions">
                    <el-button size="small" @click="viewExamDetail(exam)">详情</el-button>
                    <el-button size="small" type="primary" @click="startExamEvaluation(exam)">开始评判</el-button>
                    <el-button size="small" type="danger" @click="deleteExam(exam)">删除</el-button>
                  </div>
                </div>
                <div v-if="examList.length === 0" class="empty-state">
                  <p>暂无考试任务</p>
                  <el-button type="primary" @click="showCreateExam = true">创建第一个考试</el-button>
                </div>
              </div>
            </el-tab-pane>

            <!-- 视频管理 -->
            <el-tab-pane label="📤 视频管理" name="videos">
              <div class="video-list">
                <div class="upload-stats">
                  <div class="stat-card">
                    <span class="stat-num">{{ examVideos.length }}</span>
                    <span class="stat-name">总视频数</span>
                  </div>
                  <div class="stat-card warning">
                    <span class="stat-num">{{ pendingEvalCount }}</span>
                    <span class="stat-name">待评判</span>
                  </div>
                  <div class="stat-card success">
                    <span class="stat-num">{{ evaluatedCount }}</span>
                    <span class="stat-name">已评判</span>
                  </div>
                </div>
                
                <el-table :data="examVideos" style="width: 100%" border size="small">
                  <el-table-column prop="studentName" label="学生" width="100" />
                  <el-table-column prop="examTitle" label="考试" width="150" />
                  <el-table-column prop="uploadTime" label="上传时间" width="160" />
                  <el-table-column prop="duration" label="时长" width="80" />
                  <el-table-column prop="status" label="状态" width="100">
                    <template #default="scope">
                      <el-tag size="small" :type="getVideoStatusType(scope.row.status)">
                        {{ scope.row.status }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="score" label="得分" width="80">
                    <template #default="scope">
                      <span v-if="scope.row.score !== null" :class="['score-val', { high: scope.row.score >= 90, mid: scope.row.score >= 60 && scope.row.score < 90, low: scope.row.score < 60 }]">
                        {{ scope.row.score }}分
                      </span>
                      <span v-else class="text-gray">-</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="150">
                    <template #default="scope">
                      <el-button size="small" @click="previewExamVideo(scope.row)">预览</el-button>
                      <el-button size="small" type="primary" @click="evaluateExamVideo(scope.row)" v-if="scope.row.status === '待评判'">评判</el-button>
                      <el-button size="small" type="info" @click="viewExamResult(scope.row)" v-if="scope.row.status === '已评判'">详情</el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </el-tab-pane>

            <!-- 评分结果 -->
            <el-tab-pane label="📊 评分结果" name="results">
              <div class="results-summary">
                <div class="summary-card">
                  <div class="summary-icon">🏆</div>
                  <div class="summary-info">
                    <span class="summary-value">{{ averageExamScore }}</span>
                    <span class="summary-label">平均分</span>
                  </div>
                </div>
                <div class="summary-card">
                  <div class="summary-icon">📈</div>
                  <div class="summary-info">
                    <span class="summary-value">{{ highestScore }}</span>
                    <span class="summary-label">最高分</span>
                  </div>
                </div>
                <div class="summary-card">
                  <div class="summary-icon">📉</div>
                  <div class="summary-info">
                    <span class="summary-value">{{ lowestScore }}</span>
                    <span class="summary-label">最低分</span>
                  </div>
                </div>
              </div>
              
              <el-table :data="examResults" style="width: 100%" border size="small">
                <el-table-column prop="studentName" label="学生" width="100" />
                <el-table-column prop="examTitle" label="考试" width="150" />
                <el-table-column prop="submitTime" label="提交时间" width="160" />
                <el-table-column prop="score" label="得分" width="80">
                  <template #default="scope">
                    <span :class="['score-val', { high: scope.row.score >= 90, mid: scope.row.score >= 60 && scope.row.score < 90, low: scope.row.score < 60 }]">
                      {{ scope.row.score }}分
                    </span>
                  </template>
                </el-table-column>
                <el-table-column prop="totalScore" label="总分" width="80" />
                <el-table-column label="操作" width="180">
                  <template #default="scope">
                    <el-button size="small" @click="viewExamResult(scope.row)">查看详情</el-button>
                    <el-button size="small" type="primary" @click="exportExamReport(scope.row)">导出报告</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </div>
      </div>
    </div>

    <!-- 添加学生对话框 -->
    <el-dialog v-model="showAddStudent" title="添加学生" width="500px">
      <el-form :model="newStudent" label-width="100px">
        <el-form-item label="姓名">
          <el-input v-model="newStudent.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="学号">
          <el-input v-model="newStudent.id" placeholder="请输入学号" />
        </el-form-item>
        <el-form-item label="班级">
          <el-select v-model="newStudent.class" placeholder="请选择班级">
            <el-option label="新能源汽车1班" value="新能源汽车1班" />
            <el-option label="新能源汽车2班" value="新能源汽车2班" />
            <el-option label="智能制造班" value="智能制造班" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddStudent = false">取消</el-button>
        <el-button type="primary" @click="addStudent">确认添加</el-button>
      </template>
    </el-dialog>

    <!-- 添加任务对话框 -->
    <el-dialog v-model="showAddTask" title="创建任务" width="600px">
      <el-form :model="newTask" label-width="120px">
        <el-form-item label="任务标题">
          <el-input v-model="newTask.title" placeholder="请输入任务标题" />
        </el-form-item>
        <el-form-item label="任务描述">
          <el-input v-model="newTask.description" type="textarea" :rows="3" placeholder="请输入任务描述" />
        </el-form-item>
        <el-form-item label="截止日期">
          <el-date-picker v-model="newTask.deadline" type="date" placeholder="选择日期" />
        </el-form-item>
        <el-form-item label="选择班级">
          <el-select v-model="newTask.targetClass" placeholder="请选择目标班级">
            <el-option label="新能源汽车1班" value="新能源汽车1班" />
            <el-option label="新能源汽车2班" value="新能源汽车2班" />
            <el-option label="智能制造班" value="智能制造班" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddTask = false">取消</el-button>
        <el-button type="primary" @click="createTask">确认创建</el-button>
      </template>
    </el-dialog>

    <!-- 学生详情对话框 -->
    <el-dialog v-model="showStudentDetail" title="学生详情" width="700px">
      <div v-if="selectedStudent" class="student-detail">
        <div class="detail-header">
          <div class="student-avatar">{{ selectedStudent.name.charAt(0) }}</div>
          <div class="student-info">
            <h3>{{ selectedStudent.name }}</h3>
            <p>学号：{{ selectedStudent.id }} | 班级：{{ selectedStudent.class }}</p>
          </div>
        </div>
        <div class="detail-content">
          <div class="detail-section">
            <h4>📊 学习进度</h4>
            <el-progress :percentage="selectedStudent.progress" />
          </div>
          <div class="detail-section">
            <h4>✅ 已完成任务</h4>
            <ul class="task-list">
              <li v-for="task in selectedStudent.completedTasks" :key="task">{{ task }}</li>
            </ul>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showStudentDetail = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 任务分配对话框 -->
    <el-dialog v-model="showAssignTask" title="分配任务" width="600px">
      <div v-if="assigningStudent">
        <p>为 <strong>{{ assigningStudent.name }}</strong> 分配任务：</p>
        <el-select v-model="selectedTaskId" placeholder="请选择任务">
          <el-option v-for="task in availableTasks" :key="task.id" :label="task.title" :value="task.id" />
        </el-select>
      </div>
      <template #footer>
        <el-button @click="showAssignTask = false">取消</el-button>
        <el-button type="primary" @click="confirmAssignTask">确认分配</el-button>
      </template>
    </el-dialog>

    <!-- 创建考试对话框 -->
    <el-dialog v-model="showCreateExam" title="创建考试" width="700px">
      <el-form :model="newExam" label-width="100px">
        <el-form-item label="考试名称">
          <el-input v-model="newExam.title" placeholder="请输入考试名称" />
        </el-form-item>
        <el-form-item label="考试科目">
          <el-input v-model="newExam.subject" placeholder="请输入考试科目" />
        </el-form-item>
        <el-form-item label="时长(分钟)">
          <el-input-number v-model="newExam.duration" :min="5" :max="180" />
        </el-form-item>
        <el-form-item label="总分">
          <el-input-number v-model="newExam.totalScore" :min="10" :max="200" :step="10" />
        </el-form-item>
        <el-form-item label="截止时间">
          <el-date-picker v-model="newExam.deadline" type="datetime" placeholder="选择截止时间" />
        </el-form-item>
        <el-form-item label="考试步骤">
          <div class="exam-steps-editor">
            <div v-for="(step, index) in newExam.steps" :key="index" class="step-row">
              <span class="step-num">{{ index + 1 }}</span>
              <el-input v-model="step.name" placeholder="步骤名称" size="small" style="flex: 1" />
              <el-input v-model="step.tool" placeholder="工具(可选)" size="small" style="width: 120px" />
              <el-input-number v-model="step.score" :min="0" :max="100" size="small" style="width: 80px" />
              <el-button size="small" type="danger" @click="removeExamStep(index)">删</el-button>
            </div>
            <el-button size="small" type="primary" @click="addExamStep">+ 添加步骤</el-button>
          </div>
        </el-form-item>
        <el-form-item label="目标班级">
          <el-select v-model="newExam.targetClass" placeholder="选择班级" multiple>
            <el-option label="新能源汽车1班" value="新能源汽车1班" />
            <el-option label="新能源汽车2班" value="新能源汽车2班" />
            <el-option label="智能制造班" value="智能制造班" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateExam = false">取消</el-button>
        <el-button type="primary" @click="createExam">创建考试</el-button>
      </template>
    </el-dialog>

    <!-- 评分详情对话框 -->
    <el-dialog v-model="showExamResult" title="评分详情" width="600px">
      <div v-if="selectedExamResult" class="exam-result-detail">
        <div class="result-header">
          <div class="result-info">
            <h3>{{ selectedExamResult.studentName }}</h3>
            <p>{{ selectedExamResult.examTitle }}</p>
          </div>
          <div class="result-score">
            <span class="score-num">{{ selectedExamResult.score }}</span>
            <span class="score-total">/ {{ selectedExamResult.totalScore }}分</span>
          </div>
        </div>
        <el-divider />
        <div class="step-grades">
          <h4>步骤评分</h4>
          <div v-for="(step, index) in selectedExamResult.stepResults" :key="index" class="step-grade">
            <span class="step-idx">{{ index + 1 }}</span>
            <span class="step-name">{{ step.name }}</span>
            <span class="step-score">{{ step.score }}分</span>
            <el-tag size="small" :type="step.passed ? 'success' : 'danger'">
              {{ step.passed ? '通过' : '未通过' }}
            </el-tag>
          </div>
        </div>
        <div class="result-comment">
          <h4>教师评语</h4>
          <p>{{ selectedExamResult.feedback || '暂无评语' }}</p>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { Plus, Search } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { minimizeWindow, maximizeWindow, closeApp } from '../utils/tauri-api.js';

const router = useRouter();
const activeMenu = ref('students');
const searchQuery = ref('');
const taskFilter = ref('all');
const progressClassFilter = ref('all');
const reportStatusFilter = ref('all');

const showAddStudent = ref(false);
const showAddTask = ref(false);
const showStudentDetail = ref(false);
const showAssignTask = ref(false);

const selectedStudent = ref(null);
const assigningStudent = ref(null);
const selectedTaskId = ref('');

// 菜单配置
const menuItems = [
  { key: 'students', label: '学生管理', icon: '👨‍🎓' },
  { key: 'tasks', label: '任务管理', icon: '📋' },
  { key: 'progress', label: '学习进度', icon: '📊' },
  { key: 'reports', label: '实验报告', icon: '📝' },
  { key: 'exam', label: '考试管理', icon: '🎯' }
];

// 学生数据
const students = ref([
  { id: '20240001', name: '张三', class: '新能源汽车1班', status: '训练中', progress: 85, score: 92, completedTasks: ['电路基础实验', '电机控制实验'] },
  { id: '20240002', name: '李四', class: '新能源汽车1班', status: '在线', progress: 72, score: 85, completedTasks: ['电路基础实验'] },
  { id: '20240003', name: '王五', class: '新能源汽车1班', status: '训练中', progress: 95, score: 98, completedTasks: ['电路基础实验', '电机控制实验', '电池管理实验'] },
  { id: '20240004', name: '赵六', class: '新能源汽车2班', status: '离线', progress: 45, score: 70, completedTasks: [] },
  { id: '20240005', name: '钱七', class: '新能源汽车2班', status: '在线', progress: 68, score: 82, completedTasks: ['电路基础实验'] },
  { id: '20240006', name: '孙八', class: '智能制造班', status: '训练中', progress: 88, score: 90, completedTasks: ['PLC编程实验', '传感器实验'] }
]);

// 任务数据
const tasks = ref([
  { id: 't1', title: '电路基础实验', description: '学习电路基本原理，完成基础电路连接实验', deadline: '2024-03-15', status: 'completed', totalStudents: 6, assignedCount: 6, completionRate: 100 },
  { id: 't2', title: '电机控制实验', description: '学习直流电机控制原理，完成电机调速实验', deadline: '2024-03-20', status: 'in_progress', totalStudents: 6, assignedCount: 6, completionRate: 67 },
  { id: 't3', title: '电池管理实验', description: '学习锂电池管理系统，完成电池充放电实验', deadline: '2024-03-25', status: 'in_progress', totalStudents: 6, assignedCount: 4, completionRate: 33 },
  { id: 't4', title: 'PLC编程实验', description: '学习PLC基本编程，完成自动化控制实验', deadline: '2024-03-30', status: 'pending', totalStudents: 6, assignedCount: 0, completionRate: 0 }
]);

// 报告数据
const reports = ref([
  { id: 'r1', studentName: '张三', studentId: '20240001', taskName: '电路基础实验', submitTime: '2024-03-10 14:30', status: 'graded', score: 95 },
  { id: 'r2', studentName: '李四', studentId: '20240002', taskName: '电路基础实验', submitTime: '2024-03-11 16:20', status: 'graded', score: 88 },
  { id: 'r3', studentName: '王五', studentId: '20240003', taskName: '电机控制实验', submitTime: '2024-03-18 10:15', status: 'excellent', score: 98 },
  { id: 'r4', studentName: '赵六', studentId: '20240004', taskName: '电路基础实验', submitTime: '2024-03-12 09:45', status: 'pending', score: null },
  { id: 'r5', studentName: '钱七', studentId: '20240005', taskName: '电机控制实验', submitTime: '2024-03-19 15:30', status: 'pending', score: null }
]);

// 新学生表单
const newStudent = reactive({
  name: '',
  id: '',
  class: ''
});

// 新任务表单
const newTask = reactive({
  title: '',
  description: '',
  deadline: '',
  targetClass: ''
});

// ========== 考试相关数据 ==========
const examTab = ref('list')
const showCreateExam = ref(false)
const showExamResult = ref(false)
const selectedExamResult = ref(null)

// 考试列表
const examList = ref([
  {
    id: 'e1',
    title: '显微镜使用实操考试',
    subject: '生物实验',
    duration: 15,
    totalScore: 100,
    deadline: '2025-03-20 18:00',
    status: 'active',
    submittedCount: 3,
    pendingCount: 1,
    steps: [
      { name: '取出玻片', tool: '镊子', score: 10 },
      { name: '滴加清水', tool: '滴管', score: 15 },
      { name: '放置玻片', tool: null, score: 15 },
      { name: '调焦观察', tool: null, score: 30 },
      { name: '规范操作', tool: null, score: 30 }
    ],
    targetClass: ['新能源汽车1班', '新能源汽车2班']
  },
  {
    id: 'e2',
    title: '电路焊接实操考试',
    subject: '电子技术',
    duration: 20,
    totalScore: 100,
    deadline: '2025-03-25 18:00',
    status: 'pending',
    submittedCount: 0,
    pendingCount: 6,
    steps: [
      { name: '准备工具', tool: '电烙铁', score: 10 },
      { name: '清洁元件', tool: null, score: 15 },
      { name: '焊接操作', tool: '焊锡', score: 40 },
      { name: '检查验收', tool: null, score: 35 }
    ],
    targetClass: ['智能制造班']
  }
])

// 考试视频
const examVideos = ref([
  { id: 'v1', studentName: '张三', examTitle: '显微镜使用实操考试', uploadTime: '2025-03-10 14:30', duration: '12:25', status: '已评判', score: 85 },
  { id: 'v2', studentName: '李四', examTitle: '显微镜使用实操考试', uploadTime: '2025-03-10 15:45', duration: '14:10', status: '已评判', score: 92 },
  { id: 'v3', studentName: '王五', examTitle: '显微镜使用实操考试', uploadTime: '2025-03-11 09:20', duration: '13:30', status: '待评判', score: null },
  { id: 'v4', studentName: '赵六', examTitle: '显微镜使用实操考试', uploadTime: '2025-03-11 10:15', duration: '15:00', status: '待评判', score: null }
])

// 考试结果
const examResults = ref([
  { studentName: '张三', examTitle: '显微镜使用实操考试', submitTime: '2025-03-10 14:30', score: 85, totalScore: 100, feedback: '操作规范，动作标准' },
  { studentName: '李四', examTitle: '显微镜使用实操考试', submitTime: '2025-03-10 15:45', score: 92, totalScore: 100, feedback: '表现优秀，步骤完整' },
  { studentName: '钱七', examTitle: '电路焊接实操考试', submitTime: '2025-03-09 11:20', score: 78, totalScore: 100, feedback: '焊接质量良好，需注意第三步操作速度' }
])

// 新建考试表单
const newExam = reactive({
  title: '',
  subject: '',
  duration: 15,
  totalScore: 100,
  deadline: '',
  targetClass: [],
  steps: [
    { name: '', tool: '', score: 10 }
  ]
})

// 计算属性
const pendingEvalCount = computed(() => examVideos.value.filter(v => v.status === '待评判').length)
const evaluatedCount = computed(() => examVideos.value.filter(v => v.status === '已评判').length)
const averageExamScore = computed(() => {
  const scored = examResults.value.filter(r => r.score !== null)
  if (scored.length === 0) return 0
  return Math.round(scored.reduce((a, b) => a + b.score, 0) / scored.length)
})
const highestScore = computed(() => {
  const scored = examResults.value.filter(r => r.score !== null)
  if (scored.length === 0) return 0
  return Math.max(...scored.map(r => r.score))
})
const lowestScore = computed(() => {
  const scored = examResults.value.filter(r => r.score !== null)
  if (scored.length === 0) return 0
  return Math.min(...scored.map(r => r.score))
})

// 考试方法
const getExamStatusType = (status) => {
  const types = { active: 'success', pending: 'warning', ended: 'info' }
  return types[status] || 'info'
}

const getExamStatusLabel = (status) => {
  const labels = { active: '进行中', pending: '未开始', ended: '已结束' }
  return labels[status] || status
}

const getVideoStatusType = (status) => {
  const types = { '待评判': 'warning', '已评判': 'success' }
  return types[status] || 'info'
}

const addExamStep = () => {
  newExam.steps.push({ name: '', tool: '', score: 10 })
}

const removeExamStep = (index) => {
  if (newExam.steps.length > 1) {
    newExam.steps.splice(index, 1)
  }
}

const createExam = () => {
  if (!newExam.title || !newExam.subject) {
    ElMessage.error('请填写考试名称和科目')
    return
  }
  if (newExam.steps.some(s => !s.name)) {
    ElMessage.error('请填写所有步骤名称')
    return
  }
  
  const exam = {
    id: 'e' + Date.now(),
    title: newExam.title,
    subject: newExam.subject,
    duration: newExam.duration,
    totalScore: newExam.totalScore,
    deadline: newExam.deadline ? new Date(newExam.deadline).toLocaleString() : '未设置',
    status: 'pending',
    submittedCount: 0,
    pendingCount: students.value.filter(s => newExam.targetClass.includes(s.class)).length,
    steps: [...newExam.steps],
    targetClass: [...newExam.targetClass]
  }
  
  examList.value.push(exam)
  
  // 重置表单
  newExam.title = ''
  newExam.subject = ''
  newExam.duration = 15
  newExam.totalScore = 100
  newExam.deadline = ''
  newExam.targetClass = []
  newExam.steps = [{ name: '', tool: '', score: 10 }]
  
  showCreateExam.value = false
  ElMessage.success('考试创建成功')
}

const viewExamDetail = (exam) => {
  ElMessage.info('查看考试详情: ' + exam.title)
}

const startExamEvaluation = (exam) => {
  ElMessage.success('开始评判: ' + exam.title)
  examTab.value = 'videos'
}

const deleteExam = (exam) => {
  ElMessageBox.confirm(`确定删除考试 "${exam.title}" 吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    examList.value = examList.value.filter(e => e.id !== exam.id)
    ElMessage.success('考试已删除')
  }).catch(() => {})
}

const previewExamVideo = (video) => {
  ElMessage.info('预览视频: ' + video.studentName)
}

const evaluateExamVideo = (video) => {
  // 模拟评判
  const exam = examList.value.find(e => e.title === video.examTitle)
  const totalScore = exam?.totalScore || 100
  const score = Math.floor(Math.random() * 30 + 70)
  
  video.score = score
  video.status = '已评判'
  
  examResults.value.push({
    studentName: video.studentName,
    examTitle: video.examTitle,
    submitTime: video.uploadTime,
    score: score,
    totalScore: totalScore,
    feedback: score >= 90 ? '表现优秀' : score >= 60 ? '合格' : '需加强练习'
  })
  
  ElMessage.success('评判完成，得分: ' + score + '分')
}

const viewExamResult = (result) => {
  selectedExamResult.value = {
    ...result,
    stepResults: examList.value.find(e => e.title === result.examTitle)?.steps.map(s => ({
      name: s.name,
      score: Math.floor(s.score * (result.score / result.totalScore)),
      passed: Math.random() > 0.2
    })) || []
  }
  showExamResult.value = true
}

const exportExamReport = (result) => {
  ElMessage.success('导出考试报告: ' + result.studentName)
}

// 计算属性
const onlineCount = computed(() => students.value.filter(s => s.status === '在线' || s.status === '训练中').length);

const completedTasks = computed(() => {
  return students.value.reduce((sum, s) => sum + s.completedTasks.length, 0);
});

const filteredStudents = computed(() => {
  if (!searchQuery.value) return students.value;
  const query = searchQuery.value.toLowerCase();
  return students.value.filter(s => 
    s.name.toLowerCase().includes(query) || 
    s.id.toLowerCase().includes(query) ||
    s.class.toLowerCase().includes(query)
  );
});

const filteredTasks = computed(() => {
  if (taskFilter.value === 'all') return tasks.value;
  return tasks.value.filter(t => t.status === taskFilter.value);
});

const filteredReports = computed(() => {
  if (reportStatusFilter.value === 'all') return reports.value;
  return reports.value.filter(r => r.status === reportStatusFilter.value);
});

const classProgress = computed(() => [
  { className: '新能源汽车1班', percentage: 84 },
  { className: '新能源汽车2班', percentage: 57 },
  { className: '智能制造班', percentage: 88 }
]);

const totalTasks = computed(() => tasks.value.length);
const completedTasksCount = computed(() => tasks.value.filter(t => t.status === 'completed').length);
const inProgressTasks = computed(() => tasks.value.filter(t => t.status === 'in_progress').length);
const pendingTasks = computed(() => tasks.value.filter(t => t.status === 'pending').length);

const topStudents = computed(() => {
  return [...students.value].sort((a, b) => b.score - a.score).slice(0, 5);
});

const availableTasks = computed(() => tasks.value.filter(t => t.status !== 'completed'));

// 方法
const goBack = () => {
  router.push('/');
};

const minimize = () => minimizeWindow();
const maximize = () => maximizeWindow();
const close = () => closeApp();

const getStatusType = (status) => {
  const types = {
    '训练中': 'success',
    '在线': 'primary',
    '离线': 'danger'
  };
  return types[status] || 'info';
};

const getScoreType = (score) => {
  if (score >= 90) return 'success';
  if (score >= 80) return 'primary';
  if (score >= 60) return 'warning';
  return 'danger';
};

const getTaskStatusType = (status) => {
  const types = {
    'completed': 'success',
    'in_progress': 'primary',
    'pending': 'warning'
  };
  return types[status] || 'info';
};

const getTaskStatusLabel = (status) => {
  const labels = {
    'completed': '已完成',
    'in_progress': '进行中',
    'pending': '待分配'
  };
  return labels[status] || status;
};

const getReportStatusType = (status) => {
  const types = {
    'pending': 'warning',
    'graded': 'primary',
    'excellent': 'success'
  };
  return types[status] || 'info';
};

const getReportStatusLabel = (status) => {
  const labels = {
    'pending': '待批改',
    'graded': '已批改',
    'excellent': '优秀'
  };
  return labels[status] || status;
};

const addStudent = () => {
  if (!newStudent.name || !newStudent.id || !newStudent.class) {
    ElMessage.error('请填写完整信息');
    return;
  }
  students.value.push({
    id: newStudent.id,
    name: newStudent.name,
    class: newStudent.class,
    status: '离线',
    progress: 0,
    score: 0,
    completedTasks: []
  });
  showAddStudent.value = false;
  newStudent.name = '';
  newStudent.id = '';
  newStudent.class = '';
  ElMessage.success('学生添加成功');
};

const removeStudent = (student) => {
  const index = students.value.findIndex(s => s.id === student.id);
  if (index > -1) {
    students.value.splice(index, 1);
    ElMessage.success('学生已删除');
  }
};

const viewStudentDetail = (student) => {
  selectedStudent.value = student;
  showStudentDetail.value = true;
};

const assignTask = (student) => {
  assigningStudent.value = student;
  selectedTaskId.value = '';
  showAssignTask.value = true;
};

const confirmAssignTask = () => {
  if (!selectedTaskId.value) {
    ElMessage.error('请选择任务');
    return;
  }
  const task = tasks.value.find(t => t.id === selectedTaskId.value);
  if (task) {
    task.assignedCount++;
    ElMessage.success(`已为 ${assigningStudent.value.name} 分配任务：${task.title}`);
  }
  showAssignTask.value = false;
};

const createTask = () => {
  if (!newTask.title || !newTask.description || !newTask.deadline) {
    ElMessage.error('请填写完整信息');
    return;
  }
  tasks.value.push({
    id: 't' + Date.now(),
    title: newTask.title,
    description: newTask.description,
    deadline: newTask.deadline,
    status: 'pending',
    totalStudents: students.value.filter(s => s.class === newTask.targetClass).length || students.value.length,
    assignedCount: 0,
    completionRate: 0
  });
  showAddTask.value = false;
  newTask.title = '';
  newTask.description = '';
  newTask.deadline = '';
  newTask.targetClass = '';
  ElMessage.success('任务创建成功');
};

const editTask = (task) => {
  ElMessage.info(`编辑任务：${task.title}`);
};

const viewTaskDetail = (task) => {
  ElMessage.info(`查看任务详情：${task.title}`);
};

const viewReport = (report) => {
  ElMessage.info(`查看 ${report.studentName} 的实验报告`);
};

const gradeReport = (report) => {
  ElMessage.success(`已批改 ${report.studentName} 的报告`);
  report.status = 'graded';
  report.score = Math.floor(Math.random() * 20) + 80;
};
</script>

<style lang="scss" scoped>
.students-view {
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.title-bar {
  height: 48px;
  background: rgba(15, 23, 42, 0.95);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  -webkit-app-region: drag;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

  .title {
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 10px;

    .title-icon {
      font-size: 20px;
    }
  }

  .window-controls {
    display: flex;
    gap: 8px;
    -webkit-app-region: no-drag;

    .control-btn {
      width: 36px;
      height: 36px;
      border: none;
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
      border-radius: 8px;
      cursor: pointer;
      font-size: 18px;
      transition: all 0.2s;

      &:hover {
        background: rgba(233, 69, 96, 0.8);
      }

      &.close:hover {
        background: rgba(233, 69, 96, 1);
      }
    }
  }
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar {
  width: 220px;
  background: rgba(15, 23, 42, 0.95);
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(255, 255, 255, 0.1);

  .sidebar-header {
    padding: 24px;
    text-align: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);

    .logo {
      font-size: 48px;
      margin-bottom: 8px;
    }

    .logo-text {
      color: #fff;
      font-size: 16px;
      font-weight: 600;
    }
  }

  .nav-menu {
    flex: 1;
    padding: 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;

    .nav-item {
      display: flex;
      align-items: center;
      padding: 12px 14px;
      gap: 12px;
      border: none;
      background: transparent;
      color: rgba(255, 255, 255, 0.6);
      font-size: 14px;
      cursor: pointer;
      border-radius: 8px;
      transition: all 0.3s;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }

      &.active {
        background: linear-gradient(135deg, #4A90E2 0%, #66B1FF 100%);
        color: #fff;
      }

      .nav-icon {
        font-size: 18px;
      }
    }
  }

  .stats-panel {
    padding: 16px;
    background: rgba(74, 144, 226, 0.1);
    border-top: 1px solid rgba(255, 255, 255, 0.1);

    .stat-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);

      &:last-child {
        border-bottom: none;
      }

      .stat-value {
        color: #4A90E2;
        font-size: 20px;
        font-weight: 600;
      }

      .stat-label {
        color: rgba(255, 255, 255, 0.6);
        font-size: 12px;
      }
    }
  }
}

.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.content-panel {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);

    h2 {
      color: #fff;
      font-size: 18px;
      margin: 0;
    }

    .panel-actions {
      display: flex;
      align-items: center;
      gap: 12px;

      .search-input {
        width: 200px;
      }
    }
  }

  .panel-body {
    padding: 20px;

    :deep(.el-table) {
      background: transparent;

      .el-table__header th {
        background: rgba(255, 255, 255, 0.05) !important;
        color: rgba(255, 255, 255, 0.8);
        border-color: rgba(255, 255, 255, 0.1);
      }

      .el-table__row {
        background: transparent;

        &:hover {
          background: rgba(255, 255, 255, 0.05) !important;
        }

        td {
          border-color: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.9);
        }
      }
    }
  }
}

.progress-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;

  :deep(.el-progress) {
    flex: 1;
  }

  .progress-text {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.8);
    min-width: 40px;
  }
}

.task-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 16px;
}

.task-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 0.3s;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-2px);
  }

  &.completed {
    border-color: rgba(74, 222, 128, 0.3);
    background: rgba(74, 222, 128, 0.05);
  }

  .task-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;

    .task-icon {
      font-size: 20px;
    }

    .task-title {
      flex: 1;
      color: #fff;
      font-weight: 600;
    }
  }

  .task-info {
    margin-bottom: 12px;

    .task-desc {
      color: rgba(255, 255, 255, 0.6);
      font-size: 13px;
      margin: 0 0 8px;
      line-height: 1.4;
    }

    .task-meta {
      display: flex;
      gap: 16px;

      .meta-item {
        color: rgba(255, 255, 255, 0.5);
        font-size: 12px;
      }
    }
  }

  .task-progress {
    margin-bottom: 12px;

    .progress-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      color: rgba(255, 255, 255, 0.6);
      font-size: 12px;
    }
  }

  .task-actions {
    display: flex;
    gap: 8px;
  }
}

.progress-charts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.chart-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);

  h3 {
    color: #fff;
    font-size: 15px;
    margin: 0 0 16px;
  }

  .progress-bars {
    display: flex;
    flex-direction: column;
    gap: 12px;

    .progress-item {
      .progress-label {
        color: rgba(255, 255, 255, 0.8);
        font-size: 13px;
        margin-bottom: 4px;
      }
    }
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;

    .stat-card {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 12px;
      text-align: center;

      &.success {
        border: 1px solid rgba(74, 222, 128, 0.3);
      }

      &.warning {
        border: 1px solid rgba(251, 191, 36, 0.3);
      }

      &.danger {
        border: 1px solid rgba(239, 68, 68, 0.3);
      }

      .stat-num {
        color: #fff;
        font-size: 28px;
        font-weight: 600;
      }

      .stat-name {
        color: rgba(255, 255, 255, 0.6);
        font-size: 12px;
        margin-top: 4px;
      }
    }
  }

  :deep(.el-table) {
    background: transparent;
    font-size: 13px;

    .rank {
      font-size: 16px;
      font-weight: 600;

      &.rank-1 { color: #FFD700; }
      &.rank-2 { color: #C0C0C0; }
      &.rank-3 { color: #CD7F32; }
    }
  }
}

.student-detail {
  .detail-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);

    .student-avatar {
      width: 64px;
      height: 64px;
      background: linear-gradient(135deg, #4A90E2 0%, #66B1FF 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 28px;
      font-weight: 600;
    }

    .student-info h3 {
      color: #fff;
      margin: 0 0 4px;
    }

    .student-info p {
      color: rgba(255, 255, 255, 0.6);
      font-size: 13px;
      margin: 0;
    }
  }

  .detail-content {
    .detail-section {
      margin-bottom: 16px;

      h4 {
        color: rgba(255, 255, 255, 0.8);
        font-size: 14px;
        margin: 0 0 8px;
      }

      .task-list {
        list-style: none;
        padding: 0;
        margin: 0;

        li {
          color: rgba(255, 255, 255, 0.7);
          font-size: 13px;
          padding: 4px 0;
          padding-left: 16px;
          position: relative;

          &:before {
            content: '✓';
            position: absolute;
            left: 0;
            color: #4ADE80;
          }
        }
      }
    }
  }
}

// ========== 考试管理样式 ==========
.exam-panel {
  .exam-tabs {
    :deep(.el-tabs__header) {
      margin: 0 0 15px;
    }
  }
}

.exam-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  
  .exam-card {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    
    .exam-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      
      h4 {
        margin: 0;
        color: #fff;
        font-size: 16px;
      }
    }
    
    .exam-info {
      margin-bottom: 12px;
      
      p {
        margin: 4px 0;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.7);
      }
    }
    
    .exam-stats {
      display: flex;
      gap: 15px;
      margin-bottom: 12px;
      font-size: 12px;
      color: #10B981;
    }
    
    .exam-actions {
      display: flex;
      gap: 8px;
    }
  }
  
  .empty-state {
    grid-column: 1 / -1;
    text-align: center;
    padding: 60px 20px;
    color: rgba(255, 255, 255, 0.5);
    
    p {
      margin-bottom: 20px;
      font-size: 16px;
    }
  }
}

.exam-steps-editor {
  .step-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
    
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
  }
}

.video-list {
  .upload-stats {
    display: flex;
    gap: 20px;
    margin-bottom: 20px;
    
    .stat-card {
      flex: 1;
      padding: 20px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      text-align: center;
      
      .stat-num {
        display: block;
        font-size: 28px;
        font-weight: 700;
        color: #06B6D4;
      }
      
      .stat-name {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
      }
      
      &.warning .stat-num {
        color: #F59E0B;
      }
      
      &.success .stat-num {
        color: #10B981;
      }
    }
  }
  
  .score-val {
    font-weight: 600;
    
    &.high { color: #10B981; }
    &.mid { color: #F59E0B; }
    &.low { color: #EF4444; }
  }
}

.results-summary {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  
  .summary-card {
    flex: 1;
    padding: 20px;
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(6, 182, 212, 0.05) 100%);
    border-radius: 12px;
    border: 1px solid rgba(6, 182, 212, 0.3);
    display: flex;
    align-items: center;
    gap: 15px;
    
    .summary-icon {
      font-size: 32px;
    }
    
    .summary-info {
      display: flex;
      flex-direction: column;
      
      .summary-value {
        font-size: 28px;
        font-weight: 700;
        color: #06B6D4;
      }
      
      .summary-label {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
      }
    }
  }
}

.exam-result-detail {
  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .result-info {
      h3 {
        margin: 0 0 5px;
        color: #fff;
      }
      
      p {
        margin: 0;
        color: rgba(255, 255, 255, 0.6);
        font-size: 14px;
      }
    }
    
    .result-score {
      text-align: right;
      
      .score-num {
        font-size: 36px;
        font-weight: 700;
        color: #10B981;
      }
      
      .score-total {
        font-size: 16px;
        color: rgba(255, 255, 255, 0.5);
      }
    }
  }
  
  .step-grades {
    margin: 20px 0;
    
    h4 {
      margin-bottom: 12px;
      color: #fff;
    }
    
    .step-grade {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      margin-bottom: 8px;
      
      .step-idx {
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
        color: #fff;
      }
      
      .step-score {
        color: #06B6D4;
        font-weight: 600;
      }
    }
  }
  
  .result-comment {
    h4 {
      margin-bottom: 10px;
      color: #fff;
    }
    
    p {
      padding: 15px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      color: rgba(255, 255, 255, 0.7);
    }
  }
}

.text-gray {
  color: rgba(255, 255, 255, 0.4);
}
</style>