<template>
  <div class="teacher-dashboard">
    <!-- 主视频区域 -->
    <div class="main-video-container">
      <!-- 视频预览区域 -->
      <div class="video-preview">
        <!-- ... existing code ... -->
      </div>
    </div>

    <!-- 控制面板 -->
    <div class="control-panel">
      <!-- ... existing code ... -->

      <!-- 画中画布局 -->
      <div class="picture-in-picture-layout">
        <h4>画中画布局</h4>
        <div class="layout-options">
          <!-- 保留左上小窗 -->
          <button
            class="layout-btn"
            :class="{ active: selectedLayout === 'top-left' }"
            @click="selectLayout('top-left')"
          >
            <div class="layout-icon">
              <div class="large"></div>
              <div class="small" style="top: 0; left: 0;"></div>
            </div>
            左上小窗
          </button>

          <!-- 保留右上小窗 -->
          <button
            class="layout-btn"
            :class="{ active: selectedLayout === 'top-right' }"
            @click="selectLayout('top-right')"
          >
            <div class="layout-icon">
              <div class="large"></div>
              <div class="small" style="top: 0; right: 0;"></div>
            </div>
            右上小窗
          </button>

          <!-- 删除左下小窗和右下小窗 -->
          <!-- 删除: -->
          <!-- <button
            class="layout-btn"
            :class="{ active: selectedLayout === 'bottom-left' }"
            @click="selectLayout('bottom-left')"
          >
            <div class="layout-icon">
              <div class="large"></div>
              <div class="small" style="bottom: 0; left: 0;"></div>
            </div>
            左下小窗
          </button> -->

          <!-- 删除: -->
          <!-- <button
            class="layout-btn"
            :class="{ active: selectedLayout === 'bottom-right' }"
            @click="selectLayout('bottom-right')"
          >
            <div class="layout-icon">
              <div class="large"></div>
              <div class="small" style="bottom: 0; right: 0;"></div>
            </div>
            右下小窗
          </button> -->
        </div>
      </div>

      <!-- 其他控制项 -->
      <div class="special-layouts">
        <!-- ... existing code ... -->
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      selectedLayout: 'top-left', // 默认选择左上小窗
    };
  },
  methods: {
    selectLayout(layout) {
      this.selectedLayout = layout;
      // 触发布局切换事件
      this.$emit('layout-change', layout);
    },
  },
};
</script>

<style scoped>
.picture-in-picture-layout {
  margin-top: 20px;
}

.layout-options {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.layout-btn {
  padding: 10px;
  border: 1px solid #333;
  background-color: #1a1a1a;
  color: #fff;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 80px;
  text-align: center;
}

.layout-btn:hover {
  background-color: #2a2a2a;
}

.layout-btn.active {
  background-color: #007bff;
  border-color: #007bff;
}

.layout-icon {
  width: 60px;
  height: 40px;
  position: relative;
  margin: 5px auto;
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid #555;
}

.large {
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.1);
}

.small {
  width: 30px;
  height: 20px;
  background-color: #007bff;
  position: absolute;
  border: 1px solid #007bff;
}
</style>

