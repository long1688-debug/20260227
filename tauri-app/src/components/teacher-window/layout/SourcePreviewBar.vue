<template>
  <div class="source-preview-bar">
    <div class="preview-container">
      <!-- 预览网格 -->
      <div class="preview-grid">
        <div
          v-for="source in previewSources"
          :key="source.id"
          class="preview-item"
          :class="{
            'dragging': isDragging && draggingSourceId === source.id,
            'selected': selectedSourceId === source.id
          }"
          draggable="true"
          @mousedown="onMouseDown($event, source)"
          @touchstart="onTouchStart($event, source)"
          @click="selectSource(source)"
          @dragstart="onDragStart($event, source)"
          @dragend="onDragEnd($event, source)"
        >
          <!-- 视频预览 -->
          <div class="preview-video">
            <!-- 屏幕共享预览 -->
            <template v-if="source.type === 'screen' && source.stream">
              <video
                :ref="el => setVideoRef(source.id, el)"
                :key="`${source.id}-screen`"
                autoplay
                muted
                playsinline
                class="video-element"
                @timeupdate="emitVideoEvent('timeupdate', $event, source)"
                @play="emitVideoEvent('play', $event, source)"
                @pause="emitVideoEvent('pause', $event, source)"
                @seeked="emitVideoEvent('seeked', $event, source)"
              ></video>
            </template>

            <!-- 媒体文件预览 -->
            <template v-else-if="source.type === 'localVideo' && (source.url || source.filePath)">
              <video
                :ref="el => setVideoRef(source.id, el)"
                :key="`${source.id}-localVideo`"
                :src="source.url || source.filePath"
                autoplay
                muted
                playsinline
                controls
                class="video-element"
                @loadedmetadata="emitVideoEvent('loadedmetadata', $event, source)"
                @timeupdate="emitVideoEvent('timeupdate', $event, source)"
                @play="emitVideoEvent('play', $event, source)"
                @pause="emitVideoEvent('pause', $event, source)"
                @seeked="emitVideoEvent('seeked', $event, source)"
              ></video>
            </template>

            <!-- 网络摄像头预览 -->
            <template v-else-if="source.type === 'networkCamera'">
              <div class="camera-preview-wrapper">
                <!-- 🎯 缩略图显示（加载前） -->
                <img
                  v-if="thumbnails[source.id]"
                  :src="thumbnails[source.id]"
                  class="thumbnail-image"
                  alt="缩略图"
                />

                <video
                  :ref="el => setVideoRef(source.id, el)"
                  :key="`${source.id}-networkCamera`"
                  autoplay
                  muted
                  playsinline
                  class="video-element"
                  @loadedmetadata="emitVideoEvent('loadedmetadata', $event, source)"
                  @timeupdate="emitVideoEvent('timeupdate', $event, source)"
                  @play="emitVideoEvent('play', $event, source)"
                  @pause="emitVideoEvent('pause', $event, source)"
                  @seeked="emitVideoEvent('seeked', $event, source)"
                ></video>
              </div>
            </template>

            <!-- 摄像头预览（支持 localCamera 和 localDevice 类型） -->
            <template v-else-if="(['localCamera', 'localDevice', 'camera', 'usb'].includes(source.type))">
              <div class="camera-preview-wrapper">
                <video
                  :ref="el => setVideoRef(source.id, el)"
                  :key="`${source.id}-camera`"
                  autoplay
                  muted
                  playsinline
                  class="video-element"
                  @timeupdate="emitVideoEvent('timeupdate', $event, source)"
                  @play="emitVideoEvent('play', $event, source)"
                  @pause="emitVideoEvent('pause', $event, source)"
                  @seeked="emitVideoEvent('seeked', $event, source)"
                ></video>
                <!-- 摄像头占用提示 -->
                <div v-if="!cameraStreams[source.id]" class="camera-occupied-hint">
                  <span class="hint-icon">📹</span>
                  <span class="hint-text">已在画布中使用</span>
                </div>
              </div>
            </template>

            <!-- 文档预览 -->
            <template v-else-if="['pdf', 'ppt', 'word', 'excel', 'txt', 'image'].includes(source.type)">
              <div class="document-preview-wrapper">
                <!-- PPT 使用专用组件 -->
                <PptContent v-if="source.type === 'ppt'" :source="source" class="doc-content-inner" />
                <!-- Word 使用专用组件 -->
                <WordContent v-else-if="source.type === 'word'" :source="source" class="doc-content-inner" />
                <!-- Excel 使用专用组件 -->
                <ExcelContent v-else-if="source.type === 'excel'" :source="source" class="doc-content-inner" />
                <!-- PDF 使用 iframe 直接加载 -->
                <iframe
                  v-else-if="source.type === 'pdf' && source.url"
                  :src="source.url"
                  class="pdf-preview-frame"
                  frameborder="0"
                ></iframe>
                <!-- 图片直接显示 -->
                <img
                  v-else-if="source.type === 'image' && source.url"
                  :src="source.url"
                  class="image-preview"
                  alt="图片预览"
                />
                <!-- 文本文件显示 -->
                <div v-else-if="source.type === 'txt'" class="txt-preview">
                  <pre>{{ source.content || '文本内容加载中...' }}</pre>
                </div>
                <!-- 无 URL 后备显示 -->
                <div v-else class="doc-icon-fallback">
                  <el-icon><Document /></el-icon>
                  <span>{{ source.name }}</span>
                </div>
              </div>
            </template>

            <!-- 其他类型 -->
            <template v-else>
              <div class="generic-preview">
                <el-icon><VideoCamera /></el-icon>
                <span>{{ source.name }}</span>
              </div>
            </template>

            <!-- 🎯 统一的源信息叠加层（所有类型共用） -->
            <div class="preview-overlay">
              <div class="source-info">
                <span class="source-name">{{ source.name }}</span>
                <el-tag :type="getSourceTypeTag(source.type)" size="small">
                  {{ getSourceTypeLabel(source.type) }}
                </el-tag>
              </div>
              <div class="source-actions">
                <el-button
                  type="danger"
                  size="small"
                  circle
                  @click.stop="removeFromPreview(source)"
                >
                  <el-icon><Close /></el-icon>
                </el-button>
              </div>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="previewSources.length === 0" class="empty-preview">
          <el-empty description="暂无预览信号源" :image-size="0">
            <template #image>
              <span></span>
            </template>
            <p class="hint">点击信号源管理中的信号源添加到预览</p>
          </el-empty>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Close, Monitor, Document, VideoCamera } from '@element-plus/icons-vue'
