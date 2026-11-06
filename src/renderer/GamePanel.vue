<script setup lang="ts">
import ThemeSwitch from './ThemeSwitch.vue';
import {computed,nextTick,onMounted,onUnmounted,ref,watch} from 'vue';
import {Game} from '../shared/game';
import {bindAnswerInput} from '../shared/answer-input';
import {defaults,type Course,type CourseWord} from '../shared/contracts';
const props=defineProps<{visible:boolean;beforeStart:()=>Promise<boolean>}>();defineEmits<{home:[]}>();
const course=ref<Course>('1'),duration=ref(1),difficulty=ref<typeof defaults.difficulty>('normal'),game=new Game(),version=ref(0),busy=ref(false),error=ref(''),notice=ref(''),input=ref<HTMLInputElement>(),letters=ref(''),answerFocused=ref(false);
const phase=computed(()=>{version.value;return game.session.phase;}),active=computed(()=>!['idle','ended'].includes(phase.value)),targets=computed(()=>{version.value;return game.targets;}),stats=computed(()=>{version.value;return game.statistics();});
const time=computed(()=>{version.value;const seconds=Math.ceil((phase.value==='idle'?duration.value*60000:game.session.remainingMs)/1000);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;});
let dispose=()=>{},unpause=()=>{},unchanged=()=>{},timer:ReturnType<typeof setInterval>,queue=Promise.resolve();
function bind(){
  dispose();letters.value='';const element=input.value;if(!element)return;
  const unbind=bindAnswerInput(element,code=>{const result=game.answer(code);notice.value=result===false?'编码未匹配当前目标。':'';update();},()=>{update();return props.visible&&game.session.phase==='running';},()=>{notice.value='请使用英文状态逐键输入编码';},()=> 'vocabulary');
  // Read after the adapter handles each event, including submit and clear paths.
  const sync=()=>{letters.value=element.value;};
  const events=['keydown','input','compositionstart','compositionend','blur','paste','drop'];
  for(const event of events)element.addEventListener(event,sync);
  dispose=()=>{for(const event of events)element.removeEventListener(event,sync);unbind();letters.value='';};
}
function focusInput(){if(props.visible&&phase.value==='running'&&!busy.value&&!error.value&&!input.value?.disabled)input.value?.focus({preventScroll:true});}
function focusSurface(event:MouseEvent){
  // Keep controls keyboard-accessible; only passive game surfaces return to typing.
  if((event.target as Element).closest('button,input,select,textarea,a,label,summary,[tabindex]'))return;
  focusInput();
}

