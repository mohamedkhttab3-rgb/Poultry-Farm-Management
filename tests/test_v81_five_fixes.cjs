'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const core=require('../www/pfm-v81-issue-corrections.js');
const fixture=()=>({
 cycles:[{id:'c1',farmId:'f1',date:'2026-09-01'},{id:'c2',farmId:'f1',date:'2026-09-01'}],
 sales:[],auditLog:[],feed:[{id:'r1',cycleId:'c1',date:'2026-10-01',type:'بادي',qty:4,price:2,v410MovementId:'m1'}],
 meds:[{id:'r2',cycleId:'c1',date:'2026-10-01',type:'دواء',name:'Vet',qty:2,cost:12,v410MovementId:'m2'}],
 finance:{c1:{expenses:[{id:'r3',category:'نشارة',amount:3}]},c2:{expenses:[]}},
 v410:{
  lots:[{id:'l1',farmId:'f1',kind:'feed',item:'بادي',qty:10,unitCost:2},
        {id:'l2',farmId:'f1',kind:'feed',item:'نامي',qty:15,unitCost:3},
        {id:'l3',farmId:'f1',kind:'med',item:'Vet',qty:5,unitCost:6},
        {id:'l4',farmId:'f1',kind:'bedding',item:'Wood',qty:8,unitCost:1.5}],
  movements:[{id:'m1',kind:'issue',operationRef:'ISS-1',lotId:'l1',cycleId:'c1',farmId:'f1',
    sourceType:'feed',sourceId:'r1',qty:4,unitCost:2,cost:8,date:'2026-10-01'},
   {id:'m2',kind:'issue',operationRef:'ISS-2',lotId:'l3',cycleId:'c1',farmId:'f1',
    sourceType:'med',sourceId:'r2',qty:2,unitCost:6,cost:12,date:'2026-10-01'},
   {id:'m3',kind:'issue',operationRef:'ISS-3',lotId:'l4',cycleId:'c1',farmId:'f1',
    sourceType:'expense',sourceId:'r3',qty:2,unitCost:1.5,cost:3,date:'2026-10-01'}],
  expenses:{r3:{id:'r3',cycleId:'c1',date:'2026-10-01',lotId:'l4',qty:2,price:1.5,amount:3}},
  close:{},audit:[]}
});
const actions=[];const ctx={canFinance:()=>true,audit:(...args)=>actions.push(args),persist:()=>{}};
let d=fixture();
assert.equal(core.available(d.v410,d.v410.lots[0]),6);
core.revise(d,{...ctx,id:'m1',replacement:{qty:6,date:'2026-10-02'}});
assert.equal(d.v410.movements.length,3,'edit never creates a second issue');
assert.equal(core.available(d.v410,d.v410.lots[0]),4);
assert.equal(d.feed.find(x=>x.id==='r1').qty,6);
assert.equal(d.v410.movements.find(x=>x.id==='m1').cost,12);
assert.equal(actions.at(-1)[0],'update');
core.revise(d,{...ctx,id:'m1',replacement:{qty:5,lotId:'l2',cycleId:'c2',operationRef:'ISS-EDITED',date:'2026-10-03'}});
assert.equal(core.available(d.v410,d.v410.lots[0]),10,'old lot returned');
assert.equal(core.available(d.v410,d.v410.lots[1]),10);
assert.equal(d.feed[0].price,3);
assert.equal(d.feed[0].cycleId,'c2');
core.revise(d,{...ctx,id:'m1',remove:true});
assert.equal(d.feed.length,0);
assert.equal(core.available(d.v410,d.v410.lots[1]),15);
assert.equal(d.v410.movements.length,2);
assert.equal(actions.at(-1)[0],'delete');
d=fixture();
core.revise(d,{...ctx,id:'m2',replacement:{qty:3}});
assert.equal(d.meds[0].cost,18);
assert.equal(core.available(d.v410,d.v410.lots[2]),2);
core.revise(d,{...ctx,id:'m3',replacement:{qty:4,cycleId:'c2'}});
assert.equal(d.finance.c1.expenses.length,0);
assert.equal(d.finance.c2.expenses[0].amount,6);
assert.equal(d.v410.expenses.r3.cycleId,'c2');
core.revise(d,{...ctx,id:'m3',remove:true});
assert.equal(d.finance.c2.expenses.length,0);
assert.equal(Object.hasOwn(d.v410.expenses,'r3'),false);
assert.equal(core.available(d.v410,d.v410.lots[3]),8);
const expectSame=(opts,reason)=>{
 const before=JSON.stringify(d);assert.throws(()=>core.revise(d,{...ctx,...opts}),reason);
 assert.equal(JSON.stringify(d),before,'rejected correction cannot partially mutate state');
};
d=fixture();
expectSame({id:'m1',replacement:{qty:11}},/Insufficient/);
expectSame({id:'m1',replacement:{qty:2,operationRef:'ISS-2'}},/Duplicate/);
expectSame({id:'m1',replacement:{qty:1,lotId:'l3'}},/Different cost category/);
expectSame({id:'m1',replacement:{qty:1,date:'2020-01-01'}},/Invalid issue date/);
expectSame({id:'m1',replacement:{qty:1},canFinance:()=>false},/permission/);
d.sales.push({id:'sold',cycleId:'c1',v410Snapshot:{cost:100}});
expectSame({id:'m1',remove:true},/Frozen sale/);
d.sales=[];d.v410.close.c1={status:'closed'};
expectSame({id:'m1',remove:true},/closed/);
d=fixture();expectSame({id:'m1',replacement:{qty:7},persist:()=>{throw Error('Disk failure')}},/Disk failure/);
const index=fs.readFileSync('www/index.html','utf8');
const invoice=fs.readFileSync('www/pfm-v8-invoice-ui.js','utf8');
const ws=fs.readFileSync('www/pfm-v8-purchases-workspace.js','utf8');
const pdf=fs.readFileSync('www/pfm-v59-print-results.js','utf8');
assert(index.includes('pfm-v81-issue-corrections.js'),'correction core must be loaded on all platforms');
assert(index.includes('<th>سعر البيع</th><th>قيمة الضريبة</th><th>الإيرادات</th>'));
assert(index.includes('s.v410Vat?.invoiceGross??s.v410Vat?.gross??net'),'gross must use saved original VAT snapshot');
assert(index.includes('colspan="10"'),'sales empty row columns should match');
assert(invoice.includes('data-line-save')&&invoice.includes('PFMV8InvoiceCore.prepare'),'line drafts must be validated without committing');
assert(ws.includes('data-pfm-issue-edit')&&ws.includes('data-pfm-issue-delete'),'issue history must offer edit/delete');
assert(ws.includes('PFMV81IssueCorrections.revise'),'issue UI must use transactional core');
assert(ws.includes("for(const stage of ['5','6','8'])"),'daily menu ownership');
assert(pdf.includes('width:63mm;box-sizing:border-box;height:7mm'),'footer brand is grouped and centered');
console.log('PASS V8.1 five fixes: issue corrections, tax columns, draft lines, nav and footer');
