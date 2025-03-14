<template>
  <div class="tray-page-wrapper">
    <div class="tray-header">
      <b>导入生词</b>
      <div class="tray-menu">
        <div  @click="toggleMenu">
          <svg class="svg-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M512 661.994667q61.994667 0 106.005333-44.010667t44.010667-106.005333-44.010667-106.005333-106.005333-44.010667-106.005333 44.010667-44.010667 106.005333 44.010667 106.005333 106.005333 44.010667zM829.994667 554.005333l90.005333 69.994667q13.994667 10.005333 4.010667 28.010667l-85.994667 148.010667q-8 13.994667-26.005333 8l-106.005333-42.005333q-42.005333 29.994667-72 42.005333l-16 112q-4.010667 18.005333-20.010667 18.005333l-172.010667 0q-16 0-20.010667-18.005333l-16-112q-37.994667-16-72-42.005333l-106.005333 42.005333q-18.005333 5.994667-26.005333-8l-85.994667-148.010667q-10.005333-18.005333 4.010667-28.010667l90.005333-69.994667q-2.005333-13.994667-2.005333-42.005333t2.005333-42.005333l-90.005333-69.994667q-13.994667-10.005333-4.010667-28.010667l85.994667-148.010667q8-13.994667 26.005333-8l106.005333 42.005333q42.005333-29.994667 72-42.005333l16-112q4.010667-18.005333 20.010667-18.005333l172.010667 0q16 0 20.010667 18.005333l16 112q37.994667 16 72 42.005333l106.005333-42.005333q18.005333-5.994667 26.005333 8l85.994667 148.010667q10.005333 18.005333-4.010667 28.010667l-90.005333 69.994667q2.005333 13.994667 2.005333 42.005333t-2.005333 42.005333z"></path></svg>
        </div>
        <div class="menu-dropdown" v-if="showMenu">
          <div class="menu-item" @click="handleOpen">
            <span>打开主窗口</span>
          </div>
          <div class="menu-separator"></div>
          <div class="menu-item" @click="handleQuit">
            <span>退出</span>
          </div>
        </div>
      </div>
    </div>
    <ImportWord v-slot="{ handleImport, result, handleReset }" class="tray-container">
      <button v-if="result" class="tray-button" @click="() => handleReset()">继续导入</button>
      <button v-else class="tray-button" @click="() => handleImport()">导入生词</button>
    </ImportWord>
  </div>
</template>

<script setup lang="ts">
import ImportWord from './components/ImportWord.vue'
import { ref, onMounted, onUnmounted } from 'vue'

const { openMainWindow, quitApp} = window.electronAPI

const showMenu = ref(false)

const toggleMenu = (e: MouseEvent) => {
  e.stopPropagation()
  showMenu.value = !showMenu.value
}

const handleOpen = async () => {
  await openMainWindow()
  showMenu.value = false
}

const handleQuit = async () => {
  await quitApp()
}

// 点击其他地方关闭菜单
const closeMenu = () => {
  showMenu.value = false
}

onMounted(() => {
  document.addEventListener('click', closeMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', closeMenu)
})
</script>

<style lang="scss" scoped>
.tray-page-wrapper {
  box-sizing: border-box;
  width: 100vw;
  height: 100vh;
  padding: 12px 0;
  background-color: #ECECEC;
  box-shadow: 0 0 12px rgba(0,0,0,0.3);
  display: flex;
  flex-direction: column;
}

.tray-header {
  flex: 0 0 28px;
  padding: 0 12px 12px 12px;
  height: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;

  b {
    font-size: 12px;
    color: #666;
  }
}

.tray-menu {
  cursor: pointer;
  position: relative;

  .svg-icon {
    width: 16px;
    height: 16px;
    fill: #666;
  }
}

.menu-dropdown {
  position: absolute;
  top: 20px;
  right: 0;
  background: white;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  min-width: 120px;
  z-index: 1000;
}

.menu-item {
  padding: 8px 12px;
  font-size: 12px;
  color: #333;
  cursor: pointer;

  &:hover {
    background-color: #f5f5f5;
  }
}

.menu-separator {
  height: 1px;
  background-color: #e8e8e8;
  margin: 4px 0;
}

.tray-container {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.tray-button {
  padding: 3px 12px;
  font-size: 13px;
  color: #000000;
  background: linear-gradient(to bottom, #FFFFFF 0%, #F9F9F9 100%);
  border: 0.5px solid rgba(0, 0, 0, 0.1);
  border-radius: 5px;
  cursor: pointer;
  box-shadow: 0 1px 1px rgba(0,0,0,0.05);
  transition: all 0.3s;

  &:hover {
    background: #f5f5f5;
  }
}
</style>