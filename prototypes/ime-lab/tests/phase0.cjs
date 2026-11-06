const { resultsDirectory } = require('../../../tests/artifacts.cjs');
const {app,BrowserWindow}=require('electron');const fs=require('node:fs'),path=require('node:path');
app.setPath('userData',path.join(app.getPath('temp'),'typist-phase0'));
app.whenReady().then(async()=>{let win;try{
 require('../experiments/storage.cjs');
 win=new BrowserWindow({show:false,width:1100,height:780,webPreferences:{backgroundThrottling:false,sandbox:true,contextIsolation:true,nodeIntegration:false}});
 await win.loadFile(path.join(__dirname,'../dist/layouts.html'));
 const report=[];const out=resultsDirectory;fs.mkdirSync(out,{recursive:true});
 for(const width of [1100,760,480]){win.setSize(width,780);await new Promise(r=>setTimeout(r,100));
 for(const name of ['练习反馈','文本添加','添加结果','设置','游戏参数']){
 await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('nav button')).find(b=>b.textContent===${JSON.stringify(name)}).click()`);await new Promise(r=>setTimeout(r,100));
 const metrics=await win.webContents.executeJavaScript(`({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,tiles:[...document.querySelectorAll('.tiles article')].map(e=>({width:e.clientWidth,scroll:e.scrollWidth}))})`);
 if(metrics.overflow||metrics.tiles.some(t=>t.scroll>t.width))throw Error('Overflow '+name+' '+width);
 report.push({name,width,metrics});
 if(width===1100)fs.writeFileSync(path.join(out,'layout-'+name+'.png'),(await win.webContents.capturePage()).toPNG());
 }}
 const game=await win.webContents.executeJavaScript(`(async()=>{const wait=()=>new Promise(r=>setTimeout(r,120));const res=[];for(let i=0;i<3;i++){const s=document.querySelector('select');s.value=String(i);s.dispatchEvent(new Event('change',{bubbles:true}));await wait();const n=document.querySelectorAll('.target').length;if(n!==[3,5,7][i])throw Error('count');res.push({difficulty:i,targets:n});}return res})()`);
 const movement=await win.webContents.executeJavaScript(`(async()=>{const t=document.querySelector('.target');const y=()=>new DOMMatrix(t.style.transform).m42;const a=y();await new Promise(r=>setTimeout(r,250));const b=y();if(b<=a)throw Error('No movement');t.dispatchEvent(new MouseEvent('mouseenter'));const c=y();await new Promise(r=>setTimeout(r,150));if(y()!==c)throw Error('Hover moved');t.dispatchEvent(new MouseEvent('mouseleave'));return {distance:b-a,hover:'passed'}})()`);
 await win.webContents.executeJavaScript("document.querySelector('section button').click()");await new Promise(r=>setTimeout(r,100));
 const before=await win.webContents.executeJavaScript("[...document.querySelectorAll('.target')].map(e=>e.style.transform)");await new Promise(r=>setTimeout(r,200));
 const after=await win.webContents.executeJavaScript("[...document.querySelectorAll('.target')].map(e=>e.style.transform)");if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Pause movement');
 fs.writeFileSync(path.join(out,'phase0-runtime.json'),JSON.stringify({versions:process.versions,layout:report,game,movement,pause:'passed'},null,2));console.log('Phase 0 storage/layout/game checks passed');app.exit(0);
 }catch(e){console.error(e);app.exit(1)}});
setTimeout(()=>app.exit(1),30000);
