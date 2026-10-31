import { contextBridge, ipcRenderer } from 'electron';
import type { Bridge, Changed } from '../shared/contracts';
const bridge:Bridge = {
  getSnapshot:()=>ipcRenderer.invoke('snapshot'), getResources:()=>ipcRenderer.invoke('resources'),
  updateSettings:request=>ipcRenderer.invoke('settings',request),
  openMain:()=>ipcRenderer.invoke('open-main'),openText:()=>ipcRenderer.invoke('open-text'),quit:()=>ipcRenderer.invoke('quit'),
  onChanged:callback=>{const listener=(_event:unknown,value:Changed)=>callback(value);ipcRenderer.on('changed',listener);return ()=>ipcRenderer.removeListener('changed',listener);},
  onPause:callback=>{const listener=()=>callback();ipcRenderer.on('pause',listener);return ()=>ipcRenderer.removeListener('pause',listener);}
};
contextBridge.exposeInMainWorld('typist',bridge);
