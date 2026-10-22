'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const docs=require('../www/pfm-v8-invoice-core.js');
const draft=require('../www/pfm-v81-purchase-drafts.js');
const purchase=require('../www/pfm-v74-purchase-core.js');
let serial=0,saves=0,failSave=false;
const db={farms:[{id:'farm'}],cycles:[{id:'cycle',farmId:'farm',houseId:'h1',cycleNumber:1,date:'2026-10-01',birds:20000}],
 finance:{cycle:{expenses:[]}},settings:{currency:'SAR'},v410:{lots:[],chicks:{},expenses:{},close:{},movements:[],audit:[]},feed:[],meds:[],sales:[]};
const acct=()=>({uuid:()=>String(++serial),price:purchase.price,shares:purchase.shares,
 normalizeExpenses:f=>f.expenses||[],canFinance:()=>true,cycleOrdinal:c=>c.cycleNumber,
 userId:'qa',currency:()=> 'SAR',persist:()=>{if(failSave)throw Error('simulated disk write error');saves++}});
const ctx={uuid:()=>String(++serial),prepare:docs.prepare,accounting:acct,
 persist:()=>{if(failSave)throw Error('simulated disk write error');saves++}};
const header={date:'2026-10-20',supplier:'',invoice:''};
const diesel={kind:'diesel',item:'ديزل',quantity:'1',unit:'وحدة',priceMode:'total',amount:'35000',
 discount:'0',vatMode:'included',vatRate:'15',reclaim:'0',cycleId:'cycle',freight:'0'};
const meds={kind:'vaccine',item:'Clone 30',quantity:'500',unit:'جرعة',priceMode:'total',amount:'5000',
 discount:'0',vatMode:'excluded',vatRate:'15',reclaim:'100',freight:'0'};
let first=draft.saveLine(db,{farmId:'farm',header,line:diesel},ctx);
assert.equal(first.draft.lines.length,1);
assert.equal(db.finance.cycle.expenses.length,0,'draft must not post expenses before approval');
assert.equal(db.v410.lots.length,0,'draft must not create stock before approval');
assert.equal(db.v410.purchaseDrafts.length,1,'draft persisted');
assert.deepEqual(draft.read(db,'farm').lines.map(x=>x.item),['ديزل']);
draft.saveLine(db,{farmId:'farm',header,lineId:first.lineId,line:{...diesel,amount:'38000'}},ctx);
assert.equal(draft.read(db,'farm').lines.length,1,'edit replaces original saved line');
let second=draft.saveLine(db,{farmId:'farm',header,line:meds},ctx);
assert.equal(second.draft.lines.length,2);
assert.equal(draft.read(db,'farm').lines.length,2);
const preDuplicate=JSON.stringify(db);
assert.throws(()=>draft.saveLine(db,{farmId:'farm',header,line:meds},ctx),/DUPLICATE_ITEM/);
assert.equal(JSON.stringify(db),preDuplicate,'invalid duplicate does not mutate drafts');
const two=draft.read(db,'farm');const stagedInput={farmId:'farm',date:header.date,
 supplier:'Supplier Q',invoice:'INV-100',draftId:two.id,
 lines:two.lines.map(({draftLineId,...line})=>line)};
const totalPreview=docs.prepare(db,stagedInput,acct()).document.totals.accountingCost;
assert(totalPreview>0);
const saved=docs.commit(db,stagedInput,acct());
assert.equal(saved.lines.length,2);
assert.equal(db.v410.purchaseDocuments.length,1,'single invoice header is committed');
assert.equal(db.v410.lots.length,1,'med purchased once');
assert.equal(db.finance.cycle.expenses.length,1,'direct diesel expense posted exactly once');
assert.equal(db.finance.cycle.expenses[0].amount,38000,'VAT-inclusive unclaimable tax preserved');
assert.equal(draft.read(db,'farm'),null,'draft removed on same financial commit');
assert.equal(db.v410.movements.length,0,'stock purchase must not issue stock');
assert.throws(()=>docs.commit(db,stagedInput,acct()),/DUPLICATE_INVOICE/);
assert.equal(db.v410.purchaseDocuments.length,1,'double final approval blocked');
// Uncommitted line deletion and rollback
first=draft.saveLine(db,{farmId:'farm',header:{date:'2026-10-21'},line:diesel},ctx);
let count=db.v410.purchaseDrafts[0].lines.length;
failSave=true;
assert.throws(()=>draft.removeLine(db,{farmId:'farm',lineId:first.lineId},ctx),/simulated disk/);
assert.equal(db.v410.purchaseDrafts[0].lines.length,count,'failed delete rolls back');
assert.throws(()=>draft.saveLine(db,{farmId:'farm',header:{date:'2026-10-21'},line:meds},ctx),/simulated disk/);
assert.equal(db.v410.purchaseDrafts[0].lines.length,count,'failed draft save rolls back');
failSave=false;
draft.removeLine(db,{farmId:'farm',lineId:first.lineId},ctx);
assert.equal(draft.read(db,'farm'),null,'last line deletion removes the draft');

