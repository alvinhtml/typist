import { parseCsv, serializeCsv } from './csv';
import type { CsvKind, CsvReport } from '../shared/contracts';
import { Dictionary, courses, pairKey } from './dictionary';
import type { LearningWrite, Entry, Pair, Course, SupplementalOperation, SupplementalChange, TextAddition, VocabularyChange, VocabularySelection, CodeReplacement } from '../shared/contracts';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { defaults, type Settings, type Snapshot, type Result, type Write, type ErrorCode, type Learning, type Progress } from '../shared/contracts';
export class StoreError extends Error { constructor(public code:ErrorCode, message:string) {super(message);} }
export function failure(error:unknown):Result<never> {return {ok:false,error:{code:error instanceof StoreError?error.code:'IO',message:error instanceof StoreError?error.message:'本机数据读写失败，请检查磁盘空间和目录权限。',retryable:!(error instanceof StoreError)||error.code==='IO'}};}
const schema = `
CREATE TABLE supplemental(word TEXT NOT NULL, code TEXT NOT NULL, level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 5), PRIMARY KEY(word,code)) STRICT;
CREATE TABLE vocabulary(word TEXT NOT NULL, code TEXT NOT NULL, PRIMARY KEY(word,code)) STRICT;
CREATE TABLE learning(course TEXT NOT NULL CHECK(course IN ('1','2','3','4','5','vocabulary')), word TEXT NOT NULL, covered INTEGER NOT NULL CHECK(covered IN(0,1)), streak INTEGER NOT NULL CHECK(streak>=0), mistakes INTEGER NOT NULL CHECK(mistakes>=0), lastAnsweredAt INTEGER, mastered INTEGER NOT NULL CHECK(mastered IN(0,1)), PRIMARY KEY(course,word)) STRICT;
CREATE INDEX learning_review ON learning(course,lastAnsweredAt,mistakes);
CREATE TABLE course_progress(course TEXT PRIMARY KEY CHECK(course IN ('1','2','3','4','5','vocabulary')), cursor INTEGER NOT NULL CHECK(cursor BETWEEN 0 AND 4), orderedGroupWords TEXT NOT NULL CHECK(json_valid(orderedGroupWords) AND json_type(orderedGroupWords)='array')) STRICT;
CREATE TABLE settings(id INTEGER PRIMARY KEY CHECK(id=1), groupSize INTEGER NOT NULL CHECK(groupSize BETWEEN 5 AND 100), threshold INTEGER NOT NULL CHECK(threshold BETWEEN 1 AND 10), duration INTEGER NOT NULL CHECK(duration BETWEEN 1 AND 5), difficulty TEXT NOT NULL CHECK(difficulty IN ('easy','normal','hard'))) STRICT;
CREATE TABLE metadata(id INTEGER PRIMARY KEY CHECK(id=1), schemaVersion INTEGER NOT NULL, revision INTEGER NOT NULL CHECK(revision>=0)) STRICT;
CREATE TABLE applied_request(requestId TEXT PRIMARY KEY, payloadHash TEXT NOT NULL, result TEXT NOT NULL, revision INTEGER NOT NULL) STRICT;
INSERT INTO metadata VALUES(1,1,0);
PRAGMA user_version=1;`;
export function validateSettings(value:unknown):asserts value is Settings {
  const s = value as Settings;
  if(!s || typeof s!=='object' || Object.keys(s).sort().join(',')!=='difficulty,duration,groupSize,threshold' || !Number.isInteger(s.groupSize)||s.groupSize<5||s.groupSize>100||!Number.isInteger(s.threshold)||s.threshold<1||s.threshold>10||!Number.isInteger(s.duration)||s.duration<1||s.duration>5||!['easy','normal','hard'].includes(s.difficulty)) throw new StoreError('VALIDATION','设置超出允许范围。');
}
export class Store {
  private db:DatabaseSync;
  private index:Dictionary;
  constructor(file:string, private builtin:Entry[] = []) {
    this.index=new Dictionary(builtin,[]);
    mkdirSync(dirname(file),{recursive:true}); const existing = existsSync(file);
    this.db = new DatabaseSync(file);
    try {
      const version = (this.db.prepare('PRAGMA user_version').get() as {user_version:number}).user_version;
      if(version>1) throw new StoreError('MIGRATION','数据来自更高版本，请使用新版应用打开。');
      if(version===0) {
        // Never reinterpret an unknown existing schema as an empty database.
        if(this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().length) throw new StoreError('MIGRATION','无法识别数据库版本，原数据已保留。');
        this.db.close(); if(existing) copyFileSync(file,`${file}.before-v1.bak`); this.db = new DatabaseSync(file);
        this.db.exec('BEGIN IMMEDIATE');
        try {this.db.exec(schema); this.db.prepare('INSERT INTO settings VALUES(1,?,?,?,?)').run(defaults.groupSize,defaults.threshold,defaults.duration,defaults.difficulty); this.db.exec('COMMIT');} catch(e) {this.db.exec('ROLLBACK');throw e;}
      }
      const meta=this.db.prepare('SELECT schemaVersion FROM metadata WHERE id=1').get();
      if(meta?.schemaVersion!==1) throw new StoreError('MIGRATION','数据库版本信息不一致，停止写入。');
      if(this.db.prepare('PRAGMA quick_check').get()?.quick_check!=='ok') throw new StoreError('MIGRATION','数据库完整性检查失败，原数据已保留。');
      this.db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000;');
      this.index=this.makeIndex();
    } catch(e) {this.db.close();throw e;}
  }
  close(){this.db.close();}
  get revision(){return Number(this.db.prepare('SELECT revision FROM metadata WHERE id=1').get()!.revision);}
  snapshot():Result<Snapshot> {
    const settings=this.db.prepare('SELECT groupSize,threshold,duration,difficulty FROM settings WHERE id=1').get() as Settings;
    const rows=this.db.prepare('SELECT * FROM course_progress').all();
    return {ok:true,revision:this.revision,value:{settings,supplemental:this.db.prepare('SELECT * FROM supplemental').all() as Snapshot['supplemental'],vocabulary:this.db.prepare('SELECT * FROM vocabulary').all() as Snapshot['vocabulary'],learning:this.db.prepare('SELECT * FROM learning').all() as Learning[],courseProgress:rows.map(r=>({...r,orderedGroupWords:JSON.parse(String(r.orderedGroupWords))})) as Progress[]}};
  }
  private snapshotValue():Snapshot {const s=this.snapshot();if(!s.ok)throw new Error('无法读取快照');return s.value;}
  private makeIndex(){const s=this.snapshotValue();return new Dictionary(this.builtin,s.supplemental,s.vocabulary);}
  getCourse(request:{course:Course;offset:number;limit:number}) {
    if(!request||!courses.includes(request.course)||!Number.isSafeInteger(request.offset)||request.offset<0||!Number.isSafeInteger(request.limit)||request.limit<1||request.limit>200)throw new StoreError('VALIDATION','无效课程或分页范围。');
    return {ok:true as const,revision:this.revision,value:this.index.page(request.course,request.offset,request.limit)};
  }
  private write<T>(kind:string,request:Write<unknown>,action:()=>T,rebuild=true):{result:Result<T>;committed:boolean}{
    if(!request||typeof request.requestId!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(request.requestId)||!Number.isSafeInteger(request.expectedRevision)||request.expectedRevision<0)throw new StoreError('VALIDATION','无效的写入请求。');
    const hash=createHash('sha256').update(JSON.stringify([kind,request.expectedRevision,request.value])).digest('hex');
    this.db.exec('BEGIN IMMEDIATE');
    try{
      const prior=this.db.prepare('SELECT * FROM applied_request WHERE requestId=?').get(request.requestId);
      if(prior){if(prior.payloadHash!==hash)throw new StoreError('VALIDATION','相同请求编号不能用于不同内容。');this.db.exec('ROLLBACK');return {result:JSON.parse(String(prior.result)),committed:false};}
      if(request.expectedRevision!==this.revision)throw new StoreError('CONFLICT',`数据已更新（当前版本 ${this.revision}），请重新加载后重试。`);
      const value=action();const next=rebuild?this.makeIndex():this.index;
      this.db.exec('UPDATE metadata SET revision=revision+1 WHERE id=1');
      const result:Result<T>={ok:true,value,revision:this.revision};
      this.db.prepare('INSERT INTO applied_request VALUES(?,?,?,?)').run(request.requestId,hash,JSON.stringify(result),result.revision);
      this.db.exec('COMMIT');this.index=next;return {result,committed:true};
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  private pair(value:unknown):asserts value is Pair {
    const p=value as Pair;if(!p||typeof p.word!=='string'||!p.word||p.word.length>200||typeof p.code!=='string'||!p.code||p.code.length>100)throw new StoreError('VALIDATION','无效文字或编码。');
  }
  private entry(value:unknown):Entry {
    this.pair(value);const e=value as Entry,code=e.code.trim().toLowerCase(),length=Array.from(e.word).length;
    if(!Number.isInteger(e.level)||e.level<1||e.level>5||/[\s\p{P}]/u.test(e.word)||!/^[a-z]{1,4}$/.test(code)||(e.level<5?(length!==1||code.length!==e.level):length<2))throw new StoreError('VALIDATION','文字不能含空白或标点；一级至四级需单字及对应长度字母编码，词组需至少两字和1～4位字母编码。');
    return {word:e.word,code,level:e.level};
  }
  private reconcile(before:Snapshot,replacements:CodeReplacement[]):VocabularyChange {
    // Evaluate the complete final dictionary, never intermediate remove/add states.
    let after=this.snapshotValue();const sources=new Dictionary(this.builtin,after.supplemental);
    for(const p of after.vocabulary)if(!sources.pairs.has(pairKey(p)))this.db.prepare('DELETE FROM vocabulary WHERE word=? AND code=?').run(p.word,p.code);
    after=this.snapshotValue();const final=new Dictionary(this.builtin,after.supplemental,after.vocabulary);
    const previous=new Dictionary(this.builtin,before.supplemental,before.vocabulary);
    const removedCourseWords:VocabularyChange['removedCourseWords']=[],affectedCourses:Course[]=[];
    for(const course of courses){
      const oldWords=previous.byCourse.get(course)!,newWords=final.byCourse.get(course)!;
      if(JSON.stringify([...oldWords].map(([w,c])=>[w,[...c]]))!==JSON.stringify([...newWords].map(([w,c])=>[w,[...c]])))affectedCourses.push(course);
      const stale=new Set<string>();
      for(const word of oldWords.keys())if(!newWords.has(word)){stale.add(word);removedCourseWords.push({course,word});}
      for(const l of before.learning)if(l.course===course&&!newWords.has(l.word))stale.add(l.word);
      for(const word of stale)this.db.prepare('DELETE FROM learning WHERE course=? AND word=?').run(course,word);
      for(const p of before.courseProgress)if(p.course===course){const words=p.orderedGroupWords.filter(w=>newWords.has(w));if(words.length!==p.orderedGroupWords.length)this.db.prepare('UPDATE course_progress SET orderedGroupWords=? WHERE course=?').run(JSON.stringify(words),course);}
    }
    const oldPairs=new Set(before.vocabulary.map(pairKey)),newPairs=new Set(after.vocabulary.map(pairKey));
    const finalReplacements:CodeReplacement[]=[];
    for(const p of before.vocabulary){let code=p.code;for(const r of replacements)if(r.word===p.word&&r.oldCode===code)code=r.newCode;if(code!==p.code&&newPairs.has(pairKey({word:p.word,code})))finalReplacements.push({word:p.word,oldCode:p.code,newCode:code});}
    return {addedPairs:after.vocabulary.filter(p=>!oldPairs.has(pairKey(p))),removedPairs:before.vocabulary.filter(p=>!newPairs.has(pairKey(p))),codeReplacements:finalReplacements,removedCourseWords,affectedCourses};
  }
  addVocabularyText(request:Write<string>){
    if(!request||typeof request.value!=='string'||!request.value.trim()||request.value.length>100000)throw new StoreError('VALIDATION','请输入文本，单次最多100000个字符。');
    return this.write<TextAddition>('text',request,()=>{
      const before=this.snapshotValue(),match=this.index.match(request.value);let duplicateOccurrences=0;
      const insert=this.db.prepare('INSERT OR IGNORE INTO vocabulary VALUES(?,?)');
      for(const p of match.pairs)if(!insert.run(p.word,p.code).changes)duplicateOccurrences++;
      return {...this.reconcile(before,[]),duplicateOccurrences,unknownDistinct:match.unknownDistinct};
    });
  }
  deleteVocabulary(request:Write<VocabularySelection>){
    const v=request?.value;if(!v||!Array.isArray(v.pairs)||!Array.isArray(v.words)||v.pairs.length+v.words.length<1||v.pairs.length+v.words.length>1000)throw new StoreError('VALIDATION','请选择1～1000个删除项。');
    for(const p of v.pairs)this.pair(p);for(const w of v.words)if(typeof w!=='string'||!w||w.length>200)throw new StoreError('VALIDATION','无效文字。');
    return this.write<VocabularyChange>('delete-vocabulary',request,()=>{const before=this.snapshotValue();for(const p of v.pairs)this.db.prepare('DELETE FROM vocabulary WHERE word=? AND code=?').run(p.word,p.code);for(const w of v.words)this.db.prepare('DELETE FROM vocabulary WHERE word=?').run(w);return this.reconcile(before,[]);});
  }
  mutateSupplemental(request:Write<SupplementalOperation[]>){
    if(!request||!Array.isArray(request.value)||!request.value.length||request.value.length>1000)throw new StoreError('VALIDATION','单次需1～1000项变更。');
    for(const op of request.value){if(!op||!['add','update','delete'].includes(op.kind))throw new StoreError('VALIDATION','无效词库操作。');if(op.kind==='delete')this.pair(op.pair);else{this.entry(op.entry);if(op.kind==='update'){this.pair(op.oldPair);if(op.oldPair.word!==op.entry.word)throw new StoreError('VALIDATION','修改仅支持编码和分类。');}}}
    return this.write<SupplementalChange>('supplemental',request,()=>{
      const before=this.snapshotValue(),codeReplacements:CodeReplacement[]=[];let merged=0;
      const builtinKeys=new Set(this.builtin.map(pairKey));
      for(const op of request.value){
        if(op.kind==='delete'){this.db.prepare('DELETE FROM supplemental WHERE word=? AND code=?').run(op.pair.word,op.pair.code);continue;}
        const entry=this.entry(op.entry);
        if(op.kind==='update'){
          const old=op.oldPair;if(!this.db.prepare('SELECT 1 FROM supplemental WHERE word=? AND code=?').get(old.word,old.code))throw new StoreError('VALIDATION','待修改的补充词条不存在，请重新加载。');
          this.db.prepare('DELETE FROM supplemental WHERE word=? AND code=?').run(old.word,old.code);
          if(old.code!==entry.code&&this.db.prepare('SELECT 1 FROM vocabulary WHERE word=? AND code=?').get(old.word,old.code)){
            this.db.prepare('DELETE FROM vocabulary WHERE word=? AND code=?').run(old.word,old.code);
            this.db.prepare('INSERT OR IGNORE INTO vocabulary VALUES(?,?)').run(entry.word,entry.code);
            codeReplacements.push({word:old.word,oldCode:old.code,newCode:entry.code});
          }
        }
        if(builtinKeys.has(pairKey(entry))||this.db.prepare('SELECT 1 FROM supplemental WHERE word=? AND code=?').get(entry.word,entry.code))merged++;else this.db.prepare('INSERT INTO supplemental VALUES(?,?,?)').run(entry.word,entry.code,entry.level);
      }
      const change=this.reconcile(before,codeReplacements),after=this.snapshotValue();
      const equal=(a:Entry,b:Entry)=>pairKey(a)===pairKey(b)&&a.level===b.level;
      return {...change,merged,addedEntries:after.supplemental.filter(a=>!before.supplemental.some(b=>equal(a,b))),removedEntries:before.supplemental.filter(a=>!after.supplemental.some(b=>equal(a,b)))};
    });
  }
  exportCsv(kind:CsvKind){const snapshot=this.snapshotValue();return {text:serializeCsv(kind,snapshot[kind]),count:snapshot[kind].length};}
  importCsv(request:Write<CsvKind>,bytes:Uint8Array){
    let rows:ReturnType<typeof parseCsv>;try{rows=parseCsv(bytes,request.value);}catch(e){throw new StoreError('VALIDATION',(e as Error).message);}
    return this.write<CsvReport>('import-csv',{...request,value:{kind:request.value,content:Buffer.from(bytes).toString('base64')}},()=>{
      const before=this.snapshotValue(),issues:CsvReport['issues']=[];let added=0,duplicates=0,failed=0;
      const known=new Dictionary(this.builtin,before.supplemental),existing=new Map((request.value==='supplemental'?[...this.builtin,...before.supplemental]:before.vocabulary).map(p=>[pairKey(p),p]));
      for(const row of rows){
        try{
          const pair={word:row.word,code:row.code.trim().toLowerCase()};this.pair(pair);
          const entry=request.value==='supplemental'?this.entry({...pair,level:/^[1-5]$/.test(row.level)?Number(row.level):0}):pair;
          if(request.value==='vocabulary'&&!known.pairs.has(pairKey(pair)))throw new Error('文字与编码未匹配本机词库，请先导入补充词库。');
          const prior=existing.get(pairKey(entry));
          if(prior){duplicates++;if('level' in entry&&'level' in prior&&entry.level!==prior.level)issues.push({line:row.line,reason:'分类冲突，保留已有分类（重复忽略）。'});continue;}
          if(request.value==='supplemental')this.db.prepare('INSERT INTO supplemental VALUES(?,?,?)').run(entry.word,entry.code,(entry as Entry).level);
          else this.db.prepare('INSERT INTO vocabulary VALUES(?,?)').run(entry.word,entry.code);
          existing.set(pairKey(entry),entry);added++;
        }catch(e){if(!(e instanceof StoreError)&&!((e as Error).message.startsWith('文字与编码未匹配')))throw e;failed++;issues.push({line:row.line,reason:(e as Error).message});}
      }
      return {...this.reconcile(before,[]),added,duplicates,failed,issues};
    });
  }
  saveLearning(request:Write<LearningWrite>){
    const v=request?.value;
    if(!v||!courses.includes(v.course)||!Array.isArray(v.changes)||v.changes.length>200||!Array.isArray(v.group)||v.group.length>100||new Set(v.group).size!==v.group.length||!Number.isInteger(v.cursor)||v.cursor<0||v.cursor>4)throw new StoreError('VALIDATION','无效学习进度。');
    return this.write('learning',request,()=>{
      const valid=this.index.byCourse.get(v.course)!;
      for(const word of v.group)if(typeof word!=='string'||!valid.has(word))throw new StoreError('VALIDATION','练习组包含不属于该课程的文字。');
      const words=new Set<string>();
      for(const row of v.changes){
        if(!row||row.course!==v.course||typeof row.word!=='string'||!valid.has(row.word)||words.has(row.word)||![0,1].includes(row.covered)||![0,1].includes(row.mastered)||!Number.isSafeInteger(row.streak)||row.streak<0||!Number.isSafeInteger(row.mistakes)||row.mistakes<0||(row.lastAnsweredAt!==null&&(!Number.isSafeInteger(row.lastAnsweredAt)||row.lastAnsweredAt<0)))throw new StoreError('VALIDATION','学习记录字段或课程归属无效。');
        words.add(row.word);
      }
      const statement=this.db.prepare('INSERT INTO learning VALUES(?,?,?,?,?,?,?) ON CONFLICT(course,word) DO UPDATE SET covered=excluded.covered,streak=excluded.streak,mistakes=excluded.mistakes,lastAnsweredAt=excluded.lastAnsweredAt,mastered=excluded.mastered');
      for(const row of v.changes)statement.run(row.course,row.word,row.covered,row.streak,row.mistakes,row.lastAnsweredAt,row.mastered);
      this.db.prepare('INSERT INTO course_progress VALUES(?,?,?) ON CONFLICT(course) DO UPDATE SET cursor=excluded.cursor,orderedGroupWords=excluded.orderedGroupWords').run(v.course,v.cursor,JSON.stringify(v.group));
      return {course:v.course};
    },false);
  }
  updateSettings(request:Write<Settings>):{result:Result<Settings>; committed:boolean} {
    if(!request||typeof request.requestId!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(request.requestId)||!Number.isSafeInteger(request.expectedRevision)||request.expectedRevision<0) throw new StoreError('VALIDATION','无效的写入请求。');
    validateSettings(request.value); const s=request.value;
    const hash=createHash('sha256').update(JSON.stringify([request.expectedRevision,s.groupSize,s.threshold,s.duration,s.difficulty])).digest('hex');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const prior=this.db.prepare('SELECT * FROM applied_request WHERE requestId=?').get(request.requestId);
      if(prior) {if(prior.payloadHash!==hash) throw new StoreError('VALIDATION','相同请求编号不能用于不同内容。');this.db.exec('ROLLBACK');return {result:JSON.parse(String(prior.result)),committed:false};}
      if(request.expectedRevision!==this.revision) throw new StoreError('CONFLICT',`数据已更新（当前版本 ${this.revision}），请重新加载后再保存。`);
      this.db.prepare('UPDATE settings SET groupSize=?,threshold=?,duration=?,difficulty=? WHERE id=1').run(s.groupSize,s.threshold,s.duration,s.difficulty);
      this.db.exec('UPDATE metadata SET revision=revision+1 WHERE id=1');
      const result:Result<Settings>={ok:true,value:s,revision:this.revision};
      this.db.prepare('INSERT INTO applied_request VALUES(?,?,?,?)').run(request.requestId,hash,JSON.stringify(result),result.revision);
      this.db.exec('COMMIT'); return {result,committed:true};
    } catch(e) {this.db.exec('ROLLBACK');throw e;}
  }
}
