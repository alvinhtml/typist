<script setup lang="ts">
import {ref,computed,nextTick,onMounted,onUnmounted} from 'vue';
const mode=ref('practice'), running=ref(false), epoch=ref(0), input=ref<HTMLInputElement>();
const ime=ref(''), system=ref(''), notes=ref(''), logs=ref<object[]>([]), answers=ref<string[]>([]);
const steps = [
 {title:'用空格选出一个字',mode:'practice',action:'切换到你平时用的五笔输入法。点击「开始本步」，输入你熟悉的一个字的编码（例如「我」通常是 q）。候选框出现后按空格选字。若你的输入法自动上屏，请在备注说明。',expected:'下方只新增 1 条文字，例如「我」；不能多出「跳过」。',sample:'我'},
 {title:'连续输入两个相同词组',mode:'practice',action:'点击「开始本步」，用输入法完整提交「学习」，再完整提交一次「学习」。可换成你会打的任意词组，写在备注里。不要复制粘贴，也不要逐字提交。',expected:'恰好 2 条记录，每条都是完整词组，不是拆开的单字。',sample:'学习'},
 {title:'用数字和鼠标选候选字',mode:'practice',action:'先输入一个会出现多个候选字的编码，用数字键选择候选。再输入一次编码，这次点击候选窗口中的文字。如果没有数字选字功能，可以标记「暂不测试」并说明。',expected:'两次各记录一个选中的文字；数字不单独记录，点击候选窗不应让页面暂停。',sample:'任选熟悉的字'},
 {title:'直接按空格（普通练习）',mode:'practice',action:'切换到英文输入状态，点击「开始本步」，不要输入字母，只按一次空格。',expected:'只有 1 条「跳过」记录。',sample:'按一次空格'},
 {title:'直接按空格（游戏）',mode:'game',action:'保持英文输入状态，点击「开始本步」，只按一次空格。此步已自动切换到游戏模式。',expected:'记录数保持 0，不出现「跳过」。',sample:'按一次空格'},
 {title:'试着粘贴文字',mode:'practice',action:'先选中并复制这里的示例「学习」。再点击「开始本步」，在作答框内按 Command + V。',expected:'出现「请使用输入法作答」，记录数保持 0。',sample:'学习'},
 {title:'输入一半时暂停',mode:'practice',action:'切回五笔，点击「开始本步」。输入部分编码，候选框出现后不要选字，点击「暂停」。再点「继续本步」，重新输入一个字并选字。',expected:'暂停前未提交的内容不补判；继续后仅记录新提交的一个字。',sample:'任选熟悉的字'},
 {title:'切换窗口再回来',mode:'practice',action:'点击「开始本步」，输入部分编码但不要选字。用 Command + Tab 切到其他应用，再切回来。确认页面暂停，然后点「继续本步」输入一个字。',expected:'回来时保持暂停，旧输入没有记录；继续后新提交记录一次。',sample:'任选熟悉的字'},
 {title:'看看文字和布局',mode:'practice',action:'观察下面的视觉样例，再把窗口拖窄、放宽。检查长词是否完整、罕见字是否变成方框，以及上下两行是否仍对齐。不需要在作答框输入。',expected:'普通字与长词清晰、无裁切和重叠；罕见字若是方框请标记异常。这里只检查样例，不代表最终业务页面已验收。',sample:'视觉检查'}
];
const stepIndex=ref(0),step=computed(()=>steps[stepIndex.value]!);
const outcomes=ref<Record<number,{status:string,note:string,answers:string[]}>>({});
const notice=ref('');
async function begin(){answers.value=[];notice.value='';mode.value=step.value.mode;await reset(true);}
async function move(index:number){stepIndex.value=index;await reset(false);answers.value=[];notes.value=outcomes.value[index]?.note || '';notice.value='';}
async function mark(status:string){outcomes.value[stepIndex.value]={status,note:notes.value,answers:[...answers.value]};await reset(false);}
let composing=false;
function record(e:Event){const i=e as InputEvent,k=e as KeyboardEvent; logs.value.push({at:performance.now(),epoch:epoch.value,step:stepIndex.value,type:e.type,data:i.data,inputType:i.inputType,isComposing:i.isComposing,key:k.key,trusted:e.isTrusted,value:(e.target as HTMLInputElement)?.value,running:running.value});}
function submit(value:string){if(!running.value||!value)return;if(value===' '&&mode.value==='game')return;answers.value.push(value===' '?'[跳过]':value);}
function bind(el:HTMLInputElement){const generation=epoch.value;
 for(const type of ['keydown','keyup','beforeinput','input','compositionstart','compositionupdate','compositionend','paste','blur','focus','drop'])el.addEventListener(type,e=>{
 record(e);if(generation!==epoch.value)return;
 const ev=e as InputEvent;
 if(e.type==='paste'||e.type==='drop'||(e.type==='beforeinput'&&['insertFromPaste','insertFromDrop'].includes(ev.inputType))){e.preventDefault();notice.value='请使用输入法作答';return;}
 if(e.type==='compositionstart')composing=true;
 if(e.type==='compositionend'){
 composing=false;
 // macOS can end composition before delivering the pointer event that cancels it.
 // Experimental 50 ms grace period; real IME regression remains required.
 const value=el.value;el.value='';
 setTimeout(()=>{if(generation===epoch.value)submit(value);},50);
 }
 if(e.type==='input'&&!composing&&!ev.isComposing&&ev.inputType!=='insertCompositionText'){submit(el.value);el.value='';}
 });}
