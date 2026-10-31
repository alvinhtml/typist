import { contextBridge, ipcRenderer } from 'electron';
import type { Bridge, Changed } from '../shared/contracts';
const bridge:Bridge = {
  getSnapshot:()=>ipcRenderer.invoke('snapshot'), getResources:()=>ipcRenderer.invoke('resources'),
  saveLearning:request=>ipcRenderer.invoke('learning',request),
  setSessionActive:active=>ipcRenderer.invoke('session-active',active),
  getCourse:request=>ipcRenderer.invoke('course',request),
  mutateSupplemental:request=>ipcRenderer.invoke('supplemental',request),
  addVocabularyText:request=>ipcRenderer.invoke('add-text',request),
  deleteVocabulary:request=>ipcRenderer.invoke('delete-vocabulary',request),
  updateSettings:request=>ipcRenderer.invoke('settings',request),
  openMain:()=>ipcRenderer.invoke('open-main'),openText:()=>ipcRenderer.invoke('open-text'),quit:()=>ipcRenderer.invoke('quit'),
  onChanged:callback=>{const listener=(_event:unknown,value:Changed)=>callback(value);ipcRenderer.on('changed',listener);return ()=>ipcRenderer.removeListener('changed',listener);},
  onPause:callback=>{const listener=()=>callback();ipcRenderer.on('pause',listener);return ()=>ipcRenderer.removeListener('pause',listener);}
};
contextBridge.exposeInMainWorld('typist',bridge);
