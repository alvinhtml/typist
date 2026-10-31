import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {Course, CourseWord, Entry, Pair} from '../shared/contracts';
// JSON tuple keys preserve the boundary even for unusual built-in resource values.
export const pairKey=(p:Pair)=>JSON.stringify([p.word,p.code]);
export const courses:Course[]=['1','2','3','4','5','vocabulary'];
export function readBuiltin(directory:string):Entry[]{
  return [1,2,3,4,5].flatMap(level=>{
    const lines=readFileSync(join(directory,`level${level}.csv`),'utf8').replace(/^\uFEFF/,'').trimEnd().split(/\r?\n/);
    if(lines.shift()!=='word,code')throw new Error('无法读取内置词库表头。');
    return lines.filter(Boolean).map(line=>{const fields=line.split(',');if(fields.length!==2||!fields[0]||!fields[1])throw new Error('内置词库格式错误。');return {word:fields[0],code:fields[1],level};});
  });
}
type Node={children:Map<string,Node>;word?:string};
export class Dictionary {
  readonly pairs=new Map<string,{pair:Pair;levels:Set<number>}>();
  readonly byCourse=new Map<Course,Map<string,Set<string>>>();
  readonly byWord=new Map<string,Set<string>>();
  private root:Node={children:new Map()};
  private singles=new Set<string>();
  constructor(builtin:Entry[],supplemental:Entry[],vocabulary:Pair[]=[]){
    for(const c of courses)this.byCourse.set(c,new Map());
    for(const e of [...builtin,...supplemental]){
      const key=pairKey(e);let value=this.pairs.get(key);if(!value){value={pair:{word:e.word,code:e.code},levels:new Set()};this.pairs.set(key,value);}value.levels.add(e.level);
      this.insert(this.byCourse.get(String(e.level) as Course)!,e);
      this.insert(this.byWord,e);
      if(e.level===5){let node=this.root;for(const char of e.word){let next=node.children.get(char);if(!next){next={children:new Map()};node.children.set(char,next);}node=next;}node.word=e.word;}
      else if(Array.from(e.word).length===1)this.singles.add(e.word);
    }
    for(const p of vocabulary)if(this.pairs.has(pairKey(p)))this.insert(this.byCourse.get('vocabulary')!,p);
  }
  private insert(map:Map<string,Set<string>>,p:Pair){let codes=map.get(p.word);if(!codes){codes=new Set();map.set(p.word,codes);}codes.add(p.code);}
  page(course:Course,offset:number,limit:number):{total:number;items:CourseWord[]}{const rows=this.byCourse.get(course)!;return {total:rows.size,items:Array.from(rows).slice(offset,offset+limit).map(([word,codes])=>({word,codes:[...codes]}))};}
  match(text:string):{pairs:Pair[];unknownDistinct:string[]}{
    const chars=Array.from(text),pairs:Pair[]=[],unknown=new Set<string>();
    for(let i=0;i<chars.length;){
      const char=chars[i];if(/[\p{P}\p{Z}\s]/u.test(char)){i++;continue;}
      let node=this.root,word:string|undefined,end=i;
      for(let j=i;j<chars.length;j++){if(/[\p{P}\p{Z}\s]/u.test(chars[j]))break;const next=node.children.get(chars[j]);if(!next)break;node=next;if(node.word){word=node.word;end=j+1;}}
      if(!word&&this.singles.has(char)){word=char;end=i+1;}
      if(word){for(const code of this.byWord.get(word)!)pairs.push({word,code});i=end;}else{unknown.add(char);i++;}
    }
    return {pairs,unknownDistinct:[...unknown]};
  }
}
