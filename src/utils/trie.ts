class TrieNode {
  children: { [key: string]: TrieNode }
  isEndOfWord: boolean

  constructor() {
    this.children = {} // 存储子节点
    this.isEndOfWord = false // 标记是否是一个完整单词的结尾
  }
}

export class Trie {
  root: TrieNode

  constructor() {
    this.root = new TrieNode() // 初始化根节点
  }

  // 插入字符串
  insert(word: string): void {
    let node = this.root

    for (let char of word) {
      if (!node.children[char]) {
        node.children[char] = new TrieNode() // 如果子节点不存在，则创建新节点
      }
      node = node.children[char] // 进入下一个子节点
    }
    node.isEndOfWord = true // 标记该节点为单词结尾
  }

  // 查找字符串
  search(word: string): boolean {
    let node = this.root

    for (let char of word) {
      if (!node.children[char]) {
        return false // 如果没有找到该字符，返回 false
      }
      node = node.children[char] // 进入下一个子节点
    }

    return node.isEndOfWord // 判断是否为一个完整单词
  }

  // 查找字符串的前缀
  startsWith(prefix: string): boolean {
    let node = this.root

    for (let char of prefix) {
      if (!node.children[char]) {
        return false // 如果没有找到该前缀，返回 false
      }
      node = node.children[char] // 进入下一个子节点
    }

    return true // 如果遍历完所有字符，表示该前缀存在
  }

  // 查找最大匹配的词
  findLongestMatch(text: string, startIndex: number): string {
    let node = this.root
    let longestMatch = '';
    for (let i = startIndex; i < text.length; i++) {
      if (!node.children[text[i]]) {
        break
      }
      node = node.children[text[i]]
      longestMatch += text[i]
    }

    return longestMatch
  }

  // 删除字符串
  delete(word: string): boolean {
    return this._delete(this.root, word, 0)
  }

  // 删除辅助方法
  private _delete(node: TrieNode, word: string, index: number): boolean {
    if (index === word.length) {
      // 如果已到达单词末尾
      if (!node.isEndOfWord) {
        return false // 如果不是一个完整单词，则返回 false
      }
      node.isEndOfWord = false // 标记为非完整单词
      return Object.keys(node.children).length === 0 // 如果没有子节点，则可以删除此节点
    }

    let char = word[index]
    let childNode = node.children[char]

    if (!childNode) {
      return false // 如果没有该字符的子节点，返回 false
    }

    // 递归删除
    const shouldDeleteChild = this._delete(childNode, word, index + 1)

    if (shouldDeleteChild) {
      delete node.children[char] // 删除子节点
      return Object.keys(node.children).length === 0 && !node.isEndOfWord
    }

    return false
  }
}

// 中文分词函数
export function segmentText(text: string, trie: {
  findLongestMatch: (text: string, startIndex: number) => string
}): string[] {
  const result: string[] = []
  let i = 0

  while (i < text.length) {
    const match = trie.findLongestMatch(text, i)
    if (match) {
      result.push(match)
      i += match.length
    } else {
      result.push(text[i])
      i++
    }
  }

  return result
}
