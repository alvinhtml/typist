<template>
  <div class="app-container">
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
// rgba(90, 143, 249, 1)
// rgba(63, 213, 252, 1)

.app-container {
  position: relative;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: rgba(90, 143, 249, 0.8);

  &::before {
    content: '';
    position: absolute;
    top: -20%;
    left: -10%;
    width: 120%;
    height: 120%;
    background-image: radial-gradient(88% 88% at 0% 18%, rgba(63, 213, 252, 0.6) 0%, rgba(63, 213, 252, 0) 100%);
    background-repeat: no-repeat;
    background-size: 100% 100%;
    animation: gradient 6s ease infinite;
    filter: blur(20px);
  }
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

@keyframes gradient {
  0% {
    top: -20%;
    left: -10%;
  }
  50% {
    top: -5%;
    left: -5%;
  }
  100% {
    top: -20%;
    left: -10%;
  }
}



/* Font Awesome */
@import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css');
</style>