async function reset(active:boolean){running.value=false;const generation=++epoch.value;composing=false;await nextTick();if(generation!==epoch.value)return;if(input.value)bind(input.value);running.value=active;if(active)input.value?.focus();}
function pause(e:Event){
 logs.value.push({at:performance.now(),epoch:epoch.value,step:stepIndex.value,type:'pause-intent',event:e.type,running:running.value});
 // Invalidate before the pointer's default focus change can end composition.
 if(running.value)void reset(false);
}
function blur(){logs.value.push({at:performance.now(),type:'window-blur'});void reset(false);}
function exportLog(){const url=URL.createObjectURL(new Blob([JSON.stringify({system:system.value,ime:ime.value,userAgent:navigator.userAgent,notes:notes.value,step:stepIndex.value,outcomes:outcomes.value,mode:mode.value,answers:answers.value,logs:logs.value},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='ime-observation.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
onMounted(()=>{if(input.value)bind(input.value);window.addEventListener('blur',blur);});onUnmounted(()=>window.removeEventListener('blur',blur));
</script>
<template>
<main><header><p class="eyebrow">阶段 0 · macOS 人工检查</p><h1>跟着步骤检查输入法</h1><p>不用看代码或事件日志。每一步照着做，再告诉我们实际结果。约需 5～10 分钟。</p></header>
<details class="setup"><summary>先选好输入法（信息不知道可以留空）</summary><p>点击 macOS 顶部菜单栏的输入法图标，选择你平时使用的五笔。系统版本可从苹果菜单 → 关于本机查看。</p><label>系统版本（选填）<input v-model="system" placeholder="例如：macOS 26，Apple 芯片"></label><label>输入法名称/版本（选填）<input v-model="ime" placeholder="例如：系统五笔；不知道版本可不填"></label></details>
<div class="layout"><nav aria-label="验收步骤"><button v-for="(item,i) in steps" :key="i" :class="{selected:i===stepIndex}" @click="move(i)">{{i+1}}. {{item.title}} <small>{{outcomes[i]?.status || '未检查'}}</small></button></nav>
<section><p class="eyebrow">第 {{stepIndex+1}} / {{steps.length}} 步 · {{step.mode==='game'?'游戏模式':'普通模式'}}</p><h2>{{step.title}}</h2><h3>怎么做</h3><p>{{step.action}}</p><div class="expected"><strong>应该看到</strong><p>{{step.expected}}</p></div>
<template v-if="stepIndex!==8"><p>本步输入示例：<strong class="sample">{{step.sample}}</strong></p><div class="actions"><button data-testid="start" class="primary" @click="begin">开始本步（清空记录）</button><button data-testid="pause" @pointerdown.capture.prevent="pause" @click="pause">暂停</button><button @click="reset(true)">继续本步</button><span>{{running?'可以输入':'已暂停'}}</span></div><label for="answer">作答框 · {{running?'在这里输入上面的示例':'先点击「开始本步」'}}</label><input id="answer" :key="epoch" ref="input" class="answer" :disabled="!running" placeholder="先开始本步，再用输入法输入"><p role="status">{{notice}}</p><div class="records"><strong>本步收到 {{answers.length}} 次提交</strong><p v-if="!answers.length">暂无记录</p><ol v-else><li v-for="(answer,i) in answers" :key="i">{{answer}}</li></ol></div></template>
<div v-else class="visual"><div v-for="word in ['我','学习','中华人民共和国','𠮷','𠀀']" :key="word"><strong>{{word}}</strong><p class="correct">{{word}}</p></div></div>
<label>哪里不一样？（选填）<textarea v-model="notes" placeholder="例如：按空格选字后，出现了一个字和一次跳过。" /></label><div class="actions"><button @click="mark('符合预期')">符合预期</button><button @click="mark('发现异常')">发现异常</button><button @click="mark('暂不测试')">暂不测试</button></div><p>本步结果：{{outcomes[stepIndex]?.status || '尚未记录'}}。点选结果后，可点击左侧下一步。</p></section></div>
<footer><strong>已记录 {{Object.keys(outcomes).length}} / {{steps.length}} 项</strong><button class="primary" @click="exportLog">导出验收记录</button><p>检查完后导出 JSON 文件交给开发者；关闭窗口前请先导出。记录只保存在当前窗口中。</p></footer>
<details><summary>开发者用：原始事件（无需阅读）</summary><pre>{{JSON.stringify(logs.slice(-30),null,2)}}</pre></details>
</main></template>
<style>
*{box-sizing:border-box}body{margin:0;font:16px/1.6 system-ui;background:#f3f5f8;color:#213047}main{max-width:1120px;margin:auto;padding:28px}h1{margin:0;font-size:30px}h2{margin-top:0}h3{font-size:16px;margin-bottom:4px}.eyebrow{color:#536b8b;font-size:13px;letter-spacing:.06em}.setup,section,footer{background:white;border:1px solid #dce3ec;border-radius:12px;padding:20px;margin:18px 0}.layout{display:grid;grid-template-columns:230px minmax(0,1fr);gap:20px}nav{padding-top:18px}button,input,textarea{font:inherit}button{border:1px solid #b8c7da;border-radius:8px;background:white;padding:8px 12px;cursor:pointer;color:inherit}button:hover{background:#edf3fc}nav button{display:block;width:100%;text-align:left;margin:0 0 8px}small{display:block;color:#65758c}.selected{background:#e7efff;border-color:#3a6acc}.primary{background:#2459be;color:white}.primary:hover{background:#1a4699}.actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.expected{background:#edf5ee;border-left:4px solid #458857;padding:12px 16px}.expected p{margin:4px 0}.sample{font-size:23px}label{display:block;margin-top:16px}input,textarea{border:1px solid #a8b7ca;border-radius:8px;padding:10px;width:100%;margin-top:6px}.answer{font-size:26px}.answer:disabled{background:#eef0f3}textarea{min-height:75px}.records{background:#f5f7fa;padding:12px 16px;border-radius:8px}.records ol{display:flex;gap:24px;flex-wrap:wrap}.visual{display:flex;flex-wrap:wrap;gap:20px;padding:24px 0}.visual>div{max-width:100%;overflow-wrap:anywhere;text-align:center;font-size:24px}.correct{color:#267347}footer button{margin-left:16px}pre{max-height:280px;overflow:auto;background:white;padding:16px}summary{cursor:pointer}@media(max-width:760px){main{padding:16px}.layout{grid-template-columns:1fr}nav{display:flex;overflow:auto;gap:8px}nav button{min-width:170px}section{margin-top:0}}
</style>
