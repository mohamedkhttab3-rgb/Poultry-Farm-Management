'use strict';
// Create one SELF-CONTAINED QA fixture using the real 80k integration test.
// Never use in a production build or connect to Supabase.
const {execFileSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const target=path.resolve(process.argv[2]||'www/pfm-v81-qa80k.json');
const original=path.resolve('tests/.pfm-v81-80k-generated-open.json');
try{
 execFileSync(process.execPath,['tests/test_v81_two_farms_80k.cjs','--export-open',original],{stdio:'pipe'});
 let db=JSON.parse(fs.readFileSync(original,'utf8'));
 if(db.scenario!=='FICTIONAL_TWO_FARMS_80K_DOC'||db.farms?.length!==2||db.houses?.length!==4||
    db.cycles?.length!==4||db.cycles.reduce((n,c)=>n+Number(c.birds||0),0)!==80000||
    db.v410?.purchaseDocuments?.length!==34||db.v410?.movements?.length!==32||
    db.sales?.length!==8||db.daily?.length!==168)throw Error('Source QA acceptance fixture failed invariants');
 const ids=new Set();
 function collect(x){
  if(Array.isArray(x)){for(const a of x)collect(a);return}
  if(!x||typeof x!=='object')return;
  for(const [k,v] of Object.entries(x)){
   if(typeof v==='string'&&(k==='id'||/^(farmId|cycleId|houseId|lotId|sourceId|saleId|documentId|purchaseId)$/i.test(k)))ids.add(v);
   collect(v);
  }
 }
 collect(db);for(const k of Object.keys(db.finance||{}))ids.add(k);
 for(const k of ['chicks','close','expenses'])for(const id of Object.keys(db.v410?.[k]||{}))ids.add(id);
 const mapped=new Map([...ids].filter(Boolean).map(x=>{
  const h=crypto.createHash('sha256').update('PFM-80K-ISOLATED-QA-'+x).digest('hex');
  return [x,h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32)];
 }));
 function transform(x){
  if(Array.isArray(x))return x.map(transform);
  if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[mapped.get(k)||k,transform(v)]));
  return typeof x==='string'?(mapped.get(x)||x):x;
 }
 db=transform(db);
 db.qaOnly=true;db.settings={...db.settings,qaOnly:true,qa80k:true,localOnly:true};
 db.farms.forEach(f=>f.ownerId='pfm-v81-qa-80k-local');
 const ids2=db.cycles.map(c=>c.id);
 if(ids2.some(id=>!/^[-0-9a-f]{36}$/.test(id)))throw Error('Invalid migrated IDs');
 if(new Set(ids2).size!==4)throw Error('Duplicate migrated cycles');
 const accounting=require('../www/pfm-v81-accounting-core.js');
 const mistakes=accounting.validateLedger(db);
 if(mistakes.length)throw Error('QA ledger invalid after ID conversion: '+JSON.stringify(mistakes.slice(0,3)));
 fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(db));
 if(fs.statSync(target).size<15000)throw Error('Unexpectedly empty QA data file');
 console.log('PASS bundled isolated QA data: 2 farms, 4 houses, 80k DOC, 34 invoices, 32 movements, 8 sales, 168 daily records; JSON bytes '+fs.statSync(target).size);
}finally{fs.rmSync(original,{force:true})}
