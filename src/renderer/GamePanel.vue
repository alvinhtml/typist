<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { ammoLimit, Game, type Target } from '../shared/game';
import GameBattlefield from './GameBattlefield.vue';
import { bindAnswerInput } from '../shared/answer-input';
import type { Course, CourseWord } from '../shared/contracts';

const props = defineProps<{ visible: boolean; beforeStart: () => Promise<boolean> }>();
const emit = defineEmits<{ home: [] }>();
const courses = [['1', '一级'], ['2', '二级'], ['3', '三级'], ['4', '四级'], ['5', '词组'], ['vocabulary', '生词本']] as const;
const game = new Game();
const course = ref<Course>('1');
const duration = ref(1);
const preparing = ref(true);
const ready = ref(false);
const busy = ref(false);
const error = ref('');
const notice = ref('');
const aim = ref<Target | null>(null);
const version = ref(0);
const input = ref<HTMLInputElement>();
const resumeButton = ref<HTMLButtonElement>();
const startButton = ref<HTMLButtonElement>();
const letters = ref('');
const answerFocused = ref(false);
const phase = computed(() => { void version.value; return game.session.phase; });
const stats = computed(() => { void version.value; return game.statistics(); });
const time = computed(() => {
  void version.value;
  const seconds = Math.ceil(game.session.remainingMs / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
});
const resultLabels = { breach: '防线失守', time: '防御时间到', empty: '当前课程暂无可练内容', manual: '已结束本次防御' };
let dispose = () => {};
let removePause = () => {};
let removeChanged = () => {};
let animation = 0;
let queue = Promise.resolve();
let focusLostDuringStart = false;

function focusInput() {
  if (props.visible && phase.value === 'running' && !input.value?.disabled) input.value?.focus({ preventScroll: true });
}
function focusSurface(event: MouseEvent) {
  if (!(event.target as Element).closest('button,input,select,label')) focusInput();
}

function bind() {
  dispose();
  letters.value = '';
  const element = input.value;
  if (!element) return;
  const canAnswer = () => props.visible && !busy.value && !error.value && game.session.phase === 'running';
  const unbind = bindAnswerInput(element, code => {
    const previous = game.session.phase;
    const attack = game.answer(code);
    if (attack) aim.value = attack.target;
    notice.value = attack === false ? '编码未匹配任何敌机' : attack && attack.stockFull ? '穿甲弹库存已满' : '';
    refresh(previous);
  }, () => {
    update();
    return canAnswer();
  }, () => { notice.value = '请切换至英文输入状态'; }, () => 'vocabulary');
  const sync = () => { letters.value = element.value; };
  const events = ['keydown', 'input', 'compositionstart', 'compositionend', 'blur', 'paste', 'drop'];
  for (const event of events) element.addEventListener(event, sync);
  dispose = () => {
    for (const event of events) element.removeEventListener(event, sync);
    unbind();
    letters.value = '';
  };
}
watch(input, bind, { flush: 'post' });

function refresh(previous: typeof game.session.phase) {
  version.value++;
  if (previous === game.session.phase) return;
  bind();
  if (game.session.phase === 'ended') {
    void window.typist.setSessionActive(false);
    if (props.visible) void nextTick(() => startButton.value?.focus());
  }
  if (game.session.phase === 'running') void nextTick(focusInput);
  if (game.session.phase === 'paused' && props.visible) void nextTick(() => resumeButton.value?.focus());
}
function update() {
  if (game.session.phase !== 'running' && game.session.phase !== 'countdown') return;
  const previous = game.session.phase;
  game.tick();
  refresh(previous);
}
function animate() {
  update();
  animation = requestAnimationFrame(animate);
}
function pause() {
  if (busy.value) focusLostDuringStart = true;
  if (!game.session.active || game.session.phase === 'paused') return;
  const previous = game.session.phase;
  game.pause();
  refresh(previous);
}
function resume() {
  if (busy.value || error.value || phase.value !== 'paused') return;
  game.resume();
  refresh('paused');
}
function finish() {
  const previous = game.session.phase;
  game.finish();
  refresh(previous);
}
function exitGame() {
  if (busy.value) return;
  finish();
  preparing.value = true;
  error.value = notice.value = '';
  void nextTick(() => startButton.value?.focus());
}
function escape(event: KeyboardEvent) {
  if (!props.visible || preparing.value || event.key !== 'Escape' || event.isComposing || event.keyCode === 229) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (event.repeat || busy.value) return;
  if (phase.value === 'paused') resume();
  else if (game.session.active) pause();
}
defineExpose({ isActive: () => game.session.active, pause, finish });

async function readCourse() {
  const selected = course.value;
  const snapshot = await window.typist.getSnapshot();
  if (!snapshot.ok) throw new Error(snapshot.error.message);
  const items: CourseWord[] = [];
  let total = 1;
  for (let offset = 0; offset < total; offset += 200) {
    const page = await window.typist.getCourse({ course: selected, offset, limit: 200 });
    if (!page.ok) throw new Error(page.error.message);
    if (page.revision !== snapshot.revision) throw new Error('词库已变化，请重试。');
    items.push(...page.value.items);
    total = page.value.total;
  }
  return { snapshot, items };
}
async function start() {
  if (busy.value || !ready.value) return;
  pause();
  if (game.session.active && !window.confirm('结束当前一局并重新开始？')) return;
  busy.value = true;
  error.value = '';
  try {
    if (!await props.beforeStart()) return;
    focusLostDuringStart = false;
    await queue;
    const { snapshot, items } = await readCourse();
    if (!items.length) throw new Error('当前课程暂无可练内容，请先添加生词或补充词库。');
    const settings = { ...snapshot.value.settings, duration: duration.value };
    const saved = await window.typist.updateSettings({
      requestId: crypto.randomUUID(), expectedRevision: snapshot.revision, value: settings,
    });
    if (!saved.ok) throw new Error(saved.error.message);
    if (!props.visible) return;
    const registered = await window.typist.setSessionActive(true);
    if (!registered.ok) throw new Error(registered.error.message);
    game.finish();
    game.start(items, settings);
    preparing.value = false;
    aim.value = null;
    notice.value = '';
    if (focusLostDuringStart || !props.visible) game.pause();
    refresh('idle');
  } catch (failure) {
    error.value = (failure as Error).message;
  } finally {
    busy.value = false;
  }
}
async function loadSettings() {
  error.value = '';
  const snapshot = await window.typist.getSnapshot();
  if (snapshot.ok) {
    duration.value = snapshot.value.settings.duration;
    ready.value = true;
  } else error.value = snapshot.error.message;
}
async function reloadCourse() {
  error.value = '';
  try {
    if (!game.session.active) return;
    const session = game.session.settingsSnapshot;
    const { items } = await readCourse();
    if (!game.session.active || session !== game.session.settingsSnapshot) return;
    const previous = game.session.phase;
    game.sync(items);
    refresh(previous);
  } catch (failure) {
    error.value = (failure as Error).message;
    pause();
  } finally {
    bind();
    void nextTick(focusInput);
  }
}
watch(() => props.visible, visible => { if (!visible) pause(); });
onMounted(() => {
  window.addEventListener('keydown', escape, true);
  removePause = window.typist.onPause(pause);
  removeChanged = window.typist.onChanged(event => {
    if (game.session.active && event.affectedCourses.includes(course.value)) {
      dispose();
      queue = queue.then(reloadCourse);
    }
  });
  animation = requestAnimationFrame(animate);
  void loadSettings();
});
onUnmounted(() => {
  window.removeEventListener('keydown', escape, true);
  cancelAnimationFrame(animation);
  dispose();
  removePause();
  removeChanged();
});
</script>

<template>
  <main class="game-panel" @click="focusSurface">
    <GameBattlefield :game="game" :version="version" :aim="aim" :preview="preparing"/>
    <span v-if="!preparing" class="game-status" role="status">{{ phase === 'paused' ? '已暂停' : phase === 'ended' ? '本次游戏结束' : phase === 'running' ? '游戏中' : '准备中' }}</span>

    <form v-if="preparing" class="game-overlay briefing" @submit.prevent="start">
      <section class="mission-card">
        <button type="button" data-page="home" :disabled="busy" @click="emit('home')">← 返回主界面</button>
        <h1>太空打字防御战</h1>
        <p>输入敌机上的五笔编码，守住防线。</p>
        <div class="mission-options">
          <label>练习课程<select v-model="course" aria-label="游戏课程" :disabled="busy"><option v-for="[id, label] in courses" :key="id" :value="id">{{ label }}</option></select></label>
          <label>任务时长<select v-model.number="duration" aria-label="游戏时长" :disabled="busy"><option v-for="n in 5" :key="n" :value="n">{{ n }} 分钟</option></select></label>
          <span>难度<strong>标准</strong></span>
        </div>
        <p v-if="error" class="mission-error" role="alert">{{ error }} <button v-if="!ready" type="button" @click="loadSettings">重试</button></p>
        <button ref="startButton" class="launch" data-game="start" :disabled="busy || !ready">{{ busy ? '准备中…' : '开始游戏 →' }}</button>
      </section>
    </form>

    <template v-else>
      <header v-if="phase !== 'ended'" class="combat-hud" :inert="phase === 'paused'">
        <div class="hud-brand"><strong>typist<span>.</span></strong><small>太空防御</small></div>
        <div><small>剩余时间</small><b data-game="time">{{ time }}</b></div>
        <div class="hud-defense"><small>防线耐久</small><b data-game="defense">{{ game.defense }} / 10</b>
          <span class="defense-meter" aria-hidden="true"><i v-for="point in 10" :key="point" :class="{ spent: point > game.defense }"/></span>
        </div>
        <div><small>连击</small><b class="amber" data-game="combo">{{ game.combo }}</b></div>
        <div><small>得分</small><b class="amber" data-game="score">{{ game.score.toLocaleString() }}</b></div>
        <button data-game="pause" aria-label="暂停游戏" title="暂停（Esc）" @click="pause">Ⅱ <span>ESC</span></button>
      </header>

      <input v-if="phase !== 'ended'" ref="input" class="game-answer" aria-label="游戏编码" :disabled="phase !== 'running' || busy || !!error" autocomplete="off" spellcheck="false" @focus="answerFocused = true" @blur="answerFocused = false">
      <template v-if="phase !== 'ended'">
        <div class="ammo-hud"><small>穿甲弹</small><div><i v-for="point in ammoLimit" :key="point" :class="{ loaded: point <= game.ammo }"/><b data-game="ammo">{{ game.ammo }} / {{ ammoLimit }}</b></div></div>
        <div class="input-hud"><small>{{ phase === 'running' && !answerFocused ? '点击战场继续输入' : '当前输入' }}</small>
          <span data-game="letters" aria-live="off"><i v-for="(letter, index) in (letters || '—')" :key="index">{{ letter }}</i></span>
          <p v-if="notice" role="status">{{ notice }}</p>
        </div>
      </template>

      <div v-if="phase === 'countdown'" class="game-overlay countdown-screen" aria-live="polite">
        <strong>{{ Math.ceil(game.session.countdownMs / 1000) }}</strong><p>切换至英文状态，准备输入</p>
      </div>
      <div v-if="phase === 'paused'" class="game-overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title">
        <section class="mission-card pause-card">
          <h1 id="pause-title">游戏已暂停</h1><p>按 Esc 或点击继续，返回战场。</p>
          <p v-if="error" class="mission-error" role="alert">{{ error }} <button @click="reloadCourse">重新加载</button></p>
          <button ref="resumeButton" class="launch" data-game="resume" :disabled="busy || !!error" @click="resume">继续游戏</button>
          <button data-game="restart" :disabled="busy" @click="start">重新开始</button>
          <button data-game="exit" :disabled="busy" @click="exitGame">退出游戏</button>
        </section>
      </div>
      <div v-if="phase === 'ended'" class="game-overlay results">
        <section class="mission-card">
          <h1>本次游戏结束</h1><p>{{ game.outcome && resultLabels[game.outcome] }}</p>
          <div class="result-columns">
            <section><h2>战斗成绩</h2><dl>
              <div><dt>最终得分</dt><dd>{{ game.score }}</dd></div><div><dt>击毁敌机</dt><dd data-game="correct">{{ stats.correct }}</dd></div>
              <div><dt>最高连击</dt><dd>{{ game.bestCombo }}</dd></div><div><dt>剩余防线</dt><dd>{{ game.defense }} / 10</dd></div>
              <div><dt>穿甲弹使用</dt><dd>{{ game.piercingUsed }} 发</dd></div>
            </dl></section>
            <section><h2>打字训练成绩</h2><dl>
              <div><dt>打字速度</dt><dd>{{ stats.speed.toFixed(1) }} 字/分钟</dd></div>
              <div><dt>准确率</dt><dd>{{ stats.accuracy === null ? '—' : (stats.accuracy * 100).toFixed(1) + '%' }}</dd></div>
              <div><dt>正确输入</dt><dd>{{ game.hits }} 次 / {{ stats.characters }} 字</dd></div>
              <div><dt>错误提交</dt><dd>{{ stats.mistakes }} 次</dd></div>
            </dl></section>
          </div>
          <p v-if="error" class="mission-error" role="alert">{{ error }}</p>
          <div class="result-actions"><button ref="startButton" class="launch" data-game="start" :disabled="busy" @click="start">再来一次</button>
            <button data-game="exit" :disabled="busy" @click="exitGame">返回准备界面</button></div>
        </section>
      </div>
    </template>
  </main>
</template>

<style scoped src="./game-panel.css"></style>
