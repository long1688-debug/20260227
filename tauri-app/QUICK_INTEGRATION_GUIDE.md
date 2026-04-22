# 快速集成指南

## 快速开始

### 1. 文档翻页功能集成

在需要使用文档翻页的组件中引入 DocumentPager:

```javascript
import DocumentPager from '@/components/teacher-window/video/DocumentPager.vue'

export default {
  components: {
    DocumentPager
  }
}
```

### 2. 使用 DocumentPager

```vue
<template>
  <div class="video-section">
    <!-- 视频展示 -->
    <div class="video-grid">
      <!-- 现有网格 -->
    </div>

    <!-- 文档翻页全屏 -->
    <Teleport to="body">
      <DocumentPager
        v-if="fullscreenDocument"
        :source="fullscreenDocument"
        :initial-fullscreen="true"
        @exit-fullscreen="closeDocumentFullscreen"
      />
    </Teleport>
  </div>
</template>

<script>
import DocumentPager from '@/components/teacher-window/video/DocumentPager.vue'

export default {
  components: { DocumentPager },
  
  data() {
    return {
      fullscreenDocument: null
    }
  },
  
  methods: {
    // 双击打开文档全屏
    openDocumentFullscreen(source) {
      this.fullscreenDocument = source
    },
    
    // 关闭文档全屏
    closeDocumentFullscreen() {
      this.fullscreenDocument = null
    },
    
    // 处理网格双击
    handleGridDoubleClick(source) {
      // 检查是否为文档类型
      const docTypes = ['word', 'docx', 'pdf', 'ppt', 'pptx', 'excel', 'xlsx', 'txt']
      if (docTypes.includes(source.type)) {
        this.openDocumentFullscreen(source)
      }
    }
  }
}
</script>
```

### 3. 音频同步集成

在视频播放组件中使用音频同步管理:

```javascript
import { useGlobalAudioSyncManager } from '@/composables/useAudioSyncManager'

export default {
  setup() {
    const audioSync = useGlobalAudioSyncManager()
    
    // 注册视频元素
    const registerVideo = (videoEl, sourceId, isMaster = false) => {
      audioSync.registerVideo(videoEl, sourceId, isMaster)
    }
    
    // 设置全局音量
    const setVolume = (value) => {
      audioSync.setMasterVolume(value)
    }
    
    return {
      registerVideo,
      setVolume
    }
  }
}
```

### 4. 增强视频播放器使用

```vue
<template>
  <div class="video-player-wrapper">
    <EnhancedVideoItem
      :source="videoSource"
      :index="0"
      @fullscreen="handleFullscreen"
      @maximize="handleMaximize"
      @drop="handleVideoDrop"
    />
  </div>
</template>

<script>
import EnhancedVideoItem from '@/components/teacher-window/video/EnhancedVideoItem.vue'

export default {
  components: { EnhancedVideoItem },
  
  methods: {
    handleFullscreen({ source, isFullscreen }) {
      console.log('全屏状态变化:', isFullscreen)
    },
    
    handleMaximize() {
      console.log('最大化')
    },
    
    handleVideoDrop({ index, source }) {
      console.log('放置到格子:', index, source)
    }
  }
}
</script>
```

## 常见问题

### Q: 文档不显示？
A: 检查 source 对象的 type 属性是否正确设置为 'word', 'pdf', 'ppt' 等

### Q: 翻页不生效？
A: 确保 DocumentPager 的 source 属性包含有效数据

### Q: 音频不同步？
A: 使用 useGlobalAudioSyncManager() 获取全局单例，确保视频注册到同步系统

### Q: 全屏模式不工作？
A: 确保使用 Teleport 将全屏组件传送到 body，并正确处理事件

## 最佳实践

1. **性能优化**: 大屏幕布局时注意限制同时播放的视频数量
2. **内存管理**: 组件卸载时及时清理资源
3. **错误处理**: 为视频加载和文档渲染添加错误处理
4. **用户体验**: 添加加载状态提示

## 示例代码

### 完整示例：TeacherWindow 中的集成

```vue
<template>
  <div class="teacher-window">
    <!-- 现有布局 -->
    <VideoSection @double-click="handleDoubleClick">
      <!-- ... -->
    </VideoSection>

    <!-- 文档全屏查看器 -->
    <Teleport to="body">
      <div v-if="showDocumentViewer" class="document-viewer-fullscreen">
        <button class="close-btn" @click="closeDocumentViewer">×</button>
        <DocumentPager
          :source="currentDocument"
          :initial-fullscreen="true"
          @exit-fullscreen="closeDocumentViewer"
        />
      </div>
    </Teleport>
  </div>
</template>

<script>
import DocumentPager from '@/components/teacher-window/video/DocumentPager.vue'
import { useGlobalAudioSyncManager } from '@/composables/useAudioSyncManager'

export default {
  components: { DocumentPager },
  
  setup() {
    const audioSync = useGlobalAudioSyncManager()
    
    return { audioSync }
  },
  
  data() {
    return {
      showDocumentViewer: false,
      currentDocument: null
    }
  },
  
  methods: {
    handleDoubleClick(source) {
      const docTypes = ['word', 'docx', 'pdf', 'ppt', 'pptx', 'excel', 'xlsx', 'txt']
      if (docTypes.includes(source.type)) {
        this.currentDocument = source
        this.showDocumentViewer = true
      }
    },
    
    closeDocumentViewer() {
      this.showDocumentViewer = false
    }
  }
}
</script>

<style>
.document-viewer-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  background: #000;
}

.close-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  background: rgba(0, 0, 0, 0.6);
  border: none;
  border-radius: 50%;
  color: white;
  font-size: 24px;
  cursor: pointer;
  z-index: 10000;
}
</style>
```

## API 参考

### DocumentPager Props

| 属性 | 类型 | 默认值 | 说明 |
|-----|------|--------|------|
| source | Object | null | 文档源对象 |
| initialFullscreen | Boolean | false | 初始是否全屏 |

### DocumentPager Events

| 事件 | 参数 | 说明 |
|-----|------|------|
| page-change | { currentPage, totalPages, documentType } | 页码变化 |
| enter-fullscreen | - | 进入全屏 |
| exit-fullscreen | - | 退出全屏 |
| document-ready | - | 文档加载完成 |

### DocumentPager Methods

| 方法 | 参数 | 说明 |
|-----|------|------|
| nextPage | - | 下一页 |
| previousPage | - | 上一页 |
| goToPage | page | 跳转到指定页 |
| enterFullscreen | - | 进入全屏 |
| exitFullscreen | - | 退出全屏 |

### useAudioSyncManager Methods

| 方法 | 参数 | 说明 |
|-----|------|------|
| registerVideo | videoEl, sourceId, isMaster | 注册视频 |
| unregisterVideo | videoEl, sourceId | 取消注册 |
| setMasterVolume | volume (0-100) | 设置音量 |
| toggleMute | - | 切换静音 |
| playSource | sourceId | 播放指定源 |
| pauseSource | sourceId | 暂停指定源 |
| pauseAll | - | 暂停所有 |
