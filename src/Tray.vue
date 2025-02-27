<template>
  <div class="tray-page-wrapper">
    <ImportWord v-slot="{ handleImport, result, handleReset }" class="tray-container">
      <button v-if="result" class="tray-button" @click="() => handleReset()">继续导入</button>
      <button v-else class="tray-button" @click="() => handleImport()">导入生词</button>
    </ImportWord>
  </div>
</template>

<script setup lang="ts">
import ImportWord from './components/ImportWord.vue';
</script>

<style lang="scss">
.tray-page-wrapper {
  box-sizing: border-box;
  width: 100vw;
  height: 100vh;
}

.tray-container {
  box-sizing: border-box;
  padding: 12px 0;
  background-color: #ECECEC;
  display: flex;
  flex-direction: column;
  box-shadow: 0 0 12px rgba(0,0,0,0.3);
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
}

.tray-button:active {
  background: linear-gradient(to bottom, #F3F3F3 0%, #EBEBEB 100%);
  border-color: rgba(0, 0, 0, 0.15);
}

.tray-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>