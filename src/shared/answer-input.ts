import type {Course} from './contracts';

/** Local, synchronous code buffer. Text input/composition never submits answers. */
export function bindAnswerInput(element:HTMLInputElement,accept:(code:string|null)=>void,enabled:()=>boolean,notice:()=>void,course:()=>Course=()=> 'vocabulary'){
  let buffer='',disposed=false;
  const handlers=new Map<string,EventListener>();
  function on(type:string,handler:EventListener){handlers.set(type,handler);element.addEventListener(type,handler);}
  const clear=()=>{buffer='';element.value='';};
  const blocked=(event:Event)=>{event.preventDefault();element.value=buffer;notice();};
  on('paste',blocked);on('drop',blocked);
  on('beforeinput',event=>{event.preventDefault();if(/paste|drop/i.test((event as InputEvent).inputType))notice();});
  on('compositionstart',()=>{clear();notice();});
  on('compositionend',clear);
  on('input',event=>{if(/paste|drop/i.test((event as InputEvent).inputType))notice();element.value=buffer;});
  on('blur',clear);
  on('keydown',event=>{
    const e=event as KeyboardEvent;
    if(disposed||!enabled()){clear();return;}
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    // An input-source switch can leave compositionstart without compositionend.
    if(e.isComposing||e.keyCode===229||e.key==='Process'){clear();notice();return;}
    if(e.key==='Tab'||e.key==='Escape'||e.key.startsWith('Arrow'))return;
    e.preventDefault();if(e.repeat)return;
    if(e.key==='Backspace'){buffer=buffer.slice(0,-1);element.value=buffer;return;}
    if(e.key===' '){const answer=buffer||null;clear();accept(answer);return;}
    if(!/^[a-z]$/i.test(e.key))return;
    buffer+=e.key.toLowerCase();element.value=buffer;
    const c=course(),length=/^[1-4]$/.test(c)?Number(c):4;
    if(buffer.length===length){const answer=buffer;clear();accept(answer);}
  });
  return ()=>{disposed=true;clear();for(const [type,handler]of handlers)element.removeEventListener(type,handler);};
}
