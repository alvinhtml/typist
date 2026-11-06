import {computed,ref} from 'vue';

export type Theme = 'system'|'light'|'dark';
const key='typist.appearance';
const valid=(value:unknown):value is Theme=>value==='system'||value==='light'||value==='dark';
const system=window.matchMedia('(prefers-color-scheme: dark)');
const systemDark=ref(system.matches);
function saved():Theme {try{const value=localStorage.getItem(key);return valid(value)?value:'system';}catch{return 'system';}}
export const theme=ref<Theme>(saved());
export const dark=computed(()=>theme.value==='dark'||(theme.value==='system'&&systemDark.value));
function apply(){document.documentElement.dataset.theme=dark.value?'dark':'light';}
export function setTheme(value:Theme){theme.value=value;try{localStorage.setItem(key,value);}catch{/* Appearance remains usable if storage is unavailable. */}apply();}
system.addEventListener('change',event=>{systemDark.value=event.matches;apply();});
window.addEventListener('storage',event=>{if(event.key===key){theme.value=valid(event.newValue)?event.newValue:'system';apply();}});
apply();
