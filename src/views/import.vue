<template>
  <Header>
    <div class="text">导入生词</div>
  </Header>
  <div class="main-container">
    <ImportWord v-slot="{ handleImport, result, handleReset }" class="import-area">
      <button v-if="result" class="button is-orange" @click="() => handleReset()">继续导入</button>
      <button v-else class="button is-blue" @click="() => handleImport()">导入生词</button>
    </ImportWord>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, shallowRef, ref } from 'vue'
import type { Word } from '@/stores/common'

import Header from '@/components/Header.vue'
import ImportWord from '@/components/ImportWord.vue'
</script>

<style lang="scss">
.import-area {
  flex: 1 1 auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  .import-main {
    border-radius: 12px;
    padding: 24px;
    background-color: #f5f7fa;
  }

  .button-wrapper {
    flex: 0 0 20px;
    text-align: center;
  }

  .result-wrapper {
    font-size: 18px;
  }
}
</style>
