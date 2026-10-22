// Real React UI + production SQL in isolated PGlite. HTTP/auth are intercepted;
// this does not claim to test a live Neon/Vercel deployment.
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
const pg = new PGlite()
await pg.exec(`CREATE TABLE shared_records(kind text,record_key text,payload jsonb NOT NULL,version_time timestamptz NOT NULL,server_updated_at timestamptz DEFAULT now(),PRIMARY KEY(kind,record_key)); CREATE TABLE shared_tombstones(kind text,record_key text,deleted_at timestamptz,PRIMARY KEY(kind,record_key)); CREATE TABLE system_state(key text PRIMARY KEY,value jsonb,updated_at timestamptz DEFAULT now());`)
await pg.exec(await readFile(new URL('../migrations/001_atomic_sync.sql',import.meta.url),'utf8'))
const user={id:'luiza',name:'Luiza',username:'luiza',accesses:['MASTER','ENTRADA','PACIENTES','SAIDA']}
const call=async(mode,body={})=>(await pg.query('SELECT delta_apply($1,$2::jsonb,$3::jsonb) AS data',[mode,JSON.stringify(body),JSON.stringify(user)])).rows[0].data
await call('configure',{nextPatientNumber:500})
const browser=await chromium.launch({headless:true})
let delayNext=false, captured, release, failedSend=false
const errors=[]
async function device(){
 const context=await browser.newContext()
 await context.addInitScript(()=>localStorage.getItem('deltaVetClients')||localStorage.setItem('deltaVetClients',JSON.stringify([{id:'tutor',name:'Tutor teste',phone:'51999999999'}])))
 const page=await context.newPage()
 page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url());const body=route.request().postDataJSON()||{}
  let data
  if(url.pathname==='/api/auth/me') data={user}
  else if(url.pathname==='/api/patients'){
   data=await call('create',body)
   if(failedSend){failedSend=false;return route.abort('failed')}
  } else if(url.pathname==='/api/admin/settings/sequence') data=await call(route.request().method()==='PATCH'?'configure':'sequence',body)
  else if(url.pathname==='/api/sync/shared'){
   data=await call('sync',body)
   if(delayNext){delayNext=false;captured?.();await new Promise(r=>release=r)}
  } else return route.fulfill({status:404,json:{}})
  await route.fulfill({json:data})
 })
 return page
}
async function number(page,n){await page.waitForFunction(n=>document.querySelector('.patient-number')?.textContent===`Paciente nº ${String(n).padStart(3,'0')}`,n)}
async function fill(page,name){
 await page.getByPlaceholder('Ex.: Thor, Mel, Sem nome...').fill(name)
 await page.getByRole('button',{name:'FELINO',exact:true}).click()
 await page.getByLabel('Macho',{exact:true}).check()
 await page.locator('.client-select-row select').selectOption('tutor')
 await page.getByLabel('Caixa',{exact:true}).check()
}
try{
 const a=await device();await a.goto('http://localhost:3000/entrada');await number(a,500)
 await fill(a,'Primeiro')
 const held=new Promise(r=>captured=r);delayNext=true
 await held
 assert.equal(await a.getByRole('button',{name:/SINCRONIZAR NEON/}).count(),1)
 await a.getByRole('button',{name:/SINCRONIZAR NEON/}).click()
 assert.equal(await a.getByRole('button',{name:/SINCRONIZANDO/}).count(),1)
 await a.getByRole('button',{name:'ENVIAR',exact:true}).click();await number(a,501)
 release();await new Promise(r=>setTimeout(r,200));await number(a,501)
 await fill(a,'Segundo');await a.getByRole('button',{name:'ENVIAR',exact:true}).click();await number(a,502)
 await a.reload();await number(a,502)
 const b=await device();await b.goto('http://localhost:3000/entrada');await number(b,502)
 await Promise.all([fill(a,'Simultâneo A'),fill(b,'Simultâneo B')])
 await Promise.all([a.getByRole('button',{name:'ENVIAR',exact:true}).click(),b.getByRole('button',{name:'ENVIAR',exact:true}).click()])
 await number(a,504);await number(b,504)
 let rows=(await call('read')).patients
 assert.equal(rows.length,4);assert.equal(new Set(rows.map(p=>p.number)).size,4)
 // Simulate commit on server followed by lost HTTP response, then refresh/retry.
 failedSend=true;await fill(a,'Resposta perdida');await a.getByRole('button',{name:'ENVIAR',exact:true}).click()
 await a.getByRole('button',{name:'RETOMAR ENVIO',exact:true}).waitFor()
 await a.reload();await a.getByRole('button',{name:'RETOMAR ENVIO',exact:true}).click();await number(a,505)
 await a.getByRole('button',{name:'ENVIAR',exact:true}).waitFor()
 rows=(await call('read')).patients;assert.equal(rows.length,5)
 assert.equal(rows.filter(p=>p.patientName==='Resposta perdida').length,1)
 assert.deepEqual(errors,[])
 console.log('PASS browser: 500/501/502, delayed snapshot, reload, second device, simultaneous submissions, lost response + retry, no browser errors')
}finally{release?.();await browser.close();await pg.close()}
