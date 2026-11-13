const { artifactPath } = require('./artifacts.cjs');
const {app,BrowserWindow}=require('electron');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'typist-theme-'));
process.env.TYPIST_TEST_USER_DATA=dir;app.setAppPath(path.resolve(__dirname,'..'));
const wait=(ms=180)=>new Promise(r=>setTimeout(r,ms));
const timeout=setTimeout(()=>app.exit(1),45000);
require('../dist/main/index');
app.whenReady().then(async()=>{try{
 await wait(800);const win=BrowserWindow.getAllWindows()[0];app.focus({steal:true});win.focus();
 const call=code=>win.webContents.executeJavaScript(code);
 const click=selector=>call(`document.querySelector(${JSON.stringify(selector)}).click()`);
 const theme=async value=>{await call(`(()=>{const el=document.querySelector('.theme-switch select');el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);await wait();};
 const fit=async()=>assert.ok(await call('document.documentElement.scrollWidth<=innerWidth'),'no horizontal page overflow');
 const flatManagement=async()=>assert.ok(await call(`Array.from(document.querySelectorAll('.management>.card')).every(el=>{const s=getComputedStyle(el);return s.backgroundColor==='rgba(0, 0, 0, 0)'&&s.boxShadow==='none'&&s.borderLeftWidth==='0px';})`),'management sections blend into the page without card backgrounds or shadows');
 const alignedSettings=async()=>assert.ok(await call(`(()=>{const root=document.querySelector('.settings-page');const fields=Array.from(root.querySelectorAll('.settings-form label input,.settings-form label select'));const forms=Array.from(root.querySelectorAll('.settings-form'));const right=forms[0].getBoundingClientRect().right;return fields.length===8&&fields.every(el=>{const r=el.getBoundingClientRect(),label=el.parentElement.getBoundingClientRect();return r.top>=label.top+20&&Math.abs(r.width-label.width)<2;})&&forms.every(el=>Math.abs(el.getBoundingClientRect().right-right)<2)&&Array.from(root.querySelectorAll('.exchange-row .actions')).every(el=>Math.abs(el.getBoundingClientRect().right-right)<2);})()`),'labels sit above full-width fields; section contents and CSV actions align');
 const compactStats=async selector=>{const bar=await call(`(()=>{const el=document.querySelector(${JSON.stringify(selector)}),r=el.getBoundingClientRect();return {height:r.height,aligned:Array.from(el.querySelectorAll('.stat')).every(stat=>{const a=stat.querySelector('small').getBoundingClientRect(),b=stat.querySelector('strong').getBoundingClientRect();return Math.abs((a.top+a.bottom-b.top-b.bottom)/2)<2;})};})()`);assert.ok(bar.aligned,'statistics labels and values align horizontally');assert.ok(bar.height<=80,`compact statistics height: ${bar.height}`);};
 const capture=async name=>{await wait();fs.writeFileSync(artifactPath(`desktop-${name}.png`),(await win.webContents.capturePage()).toPNG());};
 const seed=await call('window.typist.getSnapshot()');
 await call(`window.typist.mutateSupplemental({requestId:'theme-seed',expectedRevision:${seed.revision},value:[{kind:'add',entry:{word:'专注',code:'xy',level:5}},{kind:'add',entry:{word:'精进',code:'abcd',level:5}}]})`);
 const seeded=await call('window.typist.getSnapshot()');await call(`window.typist.addVocabularyText({requestId:'theme-words',expectedRevision:${seeded.revision},value:'专注 精进'})`);await wait();
 const contrast=async()=>{
  const colors=await call(`(()=>{const s=getComputedStyle(document.documentElement);return Object.fromEntries(['ink','muted','paper','surface','accent','on-accent','error','error-soft'].map(k=>[k,s.getPropertyValue('--'+k).trim()]));})()`);
  const luminance=hex=>{const a=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return a[0]*.2126+a[1]*.7152+a[2]*.0722;};
  for(const [text,bg]of [['ink','paper'],['muted','paper'],['muted','surface'],['accent','paper'],['on-accent','accent'],['error','error-soft']]){const a=luminance(colors[text]),b=luminance(colors[bg]),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);assert.ok(ratio>=4.5,`${text}/${bg}: ${ratio}`);}
 };
 for(const value of ['light','dark']){
  await theme(value);assert.equal(await call('document.documentElement.dataset.theme'),value);await contrast();await fit();await capture(`home-${value}`);
  await click('[data-page=settings]');await wait();await fit();await flatManagement();await alignedSettings();assert.equal(await call('document.querySelector("[aria-label=设置颜色模式]").value'),value);await capture(`settings-${value}`);
  if(value==='light'){await call(`(()=>{const el=document.querySelector('form.settings-form input');el.value='24';el.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('form.settings-form button').click();})()`);await wait();assert.equal((await call('window.typist.getSnapshot()')).value.settings.groupSize,24);}
  win.setSize(760,780);await wait();await fit();await alignedSettings();await capture(`settings-narrow-${value}`);
  win.webContents.setZoomFactor(1.5);await wait();await fit();await alignedSettings();win.webContents.setZoomFactor(1);win.setSize(1100,780);await wait();
  await click('[data-page=home]');await wait();await click('[data-page=vocabulary]');await wait();await fit();await flatManagement();assert.ok(await call(`(()=>{const root=document.querySelector('.vocabulary-page');return !root.querySelector('details')&&root.querySelectorAll('input[type=checkbox]').length===root.querySelectorAll('.entry-list>li').length&&Array.from(root.querySelectorAll('.entry-list>li')).every(row=>row.querySelectorAll('.vocabulary-codes').length===1);})()`),'one inline code tag and one word checkbox per row, with no expansion');
  const words=await call('window.typist.getSnapshot()');const actual=await call(`Array.from(document.querySelectorAll('.vocabulary-page .entry-list>li')).map(row=>({word:row.querySelector('strong').textContent,codes:row.querySelector('.vocabulary-codes').textContent.split(' · ')}))`);for(const row of actual)assert.deepEqual(row.codes,words.value.vocabulary.filter(p=>p.word===row.word).map(p=>p.code));
  await capture(`vocabulary-${value}`);win.setSize(760,780);win.webContents.setZoomFactor(1.5);await wait();await fit();win.webContents.setZoomFactor(1);win.setSize(1100,780);await wait();
  await call(`(()=>{const el=document.querySelector('.vocabulary-search input');el.value='xy';el.dispatchEvent(new Event('input',{bubbles:true}));})()`);await wait();assert.equal(await call('document.querySelectorAll(".vocabulary-page .entry-list>li").length'),1);assert.equal(await call('document.querySelector(".vocabulary-page .entry-list strong").textContent'),'专注');
  await click('[data-page=home]');await wait();await click('[data-page=text]');await wait();await fit();await flatManagement();await capture(`text-${value}`);assert.ok(await call('!!document.querySelector("textarea")'));
  await click('[data-page=home]');await wait();await click('[data-page=practice]');await wait();await fit();await compactStats('.practice-panel:not(.game-panel)>.practice-stats');await capture(`practice-${value}`);win.setSize(760,780);await wait();await fit();await compactStats('.practice-panel:not(.game-panel)>.practice-stats');win.setSize(1100,780);await wait();
  await click('.practice-panel:not(.game-panel) [data-page=home]');await wait();
 }
 await click('[data-page=vocabulary]');await wait();
 const removedWord=await call('document.querySelector(".vocabulary-page .entry-list strong").textContent');await click('.vocabulary-page .entry-list input[type=checkbox]');await wait();assert.equal(await call('document.querySelector(".vocabulary-bulk button").disabled'),false);await click('.vocabulary-bulk button');await wait();const afterBulk=(await call('window.typist.getSnapshot()')).value.vocabulary;assert.ok(afterBulk.length>0);assert.ok(afterBulk.every(pair=>pair.word!==removedWord),await call('document.querySelector(".vocabulary-page").innerText'));
 const lastWord=await call('document.querySelector(".vocabulary-page .entry-list strong").textContent');await click('.vocabulary-delete');await wait();assert.ok((await call('window.typist.getSnapshot()')).value.vocabulary.every(pair=>pair.word!==lastWord));await click('[data-page=home]');await wait();
 // Persistence and OS preference apply before mount, including another native window.
 await call('window.typist.openText()');await wait();const text=BrowserWindow.getAllWindows().find(w=>w!==win);
 if(text.webContents.isLoading())await new Promise(r=>text.webContents.once('did-finish-load',r));
 assert.equal(await text.webContents.executeJavaScript('document.documentElement.dataset.theme'),'dark');
 await theme('light');await wait();assert.equal(await text.webContents.executeJavaScript('document.documentElement.dataset.theme'),'light');
 await theme('dark');win.reload();await new Promise(r=>win.webContents.once('did-finish-load',r));await wait();assert.equal(await call('document.documentElement.dataset.theme'),'dark');
 win.webContents.debugger.attach('1.3');
 await theme('system');
 for(const dark of [true,false]){await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:dark?'dark':'light'}]});await wait();assert.equal(await call('document.documentElement.dataset.theme'),dark?'dark':'light');}
 await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});assert.equal(await call('getComputedStyle(document.querySelector(".menu-entry")).transitionDuration'),'0s');win.webContents.debugger.detach();
 await click('[data-page=practice]');await wait();
 await call('window.desktopNow=0;Object.defineProperty(performance,"now",{configurable:true,value:()=>window.desktopNow});true');
 await click('[data-action=start]');await wait();await call('window.desktopNow=3000');await wait();
 if(await call('!!document.querySelector("[data-action=resume]")'))await click('[data-action=resume]');
 for(const value of ['light','dark']){await theme(value);await fit();assert.equal(await call('getComputedStyle(document.querySelector("#practice-answer")).borderTopWidth'),'0px');await capture(`practice-active-${value}`);}
 await click('[data-action=finish]');await wait();await click('.practice-panel:not(.game-panel) [data-page=home]');await wait();
 await theme('dark');await click('[data-page=game]');await wait();
 for(const width of [1100,760]){
   win.setSize(width,780);await wait();await fit();
   assert.ok(await call(`(()=>{const a=document.querySelector('.game-arena').getBoundingClientRect();return a.top===0&&a.width===innerWidth&&Math.abs(a.height-innerHeight)<2&&!document.querySelector('.studio-header');})()`),'game preparation uses the full viewport');
 }
 await capture('game-dark-narrow');
 await click('.game-panel [data-page=home]');await wait();win.setSize(1100,780);
 console.log('PASS light/dark page coverage, semantic text contrast >=4.5, theme persistence, cross-window sync, OS changes, reduced motion and full game viewport at 1100/760px');clearTimeout(timeout);app.quit();
}catch(e){console.error(e);clearTimeout(timeout);app.exit(1);}});
app.on('quit',()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:50}));
