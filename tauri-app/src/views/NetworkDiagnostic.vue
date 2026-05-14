<template>
  <div class="network-diagnostic">
    <el-card class="diagnostic-card">
      <template #header>
        <div class="card-header">
          <h2>🔍 网络摄像机连接诊断工具</h2>
          <el-button type="primary" @click="runFullDiagnostic" :loading="running">
            {{ running ? '诊断中...' : '开始完整诊断' }}
          </el-button>
        </div>
      </template>

      <!-- 诊断结果 -->
      <div v-if="diagnosticResults.length > 0" class="results-section">
        <el-timeline>
          <el-timeline-item
            v-for="(result, index) in diagnosticResults"
            :key="index"
            :timestamp="result.timestamp"
            :type="result.status"
            :icon="getStatusIcon(result.status)"
          >
            <div class="result-item">
              <h4>{{ result.title }}</h4>
              <p class="result-detail">{{ result.detail }}</p>
              <div v-if="result.suggestions && result.suggestions.length > 0" class="suggestions">
                <strong>建议：</strong>
                <ul>
                  <li v-for="(suggestion, idx) in result.suggestions" :key="idx">
                    {{ suggestion }}
                  </li>
                </ul>
              </div>
            </div>
          </el-timeline-item>
        </el-timeline>
      </div>

      <!-- 快速测试区域 -->
      <el-divider />

      <div class="quick-test-section">
        <h3>⚡ 快速测试</h3>

        <el-form label-width="120px">
          <el-form-item label="摄像机IP">
            <el-input
              v-model="testIp"
              placeholder="例如: 192.168.1.100"
              style="width: 300px"
            >
              <template #append>
                <el-button @click="testSingleCamera" :loading="testingIp">
                  测试连接
                </el-button>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item label="RTSP端口">
            <el-input-number
              v-model="testPort"
              :min="1"
              :max="65535"
              style="width: 150px"
            />
          </el-form-item>

          <el-form-item label="用户名">
            <el-input v-model="testUsername" placeholder="admin" style="width: 200px" />
          </el-form-item>

          <el-form-item label="密码">
            <el-input
              v-model="testPassword"
              type="password"
              placeholder="admin"
              style="width: 200px"
            />
          </el-form-item>

          <el-form-item>
            <el-button type="success" @click="testRtspStream" :loading="testingStream">
              测试RTSP流
            </el-button>
            <el-button @click="openInVlc">
              在VLC中打开
            </el-button>
          </el-form-item>
        </el-form>

        <!-- RTSP测试结果 -->
        <div v-if="rtspTestResult" class="test-result" :class="rtspTestResult.success ? 'success' : 'error'">
          <el-icon :size="24">
            <component :is="rtspTestResult.success ? CircleCheck : CircleClose" />
          </el-icon>
          <span>{{ rtspTestResult.message }}</span>
        </div>
      </div>

      <!-- 常见配置参考 -->
      <el-divider />

      <div class="reference-section">
        <h3>📋 常见摄像机默认配置</h3>

        <el-table :data="cameraDefaults" stripe style="width: 100%">
          <el-table-column prop="brand" label="品牌" width="120" />
          <el-table-column prop="defaultIp" label="默认IP" width="150" />
          <el-table-column prop="username" label="用户名" width="100" />
          <el-table-column prop="password" label="密码" width="100" />
          <el-table-column prop="rtspPath" label="RTSP路径" min-width="250" />
        </el-table>
      </div>

      <!-- 防火墙配置指南 -->
      <el-divider />

      <div class="firewall-guide">
        <h3>🛡️ Windows防火墙配置</h3>
        <p>如果扫描失败，可能需要添加以下防火墙规则（以管理员身份运行PowerShell）：</p>

        <pre class="code-block"># 允许ONVIF发现（UDP多播）
New-NetFirewallRule -DisplayName "ONVIF Discovery" `
  -Direction Outbound -Action Allow `
  -Protocol UDP -RemotePort 3702

