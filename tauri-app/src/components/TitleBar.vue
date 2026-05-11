<template>
  <div class="title-bar">
    <div class="title">实训教学实践系统 - 教师端</div>
    <div class="toolbar-container">
      <slot name="toolbar"></slot>
    </div>
    <div class="window-controls">
      <button class="control-btn" @click="minimize">
        <span>－</span>
      </button>
      <button class="control-btn" @click="maximize">
        <span>□</span>
      </button>
      <button class="control-btn close" @click="close">
        <span>×</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { minimizeWindow, maximizeWindow, closeApp } from '../utils/tauri-api.js';

const minimize = () => {
  minimizeWindow();
};

const maximize = () => {
  maximizeWindow();
};

const close = () => {
  closeApp();
};
</script>

<style lang="scss" scoped>
.title-bar {
  height: 50px;
  background: #0A1525;
  display: flex;
  align-items: center;
  justify-content: space-between;
  -webkit-app-region: drag;
  padding: 0 15px;
}

.title {
  font-size: 16px;
  font-weight: bold;
  color: #FFFFFF;
  flex-shrink: 0;
}

.toolbar-container {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0 15px;
  -webkit-app-region: no-drag;
  overflow: visible;
  min-width: 0;
}

.window-controls {
  display: flex;
  -webkit-app-region: no-drag;
  flex-shrink: 0;
}

.control-btn {
  width: 50px;
  height: 50px;
  border: none;
  background: transparent;
  color: #FFFFFF;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #1A2A3A;
    color: #00BFFF;
  }

  &.close:hover {
    background: #FF4500;
    color: #FFFFFF;
  }
}
</style>
