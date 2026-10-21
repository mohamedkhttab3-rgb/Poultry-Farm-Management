'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const accounting=require('../www/pfm-v81-accounting-core.js');
const invoice=require('../www/pfm-v8-invoice-core.js');
const purchase=require('../www/pfm-v74-purchase-core.js');
const blank=()=>({
 farms:[{id:'farm-A'},{id:'farm-B'}],
 cycles:[{id:'A1',farmId:'farm-A',houseId:'house-1',cycleNumber:1,birds:100,date:'2026-10-01'},
         {id:'A2',farmId:'farm-A',houseId:'house-2',cycleNumber:1,birds:300,date:'2026-10-01'},
         {id:'B1',farmId:'farm-B',houseId:'house-3',cycleNumber:1,birds:150,date:'2026-10-01'}],
 finance:{A1:{chicks:200,expenses:[{id:'legacy-1',category:'عمال',amount:50}]}},
 settings:{currency:'SAR'},
 v410:{lots:[],movements:[],chicks:{},expenses:{},audit:[],close:{},purchaseDocuments:[]}
});
let serial=0;
const ctx={uuid:()=> 'uuid-'+(++serial),now:()=> '2026-10-22T09:00:00.000Z',currentMonth:'2026-10',
 userId:'u',price:purchase.price,shares:purchase.shares,
 normalizeExpenses:f=>f?.expenses||[],canFinance:()=>true,
 cycleOrdinal:c=>c.cycleNumber,currency:()=> 'SAR',allocate:accounting.allocate};
const shared={kind:'shared',item:'فاتورة كهرباء المزرعة',quantity:1,unit:'invoice',amount:101,
 vatRate:0,reclaim:0,method:'birds',cycleIds:['A1','A2']};
const asset={kind:'asset',item:'مروحة شفط',quantity:1,unit:'item',amount:1200,
 vatRate:0,reclaim:0,startDate:'2026-10-20',lifeMonths:'12',residual:0};
const request=()=>({farmId:'farm-A',supplier:'Supplier',invoice:'INV-42',date:'2026-10-20',lines:[shared,asset]});
const db=blank(),before=JSON.stringify(db);
const plan=invoice.prepare(db,request(),ctx);
assert.equal(JSON.stringify(db),before,'Preview must not modify historical data');
assert.equal(plan.document.lines.length,2);
assert.equal(plan.document.totals.accountingCost,1301);
assert.equal(plan.nextV410.sharedExpenses.length,1);
assert.equal(plan.nextV410.assets.length,1);
assert.equal(plan.nextV410.lots.length,0,'Capital and shared expenses are NOT stock');
assert.equal(plan.nextFinance.A1.chicks,200);
assert.equal(plan.nextFinance.A1.expenses[0].amount,50,'Never double-add shared invoice into existing direct expenses');
assert.equal(plan.nextFinance.A2,undefined,'Shared expense must not create another direct expense record');
const allocation=plan.nextV410.sharedExpenses[0];
assert.deepEqual(allocation.allocations.map(a=>a.amount),[25.25,75.75]);
assert.equal(allocation.allocations.reduce((s,x)=>s+x.amount,0),101);
assert.equal(allocation.purchaseDocumentId,plan.document.id);
assert.equal(plan.nextV410.assets[0].purchaseDocumentId,plan.document.id);
let saves=0;
invoice.commit(db,request(),{...ctx,persist:()=>saves++});
assert.equal(saves,1);
assert.equal(db.v410.purchaseDocuments.length,1);
assert.throws(()=>invoice.prepare(db,request(),ctx),/DUPLICATE_INVOICE/,'Same supplier invoice cannot be charged twice');
assert.deepEqual(accounting.charges(db,'A1'),{shared:25.25,depreciation:0,total:25.25});
assert.deepEqual(accounting.charges(db,'A2'),{shared:75.75,depreciation:0,total:75.75});
assert.deepEqual(accounting.charges(db,'B1'),{shared:0,depreciation:0,total:0});
assert.deepEqual(accounting.validateLedger(db),[]);
assert.throws(()=>accounting.allocate(db,{farmId:'farm-A',cycleIds:['A1','B1'],amount:30}),/Cross-farm/);
assert.throws(()=>accounting.allocate(db,{farmId:'farm-A',cycleIds:['A1','A1'],amount:30}),/distinct/);
assert.throws(()=>accounting.allocate(db,{farmId:'farm-A',cycleIds:['A1'],amount:-1}),/Negative/);
assert.deepEqual(accounting.allocate(db,{farmId:'farm-A',cycleIds:['A1','A2'],amount:100.01,method:'equal'}).map(x=>x.amount),[50.01,50]);
const fixed=db.v410.assets[0];
const entry=accounting.postDepreciation(db,{assetId:fixed.id,month:'2026-10',cycleIds:['A1','A2'],method:'birds'},
 {...ctx,persist:()=>saves++});
