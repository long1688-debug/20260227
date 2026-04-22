<template>
  <div class="side-panel">
    <!-- 顶部状态栏 -->
    <div class="status-bar">
      <div class="status-item">
        <span class="status-label">CPU:</span>
        <span class="status-value">{{ systemStatus.cpu }}</span>
      </div>
      <div class="status-item">
        <span class="status-label">内存:</span>
        <span class="status-value">{{ systemStatus.memory }}</span>
      </div>
    </div>

    <!-- 功能标签网格 -->
    <div class="tabs-grid">
      <button
        v-for="tab in tabs"
        :key="tab.name"
        :class="['tab-icon-btn', { active: modelValue === tab.name }]"
        @click="$emit('update:modelValue', tab.name)"
        :title="tab.label"
      >
        <component :is="tab.iconComponent" class="tab-icon" />
        <span class="tab-label">{{ tab.label }}</span>
      </button>
    </div>

    <!-- Tab 内容区域 -->
    <div class="tab-content">
      <!-- 布局选择面板 -->
      <div v-show="modelValue === 'layout'" class="tab-panel">
        <slot name="layout">
          <div class="panel-header">
            <h3>场景布局</h3>
          </div>
          <p style="padding: 20px; text-align: center; color: #999;">
            请使用插槽注入布局选择器内容
          </p>
        </slot>
      </div>

      <!-- 信号源管理面板 -->
      <div v-show="modelValue === 'sources'" class="tab-panel">
        <slot name="sources">
          <div class="panel-header">
            <h3>信号源管理</h3>
          </div>
          <p style="padding: 20px; text-align: center; color: #999;">
            请使用插槽注入信号源列表内容
          </p>
        </slot>
      </div>

      <!-- 音频控制面板 -->
      <div v-show="modelValue === 'audio'" class="tab-panel">
        <slot name="audio">
          <div class="panel-header">
            <h3>音频控制</h3>
          </div>
          <p style="padding: 20px; text-align: center; color: #999;">
            请使用插槽注入音频控制内容
          </p>
        </slot>
      </div>

      <!-- 学生列表面板 -->
      <div v-show="modelValue === 'students'" class="tab-panel">
        <slot name="students">
          <div class="panel-header">
            <h3>学生列表</h3>
          </div>
          <p style="padding: 20px; text-align: center; color: #999;">
            请使用插槽注入学生列表内容
          </p>
        </slot>
      </div>

      <!-- 任务管理面板 -->
      <div v-show="modelValue === 'tasks'" class="tab-panel">
        <slot name="tasks">
          <div class="panel-header">
            <h3>任务管理</h3>
          </div>
          <p style="padding: 20px; text-align: center; color: #999;">
            请使用插槽注入任务列表内容
          </p>
        </slot>
      </div>

      <!-- 其他面板... -->
      <div v-for="tab in otherTabs" :key="tab" v-show="modelValue === tab" class="tab-panel">
        <slot :name="tab">
          <div class="panel-header">
            <h3>{{ getTabLabel(tab) }}</h3>
          </div>
          <p style="padding: 20px; text-align: center; color: #999;">
            内容待实现
          </p>
        </slot>
      </div>
    </div>

    <!-- 🆕 底部快捷操作按钮 -->
    <div class="bottom-actions">
      <el-button 
        size="small" 
        :type="isLiveActive ? 'danger' : 'primary'" 
        @click="handleToggleLive"
      >
        {{ isLiveActive ? '⏹️ 停止直播' : '📡 开始直播' }}
      </el-button>
      <el-button size="small" type="success" @click="showRecordDialog = true">开始录制</el-button>
    </div>

    <!-- 🆕 录制配置对话框 -->
    <el-dialog
      v-model="showRecordDialog"
      title="设置录制参数"
      width="420px"
      :close-on-click-modal="false"
    >
      <div class="config-form">
        <div class="form-item">
          <label>录制内容</label>
          <el-checkbox-group v-model="recordConfig.content">
            <el-checkbox label="video">主视频</el-checkbox>
            <el-checkbox label="audio">系统音频</el-checkbox>
            <el-checkbox label="mic">麦克风</el-checkbox>
          </el-checkbox-group>
        </div>
        <div class="form-item">
          <label>录制分辨率</label>
          <el-select v-model="recordConfig.resolution" style="width: 100%">
            <el-option label="1080p (1920×1080)" value="1080p" />
            <el-option label="720p (1280×720)" value="720p" />
            <el-option label="480p (854×480)" value="480p" />
          </el-select>
        </div>
        <div class="form-item">
          <label>录制帧率</label>
          <el-select v-model="recordConfig.frameRate" style="width: 100%">
            <el-option label="60 FPS" :value="60" />
            <el-option label="30 FPS" :value="30" />
            <el-option label="24 FPS" :value="24" />
          </el-select>
        </div>
        <div class="form-item">
          <label>视频码率</label>
          <el-select v-model="recordConfig.bitrate" style="width: 100%">
            <el-option label="8 Mbps" :value="8000000" />
            <el-option label="5 Mbps" :value="5000000" />
            <el-option label="3 Mbps" :value="3000000" />
          </el-select>
        </div>
        <div class="form-tip">
          <el-icon><InfoFilled /></el-icon>
          <span>开始录制后，所有内容将保存到本地</span>
        </div>
      </div>
      <template #footer>
        <el-button @click="showRecordDialog = false">取消</el-button>
        <el-button type="primary" @click="handleStartRecording">开始录制</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import { Grid, VideoCamera, Headset, User, List, Notebook, DataAnalysis, Service, Document, VideoPlay } from '@/components/icons';
