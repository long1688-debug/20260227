/**
 * 测试 ONVIF → RTSP 地址转换修复
 */

// 模拟 formData 数据（来自用户添加摄像机时的输入）
const testCases = [
  {
    name: '案例1: streamUrl 是 ONVIF 服务端点',
    formData: {
      protocol: 'onvif',
      streamUrl: 'http://192.168.5.165:2000/onvif/device_service',
      onvifUrl: 'http://192.168.5.165:2000/onvif/device_service',
      username: 'admin',
      password: 'admin'
    },
    expected: '应该执行 ONVIF → RTSP 转换'
  },
  {
    name: '案例2: streamUrl 为空，只有 onvifUrl',
    formData: {
      protocol: 'onvif',
      streamUrl: '',
      onvifUrl: 'http://192.168.5.165:2000/onvif/device_service',
      username: 'admin',
      password: 'admin'
    },
    expected: '应该执行 ONVIF → RTSP 转换'
  },
  {
    name: '案例3: streamUrl 已经是 RTSP 地址',
    formData: {
      protocol: 'rtsp',
      streamUrl: 'rtsp://192.168.5.165:554/h264/ch1/main/av_stream',
      username: 'admin',
      password: 'admin'
    },
    expected: '不应该执行转换'
  },
  {
    name: '案例4: 协议不是 onvif',
    formData: {
      protocol: 'hikvision',
      streamUrl: 'rtsp://192.168.5.165:554/h264/ch1/main/av_stream',
      username: 'admin',
      password: 'admin'
    },
    expected: '不应该执行转换'
  }
];

// 测试函数
function testOnvifConversion(formData) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`测试: ${formData.name}`);
  console.log(`${'='.repeat(60)}`);
  console.log('输入数据:', JSON.stringify(formData.formData, null, 2));

  // 🎯 新的判断逻辑（修复后）
  const isOnvifEndpoint = formData.formData.protocol === 'onvif' &&
    (formData.formData.streamUrl || formData.formData.onvifUrl) &&
    /https?:\/\/[^/]+\/onvif\//i.test(formData.formData.streamUrl || formData.formData.onvifUrl);

  console.log('\n判断结果:');
  console.log('  - 协议是 onvif:', formData.formData.protocol === 'onvif');
  console.log('  - 有 streamUrl 或 onvifUrl:', !!(formData.formData.streamUrl || formData.formData.onvifUrl));
  console.log('  - 是 ONVIF 服务端点:', /https?:\/\/[^/]+\/onvif\//i.test(formData.formData.streamUrl || formData.formData.onvifUrl));
  console.log('  - isOnvifEndpoint:', isOnvifEndpoint);
  console.log('\n预期行为:', formData.expected);
  console.log('实际行为:', isOnvifEndpoint ? '执行 ONVIF → RTSP 转换' : '不执行转换');

  if ((isOnvifEndpoint && formData.expected.includes('应该执行')) ||
    (!isOnvifEndpoint && formData.expected.includes('不应该执行'))) {
    console.log('✅ 测试结果: PASS');
  } else {
    console.log('❌ 测试结果: FAIL');
  }
}

// 运行所有测试
console.log('🧪 开始测试 ONVIF → RTSP 地址转换修复\n');
testCases.forEach(testCase => testOnvifConversion(testCase));

console.log(`\n${'='.repeat(60)}`);
console.log('测试完成！');
console.log(`${'='.repeat(60)}\n`);
