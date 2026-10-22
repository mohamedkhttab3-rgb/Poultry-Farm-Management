'use strict';
/*
 * PFM V8.1 two realistic, FICTIONAL broiler farms financial acceptance scenario.
 * ALL supplier names, farm IDs, invoices, sales and values are test-only.
 * No writes to production/localStorage/Supabase. Never auto-import into users' farms.
 *
 * 2 farms x 2 houses/farm x 20,000 DOC = 80,000 received.
 * 42 daily records/house; 600 dead + 100 culled + 19,300 sold = 20,000/house.
 * Feed consumed 64,000kg/house; stage ratios 12t starter + 28t grower + 24t finisher.
 * Independent target: 413,680 SAR cost/farm and 595,012 SAR revenue/farm.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const invoice=require('../www/pfm-v8-invoice-core.js');
const pricing=require('../www/pfm-v74-purchase-core.js');
const accounting=require('../www/pfm-v81-accounting-core.js');
const index=fs.readFileSync(path.join(__dirname,'../www/index.html'),'utf8');
const financeJS=fs.readFileSync(path.join(__dirname,'../www/v410-finance.js'),'utf8');
const stockJS=fs.readFileSync(path.join(__dirname,'../www/pfm-v8-purchases-workspace.js'),'utf8');
const SOURCE={
 calc:index.match(/function calc\(c\)\{[\s\S]*?(?=\nfunction cycleOrdinal\(c\))/)?.[0],
 close:financeJS.match(/function closeCycle\(\)\{[\s\S]*?(?=\n function reopenCycle\(\))/)?.[0],
 issue:stockJS.match(/function issue\(override\)\{[\s\S]*?(?=\nfunction dailyMedicine\(\))/)?.[0],
 live:index.match(/function liveBreakdown\(c,d=today\(\)\)\{[\s\S]*?(?=\nfunction liveSource\()/)?.[0],
 sale:index.match(/function addSale\(\)\{[\s\S]*?(?=\nfunction renderSales\()/)?.[0]
};
for(const [key,val] of Object.entries(SOURCE))assert(val,'Actual app handler absent: '+key);
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
const cents=n=>Math.round(Number(n)*100);
const dateAdd=(start,i)=>new Date(Date.parse(start+'T12:00:00Z')+86400000*i).toISOString().slice(0,10);
const idPrefix='QA-80K-';
const db={
 qaOnly:true,scenario:'FICTIONAL_TWO_FARMS_80K_DOC',
 farms:[],houses:[],cycles:[],daily:[],weights:[],feed:[],meds:[],
 sales:[],inventory:[],finance:{},auditLog:[],tombstones:[],
 settings:{currency:'SAR'},
 v410:{lots:[],movements:[],chicks:{},expenses:{},audit:[],close:{},purchaseDocuments:[]}
};
let seq=0,persists=0;
const uuid=()=>idPrefix+String(++seq).padStart(6,'0');
const ctx={
 uuid,now:()=> '2026-10-22T08:00:00.000Z',currentMonth:'2026-10',
 userId:'QA-FICTIONAL-OWNER',price:pricing.price,shares:pricing.shares,
 normalizeExpenses:fin=>fin?.expenses||[],canFinance:()=>true,
 cycleOrdinal:c=>c.cycleNumber,currency:()=> 'SAR',allocate:accounting.allocate,
 persist:()=>{persists++}
};
const farms=[
 {id:'QA-FARM-EAST',name:'مزرعة التسمين التجريبية - الشرقية',first:'2026-08-01'},
 {id:'QA-FARM-WEST',name:'مزرعة التسمين التجريبية - الغربية',first:'2026-08-03'}
];
const cyclesOf=farm=>db.cycles.filter(c=>c.farmId===farm.id);
for(const farm of farms){
 db.farms.push({id:farm.id,name:farm.name,location:'افتراضي — للاختبار فقط',owner:'QA'});
 for(let house=1;house<=2;house++){
  const houseId=farm.id+'-H'+house,cycleId=farm.id+'-C'+house;
  db.houses.push({id:houseId,farmId:farm.id,name:'عنبر '+house,capacity:20000});
  db.cycles.push({id:cycleId,farmId:farm.id,houseId,cycleNumber:1,birds:20000,
   date:farm.first,initWeight:0.042,breed:'Ross 308',source:'QA hatchery',currency:'SAR',
   active:false,endedAt:dateAdd(farm.first,41)});
 }
}
assert.equal(db.farms.length,2);
assert.equal(db.houses.length,4);
assert.equal(db.cycles.length,4);
assert.equal(db.cycles.reduce((n,c)=>n+c.birds,0),80000);
for(const house of db.houses)assert.equal(house.capacity,20000);

const L=(kind,item,quantity,amount,additional={})=>
 ({kind,item,quantity,unit:'item',priceMode:'total',amount,vatRate:0,reclaim:0,...additional});
const bill=(farm,code,supplier,items,date=farm.first)=>({
 farmId:farm.id,date,supplier:supplier+' — افتراضي للاختبار',invoice:code,lines:items
});
const docs=[];
function addInvoice(farm,code,supplier,items,date){
 const input=bill(farm,code,supplier,items,date),before=db.v410.purchaseDocuments.length;
 const preview=invoice.prepare(db,input,ctx);
 assert.equal(db.v410.purchaseDocuments.length,before,'Invoice preview cannot persist data');
 assert.equal(preview.document.farmId,farm.id,'Invoice must remain inside farm');
 const saved=invoice.commit(db,input,ctx);
 assert.equal(db.v410.purchaseDocuments.length,before+1);
 assert.deepEqual(saved.totals,preview.document.totals,'Plan and commit must have equal VAT/cost totals');
 docs.push(saved);
 assert.throws(()=>invoice.prepare(db,input,ctx),/DUPLICATE_INVOICE/,'Reject duplicate supplier+invoice+farm');
 return saved;
}
for(const farm of farms){
 const houses=cyclesOf(farm),ids=houses.map(c=>c.id);
 const invoiceSet='INV-'+farm.id;
 // Purchase 40,000 received chicks incl. 1,200 free (600 free per house);
 // 38,800 paid x SAR 2.15 plus SAR 3,500 chick transport.
 addInvoice(farm,invoiceSet+'-DOC','المفرخ التجريبي',[
  L('chicks','صيصان تسمين عمر يوم',40000,2.15,
   {priceMode:'unit',unit:'item',free:1200,freight:3500,cycleNumber:1,vatRate:15,reclaim:100})
 ]);
 // Feed is PURCHASED, not an expense until issued to a cycle.
 addInvoice(farm,invoiceSet+'-FEED','مصنع أعلاف تجريبي',[
  L('feed','بادي',26000,1.95,{priceMode:'unit',unit:'kg',vatRate:15,reclaim:100}),
  L('feed','نامي',58000,1.77,{priceMode:'unit',unit:'kg',vatRate:15,reclaim:100}),
  L('feed','ناهي',50000,1.68,{priceMode:'unit',unit:'kg',vatRate:15,reclaim:100})
 ]);
 // Mixed taxable, recoverable and NONrecoverable VAT in one original document.
 addInvoice(farm,invoiceSet+'-VET','مستلزمات بيطرية تجريبية',[
  L('med','فيتامينات',200,19000,{unit:'dose',vatRate:15,vatMode:'included',reclaim:0}),
  L('vaccine','لقاحات',42000,0.16,{unit:'dose',priceMode:'unit',vatRate:15,reclaim:100}),
  L('disinfectant','مطهر مياه',400,25,{unit:'liter',priceMode:'unit',vatRate:15,reclaim:100})
 ]);
 addInvoice(farm,invoiceSet+'-BED','مستلزمات فرشة تجريبية',[
  L('bedding','نشارة',9000,0.6,{unit:'kg',priceMode:'unit',vatRate:15,reclaim:100})
 ]);
 addInvoice(farm,invoiceSet+'-ELEC','شركة المرافق الافتراضية',[
  L('shared','كهرباء العنابر',1,16000,{cycleIds:ids,method:'equal'})
 ],dateAdd(farm.first,4));
 addInvoice(farm,invoiceSet+'-WATER','خدمات مياه افتراضية',[
  L('shared','مياه المزرعة',1,3000,{cycleIds:ids,method:'birds'})
 ],dateAdd(farm.first,4));
 addInvoice(farm,invoiceSet+'-SUP','سند أجور إشراف تجريبي',[
  L('shared','إشراف فني مشترك',1,12000,{cycleIds:ids,method:'equal'})
 ],dateAdd(farm.first,5));
 addInvoice(farm,invoiceSet+'-RENT','إيجار المزرعة الافتراضي',[
  L('shared','إيجار المشروع',1,10000,{cycleIds:ids,method:'equal'})
 ],dateAdd(farm.first,5));
 addInvoice(farm,invoiceSet+'-DIESEL','وقود تدفئة تجريبي',houses.map((c,i)=>
  L('diesel','ديزل التدفئة',1,2000,{cycleId:c.id})),dateAdd(farm.first,2));
 addInvoice(farm,invoiceSet+'-LAB','مسير عمالة تجريبي',houses.map(c=>
  L('labor','عمال التربية',1,8000,{cycleId:c.id})),dateAdd(farm.first,6));
 addInvoice(farm,invoiceSet+'-SALES','شركة نقل وبيع افتراضية',houses.flatMap(c=>[
  L('transport','نقل الدجاج للمبيعات',1,2500,{cycleId:c.id}),
  L('loading','تحميل دجاج حي',1,1000,{cycleId:c.id})
 ]),dateAdd(farm.first,7));
 addInvoice(farm,invoiceSet+'-ASSET','شركة تجهيزات دواجن افتراضية',[
  L('asset','شفاطات تهوية',1,120000,
    {startDate:farm.first,lifeMonths:60,residual:0,vatRate:15,reclaim:100})
 ]);
 // Every remaining supported direct category must be exercised as an original
 // source invoice, not added again as a legacy manual finance entry.
 // Same supplier+invoice number in ANOTHER farm is valid scope isolation.
 addInvoice(farm,'QA-RENT-COMMON-2026','مكتب إيجارات تجريبي',[
  L('rent','إيجار خدمة عنبر خاصة',1,600,{cycleId:ids[0]})
 ],dateAdd(farm.first,10));
 addInvoice(farm,invoiceSet+'-H-POWER','صيانة كهربائية تجريبية',[
  L('electricity','كهرباء مولد احتياطي خاصة',1,400,{cycleId:ids[1]})
 ],dateAdd(farm.first,11));
 addInvoice(farm,invoiceSet+'-H-WATER','شركة مياه محلية تجريبية',[
  L('water','مياه معالجة خاصة',1,300,{cycleId:ids[0]})
 ],dateAdd(farm.first,12));
 addInvoice(farm,invoiceSet+'-EQ-RENT','تأجير معدات افتراضي',[
  L('equipment_rent','إيجار معدة صيانة',1,250,{cycleId:ids[1]})
 ],dateAdd(farm.first,13));
 addInvoice(farm,invoiceSet+'-PETTY','مصروفات تشغيلية تجريبية',[
  L('other','مصروفات نثرية',1,150,{cycleId:ids[0]})
 ],dateAdd(farm.first,14));
}
assert.equal(docs.length,34,'17 real-shaped source documents per farm');
assert.equal(new Set(docs.map(d=>d.farmId+'|'+d.supplier+'|'+d.invoice)).size,34);
assert.equal(db.v410.purchaseDocuments.length,34);
assert.equal(Object.keys(db.v410.chicks).length,4,'Four cycles have chick costs without duplication');
assert.equal(db.v410.lots.length,14,'Seven purchased inventory batches per farm');
assert.equal(db.v410.sharedExpenses.length,8,'4 farm-wide source documents per farm');
assert.equal(db.v410.assets.length,2,'One actual asset per farm');
assert.equal(db.v410.movements.length,0,'Purchase is not a stock consumption');
const requestedFeed={بادي:12000,نامي:28000,ناهي:24000};
const ISSUE_QUANTITIES={
 feed:{بادي:12000,نامي:28000,ناهي:24000},
 med:{فيتامينات:50},
 vaccine:{لقاحات:20000},
 disinfectant:{'مطهر مياه':150},
 bedding:{نشارة:4000}
};
const originalLotQuantity=new Map(db.v410.lots.map(l=>[l.id,l.qty]));
const controlKeys=['pfm-v8-issue-cycle','pfm-v8-issue-lot','pfm-v8-issue-qty',
 'pfm-v8-issue-date','pfm-v8-issue-ref','pfm-v8-issue-state'];
const controls=Object.fromEntries(controlKeys.map(k=>[k,{value:'',textContent:''}]));
let selectedFarm=farms[0].id,denyFinance=false,failedWrites=false;
const balance=lot=>lot.qty+db.v410.movements.filter(m=>m.lotId===lot.id)
 .reduce((n,m)=>n+(m.kind==='return'?m.qty:-m.qty),0);
const issueCtx=vm.createContext({db,window:{PFM_V410:{refresh(){}}},financeDraftExpenses:{},issuing:false,
 $:k=>controls[k],stock:()=>db.v410,selectedFarm:()=>selectedFarm,
 balance,tr:a=>a,money:round,uuid,can:()=>!denyFinance,
 requireActionForRecord:()=>!denyFinance,
 audit:(_a,_b,id)=>db.auditLog.push({id}),save:()=>{if(failedWrites)throw Error('QA simulated disk failure');persists++},
 normalizeFinanceExpenses:f=>f.expenses||[],refreshIssues:()=>{}});
vm.runInContext(SOURCE.issue+'\nthis.writeIssue=issue;',issueCtx);
function lotFor(farmId,kind,item){
 const lot=db.v410.lots.find(x=>x.farmId===farmId&&x.kind===kind&&x.item===item);
 assert(lot,'Missing purchased lot '+farmId+' '+kind+' '+item);return lot;
}
function issue(farmId,cycleId,kind,item,qty,ref,date){
 selectedFarm=farmId;
 const lot=lotFor(farmId,kind,item);
 controls['pfm-v8-issue-cycle'].value=cycleId;
 controls['pfm-v8-issue-lot'].value=lot.id;
 controls['pfm-v8-issue-qty'].value=String(qty);
 controls['pfm-v8-issue-ref'].value=ref;
 controls['pfm-v8-issue-date'].value=date;
 controls['pfm-v8-issue-state'].textContent='';
 const before=db.v410.movements.length;issueCtx.writeIssue();
 assert.equal(db.v410.movements.length,before+1,
  'Real stock issue rejected: '+ref+' '+controls['pfm-v8-issue-state'].textContent);
 assert.equal(db.v410.movements.at(-1).operationRef,ref);
}
function refuse(label,fn,needle){
 const before=JSON.stringify({feed:db.feed,meds:db.meds,finance:db.finance,ledger:db.v410.movements,audit:db.auditLog});
 fn();
 assert.match(controls['pfm-v8-issue-state'].textContent,needle,label);
 assert.equal(JSON.stringify({feed:db.feed,meds:db.meds,finance:db.finance,ledger:db.v410.movements,audit:db.auditLog}),
  before,'Rejected '+label+' must preserve all financial data');
}
const saleControls=Object.fromEntries([
 'saleCycle','saleBirds','saleWeightUnit','saleWeight','saleAvgWeight',
 'salePrice','saleDate','saleBuyer'].map(k=>[k,{value:''}]));
const saleAlerts=[];
const saleCtx=vm.createContext({db,uuid,editState:{type:null,id:null},
 saleCycle:saleControls.saleCycle,saleBirds:saleControls.saleBirds,
 saleWeightUnit:saleControls.saleWeightUnit,saleWeight:saleControls.saleWeight,
 saleAvgWeight:saleControls.saleAvgWeight,salePrice:saleControls.salePrice,
 saleDate:saleControls.saleDate,saleBuyer:saleControls.saleBuyer,
 cyc:id=>db.cycles.find(c=>c.id===id),
 getCycleCurrency:()=> 'SAR',requireActionForRecord:()=>true,
 isPastOrToday:(date,asOf)=>!date||date<=asOf,
 deadTotal:(c,asOf)=>db.daily.filter(d=>d.cycleId===c.id&&d.date<=asOf).reduce((n,d)=>n+d.dead,0),
 cullTotal:(c,asOf)=>db.daily.filter(d=>d.cycleId===c.id&&d.date<=asOf).reduce((n,d)=>n+d.cull,0),
 soldBirdsAtDate:(c,asOf)=>db.sales.filter(v=>v.cycleId===c.id&&v.date<=asOf).reduce((n,v)=>n+v.birds,0),
 audit:(_op,_type,id)=>db.auditLog.push({id}),
 refreshFinancialSnapshot:()=>{},clearEdit:()=>{},save:()=>{persists++},
 updateSaleWeightUnitUI:()=>{},alert:message=>saleAlerts.push(message),Date});
vm.runInContext(SOURCE.sale+'\nthis.postSale=addSale;',saleCtx);
function actualSale(c,date,birds,kg,price,buyer,snapshot){
 saleControls.saleCycle.value=c.id;
 saleControls.saleBirds.value=String(birds);
 saleControls.saleWeightUnit.value='kg';
 saleControls.saleWeight.value=String(kg);
 saleControls.salePrice.value=String(price);
 saleControls.saleDate.value=date;
 saleControls.saleBuyer.value=buyer;
 const before=db.sales.length;
 saleCtx.postSale();
 assert.equal(db.sales.length,before+1,
  'Actual addSale handler rejected '+c.id+': '+saleAlerts.at(-1));
 const posted=db.sales.at(-1);
 assert.equal(posted.birds,birds);
 assert.equal(posted.weightKg,kg);
 posted.v410Snapshot=snapshot;
 return posted;
}

for(const farm of farms){
 const cycles=cyclesOf(farm);
 for(const c of cycles){
  const issuedAt=dateAdd(farm.first,20);
  const issueKey=c.id;
  // Valid same-day TWO starter disbursements must both be accepted.
  issue(farm.id,c.id,'feed','بادي',4000,issueKey+'-STARTER-A',issuedAt);
  issue(farm.id,c.id,'feed','بادي',8000,issueKey+'-STARTER-B',issuedAt);
  issue(farm.id,c.id,'feed','نامي',28000,issueKey+'-GROWER',dateAdd(farm.first,25));
  issue(farm.id,c.id,'feed','ناهي',24000,issueKey+'-FINISHER',dateAdd(farm.first,34));
  issue(farm.id,c.id,'med','فيتامينات',50,issueKey+'-VIT',dateAdd(farm.first,10));
  issue(farm.id,c.id,'vaccine','لقاحات',20000,issueKey+'-VAX',dateAdd(farm.first,4));
  issue(farm.id,c.id,'disinfectant','مطهر مياه',150,issueKey+'-DIS',dateAdd(farm.first,12));
  issue(farm.id,c.id,'bedding','نشارة',4000,issueKey+'-BED',dateAdd(farm.first,1));
  const quantityForDay=(total,day,dayWeights)=>{
   const all=dayWeights.reduce((x,y)=>x+y,0);
   const before=Math.round(total*dayWeights.slice(0,day).reduce((x,y)=>x+y,0)/all);
   const after=Math.round(total*dayWeights.slice(0,day+1).reduce((x,y)=>x+y,0)/all);
   return after-before;
  };
  const dayWeights=Array.from({length:42},(_,i)=>100+65*i);
  for(let day=0;day<42;day++){
   // 600 dead + 100 cull by the end of 42 days.
   const dead=Math.floor(600/42)+(day<600%42?1:0);
   const cull=Math.floor(100/42)+(day<100%42?1:0);
   const dailyFeed=quantityForDay(64000,day,dayWeights);
   db.daily.push({id:uuid(),cycleId:c.id,date:dateAdd(farm.first,day),
    dead,cull,feed:dailyFeed,water:round(dailyFeed*1.92),weight:round(0.042+2.108*day/41),
    temp:day<14?round(33-day*0.4):27,humidity:58,
    notes:'بيانات دورة اختبارية وليست سجلات مزرعة حقيقية'});
  }
  db.weights.push({id:uuid(),cycleId:c.id,date:dateAdd(farm.first,41),
   avg:2.15,sample:100,total:215,cv:9.4});
  // Two partial/complete harvests with individually frozen historical sale costs.
  // Use the real in-app addSale() handler, not fabricated records injected into db.sales.
  actualSale(c,dateAdd(farm.first,39),9000,17460,7.4,'مشتري تجريبي أ',
    {cost:97000,margin:32204});
  actualSale(c,dateAdd(farm.first,41),10300,22145,7.6,'مشتري تجريبي ب',
    {cost:109840,margin:58462});
 }
}
assert.equal(db.daily.length,168,'42 daily records in each of 4 houses');
assert.equal(db.sales.length,8,'Two sales via real UI save handler per house');
const beforeOversale=db.sales.length;
actualOversale();
function actualOversale(){
 const c=db.cycles[0];
 saleControls.saleCycle.value=c.id;
 saleControls.saleBirds.value='1';
 saleControls.saleWeightUnit.value='kg';
 saleControls.saleWeight.value='2.1';
 saleControls.salePrice.value='7.5';
 saleControls.saleDate.value=c.endedAt;
 saleControls.saleBuyer.value='QA invalid over-sale';
 saleCtx.postSale();
 assert.equal(db.sales.length,beforeOversale,'Cannot sell a bird not available after final harvest');
 assert.match(saleAlerts.at(-1),/أكبر من الحي المتاح/);
}
assert.equal(db.v410.movements.length,32,'8 distinct stock issues per cycle');
assert.equal(new Set(db.v410.movements.map(x=>x.farmId+'|'+x.operationRef)).size,32);
const frozenSaleState=JSON.stringify(db.sales);
// Execute the real app's occupancy ledger with actual 42-day mortality and
// partial sales, not a hand-written "20000 - 700 - 19300" stand-in.
const liveCtx=vm.createContext({db,
 isPastOrToday:(date,asOf)=>!date||date<=asOf,
 saleRowBirds:(_cycle,sale)=>sale.birds});
vm.runInContext(SOURCE.live+'\nthis.actualLive=liveBreakdown;',liveCtx);
for(const c of db.cycles){
 const live=liveCtx.actualLive(c,c.endedAt);
 assert.deepEqual([live.received,live.dead,live.cull,live.sold,live.live,live.raw],
  [20000,600,100,19300,0,0],
  'Real liveBreakdown must reconcile EVERY bird for each house');
 const daily=db.daily.filter(x=>x.cycleId===c.id),sales=db.sales.filter(x=>x.cycleId===c.id);
 assert.equal(daily.reduce((n,d)=>n+d.dead,0),600);
 assert.equal(daily.reduce((n,d)=>n+d.cull,0),100);
 assert.equal(daily.reduce((n,d)=>n+d.feed,0),64000);
 assert.equal(sales.reduce((n,s)=>n+s.birds,0),19300);
 assert.equal(20000-600-100-19300,0,'End of cycle has NO birds outstanding');
 assert.equal(db.feed.filter(x=>x.cycleId===c.id).reduce((n,r)=>n+r.qty,0),64000);
 assert.equal(db.feed.filter(x=>x.cycleId===c.id).reduce((n,r)=>n+r.qty*r.price,0),113280);
 assert.equal(db.meds.filter(x=>x.cycleId===c.id).reduce((n,r)=>n+r.cost,0),11700);
 assert.equal(db.finance[c.id].chicks,43460);
 const extraDirect=c.houseId.endsWith('-H1')?1050:650;
 assert.equal(db.finance[c.id].expenses.reduce((n,r)=>n+r.amount,0),15900+extraDirect,
  'Direct house costs include every original invoice kind, plus one bedding stock issue');
}
for(const lot of db.v410.lots){
 assert.equal(originalLotQuantity.get(lot.id),lot.qty,'Purchase invoice quantity must never be changed');
 assert(balance(lot)>=0,'No stock negative');
 const perFarmRemaining={feed:{بادي:2000,نامي:2000,ناهي:2000},med:{فيتامينات:100},
  vaccine:{لقاحات:2000},disinfectant:{'مطهر مياه':100},bedding:{نشارة:1000}};
 assert.equal(balance(lot),perFarmRemaining[lot.kind][lot.item]);
}
const srcInvoice=docs.find(d=>d.farmId===farms[0].id&&d.invoice.endsWith('-VET'));
assert(srcInvoice.lines[0].vat.tax>0&&srcInvoice.lines[0].vat.recoverable===0,'Medicine VAT is NONrecoverable');
const stockWorth=db.v410.lots.reduce((sum,l)=>sum+round(balance(l)*l.unitCost),0);
assert.equal(round(stockWorth),47440,'Remaining unconsumed inventory is an asset, not an extra cycle cost');
assert.deepEqual(accounting.validateLedger(db),[]);
for(const farm of farms){
 const ids=cyclesOf(farm).map(c=>c.id),asset=db.v410.assets.find(a=>a.farmId===farm.id);
 for(const month of ['2026-08','2026-09']){
  const posting=accounting.postDepreciation(db,{assetId:asset.id,month,cycleIds:ids,method:'equal'},ctx);
  assert.equal(posting.amount,2000);
 }
 assert.throws(()=>accounting.postDepreciation(db,{assetId:asset.id,month:'2026-09',cycleIds:ids},ctx),/DUPLICATE_DEPRECIATION/);
}
assert.equal(db.v410.depreciationPostings.length,4);
assert.deepEqual(accounting.validateLedger(db),[]);
// Try genuinely invalid actions with real stock issue handler BEFORE closure.
const sample=db.cycles[0],firstFarm=farms[0],sameLot=lotFor(firstFarm.id,'feed','بادي');
refuse('duplicate issue ref',()=>{
 selectedFarm=firstFarm.id;
 controls['pfm-v8-issue-cycle'].value=sample.id;
 controls['pfm-v8-issue-lot'].value=sameLot.id;
 controls['pfm-v8-issue-qty'].value='1';
 controls['pfm-v8-issue-date'].value=dateAdd(firstFarm.first,20);
 controls['pfm-v8-issue-ref'].value=sample.id+'-STARTER-A';
 issueCtx.writeIssue();
},/رقم إذن الصرف مسجل بالفعل/);
refuse('overdraw inventory',()=>{
 controls['pfm-v8-issue-ref'].value='INVALID-OVERDRAW';
 controls['pfm-v8-issue-qty'].value='999999';
 issueCtx.writeIssue();
},/تتجاوز الرصيد/);
refuse('foreign farm lot',()=>{
 controls['pfm-v8-issue-ref'].value='INVALID-FOREIGN-FARM';
 controls['pfm-v8-issue-qty'].value='1';
 controls['pfm-v8-issue-lot'].value=lotFor(farms[1].id,'feed','بادي').id;
 issueCtx.writeIssue();
},/نفس المزرعة/);
assert.throws(()=>accounting.allocate(db,{farmId:farms[0].id,cycleIds:[db.cycles[0].id,db.cycles[2].id],amount:10}),/Cross-farm/);
// Finance real application formulas, not a reimplementation.
const dateFinal='2026-10-22';
const virtualContext={
 db,window:{PFMV81Accounting:accounting},financeDraftExpenses:{},today:()=>dateFinal,
 cycleMetricDate:c=>c.endedAt,isPastOrToday:(date,asOf=dateFinal)=>!date||date<=asOf,
 saleRowBirds:(_c,s)=>s.birds,
 saleWeightKg:(_c,s)=>s.weightKg,pfm81SaleWeightProblem:(_c,s)=>s.weightUnit==='bird'&&Number(s.avgWeight)>8,
 saleRowRevenue:s=>s.total,
 deadTotal:c=>db.daily.filter(d=>d.cycleId===c.id&&d.date<=c.endedAt).reduce((n,d)=>n+d.dead,0),
 cullTotal:c=>db.daily.filter(d=>d.cycleId===c.id&&d.date<=c.endedAt).reduce((n,d)=>n+d.cull,0),
 liveAtDate:c=>Math.max(0,c.birds-700-db.sales.filter(s=>s.cycleId===c.id).reduce((n,s)=>n+s.birds,0)),
 liveSource:c=>({received:c.birds,dead:600,cull:100,sold:19300,live:0,raw:0}),
 feedForFcr:c=>db.daily.filter(d=>d.cycleId===c.id).reduce((n,d)=>n+d.feed,0),
 performanceWeight:()=>2.15,age:()=>42,getCycleCurrency:()=> 'SAR',
 financeExpenseTotal:f=>(f.expenses||[]).reduce((n,x)=>n+x.amount,0)
};
const cc=vm.createContext(virtualContext);
vm.runInContext(SOURCE.calc+'\nthis.actualCalc=calc;',cc);
const beforeCalc=JSON.stringify(db),computed={};
for(const c of db.cycles){
 const p=cc.actualCalc(c);computed[c.id]=p;
 assert.equal(p.dead,600);assert.equal(p.cul,100);assert.equal(p.liv,0);
 assert.equal(p.soldBirds,19300);
 assert.equal(p.feed,64000);
 assert.equal(p.fc,113280);
 assert.equal(p.meds,11700);
 assert.equal(p.expenseTotal,15900+(c.houseId.endsWith('-H1')?1050:650));
 assert.equal(p.sharedCost,20500);
 assert.equal(p.depreciationCost,2000);
 assert.equal(p.cost,c.houseId.endsWith('-H1')?207890:207490,'Independent expected cost per house');
 assert.equal(p.rev,297506,'Independent expected revenue per house');
 assert.equal(p.profit,c.houseId.endsWith('-H1')?89616:90016);
 assert.equal(round(p.fcr),1.62,'Plausible FCR including sold weight');
 assert.equal(round(p.costPerKg),round(p.cost/39605));
 assert.equal(round(p.costPerBird),round(p.cost/19300));
}
assert.equal(JSON.stringify(db),beforeCalc,'Calc must not mutate fixture or frozen sales');
function exportQA(destination){
 const filepath=path.resolve(destination);
 fs.mkdirSync(path.dirname(filepath),{recursive:true});
 // This JSON is a realistic but FICTIONAL dataset. Import would REPLACE
 // current data, so ONLY use in a disposable, offline QA profile.
 fs.writeFileSync(filepath,JSON.stringify(db,null,2));
 console.log('Exported FICTIONAL QA backup (DANGER: importing replaces account data): '+filepath);
}
if(process.argv[2]==='--export-open')exportQA(process.argv[3]||'PFM_V81_TWO_FARMS_80K_OPEN_QA.json');
assert.equal(Object.values(computed).reduce((n,p)=>n+p.cost,0),830760);
assert.equal(Object.values(computed).reduce((n,p)=>n+p.rev,0),1190024);
assert.equal(Object.values(computed).reduce((n,p)=>n+p.profit,0),359264);
// Actual closeCycle() with its existing totalFrozen and available-bird guards.
const closes=[],notifications=[];
let selectedCycle=db.cycles[0].id;
const closeCtx=vm.createContext({db,currentUser:{id:'QA-FICTIONAL-OWNER'},
 cid:()=>selectedCycle,cyc:id=>db.cycles.find(c=>c.id===id),
 userCan:()=>true,permit:()=>true,financialLive:()=>0,v:()=>db.v410,
 money:round,calc:c=>cc.actualCalc(c),totalFrozen:id=>db.sales.filter(x=>x.cycleId===id).reduce((n,x)=>n+x.v410Snapshot.cost,0),
 legacyCount:()=>0,$:()=>({value:'QA reconciliation: 0 birds; remaining stock is unissued purchase inventory'}),
 out:(ar,en)=>notifications.push(en),E:(ar,en)=>en,confirm:()=>true,
 track:(...values)=>closes.push(values),save:()=>{persists++},
 window:{PFMV81Accounting:accounting},Date
});
vm.runInContext(SOURCE.close+'\nthis.actualClose=closeCycle;',closeCtx);
const closesBefore=JSON.stringify(db.v410.close);
db.v410.sharedExpenses[0].allocations[0].amount+=1;
closeCtx.actualClose();
assert.equal(JSON.stringify(db.v410.close),closesBefore,'Unbalanced shared allocation must block close');
db.v410.sharedExpenses[0].allocations[0].amount-=1;
for(const c of db.cycles){
 selectedCycle=c.id;closeCtx.actualClose();
 assert.equal(db.v410.close[c.id].status,'closed');
 assert.equal(db.v410.close[c.id].cost,c.houseId.endsWith('-H1')?207890:207490);
 assert.equal(db.v410.close[c.id].profit,c.houseId.endsWith('-H1')?89616:90016);
}
assert.equal(closes.length,4,'Each house closes precisely once');
assert.equal(JSON.stringify(db.sales),frozenSaleState,'Partial sales frozen costs remain unchanged');
assert.equal(db.v410.purchaseDocuments.length,34,'No duplicated source invoices by closing');
assert.equal(db.v410.movements.length,32,'No duplicated stock charges by closing');
assert.deepEqual(accounting.validateLedger(db),[]);
assert.throws(()=>accounting.allocate(db,{farmId:farms[0].id,cycleIds:[db.cycles[0].id],amount:10}),/closed/);
refuse('issue closed cycle',()=>{
 selectedFarm=farms[0].id;
 controls['pfm-v8-issue-cycle'].value=db.cycles[0].id;
 controls['pfm-v8-issue-lot'].value=sameLot.id;
 controls['pfm-v8-issue-qty'].value='1';
 controls['pfm-v8-issue-date'].value=dateAdd(firstFarm.first,21);
 controls['pfm-v8-issue-ref'].value='QA-NEW-AFTER-CLOSE';
 issueCtx.writeIssue();
},/الدورة مغلقة مالياً|الدورة مغلقة ماليًا/);
const byFarm=farms.map(f=>{
 const ccFarm=cyclesOf(f).map(c=>computed[c.id]);
 return {farm:f.name,houses:2,placed:40000,dead:1200,culled:200,sold:38600,
  feedKg:128000,invoices:docs.filter(d=>d.farmId===f.id).length,
  costs:ccFarm.reduce((n,p)=>n+p.cost,0),revenue:ccFarm.reduce((n,p)=>n+p.rev,0),
  profit:ccFarm.reduce((n,p)=>n+p.profit,0)};
});
assert.deepEqual(byFarm.map(x=>[x.costs,x.revenue,x.profit]),[[415380,595012,179632],[415380,595012,179632]]);
if(process.argv[2]==='--export-closed'||process.argv[2]==='--export')
 exportQA(process.argv[3]||'PFM_V81_TWO_FARMS_80K_CLOSED_QA.json');
console.log('PASS 80K TWO-FARM acceptance: 2 farms, 4 houses, 20,000 DOC each, 168 daily entries, 34 supplier invoices (ALL supported expense categories), 32 stock issues, mixed VAT, 8 partial sales, 4 depreciation postings, 4 financial closes.');
console.log('COST 830,760 SAR; REVENUE 1,190,024 SAR; PROFIT 359,264 SAR; purchased unused stock remains 47,440 SAR and is NOT expensed.');
console.log('DISCLAIMER: Realistic SYNTHETIC test data, never real customer/farm records. No device installation or cloud sync executed.');
