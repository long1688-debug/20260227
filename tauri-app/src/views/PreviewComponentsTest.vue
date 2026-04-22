<template>
  <div class="preview-components-test">
    <el-header>
      <h1>信号源预览组件测试</h1>
      <p>测试各种信号源类型的预览组件</p>
    </el-header>

    <el-main>
      <!-- 采集卡预览 -->
      <el-card class="test-card">
        <template #header>
          <div class="card-header">
            <span>🎥 采集卡预览 (CaptureCardPreview)</span>
            <el-tag type="success">已实现</el-tag>
          </div>
        </template>
        <div class="preview-container" style="height: 400px;">
          <CaptureCardPreview
            source-id="test-capture-1"
            device-id=""
            interface-type="HDMI"
            resolution="1080p"
            device-name="测试采集卡"
          />
        </div>
      </el-card>

      <!-- 高拍仪预览 -->
      <el-card class="test-card">
        <template #header>
          <div class="card-header">
            <span>📷 高拍仪预览 (DocumentScannerPreview)</span>
            <el-tag type="success">已实现</el-tag>
          </div>
        </template>
        <div class="preview-container" style="height: 500px;">
          <DocumentScannerPreview
            source-id="test-scanner-1"
            device-id=""
            scan-mode="single"
            auto-enhance
            auto-crop
            device-name="测试高拍仪"
            @image-captured="onImageCaptured"
          />
        </div>
      </el-card>

      <!-- 网页查看器 -->
      <el-card class="test-card">
        <template #header>
          <div class="card-header">
            <span>🌍 网页查看器 (WebpageViewer)</span>
            <el-tag type="success">已实现</el-tag>
          </div>
        </template>
        <div class="preview-container" style="height: 600px;">
          <WebpageViewer
            source-id="test-webpage-1"
            url="https://www.example.com"
            :zoom="100"
            :disable-java-script="false"
            show-toolbar
            show-info
          />
        </div>
      </el-card>

      <!-- PPT查看器 -->
      <el-card class="test-card">
        <template #header>
          <div class="card-header">
            <span>📊 PPT查看器 (PptViewer)</span>
            <el-tag type="success">已实现</el-tag>
          </div>
        </template>
        <div class="preview-container" style="height: 500px;">
          <PptViewer
            source-id="test-ppt-1"
            file-path=""
            file-name="示例演示文稿.pptx"
            :auto-play="false"
            :play-interval="10"
            show-info
            @slide-change="onSlideChange"
          />
        </div>
      </el-card>

      <!-- PDF查看器 -->
      <el-card class="test-card">
        <template #header>
          <div class="card-header">
            <span>📄 PDF查看器 (PdfViewer)</span>
            <el-tag type="success">已实现</el-tag>
          </div>
        </template>
        <div class="preview-container" style="height: 500px;">
          <PdfViewer
            source-id="test-pdf-1"
            file-path=""
            file-name="示例文档.docx"
            show-info
            @page-change="onPageChange"
            @load-complete="onPdfLoadComplete"
            @load-error="onPdfLoadError"
          />
        </div>
      </el-card>

      <!-- 待实现组件列表 -->
      <el-card class="test-card">
        <template #header>
          <div class="card-header">
            <span>⏳ 待实现的预览组件</span>
            <el-tag type="warning">开发中</el-tag>
          </div>
        </template>
        <el-table :data="pendingComponents" border stripe>
          <el-table-column prop="name" label="组件名称" width="250" />
          <el-table-column prop="type" label="信号源类型" width="200" />
          <el-table-column prop="description" label="功能描述" />
          <el-table-column prop="priority" label="优先级" width="100">
            <template #default="{ row }">
              <el-tag :type="getPriorityType(row.priority)" size="small">
                {{ row.priority }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </el-main>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import {
  CaptureCardPreview,
  DocumentScannerPreview,
  WebpageViewer,
  PptViewer,
  PdfViewer
} from '@/components/previews';

// 事件处理
const onImageCaptured = (imageData) => {
  console.log('拍摄到图片:', imageData);
  ElMessage.success('图片已捕获');
};

const onSlideChange = (slideIndex) => {
  console.log('切换到幻灯片:', slideIndex);
};

const onPageChange = (page) => {
  console.log('切换到页面:', page);
};

const onPdfLoadComplete = (data) => {
  console.log('PDF加载完成:', data);
  ElMessage.success(`PDF加载完成，共${data.totalPages}页`);
};

const onPdfLoadError = (error) => {
  console.error('PDF加载失败:', error);
  ElMessage.error('PDF加载失败: ' + error.message);
};

// 待实现组件列表
const pendingComponents = ref([
  {
    name: 'MRCameraPreview.vue',
    type: 'mrCamera',
    description: 'MR摄像机预览，支持HoloLens、Quest等设备',
    priority: '中'
  },
  {
    name: 'MobileDevicePreview.vue',
    type: 'mobileCamera/mobileScreen',
    description: '移动设备预览，支持摄像头和屏幕镜像',
    priority: '高'
  },
  {
    name: 'WordViewer.vue',
    type: 'word',
    description: 'Word文档查看器，支持.doc/.docx格式',
    priority: '中'
  },
  {
    name: 'MindmapViewer.vue',
    type: 'mindmap',
    description: '思维导图查看器，支持XMind等格式',
    priority: '低'
  },
  {
    name: 'NetworkStreamPlayer.vue',
    type: 'networkStream',
    description: '网络串流播放器，支持RTMP/RTSP/HLS等协议',
    priority: '高'
  }
]);

const getPriorityType = (priority) => {
  const types = {
    '高': 'danger',
    '中': 'warning',
    '低': 'info'
  };
  return types[priority] || '';
};
</script>

<style scoped lang="scss">
.preview-components-test {
  min-height: 100vh;
  background: #f5f7fa;

  .el-header {
    background: white;
    border-bottom: 1px solid #e4e7ed;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 20px 40px;

    h1 {
      margin: 0 0 8px 0;
      font-size: 24px;
      color: #303133;
    }

    p {
      margin: 0;
      font-size: 14px;
      color: #909399;
    }
  }

  .el-main {
    padding: 20px 40px;
  }

  .test-card {
    margin-bottom: 24px;

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 500;
    }

    .preview-container {
      border: 1px dashed #dcdfe6;
      border-radius: 4px;
      overflow: hidden;
    }
  }
}
</style>
