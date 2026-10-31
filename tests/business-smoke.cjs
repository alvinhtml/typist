const {app,BrowserWindow}=require('electron');const assert=require('node:assert/strict');const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'typist-business-smoke-'));process.env.TYPIST_TEST_USER_DATA=dir;app.setAppPath(path.resolve(__dirname,'..'));
const checks=[];const timeout=setTimeout(()=>{console.error('Business smoke timeout');app.exit(1)},45000);let exitCode=0;
require('../dist/main/index');
const wait=()=>new Promise(r=>setTimeout(r,100));
async function loaded(win){if(win.webContents.isLoading())await new Promise(r=>win.webContents.once('did-finish-load',r));}
app.whenReady().then(async()=>{try{
 await new Promise(r=>setTimeout(r,800));const main=BrowserWindow.getAllWindows()[0];await loaded(main);const call=code=>main.webContents.executeJavaScript(code);
 async function nav(label){await call(`Array.from(document.querySelectorAll('nav button')).find(b=>b.textContent===${JSON.stringify(label)}).click()`);await wait();}
 await nav('设置中心');
 await call(`(()=>{const set=(q,v)=>{const e=document.querySelector(q);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));};set('[aria-label="补充文字"]','阶段二测试词');set('[aria-label="补充编码"]','xyyz');const select=document.querySelector('.business select');select.value='5';select.dispatchEvent(new Event('change',{bubbles:true}));})()`);await wait();await call(`document.querySelector('.business form').requestSubmit()`);await wait();
 let snap=await call('window.typist.getSnapshot()');assert.equal(snap.value.supplemental.length,1);assert.equal(snap.value.vocabulary.length,0);assert.equal(snap.value.supplemental[0].code,'xyyz');checks.push('settings form adds supplemental without adding vocabulary');
 await call('window.typist.openText()');await wait();const text=BrowserWindow.getAllWindows().find(w=>w!==main);await loaded(text);const textCall=code=>text.webContents.executeJavaScript(code);
 await textCall(`window.events=[];window.typist.onChanged(e=>window.events.push(e));true`);
 await textCall(`(()=>{const e=document.querySelector('textarea');e.value='阶段二测试词，阶段二测试词🚀';e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await wait();
 assert.equal((await call('window.typist.getSnapshot()')).value.vocabulary.length,0);
 await textCall(`document.querySelector('.business form').requestSubmit()`);await wait();assert.ok((await textCall('document.body.innerText')).includes('新增 1 个组合 · 重复 1 次'));assert.ok((await textCall('document.body.innerText')).includes('🚀'));snap=await call('window.typist.getSnapshot()');assert.equal(snap.value.vocabulary.length,1);
 fs.writeFileSync('/private/tmp/typist-phase2-text.png',(await text.webContents.capturePage()).toPNG());
 await nav('生词本');assert.ok((await call('document.body.innerText')).includes('阶段二测试词'));fs.writeFileSync('/private/tmp/typist-phase2-vocabulary.png',(await main.webContents.capturePage()).toPNG());checks.push('paste requires manual add; longest phrase result, duplicates, unknown and main window synchronization');
 await textCall(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='继续添加').click()`);await wait();assert.equal(await textCall('document.querySelector("textarea").value'),'');
 const req={requestId:'business-replace',expectedRevision:snap.revision,value:[{kind:'update',oldPair:{word:'阶段二测试词',code:'xyyz'},entry:{word:'阶段二测试词',code:'xyz',level:5}}]};
 const result=await call(`window.typist.mutateSupplemental(${JSON.stringify(req)})`);assert.equal(result.ok,true);await wait();assert.ok((await call('document.body.innerText')).includes('xyz'));let events=await textCall('window.events');assert.equal(events.length,2);assert.equal(events[1].codeReplacements[0].newCode,'xyz');
 await call(`window.typist.mutateSupplemental(${JSON.stringify(req)})`);await wait();assert.equal((await textCall('window.events')).length,2);checks.push('atomic code replacement notifies both windows once; idempotent replay does not broadcast');
 const invalid=await call(`window.typist.mutateSupplemental({requestId:'bad-business',expectedRevision:${result.revision},value:[{kind:'add',entry:{word:'字',code:'123',level:1}}]})`);assert.equal(invalid.error.code,'VALIDATION');assert.equal((await call('window.typist.getSnapshot()')).revision,result.revision);
 await call(`document.querySelector('.word-heading button').click()`);await wait();assert.equal((await call('window.typist.getSnapshot()')).value.vocabulary.length,0);checks.push('invalid IPC data rejected; UI whole-word deletion persists');
 await nav('设置中心');await call("document.querySelector('.business').scrollIntoView()");await wait();fs.writeFileSync('/private/tmp/typist-phase2-supplemental.png',(await main.webContents.capturePage()).toPNG());
 for(const course of ['1','2','3','4','5']){const r=await call(`window.typist.getCourse({course:'${course}',offset:0,limit:5})`);assert.equal(r.ok,true);assert.ok(r.value.total>0);assert.equal(r.value.items.length,5);}checks.push('five real merged courses paginated through sandbox bridge');
 console.log(JSON.stringify({platform:process.platform,arch:process.arch,electron:process.versions.electron,checks},null,2));
}catch(e){console.error(e);exitCode=1;}finally{clearTimeout(timeout);if(exitCode)app.exit(1);else{setTimeout(()=>{console.error('Business smoke shutdown timeout');app.exit(1)},5000).unref();app.quit();}}});
app.on('quit',()=>{fs.rmSync(dir,{recursive:true,force:true});process.exit(exitCode);});
