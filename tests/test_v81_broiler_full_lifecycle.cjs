'use strict';
// Real accounting-flow integration: register farm/houses/cycles -> supplier invoice ->
// stocked feed/medicine -> actual issued records -> shared cost / depreciation ->
// sale settlements -> actual calc(c) and closeCycle(), without any real farm data.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const invoice=require('../www/pfm-v8-invoice-core.js');
const pricing=require('../www/pfm-v74-purchase-core.js');
const accounting=require('../www/pfm-v81-accounting-core.js');
const html=fs.readFileSync('www/index.html','utf8');
const financeJs=fs.readFileSync('www/v410-finance.js','utf8');
const workspace=fs.readFileSync('www/pfm-v8-purchases-workspace.js','utf8');
const calcSource=html.match(/function calc\(c\)\{[\s\S]*?(?=\nfunction cycleOrdinal\(c\))/)?.[0];
const closeSource=financeJs.match(/function closeCycle\(\)\{[\s\S]*?(?=\n function reopenCycle\(\))/)?.[0];
const issueSource=workspace.match(/function issue\(\)\{[\s\S]*?(?=\nfunction build\(\))/)?.[0];
for(const [name,src] of [['calc',calcSource],['close',closeSource],['issue',issueSource]])assert(src,'Missing real '+name+' handler');
const db={
 farms:[{id:'F1',name:'Test broiler farm'}],houses:[{id:'H1',farmId:'F1'},{id:'H2',farmId:'F1'}],
 cycles:[{id:'C1',farmId:'F1',houseId:'H1',date:'2026-10-01',cycleNumber:1,birds:100,initWeight:.04},
 {id:'C2',farmId:'F1',houseId:'H2',date:'2026-10-01',cycleNumber:1,birds:200,initWeight:.04}],
 feed:[],meds:[],sales:[],daily:[],weights:[],finance:{},auditLog:[],settings:{currency:'SAR'},
 v410:{lots:[],movements:[],chicks:{},expenses:{},audit:[],close:{},purchaseDocuments:[]}
};
let counter=0,saves=0;
const context={uuid:()=> 'test-'+(++counter),now:()=> '2026-10-22T08:00:00.000Z',currentMonth:'2026-10',
 userId:'owner',price:pricing.price,shares:pricing.shares,normalizeExpenses:f=>f?.expenses||[],
 canFinance:()=>true,cycleOrdinal:c=>c.cycleNumber,currency:()=> 'SAR',allocate:accounting.allocate,
 persist:()=>{saves++}};
const lines=[
 {kind:'chicks',item:'كتاكيت عمر يوم',quantity:300,unit:'item',priceMode:'unit',amount:2,cycleNumber:1,free:0,vatRate:0},
 {kind:'feed',item:'بادي',quantity:600,unit:'kg',amount:900,vatRate:0},
 {kind:'med',item:'فيتامينات',quantity:30,unit:'dose',amount:150,vatRate:0},
 {kind:'shared',item:'كهرباء',quantity:1,unit:'invoice',amount:90,vatRate:0,method:'birds',cycleIds:['C1','C2']},
 {kind:'asset',item:'شفاط',quantity:1,unit:'item',amount:1200,vatRate:0,startDate:'2026-10-01',lifeMonths:12,residual:0},
 {kind:'rent',item:'إيجار خاص بعنبر 1',quantity:1,unit:'invoice',amount:60,vatRate:0,cycleId:'C1'}
];
const purchase={farmId:'F1',supplier:'All-in supplier',invoice:'FARM-1',date:'2026-10-01',lines};
const before=JSON.stringify(db);
const preview=invoice.prepare(db,purchase,context);
assert.equal(JSON.stringify(db),before,'Invoice preview should never mutate farms/cycles');
assert.equal(preview.nextV410.lots.length,2,'Stock purchase must create only feed/med batches');
assert.equal(preview.nextV410.movements.length,0,'Purchases cannot count as consumed feed');
assert.equal(preview.nextFinance.C1.chicks,200);
assert.equal(preview.nextFinance.C2.chicks,400);
invoice.commit(db,purchase,context);
assert.equal(saves,1);
assert.equal(db.v410.purchaseDocuments.length,1);
assert.throws(()=>invoice.commit(db,purchase,context),/DUPLICATE_INVOICE/);
assert.equal(db.v410.sharedExpenses[0].allocations.reduce((s,x)=>s+x.amount,0),90);
assert.equal(db.v410.assets[0].cost,1200);
assert.equal(db.finance.C1.expenses.length,1);
assert.equal(db.finance.C1.expenses[0].amount,60);
assert(!db.finance.C2.expenses,'Shared expense must not be copied into C2 expenses');
const lotByKind=kind=>db.v410.lots.find(l=>l.kind===kind);
const controls={};
for(const [key,value] of Object.entries({'pfm-v8-issue-cycle':'C1','pfm-v8-issue-lot':lotByKind('feed').id,
 'pfm-v8-issue-qty':'200','pfm-v8-issue-date':'2026-10-12','pfm-v8-issue-ref':'FEED-C1',
 'pfm-v8-issue-state':''}))controls[key]={value,textContent:''};
const issueContext=vm.createContext({db,window:{PFM_V410:{refresh(){} }},financeDraftExpenses:{},
 issuing:false,$:id=>controls[id],stock:()=>db.v410,selectedFarm:()=> 'F1',
 balance:lot=>lot.qty+db.v410.movements.filter(x=>x.lotId===lot.id).reduce((t,m)=>t+(m.kind==='return'?m.qty:-m.qty),0),
 tr:ar=>ar,money:n=>Math.round((Number(n)+Number.EPSILON)*100)/100,
 uuid:context.uuid,can:()=>true,requireActionForRecord:()=>true,
 audit:(_op,_type,id)=>db.auditLog.push({id}),save:()=>{saves++},
 normalizeFinanceExpenses:f=>f?.expenses||[],refreshIssues:()=>{}});
vm.runInContext(issueSource+'\nthis.postIssue=issue;',issueContext);
function issue(cycleId,kind,qty,reference){
 controls['pfm-v8-issue-cycle'].value=cycleId;
 controls['pfm-v8-issue-lot'].value=lotByKind(kind).id;
 controls['pfm-v8-issue-qty'].value=String(qty);
 controls['pfm-v8-issue-ref'].value=reference;
 issueContext.postIssue();
 assert(!controls['pfm-v8-issue-state'].textContent.startsWith('تعذر'),reference+': issue failed');
}
issue('C1','feed',200,'FEED-C1');
issue('C2','feed',400,'FEED-C2');
issue('C1','med',10,'MED-C1');
issue('C2','med',20,'MED-C2');
assert.equal(db.v410.movements.length,4);
assert.equal(db.feed.reduce((t,r)=>t+r.qty*r.price,0),900,'Feed must cost exactly the original invoiced total, once');
assert.equal(db.meds.reduce((t,r)=>t+r.cost,0),150,'Medicine must cost exactly the invoiced total, once');
assert.equal(db.v410.lots.reduce((t,l)=>t+l.accountingCost,0),1050,'Purchase stock must not duplicate operational cost');
assert.equal(db.v410.sharedExpenses.length,1);
const extra=accounting.postDepreciation(db,{assetId:db.v410.assets[0].id,month:'2026-10',cycleIds:['C1','C2'],method:'birds'},context);
assert.equal(extra.amount,100);
assert.equal(db.v410.depreciationPostings.length,1);
assert.equal(accounting.validateLedger(db).length,0);
const frozen=[{id:'S1',cycleId:'C1',date:'2026-10-21',birds:100,weightKg:190,total:1000,v410Snapshot:{cost:650,margin:350}},
 {id:'S2',cycleId:'C2',date:'2026-10-21',birds:200,weightKg:380,total:1800,v410Snapshot:{cost:1200,margin:600}}];
db.sales.push(...frozen);
const snapshot=JSON.stringify(frozen);
const calcContext=vm.createContext({db,window:{PFMV81Accounting:accounting},financeDraftExpenses:{},
 today:()=> '2026-10-22',cycleMetricDate:()=> '2026-10-22',
 deadTotal:()=>0,cullTotal:()=>0,isPastOrToday:()=>true,
 saleRowBirds:(c,s)=>s.birds,saleWeightKg:(c,s)=>s.weightKg,
 liveAtDate:()=>0,feedForFcr:()=>200,performanceWeight:()=>1.9,
 age:()=>21,getCycleCurrency:()=> 'SAR',saleRowRevenue:s=>s.total,
 financeExpenseTotal:f=>(f.expenses||[]).reduce((t,x)=>t+x.amount,0),liveSource:()=>({live:0})});
vm.runInContext(calcSource+'\nthis.realCalc=calc;',calcContext);
const c1=calcContext.realCalc(db.cycles[0]),c2=calcContext.realCalc(db.cycles[1]);
assert.equal(c1.cost,673.33);
assert.equal(c2.cost,1226.67);
assert.equal(c1.cost+c2.cost,1900,'All expenses must reconcile to the whole farm, without stock purchase double count');
assert.equal(c1.rev,1000);assert.equal(c2.rev,1800);
assert.equal(Number(c1.profit.toFixed(2)),326.67);assert.equal(Number(c2.profit.toFixed(2)),573.33);
assert.equal(Number((c1.profit+c2.profit).toFixed(2)),900);
assert.equal(JSON.stringify(frozen),snapshot,'Recalculation must not reprice frozen sales');
const status=[],closeEvents=[];
let active='C1';
const closeContext=vm.createContext({db,currentUser:{id:'owner'},cid:()=>active,cyc:id=>db.cycles.find(c=>c.id===id),
 userCan:()=>true,permit:()=>true,financialLive:()=>0,
 v:()=>db.v410,money:n=>Math.round((Number(n)+Number.EPSILON)*100)/100,
 calc:c=>calcContext.realCalc(c),totalFrozen:id=>db.sales.filter(s=>s.cycleId===id).reduce((t,s)=>t+s.v410Snapshot.cost,0),
 legacyCount:()=>0,$:()=>({value:'Ending stock balanced; all birds sold'}),
 out:(ar,en)=>status.push(en),E:(ar,en)=>en,confirm:()=>true,
 track:(...args)=>closeEvents.push(args),save:()=>saves++,
 window:{PFMV81Accounting:accounting},Date});
vm.runInContext(closeSource+'\nthis.finish=closeCycle;',closeContext);
closeContext.finish();
assert.equal(db.v410.close.C1.cost,673.33);
assert.equal(db.v410.close.C1.profit,326.67);
active='C2';closeContext.finish();
assert.equal(db.v410.close.C2.cost,1226.67);
assert.equal(db.v410.close.C2.profit,573.33);
assert.equal(closeEvents.length,2);
assert.equal(JSON.stringify(frozen),snapshot,'Financial close must not rewrite frozen partial-sale snapshots');
assert.equal(db.v410.purchaseDocuments.length,1);
assert.equal(db.v410.depreciationPostings.length,1);
assert.equal(db.v410.movements.length,4);
assert.throws(()=>accounting.allocate(db,{farmId:'F1',cycleIds:['C1'],amount:1}),/closed/);
console.log('PASS END-TO-END farm/house/cycle -> single invoice -> purchased stock -> four issues -> per-house allocation -> depreciation -> frozen sales -> exact profit and closed cycles. Costs=673.33+1226.67; profits=326.67+573.33.');
