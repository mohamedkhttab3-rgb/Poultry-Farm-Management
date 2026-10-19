/* PFM unified offline-first sync V1. Safe default: no silent overwrite or delete.
   Same web asset runs on Windows Electron, Android, iOS and browser.
   Requires isolated Supabase migration 20261019_pfm_unified_sync_v1.sql.
   Legacy per-table bulk sync must not run alongside this engine. */
(function(root){'use strict';
const COLLECTIONS=['farms','houses','cycles','daily','weights','feed','meds','inventory',
 'sales','finance','performanceRules','auditLog','invitations','tombstones','settings','v410','extras'];
const ARRAYS=new Set(['farms','houses','cycles','daily','weights','feed','meds','inventory','sales','performanceRules','auditLog','invitations','tombstones']);
const RESERVED=new Set([...COLLECTIONS.filter(x=>x!=='extras'),'extras']);
function canonical(value){
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 return JSON.stringify(value===undefined?null:value);
}
function documents(db){
 const result=new Map();
 const add=(collection,id,payload)=>{
  const key=collection+':'+id;
  if(result.has(key))throw Error('Duplicate local sync record: '+key);
  result.set(key,{collection,record_id:id,payload:JSON.parse(JSON.stringify(payload))});
 };
 for(const type of ARRAYS){
  for(const row of db[type]||[]){
   if(!row||typeof row!=='object'||!row.id)throw Error('Record without ID in '+type);
   add(type,String(row.id),row);
  }
 }
 for(const [id,value] of Object.entries(db.finance||{}))add('finance',id,value);
 if(db.settings&&typeof db.settings==='object')add('settings','main',db.settings);
 if(db.v410&&typeof db.v410==='object')add('v410','main',db.v410);
 const unknown={};
 for(const [key,value] of Object.entries(db))
  if(!RESERVED.has(key))unknown[key]=value;
 if(Object.keys(unknown).length)add('extras','main',unknown);
 return result;
}
function build(local,merged){
 const result=JSON.parse(JSON.stringify(local));
 for(const type of ARRAYS)result[type]=[];
 result.finance={};
 for(const [key,record] of merged){
  const {collection,payload}=record;
  if(ARRAYS.has(collection))result[collection].push(payload);
  else if(collection==='finance')result.finance[record.record_id]=payload;
  else if(collection==='settings'||collection==='v410')result[collection]=payload;
  else if(collection==='extras'){
   for(const [field,value] of Object.entries(payload))
    if(!RESERVED.has(field)&&field!=='__proto__'&&field!=='constructor')
     result[field]=value;
  }
 }
 return result;
}
function stateKey(uid){return 'pfm_unified_sync_v1_'+uid}
function readState(storage,uid){
 try{
  const raw=storage.getItem(stateKey(uid));
  if(!raw)return {};
  const v=JSON.parse(raw);return v&&v.version===1&&v.records&&typeof v.records==='object'?v.records:{};
 }catch(_){return {}}
}
function persistState(storage,uid,records){
 storage.setItem(stateKey(uid),JSON.stringify({version:1,records}));
 if(!storage.getItem(stateKey(uid)))throw Error('Sync state storage unavailable');
}
function safeMap(rows){
 const result=new Map();
 for(const row of rows){
  if(!COLLECTIONS.includes(row.collection)||typeof row.record_id!=='string')continue;
  result.set(row.collection+':'+row.record_id,row);
 }
 return result;
}
function comparable(row){return row?canonical(row.payload):null}
async function sync({client,userId,db,storage,assertUnchanged,persistLocal,archiveLocal}){
 if(!client||!userId||!db||!storage||!persistLocal)throw Error('Missing sync context');
 if(typeof navigator!=='undefined'&&navigator.onLine===false)return {status:'offline'};
 const source=canonical(db);
 // A pristine installation still contains default settings (and may contain
 // an empty V4.10 ledger). These defaults must not block first cloud login.
 // Any meaningful local project/ledger/preferences instead requires review.
 const defaultSettings=Object.entries(db.settings||{}).every(([k,v])=>
  (k==='currency'&&v==='SAR')||(k==='language'&&v==='ar')||
  (k==='globalStandardBreed'&&v==='Ross 308'));
 const emptyLedger=v=>v==null||(Array.isArray(v)?v.length===0:
  typeof v==='object'?Object.values(v).every(emptyLedger):false);
 const newDevice=defaultSettings&&emptyLedger(db.v410)&&
  [...ARRAYS].every(type=>(db[type]||[]).length===0)&&
  Object.keys(db.finance||{}).length===0;
 const local=documents(db);
 // Read ONLY the signed-in account; RLS independently enforces ownership.
 const {data:rows,error:readError}=await client.from('pfm_sync_records')
  .select('collection,record_id,payload,version').eq('owner_id',userId);
 if(readError)throw Error('Cloud sync unavailable: '+readError.message);
 const remote=safeMap(rows||[]);
 const base=readState(storage,userId);
 const merged=new Map(local),nextState={...base};
 const conflicts=[],writes=[],incoming=[];
 const keys=new Set([...local.keys(),...remote.keys(),...Object.keys(base)]);
 for(const key of keys){
  const l=local.get(key),r=remote.get(key),b=base[key];
  const lc=comparable(l),rc=comparable(r),bc=b?b.payload:null;
  if(l && r && lc===rc){
   nextState[key]={payload:lc,version:r.version};continue;
  }
  if(!b){
   if(l&&!r){writes.push({key,doc:l,expected:0});continue}
   if(!l&&r){merged.set(key,{collection:r.collection,record_id:r.record_id,payload:r.payload});incoming.push(key);nextState[key]={payload:rc,version:r.version};continue}
   if(l&&r){
    if(newDevice&&(key==='settings:main'||key==='v410:main')){
     merged.set(key,{collection:r.collection,record_id:r.record_id,payload:r.payload});
     incoming.push(key);nextState[key]={payload:rc,version:r.version};continue;
    }
    conflicts.push(key);continue;
   }
  }else{
   const localChanged=lc!==bc,remoteChanged=rc!==bc;
   if(!l||!r){
    // Record disappearance may represent a deletion. No silent resurrection,
    // deletion or local data loss; requires an explicit conflict-resolution UI.
    conflicts.push(key);continue;
   }
   if(localChanged&&remoteChanged){conflicts.push(key);continue}
   if(localChanged){writes.push({key,doc:l,expected:r.version});continue}
   if(remoteChanged){merged.set(key,{collection:r.collection,record_id:r.record_id,payload:r.payload});incoming.push(key);nextState[key]={payload:rc,version:r.version};continue}
   nextState[key]={payload:lc,version:r.version};
  }
 }
 if(conflicts.length)return {status:'conflict',conflicts,uploads:0,downloads:0};
 if(assertUnchanged&&!assertUnchanged(source))return {status:'local-changed',uploads:0,downloads:0};
 // Archive before any local replace; storage failures stop the sync safely.
 if(incoming.length){
  if(typeof archiveLocal!=='function')throw Error('Verified local archive is required before downloading');
  await archiveLocal(source);
 }
 // Persist per-record CAS acknowledgement immediately after server commit.
 // If interrupted, the next run safely compares the server payload again.
 for(const op of writes){
  if(assertUnchanged&&!assertUnchanged(source))return {status:'local-changed',uploads:0,downloads:0};
  const response=await client.rpc('pfm_sync_cas_write',{
   p_collection:op.doc.collection,p_record_id:op.doc.record_id,
   p_payload:op.doc.payload,p_expected_version:op.expected
  });
  if(response.error){
   return {status:'retry-or-conflict',error:response.error.message,uploads:0,downloads:0};
  }
  const version=Number(response.data);
  if(!Number.isInteger(version)||version<1)throw Error('Invalid cloud revision');
  nextState[op.key]={payload:comparable(op.doc),version};
  persistState(storage,userId,nextState);
 }
 if(incoming.length){
  if(assertUnchanged&&!assertUnchanged(source))
   return {status:'local-changed',uploads:writes.length,downloads:0};
  const next=build(db,merged);
  await persistLocal(next);
 }
 persistState(storage,userId,nextState);
 return {status:'synced',uploads:writes.length,downloads:incoming.length};
}
root.PFMUnifiedSync={sync,documents,build,canonical,stateKey,readState};
})(typeof window!=='undefined'?window:globalThis);