import { useSourceStore } from '@/stores/sourceStore'
import PptContent from '@/components/teacher-window/canvas/contents/PptContent.vue'
import WordContent from '@/components/teacher-window/canvas/contents/WordContent.vue'
import ExcelContent from '@/components/teacher-window/canvas/contents/ExcelContent.vue'
import flvjs from 'flv.js'  // 🎯 导入 flv.js 播放器

const sourceStore = useSourceStore()

// 🎯 缩略图缓存 { sourceId: base64Image }
const thumbnails = ref({})

// 🎯 定义 emit 事件
const emit = defineEmits([
  'drag-start',
  'drag-end',
  'mouse-down',
  'touch-start',
  'rename-source',
  'remove-source',
  'timeupdate',
  'loadedmetadata',
  'play',
  'pause',
  'seeked'
])

// 状态定义
const selectedSourceId = ref(null)
const isDragging = ref(false)
const draggingSourceId = ref(null)
const videoRefMap = ref({})
const cameraStreams = ref({})

// 获取预览信号源列表
const previewSources = computed(() => {
  // 🎯 修复：使用 sourceStore 的 previewSources getter，保持一致性
  return sourceStore.previewSources
})

// 选择信号源
const selectSource = (source) => {
  selectedSourceId.value = source.id
}

