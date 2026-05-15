/**
 * 移动端连接功能测试脚本
 *
 * 使用方法：
 * 1. 确保Tauri应用正在运行
 * 2. 在浏览器控制台或Node.js环境中执行此脚本
 */

// 导入服务（如果在Vue组件中使用）
// import {
//   registerMobileConnection,
//   sendHeartbeat,
//   disconnectMobile,
//   getMobileConnections,
//   generateQRCodeData,
//   getServerUrl
// } from '@/services/mobileConnectionService'

async function testMobileConnection() {
  console.log('🧪 开始测试移动端连接功能...\n')

  try {
    // 测试1：获取服务器URL
    console.log('📍 测试1: 获取服务器URL')
    const serverUrl = await getServerUrl()
    console.log(`✅ 服务器URL: ${serverUrl}\n`)

    // 测试2：生成二维码数据
    console.log('📱 测试2: 生成二维码数据')
    const streamId = `mobile_${Date.now()}`
    const qrData = generateQRCodeData(serverUrl, streamId)
    console.log(`✅ 流ID: ${streamId}`)
    console.log(`✅ 二维码数据: ${qrData}\n`)

    // 测试3：注册连接
    console.log('🔗 测试3: 注册移动端连接')
    const connectionId = `conn_${Date.now()}`
    const registered = await registerMobileConnection(
      connectionId,
      streamId,
      'android'
    )
    console.log(`✅ 注册结果: ${registered ? '成功' : '失败'}\n`)

    // 测试4：获取连接列表
    console.log('📋 测试4: 获取连接列表')
    const connections = await getMobileConnections()
    console.log(`✅ 当前连接数: ${connections.length}`)
    console.log('连接详情:', connections)
    console.log()

    // 测试5：发送心跳
    console.log('💓 测试5: 发送心跳')
    const heartbeatResult = await sendHeartbeat(connectionId)
    console.log(`✅ 心跳结果: ${heartbeatResult ? '成功' : '失败'}\n`)

    // 等待2秒
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 测试6：再次获取连接列表（检查心跳更新）
    console.log('🔄 测试6: 检查心跳更新')
    const updatedConnections = await getMobileConnections()
    const conn = updatedConnections.find(c => c.connection_id === connectionId)
    if (conn) {
      console.log(`✅ 最后心跳时间: ${new Date(conn.last_heartbeat * 1000).toLocaleTimeString()}\n`)
    }

    // 测试7：断开连接
    console.log('❌ 测试7: 断开连接')
    const disconnected = await disconnectMobile(connectionId)
    console.log(`✅ 断开结果: ${disconnected ? '成功' : '失败'}\n`)

    // 测试8：验证已断开
    console.log('✅ 测试8: 验证连接已断开')
    const finalConnections = await getMobileConnections()
    const stillConnected = finalConnections.find(c => c.connection_id === connectionId)
    console.log(`✅ 连接状态: ${stillConnected ? '仍存在' : '已清除'}\n`)

    console.log('🎉 所有测试完成！')

  } catch (error) {
    console.error('❌ 测试失败:', error)
  }
}

// 辅助函数：模拟完整的连接流程
async function simulateFullWorkflow() {
  console.log('\n🚀 模拟完整工作流程...\n')

  // 1. 教师端生成二维码
  console.log('📝 步骤1: 教师端生成二维码')
  const serverUrl = await getServerUrl()
  const streamId = `stream_${Date.now()}`
  const qrData = generateQRCodeData(serverUrl, streamId)
  console.log(`   二维码数据: ${qrData.substring(0, 50)}...`)

  // 2. 手机扫描并解析
  console.log('\n📱 步骤2: 手机扫描二维码')
  const parsed = JSON.parse(qrData)
  console.log(`   解析结果:`)
  console.log(`   - 流ID: ${parsed.id}`)
  console.log(`   - 服务器: ${parsed.serverUrl}`)
  console.log(`   - 类型: ${parsed.type}`)

  // 3. 手机建立WebRTC连接（这里只是模拟）
  console.log('\n🔗 步骤3: 建立WebRTC连接')
  console.log('   [WebRTC握手过程...]')

  // 4. 注册连接
  console.log('\n📝 步骤4: 注册连接到后端')
  const connectionId = `conn_${Date.now()}`
  await registerMobileConnection(connectionId, streamId, 'ios')
  console.log('   ✅ 连接已注册')

  // 5. 启动心跳
  console.log('\n💓 步骤5: 启动心跳定时器')
  const clearTimer = startHeartbeatTimer(connectionId, 5000) // 5秒一次用于测试
  console.log('   ✅ 心跳已启动（每5秒）')

  // 6. 等待一段时间观察
  console.log('\n⏳ 步骤6: 等待15秒观察心跳...')
  await new Promise(resolve => setTimeout(resolve, 15000))

  // 7. 查看连接状态
  console.log('\n📊 步骤7: 查看连接状态')
  const connections = await getMobileConnections()
  const activeConn = connections.find(c => c.connection_id === connectionId)
  if (activeConn) {
    console.log(`   设备类型: ${activeConn.device_type}`)
    console.log(`   连接状态: ${activeConn.status}`)
    console.log(`   最后心跳: ${new Date(activeConn.last_heartbeat * 1000).toLocaleTimeString()}`)
  }

  // 8. 清理
  console.log('\n🧹 步骤8: 清理资源')
  clearTimer()
  await disconnectMobile(connectionId)
  console.log('   ✅ 已断开连接并清除定时器')

  console.log('\n✨ 工作流程模拟完成！\n')
}

// 导出测试函数
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    testMobileConnection,
    simulateFullWorkflow
  }
}

// 如果在浏览器环境中，自动执行测试
if (typeof window !== 'undefined') {
  console.log('📱 移动端连接测试工具已加载')
  console.log('可用函数:')
  console.log('  - testMobileConnection()     运行基础测试')
  console.log('  - simulateFullWorkflow()     模拟完整流程')
}
