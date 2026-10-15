/* Run: node tests/test_v63_storage.cjs — no npm dependencies */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const TABLE=[];
const store={
 createIndex(){},
 index(){return {getAll(userId){const req={};setTimeout(()=>{req.result=TABLE.filter(r=>r.userId===userId).map(x=>({...x}));req.onsuccess?.()},1);return req}}},
 add(item){const req={};setTimeout(()=>{req.result=TABLE.length?Math.max(...TABLE.map(x=>x.id))+1:1;TABLE.push({...item,id:req.result});req.onsuccess?.()},1);return req},
 delete(id){setTimeout(()=>{const i=TABLE.findIndex(x=>x.id===id);if(i>=0)TABLE.splice(i,1)},1)}
};
const db={objectStoreNames:{contains(){return false}},createObjectStore(){return store},transaction(name,mode){const tx={objectStore(){return store}};setTimeout(()=>tx.oncomplete?.(),10);return tx}};
const indexedDB={open(){const req={result:db};setTimeout(()=>{req.onupgradeneeded?.();req.onsuccess?.()},1);return req}};
const m=new Map();let broken=false;
const localStorage={setItem(k,v){if(broken)throw Error('QuotaExceededError');m.set(k,String(v))},getItem(k){if(broken)throw Error('Storage unavailable');return m.get(k)??null},removeItem(k){m.delete(k)}};
const win={crypto:webcrypto,indexedDB,localStorage};
const context=vm.createContext({window:win,document:{body:null,getElementById(){return null}},setTimeout,clearTimeout,console,Blob,TextEncoder,URL,Date,Map,JSON,Error,Uint8Array});
const script=fs.readFileSync(path.join(__dirname,'../www/pfm-v63-storage.js'),'utf8');vm.runInContext(script,context);
const pfm=win.PFMV63;
(async()=>{
 assert(pfm.available());
 const payload=JSON.stringify({farms:[{id:'a'}],cycles:[{id:'b',standardSnapshot:{breed:'Ross 308',weight:3000}}]});
 assert(pfm.persist('owner-1','database-owner-1',payload));
 assert.equal(localStorage.getItem('database-owner-1'),payload);
 const first=await pfm.snapshot('owner-1',payload,'test');
 assert.equal(first.duplicate,false);
 const again=await pfm.snapshot('owner-1',payload,'test');
 assert.equal(again.duplicate,true);
 assert.equal((await pfm.snapshots('owner-1')).length,1);
 assert.equal((await pfm.snapshots('owner-2')).length,0);
 const verified=await pfm.readVerified('owner-1',first.record.id);
 assert.equal(verified.data.cycles[0].standardSnapshot.breed,'Ross 308');
 const expected=await pfm.digest(payload);
 assert.match(expected,/^[a-f0-9]{64}$/);
 TABLE[0].json=TABLE[0].json.replace('Ross 308','Different Breed');
 await assert.rejects(()=>pfm.readVerified('owner-1',first.record.id),/integrity/i);
 broken=true;
 assert.throws(()=>pfm.persist('owner-1','database-owner-1','{"fail":true}'),/تعذر حفظ البيانات/);
 assert.equal(pfm.dirty,true);
 broken=false;
 assert.equal(localStorage.getItem('database-owner-1'),payload);
 console.log('PASS: persistent write + readback, SHA-256 digest, archive dedup, user isolation, corruption rejection, quota failure behavior');
})().catch(e=>{console.error(e);process.exitCode=1});
