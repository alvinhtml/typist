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

type PropertiesOnly<T> = {
  [K in keyof T as T[K] extends Function ? never : K]: T[K]
}

type PickProperties<T, K extends keyof T> = {
  [P in K]: T[P];
};

export type PracticeProps = PickProperties<Practice, 'time' | 'inputLetters' | 'currentWords' | 'results' | 'page' | 'report' | 'started'>

type EventName = 'correct' | 'incorrect' | 'change'

interface Event {
  event: EventName
  callback: (data: PracticeProps) => void
}

const defaultConfig: PracticeConfig = {
  limit: 100
}

export class Practice {
  started: boolean
  report: Report | null
  wordsGenerator: Generator<Word[], void, unknown>
  currentWords: Word[]
  currentIndex: number
  inputLetters: string[]
  results: number[]
  time: number
  duration: number
  page: number
  timer: number | null
  config: PracticeConfig
  events: Event[]
  boundInput: (event: KeyboardEvent) => void

  constructor(data: Word[], config: PracticeConfig = defaultConfig) {
    this.config = { ...defaultConfig, ...config }

    this.started = false
    this.report = null
    this.currentWords = []
    this.currentIndex = 0
    this.inputLetters = []
    this.results = []
    this.time = 0
    this.page = 1
    this.duration = 60
    this.timer = null
    this.events = []
    this.wordsGenerator = generateWords(data, this.config.limit)
    this.boundInput = this.input.bind(this);
  }

  update(data: Word[]) {
    this.wordsGenerator = generateWords(data, this.config.limit)
  }

  private getProperties(): PracticeProps {
    return {
      time: this.time,
      inputLetters: this.inputLetters,
      currentWords: this.currentWords,
      results: this.results,
      page: this.page,
      report: this.report,
      started: this.started
    }
  }

  private input (event: KeyboardEvent)  {
    const currentWord = this.currentWords[this.currentIndex]
    
    if (event.key === 'Backspace') {
      if (this.inputLetters.length > 0) {
        this.inputLetters.pop()
      } else if (this.results.length > 0 && this.currentIndex > 0) {
        this.results.pop()
        this.currentIndex--
      }
      this.dispatchEvent('change', this.getProperties())
      return
    }
    
    if (!/^[a-zA-Z]$/.test(event.key)) {
      if (event.key === ' ' && this.inputLetters.length > 0) {
        this.checkResult()
      }
      return
    }
  
    this.inputLetters.push(event.key.toLowerCase())
    console.log(this.inputLetters);
    this.dispatchEvent('change', this.getProperties())
  
    if (this.inputLetters.length === 4) {
      this.checkResult()
    }
  }

  checkResult() {
    const currentWord = this.currentWords[this.currentIndex]
    const input = this.inputLetters.join('')
    
    if (input.toLocaleLowerCase() === currentWord.code.toLocaleLowerCase()) {
      this.results.push(1)
      Promise.resolve().then(() => {
        this.dispatchEvent('correct', this.getProperties())
      })
    } else {
      this.results.push(0)
      Promise.resolve().then(() => {
        this.dispatchEvent('incorrect', this.getProperties())
      })
    }
    
    this.currentIndex++
    this.inputLetters = []
    this.dispatchEvent('change', this.getProperties())

    console.log(this.currentIndex);
    
    if (this.currentIndex >= this.config.limit) {
        console.log(this.currentIndex, this.config.limit - 1)
        const nextWords = this.wordsGenerator.next().value

        if (nextWords) {
          this.page++
          this.currentWords = nextWords
          this.currentIndex = 0
        }
    }

    this.updateReport()
  }

  start(duration: number = 60) {
    this.duration = duration
    this.started = true
    
    const firstWords = this.wordsGenerator.next().value
    console.log(firstWords);
    
    if (firstWords) {
      this.currentWords = firstWords
      this.currentIndex = 0

      this.results = []
      this.inputLetters = []
      this.started = true
      this.report = null
      this.page = 1
      this.time = 0

      
      
      window.addEventListener('keydown', this.boundInput)

      if (this.timer) clearInterval(this.timer)

      this.timer = window.setInterval(() => {
        this.time++
        this.updateReport()
        this.dispatchEvent('change', this.getProperties())
        if (this.time >= this.duration) {
          this.stop()
        }
      }, 1000)

      this.dispatchEvent('change', this.getProperties())
    }
  }

  stop() {
    this.started = false
    this.updateReport()

    if (this.timer) clearInterval(this.timer)
    this.timer = null
    window.removeEventListener('keydown', this.boundInput)
    this.time = 0
    this.inputLetters = []
    this.results = []
    this.currentWords = []
    this.currentIndex = 0
    this.page = 1
    
    this.dispatchEvent('change', this.getProperties())
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

  dispatchEvent(event: EventName, data: PracticeProps) {
    this.events.forEach(e => {
      if (e.event === event) {
        e.callback(data)
      }
    })
  }
}