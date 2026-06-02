/**
 * 前端播放问题诊断脚本
 * 用于快速定位预览区域黑屏、画布无画面、RTSP延迟等问题
 */

console.log('========================================');
console.log('  前端播放问题诊断工具');
console.log('========================================\n');

// 诊断1：检查ZLMediaKit服务
async function checkZLMediaKit() {
  console.log('📡 诊断1: 检查ZLMediaKit服务');

  try {
    const response = await fetch('http://127.0.0.1:801/index/api/getServerInfo');
    if (response.ok) {
      const data = await response.json();
      console.log('✅ ZLMediaKit服务正常运行');
      console.log('   服务器版本:', data.data?.mediaServerVersion || '未知');
      console.log('   启动时间:', data.data?.startTime || '未知');
      console.log('   当前时间:', data.data?.currentTime || '未知');
      return true;
    } else {
      console.log('❌ ZLMediaKit服务响应异常:', response.status);
      return false;
    }
  } catch (e) {
    console.log('❌ ZLMediaKit服务未运行或无法访问');
    console.log('   错误:', e.message);
    console.log('   解决方法: 确保ZLMediaKit已正确安装并在Tauri应用中启动');
    return false;
  }
}

// 诊断2：检查FLV.js支持
function checkFlvSupport() {
  console.log('\n🎬 诊断2: 检查FLV.js支持');

  if (typeof flvjs !== 'undefined') {
    console.log('✅ FLV.js已加载');
    console.log('   版本:', flvjs.version);
    console.log('   是否支持:', flvjs.isSupported());

    if (!flvjs.isSupported()) {
      console.log('⚠️  FLV.js不支持当前浏览器');
      console.log('   建议使用Chrome、Edge或Firefox');
    }

    return true;
  } else {
    console.log('❌ FLV.js未加载');
    console.log('   解决方法: 检查index.html是否引入flv.js');
    return false;
  }
}

// 诊断3：检查视频元素
function checkVideoElement() {
  console.log('\n📺 诊断3: 检查视频元素');

  const videoElements = document.querySelectorAll('video');
  console.log('找到视频元素数量:', videoElements.length);

  if (videoElements.length === 0) {
    console.log('❌ 未找到任何视频元素');
    console.log('   可能原因: VideoPreview组件未正确渲染');
    return false;
  }

  videoElements.forEach((video, index) => {
    console.log(`\n视频元素 ${index + 1}:`);
    console.log('  - src:', video.src || '(无)');
    console.log('  - srcObject:', video.srcObject ? 'MediaStream' : '(无)');
    console.log('  - readyState:', video.readyState);
    console.log('  - paused:', video.paused);
    console.log('  - currentTime:', video.currentTime);
    console.log('  - videoWidth:', video.videoWidth);
    console.log('  - videoHeight:', video.videoHeight);
    console.log('  - error:', video.error ? video.error.message : '(无)');

    // 检查是否有FLV播放器实例
    if (video._flvPlayer) {
      console.log('  - FLV播放器: ✅ 已创建');
      console.log('    类型:', video._flvPlayer.type);
      console.log('    状态:', video._flvPlayer.status);
    } else {
      console.log('  - FLV播放器: ❌ 未创建');
    }
  });

  return videoElements.length > 0;
}

// 诊断4：检查网络连接
async function checkNetworkConnectivity() {
  console.log('\n🌐 诊断4: 检查网络连接');

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  if (connection) {
    console.log('✅ Network Information API可用');
    console.log('  - 下行带宽:', connection.downlink, 'Mbps');
    console.log('  - 有效类型:', connection.effectiveType);
    console.log('  - RTT:', connection.rtt, 'ms');
    console.log('  - 节省数据:', connection.saveData);

    if (connection.downlink < 5) {
      console.log('⚠️  带宽较低，可能导致延迟');
      console.log('   建议: 使用子码流或降低分辨率');
    }
  } else {
    console.log('⚠️  Network Information API不可用');
  }

  // 测试RTSP Proxy连接
  try {
    const startTime = performance.now();
    await fetch('http://localhost:8081/health');
    const endTime = performance.now();

    console.log('✅ RTSP Proxy连接延迟:', (endTime - startTime).toFixed(2), 'ms');

    if (endTime - startTime > 100) {
      console.log('⚠️  连接延迟较高，可能影响播放');
    }
  } catch (e) {
    console.log('❌ 无法连接到RTSP Proxy');
  }
}