# 允许RTSP入站连接
New-NetFirewallRule -DisplayName "Camera RTSP" `
  -Direction Inbound -Action Allow `
  -Protocol TCP -LocalPort 554</pre>

        <el-button size="small" @click="copyFirewallCommands">
          <el-icon><DocumentCopy /></el-icon>
          复制命令
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { CircleCheck, CircleClose, DocumentCopy } from '@element-plus/icons-vue';
import { invoke } from '@tauri-apps/api/core';

const running = ref(false);
const testingIp = ref(false);
const testingStream = ref(false);
const diagnosticResults = ref([]);

// 测试参数
const testIp = ref('');
const testPort = ref(554);
const testUsername = ref('admin');
const testPassword = ref('admin');
const rtspTestResult = ref(null);

// 常见摄像机默认配置
const cameraDefaults = [
  {
    brand: '海康威视',
    defaultIp: '192.168.1.64',
    username: 'admin',
    password: '12345',
    rtspPath: '/h264/ch1/main/av_stream'
  },
  {
    brand: '大华',
    defaultIp: '192.168.1.108',
    username: 'admin',
    password: 'admin',
    rtspPath: '/cam/realmonitor?channel=1&subtype=0'
  },
  {
    brand: 'Axis',
    defaultIp: 'DHCP',
    username: 'root',
    password: 'pass',
    rtspPath: '/axis-media/media.amp'
  },
  {
    brand: 'Hikvision NVR',
    defaultIp: '192.168.1.100',
    username: 'admin',
    password: '12345',
    rtspPath: '/Streaming/Channels/101'
  }
];

/**
 * 获取状态图标
 */
function getStatusIcon(status) {
  const icons = {
    success: CircleCheck,
    warning: 'Warning',
    error: CircleClose
  };
  return icons[status] || CircleCheck;
}

/**
 * 运行完整诊断
 */
async function runFullDiagnostic() {
  running.value = true;
  diagnosticResults.value = [];

  try {
    // 1. 检查本地IP
    await checkLocalIp();

    // 2. 尝试ONVIF发现
    await testOnvifDiscovery();

    // 3. 尝试子网扫描
    await testSubnetScan();

    // 4. 综合发现
    await testComprehensiveDiscovery();

    ElMessage.success('诊断完成！请查看上方的详细结果');
  } catch (error) {
    ElMessage.error('诊断过程出错: ' + error.message);
  } finally {
    running.value = false;
  }
}

/**
 * 检查本地IP
 */
async function checkLocalIp() {
  const timestamp = new Date().toLocaleTimeString();

  try {
    const localIp = await invoke('get_local_ip');

    diagnosticResults.value.push({
      timestamp,
      status: 'success',
      title: '✅ 本地IP检测成功',
      detail: `当前IP地址: ${localIp}`,
      suggestions: [
        `您的设备位于 ${localIp.split('.').slice(0, 3).join('.')}.x 网段`,
        '确保摄像机在同一网段内'
      ]
    });
  } catch (error) {
    diagnosticResults.value.push({
      timestamp,
      status: 'error',
      title: '❌ 无法获取本地IP',
      detail: error.message,
      suggestions: [
        '检查网络连接是否正常',
        '确认已连接到局域网',
        '尝试 ping 网关测试连通性'
      ]
    });
  }
}

/**
 * 测试ONVIF发现
 */