watch(input,bind,{flush:'post'});
function update(){const old=game.session.phase;game.tick();version.value++;if(old!==game.session.phase){bind();if(game.session.phase==='ended')void window.typist.setSessionActive(false);if(game.session.phase==='running'&&props.visible)void nextTick(focusInput);}}
function pause(){game.pause();version.value++;bind();if(game.session.phase==='ended')void window.typist.setSessionActive(false);}
function finish(){game.finish();version.value++;bind();void window.typist.setSessionActive(false);}
function resume(){if(error.value||busy.value)return;game.resume();version.value++;bind();void nextTick(focusInput);}
defineExpose({isActive:()=>game.session.active,pause,finish});
async function read(){const snapshot=await window.typist.getSnapshot();if(!snapshot.ok)throw new Error(snapshot.error.message);const items:CourseWord[]=[];let total=1;for(let offset=0;offset<total;offset+=200){const r=await window.typist.getCourse({course:course.value,offset,limit:200});if(!r.ok)throw new Error(r.error.message);if(r.revision!==snapshot.revision)throw new Error('词库已变化，请重试。');items.push(...r.value.items);total=r.value.total;}return {snapshot,items};}
async function start(){if(busy.value)return;pause();if(game.session.active&&!window.confirm('结束当前一局并重新开始？'))return;if(!await props.beforeStart())return;busy.value=true;error.value='';try{await queue;const {snapshot,items}=await read();if(!items.length)throw new Error('当前课程暂无可练内容，请先添加生词或补充词库。');const settings={...snapshot.value.settings,duration:duration.value,difficulty:difficulty.value};const saved=await window.typist.updateSettings({requestId:crypto.randomUUID(),expectedRevision:snapshot.revision,value:settings});if(!saved.ok)throw new Error(saved.error.message);if(game.session.active)game.finish();const registered=await window.typist.setSessionActive(true);if(!registered.ok)throw new Error(registered.error.message);game.start(items,settings);notice.value='';version.value++;bind();}catch(e){error.value=(e as Error).message;}finally{busy.value=false;}}
function changeCourse(event:Event){const select=event.target as HTMLSelectElement,next=select.value as Course;select.value=course.value;if(next===course.value)return;pause();if(game.session.active&&!window.confirm('结束当前一局并切换课程？'))return;if(game.session.active)finish();course.value=next;notice.value='课程已切换，点击开始游戏。';}
async function reload(){error.value='';try{if(game.session.active){const {items}=await read();game.sync(items);version.value++;bind();if(!game.session.active)void window.typist.setSessionActive(false);}}catch(e){error.value=(e as Error).message;pause();}}
watch(()=>props.visible,v=>{if(!v)pause();});
onMounted(async()=>{unpause=window.typist.onPause(pause);unchanged=window.typist.onChanged(e=>{if(e.affectedCourses.includes(course.value)&&game.session.active){dispose();queue=queue.then(reload);}});timer=setInterval(update,30);const r=await window.typist.getSnapshot();if(r.ok){duration.value=r.value.settings.duration;difficulty.value=r.value.settings.difficulty;}else error.value=r.error.message;});
onUnmounted(()=>{clearInterval(timer);dispose();unpause();unchanged();});
</script>
<template>
<section class="practice-panel game-panel" @click="focusSurface">
  <header class="practice-options">
    <button class="back" data-page="home" @pointerdown.capture="pause" @click="pause();$emit('home')">← 首页</button><span class="control-divider"></span>
    <select aria-label="游戏课程" :value="course" :disabled="busy" @change="changeCourse"><option v-for="n in 5" :value="String(n)">{{n===5?'词组':`${n}级`}}</option><option value="vocabulary">生词本</option></select>
    <select v-model.number="duration" aria-label="游戏时长" :disabled="active||busy"><option v-for="n in 5" :value="n">{{n}} 分钟</option></select>
    <select v-model="difficulty" aria-label="游戏难度" :disabled="active||busy"><option value="easy">简单</option><option value="normal">普通</option><option value="hard">困难</option></select>
    <strong class="remaining">{{time}}</strong>
    <button v-if="phase==='running'||phase==='countdown'" data-game="pause" @pointerdown.capture.prevent="pause" @click="pause">Ⅱ 暂停</button>
    <button v-if="phase==='paused'" data-game="resume" :disabled="busy||!!error" @click="resume">继续</button>
    <button v-if="active" class="back" data-game="finish" @pointerdown.capture="pause" @click="finish">结束本次</button>
    <button v-if="active" class="back restart" data-game="start" :disabled="busy" @click="start">重新开始</button>
    <ThemeSwitch/>
  </header>
  <main class="practice-body game-body">
    <div v-if="error" class="error game-alert" role="alert">{{error}} <button @click="reload">重新加载</button></div>
    <p v-if="notice" class="note game-notice" role="status">{{notice}}</p>
    <span class="game-status" role="status">{{phase==='countdown'?`准备 ${Math.ceil(game.session.countdownMs/1000)}`:phase==='paused'?'已暂停':phase==='ended'?'本次游戏结束':phase==='idle'?'未开始':'游戏中'}}</span>
    <div v-if="phase==='idle'" class="empty-state game-overlay"><h1>让每一次输入，消除一个目标</h1><p>输入编码消除下落文字，悬停查看提示。</p><button class="primary" data-game="start" :disabled="busy" @click="start">{{busy?'准备中…':'开始游戏 →'}}</button></div>
    <div v-if="phase==='countdown'" class="countdown game-overlay" aria-live="polite"><strong>{{Math.ceil(game.session.countdownMs/1000)}}</strong><p>切换至英文状态，双手放在键盘上</p></div>
    <div v-show="phase==='running'||phase==='paused'" class="game-playfield">
      <div class="game-arena" aria-label="下落目标" :class="{paused:phase==='paused'}" :style="{gridTemplateColumns:`repeat(${game.profile.count},minmax(0,1fr))`}">
        <div v-for="lane in game.profile.count" :key="lane" class="game-lane"><div v-for="target in targets.filter(t=>t.lane===lane-1)" :key="target.id" class="game-target" :data-word="target.word" :style="{top:`${target.y/420*100}%`}" @mouseenter="game.tick();target.hover=true;version++" @mouseleave="game.tick();target.hover=false;version++"><strong>{{target.word}}</strong><small v-if="target.hover">{{target.codes.join(' · ')}}</small></div></div>
      </div>
      <input ref="input" class="game-answer" @focus="answerFocused=true" @blur="answerFocused=false" aria-label="游戏编码" :disabled="phase!=='running'||busy||!!error" autocomplete="off" spellcheck="false">
    </div>
    <div v-if="phase==='paused'" class="pause-message game-overlay"><p>目标与成绩已保留，继续后可直接输入。</p><button class="primary" :disabled="busy||!!error" @click="resume">继续游戏 →</button></div>
    <div v-if="phase==='ended'" class="empty-state game-overlay"><h1>每一次消除，都更熟悉一点</h1><p>本次游戏已结束，成绩见下方。</p><button class="primary" data-game="start" :disabled="busy" @click="start">再玩一次 →</button></div>
  </main>
  <section class="practice-stats" aria-label="游戏成绩">
    <div class="stat"><small>速度</small><strong>{{stats.speed.toFixed(1)}}</strong><span> 字/分钟</span></div>
    <div class="stat"><small>正确率</small><strong>{{stats.accuracy===null?'—':(stats.accuracy*100).toFixed(1)}}</strong><span v-if="stats.accuracy!==null"> %</span></div>
    <div class="stat"><small>消除题数</small><strong data-game="correct">{{stats.correct}}</strong><span> 题</span><span class="stat-detail">正确 {{stats.characters}} 字</span></div>
    <div class="stat"><small>错误提交</small><strong>{{stats.mistakes}}</strong><span> 次</span></div>
    <div class="game-current-input"><small>{{phase==='running'&&!answerFocused?'点击游戏区继续输入':'当前输入'}}</small><span data-game="letters">{{letters||'—'}}</span></div>
  </section>
