<template>
  <div class="main-container">
    <div class="header">
      <div class="breadcrumb">
        <RouterLink :to="{ name: 'Index' }">
          首页
        </RouterLink>
        <span> &gt;</span>
        <RouterLink :to="{ name: 'PracticeMenu' }">
          课程练习
        </RouterLink>
        <span> &gt;</span>
        <span> {{ lessons[lesson as keyof typeof lessons] }} </span>
      </div>

      <div class="lesson-selector">
        选择课程
        <div class="select">
          <select v-model="lesson">
          <option v-for="(v, k) in lessons" :value="k">{{ v }}</option>
        </select>
        </div>
        <div class="select">
          <select v-model="duration">
          <option v-for="v in durations" :value="v">{{ v / 60 }}分钟</option>
        </select>
        </div>
        <button v-if="started" class="button is-orange" @click="handleStop">结束练习</button>
        <button v-else class="button is-blue" @click="handleStart">开始练习</button>
      </div>
    </div>

    <div class="input-infos"><span>当前输入</span><b>{{ inputLetters.join('').toLocaleUpperCase() }}</b></div>
    <div class="practice-area">
      <div class="report" v-if="report && !started">
        <div class="title">结束！</div>
        <div><span>时间</span><b>{{ formatTime(report.time) }}</b></div>
        <div><span>字数</span><b>{{ report.count }}</b></div>
        <div><span>速度</span><b>{{ Math.floor(report.speed) }} 个/分钟</b></div>
        <div><span>正确率</span><b>{{ report.accuracy.toFixed(2) }}%</b></div>
      </div>
      <div class="words" :class="`is-${lesson}`" v-else>
        <template v-for="(word, index) in currentWords" :key="index">
          <span :class="[ results[(page - 1) * limit + index] ? 'correct' : (results[index] === 0 ? 'incorrect' : '')]">{{ word.word }}</span>
        </template>
      </div>
    </div>
    <div class="stats-bar" v-if="report">
      <div class="stat-item">
        时间 {{ formatTime(report.time) }}
      </div>
      <div class="stat-item">
        速度 {{ Math.floor(report.speed) }} 个/分钟
      </div>
      <div class="stat-item">
        进度 {{ ((report.time / duration) * 100).toFixed(2) }}%
      </div>
      <div class="stat-item" v-if="report">
        正确率 {{ report.accuracy.toFixed(2) }}%
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed, onUnmounted } from 'vue'
import { useCommonStore } from '@/stores/common'
import { RouterLink, useRoute } from 'vue-router'
import type { Word } from '@/stores/common'
import { Practice, Report, PracticeProps, formatTime } from '@/utils/practice'

const commonStore = useCommonStore()
const route = useRoute()

const lessons = commonStore.lessons
const lessonData = computed<Word[]>(() => commonStore.lessonData)

const lesson = ref<keyof typeof lessons>(route.params.level as keyof typeof lessons)

const durations = [60, 120, 180, 240, 300]
const duration = ref(60)

const report = ref<Report | null>(null)
const inputLetters = ref<string[]>([])
const currentWords = ref<Word[]>([])
const results = ref<number[]>([])
const limit = ref(100)
const page = ref(1)
const started = ref(false)
const time = ref(0)

const practice = new Practice(lessonData.value, { 
  limit: 100
})

practice.addEventListener('change', (event: PracticeProps) => {
  console.log(event)
  started.value = event.started
  time.value = event.time
  inputLetters.value = event.inputLetters
  currentWords.value = event.currentWords
  results.value = event.results
  page.value = event.page
  report.value = event.report
})

const handleStart = () => {
  practice.update(lessonData.value)
  practice.start(duration.value)
}

const handleStop = () => {
  practice.stop()
}


watch(lesson, async (newLesson) => {
  practice.stop()
  try {
    await commonStore.readData(newLesson)
  } catch (error) {
    console.error('Failed to load lesson:', error)
  }
})

watch(duration, () => {
  practice.stop()
})

onMounted(async () => {
  try {
    await commonStore.readData(lesson.value)
  } catch (error) {
    console.error('Failed to load lesson:', error)
  }
})

onUnmounted(() => {
  practice.stop()
})
</script>

<style lang="scss" scoped>
.input-infos {
  display: flex;
  justify-content: flex-end;
  align-items:flex-end;
  padding: 8px;
  height: 22px;

  span {
    font-size: 14px;
    padding-right: 8px;
  }

  b {
    font-size: 20px;
    width: 80px;
    text-align: left;
    border-bottom: 1px solid #ccc;
    padding: 0 4px;
  }
}


.practice-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  align-items: center;
  justify-content: center;
  background-color: #f5f7fa;
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;

  .report {
    font-size: 20px;

    .title {
      font-size: 32px;
      margin-bottom: 1rem;
      color: #4CAF50;
      text-align: center;
    }

    span {
      display: inline-block;
      width: 86px;
      text-align: right;
      padding-right: 12px;
    }
  }

  .words {
    font-size: 28px;
    
    &.is-level5 {
      font-size: 24px;

      span {
        padding: 0 12px;
      }
    }

    span {
      white-space: nowrap;

      &.correct {
        color: #4CAF50;
      }

      &.incorrect {
        color: #F44336;
      }
    }
  }
}

.text-display {
  font-size: 2rem;
  color: #333;
  transition: color 0.3s ease;
}

.text-display.text-correct {
  color: #4CAF50;
}

.stats-bar {
  display: flex;
  justify-content: space-between;
  padding: 1rem 2rem;
  background-color: #f5f7fa;
  border-radius: 8px;
}

.stat-item {
  color: #666;
  font-size: 0.9rem;
}
</style>