async function testOnvifDiscovery() {
  const timestamp = new Date().toLocaleTimeString();

  try {
    const devices = await invoke('onvif_discover_devices', { timeoutSecs: 5 });

    if (devices.length > 0) {
      diagnosticResults.value.push({
        timestamp,
        status: 'success',
        title: `✅ ONVIF发现成功 (${devices.length}个设备)`,
        detail: devices.map(d => `${d.name || d.ip} @ ${d.ip}`).join(', '),
        suggestions: ['可以直接使用这些设备进行注册']
      });
    } else {
      diagnosticResults.value.push({
        timestamp,
        status: 'warning',
        title: '⚠️ ONVIF未发现设备',
        detail: '可能的原因：防火墙阻止、摄像机未启用ONVIF、不在同一网段',
        suggestions: [
          '检查Windows防火墙设置',
          '确认摄像机已启用ONVIF服务',
          '尝试子网扫描方式'
        ]
      });
    }
  } catch (error) {
    diagnosticResults.value.push({
      timestamp,
      status: 'error',
      title: '❌ ONVIF发现失败',
      detail: error.message,
      suggestions: [
        'UDP多播可能被阻止',
        '尝试其他扫描方式'
      ]
    });
  }
}

/**
 * 测试子网扫描
 */
async function testSubnetScan() {
  const timestamp = new Date().toLocaleTimeString();

  try {
    const cameras = await invoke('scan_local_subnet', { timeoutSecs: 5 });

    if (cameras.length > 0) {
      diagnosticResults.value.push({
        timestamp,
        status: 'success',
        title: `✅ 子网扫描成功 (${cameras.length}个设备)`,
        detail: cameras.map(c => `${c.address}:${c.port}`).join(', '),
        suggestions: ['这些设备可能不支持ONVIF，但开放了常见端口']
      });
    } else {
      diagnosticResults.value.push({
        timestamp,
        status: 'warning',
        title: '⚠️ 子网扫描未发现设备',
        detail: '未在当前子网发现开放的摄像机端口',
        suggestions: [
          '确认摄像机IP地址范围',
          '尝试手动指定IP进行扫描',
          '检查摄像机是否在线'
        ]
      });
    }
  } catch (error) {
    diagnosticResults.value.push({
      timestamp,
      status: 'error',
      title: '❌ 子网扫描失败',
      detail: error.message,
      suggestions: ['可能是网络权限或超时问题']
    });
  }
}

/**
 * 测试综合发现
 */
async function testComprehensiveDiscovery() {
  const timestamp = new Date().toLocaleTimeString();

  try {
    const result = await invoke('discover_all_cameras', { timeoutSecs: 5 });

    if (result.cameras && result.cameras.length > 0) {
      diagnosticResults.value.push({
        timestamp,
        status: 'success',
        title: `✅ 综合发现成功 (${result.cameras.length}个设备)`,
        detail: `耗时: ${result.scan_duration_ms}ms`,
        suggestions: ['这是最全面的扫描方式，建议使用此结果']
      });
    } else {
      diagnosticResults.value.push({
        timestamp,
        status: 'warning',
        title: '⚠️ 综合发现未找到设备',
        detail: '所有扫描方式均未发现设备',
        suggestions: [
          '强烈建议手动添加摄像机',
          '确认摄像机网络连接正常',
          '联系网络管理员检查网络配置'
        ]
      });
    }
  } catch (error) {
    diagnosticResults.value.push({
      timestamp,
      status: 'error',
      title: '❌ 综合发现失败',
      detail: error.message,
      suggestions: ['系统级错误，请检查应用日志']
    });
  }
}

/**
 * 测试单个摄像机IP
 */
async function testSingleCamera() {
  if (!testIp.value) {
    ElMessage.warning('请输入摄像机IP地址');
    return;
  }

  testingIp.value = true;

  try {
    // 测试端口连接
    const result = await invoke('scan_network_cameras', {
      ips: [testIp.value],
      ports: [testPort.value],
      timeoutSecs: 3
    });

    if (result.length > 0) {
      ElMessage.success(`✓ ${testIp.value}:${testPort.value} 端口开放`);
    } else {
      ElMessage.warning(`✗ ${testIp.value}:${testPort.value} 端口未开放或不可达`);
    }
  } catch (error) {
    ElMessage.error('测试失败: ' + error.message);
  } finally {
    testingIp.value = false;
  }
}

/**
 * 测试RTSP流
 */
