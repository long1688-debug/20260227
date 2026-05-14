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
                <el-button type="warning" size="small" @click="handleRenameSource(source)">
                  <el-icon><Edit /></el-icon>
                </el-button>
                <el-button type="danger" size="small" @click="handleDeleteSource(source.id)">
                  <el-icon><Delete /></el-icon>
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
              <!-- 扫描模式选择器 -->
              <div class="scan-mode-selector">
                <el-radio-group v-model="scanMode" size="small">
                  <el-radio-button value="auto_scan">🔍 自动扫描</el-radio-button>
                  <el-radio-button value="all_interfaces">🌐 多网卡扫描</el-radio-button>
                  <el-radio-button value="manual_input">✏️ 手动输入</el-radio-button>
                </el-radio-group>
              </div>

              <!-- 自动扫描模式 -->
              <template v-if="scanMode === 'auto_scan'">
                <div class="camera-scan-section">
                  <el-form-item>
                    <div class="scan-header">
                      <span class="scan-label">🔍 自动扫描局域网</span>
                      <el-button
                        type="primary"
                        size="small"
                        :loading="isScanning"
                        @click="handleScanCameras"
                      >
                        <el-icon><Search /></el-icon> {{ isScanning ? '扫描中...' : '开始扫描' }}
                      </el-button>
                    </div>

                    <!-- 扫描结果列表 -->
                    <div v-if="discoveredCameras.length > 0" class="discovered-cameras-list">
                      <div
                        v-for="camera in discoveredCameras"
                        :key="camera.address"
                        class="discovered-camera-item"
                        :class="{ selected: selectedCamera?.address === camera.address }"
                        @click="selectDiscoveredCamera(camera)"
                      >
                        <div class="camera-info">
                          <el-icon class="camera-icon"><VideoCamera /></el-icon>
                          <div class="camera-details">
                            <span class="camera-name">{{ camera.name || '未知设备' }}</span>
                            <span class="camera-ip">{{ camera.address }}</span>
                            <span v-if="camera.port" class="camera-port">端口: {{ camera.port }}</span>
                          </div>
                        </div>
                        <div class="camera-actions">
                          <el-button size="small" @click.stop="editDiscoveredCamera(camera)">编辑</el-button>
                          <el-button type="primary" size="small" @click.stop="confirmAddCamera(camera)">添加</el-button>
                        </div>
                      </div>
                    </div>
                    <div v-else-if="!isScanning" class="empty-scan">
                      <el-empty description="点击上方按钮扫描摄像机" :image-size="40" />
                      <p class="empty-hint">将扫描 ONVIF 设备和常见端口</p>
                    </div>
                    <div v-if="scanError" class="scan-error">
                      <el-icon color="#ef4444"><Warning /></el-icon>
                      <span>{{ scanError }}</span>
                    </div>
                  </el-form-item>
                </div>
              </template>

              <!-- 多网卡扫描模式 -->
              <template v-else-if="scanMode === 'all_interfaces'">
                <div class="camera-scan-section">
                  <el-form-item>
                    <div class="scan-header">
                      <span class="scan-label">🌐 多网卡扫描（推荐）</span>
                      <el-button
                        type="primary"
                        size="small"
                        :loading="isScanning"
                        @click="handleScanCameras"
                      >
                        <el-icon><Search /></el-icon> {{ isScanning ? '扫描中...' : '开始扫描' }}
                      </el-button>
                    </div>

                    <div class="scan-mode-info">
                      <el-icon><InfoFilled /></el-icon>
                      <span>将扫描所有网络接口，发现不同网段的摄像机设备</span>
                    </div>

                    <!-- 扫描结果列表 -->
                    <div v-if="discoveredCameras.length > 0" class="discovered-cameras-list">
                      <div
                        v-for="camera in discoveredCameras"
                        :key="camera.address"
                        class="discovered-camera-item"
                        :class="{ selected: selectedCamera?.address === camera.address }"
                        @click="selectDiscoveredCamera(camera)"
                      >
                        <div class="camera-info">
                          <el-icon class="camera-icon"><VideoCamera /></el-icon>
                          <div class="camera-details">
                            <span class="camera-name">{{ camera.name || '未知设备' }}</span>
                            <span class="camera-ip">{{ camera.address }}</span>
                            <span v-if="camera.port" class="camera-port">端口: {{ camera.port }}</span>
                          </div>
                        </div>
                        <div class="camera-actions">
                          <el-button size="small" @click.stop="editDiscoveredCamera(camera)">编辑</el-button>
                          <el-button type="primary" size="small" @click.stop="confirmAddCamera(camera)">添加</el-button>
                        </div>
                      </div>
                    </div>
                    <div v-else-if="!isScanning" class="empty-scan">
                      <el-empty description="点击上方按钮扫描所有网卡" :image-size="40" />
                      <p class="empty-hint">支持跨网段发现摄像机</p>
                    </div>
                    <div v-if="scanError" class="scan-error">
                      <el-icon color="#ef4444"><Warning /></el-icon>
                      <span>{{ scanError }}</span>
                    </div>
                  </el-form-item>
                </div>
              </template>

              <!-- 手动输入模式 -->
              <template v-else-if="scanMode === 'manual_input'">
                <div class="manual-input-notice">
                  <el-icon><InfoFilled /></el-icon>
                  <span>手动输入模式：请直接填写下方摄像机信息</span>
                </div>
              </template>

              <el-divider />

              <!-- 手动输入区域（所有模式都显示） -->
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
              <el-form-item v-if="form.protocol === 'onvif'" label="ONVIF服务地址" prop="onvifUrl">
                <el-input
                  v-model="form.onvifUrl"
                  placeholder="例如：http://192.168.1.118:2000/onvif/device_service"
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
import { Refresh, VideoPlay, VideoPause, Edit, Delete, Warning, VideoCamera, Search, InfoFilled, DocumentCopy } from '@element-plus/icons-vue';
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
const scanMode = ref('manual_input'); // 扫描模式：auto_scan | all_interfaces | manual_input
const testingStream = ref(false); // RTSP流测试状态