const html=fs.readFileSync('www/index.html','utf8');
const purchaseUI=fs.readFileSync('www/pfm-v8-invoice-ui.js','utf8');
const workspace=fs.readFileSync('www/pfm-v8-purchases-workspace.js','utf8');
const core=fs.readFileSync('www/pfm-v8-invoice-core.js','utf8');
for(const file of ['www/pfm-v8-invoice-ui.js','www/pfm-v8-purchases-workspace.js',
 'www/pfm-v81-purchase-drafts.js','www/pfm-v8-invoice-core.js'])new Function(fs.readFileSync(file,'utf8'));
assert(html.includes('pfm-v81-purchase-drafts.js'),'draft engine must be loaded');
assert(purchaseUI.includes('data-v8-edit-draft')&&purchaseUI.includes('pfm-v8-draft-rows'));
assert(purchaseUI.includes("$(id).scrollIntoView"),'missing header must be scrolled into view');
assert(core.includes('input?.draftId'),'approved invoice must remove its draft atomically');
assert(workspace.includes('function dailyMedicine()'),'daily medicine entry must use purchased batch');
assert(workspace.includes('function configureDailyMedicines()'));
assert(workspace.includes('cost.hidden=true'),'hide daily medicine cost entry');
assert(workspace.includes("withdrawal:Number(override?.medication?.withdrawal||0)"));
assert(workspace.includes('#meds .v410-direct-tax'),'hide invoice VAT on daily health screen');
// Execute the actual shared stock-issue handler with a daily medicine override.
const source=workspace.match(/function issue\(override\)\{[\s\S]*?(?=\nfunction dailyMedicine\(\))/)?.[0];
assert(source,'shared issue handler missing');
const medDB={farms:[{id:'farm'}],cycles:[{id:'cycle',farmId:'farm',date:'2026-10-01',houseId:'h1'}],
 feed:[],meds:[],auditLog:[],finance:{},settings:{currency:'SAR'},
 v410:{lots:[{id:'batch',kind:'vaccine',farmId:'farm',item:'Clone 30',qty:200,unitCost:2,unit:'dose',supplier:'Supplier Q',invoice:'INV-2'}],
  movements:[],expenses:{},close:{}}};
const controls={'pfm-v8-issue-qty':{value:'1'},'pfm-v8-issue-ref':{value:'manual-ref'},'pfm-v8-issue-state':{textContent:''},medQty:{value:'3'},medDose:{value:'spray'},medWithdrawal:{value:'0'}};
let medSaves=0;
const sandbox={db:medDB,issuing:false,issueEditingId:'',window:{PFM_V410:{refresh(){}}},
 currentUser:{id:'qa'},$:id=>controls[id],selectedFarm:()=> 'farm',stock:()=>medDB.v410,
 tr:(ar,en)=>ar,money:n=>Math.round((Number(n)+Number.EPSILON)*100)/100,
 balance:lot=>lot.qty-medDB.v410.movements.filter(x=>x.lotId===lot.id).reduce((a,b)=>a+b.qty,0),
 uuid:(()=>{let i=0;return()=>String(++i)})(),can:()=>true,requireActionForRecord:()=>true,
 audit:()=>{},save:()=>{medSaves++},normalizeFinanceExpenses:f=>f.expenses||[],
 refreshIssues:()=>{},renderMedTable:()=>{},alert:()=>{}};
vm.runInNewContext(source+'\nthis.runIssue=issue;',sandbox);
sandbox.runIssue({lotId:'batch',cycleId:'cycle',qty:20,date:'2026-10-20',operationRef:'MED-QA-1',
 medication:{dose:'spray',withdrawal:7}});
assert.equal(medDB.meds.length,1);
assert.equal(medDB.meds[0].cost,40);
assert.equal(medDB.meds[0].dose,'spray');
assert.equal(medDB.meds[0].withdrawal,7);
assert.equal(medDB.v410.movements.length,1);
assert.equal(medDB.v410.movements[0].cost,40);
assert.equal(medDB.v410.lots[0].qty,200,'purchase original remains untouched');
assert.equal(medSaves,1,'single financial save boundary');
console.log('PASS V8.1: draft save/restore/edit/delete, real approval, no duplicate invoices, daily vaccine issue + technical fields');
