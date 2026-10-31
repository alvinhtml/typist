const {test}=require('node:test');const assert=require('node:assert/strict');
const {Practice}=require('../dist/shared/practice');const {defaults}=require('../dist/shared/contracts');const {Session}=require('../dist/shared/session');
const settings={...defaults,groupSize:5,threshold:2};const item=word=>({word,codes:['a','ab']});const items=['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'].map(item);
const learned=(word,extra={})=>({course:'1',word,covered:1,streak:0,mistakes:0,lastAnsweredAt:100,mastered:0,...extra});
function model(entries=items,records=[],progress,opts=settings){return new Practice('1',entries,opts,records,progress,()=>0.5);}
function round(p,answer=w=>'a'){const n=p.round.length;for(let i=0;i<n;i++)p.answer(answer(p.current),1000+i);}
test('initial random unseen group, actual answers cover, wrong and skip reset, words count code points',()=>{
 const p=model([item('学习'),item('𠮷')]);assert.equal(p.group.length,2);assert.equal(p.covered,0);assert.equal(new Set(p.round).size,2);const word=p.current;p.answer('a',100);assert.equal(p.correctCharacters,Array.from(word).length);const other=p.current;p.answer(null,101);assert.equal(p.records.get(other).covered,1);assert.equal(p.records.get(other).streak,0);assert.equal(p.records.get(other).mistakes,1);assert.equal(p.previousFeedback.find(f=>f.word===other).answer,'');assert.equal(p.statistics(60000).accuracy,0.5);assert.equal(p.statistics(60000).answered,2);
 const phrase=model([item('学习')]);phrase.answer('学',100);assert.equal(phrase.correct,0);assert.equal(phrase.answered,1);phrase.answer('学习方法',101);assert.equal(phrase.answered,2);assert.equal(phrase.correct,0);assert.equal(phrase.statistics(60000).speed,0);
});
test('threshold replaces only mastered words on next round and retains unfinished group',()=>{
 const p=model();const original=[...p.group];round(p);assert.deepEqual(new Set(p.group),new Set(original));const mastered=p.current;p.answer('a',2000);assert.ok(p.group.includes(mastered));const remaining=p.round.length-1;for(let i=0;i<remaining;i++)p.answer('错误',2100+i);assert.equal(p.group.includes(mastered),false);assert.equal(p.group.filter(w=>original.includes(w)).length,4);assert.equal(p.records.get(mastered).mastered,1);assert.equal(p.records.get(original.find(w=>w!==mastered)).streak,0);
});
test('replacement cursor accumulates four fresh slots then oldest mastered review, not per round rounding',()=>{
 const records=[learned('旧甲',{mastered:1,lastAnsweredAt:50}),learned('旧乙',{mastered:1,lastAnsweredAt:10}),learned('旧丙',{mastered:1,lastAnsweredAt:10,mistakes:4})];
 const all=[...items,...records.map(r=>item(r.word))];let cursor=0;
 for(let slot=0;slot<5;slot++){
  const group=['甲','乙','丙','丁','戊'];const rows=group.map((w,i)=>learned(w,{streak:i===0?2:0}));
  const p=model(all,[...rows,...records],{course:'1',cursor,orderedGroupWords:group});
  const inserted=p.group.find(w=>!group.includes(w));assert.ok(inserted);if(slot<4)assert.equal(records.some(r=>r.word===inserted),false);else{assert.equal(inserted,'旧丙');assert.equal(p.records.get(inserted).streak,0);assert.equal(p.records.get(inserted).mastered,1);}
  cursor=p.cursor;
 }
 assert.equal(cursor,0);
});
test('review failure cancels mastery, all-covered chooses unfinished first; tiny course repeats without duplicate words',()=>{
 const all=['甲','乙','丙'].map(item),records=[learned('甲',{mastered:1,streak:2}),learned('乙',{mastered:1,streak:2}),learned('丙')];
 const p=model(all,records,{course:'1',cursor:4,orderedGroupWords:['甲']},{...settings,groupSize:1});assert.equal(p.current,'丙');p.answer('错误',200);assert.equal(p.records.get('丙').mastered,0);
 const tiny=model([item('甲')],[learned('甲',{mastered:1,streak:2})],{course:'1',cursor:0,orderedGroupWords:['甲']});assert.equal(tiny.group.length,1);assert.equal(tiny.records.get('甲').streak,0);tiny.answer('错误',300);assert.equal(tiny.mastered,0);assert.equal(tiny.covered,1);assert.equal(tiny.total,1);assert.equal(tiny.answered,1);
});
test('sync removes current without errors, keeps finished stats, updates codes and fills only at next round',()=>{
 const p=model(items.slice(0,5));p.answer('a',100);const answered=p.answered,current=p.current;const rest=items.filter(i=>i.word!==current);const removed=p.sync(rest,Array.from(p.records.values()));assert.equal(removed,true);assert.equal(p.answered,answered);assert.equal(p.group.length,4);assert.equal(p.round.includes(current),false);assert.equal(p.covered,1);assert.equal(p.total,9);
 const next=p.current;p.sync(rest.map(i=>i.word===next?{...i,codes:['new']}:i),Array.from(p.records.values()));assert.deepEqual(p.items.get(next),['new']);assert.equal(p.answered,1);const length=p.round.length-p.position;for(let i=0;i<length;i++)p.answer('错误',200+i);assert.equal(p.group.length,5);
 p.sync([],[]);assert.equal(p.total,0);assert.equal(p.answered,1+length);assert.equal(p.current,undefined);
});
test('restart restores group and independent course records; size/threshold changes preserve learning',()=>{
 const p=model();round(p);const progress={course:'1',cursor:p.cursor,orderedGroupWords:[...p.group]};const records=[...p.records.values()].filter(l=>l.covered);const restarted=model(items,records,progress);assert.deepEqual(new Set(restarted.group),new Set(p.group));assert.equal(restarted.answered,0);assert.equal(restarted.covered,5);
 const other=new Practice('2',items,settings,records,undefined,()=>0.5);assert.equal(other.covered,0);
 const shrunk=model(items,[...records.map((r,i)=>({...r,streak:i<2?2:1,mastered:i<2?1:0}))],progress,{...settings,groupSize:3,threshold:2});assert.ok(shrunk.group.every(w=>!records.slice(0,2).some(r=>r.word===w)));assert.equal(shrunk.covered,5);
 const lowered=model(items,records,progress,{...settings,threshold:1});assert.ok(lowered.group.every(w=>!progress.orderedGroupWords.includes(w)));assert.equal(lowered.mastered,5);
});
test('candidate clone isolates uncommitted answers and zero-submission results have no accuracy',()=>{
 const p=model();p.saved();const candidate=p.clone();candidate.answer('a',100);assert.equal(p.answered,0);assert.equal(p.covered,0);assert.equal(candidate.answered,1);assert.equal(candidate.write().changes.length,1);assert.deepEqual(p.write().changes,[]);assert.equal(p.statistics(0).accuracy,null);assert.equal(p.statistics(0).speed,0);
});
test('clock excludes pauses, countdown and late timeout input has no effect on score',()=>{
 let now=0;const s=new Session(()=>now),p=model([item('学习')]);s.start(settings);now=3000;s.tick();now=4000;p.answer('a',100);s.pause();const remaining=s.remainingMs;now=30000;s.tick();assert.equal(s.remainingMs,remaining);s.resume();now=89000;s.tick();assert.equal(s.phase,'ended');const stats=p.statistics(settings.duration*60000-s.remainingMs);assert.equal(stats.speed,2);assert.equal(stats.answered,1);
});
test('code matching uses only supplied course codes, accepts alternatives and lowercase, skips explicitly',()=>{
 const p=new Practice('2',[{word:'甲',codes:['ab','ac']}],settings,[],undefined,()=>0.5);
 p.answer('AC',1);assert.equal(p.correct,1);assert.equal(p.previousFeedback[0].answer,'甲');
 p.answer('a',2);assert.equal(p.correct,1);assert.equal(p.previousFeedback[0].answer,'a');
 p.answer('甲',3);assert.equal(p.correct,1);p.answer(null,4);assert.equal(p.previousFeedback[0].skipped,true);assert.equal(p.previousFeedback[0].answer,'');
});
