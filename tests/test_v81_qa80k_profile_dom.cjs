'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom');
const fixture=JSON.parse(fs.readFileSync('www/pfm-v81-qa80k.json','utf8'));
const vc=new VirtualConsole();vc.on('jsdomError',()=>{});
const dom=new JSDOM('<!doctype html><html lang="ar"><body><section id="settings"><h2>الإعدادات</h2></section></body></html>',
 {url:'https://qa.local/',runScripts:'outside-only',virtualConsole:vc});
const w=dom.window, id='pfm-v81-qa-80k-local',original={id:'owner-test-uuid',name:'Owner',role:'owner'};
w.alert=()=>{};w.confirm=()=>true;w.structuredClone=x=>JSON.parse(JSON.stringify(x));
w.fetch=async()=>({ok:true,json:async()=>structuredClone(fixture)});
const snapshots=[];
w.PFMV63={available:()=>true,persist:(uid,key,data)=>{w.localStorage.setItem(key,data);snapshots.push({uid,key})}};
w.currentUser=original;w.supabaseClient=null;
w.hasRealSupabaseConfig=()=>false;
w.persistLocal=()=>{w.__originalSaved=(w.__originalSaved||0)+1};
w.eval(fs.readFileSync('www/pfm-v81-qa80k-profile.js','utf8'));
(async()=>{
 const api=w.PFMV81QA80K;assert(api);
 api.install();
 assert(w.document.getElementById('pfm81-qa-enter'),'sandbox chooser exists');
 await api.enter();
 const q=w.localStorage.getItem('poultry_farm_management_v34_'+id);
 assert(q&&q.length>15000,'local QA fixture persisted under an isolated account key');
 assert.equal(JSON.parse(q).farms.length,2);
 assert.equal(JSON.parse(q).settings.localOnly,true);
 assert.equal(JSON.parse(w.localStorage.getItem('poultry_farm_manager_session_v32')).id,id);
 assert.equal(JSON.parse(w.localStorage.getItem('pfm-v81-qa80k-origin-session')).id,original.id);
 assert.equal(w.__originalSaved,1,'original account persisted before switching');
 const before=q;w.currentUser={id:'pfm-v81-qa-80k-local',role:'owner',name:'Demo'};
 api.install();api.exit();
 assert.equal(w.localStorage.getItem('poultry_farm_management_v34_'+id),before);
 assert.equal(JSON.parse(w.localStorage.getItem('poultry_farm_manager_session_v32')).id,original.id);
 w.currentUser={id:'owner-test-uuid',role:'owner'};w.supabaseClient={connected:true};
 w.stopV8Realtime=()=>{w.__stoppedRealtime=true};
 // Dirty old QA records or manual test farms must never survive the next
 // canonical test round; only the QA storage key may be overwritten.
 const qaKey='poultry_farm_management_v34_'+id;
 w.localStorage.setItem(qaKey,JSON.stringify({farms:[{id:'manual'}],cycles:[],manualOnly:true}));
 const previousCount=snapshots.length;await api.enter();
 assert.equal(snapshots.length,previousCount+1,'re-entry must reset QA dataset from canonical 80K fixture');
 const restored=JSON.parse(w.localStorage.getItem(qaKey));
 assert.equal(restored.farms.length,2,'manual QA farms replaced by exactly two standard farms');
 assert.equal(restored.cycles.length,4);
 assert.equal(restored.manualOnly,undefined,'manual QA entries removed');
 assert.equal(restored.v410.purchaseDocuments.length,34);
 assert.equal(JSON.parse(w.localStorage.getItem('poultry_farm_manager_session_v32')).id,id,
  'cloud owner enters only the synthetic local user, not a cloud farm');
 assert.equal(w.__stoppedRealtime,true,'cloud Realtime connection stopped before switching');
 clearInterval?.(w.__qaTimer);
 w.close();
 console.log('PASS DOM sandbox: canonical two-farm baseline replaces only manual QA records; real owner unchanged, Supabase stopped');
})().catch(e=>{console.error(e);w.close();process.exitCode=1});
