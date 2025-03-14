<template>
  <div class="import-container">
    <div class="import-main">
      <div v-if="result" class="result-wrapper">
        <ul>
          <li class="is-new" v-for="(word, index) in result.newWords" :key="index">{{ word.word }} {{ word.code }}</li>
          <li class="is-duplicate" v-for="(word, index) in result.duplicateWords" :key="index">{{ word.word }} {{ word.code }}</li>
        </ul>
      </div>
      <textarea
        v-else
        v-model="text"
        placeholder="请输入要导入的文本"
        class="input-area"
      ></textarea>
    </div>
    <div class="button-wrapper">
      <slot name="default" :handleImport="handleImport" :result="result" :handleReset="handleReset"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeMount } from 'vue'
import { useCommonStore } from '@/stores/common'
import { segmentText } from '@/utils/trie'
import type { Word, ImportResult } from '@/stores/common'

const commonStore = useCommonStore()
const { readData, importWords, exportWords } = window.electronAPI

const text = ref('')
const result = ref<ImportResult | null>()

async function handleImport() {
  try {

    if (!text.value.trim()) {
      return
    }

    const dicts = commonStore.dicts
    const trie = commonStore.trie

    const wordArray = segmentText(text.value.replace(/[^\u4E00-\u9FA5]/g, ''), trie)
    
    // 只保留有编码的词
    const newWords: Word[] = wordArray.map(word => ({
      word,
      code: dicts[word] || ''
    })).filter(word => word.code)

    console.log('dicts', dicts.value)
    console.log(wordArray, newWords)

    if (newWords.length === 0) {
      result.value = {
        count: 0,
        newWords: [],
        duplicateWords: []
      }
      return
    }

    // 先读取现有的单词
    const existingWords = await readData('words')
      
    // 创建一个Set来存储现有的单词
    const existingWordSet = new Set(existingWords.map(w => w.word))
    
    // 过滤出不存在的新词
    const wordsToAdd = newWords.filter(word => 
      word.code && !existingWordSet.has(word.word)
    )
    
    // 过滤出已存在的词
    const wordsToDuplicate = newWords.filter(word => 
      word.code && existingWordSet.has(word.word)
    )
    
    if (wordsToAdd.length === 0) {
      return {
        count: wordsToAdd.length,
        newWords: wordsToAdd,
        duplicateWords: wordsToDuplicate
      }
    }

    await importWords(newWords)

    result.value = {
      count: wordsToAdd.length,
      newWords: wordsToAdd,
      duplicateWords: wordsToDuplicate
    }
  } catch (error) {
    console.error('Import error:', error)
  }
}

const handleReset = () => {
  text.value = ''
  result.value = null
}

onBeforeMount(() => {
  commonStore.loadDicts()
})
</script>

<style lang="scss" scoped>
.import-container {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0; /* 重要：防止 flex 容器溢出 */
}

.import-main {
  flex: 1 1 auto;
  background-color: #ffffff;
  min-height: 0; /* 重要：防止 flex 容器溢出 */
  display: flex;
  flex-direction: column;
}

.input-area {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 12px;
  background-color: transparent;
  border: none;
  resize: none;
  font-size: 14px;
  line-height: 1.4;
  color: #000000;
}

.input-area:focus {
  outline: none;
}

.result-wrapper {
  flex: 1 1 auto;
  min-height: 0; /* 重要：防止 flex 容器溢出 */
  padding: 16px;
  overflow-y: auto;
  font-size: 14px;
  line-height: 1.6;

  ul {
    margin: 0;
    padding: 0;
    list-style: none;

    li {
      margin: 4px 0;
      padding: 6px 12px;
      border-radius: 4px;
      font-family: monospace;

      &.is-new {
        background-color: #EBF7F3;
        color: #0BA888;
      }

      &.is-duplicate {
        background-color: #FFF7EF;
        color: #BC8540;
      }

    }
  }
}

.button-wrapper {
  flex: 0 0 auto;
  padding: 12px 0 0 0;
  display: flex;
  justify-content: center;

  button + button {
    margin-left: 12px;
  }
}
</style>