const form = ref({
  type: 'localDevice',
  // 通用字段
  name: '',
  deviceId: '',
  // 本地设备类别
  deviceCategory: 'camera',

  // 采集卡相关
  inputInterface: 'hdmi',
  resolution: 'auto',

  // 高拍仪相关
  scanMode: 'single',
  autoEnhance: false,
  autoCrop: false,

  // 网络摄像头/串流相关
  protocol: 'rtsp',
  streamUrl: '',
  onvifUrl: '', // ONVIF设备服务地址
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

function handleDeleteSource(sourceId) {
  emit('delete-source', sourceId);
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
    try {
      localIp = await invoke('get_local_ip');
      console.log('[摄像机扫描] 本地IP:', localIp);
    } catch (e) {
      console.warn('[摄像机扫描] 无法获取本地IP:', e);
    }

    // 尝试多种扫描方式
    let found = [];
    const scanMethods = [
      { name: 'ONVIF发现', method: 'onvif_discover_devices', timeout: 5 },
      { name: '子网扫描', method: 'scan_local_subnet', timeout: 5 },
      { name: '综合发现', method: 'discover_all_cameras', timeout: 5 }
    ];

    for (const method of scanMethods) {
      console.log(`[摄像机扫描] 尝试 ${method.name}...`);
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
          suggestions.push(`• 当前网络段: ${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.x`);
        }
      }

      suggestions.push('• 确认摄像机已通电并连接到同一网络');
      suggestions.push('• 检查摄像机是否启用了ONVIF或RTSP服务');
      suggestions.push('• 尝试手动输入摄像机IP地址');
      suggestions.push('• 检查Windows防火墙是否阻止了UDP多播');

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
  // 自动填充表单
  form.value.protocol = 'rtsp';
  form.value.name = camera.name || `摄像机_${camera.address.split('.').pop()}`;

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

  if (camera.username) {
    form.value.needAuth = true;
    form.value.username = camera.username;
    form.value.password = camera.password || 'admin';
  } else {
    form.value.needAuth = false;
  }

  // 提示用户检查URL格式
  ElMessage.warning({
    message: '已自动填写 RTSP 地址模板，请根据实际摄像机型号修改路径后缀',
    duration: 5000
  });
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
    resolution: 'auto',

    // 高拍仪相关
    scanMode: 'single',
    autoEnhance: false,
    autoCrop: false,

    // 网络摄像头/串流相关
    protocol: 'rtsp',
    streamUrl: '',
    onvifUrl: '', // ONVIF设备服务地址
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
</style>
