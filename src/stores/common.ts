import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref, shallowRef } from 'vue'
import { Trie } from '../utils/trie'

export interface ImportResult {
  count: number
  newWords: Word[]
  duplicateWords: Word[]
}

export interface Dict {
  [key: string]: string
}

export interface Word {
  word: string
  code: string
}

export const useCommonStore = defineStore('common', () => {
  
  const { readData, importWords } = window.electronAPI
  
  const lessons = {
    level1: '一级简码',
    level2: '二级简码',
    level3: '三级简码',
    level4: '四级简码',
    level5: '词组练习',
    words: '生词练习',
  }

  const dicts = shallowRef<Dict>({})
  const trie = shallowRef<Trie>(new Trie())


  async function loadDicts() {
    const files = Object.keys(lessons).filter(file => file !== 'words')

    let dict: Dict = {}

    try {
      const values = await Promise.all(files.map(file => readData(file)))

      values.forEach(words => {
        words.forEach(word => {
          dict[word.word] = word.code
        })
      })

      dicts.value = dict
      
      // 初始化新的 Trie 并插入所有词
      const newTrie = new Trie()
      Object.keys(dict).forEach(word => {
        newTrie.insert(word)
      })
      trie.value = newTrie
      
      console.log('Dicts and trie updated:', {
        dictsSize: Object.keys(dicts.value).length,
        trieSize: Object.keys(dict).length
      })
      return dict
    } catch (error) {
      console.error('Failed to load dicts:', error)
      throw error
    }
  } 

  return {
    lessons,
    loadDicts,
    dicts,
    trie,
    importWords
  } as const
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCommonStore as any, import.meta.hot))
}