// 🎯 HTML5 拖拽开始
const onDragStart = (event, source) => {
  console.log('[SourcePreviewBar] HTML5 拖拽开始:', source.name, source.type, source.id)

  isDragging.value = true
  draggingSourceId.value = source.id

  // 设置拖拽数据 - 关键：必须设置 JSON 格式的数据
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('sourceId', source.id)
  event.dataTransfer.setData('sourceType', source.type)
  event.dataTransfer.setData('sourceName', source.name)
  event.dataTransfer.setData('application/json', JSON.stringify(source))

  // 设置拖拽图像（可选）
  if (event.currentTarget) {
    const dragImage = event.currentTarget.cloneNode(true)
    dragImage.style.opacity = '0.8'
    dragImage.style.width = '180px'
    document.body.appendChild(dragImage)
    event.dataTransfer.setDragImage(dragImage, 90, 60)
    setTimeout(() => document.body.removeChild(dragImage), 0)
  }

  // 🎯 发出事件给父组件
  emit('drag-start', source)
}

// 🎯 HTML5 拖拽结束
const onDragEnd = () => {
  console.log('[SourcePreviewBar] HTML5 拖拽结束')
  isDragging.value = false
  draggingSourceId.value = null

  // 🎯 发出事件给父组件
  emit('drag-end')
}

// 🎯 鼠标按下（用于自定义拖拽 - 兼容 Tauri）
const onMouseDown = (event, source) => {
  // 只处理左键
  if (event.button !== 0) return

  console.log('[SourcePreviewBar] 鼠标按下，开始拖拽:', source.name, source.type)

  // 🎯 发出 mouse-down 事件，isFromPreview 设为 true 表示从预览区域拖拽
  emit('mouse-down', event, source, true)
}

// 🎯 触摸开始（用于移动端/触摸屏拖拽）
const onTouchStart = (event, source) => {
  // 阻止默认行为（防止页面滚动）
  event.preventDefault();

  console.log('[SourcePreviewBar] 触摸开始:', source.name)

  // 🎯 发出触摸事件给父组件
  emit('touch-start', event, source)
}

// 从预览移除信号源
const removeFromPreview = (source) => {
  // 🎯 发出 remove-source 事件给父组件处理
  emit('remove-source', source)

  ElMessage.success(`已从预览移除 "${source.name}"`)
}

// 获取信号源类型标签
const getSourceTypeLabel = (type) => {
  const labels = {
    localCamera: '摄像头',
    localVideo: '本地视频',
    remoteDesktop: '屏幕共享',
    ppt: 'PPT课件',
    word: 'Word文档',
    pdf: 'PDF文档',
    networkCamera: '网络摄像头',
    captureCard: '采集卡'
  }
  return labels[type] || type
}

// 获取信号源类型标签颜色
const getSourceTypeTag = (type) => {
  const tags = {
    localCamera: 'primary',
    localVideo: 'success',
    remoteDesktop: 'warning',
    ppt: 'info',
    word: 'info',
    pdf: 'info',
    networkCamera: 'primary',
    captureCard: 'primary'
  }
  return tags[type] || 'info'  // 默认返回 'info' 而不是空字符串
}

// 视频元数据加载完成
const onVideoLoadedMetadata = (source) => {
  console.log(`视频 "${source.name}" 元数据加载完成`)
}

// 🎯 统一处理视频事件并发出给父组件
const emitVideoEvent = (eventName, event, source) => {
  // 发出事件给父组件
  emit(eventName, { event, source })
}

// 自动检测可用摄像头设备
const getAvailableCameras = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter(d => d.kind === 'videoinput')
  } catch (error) {
    console.error('获取摄像头设备列表失败:', error)
    return []
  }
}

