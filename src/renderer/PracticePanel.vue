<script setup lang="ts">
import ThemeSwitch from './ThemeSwitch.vue';
import {computed,nextTick,onMounted,onUnmounted,ref,shallowRef,watch} from 'vue';
import {Practice} from '../shared/practice';
import {Session} from '../shared/session';
import {bindAnswerInput} from '../shared/answer-input';
import {defaults,type Course,type CourseWord,type Settings,type Snapshot,type Write,type LearningWrite} from '../shared/contracts';
const props=defineProps<{visible:boolean;beforeStart?:()=>Promise<boolean>}>();
defineEmits<{home:[];'add-text':[]}>();
defineExpose({openCourse,isActive:()=>session.active,pause,finish});
function openCourse(request:Course|'graded'){const next=request==='graded'?lastGradedCourse.value:request;if(next===course.value)return;if(session.active){pause();pending.value={kind:'course',course:next};}else void changeCourse(next);}
const labels:[Course,string][]=[['1','一级简码'],['2','二级简码'],['3','三级简码'],['4','四级简码'],['5','词组'],['vocabulary','生词专项']];
const course=ref<Course>('1'),duration=ref(1),model=shallowRef<Practice>(),phase=ref('idle'),remaining=ref(60000),countdown=ref(3000);
const error=ref(''),notice=ref(''),loading=ref(false),saving=ref(false),input=ref<HTMLInputElement>(),grid=ref<HTMLElement>(),gridWidth=ref(600),inputKey=ref(0),revision=ref(0),preview=ref({total:0,covered:0,mastered:0});
const answerFocused=ref(false),lastGradedCourse=ref<Course>('1');
const pending=ref<{kind:'restart'|'course';course?:Course}>();
const dialog=ref<HTMLElement>();let beforeDialog:HTMLElement|null=null;
watch(pending,async value=>{if(value){beforeDialog=document.activeElement as HTMLElement;await nextTick();dialog.value?.querySelector('button')?.focus();}else{await nextTick();if(beforeDialog?.isConnected)beforeDialog.focus();}});
function dialogKeys(event:KeyboardEvent){
  if(event.key==='Escape'){event.preventDefault();pending.value=undefined;return;}
  if(event.key!=='Tab')return;
  const buttons=dialog.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');if(!buttons?.length)return;
  const first=buttons[0],last=buttons[buttons.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
}
let session=new Session();let queue=Promise.resolve(),disposeInput:()=>void=()=>{},unsub=()=>{},unpause=()=>{},timer:ReturnType<typeof setInterval>;
const ownRequests=new Set<string>();let mounted=true,refreshSequence=0,answerEpoch=0;
const active=computed(()=>!['idle','ended'].includes(phase.value));
const stats=computed(()=>model.value?.statistics((session.settingsSnapshot?.duration??duration.value)*60000-remaining.value));
const counts=computed(()=>model.value?{total:model.value.total,covered:model.value.covered,mastered:model.value.mastered}:preview.value);
const time=computed(()=>{const seconds=phase.value==='idle'?duration.value*60:Math.ceil(remaining.value/1000);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;});
const visibleQuestions=computed(()=>{
  if(!model.value)return [];
  const chunks:{word:string;index:number;width:number}[][]=[];let row:{word:string;index:number;width:number}[]=[],used=0;
  model.value.round.forEach((word,index)=>{const width=Math.min(gridWidth.value,Math.max(104,Array.from(word).length*44+36));if(row.length&&used+12+width>gridWidth.value){chunks.push(row);row=[];used=0;}row.push({word,index,width});used+=width+12;});if(row.length)chunks.push(row);
  return chunks.find(row=>row.some(q=>q.index===model.value!.position))??chunks[0]??[];
});
watch(input,()=>{void bind();},{flush:'post'});
// Keep one input node across answer saves so a fast next partial code survives.
// Only its position follows the current cell; pause/invalidations still clear it.
const answerPosition=ref({left:'0px',top:'0px',width:'0px'});
async function positionAnswer(){await nextTick();const slot=grid.value?.querySelector<HTMLElement>('.input-slot');if(slot&&grid.value){const outer=grid.value.getBoundingClientRect(),r=slot.getBoundingClientRect();answerPosition.value={left:`${r.left-outer.left}px`,top:`${r.top-outer.top}px`,width:`${r.width}px`};}}
watch([model,phase,()=>props.visible],()=>{void positionAnswer();},{flush:'post'});
let resize:ResizeObserver|undefined;
watch(grid,element=>{resize?.disconnect();if(element){gridWidth.value=element.clientWidth;resize=new ResizeObserver(entries=>{gridWidth.value=Math.max(104,entries[0].contentRect.width);void positionAnswer();});resize.observe(element);}});
async function bind(){await nextTick();disposeInput();if(mounted&&input.value)disposeInput=bindAnswerInput(input.value,submit,()=>{updateClock();return session.phase==='running'&&props.visible&&!pending.value;},()=>{notice.value='请使用英文状态逐键输入编码';},()=>course.value);if(input.value&&session.phase==='running'&&props.visible&&document.activeElement===document.body)input.value.focus();}
function invalidate(){disposeInput();inputKey.value++;void bind();}
function updateClock(){const old=phase.value;session.tick();phase.value=session.phase;remaining.value=session.remainingMs;countdown.value=session.countdownMs;if(old!==phase.value){if(phase.value==='ended'){invalidate();void window.typist.setSessionActive(false);}else if(phase.value==='running')void nextTick(()=>input.value?.focus());}}
function pause(){updateClock();if(!session.active)return;session.pause();phase.value=session.phase;remaining.value=session.remainingMs;countdown.value=session.countdownMs;invalidate();if(session.phase==='ended')void window.typist.setSessionActive(false);}
function resume(){if(loading.value||error.value||!props.visible)return;session.resume();phase.value=session.phase;invalidate();void nextTick(()=>input.value?.focus());}
function finish(){updateClock();if(session.phase!=='ended')session.end();phase.value='ended';invalidate();void window.typist.setSessionActive(false);}
function enqueue(task:()=>Promise<void>){queue=queue.then(task).catch(e=>{error.value=e instanceof Error?e.message:'练习操作失败。';pause();});return queue;}
async function snapshot(){const r=await window.typist.getSnapshot();if(!r.ok)throw new Error(r.error.message);revision.value=r.revision;return r.value;}
async function data():Promise<{snapshot:Snapshot;items:CourseWord[]}>{
  const state=await snapshot(),readRevision=revision.value,items:CourseWord[]=[];let total=1;
  for(let offset=0;offset<total;offset+=200){const r=await window.typist.getCourse({course:course.value,offset,limit:200});if(!r.ok)throw new Error(r.error.message);if(r.revision!==readRevision)throw new Error('读取期间词库已变化，请重新加载后重试。');items.push(...r.value.items);total=r.value.total;}
  return {snapshot:state,items};
}
async function persist(candidate:Practice){
  const request:Write<LearningWrite>={requestId:crypto.randomUUID(),expectedRevision:revision.value,value:candidate.write()};ownRequests.add(request.requestId);saving.value=true;
  try{const r=await window.typist.saveLearning(request);if(!r.ok)throw new Error(r.error.message);revision.value=r.revision;candidate.saved();}
  finally{saving.value=false;ownRequests.delete(request.requestId);}
}
async function previewLoad(){const seq=++refreshSequence;const state=await snapshot();const r=await window.typist.getCourse({course:course.value,offset:0,limit:1});if(!r.ok)throw new Error(r.error.message);if(seq!==refreshSequence)return;const records=state.learning.filter(l=>l.course===course.value);preview.value={total:r.value.total,covered:records.filter(l=>l.covered).length,mastered:records.filter(l=>l.mastered).length};if(!session.active)duration.value=state.settings.duration;}
async function refreshSource(){
  if(!model.value){await previewLoad();return;}
  const loaded=await data(),candidate=model.value.clone();const cancelled=candidate.sync(loaded.items,loaded.snapshot.learning);
  if(cancelled){session.generation++;invalidate();notice.value='当前题已失效，已取消且不计错误。';}
  if(session.active&&candidate.total)await persist(candidate);
  model.value=candidate;if(!candidate.total&&session.active){finish();notice.value='当前课程已无可练内容，本次已结束。';}
}
async function begin(){
  if(loading.value)return;if(props.beforeStart&&!await props.beforeStart())return;loading.value=true;error.value='';notice.value='';
  try{
    await queue;const loaded=await data();
    if(!loaded.items.length){notice.value='当前课程暂无内容，请先添加生词或补充词库。';return;}
    let settings:Settings={...loaded.snapshot.settings,duration:duration.value};
    if(settings.duration!==loaded.snapshot.settings.duration){const r=await window.typist.updateSettings({requestId:crypto.randomUUID(),expectedRevision:revision.value,value:settings});if(!r.ok)throw new Error(r.error.message);revision.value=r.revision;}
    const next=new Practice(course.value,loaded.items,Object.freeze({...settings}),loaded.snapshot.learning,loaded.snapshot.courseProgress.find(p=>p.course===course.value));
    await persist(next);const registered=await window.typist.setSessionActive(true);if(!registered.ok)throw new Error(registered.error.message);
    model.value=next;session.start(settings);phase.value=session.phase;remaining.value=session.remainingMs;countdown.value=session.countdownMs;invalidate();
  }catch(e){error.value=e instanceof Error?e.message:'无法开始练习。';}finally{loading.value=false;}
}
function start(){if(session.active){pause();pending.value={kind:'restart'};}else void begin();}
function chooseCourse(event:Event){const el=event.target as HTMLSelectElement,next=el.value as Course;el.value=course.value;if(next===course.value)return;if(session.active){pause();pending.value={kind:'course',course:next};}else void changeCourse(next);}
async function changeCourse(next:Course){if(next!=='vocabulary')lastGradedCourse.value=next;course.value=next;model.value=undefined;session=new Session();phase.value='idle';error.value='';notice.value='';try{await previewLoad();}catch(e){error.value=String(e);}}
async function confirm(){const action=pending.value;pending.value=undefined;if(!action)return;finish();await queue;if(action.kind==='course')await changeCourse(action.course!);else await begin();}
function submit(answer:string|null){
  updateClock();if(session.phase!=='running'||!model.value||!props.visible||pending.value)return;
  const epoch=answerEpoch,at=Date.now();notice.value='';
  void enqueue(async()=>{
    if(epoch!==answerEpoch||!model.value)return;
    const candidate=model.value.clone();if(!candidate.answer(answer,at))return;
    try{await persist(candidate);model.value=candidate;}
    catch(e){answerEpoch++;pause();error.value=e instanceof Error?e.message:'学习记录保存失败，本次答案未计入。';try{await refreshSource();}catch(recovery){error.value+=` 重新加载失败：${recovery instanceof Error?recovery.message:String(recovery)}`;}}
  });
}
async function reload(){error.value='';await enqueue(refreshSource);}
watch(()=>props.visible,value=>{if(!value)pause();});
onMounted(async()=>{
  unsub=window.typist.onChanged(event=>{
    if(ownRequests.has(event.requestId))return;
    if(event.affectedCourses.includes(course.value)){
      answerEpoch++;invalidate();
      if(model.value&&event.removedCourseWords.some(r=>r.course===course.value&&r.word===model.value!.current)){session.generation++;invalidate();}
      void enqueue(refreshSource);
    }else if(!session.active&&!model.value)void enqueue(previewLoad);
  });
  unpause=window.typist.onPause(pause);timer=setInterval(updateClock,50);await bind();try{await previewLoad();}catch(e){error.value=String(e);}
});
onUnmounted(()=>{mounted=false;clearInterval(timer);resize?.disconnect();disposeInput();unsub();unpause();});
</script>
<template>
<section class="practice-panel">
  <header class="practice-options">
    <button class="back" data-page="home" @pointerdown.capture="pause" @click="pause();$emit('home')">← 首页</button><span class="control-divider"></span>
    <select aria-label="练习课程" :value="course" @change="chooseCourse" :disabled="loading||saving"><option v-for="[id,label] in labels" :value="id">{{label}}</option></select>
    <select aria-label="练习时长" v-model.number="duration" :disabled="active||loading"><option v-for="n in 5" :value="n">{{n}} 分钟</option></select>
    <strong class="remaining" data-testid="remaining">{{time}}</strong>
    <button v-if="phase==='running'||phase==='countdown'" data-action="pause" @pointerdown.capture.prevent="pause" @click="pause">Ⅱ 暂停</button>
    <button v-if="phase==='paused'" data-action="resume" :disabled="!!error||loading||saving||!!pending" @click="resume">继续</button>
    <button v-if="active" class="back" data-action="finish" @pointerdown.capture="pause" @click="finish">结束本次</button>
    <button v-if="active" class="back restart" data-action="start" :disabled="loading||saving" @click="start">重新开始</button>
    <ThemeSwitch/>
  </header>
  <main class="practice-body">
    <div v-if="error" class="error" role="alert">{{error}} <button @click="reload">重新加载</button></div>
    <p v-if="notice" role="status" class="note">{{notice}}</p>
    <div class="round-header"><p v-if="model" class="note">第 {{model.roundNumber}} 轮 · 本组 {{model.group.length}} 题 · 连续正确 {{model.settings.threshold}} 次暂时熟练</p><span v-else class="eyebrow">{{course==='vocabulary'?'生词专项':'分级练习'}}</span><span class="phase" data-testid="phase" role="status">{{phase==='countdown'?`准备 ${Math.ceil(countdown/1000)}`:phase==='paused'?'已暂停':phase==='running'?'练习中':phase==='ended'?'本次结束':'未开始'}}</span></div>
    <div v-if="!model" class="empty-state"><h1>{{counts.total?'给专注，几分钟。':'暂无可练内容'}}</h1><p>{{counts.total?'接续已有学习进度，每一次输入都更熟悉一点。':'添加生词或补充词库后，再回来练习。'}}</p><button v-if="counts.total" class="primary" data-action="start" :disabled="loading||saving" @click="start">{{loading?'准备中…':'开始练习 →'}}</button><button v-else class="primary" @click="$emit('add-text')">添加文本 →</button></div>
    <div v-if="phase==='countdown'" class="countdown" aria-live="polite"><strong>{{Math.ceil(countdown/1000)}}</strong><p>切换至英文状态，双手放在键盘上</p></div>
    <div v-if="model&&phase!=='ended'" ref="grid" class="practice-grid" aria-label="本轮题目" :class="{paused:phase==='paused'||phase==='countdown'}">
      <div v-for="{word,index:i,width} in visibleQuestions" :key="word" class="question-cell" :style="{width:`${width}px`}" :class="{current:i===model.position,future:i>model.position}" :data-current="i===model.position?word:undefined">
        <strong class="question-word">{{word}}</strong>
        <small class="answer-code" v-if="model.feedback[i]&&!model.feedback[i].correct">{{model.items.get(word)?.join(' · ')}}</small><small v-else class="answer-code">&nbsp;</small>
        <span v-if="i===model.position&&active" class="input-slot" aria-hidden="true"></span>
        <span v-else class="answer-feedback" :class="model.feedback[i]?.correct?'correct':'incorrect'">{{model.feedback[i]?.answer||'\u00a0'}}</span>
      </div>
      <input v-if="active" id="practice-answer" :key="inputKey" ref="input" class="practice-answer" :style="answerPosition" aria-label="练习作答" @focus="answerFocused=true" @blur="answerFocused=false" :disabled="phase!=='running'||!!pending" autocomplete="off" spellcheck="false" placeholder="│">
    </div>
    <p v-if="model&&phase==='running'" class="answer-label">{{answerFocused?'英文状态逐键输入编码 · 短码按空格提交 · 空码空格跳过':'作答区未聚焦 · 点击当前题下方继续输入'}}</p>
    <div v-if="phase==='paused'" class="pause-message"><p>题目与进度已保留，继续后可直接输入。</p><button class="primary" :disabled="!!error||loading||saving||!!pending" @click="resume">继续练习 →</button></div>
    <div v-if="phase==='ended'" class="empty-state"><h1>每一次，都更熟悉一点。</h1><p>本次练习已结束，学习进度已保留。</p><button class="primary" data-action="start" :disabled="loading||saving" @click="start">再练一次 →</button></div>
    <p v-if="saving" class="note" role="status">正在保存学习进度…</p>
    <details v-if="model?.previousFeedback.length" class="previous-round"><summary>上一轮作答</summary><div class="practice-grid"><div v-for="(f,i) in model.previousFeedback" :key="i" class="question-cell"><strong class="question-word">{{f.word}}</strong><small class="answer-code">{{f.correct?'\u00a0':f.codes.join(' · ')}}</small><span class="answer-feedback" :class="f.correct?'correct':'incorrect'">{{f.answer||'\u00a0'}}</span></div></div></details>
  </main>
  <section class="practice-stats" :aria-label="phase==='ended'?'本次成绩':'本次统计'">
    <div class="stat"><small>速度</small><strong>{{stats?.speed.toFixed(1)??'0.0'}}</strong><span> 字/分钟</span></div>
    <div class="stat"><small>正确率</small><strong>{{stats?.accuracy==null?'—':(stats.accuracy*100).toFixed(1)}}</strong><span v-if="stats?.accuracy!=null"> %</span></div>
    <div class="stat"><small>已答</small><strong data-testid="answered">{{stats?.answered??0}}</strong><span>题</span><span class="stat-detail">正确 {{stats?.correct??0}} 题 · {{stats?.correctCharacters??0}} 字</span></div>
    <div class="stat coverage"><small>已练过</small><strong>{{counts.covered}} / {{counts.total}}</strong><div class="meter"><span :style="{width:`${counts.total?counts.covered/counts.total*100:0}%`}"></span></div></div>
    <div class="stat mastery"><small>暂时熟练</small><strong>{{counts.mastered}} / {{counts.total}}</strong><div class="meter"><span :style="{width:`${counts.total?counts.mastered/counts.total*100:0}%`}"></span></div></div>
  </section>
  <div v-if="pending" class="confirm-backdrop"><section ref="dialog" class="card confirm-dialog" role="dialog" @keydown="dialogKeys" aria-modal="true" aria-labelledby="practice-confirm-title"><h2 id="practice-confirm-title">结束当前一局？</h2><p>已完成的学习进度会保留，当前一局将结束。</p><div class="actions"><button @click="pending=undefined">取消</button><button class="primary" @click="confirm">{{pending.kind==='course'?'结束并切换课程':'结束并重新开始'}}</button></div></section></div>
</section>
</template>
