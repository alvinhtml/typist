import type { Settings } from './contracts';
export type Phase = 'idle' | 'countdown' | 'running' | 'paused' | 'ended';
/** Memory only. Consumers invalidate pending input whenever generation changes. */
export class Session {
  phase:Phase = 'idle'; generation = 0; remainingMs = 0; countdownMs = 3000;
  settingsSnapshot:Readonly<Settings> | null = null;
  private last = 0;
  constructor(private clock:()=>number = ()=>performance.now()) {}
  start(settings:Settings) {
    if (this.active) throw new Error('请先结束当前一局');
    this.settingsSnapshot = Object.freeze({...settings}); this.remainingMs = settings.duration * 60000;
    this.countdownMs = 3000; this.phase = 'countdown'; this.last = this.clock(); this.generation++;
  }
  get active() { return this.phase !== 'idle' && this.phase !== 'ended'; }
  tick() {
    const now = this.clock(); let delta = Math.max(0, now-this.last); this.last = now;
    if(this.phase === 'countdown') {
      const used = Math.min(delta,this.countdownMs); this.countdownMs -= used; delta -= used;
      if(this.countdownMs === 0) this.phase = 'running';
    }
    if(this.phase === 'running') { this.remainingMs = Math.max(0,this.remainingMs-delta); if(!this.remainingMs) this.end(); }
  }
  pause() { this.tick(); if(this.phase==='running'||this.phase==='countdown') {this.phase='paused'; this.generation++;} }
  resume() {if(this.phase==='paused') {this.phase='running'; this.countdownMs=0; this.last=this.clock(); this.generation++;} }
  end() {this.phase='ended'; this.generation++;}
}