// 初始化摄像头视频流
const initCameraStream = async (source, videoEl) => {
  try {
    if (!videoEl) return

    // 🎯 修复：防止重复初始化导致闪烁
    if (videoEl.srcObject) {
      console.log(`[SourcePreviewBar] 摄像头 "${source.name}" 已初始化，跳过重复初始化`)
      return
    }

    let constraints = { video: true }

    // 如果有 deviceId，使用指定设备
    if (source.deviceId) {
      constraints = { video: { deviceId: source.deviceId } }
    } else {
      // 没有 deviceId，自动检测并使用第一个可用摄像头
      const cameras = await getAvailableCameras()
      if (cameras.length > 0) {
        // 更新 source 的 deviceId
        source.deviceId = cameras[0].deviceId
        constraints = { video: { deviceId: cameras[0].deviceId } }
      }
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints)

    videoEl.srcObject = stream
    cameraStreams.value[source.id] = stream

    // 🎯 修复：只有当流确实变化时才更新 store，避免无限循环
    if (!source.stream || source.stream.id !== stream.id) {
      sourceStore.updateSource(source.id, { stream })
    }

    console.log(`[SourcePreviewBar] 摄像头 "${source.name}" 流初始化成功`)
  } catch (error) {
    console.error('初始化摄像头流失败:', error)
    // 不显示错误消息，因为这可能是正常的（用户拒绝权限等）
  }
}

