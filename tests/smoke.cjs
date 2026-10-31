const {app,BrowserWindow}=require('electron');const assert=require('node:assert/strict');const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'typist-smoke-'));process.env.TYPIST_TEST_USER_DATA=dir;
const checks=[];let exitCode=0;
const timeout=setTimeout(()=>{console.error('Smoke timeout');app.exit(1)},25000);
async function loaded(win){if(win.webContents.isLoading())await new Promise(r=>win.webContents.once('did-finish-load',r));}
app.on('browser-window-created',(_e,win)=>{win.webContents.on('render-process-gone',()=>{exitCode=1;});});
app.setAppPath(path.resolve(__dirname,'..'));
require('../dist/main/index');
app.whenReady().then(async()=>{
  try{
    await new Promise(r=>setTimeout(r,800));const main=BrowserWindow.getAllWindows()[0];assert.ok(main);await loaded(main);
    const call=code=>main.webContents.executeJavaScript(code);
    const snap=await call('window.typist.getSnapshot()');assert.equal(snap.ok,true);checks.push('sandbox preload and SQLite snapshot');
    const resources=await call('window.typist.getResources()');assert.equal(resources.ok,true,JSON.stringify(resources));assert.equal(resources.value.length,5);assert.ok(resources.value.every(r=>r.bytes>0));checks.push('five read-only resource files');
    fs.writeFileSync('/private/tmp/typist-phase1.png',(await main.webContents.capturePage()).toPNG());
    await call('window.typist.openText()');await call('window.typist.openText()');assert.equal(BrowserWindow.getAllWindows().length,2);const text=BrowserWindow.getAllWindows().find(w=>w!==main);await loaded(text);
    await text.webContents.executeJavaScript('window.lastRevision=0;window.stopChange=window.typist.onChanged(e=>window.lastRevision=e.revision);true');
    const updated=await call(`window.typist.updateSettings({requestId:'smoke',expectedRevision:0,value:{groupSize:30,threshold:4,duration:2,difficulty:'easy'}})`);assert.equal(updated.ok,true);
    await new Promise(r=>setTimeout(r,100));assert.equal(await text.webContents.executeJavaScript('window.lastRevision'),1);checks.push('single text window and cross-window committed notification');
    const invalid=await call(`window.typist.updateSettings({requestId:'bad',expectedRevision:1,value:{groupSize:0}})`);assert.equal(invalid.error.code,'VALIDATION');
    await call('window.paused=0;window.typist.onPause(()=>window.paused++);true');main.close();assert.equal(main.isDestroyed(),false);assert.equal(main.isVisible(),false);
    await new Promise(r=>setTimeout(r,100));assert.ok(await call('window.paused')>0);await text.webContents.executeJavaScript('window.typist.openMain()');assert.equal(main.isVisible(),true);assert.equal(BrowserWindow.getAllWindows().length,2);checks.push('close hides and pauses; same main window restored');
    const unknown=new BrowserWindow({show:false,webPreferences:{preload:path.resolve('dist/preload/index.js'),sandbox:true,contextIsolation:true}});await unknown.loadURL('about:blank');const denied=await unknown.webContents.executeJavaScript('window.typist.getSnapshot()');assert.equal(denied.error.code,'VALIDATION');unknown.destroy();checks.push('untrusted renderer rejected');
    console.log(JSON.stringify({platform:process.platform,arch:process.arch,electron:process.versions.electron,checks},null,2));
  }catch(e){console.error(e);exitCode=1;}finally{clearTimeout(timeout);if(exitCode)app.exit(exitCode);else app.quit();}
});
app.on('quit',()=>{fs.rmSync(dir,{recursive:true,force:true});process.exitCode=exitCode;});
