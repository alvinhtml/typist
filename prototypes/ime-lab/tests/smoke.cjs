const { artifactPath } = require('../../../tests/artifacts.cjs');
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
app.setPath('userData',path.join(app.getPath('temp'),'typist-ime-smoke'));
const timeout=setTimeout(()=>{console.error('Smoke timeout');app.exit(1)},20000);
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
 try {
 await win.loadFile(path.join(__dirname,'../dist/index.html'));
 const result=await win.webContents.executeJavaScript(`(async()=>{
 const tick=()=>new Promise(r=>setTimeout(r,0));
 document.querySelector('[data-testid=start]').click();await tick();
 const el=document.querySelector('.answer');
 if(el.disabled)throw Error('Input stays disabled');
 el.value='学习';el.dispatchEvent(new InputEvent('input',{inputType:'insertText',data:'学习',bubbles:true}));await tick();
 if(document.querySelector('.records li')?.textContent!=='学习')throw Error('Commit missing');
 const paste=new Event('paste',{cancelable:true});el.dispatchEvent(paste);if(!paste.defaultPrevented)throw Error('Paste accepted');
 document.querySelector('[data-testid=pause]').click();await tick();
 if(!document.querySelector('.answer').disabled)throw Error('Pause failed');
 // Reproduce composition ending after pointer-down but before click.
 document.querySelector('[data-testid=start]').click();await tick();
 const old=document.querySelector('.answer');
 old.dispatchEvent(new CompositionEvent('compositionstart',{data:''}));old.value='ls';
 old.dispatchEvent(new InputEvent('input',{data:'ls',inputType:'insertCompositionText',isComposing:true}));
 const pause=document.querySelector('[data-testid=pause]');
 pause.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}));
 old.dispatchEvent(new CompositionEvent('compositionend',{data:'ls'}));await tick();
 if(document.querySelectorAll('.records li').length)throw Error('Paused composition submitted');
 pause.click();await tick();
 document.querySelectorAll('.actions button')[2].click();await tick();
 old.dispatchEvent(new CompositionEvent('compositionend',{data:'ls'}));await tick();
 if(document.querySelectorAll('.records li').length)throw Error('Stale composition submitted after resume');
 const fresh=document.querySelector('.answer');
 fresh.dispatchEvent(new CompositionEvent('compositionstart',{data:''}));fresh.value='困';
 fresh.dispatchEvent(new CompositionEvent('compositionend',{data:'困'}));await new Promise(r=>setTimeout(r,70));
 if(document.querySelectorAll('.records li').length!==1||document.querySelector('.records li').textContent!=='困')throw Error('Resume commit incorrect');
 // Actual reported ordering: compositionend precedes pause pointerdown.
 fresh.dispatchEvent(new CompositionEvent('compositionstart',{data:''}));fresh.value='ls';
 fresh.dispatchEvent(new CompositionEvent('compositionend',{data:'ls'}));
 await new Promise(r=>setTimeout(r,5));
 pause.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}));
 await new Promise(r=>setTimeout(r,70));
 if(document.querySelectorAll('.records li').length!==1)throw Error('Composition before pause leaked');
 document.querySelectorAll('.actions button')[2].click();await tick();
 const resumed=document.querySelector('.answer');
 // A real Latin text commit must still be accepted.
 resumed.value='ls';resumed.dispatchEvent(new InputEvent('input',{data:'ls',inputType:'insertText'}));await tick();
 if(document.querySelectorAll('.records li').length!==2)throw Error('Latin commit incorrectly filtered');
 return {title:document.title,checks:['mounted','text commit','paste blocked','pause disables input','pause before compositionend discards draft','stale event after resume ignored','new composition accepted','Latin commit retained','compositionend before pause discarded'],userAgent:navigator.userAgent};
 })()`);
 console.log(JSON.stringify({versions:process.versions,result},null,2));
 fs.writeFileSync(artifactPath('ime-smoke-result.json'),JSON.stringify({versions:process.versions,result},null,2));
 clearTimeout(timeout);app.exit(0);
 }catch(e){console.error(e);app.exit(1)}
});
