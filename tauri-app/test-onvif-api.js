/**
 * 测试 ONVIF GetStreamUri API
 */

async function testOnvifApi() {
  console.log('🧪 测试 ONVIF GetStreamUri API\n')

  try {
    // 动态导入 Tauri API
    const { invoke } = await import('@tauri-apps/api/core')

    console.log('📍 测试参数:')
    console.log('  - IP: 192.168.5.165')
    console.log('  - 端口: 2000')
    console.log('  - 用户名: admin')
    console.log('  - 密码: admin\n')

    console.log('🔧 调用 get_onvif_stream_uri...')
    const result = await invoke('get_onvif_stream_uri', {
      ip: '192.168.5.165',
      port: 2000,
      username: 'admin',
      password: 'admin'
    })

    console.log('✅ API 调用成功!')
    console.log('返回结果:', JSON.stringify(result, null, 2))

    if (result && result.uri) {
      console.log('\n🎉 RTSP 地址:', result.uri)
      return result.uri
    } else {
      console.warn('\n⚠️ API 返回但没有 uri 字段')
      return null
    }
  } catch (error) {
    console.error('❌ API 调用失败:')
    console.error('  - 错误类型:', error.constructor.name)
    console.error('  - 错误消息:', error.message)
    console.error('  - 完整错误:', error)
    return null
  }
}

// 在浏览器控制台执行
if (typeof window !== 'undefined') {
  window.testOnvifApi = testOnvifApi
  console.log('💡 在浏览器控制台运行: await window.testOnvifApi()')
}

// 如果直接运行此脚本
if (typeof process !== 'undefined' && process.argv) {
  testOnvifApi()
}
