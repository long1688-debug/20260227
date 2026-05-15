/**
 * 测试 ONVIF 改进功能
 * 用于验证ONVIF失败时的备选方案是否正常工作
 */

async function testOnvifFallback() {
  console.log('🧪 测试 ONVIF 备选方案功能\n')

  try {
    // 动态导入 Tauri API
    const { invoke } = await import('@tauri-apps/api/core')

    console.log('📍 测试参数:')
    console.log('  - IP: 192.168.1.162')
    console.log('  - 端口: 8000')
    console.log('  - 用户名: admin')
    console.log('  - 密码: admin')
    console.log('  - 品牌: 未知\n')

    // 首先尝试标准的ONVIF方法
    console.log('🔧 步骤1: 尝试标准ONVIF方法...')
    try {
      const onvifResult = await invoke('get_onvif_stream_uri', {
        ip: '192.168.1.162',
        port: 8000,
        username: 'admin',
        password: 'admin'
      })

      console.log('✅ 标准ONVIF方法成功!')
      console.log('返回结果:', JSON.stringify(onvifResult, null, 2))
      return onvifResult
    } catch (onvifError) {
      console.log('❌ 标准ONVIF方法失败:', onvifError.message)
      console.log('🔄 步骤2: 尝试备选方案...\n')
    }

    // 然后尝试备选方案
    console.log('🔧 步骤2: 尝试通用RTSP模板备选方案...')
    const fallbackResult = await invoke('try_common_rtsp_templates', {
      ip: '192.168.1.162',
      port: 8000,
      username: 'admin',
      password: 'admin',
      brand: null
    })

    if (fallbackResult) {
      console.log('✅ 备选方案成功!')
      console.log('RTSP地址:', fallbackResult)
      return fallbackResult
    } else {
      console.log('❌ 备选方案也失败了')
      return null
    }
  } catch (error) {
    console.error('❌ 测试失败:')
    console.error('  - 错误类型:', error.constructor.name)
    console.error('  - 错误消息:', error.message)
    console.error('  - 完整错误:', error)
    return null
  }
}

// 在浏览器控制台执行
if (typeof window !== 'undefined') {
  window.testOnvifFallback = testOnvifFallback
  console.log('💡 在浏览器控制台运行: await window.testOnvifFallback()')
}

// 如果直接运行此脚本
if (typeof process !== 'undefined' && process.argv) {
  testOnvifFallback()
}
