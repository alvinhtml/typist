// Disposable SQLite feasibility experiment, never opens application/user data.
const {DatabaseSync}=require('node:sqlite');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'typist-storage-'));const file=path.join(dir,'test.sqlite');
let db=new DatabaseSync(file);const checks=[];
try{
db.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE supplemental(word TEXT NOT NULL,code TEXT NOT NULL,level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 5),PRIMARY KEY(word,code)) STRICT;
CREATE TABLE vocabulary(word TEXT NOT NULL,code TEXT NOT NULL,PRIMARY KEY(word,code)) STRICT;
CREATE TABLE learning(course TEXT NOT NULL,word TEXT NOT NULL,covered INTEGER NOT NULL CHECK(covered IN(0,1)),streak INTEGER NOT NULL CHECK(streak>=0),PRIMARY KEY(course,word)) STRICT;
CREATE TABLE progress(course TEXT PRIMARY KEY,cursor INTEGER NOT NULL CHECK(cursor BETWEEN 0 AND 4),group_json TEXT NOT NULL CHECK(json_valid(group_json))) STRICT;
PRAGMA user_version=1;
INSERT INTO supplemental VALUES('学习','ipnu',5);
INSERT INTO vocabulary VALUES('学习','ipnu');
INSERT INTO learning VALUES('5','学习',1,2);
INSERT INTO progress VALUES('5',4,'["学习"]');`);
assert.throws(()=>db.exec("INSERT INTO supplemental VALUES('学习','ipnu',5)"));checks.push('composite uniqueness');
assert.throws(()=>db.exec("INSERT INTO supplemental VALUES('错误','a',6)"));checks.push('level constraint');
db.exec('BEGIN IMMEDIATE');db.exec("UPDATE supplemental SET code='test' WHERE word='学习'; UPDATE vocabulary SET code='test' WHERE word='学习'");db.exec('ROLLBACK');
assert.equal(db.prepare('SELECT code FROM vocabulary').get().code,'ipnu');checks.push('rollback keeps linked data');
db.exec("BEGIN IMMEDIATE; UPDATE supplemental SET code='abcd'; UPDATE vocabulary SET code='abcd'; COMMIT;");
assert.equal(db.prepare('SELECT code FROM vocabulary').get().code,'abcd');assert.equal(db.prepare('SELECT streak FROM learning').get().streak,2);checks.push('atomic recode preserves word progress');
db.close();db=new DatabaseSync(file);assert.equal(db.prepare('SELECT cursor FROM progress').get().cursor,4);assert.equal(db.prepare('PRAGMA user_version').get().user_version,1);checks.push('reopen persists progress and schema version');
db.exec('PRAGMA query_only=ON');assert.throws(()=>db.exec("DELETE FROM vocabulary"));assert.equal(db.prepare('SELECT count(*) AS n FROM vocabulary').get().n,1);checks.push('read-only write fails without data loss');
console.log(JSON.stringify({runtime:process.versions,checks,scope:'disposable feasibility only; no production storage'},null,2));
}finally{db.close();fs.rmSync(dir,{recursive:true,force:true})}
