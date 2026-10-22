import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { chooseSequence } from '../components/sequenceState.js'
import { preserveProcedureDetails } from '../components/procedureUtils.js'
import { mergeCollection } from '../components/syncMerge.js'
import { patientRecordKey } from '../components/syncUtils.js'
const sql = await readFile(new URL('../migrations/001_atomic_sync.sql',import.meta.url),'utf8')
const pg = new PGlite()
await pg.exec(`CREATE TABLE shared_records(kind text,record_key text,payload jsonb NOT NULL,version_time timestamptz NOT NULL,server_updated_at timestamptz DEFAULT now(),PRIMARY KEY(kind,record_key));
CREATE TABLE shared_tombstones(kind text,record_key text,deleted_at timestamptz,PRIMARY KEY(kind,record_key));
CREATE TABLE system_state(key text PRIMARY KEY,value jsonb,updated_at timestamptz DEFAULT now());`)
await pg.exec(sql)
const call = async (mode,body={}) => (await pg.query('SELECT delta_apply($1,$2::jsonb,$3::jsonb) AS data',[mode,JSON.stringify(body),JSON.stringify({id:'u',name:'Luiza',username:'luiza'})])).rows[0].data
const input = id => ({patient:{id,patientName:'Thor',tutorName:'Tutor',species:'FELINO',sex:'Macho',location:'Caixa',locationNumber:'500'},autoLocation:true})
test('500 → 501 → 502, refresh, stale snapshot and another device',async()=>{
 const initial=await call('configure',{nextPatientNumber:500}); assert.equal(initial.nextPatientNumber,500)
 const a=await call('create',input('patient-0000000001'));assert.equal(a.patient.number,500);assert.equal(a.nextPatientNumber,501)
 const b=await call('create',input('patient-0000000002'));assert.equal(b.patient.number,501);assert.equal(b.nextPatientNumber,502)
 assert.equal((await call('read')).nextPatientNumber,502)
 assert.equal((await call('sync',{nextPatientNumber:500,patients:[]})).nextPatientNumber,502)
 const current=chooseSequence(null,b);assert.equal(chooseSequence(current,initial).value,502)
 assert.equal((await call('read')).patients.length,2)
})
test('concurrent queued requests have distinct numbers; retry is idempotent',async()=>{
 const results=await Promise.all(Array.from({length:12},(_,i)=>call('create',input(`parallel-${i}`))))
 assert.equal(new Set(results.map(r=>r.patient.number)).size,12)
 const retry=await call('create',input('parallel-0'))
 assert.equal(retry.patient.number,results[0].patient.number)
 assert.equal((await call('read')).patients.length,14)
 assert.equal((await call('read')).auditLog.filter(a=>a.action==='ENTRADA_CRIADA').length,14)
})
test('intentional reset has newer revision; old epoch remains unchanged',async()=>{
 const before=await call('read');const reset=await call('configure',{nextPatientNumber:1})
 assert.equal(chooseSequence(chooseSequence(null,before),reset).value,1)
 const a=await call('create',input('new-epoch'));assert.equal(a.patient.number,1)
 assert.equal((await call('read')).patients.find(p=>p.id==='patient-0000000001').number,500)
})
test('permanent deletion survives future clocks and stale device imports',async()=>{
 const p=(await call('read')).patients.find(p=>p.id==='parallel-1')
 await call('sync',{deletions:[{kind:'patients',recordKey:p.id,at:'2000-01-01'}]})
 const r=await call('sync',{patients:[{...p,_syncUpdatedAt:'2099-01-01'}]})
 assert.ok(!r.patients.some(x=>x.id===p.id));assert.ok(r.deletions.some(x=>x.recordKey===p.id))
 assert.ok((await pg.query('SELECT * FROM shared_record_versions WHERE record_key=$1',[p.id])).rows.length)
})
test('legacy import preserves numbers, invalid dates do not abort sync',async()=>{
 const p={number:700,createdAt:new Date().toISOString(),patientName:'Legacy',timeline:null}
 const r=await call('sync',{patients:[p,{number:9,createdAt:'invalid'}]})
 assert.ok(r.patients.some(x=>x.number===700));assert.equal(r.nextPatientNumber,701)
})
test('read / sync do not replace a saved patient number or drop timeline',async()=>{
 const p=(await call('read')).patients.find(p=>p.id==='new-epoch')
 const r=await call('sync',{patients:[{...p,number:999,_syncUpdatedAt:'2098-01-01',timeline:[{type:'ALTA',at:'2098-01-01'}]}]})
 const saved=r.patients.find(x=>x.id===p.id);assert.equal(saved.number,1)
 assert.ok(saved.timeline.some(e=>e.type==='ENTRADA_CRIADA'));assert.ok(saved.timeline.some(e=>e.type==='ALTA'))
})
test('local merge retains new records and in-flight edits, applies tombstones',()=>{
 const sent=[{id:'a',notes:'old'}];const local=[{id:'a',notes:'edited'},{id:'b'}]
 assert.deepEqual(mergeCollection(sent,local,sent,p=>p.id,[]),local)
 assert.deepEqual(mergeCollection(sent,local,sent,p=>p.id,['a']),[{id:'b'}])
})
test('identity separates old repeated numbers; historical procedure price preserved',()=>{
 assert.notEqual(patientRecordKey({number:1,createdAt:'2025'}),patientRecordKey({number:1,createdAt:'2026'}))
 assert.deepEqual(preserveProcedureDetails(['Castração','Exame'],[{name:'Castração',value:80}],[{name:'Castração',value:100},{name:'Exame',value:20}]),[{name:'Castração',value:80},{name:'Exame',value:20}])
})
test('migration is repeatable and does not alter existing records',async()=>{
 const before=await call('read');await pg.exec(sql);const after=await call('read')
 assert.deepEqual(after.patients,before.patients);assert.deepEqual(after.auditLog,before.auditLog)
})
test('public TV cannot import new patients or delete records',async()=>{
 const before=await call('read')
 const r=await call('tv',{patients:[{id:'public-new',number:2}],deletions:[{kind:'patients',recordKey:before.patients[0].id}]})
 assert.equal(r.patients.length,before.patients.length)
})
test('failed transaction leaves no patient and does not consume a number',async()=>{
 const before=await call('read')
 await pg.query("INSERT INTO shared_records(kind,record_key,payload,version_time) VALUES('audit','entry-failure-test','{}',now())")
 await assert.rejects(call('create',input('failure-test')))
 const after=await call('read');assert.equal(after.nextPatientNumber,before.nextPatientNumber)
 assert.ok(!after.patients.some(p=>p.id==='failure-test'))
})
test.after(()=>pg.close())
