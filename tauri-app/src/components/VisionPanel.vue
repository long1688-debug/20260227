<template>
  <div class="vision-panel">
    <!-- 标签页切换 -->
    <div class="tabs">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ tab.icon }} {{ tab.name }}
      </button>
    </div>

    <!-- COCO 数据集管理 -->
    <div v-if="activeTab === 'coco'" class="tab-content">
      <div class="section">
        <h3>📁 COCO 数据集配置</h3>
        <div class="form-group">
          <label>数据集路径:</label>
          <div class="path-input-group">
            <input 
              v-model="datasetPath" 
              type="text" 
              class="form-input"
              placeholder="输入 COCO 数据集路径"
            />
            <button class="btn btn-secondary" @click="browseDatasetPath">浏览</button>
          </div>
          <button class="btn btn-primary" @click="saveDatasetPath">保存路径</button>
        </div>

        <button class="btn btn-info" @click="validateDataset">验证数据集</button>
        <button class="btn btn-info" @click="getDatasetStats">获取统计</button>

        <div v-if="validationResult" class="result-card">
          <h4>验证结果</h4>
          <div class="validation-checks">
            <div 
              v-for="check in validationResult.checks" 
              :key="check.name"
              class="check-item"
              :class="{ pass: check.exists, fail: !check.exists && check.required }"
            >
              <span>{{ check.name }}</span>
              <span class="status">{{ check.exists ? '✓' : '✗' }}</span>
            </div>
          </div>
          <div class="valid-badge" :class="{ valid: validationResult.is_valid }">
            {{ validationResult.is_valid ? '✓ 数据集完整' : '✗ 数据集不完整' }}
          </div>
        </div>

        <div v-if="datasetStats" class="stats-card">
          <h4>数据集统计</h4>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-value">{{ datasetStats.total_images }}</span>
              <span class="stat-label">图片总数</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ datasetStats.total_annotations }}</span>
              <span class="stat-label">标注总数</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ datasetStats.total_categories }}</span>
              <span class="stat-label">类别数</span>
            </div>
          </div>
        </div>

        <div class="search-section">
          <h4>🔍 按类别搜索</h4>
          <div class="search-input-group">
            <select v-model="searchCategory" class="form-input">
              <option value="">选择类别</option>
              <option v-for="label in cocoLabels" :key="label" :value="label">{{ label }}</option>
            </select>
            <button class="btn btn-primary" @click="searchImages">搜索</button>
          </div>
          <div v-if="searchResults.length > 0" class="search-results">
            <div v-for="(img, idx) in searchResults" :key="idx" class="result-item">
              {{ img.name }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 智能视觉分析 -->
    <div v-if="activeTab === 'analysis'" class="tab-content">
      <div class="section">
        <h3>🔍 智能视觉分析</h3>
        
        <div class="form-group">
          <label>图片路径:</label>
          <div class="path-input-group">
            <input 
              v-model="imagePath" 
              type="text" 
              class="form-input"
              placeholder="输入图片路径"
            />
            <button class="btn btn-secondary" @click="browseImage">浏览</button>
          </div>
          <button class="btn btn-primary" @click="analyzeImage">开始分析</button>
        </div>

        <div v-if="analysisResult" class="result-card">
          <h4>分析结果</h4>
          <div class="analysis-results">
            <div class="result-section">
              <h5>👤 人脸检测 ({{ analysisResult.faces.length }})</h5>
              <div v-if="analysisResult.faces.length > 0">
                <div v-for="(face, idx) in analysisResult.faces" :key="idx" class="detected-item">
                  人脸 {{ idx + 1 }}: 置信度 {{ (face.confidence * 100).toFixed(1) }}%
                </div>
              </div>
            </div>

            <div class="result-section">
              <h5>📦 物体检测 ({{ analysisResult.objects.length }})</h5>
              <div v-if="analysisResult.objects.length > 0">
                <div v-for="(obj, idx) in analysisResult.objects" :key="idx" class="detected-item">
                  <span class="label">{{ obj.label }}</span>
                  <span class="confidence">{{ (obj.confidence * 100).toFixed(1) }}%</span>
                </div>
              </div>
            </div>

            <div class="result-section">
              <h5>🎯 专注度</h5>
              <div class="attention-bar">
                <div class="attention-fill" :style="{ width: analysisResult.attention_score + '%' }"></div>
                <span class="attention-text">{{ analysisResult.attention_score.toFixed(1) }}%</span>
              </div>
            </div>

            <div class="result-section">
              <h5>😊 情绪分析</h5>
              <div v-if="analysisResult.emotions.length > 0">
                <div v-for="(emotion, idx) in analysisResult.emotions" :key="idx" class="emotion-item">
                  人脸 {{ idx + 1 }}: {{ emotion.dominant_emotion }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="history-section">
          <h4>📜 分析历史 ({{ analysisHistory.length }})</h4>
          <button class="btn btn-danger" @click="clearHistory">清除历史</button>
          <div v-if="analysisHistory.length > 0" class="history-list">
            <div v-for="(item, idx) in analysisHistory.slice(0, 5)" :key="idx" class="history-item">
              <span>{{ item.timestamp }}</span>
              <span>{{ item.objects.length }} 个物体</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- AI 评估系统 -->
    <div v-if="activeTab === 'evaluation'" class="tab-content">
      <div class="section">
        <h3>🏆 AI 评估系统</h3>

        <div class="form-group">
          <h4>考试配置</h4>
          <label>考试时长 (秒):</label>
          <input v-model.number="examConfig.duration" type="number" class="form-input small" />
          
          <label>最小置信度:</label>
          <input v-model.number="examConfig.min_confidence" type="number" step="0.1" min="0" max="1" class="form-input small" />
          
          <label>需要检测的物体:</label>
          <div class="object-tags">
            <div 
              v-for="(obj, idx) in examConfig.required_objects" 
              :key="idx" 
              class="tag"
            >
              {{ obj }}
              <button @click="removeObject(idx)">×</button>
            </div>
          </div>
          <div class="add-object">
            <input v-model="newObject" type="text" placeholder="输入物体名称" class="form-input" />
            <button class="btn btn-secondary" @click="addObject">添加</button>
          </div>
          <button class="btn btn-primary" @click="saveExamConfig">保存配置</button>
        </div>

        <div class="batch-section">
          <h4>📊 批量测试</h4>
          <div class="form-group">
            <label>测试图片数量:</label>
            <input v-model.number="batchCount" type="number" class="form-input small" />
            <button class="btn btn-primary" @click="startBatchTest">开始测试</button>
          </div>

          <div v-if="batchResult" class="result-card">
            <h4>测试结果</h4>
            <div class="batch-stats">
              <div class="batch-stat">
                <span class="stat-value">{{ batchResult.total }}</span>
                <span class="stat-label">测试图片</span>
              </div>
              <div class="batch-stat">
                <span class="stat-value">{{ batchResult.correct }}</span>
                <span class="stat-label">正确检测</span>
              </div>
              <div class="batch-stat">
                <span class="stat-value">{{ batchResult.accuracy }}%</span>
                <span class="stat-label">准确率</span>
              </div>
              <div class="batch-stat">
                <span class="stat-value">{{ batchResult.total_detections }}</span>
                <span class="stat-label">总检测数</span>
              </div>
            </div>
          </div>
        </div>

        <div class="exam-section">
          <h4>📝 模拟考试评分</h4>
          <button class="btn btn-primary" @click="runSimulatedExam">运行模拟考试</button>
          
          <div v-if="examScore" class="result-card">
            <h4>考试评分结果</h4>
            <div class="score-display">
              <div class="final-score">{{ examScore.score }}</div>
              <div class="score-label">最终得分</div>
            </div>
            <div v-if="examScore.object_scores.length > 0">
              <h5>各物体得分:</h5>
              <div v-for="obj in examScore.object_scores" :key="obj.object" class="object-score">
                <span>{{ obj.object }}</span>
                <span class="score-bar">
                  <div :style="{ width: obj.score + '%' }"></div>
                </span>
                <span>{{ obj.score }}分</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>import { ref, reactive } from 'vue';
import { tauriVision, COCO_LABELS } from '@/services';
const tabs = [
 { id: 'coco', name: 'COCO 数据集', icon: '📁' },
 { id: 'analysis', name: '智能视觉分析', icon: '🔍' },
 { id: 'evaluation', name: 'AI 评估系统', icon: '🏆' }
];
const activeTab = ref('coco');
// COCO 数据集相关
const datasetPath = ref('F:\\coco');
const validationResult = ref(null);
const datasetStats = ref(null);
const searchCategory = ref('');
const searchResults = ref([]);
const cocoLabels = COCO_LABELS;
// 视觉分析相关
const imagePath = ref('');
const analysisResult = ref(null);
const analysisHistory = ref([]);
// AI 评估相关
const examConfig = reactive({
 duration: 60,
 required_objects: ['person', 'hand'],
 min_confidence: 0.5
});
const newObject = ref('');
const batchCount = ref(10);
const batchResult = ref(null);
const examScore = ref(null);
// COCO 数据集方法
const browseDatasetPath = async () => {
 const { open } = await import('@tauri-apps/api/dialog');
 const result = await open({
 directory: true,
 title: '选择 COCO 数据集目录'
 });
 if (result) {
 datasetPath.value = result;
 }
};
const saveDatasetPath = async () => {
 try {
 await tauriVision.coco.setDatasetPath(datasetPath.value);
 alert('路径保存成功');
 }
 catch (e) {
 console.error('保存路径失败:', e);
 }
};
const validateDataset = async () => {
 try {
 validationResult.value = await tauriVision.coco.validateDataset();
 }
 catch (e) {
 console.error('验证数据集失败:', e);
 }
};
const getDatasetStats = async () => {
 try {
 datasetStats.value = await tauriVision.coco.getStatistics();
 }
 catch (e) {
 console.error('获取统计失败:', e);
 }
};
const searchImages = async () => {
 if (!searchCategory.value)
 return;
 try {
 searchResults.value = await tauriVision.coco.searchImagesByCategory(searchCategory.value, 5);
 }
 catch (e) {
 console.error('搜索失败:', e);
 }
};
// 视觉分析方法
const browseImage = async () => {
 const { open } = await import('@tauri-apps/api/dialog');
 const result = await open({
 filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png'] }],
 title: '选择图片'
 });
 if (result) {
 imagePath.value = result;
 }
};
const analyzeImage = async () => {
 if (!imagePath.value)
 return;
 try {
 analysisResult.value = await tauriVision.analysis.analyzeImage(imagePath.value);
 await loadHistory();
 }
 catch (e) {
 console.error('分析失败:', e);
 }
};
const loadHistory = async () => {
 try {
 analysisHistory.value = await tauriVision.analysis.getAnalysisHistory();
 }
 catch (e) {
 console.error('获取历史失败:', e);
 }
};
const clearHistory = async () => {
 try {
 await tauriVision.analysis.clearAnalysisHistory();
 analysisHistory.value = [];
 analysisResult.value = null;
 }
 catch (e) {
 console.error('清除历史失败:', e);
 }
};
// AI 评估方法
const addObject = () => {
 if (newObject.value && !examConfig.required_objects.includes(newObject.value)) {
 examConfig.required_objects.push(newObject.value);
 newObject.value = '';
 }
};
const removeObject = (idx) => {
 examConfig.required_objects.splice(idx, 1);
};
const saveExamConfig = async () => {
 try {
 await tauriVision.evaluation.setExamConfig(examConfig);
 alert('配置保存成功');
 }
 catch (e) {
 console.error('保存配置失败:', e);
 }
};
const startBatchTest = async () => {
 try {
 batchResult.value = await tauriVision.evaluation.startBatchTest(batchCount.value);
 }
 catch (e) {
 console.error('批量测试失败:', e);
 }
};
const runSimulatedExam = async () => {
 // 生成模拟考试帧数据
 const examResults = [];
 for (let i = 0; i < 30; i++) {
 const objects = [];
 const labels = examConfig.required_objects;
 // 随机生成检测结果
 for (const label of labels) {
 if (Math.random() > 0.3) {
 objects.push({
 label,
 confidence: 0.5 + Math.random() * 0.45,
 bbox: { x: 0, y: 0, width: 0, height: 0 }
 });
 }
 }
 examResults.push({
 objects,
 timestamp: Date.now()
 });
 }
 try {
 // 保存配置
 await tauriVision.evaluation.setExamConfig(examConfig);
 // 分析考试结果
 examScore.value = await tauriVision.evaluation.analyzeExamResults(examResults);
 }
 catch (e) {
 console.error('模拟考试失败:', e);
 }
};
// 初始化
loadHistory();</script>

<style scoped>
.vision-panel {
  padding: 20px;
  background: #1e1e2e;
  border-radius: 12px;
  min-height: 500px;
}

.tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  border-bottom: 1px solid #3a3a4a;
  padding-bottom: 10px;
}

.tab-btn {
  padding: 10px 20px;
  background: transparent;
  border: none;
  color: #888;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
}

.tab-btn:hover {
  background: #2a2a3e;
  color: #fff;
}

.tab-btn.active {
  background: #3b82f6;
  color: #fff;
}

.tab-content {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.section {
  margin-bottom: 20px;
}

.section h3 {
  color: #fff;
  margin-bottom: 15px;
  font-size: 16px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  color: #aaa;
  font-size: 12px;
  margin-bottom: 6px;
}

.form-input {
  padding: 10px;
  border: 1px solid #3a3a4a;
  border-radius: 8px;
  background: #2a2a3e;
  color: #fff;
  font-size: 14px;
}

.form-input.small {
  width: 150px;
}

.path-input-group, .search-input-group {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.add-object {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: #fff;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: #3a3a4a;
  color: #fff;
}

.btn-secondary:hover {
  background: #4a4a5e;
}

.btn-info {
  background: #0dcaf0;
  color: #000;
}

.btn-danger {
  background: #dc2626;
  color: #fff;
}

.result-card {
  background: #2a2a3e;
  border-radius: 8px;
  padding: 15px;
  margin-top: 15px;
}

.result-card h4 {
  color: #fff;
  margin-bottom: 12px;
  font-size: 14px;
}

.validation-checks {
  margin-bottom: 12px;
}

.check-item {
  display: flex;
  justify-content: space-between;
  padding: 8px;
  background: #1a1a28;
  border-radius: 6px;
  margin-bottom: 6px;
}

.check-item.pass .status {
  color: #28a745;
}

.check-item.fail .status {
  color: #dc2626;
}

.valid-badge {
  padding: 8px 12px;
  border-radius: 6px;
  background: #dc2626;
  color: #fff;
  text-align: center;
}

.valid-badge.valid {
  background: #28a745;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
}

.stat-item {
  text-align: center;
  padding: 10px;
  background: #1a1a28;
  border-radius: 8px;
}

.stat-value {
  display: block;
  font-size: 24px;
  font-weight: bold;
  color: #3b82f6;
}

.stat-label {
  display: block;
  font-size: 12px;
  color: #888;
  margin-top: 4px;
}

.search-section {
  margin-top: 20px;
}

.search-results {
  margin-top: 10px;
}

.result-item {
  padding: 8px;
  background: #1a1a28;
  border-radius: 6px;
  margin-bottom: 4px;
  color: #aaa;
}

.analysis-results {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.result-section {
  background: #1a1a28;
  padding: 12px;
  border-radius: 8px;
}

.result-section h5 {
  color: #aaa;
  font-size: 12px;
  margin-bottom: 8px;
}

.detected-item {
  display: flex;
  justify-content: space-between;
  padding: 6px;
  background: #2a2a3e;
  border-radius: 4px;
  margin-bottom: 4px;
}

.detected-item .label {
  color: #fff;
}

.detected-item .confidence {
  color: #3b82f6;
}

.attention-bar {
  position: relative;
  height: 24px;
  background: #1a1a28;
  border-radius: 12px;
  overflow: hidden;
}

.attention-fill {
  height: 100%;
  background: linear-gradient(90deg, #28a745, #3b82f6, #dc2626);
  transition: width 0.3s;
}

.attention-text {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  text-align: center;
  line-height: 24px;
  color: #fff;
  font-size: 12px;
  font-weight: bold;
}

.emotion-item {
  padding: 6px;
  background: #2a2a3e;
  border-radius: 4px;
  margin-bottom: 4px;
  color: #fff;
}

.history-section {
  margin-top: 20px;
}

.history-section h4 {
  color: #aaa;
  font-size: 14px;
  margin-bottom: 10px;
}

.history-list {
  margin-top: 10px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  padding: 8px;
  background: #2a2a3e;
  border-radius: 6px;
  margin-bottom: 4px;
  color: #888;
  font-size: 12px;
}

.object-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.tag {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #3b82f6;
  color: #fff;
  border-radius: 20px;
  font-size: 12px;
}

.tag button {
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  font-size: 16px;
}

.batch-section, .exam-section {
  margin-top: 20px;
}

.batch-section h4, .exam-section h4 {
  color: #aaa;
  font-size: 14px;
  margin-bottom: 10px;
}

.batch-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 15px;
}

.batch-stat {
  text-align: center;
  padding: 15px;
  background: #1a1a28;
  border-radius: 8px;
}

.batch-stat .stat-value {
  font-size: 28px;
}

.score-display {
  text-align: center;
  margin-bottom: 15px;
}

.final-score {
  font-size: 64px;
  font-weight: bold;
  color: #3b82f6;
}

.score-label {
  display: block;
  color: #888;
  font-size: 14px;
}

.object-score {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: #1a1a28;
  border-radius: 8px;
  margin-bottom: 8px;
}

.object-score span:first-child {
  width: 80px;
  color: #fff;
}

.score-bar {
  flex: 1;
  height: 12px;
  background: #2a2a3e;
  border-radius: 6px;
  overflow: hidden;
}

.score-bar div {
  height: 100%;
  background: #3b82f6;
  transition: width 0.3s;
}

.object-score span:last-child {
  width: 50px;
  text-align: right;
  color: #3b82f6;
  font-weight: bold;
}
</style>