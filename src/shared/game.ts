import {Session} from './session';
import type {CourseWord,Settings} from './contracts';
export const gameProfiles={easy:{count:3,speed:24},normal:{count:5,speed:40},hard:{count:7,speed:60}};
export type Target={id:number;word:string;codes:string[];lane:number;y:number;hover:boolean};
export class Game {
  session:Session;targets:Target[]=[];items:CourseWord[]=[];correct=0;characters=0;mistakes=0;private sequence=0;private elapsed=0;
  constructor(private clock:()=>number=()=>performance.now(),private random:()=>number=Math.random){this.session=new Session(clock);}
  get usedMs(){return this.session.settingsSnapshot?this.session.settingsSnapshot.duration*60000-this.session.remainingMs:0;}
  get profile(){return gameProfiles[this.session.settingsSnapshot?.difficulty??'normal'];}
  start(items:CourseWord[],settings:Settings){if(!items.length)throw new Error('当前课程暂无可练内容。');this.session.start(settings);this.items=items;this.elapsed=0;this.targets=[];this.correct=0;this.characters=0;this.mistakes=0;this.fill();}
  private fill(){const count=Math.min(this.profile.count,this.items.length);for(let lane=0;lane<count;lane++){if(this.targets.some(t=>t.lane===lane))continue;const available=this.items.filter(i=>!this.targets.some(t=>t.word===i.word));if(!available.length)break;const item=available[Math.min(available.length-1,Math.floor(this.random()*available.length))];this.targets.push({id:++this.sequence,word:item.word,codes:[...item.codes],lane,y:0,hover:false});}}
  tick(){this.session.tick();const elapsed=this.usedMs,delta=Math.max(0,elapsed-this.elapsed);this.elapsed=elapsed;for(const target of this.targets)if(!target.hover)target.y=(target.y+this.profile.speed*delta/1000)%420;}
  pause(){this.tick();this.session.pause();}
  resume(){this.session.resume();}
  finish(){this.tick();this.session.end();}
  answer(code:string|null){this.tick();if(this.session.phase!=='running'||!code)return null;const target=this.targets.filter(t=>t.codes.includes(code)).sort((a,b)=>b.y-a.y||a.id-b.id)[0];if(!target){this.mistakes++;return false;}this.correct++;this.characters+=Array.from(target.word).length;this.targets=this.targets.filter(t=>t!==target);this.fill();return true;}
  sync(items:CourseWord[]){this.tick();this.items=items;const byWord=new Map(items.map(i=>[i.word,i.codes]));this.targets=this.targets.filter(t=>byWord.has(t.word));for(const t of this.targets)t.codes=[...byWord.get(t.word)!];if(this.session.active){this.fill();if(!items.length)this.finish();}}
  statistics(){const answered=this.correct+this.mistakes;return {correct:this.correct,characters:this.characters,mistakes:this.mistakes,accuracy:answered?this.correct/answered:null,speed:this.usedMs?this.characters/(this.usedMs/60000):0};}
}
