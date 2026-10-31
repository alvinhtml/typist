<script setup lang="ts">
import {onMounted,onUnmounted,ref} from 'vue';
import {defaults,type Settings} from '../shared/contracts';
const pages=[['practice','分级练习'],['vocabulary','生词本'],['text','添加文本'],['game','打字游戏'],['settings','设置中心']];
const compact=location.hash==='#text';
const page=ref(compact?'text':'practice');const error=ref('');const status=ref('');const revision=ref(0);const ready=ref(false);const busy=ref(false);
const settings=ref<Settings>({...defaults});const resources=ref<{level:number;bytes:number}[]>([]);const draft=ref('');
let cleanup:()=>void=()=>{};
async function load(){try{const result=await window.typist.getSnapshot();if(!result.ok){error.value=result.error.message;return;}settings.value={...result.value.settings};revision.value=result.revision;ready.value=true;}catch{error.value='无法连接本机数据服务。';}}
async function save(){busy.value=true;error.value='';status.value='';try{const result=await window.typist.updateSettings({requestId:crypto.randomUUID(),expectedRevision:revision.value,value:{...settings.value}});if(result.ok){revision.value=result.revision;status.value='设置已保存，下次开始时生效。';}else{error.value=result.error.message;if(result.error.code==='CONFLICT')await load();}}catch{error.value='保存失败，请重新加载后重试。';}finally{busy.value=false;}}
async function openText(){const r=await window.typist.openText();if(!r.ok)error.value=r.error.message;}
onMounted(async()=>{cleanup=window.typist.onChanged(()=>{void load();});await load();const r=await window.typist.getResources();if(r.ok)resources.value=r.value;else error.value=r.error.message;});
onUnmounted(()=>cleanup());
</script>
<template>
  <div class="shell" :class="{compact}">
    <aside v-if="!compact"><div class="brand">字<span>Typist</span></div><p class="tagline">每天一点，熟能生巧</p><nav><button v-for="[id,label] in pages" :key="id" :class="{active:page===id}" @click="page=id;status=''">{{label}}</button></nav><button class="tray-link" @click="openText">打开文本小窗口 ↗</button></aside>
    <main><header><span class="eyebrow">五笔 86 · 离线练习</span><h1>{{pages.find(p=>p[0]===page)?.[1]}}</h1></header>
      <div v-if="error" role="alert" class="error">{{error}} <button @click="error='';load()">重新加载</button></div><p v-if="status" role="status" class="success">{{status}}</p>
      <section v-if="page==='settings'" class="card"><h2>练习偏好</h2><p>统一用于所有课程，下次开始时生效。</p><form @submit.prevent="save"><label>每组题数<input v-model.number="settings.groupSize" type="number" min="5" max="100" required></label><label>连续正确阈值<input v-model.number="settings.threshold" type="number" min="1" max="10" required></label><label>练习时长<select v-model.number="settings.duration"><option v-for="n in 5" :value="n">{{n}} 分钟</option></select></label><label>游戏难度<select v-model="settings.difficulty"><option value="easy">简单</option><option value="normal">普通</option><option value="hard">困难</option></select></label><button class="primary" :disabled="!ready||busy">{{busy?'保存中…':'保存设置'}}</button></form></section>
      <section v-else-if="page==='practice'" class="card"><h2>选择你的课程</h2><div class="courses"><div v-for="r in resources" class="course"><strong>{{r.level===5?'词组':`${r.level} 级简码`}}</strong><span>内置词库已读取</span></div></div><p class="note">练习功能将在阶段 3 接入。</p></section>
      <section v-else-if="page==='text'" class="card"><h2>积累想练习的文字</h2><p>在此粘贴文本，后续可添加到生词本。</p><textarea v-model="draft" placeholder="粘贴或输入文字" rows="9"></textarea><button class="primary" disabled>添加功能将在阶段 2 接入</button></section>
      <section v-else class="card"><h2>{{page==='game'?'让文字变成练习的乐趣':'你的专属练习词库'}}</h2><p>{{page==='game'?'下落消除游戏将在阶段 5 接入。':'生词查看与管理将在阶段 2 接入。'}}</p></section>
      <footer>数据保存在本机 · 关闭窗口后可从托盘重新打开</footer>
    </main>
  </div>
</template>
