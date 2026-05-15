<template>
  <div class="camera-discovery-panel">
    <!-- 头部信息 -->
    <div class="panel-header">
      <h3>🎥 网络摄像机发现</h3>
      <div class="local-ip-info">
        <span class="label">本地 IP:</span>
        <span class="value">{{ localIp || '检测中...' }}</span>
        <el-button size="small" @click="refreshLocalIp" :loading="ipLoading">刷新</el-button>
      </div>
    </div>

    <!-- 扫描控制区 -->
    <div class="scan-controls">
      <el-radio-group v-model="scanMode" size="default">
        <el-radio-button value="all_interfaces">🌐 多网卡扫描（推荐）</el-radio-button>
        <el-radio-button value="subnet">自动子网扫描</el-radio-button>
        <el-radio-button value="full">综合发现</el-radio-button>
        <el-radio-button value="manual">手动指定</el-radio-button>
      </el-radio-group>

      <!-- 🎯 协议选择 (仅在综合发现模式下显示) -->
      <div v-if="scanMode === 'full'" class="protocol-selector">
        <span class="label">发现协议:</span>
        <el-checkbox-group v-model="selectedProtocols" size="small">
          <el-checkbox label="onvif">ONVIF</el-checkbox>
          <el-checkbox label="gb28181">GB/T 28181</el-checkbox>
          <el-checkbox label="hikvision">海康SADP</el-checkbox>
          <el-checkbox label="dahua">大华P2P</el-checkbox>
          <el-checkbox label="portscan">端口扫描</el-checkbox>
        </el-checkbox-group>
      </div>

      <div class="timeout-control">
        <span class="label">超时时间:</span>
        <el-input-number
          v-model="timeoutSecs"
          :min="1"
          :max="30"
          size="small"
          controls-position="right"
        />
        <span class="unit">秒</span>
      </div>

      <el-button
        type="primary"
        @click="startScan"
        :loading="scanning"
        :disabled="scanning"
        class="scan-btn"
      >
        {{ scanning ? '扫描中...' : '开始扫描' }}
      </el-button>

      <el-button
        type="info"
        size="small"
        @click="debugNetworkInterfaces"
        class="debug-btn"
      >
        🔍 诊断网络接口
      </el-button>
    </div>

    <!-- 网络接口信息 -->
    <div v-if="networkInterfaces.length > 0" class="network-interfaces-info">
      <h4>📡 检测到的网络接口 ({{ networkInterfaces.length }})</h4>
      <div class="interface-list">
        <div
          v-for="(iface, index) in networkInterfaces"
          :key="index"
          class="interface-item"
          :class="{ 'is-primary': iface.is_primary }"
        >
          <span class="iface-name">{{ iface.name }}</span>
          <span class="iface-ip">{{ iface.ip }}</span>
          <span class="iface-subnet">{{ iface.subnet }}</span>
          <el-tag v-if="iface.is_primary" size="small" type="success">主网卡</el-tag>
        </div>
      </div>
    </div>

    <!-- 手动指定模式 -->
    <div v-if="scanMode === 'manual'" class="manual-config">
      <el-form label-width="100px" size="small">
        <el-form-item label="IP 地址范围">
          <el-input
            v-model="manualIpRange"
            placeholder="例如: 192.168.1.1-192.168.1.254"
          />
          <div class="form-tip">支持单个IP、IP范围或逗号分隔的多个IP</div>
        </el-form-item>

        <el-form-item label="扫描端口">
          <el-checkbox-group v-model="selectedPorts">
            <el-checkbox label="80">HTTP(80)</el-checkbox>
            <el-checkbox label="554">RTSP(554)</el-checkbox>
            <el-checkbox label="8000">海康(8000)</el-checkbox>
            <el-checkbox label="8080">通用(8080)</el-checkbox>
            <el-checkbox label="8899">大华(8899)</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
    </div>

    <!-- 扫描进度 -->
    <div v-if="scanning" class="scan-progress">
      <el-progress
        :percentage="scanProgress"
        :status="scanStatus"
        :stroke-width="8"
      />
      <div class="progress-info">
        <span>{{ progressText }}</span>
        <span class="elapsed-time">已用时: {{ elapsedTime }}s</span>
      </div>
      <div v-if="foundCount > 0" class="found-count">
        已发现: <strong>{{ foundCount }}</strong> 个设备
      </div>
    </div>

    <!-- 设备列表 -->
    <div v-if="cameras.length > 0" class="camera-list">
      <div class="list-header">
        <h4>发现的设备 ({{ cameras.length }})</h4>
        <div class="header-actions">
          <el-button 
            size="small" 
            type="success"
            @click="showBatchConfigDialog = true"
            :disabled="selectedDevices.length === 0"
          >
            🔧 批量配置 ({{ selectedDevices.length }})
          </el-button>
          <el-button size="small" @click="exportDevices">导出</el-button>
          <el-button size="small" @click="showTemplateDialog = true">📋 模板管理</el-button>
        </div>
      </div>

      <el-table
        :data="cameras"
        style="width: 100%"
        max-height="400"
        stripe
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="address" label="IP 地址" width="140">
          <template #default="{ row }">
            <el-input 
              v-if="row.editing" 
              v-model="row.address" 
              size="small"
              placeholder="IP地址"
            />
            <span v-else>{{ row.address }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="port" label="端口" width="100">
          <template #default="{ row }">
            <el-input-number 
              v-if="row.editing" 
              v-model="row.port" 
              :min="1"
              :max="65535"
              size="small"
              controls-position="right"
              style="width: 100%"
            />
            <span v-else>{{ row.port }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="设备名称" min-width="150">
          <template #default="{ row }">
            <el-input 
              v-if="row.editing" 
              v-model="row.name" 
              size="small"
              placeholder="设备名称"
            />
            <span v-else>{{ row.name || `摄像机_${row.address.split('.').pop()}` }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="protocol" label="协议" width="100" />
        <el-table-column label="认证信息" width="200">
          <template #default="{ row }">
            <div v-if="row.editing" class="auth-fields">
              <el-input 
                v-model="row.username" 
                size="small"
                placeholder="用户名"
                style="margin-bottom: 4px"
              />
              <el-input 
                v-model="row.password" 
                size="small"
                type="password"
                show-password
                placeholder="密码"
              />
            </div>
            <span v-else class="auth-display">
              {{ row.username || 'admin' }} / ***
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <template v-if="!row.editing">
              <el-button size="small" type="primary" @click="registerDevice(row)">
                注册
              </el-button>
              <el-button size="small" @click="previewDevice(row)">
                预览
              </el-button>
              <el-button size="small" type="warning" @click="startEdit(row)">
                ✏️ 编辑
              </el-button>
              <el-button size="small" type="danger" @click="removeDevice(row)">
                删除
              </el-button>
            </template>
            <template v-else>
              <el-button size="small" type="success" @click="saveEdit(row)" :loading="row.saving">
                💾 保存
              </el-button>
              <el-button size="small" @click="cancelEdit(row)">
                ❌ 取消
              </el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 空状态 -->
    <div v-else-if="!scanning && scanned" class="empty-state">
      <el-empty description="未发现设备">
        <template #image>
          <el-icon :size="80" color="#c0c4cc"><VideoCamera /></el-icon>
        </template>
        <p class="empty-hint">请检查以下项目：</p>
        <ul class="troubleshoot-list">
          <li>✓ 摄像机已连接网络并通电</li>
          <li>✓ 防火墙允许扫描请求</li>
          <li>✓ IP 地址段配置正确</li>
          <li>✓ 摄像机启用了 ONVIF/RTSP 服务</li>
        </ul>
      </el-empty>
    </div>

    <!-- 注册对话框 -->
    <el-dialog
      v-model="showRegisterDialog"
      title="注册摄像机"
      width="500px"
    >
      <el-form :model="registerForm" label-width="100px">
        <el-form-item label="设备 IP">
          <el-input v-model="registerForm.ip" disabled />
        </el-form-item>
        <el-form-item label="设备名称">
          <el-input v-model="registerForm.name" placeholder="自定义设备名称" />
        </el-form-item>
        <el-form-item label="用户名">
          <el-input v-model="registerForm.username" placeholder="admin" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="registerForm.password"
            type="password"
            show-password
            placeholder="admin"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showRegisterDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmRegister" :loading="registering">
          确认注册
        </el-button>
      </template>
    </el-dialog>

    <!-- 🎯 配置编辑对话框 -->
    <el-dialog
      v-model="showConfigDialog"
      title="编辑摄像机配置"
      width="500px"
    >
      <el-alert
        title="提示：修改IP或端口后，设备ID将会改变"
        type="info"
        :closable="false"
        style="margin-bottom: 15px"
      />
      
      <el-form :model="configForm" label-width="100px">
        <el-form-item label="当前设备ID">
          <el-input v-model="configForm.deviceId" disabled />
        </el-form-item>
        <el-form-item label="设备名称">
          <el-input v-model="configForm.name" placeholder="自定义设备名称" />
        </el-form-item>
        <el-form-item label="IP 地址">
          <el-input v-model="configForm.ip" placeholder="192.168.1.100" />
        </el-form-item>
        <el-form-item label="端口">
          <el-input-number
            v-model="configForm.port"
            :min="1"
            :max="65535"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="用户名">
          <el-input v-model="configForm.username" placeholder="admin" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="configForm.password"
            type="password"
            show-password
            placeholder="请输入密码"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="testConnection" :loading="testingConnection">
          🔍 测试连接
        </el-button>
        <el-button @click="showConfigDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmUpdateConfig" :loading="updatingConfig">
          保存配置
        </el-button>
      </template>
    </el-dialog>

    <!-- 🎯 批量配置对话框 -->
    <el-dialog
      v-model="showBatchConfigDialog"
      title="批量配置摄像机"
      width="600px"
    >
      <el-alert
        title="将选中的设备统一修改指定参数（未填写的参数保持不变）"
        type="warning"
        :closable="false"
        style="margin-bottom: 15px"
      />
      
      <div class="selected-devices-info">
        <h4>已选择 {{ selectedDevices.length }} 个设备:</h4>
        <div class="device-tags">
          <el-tag
            v-for="device in selectedDevices"
            :key="device.address"
            closable
            @close="removeSelectedDevice(device)"
            style="margin-right: 8px; margin-bottom: 8px"
          >
            {{ device.name || device.address }}
          </el-tag>
        </div>
      </div>

      <el-divider />
      
      <el-form :model="batchConfigForm" label-width="100px">
        <el-form-item label="设备名称前缀">
          <el-input 
            v-model="batchConfigForm.namePrefix" 
            placeholder="可选，如：会议室_"
          />
          <div class="form-tip">将在原名称前添加此 prefix</div>
        </el-form-item>
        <el-form-item label="用户名">
          <el-input v-model="batchConfigForm.username" placeholder="留空则不修改" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="batchConfigForm.password"
            type="password"
            show-password
            placeholder="留空则不修改"
          />
        </el-form-item>
        <el-form-item label="端口">
          <el-input-number
            v-model="batchConfigForm.port"
            :min="1"
            :max="65535"
            controls-position="right"
            placeholder="留空则不修改"
            style="width: 100%"
            clearable
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showBatchConfigDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmBatchConfig" :loading="batchUpdating">
          应用配置
        </el-button>
      </template>
    </el-dialog>

    <!-- 🎯 配置模板管理对话框 -->
    <el-dialog
      v-model="showTemplateDialog"
      title="配置模板管理"
      width="700px"
    >
      <el-tabs v-model="templateActiveTab">
        <el-tab-pane label="保存模板" name="save">
          <el-form :model="templateForm" label-width="100px">
            <el-form-item label="模板名称">
              <el-input v-model="templateForm.name" placeholder="例如：海康威视默认配置" />
            </el-form-item>
            <el-form-item label="描述">
              <el-input v-model="templateForm.description" type="textarea" :rows="2" placeholder="模板说明" />
            </el-form-item>
            <el-form-item label="用户名">
              <el-input v-model="templateForm.username" placeholder="admin" />
            </el-form-item>
            <el-form-item label="密码">
              <el-input
                v-model="templateForm.password"
                type="password"
                show-password
                placeholder="admin"
              />
            </el-form-item>
            <el-form-item label="端口">
              <el-input-number
                v-model="templateForm.port"
                :min="1"
                :max="65535"
                controls-position="right"
                style="width: 100%"
              />
            </el-form-item>
          </el-form>
          
          <template #footer>
            <el-button @click="showTemplateDialog = false">取消</el-button>
            <el-button type="primary" @click="saveTemplate">保存模板</el-button>
          </template>
        </el-tab-pane>

        <el-tab-pane label="应用模板" name="apply">
          <div v-if="templates.length === 0" class="empty-templates">
            <el-empty description="暂无模板" :image-size="80">
              <template #description>
                <p>请先在"保存模板"标签页创建配置模板</p>
              </template>
            </el-empty>
          </div>
          <div v-else class="template-list">
            <el-table :data="templates" style="width: 100%">
              <el-table-column prop="name" label="模板名称" width="150" />
              <el-table-column prop="description" label="描述" min-width="200" />
              <el-table-column prop="username" label="用户名" width="100" />
              <el-table-column prop="port" label="端口" width="80" />
              <el-table-column label="操作" width="150" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" type="primary" @click="applyTemplate(row)">
                    应用
                  </el-button>
                  <el-button size="small" type="danger" @click="deleteTemplate(row)">
                    删除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { ElMessage, ElMessageBox } from 'element-plus';
import { VideoCamera } from '@element-plus/icons-vue';

// 状态变量
const localIp = ref('');
const ipLoading = ref(false);
const scanMode = ref('all_interfaces'); // all_interfaces | subnet | full | manual
const timeoutSecs = ref(5);
const scanning = ref(false);
const scanned = ref(false);
const cameras = ref([]);
const scanProgress = ref(0);
const scanStatus = ref('');
const progressText = ref('准备扫描...');
const foundCount = ref(0);
const startTime = ref(0);
const elapsedTime = ref(0);
const networkInterfaces = ref([]); // 网络接口列表

// 🎯 协议选择 (综合发现模式)
const selectedProtocols = ref(['onvif', 'gb28181', 'hikvision', 'dahua', 'portscan']);

let timerInterval = null;
let unlisten = null;

// 手动配置
const manualIpRange = ref('');
const selectedPorts = ref(['80', '554', '8000']);

// 注册对话框
const showRegisterDialog = ref(false);
const registerForm = ref({
  ip: '',
  name: '',
  username: 'admin',
  password: 'admin'
});
const registering = ref(false);

// 🎯 配置编辑对话框
const showConfigDialog = ref(false);
const configForm = ref({
  deviceId: '',
  name: '',
  username: 'admin',
  password: '',
  ip: '',
  port: 80
});
const updatingConfig = ref(false);

// 🎯 批量配置对话框
const showBatchConfigDialog = ref(false);
const selectedDevices = ref([]);
const batchConfigForm = ref({
  namePrefix: '',
  username: '',
  password: '',
  port: null
});
const batchUpdating = ref(false);

// 🎯 配置模板管理对话框
const showTemplateDialog = ref(false);
const templateActiveTab = ref('save');
const templates = ref([]);
const templateForm = ref({
  name: '',
  description: '',
  username: 'admin',
  password: 'admin',
  port: 80
});

// 获取本地 IP
const refreshLocalIp = async () => {
  ipLoading.value = true;
  try {
    localIp.value = await invoke('get_local_ip');
    ElMessage.success('IP 地址已更新');
  } catch (error) {
    ElMessage.error('获取 IP 失败: ' + error);
  } finally {
    ipLoading.value = false;
  }
};

// 🎯 诊断网络接口（调试功能）
const debugNetworkInterfaces = async () => {
  try {
    console.log('🔍 开始诊断网络接口...');
    
    const result = await invoke('get_network_interfaces_info');
    console.log('📡 检测到的网络接口:', result);
    
    if (result.count === 0) {
      ElMessage.warning({
        message: '⚠️ 未检测到有效的网络接口！请检查网络连接',
        duration: 5000,
        showClose: true
      });
    } else {
      ElMessage.success({
        message: `✅ 检测到 ${result.count} 个网络接口，详见控制台`,
        duration: 3000,
        showClose: true
      });
      
      // 在控制台输出详细信息
      console.table(result.interfaces.map(iface => ({
        '网卡名称': iface.name,
        'IP 地址': iface.ip,
        '子网': iface.subnet,
        '主网卡': iface.is_primary ? '是' : '否'
      })));
    }
  } catch (error) {
    console.error('❌ 诊断失败:', error);
    ElMessage.error(`诊断失败: ${error}`);
  }
};

// 监听扫描进度事件
const setupProgressListener = async () => {
  // 监听扫描进度
  const unlistenProgress = await listen('scan-progress', (event) => {
    const data = event.payload;
    scanProgress.value = data.progress;
    progressText.value = data.message;
    foundCount.value = data.found_count;

    if (data.progress === 100) {
      scanStatus.value = 'success';
    }
  });

  // 监听网络接口信息
  const unlistenInterfaces = await listen('network-interfaces', (event) => {
    const data = event.payload;
    networkInterfaces.value = data.interfaces;
    console.log(`检测到 ${data.count} 个网络接口`);
  });

  // 返回清理函数
  return () => {
    if (unlistenProgress) unlistenProgress();
    if (unlistenInterfaces) unlistenInterfaces();
  };
};

// 开始扫描
const startScan = async () => {
  scanning.value = true;
  scanned.value = false;
  cameras.value = [];
  scanProgress.value = 0;
  foundCount.value = 0;
  startTime.value = Date.now();

  // 启动计时器
  timerInterval = setInterval(() => {
    elapsedTime.value = Math.floor((Date.now() - startTime.value) / 1000);
  }, 1000);

  try {
    let result;

    if (scanMode.value === 'all_interfaces') {
      // 多网卡扫描（推荐）
      progressText.value = '正在扫描所有网络接口...';
      networkInterfaces.value = []; // 清空之前的接口列表
      result = await invoke('scan_all_network_interfaces', {
        timeoutSecs: timeoutSecs.value
      });
      cameras.value = result;

    } else if (scanMode.value === 'subnet') {
      // 自动子网扫描（带进度）
      progressText.value = '正在扫描本地子网...';
      result = await invoke('scan_local_subnet_with_progress', {
        timeoutSecs: timeoutSecs.value
      });
      cameras.value = result;

    } else if (scanMode.value === 'full') {
      // 🎯 综合发现 - 根据选择的协议执行不同的发现方式
      progressText.value = '正在进行综合发现...';
      
      const selectedProtos = selectedProtocols.value;
      let allDevices = [];
      
      // 如果选择了多个协议,并行执行
      const promises = [];
      
      if (selectedProtos.includes('onvif')) {
        progressText.value = '正在通过ONVIF协议发现...';
        promises.push(
          invoke('discover_all_cameras', { timeoutSecs: timeoutSecs.value })
            .then(result => result.cameras)
        );
      }
      
      if (selectedProtos.includes('gb28181')) {
        progressText.value = '正在通过GB/T 28181协议发现...';
        promises.push(
          invoke('discover_gb28181_devices', { timeoutSecs: timeoutSecs.value })
        );
      }
      
      if (selectedProtos.includes('hikvision') || selectedProtos.includes('dahua')) {
        progressText.value = '正在通过厂商私有协议发现...';
        promises.push(
          invoke('discover_vendor_cameras', { timeoutSecs: timeoutSecs.value })
        );
      }
      
      if (selectedProtos.includes('portscan')) {
        progressText.value = '正在进行端口扫描...';
        const localIp = await invoke('get_local_ip');
        const subnetHosts = generateSubnetFromIp(localIp);
        promises.push(
          invoke('scan_network_cameras', {
            ips: subnetHosts,
            ports: [80, 554, 8000, 8080],
            timeoutSecs: timeoutSecs.value
          })
        );
      }
      
      // 等待所有协议完成
      if (promises.length > 0) {
        const results = await Promise.all(promises);
        allDevices = results.flat();
        
        // 去重
        const seen = new Set();
        cameras.value = allDevices.filter(device => {
          if (seen.has(device.address)) return false;
          seen.add(device.address);
          return true;
        });
        
        console.log(`综合发现耗时: ${Math.floor((Date.now() - startTime.value) / 1000)}s`);
      } else {
        ElMessage.warning('请至少选择一个发现协议');
        scanning.value = false;
        clearInterval(timerInterval);
        return;
      }
    } else if (scanMode.value === 'manual') {
      // 手动指定
      progressText.value = '正在扫描指定 IP...';
      const ips = parseIpRange(manualIpRange.value);
      const ports = selectedPorts.value.map(p => parseInt(p));

      result = await invoke('scan_network_cameras', {
        ips,
        ports,
        timeoutSecs: timeoutSecs.value
      });
      cameras.value = result;
    }

    // 🎯 为每个设备添加编辑状态字段和默认认证信息
    cameras.value = cameras.value.map(device => ({
      ...device,
      editing: false,
      saving: false,
      username: device.username || 'admin',
      password: device.password || ''
    }));

    foundCount.value = cameras.value.length;
    scanProgress.value = 100;
    scanStatus.value = 'success';
    scanned.value = true;

    if (cameras.value.length === 0) {
      ElMessage.warning('未发现设备，请检查网络连接');
    } else {
      ElMessage.success(`发现 ${cameras.value.length} 个设备`);
    }

  } catch (error) {
    scanStatus.value = 'exception';
    progressText.value = '扫描失败';
    ElMessage.error('扫描失败: ' + error);
  } finally {
    scanning.value = false;
    clearInterval(timerInterval);
  }
};

// 解析 IP 范围
const parseIpRange = (rangeStr) => {
  const ips = [];

  if (!rangeStr.trim()) {
    return ips;
  }

  // 处理逗号分隔的多个 IP
  const parts = rangeStr.split(',').map(s => s.trim());

  for (const part of parts) {
    if (part.includes('-')) {
      // IP 范围: 192.168.1.1-192.168.1.254
      const [start, end] = part.split('-').map(s => s.trim());
      const startParts = start.split('.').map(Number);
      const endParts = end.split('.').map(Number);

      if (startParts[0] === endParts[0] &&
          startParts[1] === endParts[1] &&
          startParts[2] === endParts[2]) {
        // 同一网段
        for (let i = startParts[3]; i <= endParts[3]; i++) {
          ips.push(`${startParts[0]}.${startParts[1]}.${startParts[2]}.${i}`);
        }
      }
    } else if (part.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
      // 单个 IP
      ips.push(part);
    }
  }

  return ips;
};

// 🎯 从IP地址生成子网主机列表 (/24)
const generateSubnetFromIp = (ip) => {
  const parts = ip.split('.').map(Number);
  const hosts = [];
  
  // 生成 1-254 的主机列表
  for (let i = 1; i <= 254; i++) {
    hosts.push(`${parts[0]}.${parts[1]}.${parts[2]}.${i}`);
  }
  
  return hosts;
};

// 注册设备
const registerDevice = (camera) => {
  registerForm.value = {
    ip: camera.address,
    name: camera.name || `摄像机_${camera.address.split('.').pop()}`,
    username: 'admin',
    password: 'admin'
  };
  showRegisterDialog.value = true;
};

// 确认注册
const confirmRegister = async () => {
  registering.value = true;
  try {
    await invoke('ptz_register_device', {
      ip: registerForm.value.ip,
      username: registerForm.value.username,
      password: registerForm.value.password,
      name: registerForm.value.name
    });

    ElMessage.success('设备注册成功');
    showRegisterDialog.value = false;
  } catch (error) {
    ElMessage.error('注册失败: ' + error);
  } finally {
    registering.value = false;
  }
};

// 预览设备
const previewDevice = (camera) => {
  ElMessage.info(`预览功能开发中: ${camera.address}:${camera.port}`);
  // TODO: 打开预览窗口
};

// 🎯 开始行内编辑
const startEdit = (row) => {
  // 保存原始数据用于取消时恢复
  row._originalData = {
    address: row.address,
    port: row.port,
    name: row.name,
    username: row.username || 'admin',
    password: row.password || ''
  };
  row.editing = true;
};

// 🎯 保存行内编辑
const saveEdit = async (row) => {
  row.saving = true;
  
  try {
    // 验证IP地址格式
    if (!isValidIp(row.address)) {
      ElMessage.error('IP地址格式不正确');
      row.saving = false;
      return;
    }
    
    // 验证端口范围
    if (row.port < 1 || row.port > 65535) {
      ElMessage.error('端口号必须在1-65535之间');
      row.saving = false;
      return;
    }
    
    // 如果设备已注册,则更新配置
    const deviceId = row.name || `摄像机_${row.address.split('.').pop()}`;
    const originalId = row._originalData?.name || `摄像机_${row._originalData?.address.split('.').pop()}`;
    
    // 检查是否是已注册设备
    const isRegistered = await checkDeviceRegistered(originalId);
    
    if (isRegistered) {
      // 更新已注册设备的配置
      await invoke('update_camera_config', {
        deviceId: originalId,
        name: row.name || null,
        username: row.username || null,
        password: row.password || null,
        ip: row.address !== row._originalData?.address ? row.address : null,
        port: row.port !== row._originalData?.port ? row.port : null
      });
      
      ElMessage.success('设备配置已更新');
    } else {
      // 未注册设备,只更新本地列表
      ElMessage.success('配置已保存到本地(设备未注册)');
    }
    
    // 清除编辑状态
    row.editing = false;
    row.saving = false;
    delete row._originalData;
    
  } catch (error) {
    ElMessage.error('保存失败: ' + error);
    row.saving = false;
  }
};

// 🎯 取消行内编辑
const cancelEdit = (row) => {
  // 恢复原始数据
  if (row._originalData) {
    row.address = row._originalData.address;
    row.port = row._originalData.port;
    row.name = row._originalData.name;
    row.username = row._originalData.username;
    row.password = row._originalData.password;
    delete row._originalData;
  }
  row.editing = false;
};

// 🎯 验证IP地址格式
const isValidIp = (ip) => {
  const pattern = /^(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])$/;
  return pattern.test(ip);
};

// 🎯 检查设备是否已注册
const checkDeviceRegistered = async (deviceId) => {
  try {
    await invoke('get_camera_details', { deviceId });
    return true;
  } catch (error) {
    return false;
  }
};

// 🎯 编辑设备配置
const editConfig = async (camera) => {
  try {
    // 获取设备详细信息
    const details = await invoke('get_camera_details', { 
      deviceId: camera.name || `摄像机_${camera.address.split('.').pop()}` 
    });
    
    configForm.value = {
      deviceId: details.id,
      name: details.id,
      username: details.username,
      password: '', // 不显示现有密码
      ip: details.ip,
      port: details.port
    };
    
    showConfigDialog.value = true;
  } catch (error) {
    console.error('获取设备详情失败:', error);
    // 如果获取详情失败，使用基本信息
    configForm.value = {
      deviceId: camera.name || `摄像机_${camera.address.split('.').pop()}`,
      name: camera.name || `摄像机_${camera.address.split('.').pop()}`,
      username: 'admin',
      password: '',
      ip: camera.address,
      port: camera.port || 80
    };
    showConfigDialog.value = true;
  }
};

// 🎯 确认更新配置
const confirmUpdateConfig = async () => {
  updatingConfig.value = true;
  try {
    const result = await invoke('update_camera_config', {
      deviceId: configForm.value.deviceId,
      name: configForm.value.name,
      username: configForm.value.username,
      password: configForm.value.password || null,
      ip: configForm.value.ip,
      port: configForm.value.port
    });
    
    ElMessage.success(result);
    showConfigDialog.value = false;
    
    // 刷新设备列表（可选）
    // await startScan();
  } catch (error) {
    ElMessage.error('配置更新失败: ' + error);
  } finally {
    updatingConfig.value = false;
  }
};

// 🎯 删除设备
const removeDevice = async (camera) => {
  const deviceId = camera.name || `摄像机_${camera.address.split('.').pop()}`;
  
  try {
    await ElMessageBox.confirm(
      `确定要删除设备 "${deviceId}" 吗？此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );
    
    const result = await invoke('remove_camera_device', { deviceId });
    ElMessage.success(result);
    
    // 从列表中移除
    cameras.value = cameras.value.filter(c => {
      const cId = c.name || `摄像机_${c.address.split('.').pop()}`;
      return cId !== deviceId;
    });
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败: ' + error);
    }
  }
};

// 🎯 测试连接
const testingConnection = ref(false);
const testConnection = async () => {
  testingConnection.value = true;
  try {
    // 尝试获取设备详情来验证连接
    await invoke('get_camera_details', { 
      deviceId: configForm.value.deviceId 
    });
    
    ElMessage.success({
      message: '✅ 连接测试成功！设备可访问',
      duration: 3000
    });
  } catch (error) {
    ElMessage.error({
      message: `❌ 连接测试失败: ${error}`,
      duration: 5000
    });
  } finally {
    testingConnection.value = false;
  }
};

// 🎯 处理表格选择变化
const handleSelectionChange = (selection) => {
  selectedDevices.value = selection;
};

// 🎯 从批量选择中移除设备
const removeSelectedDevice = (device) => {
  selectedDevices.value = selectedDevices.value.filter(d => d.address !== device.address);
};

// 🎯 确认批量配置
const confirmBatchConfig = async () => {
  if (selectedDevices.value.length === 0) {
    ElMessage.warning('请先选择要配置的设备');
    return;
  }

  batchUpdating.value = true;
  let successCount = 0;
  let failCount = 0;
  const errors = [];

  try {
    for (const device of selectedDevices.value) {
      const deviceId = device.name || `摄像机_${device.address.split('.').pop()}`;
      
      try {
        // 构建更新参数（只更新非空字段）
        const updateParams = {
          deviceId,
          name: batchConfigForm.value.namePrefix ? 
            `${batchConfigForm.value.namePrefix}${device.name || ''}` : null,
          username: batchConfigForm.value.username || null,
          password: batchConfigForm.value.password || null,
          port: batchConfigForm.value.port || null
        };

        await invoke('update_camera_config', updateParams);
        successCount++;
      } catch (error) {
        failCount++;
        errors.push(`${deviceId}: ${error}`);
        console.error(`批量配置失败 [${deviceId}]:`, error);
      }
    }

    // 显示结果
    if (failCount === 0) {
      ElMessage.success(`✅ 批量配置完成！成功: ${successCount} 个设备`);
    } else {
      ElMessage.warning({
        message: `⚠️ 批量配置完成！成功: ${successCount}, 失败: ${failCount}\n\n失败详情:\n${errors.join('\n')}`,
        duration: 8000,
        showClose: true
      });
    }

    showBatchConfigDialog.value = false;
    
    // 清空选择
    selectedDevices.value = [];
  } catch (error) {
    ElMessage.error('批量配置过程出错: ' + error);
  } finally {
    batchUpdating.value = false;
  }
};

// 🎯 加载模板
const loadTemplates = () => {
  try {
    const saved = localStorage.getItem('camera-config-templates');
    if (saved) {
      templates.value = JSON.parse(saved);
    }
  } catch (error) {
    console.error('加载模板失败:', error);
    templates.value = [];
  }
};

// 🎯 保存模板
const saveTemplate = () => {
  if (!templateForm.value.name) {
    ElMessage.warning('请输入模板名称');
    return;
  }

  const newTemplate = {
    id: Date.now().toString(),
    name: templateForm.value.name,
    description: templateForm.value.description,
    username: templateForm.value.username,
    password: templateForm.value.password,
    port: templateForm.value.port,
    createdAt: new Date().toISOString()
  };

  templates.value.push(newTemplate);
  
  // 保存到 localStorage
  try {
    localStorage.setItem('camera-config-templates', JSON.stringify(templates.value));
    ElMessage.success('模板保存成功');
    
    // 重置表单
    templateForm.value = {
      name: '',
      description: '',
      username: 'admin',
      password: 'admin',
      port: 80
    };
  } catch (error) {
    ElMessage.error('保存模板失败: ' + error);
  }
};

// 🎯 应用模板到当前编辑的设备
const applyTemplate = (template) => {
  if (!configForm.value.deviceId) {
    ElMessage.warning('请先选择一个设备进行配置');
    return;
  }

  // 填充表单
  configForm.value.username = template.username;
  configForm.value.password = template.password;
  configForm.value.port = template.port;

  ElMessage.success(`已应用模板 "${template.name}"，请点击"保存配置"生效`);
  showTemplateDialog.value = false;
};

// 🎯 删除模板
const deleteTemplate = async (template) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除模板 "${template.name}" 吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    templates.value = templates.value.filter(t => t.id !== template.id);
    
    // 更新 localStorage
    localStorage.setItem('camera-config-templates', JSON.stringify(templates.value));
    
    ElMessage.success('模板已删除');
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除模板失败: ' + error);
    }
  }
};

// 导出设备列表
const exportDevices = () => {
  const data = cameras.value.map(cam => ({
    address: cam.address,
    port: cam.port,
    name: cam.name || `摄像机_${cam.address.split('.').pop()}`,
    protocol: cam.protocol
  }));

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cameras_${new Date().getTime()}.json`;
  a.click();
  URL.revokeObjectURL(url);

  ElMessage.success('设备列表已导出');
};

onMounted(async () => {
  await refreshLocalIp();
  unlisten = await setupProgressListener();
  
  // 🎯 加载配置模板
  loadTemplates();
});

onUnmounted(() => {
  if (unlisten) {
    unlisten();
  }
  if (timerInterval) {
    clearInterval(timerInterval);
  }
});
</script>

<style scoped lang="scss">
.camera-discovery-panel {
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.panel-header {
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid #e8e8e8;

  h3 {
    margin: 0 0 10px 0;
    font-size: 18px;
    color: #303133;
  }

  .local-ip-info {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;

    .label {
      color: #606266;
    }

    .value {
      font-weight: 500;
      color: #409eff;
      font-family: 'Courier New', monospace;
    }
  }
}

.scan-controls {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 6px;

  .timeout-control {
    display: flex;
    align-items: center;
    gap: 8px;

    .label {
      font-size: 14px;
      color: #606266;
    }

    .unit {
      font-size: 14px;
      color: #909399;
    }
  }

  // 🎯 协议选择器样式
  .protocol-selector {
    display: flex;
    align-items: center;
    gap: 10px;

    .label {
      font-size: 14px;
      color: #606266;
      white-space: nowrap;
    }
  }

  .scan-btn {
    min-width: 120px;
  }

  .debug-btn {
    margin-left: auto;
  }
}

.network-interfaces-info {
  margin-bottom: 20px;
  padding: 15px;
  background: #f0f9ff;
  border-radius: 6px;
  border-left: 4px solid #409eff;

  h4 {
    margin: 0 0 12px 0;
    font-size: 15px;
    color: #303133;
  }

  .interface-list {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .interface-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 15px;
    background: white;
    border-radius: 6px;
    border: 1px solid #dcdfe6;
    transition: all 0.3s;

    &.is-primary {
      border-color: #67c23a;
      background: #f0f9ff;
      box-shadow: 0 2px 8px rgba(103, 194, 58, 0.2);
    }

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .iface-name {
      font-weight: 600;
      color: #303133;
      min-width: 80px;
    }

    .iface-ip {
      font-family: 'Courier New', monospace;
      color: #409eff;
      font-size: 13px;
    }

    .iface-subnet {
      color: #909399;
      font-size: 12px;
    }
  }
}

.manual-config {
  margin-bottom: 20px;
  padding: 15px;
  background: #fafafa;
  border-radius: 6px;
  border: 1px solid #e8e8e8;

  .form-tip {
    font-size: 12px;
    color: #909399;
    margin-top: 5px;
  }
}

.scan-progress {
  margin-bottom: 20px;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  color: white;

  .progress-info {
    display: flex;
    justify-content: space-between;
    margin-top: 10px;
    font-size: 14px;

    .elapsed-time {
      opacity: 0.9;
    }
  }

  .found-count {
    margin-top: 10px;
    font-size: 16px;
    text-align: center;

    strong {
      font-size: 24px;
      margin: 0 5px;
    }
  }
}

.camera-list {
  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;

    h4 {
      margin: 0;
      font-size: 16px;
      color: #303133;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }
  }
}

// 🎯 行内编辑相关样式
.auth-fields {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.auth-display {
  font-size: 12px;
  color: #909399;
  font-family: 'Courier New', monospace;
}

// 编辑状态的高亮效果
:deep(.el-table__row) {
  transition: background-color 0.3s;
  
  &:hover {
    background-color: #f5f7fa;
  }
}

// 🎯 批量配置相关样式
.selected-devices-info {
  margin-bottom: 20px;

  h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    color: #303133;
  }

  .device-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}

// 🎯 模板管理相关样式
.empty-templates {
  padding: 40px 0;
}

.template-list {
  max-height: 400px;
  overflow-y: auto;
}

.empty-state {
  padding: 40px 20px;

  .empty-hint {
    margin: 15px 0 10px;
    color: #606266;
    font-size: 14px;
  }

  .troubleshoot-list {
    list-style: none;
    padding: 0;
    margin: 0;
    text-align: left;
    display: inline-block;

    li {
      padding: 5px 0;
      color: #909399;
      font-size: 13px;
    }
  }
}
</style>
