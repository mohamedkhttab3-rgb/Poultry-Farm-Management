'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const accounting=require('../www/pfm-v81-accounting-core.js');
const html=fs.readFileSync('www/index.html','utf8'),finance=fs.readFileSync('www/v410-finance.js','utf8');
const calcSource=html.match(/function calc\(c\)\{[\s\S]*?(?=\nfunction cycleOrdinal\(c\))/)?.[0];
const closeSource=finance.match(/function closeCycle\(\)\{[\s\S]*?(?=\n function reopenCycle\(\))/)?.[0];
assert(calcSource,'Actual cycle profitability source not found');
assert(closeSource,'Actual financial closure code not found');
const cycle={id:'C1',farmId:'F1',houseId:'H1',birds:100,initWeight:.04,date:'2026-10-01'};
const invoice={id:'D1'};
const fake={farms:[{id:'F1'}],cycles:[cycle],weights:[],feed:[{id:'food',cycleId:'C1',date:'2026-10-10',qty:30,price:2}],meds:[{cycleId:'C1',date:'2026-10-10',cost:10}],sales:[{id:'S1',cycleId:'C1',date:'2026-10-12',birds:100,weightKg:180,total:450,v410Snapshot:{cost:100,margin:350}}],
 finance:{C1:{chicks:100,expenses:[{id:'E1',category:'عمال',amount:40}]}},settings:{currency:'SAR'},
 v410:{close:{},audit:[],purchaseDocuments:[invoice],assets:[{id:'A1',farmId:'F1',cost:1200,residual:0,lifeMonths:12,startDate:'2026-10-01',currency:'SAR'}],
 sharedExpenses:[{id:'SH1',farmId:'F1',purchaseDocumentId:'D1',date:'2026-10-10',cost:80,allocations:[{cycleId:'C1',amount:80}]}],
 depreciationPostings:[{id:'DEP1',assetId:'A1',farmId:'F1',date:'2026-10-01',month:'2026-10',amount:100,allocations:[{cycleId:'C1',amount:100}]}]
 }};
const vmCtx=vm.createContext({db:fake,window:{PFMV81Accounting:accounting},financeDraftExpenses:{},
 today:()=> '2026-10-22',cycleMetricDate:()=> '2026-10-22',
 deadTotal:()=>0,cullTotal:()=>0,isPastOrToday:()=>true,
 saleRowBirds:(c,s)=>s.birds,saleWeightKg:(c,s)=>s.weightKg,pfm81SaleWeightProblem:(_c,s)=>s.weightUnit==='bird'&&Number(s.avgWeight)>8,
 liveAtDate:()=>0,feedForFcr:()=>30,performanceWeight:()=>1.8,
 age:()=>21,getCycleCurrency:()=> 'SAR',saleRowRevenue:s=>s.total,
 financeExpenseTotal:fin=>fin.expenses.reduce((t,e)=>t+e.amount,0),liveSource:()=>({live:0})});
vm.runInContext(calcSource+'\nthis.actualCalc=calc',vmCtx);
const p=vmCtx.actualCalc(cycle);
assert.equal(p.fc,60);
assert.equal(p.meds,10);
assert.equal(p.expenseTotal,40);
assert.equal(p.sharedCost,80);
assert.equal(p.depreciationCost,100);
assert.equal(p.cost,390,'Chicks + feed + medicines + legacy expenses + shared allocations + depreciation once');
assert.equal(p.rev,450);
assert.equal(p.profit,60);
assert.equal(fake.sales[0].v410Snapshot.cost,100,'Old frozen sale snapshots must never be repriced');
const statuses=[],audit=[],snapshots=[];
const context=vm.createContext({
 db:fake,currentUser:{id:'owner'},cid:()=>cycle.id,cyc:()=>cycle,
 userCan:()=>true,permit:()=>true,financialLive:()=>0,
 v:()=>fake.v410,money:n=>Math.round(n*100)/100,calc:()=>vmCtx.actualCalc(cycle),
 totalFrozen:()=>100,legacyCount:()=>0,
 $:id=>({value:'final reconciliation'}),
 out:(ar,en)=>statuses.push(en),E:(ar,en)=>en,confirm:()=>true,
 track:(kind,id,before,after,reason)=>audit.push({kind,id,before,after,reason}),
 save:()=>snapshots.push(JSON.stringify(fake.v410.close[cycle.id])),
 window:{PFMV81Accounting:accounting},Date
});
vm.runInContext(closeSource+'\nthis.actualClose=closeCycle',context);
const original=JSON.stringify(fake.v410.close);
fake.v410.sharedExpenses[0].allocations[0].amount=79;
context.actualClose();
assert.equal(JSON.stringify(fake.v410.close),original,'Unbalanced shared cost must prevent financial close');
assert.equal(snapshots.length,0);
assert(statuses.some(m=>m.includes('blocked')),'User sees reason close was blocked');
fake.v410.sharedExpenses[0].allocations[0].amount=80;
context.actualClose();
assert.equal(snapshots.length,1,'Balanced closed cycle should be saved once');
assert.equal(fake.v410.close.C1.status,'closed');
assert.equal(fake.v410.close.C1.cost,390,'Closing must include allocated shared costs and depreciation');
assert.equal(fake.v410.close.C1.profit,60);
assert.equal(fake.sales[0].v410Snapshot.cost,100,'Closing cannot rewrite frozen sales');
assert.equal(audit.length,1,'One closing audit record');
console.log('PASS: Actual per-house calc includes shared/depreciation once, frozen sales remain immutable, and close refuses unbalanced ledger.');
