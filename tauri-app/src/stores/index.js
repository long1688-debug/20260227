/**
 * Pinia Store 索引
 * 集中管理所有状态
 */

// 导出所有可用的 stores (命名导出)
export { useStudentStore } from './studentStore';
export { useTaskStore } from './taskStore';
export { useVisionStore } from './visionStore';
export { useSubtitleStore } from './subtitleStore';
export { useAnnotationStore } from './annotationStore';
export { useTrainingStore } from './trainingStore';
export { useSourceStore } from './sourceStore';
export { useRecordingStore } from './recording';
export { useSettingsStore } from './settings';

// 🚨 重要提示：useVideoStore 已被完全废弃并移至 ARCHIVE 目录
// 如果尝试从 '@stores' 导入 useVideoStore，将会收到运行时错误
// ✅ 正确做法: import { useVideoSync } from '@/composables/useVideoSync'

export { useClassStore } from './classStore';
export { useEvaluationStore } from './evaluationStore';
export { useMediaStore } from './mediaStore';
export { useCanvasStore } from './canvasStore';
export { useTTSStore } from './ttsStore';
export { useLiveStreamingStore } from './liveStreamingStore';
