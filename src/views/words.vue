<template>
  <Header>
    <div class="text">生词本</div>
  </Header>
  <div class="main-container">
    <div class="word-table-area">
      <div class="word-table-toolbar">
        <div class="toolbar-left">
          <button class="button is-danger is-small" @click="handleBatchDelete">批量删除</button>
        </div>
        <div class="toolbar-right">
          <RouterLink to="/import" class="button is-blue is-small">导入生词</RouterLink>
          <button class="button is-blue is-small" @click="handleExport">导出生词</button>
        </div>
      </div>
      <div class="word-table-wrapper">
        <table class="word-table">
        <thead>
          <tr>
            <th><input type="checkbox" @change="toggleSelectAll"></th>
            <th>生词</th>
            <th>编码</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="word in words" :key="word.word">
            <td><input type="checkbox" v-model="selectedWords" :value="word"></td>
            <td>{{ word.word }}</td>
            <td>{{ word.code }}</td>
            <td>
              <button @click="handleDelete(word)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
      </div> 
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, shallowRef, ref } from 'vue'
import type { Word } from '@/stores/common'

import Header from '@/components/Header.vue'

const { readData } = window.electronAPI

const words = shallowRef<Word[]>([])
const selectedWords = ref<Word[]>([])

onMounted(async () => {
  try {
    words.value = await readData('words')
  } catch (error) {
    console.error('Failed to load lesson:', error)
  }
})

function toggleSelectAll(event: Event) {
  const isChecked = (event.target as HTMLInputElement).checked;
  selectedWords.value = isChecked ? [...words.value] : [];
}

function handleDelete(word: Word) {
  // Implement delete logic
  console.log('Deleting word:', word);
}

function handleBatchDelete() {
  // Implement batch delete logic
  console.log('Batch deleting words:', selectedWords.value);
}

function handleExport() {
  window.electronAPI.exportWords()
}
</script>

<style lang="scss">
.word-table-area {
  background-color: #f5f7fa;
  padding: 20px;
  border-radius: 12px;
  flex: 0 1 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;

  .word-table-toolbar {
    flex: 0 0 24px;
    display: flex;
    justify-content: space-between;

    .toolbar-right {
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }

    .button + .button {
      margin-left: 12px;
    }
  }
}

.word-table-wrapper {
  flex: 1 1 auto;
  overflow-y: auto;
}

.word-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 16px;
}

.word-table th, .word-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

.word-table th {
  background-color: #e9ecef;
}

.batch-actions {
  display: flex;
  gap: 8px;
}

.batch-actions button {
  padding: 8px 16px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.batch-actions button:hover {
  background-color: #0056b3;
}
</style>
