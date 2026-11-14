const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store}=require('../dist/main/storage');const {Dictionary,readBuiltin}=require('../dist/main/dictionary');
const builtins=[{word:'学',code:'i',level:1},{word:'习',code:'nu',level:2},{word:'学习',code:'ipnu',level:5},{word:'学习者',code:'ipnf',level:5},{word:'学',code:'ipb',level:3},{word:'工',code:'a',level:1},{word:'工',code:'a',level:4}];
function fixture(t,b=builtins){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'typist-business-'));let store=new Store(path.join(dir,'data.sqlite'),b);t.after(()=>{store.close();fs.rmSync(dir,{recursive:true,force:true});});let id=0;return {get s(){return store},reopen(){store.close();store=new Store(path.join(dir,'data.sqlite'),b)},req(value){return {requestId:`req-${++id}`,expectedRevision:store.revision,value}}};}
function value(out){assert.equal(out.result.ok,true);return out.result.value;}
test('practice additions match the full word and retain every code',t=>{
 const {s,req}=fixture(t,[...builtins,{word:'。',code:'zz',level:2}]);
 assert.equal(value(s.addVocabularyText(req('。'))).addedPairs.length,0);
 assert.deepEqual(value(s.addVocabularyText(req('。'),true)).addedPairs.map(p=>({...p})),[{word:'。',code:'zz'}]);
 assert.equal(value(s.addVocabularyText(req('学'),true)).addedPairs.length,2);
 assert.equal(value(s.addVocabularyText(req('学'),true)).duplicateOccurrences,2);
 assert.deepEqual(value(s.addVocabularyText(req('学习学习'),true)).unknownDistinct,['学习学习']);
});
test('longest phrases, no internal singles, separators, unknown distinct and all codes',()=>{
 const d=new Dictionary(builtins,[]);assert.deepEqual(d.match('学习者学习，学\n习🚀🚀A1'),{pairs:[{word:'学习者',code:'ipnf'},{word:'学习',code:'ipnu'},{word:'学',code:'i'},{word:'学',code:'ipb'},{word:'习',code:'nu'}],unknownDistinct:['🚀','A','1']});
 assert.equal(d.pairs.get(JSON.stringify(['工','a'])).levels.size,2);assert.equal(d.page('4',0,10).items[0].word,'工');assert.equal(d.match('学，习').pairs.some(p=>p.word==='学习'),false);
});
test('text additions count occurrences, report only new codes and preserve progress; restart',t=>{
 const f=fixture(t),s=f.s;const first=value(s.addVocabularyText(f.req('学学')));assert.equal(first.addedPairs.length,2);assert.equal(first.duplicateOccurrences,2);
 s.db.exec("INSERT INTO learning VALUES('vocabulary','学',1,3,2,123,1)");
 value(s.mutateSupplemental(f.req([{kind:'add',entry:{word:'学',code:'xx',level:2}}])));
 const next=value(s.addVocabularyText(f.req('学')));assert.deepEqual(next.addedPairs.map(p=>({...p})),[{word:'学',code:'xx'}]);assert.equal(next.duplicateOccurrences,2);assert.equal(s.snapshot().value.learning[0].streak,3);
 f.reopen();assert.equal(f.s.snapshot().value.vocabulary.length,3);assert.equal(f.s.getCourse({course:'vocabulary',offset:0,limit:10}).value.total,1);
});
test('supplemental validation, normalization, built-in duplicate and no automatic vocabulary',t=>{
 const f=fixture(t);for(const entry of [{word:'词组',code:'a',level:1},{word:'词，组',code:'aa',level:5},{word:'词 组',code:'aa',level:5},{word:'字',code:'abc',level:2},{word:'字',code:'1',level:1}])assert.throws(()=>f.s.mutateSupplemental(f.req([{kind:'add',entry}])),{code:'VALIDATION'});
 const added=value(f.s.mutateSupplemental(f.req([{kind:'add',entry:{word:'𠮷',code:' AB ',level:2}}])));assert.equal(added.addedEntries[0].code,'ab');assert.equal(f.s.snapshot().value.vocabulary.length,0);
 const duplicate=value(f.s.mutateSupplemental(f.req([{kind:'add',entry:{word:'工',code:'a',level:1}}])));assert.equal(duplicate.merged,1);assert.equal(f.s.snapshot().value.supplemental.length,1);
 assert.throws(()=>f.s.mutateSupplemental(f.req([{kind:'update',oldPair:{word:'工',code:'a'},entry:{word:'工',code:'b',level:1}}])),{code:'VALIDATION'});
});
test('code replacement merging preserves other codes and valid learning; final classification cleans only exited course',t=>{
 const f=fixture(t);value(f.s.mutateSupplemental(f.req([{kind:'add',entry:{word:'新',code:'x',level:1}},{kind:'add',entry:{word:'新',code:'xx',level:2}}])));value(f.s.addVocabularyText(f.req('新')));
 f.s.db.exec(`INSERT INTO learning VALUES('1','新',1,3,1,100,1);INSERT INTO learning VALUES('2','新',1,2,0,100,0);INSERT INTO learning VALUES('vocabulary','新',1,4,0,100,1);INSERT INTO course_progress VALUES('1',3,'["新","工"]');`);
 const changed=value(f.s.mutateSupplemental(f.req([{kind:'update',oldPair:{word:'新',code:'x'},entry:{word:'新',code:'xx',level:2}}])));
 assert.equal(changed.merged,1);assert.deepEqual(f.s.snapshot().value.vocabulary.map(p=>({...p})),[{word:'新',code:'xx'}]);assert.equal(changed.codeReplacements.length,1);assert.deepEqual(f.s.snapshot().value.learning.map(l=>l.course).sort(),['2','vocabulary']);assert.deepEqual(f.s.snapshot().value.courseProgress[0],{course:'1',cursor:3,orderedGroupWords:['工']});
 const renamed=value(f.s.mutateSupplemental(f.req([{kind:'update',oldPair:{word:'新',code:'xx'},entry:{word:'新',code:'yy',level:2}}])));assert.equal(renamed.codeReplacements[0].newCode,'yy');assert.equal(f.s.snapshot().value.learning.find(l=>l.course==='2').streak,2);
 value(f.s.mutateSupplemental(f.req([{kind:'delete',pair:{word:'新',code:'yy'}}])));assert.equal(f.s.snapshot().value.vocabulary.length,0);assert.equal(f.s.snapshot().value.learning.length,0);
});
test('atomic remove/add keeps final sources and progress; deleting uncollected entry never adds vocabulary',t=>{
 const f=fixture(t);value(f.s.mutateSupplemental(f.req([{kind:'add',entry:{word:'新',code:'x',level:1}}])));value(f.s.addVocabularyText(f.req('新')));f.s.db.exec("INSERT INTO learning VALUES('1','新',1,2,0,100,0)");
 value(f.s.mutateSupplemental(f.req([{kind:'delete',pair:{word:'新',code:'x'}},{kind:'add',entry:{word:'新',code:'x',level:1}}])));assert.equal(f.s.snapshot().value.learning.length,1);assert.equal(f.s.snapshot().value.vocabulary.length,1);
 value(f.s.mutateSupplemental(f.req([{kind:'add',entry:{word:'末',code:'m',level:1}},{kind:'update',oldPair:{word:'末',code:'m'},entry:{word:'末',code:'n',level:1}}])));assert.equal(f.s.snapshot().value.vocabulary.length,1);
});
test('pair and word batch deletion retain learning until last code; word resolved using current snapshot',t=>{
 const f=fixture(t);value(f.s.addVocabularyText(f.req('学工')));f.s.db.exec("INSERT INTO learning VALUES('vocabulary','学',1,2,0,100,0);INSERT INTO learning VALUES('1','学',1,2,0,100,0)");
 value(f.s.deleteVocabulary(f.req({pairs:[{word:'学',code:'i'}],words:[]})));assert.equal(f.s.snapshot().value.learning.length,2);
 value(f.s.deleteVocabulary(f.req({pairs:[],words:['学','工']})));assert.equal(f.s.snapshot().value.vocabulary.length,0);assert.deepEqual(f.s.snapshot().value.learning.map(l=>l.course),['1']);
});
test('idempotent writes, conflicts, invalid batches and mid-transaction failure roll back index and data',t=>{
 const f=fixture(t),req=f.req('工');assert.equal(f.s.addVocabularyText(req).committed,true);assert.equal(f.s.addVocabularyText(req).committed,false);assert.throws(()=>f.s.addVocabularyText({...req,value:'学'}),{code:'VALIDATION'});assert.throws(()=>f.s.addVocabularyText({...req,requestId:'other'}),{code:'CONFLICT'});
 const revision=f.s.revision;assert.throws(()=>f.s.mutateSupplemental(f.req([{kind:'add',entry:{word:'新',code:'x',level:1}},{kind:'update',oldPair:{word:'不存在',code:'x'},entry:{word:'不存在',code:'abc',level:5}}])),{code:'VALIDATION'});assert.equal(f.s.revision,revision);assert.equal(f.s.snapshot().value.supplemental.length,0);
 f.s.db.exec("CREATE TRIGGER fail_request BEFORE INSERT ON applied_request BEGIN SELECT RAISE(ABORT,'disk failure'); END");assert.throws(()=>f.s.mutateSupplemental(f.req([{kind:'add',entry:{word:'新',code:'x',level:1}}])));assert.equal(f.s.revision,revision);assert.equal(f.s.getCourse({course:'1',offset:0,limit:100}).value.items.some(x=>x.word==='新'),false);assert.equal(f.s.snapshot().value.supplemental.length,0);
 assert.throws(()=>f.s.getCourse({course:'6',offset:0,limit:200}),{code:'VALIDATION'});
});
test('real built-in corpus loads five courses and preserves original codes',()=>{const builtin=readBuiltin(path.resolve('data'));const d=new Dictionary(builtin,[]);for(const course of ['1','2','3','4','5'])assert.ok(d.page(course,0,5).total>0);assert.ok(d.match('工').pairs.some(p=>p.code==='a'));});
test('empty results, existing-only input and unknown content never report false additions',t=>{
 const f=fixture(t);const empty=value(f.s.addVocabularyText(f.req('，\n🚀🚀')));assert.deepEqual(empty.addedPairs,[]);assert.deepEqual(empty.unknownDistinct,['🚀']);value(f.s.addVocabularyText(f.req('工')));const duplicate=value(f.s.addVocabularyText(f.req('工工')));assert.equal(duplicate.addedPairs.length,0);assert.equal(duplicate.duplicateOccurrences,2);
 assert.throws(()=>f.s.addVocabularyText(f.req(' \n ')),{code:'VALIDATION'});
});
test('batch supplemental removal keeps built-in and remaining codes; classification change keeps vocabulary progress',t=>{
 // Simulate a persisted supplemental pair that is also present in a later built-in resource.
 const f=fixture(t);f.s.db.exec("INSERT INTO supplemental VALUES('工','a',1)");f.reopen();value(f.s.mutateSupplemental(f.req([{kind:'add',entry:{word:'新',code:'x',level:1}},{kind:'add',entry:{word:'末',code:'m',level:1}},{kind:'add',entry:{word:'新',code:'xx',level:2}}])));value(f.s.addVocabularyText(f.req('工新末')));
 f.s.db.exec("INSERT INTO learning VALUES('vocabulary','新',1,4,0,100,1);INSERT INTO learning VALUES('1','新',1,4,0,100,1)");
 value(f.s.mutateSupplemental(f.req([{kind:'delete',pair:{word:'工',code:'a'}},{kind:'delete',pair:{word:'新',code:'x'}},{kind:'delete',pair:{word:'末',code:'m'}}])));assert.deepEqual(f.s.snapshot().value.vocabulary.map(p=>p.word).sort(),['工','新']);assert.equal(f.s.snapshot().value.learning.length,1);
 value(f.s.mutateSupplemental(f.req([{kind:'add',entry:{word:'新词',code:'aa',level:5}},{kind:'update',oldPair:{word:'新',code:'xx'},entry:{word:'新',code:'yy',level:2}}])));assert.equal(f.s.snapshot().value.learning[0].streak,4);
});
test('a failed code replacement restores original code, learning, group and revision',t=>{
 const f=fixture(t);value(f.s.mutateSupplemental(f.req([{kind:'add',entry:{word:'新',code:'x',level:1}}])));value(f.s.addVocabularyText(f.req('新')));f.s.db.exec(`INSERT INTO learning VALUES('vocabulary','新',1,4,0,100,1);INSERT INTO course_progress VALUES('vocabulary',2,'["新"]');CREATE TRIGGER fail_request BEFORE INSERT ON applied_request BEGIN SELECT RAISE(ABORT,'disk failure'); END`);
 const before=f.s.snapshot();assert.throws(()=>f.s.mutateSupplemental(f.req([{kind:'update',oldPair:{word:'新',code:'x'},entry:{word:'新',code:'y',level:1}}])));assert.deepEqual(f.s.snapshot(),before);assert.equal(f.s.getCourse({course:'vocabulary',offset:0,limit:100}).value.items[0].codes[0],'x');
});
test('a multi-operation replacement publishes only the final code and preserves learning',t=>{
 const f=fixture(t);value(f.s.mutateSupplemental(f.req([{kind:'add',entry:{word:'新',code:'x',level:1}}])));value(f.s.addVocabularyText(f.req('新')));f.s.db.exec("INSERT INTO learning VALUES('vocabulary','新',1,3,0,100,1)");
 const changed=value(f.s.mutateSupplemental(f.req([{kind:'update',oldPair:{word:'新',code:'x'},entry:{word:'新',code:'y',level:1}},{kind:'update',oldPair:{word:'新',code:'y'},entry:{word:'新',code:'z',level:1}}])));assert.deepEqual(changed.codeReplacements,[{word:'新',oldCode:'x',newCode:'z'}]);assert.equal(f.s.snapshot().value.learning[0].streak,3);
});