</section>
</template>
<style scoped>
.game-panel{height:100dvh;min-height:0;flex:none;overflow:hidden}.game-panel>.practice-options,.game-panel>.practice-stats{flex-shrink:0}.game-body{position:relative;flex:1;min-height:0;padding:0;overflow:hidden}.game-playfield{position:absolute;inset:0;min-width:0}.game-arena{position:absolute;inset:0;display:grid;gap:8px}.game-overlay{position:absolute;inset:0;z-index:1;display:grid;place-content:center;justify-items:center;text-align:center;padding:24px;margin:0;background:var(--overlay)}.game-alert,.game-notice{position:absolute;top:12px;left:24px;right:24px;z-index:2;margin:0}.game-notice{pointer-events:none}.game-status{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}.game-arena.paused{opacity:.5}.game-lane{position:relative;min-width:0;overflow:hidden}.game-target{position:absolute;left:0;width:100%;max-height:100%;overflow:auto;padding:4px;text-align:center;overflow-wrap:anywhere;cursor:help}.game-target strong{font:400 clamp(20px,2.5vw,36px)/1.5 "Kaiti SC","STKaiti","KaiTi","Songti SC",serif}.game-target small{display:block;color:var(--accent)}.game-answer{position:absolute;width:1px;height:1px;padding:0;border:0;overflow:hidden;clip-path:inset(50%);opacity:0}.game-current-input{display:flex;align-items:center;gap:8px;margin-left:auto;min-width:0;white-space:nowrap;cursor:text}.game-current-input small{display:inline;font-size:11px;color:var(--muted);margin:0}.game-current-input span{font:16px/1.4 ui-monospace,monospace;color:var(--accent);letter-spacing:2px}
</style>
