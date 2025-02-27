<template>
  <div class="app-container">
    <div class="titlebar">
      <!-- <div class="titlebar-drag" v-if="false">Typist</div>
      <div class="window-controls" v-if="false">
        <button class="control-button minimize" @click="minimizeWindow">
          <i class="fas fa-minus"></i>
        </button>
        <button class="control-button maximize" @click="maximizeWindow">
          <i class="fas fa-expand"></i>
        </button>
        <button class="control-button close" @click="closeWindow">
          <i class="fas fa-times"></i>
        </button>
      </div> -->
      <div class="titlebar-drag"></div>
      <div class="menu-icon">
        <i class="fas fa-cog"></i>
      </div>
    </div>
    <router-view></router-view>
  </div>
</template>

<script setup lang="ts">
const minimizeWindow = () => {
  window.electronAPI.minimizeWindow()
}

const maximizeWindow = () => {
  window.electronAPI.maximizeWindow()
}

const closeWindow = () => {
  window.electronAPI.closeWindow()
}
</script>

<style lang="scss">

.app-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: radial-gradient(100% 80% at 70% 43%, rgba(138, 5, 147, 0.8) 0%, rgba(138, 5, 147, 0) 100%), linear-gradient(239deg, #340263 2%, #15003D 100%);
}

.titlebar {
  height: 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  -webkit-app-region: drag;
  user-select: none;
}

.titlebar-drag {
  color: #eee;
  font-size: 12px;
  padding-right: 12px;
}


.menu-icon {
  color: #ddd;
  font-size: 12px;
  padding-right: 12px;
}

.window-controls {
  display: flex;
  -webkit-app-region: no-drag;
}

.control-button {
  width: 46px;
  height: 32px;
  border: none;
  background: transparent;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s;
}

.control-button:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.control-button.close:hover {
  background-color: #e81123;
}

.control-button i {
  font-size: 12px;
}

nav {
  padding: 20px 0;
  
  a {
    font-weight: bold;
    color: #2c3e50;
    text-decoration: none;
    margin: 0 10px;

    &.router-link-active {
      color: #42b983;
    }
  }
}

/* 确保路由视图占满剩余空间 */
router-view {
  flex: 1;
  overflow: auto;
}

/* 全局样式 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow: hidden;
}

/* Font Awesome */
@import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css');
</style>
