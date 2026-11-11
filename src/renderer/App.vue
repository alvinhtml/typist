<script setup lang="ts">
import ThemeSwitch from './ThemeSwitch.vue';
import {theme,setTheme,type Theme} from './theme';
import GamePanel from './GamePanel.vue';
import PracticePanel from './PracticePanel.vue';
import VocabularyPanel from './VocabularyPanel.vue';
import {nextTick,onMounted,onUnmounted,ref} from 'vue';
import {defaults,type Settings,type CsvKind,type CsvReport,type Course} from '../shared/contracts';
const pages=[['practice','分级练习'],['vocabulary','生词本'],['text','添加文本'],['game','打字游戏'],['settings','设置中心']];
const settingsTab=ref('preferences');
const settingsTabs=[['preferences','练习偏好'],['appearance','界面外观'],['supplemental','补充词库'],['exchange','数据交换']];
const courses:[Course,string][]=[['1','一级简码'],['2','二级简码'],['3','三级简码'],['4','四级简码'],['5','词组'],['vocabulary','生词专项']];
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
async function navigate(next:string,course?:Course|'graded'){
  if(navigating)return;
  navigating=true;
  try{page.value=next;status.value='';await nextTick();if(course)practice.value?.openCourse(course);}
  finally{navigating=false;}
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
    <header class="studio-header" v-if="!compact">
      <button class="studio-logo" data-page="home" @click="navigate('home')">typist<span>.</span></button>
      <nav aria-label="主导航"><button :class="{selected:['home','courses','practice','game'].includes(page)}" @click="navigate('home')">练习室</button><button data-page="vocabulary" :class="{selected:page==='vocabulary'}" @click="navigate('vocabulary')">生词本</button><button data-page="text" :class="{selected:page==='text'}" @click="navigate('text')">收集文字</button><button data-page="settings" :class="{selected:page==='settings'}" @click="navigate('settings')">设置</button></nav>
      <span class="studio-edition">WUBI 86<br>OFFLINE FIRST</span><ThemeSwitch/>
    </header>
    <header v-else class="studio-header"><div class="studio-logo">typist<span>.</span></div><ThemeSwitch/></header>
    <div v-if="error" role="alert" class="error app-notice">{{error}} <button @click="error='';load()">重新加载</button></div><p v-if="status" role="status" class="success app-notice">{{status}}</p>
    <main v-if="page==='home'" class="studio-home">
      <div class="studio-intro"><span class="studio-kicker">YOUR DAILY TYPE STUDIO</span><h1>从生疏，到自如。</h1></div>
      <div class="studio-hero"><div class="studio-hero-copy"><span class="studio-tag">01 / PRACTICE</span><h2>手指，也有记忆。</h2><p>从简码到词组，循序渐进。<br>留几分钟，让文字在指尖流动。</p><button class="primary" data-page="practice" @click="navigate('courses')">选择课程　↗</button><p class="note">五类课程 · 1–5 分钟 · 本机保存进度</p></div><div class="studio-art" aria-hidden="true"><div class="studio-orbit"></div><div class="studio-key">字<small>CHARACTER</small></div><div class="studio-key red">A<small>KEYSTROKE</small></div></div></div>
      <nav class="studio-tiles" aria-label="练习入口"><button class="studio-tile" data-page="words" @click="navigate('practice','vocabulary')"><span class="tile-symbol">Aa</span><span><strong>只练，还不熟的。</strong><small>生词专项 · 从自己的积累开始</small></span><span class="tile-arrow">↗</span></button><button class="studio-tile" data-page="game" @click="navigate('game')"><span class="tile-symbol">↘</span><span><strong>换一种节奏。</strong><small>下落消除 · 轻松练习编码</small></span><span class="tile-arrow">↗</span></button></nav>
    </main>
    <main v-else-if="page==='courses'" class="studio-home"><span class="studio-kicker">CHOOSE YOUR PRACTICE</span><h1>今天，从哪里开始？</h1><p>按课程独立保存覆盖与暂时熟练进度。</p><div class="studio-courses"><button v-for="([id,label],i) in courses" :key="id" @click="navigate('practice',id)"><b>{{i===4?'Aa':i===5?'＋':`0${i+1}`}}</b><strong>{{label}}</strong><small>进入课程，接续已有学习进度 ↗</small></button></div></main>
    <main v-else-if="page!=='practice'&&page!=='game'" class="management" :class="{'settings-page':page==='settings'}">
      <div v-if="page==='settings'" class="settings-intro"><span class="studio-kicker">MAKE IT YOURS</span><h1>顺手，才是好工具。</h1><p>让工具适应你的练习节奏。</p></div><nav v-if="page==='settings'" class="settings-tabs" aria-label="设置分区"><button v-for="[id,label] in settingsTabs" :key="id" :class="{selected:settingsTab===id}" :aria-pressed="settingsTab===id" @click="settingsTab=id">{{label}}</button></nav><div class="settings-content" v-if="page==='settings'">
      <section v-if="page==='settings'" v-show="settingsTab==='appearance'" class="card settings-section" aria-labelledby="appearance-heading">
        <div class="settings-section-heading"><h2 id="appearance-heading">界面外观</h2><p>选择适合当前环境的显示方式。</p></div>
        <div class="settings-form appearance-form"><label>颜色模式<select aria-label="设置颜色模式" :value="theme" @change="setTheme(($event.target as HTMLSelectElement).value as Theme)"><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></label><p class="note">切换后立即生效。跟随系统时，自动响应系统外观变化。</p></div>
      </section>
      <section v-if="page==='settings'" v-show="settingsTab==='preferences'" class="card settings-section" aria-labelledby="preferences-heading">
        <div class="settings-section-heading"><h2 id="preferences-heading">练习偏好</h2><p>统一用于所有课程，保存后从下一局生效。</p></div>
        <form class="settings-form" @submit.prevent="save">
          <label>每组题数<input v-model.number="settings.groupSize" type="number" min="5" max="100" required></label>
          <label>连续正确阈值<input v-model.number="settings.threshold" type="number" min="1" max="10" required></label>
          <label>练习时长<select v-model.number="settings.duration"><option v-for="n in 5" :value="n">{{n}} 分钟</option></select></label>
          <label>游戏难度<select v-model="settings.difficulty"><option value="easy">简单</option><option value="normal">普通</option><option value="hard">困难</option></select></label>
          <button class="primary" :disabled="!ready||busy">{{busy?'保存中…':'保存设置'}}</button>
        </form>
      </section>
      <section v-if="page==='settings'" v-show="settingsTab==='exchange'" class="card settings-section" aria-labelledby="exchange-heading">
        <div class="settings-section-heading"><h2 id="exchange-heading">CSV 导入导出</h2><p>迁移时先导入补充词库，再导入生词本。文件不包含学习进度。</p></div>
        <div class="exchange-content">
          <div v-for="kind in (['supplemental','vocabulary'] as const)" :key="kind" class="exchange-row">
            <strong>{{kind==='supplemental'?'补充词库':'生词本'}}</strong>
            <div class="actions"><button :disabled="busy||!ready" :aria-label="`导入${kind==='supplemental'?'补充词库':'生词本'} CSV`" @click="exchange(kind,true)">导入 CSV</button><button :disabled="busy||!ready" :aria-label="`导出${kind==='supplemental'?'补充词库':'生词本'} CSV`" @click="exchange(kind,false)">导出 CSV</button></div>
          </div>
          <div v-if="csvReport" class="csv-report" role="status"><p>新增 {{csvReport.added}} · 重复忽略 {{csvReport.duplicates}} · 失败 {{csvReport.failed}}</p><details v-if="csvReport.issues.length"><summary>查看行级原因</summary><p v-for="(issue,i) in csvReport.issues" :key="i">第 {{issue.line}} 行：{{issue.reason}}</p></details></div>
        </div>
      </section>
      <VocabularyPanel v-if="page==='settings'" v-show="settingsTab==='supplemental'" mode="supplemental"/>
      </div>
      <VocabularyPanel v-if="page==='text'||page==='vocabulary'" :key="page" :mode="page==='text'?'text':'vocabulary'"/>

    </main>
    <GamePanel v-if="!compact" ref="game" v-show="page==='game'" :visible="page==='game'" :before-start="beforeGame" @home="navigate('home')"/>
    <PracticePanel :before-start="beforePractice" v-if="!compact" ref="practice" v-show="page==='practice'" :visible="page==='practice'" @home="navigate('home')" @add-text="navigate('text')"/>
    <footer v-if="page!=='practice'&&page!=='game'" class="app-footer"><span><span class="offline-dot">●</span> 本机存储 · 离线可用</span><button v-if="!compact" class="back" @click="openText">打开文本小窗口 ↗</button><span v-else>关闭窗口后可从托盘重新打开</span></footer>
  </div>
</template>