assert.equal(entry.amount,100);
assert.deepEqual(entry.allocations.map(x=>x.amount),[25,75]);
assert.equal(db.v410.depreciationPostings.length,1);
assert.equal(db.finance.A1.expenses[0].amount,50,'Depreciation must not be copied into legacy expenses');
assert.deepEqual(accounting.charges(db,'A1'),{shared:25.25,depreciation:25,total:50.25});
assert.deepEqual(accounting.charges(db,'A2'),{shared:75.75,depreciation:75,total:150.75});
assert.equal(accounting.charges(db,'A1','2026-09-30').total,0,'Prior-date reports must not include later costs');
assert.equal(accounting.validateLedger(db).length,0);
assert.throws(()=>accounting.postDepreciation(db,{assetId:fixed.id,month:'2026-10',cycleIds:['A1','A2']},{...ctx,persist:()=>{}}),/DUPLICATE_DEPRECIATION/);
assert.equal(db.v410.depreciationPostings.length,1);
assert.throws(()=>accounting.planDepreciation(db,{assetId:fixed.id,month:'2026-12',cycleIds:['A1']},{...ctx,currentMonth:'2026-12'}),/previous month/i);
db.v410.close.A2={status:'closed'};
assert.throws(()=>accounting.allocate(db,{farmId:'farm-A',cycleIds:['A2'],amount:10}),/closed/);
assert.throws(()=>accounting.planDepreciation(db,{assetId:fixed.id,month:'2026-11',cycleIds:['A1','A2']},{...ctx,currentMonth:'2026-11'}),/closed/);
delete db.v410.close.A2;
const preFail=JSON.stringify(db);
assert.throws(()=>accounting.postDepreciation(db,{assetId:fixed.id,month:'2026-11',cycleIds:['A1','A2']},
 {...ctx,currentMonth:'2026-11',persist:()=>{throw Error('Storage error')}}),/Storage error/);
assert.equal(JSON.stringify(db),preFail,'Failed save must roll back depreciation without creating duplicate costs');
assert.throws(()=>invoice.prepare(blank(),{...request(),lines:[{...asset,residual:2000}]},ctx),/Residual/);
const invalid=JSON.parse(JSON.stringify(db));
invalid.v410.sharedExpenses[0].allocations[0].amount=25.26;
assert(accounting.validateLedger(invalid,'A1').some(s=>s.startsWith('SHARED:')),'Closing integrity must detect unbalanced shared invoice');
const tiny={id:'tiny',startDate:'2026-10-01',cost:100,residual:0,lifeMonths:3};
assert.equal(accounting.monthCharge(tiny,'2026-10'),33.33);
assert.equal(accounting.monthCharge(tiny,'2026-11',[{assetId:'tiny',month:'2026-10'}]),33.33);
assert.equal(accounting.monthCharge(tiny,'2026-12',[{assetId:'tiny',month:'2026-10'},{assetId:'tiny',month:'2026-11'}]),33.34);
assert.equal(accounting.charges(db,'A1').shared+accounting.charges(db,'A2').shared,101);
console.log('PASS V8.1: single-source shared invoice; cent-exact allocations; per-house independent profit charges; fixed assets; monthly depreciation; locked cycles; duplicate guard; past-date reporting; rollback; ledger reconciliation.');
