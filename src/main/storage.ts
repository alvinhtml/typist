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
  constructor(file:string) {
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
    } catch(e) {this.db.close();throw e;}
  }
  close(){this.db.close();}
  get revision(){return Number(this.db.prepare('SELECT revision FROM metadata WHERE id=1').get()!.revision);}
  snapshot():Result<Snapshot> {
    const settings=this.db.prepare('SELECT groupSize,threshold,duration,difficulty FROM settings WHERE id=1').get() as Settings;
    const rows=this.db.prepare('SELECT * FROM course_progress').all();
    return {ok:true,revision:this.revision,value:{settings,supplemental:this.db.prepare('SELECT * FROM supplemental').all() as Snapshot['supplemental'],vocabulary:this.db.prepare('SELECT * FROM vocabulary').all() as Snapshot['vocabulary'],learning:this.db.prepare('SELECT * FROM learning').all() as Learning[],courseProgress:rows.map(r=>({...r,orderedGroupWords:JSON.parse(String(r.orderedGroupWords))})) as Progress[]}};
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
