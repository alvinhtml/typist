import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { Store, StoreError, failure } from './storage';
import { readBuiltin } from './dictionary';
import type { Changed, VocabularyChange, Result } from '../shared/contracts';
let store:Store|undefined, startupError:unknown;
let main:BrowserWindow|null=null, text:BrowserWindow|null=null, tray:Tray|null=null, quitting=false,sessionActive=false,confirmingQuit=false;
const pendingHide=new WeakSet<BrowserWindow>();
const page=join(__dirname,'../renderer/index.html');
const allowed=pathToFileURL(page).href;
// A test process may select a disposable directory without touching the user's data.
if(process.env.TYPIST_TEST_USER_DATA) app.setPath('userData',process.env.TYPIST_TEST_USER_DATA);
function windowFor(kind:'main'|'text') {
  const current=kind==='main'?main:text;
  if(current&&!current.isDestroyed()){pendingHide.delete(current);current.show();if(current.isMinimized())current.restore();current.focus();return current;}
  const win=new BrowserWindow({width:kind==='main'?1100:480,height:780,minWidth:kind==='main'?760:420,minHeight:640,show:false,webPreferences:{preload:join(__dirname,'../preload/index.js'),contextIsolation:true,sandbox:true,nodeIntegration:false}});
  if(kind==='main')main=win;else text=win;
  win.webContents.on('did-start-loading',()=>{if(kind==='main')sessionActive=false;});
  win.webContents.on('render-process-gone',()=>{if(kind==='main')sessionActive=false;});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',e=>e.preventDefault());
  // Native macOS fullscreen transitions must finish before hiding the window.
  win.on('leave-full-screen',()=>{if(pendingHide.delete(win)&&!win.isDestroyed())win.hide();});
  win.on('enter-full-screen',()=>{if(pendingHide.has(win))win.setFullScreen(false);});
  win.on('close',e=>{if(!quitting){
    e.preventDefault();win.webContents.send('pause');
    if(process.platform==='darwin'&&win.isFullScreen()){
      pendingHide.add(win);win.setFullScreen(false);
    }else win.hide();
  }});
  win.on('minimize',()=>win.webContents.send('pause'));
  win.on('blur',()=>{
    // Candidate panels may transiently change focus without deactivating this macOS app.
    const check=()=>{if(win.isDestroyed()||win.isFocused())return;const focused=BrowserWindow.getFocusedWindow();if(process.platform==='darwin'&&app.isActive()&&!focused)return;win.webContents.send('pause');};
    check();setTimeout(check,20);
  });
  win.on('closed',()=>{if(kind==='main')main=null;else text=null;});
  void win.loadFile(page,{hash:kind==='text'?'text':'practice'}).then(()=>win.show());
  return win;
}
async function quit(){
  if(quitting||confirmingQuit)return;confirmingQuit=true;
  try{
    if(sessionActive){
      main?.webContents.send('pause');
      const options={type:'question' as const,buttons:['继续练习','退出应用'],defaultId:0,cancelId:0,message:'当前一局尚未结束，确定退出？',detail:'已完成的学习进度会保留，重启不恢复本局现场。'};
      const result=main&&!main.isDestroyed()?await dialog.showMessageBox(main,options):await dialog.showMessageBox(options);
      if(result.response!==1)return;
    }
    quitting=true;app.quit();
  }finally{confirmingQuit=false;}
}
function register() {
  function business(request:any,run:()=>{result:Result<VocabularyChange>;committed:boolean}){
    const {result,committed}=run();if(committed&&result.ok){const event:Changed={revision:result.revision,requestId:request.requestId,affectedCourses:result.value.affectedCourses,addedPairs:result.value.addedPairs,removedPairs:result.value.removedPairs,codeReplacements:result.value.codeReplacements,removedCourseWords:result.value.removedCourseWords};for(const win of BrowserWindow.getAllWindows())win.webContents.send('changed',event);}return result;
  }
  const handlers:Record<string,(arg:any)=>unknown>={
    'import-csv':async request=>{
      if(!store)throw startupError;
      if(!request||!['vocabulary','supplemental'].includes(request.value))throw new StoreError('VALIDATION','无效文件类型。');
      main?.webContents.send('pause');
      const selection=await dialog.showOpenDialog({properties:['openFile'],filters:[{name:'CSV',extensions:['csv']}]});
      if(selection.canceled)throw new StoreError('CANCELLED','已取消导入。');
      return business(request,()=>store!.importCsv(request,readFileSync(selection.filePaths[0])));
    },
    'export-csv':async kind=>{
      if(!store)throw startupError;if(!['vocabulary','supplemental'].includes(kind))throw new StoreError('VALIDATION','无效文件类型。');
      main?.webContents.send('pause');
      const selection=await dialog.showSaveDialog({defaultPath:`${kind}.csv`,filters:[{name:'CSV',extensions:['csv']}]});
      if(selection.canceled||!selection.filePath)throw new StoreError('CANCELLED','已取消导出。');
      const data=store.exportCsv(kind);writeFileSync(selection.filePath,data.text,'utf8');return {ok:true,value:{count:data.count},revision:store.revision};
    },
    snapshot:()=>{if(!store)throw startupError;return store.snapshot();},
    'session-active':active=>{if(typeof active!=='boolean')throw new StoreError('VALIDATION','无效会话状态。');sessionActive=active;return {ok:true,value:null,revision:store?.revision??0};},
    learning:request=>{if(!store)throw startupError;const {result,committed}=store.saveLearning(request);if(committed&&result.ok){const event:Changed={revision:result.revision,requestId:request.requestId,affectedCourses:[],addedPairs:[],removedPairs:[],codeReplacements:[],removedCourseWords:[]};for(const win of BrowserWindow.getAllWindows())win.webContents.send('changed',event);}return result;},
    course:request=>{if(!store)throw startupError;return store.getCourse(request);},
    supplemental:request=>{if(!store)throw startupError;return business(request,()=>store!.mutateSupplemental(request));},
    'add-text':request=>{if(!store)throw startupError;return business(request,()=>store!.addVocabularyText(request));},
    'delete-vocabulary':request=>{if(!store)throw startupError;return business(request,()=>store!.deleteVocabulary(request));},
    resources:()=>({ok:true,revision:store?.revision??0,value:[1,2,3,4,5].map(level=>({level,bytes:readFileSync(join(app.isPackaged?process.resourcesPath:app.getAppPath(),'data',`level${level}.csv`)).length}))}),
    settings:request=>{if(!store)throw startupError;const {result,committed}=store.updateSettings(request);if(committed&&result.ok){const event:Changed={revision:result.revision,requestId:request.requestId,affectedCourses:[],addedPairs:[],removedPairs:[],codeReplacements:[],removedCourseWords:[]};for(const win of BrowserWindow.getAllWindows())win.webContents.send('changed',event);}return result;},
    'open-main':()=>{windowFor('main');return {ok:true,value:null,revision:store?.revision??0};},
    'open-text':()=>{windowFor('text');return {ok:true,value:null,revision:store?.revision??0};},
    quit:()=>{setImmediate(quit);return {ok:true,value:null,revision:store?.revision??0};}
  };
  for(const [channel,handler] of Object.entries(handlers)) ipcMain.handle(channel,async(event,arg)=>{
    try {if(![main,text].some(w=>w?.webContents===event.sender)||event.senderFrame!==event.sender.mainFrame||event.senderFrame.url.split('#')[0]!==allowed)throw new StoreError('VALIDATION','不受信任的窗口请求。');if(['learning','session-active'].includes(channel)&&event.sender!==main?.webContents)throw new StoreError('VALIDATION','练习进度仅允许主窗口写入。');return await handler(arg);}catch(e){return failure(e);}
  });
}
if(!app.requestSingleInstanceLock()){app.quit();}else {
  app.on('second-instance',()=>{if(app.isReady())windowFor('main');});
  app.whenReady().then(()=>{
    try {store=new Store(join(app.getPath('userData'),'typist.sqlite'),readBuiltin(join(app.isPackaged?process.resourcesPath:app.getAppPath(),'data')));}catch(e){startupError=e;}
    const { session } = require('electron') as typeof import('electron');
    session.defaultSession.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
    session.defaultSession.setPermissionCheckHandler(()=>false);
    register();
    // Raw RGBA template avoids platform SVG support and external icon dependencies.
    const pixels=Buffer.alloc(16*16*4);for(let y=2;y<14;y++)for(let x=2;x<14;x++)if(y<5||(x>=6&&x<10)){const i=(y*16+x)*4;pixels[i+3]=255;}
    const icon=nativeImage.createFromBuffer(pixels,{width:16,height:16});icon.setTemplateImage(true);
    try {tray=new Tray(icon);tray.setToolTip('Typist · 五笔练习');tray.setContextMenu(Menu.buildFromTemplate([{label:'打开主窗口',click:()=>windowFor('main')},{label:'添加文本',click:()=>windowFor('text')},{type:'separator'},{label:'退出应用',click:quit}]));tray.on('click',()=>windowFor('text'));}catch(e){dialog.showErrorBox('托盘初始化失败','无法创建托盘，应用将退出，避免窗口关闭后无法恢复。');quit();return;}
    Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Typist',submenu:[{label:'主窗口',click:()=>windowFor('main')},{label:'添加文本',click:()=>windowFor('text')},{label:'退出应用',click:quit}]},{label:'编辑',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]}]));
    windowFor('main');
  });
  app.on('activate',()=>{if(app.isReady())windowFor('main');});
  app.on('window-all-closed',()=>{});
  app.on('before-quit',event=>{if(sessionActive&&!quitting){event.preventDefault();void quit();}else quitting=true;});
  app.on('will-quit',()=>{tray?.destroy();store?.close();});
}
