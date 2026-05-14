/**
 * 网络摄像机配置管理功能 - 快速测试脚本
 * 
 * 使用方法:
 * 1. 在浏览器控制台(F12)中运行此脚本
 * 2. 或在Vue组件的mounted钩子中调用testFunctions()
 */

// ==================== 导入服务层API ====================
import { 
  updateCameraConfig,
  removeCameraDevice,
  getCameraDetails,
  listPtzDevices,
  registerOnvifDevice
} from '@/services/captureDeviceService'

// ==================== 测试函数 ====================

/**
 * 测试1: 列出所有已注册设备
 */
async function testListDevices() {
  console.log('\n📋 测试1: 列出所有设备')
  try {
    const devices = await listPtzDevices()
    console.log('✅ 已注册设备:', devices)
    return devices
  } catch (error) {
    console.error('❌ 失败:', error)
  }
}

/**
 * 测试2: 获取设备详情
 */
async function testGetDeviceDetails(deviceId) {
  console.log(`\n🔍 测试2: 获取设备详情 - ${deviceId}`)
  try {
    const details = await getCameraDetails(deviceId)
    console.log('✅ 设备详情:', details)
    return details
  } catch (error) {
    console.error('❌ 失败:', error)
  }
}

/**
 * 测试3: 更新设备配置（仅修改名称）
 */
async function testUpdateName(deviceId) {
  console.log(`\n✏️ 测试3: 更新设备名称 - ${deviceId}`)
  try {
    const result = await updateCameraConfig({
      deviceId: deviceId,
      name: '测试摄像机_更新后'
    })
    console.log('✅ 更新结果:', result)
    return result
  } catch (error) {
    console.error('❌ 失败:', error)
  }
}

/**
 * 测试4: 更新设备IP地址
 */
async function testUpdateIP(deviceId, oldIp, newIp) {
  console.log(`\n🌐 测试4: 更新IP地址 - ${oldIp} → ${newIp}`)
  try {
    const result = await updateCameraConfig({
      deviceId: deviceId,
      ip: newIp
    })
    console.log('✅ 更新结果:', result)
    console.log('⚠️ 注意: 设备ID已改变，请使用新ID进行后续操作')
    return result
  } catch (error) {
    console.error('❌ 失败:', error)
  }
}

/**
 * 测试5: 更新密码
 */
async function testUpdatePassword(deviceId, newPassword) {
  console.log(`\n🔒 测试5: 更新密码 - ${deviceId}`)
  try {
    const result = await updateCameraConfig({
      deviceId: deviceId,
      password: newPassword
    })
    console.log('✅ 密码已更新')
    return result
  } catch (error) {
    console.error('❌ 失败:', error)
  }
}

/**
 * 测试6: 删除设备
 */
async function testRemoveDevice(deviceId) {
  console.log(`\n🗑️ 测试6: 删除设备 - ${deviceId}`)
  try {
    // 二次确认
    const confirmed = confirm(`确定要删除设备 "${deviceId}" 吗？`)
    if (!confirmed) {
      console.log('⚠️ 用户取消删除')
      return
    }
    
    const result = await removeCameraDevice(deviceId)
    console.log('✅ 删除结果:', result)
    return result
  } catch (error) {
    console.error('❌ 失败:', error)
  }
}

/**
 * 测试7: 注册新设备
 */
async function testRegisterDevice(ip, username, password, name) {
  console.log(`\n➕ 测试7: 注册新设备 - ${ip}`)
  try {
    const deviceId = await registerOnvifDevice({
      ip: ip,
      username: username,
      password: password,
      name: name || `测试摄像机_${ip.split('.').pop()}`
    })
    console.log('✅ 注册成功，设备ID:', deviceId)
    return deviceId
  } catch (error) {
    console.error('❌ 失败:', error)
  }
}

/**
 * 完整测试流程
 */
async function runFullTest() {
  console.log('🚀 开始完整测试流程...\n')
  
  // 步骤1: 列出所有设备
  const devices = await testListDevices()
  if (!devices || devices.length === 0) {
    console.log('⚠️ 没有已注册的设备，请先注册一个测试设备')
    return
  }
  
  // 步骤2: 获取第一个设备的详情
  const firstDeviceId = devices[0]
  const details = await testGetDeviceDetails(firstDeviceId)
  if (!details) return
  
  // 步骤3: 更新名称
  await testUpdateName(firstDeviceId)
  
  // 步骤4: 更新密码（可选，需要提供实际密码）
  // await testUpdatePassword(firstDeviceId, 'newpassword123')
  
  console.log('\n✅ 测试流程完成！')
  console.log('💡 提示: 可以单独调用各个测试函数进行专项测试')
}

// ==================== 导出测试函数 ====================
export {
  testListDevices,
  testGetDeviceDetails,
  testUpdateName,
  testUpdateIP,
  testUpdatePassword,
  testRemoveDevice,
  testRegisterDevice,
  runFullTest
}

// ==================== 使用示例 ====================
/*
// 在浏览器控制台中:
import { runFullTest, testListDevices } from './test-camera-config.js'

// 运行完整测试
await runFullTest()

// 或单独测试某个功能
await testListDevices()
*/
