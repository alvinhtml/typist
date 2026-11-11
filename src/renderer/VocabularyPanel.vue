<script setup lang="ts">
import {computed,onMounted,onUnmounted,ref,watch} from 'vue';
import type {Entry,Pair,Result,Snapshot,SupplementalOperation,TextAddition} from '../shared/contracts';
const props=defineProps<{mode:'text'|'vocabulary'|'supplemental'}>();
const snapshot=ref<Snapshot>(),revision=ref(0),busy=ref(false),error=ref(''),status=ref('');
const text=ref(''),result=ref<TextAddition>(),query=ref(''),offset=ref(0);
const selectedWords=ref<string[]>([]),selectedPairs=ref<string[]>([]);
const entry=ref<Entry>({word:'',code:'',level:1}),editing=ref<Pair>();
const labels=['一级简码','二级简码','三级简码','四级','词组'];
const key=(p:Pair)=>JSON.stringify([p.word,p.code]);
const grouped=computed(()=>{const map=new Map<string,string[]>();for(const p of snapshot.value?.vocabulary??[]){const codes=map.get(p.word)??[];codes.push(p.code);map.set(p.word,codes);}return [...map].map(([word,codes])=>({word,codes}));});
const rows=computed(()=>props.mode==='supplemental'?(snapshot.value?.supplemental??[]):grouped.value);
const filtered=computed(()=>rows.value.filter(r=>r.word.includes(query.value)||('code'in r?String(r.code):r.codes.join(' ')).includes(query.value)));
const visible=computed(()=>filtered.value.slice(offset.value,offset.value+100));
watch(()=>filtered.value.length,n=>{if(offset.value>=n)offset.value=Math.max(0,Math.floor((n-1)/100)*100);});
const added=computed(()=>{const map=new Map<string,string[]>();for(const p of result.value?.addedPairs??[]){const codes=map.get(p.word)??[];codes.push(p.code);map.set(p.word,codes);}return [...map];});
let unsubscribe=()=>{};
async function load(){const r=await window.typist.getSnapshot();if(r.ok){snapshot.value=r.value;revision.value=r.revision;}else error.value=r.error.message;}
async function run<T>(action:()=>Promise<Result<T>>,success:(value:T)=>void){if(busy.value)return;busy.value=true;error.value='';status.value='';try{const r=await action();if(r.ok){revision.value=r.revision;success(r.value);selectedWords.value=[];selectedPairs.value=[];await load();}else{error.value=r.error.message;if(r.error.code==='CONFLICT')await load();}}catch{error.value='无法连接本机数据服务，请重新加载后重试。';}finally{busy.value=false;}}
const request=<T,>(value:T)=>({requestId:crypto.randomUUID(),expectedRevision:revision.value,value});
async function add(){await run(()=>window.typist.addVocabularyText(request(text.value)),value=>{result.value=value;});}
async function saveEntry(){const value:SupplementalOperation=editing.value?{kind:'update',oldPair:{...editing.value},entry:{...entry.value}}:{kind:'add',entry:{...entry.value}};await run(()=>window.typist.mutateSupplemental(request([value])),value=>{status.value=value.merged?'已存在，已合并。':'补充词库已保存，可立即用于识别。';resetEntry();});}
function resetEntry(){editing.value=undefined;entry.value={word:'',code:'',level:1};}
function edit(row:Entry){editing.value={word:row.word,code:row.code};entry.value={...row};}
async function removeSupplemental(pairs:Pair[]){await run(()=>window.typist.mutateSupplemental(request(pairs.map(pair=>({kind:'delete' as const,pair})))),()=>{status.value='补充词条已删除，生词及课程记录已按最终词库同步。';resetEntry();});}
async function removeVocabulary(pairs:Pair[],words:string[]=[]){await run(()=>window.typist.deleteVocabulary(request({pairs:pairs.map(pair=>({...pair})),words:[...words]})),value=>{status.value=`已删除 ${value.removedPairs.length} 个生词组合。`;});}
function decode(keys:string[]):Pair[]{return keys.map(k=>{const [word,code]=JSON.parse(k);return {word,code};});}
onMounted(async()=>{unsubscribe=window.typist.onChanged(()=>{void load();});try{await load();}catch{error.value='无法连接本机数据服务。';}});
onUnmounted(()=>unsubscribe());
</script>
<template>
<section class="card business" :class="{'settings-section':mode==='supplemental','vocabulary-page':mode==='vocabulary','text-page':mode==='text'}">
  <div v-if="error" class="error" role="alert">{{error}} <button @click="error='';load()">重新加载</button></div>
  <p v-if="status" class="success" role="status">{{status}}</p>
  <template v-if="mode==='text'">
    <template v-if="!result"><span class="studio-kicker">CAPTURE &amp; KEEP</span><h1>遇见生词，留下它。</h1><p>优先识别最长词组，单字兜底。重复添加保留学习进度。</p><form @submit.prevent="add"><textarea v-model="text" aria-label="添加文本" placeholder="粘贴一段文字，或写下刚刚遇见的词…" rows="9" maxlength="100000"></textarea><button class="primary" :disabled="busy||!snapshot||!text.trim()">{{busy?'添加中…':'添加到生词本'}}</button></form></template>
    <template v-else><h2>本次添加结果</h2><p role="status">新增 {{result.addedPairs.length}} 个组合 · 重复 {{result.duplicateOccurrences}} 次</p><ul class="result-list"><li v-for="[word,codes] in added" :key="word"><strong>{{word}}</strong><code>{{codes.join(' · ')}}</code></li></ul><p v-if="!added.length">本次没有新增生词。</p><p v-if="result.unknownDistinct.length">未识别：{{result.unknownDistinct.join('、')}}</p><button class="primary" @click="result=undefined;text=''">继续添加</button></template>
  </template>
  <template v-else>
    <div class="settings-section-heading"><h2>{{mode==='supplemental'?'补充词库':'生词本'}}<span v-if="mode==='vocabulary'" class="vocabulary-total">{{grouped.length}} 个文字</span></h2><p>{{mode==='supplemental'?'新增补充词条不会自动加入生词本；内置词库只读。':'那些值得再练的字，收在这里。保留全部有效编码。'}}</p></div>
    <form class="settings-form" v-if="mode==='supplemental'" @submit.prevent="saveEntry">
      <label>文字<input v-model="entry.word" :disabled="!!editing" maxlength="200" required aria-label="补充文字"></label>
      <label>编码<input v-model="entry.code" maxlength="20" required aria-label="补充编码"></label>
      <label>分类<select v-model.number="entry.level"><option v-for="(label,i) in labels" :value="i+1">{{label}}</option></select></label>
      <p class="note">一级至四级：单字及对应长度编码；词组：至少两字、1～4 位字母编码。</p>
      <div class="actions"><button class="primary" :disabled="busy||!snapshot">{{editing?'保存修改':'添加词条'}}</button><button v-if="editing" type="button" @click="resetEntry">取消修改</button></div>
    </form>
    <div v-if="mode==='vocabulary'" class="vocabulary-toolbar">
      <label class="vocabulary-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><input v-model="query" aria-label="搜索文字或编码" placeholder="搜索文字或编码" @input="offset=0"></label>
      <div class="vocabulary-bulk"><span v-if="query" class="note">找到 {{filtered.length}} 个文字</span><button class="danger" :disabled="busy||!selectedWords.length" @click="removeVocabulary([],selectedWords)">删除选中<span v-if="selectedWords.length">（{{selectedWords.length}}）</span></button></div>
    </div>
    <div v-else class="list-toolbar"><input v-model="query" aria-label="搜索文字或编码" placeholder="搜索文字或编码" @input="offset=0"><span>{{filtered.length}} {{mode==='supplemental'?'个组合':'个文字'}}</span></div>
    <div class="actions" v-if="mode==='supplemental'"><button class="danger" :disabled="busy||!selectedPairs.length" @click="removeSupplemental(decode(selectedPairs))">删除选中组合（{{selectedPairs.length}}）</button></div>

    <p v-if="!filtered.length" :class="{'vocabulary-empty':mode==='vocabulary'}">{{query?'没有匹配内容。':'暂无条目。'}}</p>
    <ul class="entry-list">
      <li v-for="row in visible" :key="'code'in row?key(row):row.word">
        <template v-if="'code'in row">
          <label class="choice"><input type="checkbox" v-model="selectedPairs" :value="key(row)"><strong>{{row.word}}</strong></label><code>{{row.code}}</code><span>{{labels[row.level-1]}}</span><div class="actions"><button :disabled="busy" @click="edit(row)">修改</button><button class="danger" :disabled="busy" @click="removeSupplemental([row])">删除</button></div>
        </template>
        <template v-else>
          <div class="word-heading">
            <div class="vocabulary-content"><label class="choice"><input type="checkbox" v-model="selectedWords" :value="row.word" :aria-label="`选择${row.word}`"><strong>{{row.word}}</strong></label><code class="vocabulary-codes" :aria-label="`${row.word} 的编码`">{{row.codes.join(' · ')}}</code></div>
            <button class="danger vocabulary-delete" :disabled="busy" :aria-label="`删除${row.word}及全部编码`" @click="removeVocabulary([],[row.word])"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6"/></svg><span>删除</span></button>
          </div>
        </template>
      </li>
    </ul>
    <div class="actions" v-if="filtered.length>100"><button :disabled="offset===0" @click="offset=Math.max(0,offset-100)">上一页</button><span>第 {{Math.floor(offset/100)+1}} 页</span><button :disabled="offset+100>=filtered.length" @click="offset+=100">下一页</button></div>
  </template>
</section>
</template>
