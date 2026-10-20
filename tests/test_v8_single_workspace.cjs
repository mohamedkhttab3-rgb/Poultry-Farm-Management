'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const workspace=fs.readFileSync('www/pfm-v8-purchases-workspace.js','utf8');
const invoice=fs.readFileSync('www/pfm-v8-invoice-ui.js','utf8');
const finance=fs.readFileSync('www/v410-finance.js','utf8');
new Function(workspace);
assert(invoice.includes("script.src='./pfm-v8-purchases-workspace.js'"),'Unified workspace not activated');
for(const id of ['feed','chicks','health','expenses'])
 assert(workspace.includes("'"+id+"'"),'Missing purchase category '+id);
assert(workspace.includes('data-stage="7"')&&workspace.includes('data-stage="8"'),'Duplicate legacy screen links remain visible');
assert(workspace.includes('data-stage="9"'),'Unified navigation entry missing');
assert(workspace.includes('pfm-v8-issue-cycle')&&workspace.includes('pfm-v8-issue-lot'),'Stock issue must be on same page');
assert(workspace.includes('new MutationObserver(translate)'),'Languages must stay consistent');
assert(finance.includes("addFeed=function(){if(window.PFMV8SingleEntryActive)"),'Old feed direct-cost form not blocked');
assert(finance.includes("addMed=function(){if(window.PFMV8SingleEntryActive)"),'Old medicine direct-cost form not blocked');
const issueSource=workspace.match(/function issue\(\)\{[\s\S]*?(?=\nfunction build\(\))/)?.[0];
assert(issueSource,'Could not locate actual unified issue handler');
function scenario(){
 const f='f1',c='c1',date='2026-04-02';
 const db={settings:{currency:'SAR'},cycles:[{id:c,farmId:f,date:'2026-04-01',houseId:'h1'}],
  feed:[],meds:[],finance:{},auditLog:[],v410:{lots:[
   {id:'l-feed',farmId:f,kind:'feed',item:'بادي',qty:1000,unit:'kg',unitCost:2,invoice:'INV1',currency:'SAR'},
   {id:'l-med',farmId:f,kind:'med',item:'Medicine A',qty:100,unit:'dose',unitCost:3,invoice:'INV1',currency:'SAR'},
   {id:'l-bedding',farmId:f,kind:'bedding',item:'نشارة',qty:50,unit:'kg',unitCost:1.5,invoice:'INV1',currency:'SAR'},
   {id:'l-other',farmId:'other',kind:'feed',item:'بادي',qty:100,unit:'kg',unitCost:1}
  ],movements:[],expenses:{},close:{}}};
 const controls={};
 for(const [id,value] of Object.entries({'pfm-v8-issue-lot':'l-feed','pfm-v8-issue-cycle':c,
 'pfm-v8-issue-qty':'100','pfm-v8-issue-date':date,'pfm-v8-issue-state':''}))
  controls[id]={value,textContent:''};
 let serial=0,persist=()=>{},refresh=0,issued=0;
 const ctx=vm.createContext({
  db,window:{PFM_V410:{refresh(){refresh++}}},issuing:false,
  financeDraftExpenses:{},getHouseName:()=>'',currentUser:{id:'u'},
  $:id=>controls[id],stock:()=>db.v410,selectedFarm:()=>f,
  balance:lot=>lot.qty+db.v410.movements.filter(x=>x.lotId===lot.id).reduce((sum,x)=>sum+(x.kind==='return'?x.qty:-x.qty),0),
  tr:(ar)=>ar,money:v=>Math.round((Number(v)+Number.EPSILON)*100)/100,
  uuid:()=> 'test-'+(++serial),can:()=>true,requireActionForRecord:()=>true,
  audit:(_op,_type,id)=>db.auditLog.push({id}),save:()=>persist(),
  normalizeFinanceExpenses:fin=>fin.expenses||[],refreshIssues:()=>{issued++}
 });
 vm.runInContext(issueSource+'\nthis.perform=issue;',ctx);
 return {db,controls,ctx,setPersist:v=>persist=v,info:()=>({refresh,issued})};
}
const x=scenario();
x.ctx.perform();
assert.equal(x.db.feed.length,1,'Feed issue must create exactly one cycle record');
assert.equal(x.db.feed[0].price,2,'Issue must use purchase batch unit cost, not a second entered price');
assert.equal(x.db.v410.movements.length,1,'Issue must create exactly one stock movement');
assert.equal(x.db.v410.movements[0].qty,100);
assert.equal(x.db.v410.lots[0].qty,1000,'Original purchase must never be overwritten');
assert(!x.db.finance.c1?.expenses?.length,'Feed issue must not add a second direct expense');
assert.equal(x.info().issued,1,'Successful issue should update the visible balances');
x.controls['pfm-v8-issue-qty'].value='10';x.ctx.perform();
assert.equal(x.db.v410.movements.length,1,'Duplicate feed issue for same date blocked');
assert.match(x.controls['pfm-v8-issue-state'].textContent,/مسجل بالفعل/);
x.controls['pfm-v8-issue-lot'].value='l-med';
x.controls['pfm-v8-issue-qty'].value='20';x.ctx.perform();
assert.equal(x.db.meds.length,1,'Medicines must be issued from same page');
assert.equal(x.db.meds[0].cost,60);
assert.equal(x.db.v410.movements.length,2);
x.controls['pfm-v8-issue-lot'].value='l-bedding';
x.controls['pfm-v8-issue-qty'].value='10';x.ctx.perform();
assert.equal(x.db.finance.c1.expenses.length,1,'Bedding should charge cycle once');
assert.equal(x.db.finance.c1.expenses[0].amount,15);
assert.equal(x.db.v410.movements.length,3);
const beforeInvalid=JSON.stringify(x.db);
x.controls['pfm-v8-issue-qty'].value='1000';x.ctx.perform();
assert.equal(JSON.stringify(x.db),beforeInvalid,'Overdrawn stock may not mutate records');
x.controls['pfm-v8-issue-lot'].value='l-other';
x.controls['pfm-v8-issue-qty'].value='2';x.ctx.perform();
assert.equal(JSON.stringify(x.db),beforeInvalid,'Stock from another farm must be rejected');
x.controls['pfm-v8-issue-lot'].value='l-feed';
x.controls['pfm-v8-issue-qty'].value='5';
x.db.v410.close.c1={status:'closed'};const beforeClosed=JSON.stringify(x.db);
x.ctx.perform();
assert.equal(JSON.stringify(x.db),beforeClosed,'Closed cycles reject new stock expenses');
const y=scenario();const beforeFailure=JSON.stringify(y.db);
y.setPersist(()=>{throw Error('Storage failed')});y.ctx.perform();
assert.equal(JSON.stringify(y.db),beforeFailure,'Failed persistence must roll back all three operational ledgers');
assert.match(y.controls['pfm-v8-issue-state'].textContent,/Storage failed/);
console.log('PASS: unified categories, old-entry guards, quantity-only issue, one-time financial charge, duplicate/foreign stock/closed-cycle checks and rollback.');
