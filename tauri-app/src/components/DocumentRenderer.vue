<template>
  <div class="document-container">
    <!-- PPT 使用专用组件 -->
    <PptContent v-if="source?.type === 'ppt'" :source="source" class="doc-content-inner" />
    <!-- Word 使用专用组件 -->
    <WordContent v-else-if="source?.type === 'word'" :source="source" class="doc-content-inner" />
    <!-- PDF 使用 PdfViewer 组件 -->
    <PdfViewer
      v-else-if="source?.type === 'pdf'"
      :source-id="source.id"
      :file-path="source.filePath"
      :file-name="source.name"
      :show-info="false"
      class="pdf-viewer-inner"
    />
    <!-- Excel 使用专用组件 -->
    <ExcelContent v-else-if="source?.type === 'excel'" :source="source" class="doc-content-inner" />
    <!-- TXT 使用专用组件 -->
    <TxtContent v-else-if="source?.type === 'txt'" :source="source" class="doc-content-inner" />
    <!-- 图片使用专用组件 -->
    <ImageContent v-else-if="source?.type === 'image'" :source="source" class="doc-content-inner" />
    <!-- 无 URL 后备显示 -->
    <div v-else class="doc-icon-fallback">
      <el-icon :size="64"><Document /></el-icon>
      <span>{{ source?.name || '文档' }}</span>
    </div>
  </div>
</template>

<script setup>
import { Document } from '@element-plus/icons-vue';
import PptContent from './teacher-window/canvas/contents/PptContent.vue';
import WordContent from './teacher-window/canvas/contents/WordContent.vue';
import ExcelContent from './teacher-window/canvas/contents/ExcelContent.vue';
import TxtContent from './teacher-window/canvas/contents/TxtContent.vue';
import PdfViewer from './previews/PdfViewer.vue';
import ImageContent from './teacher-window/canvas/contents/ImageContent.vue';

defineProps({
  source: {
    type: Object,
    default: null
  }
});
</script>

<style scoped lang="scss">
.document-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: #fff;
  overflow: hidden;

  .doc-content-inner {
    width: 100%;
    height: 100%;
    transform-origin: top left;
    pointer-events: none;
  }

  .pdf-viewer-inner {
    width: 100%;
    height: 100%;
    border: none;
    pointer-events: none;
  }

  .doc-icon-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--bg-primary, #0D1B2A);

    .el-icon {
      font-size: 48px;
      color: var(--text-secondary, #ADB5BD);
      margin-bottom: 8px;
    }

    span {
      font-size: 12px;
      color: var(--text-secondary, #ADB5BD);
      text-align: center;
      padding: 0 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
    }
  }
}
</style>
