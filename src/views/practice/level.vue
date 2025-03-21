<template>
  <Header>
    <div class="text">课程</div>
    <div class="select">
      <select v-model="lesson">
        <option v-for="(v, k) in lessons" :value="k">{{ v }}</option>
      </select>
    </div>
    <div class="text">时长</div>
    <div class="select">
      <select v-model="duration">
        <option v-for="v in durations" :value="v">{{ v / 60 }}分钟</option>
      </select>
    </div>
    <div class="infos" v-if="report">
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
    <template #right>
      <div class="text input-infos">
        <b>{{ inputs }}</b> 
      </div>
    </template>
  </Header>
  <div class="main-container">
    <div class="practice-area">
      <div class="report" v-if="report && !started">
        <div class="title">结束</div>
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
    
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed, onUnmounted, shallowRef } from 'vue'
import { useCommonStore } from '@/stores/common'
import { RouterLink, useRoute } from 'vue-router'
import type { Word } from '@/stores/common'
import { Practice, Report, PracticeProps, formatTime } from '@/utils/practice'
import Header from '@/components/Header.vue';

const commonStore = useCommonStore()
const route = useRoute()
const { readData } = window.electronAPI

const lessons = commonStore.lessons

const lesson = ref<keyof typeof lessons>(route.params.level as keyof typeof lessons)
const lessonData = shallowRef<Word[]>([])

const reload = async () => {
  lessonData.value = await readData(lesson.value)
}

const durations = [60, 120, 180, 240, 300]
const duration = ref(60)

const report = ref<Report | null>(null)
const inputs = ref<string>('')
const currentWords = ref<Word[]>([])
const results = ref<number[]>([])
const limit = ref(80)
const page = ref(1)
const started = ref(false)
const time = ref(0)

const practice = new Practice()

practice.requestAnimationFrame((status) => {
  started.value = status.started
  inputs.value = status.inputs.join('').toLocaleUpperCase()
  currentWords.value = status.words
  results.value = status.results
  page.value = status.page
  report.value = status.report
})


const handleStart = () => {
  practice.load(lessonData.value)
  practice.start(duration.value)
}

const handleStop = () => {
  practice.stop()
}


watch(lesson, async (newLesson) => {
  practice.stop()
  try {
    await reload()
    handleStart()
  } catch (error) {
    console.error('Failed to load lesson:', error)
  }
})

watch(duration, () => {
  practice.stop()
  handleStart()
})

onMounted(async () => {
  try {
    await reload()
    handleStart()
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
  width: 60px;
  padding-left: 4px;
  letter-spacing: 2px;
  text-align: right;
}


.practice-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;

  .report {
    font-size: 20px;
    color: #ffffff;

    .title {
      font-size: 32px;
      margin-bottom: 1rem;
      color: #00ff1e;
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
    font-size: 24px;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    color: #ffffff;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);

    span {
      flex: 0 0 60px;
      white-space: nowrap;
      text-align: center;

      &.correct {
        color: #00ff1e;
      }

      &.incorrect {
        color: #ff0000;
      }
    }
  }
}

.infos {
  display: flex;
  justify-content: flex-start;
}

.stat-item {
  color: #ffffff;
  font-size: 12px;
  margin-left: 24px;
}
</style>
