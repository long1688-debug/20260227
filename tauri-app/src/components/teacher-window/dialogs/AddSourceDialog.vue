<template>
  <el-dialog
    v-model="visible"
    title="添加信号源"
    fullscreen
    :close-on-click-modal="false"
    class="add-source-dialog-wrapper"
    @close="handleClose"
    :z-index="2000"
    :modal="true"
    append-to-body
  >
    <div class="add-source-dialog">
      <!-- 信号源列表 -->
      <div class="source-list-section">
        <div class="source-list-header">
          <h4>已添加的信号源 ({{ sources.length }})</h4>
          <el-button type="info" size="small" @click="handleRefreshSources">
            <el-icon><Refresh /></el-icon> 刷新
          </el-button>
        </div>
        <div class="source-list-in-dialog">
          <div v-if="sources.length === 0" class="source-list-empty">
            <el-empty description="暂无信号源" :image-size="60" />
          </div>
          <div v-else class="source-list">
            <div v-for="source in sources" :key="source.id" class="source-list-item">
              <div class="source-item-content">
                <div class="source-item-info">
                  <span class="source-type-icon">{{ getSourceTypeIcon(source.type) }}</span>
                  <span class="source-name">{{ source.name }}</span>
                  <el-tag :type="getSourceTypeTag(source.type)" size="small">
                    {{ getSourceTypeLabel(source.type) }}
                  </el-tag>
                </div>
                <div class="source-item-status">
                  <span class="status-dot" :class="{ online: source.status === 'online' }"></span>
                  <span class="status-text">{{ source.status === 'online' ? '在线' : '离线' }}</span>
                </div>
              </div>
              <div class="source-item-actions">
                <el-button
                  v-if="!source.addedToPreview"
                  type="primary"
                  size="small"
                  @click="handleAddToPreview(source)"
                >
                  <el-icon><VideoPlay /></el-icon> 添加到预览区域
                </el-button>
                <el-button
                  v-else
                  type="info"
                  size="small"
                  @click="handleRemoveFromPreview(source.id)"
                >
                  <el-icon><VideoPause /></el-icon> 从预览区域移除
                </el-button>
                <el-button
                  v-if="source.type === 'networkCamera'"
                  type="success"
                  size="small"
                  @click="handleEditNetworkCamera(source)"
                  title="编辑摄像机信息"
                >
                  <el-icon><Edit /></el-icon> 编辑
                </el-button>
                <el-button type="warning" size="small" @click="handleRenameSource(source)">
                  <el-icon><Edit /></el-icon> 重命名
                </el-button>
                <el-button type="danger" size="small" @click="handleDeleteSource(source.id)">
                  <el-icon><Delete /></el-icon> 删除
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <el-divider />

      <!-- 添加新信号源 -->
      <div class="add-source-section">
        <h4>添加新信号源</h4>

        <!-- 信号源类型选择 -->
        <div class="source-type-selector-grouped">
          <div v-for="group in sourceTypeGroups" :key="group.name" class="source-type-group">
            <div class="group-title">
              <el-icon class="group-icon-svg"><component :is="group.iconComponent" /></el-icon>
              <span class="group-name">{{ group.name }}</span>
            </div>
            <div class="group-items">
              <div
                v-for="type in group.types"
                :key="type.value"
                class="source-type-option"
                :class="{ active: form.type === type.value }"
                @click="form.type = type.value"
              >
                <span class="type-icon">{{ type.icon }}</span>
                <span class="type-label">{{ type.label }}</span>
              </div>
            </div>
          </div>
        </div>


        <!-- 信号源表单 -->
        <div class="source-form-container">
          <el-form
            ref="formRef"
            :model="form"
            :rules="rules"
            label-width="120px"
            label-position="top"
          >
            <!-- 本地设备（统一包含摄像头、采集卡、高拍仪） -->
            <template v-if="form.type === 'localDevice'">
              <!-- 设备类型选择 -->
              <el-form-item label="设备类型" prop="deviceCategory">
                <el-select v-model="form.deviceCategory" placeholder="请选择设备类型" style="width: 100%"
                  @change="handleDeviceCategoryChange">
                  <el-option label="USB摄像头" value="camera" />
                  <el-option label="采集卡" value="captureCard" />
                  <el-option label="高拍仪" value="scanner" />
                </el-select>
              </el-form-item>

              <!-- 设备选择 -->
              <el-form-item label="选择设备" prop="deviceId">
                <el-select
                  v-model="form.deviceId"
                  placeholder="请选择设备"
                  style="width: 100%"
                  @change="handleLocalDeviceChange"
                >
                  <!-- USB摄像头 -->
                  <template v-if="form.deviceCategory === 'camera'">
                    <el-option
                      v-for="device in localDevices"
                      :key="device.deviceId"
                      :label="getCameraDeviceLabel(device)"
                      :value="device.deviceId"
                    >
                      <div class="device-option">
                        <span class="device-name">{{ device.label || device.deviceId }}</span>
                        <el-tag size="small" type="success">USB</el-tag>
                      </div>
                    </el-option>
                  </template>
                  <!-- 采集卡 -->
                  <template v-else-if="form.deviceCategory === 'captureCard'">
                    <el-option
                      v-for="device in captureDevices"
                      :key="device.id"
                      :label="getCaptureDeviceLabel(device)"
                      :value="device.id"
                    >
                      <div class="device-option">
                        <span class="device-name">{{ device.name }}</span>
                        <span class="device-info">
                          <el-tag size="small" type="info">{{ device.interface_type || '未知' }}</el-tag>
                          <span v-if="device.resolution" class="device-resolution">{{ device.resolution }}</span>
                        </span>
                      </div>
                    </el-option>
                  </template>
                  <!-- 高拍仪 -->
                  <template v-else-if="form.deviceCategory === 'scanner'">
                    <el-option
                      v-for="device in scannerDevices"
                      :key="device.id"
                      :label="getScannerDeviceLabel(device)"
                      :value="device.id"
                    >
                      <div class="device-option">
                        <span class="device-name">{{ device.name }}</span>
                        <span class="device-info">
                          <el-tag size="small" type="success">{{ device.interface_type || 'USB' }}</el-tag>
                          <span v-if="device.resolution" class="device-resolution">{{ device.resolution }}</span>
                        </span>
                      </div>
                    </el-option>
                  </template>
                </el-select>
              </el-form-item>

              <!-- 空状态提示 -->
              <div v-if="currentDevices.length === 0" class="empty-tip">
                <el-icon><Warning /></el-icon>
                <span>未检测到{{ getDeviceCategoryLabel(form.deviceCategory) }}设备，请检查设备连接</span>
              </div>

              <!-- 采集卡专用配置 -->
              <template v-if="form.deviceCategory === 'captureCard'">
                <el-form-item label="输入接口" prop="inputInterface">
                  <el-select v-model="form.inputInterface" placeholder="请选择输入接口" style="width: 100%">
                    <el-option label="HDMI" value="hdmi" />
                    <el-option label="SDI" value="sdi" />
                    <el-option label="DVI" value="dvi" />
                    <el-option label="VGA" value="vga" />
                    <el-option label="USB" value="usb" />
                  </el-select>
                </el-form-item>
                <el-form-item label="分辨率" prop="resolution">
                  <el-select v-model="form.resolution" placeholder="请选择分辨率" style="width: 100%">
                    <el-option label="1920x1080 (1080p)" value="1920x1080" />
                    <el-option label="1280x720 (720p)" value="1280x720" />
                    <el-option label="3840x2160 (4K)" value="3840x2160" />
                    <el-option label="自动检测" value="auto" />
                  </el-select>
                </el-form-item>
              </template>

              <!-- 高拍仪专用配置 -->
              <template v-if="form.deviceCategory === 'scanner'">
                <el-form-item label="扫描模式" prop="scanMode">
                  <el-select v-model="form.scanMode" placeholder="请选择扫描模式" style="width: 100%">
                    <el-option label="单页扫描" value="single" />
                    <el-option label="连续扫描" value="continuous" />
                    <el-option label="自动对焦" value="autofocus" />
                  </el-select>
                </el-form-item>
                <el-form-item label="图像增强" prop="imageEnhance">
                  <el-checkbox v-model="form.autoEnhance">自动增强</el-checkbox>
                  <el-checkbox v-model="form.autoCrop">自动裁剪</el-checkbox>
                </el-form-item>
              </template>

              <!-- 信号源名称 -->
              <el-form-item label="信号源名称" prop="name">
                <el-input v-model="form.name" placeholder="留空则自动生成" />
              </el-form-item>
            </template>

            <!-- 网络摄像机 -->
            <template v-else-if="form.type === 'networkCamera'">
              <!-- 简化的扫描界面 -->
              <div class="simple-scan-container">
                <!-- 扫描模式选择 -->
                <div class="scan-mode-selector" style="margin-bottom: 15px;">
                  <el-radio-group v-model="scanMode" size="default">
                    <el-radio-button value="auto">🔍 自动扫描</el-radio-button>
                    <el-radio-button value="cross_subnet"> 跨网段扫描</el-radio-button>
                  </el-radio-group>
                </div>

                <!-- 一键扫描区域 -->
                <div class="quick-scan-section">
                  <div class="scan-icon">📷</div>
                  <div class="scan-title">发现网络摄像机</div>
                  <div class="scan-description">自动扫描局域网内的摄像机设备</div>
                  <el-button
                    type="primary"
                    size="large"
                    :loading="isScanning"
                    @click="handleQuickScan"
                    class="quick-scan-btn"
                  >
                    <el-icon><Search /></el-icon> {{ isScanning ? '扫描中...' : '开始扫描' }}
                  </el-button>
                </div>

                <!-- 跨网段扫描配置 -->
                <div v-if="scanMode === 'cross_subnet'" class="cross-subnet-config">
                  <el-alert title="跨网段扫描说明" type="info" :closable="false" class="mb-3">
                    <p style="margin: 8px 0;">跨网段扫描可以探测其他网段的摄像机设备，需要：</p>
                    <ul style="margin: 8px 0; padding-left: 20px;">
                      <li>网络路由可达（防火墙允许访问目标网段）</li>
                      <li>配置目标网段列表（CIDR格式，如 192.168.2.0/24）</li>
                    </ul>
                  </el-alert>

                  <el-form-item label="目标网段列表">
                    <el-input
                      v-model="crossSubnetList"
                      type="textarea"
                      :rows="3"
                      placeholder="每行一个网段，CIDR格式&#10;例如：&#10;192.168.2.0/24&#10;192.168.3.0/24&#10;10.0.1.0/24"
                    />
                  </el-form-item>

                  <el-form-item>
                    <el-button size="small" @click="loadExampleSubnets">
                      <el-icon><InfoFilled /></el-icon> 加载示例
                    </el-button>
                    <el-button size="small" @click="clearSubnets">
                      <el-icon><Delete /></el-icon> 清空
                    </el-button>
                  </el-form-item>
                </div>

                <!-- 扫描结果表格 -->
                <div v-if="discoveredCameras.length > 0" class="discovered-cameras-section">
                  <div class="section-header">
                    <span>找到 {{ discoveredCameras.length }} 台设备</span>
                    <el-button size="small" @click="clearScanResults">清空</el-button>
                  </div>
                  <div class="discovered-cameras-table">
                    <el-table
                      :data="discoveredCameras"
                      @row-click="selectDiscoveredCamera"
                      @row-dblclick="handleDoubleClickCamera"
                      border
                      stripe
                      highlight-current-row
                    >
                      <el-table-column label="序号" width="60">
                        <template #default="{ $index }">{{ $index + 1 }}</template>
                      </el-table-column>
                      <el-table-column label="IP地址" prop="address">
                        <template #default="{ row }">
                          <el-input
                            v-if="editingCamera?.address === row.address"
                            v-model="editingCamera.address"
                            size="small"
                            @blur="saveCameraEdit"
                            @keyup.enter="saveCameraEdit"
                            ref="editInput"
                          />
                          <span v-else>{{ row.address }}</span>
                        </template>
                      </el-table-column>
                      <el-table-column label="MAC地址" prop="mac" width="180">
                        <template #default="{ row }">{{ row.mac || '-' }}</template>
                      </el-table-column>
                      <el-table-column label="设备名称" prop="name" width="150">
                        <template #default="{ row }">{{ row.name || '未知设备' }}</template>
                      </el-table-column>
                      <el-table-column label="设备型号" prop="model" width="150">
                        <template #default="{ row }">{{ row.model || '-' }}</template>
                      </el-table-column>
                      <el-table-column label="协议类型" width="120">
                        <template #default="{ row }">
                          <el-tag :type="getProtocolType(row)">
                            {{ row.protocol || '未知' }}
                          </el-tag>
                        </template>
                      </el-table-column>
                      <el-table-column label="端口" width="80">
                        <template #default="{ row }">{{ row.port || '-' }}</template>
                      </el-table-column>
                      <el-table-column label="操作" width="200">
                        <template #default="{ row }">
                          <el-button
                            size="small"
                            @click.stop="openEditDialog(row)"
                          >
                            <el-icon><Edit /></el-icon> 编辑
                          </el-button>
                          <el-button
                            type="primary"
                            size="small"
                            @click.stop="confirmAddCamera(row)"
                          >
                            添加
                          </el-button>
                        </template>
                      </el-table-column>
                    </el-table>
                  </div>
                </div>

                <!-- 手动添加入口 -->
                <div class="manual-add-section">
                  <span>找不到摄像机？</span>
                  <el-button size="small" @click="showManualInput = !showManualInput">
                    {{ showManualInput ? '收起' : '手动输入' }}
                  </el-button>
                </div>

                <!-- 手动输入表单（可折叠） -->
                <div v-if="showManualInput" class="manual-input-form">
                  <el-divider />
              <el-form-item label="协议类型" prop="protocol">
                <el-select v-model="form.protocol" placeholder="请选择协议" style="width: 100%">
                  <el-option label="RTSP" value="rtsp" />
                  <el-option label="RTMP" value="rtmp" />
                  <el-option label="HLS" value="hls" />
                  <el-option label="HTTP-FLV" value="http-flv" />
                  <el-option label="ONVIF" value="onvif" />
                </el-select>
              </el-form-item>

              <!-- ONVIF设备服务地址 -->
              <el-form-item v-if="form.protocol === 'onvif'" label="IP地址" prop="cameraIp">
                <el-input
                  v-model="form.cameraIp"
                  placeholder="例如：192.168.1.118"
                >
                  <template #prepend>IP</template>
                </el-input>
              </el-form-item>

              <!--  新增：品牌选择 -->
              <el-form-item v-if="form.protocol === 'onvif'" label="摄像头品牌">
                <el-select v-model="form.brand" placeholder="自动识别（可选）" style="width: 100%" clearable>
                  <el-option label="自动识别" value="" />
                  <el-option label="海康威视 (Hikvision)" value="hikvision" />
                  <el-option label="大华 (Dahua)" value="dahua" />
                  <el-option label="宇视 (Uniview)" value="uniview" />
                  <el-option label="安讯士 (Axis)" value="axis" />
                  <el-option label="雄迈 (Xiongmai)" value="xiongmai" />
                  <el-option label="TP-Link" value="tplink" />
                  <el-option label="其他/未知" value="generic" />
                </el-select>
                <div class="form-tip text-sm text-gray-500 mt-1">
                  选择品牌可提高 RTSP 地址获取成功率
                </div>
              </el-form-item>

              <el-form-item v-if="form.protocol === 'onvif'" label="ONVIF端口" prop="onvifPort">
                <el-input-number
                  v-model="form.onvifPort"
                  :min="1"
                  :max="65535"
                  :step="1"
                  placeholder="2000"
                  style="width: 100%"
                />
                <div class="form-tip text-sm text-gray-500 mt-1">
                  常见端口：80, 8000, 8080, 8899
                </div>
              </el-form-item>

              <!-- ONVIF服务地址（可选，用于手动指定） -->
              <el-form-item v-if="form.protocol === 'onvif'" label="ONVIF服务地址" prop="onvifUrl">
                <el-input
                  v-model="form.onvifUrl"
                  placeholder="例如：http://192.168.1.118:80/onvif/device_service（可选）"
                >
                  <template #prepend>ONVIF</template>
                  <template #append>
                    <el-button @click="copyOnvifExample" title="复制示例格式">
                      <el-icon><DocumentCopy /></el-icon>
                    </el-button>
                  </template>
                </el-input>
                <div class="onvif-examples mt-2">
                  <div class="example-label mb-1 text-sm text-gray-600">常见ONVIF格式：</div>
                  <el-button-group size="small">
                    <el-button @click="setOnvifExample('default')">默认格式</el-button>
                    <el-button @click="setOnvifExample('hikvision')">海康威视</el-button>
                    <el-button @click="setOnvifExample('dahua')">大华</el-button>
                    <el-button @click="setOnvifExample('axis')">安讯士</el-button>
                  </el-button-group>
                </div>
              </el-form-item>

              <!-- ONVIF获取流地址按钮 -->
              <el-form-item v-if="form.protocol === 'onvif'" label="获取流地址">
                <div class="flex gap-2">
                  <el-button
                    type="primary"
                    @click="fetchOnvifStreamUrl"
                    :loading="fetchingOnvifStream"
                    :disabled="!form.cameraIp || !form.username || !form.password"
                  >
                    <el-icon><VideoPlay /></el-icon>
                    {{ fetchingOnvifStream ? '正在获取...' : '自动获取RTSP地址' }}
                  </el-button>
                  <el-button
                    type="success"
                    @click="detectOnvifServices"
                    :loading="detectingOnvifServices"
                    :disabled="!form.cameraIp || !form.username || !form.password"
                  >
                    <el-icon><Search /></el-icon>
                    {{ detectingOnvifServices ? '检测中...' : '高级检测' }}
                  </el-button>
                </div>
                <div class="form-tip text-sm text-gray-500 mt-1">
                  点击按钮通过ONVIF协议自动从摄像机获取RTSP流地址，或使用“高级检测”查看完整的服务路径信息
                </div>
              </el-form-item>

              <el-form-item label="流媒体地址" prop="streamUrl">
                <el-input v-model="form.streamUrl" placeholder="例如：rtsp://192.168.1.100:554/stream" />

                <!-- RTSP URL 模板选择器 -->
                <div v-if="form.protocol === 'rtsp'" class="rtsp-url-templates mt-2">
                  <div class="template-label mb-1 text-sm text-gray-600">常用格式：</div>
                  <el-button-group size="small">
                    <el-button @click="selectRtspTemplate('hikvision')">海康威视</el-button>
                    <el-button @click="selectRtspTemplate('dahua')">大华</el-button>
                    <el-button @click="selectRtspTemplate('axis')">安讯士</el-button>
                    <el-button @click="selectRtspTemplate('uniview')">宇视</el-button>
                    <el-button @click="selectRtspTemplate('generic')">通用格式</el-button>
                  </el-button-group>
                </div>
              </el-form-item>

              <el-form-item label="认证" prop="needAuth">
                <el-checkbox v-model="form.needAuth">需要认证</el-checkbox>
              </el-form-item>

              <el-form-item v-if="form.needAuth" label="用户名" prop="username">
                <el-input v-model="form.username" placeholder="请输入用户名" />
              </el-form-item>

              <el-form-item v-if="form.needAuth" label="密码" prop="password">
                <el-input
                  v-model="form.password"
                  type="password"
                  show-password
                  placeholder="请输入密码"
                />
              </el-form-item>

              <!-- IP修改提示 -->
              <el-alert
                v-if="selectedCamera && form.protocol === 'rtsp'"
                title="提示：如需修改IP地址，请直接在流媒体地址中编辑"
                type="info"
                show-icon
                :closable="false"
                class="mb-3"
              />

              <!-- 认证信息提示 -->
              <el-alert
                v-if="form.needAuth && !form.username"
                title="警告：需要认证但未填写用户名和密码"
                type="warning"
                show-icon
                :closable="false"
                class="mb-3"
              />
              <el-form-item label="信号源名称" prop="name">
                <el-input v-model="form.name" placeholder="留空则自动生成" />
              </el-form-item>
                </div> <!-- 关闭手动输入表单 -->
              </div> <!-- 关闭simple-scan-container -->
            </template>

            <!-- MR摄像机 -->
            <template v-else-if="form.type === 'mrCamera'">
              <el-form-item label="MR设备类型" prop="mrType">
                <el-select v-model="form.mrType" placeholder="请选择MR设备类型" style="width: 100%">
                  <el-option label="Microsoft HoloLens" value="hololens" />
                  <el-option label="Meta Quest" value="quest" />
                  <el-option label="HTC Vive" value="vive" />
                  <el-option label="自定义MR设备" value="custom" />
                </el-select>
              </el-form-item>
              <el-form-item label="连接方式" prop="connectionType">
                <el-select v-model="form.connectionType" placeholder="请选择连接方式" style="width: 100%">
                  <el-option label="WiFi无线" value="wifi" />
                  <el-option label="USB有线" value="usb" />
                  <el-option label="网络串流" value="stream" />
                </el-select>
              </el-form-item>
              <el-form-item v-if="form.connectionType === 'stream'" label="串流地址" prop="streamUrl">
                <el-input v-model="form.streamUrl" placeholder="MR设备串流地址" />
              </el-form-item>
              <el-form-item label="信号源名称" prop="name">
                <el-input v-model="form.name" placeholder="留空则自动生成" />
              </el-form-item>
            </template>


            <!-- 远程桌面摄像头 -->
            <template v-else-if="form.type === 'remoteCamera'">
              <el-form-item label="远程桌面ID" prop="desktopId">
                <el-input v-model="form.desktopId" placeholder="关联的远程桌面ID或地址" />
              </el-form-item>
              <el-form-item label="摄像头索引" prop="cameraIndex">
                <el-input-number v-model="form.cameraIndex" :min="0" :max="10" placeholder="远程摄像头索引" />
              </el-form-item>
              <el-form-item label="信号源名称" prop="name">
                <el-input v-model="form.name" placeholder="留空则自动生成" />
              </el-form-item>
            </template>

            <!-- 手机/平板摄像头 -->
            <template v-else-if="form.type === 'mobileCamera'">
              <el-form-item label="连接方式" prop="mobileConnection">
                <el-select v-model="form.mobileConnection" placeholder="请选择连接方式" style="width: 100%">
                  <el-option label="WiFi局域网" value="wifi" />
                  <el-option label="USB数据线" value="usb" />
                  <el-option label="二维码扫码" value="qrcode" />
                </el-select>
              </el-form-item>
              <el-form-item v-if="form.mobileConnection === 'wifi'" label="设备IP地址" prop="mobileIp">
                <el-input v-model="form.mobileIp" placeholder="例如：192.168.1.100" />
              </el-form-item>
              <el-form-item v-if="form.mobileConnection === 'usb'" label="ADB端口" prop="adbPort">
                <el-input v-model="form.adbPort" placeholder="默认5555" />
              </el-form-item>
              <el-form-item label="摄像头方向" prop="cameraDirection">
                <el-select v-model="form.cameraDirection" placeholder="请选择摄像头" style="width: 100%">
                  <el-option label="前置摄像头" value="front" />
                  <el-option label="后置摄像头" value="back" />
                </el-select>
              </el-form-item>
              <el-form-item label="信号源名称" prop="name">
                <el-input v-model="form.name" placeholder="留空则自动生成" />
              </el-form-item>
            </template>

            <!-- 手机/平板桌面投屏 -->
            <template v-else-if="form.type === 'mobileScreen'">
              <el-alert
                title="手机/平板投屏说明"
                type="info"
                :closable="false"
                class="mb-3"
              >
                <p>支持以下投屏方式：</p>
                <ul style="margin: 8px 0; padding-left: 20px;">
                  <li><strong>WiFi局域网：</strong>手机和电脑在同一局域网，通过RTSP/WebRTC推流</li>
                  <li><strong>USB数据线：</strong>通过USB连接，使用ADB屏幕捕获</li>
                  <li><strong>二维码扫码：</strong>扫描App生成的二维码快速连接</li>
                </ul>
              </el-alert>

              <el-form-item label="连接方式" prop="mobileConnection">
                <el-select v-model="form.mobileConnection" placeholder="请选择连接方式" style="width: 100%">
                  <el-option label="WiFi局域网" value="wifi">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span>📶 WiFi局域网</span>
                      <el-tag size="small" type="success">推荐</el-tag>
                    </div>
                  </el-option>
                  <el-option label="USB数据线" value="usb">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span>🔌 USB数据线</span>
                      <el-tag size="small" type="warning">低延迟</el-tag>
                    </div>
                  </el-option>
                  <el-option label="二维码扫码" value="qrcode">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span>📱 二维码扫码</span>
                      <el-tag size="small" type="info">便捷</el-tag>
                    </div>
                  </el-option>
                </el-select>
              </el-form-item>

              <el-form-item v-if="form.mobileConnection === 'wifi'" label="设备IP地址" prop="mobileIp">
                <el-input v-model="form.mobileIp" placeholder="例如：192.168.1.100">
                  <template #append>
                    <el-button @click="autoDetectMobileIp" :loading="detectingIp">
                      <el-icon><Search /></el-icon> 自动检测
                    </el-button>
                  </template>
                </el-input>
                <div class="form-tip text-sm text-gray-500 mt-1">
                  提示：在手机投屏App中查看IP地址，或点击"自动检测"按钮
                </div>
              </el-form-item>

              <el-form-item v-if="form.mobileConnection === 'usb'" label="ADB端口" prop="adbPort">
                <el-input v-model="form.adbPort" placeholder="默认5555" />
                <div class="form-tip text-sm text-gray-500 mt-1">
                  提示：确保手机已开启开发者选项和USB调试
                </div>
              </el-form-item>

              <el-form-item v-if="form.mobileConnection === 'qrcode'" label="连接状态">
                <div class="qrcode-status">
                  <el-button type="primary" @click="generateQRCode">
                    <el-icon><Grid /></el-icon> 生成连接二维码
                  </el-button>
                  <div v-if="qrCodeUrl" class="qrcode-display mt-2">
                    <img :src="qrCodeUrl" alt="连接二维码" style="max-width: 200px;" />
                    <p class="text-sm text-gray-500 mt-1">请使用手机App扫描此二维码</p>
                  </div>
                </div>
              </el-form-item>

              <el-form-item label="分辨率" prop="resolution">
                <el-select v-model="form.resolution" placeholder="请选择分辨率" style="width: 100%">
                  <el-option label="1920x1080 (1080p)" value="1920x1080" />
                  <el-option label="1280x720 (720p)" value="1280x720" />
                  <el-option label="自动适配" value="auto" />
                </el-select>
              </el-form-item>

              <el-form-item label="帧率" prop="frameRate">
                <el-select v-model="form.frameRate" placeholder="请选择帧率" style="width: 100%">
                  <el-option label="60 fps" :value="60" />
                  <el-option label="30 fps" :value="30" />
                  <el-option label="15 fps" :value="15" />
                </el-select>
              </el-form-item>

              <el-form-item label="音频" prop="captureAudio">
                <el-switch v-model="form.captureAudio" /> 捕获系统音频
              </el-form-item>

              <el-form-item label="信号源名称" prop="name">
                <el-input v-model="form.name" placeholder="留空则自动生成" />
              </el-form-item>
            </template>

            <!-- 网络串流 -->
            <template v-else-if="form.type === 'networkStream'">
              <el-form-item label="流媒体协议" prop="protocol">
                <el-select v-model="form.protocol" placeholder="请选择协议" style="width: 100%">
                  <el-option label="RTMP" value="rtmp" />
                  <el-option label="RTSP" value="rtsp" />
                  <el-option label="HLS (m3u8)" value="hls" />
                  <el-option label="HTTP-FLV" value="http-flv" />
                  <el-option label="WebSocket-FLV" value="ws-flv" />
                  <el-option label="SRT" value="srt" />
                  <el-option label="WebRTC" value="webrtc" />
                </el-select>
              </el-form-item>
              <el-form-item label="流媒体地址" prop="streamUrl">
                <el-input v-model="form.streamUrl" placeholder="例如：rtmp://live.example.com/stream/key" />
              </el-form-item>
              <el-form-item label="缓冲时间(ms)" prop="bufferTime">
                <el-input-number v-model="form.bufferTime" :min="0" :max="5000" :step="100" />
              </el-form-item>
              <el-form-item label="认证" prop="needAuth">
                <el-checkbox v-model="form.needAuth">需要认证</el-checkbox>
              </el-form-item>
              <el-form-item v-if="form.needAuth" label="Token/密钥" prop="authToken">
                <el-input v-model="form.authToken" type="password" placeholder="请输入认证Token" show-password />
              </el-form-item>
              <el-form-item label="信号源名称" prop="name">
                <el-input v-model="form.name" placeholder="留空则自动生成" />
              </el-form-item>
            </template>

            <!-- 本地视频 -->
            <template v-else-if="form.type === 'localVideo'">
              <el-form-item label="选择视频文件" prop="filePath">
                <el-input v-model="form.filePath" placeholder="请选择视频文件">
                  <template #append>
                    <el-button @click="handleSelectVideoFile">选择文件</el-button>
                  </template>
                </el-input>
              </el-form-item>
              <el-form-item label="循环播放" prop="loop">
                <el-switch v-model="form.loop" />
              </el-form-item>
              <el-form-item label="自动播放" prop="autoPlay">
                <el-switch v-model="form.autoPlay" />
              </el-form-item>
              <el-form-item label="静音播放" prop="muted">
                <el-switch v-model="form.muted" />
              </el-form-item>
              <el-form-item label="信号源名称" prop="name">
                <el-input v-model="form.name" placeholder="留空则自动生成" />
              </el-form-item>
            </template>

            <!-- 屏幕共享 -->
            <template v-else-if="form.type === 'remoteDesktop'">
              <el-form-item label="共享方式" prop="shareMode">
                <el-select v-model="form.shareMode" placeholder="请选择共享方式" style="width: 100%">
                  <el-option label="整个屏幕" value="screen" />
                  <el-option label="应用程序窗口" value="window" />
                  <el-option label="浏览器标签页" value="browser" />
                </el-select>
              </el-form-item>
              <el-form-item label="分辨率" prop="resolution">
                <el-select v-model="form.resolution" placeholder="请选择分辨率" style="width: 100%">
                  <el-option label="1920x1080" value="1920x1080" />
                  <el-option label="1280x720" value="1280x720" />
                  <el-option label="3840x2160" value="3840x2160" />
                  <el-option label="原分辨率" value="original" />
                </el-select>
              </el-form-item>
              <el-form-item label="帧率" prop="frameRate">
                <el-select v-model="form.frameRate" placeholder="请选择帧率" style="width: 100%">
                  <el-option label="60 fps" :value="60" />
                  <el-option label="30 fps" :value="30" />
                  <el-option label="15 fps" :value="15" />
                </el-select>
              </el-form-item>
              <el-form-item label="音频" prop="captureAudio">
                <el-switch v-model="form.captureAudio" /> 捕获系统音频
              </el-form-item>
              <el-form-item label="信号源名称" prop="name">
                <el-input v-model="form.name" placeholder="留空则自动生成" />
              </el-form-item>
            </template>

            <!-- PPT课件 -->
            <template v-else-if="form.type === 'ppt'">
              <el-form-item label="选择PPT文件" prop="filePath">
                <el-input v-model="form.filePath" placeholder="请选择PPT文件">
                  <template #append>
                    <el-button @click="handleSelectPPTFile">选择文件</el-button>
                  </template>
                </el-input>
              </el-form-item>
              <el-form-item label="显示模式" prop="displayMode">
                <el-select v-model="form.displayMode" placeholder="请选择显示模式" style="width: 100%">
                  <el-option label="幻灯片模式" value="slideshow" />
                  <el-option label="大纲模式" value="outline" />
                  <el-option label="阅读模式" value="reading" />
                </el-select>
              </el-form-item>
              <el-form-item label="自动播放" prop="autoPlay">
                <el-switch v-model="form.autoPlay" />
              </el-form-item>
              <el-form-item label="信号源名称" prop="name">
                <el-input v-model="form.name" placeholder="留空则自动生成" />
              </el-form-item>
            </template>

            <!-- Word文档 -->
            <template v-else-if="form.type === 'word'">
              <el-form-item label="选择Word文件" prop="filePath">
                <el-input v-model="form.filePath" placeholder="请选择Word文件">
                  <template #append>
                    <el-button @click="handleSelectWordFile">选择文件</el-button>
                  </template>
                </el-input>
              </el-form-item>
              <el-form-item label="显示模式" prop="displayMode">
                <el-select v-model="form.displayMode" placeholder="请选择显示模式" style="width: 100%">
                  <el-option label="页面视图" value="print" />
                  <el-option label="阅读视图" value="web" />
                  <el-option label="大纲视图" value="outline" />
                </el-select>
              </el-form-item>
              <el-form-item label="缩放" prop="zoom">
                <el-slider v-model="form.zoom" :min="50" :max="200" :step="25" />
              </el-form-item>
              <el-form-item label="信号源名称" prop="name">
                <el-input v-model="form.name" placeholder="留空则自动生成" />
              </el-form-item>
            </template>

            <!-- PDF文档 -->
            <template v-else-if="form.type === 'pdf'">
              <el-form-item label="选择文档文件" prop="filePath">
                <el-input v-model="form.filePath" placeholder="请选择文档文件（支持Word/Excel/PPT/PDF等格式）">
                  <template #append>
                    <el-button @click="handleSelectPdfFile">选择文件</el-button>
                  </template>
                </el-input>
              </el-form-item>
              <el-form-item label="信号源名称" prop="name">
                <el-input v-model="form.name" placeholder="留空则自动生成" />
              </el-form-item>
            </template>


          </el-form>
        </div>
      </div>
    </div>

    <!-- 摄像机编辑对话框 -->
    <el-dialog
      title="编辑摄像机"
      v-model="showEditDialog"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="editingCameraData" label-width="100px" class="edit-camera-form">
        <el-form-item label="协议类型" prop="protocol">
          <el-select v-model="editingCameraData.protocol" placeholder="请选择协议" style="width: 100%">
            <el-option label="RTSP - 实时流" value="rtsp" />
            <el-option label="ONVIF - 标准协议" value="onvif" />
            <el-option label="海康威视" value="hikvision" />
            <el-option label="大华" value="dahua" />
            <el-option label="宇视" value="uniview" />
          </el-select>
        </el-form-item>
        <el-form-item label="IP地址" prop="address">
          <el-input
            v-model="editingCameraData.address"
            placeholder="例如：192.168.1.100"
            @input="handleIpChange"
          />
        </el-form-item>
        <el-form-item label="流地址" prop="streamUrl">
          <el-input
            v-model="editingCameraData.streamUrl"
            :placeholder="getStreamUrlPlaceholder"
          />
          <div class="form-tip text-gray-500 text-xs mt-1">
            {{ getStreamUrlTip }}
          </div>
        </el-form-item>
        <el-form-item label="需要认证" prop="needAuth">
          <el-switch
            v-model="editingCameraData.needAuth"
            :disabled="editingCameraData.protocol === 'rtsp'"
          />
          <span v-if="editingCameraData.protocol === 'rtsp'" class="auth-hint">
            RTSP认证在添加时设置
          </span>
          <span v-if="editingCameraData.protocol === 'onvif'" class="auth-hint">
            ONVIF通常需要认证
          </span>
        </el-form-item>
        <template v-if="editingCameraData.needAuth">
          <el-form-item label="用户名" prop="username">
            <el-input
              v-model="editingCameraData.username"
              placeholder="默认：admin"
            />
          </el-form-item>
          <el-form-item label="密码" prop="password">
            <el-input
              v-model="editingCameraData.password"
              type="password"
              show-password
              placeholder="请输入密码"
            />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="closeEditDialog">取消</el-button>
        <el-button type="primary" @click="saveCameraChanges">保存</el-button>
      </template>
    </el-dialog>

    <!-- 🎯 ONVIF 检测结果对话框 -->
    <el-dialog
      v-model="showOnvifDetectionResult"
      title="ONVIF 服务路径检测结果"
      width="900px"
      :close-on-click-modal="false"
    >
      <div v-if="onvifDetectionResult" class="onvif-detection-result">
        <!-- 🎯 设备信息 -->
        <el-card v-if="onvifDetectionResult.device_info" class="mb-4" shadow="hover">
          <template #header>
            <div class="card-header">
              <span>📷 设备信息 (GetDeviceInfo)</span>
              <el-tag type="success" size="small">✓ 验证成功</el-tag>
            </div>
          </template>
          <el-descriptions :column="3" border>
            <el-descriptions-item label="制造商">
              {{ onvifDetectionResult.device_info.manufacturer }}
            </el-descriptions-item>
            <el-descriptions-item label="型号">
              {{ onvifDetectionResult.device_info.model }}
            </el-descriptions-item>
            <el-descriptions-item label="固件版本">
              {{ onvifDetectionResult.device_info.firmware_version }}
            </el-descriptions-item>
            <el-descriptions-item label="序列号" :span="2">
              {{ onvifDetectionResult.device_info.serial_number }}
            </el-descriptions-item>
            <el-descriptions-item label="硬件ID">
              {{ onvifDetectionResult.device_info.hardware_id }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 设备基本信息 -->
        <el-card class="mb-4" shadow="hover">
          <template #header>
            <div class="card-header">
              <span>📷 设备信息</span>
            </div>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="IP地址">{{ onvifDetectionResult.ip }}</el-descriptions-item>
            <el-descriptions-item label="端口">{{ onvifDetectionResult.port }}</el-descriptions-item>
            <el-descriptions-item label="设备服务URL">
              <el-tag v-if="onvifDetectionResult.device_service_url" type="success" size="small">
                {{ onvifDetectionResult.device_service_url }}
              </el-tag>
              <el-tag v-else type="info" size="small">未找到</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="媒体服务URL">
              <el-tag v-if="onvifDetectionResult.media_service_url" type="success" size="small">
                {{ onvifDetectionResult.media_service_url }}
              </el-tag>
              <el-tag v-else type="info" size="small">未找到</el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 推荐配置 -->
        <el-card class="mb-4" shadow="hover">
          <template #header>
            <div class="card-header">
              <span>✨ 推荐配置</span>
              <el-tag
                :type="onvifDetectionResult.recommended_config.confidence === 'high' ? 'success' :
                       onvifDetectionResult.recommended_config.confidence === 'medium' ? 'warning' : 'danger'"
                size="small"
              >
                置信度: {{ onvifDetectionResult.recommended_config.confidence }}
              </el-tag>
            </div>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="设备服务路径">
              <code>{{ onvifDetectionResult.recommended_config.device_service_path }}</code>
            </el-descriptions-item>
            <el-descriptions-item label="媒体服务路径">
              <code>{{ onvifDetectionResult.recommended_config.media_service_path }}</code>
            </el-descriptions-item>
            <el-descriptions-item label="Profile Token">
              <code>{{ onvifDetectionResult.recommended_config.profile_token }}</code>
            </el-descriptions-item>
            <el-descriptions-item label="RTSP流地址" :span="2">
              <el-tag v-if="onvifDetectionResult.rtsp_stream_url" type="success">
                {{ onvifDetectionResult.rtsp_stream_url }}
              </el-tag>
              <span v-else class="text-gray-400">未获取到</span>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 服务路径测试结果 -->
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>🔍 服务路径测试 (共 {{ onvifDetectionResult.service_tests.length }} 个)</span>
              <div class="test-summary">
                <el-tag type="success" size="small" class="mr-2">
                  成功: {{ onvifDetectionResult.service_tests.filter(t => t.status === 'success').length }}
                </el-tag>
                <el-tag type="danger" size="small" class="mr-2">
                  失败: {{ onvifDetectionResult.service_tests.filter(t => t.status === 'failed').length }}
                </el-tag>
                <el-tag type="warning" size="small">
                  超时: {{ onvifDetectionResult.service_tests.filter(t => t.status === 'timeout').length }}
                </el-tag>
              </div>
            </div>
          </template>

          <el-table
            :data="onvifDetectionResult.service_tests"
            max-height="400"
            stripe
            style="width: 100%"
          >
            <el-table-column prop="path" label="路径" min-width="200">
              <template #default="{ row }">
                <code class="text-xs">{{ row.path }}</code>
              </template>
            </el-table-column>
            <el-table-column prop="protocol" label="协议" width="80">
              <template #default="{ row }">
                <el-tag size="small">{{ row.protocol }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag
                  :type="row.status === 'success' ? 'success' :
                         row.status === 'timeout' ? 'warning' : 'danger'"
                  size="small"
                >
                  {{ row.status === 'success' ? '成功' : row.status === 'timeout' ? '超时' : '失败' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="status_code" label="状态码" width="100">
              <template #default="{ row }">
                <span v-if="row.status_code" class="text-sm">{{ row.status_code }}</span>
                <span v-else class="text-gray-400">-</span>
              </template>
            </el-table-column>
            <el-table-column prop="response_time_ms" label="响应时间" width="120">
              <template #default="{ row }">
                <span class="text-sm">{{ row.response_time_ms }}ms</span>
              </template>
            </el-table-column>
            <el-table-column prop="is_device_service" label="类型" width="120">
              <template #default="{ row }">
                <el-tag
                  :type="row.is_device_service ? 'primary' : 'success'"
                  size="small"
                >
                  {{ row.is_device_service ? '设备服务' : '媒体服务' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="error_message" label="错误信息" min-width="150">
              <template #default="{ row }">
                <span v-if="row.error_message" class="text-xs text-red-500">
                  {{ row.error_message.substring(0, 50) }}...
                </span>
                <span v-else class="text-green-500">✓</span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <!-- Profile 列表 -->
        <el-card v-if="onvifDetectionResult.profiles && onvifDetectionResult.profiles.length > 0" class="mt-4" shadow="hover">
          <template #header>
            <div class="card-header">
              <span>📋 Profiles (共 {{ onvifDetectionResult.profiles.length }} 个)</span>
            </div>
          </template>
          <div class="profile-list">
            <el-tag
              v-for="(profile, index) in onvifDetectionResult.profiles"
              :key="index"
              class="mr-2 mb-2"
              :type="index === 0 ? 'success' : 'info'"
            >
              {{ profile }}
            </el-tag>
          </div>
        </el-card>
      </div>

      <template #footer>
        <el-button @click="showOnvifDetectionResult = false">关闭</el-button>
        <el-button
          type="primary"
          @click="applyRecommendedConfig"
          :disabled="!onvifDetectionResult || !onvifDetectionResult.rtsp_stream_url"
        >
          应用推荐配置
        </el-button>
      </template>
    </el-dialog>

    <template #footer>
      <el-form-item>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">确定</el-button>
        <el-button @click="handleClose">取消</el-button>

        <!-- 测试按钮 -->
        <el-button
          v-if="form.protocol === 'rtsp' && form.streamUrl"
          type="success"
          @click="testRtspStream"
          :loading="testingStream"
          class="ml-2"
        >
          测试连接
        </el-button>
      </el-form-item>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { Refresh, VideoPlay, VideoPause, Edit, Delete, Warning, VideoCamera, Search, InfoFilled, DocumentCopy, Grid } from '@element-plus/icons-vue';
import { SOURCE_TYPE_OPTIONS, SOURCE_TYPE_GROUPS, getSourceTypeIcon, getSourceTypeLabel, getSourceTypeTag } from '@/constants/sourceTypes';
import { ElMessage } from 'element-plus';

// ==================== Props & Emits ====================

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  sources: {
    type: Array,
    default: () => []
  },
  localDevices: {
    type: Array,
    default: () => []
  },
  captureDevices: {
    type: Array,
    default: () => []
  },
  scannerDevices: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits([
  'update:modelValue',
  'refresh-sources',
  'add-to-preview',
  'remove-from-preview',
  'rename-source',
  'delete-source',
  'submit-source-form'
]);

// ==================== State ====================

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const formRef = ref(null);

// 提交状态
const submitting = ref(false);

// 摄像机扫描相关状态
const isScanning = ref(false);
const discoveredCameras = ref([]);
const selectedCamera = ref(null);
const scanError = ref('');
const editingCamera = ref(null);
const scanMode = ref('manual_input'); // 扫描模式：auto_scan | all_interfaces | advanced_search | manual_input
const testingStream = ref(false); // RTSP流测试状态
const detectingIp = ref(false); // IP自动检测状态
const qrCodeUrl = ref(''); // 二维码URL
const showManualInput = ref(false); // 是否显示手动输入表单
const lastProtocol = ref(''); // 记录上次选择的协议，用于避免重复提示

// ONVIF 自动获取流地址相关状态
const fetchingOnvifStream = ref(false); // ONVIF流地址获取状态
const detectingOnvifServices = ref(false); // ONVIF服务检测状态
const showOnvifDetectionResult = ref(false); // 显示ONVIF检测结果对话框
const onvifDetectionResult = ref(null); // ONVIF检测结果

// 跨网段扫描配置
const crossSubnetList = ref('');

// 一键快速扫描
async function handleQuickScan() {
  if (isScanning.value) return;

  isScanning.value = true;
  scanError.value = '';
  discoveredCameras.value = [];

  try {
    const { invoke } = await import('@tauri-apps/api/core');

    let result;

    // 🎯 根据扫描模式选择不同的扫描方法
    if (scanMode.value === 'cross_subnet') {
      // 跨网段扫描
      console.log('[摄像机扫描] 开始跨网段扫描...');
      const subnets = parseSubnetList(crossSubnetList.value);

      if (subnets.length === 0) {
        ElMessage.warning('请输入至少一个目标网段');
        isScanning.value = false;
        return;
      }

      ElMessage.info({
        message: `正在扫描 ${subnets.length} 个网段...`,
        duration: 3000
      });

      // 🚀 优化：减少超时时间，提高扫描速度
      result = await invoke('scan_specific_subnets', {
        subnets,
        timeoutSecs: 3  // 从8秒降低到3秒，加快扫描速度
      });
    } else {
      // 自动扫描（多网卡扫描）
      console.log('[摄像机扫描] 开始多网卡扫描...');
      result = await invoke('scan_all_network_interfaces', { timeoutSecs: 8 });
    }

    if (result && Array.isArray(result)) {
      discoveredCameras.value = result;
    } else if (result && result.cameras && Array.isArray(result.cameras)) {
      discoveredCameras.value = result.cameras;
    }

    if (discoveredCameras.value.length === 0) {
      ElMessage.warning('未发现摄像机设备，请检查网络连接或手动添加');
    } else {
      ElMessage.success(`发现 ${discoveredCameras.value.length} 台摄像机`);
    }
  } catch (error) {
    console.error('[摄像机扫描] 失败:', error);
    scanError.value = '扫描失败，请检查网络连接';
    ElMessage.error('扫描失败：' + error);
  } finally {
    isScanning.value = false;
  }
}

// 清空扫描结果
function clearScanResults() {
  discoveredCameras.value = [];
  selectedCamera.value = null;
  editingCamera.value = null;
}

// 解析用户输入的网段列表
function parseSubnetList(input) {
  if (!input || input.trim() === '') {
    return [];
  }

  const subnets = [];
  const lines = input.split(/[\n,]+/).map(line => line.trim()).filter(line => line.length > 0);

  for (const line of lines) {
    // 验证CIDR格式：x.x.x.x/x
    if (line.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/)) {
      subnets.push(line);
    } else {
      console.warn('[跨网段扫描] 无效的网段格式:', line);
    }
  }

  return subnets;
}

// 加载示例网段
function loadExampleSubnets() {
  crossSubnetList.value = `192.168.2.0/24
192.168.3.0/24
10.0.1.0/24`;
  ElMessage.info('已加载示例网段，请根据实际情况修改');
}

// 清空网段列表
function clearSubnets() {
  crossSubnetList.value = '';
  ElMessage.info('已清空网段列表');
}

// 双击摄像机行进入编辑模式
function handleDoubleClickCamera(row) {
  console.log('[摄像机管理] 双击编辑摄像机:', row.address);
  editingCamera.value = { ...row };
}

// 保存编辑的摄像机信息
function saveCameraEdit() {
  if (editingCamera.value) {
    const index = discoveredCameras.value.findIndex(
      cam => cam.address === editingCamera.value.address
    );
    if (index !== -1) {
      discoveredCameras.value[index] = { ...editingCamera.value };
      console.log('[摄像机管理] 保存摄像机编辑:', editingCamera.value);
    }
    editingCamera.value = null;
  }
}

// 获取协议类型对应的标签类型
function getProtocolType(row) {
  const protocol = row.protocol?.toLowerCase();
  switch (protocol) {
    case 'onvif': return 'success';
    case 'rtsp': return 'primary';
    case 'hikvision': return 'warning';
    case 'dahua': return 'info';
    case 'uniview': return 'danger';
    default: return undefined; // 返回undefined而不是空字符串
  }
}

// 更新摄像机协议类型
function updateCameraProtocol(row) {
  console.log('[摄像机管理] 更新协议类型:', row.address, row.protocol);
  // 可以在这里添加协议变更后的处理逻辑
}

// 编辑对话框状态
const showEditDialog = ref(false);
const editingSource = ref(null); // 当前正在编辑的已添加信号源
const editingCameraData = ref({
  originalAddress: '', // 保存原始地址用于查找
  address: '',
  streamUrl: '',
  protocol: 'rtsp',
  needAuth: false,
  username: '',
  password: ''
});

// 协议URL模板配置
const protocolUrlTemplates = {
  rtsp: 'rtsp://{ip}/live/ch1',
  onvif: 'http://{ip}:2000/onvif/device_service',
  hikvision: 'rtsp://{ip}:554/h264/ch1/main/av_stream',
  dahua: 'rtsp://{ip}:554/cam/realmonitor?channel=1&subtype=0',
  uniview: 'rtsp://{ip}:554/Streaming/Channels/101'
};

// 计算属性：获取流地址提示
const getStreamUrlPlaceholder = computed(() => {
  const template = protocolUrlTemplates[editingCameraData.value.protocol];
  if (template) {
    const ip = editingCameraData.value.address || '192.168.1.10';
    return template.replace('{ip}', ip);
  }
  return '请输入流地址';
});

const getStreamUrlTip = computed(() => {
  const protocol = editingCameraData.value.protocol;
  const tips = {
    rtsp: 'RTSP格式示例：rtsp://192.168.1.10/live/ch1',
    onvif: 'ONVIF格式示例：http://192.168.1.10:2000/onvif/device_service',
    hikvision: '海康威视格式：rtsp://{ip}:554/h264/ch1/main/av_stream',
    dahua: '大华格式：rtsp://{ip}:554/cam/realmonitor?channel=1&subtype=0',
    uniview: '宇视格式：rtsp://{ip}:554/Streaming/Channels/101'
  };
  return tips[protocol] || '';
});

// 打开编辑对话框
function openEditDialog(row) {
  console.log('[摄像机管理] 打开编辑对话框:', row);
  const protocol = row.protocol || 'rtsp';
  let streamUrl = row.streamUrl || '';

  // 如果没有流地址，根据协议生成模板
  if (!streamUrl && row.address) {
    const template = protocolUrlTemplates[protocol];
    if (template) {
      streamUrl = template.replace('{ip}', row.address);
    }
  }

  editingCameraData.value = {
    originalAddress: row.address || '',
    address: row.address || '',
    streamUrl: streamUrl,
    protocol: protocol,
    needAuth: row.needAuth || (protocol === 'onvif'),
    username: row.username || '',
    password: row.password || ''
  };
  showEditDialog.value = true;
}

// 关闭编辑对话框
function closeEditDialog() {
  showEditDialog.value = false;
  editingCameraData.value = {
    originalAddress: '',
    address: '',
    streamUrl: '',
    protocol: 'rtsp',
    needAuth: false,
    username: '',
    password: ''
  };
}

// 处理IP地址变化，自动更新流地址模板
function handleIpChange() {
  if (editingCameraData.value.address && !editingCameraData.value.streamUrl) {
    const template = protocolUrlTemplates[editingCameraData.value.protocol];
    if (template) {
      editingCameraData.value.streamUrl = template.replace('{ip}', editingCameraData.value.address);
    }
  }
}

// 处理协议变化，更新流地址模板
watch(() => editingCameraData.value.protocol, (newProtocol, oldProtocol) => {
  // 只有当流地址是旧的协议模板时才更新
  if (oldProtocol && editingCameraData.value.address) {
    const oldTemplate = protocolUrlTemplates[oldProtocol];
    const currentUrl = editingCameraData.value.streamUrl;

    // 检查当前URL是否匹配旧协议模板
    if (oldTemplate && currentUrl && currentUrl.includes(editingCameraData.value.address)) {
      const newTemplate = protocolUrlTemplates[newProtocol];
      if (newTemplate) {
        editingCameraData.value.streamUrl = newTemplate.replace('{ip}', editingCameraData.value.address);
      }
    }
  }

  // ONVIF协议默认需要认证
  if (newProtocol === 'onvif') {
    editingCameraData.value.needAuth = true;
  } else if (newProtocol === 'rtsp') {
    editingCameraData.value.needAuth = false;
  }
});

// 保存编辑的摄像机信息
function saveCameraChanges() {
  if (!editingCameraData.value.address) {
    ElMessage.error('请输入IP地址');
    return;
  }

  // 如果是编辑已添加的信号源
  if (editingSource.value) {
    const updatedSource = {
      ...editingSource.value,
      protocol: editingCameraData.value.protocol,
      streamUrl: editingCameraData.value.streamUrl,
      onvifUrl: editingCameraData.value.protocol === 'onvif' ? editingCameraData.value.streamUrl : editingSource.value.onvifUrl,
      needAuth: editingCameraData.value.needAuth,
      username: editingCameraData.value.username,
      password: editingCameraData.value.password
    };

    emit('update-network-camera', updatedSource);
    console.log('[摄像机管理] 更新已添加的摄像机:', updatedSource);
    ElMessage.success('摄像机信息已更新');
    closeEditDialog();
    editingSource.value = null;
    return;
  }

  // 否则是编辑扫描结果列表中的摄像机
  const index = discoveredCameras.value.findIndex(
    cam => cam.address === editingCameraData.value.originalAddress
  );

  if (index !== -1) {
    // 使用新地址更新摄像机
    const updatedCamera = {
      ...discoveredCameras.value[index],
      ...editingCameraData.value
    };
    // 如果地址改变了，需要从新地址的角度更新（但这里我们是更新整个列表，所以保持原样）
    discoveredCameras.value[index] = updatedCamera;
    console.log('[摄像机管理] 更新摄像机信息:', updatedCamera);
  } else {
    // 如果找不到，尝试用新地址查找
    const newIndex = discoveredCameras.value.findIndex(
      cam => cam.address === editingCameraData.value.address
    );

    if (newIndex !== -1) {
      // 地址已存在，更新其他信息
      discoveredCameras.value[newIndex] = {
        ...discoveredCameras.value[newIndex],
        ...editingCameraData.value,
        originalAddress: editingCameraData.value.address
      };
      console.log('[摄像机管理] 地址已存在，更新信息:', discoveredCameras.value[newIndex]);
    } else {
      // 添加新摄像机
      const newCamera = {
        ...editingCameraData.value,
        originalAddress: editingCameraData.value.address
      };
      discoveredCameras.value.push(newCamera);
      console.log('[摄像机管理] 添加新摄像机:', newCamera);
    }
  }

  ElMessage.success('摄像机信息已保存');
  closeEditDialog();
}

const form = ref({
  type: 'localDevice',
  // 通用字段
  name: '',
  deviceId: '',
  // 本地设备类别
  deviceCategory: 'camera',

  // 采集卡相关
  inputInterface: 'hdmi',
  cardResolution: 'auto',

  // 高拍仪相关
  scanMode: 'single',
  autoEnhance: false,
  autoCrop: false,

  // 网络摄像头/串流相关
  protocol: 'rtsp',
  streamUrl: '',
  cameraIp: '', // 摄像机IP地址（ONVIF专用）
  onvifUrl: '', // ONVIF设备服务地址
  onvifPort: 2000, // ONVIF端口，默认2000（不同品牌可能不同）
  needAuth: false,
  username: '',
  password: '',
  authToken: '',
  bufferTime: 1000,

  // MR摄像机相关
  mrType: 'hololens',
  connectionType: 'wifi',

  // 远程摄像头相关
  desktopId: '',
  cameraIndex: 0,

  // 移动设备相关
  mobileConnection: 'wifi',
  mobileIp: '',
  adbPort: '5555',
  cameraDirection: 'back',
  mobileResolution: '1920x1080',
  frameRate: 30,
  captureAudio: true,

  // 本地视频相关
  filePath: '',
  file: null,
  loop: false,
  autoPlay: true,
  muted: false,

  // 屏幕共享相关
  shareMode: 'screen',
  captureAudio: false,

  // 文档课件相关
  displayMode: 'slideshow',
  zoom: 100
});

const rules = {
  name: [{ max: 100, message: '名称不能超过100个字符', trigger: 'blur' }],
  deviceId: [{ required: true, message: '请选择设备', trigger: 'change' }],
  streamUrl: [
    {
      required: false,
      validator: (rule, value, callback) => {
        // 当协议是ONVIF时，streamUrl是可选的
        if (form.value.protocol === 'onvif') {
          callback();
          return;
        }

        // 网络摄像机和RTSP协议需要验证streamUrl
        if (form.value.type === 'networkCamera' || form.value.protocol === 'rtsp') {
          if (!value) {
            callback(new Error('请输入流媒体地址'));
          } else if (!/^(rtsp|rtmp|hls|http|ws|srt):\/\//.test(value)) {
            callback(new Error('请输入有效的URL地址'));
          } else {
            callback();
          }
        } else {
          callback();
        }
      },
      trigger: 'blur'
    }
  ],
  onvifUrl: [
    {
      required: false,
      validator: (rule, value, callback) => {
        // 只有当协议是ONVIF时才验证
        if (form.value.protocol === 'onvif') {
          if (!value) {
            callback(new Error('请输入ONVIF设备服务地址'));
          } else if (!/^https?:\/\//.test(value)) {
            callback(new Error('请输入有效的ONVIF URL地址'));
          } else {
            callback();
          }
        } else {
          callback();
        }
      },
      trigger: 'blur'
    }
  ]
};

// ==================== Computed ====================

const sourceTypeOptions = computed(() => SOURCE_TYPE_OPTIONS);

// 信号源类型分组（使用常量定义）
const sourceTypeGroups = computed(() => {
  return SOURCE_TYPE_GROUPS.map(group => ({
    name: group.name,
    icon: group.icon,
    types: group.types
      .map(typeValue => SOURCE_TYPE_OPTIONS.find(t => t.value === typeValue))
      .filter(Boolean)
  })).filter(group => group.types.length > 0);
});

// 当前选中类别的设备列表
const currentDevices = computed(() => {
  switch (form.value.deviceCategory) {
    case 'camera':
      return props.localDevices;
    case 'captureCard':
      return props.captureDevices;
    case 'scanner':
      return props.scannerDevices;
    default:
      return [];
  }
});

// 获取设备类别标签
function getDeviceCategoryLabel(category) {
  const labels = {
    camera: 'USB摄像头',
    captureCard: '采集卡',
    scanner: '高拍仪'
  };
  return labels[category] || '设备';
}

// ==================== Methods ====================

// 工具函数（复用常量）
function getSourceTypeIconWrapper(type) {
  return getSourceTypeIcon(type);
}

function getSourceTypeLabelWrapper(type) {
  return getSourceTypeLabel(type);
}

function getSourceTypeTagWrapper(type) {
  return getSourceTypeTag(type);
}

// 事件处理函数
function handleClose() {
  resetForm();
}

function handleRefreshSources() {
  emit('refresh-sources');
}

function handleAddToPreview(source) {
  emit('add-to-preview', source);
}

function handleRemoveFromPreview(sourceId) {
  emit('remove-from-preview', sourceId);
}

function handleRenameSource(source) {
  emit('rename-source', source);
}

function handleEditNetworkCamera(source) {
  console.log('[摄像机管理] 编辑已添加的摄像机:', source);

  const protocol = source.protocol || 'rtsp';
  let streamUrl = '';

  // 根据协议获取流地址
  if (protocol === 'onvif') {
    streamUrl = source.onvifUrl || '';
  } else {
    streamUrl = source.streamUrl || '';
  }

  // 打开编辑对话框
  editingCameraData.value = {
    originalAddress: source.id, // 使用source.id作为原始标识
    address: source.streamUrl ? getIpFromUrl(source.streamUrl) : '',
    streamUrl: streamUrl,
    protocol: protocol,
    needAuth: source.needAuth || (protocol === 'onvif'),
    username: source.username || '',
    password: source.password || ''
  };
  showEditDialog.value = true;

  // 保存当前source以便后续更新
  editingSource.value = source;
}

function handleDeleteSource(sourceId) {
  emit('delete-source', sourceId);
}

// 从URL中提取IP地址
function getIpFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    // 如果URL格式不正确，尝试用正则提取IP
    const ipMatch = url.match(/(\d+\.\d+\.\d+\.\d+)/);
    return ipMatch ? ipMatch[1] : '';
  }
}

// 选择本地视频文件
async function handleSelectVideoFile() {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      filters: [
        { name: '视频文件', extensions: ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      multiple: false
    });

    if (selected) {
      form.value.filePath = selected;
      form.value.name = form.value.name || selected.split('/').pop().split('\\').pop();
    }
  } catch (error) {
    console.error('选择视频文件失败:', error);
  }
}

// 选择PPT文件
async function handleSelectPPTFile() {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      filters: [
        { name: 'PowerPoint', extensions: ['pptx', 'ppt'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      multiple: false
    });

    if (selected) {
      form.value.filePath = selected;
      form.value.name = form.value.name || selected.split('/').pop().split('\\').pop();
    }
  } catch (error) {
    console.error('选择PPT文件失败:', error);
  }
}

// 选择Word文件
async function handleSelectWordFile() {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      filters: [
        { name: 'Word文档', extensions: ['docx', 'doc'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      multiple: false
    });

    if (selected) {
      form.value.filePath = selected;
      form.value.name = form.value.name || selected.split('/').pop().split('\\').pop();
    }
  } catch (error) {
    console.error('选择Word文件失败:', error);
  }
}

// 选择PDF文档文件
async function handleSelectPdfFile() {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      filters: [
        { name: 'PDF文档', extensions: ['pdf'] },
        { name: 'Word文档', extensions: ['docx', 'doc'] },
        { name: 'Excel文档', extensions: ['xlsx', 'xls'] },
        { name: 'PowerPoint', extensions: ['pptx', 'ppt'] },
        { name: 'OpenDocument', extensions: ['odt', 'ods', 'odp'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      multiple: false
    });

    if (selected) {
      form.value.filePath = selected;
      form.value.name = form.value.name || selected.split('/').pop().split('\\').pop();
    }
  } catch (error) {
    console.error('选择文档文件失败:', error);
  }
}

async function handleSubmit() {
  if (submitting.value) return; // 防止重复提交

  try {
    submitting.value = true;

    await formRef.value?.validate();

    emit('submit-source-form', { ...form.value });

    // 提交成功后关闭对话框（由父组件控制）
    // visible.value = false; // 如果需要自动关闭，取消注释这行
  } catch (error) {
    console.error('表单验证失败:', error);
  } finally {
    submitting.value = false;
  }
}

// ==================== 摄像机扫描相关方法 ====================

/**
 * 扫描局域网摄像机设备（优化版）
 */
async function handleScanCameras() {
  if (isScanning.value) return;

  isScanning.value = true;
  scanError.value = '';
  discoveredCameras.value = [];

  try {
    const { invoke } = await import('@tauri-apps/api/core');

    // 先获取本地IP用于诊断
    let localIp = '';
    let allInterfaces = [];
    try {
      localIp = await invoke('get_local_ip');
      console.log('[摄像机扫描] 主网卡IP:', localIp);

      // 🎯 获取所有网络接口信息
      try {
        const interfacesInfo = await invoke('get_network_interfaces_info');
        if (interfacesInfo && interfacesInfo.interfaces) {
          allInterfaces = interfacesInfo.interfaces;
          console.log('[摄像机扫描] 检测到网络接口:', allInterfaces);
        }
      } catch (e) {
        console.warn('[摄像机扫描] 无法获取网络接口信息:', e);
      }
    } catch (e) {
      console.warn('[摄像机扫描] 无法获取本地IP:', e);
    }

    // 尝试多种扫描方式
    let found = [];
    const scanMethods = [
      { name: 'ONVIF发现', method: 'onvif_discover_devices', timeout: 5 },
      { name: '子网扫描', method: 'scan_local_subnet', timeout: 5 },
      { name: '综合发现', method: 'discover_all_cameras', timeout: 5 },
      { name: '多网卡扫描', method: 'scan_all_network_interfaces', timeout: 5 } // 🎯 新增：扫描所有网卡
    ];

    for (const method of scanMethods) {
      console.log(`[摄像机扫描] 尝试 ${method.name}...`);

      // 🎯 特殊处理多网卡扫描
      if (method.method === 'scan_all_network_interfaces') {
        ElMessage.info({
          message: `正在扫描所有网络接口（${allInterfaces.length}个）...`,
          duration: 3000
        });
      }

      try {
        const result = await invoke(method.method, { timeoutSecs: method.timeout });

        // 处理不同返回格式
        if (Array.isArray(result)) {
          found = result;
        } else if (result.cameras && Array.isArray(result.cameras)) {
          found = result.cameras;
        }

        if (found.length > 0) {
          console.log(`[摄像机扫描] ${method.name} 成功，发现 ${found.length} 个设备`);
          break;
        }
      } catch (error) {
        console.warn(`[摄像机扫描] ${method.name} 失败:`, error.message);
      }
    }

    // 处理发现的设备
    if (found.length > 0) {
      discoveredCameras.value = found.map(device => ({
        ...device,
        // 默认用户名密码（部分摄像机默认配置）
        username: device.username || 'admin',
        password: device.password || 'admin',
        name: device.name || `摄像机_${device.address?.split('.').pop() || '未知'}`
      }));

      ElMessage.success(`成功发现 ${discoveredCameras.value.length} 个摄像机设备`);
    } else {
      // 构建详细的错误提示
      const suggestions = [];

      if (!localIp) {
        suggestions.push('• 无法检测到本地IP，请检查网络连接');
      } else {
        const ipParts = localIp.split('.');
        if (ipParts.length === 4) {
          suggestions.push(`• 当前主网卡: ${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.x`);
        }
      }

      // 🎯 显示所有检测到的网络接口
      if (allInterfaces.length > 1) {
        suggestions.push(`• 检测到 ${allInterfaces.length} 个网络接口:`);
        allInterfaces.forEach(iface => {
          suggestions.push(`   - ${iface.name}: ${iface.ip}`);
        });
        suggestions.push('• 已自动扫描所有网卡，如仍未发现请手动输入');
      } else {
        suggestions.push('• 确认摄像机已通电并连接到同一网络');
        suggestions.push('• 检查摄像机是否启用了ONVIF或RTSP服务');
        suggestions.push('• 尝试手动输入摄像机IP地址');
        suggestions.push('• 检查Windows防火墙是否阻止了UDP多播');
      }

      scanError.value = '未发现摄像机设备\n\n建议检查：\n' + suggestions.join('\n');

      ElMessage.warning({
        message: '未发现设备，建议尝试手动添加',
        duration: 5000
      });
    }
  } catch (error) {
    scanError.value = '扫描失败: ' + error.message;
    console.error('[摄像机扫描] 扫描失败:', error);

    ElMessage.error({
      message: '扫描过程发生错误，请查看控制台日志',
      duration: 5000
    });
  } finally {
    isScanning.value = false;
  }
}

/**
 * 选择发现的摄像机
 */
function selectDiscoveredCamera(camera) {
  selectedCamera.value = camera;

  // 如果摄像机已经有流地址和协议设置，优先使用
  if (camera.protocol) {
    form.value.protocol = camera.protocol.toLowerCase();
  } else {
    // 根据发现设备的协议类型自动选择协议
    // ONVIF发现的设备使用ONVIF协议，其他(端口扫描等)使用RTSP协议
    if (camera.protocol === 'ONVIF' || camera.protocol?.toLowerCase().includes('onvif')) {
      form.value.protocol = 'onvif';
    } else {
      form.value.protocol = 'rtsp';
    }
  }

  // 设置名称
  form.value.name = camera.name || `摄像机_${camera.address?.split('.').pop() || '未知'}`;

  // 处理ONVIF协议
  if (form.value.protocol === 'onvif') {
    // ONVIF协议使用服务地址
    const onvifPort = 2000;
    const ip = camera.address;
    form.value.onvifUrl = camera.streamUrl || `http://${ip}:${onvifPort}/onvif/device_service`;
    form.value.streamUrl = ''; // ONVIF协议不需要RTSP流地址
  }
  // 处理RTSP及其他协议
  else {
    // 如果摄像机已经有流地址，直接使用
    if (camera.streamUrl) {
      form.value.streamUrl = camera.streamUrl;
    } else {
      // 根据设备类型智能推荐RTSP URL
      const port = camera.port || 554;
      const ip = camera.address;
      let suggestedUrl = `rtsp://${ip}:${port}/stream`;

      // 根据端口和设备信息智能推荐格式
      if (camera.manufacturer?.toLowerCase().includes('hik')) {
        suggestedUrl = `rtsp://${ip}:${port}/h264/ch1/main/av_stream`;
      } else if (camera.manufacturer?.toLowerCase().includes('dahua')) {
        suggestedUrl = `rtsp://${ip}:${port}/cam/realmonitor?channel=1&subtype=0`;
      } else if (camera.manufacturer?.toLowerCase().includes('axis')) {
        suggestedUrl = `rtsp://${ip}:${port}/axis-media/media.amp`;
      } else if (port === 554) {
        suggestedUrl = `rtsp://${ip}:${port}/h264/ch1/main/av_stream`; // 默认海康格式
      } else if (port === 8899) {
        suggestedUrl = `rtsp://${ip}:554/cam/realmonitor?channel=1&subtype=0`; // 大华格式
      }

      form.value.streamUrl = suggestedUrl;
    }
  }

  // 处理认证信息
  if (camera.needAuth) {
    form.value.needAuth = true;
    form.value.username = camera.username || 'admin';
    form.value.password = camera.password || 'admin';
  } else if (camera.username) {
    form.value.needAuth = true;
    form.value.username = camera.username;
    form.value.password = camera.password || 'admin';
  } else {
    // ONVIF协议默认需要认证
    if (form.value.protocol === 'onvif') {
      form.value.needAuth = true;
      form.value.username = 'admin';
      form.value.password = 'admin';
    } else {
      form.value.needAuth = false;
    }
  }

  // 根据协议类型给出相应提示（只在协议改变时显示）
  if (lastProtocol.value !== form.value.protocol) {
    if (form.value.protocol === 'onvif') {
      ElMessage.success({
        message: '已自动选择ONVIF协议，请确认ONVIF服务地址并填写认证信息',
        duration: 5000
      });
    } else {
      ElMessage.warning({
        message: '已自动填写 RTSP 地址模板，请根据实际摄像机型号修改路径后缀',
        duration: 5000
      });
    }
    lastProtocol.value = form.value.protocol;
  }
}

/**
 * 编辑发现的摄像机信息
 */
function editDiscoveredCamera(camera) {
  editingCamera.value = { ...camera };

  // 先选择摄像机以填充表单
  selectDiscoveredCamera(camera);

  // 滚动到表单区域
  setTimeout(() => {
    const formContainer = document.querySelector('.source-form-container');
    if (formContainer) {
      formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 100);

  ElMessage({
    type: 'info',
    message: '已将摄像机信息填入表单，请修改后点击底部"确定"按钮添加',
    duration: 3000
  });
}

/**
 * 确认添加摄像机
 */
function confirmAddCamera(camera) {
  // 如果没有选择，先选择
  if (selectedCamera.value?.address !== camera.address) {
    selectDiscoveredCamera(camera);
  }

  // 直接提交
  handleSubmit();
}

/**
 * 从高级搜索面板选择摄像机
 */
function handleCameraFromDiscovery(cameraData) {
  console.log('[AddSourceDialog] 从高级搜索面板选择摄像机:', cameraData);

  // 切换到手动输入模式，显示表单
  scanMode.value = 'manual_input';

  // 填充表单数据
  form.value.protocol = cameraData.protocol || 'rtsp';
  form.value.streamUrl = cameraData.streamUrl || `rtsp://${cameraData.address}:554/stream`;
  form.value.name = cameraData.name || `摄像机_${cameraData.address?.split('.').pop() || '未知'}`;

  // 如果需要认证
  if (cameraData.username) {
    form.value.needAuth = true;
    form.value.username = cameraData.username;
    form.value.password = cameraData.password || '';
  } else {
    form.value.needAuth = false;
  }

  ElMessage.success({
    message: '已从高级搜索面板加载摄像机信息，请确认后点击底部“确定”按钮添加',
    duration: 3000
  });

  // 滚动到表单区域
  setTimeout(() => {
    const formContainer = document.querySelector('.source-form-container');
    if (formContainer) {
      formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 100);
}

/**
 * 选择RTSP URL模板
 */
function selectRtspTemplate(brand) {
  // 尝试从现有 URL 中提取 IP 和端口，如果没有则使用默认值
  const ipMatch = form.value.streamUrl.match(/rtsp:\/\/([^:/]+)/)?.[1] || form.value.streamUrl.match(/\d+\.\d+\.\d+\.\d+/)?.[0];
  const ip = ipMatch || '192.168.1.100';

  // 尝试提取端口，默认为 554
  let port = '554';
  const portMatch = form.value.streamUrl.match(/:(\d+)\//);
  if (portMatch) {
    port = portMatch[1];
  } else if (form.value.streamUrl.includes(':')) {
     // 简单处理一些非标准情况，通常 rtsp://ip:port/path
     const parts = form.value.streamUrl.split(':')[2]; // split by : after rtsp://
     if (parts) {
         port = parts.split('/')[0];
     }
  }

  let urlTemplate;

  switch (brand) {
    case 'hikvision':
      urlTemplate = `rtsp://${ip}:${port}/h264/ch1/main/av_stream`;
      break;
    case 'dahua':
      urlTemplate = `rtsp://${ip}:${port}/cam/realmonitor?channel=1&subtype=0`;
      break;
    case 'axis':
      urlTemplate = `rtsp://${ip}:${port}/axis-media/media.amp`;
      break;
    case 'uniview':
      urlTemplate = `rtsp://${ip}:${port}/media/video1`;
      break;
    case 'generic':
      urlTemplate = `rtsp://${ip}:${port}/stream`;
      break;
    default:
      urlTemplate = `rtsp://${ip}:${port}/stream`;
  }

  form.value.streamUrl = urlTemplate;
  ElMessage.info(`已应用${getBrandName(brand)} RTSP格式`);
}

/**
 * 获取品牌名称
 */
function getBrandName(brand) {
  const brands = {
    'hikvision': '海康威视',
    'dahua': '大华',
    'axis': '安讯士',
    'uniview': '宇视',
    'generic': '通用格式'
  };
  return brands[brand] || brand;
}

/**
 * 复制ONVIF示例格式到剪贴板
 */
async function copyOnvifExample() {
  const exampleUrl = 'http://192.168.1.118:2000/onvif/device_service';
  try {
    await navigator.clipboard.writeText(exampleUrl);
    ElMessage.success('ONVIF示例格式已复制到剪贴板');
  } catch (error) {
    console.error('复制失败:', error);
    ElMessage.error('复制失败，请手动输入');
  }
}

/**
 * 设置ONVIF示例格式
 */
function setOnvifExample(type) {
  // 尝试从现有 URL 中提取 IP，如果没有则使用默认值
  const ipMatch = form.value.onvifUrl?.match(/https?:\/\/([^:/]+)/)?.[1] || '192.168.1.100';

  let urlTemplate;

  switch (type) {
    case 'default':
      urlTemplate = `http://${ipMatch}:2000/onvif/device_service`;
      break;
    case 'hikvision':
      urlTemplate = `http://${ipMatch}:80/onvif/device_service`;
      break;
    case 'dahua':
      urlTemplate = `http://${ipMatch}:80/onvif/device_service`;
      break;
    case 'axis':
      urlTemplate = `http://${ipMatch}/onvif/device_service`;
      break;
    default:
      urlTemplate = `http://${ipMatch}:2000/onvif/device_service`;
  }

  form.value.onvifUrl = urlTemplate;
  ElMessage.info(`已应用${getOnvifBrandName(type)} ONVIF格式`);
}

/**
 * 获取ONVIF品牌名称
 */
function getOnvifBrandName(type) {
  const brands = {
    'default': '默认',
    'hikvision': '海康威视',
    'dahua': '大华',
    'axis': '安讯士'
  };
  return brands[type] || type;
}

/**
 * 测试RTSP流连接
 */
async function testRtspStream() {
  if (!form.value.streamUrl) {
    ElMessage.warning('请先输入流媒体地址');
    return;
  }

  testingStream.value = true;

  try {
    // 验证URL格式
    const urlPattern = /^(rtsp|rtmp|hls|http|ws|srt):\/\/[^\s]+$/;
    if (!urlPattern.test(form.value.streamUrl)) {
      ElMessage.error('URL格式不正确，请检查');
      testingStream.value = false;
      return;
    }

    // 提示用户进行实际测试
    ElMessage.info({
      message: '请在VLC播放器中测试此URL：\n' + form.value.streamUrl + '\n\n如能正常播放，则配置正确',
      duration: 8000,
      showClose: true
    });

    // 复制到剪贴板方便用户测试
    try {
      await navigator.clipboard.writeText(form.value.streamUrl);
      ElMessage.success('RTSP地址已复制到剪贴板');
    } catch (e) {
      console.warn('复制失败:', e);
    }
  } catch (error) {
    ElMessage.error('测试失败: ' + error.message);
  } finally {
    testingStream.value = false;
  }
}

function resetForm() {
  form.value = {
    type: 'localDevice',
    // 通用字段
    name: '',
    deviceId: '',
    // 本地设备类别
    deviceCategory: 'camera',

    // 采集卡相关
    inputInterface: 'hdmi',
    cardResolution: 'auto',

    // 高拍仪相关
    scanMode: 'single',
    autoEnhance: false,
    autoCrop: false,

    // 网络摄像头/串流相关
    protocol: 'rtsp',
    streamUrl: '',
    cameraIp: '', // 摄像机IP地址（ONVIF专用）
    onvifUrl: '', // ONVIF设备服务地址
    onvifPort: 2000, // ONVIF端口，默认2000（不同品牌可能不同）
    needAuth: false,
    username: '',
    password: '',
    authToken: '',
    bufferTime: 1000,

    // MR摄像机相关
    mrType: 'hololens',
    connectionType: 'wifi',

    // 远程摄像头相关
    desktopId: '',
    cameraIndex: 0,

    // 移动设备相关
    mobileConnection: 'wifi',
    mobileIp: '',
    adbPort: '5555',
    cameraDirection: 'back',
    mobileResolution: '1920x1080',
    frameRate: 30,
    captureAudio: true,

    // 本地视频相关
    filePath: '',
    file: null,
    loop: false,
    autoPlay: true,
    muted: false,

    // 屏幕共享相关
    shareMode: 'screen',
    captureAudio: false,

    // 文档课件相关
    displayMode: 'slideshow',
    zoom: 100
  };
  formRef.value?.clearValidate();

  // 重置扫描模式
  scanMode.value = 'manual_input';
}

/**
 * 获取USB摄像头设备显示标签
 */
function getCameraDeviceLabel(device) {
  if (!device) return '';
  return device.label || device.deviceId || '未知设备';
}

/**
 * 获取采集卡设备显示标签
 */
function getCaptureDeviceLabel(device) {
  if (!device) return '';
  const interfaceInfo = device.interface_type ? ` (${device.interface_type})` : '';
  const resolutionInfo = device.resolution ? ` - ${device.resolution}` : '';
  return `${device.name}${interfaceInfo}${resolutionInfo}`;
}

/**
 * 获取高拍仪设备显示标签
 */
function getScannerDeviceLabel(device) {
  if (!device) return '';
  const interfaceInfo = device.interface_type ? ` (${device.interface_type})` : '';
  const resolutionInfo = device.resolution ? ` - ${device.resolution}` : '';
  return `${device.name}${interfaceInfo}${resolutionInfo}`;
}

/**
 * 采集卡设备选择变化处理
 */
function handleCaptureDeviceChange(deviceId) {
  const device = props.captureDevices.find(d => d.id === deviceId);
  if (device) {
    // 自动填充信号源名称
    if (!form.value.name) {
      form.value.name = device.name;
    }
    // 自动设置分辨率(如果设备提供)
    if (device.resolution && form.value.resolution === 'auto') {
      form.value.resolution = device.resolution;
    }
    console.log('[采集卡] 选择设备:', device);
  }
}

/**
 * 高拍仪设备选择变化处理
 */
function handleScannerDeviceChange(deviceId) {
  const device = props.scannerDevices.find(d => d.id === deviceId);
  if (device) {
    // 自动填充信号源名称
    if (!form.value.name) {
      form.value.name = device.name;
    }
    console.log('[高拍仪] 选择设备:', device);
  }
}

/**
 * 本地摄像头设备选择变化处理
 */
function handleCameraDeviceChange(deviceId) {
  const device = props.localDevices.find(d => d.deviceId === deviceId);
  if (device) {
    // 自动填充信号源名称
    if (!form.value.name) {
      form.value.name = device.label || `摄像头_${deviceId.slice(0, 8)}`;
    }
    console.log('[本地摄像头] 选择设备:', device);
  }
}

/**
 * 设备类别变化处理
 */
function handleDeviceCategoryChange() {
  // 切换设备类别时清空已选设备
  form.value.deviceId = '';
  form.value.name = '';
}

/**
 * 本地设备选择变化处理（统一处理摄像头、采集卡、高拍仪）
 */
function handleLocalDeviceChange(deviceId) {
  const category = form.value.deviceCategory;

  if (category === 'camera') {
    handleCameraDeviceChange(deviceId);
  } else if (category === 'captureCard') {
    handleCaptureDeviceChange(deviceId);
  } else if (category === 'scanner') {
    handleScannerDeviceChange(deviceId);
  }
}

/**
 * 自动检测手机IP地址
 */
async function autoDetectMobileIp() {
  detectingIp.value = true;
  try {
    // 尝试获取本机IP，然后推断手机可能的IP段
    const { invoke } = await import('@tauri-apps/api/core');
    const localIp = await invoke('get_local_ip');

    if (localIp) {
      // 提取网段，例如 192.168.1.x -> 192.168.1
      const ipParts = localIp.split('.');
      if (ipParts.length === 4) {
        const subnet = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;
        // 提示用户在该网段内查找
        ElMessage.info({
          message: `当前网络段: ${subnet}.x\n请在该网段内查找手机IP地址`,
          duration: 5000
        });
      }
    } else {
      ElMessage.warning('无法获取本机IP，请手动输入手机IP地址');
    }
  } catch (error) {
    console.error('[自动检测IP] 失败:', error);
    ElMessage.error('自动检测失败，请手动输入IP地址');
  } finally {
    detectingIp.value = false;
  }
}

/**
 * 生成连接二维码
 */
async function generateQRCode() {
  try {
    // 生成一个唯一的连接ID
    const connectionId = 'mobile_' + Date.now();

    // 构建连接信息
    const connectionInfo = {
      id: connectionId,
      type: 'mobile_screen',
      timestamp: Date.now(),
      serverUrl: window.location.origin
    };

    // 将连接信息转换为JSON字符串
    const jsonString = JSON.stringify(connectionInfo);

    // 使用第三方库生成二维码（这里使用简单的示例）
    // 在实际项目中，可以使用 qrcode.js 或其他二维码库
    const qrCodeApi = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(jsonString)}`;

    qrCodeUrl.value = qrCodeApi;

    ElMessage.success('二维码已生成，请使用手机App扫描');
  } catch (error) {
    console.error('[生成二维码] 失败:', error);
    ElMessage.error('生成二维码失败');
  }
}

/**
 * 🎯 ONVIF 自动获取 RTSP 流地址
 * 通过 ONVIF 协议从摄像机获取 RTSP 流地址
 */
async function fetchOnvifStreamUrl() {
  if (!form.value.cameraIp || !form.value.username || !form.value.password) {
    ElMessage.warning('请先填写摄像机IP、用户名和密码');
    return;
  }

  fetchingOnvifStream.value = true;

  try {
    const { invoke } = await import('@tauri-apps/api/core');

    // 解析 IP 和端口
    let ip = form.value.cameraIp;
    let port = parseInt(form.value.onvifPort, 10) || 80;

    // 如果 cameraIp 包含端口号，提取出来
    if (ip.includes(':')) {
      const parts = ip.split(':');
      ip = parts[0];
      port = parseInt(parts[1], 10) || port;
    }

    console.log('[ONVIF获取] 开始获取RTSP流地址...');
    console.log('[ONVIF获取] IP:', ip, '端口:', port);
    console.log('[ONVIF获取] 品牌:', form.value.brand);

    // 调用 Tauri API 获取 RTSP 流地址
    const result = await invoke('get_onvif_stream_uri', {
      onvifUrl: `http://${ip}:${port}/onvif/device_service`,
      username: form.value.username,
      password: form.value.password
    });

    if (result && result.rtspUrl) {
      // 成功获取到 RTSP 地址
      form.value.streamUrl = result.rtspUrl;
      console.log('[ONVIF获取] ✅ 成功获取RTSP地址:', result.rtspUrl);
      ElMessage.success(`成功获取RTSP地址！\n${result.rtspUrl}`);
    } else {
      // 获取失败，尝试备选方案
      console.warn('[ONVIF获取] ⚠️ ONVIF标准方法失败，尝试备选方案...');

      try {
        const fallbackResult = await invoke('try_common_rtsp_templates', {
          ip,
          port,
          username: form.value.username,
          password: form.value.password,
          brand: form.value.brand || null
        });

        if (fallbackResult) {
          form.value.streamUrl = fallbackResult;
          console.log('[ONVIF获取] ✅ 备选方案成功:', fallbackResult);
          ElMessage.success(`通过备选方案获取RTSP地址！\n${fallbackResult}`);
        } else {
          console.error('[ONVIF获取] ❌ 所有方法均失败');
          ElMessage.error({
            message: '无法获取RTSP流地址，请检查：\n1. 摄像机是否支持ONVIF协议\n2. 用户名密码是否正确\n3. 网络连接是否正常\n4. 或手动输入RTSP地址',
            duration: 5000
          });
        }
      } catch (fallbackErr) {
        console.error('[ONVIF获取] ❌ 备选方案也失败:', fallbackErr);
        ElMessage.error('获取RTSP地址失败，请手动输入');
      }
    }
  } catch (error) {
    console.error('[ONVIF获取] 错误:', error);
    ElMessage.error(`获取失败: ${error.message || error}`);
  } finally {
    fetchingOnvifStream.value = false;
  }
}

/**
 * 🎯 ONVIF 高级检测 - 检测所有服务路径并显示结果
 */
async function detectOnvifServices() {
  if (!form.value.cameraIp || !form.value.username || !form.value.password) {
    ElMessage.warning('请先填写摄像机IP、用户名和密码');
    return;
  }

  detectingOnvifServices.value = true;

  try {
    const { invoke } = await import('@tauri-apps/api/core');

    // 解析 IP 和端口
    let ip = form.value.cameraIp;
    let port = parseInt(form.value.onvifPort, 10) || 80;

    // 如果 cameraIp 包含端口号，提取出来
    if (ip.includes(':')) {
      const parts = ip.split(':');
      ip = parts[0];
      port = parseInt(parts[1], 10) || port;
    }

    console.log('[ONVIF检测] 开始检测ONVIF服务路径...');
    console.log('[ONVIF检测] IP:', ip, '端口:', port);

    // 调用 Tauri API 进行完整检测
    const result = await invoke('detect_onvif_services', {
      ip,
      port,
      username: form.value.username,
      password: form.value.password
    });

    console.log('[ONVIF检测] ✅ 检测完成:', result);

    // 保存检测结果
    onvifDetectionResult.value = result;
    showOnvifDetectionResult.value = true;

    // 如果有推荐的配置，自动应用
    if (result.recommended_config && result.recommended_config.confidence !== 'low') {
      ElMessage.success({
        message: `检测完成！找到 ${result.service_tests.filter(t => t.status === 'success').length} 个可用服务路径。置信度: ${result.recommended_config.confidence}`,
        duration: 3000
      });

      // 如果有RTSP流地址，自动填充
      if (result.rtsp_stream_url) {
        form.value.streamUrl = result.rtsp_stream_url;
        console.log('[ONVIF检测] 自动填充RTSP地址:', result.rtsp_stream_url);
      }
    } else {
      ElMessage.warning('检测完成，但未找到可靠的配置。请查看详细信息。');
    }
  } catch (error) {
    console.error('[ONVIF检测] 错误:', error);
    ElMessage.error(`检测失败: ${error.message || error}`);
  } finally {
    detectingOnvifServices.value = false;
  }
}

/**
 * 🎯 应用推荐的ONVIF配置
 */
function applyRecommendedConfig() {
  if (!onvifDetectionResult.value) {
    ElMessage.warning('没有可用的检测结果');
    return;
  }

  const result = onvifDetectionResult.value;

  // 应用RTSP流地址
  if (result.rtsp_stream_url) {
    form.value.streamUrl = result.rtsp_stream_url;
    console.log('[ONVIF检测] 已应用RTSP地址:', result.rtsp_stream_url);
  }

  // 关闭对话框
  showOnvifDetectionResult.value = false;

  ElMessage.success('已应用推荐配置！');
}

// ==================== Watch ====================

/**
 * 监听 ONVIF IP 地址和端口变化，自动构建 onvifUrl
 */
watch(
  [() => form.value.cameraIp, () => form.value.onvifPort],
  ([newIp, newPort]) => {
    // 只有当协议是 ONVIF 且用户手动输入了 IP 时才自动构建
    if (form.value.protocol === 'onvif' && newIp) {
      const oldUrl = form.value.onvifUrl;

      // 如果 onvifUrl 为空，或者包含旧的 IP 地址，则更新
      if (!oldUrl || !oldUrl.includes(newIp)) {
        form.value.onvifUrl = `http://${newIp}:${newPort}/onvif/device_service`;
        console.log('[AddSourceDialog] 自动更新 ONVIF URL:', form.value.onvifUrl);
      }
    }
  },
  { immediate: false }
);

</script>

<style scoped lang="scss">
@import '@/styles/variables.scss';

// 🎯 滚动条样式 mixin
@mixin custom-scrollbar {
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 3px;

    &:hover {
      background: #555;
    }
  }
}

// 🎯 全局弹窗样式控制
.add-source-dialog-wrapper {
  :deep(.el-dialog__body) {
    max-height: calc(100vh - 150px);
    overflow-y: auto;
    padding: 0;
    @include custom-scrollbar;
  }

  // 确保footer始终可见
  :deep(.el-dialog__footer) {
    position: sticky;
    bottom: 0;
    background: var(--el-bg-color);
    border-top: 1px solid var(--el-border-color-light);
    padding: 16px 20px;
    z-index: 10;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
  }
}

.add-source-dialog {
  padding: 20px;
}

.source-list-section {
  margin-bottom: 24px;

  .source-list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    h4 {
      margin: 0;
      font-size: $font-size-lg;
      color: $text-primary;
    }
  }

  .source-list-in-dialog {
    max-height: 250px;
    overflow-y: auto;
    padding-right: 8px;
    @include custom-scrollbar;

    .source-list-empty {
      padding: 40px 0;
      text-align: center;
    }

    .source-list {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .source-list-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        background: $bg-color-page;
        border-radius: $border-radius-base;
        border: 1px solid $border-color-light;
        transition: all $transition-base;

        &:hover {
          border-color: $primary-color;
          box-shadow: $box-shadow-sm;
        }

        .source-item-content {
          display: flex;
          align-items: center;
          gap: 16px;
          flex: 1;

          .source-item-info {
            display: flex;
            align-items: center;
            gap: 8px;

            .source-type-icon {
              font-size: $font-size-xl;
            }

            .source-name {
              font-weight: 500;
              color: $text-primary;
            }
          }

          .source-item-status {
            display: flex;
            align-items: center;
            gap: 6px;

            .status-dot {
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background: $text-secondary;

              &.online {
                background: $success-color;
                box-shadow: 0 0 8px rgba($success-color, 0.5);
              }
            }

            .status-text {
              font-size: $font-size-sm;
              color: $text-secondary;
            }
          }
        }

        .source-item-actions {
          display: flex;
          gap: 8px;
        }
      }
    }
  }
}

.add-source-section {
  h4 {
    margin: 0 0 16px 0;
    font-size: $font-size-lg;
    color: $text-primary;
  }

  .source-type-selector-grouped {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 20px;

    .source-type-group {
      .group-title {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
        font-size: $font-size-base;
        font-weight: 600;
        color: $text-primary;

        .group-icon-svg {
          width: 16px;
          height: 16px;
          color: $primary-color;
        }
      }

      .group-items {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
        gap: 8px;

        .source-type-option {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 8px 6px;
          border: 1px solid $border-color-base;
          border-radius: $border-radius-base;
          cursor: pointer;
          transition: all $transition-base;
          background: $bg-color;

          &:hover {
            border-color: $primary-color;
            transform: translateY(-1px);
            box-shadow: $box-shadow-sm;
          }

          &.active {
            border-color: $primary-color;
            background: rgba($primary-color, 0.05);

            .type-icon {
              color: $primary-color;
            }

            .type-label {
              color: $primary-color;
              font-weight: 500;
            }
          }

          .type-icon {
            font-size: 18px;
            margin-bottom: 4px;
            color: $text-secondary;
            transition: color $transition-base;
          }

          .type-label {
            font-size: 11px;
            color: $text-regular;
            text-align: center;
            line-height: 1.2;
            transition: color $transition-base;
          }
        }
      }
    }
  }

  .source-form-container {
    padding: 20px;
    background: $bg-color-page;
    border-radius: $border-radius-base;

    .empty-tip {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: rgba($warning-color, 0.1);
      border-left: 3px solid $warning-color;
      border-radius: $border-radius-sm;
      color: $text-secondary;
      font-size: $font-size-sm;
      margin-bottom: 16px;
    }

    // 设备选项样式
    :deep(.device-option) {
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: 100%;

      .device-name {
        font-size: $font-size-base;
        color: $text-primary;
        font-weight: 500;
      }

      .device-info {
        display: flex;
        align-items: center;
        gap: 8px;

        .device-resolution {
          font-size: $font-size-sm;
          color: $text-secondary;
        }
      }
    }

    .file-name {
      margin-left: 12px;
      color: $text-secondary;
      font-size: $font-size-sm;
    }

    // 跨网段扫描配置样式
    .cross-subnet-config {
      margin-top: 16px;
      padding: 16px;
      background: rgba($primary-color, 0.03);
      border-radius: $border-radius-base;
      border: 1px dashed $border-color-light;

      :deep(.el-alert) {
        margin-bottom: 16px;
      }

      :deep(.el-textarea__inner) {
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: $font-size-sm;
      }
    }

    // 摄像机扫描区域样式
    .camera-scan-section {
      margin-bottom: 16px;

      .scan-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;

        .scan-label {
          font-weight: 500;
          color: $text-primary;
        }
      }

      .discovered-cameras-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 200px;
        overflow-y: auto;
        @include custom-scrollbar;
      }

      .discovered-camera-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        background: $bg-color-page;
        border: 1px solid $border-color-light;
        border-radius: $border-radius-base;
        cursor: pointer;
        transition: all $transition-base;

        &:hover {
          border-color: $primary-color;
          background: rgba($primary-color, 0.03);
        }

        &.selected {
          border-color: $primary-color;
          background: rgba($primary-color, 0.05);
        }

        .camera-info {
          display: flex;
          align-items: center;
          gap: 12px;

          .camera-icon {
            width: 24px;
            height: 24px;
            color: $primary-color;
          }

          .camera-details {
            display: flex;
            flex-direction: column;
            gap: 2px;

            .camera-name {
              font-weight: 500;
              color: $text-primary;
            }

            .camera-ip {
              font-size: $font-size-sm;
              color: $text-secondary;
            }

            .camera-port {
              font-size: $font-size-sm;
              color: $text-secondary;
            }
          }
        }

        .camera-actions {
          display: flex;
          gap: 6px;
        }
      }

      .empty-scan {
        padding: 20px;
        text-align: center;
      }

      .scan-error {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px;
        background: rgba($danger-color, 0.1);
        border-radius: $border-radius-sm;
        color: $danger-color;
        font-size: $font-size-sm;
        margin-top: 8px;
      }
    }

    .rtsp-url-templates {
      margin-top: 8px;

      .template-label {
        font-size: 12px;
        color: $text-secondary;
        margin-bottom: 4px;
      }

      :deep(.el-button-group) {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;

        .el-button {
          flex: 0 0 auto;
        }
      }
    }

    .onvif-examples {
      margin-top: 8px;

      .example-label {
        font-size: 12px;
        color: $text-secondary;
        margin-bottom: 4px;
      }

      :deep(.el-button-group) {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;

        .el-button {
          flex: 0 0 auto;
        }
      }
    }
  }
}

// 高级搜索内嵌容器样式
.advanced-search-container {
  height: 450px;
  margin-bottom: 16px;
  border: 1px solid $border-color-light;
  border-radius: $border-radius-base;
  overflow: hidden;

  :deep(.camera-discovery-panel) {
    height: 100%;

    .main-container {
      height: 100%;
    }
  }
}

// 🎯 ONVIF 检测结果对话框样式
.onvif-detection-result {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
  }

  code {
    font-family: 'Courier New', monospace;
    font-size: 12px;
    background: #f5f5f5;
    padding: 2px 6px;
    border-radius: 3px;
    color: #e96900;
  }

  .test-summary {
    display: flex;
    gap: 8px;
  }

  .profile-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  :deep(.el-descriptions__label) {
    font-weight: 600;
    width: 120px;
  }

  :deep(.el-table) {
    font-size: 13px;

    .el-table__cell {
      padding: 8px 0;
    }
  }
}

// 移除旧的对话框样式
</style>
