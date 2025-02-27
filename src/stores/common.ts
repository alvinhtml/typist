import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref, shallowRef } from 'vue'
import { apiReadData, apiImportWords } from '../api/common'
import { Trie } from '../utils/trie'
import { log } from 'console'

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
  
  const lessons = {
    level1: '一级简码',
    level2: '二级简码',
    level3: '三级简码',
    level4: '四级简码',
    level5: '词组练习',
    words: '生词练习',
  }

  const lessonData = ref<Word[]>([])

  async function readData(lesson: string) {
    try {
      lessonData.value = await apiReadData(lesson)
    } catch (error) {
      console.error('Failed to load lesson data:', error)
      throw error
    }
  }

  const dicts = shallowRef<Dict>({})
  const trie = shallowRef<Trie>(new Trie())


  async function loadDicts() {
    console.log('Loading dicts...')
    const files = Object.keys(lessons).filter(file => file !== 'words')

    let dict: Dict = {}

    try {
      const values = await Promise.all(files.map(file => apiReadData(file)))
      console.log('Loaded values:', values)

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

  async function importWords(newWords: Word[]): Promise<ImportResult> {
    try {
      // 先读取现有的单词
      const existingWords = await apiReadData('words')
      
      // 创建一个Set来存储现有的单词
      const existingWordSet = new Set(existingWords.map(w => w.word))
      
      // 过滤出不存在的新词
      const wordsToAdd = newWords.filter(word => 
        word.code && !existingWordSet.has(word.word)
      )

      console.log('Words to add:', wordsToAdd)

      
      // 过滤出已存在的新词
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
      
      // 写入文件
      await apiImportWords(wordsToAdd)

      return {
        count: wordsToAdd.length,
        newWords: wordsToAdd,
        duplicateWords: wordsToDuplicate
      }

    } catch (error) {
      console.error('Failed to add words:', error)
      throw error
    }
  }

  return {
    lessons,
    lessonData,
    readData,
    loadDicts,
    dicts,
    trie,
    importWords
  } as const
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCommonStore as any, import.meta.hot))
}