// 初始化网络摄像头RTSP流（预览栏显示画面，参考本地摄像机实现）
const initNetworkCameraStream = async (source, videoEl) => {
  try {
    if (!videoEl || !source) return

    //  防止重复初始化
    if (videoEl._flvPlayer) {
      console.log(`[SourcePreviewBar] 网络摄像头 "${source.name}" 已初始化，跳过`)
      return
    }

    console.log(`[SourcePreviewBar] 正在初始化网络摄像头预览: ${source.name}`)
    console.log('[SourcePreviewBar] 信号源完整数据:', JSON.stringify(source, null, 2))

    // 🎯 构建RTSP URL（兼容多种字段名）
    let rtspUrl = source.streamUrl || source.rtspUrl || source.url
    if (source.needAuth && source.username && source.password) {
      // 添加认证信息
      if (!rtspUrl.includes('@')) {
        rtspUrl = rtspUrl.replace('rtsp://', `rtsp://${source.username}:${source.password}@`)
      }
    }

    // 🎯 关键修复：ONVIF服务端点（http://*/onvif/*）不是真实视频流地址
    // 需要先通过 Tauri ONVIF GetStreamUri 解析出真实 RTSP uri
    if (/^https?:\/\/[^/]+\/onvif\//i.test(rtspUrl)) {
      console.log('[SourcePreviewBar] 检测到ONVIF服务端点，正在解析RTSP地址...');
      try {
        const addrMatch = rtspUrl.match(/^https?:\/\/([^:/]+)(?::(\d+))?/);
        if (addrMatch) {
          const ip = addrMatch[1];
          const port = parseInt(addrMatch[2] || '80', 10);
          const creds = source.credentials || source;
          const uriResult = await invoke('get_onvif_stream_uri', {
            ip,
            port,
            username: creds.username || '',
            password: creds.password || '',
          });
          if (uriResult?.uri) {
            rtspUrl = uriResult.uri;
            // 如果需要认证且URL中没有认证信息，添加认证
            if ((source.needAuth || creds.username) && creds.username && creds.password && !rtspUrl.includes('@')) {
              rtspUrl = rtspUrl.replace('rtsp://', `rtsp://${creds.username}:${creds.password}@`)
            }
            console.log(`[SourcePreviewBar] ONVIF→RTSP解析成功: ${rtspUrl}`);
          }
        }
      } catch (e) {
        console.warn('[SourcePreviewBar] ONVIF RTSP解析失败，尝试直接使用原地址:', e.message);
      }
    }

    // 🎯 调用RTSP Proxy服务
    const { invoke } = await import('@tauri-apps/api/core')

    try {
      // 🎯 关键修复：先通过HTTP健康检查确保RTSP代理服务正在运行
      console.log('[SourcePreviewBar] 开始检查RTSP代理服务状态...');
      let serviceRunning = false;

      try {
        const response = await fetch('http://127.0.0.1:8081/health', {
          method: 'GET',
          mode: 'cors',
          timeout: 2000
        });

        if (response.ok) {
          const data = await response.json();
          console.log('[SourcePreviewBar] ✅ RTSP代理服务已通过HTTP健康检查:', data);
          serviceRunning = true;
        } else {
          console.warn('[SourcePreviewBar] ⚠️ RTSP代理服务健康检查失败，HTTP状态:', response.status);
        }
      } catch (e) {
        console.warn('[SourcePreviewBar] ⚠️ RTSP代理服务HTTP检查异常:', e.message);
        console.warn('[SourcePreviewBar] 将尝试直接调用Tauri API启动服务...');
      }

      // 如果HTTP检查失败，尝试通过Tauri API启动服务
      if (!serviceRunning) {
        console.log('[SourcePreviewBar] 尝试通过Tauri API启动RTSP代理服务...');
        try {
          await invoke('start_rtsp_proxy');
          console.log('[SourcePreviewBar] ✅ Tauri API启动成功');
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (apiError) {
          console.error('[SourcePreviewBar] ❌ Tauri API启动失败:', apiError);
          // 即使启动失败，也继续尝试（可能服务已在外部运行）
          console.warn('[SourcePreviewBar] 警告：服务启动失败，但仍将尝试连接...');
        }
      }

      // 🎯 使用统一的streamId格式（与VideoPreview保持一致）
      const streamId = `camera_${source.id.split('_').pop()}`  // 例如: camera_cqkfezgf5
      console.log('[SourcePreviewBar] 使用streamId:', streamId)

      const proxyResult = await invoke('start_rtsp_stream_proxy', {
        rtspUrl: rtspUrl,
        streamId: streamId
      })

      if (proxyResult) {
        console.log('[SourcePreviewBar] RTSP代理返回结果:', JSON.stringify(proxyResult, null, 2))

        // 获取缩略图（异步，不阻塞播放）
        fetchThumbnail(streamId, source.id)

        // 兼容不同的字段名格式
        const flvUrl = proxyResult.flvUrl || proxyResult.flv_url

        if (flvUrl) {
          console.log('[SourcePreviewBar] RTSP代理启动成功, FLV URL:', flvUrl)

          // 使用flv.js播放FLV流
          console.log('[SourcePreviewBar] 🔍 flvjs.isSupported():', flvjs.isSupported())
          console.log('[SourcePreviewBar] 📺 MediaSource支持:', typeof window.MediaSource !== 'undefined')
          console.log('[SourcePreviewBar] 🎯 User Agent:', navigator.userAgent)

          if (flvjs.isSupported()) {
            console.log('[SourcePreviewBar] ✅ 创建FLV播放器...')

            const flvPlayer = flvjs.createPlayer({
              type: 'flv',
              url: flvUrl,
              isLive: true,
              hasAudio: true,
              hasVideo: true
            }, {
              // 🎯 关键配置：修复flushStashedSamples错误，同时优化延迟
              enableWorker: false,              // 禁用Worker避免跨线程错误
              enableStashBuffer: true,          // ✅ 必须启用，否则会导致flushStashedSamples错误
              stashInitialSize: 4096,           // 初始缓冲 4KB（有效覆盖单帧 FLV tag + 音频头，消除 flushStashedSamples 错误）
              lazyLoad: false,                  // 禁用懒加载
              lazyLoadMaxDuration: 0,           // 不限制最大持续时间
              deferLoadAfterSourceOpen: false,  // 不延迟加载
              //  自动清理策略 - 控制内存和延迟
              autoCleanupSourceBuffer: true,    // 自动清理SourceBuffer
              autoCleanupMaxBackwardDuration: 2, // 最大向后保留2秒
              autoCleanupMinBackwardDuration: 1,  // 最小向后保留1秒
              // 🎯 直播同步配置 - 降低延迟（0.5秒覆盖窗口，接近实时）
              liveSyncDuration: 0.5,            // 直播同步时长0.5秒
              liveSyncDurationCount: 1,         // 直播同步帧数
              fixAudioTimestampGap: true        // 修正音频时间戳间隙
            })

            flvPlayer.attachMediaElement(videoEl)
            videoEl._flvPlayer = flvPlayer  // 保存播放器实例

            // 🎯 关键配置：进一步优化低延迟播放 + 自动重连（借鉴MCX框架）
            let retryCount = 0;
            const MAX_RETRIES = 3;

            flvPlayer.on(flvjs.Events.ERROR, (errorType, errorDetail, errorInfo) => {
              console.error('[SourcePreviewBar] ❌ FLV播放错误:', errorType, errorDetail, errorInfo)

              // 🎯 网络错误时自动重连（借鉴MCX框架的自动重连机制）
              if (errorType === 'NetworkError' && retryCount < MAX_RETRIES) {
                retryCount++;
                const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000); // 指数退避
                console.warn(`[SourcePreviewBar] 网络错误，第${retryCount}次重试（延迟${delay}ms）...`);

                setTimeout(() => {
                  try {
                    if (videoEl && videoEl._flvPlayer) {
                      // 🎯 销毁旧播放器并重建（借鉴MCX的错误恢复机制）
                      console.log('[SourcePreviewBar] 销毁旧的FLV播放器并重建...');
                      const oldPlayer = videoEl._flvPlayer;
                      oldPlayer.pause();
                      oldPlayer.unload();
                      oldPlayer.detachMediaElement();
                      oldPlayer.destroy();
                      videoEl._flvPlayer = null;

                      // 重新创建播放器
                      const newFlvPlayer = flvjs.createPlayer({
                        type: 'flv',
                        url: flvUrl,
                        isLive: true,
                        hasAudio: true,
                        hasVideo: true
                      }, {
                        enableWorker: false,
                        enableStashBuffer: true,
                        stashInitialSize: 4096,            // 初始缓冲 4KB
                        lazyLoad: false,
                        lazyLoadMaxDuration: 0,
                        deferLoadAfterSourceOpen: false,
                        autoCleanupSourceBuffer: true,
                        autoCleanupMaxBackwardDuration: 2, // 最大向后保留2秒
                        autoCleanupMinBackwardDuration: 1,  // 最小向后保留1秒
                        liveSyncDuration: 1,               // 直播同步时长1秒
                        liveSyncDurationCount: 1,          // 直播同步帧数
                        fixAudioTimestampGap: true
                      });

                      videoEl._flvPlayer = newFlvPlayer;
                      newFlvPlayer.attachMediaElement(videoEl);
                      newFlvPlayer.load();
                      newFlvPlayer.play().catch(err => {
                        console.warn('[SourcePreviewBar] FLV重播失败:', err);
                      });
                    }
                  } catch (e) {
                    console.error('[SourcePreviewBar] FLV重加载失败:', e);
                  }
                }, delay);
              } else if (retryCount >= MAX_RETRIES) {
                console.error('[SourcePreviewBar] 达到最大重试次数，停止重试');
                ElMessage.warning('预览区域视频加载失败，请拖拽到画布查看');
              }
            })

            flvPlayer.load()
            await flvPlayer.play()

            console.log(`[SourcePreviewBar] 🎉 网络摄像头 "${source.name}" 预览播放成功`)
          } else {
            // 🎯 备用方案：flv.js不支持时，尝试直接使用原生 video 元素
            console.warn('[SourcePreviewBar] ⚠️ flv.js 不支持当前环境')
            console.log('[SourcePreviewBar] 尝试原生 video 播放 FLV:', flvUrl)
            videoEl.src = flvUrl
            videoEl.load()

            videoEl.onerror = (e) => {
              console.error('[SourcePreviewBar] ❌ 原生 video 播放失败:', e)
              ElMessage.error('网络摄像头播放失败：浏览器不支持FLV格式')
            }

            try {
              await videoEl.play()
              console.log(`[SourcePreviewBar]  网络摄像头 "${source.name}" 原生播放启动`)
            } catch (playError) {
              console.error('[SourcePreviewBar] ❌ 播放失败:', playError)
              ElMessage.error(`网络摄像头播放失败: ${playError.message}`)
            }
          }
        } else {
          console.error('[SourcePreviewBar] RTSP代理启动失败: 未找到FLV URL', proxyResult)
          ElMessage.error('RTSP代理启动失败: 未找到FLV URL')
        }
      } else {
        console.error('[SourcePreviewBar] RTSP代理返回结果为空')
        ElMessage.error('RTSP代理返回结果为空')
      }
    } catch (error) {
      console.error('[SourcePreviewBar] 调用RTSP代理失败:', error)
      // 预览栏失败不影响用户继续操作
      console.warn('[SourcePreviewBar] 预览栏RTSP播放失败，拖拽到画布后VideoPreview会重新尝试')
    }
  } catch (error) {
    console.error('[SourcePreviewBar] 初始化网络摄像头失败:', error)
  }
}

