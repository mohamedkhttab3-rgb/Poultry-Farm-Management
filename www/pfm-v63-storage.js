/* Poultry Farm Manager V6.3 — verified primary storage and local snapshot archive.
   Runs without a server. localStorage is the legacy source of truth; IndexedDB is
   an independent best-effort recovery archive. Backups outside the browser remain essential.
   No automatic restore or account cross-copy is ever performed. */
(function(global){'use strict';
const NAME='PFM_V63_BACKUP_ARCHIVE',STORE='snapshots',VERSION=1,LIMIT=12;
let dbPromise=null,pending=null,dirty=false,storageIssue='';
const $=id=>document.getElementById(id);
function storeStatus(message,unpersisted){
  storageIssue=message||'';dirty=!!unpersisted;
  let bar=$('pfm63StorageWarning');
  if(!bar&&document.body){bar=document.createElement('div');bar.id='pfm63StorageWarning';bar.setAttribute('role','alert');bar.innerHTML='<strong id="pfm63WarningText"></strong><button type="button" id="pfm63EmergencyDownload">تنزيل البيانات الحالية JSON</button>';document.body.appendChild(bar);$('pfm63EmergencyDownload').onclick=()=>{
    try{const payload=JSON.stringify(global.PFMV63.currentData?.()||{},null,2);download(new Blob([payload],{type:'application/json'}),'PFM-UNSAVED-EMERGENCY-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');}catch(e){alert('تعذر تنزيل البيانات: '+e.message);}
  };}
  if(bar){bar.hidden=!message;const label=$('pfm63WarningText');if(label)label.textContent=message;}
}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.download=name;a.href=url;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),25000);}
function verifyPrimary(key,json){
 if(!key||typeof key!=='string')throw Error('Account storage key is missing');
 try{global.localStorage.setItem(key,json);if(global.localStorage.getItem(key)!==json)throw Error('Read-back did not match');storeStatus('',false);return true;}
 catch(err){storeStatus('تحذير: تعذّر حفظ آخر تعديل على القرص. لا تغلق الصفحة! نزّل البيانات الحالية JSON، ثم راجع مساحة التخزين وإعدادات المتصفح.',true);throw Error('تعذر حفظ البيانات بشكل دائم على المتصفح: '+(err?.message||err));}
}
function available(){try{const k='__pfm63_write_test__';global.localStorage.setItem(k,'ok');const valid=global.localStorage.getItem(k)==='ok';global.localStorage.removeItem(k);return valid;}catch(_){return false;}}
function idb(){
 if(dbPromise)return dbPromise;
 if(!global.indexedDB)return Promise.reject(Error('IndexedDB is unavailable'));
 dbPromise=new Promise((resolve,reject)=>{
  const request=global.indexedDB.open(NAME,VERSION);
  request.onupgradeneeded=()=>{const d=request.result;if(!d.objectStoreNames.contains(STORE)){const st=d.createObjectStore(STORE,{keyPath:'id',autoIncrement:true});st.createIndex('by_user','userId',{unique:false});}};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||Error('Could not open IndexedDB'));
 }).catch(e=>{dbPromise=null;throw e});return dbPromise;
}
function transaction(mode,exec){return idb().then(d=>new Promise((resolve,reject)=>{let out;const tx=d.transaction(STORE,mode),st=tx.objectStore(STORE);tx.oncomplete=()=>resolve(out);tx.onerror=()=>reject(tx.error||Error('Archive transaction failed'));tx.onabort=()=>reject(tx.error||Error('Archive transaction aborted'));try{exec(st,v=>out=v);}catch(e){tx.abort();reject(e);}}));}
async function digest(s){if(!global.crypto?.subtle)throw Error('SHA-256 unavailable: this browser context cannot verify archive integrity');const bytes=new TextEncoder().encode(s),buff=await global.crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(buff)].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function snapshots(userId){if(!userId)return [];const records=await transaction('readonly',(st,done)=>{const r=st.index('by_user').getAll(userId);r.onsuccess=()=>done(r.result||[]);});return records.sort((a,b)=>b.id-a.id);}
async function snapshot(userId,json,reason='تلقائي'){
 if(!userId||!json)throw Error('No account data to archive');
 JSON.parse(json);const sha256=await digest(json);
 const existing=await snapshots(userId);if(existing.length&&existing[0].sha256===sha256)return {duplicate:true,record:existing[0]};
 const meta={userId,createdAt:new Date().toISOString(),reason,sha256,bytes:new Blob([json]).size,json};
 const id=await transaction('readwrite',(st,done)=>{const r=st.add(meta);r.onsuccess=()=>done(r.result);});
 const all=await snapshots(userId);if(all.length>LIMIT)await transaction('readwrite',(st)=>{all.slice(LIMIT).forEach(x=>st.delete(x.id));});
 return {duplicate:false,record:{...meta,id}};
}
function schedule(userId,json,label='تلقائي'){
 if(!userId||!json)return;
 if(pending)clearTimeout(pending);
 pending=setTimeout(()=>{pending=null;snapshot(userId,json,label).catch(e=>{console.warn('PFM IndexedDB snapshot unavailable:',e);storeArchiveStatus('لا تتوفر نسخة تلقائية في هذا المتصفح؛ استخدم تصدير JSON خارج البرنامج.');});},1000);
}
function storeArchiveStatus(message){const el=$('pfm63ArchiveStatus');if(el)el.textContent=message;}
async function readVerified(userId,id){const x=(await snapshots(userId)).find(v=>v.id===Number(id));if(!x)throw Error('Snapshot not found for this user');if(await digest(x.json)!==x.sha256)throw Error('Archive integrity check failed — no data was changed');return {data:JSON.parse(x.json),meta:{id:x.id,createdAt:x.createdAt,reason:x.reason,bytes:x.bytes,sha256:x.sha256}};}
function rememberLoaded(userId,json){if(userId&&json)schedule(userId,json,'نسخة ما قبل العمل');}
function persist(userId,key,json){verifyPrimary(key,json);schedule(userId,json,'حفظ تلقائي');return true;}
function canRecover(){return !dirty;}
global.PFMV63={available,verifyPrimary,persist,rememberLoaded,snapshot,snapshots,readVerified,digest,storeStatus,download,canRecover,get dirty(){return dirty;},get storageIssue(){return storageIssue;},currentData:null};
})(window);
