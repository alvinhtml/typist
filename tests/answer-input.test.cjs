const {test}=require('node:test');const assert=require('node:assert/strict');const {bindAnswerInput}=require('../dist/shared/answer-input');
class Input extends EventTarget{value='';emit(type,properties={}){const e=new Event(type,{cancelable:true});Object.assign(e,properties);this.dispatchEvent(e);return e;}keys(text){for(const key of text)this.emit('keydown',{key});}}
test('English keydown recovers when an input-source switch omits compositionend',()=>{
  const el=new Input(),answers=[];
  bindAnswerInput(el,code=>answers.push(code),()=>true,()=>{});
  el.keys('ab');
  el.emit('compositionstart');
  el.emit('keydown',{key:'a',isComposing:true});
  el.emit('keydown',{key:' ',keyCode:229});
  el.emit('keydown',{key:'Process'});
  assert.deepEqual(answers,[]);
  el.keys('CD ');
  assert.deepEqual(answers,['cd']);
});
for(const course of ['1','2','3','4','5','vocabulary'])test(`course ${course}: synchronous length, case normalization, rapid next answer`,()=>{const el=new Input(),answers=[],n=Number(course)<=4?Number(course):4;bindAnswerInput(el,v=>answers.push(v),()=>true,()=>{},()=>course);el.keys('ABCD'.slice(0,n).repeat(2));assert.deepEqual(answers,['abcd'.slice(0,n),'abcd'.slice(0,n)]);assert.equal(el.value,'');});
test('short codes wait for space; backspace, punctuation, repeats, shortcuts and skip',()=>{const el=new Input(),answers=[];bindAnswerInput(el,v=>answers.push(v),()=>true,()=>{});el.keys('a1!b');assert.equal(el.value,'ab');el.emit('keydown',{key:'c',repeat:true});el.emit('keydown',{key:'v',metaKey:true});el.emit('keydown',{key:'Backspace'});assert.equal(el.value,'a');el.keys('  ');assert.deepEqual(answers,['a',null]);});
test('paste/drop, composition and text input never answer; blur and disposal clear partial code',()=>{const el=new Input(),answers=[];let notices=0;const off=bindAnswerInput(el,v=>answers.push(v),()=>true,()=>notices++);el.keys('ab');assert.ok(el.emit('paste').defaultPrevented);assert.ok(el.emit('drop').defaultPrevented);el.emit('compositionstart');el.emit('keydown',{key:'a',isComposing:true});el.value='中文';el.emit('compositionend');el.emit('input',{inputType:'insertFromComposition'});assert.equal(el.value,'');el.keys('ab');el.emit('blur');assert.equal(el.value,'');el.keys('ab');off();el.keys('cd ');assert.deepEqual(answers,[]);assert.ok(notices>=3);});
test('disabled clears unsubmitted buffer; fresh binding accepts new code',()=>{const el=new Input(),answers=[];let active=true;const off=bindAnswerInput(el,v=>answers.push(v),()=>active,()=>{});el.keys('ab');active=false;el.keys('c');assert.equal(el.value,'');off();active=true;bindAnswerInput(el,v=>answers.push(v),()=>active,()=>{});el.keys('abcd');assert.deepEqual(answers,['abcd']);});
