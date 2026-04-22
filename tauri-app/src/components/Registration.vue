<template>
  <div class="registration-container">
    <div class="registration-content">
      <!-- 注册状态卡�?-->
      <div class="status-card" :class="registrationStatus">
        <div class="status-icon">
          <span v-if="registrationStatus === 'activated'">�?/span>
          <span v-else-if="registrationStatus === 'trial'">�?/span>
          <span v-else>🔒</span>
        </div>
        <div class="status-info">
          <h3 class="status-title">{{ statusTitle }}</h3>
          <p class="status-desc">{{ statusDescription }}</p>
          <div v-if="registrationStatus === 'trial'" class="trial-countdown">
            <el-progress
              :percentage="trialProgress"
              :status="trialProgress < 50 ? 'exception' : (trialProgress < 80 ? 'warning' : 'success')"
              :format="formatTrialProgress"
            />
          </div>
        </div>
      </div>

      <!-- 注册信息展示 -->
      <div v-if="registrationStatus === 'activated'" class="registration-info-card">
        <h4>📋 注册信息</h4>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">用户名称�?/span>
            <span class="info-value">{{ registrationInfo.userName || '未设�? }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">授权类型�?/span>
            <el-tag :type="registrationInfo.licenseType === 'permanent' ? 'success' : 'warning'">
              {{ registrationInfo.licenseType === 'permanent' ? '永久授权' : '临时授权' }}
            </el-tag>
          </div>
          <div class="info-item">
            <span class="info-label">授权设备�?/span>
            <span class="info-value">{{ registrationInfo.deviceCount || 1 }} �?/span>
          </div>
          <div class="info-item">
            <span class="info-label">注册日期�?/span>
            <span class="info-value">{{ registrationInfo.registerDate || '-' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">有效期至�?/span>
            <span class="info-value">{{ getExpiryDate() }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">机器码：</span>
            <span class="info-value machine-code">{{ machineCode }}</span>
          </div>
        </div>
      </div>

      <!-- 试用倒计时警�?-->
      <div v-if="registrationStatus === 'trial' && trialRemaining < 3600000" class="trial-warning">
        <el-alert
          title="⚠️ 试用时间即将到期"
          type="warning"
          :closable="false"
          show-icon
        >
          <template #default>
            <p>您的试用时间还剩 <strong>{{ formatTime(trialRemaining) }}</strong>，请尽快注册以继续使用�?/p>
          </template>
        </el-alert>
      </div>

      <!-- 注册表单 -->
      <div v-if="registrationStatus !== 'activated'" class="registration-form">
        <h4>🔑 产品注册</h4>

        <el-form label-width="100px" label-position="left">
          <el-form-item label="机器�?>
            <div class="machine-code-display">
              <el-input v-model="machineCode" readonly class="machine-code-input" />
              <el-button @click="copyMachineCode">
                <el-icon><CopyDocument /></el-icon> 复制
              </el-button>
            </div>
            <div class="form-tip">请将此机器码发送给供应商以获取注册�?/div>
          </el-form-item>

          <el-form-item label="用户名称">
            <el-input v-model="userName" placeholder="请输入用户名称（个人/公司�? />
          </el-form-item>

          <el-form-item label="注册�?>
            <el-input
              v-model="registrationCode"
              placeholder="请输入注册码"
              class="registration-code-input"
            />
            <div class="form-tip">注册码格式：XXXX-XXXX-XXXX-XXXX</div>
          </el-form-item>

          <el-form-item>
            <div class="form-actions">
              <el-button type="primary" size="large" @click="activateRegistration" :loading="activating">
                🔓 激活注�?              </el-button>
              <el-button @click="tryAgain">
                🔄 重试
              </el-button>
            </div>
          </el-form-item>
        </el-form>

        <div class="registration-help">
          <h5>💡 如何获取注册码？</h5>
          <ol>
            <li>复制上方显示的机器码</li>
            <li>联系供应商或访问官网注册页面</li>
            <li>提供机器码并支付相应费用</li>
            <li>收到注册码后输入并激�?/li>
          </ol>
          <div class="contact-info">
            <p><strong>联系方式�?/strong></p>
            <p>📞 售后服务电话�?00-XXX-XXXX</p>
            <p>📧 邮箱：support@example.com</p>
            <p>🌐 官网：www.example.com</p>
          </div>
        </div>
      </div>

      <!-- 已激活操�?-->
      <div v-else class="activated-actions">
        <el-button type="danger" @click="showDeactivateDialog = true">
          🔓 解除绑定
        </el-button>
        <el-button @click="refreshStatus">
          🔄 刷新状�?        </el-button>
      </div>
    </div>

    <!-- 解除绑定确认对话�?-->
    <el-dialog
      v-model="showDeactivateDialog"
      title="解除绑定确认"
      width="400px"
    >
      <div class="deactivate-dialog">
        <el-alert
          title="⚠️ 谨慎操作"
          type="warning"
          :closable="false"
          show-icon
          style="margin-bottom: 15px"
        >
          <template #default>
            <p>解除绑定后，当前设备将无法使用本软件�?/p>
            <p>如需重新使用，需要重新输入注册码激活�?/p>
          </template>
        </el-alert>
        <el-form>
          <el-form-item label="确认操作">
            <el-checkbox v-model="confirmDeactivate">我已了解风险，确认解除绑�?/el-checkbox>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="showDeactivateDialog = false">取消</el-button>
        <el-button
          type="danger"
          @click="deactivateRegistration"
          :disabled="!confirmDeactivate"
        >
          确认解除
        </el-button>
      </template>
    </el-dialog>

    <!-- 试用到期提示对话�?-->
    <el-dialog
      v-model="showTrialExpiredDialog"
      title="⚠️ 试用已到�?
      width="450px"
      :close-on-click-modal="false"
      :show-close="false"
    >
      <div class="trial-expired-content">
        <el-alert
          title="试用版本已到�?
          type="error"
          :closable="false"
          show-icon
        >
          <template #default>
            <p>您的 30 天试用期限已到期�?/p>
            <p>请购买正式版本以继续使用本软件�?/p>
          </template>
        </el-alert>
        <div class="purchase-info">
          <h5>购买正式版本后您将获得：</h5>
          <ul>
            <li>�?永久使用授权</li>
            <li>�?免费升级更新</li>
            <li>�?专业技术支�?/li>
            <li>�?完整功能使用</li>
          </ul>
        </div>
      </div>
      <template #footer>
        <el-button @click="contactSupport">联系购买</el-button>
        <el-button type="primary" @click="doExitApplication">退出应用</el-button>
      </template>
    </el-dialog>
  </div>
</template>