// 诊断5：检查常见错误
function checkCommonErrors() {
  console.log('\n⚠️  诊断5: 检查常见错误');

  const errors = [];

  // 检查控制台错误
  const originalError = console.error;
  let errorCount = 0;

  // 这里只能检查当前的错误状态
  console.log('提示: 请查看浏览器控制台的Errors标签');
  console.log('常见错误包括:');
  console.log('  - NetworkError: 网络连接失败');
  console.log('  - MediaError: 媒体格式错误');
  console.log('  - MuxError: 封装格式错误');
  console.log('  - flushStashedSamples: 缓冲区错误');
}

// 诊断6：检查性能
function checkPerformance() {
  console.log('\n⚡ 诊断6: 检查性能指标');

  if (performance.getEntriesByType) {
    const resources = performance.getEntriesByType('resource');
    const flvResources = resources.filter(r => r.name.includes('flv'));

    console.log('FLV相关资源请求:', flvResources.length);

    flvResources.forEach((resource, index) => {
      console.log(`\nFLV请求 ${index + 1}:`);
      console.log('  - URL:', resource.name);
      console.log('  - 持续时间:', resource.duration.toFixed(2), 'ms');
      console.log('  - 传输大小:', (resource.transferSize / 1024).toFixed(2), 'KB');
      console.log('  - 解码大小:', (resource.decodedBodySize / 1024).toFixed(2), 'KB');
    });
  }

  // 内存使用
  if (performance.memory) {
    const memory = performance.memory;
    console.log('\n内存使用:');
    console.log('  - JS堆大小:', (memory.usedJSHeapSize / 1024 / 1024).toFixed(2), 'MB');
    console.log('  - JS堆限制:', (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2), 'MB');
  }
}

// 运行所有诊断
async function runDiagnostics() {
  console.log('开始诊断...\n');

  const results = {
    zlmediakit: await checkZLMediaKit(),
    flvSupport: checkFlvSupport(),
    videoElement: checkVideoElement(),
    network: await checkNetworkConnectivity(),
    errors: checkCommonErrors(),
    performance: checkPerformance()
  };

  console.log('\n========================================');
  console.log('  诊断总结');
  console.log('========================================');
  console.log('ZLMediaKit服务:', results.zlmediakit ? '✅ 正常' : '❌ 异常');
  console.log('FLV.js支持:', results.flvSupport ? '✅ 正常' : '❌ 异常');
  console.log('视频元素:', results.videoElement ? '✅ 存在' : '❌ 缺失');
  console.log('网络连接:', results.network ? '✅ 正常' : '⚠️  需检查');

  console.log('\n💡 建议:');

  if (!results.zlmediakit) {
    console.log('1. 确保ZLMediaKit服务已启动: 在Tauri应用中启动ZLMediaKit服务');
  }

  if (!results.flvSupport) {
    console.log('2. 确保FLV.js已正确加载');
  }

  if (!results.videoElement) {
    console.log('3. 检查VideoPreview组件是否正确渲染');
  }

  console.log('4. 查看浏览器控制台的详细日志');
  console.log('5. 检查ZLMediaKit服务的日志输出');

  console.log('\n========================================');
  console.log('诊断完成');
  console.log('========================================');
}

// 执行诊断
runDiagnostics().catch(console.error);

// 导出函数供手动调用
window.__diagnosePlayback = runDiagnostics;
console.log('\n💡 提示: 可以随时运行 window.__diagnosePlayback() 重新诊断');