async function testRtspStream() {
  if (!testIp.value) {
    ElMessage.warning('请输入摄像机IP地址');
    return;
  }

  testingStream.value = true;
  rtspTestResult.value = null;

  try {
    const rtspUrl = `rtsp://${testUsername.value}:${testPassword.value}@${testIp.value}:${testPort.value}/stream`;

    // 这里可以调用后端API测试RTSP流
    // 暂时只生成URL供用户在VLC中测试
    rtspTestResult.value = {
      success: true,
      message: `RTSP URL已生成: ${rtspUrl}\n请在VLC播放器中打开测试`
    };

    ElMessage.success('RTSP URL已生成，请在VLC中测试');
  } catch (error) {
    rtspTestResult.value = {
      success: false,
      message: error.message
    };
    ElMessage.error('RTSP测试失败: ' + error.message);
  } finally {
    testingStream.value = false;
  }
}

/**
 * 在VLC中打开
 */
function openInVlc() {
  if (!testIp.value) {
    ElMessage.warning('请输入摄像机IP地址');
    return;
  }

  const rtspUrl = `rtsp://${testUsername.value}:${testPassword.value}@${testIp.value}:${testPort.value}/stream`;

  // 复制到剪贴板
  navigator.clipboard.writeText(rtspUrl).then(() => {
    ElMessage.success('RTSP URL已复制到剪贴板，请在VLC中粘贴打开');
  }).catch(() => {
    ElMessage.warning('复制失败，请手动复制: ' + rtspUrl);
  });
}

/**
 * 复制防火墙命令
 */
function copyFirewallCommands() {
  const commands = `# 允许ONVIF发现（UDP多播）
New-NetFirewallRule -DisplayName "ONVIF Discovery" \`
  -Direction Outbound -Action Allow \`
  -Protocol UDP -RemotePort 3702

# 允许RTSP入站连接
New-NetFirewallRule -DisplayName "Camera RTSP" \`
  -Direction Inbound -Action Allow \`
  -Protocol TCP -LocalPort 554`;

  navigator.clipboard.writeText(commands).then(() => {
    ElMessage.success('防火墙命令已复制到剪贴板');
  }).catch(() => {
    ElMessage.error('复制失败');
  });
}
</script>

<style scoped lang="scss">
.network-diagnostic {
  padding: 20px;

  .diagnostic-card {
    max-width: 1200px;
    margin: 0 auto;

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      h2 {
        margin: 0;
        font-size: 20px;
      }
    }
  }

  .results-section {
    margin-top: 20px;

    .result-item {
      h4 {
        margin: 0 0 8px 0;
        font-size: 16px;
      }

      .result-detail {
        margin: 0 0 12px 0;
        color: #606266;
        line-height: 1.6;
      }

      .suggestions {
        margin-top: 12px;
        padding: 12px;
        background: #f5f7fa;
        border-radius: 4px;

        ul {
          margin: 8px 0 0 20px;
          padding: 0;

          li {
            margin: 4px 0;
            color: #606266;
            line-height: 1.6;
          }
        }
      }
    }
  }

  .quick-test-section {
    margin-top: 20px;

    h3 {
      margin: 0 0 16px 0;
      font-size: 16px;
    }

    .test-result {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border-radius: 4px;
      margin-top: 16px;

      &.success {
        background: #f0f9ff;
        border: 1px solid #67c23a;
        color: #67c23a;
      }

      &.error {
        background: #fef0f0;
        border: 1px solid #f56c6c;
        color: #f56c6c;
      }
    }
  }

  .reference-section {
    margin-top: 20px;

    h3 {
      margin: 0 0 16px 0;
      font-size: 16px;
    }
  }

  .firewall-guide {
    margin-top: 20px;

    h3 {
      margin: 0 0 12px 0;
      font-size: 16px;
    }

    p {
      margin: 0 0 12px 0;
      color: #606266;
    }

    .code-block {
      padding: 16px;
      background: #282c34;
      color: #abb2bf;
      border-radius: 4px;
      overflow-x: auto;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.6;
      margin: 12px 0;
    }
  }
}
</style>