import { eventBus, EventTypes } from '@/utils/eventBus';

const props = defineProps({
  modelValue: {
    type: String,
    default: 'layout'
  },
  systemStatus: {
    type: Object,
    default: () => ({
      cpu: '3.9%',
      memory: '13.4G / 15G'
    })
  }
});

const emit = defineEmits(['update:modelValue', 'start-live', 'stop-live', 'start-recording', 'pause-recording', 'stop-recording']);

// 🆕 录制对话框状态
const showRecordDialog = ref(false)

// 🆕 直播状态
const isLiveActive = ref(false)

// 🆕 录制配置
const recordConfig = reactive({
  content: ['video', 'audio', 'mic'],
  resolution: '1080p',
  frameRate: 30,
  bitrate: 5000000
})

// 🆕 切换直播状态 - 直接开始/停止直播，无需配置
const handleToggleLive = () => {
  if (isLiveActive.value) {
    // 停止直播
    isLiveActive.value = false
    eventBus.emit(EventTypes.BROADCAST_STOP, {
      type: 'main',
      reason: 'user_stopped'
    })
    ElMessage.info('主直播已停止')
  } else {
    // 开始直播 - 直接推流到学生端，无需配置
    isLiveActive.value = true
    eventBus.emit(EventTypes.BROADCAST_START, {
      type: 'main',
      fps: 30
    })
    ElMessage.success('主直播已开始，学生端正在接收')
  }
}

// 🆕 开始录制
const handleStartRecording = () => {
  showRecordDialog.value = false
  if (recordConfig.content.length === 0) {
    ElMessage.warning('请选择至少一项录制内容')
    return
  }
  emit('start-recording', recordConfig)
}

// 所有 Tab 配置
const allTabs = [
  { name: 'layout', label: '布局', iconComponent: Grid },
  { name: 'sources', label: '信号源', iconComponent: VideoCamera },
  { name: 'audio', label: '音频', iconComponent: Headset },
  { name: 'students', label: '学生', iconComponent: User },
  { name: 'tasks', label: '任务', iconComponent: List },
  { name: 'training', label: '实训', iconComponent: Notebook },
  { name: 'analysis', label: '分析', iconComponent: DataAnalysis },
  { name: 'server', label: '服务', iconComponent: Service },
  { name: 'web', label: 'Web', iconComponent: Service },
  { name: 'status', label: '状态', iconComponent: VideoPlay },
  { name: 'logs', label: '日志', iconComponent: Document }
];

// 主要面板（有专门插槽）
const mainTabs = ['layout', 'sources', 'audio', 'students', 'tasks'];

// 计算属性
const tabs = computed(() => allTabs);

const otherTabs = computed(() => {
  return allTabs.filter(tab => !mainTabs.includes(tab.name)).map(tab => tab.name);
});

// 方法
const getTabLabel = (tabName) => {
  const tab = allTabs.find(t => t.name === tabName);
  return tab ? tab.label : tabName;
};
</script>

<style scoped lang="scss">
@import '@/styles/variables.scss';

.side-panel {
  width: 320px;
  background: $bg-secondary;
  border-left: 1px solid $border-color;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.status-bar {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: $bg-tertiary;
  border-bottom: 1px solid $border-color;
  font-size: 11px;
}

.status-item {
  display: flex;
  gap: 4px;
}

.status-label {
  color: $text-secondary;
}

.status-value {
  color: $text-primary;
  font-weight: 500;
}

.tabs-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid $border-color;
}

.tab-icon-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 6px 4px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba($primary-color, 0.1);
    border-color: $primary-color;
  }

  &.active {
    background: rgba($primary-color, 0.15);
    border-color: $primary-color;
    color: $primary-color;
  }
}

.tab-icon {
  font-size: 18px;
}

.tab-label {
  font-size: 10px;
  white-space: nowrap;
  line-height: 1.2;
}

.tab-content {
  flex: 1;
  overflow-y: auto;
  background: $bg-primary;
}

.tab-panel {
  min-height: 100%;
}

.panel-header {
  padding: 10px 12px;
  border-bottom: 1px solid $border-color;
  background: $bg-secondary;

  h3 {
    margin: 0;
    font-size: 13px;
    color: $text-primary;
  }
}

// 🆕 底部操作按钮
.bottom-actions {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid $border-color;
  background: $bg-tertiary;

  :deep(.el-button) {
    flex: 1;
  }
}

// 🆕 配置对话框样式
.config-form {
  .form-item {
    margin-bottom: 16px;

    label {
      display: block;
      margin-bottom: 8px;
      font-size: 13px;
      color: #303133;
    }

    .el-input,
    .el-select {
      width: 100%;
    }
  }

  .form-tip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: rgba(64, 158, 255, 0.1);
    border-radius: 6px;
    font-size: 12px;
    color: #409EFF;
    margin-top: 16px;

    .el-icon {
      flex-shrink: 0;
    }
  }
}
</style>
