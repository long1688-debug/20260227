<template>
  <div class="onvif-diagnosis">
    <h3>ONVIF 协议诊断工具</h3>
    <p class="description">
      按标准 ONVIF 流程逐步诊断：GetCapabilities → GetProfiles → GetStreamUri
    </p>

    <div class="input-form">
      <div class="form-group">
        <label>摄像机 IP 地址：</label>
        <input v-model="ip" placeholder="192.168.1.100" />
      </div>

      <div class="form-group">
        <label>端口：</label>
        <input v-model="port" type="number" placeholder="80" />
      </div>

      <div class="form-group">
        <label>用户名：</label>
        <input v-model="username" placeholder="admin" />
      </div>

      <div class="form-group">
        <label>密码：</label>
        <input v-model="password" type="password" placeholder="admin" />
      </div>

      <button @click="runDiagnosis" :disabled="isRunning">
        {{ isRunning ? '诊断中...' : '开始诊断' }}
      </button>
    </div>

    <div v-if="isRunning" class="loading">
      <div class="spinner"></div>
      <p>正在执行 ONVIF 诊断流程...</p>
    </div>

    <div v-if="error" class="error">
      <strong>错误：</strong> {{ error }}
    </div>

    <div v-if="result" class="result">
      <h4>诊断结果</h4>

      <div class="step" :class="{ success: result.success }">
        <span class="step-icon">{{ result.success ? '✅' : '❌' }}</span>
        <span class="step-text">{{ result.success ? '完整流程成功' : '流程失败' }}</span>
      </div>

      <div v-if="result.media_service_url" class="step success">
        <span class="step-icon">✅</span>
        <span class="step-text">步骤1: GetCapabilities → Media URL: {{ result.media_service_url }}</span>
      </div>

      <div v-if="result.rtsp_uri" class="step success">
        <span class="step-icon">✅</span>
        <span class="step-text">步骤3: GetStreamUri → RTSP: {{ result.rtsp_uri }}</span>
      </div>

      <div v-if="result.steps">
        <div v-for="(step, index) in result.steps" :key="index" class="step-detail">
          <h5>步骤 {{ step.step }}: {{ step.name }}</h5>
          <pre>{{ JSON.stringify(step, null, 2) }}</pre>
        </div>
      </div>
    </div>

    <div class="log-output" v-if="logs.length > 0">
      <h4>详细日志</h4>
      <div class="log-entries">
        <div v-for="(log, index) in logs" :key="index" class="log-entry">
          {{ log }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'

const ip = ref('192.168.1.100')
const port = ref(80)
const username = ref('admin')
const password = ref('admin123')
const isRunning = ref(false)
const error = ref('')
const result = ref(null)
const logs = ref([])

async function runDiagnosis() {
  isRunning.value = true
  error.value = ''
  result.value = null
  logs.value = []

  try {
    logs.value.push(`开始 ONVIF 诊断: ${ip.value}:${port.value}`)

    const diagResult = await invoke('diagnose_onvif_flow', {
      ip: ip.value,
      port: port.value,
      username: username.value,
      password: password.value
    })

    logs.value.push(`诊断完成: ${JSON.stringify(diagResult, null, 2)}`)
    result.value = diagResult

    if (diagResult.success) {
      logs.value.push(`✅ 成功获取 RTSP 地址: ${diagResult.rtsp_uri}`)
    } else {
      logs.value.push(`❌ 诊断失败`)
    }
  } catch (e) {
    error.value = e.toString()
    logs.value.push(`❌ 错误: ${e.toString()}`)
  } finally {
    isRunning.value = false
  }
}
</script>

<style scoped>
.onvif-diagnosis {
  padding: 20px;
  background: #1a1a2e;
  color: #eee;
  border-radius: 8px;
}

.input-form {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  font-size: 12px;
  margin-bottom: 4px;
}

.form-group input {
  padding: 8px;
  border: 1px solid #444;
  border-radius: 4px;
  background: #2a2a3e;
  color: #fff;
}

button {
  padding: 10px 20px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:disabled {
  background: #666;
  cursor: not-allowed;
}

.loading {
  text-align: center;
  padding: 20px;
}

.spinner {
  border: 3px solid #f3f3f3;
  border-top: 3px solid #4CAF50;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error {
  padding: 10px;
  background: #f44336;
  color: white;
  border-radius: 4px;
  margin-bottom: 20px;
}

.result {
  padding: 15px;
  background: #2a2a3e;
  border-radius: 4px;
  margin-bottom: 20px;
}

.step {
  padding: 8px;
  margin: 5px 0;
  background: #333;
  border-radius: 4px;
}

.step.success {
  background: #2e7d32;
}

.step-icon {
  margin-right: 10px;
}

.step-detail {
  margin-top: 15px;
  padding: 10px;
  background: #333;
  border-radius: 4px;
}

.step-detail pre {
  font-size: 12px;
  overflow-x: auto;
}

.log-output {
  margin-top: 20px;
  padding: 15px;
  background: #111;
  border-radius: 4px;
}

.log-entries {
  max-height: 300px;
  overflow-y: auto;
  font-family: monospace;
  font-size: 12px;
}

.log-entry {
  padding: 4px 0;
  border-bottom: 1px solid #333;
}
</style>
