'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('www/pfm-unified-sync.js','utf8');
const box={window:{},JSON,Set,Map,Number,Error};
vm.runInNewContext(src,box,{filename:'pfm-unified-sync.js'});
const api=box.window.PFMUnifiedSync;
const records=new Map();
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v))}};
function client(){
 return {
  from(t){assert.equal(t,'pfm_sync_records');return {select(){return {eq(column,uid){
   assert.equal(column,'owner_id');
   return Promise.resolve({data:[...records.values()].filter(x=>x.owner_id===uid),error:null});
  }}}}},
  async rpc(name,args){
   assert.equal(name,'pfm_sync_cas_write');
   const key=args.p_collection+':'+args.p_record_id;
   const old=records.get(key);
   if((old?.version||0)!==args.p_expected_version)return {error:{message:'CAS conflict'}};
   const version=(old?.version||0)+1;
   records.set(key,{owner_id:'user-1',collection:args.p_collection,
    record_id:args.p_record_id,payload:JSON.parse(JSON.stringify(args.p_payload)),version});
   return {data:version,error:null};
  }
 };
}
function db(){return {farms:[],houses:[],cycles:[],daily:[],weights:[],feed:[],meds:[],
 inventory:[],sales:[],finance:{},performanceRules:[],auditLog:[],invitations:[],
 tombstones:[],settings:{currency:'SAR',language:'ar'},v410:{lots:[],audit:[]}}}
function device(){
 const obj={db:db(),storage:memory(),archives:[]};
 obj.run=async()=>{
  const before=api.canonical(obj.db);
  return api.sync({client:client(),userId:'user-1',db:obj.db,storage:obj.storage,
   assertUnchanged:s=>api.canonical(obj.db)===s,
   archiveLocal:async s=>{obj.archives.push(s)},
   persistLocal:async next=>{obj.db=next}});
 };
 return obj;
}
(async()=>{
 const a=device(),b=device();
 const id='12345678-1234-4234-9234-123456789012';
 a.db.farms.push({id,name:'Farm A',ownerId:'user-1'});
 a.db.cycles.push({id:'c-1',farmId:id,standardSnapshot:{breed:'Ross 308',weight:2.3}});
 a.db.v410.lots.push({id:'lot-1',amount:151.75,vatRecoverable:true});
 assert.equal((await a.run()).status,'synced','First device uploads without data loss');
 let out=await b.run();assert.equal(out.status,'synced');
 assert.equal(b.db.cycles[0].standardSnapshot.weight,2.3);
 assert.equal(b.db.v410.lots[0].amount,151.75);
 assert.equal(b.archives.length,1,'Download must archive original local DB');
 b.db.farms[0].name='Farm B';
 assert.equal((await b.run()).status,'synced');
 assert.equal((await a.run()).status,'synced');
 assert.equal(a.db.farms[0].name,'Farm B','Remote changes reach another device');
 a.db.farms[0].name='Change A';
 b.db.farms[0].name='Change B';
 assert.equal((await a.run()).status,'synced');
 out=await b.run();
 assert.equal(out.status,'conflict','Simultaneous offline edits are never overwritten');
 assert.equal(b.db.farms[0].name,'Change B','Local conflict data is kept');
 assert.equal(records.get('farms:'+id).payload.name,'Change A');
 const c=device();
 c.db.farms.push({id,name:'Unrelated local data'});
 out=await c.run();assert.equal(out.status,'conflict','Unknown divergent baseline stops unsafe merge');
 assert.equal(c.db.farms[0].name,'Unrelated local data');
 const d=device();
 // Empty account can safely restore complete remotely backed data.
 out=await d.run();assert.equal(out.status,'synced');
 assert.equal(d.db.v410.lots[0].vatRecoverable,true);
 assert.equal(d.db.cycles[0].standardSnapshot.breed,'Ross 308');
 // Deletion is never silently propagated by a stale device.
 d.db.farms.splice(0);
 out=await d.run();assert.equal(out.status,'conflict');
 assert(records.has('farms:'+id));
 const source=fs.readFileSync('www/index.html','utf8');
 assert(source.includes('<script src="./pfm-unified-sync.js"></script>'));
 assert(source.includes('window.PFMUnifiedSync.sync('));
 assert(!source.includes('await syncFromCloud({pushLocal:true});'));
 console.log('PASS: offline-first cross-platform sync; first upload; recovery; full finance and breed preservation; CAS conflicts; safe deletion; no legacy auto-sync');
})().catch(e=>{console.error(e);process.exitCode=1});
