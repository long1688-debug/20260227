import { ref, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import flvjs from 'flv.js'

// 检查是否在 Tauri 环境中运行
const isTauriEnv = typeof window !== 'undefined' && window.__TAURI__ !== undefined

// 安全导入 Tauri API
let invoke = undefined
if (isTauriEnv) {
  try {
    invoke = require('@tauri-apps/api/core').invoke
  } catch (e) {
    console.warn('[useRtspPlayer] Tauri API 不可用')
  }
}

/**
 * RTSP 播放器 Composable
 * 封装网络摄像头 RTSP 流的播放逻辑，包括：
 * - FLV 播放器创建、销毁、重连
 * - 去重保护和初始化状态跟踪
 * - UI 状态反馈（加载/失败/成功）
 * - 全局事件监听管理
 */
export function useRtspPlayer() {
  // 播放器实例 Map { sourceId: flvPlayer }
  const players = shallowRef({})

  // 去重保护：跟踪正在初始化的源
  const initializingSources = new Set()

  // 去重保护：最近初始化时间
  const lastInitialized = {}

  // 最小初始化间隔（毫秒）
  const MIN_INIT_INTERVAL = 500

  // 全局事件监听器引用
  const globalEventListeners = []

  // UI 覆盖层容器
  const overlayContainers = new Map()

  // 清理 URL，移除反引号
  const cleanUrl = (url) => {
    if (!url) return url
    return url.trim().replace(/^`\s*/, '').replace(/\s*`$/, '')
  }

  // 注册全局事件监听器
  const addGlobalEventListener = (eventName, handler, options = {}) => {
    window.addEventListener(eventName, handler, options)
    globalEventListeners.push({ eventName, handler, options })
  }

  // 移除全局事件监听器
  const removeGlobalEventListener = (eventName, handler, options = {}) => {
    window.removeEventListener(eventName, handler, options)
    const index = globalEventListeners.findIndex(
      item => item.eventName === eventName && item.handler === handler
    )
    if (index !== -1) {
      globalEventListeners.splice(index, 1)
    }
  }

  // 清理所有全局事件监听器
  const cleanupGlobalEventListeners = () => {
    globalEventListeners.forEach(({ eventName, handler, options }) => {
      try {
        window.removeEventListener(eventName, handler, options)
      } catch (e) {
        console.warn('[useRtspPlayer] 移除事件监听器失败:', e)
      }
    })
    globalEventListeners.length = 0
  }

  // 显示加载覆盖层
  const showLoadingOverlay = (sourceId) => {
    const previewCard = document.querySelector(`[data-source-id="${sourceId}"]`)
    if (previewCard) {
      hideOverlay(sourceId)
      const overlay = document.createElement('div')
      overlay.className = 'source-loading-overlay'
      overlay.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(255,255,255,0.9); z-index: 10; pointer-events: none;'
      overlay.innerHTML = `
        <el-icon class="is-loading" style="font-size: 32px; color: #409EFF;">
          <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
            <path fill="currentColor" d="M512 64a448 448 0 1 1-447.936 460.8A32 32 0 0 1 96 512a32 32 0 0 0 32 32 384 384 0 1 0 384-384 32 32 0 0 0-32-32 32 32 0 0 1-32-32A448 448 0 0 1 512 64z"></path>
          </svg>
        </el-icon>
        <div style="font-size: 12px; color: #909399; margin-top: 8px;">正在连接...</div>
      `
      previewCard.style.position = 'relative'
      previewCard.appendChild(overlay)
      overlayContainers.set(sourceId, overlay)
    }
  }

  // 显示失败覆盖层
  const showFailedOverlay = (sourceId, message = '连接失败') => {
    const previewCard = document.querySelector(`[data-source-id="${sourceId}"]`)
    if (previewCard) {
      hideOverlay(sourceId)
      const overlay = document.createElement('div')
      overlay.className = 'source-failed-overlay'
      overlay.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(255,255,255,0.9); z-index: 10; pointer-events: none; padding: 10px; text-align: center;'
      overlay.innerHTML = `
        <el-icon style="font-size: 32px; color: #F56C6C;"><svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M512 64a448 448 0 1 1-447.936 460.8A32 32 0 0 1 96 512a32 32 0 0 0 32 32 384 384 0 1 0 384-384 32 32 0 0 0-32-32 32 32 0 0 1-32-32A448 448 0 0 1 512 64z"></path></svg></el-icon>
        <div style="font-size: 12px; color: #F56C6C; font-weight: 500; margin-top: 8px;">${message}</div>
        <div style="font-size: 10px; color: #909399; margin-top: 4px;">请编辑信号源重新配置</div>
      `
      previewCard.style.position = 'relative'
      previewCard.appendChild(overlay)
      overlayContainers.set(sourceId, overlay)
    }
  }

  // 显示需要手动配置的覆盖层
  const showConfigRequiredOverlay = (sourceId, message = '需要手动配置') => {
    const previewCard = document.querySelector(`[data-source-id="${sourceId}"]`)
    if (previewCard) {
      hideOverlay(sourceId)
      const overlay = document.createElement('div')
      overlay.className = 'source-config-overlay'
      overlay.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(255,255,255,0.9); z-index: 10; pointer-events: none; padding: 10px; text-align: center;'
      overlay.innerHTML = `
        <el-icon style="font-size: 32px; color: #E6A23C; margin-bottom: 8px;"><svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M512 64a448 448 0 1 1-447.936 460.8A32 32 0 0 1 96 512a32 32 0 0 0 32 32 384 384 0 1 0 384-384 32 32 0 0 0-32-32 32 32 0 0 1-32-32A448 448 0 0 1 512 64z"></path></svg></el-icon>
        <div style="font-size: 12px; color: #E6A23C; font-weight: 500;">${message}</div>
        <div style="font-size: 10px; color: #909399; margin-top: 4px;">请编辑信号源输入RTSP地址</div>
      `
      previewCard.style.position = 'relative'
      previewCard.appendChild(overlay)
      overlayContainers.set(sourceId, overlay)
    }
  }

  // 隐藏覆盖层
  const hideOverlay = (sourceId) => {
    const overlay = overlayContainers.get(sourceId)
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay)
    }
    overlayContainers.delete(sourceId)
  }

  // 安全销毁播放器
  const destroyPlayer = async (videoEl) => {
    if (!videoEl) return

    // 🎯 如果既没有 flvPlayer 也没有 webrtcPlayer，直接返回
    if (!videoEl._flvPlayer && !videoEl._webrtcPlayer) return

    videoEl._isDestroying = true

    // 标记播放状态为已暂停，避免 play() 被打断
    videoEl._playInterrupted = true

    // 🎯 清理 WebRTC 播放器
    if (videoEl._webrtcPlayer) {
      try {
        await videoEl._webrtcPlayer.destroy()
        console.log('[useRtspPlayer] WebRTC 播放器已销毁')
      } catch (e) {
        console.warn('[useRtspPlayer] WebRTC销毁失败:', e)
      }
      videoEl._webrtcPlayer = null
    }

    // 清理 FLV 播放器
    if (videoEl._flvPlayer) {
      const player = videoEl._flvPlayer

      const safeCall = (fn, name) => {
        try {
          fn()
        } catch (e) {
          console.warn(`[useRtspPlayer] ${name}失败:`, e)
        }
      }

      safeCall(() => player.pause(), 'pause')
      safeCall(() => player.unload(), 'unload')
      safeCall(() => player.detachMediaElement(), 'detachMediaElement')
      safeCall(() => player.destroy(), 'destroy')

      videoEl._flvPlayer = null
    }

    videoEl._isDestroying = false
    videoEl._playInterrupted = false

    // 等待微任务完成，确保销毁完全
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  // 销毁指定源的播放器
  const destroyPlayerBySourceId = async (sourceId) => {
    const player = players.value[sourceId]
    if (player && player.videoEl) {
      await destroyPlayer(player.videoEl)
    }
    delete players.value[sourceId]
  }

  // 销毁所有播放器
  const destroyAllPlayers = async () => {
    for (const player of Object.values(players.value)) {
      if (player.videoEl) {
        await destroyPlayer(player.videoEl)
      }
    }
    players.value = {}
    cleanupGlobalEventListeners()
  }

  // 清理指定源的覆盖层
  const cleanupOverlay = (sourceId) => {
    hideOverlay(sourceId)
  }

  // 解析 ONVIF RTSP 地址
  // ONVIF 设备信息和流配置发现
  const discoverOnvifDevice = async (ip, username, password) => {
    console.log(`[useRtspPlayer] 🔍 开始发现ONVIF设备 - IP: ${ip}`)

    const onvifPorts = [80, 8080, 8899, 7001, 7002, 10000]
    let deviceInfo = null
    let profiles = []

    for (const port of onvifPorts) {
      try {
        console.log(`[useRtspPlayer] 尝试连接 ONVIF 端口 ${port}...`)
        const info = await invoke('get_onvif_device_info', {
          ip,
          port,
          username: username || '',
          password: password || ''
        })

        if (info) {
          deviceInfo = info
          console.log(`[useRtspPlayer] ✅ 获取设备信息成功:`, JSON.stringify(info, null, 2))

          // 获取流配置文件
          try {
            const profileList = await invoke('get_onvif_profiles', {
              ip,
              port,
              username: username || '',
              password: password || ''
            })
            if (profileList && profileList.length > 0) {
              profiles = profileList
              console.log(`[useRtspPlayer] ✅ 获取流配置文件成功，共 ${profiles.length} 个`)
              profiles.forEach((p, i) => {
                console.log(`  Profile ${i + 1}: ${p.name} - ${p.uri || '无URI'}`)
              })
            }
          } catch (e) {
            console.warn('[useRtspPlayer] 获取流配置文件失败:', e.message)
          }

          break // 成功后退出循环
        }
      } catch (e) {
        console.warn(`[useRtspPlayer] ONVIF端口 ${port} 连接失败:`, e.message)
      }
    }

    return { deviceInfo, profiles }
  }

  // 扫描网络中的 ONVIF 设备
  const scanOnvifDevices = async (subnet = '192.168.1') => {
    console.log(`[useRtspPlayer] 🖥️ 扫描网络 ${subnet}.1-254 中的 ONVIF 设备...`)

    const foundDevices = []
    const promises = []

    // 扫描 IP 范围
    for (let i = 1; i <= 254; i += 8) {
      const batch = []
      for (let j = i; j < Math.min(i + 8, 255); j++) {
        const ip = `${subnet}.${j}`
        batch.push(checkOnvifDevice(ip))
      }
      // 分批扫描，避免网络过载
      const results = await Promise.all(batch)
      foundDevices.push(...results.filter(d => d))

      // 每批之间延迟
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log(`[useRtspPlayer] ✅ 扫描完成，发现 ${foundDevices.length} 个ONVIF设备`)
    return foundDevices
  }

  // 检查单个 IP 是否为 ONVIF 设备
  const checkOnvifDevice = async (ip) => {
    const ports = [80, 8080, 8899]
    for (const port of ports) {
      try {
        const info = await invoke('get_onvif_device_info', {
          ip,
          port,
          username: '',
          password: ''
        })
        if (info && info.manufacturer) {
          return {
            ip,
            port,
            ...info
          }
        }
      } catch (e) {
        // 忽略错误，继续尝试下一个端口
      }
    }
    return null
  }

  // 测试 RTSP 流地址是否可用
  const testRtspUrl = async (rtspUrl, timeout = 5000) => {
    console.log(`[useRtspPlayer] 🧪 测试 RTSP URL: ${rtspUrl}`)
    try {
      const result = await invoke('test_rtsp_connection', {
        rtspUrl,
        timeout
      })
      if (result.success) {
        console.log(`[useRtspPlayer] ✅ RTSP URL 测试通过`)
        return { success: true, latency: result.latency }
      } else {
        console.log(`[useRtspPlayer] ❌ RTSP URL 测试失败: ${result.error}`)
        return { success: false, error: result.error }
      }
    } catch (error) {
      console.log(`[useRtspPlayer] ❌ RTSP URL 测试异常:`, error.message)
      return { success: false, error: error.message }
    }
  }

  // 获取设备支持的所有 RTSP 流地址
  // 🚫 getDeviceRtspUrls 函数已删除，不再使用品牌模板猜测 RTSP 地址
  // 强制使用 ONVIF 协议获取真实的 RTSP 地址

  // 自动发现最佳 RTSP 流地址
  const autoDiscoverRtspUrl = async (ip, username, password, options = {}) => {
    console.log(`[useRtspPlayer] 🤖 自动发现 RTSP 流地址 - IP: ${ip}`)

    const { timeout = 3000, maxTests = 20 } = options

    // 收集所有候选 URL（包括 ONVIF 返回的）
    const candidateUrls = []

    // 步骤1: 尝试 ONVIF GetStreamUri
    console.log('[useRtspPlayer] 步骤1: 尝试 ONVIF GetStreamUri...')
    const onvifPorts = [80, 8080, 8899]
    for (const port of onvifPorts) {
      try {
        const result = await invoke('get_onvif_stream_uri', {
          ip,
          port,
          username: username || '',
          password: password || ''
        })
        if (result?.uri) {
          console.log(`[useRtspPlayer] ✅ ONVIF 发现成功: ${result.uri}`)
          // 将 ONVIF 返回的 URL 添加到候选列表，而不是直接返回
          candidateUrls.push(result.uri)
        }
      } catch (e) {
        console.warn(`[useRtspPlayer] ONVIF端口 ${port} 失败:`, e.message)
      }
    }

    // 🚫 步骤2已删除：不再添加常见 RTSP URL（品牌模板猜测）
    // 强制使用 ONVIF 协议获取真实的 RTSP 地址

    // 步骤3: 测试所有候选 URL
    console.log(`[useRtspPlayer] 步骤3: 测试候选 URL (共 ${candidateUrls.length} 个)...`)

    // 并行测试，但限制数量
    const testPromises = candidateUrls.slice(0, maxTests).map(url =>
      testRtspUrl(url, timeout).then(result => ({ url, ...result }))
    )

    const results = await Promise.all(testPromises)
    const successful = results.filter(r => r.success)

    if (successful.length > 0) {
      // 优先选择某些特定路径（如 /live/av0）
      // 这些路径通常是摄像机的主码流
      successful.sort((a, b) => {
        // 给特定路径更高优先级
        const priorityPaths = ['/live/av0', '/live/av1']

        const aPriority = priorityPaths.findIndex(p => a.url.includes(p))
        const bPriority = priorityPaths.findIndex(p => b.url.includes(p))

        // 如果a在优先列表中，b不在，则a优先
        if (aPriority >= 0 && bPriority < 0) return -1
        if (bPriority >= 0 && aPriority < 0) return 1

        // 如果都在优先列表中，按优先级排序
        if (aPriority >= 0 && bPriority >= 0) return aPriority - bPriority

        // 否则按延迟排序
        return (a.latency || Infinity) - (b.latency || Infinity)
      })

      const bestUrl = successful[0]
      console.log(`[useRtspPlayer] ✅ 发现可用流地址: ${bestUrl.url} (延迟: ${bestUrl.latency}ms)`)
      return bestUrl.url
    }

    console.log('[useRtspPlayer] ❌ 未能自动发现可用的 RTSP 流地址')
    return null
  }

  const resolveOnvifRtspUrl = async (rtspUrl, source, isUserConfiguredPort = false, userUrlPort = null) => {
    console.log(`[useRtspPlayer] 🔍 resolveOnvifRtspUrl 开始解析: ${rtspUrl}, 用户配置端口: ${isUserConfiguredPort}, URL端口: ${userUrlPort}`)

    const addrMatch = rtspUrl.match(/^https?:\/\/([^:/]+)(?::(\d+))?/)
    if (!addrMatch) {
      console.warn(`[useRtspPlayer] ⚠️ 无法从URL提取IP地址: ${rtspUrl}`)
      return rtspUrl
    }

    const ip = addrMatch[1]
    const originalPort = parseInt(addrMatch[2] || '80', 10)
    const creds = source.credentials || source

    console.log(`[useRtspPlayer] 📍 提取到IP: ${ip}, 端口: ${originalPort}`)

    // 收集所有候选 URL
    const candidateUrls = []

    // ONVIF 端口列表：如果用户手动配置了端口，只尝试该端口；否则尝试常见端口列表
    let onvifPorts
    // 🎯 修复：优先使用用户URL中的端口，其次是source.onvifPort
    const effectiveUserPort = userUrlPort || source.onvifPort
    if (isUserConfiguredPort && effectiveUserPort && effectiveUserPort !== 80) {
      // 用户手动输入了非默认端口，只尝试该端口
      onvifPorts = [effectiveUserPort]
      console.log(`[useRtspPlayer] 📡 用户使用自定义ONVIF端口: ${effectiveUserPort}（来自${userUrlPort ? 'URL' : '配置'}），仅尝试该端口`)
    } else if (isUserConfiguredPort) {
      // 用户配置了端口（可能是80），只尝试该端口
      onvifPorts = [originalPort]
      console.log(`[useRtspPlayer] 📡 用户使用ONVIF端口: ${originalPort}，仅尝试该端口`)
    } else {
      // 自动搜索模式，尝试常见端口列表
      onvifPorts = [originalPort, 80, 8080, 8899, 7001, 7002]
      console.log(`[useRtspPlayer] 📡 自动搜索模式，尝试常见端口列表: ${onvifPorts.join(', ')}`)
    }
    // 去重并保持顺序
    const uniquePorts = [...new Set(onvifPorts)]

    console.log(`[useRtspPlayer] 📡 ONVIF解析开始 - IP: ${ip}, 端口列表: ${uniquePorts.join(', ')}, 用户名: ${creds.username || '(空)'}`)

    // 策略1: 尝试标准 ONVIF GetStreamUri（遍历多个端口）
    for (const port of uniquePorts) {
      try {
        console.log(`[useRtspPlayer] 策略1: 尝试ONVIF GetStreamUri (端口: ${port})...`)
        console.log(`[useRtspPlayer] 调用参数 - IP: ${ip}, 端口: ${port}, 用户名: ${creds.username || '(空)'}, 密码: ${creds.password ? '***' : '(空)'}`)

        const uriResult = await invoke('get_onvif_stream_uri', {
          ip,
          port,
          username: creds.username || '',
          password: creds.password || '',
        })

        console.log(`[useRtspPlayer] ONVIF端口 ${port} 返回结果:`, uriResult)

        if (uriResult?.uri) {
          console.log('[useRtspPlayer] ✅ ONVIF→RTSP解析成功:', uriResult.uri)
          // 🎯 关键修复：ONVIF 返回的是摄像机真实的RTSP地址，直接信任并使用
          // 不再添加到候选列表进行猜测测试，避免和猜测URL混淆
          console.log('[useRtspPlayer] 🎯 使用ONVIF返回的真实地址，跳过猜测测试')
          return uriResult.uri
        } else {
          console.log(`[useRtspPlayer] ⚠️ ONVIF端口 ${port} 返回空结果或无uri字段`)
        }
      } catch (e) {
        console.warn(`[useRtspPlayer] ONVIF端口 ${port} GetStreamUri失败:`, e.message || e)
        console.warn(`[useRtspPlayer] 错误详情:`, e)
      }
    }

    // 🚫 策略2、3、4已删除：不再使用品牌模板猜测 RTSP 地址
    // 强制使用 ONVIF 协议获取真实的 RTSP 地址
    console.error('[useRtspPlayer] ❌ ONVIF GetStreamUri 所有端口均失败，不再进行猜测')
    console.error('[useRtspPlayer] 请检查:')
    console.error('  1. 摄像机是否支持 ONVIF 协议')
    console.error('  2. ONVIF 服务是否已启用')
    console.error('  3. 用户名和密码是否正确')
    console.error('  4. 网络连接是否正常')
    return null
  }

  // 检查 RTSP 代理服务状态
  const checkRtspProxyService = async () => {
    try {
      const response = await fetch('http://127.0.0.1:801/index/api/getServerInfo', {
        method: 'GET',
        mode: 'cors',
        timeout: 2000
      })
      if (response.ok) {
        const data = await response.json()
        console.log('[useRtspPlayer] ✅ ZLMediaKit服务健康检查通过:', data)
        return true
      }
    } catch (e) {
      console.warn('[useRtspPlayer] ZLMediaKit服务HTTP检查异常:', e.message)
    }
    return false
  }

  // 启动 RTSP 代理
  const startRtspProxy = async () => {
    try {
      await invoke('start_rtsp_proxy')
      console.log('[useRtspPlayer] ✅ Tauri API启动ZLMediaKit成功')
      await new Promise(resolve => setTimeout(resolve, 2000))
      return true
    } catch (apiError) {
      console.error('[useRtspPlayer] ❌ Tauri API启动ZLMediaKit失败:', apiError)
      return false
    }
  }

  // 确保 ZLMediaKit 服务已启动
  const ensureZLMediaKitRunning = async () => {
    console.log('[useRtspPlayer] 检查ZLMediaKit状态...')

    // 如果不在 Tauri 环境中，跳过检查（假设 ZLM 已手动启动）
    if (!invoke) {
      console.log('[useRtspPlayer] 非Tauri环境，跳过ZLMediaKit状态检查')
      return
    }

    try {
      const status = await invoke('check_zlmediakit_status')
      console.log('[useRtspPlayer] ZLMediaKit状态:', status)

      if (!status.running) {
        console.log('[useRtspPlayer] ZLMediaKit未运行，尝试启动...')
        const result = await invoke('start_zlmediakit')
        console.log('[useRtspPlayer] ZLMediaKit启动结果:', result)

        // 等待服务启动
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
    } catch (e) {
      console.warn('[useRtspPlayer] ZLMediaKit检查/启动失败:', e)
    }
  }

  // 通过 ZLMediaKit HTTP API 启动 RTSP 流代理
  const startRtspStreamProxyViaHttp = async (rtspUrl, streamId, options = {}) => {
    try {
      console.log(`[useRtspPlayer] 通过HTTP API启动RTSP代理 - streamId: ${streamId}, rtspUrl: ${rtspUrl}`)

      // 构建带认证信息的 RTSP URL
      let proxyUrl = rtspUrl
      if (options.username && options.password) {
        // 将认证信息添加到 RTSP URL
        const atIndex = proxyUrl.indexOf('@')
        if (atIndex === -1) {
          const protocolEnd = proxyUrl.indexOf('://')
          if (protocolEnd !== -1) {
            proxyUrl = `${proxyUrl.substring(0, protocolEnd + 3)}${options.username}:${options.password}@${proxyUrl.substring(protocolEnd + 3)}`
          }
        }
      }

      // ZLMediaKit API: 添加 RTSP 流代理
      const apiUrl = `/index/api/addStreamProxy?secret=8qNdNv8bykcWrRo9BAsFQiUZABZ9kWd3`
      const requestBody = {
        vhost: '__defaultVhost__', // ZLMediaKit 默认虚拟主机
        url: proxyUrl,
        app: 'live',
        stream: streamId,
        rtp_type: 0, // 0=TCP, 1=UDP
        enable_hls: 0,
        enable_mp4: 0
      }
      
      // 🎯 详细日志：记录完整请求信息
      console.log(`[useRtspPlayer] 🚀 发送ZLMediaKit API请求:`)
      console.log(`  - URL: ${window.location.origin}${apiUrl}`)
      console.log(`  - Method: POST`)
      console.log(`  - Body:`, JSON.stringify(requestBody, null, 2))
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })
      
      // 🎯 详细日志：记录响应状态
      console.log(`[useRtspPlayer] 📥 ZLMediaKit API响应状态: ${response.status} ${response.statusText}`)

      // 🎯 关键修复：先检查HTTP状态码，再尝试解析JSON
      if (!response.ok) {
        // 获取响应体（可能是空的或不是JSON）
        let errorMessage = `HTTP ${response.status} ${response.statusText}`
        try {
          const text = await response.text()
          if (text && text.trim()) {
            // 尝试解析为JSON
            try {
              const errorJson = JSON.parse(text)
              errorMessage = errorJson.msg || errorJson.message || errorMessage
            } catch {
              // 不是JSON，直接使用文本
              errorMessage = text
            }
          }
        } catch (e) {
          console.warn(`[useRtspPlayer] 获取错误响应体失败:`, e)
        }
        throw new Error(`ZLMediaKit API错误: ${errorMessage}`)
      }

      // 尝试解析JSON响应
      let result
      try {
        result = await response.json()
      } catch (e) {
        // JSON解析失败，获取原始响应文本
        const text = await response.text()
        console.error(`[useRtspPlayer] ZLM HTTP API 返回非JSON响应:`, text)
        throw new Error(`ZLMediaKit返回无效响应: ${text.substring(0, 200)}`)
      }

      console.log(`[useRtspPlayer] ZLM HTTP API 返回:`, result)

      if (result.code !== 0) {
        throw new Error(result.msg || 'RTSP代理启动失败')
      }

      return {
        success: true,
        streamId: streamId,
        flvUrl: `http://127.0.0.1:801/live/${streamId}.live.flv`,
        webrtcUrl: null
      }
    } catch (error) {
      console.error(`[useRtspPlayer] ❌ HTTP API启动RTSP代理异常:`, error.message)
      throw error
    }
  }

  // 启动 RTSP 流代理（优先使用 Tauri API，备用 HTTP API）
  const startRtspStreamProxy = async (rtspUrl, streamId, options = {}) => {
    // 如果不在 Tauri 环境中，使用 HTTP API
    if (!invoke) {
      return startRtspStreamProxyViaHttp(rtspUrl, streamId, options)
    }

    try {
      console.log(`[useRtspPlayer] 启动RTSP代理 - streamId: ${streamId}, rtspUrl: ${rtspUrl}`)

      const result = await invoke('start_rtsp_stream_proxy', {
        rtspUrl,
        streamId,
        options
      })

      // 检查是否有错误信息
      if (result && result.error) {
        console.error(`[useRtspPlayer] RTSP代理启动失败: ${result.error}`)
        // 检测 FFmpeg 错误
        if (result.error.includes('ffmpeg') ||
          result.error.includes('Error opening input file') ||
          result.error.includes('5XX')) {
          throw new Error(`RTSP转码失败: ${result.error}`)
        }
      }

      return result
    } catch (error) {
      console.error(`[useRtspPlayer] ❌ 启动RTSP代理异常:`, error.message)
      throw error
    }
  }

  // 获取缩略图（带重试）
  const fetchThumbnail = async (streamId, sourceId, retryCount = 0, maxRetries = 3) => {
    const maxDelay = 3000
    try {
      console.log(`[useRtspPlayer] 请求缩略图: ${streamId} (尝试 ${retryCount + 1}/${maxRetries})`)
      // 🎯 修复：使用 HTTP FLV URL 而不是 RTSP URL
      const response = await fetch(`/index/api/getSnap?url=http://127.0.0.1:801/live/${streamId}.live.flv&timeout_sec=2&expire_sec=60`)

      // 检查响应状态
      if (!response.ok) {
        console.warn(`[useRtspPlayer] 缩略图请求失败 - HTTP ${response.status}`)
        if (retryCount < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), maxDelay)
          await new Promise(resolve => setTimeout(resolve, delay))
          return fetchThumbnail(streamId, sourceId, retryCount + 1, maxRetries)
        }
        return { success: false, error: `HTTP ${response.status}` }
      }

      // 尝试解析 JSON
      const text = await response.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        console.warn(`[useRtspPlayer] 缩略图响应不是有效的 JSON: ${text.substring(0, 100)}...`)
        if (retryCount < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), maxDelay)
          await new Promise(resolve => setTimeout(resolve, delay))
          return fetchThumbnail(streamId, sourceId, retryCount + 1, maxRetries)
        }
        return { success: false, error: '响应不是有效的 JSON' }
      }

      if (data.success && data.thumbnail) {
        return { success: true, thumbnail: data.thumbnail, cached: data.cached }
      }

      if (retryCount < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), maxDelay)
        await new Promise(resolve => setTimeout(resolve, delay))
        return fetchThumbnail(streamId, sourceId, retryCount + 1, maxRetries)
      }
      return { success: false, error: data.error || '未知错误' }
    } catch (error) {
      console.error(`[useRtspPlayer] 缩略图请求失败:`, error.message)
      if (retryCount < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), maxDelay)
        await new Promise(resolve => setTimeout(resolve, delay))
        return fetchThumbnail(streamId, sourceId, retryCount + 1, maxRetries)
      }
      return { success: false, error: error.message }
    }
  }

  // 验证 FLV URL 是否可用
  const validateFlvUrl = async (flvUrl) => {
    try {
      console.log(`[useRtspPlayer] 🔍 验证FLV URL: ${flvUrl}`)

      // Fetch API 不支持 ws:// 协议，跳过验证或转换
      if (flvUrl.startsWith('ws://')) {
        console.log('[useRtspPlayer] ⚠️ WebSocket URL，跳过验证')
        return true
      }

      // 使用 HEAD 请求检查是否存在（不下载完整内容）
      const response = await fetch(flvUrl, {
        method: 'HEAD',
        timeout: 5000
      })

      if (response.ok) {
        // 检查 Content-Type
        const contentType = response.headers.get('Content-Type')
        const contentLength = response.headers.get('Content-Length')

        console.log(`[useRtspPlayer] ✅ FLV URL验证通过 - Status: ${response.status}, Content-Type: ${contentType || 'null'}, Content-Length: ${contentLength}`)

        // Content-Type 为 null 或 undefined 时也允许播放（某些服务端可能不返回 Content-Type）
        if (!contentType) {
          console.warn('[useRtspPlayer] ⚠️ Content-Type 为空，但继续尝试播放')
          return true
        }

        // 验证是否是 FLV 类型或视频流
        if (contentType.includes('video') || contentType.includes('flv') || contentType.includes('application/octet-stream')) {
          return true
        }

        console.warn(`[useRtspPlayer] ⚠️ FLV URL Content-Type异常: ${contentType}`)
        // 即使 Content-Type 不对，也尝试播放（可能服务端配置问题）
        return true
      }

      // 🎯 处理503错误（流服务未就绪）
      if (response.status === 503) {
        try {
          const errorData = await response.json()
          console.error(`[useRtspPlayer] ❌ FLV流服务未就绪 - ${errorData.message || 'Unknown error'}`)
          ElMessage.warning(`视频流服务正在启动中，请稍候重试`)
        } catch (e) {
          console.error(`[useRtspPlayer] ❌ FLV流服务未就绪`)
          ElMessage.warning('视频流服务正在启动中，请稍候重试')
        }
        return false
      }

      // 🎯 处理404错误（流不存在）
      if (response.status === 404) {
        try {
          const errorData = await response.json()
          console.error(`[useRtspPlayer] ❌ FLV流不存在: ${errorData.message || 'Stream not found'}`)
        } catch (e) {
          console.error(`[useRtspPlayer] ❌ FLV流不存在`)
        }
        return false
      }

      console.error(`[useRtspPlayer] ❌ FLV URL验证失败 - HTTP状态码: ${response.status}`)
      return false

    } catch (error) {
      console.error(`[useRtspPlayer] ❌ FLV URL验证异常:`, error.message)
      // 网络错误不立即失败，让播放器尝试
      return true
    }
  }

  // 错误类型枚举
  const ErrorTypes = {
    NOT_FOUND: 'NotFound',
    NETWORK_ERROR: 'NetworkError',
    SERVER_ERROR: 'ServerError',
    ABORT_ERROR: 'AbortError',
    PLAY_ERROR: 'PlayError',
    UNKNOWN: 'Unknown'
  }

  // 解析错误类型
  const parseErrorType = (errorDetail, errorInfo) => {
    // 404/400 错误
    if (errorDetail?.status === 404 || errorDetail?.status === 400) {
      return ErrorTypes.NOT_FOUND
    }
    // 服务端错误
    if (errorDetail?.status >= 500) {
      return ErrorTypes.SERVER_ERROR
    }
    // AbortError - 竞态条件
    if (errorDetail?.message?.includes('AbortError')) {
      return ErrorTypes.ABORT_ERROR
    }
    // 网络错误
    if (errorDetail?.message?.includes('NetworkError') || errorDetail?.message?.includes('Failed to fetch')) {
      return ErrorTypes.NETWORK_ERROR
    }
    // FFmpeg 错误（从错误信息中检测）
    if (errorDetail?.message?.includes('ffmpeg') ||
      errorDetail?.message?.includes('Error opening input file') ||
      errorDetail?.message?.includes('5XX')) {
      return ErrorTypes.SERVER_ERROR
    }
    return ErrorTypes.UNKNOWN
  }

  // 创建 FLV 播放器
  const createFlvPlayer = (videoEl, flvUrl, sourceId) => {
    if (!flvjs.isSupported()) {
      console.warn('[useRtspPlayer] flv.js 不支持当前环境')
      return null
    }

    const flvPlayer = flvjs.createPlayer({
      type: 'flv',
      url: flvUrl,
      isLive: true,
      hasAudio: true,
      hasVideo: true
    }, {
      enableWorker: false,
      enableStashBuffer: true,
      stashInitialSize: 1024,
      lazyLoad: false,
      lazyLoadMaxDuration: 0,
      deferLoadAfterSourceOpen: false,
      autoCleanupSourceBuffer: true,
      autoCleanupMaxBackwardDuration: 1,
      autoCleanupMinBackwardDuration: 0.5,
      liveSyncDuration: 0.5,
      liveSyncDurationCount: 1,
      fixAudioTimestampGap: true
    })

    let retryCount = 0
    const MAX_RETRIES = 3
    let lastErrorType = null

    flvPlayer.on(flvjs.Events.ERROR, (errorType, errorDetail, errorInfo) => {
      console.error('[useRtspPlayer] ❌ FLV播放错误:', errorType, errorDetail, errorInfo)

      if (videoEl._isDestroying) {
        console.log('[useRtspPlayer] ℹ️ 播放器正在销毁，忽略错误')
        return
      }

      // 解析具体错误类型
      const parsedErrorType = parseErrorType(errorDetail, errorInfo)
      console.log('[useRtspPlayer] 解析错误类型:', parsedErrorType)

      // 404 错误：不重试，直接显示错误
      if (parsedErrorType === ErrorTypes.NOT_FOUND) {
        console.error('[useRtspPlayer] ❌ FLV文件不存在(404)，后端转流服务未正确提供FLV文件')
        ElMessage.error('视频流地址不存在，请检查摄像头配置或转流服务')
        showFailedOverlay(sourceId, '流地址不存在')
        return
      }

      // 服务端错误：有限重试
      if (parsedErrorType === ErrorTypes.SERVER_ERROR) {
        console.error('[useRtspPlayer] ❌ 服务端错误(5xx)')
        if (retryCount < MAX_RETRIES) {
          retryCount++
          const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000)
          console.warn(`[useRtspPlayer] 服务端错误，第${retryCount}次重试（延迟${delay}ms）...`)
        } else {
          console.error('[useRtspPlayer] 达到最大重试次数，停止重试')
          ElMessage.error('视频服务异常，请稍后重试')
          showFailedOverlay(sourceId, '服务端错误')
          return
        }
      }

      // AbortError：竞态条件，忽略或延迟重试
      if (parsedErrorType === ErrorTypes.ABORT_ERROR) {
        console.warn('[useRtspPlayer] ⚠️ AbortError - 播放被中断（竞态条件）')
        // 延迟重试，避免再次触发竞态
        setTimeout(() => {
          if (!videoEl._isDestroying && videoEl._flvPlayer) {
            videoEl._flvPlayer.load()
            videoEl._flvPlayer.play().catch(err => {
              console.warn('[useRtspPlayer] AbortError重试失败:', err)
            })
          }
        }, 500)
        return
      }

      // 网络错误：指数退避重试
      if ((errorType === 'NetworkError' || parsedErrorType === ErrorTypes.NETWORK_ERROR) && retryCount < MAX_RETRIES) {
        retryCount++
        const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000)
        console.warn(`[useRtspPlayer] 网络错误，第${retryCount}次重试（延迟${delay}ms）...`)

        // 记录最后错误类型，避免无限重试相同错误
        lastErrorType = parsedErrorType

        setTimeout(async () => {
          if (videoEl && videoEl._flvPlayer && !videoEl._isDestroying) {
            console.log('[useRtspPlayer] 销毁旧的FLV播放器并重建...')
            await destroyPlayer(videoEl)

            if (!videoEl._isDestroying) {
              const newFlvPlayer = createFlvPlayer(videoEl, flvUrl, sourceId)
              if (newFlvPlayer) {
                videoEl._flvPlayer = newFlvPlayer
                players.value[sourceId] = { videoEl, flvPlayer: newFlvPlayer }
                newFlvPlayer.attachMediaElement(videoEl)
                newFlvPlayer.load()
                newFlvPlayer.play().catch(err => {
                  console.warn('[useRtspPlayer] FLV重播失败:', err)
                })
              }
            }
          }
        }, delay)
      } else if (retryCount >= MAX_RETRIES) {
        console.error('[useRtspPlayer] 达到最大重试次数，停止重试')
        ElMessage.warning('预览区域视频加载失败，请拖拽到画布查看')
        showFailedOverlay(sourceId, '视频加载失败')
      }
    })

    return flvPlayer
  }

  // 初始化网络摄像头流
  const initNetworkCameraStream = async (source, videoEl, callbacks = {}) => {
    const { onPlaying, onError } = callbacks

    try {
      if (!videoEl || !source) return

      const sourceId = source.id

      // 🎯 生成 ZLMediaKit 流 ID（用于代理和播放）
      const streamId = source.streamId || `cam_${sourceId}_${Date.now()}`

      // 去重保护1：检查是否正在初始化中
      if (initializingSources.has(sourceId)) {
        console.log(`[useRtspPlayer] ⚠️ 网络摄像头 "${source.name}" 正在初始化中，跳过重复调用`)
        return
      }

      // 去重保护2：防抖检查
      const now = Date.now()
      if (lastInitialized[sourceId] && now - lastInitialized[sourceId] < MIN_INIT_INTERVAL) {
        console.log(`[useRtspPlayer] ⚠️ 网络摄像头 "${source.name}" 刚初始化过，跳过`)
        return
      }

      // 检查播放器是否正在销毁中
      if (videoEl._flvPlayer && !videoEl._isDestroying) {
        console.log(`[useRtspPlayer] 网络摄像头 "${source.name}" 已初始化，跳过`)
        return
      }

      // 如果播放器正在销毁，等待销毁完成
      if (videoEl._isDestroying) {
        console.log(`[useRtspPlayer] 等待旧播放器销毁完成: ${source.name}`)
        await new Promise(resolve => setTimeout(resolve, 300))
      }

      // 标记为正在初始化
      initializingSources.add(sourceId)
      lastInitialized[sourceId] = now

      console.log(`[useRtspPlayer] 正在初始化网络摄像头预览: ${source.name}`)

      // 检查连接状态
      if (source.loading) {
        console.log('[useRtspPlayer] ⏳ 信号源正在连接中，显示加载动画...')
        showLoadingOverlay(sourceId)

        const reloadHandler = (event) => {
          if (event.detail.sourceId === source.id) {
            console.log('[useRtspPlayer] 🔄 收到重载事件，重新初始化流...')
            removeGlobalEventListener('reload-preview', reloadHandler)
            setTimeout(() => {
              initNetworkCameraStream(source, videoEl, callbacks)
            }, 500)
          }
        }

        addGlobalEventListener('reload-preview', reloadHandler)
        return
      }

      if (source.connectionStatus === 'failed') {
        console.warn('[useRtspPlayer] ❌ 信号源连接失败，显示错误提示...')
        showFailedOverlay(sourceId, '连接失败')
        return
      }

      // 🎯 构建 RTSP URL - 添加详细日志追踪
      let rtspUrl = cleanUrl(source.streamUrl || source.rtspUrl || source.url)

      // 🎯 调试日志：显示URL的来源
      console.log(`[useRtspPlayer] 📋 URL来源检查:`)
      console.log(`  - source.streamUrl: ${source.streamUrl || '(空)'}`)
      console.log(`  - source.rtspUrl: ${source.rtspUrl || '(空)'}`)
      console.log(`  - source.url: ${source.url || '(空)'}`)
      console.log(`  - source.protocol: ${source.protocol || '(空)'}`)
      console.log(`  - 最终rtspUrl: ${rtspUrl || '(空)'}`)

      // 🎯 关键修复：尝试通过ONVIF获取正确的RTSP地址
      // 无论protocol是什么，如果URL看起来像是自动生成的模板（如/stream1），都尝试ONVIF解析
      const shouldTryOnvif =
        source.protocol === 'onvif' ||
        source.onvifUrl ||
        // 如果URL包含常见的模板路径，说明可能是自动生成的，需要验证
        (rtspUrl && (rtspUrl.includes('/stream1') || rtspUrl.includes('/stream2')))

      if (shouldTryOnvif) {
        console.log('[useRtspPlayer] 🔍 尝试通过ONVIF获取正确的RTSP地址...')

        // 构建ONVIF服务端点URL用于解析
        let onvifEndpoint = rtspUrl
        if (!/^https?:\/\/[^/]+\/onvif\//i.test(rtspUrl)) {
          // 如果rtspUrl不是ONVIF服务端点格式，尝试从IP和端口构建
          const addrMatch = rtspUrl.match(/^https?:\/\/([^:/]+)(?::(\d+))?/)
          if (addrMatch) {
            const ip = addrMatch[1]
            // 优先从URL中提取端口，其次是用户配置的端口，最后是默认80
            const urlPort = addrMatch[2] ? parseInt(addrMatch[2], 10) : null
            const onvifPort = source.onvifPort || urlPort || 80
            onvifEndpoint = `http://${ip}:${onvifPort}/onvif/device_service`
            console.log(`[useRtspPlayer] 从RTSP URL提取IP构建ONVIF端点: ${onvifEndpoint} (URL端口: ${urlPort}, 配置端口: ${source.onvifPort}, 使用端口: ${onvifPort})`)
          } else if (source.onvifUrl) {
            onvifEndpoint = source.onvifUrl
          }
        }

        // 判断是否是用户手动配置的端口（非自动搜索）
        // 🎯 修复：如果URL中包含非80端口，也视为用户手动配置
        const urlPort = addrMatch?.[2] ? parseInt(addrMatch[2], 10) : null
        const isUserConfiguredPort = !!(source.onvifPort && source.onvifPort !== 80) || !!(urlPort && urlPort !== 80)
        const resolvedUrl = await resolveOnvifRtspUrl(onvifEndpoint, source, isUserConfiguredPort, urlPort)
        if (resolvedUrl) {
          console.log(`[useRtspPlayer] ✅ ONVIF解析成功，使用解析后的地址: ${resolvedUrl}`)
          rtspUrl = resolvedUrl
        } else {
          console.warn(`[useRtspPlayer] ⚠️ ONVIF解析失败，回退到原始streamUrl: ${source.streamUrl}`)
          // ONVIF解析失败，回退到原始streamUrl（如果存在）
          if (source.streamUrl && !/^https?:\/\/[^/]+\/onvif\//i.test(source.streamUrl)) {
            rtspUrl = cleanUrl(source.streamUrl)
          }
        }
      } else if (source.protocol === 'rtsp' || rtspUrl.startsWith('rtsp://')) {
        // RTSP协议，直接使用提供的URL
        console.log('[useRtspPlayer] 检测到RTSP协议，直接使用提供的URL')
      } else if (!rtspUrl || rtspUrl.trim() === '') {
        console.warn('[useRtspPlayer] ⚠️ RTSP URL 为空，显示手动配置提示')
        ElMessage.warning({
          message: '此信号源需要手动配置RTSP地址。请编辑信号源并输入正确的RTSP地址（格式：rtsp://IP:554/路径）',
          duration: 10000,
          showClose: true,
          offset: 60
        })
        showConfigRequiredOverlay(sourceId, '需要手动配置')
        return
      }

      // 验证 URL 格式
      if (/^https?:\/\/[^/]+\/onvif\//i.test(rtspUrl)) {
        console.error('[useRtspPlayer] ❌ 无法使用 ONVIF 服务端点作为 RTSP 流地址')
        ElMessage.warning({
          message: 'ONVIF解析失败，请手动输入RTSP地址。格式：rtsp://IP:554/路径',
          duration: 10000,
          showClose: true,
          offset: 60
        })
        showConfigRequiredOverlay(sourceId, '需要手动配置')
        return
      }

      // 🎯 使用 ZLMediaKit 处理 RTSP 流（替代 Node.js 代理）
      console.log(`[useRtspPlayer] 🚀 准备使用ZLMediaKit处理RTSP流:`)
      console.log(`  - streamId: ${streamId}`)
      console.log(`  - rtspUrl: ${rtspUrl}`)
      console.log(`  - sourceId: ${sourceId}`)

      // 确保ZLMediaKit服务已启动
      await ensureZLMediaKitRunning()

      // 准备代理选项（包含认证信息）
      const proxyOptions = {}
      if (source?.username) {
        proxyOptions.username = source.username
      }
      if (source?.password) {
        proxyOptions.password = source.password
      }

      let proxyResult
      let retryCount = 0
      const maxRetries = 2

      while (retryCount <= maxRetries) {
        try {
          // 使用统一的代理函数（自动选择 Tauri API 或 HTTP API）
          proxyResult = await startRtspStreamProxy(rtspUrl, streamId, proxyOptions)
          console.log(`[useRtspPlayer] ✅ ZLMediaKit代理启动成功，返回结果:`, proxyResult)
          break
        } catch (error) {
          // 🎯 Tauri invoke 抛出的错误可能是字符串而非 Error 对象，需要安全提取消息
          const errMsg = error?.message || error?.toString?.() || String(error) || '未知错误'
          console.error('[useRtspPlayer] ❌ ZLMediaKit代理启动异常:', errMsg)

          // 处理超时错误，增加重试机制
          if (errMsg.includes('timeout') && retryCount < maxRetries) {
            retryCount++
            const delay = Math.pow(2, retryCount) * 1000 // 指数退避：2s, 4s
            console.warn(`[useRtspPlayer] ⚠️ RTSP拉流超时，第 ${retryCount} 次重试（延迟 ${delay}ms）...`)
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          }

          if (errMsg.includes('连接') ||
            errMsg.includes('Error opening') ||
            errMsg.includes('5XX')) {
            console.error('[useRtspPlayer] ❌ 检测到连接错误，可能原因:')
            console.error('  - RTSP地址错误或无法访问')
            console.error('  - 摄像头认证失败（用户名/密码错误）')
            console.error('  - 摄像头未开启或网络不通')
            ElMessage.error(`RTSP连接失败: 无法连接到摄像头或流地址错误，请检查摄像头配置`)
            showFailedOverlay(sourceId, '连接失败')
          } else if (errMsg.includes('timeout')) {
            console.error('[useRtspPlayer] ❌ RTSP拉流超时，可能原因:')
            console.error('  - 网络延迟过高或防火墙阻止了RTSP流量')
            console.error('  - 摄像头响应缓慢或未开启')
            console.error('  - RTSP地址格式不正确')
            console.error('  - 需要配置RTSP TCP传输模式（当前ZLM版本可能不支持）')
            console.error('  - 建议升级ZLMediaKit到最新版本')
            console.error(`[useRtspPlayer] 📋 调试信息:`)
            console.error(`  - RTSP URL: ${rtspUrl}`)
            console.error(`  - 流ID: ${streamId}`)
            console.error(`  - 重试次数: ${retryCount}/${maxRetries}`)
            ElMessage.error(`RTSP拉流超时: 网络连接问题或摄像头未响应，请检查网络和摄像头配置。如果问题持续，请尝试升级ZLMediaKit。`)
            showFailedOverlay(sourceId, '拉流超时')
          } else {
            ElMessage.error(`RTSP代理启动失败: ${errMsg}`)
            showFailedOverlay(sourceId, '代理启动失败')
          }
          return
        }
      }

      if (!proxyResult) {
        console.error('[useRtspPlayer] ZLMediaKit代理返回结果为空')
        showFailedOverlay(sourceId, '代理启动失败')
        return
      }

      console.log('[useRtspPlayer] ZLMediaKit代理返回结果:', JSON.stringify(proxyResult, null, 2))

      // 调试：检查返回的流ID
      const returnedStreamId = proxyResult.streamId || proxyResult.stream_id || proxyResult.id
      console.log('[useRtspPlayer] 前端生成的streamId:', streamId)
      console.log('[useRtspPlayer] ZLM返回的streamId:', returnedStreamId)

      // 🎯 使用 ZLM 返回的实际流 ID（用于后续 API 调用）
      const actualStreamId = returnedStreamId || streamId

      // 获取缩略图（使用 ZLM 返回的流 ID）
      fetchThumbnail(actualStreamId, source.id)

      // 🎯 优化：优先使用 WebRTC（延迟 <200ms），不支持时降级到 FLV
      const webrtcUrl = proxyResult.webrtcUrl || proxyResult.webrtc_url
      const playMode = proxyResult.playMode || 'webrtc'

      // 备用 FLV URL - 优先使用 HTTP-FLV（兼容性更好）
      let flvUrl = proxyResult.flvUrl || proxyResult.flv_url;
      if (!flvUrl) {
        flvUrl = proxyResult.wsFlvUrl || proxyResult.ws_flv_url;
      }

      // 如果是 WebSocket URL，转换为 HTTP URL（兼容性更好）
      if (flvUrl && flvUrl.startsWith('ws://')) {
        flvUrl = flvUrl.replace('ws://', 'http://')
        console.log('[useRtspPlayer] WebSocket URL 转换为 HTTP:', flvUrl)
      }

      // Convert FLV URL to proxy path
      let flvProxyUrl = flvUrl
      if (flvUrl && flvUrl.startsWith('http://127.0.0.1:801')) {
        flvProxyUrl = flvUrl.replace('http://127.0.0.1:801', '')
        console.log('[useRtspPlayer] 原始FLV URL:', flvUrl)
        console.log('[useRtspPlayer] 转换后FLV代理路径:', flvProxyUrl)
      } else {
        console.log('[useRtspPlayer] FLV URL无需转换:', flvUrl)
      }

      // 先销毁旧播放器
      await destroyPlayer(videoEl)

      // 🎯 简化方案：直接使用 FLV 播放（当前 ZLM 版本不支持 WebRTC）
      console.log('[useRtspPlayer] 🎯 使用 FLV 播放')
      console.log('[useRtspPlayer] FLV URL:', flvProxyUrl)

      if (!flvProxyUrl) {
        console.error('[useRtspPlayer] ❌ FLV URL 为空')
        showFailedOverlay(sourceId, '未找到播放地址')
        if (onError) onError(source, new Error('FLV URL 为空'))
        return
      }

      // 预验证 FLV 流地址
      const flvValid = await validateFlvUrl(flvProxyUrl)
      if (!flvValid) {
        console.error('[useRtspPlayer] ❌ FLV流地址验证失败')
        ElMessage.error('视频流服务异常，请检查转流服务是否正常运行')
        showFailedOverlay(sourceId, '流服务异常')
        if (onError) onError(source, new Error('FLV流地址验证失败'))
        return
      }

      await _playWithFlv(videoEl, flvProxyUrl, sourceId, source, { onPlaying, onError })

    } catch (error) {
      console.error('[useRtspPlayer] 初始化网络摄像头失败:', error)
      showFailedOverlay(source.id, '初始化失败')
      if (onError) onError(source)
    } finally {
      if (source?.id) {
        initializingSources.delete(source.id)
      }
    }
  }

  // FLV 播放辅助函数（WebRTC 降级时使用）
  const _playWithFlv = async (videoEl, flvUrl, sourceId, source, callbacks = {}) => {
    const { onPlaying, onError } = callbacks

    // 创建 FLV 播放器
    const flvPlayer = createFlvPlayer(videoEl, flvUrl, sourceId)

    if (!flvPlayer) {
      // 备用方案：原生 video 元素
      console.warn('[useRtspPlayer] ⚠️ flv.js 不支持，使用原生 video')
      videoEl.src = flvUrl
      videoEl.load()
      videoEl._flvPlayer = null
      players.value[sourceId] = { videoEl, flvPlayer: null }

      videoEl.onerror = () => {
        console.error('[useRtspPlayer] ❌ 原生 video 播放失败')
        ElMessage.error('网络摄像头播放失败：浏览器不支持FLV格式')
        showFailedOverlay(sourceId, '播放失败')
        if (onError) onError(source)
      }

      try {
        await videoEl.play()
        console.log('[useRtspPlayer] 网络摄像头原生播放启动')
        hideOverlay(sourceId)
        if (onPlaying) onPlaying(source)
      } catch (playError) {
        console.error('[useRtspPlayer] ❌ 播放失败:', playError)
        ElMessage.error('网络摄像头播放失败: ' + playError.message)
        if (onError) onError(source)
      }
      return
    }

    // 绑定播放器
    videoEl._flvPlayer = flvPlayer
    players.value[sourceId] = { videoEl, flvPlayer }

    flvPlayer.attachMediaElement(videoEl)
    flvPlayer.load()

    try {
      await flvPlayer.play()
      console.log('[useRtspPlayer] 🎉 FLV 播放成功')
      hideOverlay(sourceId)
      if (onPlaying) onPlaying(source)
    } catch (playError) {
      console.error('[useRtspPlayer] ❌ flvPlayer.play() 失败:', playError)
      ElMessage.error('网络摄像头播放失败: ' + playError.message)
      if (onError) onError(source)
    }
  }

  // 组件卸载时清理
  const onUnmount = async () => {
    await destroyAllPlayers()
    overlayContainers.forEach((overlay) => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay)
      }
    })
    overlayContainers.clear()
  }

  return {
    // 状态
    players,
    initializingSources,

    // 核心方法
    initNetworkCameraStream,
    destroyPlayer,
    destroyPlayerBySourceId,
    destroyAllPlayers,

    // 覆盖层管理
    showLoadingOverlay,
    showFailedOverlay,
    showConfigRequiredOverlay,
    hideOverlay,
    cleanupOverlay,

    // ONVIF 设备发现（类似 ONVIF Device Manager）
    discoverOnvifDevice,      // 获取ONVIF设备信息和流配置
    scanOnvifDevices,         // 扫描网络中的ONVIF设备
    checkOnvifDevice,         // 检查单个IP是否为ONVIF设备
    autoDiscoverRtspUrl,      // 自动发现最佳RTSP流地址
    testRtspUrl,              // 测试RTSP URL是否可用
    // 🚫 getDeviceRtspUrls 已删除，不再使用品牌模板

    // 工具方法
    fetchThumbnail,
    ensureZLMediaKitRunning,
    resolveOnvifRtspUrl,

    // 生命周期
    onUnmount,

    // 事件监听管理
    addGlobalEventListener,
    removeGlobalEventListener,
    cleanupGlobalEventListeners
  }
}
