<template>
  <div class="game-container">
    <div class="header">
      <div class="breadcrumb">
        首页 → 打字游戏
      </div>
      <div class="game-controls">
        <button @click="startGame" :disabled="isGameActive">
          开始游戏
        </button>
      </div>
    </div>

    <div class="game-area" ref="gameAreaRef">
      <div class="boats-container">
        <div v-for="(boat, index) in boats" 
             :key="index"
             class="boat"
             :style="getBoatStyle(boat)">
          <div class="boat-content">{{ boat.text }}</div>
        </div>
      </div>
    </div>

    <div class="stats-bar">
      <div class="stat-item">
        时间 {{ formatTime(time) }}
      </div>
      <div class="stat-item">
        速度 每秒 {{ speed }} 个
      </div>
      <div class="stat-item">
        进度 {{ progress }}%
      </div>
      <div class="stat-item">
        正确率 {{ accuracy }}%
      </div>
    </div>

    <div class="input-area">
      <input
        ref="inputRef"
        v-model="userInput"
        @input="checkInput"
        :disabled="!isGameActive"
        placeholder="输入文字击沉船只..."
        autocomplete="off"
        spellcheck="false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'

interface Boat {
  id: number
  text: string
  x: number
  y: number
  speed: number
  isHit?: boolean
}

const boats = ref<Boat[]>([])
const userInput = ref('')
const isGameActive = ref(false)
const time = ref(0)
const speed = ref(0)
const progress = ref(30)
const accuracy = ref(95)
const inputRef = ref<HTMLInputElement | null>(null)
const timer = ref<number | null>(null)
const gameTimer = ref<number | null>(null)
const gameAreaRef = ref<HTMLDivElement | null>(null)

const gameAreaDimensions = computed(() => {
  if (!gameAreaRef.value) return { width: 0, height: 0 }
  const rect = gameAreaRef.value.getBoundingClientRect()
  return {
    width: rect.width,
    height: rect.height
  }
})

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

const getBoatStyle = (boat: Boat) => {
  return {
    transform: `translate(${boat.x}px, ${boat.y}px)`,
    transition: 'transform 0.1s linear',
    opacity: boat.isHit ? '0' : '1'
  }
}

const startGame = () => {
  isGameActive.value = true
  time.value = 0
  boats.value = []
  userInput.value = ''
  progress.value = 0
  accuracy.value = 100
  
  // 开始计时
  timer.value = window.setInterval(() => {
    time.value++
  }, 1000)

  // 生成船只
  gameTimer.value = window.setInterval(() => {
    if (boats.value.length < 6) {
      const { width, height } = gameAreaDimensions.value
      boats.value.push({
        id: Date.now(),
        text: '工',
        x: Math.random() * (width - 100), // 减去船只宽度
        y: Math.random() * (height - 100), // 减去船只高度
        speed: 1 + Math.random() * 2
      })
    }

    // 移动船只
    boats.value = boats.value.map(boat => ({
      ...boat,
      x: boat.x + boat.speed
    })).filter(boat => boat.x < gameAreaDimensions.value.width && !boat.isHit)

    // 检查游戏是否结束
    if (boats.value.length >= 10) {
      endGame()
    }
  }, 2000)
}

const checkInput = () => {
  const input = userInput.value.trim()
  if (!input) return

  // 检查是否击中船只
  const hitBoatIndex = boats.value.findIndex(boat => boat.text === input)
  if (hitBoatIndex !== -1) {
    boats.value[hitBoatIndex].isHit = true
    setTimeout(() => {
      boats.value = boats.value.filter(boat => !boat.isHit)
    }, 500)
    userInput.value = ''
    updateStats(true)
  } else {
    updateStats(false)
  }
}

const updateStats = (isCorrect: boolean) => {
  const total = progress.value + (isCorrect ? 1 : 0)
  const correct = accuracy.value * progress.value / 100 + (isCorrect ? 1 : 0)
  progress.value = total
  accuracy.value = Math.round((correct / total) * 100)
  speed.value = Math.round((correct / time.value) * 60)
}

const endGame = () => {
  isGameActive.value = false
  if (timer.value) clearInterval(timer.value)
  if (gameTimer.value) clearInterval(gameTimer.value)
  // 可以在这里添加游戏结束的其他逻辑，比如显示得分等
}

onMounted(() => {
  inputRef.value?.focus()
})

onUnmounted(() => {
  endGame()
})
</script>

<style scoped>
.game-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  padding: 2rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.breadcrumb {
  color: #666;
  font-size: 0.9rem;
}

.game-controls button {
  padding: 0.5rem 1.5rem;
  border: none;
  border-radius: 4px;
  background-color: #2196F3;
  color: white;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.game-controls button:hover {
  background-color: #1976D2;
}

.game-controls button:disabled {
  background-color: #BDBDBD;
  cursor: not-allowed;
}

.game-area {
  flex: 1;
  position: relative;
  background: linear-gradient(180deg, #E3F2FD 0%, #BBDEFB 100%);
  border-radius: 12px;
  margin-bottom: 2rem;
  overflow: hidden;
}

.boats-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.boat {
  position: absolute;
  transition: transform 0.1s linear;
}

.boat-content {
  padding: 0.5rem 1rem;
  background-color: white;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  font-size: 1.2rem;
}

.stats-bar {
  display: flex;
  justify-content: space-between;
  padding: 1rem 2rem;
  background-color: #f5f7fa;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.stat-item {
  color: #666;
  font-size: 0.9rem;
}

.input-area {
  width: 100%;
  padding: 0 2rem;
}

.input-area input {
  width: 100%;
  padding: 1rem;
  font-size: 1.2rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  text-align: center;
  transition: all 0.3s ease;
}

.input-area input:focus {
  outline: none;
  border-color: #2196F3;
  box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
}

.input-area input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}
</style>
