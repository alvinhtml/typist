<script setup lang="ts">
import ThemeSwitch from './ThemeSwitch.vue';
import {theme,setTheme,type Theme} from './theme';
import GamePanel from './GamePanel.vue';
import PracticePanel from './PracticePanel.vue';
import VocabularyPanel from './VocabularyPanel.vue';
import {nextTick,onMounted,onUnmounted,ref} from 'vue';
import {defaults,type Settings,type CsvKind,type CsvReport} from '../shared/contracts';
const pages=[['practice','分级练习'],['vocabulary','生词本'],['text','添加文本'],['game','打字游戏'],['settings','设置中心']];
const compact=location.hash==='#text';
const page=ref(compact?'text':'home');const error=ref('');const status=ref('');const revision=ref(0);const ready=ref(false);const busy=ref(false);
const settings=ref<Settings>({...defaults});const resources=ref<{level:number;bytes:number}[]>([]);
const practice=ref<InstanceType<typeof PracticePanel>>();
const csvReport=ref<CsvReport|null>(null);
async function exchange(kind:CsvKind, importing:boolean){busy.value=true;error.value='';status.value='';csvReport.value=null;try{if(importing){const r=await window.typist.importCsv({requestId:crypto.randomUUID(),expectedRevision:revision.value,value:kind});if(r.ok){csvReport.value=r.value;await load();}else if(r.error.code!=='CANCELLED'){error.value=r.error.message;if(r.error.code==='CONFLICT')await load();}}else{const r=await window.typist.exportCsv(kind);if(r.ok)status.value=`已导出 ${r.value.count} 个编码组合。`;else if(r.error.code!=='CANCELLED')error.value=r.error.message;}}catch{error.value='文件交换失败，请重试。';}finally{busy.value=false;}}
const game=ref<InstanceType<typeof GamePanel>>();
async function beforeGame(){if(practice.value?.isActive()){practice.value.pause();if(!window.confirm('结束当前练习并开始游戏？'))return false;practice.value.finish();}return true;}
async function beforePractice(){if(game.value?.isActive()){game.value.pause();if(!window.confirm('结束当前游戏并开始练习？'))return false;game.value.finish();}return true;}
let navigating=false;
async function navigate(next:string,course?:'vocabulary'|'graded'){
  if(navigating)return;
  navigating=true;
  try{page.value=next;status.value='';await nextTick();if(course)practice.value?.openCourse(course);}
  finally{navigating=false;}
}
function glow(event:PointerEvent){const el=event.currentTarget as HTMLElement,r=el.getBoundingClientRect();el.style.setProperty('--mx',`${event.clientX-r.left}px`);el.style.setProperty('--my',`${event.clientY-r.top}px`);}
function ripple(event:PointerEvent){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const el=event.currentTarget as HTMLElement,r=el.getBoundingClientRect(),dot=document.createElement('span');dot.className='menu-ripple';dot.style.left=`${event.clientX-r.left}px`;dot.style.top=`${event.clientY-r.top}px`;el.append(dot);dot.addEventListener('animationend',()=>dot.remove(),{once:true});
}
let cleanup:()=>void=()=>{};
async function load(){try{const result=await window.typist.getSnapshot();if(!result.ok){error.value=result.error.message;return;}settings.value={...result.value.settings};revision.value=result.revision;ready.value=true;}catch{error.value='无法连接本机数据服务。';}}
async function save(){busy.value=true;error.value='';status.value='';try{const result=await window.typist.updateSettings({requestId:crypto.randomUUID(),expectedRevision:revision.value,value:{...settings.value}});if(result.ok){revision.value=result.revision;status.value='设置已保存，下次开始时生效。';}else{error.value=result.error.message;if(result.error.code==='CONFLICT')await load();}}catch{error.value='保存失败，请重新加载后重试。';}finally{busy.value=false;}}
async function openText(){const r=await window.typist.openText();if(!r.ok)error.value=r.error.message;}
onMounted(async()=>{cleanup=window.typist.onChanged(()=>{void load();});await load();const r=await window.typist.getResources();if(r.ok)resources.value=r.value;else error.value=r.error.message;});
onUnmounted(()=>cleanup());
</script>
<template>
  <div class="shell" :class="{compact,'practice-shell':page==='practice'||page==='game'}">
    <header v-if="page==='home'" class="home-header"><div class="brand"><span class="brand-mark">字</span>Typist</div><span class="edition">五笔 86 · 每天一点，熟能生巧</span><ThemeSwitch/></header>
    <header v-else-if="page!=='practice'&&page!=='game'" class="page-header"><button v-if="!compact" class="back" data-page="home" @click="navigate('home')">← 首页</button><div class="brand"><span class="brand-mark">字</span>Typist</div><span class="edition">{{pages.find(p=>p[0]===page)?.[1]}}</span><ThemeSwitch/></header>
    <div v-if="error" role="alert" class="error app-notice">{{error}} <button @click="error='';load()">重新加载</button></div><p v-if="status" role="status" class="success app-notice">{{status}}</p>
    <main v-if="page==='home'" class="home-center">
      <div class="home-intro"><span class="home-kicker">DAILY PRACTICE</span><p class="home-caption">选择一种练习，进入专注时刻<span>从记住一个编码，到自然落下每一笔。</span></p></div>
      <nav class="home-entries" aria-label="练习入口">
        <button class="menu-entry featured" data-page="practice" @pointermove="glow" @pointerdown="ripple" @click="navigate('practice','graded')"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 9h1m4 0h1m4 0h1M6 12h1m4 0h1m4 0h1M7 16h10"/></svg><span class="entry-index">01 / PRACTICE</span><strong>分级练习</strong><small>从简码到词组，循序练习</small><span class="entry-arrow">↗</span></button>
        <button class="menu-entry" data-page="words" @pointermove="glow" @pointerdown="ripple" @click="navigate('practice','vocabulary')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v16M12 5C9 2 4 3 2 4v15c4-2 8-1 10 2 2-3 6-4 10-2V4c-2-1-7-2-10 1Z"/></svg><span class="entry-index">02 / VOCABULARY</span><strong>生词练习</strong><small>回到还不够熟悉的文字</small><span class="entry-arrow">↗</span></button>
        <button class="menu-entry" data-page="game" @pointermove="glow" @pointerdown="ripple" @click="navigate('game')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10c4 0 6 13 3 13-2 0-4-4-5-4H9c-1 0-3 4-5 4C1 20 3 7 7 7ZM7 10v5m-2-2h4m6-2h1m2 3h1"/></svg><span class="entry-index">03 / PLAY</span><strong>打字游戏</strong><small>下落消除 · 编码挑战</small><span class="entry-arrow">↗</span></button>
      </nav>
      <nav class="secondary-menu" aria-label="管理功能"><button data-page="vocabulary" @click="navigate('vocabulary')">生词本</button><button data-page="text" @click="navigate('text')">添加文本</button><button data-page="settings" @click="navigate('settings')">设置中心</button></nav>
    </main>
    <main v-else-if="page!=='practice'&&page!=='game'" class="management" :class="{'settings-page':page==='settings'}">
      <div v-if="page==='settings'" class="settings-intro"><h1>设置中心</h1><p>调整练习习惯，让每一次输入更适合你。</p></div>
      <section v-if="page==='settings'" class="card settings-section" aria-labelledby="appearance-heading">
        <div class="settings-section-heading"><h2 id="appearance-heading">界面外观</h2><p>选择适合当前环境的显示方式。</p></div>
        <div class="settings-form appearance-form"><label>颜色模式<select aria-label="设置颜色模式" :value="theme" @change="setTheme(($event.target as HTMLSelectElement).value as Theme)"><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></label><p class="note">切换后立即生效。跟随系统时，自动响应系统外观变化。</p></div>
      </section>
      <section v-if="page==='settings'" class="card settings-section" aria-labelledby="preferences-heading">
        <div class="settings-section-heading"><h2 id="preferences-heading">练习偏好</h2><p>统一用于所有课程，保存后从下一局生效。</p></div>
        <form class="settings-form" @submit.prevent="save">
          <label>每组题数<input v-model.number="settings.groupSize" type="number" min="5" max="100" required></label>
          <label>连续正确阈值<input v-model.number="settings.threshold" type="number" min="1" max="10" required></label>
          <label>练习时长<select v-model.number="settings.duration"><option v-for="n in 5" :value="n">{{n}} 分钟</option></select></label>
          <label>游戏难度<select v-model="settings.difficulty"><option value="easy">简单</option><option value="normal">普通</option><option value="hard">困难</option></select></label>
          <button class="primary" :disabled="!ready||busy">{{busy?'保存中…':'保存设置'}}</button>
        </form>
      </section>
      <section v-if="page==='settings'" class="card settings-section" aria-labelledby="exchange-heading">
        <div class="settings-section-heading"><h2 id="exchange-heading">CSV 导入导出</h2><p>迁移时先导入补充词库，再导入生词本。文件不包含学习进度。</p></div>
        <div class="exchange-content">
          <div v-for="kind in (['supplemental','vocabulary'] as const)" :key="kind" class="exchange-row">
            <strong>{{kind==='supplemental'?'补充词库':'生词本'}}</strong>
            <div class="actions"><button :disabled="busy||!ready" :aria-label="`导入${kind==='supplemental'?'补充词库':'生词本'} CSV`" @click="exchange(kind,true)">导入 CSV</button><button :disabled="busy||!ready" :aria-label="`导出${kind==='supplemental'?'补充词库':'生词本'} CSV`" @click="exchange(kind,false)">导出 CSV</button></div>
          </div>
          <div v-if="csvReport" class="csv-report" role="status"><p>新增 {{csvReport.added}} · 重复忽略 {{csvReport.duplicates}} · 失败 {{csvReport.failed}}</p><details v-if="csvReport.issues.length"><summary>查看行级原因</summary><p v-for="(issue,i) in csvReport.issues" :key="i">第 {{issue.line}} 行：{{issue.reason}}</p></details></div>
        </div>
      </section>
      <VocabularyPanel v-if="page==='settings'" mode="supplemental"/>
      <VocabularyPanel v-if="page==='text'||page==='vocabulary'" :key="page" :mode="page==='text'?'text':'vocabulary'"/>

    </main>
    <GamePanel v-if="!compact" ref="game" v-show="page==='game'" :visible="page==='game'" :before-start="beforeGame" @home="navigate('home')"/>
    <PracticePanel :before-start="beforePractice" v-if="!compact" ref="practice" v-show="page==='practice'" :visible="page==='practice'" @home="navigate('home')" @add-text="navigate('text')"/>
    <footer v-if="page!=='practice'&&page!=='game'" class="app-footer"><span><span class="offline-dot">●</span> 本机存储 · 离线可用</span><button v-if="!compact" class="back" @click="openText">打开文本小窗口 ↗</button><span v-else>关闭窗口后可从托盘重新打开</span></footer>
  </div>
</template>
