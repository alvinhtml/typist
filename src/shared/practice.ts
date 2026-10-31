import type {Course,CourseWord,Learning,Progress,Settings,LearningWrite} from './contracts';
export type AnswerFeedback={word:string;answer:string;correct:boolean;skipped:boolean;codes:string[]};
/** Deterministic business model. Persistence and the active clock belong to its caller. */
export class Practice {
  items:Map<string,string[]>;
  records=new Map<string,Learning>();
  group:string[]=[];round:string[]=[];position=0;cursor=0;roundNumber=0;
  feedback:AnswerFeedback[]=[];previousFeedback:AnswerFeedback[]=[];
  answered=0;correct=0;correctCharacters=0;
  private dirty=new Set<string>();
  constructor(readonly course:Course,items:CourseWord[],readonly settings:Readonly<Settings>,learning:Learning[],progress?:Progress,private random:()=>number=Math.random){
    this.items=new Map(items.map(i=>[i.word,[...i.codes]]));
    for(const l of learning)if(l.course===course&&this.items.has(l.word))this.records.set(l.word,{...l});
    this.cursor=progress?.cursor??0;
    const existing=(progress?.orderedGroupWords??[]).filter(w=>this.items.has(w));
    // A smaller next-session group retains unfinished words first.
    this.group=[...existing.filter(w=>this.record(w).streak<settings.threshold),...existing.filter(w=>this.record(w).streak>=settings.threshold)].slice(0,settings.groupSize);
    for(const word of this.group)if(this.record(word).streak>=settings.threshold){this.record(word).mastered=1;this.dirty.add(word);}
    this.nextRound(!progress);
  }
  private record(word:string):Learning{let row=this.records.get(word);if(!row){row={course:this.course,word,covered:0,streak:0,mistakes:0,lastAnsweredAt:null,mastered:0};this.records.set(word,row);}return row;}
  private shuffle<T>(values:T[]):T[]{const a=[...values];for(let i=a.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  private review(words:string[]):string|undefined{return this.shuffle(words).sort((a,b)=>(this.record(a).lastAnsweredAt??-Infinity)-(this.record(b).lastAnsweredAt??-Infinity)||this.record(b).mistakes-this.record(a).mistakes)[0];}
  private nextRound(initial=false){
    if(this.feedback.length)this.previousFeedback=this.feedback.map(f=>({...f,codes:[...f.codes]}));
    const outgoing=new Set(this.group.filter(w=>this.record(w).streak>=this.settings.threshold));
    this.group=this.group.filter(w=>this.items.has(w)&&!outgoing.has(w));
    const target=Math.min(this.settings.groupSize,this.items.size);
    while(this.group.length<target){
      let available=[...this.items.keys()].filter(w=>!this.group.includes(w)&&!outgoing.has(w));
      if(!available.length)available=[...this.items.keys()].filter(w=>!this.group.includes(w));
      const fresh=available.filter(w=>!this.record(w).covered),unfinished=available.filter(w=>this.record(w).covered&&!this.record(w).mastered),review=available.filter(w=>this.record(w).mastered);
      let word:string|undefined;
      if(initial&&fresh.length)word=this.shuffle(fresh)[0];
      else if([...this.items.keys()].some(w=>!this.record(w).covered)){
        word=this.cursor===4?(this.review(review)??this.shuffle(fresh)[0]):(this.shuffle(fresh)[0]??this.review(review));
        word??=this.review(unfinished);this.cursor=(this.cursor+1)%5;
      }else{word=this.review(unfinished)??this.review(review);this.cursor=(this.cursor+1)%5;}
      if(!word)break;
      const record=this.record(word);if(record.covered){record.streak=0;this.dirty.add(word);}
      this.group.push(word);
    }
    this.round=this.shuffle(this.group);this.position=0;this.feedback=[];this.roundNumber++;
  }
  get current(){return this.round[this.position];}
  get covered(){return [...this.records.values()].filter(r=>this.items.has(r.word)&&r.covered).length;}
  get mastered(){return [...this.records.values()].filter(r=>this.items.has(r.word)&&r.mastered).length;}
  get total(){return this.items.size;}
  answer(answer:string|null,at:number){
    const word=this.current;if(!word||answer==='')return false;
    const normalized=answer?.toLowerCase()??'',skipped=answer===null,correct=!skipped&&(this.items.get(word)??[]).includes(normalized),row=this.record(word);
    row.covered=1;row.lastAnsweredAt=at;
    if(correct){row.streak++;if(row.streak>=this.settings.threshold)row.mastered=1;this.correct++;this.correctCharacters+=Array.from(word).length;}
    else{row.streak=0;row.mastered=0;row.mistakes++;}
    this.dirty.add(word);this.answered++;
    this.feedback.push({word,answer:correct?word:normalized,correct,skipped,codes:[...(this.items.get(word)??[])]});
    this.position++;if(this.position>=this.round.length)this.nextRound();return true;
  }
  sync(items:CourseWord[],learning:Learning[]){
    const oldCurrent=this.current,done=new Set(this.round.slice(0,this.position));
    this.items=new Map(items.map(i=>[i.word,[...i.codes]]));
    this.records=new Map(learning.filter(l=>l.course===this.course&&this.items.has(l.word)).map(l=>[l.word,{...l}]));this.dirty.clear();
    this.group=this.group.filter(w=>this.items.has(w));
    this.round=this.round.filter(w=>this.items.has(w));this.position=this.round.filter(w=>done.has(w)).length;
    this.feedback=this.feedback.filter(f=>this.items.has(f.word)).map(f=>({...f,codes:[...(this.items.get(f.word)??[])]}));
    if(this.round.length&&this.position>=this.round.length)this.nextRound();
    else if(!this.round.length&&this.items.size)this.nextRound();
    return oldCurrent!==this.current;
  }
  write():LearningWrite{return {course:this.course,changes:[...this.dirty].filter(w=>this.items.has(w)).map(w=>({...this.record(w)})),group:[...this.group],cursor:this.cursor};}
  saved(){this.dirty.clear();}
  clone():Practice{const p=Object.create(Practice.prototype) as Practice;Object.assign(p,this);p.items=new Map([...this.items].map(([w,c])=>[w,[...c]]));p.records=new Map([...this.records].map(([w,l])=>[w,{...l}]));p.group=[...this.group];p.round=[...this.round];p.feedback=this.feedback.map(f=>({...f,codes:[...f.codes]}));p.previousFeedback=this.previousFeedback.map(f=>({...f,codes:[...f.codes]}));p.dirty=new Set(this.dirty);return p;}
  statistics(elapsedMs:number){return {answered:this.answered,correct:this.correct,correctCharacters:this.correctCharacters,accuracy:this.answered?this.correct/this.answered:null,speed:elapsedMs>0?this.correctCharacters/(elapsedMs/60000):0};}
}
