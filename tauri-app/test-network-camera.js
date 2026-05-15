/**
 * 网络摄像机测试脚本
 * 用于测试ONVIF协议获取RTSP地址和RTSP代理播放功能
 */

const { invoke } = require('@tauri-apps/api/core');

// 测试配置 - 请根据实际情况修改
const TEST_CONFIG = {
  // ONVIF测试配置
  onvif: {
    ip: '192.168.1.100',      // 摄像机IP
    port: 80,                  // ONVIF端口（常见：80, 8080, 2000, 8899）
    username: 'admin',         // 用户名
    password: 'password123'    // 密码
  },

  // RTSP测试配置
  rtsp: {
    url: 'rtsp://192.168.1.100:554/h264/ch1/main/av_stream',  // RTSP地址
    username: 'admin',         // 用户名（如果需要）
    password: 'password123'    // 密码（如果需要）
  }
};

/**
 * 测试1：ONVIF连接测试
 */
async function testOnvifConnection() {
  console.log('\n=== 测试1: ONVIF连接测试 ===');
  console.log('目标:', TEST_CONFIG.onvif.ip + ':' + TEST_CONFIG.onvif.port);

  try {
    const result = await invoke('test_onvif_connection', {
      ip: TEST_CONFIG.onvif.ip,
      port: TEST_CONFIG.onvif.port,
      username: TEST_CONFIG.onvif.username,
      password: TEST_CONFIG.onvif.password
    });

    console.log('✅ ONVIF连接成功!');
    console.log('响应:', result.substring(0, 500) + '...');
    return true;
  } catch (error) {
    console.error('❌ ONVIF连接失败:', error);
    return false;
  }
}

/**
 * 测试2：通过ONVIF获取RTSP流地址
 */
async function testGetOnvifStreamUri() {
  console.log('\n=== 测试2: 通过ONVIF获取RTSP流地址 ===');
  console.log('目标:', TEST_CONFIG.onvif.ip + ':' + TEST_CONFIG.onvif.port);

  try {
    const result = await invoke('get_onvif_stream_uri', {
      ip: TEST_CONFIG.onvif.ip,
      port: TEST_CONFIG.onvif.port,
      username: TEST_CONFIG.onvif.username,
      password: TEST_CONFIG.onvif.password
    });

    console.log('✅ 获取RTSP流地址成功!');
    console.log('流地址:', result.uri);
    console.log('协议:', result.protocol);
    console.log('超时:', result.timeout);
    return result.uri;
  } catch (error) {
    console.error('❌ 获取RTSP流地址失败:', error);
    return null;
  }
}

/**
 * 测试3：检查RTSP代理服务状态
 */
async function testRtspProxyStatus() {
  console.log('\n=== 测试3: 检查RTSP代理服务状态 ===');

  try {
    const status = await invoke('check_rtsp_proxy_status');
    console.log('服务状态:', status);

    if (!status.running) {
      console.log('⚠️  RTSP代理服务未运行，尝试启动...');
      await startRtspProxy();
    } else {
      console.log('✅ RTSP代理服务已在运行');
    }

    return status;
  } catch (error) {
    console.error('❌ 检查RTSP代理服务状态失败:', error);
    return null;
  }
}

/**
 * 启动RTSP代理服务
 */
async function startRtspProxy() {
  console.log('\n=== 启动RTSP代理服务 ===');

  try {
    const result = await invoke('start_rtsp_proxy');
    console.log('✅ RTSP代理服务启动成功:', result);
    return true;
  } catch (error) {
    console.error('❌ RTSP代理服务启动失败:', error);
    return false;
  }
}

/**
 * 测试4：启动RTSP流代理
 */
async function testStartRtspStream(rtspUrl) {
  console.log('\n=== 测试4: 启动RTSP流代理 ===');
  console.log('RTSP地址:', rtspUrl);

  const streamId = `test_camera_${Date.now()}`;

  try {
    const result = await invoke('start_rtsp_stream_proxy', {
      rtspUrl: rtspUrl,
      streamId: streamId
    });

    console.log('✅ RTSP流代理启动成功!');
    console.log('流ID:', result.streamId);
    console.log('FLV地址:', result.flvUrl);
    console.log('WebSocket地址:', result.wsUrl);

    return result;
  } catch (error) {
    console.error('❌ RTSP流代理启动失败:', error);
    return null;
  }
}

/**
 * 测试5：获取所有活跃的RTSP流
 */
async function testGetRtspStreams() {
  console.log('\n=== 测试5: 获取所有活跃的RTSP流 ===');

  try {
    const streams = await invoke('get_rtsp_streams');
    console.log('活跃流数量:', streams.length);
    console.log('流列表:', JSON.stringify(streams, null, 2));
    return streams;
  } catch (error) {
    console.error('❌ 获取活跃流列表失败:', error);
    return [];
  }
}

/**
 * 测试6：停止RTSP流代理
 */
async function testStopRtspStream(streamId) {
  console.log('\n=== 测试6: 停止RTSP流代理 ===');
  console.log('流ID:', streamId);

  try {
    const result = await invoke('stop_rtsp_stream_proxy', {
      streamId: streamId
    });

    console.log('✅ RTSP流代理停止成功:', result);
    return true;
  } catch (error) {
    console.error('❌ RTSP流代理停止失败:', error);
    return false;
  }
}

/**
 * 完整测试流程
 */
async function runFullTest() {
  console.log('========================================');
  console.log('  网络摄像机完整测试流程');
  console.log('========================================\n');

  // 测试ONVIF连接
  const onvifConnected = await testOnvifConnection();

  let rtspUrl = null;

  if (onvifConnected) {
    // 通过ONVIF获取RTSP地址
    rtspUrl = await testGetOnvifStreamUri();
  }

  // 如果ONVIF失败，使用配置的RTSP地址
  if (!rtspUrl) {
    console.log('\n⚠️  ONVIF获取失败，使用配置的RTSP地址');
    rtspUrl = TEST_CONFIG.rtsp.url;

    // 如果配置了认证信息，添加到URL中
    if (TEST_CONFIG.rtsp.username && TEST_CONFIG.rtsp.password) {
      if (!rtspUrl.includes('@')) {
        rtspUrl = rtspUrl.replace('rtsp://',
          `rtsp://${TEST_CONFIG.rtsp.username}:${TEST_CONFIG.rtsp.password}@`);
      }
    }

    console.log('使用RTSP地址:', rtspUrl);
  }

  // 检查并启动RTSP代理服务
  await testRtspProxyStatus();

  // 启动RTSP流代理
  const streamResult = await testStartRtspStream(rtspUrl);

  if (streamResult) {
    console.log('\n✅ 测试完成！');
    console.log('\n📺 在浏览器中打开以下地址测试播放:');
    console.log('   FLV地址:', streamResult.flvUrl);
    console.log('\n💡 提示: 可以使用flv.js播放器测试播放效果\n');

    // 等待用户确认后清理
    console.log('按 Ctrl+C 停止测试并清理资源...\n');

    // 保持进程运行，让用户可以测试
    await new Promise(resolve => setTimeout(resolve, 60000));

    // 清理资源
    if (streamResult.streamId) {
      await testStopRtspStream(streamResult.streamId);
    }
  } else {
    console.error('\n❌ 测试失败，请检查配置和网络连接');
  }
}

// 执行测试
if (require.main === module) {
  runFullTest().catch(console.error);
}

module.exports = {
  testOnvifConnection,
  testGetOnvifStreamUri,
  testRtspProxyStatus,
  testStartRtspStream,
  testGetRtspStreams,
  testStopRtspStream,
  runFullTest,
  TEST_CONFIG
};