// 🎯 获取缩略图
const fetchThumbnail = async (streamId, sourceId) => {
  try {
    console.log(`[Thumbnail] 请求缩略图: ${streamId}`)

    const response = await fetch(`http://127.0.0.1:8081/api/thumbnail/${streamId}`)
    const data = await response.json()

    if (data.success && data.thumbnail) {
      thumbnails.value[sourceId] = data.thumbnail
      console.log(`[Thumbnail] ✅ 缩略图加载成功: ${sourceId}, cached: ${data.cached}`)
    } else {
      console.warn(`[Thumbnail] ⚠️ 缩略图加载失败: ${streamId}`, data.error)
    }
  } catch (error) {
    console.error(`[Thumbnail] ❌ 请求失败: ${streamId}`, error.message)
  }
}

// 设置 video 引用到 Map 中
const setVideoRef = (sourceId, el) => {
  if (el) {
    videoRefMap.value[sourceId] = el
  } else {
    delete videoRefMap.value[sourceId]
  }
}

// 监听预览源变化，初始化视频元素
watch(
  () => previewSources.value,
  async (newSources) => {
    await nextTick()

    newSources.forEach((source) => {
      const videoEl = videoRefMap.value[source.id]

      if (source.type === 'screen' && source.stream && videoEl) {
        videoEl.srcObject = source.stream
      } else if (['localCamera', 'localDevice', 'camera', 'usb'].includes(source.type) && videoEl) {
        //  修复：只有当视频元素还没有流时才初始化，避免重复初始化导致闪烁
        if (!videoEl.srcObject) {
          initCameraStream(source, videoEl)
        }
      } else if (source.type === 'networkCamera' && videoEl) {
        // 🎯 新增：处理网络摄像头RTSP流
        console.log('[SourcePreviewBar] 检测到网络摄像头，加载RTSP流:', source.name)
        initNetworkCameraStream(source, videoEl)
      }
    })
  },
  { deep: true }
)

