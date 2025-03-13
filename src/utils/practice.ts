export function formatTime (seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}分${remainingSeconds}秒`
}

function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function* generateWords<T>(data: T[], n: number): Generator<T[], void, unknown> {
  const words = [...data]
  let index = Math.round(Math.random() * words.length)

  while (true) {
      let selectedWords: T[] = []
      for (let i = 0; i < n; i++) {
      selectedWords.push(words[index % words.length])
      index++
      }
      yield shuffleArray(selectedWords)
  }
}

export interface Report {
  time: number
  count: number
  accuracy: number
  speed: number
}

export interface  Word {
  word: string
  code: string
}

export interface PracticeConfig {
  limit: number
}

// type PropertiesOnly<T> = {
//   [K in keyof T as T[K] extends Function ? never : K]: T[K]
// }

type PickProperties<T, K extends keyof T> = {
  [P in K]: T[P];
};

export type PracticeProps = PickProperties<Practice, 'time' | 'inputs' | 'words' | 'results' | 'page' | 'report' | 'started'>

type EventName = 'correct' | 'incorrect' | 'message'

interface Event {
  event: EventName
  callback: (data: PracticeProps) => void
}

export class Practice {
  started: boolean
  report: Report | null
  wordsGenerator: Generator<Word[], void, unknown>
  words: Word[]
  index: number
  inputs: string[]
  results: number[]
  time: number
  duration: number
  page: number
  timer: number | null
  events: Event[]
  limit: number
  boundInput: (event: KeyboardEvent) => void

  constructor() {

    this.started = false
    this.report = null
    this.words = []
    this.index = 0
    this.inputs = []
    this.results = []
    this.time = 0
    this.page = 1
    this.duration = 60
    this.timer = null
    this.limit = 80
    this.events = []
    this.wordsGenerator = generateWords([], this.limit)
    this.boundInput = this.input.bind(this)
  }

  load(data: Word[]) {
    this.wordsGenerator = generateWords(data, this.limit)
  }

  private message(): PracticeProps {
    this.updateReport()
    return {
      time: this.time,
      inputs: this.inputs,
      words: this.words,
      results: this.results,
      page: this.page,
      report: this.report,
      started: this.started
    }
  }

  private input (event: KeyboardEvent)  {
    const currentWord = this.words[this.index]
    
    if (event.key === 'Backspace') {
      if (this.inputs.length > 0) {
        this.inputs.pop()
      } else if (this.results.length > 0 && this.index > 0) {
        this.results.pop()
        this.index--
      }
      this.dispatchEvent('message', this.message())
      return
    }
    
    if (!/^[a-zA-Z]$/.test(event.key)) {
      if (event.key === ' ' && this.inputs.length > 0) {
        this.checkResult()
      }
      return
    }
  
    this.inputs.push(event.key.toLowerCase())
  
    if (this.inputs.length === 4) {
      this.checkResult()
    } else {
      this.dispatchEvent('message', this.message())
    }
  }

  checkResult() {
    const currentWord = this.words[this.index]
    const input = this.inputs.join('')
    
    if (input.toLocaleLowerCase() === currentWord.code.toLocaleLowerCase()) {
      this.results.push(1)
      Promise.resolve().then(() => {
        this.dispatchEvent('correct', this.message())
      })
    } else {
      this.results.push(0)
      Promise.resolve().then(() => {
        this.dispatchEvent('incorrect', this.message())
      })
    }
    
    this.index++
    this.inputs = []
    this.dispatchEvent('message', this.message())

    if (this.index >= this.limit) {
        console.log(this.index, this.limit - 1)
        const nextWords = this.wordsGenerator.next().value

        if (nextWords) {
          this.page++
          this.words = nextWords
          this.index = 0
        }
    }
  }

  start(duration: number = 60) {
    this.duration = duration
    this.started = true
    
    const firstWords = this.wordsGenerator.next().value
    
    if (firstWords) {
      this.words = firstWords
      this.index = 0

      this.results = []
      this.inputs = []
      this.started = true
      this.report = null
      this.page = 1
      this.time = 0

      
      
      window.addEventListener('keydown', this.boundInput)

      if (this.timer) clearInterval(this.timer)

      this.timer = window.setInterval(() => {
        this.time++
        this.dispatchEvent('message', this.message())
        if (this.time >= this.duration) {
          this.stop()
        }
      }, 1000)

      this.dispatchEvent('message', this.message())
    }
  }

  stop() {
    this.started = false

    if (this.timer) clearInterval(this.timer)
    this.timer = null
    window.removeEventListener('keydown', this.boundInput)
    this.time = 0
    this.inputs = []
    this.results = []
    this.words = []
    this.index = 0
    this.page = 1
    
    this.dispatchEvent('message', this.message())
  }

  updateReport() {
    this.report = {
      time: this.time,
      count: this.results.length,
      accuracy: this.results.length > 0 ? (this.results.filter(word => word === 1).length / this.results.length * 100) : 0,
      speed: this.results.length > 0 ? (this.results.filter(word => word === 1).length / (this.time / 60)) : 0
    }
  }

  addEventListener(event: EventName, callback: (data: PracticeProps) => void) {
    this.events.push({ event, callback })
  }

  removeEventListener(event: EventName, callback: (data: PracticeProps) => void) {
    this.events = this.events.filter(e => e.event !== event || e.callback !== callback)
  }

  requestAnimationFrame(callback: (status: PracticeProps) => void) {
    this.addEventListener('message', callback)
  }

  dispatchEvent(event: EventName, data: PracticeProps) {
    this.events.forEach(e => {
      if (e.event === event) {
        e.callback(data)
      }
    })
  }
}