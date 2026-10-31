import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { Store, StoreError, failure } from './storage';
import type { Changed } from '../shared/contracts';
let store:Store|undefined, startupError:unknown;
let main:BrowserWindow|null=null, text:BrowserWindow|null=null, tray:Tray|null=null, quitting=false;
const page=join(__dirname,'../renderer/index.html');
const allowed=pathToFileURL(page).href;
// A test process may select a disposable directory without touching the user's data.
if(process.env.TYPIST_TEST_USER_DATA) app.setPath('userData',process.env.TYPIST_TEST_USER_DATA);
function windowFor(kind:'main'|'text') {
  const current=kind==='main'?main:text;
  if(current&&!current.isDestroyed()){current.show();if(current.isMinimized())current.restore();current.focus();return current;}
  const win=new BrowserWindow({width:kind==='main'?1100:480,height:780,minWidth:kind==='main'?760:420,minHeight:640,show:false,webPreferences:{preload:join(__dirname,'../preload/index.js'),contextIsolation:true,sandbox:true,nodeIntegration:false}});
  if(kind==='main')main=win;else text=win;
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',e=>e.preventDefault());
  win.on('close',e=>{if(!quitting){e.preventDefault();win.webContents.send('pause');win.hide();}});
  win.on('minimize',()=>win.webContents.send('pause'));
  win.on('blur',()=>win.webContents.send('pause'));
  win.on('closed',()=>{if(kind==='main')main=null;else text=null;});
  void win.loadFile(page,{hash:kind==='text'?'text':'practice'}).then(()=>win.show());
  return win;
}
function quit(){quitting=true;app.quit();}
function register() {
  const handlers:Record<string,(arg:any)=>unknown>={
    snapshot:()=>{if(!store)throw startupError;return store.snapshot();},
    resources:()=>({ok:true,revision:store?.revision??0,value:[1,2,3,4,5].map(level=>({level,bytes:readFileSync(join(app.isPackaged?process.resourcesPath:app.getAppPath(),'data',`level${level}.csv`)).length}))}),
    settings:request=>{if(!store)throw startupError;const {result,committed}=store.updateSettings(request);if(committed&&result.ok){const event:Changed={revision:result.revision,requestId:request.requestId,affectedCourses:[],addedPairs:[],removedPairs:[],codeReplacements:[],removedCourseWords:[]};for(const win of BrowserWindow.getAllWindows())win.webContents.send('changed',event);}return result;},
    'open-main':()=>{windowFor('main');return {ok:true,value:null,revision:store?.revision??0};},
    'open-text':()=>{windowFor('text');return {ok:true,value:null,revision:store?.revision??0};},
    quit:()=>{setImmediate(quit);return {ok:true,value:null,revision:store?.revision??0};}
  };
  for(const [channel,handler] of Object.entries(handlers)) ipcMain.handle(channel,(event,arg)=>{
    try {if(![main,text].some(w=>w?.webContents===event.sender)||event.senderFrame!==event.sender.mainFrame||event.senderFrame.url.split('#')[0]!==allowed)throw new StoreError('VALIDATION','不受信任的窗口请求。');return handler(arg);}catch(e){return failure(e);}
  });
}
if(!app.requestSingleInstanceLock()){app.quit();}else {
  app.on('second-instance',()=>{if(app.isReady())windowFor('main');});
  app.whenReady().then(()=>{
    try {store=new Store(join(app.getPath('userData'),'typist.sqlite'));}catch(e){startupError=e;}
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
  app.on('before-quit',()=>{quitting=true;});
  app.on('will-quit',()=>{tray?.destroy();store?.close();});
}