// 组件卸载时清理资源
onUnmounted(() => {
  console.log('[SourcePreviewBar] 组件卸载，清理所有播放器')

  // 🎯 销毁所有flv.js播放器实例
  const videoElements = document.querySelectorAll('.source-preview-bar video.video-element')
  videoElements.forEach(videoEl => {
    if (videoEl._flvPlayer) {
      console.log('[SourcePreviewBar] 销毁FLV播放器:', videoEl._flvPlayer)
      try {
        videoEl._flvPlayer.pause()
        videoEl._flvPlayer.unload()
        videoEl._flvPlayer.detachMediaElement()
        videoEl._flvPlayer.destroy()
      } catch (e) {
        console.warn('[SourcePreviewBar] 销毁播放器时出错:', e)
      }
      videoEl._flvPlayer = null
    }
  })

  // 停止所有摄像头流
  Object.values(cameraStreams.value).forEach(stream => {
    stream.getTracks().forEach(track => track.stop())
  })
  cameraStreams.value = {}
})


</script>

<style scoped lang="scss">
.source-preview-bar {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;         // 🎯 关键修复：允许收缩到任意高度
  background: var(--bg-secondary, #1B263B);
  border-top: 1px solid var(--border-color, #415A77);
  border-radius: 8px;
}

.preview-container {
  flex: 1;
  min-height: 0;         // 🎯 关键修复：允许flex子元素正常收缩
  overflow-x: auto;
  overflow-y: auto;
  padding: 10px 12px;
}

.preview-grid {
  display: flex;
  gap: 12px;
  height: 100%;
  align-items: stretch;

  .preview-item {
    width: 180px;
    height: 100%;
    flex: 0 0 180px;
    background: var(--bg-primary, #0D1B2A);
    border: 2px solid var(--border-color, #415A77);
    border-radius: 8px;
    overflow: auto;
    cursor: move;
    transition: all 0.2s ease;

    // 🎯 触摸优化：禁用默认触摸行为，防止页面滚动
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;

    &:hover {
      border-color: var(--color-primary, #4CC9F0);
      box-shadow: 0 2px 8px rgba(76, 201, 240, 0.2);
    }

    &.selected {
      border-color: var(--color-primary, #4CC9F0);
    }

    &.dragging {
      opacity: 0.6;
      transform: scale(0.98);
    }

    // 🎯 触摸激活状态（可选）
    &:active {
      transform: scale(0.95);
    }
  }

  .empty-preview {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;

    .hint {
      font-size: 12px;
      color: var(--text-secondary, #ADB5BD);
      margin-top: 8px;
    }
  }
}

.preview-video {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;

  .video-element {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  // 摄像头预览容器
  .camera-preview-wrapper {
    width: 100%;
    height: 100%;
    position: relative;
    background: #000;

    .video-element {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    // 摄像头占用提示
    .camera-occupied-hint {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.8);

      .hint-icon {
        font-size: 32px;
        margin-bottom: 8px;
      }

      .hint-text {
        font-size: 12px;
        color: var(--text-secondary, #ADB5BD);
      }
    }
  }

  // 文档预览容器
  .document-preview-wrapper {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #fff;
    position: relative;

    // 嵌入的文档内容组件缩放适配
    .doc-content-inner {
      width: 100%;
      height: 100%;
      transform-origin: top left;
      pointer-events: none; // 预览条内禁止交互，防止误操作
    }

    // PDF iframe
    .pdf-preview-frame {
      width: 100%;
      height: 100%;
      border: none;
      pointer-events: none;
    }

    // 无 URL 后备图标
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

  .screen-preview,
  .document-preview,
  .generic-preview {
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
      font-size: 14px;
      color: var(--text-secondary, #ADB5BD);
    }
  }

  .preview-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.8) 100%);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 8px;
    opacity: 0;
    transition: opacity 0.2s ease;
    z-index: 10;

    .preview-item:hover & {
      opacity: 1;
      pointer-events: auto; // ✅ hover时允许交互（包括删除按钮）
    }
  }

  .source-actions {
    display: flex;
    justify-content: flex-end;

    .el-button {
      pointer-events: auto !important;
      cursor: pointer !important;
    }
  }

  .source-info {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .source-name {
      font-size: 12px;
      color: #fff;
      font-weight: 500;
      text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    }
  }

  // 🎯 缩略图样式
  .thumbnail-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 1;
    opacity: 0.8;
    transition: opacity 0.3s ease;
  }

  .camera-preview-wrapper {
    position: relative;
    width: 100%;
    height: 100%;

    .video-element {
      position: relative;
      z-index: 2;
    }
  }
}
</style>
